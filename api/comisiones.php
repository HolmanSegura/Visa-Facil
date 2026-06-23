<?php
/* ============================================================
   API/COMISIONES.PHP
   Configuración y reporte de comisiones.

   GET  /api/comisiones.php                → config completa
   PUT  /api/comisiones.php                → guardar config completa
   GET  /api/comisiones.php?reporte=1      → reporte calculado
       ?desde=YYYY-MM-DD &hasta=YYYY-MM-DD &usuario_id=N
   ============================================================ */

require_once __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];

try {
    $db = getDB();

    // ── GET config ───────────────────────────────────────────
    if ($method === 'GET' && empty($_GET['reporte'])) {
        $asesores = $db->query("
            SELECT ca.id, ca.porcentaje, ca.base, ca.activo,
                   u.id AS usuario_id, u.nombre AS responsable
            FROM config_comisiones_asesores ca
            JOIN usuarios u ON u.id = ca.usuario_id
            ORDER BY u.nombre
        ")->fetchAll();

        $productos = $db->query("
            SELECT cp.*, p.nombre AS producto_nombre_catalogo
            FROM config_comisiones_productos cp
            LEFT JOIN productos p ON p.id = cp.producto_id
            ORDER BY cp.nombre_producto
        ")->fetchAll();

        jsonResponse([
            'ok'         => true,
            'porAsesor'  => $asesores,
            'porProducto'=> $productos,
        ]);
    }

    // ── GET reporte ──────────────────────────────────────────
    if ($method === 'GET' && !empty($_GET['reporte'])) {
        $desde      = $_GET['desde']      ?? date('Y-01-01');
        $hasta      = $_GET['hasta']      ?? date('Y-m-d');
        $usuarioId  = !empty($_GET['usuario_id']) ? (int) $_GET['usuario_id'] : null;

        /*
         * Fuente de verdad: movimientos_caja tipo=gasto, categoria=comisiones.
         *
         * Estado 'pendiente' → comisión devengada (factura HubSpot pagada, aún no
         *                       transferida al asesor). Creado automáticamente por
         *                       api/hubspot-webhook.php.
         * Estado 'pagado'    → comisión ya transferida al asesor.
         *
         * teorico    = devengado total (pendiente + pagado)
         * registrado = sólo lo ya pagado al asesor
         */
        $sqlCom = "
            SELECT m.responsable_id,
                   SUM(m.valor)                                  AS total_devengado,
                   SUM(IF(m.estado = 'pagado', m.valor, 0))      AS total_pagado,
                   COUNT(*)                                       AS n_total,
                   COUNT(IF(m.estado = 'pagado', 1, NULL))       AS n_pagados
            FROM movimientos_caja m
            JOIN categorias_caja cat ON cat.id = m.categoria_id
            WHERE cat.valor = 'comisiones'
              AND m.tipo = 'gasto'
              AND m.fecha BETWEEN ? AND ?
              AND m.deleted_at IS NULL
        ";
        $paramsC = [$desde, $hasta];
        if ($usuarioId) { $sqlCom .= " AND m.responsable_id = ?"; $paramsC[] = $usuarioId; }
        $sqlCom .= " GROUP BY m.responsable_id";
        $stmtC = $db->prepare($sqlCom);
        $stmtC->execute($paramsC);
        $comisionesPorAsesor = [];
        foreach ($stmtC->fetchAll() as $r) {
            $comisionesPorAsesor[$r['responsable_id']] = [
                'devengado' => (float) $r['total_devengado'],
                'pagado'    => (float) $r['total_pagado'],
                'total'     => (int)   $r['n_total'],
                'pagados'   => (int)   $r['n_pagados'],
            ];
        }

        // Config de comisiones
        $configs = $db->query("SELECT * FROM config_comisiones_asesores")->fetchAll();
        $configMap = [];
        foreach ($configs as $c) { $configMap[$c['usuario_id']] = $c; }

        // Todos los asesores con actividad en el período
        $stmtU = $db->query("SELECT id, nombre FROM usuarios WHERE deleted_at IS NULL ORDER BY nombre");
        $filas = [];
        foreach ($stmtU->fetchAll() as $u) {
            $uid = (int) $u['id'];
            $com = $comisionesPorAsesor[$uid] ?? null;
            if (!$com) continue;

            $cfg      = $configMap[$uid] ?? null;
            $pct      = $cfg ? (float) $cfg['porcentaje'] : 0;
            $activo   = $cfg ? (bool)  $cfg['activo']     : true;
            $teorico  = $com['devengado'];
            $registrado = $com['pagado'];
            // ingresos aproximado: si porcentaje > 0, inferir base; si no, 0
            $ingresos = ($pct > 0) ? round($teorico / ($pct / 100)) : 0;

            $filas[] = [
                'usuario_id'  => $uid,
                'responsable' => $u['nombre'],
                'activo'      => $activo,
                'ingresos'    => $ingresos,
                'porcentaje'  => $pct,
                'teorico'     => round($teorico, 2),
                'registrado'  => round($registrado, 2),
                'pagos'       => $com['pagados'],
                'diferencia'  => round($registrado - $teorico, 2),
            ];
        }

        usort($filas, function($a, $b) { return $b['registrado'] <=> $a['registrado']; });

        jsonResponse([
            'ok'    => true,
            'desde' => $desde,
            'hasta' => $hasta,
            'filas' => $filas,
        ]);
    }

    // ── PUT (guardar config completa) ────────────────────────
    if ($method === 'PUT') {
        $b = getBody();

        $db->beginTransaction();

        if (isset($b['porAsesor']) && is_array($b['porAsesor'])) {
            $stmt = $db->prepare("
                INSERT INTO config_comisiones_asesores (usuario_id, porcentaje, base, activo)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                  porcentaje = VALUES(porcentaje),
                  base       = VALUES(base),
                  activo     = VALUES(activo),
                  updated_at = NOW()
            ");
            foreach ($b['porAsesor'] as $a) {
                if (empty($a['usuario_id']) && !empty($a['responsable'])) {
                    $s = $db->prepare("SELECT id FROM usuarios WHERE nombre = ? LIMIT 1");
                    $s->execute([$a['responsable']]);
                    $r = $s->fetch();
                    $a['usuario_id'] = $r ? $r['id'] : null;
                }
                if (empty($a['usuario_id'])) continue;
                $stmt->execute([
                    $a['usuario_id'],
                    $a['porcentaje'] ?? 5,
                    $a['base']       ?? 'ingresos',
                    isset($a['activo']) ? (int)(bool)$a['activo'] : 1,
                ]);
            }
        }

        if (isset($b['porProducto']) && is_array($b['porProducto'])) {
            $db->exec("DELETE FROM config_comisiones_productos");
            $stmt = $db->prepare("
                INSERT INTO config_comisiones_productos
                  (producto_id, hubspot_product_id, nombre_producto, porcentaje)
                VALUES (?, ?, ?, ?)
            ");
            foreach ($b['porProducto'] as $p) {
                $stmt->execute([
                    $p['producto_id']        ?? null,
                    $p['hubspot_product_id'] ?? $p['productoId'] ?? null,
                    $p['nombre_producto']    ?? $p['producto']   ?? '',
                    $p['porcentaje']         ?? 5,
                ]);
            }
        }

        $db->commit();
        jsonResponse(['ok' => true]);
    }

    errorResponse('Método no soportado', 405);

} catch (PDOException $e) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    error_log('[comisiones.php] ' . $e->getMessage());
    errorResponse('Error de base de datos', 500);
}
