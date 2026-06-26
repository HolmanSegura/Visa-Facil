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
         * Comisiones: fuente = movimientos_caja tipo=gasto, categoria=comisiones.
         *   pendiente → devengada (factura HubSpot pagada, no transferida aún)
         *   pagado    → ya transferida al asesor
         *
         * Ventas: fuente = ingresos_factura (todos los métodos de pago).
         *   Permite mostrar la base real de comisión sin back-calcular.
         */

        // Comisiones devengadas y pagadas
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

        // Ventas reales por asesor desde ingresos_factura
        $sqlIng = "
            SELECT asesor_id,
                   SUM(monto)                                         AS total_ventas,
                   SUM(IF(metodo_pago = 'efectivo', monto, 0))        AS ventas_efectivo,
                   SUM(IF(metodo_pago != 'efectivo', monto, 0))       AS ventas_no_efectivo,
                   COUNT(*)                                           AS n_facturas
            FROM ingresos_factura
            WHERE estado = 'activo'
              AND fecha_pago BETWEEN ? AND ?
        ";
        $paramsI = [$desde, $hasta];
        if ($usuarioId) { $sqlIng .= " AND asesor_id = ?"; $paramsI[] = $usuarioId; }
        $sqlIng .= " GROUP BY asesor_id";
        $stmtI = $db->prepare($sqlIng);
        $stmtI->execute($paramsI);
        $ventasPorAsesor = [];
        foreach ($stmtI->fetchAll() as $r) {
            $ventasPorAsesor[$r['asesor_id']] = [
                'total'          => (float) $r['total_ventas'],
                'efectivo'       => (float) $r['ventas_efectivo'],
                'no_efectivo'    => (float) $r['ventas_no_efectivo'],
                'n_facturas'     => (int)   $r['n_facturas'],
            ];
        }

        // Config de comisiones
        $configs = $db->query("SELECT * FROM config_comisiones_asesores")->fetchAll();
        $configMap = [];
        foreach ($configs as $c) { $configMap[$c['usuario_id']] = $c; }

        // Combinar: mostrar asesores con comisiones Y/O ventas en el período
        $stmtU = $db->query("SELECT id, nombre FROM usuarios WHERE deleted_at IS NULL ORDER BY nombre");
        $filas = [];
        foreach ($stmtU->fetchAll() as $u) {
            $uid  = (int) $u['id'];
            $com  = $comisionesPorAsesor[$uid] ?? null;
            $vtas = $ventasPorAsesor[$uid]     ?? null;
            if (!$com && !$vtas) continue;

            $cfg        = $configMap[$uid] ?? null;
            $pct        = $cfg ? (float) $cfg['porcentaje'] : 0;
            $activo     = $cfg ? (bool)  $cfg['activo']     : true;
            $teorico    = $com ? $com['devengado'] : 0;
            $registrado = $com ? $com['pagado']    : 0;

            // Ventas reales desde ingresos_factura; fallback a back-cálculo si no hay datos aún
            $ingresos = $vtas
                ? $vtas['total']
                : (($pct > 0 && $teorico > 0) ? round($teorico / ($pct / 100)) : 0);

            $filas[] = [
                'usuario_id'      => $uid,
                'responsable'     => $u['nombre'],
                'activo'          => $activo,
                'ingresos'        => round($ingresos, 2),
                'ventas_efectivo' => round($vtas ? $vtas['efectivo']    : 0, 2),
                'ventas_otros'    => round($vtas ? $vtas['no_efectivo'] : 0, 2),
                'n_facturas'      => $vtas ? $vtas['n_facturas'] : 0,
                'porcentaje'      => $pct,
                'teorico'         => round($teorico, 2),
                'registrado'      => round($registrado, 2),
                'pagos'           => $com ? $com['pagados'] : 0,
                'diferencia'      => round($registrado - $teorico, 2),
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

    // ── GET facturas con comisión sugerida y ajuste vigente ──
    if ($method === 'GET' && !empty($_GET['ajustes'])) {
        $desde     = $_GET['desde']      ?? date('Y-01-01');
        $hasta     = $_GET['hasta']      ?? date('Y-m-d');
        $usuarioId = !empty($_GET['asesor_id']) ? (int) $_GET['asesor_id'] : null;

        $sql = "
            SELECT inf.id,
                   inf.hubspot_inv_id,
                   inf.referencia,
                   inf.fecha_pago,
                   inf.monto,
                   inf.moneda,
                   inf.metodo_pago,
                   inf.titulo,
                   inf.asesor_id,
                   u.nombre                                         AS asesor,
                   cca.porcentaje,
                   ROUND(inf.monto * COALESCE(cca.porcentaje, 0) / 100, 0)  AS comision_sugerida,
                   (SELECT ca.comision_ajustada
                      FROM comisiones_ajustes ca
                     WHERE ca.ingreso_factura_id = inf.id
                     ORDER BY ca.created_at DESC LIMIT 1)           AS comision_ajustada,
                   (SELECT ca.created_at
                      FROM comisiones_ajustes ca
                     WHERE ca.ingreso_factura_id = inf.id
                     ORDER BY ca.created_at DESC LIMIT 1)           AS ultimo_ajuste_at,
                   (SELECT COUNT(*)
                      FROM comisiones_ajustes ca
                     WHERE ca.ingreso_factura_id = inf.id)          AS n_ajustes
            FROM ingresos_factura inf
            LEFT JOIN usuarios u                   ON u.id   = inf.asesor_id
            LEFT JOIN config_comisiones_asesores cca
                   ON cca.usuario_id = inf.asesor_id AND cca.activo = 1
            WHERE inf.estado = 'activo'
              AND inf.fecha_pago BETWEEN :desde AND :hasta
        ";
        $params = [':desde' => $desde, ':hasta' => $hasta];
        if ($usuarioId) { $sql .= " AND inf.asesor_id = :asesor"; $params[':asesor'] = $usuarioId; }
        $sql .= " ORDER BY inf.fecha_pago DESC, inf.id DESC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        jsonResponse(['ok' => true, 'desde' => $desde, 'hasta' => $hasta, 'data' => $stmt->fetchAll()]);
    }

    // ── POST ajuste manual de comisión ────────────────────────
    if ($method === 'POST' && !empty($_GET['ajuste'])) {
        $b          = getBody();
        $facturaId  = (int) ($b['ingreso_factura_id'] ?? 0);
        $ajustada   = isset($b['comision_ajustada']) ? (float) $b['comision_ajustada'] : null;
        $motivo     = trim($b['motivo'] ?? '');
        $usuarioId  = !empty($b['usuario_id']) ? (int) $b['usuario_id'] : null;

        if (!$facturaId)      errorResponse('ingreso_factura_id requerido', 400);
        if ($ajustada === null || $ajustada < 0) errorResponse('comision_ajustada debe ser >= 0', 400);

        // Leer estado actual
        $stmtI = $db->prepare("
            SELECT inf.monto,
                   COALESCE(cca.porcentaje, 0) AS porcentaje,
                   (SELECT ca.comision_ajustada
                      FROM comisiones_ajustes ca
                     WHERE ca.ingreso_factura_id = inf.id
                     ORDER BY ca.created_at DESC LIMIT 1) AS ultima
            FROM ingresos_factura inf
            LEFT JOIN config_comisiones_asesores cca
                   ON cca.usuario_id = inf.asesor_id AND cca.activo = 1
            WHERE inf.id = ?
        ");
        $stmtI->execute([$facturaId]);
        $row = $stmtI->fetch();
        if (!$row) errorResponse('Factura no encontrada', 404);

        $sugerida = round((float) $row['monto'] * (float) $row['porcentaje'] / 100, 0);
        $anterior = $row['ultima'] !== null ? (float) $row['ultima'] : null;

        $db->prepare("
            INSERT INTO comisiones_ajustes
              (ingreso_factura_id, comision_sugerida, comision_anterior, comision_ajustada, motivo, usuario_id)
            VALUES (?, ?, ?, ?, ?, ?)
        ")->execute([$facturaId, $sugerida, $anterior, $ajustada, $motivo ?: null, $usuarioId]);

        jsonResponse(['ok' => true, 'id' => (int) $db->lastInsertId()]);
    }

    // ── GET historial de ajustes de una factura ───────────────
    if ($method === 'GET' && !empty($_GET['historial'])) {
        $facturaId = (int) ($_GET['factura_id'] ?? 0);
        if (!$facturaId) errorResponse('factura_id requerido', 400);

        $stmt = $db->prepare("
            SELECT ca.id, ca.comision_sugerida, ca.comision_anterior,
                   ca.comision_ajustada, ca.motivo, ca.created_at,
                   u.nombre AS usuario
            FROM comisiones_ajustes ca
            LEFT JOIN usuarios u ON u.id = ca.usuario_id
            WHERE ca.ingreso_factura_id = ?
            ORDER BY ca.created_at DESC
        ");
        $stmt->execute([$facturaId]);
        jsonResponse(['ok' => true, 'data' => $stmt->fetchAll()]);
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
