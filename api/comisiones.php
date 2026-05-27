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

        // Ingresos por asesor en el período
        $sqlIngresos = "
            SELECT m.responsable_id, SUM(m.valor) AS total_ingresos
            FROM movimientos_caja m
            WHERE m.tipo = 'ingreso'
              AND m.estado = 'pagado'
              AND m.fecha BETWEEN ? AND ?
              AND m.deleted_at IS NULL
        ";
        $paramsI = [$desde, $hasta];
        if ($usuarioId) { $sqlIngresos .= " AND m.responsable_id = ?"; $paramsI[] = $usuarioId; }
        $sqlIngresos .= " GROUP BY m.responsable_id";
        $stmtI = $db->prepare($sqlIngresos);
        $stmtI->execute($paramsI);
        $ingresosPorAsesor = [];
        foreach ($stmtI->fetchAll() as $r) {
            $ingresosPorAsesor[$r['responsable_id']] = (float) $r['total_ingresos'];
        }

        // Comisiones ya registradas como gasto categoría "comisiones"
        $sqlRegistradas = "
            SELECT m.responsable_id, SUM(m.valor) AS total_registrado, COUNT(*) AS n_pagos
            FROM movimientos_caja m
            JOIN categorias_caja cat ON cat.id = m.categoria_id
            WHERE cat.valor = 'comisiones'
              AND m.tipo = 'gasto'
              AND m.fecha BETWEEN ? AND ?
              AND m.deleted_at IS NULL
        ";
        $paramsR = [$desde, $hasta];
        if ($usuarioId) { $sqlRegistradas .= " AND m.responsable_id = ?"; $paramsR[] = $usuarioId; }
        $sqlRegistradas .= " GROUP BY m.responsable_id";
        $stmtR = $db->prepare($sqlRegistradas);
        $stmtR->execute($paramsR);
        $registradasPorAsesor = [];
        foreach ($stmtR->fetchAll() as $r) {
            $registradasPorAsesor[$r['responsable_id']] = [
                'total'  => (float) $r['total_registrado'],
                'pagos'  => (int)   $r['n_pagos'],
            ];
        }

        // Config de comisiones
        $configs = $db->query("SELECT * FROM config_comisiones_asesores")->fetchAll();
        $configMap = [];
        foreach ($configs as $c) { $configMap[$c['usuario_id']] = $c; }

        // Todos los asesores con actividad
        $stmtU = $db->query("SELECT id, nombre FROM usuarios WHERE deleted_at IS NULL ORDER BY nombre");
        $filas = [];
        foreach ($stmtU->fetchAll() as $u) {
            $uid      = (int) $u['id'];
            $ingresos = $ingresosPorAsesor[$uid]   ?? 0;
            $reg      = $registradasPorAsesor[$uid] ?? ['total' => 0, 'pagos' => 0];
            if ($ingresos === 0.0 && $reg['total'] === 0.0) continue;

            $cfg      = $configMap[$uid] ?? null;
            $pct      = $cfg ? (float) $cfg['porcentaje'] : 0;
            $activo   = $cfg ? (bool)  $cfg['activo']     : true;
            $teorico  = round($ingresos * $pct / 100, 2);

            $filas[] = [
                'usuario_id'  => $uid,
                'responsable' => $u['nombre'],
                'activo'      => $activo,
                'ingresos'    => $ingresos,
                'porcentaje'  => $pct,
                'teorico'     => $teorico,
                'registrado'  => $reg['total'],
                'pagos'       => $reg['pagos'],
                'diferencia'  => round($reg['total'] - $teorico, 2),
            ];
        }

        usort($filas, fn($a, $b) => $b['registrado'] <=> $a['registrado']);

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
