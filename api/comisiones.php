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
    if ($method === 'GET' && empty($_GET['reporte']) && empty($_GET['ajustes']) && empty($_GET['historial'])) {
        $asesores = $db->query("
            SELECT
                ca.id,
                ca.usuario_id,
                u.nombre AS responsable,
                ca.porcentaje,
                ca.base,
                ca.activo,
                COALESCE(ca.tipo, 'porcentaje') AS tipo_comision,
                COALESCE(ca.valor_fijo, ca.porcentaje, 0) AS valor_comision
            FROM config_comisiones_asesores ca
            JOIN usuarios u ON u.id = ca.usuario_id
            ORDER BY u.nombre
        ")->fetchAll();

        $productos = $db->query("
            SELECT
                cp.id,
                cp.producto_id,
                cp.hubspot_product_id,
                cp.nombre_producto,
                cp.porcentaje,
                p.nombre AS producto_nombre_catalogo,
                COALESCE(cp.tipo, 'porcentaje') AS tipo_comision,
                COALESCE(cp.valor_fijo, cp.porcentaje, 0) AS valor_comision
            FROM config_comisiones_productos cp
            LEFT JOIN productos p ON p.id = cp.producto_id
            WHERE cp.nombre_producto != '__general__'
            ORDER BY cp.nombre_producto
        ")->fetchAll();

        $generalRow = $db->query("
            SELECT
                COALESCE(tipo, 'porcentaje') AS tipo_comision,
                COALESCE(valor_fijo, porcentaje, 0) AS valor_comision
            FROM config_comisiones_productos
            WHERE nombre_producto = '__general__'
            LIMIT 1
        ")->fetch();

        $gTipo  = $generalRow['tipo_comision'] ?? 'porcentaje';
        $gValor = (float) ($generalRow['valor_comision'] ?? 5);

        jsonResponse([
            'ok'                      => true,
            'porAsesor'               => $asesores,
            'porProducto'             => $productos,
            // Tasa general de producto — fallback cuando no hay excepción ni tasa de asesor
            'generalProducto'         => ['tipo_comision' => $gTipo, 'valor_comision' => $gValor],
            'generalProductoTipo'     => $gTipo,
            'generalProductoValor'    => $gValor,
            'generalProductoPorcentaje' => $gTipo === 'porcentaje' ? $gValor : 0,
        ]);
    }

    // ── GET reporte ──────────────────────────────────────────
    if ($method === 'GET' && !empty($_GET['reporte'])) {
        $desde     = $_GET['desde'] ?? date('Y-01-01');
        $hasta     = $_GET['hasta'] ?? date('Y-m-d');
        $usuarioId = !empty($_GET['usuario_id']) ? (int) $_GET['usuario_id'] : null;

        $sqlCom = "
            SELECT
                m.responsable_id,
                SUM(m.valor) AS total_devengado,
                SUM(IF(m.estado = 'pagado', m.valor, 0)) AS total_pagado,
                SUM(IF(m.estado != 'pagado', m.valor, 0)) AS total_pendiente,
                COUNT(*) AS n_total,
                COUNT(IF(m.estado = 'pagado', 1, NULL)) AS n_pagados,
                COUNT(IF(m.estado != 'pagado', 1, NULL)) AS n_pendientes
            FROM movimientos_caja m
            JOIN categorias_caja cat ON cat.id = m.categoria_id
            WHERE cat.valor = 'comisiones'
            AND m.tipo = 'gasto'
            AND m.fecha BETWEEN ? AND ?
            AND m.deleted_at IS NULL
        ";
        $paramsC = [$desde, $hasta];
        if ($usuarioId) {
            $sqlCom .= " AND m.responsable_id = ?";
            $paramsC[] = $usuarioId;
        }
        $sqlCom .= " GROUP BY m.responsable_id";
        $stmtC = $db->prepare($sqlCom);
        $stmtC->execute($paramsC);

        $comisionesPorAsesor = [];
        foreach ($stmtC->fetchAll() as $r) {
            $comisionesPorAsesor[$r['responsable_id']] = [
                'devengado'   => (float) $r['total_devengado'],
                'pagado'      => (float) $r['total_pagado'],
                'pendiente'   => (float) $r['total_pendiente'],
                'total'       => (int) $r['n_total'],
                'pagados'     => (int) $r['n_pagados'],
                'pendientes'  => (int) $r['n_pendientes'],
            ];
        }

        $sqlIng = "
            SELECT
                asesor_id,
                SUM(monto) AS total_ventas,
                SUM(IF(metodo_pago = 'efectivo', monto, 0)) AS ventas_efectivo,
                SUM(IF(metodo_pago != 'efectivo', monto, 0)) AS ventas_no_efectivo,
                COUNT(*) AS n_facturas
            FROM ingresos_factura
            WHERE estado = 'activo'
            AND fecha_pago BETWEEN ? AND ?
        ";
        $paramsI = [$desde, $hasta];
        if ($usuarioId) {
            $sqlIng .= " AND asesor_id = ?";
            $paramsI[] = $usuarioId;
        }
        $sqlIng .= " GROUP BY asesor_id";
        $stmtI = $db->prepare($sqlIng);
        $stmtI->execute($paramsI);

        $ventasPorAsesor = [];
        foreach ($stmtI->fetchAll() as $r) {
            $ventasPorAsesor[$r['asesor_id']] = [
                'total'        => (float) $r['total_ventas'],
                'efectivo'     => (float) $r['ventas_efectivo'],
                'no_efectivo'  => (float) $r['ventas_no_efectivo'],
                'n_facturas'   => (int) $r['n_facturas'],
            ];
        }

        $configs = $db->query("SELECT * FROM config_comisiones_asesores")->fetchAll();
        $configMap = [];
        foreach ($configs as $c) {
            $configMap[$c['usuario_id']] = $c;
        }

        $stmtU = $db->query("SELECT id, nombre FROM usuarios WHERE deleted_at IS NULL ORDER BY nombre");
        $filas = [];

        foreach ($stmtU->fetchAll() as $u) {
            $uid  = (int) $u['id'];
            $com  = $comisionesPorAsesor[$uid] ?? null;
            $vtas = $ventasPorAsesor[$uid] ?? null;

            if (!$com && !$vtas) continue;

            $cfg = $configMap[$uid] ?? null;
            $activo = $cfg ? (bool) $cfg['activo'] : true;
            $tipoComision = $cfg['tipo'] ?? 'porcentaje';
            $valorComision = ($tipoComision === 'fijo' && !empty($cfg['valor_fijo']))
                ? (float) $cfg['valor_fijo']
                : (float) ($cfg['porcentaje'] ?? 0);

            $teorico = $com ? $com['devengado'] : 0;
            $registrado = $com ? $com['pagado'] : 0;
            $pendiente = $com ? $com['pendiente'] : 0;

            $ingresos = $vtas ? $vtas['total'] : 0;

            $filas[] = [
                'usuario_id'        => $uid,
                'responsable'       => $u['nombre'],
                'activo'            => $activo,
                'ingresos'          => round($ingresos, 2),
                'ventas_efectivo'   => round($vtas ? $vtas['efectivo'] : 0, 2),
                'ventas_otros'      => round($vtas ? $vtas['no_efectivo'] : 0, 2),
                'n_facturas'        => $vtas ? $vtas['n_facturas'] : 0,
                'tipo_comision'     => $tipoComision,
                'valor_comision'    => round($valorComision, 2),
                'porcentaje'        => $tipoComision === 'porcentaje' ? round($valorComision, 2) : 0,
                'teorico'           => round($teorico, 2),
                'registrado'        => round($registrado, 2),
                'pendiente'         => round($pendiente, 2),
                'total'             => $com ? $com['total'] : 0,
                'pagos'             => $com ? $com['pagados'] : 0,
                'pendientes_count'  => $com ? $com['pendientes'] : 0,
                'diferencia'        => round($registrado - $teorico, 2),
            ];
        }

        usort($filas, function ($a, $b) {
            return $b['registrado'] <=> $a['registrado'];
        });

        jsonResponse([
            'ok'    => true,
            'desde' => $desde,
            'hasta' => $hasta,
            'filas' => $filas,
        ]);
    }

    // ── GET facturas con comisión sugerida y ajuste vigente ──
    if ($method === 'GET' && !empty($_GET['ajustes'])) {
        $desde     = !empty($_GET['desde']) ? $_GET['desde'] : null;
        $hasta     = !empty($_GET['hasta']) ? $_GET['hasta'] : null;
        $usuarioId = !empty($_GET['asesor_id']) ? (int) $_GET['asesor_id'] : null;

        $sql = "
            SELECT
                inf.id,
                inf.hubspot_inv_id,
                inf.referencia,
                inf.fecha_pago,
                inf.monto,
                inf.moneda,
                inf.metodo_pago,
                inf.titulo,
                inf.asesor_id,
                inf.producto_id,
                inf.producto_nombre,
                u.nombre AS asesor,
                -- Jerarquía: excepción producto > asesor (solo si > 0) > general producto
                CASE
                    WHEN cp.id IS NOT NULL
                        THEN COALESCE(cp.tipo, 'porcentaje')
                    WHEN cca.usuario_id IS NOT NULL AND COALESCE(cca.valor_fijo, cca.porcentaje, 0) > 0
                        THEN COALESCE(cca.tipo, 'porcentaje')
                    ELSE COALESCE(cg.tipo, 'porcentaje')
                END AS tipo_comision,
                CASE
                    WHEN cp.id IS NOT NULL
                        THEN COALESCE(cp.valor_fijo, cp.porcentaje, 0)
                    WHEN cca.usuario_id IS NOT NULL AND COALESCE(cca.valor_fijo, cca.porcentaje, 0) > 0
                        THEN COALESCE(cca.valor_fijo, cca.porcentaje, 0)
                    ELSE COALESCE(cg.valor_fijo, cg.porcentaje, 0)
                END AS valor_comision,
                CASE
                    WHEN cp.id IS NOT NULL
                        THEN COALESCE(cp.valor_fijo, cp.porcentaje, 0)
                    WHEN cca.usuario_id IS NOT NULL AND COALESCE(cca.valor_fijo, cca.porcentaje, 0) > 0
                        THEN COALESCE(cca.valor_fijo, cca.porcentaje, 0)
                    ELSE COALESCE(cg.valor_fijo, cg.porcentaje, 0)
                END AS porcentaje,
                CASE
                    WHEN cp.id IS NOT NULL AND COALESCE(cp.tipo, 'porcentaje') = 'fijo'
                        THEN ROUND(COALESCE(cp.valor_fijo, 0), 0)
                    WHEN cp.id IS NOT NULL
                        THEN ROUND(inf.monto * COALESCE(cp.valor_fijo, cp.porcentaje, 0) / 100, 0)
                    WHEN cca.usuario_id IS NOT NULL AND COALESCE(cca.valor_fijo, cca.porcentaje, 0) > 0 AND COALESCE(cca.tipo, 'porcentaje') = 'fijo'
                        THEN ROUND(COALESCE(cca.valor_fijo, 0), 0)
                    WHEN cca.usuario_id IS NOT NULL AND COALESCE(cca.valor_fijo, cca.porcentaje, 0) > 0
                        THEN ROUND(inf.monto * COALESCE(cca.valor_fijo, cca.porcentaje, 0) / 100, 0)
                    WHEN COALESCE(cg.tipo, 'porcentaje') = 'fijo'
                        THEN ROUND(COALESCE(cg.valor_fijo, 0), 0)
                    ELSE ROUND(inf.monto * COALESCE(cg.valor_fijo, cg.porcentaje, 0) / 100, 0)
                END AS comision_sugerida,
                (SELECT ca.comision_ajustada
                    FROM comisiones_ajustes ca
                    WHERE ca.ingreso_factura_id = inf.id
                    ORDER BY ca.created_at DESC LIMIT 1) AS comision_ajustada,
                (SELECT ca.created_at
                    FROM comisiones_ajustes ca
                    WHERE ca.ingreso_factura_id = inf.id
                    ORDER BY ca.created_at DESC LIMIT 1) AS ultimo_ajuste_at,
                (SELECT COUNT(*)
                    FROM comisiones_ajustes ca
                    WHERE ca.ingreso_factura_id = inf.id) AS n_ajustes,
                mc_com.id AS comision_caja_id,
                mc_com.estado AS estado_comision,
                mc_com.valor AS comision_pagada_valor,
                mc_com.fecha AS comision_pagada_fecha
            FROM ingresos_factura inf
            LEFT JOIN usuarios u ON u.id = inf.asesor_id
            LEFT JOIN config_comisiones_asesores cca
                ON cca.usuario_id = inf.asesor_id AND cca.activo = 1
            LEFT JOIN config_comisiones_productos cp
                ON cp.nombre_producto != '__general__'
               AND (
                        (cp.producto_id IS NOT NULL AND cp.producto_id = inf.producto_id)
                        OR
                        (cp.hubspot_product_id IS NOT NULL AND cp.hubspot_product_id = inf.producto_id)
                        OR
                        (cp.nombre_producto IS NOT NULL AND cp.nombre_producto = inf.producto_nombre)
                    )
            LEFT JOIN config_comisiones_productos cg ON cg.nombre_producto = '__general__'
            LEFT JOIN movimientos_caja mc_com
                ON mc_com.ingreso_factura_id = inf.id
               AND mc_com.tipo = 'gasto'
               AND mc_com.deleted_at IS NULL
               AND EXISTS (
                 SELECT 1 FROM categorias_caja cc
                 WHERE cc.id = mc_com.categoria_id AND cc.valor = 'comisiones'
               )
            WHERE inf.estado = 'activo'
        ";
        $params = [];
        if ($desde) { $sql .= " AND inf.fecha_pago >= :desde"; $params[':desde'] = $desde; }
        if ($hasta) { $sql .= " AND inf.fecha_pago <= :hasta"; $params[':hasta'] = $hasta; }
        if ($usuarioId) {
            $sql .= " AND inf.asesor_id = :asesor";
            $params[':asesor'] = $usuarioId;
        }
        $sql .= " ORDER BY inf.fecha_pago DESC, inf.id DESC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        jsonResponse([
            'ok'    => true,
            'desde' => $desde,
            'hasta' => $hasta,
            'data'  => $stmt->fetchAll()
        ]);
    }

    // ── POST ajuste manual de comisión ────────────────────────
    if ($method === 'POST' && !empty($_GET['ajuste'])) {
        $b         = getBody();
        $facturaId = (int) ($b['ingreso_factura_id'] ?? 0);
        $ajustada  = isset($b['comision_ajustada']) ? (float) $b['comision_ajustada'] : null;
        $motivo    = trim($b['motivo'] ?? '');
        $usuarioId = !empty($b['usuario_id']) ? (int) $b['usuario_id'] : null;

        if (!$facturaId) errorResponse('ingreso_factura_id requerido', 400);
        if ($ajustada === null || $ajustada < 0) errorResponse('comision_ajustada debe ser >= 0', 400);

        $stmtI = $db->prepare("
            SELECT
                inf.monto,
                inf.producto_id,
                inf.producto_nombre,
                CASE
                    WHEN cp.id IS NOT NULL
                        THEN COALESCE(cp.tipo, 'porcentaje')
                    WHEN cca.usuario_id IS NOT NULL AND COALESCE(cca.valor_fijo, cca.porcentaje, 0) > 0
                        THEN COALESCE(cca.tipo, 'porcentaje')
                    ELSE COALESCE(cg.tipo, 'porcentaje')
                END AS tipo_comision,
                CASE
                    WHEN cp.id IS NOT NULL
                        THEN COALESCE(cp.valor_fijo, cp.porcentaje, 0)
                    WHEN cca.usuario_id IS NOT NULL AND COALESCE(cca.valor_fijo, cca.porcentaje, 0) > 0
                        THEN COALESCE(cca.valor_fijo, cca.porcentaje, 0)
                    ELSE COALESCE(cg.valor_fijo, cg.porcentaje, 0)
                END AS valor_comision,
                (SELECT ca.comision_ajustada
                FROM comisiones_ajustes ca
                WHERE ca.ingreso_factura_id = inf.id
                ORDER BY ca.created_at DESC LIMIT 1) AS ultima
            FROM ingresos_factura inf
            LEFT JOIN config_comisiones_asesores cca
                ON cca.usuario_id = inf.asesor_id AND cca.activo = 1
            LEFT JOIN config_comisiones_productos cp
                ON cp.nombre_producto != '__general__'
               AND (
                        (cp.producto_id IS NOT NULL AND cp.producto_id = inf.producto_id)
                        OR
                        (cp.hubspot_product_id IS NOT NULL AND cp.hubspot_product_id = inf.producto_id)
                        OR
                        (cp.nombre_producto IS NOT NULL AND cp.nombre_producto = inf.producto_nombre)
                    )
            LEFT JOIN config_comisiones_productos cg ON cg.nombre_producto = '__general__'
            WHERE inf.id = ?
            LIMIT 1
        ");
        $stmtI->execute([$facturaId]);
        $row = $stmtI->fetch();
        if (!$row) errorResponse('Factura no encontrada', 404);

        $tipo = $row['tipo_comision'] ?? 'porcentaje';
        $valor = (float) ($row['valor_comision'] ?? 0);

        $sugerida = $tipo === 'fijo'
            ? round($valor, 0)
            : round((float) $row['monto'] * $valor / 100, 0);

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
                INSERT INTO config_comisiones_asesores
                    (usuario_id, porcentaje, valor_fijo, tipo, base, activo)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    porcentaje = VALUES(porcentaje),
                    valor_fijo = VALUES(valor_fijo),
                    tipo       = VALUES(tipo),
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

                $tipo = in_array(($a['tipo_comision'] ?? $a['tipo'] ?? 'porcentaje'), ['porcentaje', 'fijo'], true)
                    ? ($a['tipo_comision'] ?? $a['tipo'])
                    : 'porcentaje';

                $valor = isset($a['valor_comision'])
                    ? (float) $a['valor_comision']
                    : (float) ($a['porcentaje'] ?? 5);

                $stmt->execute([
                    $a['usuario_id'],
                    $tipo === 'porcentaje' ? $valor : 0,
                    $tipo === 'fijo' ? $valor : null,
                    $tipo,
                    $a['base'] ?? 'ingresos',
                    isset($a['activo']) ? (int) (bool) $a['activo'] : 1,
                ]);
            }
        }

        // Upsert tasa general de producto (sentinel __general__)
        $gTipo = in_array(
            $b['generalProducto']['tipo_comision'] ?? $b['generalProductoTipo'] ?? 'porcentaje',
            ['porcentaje', 'fijo'], true
        ) ? ($b['generalProducto']['tipo_comision'] ?? $b['generalProductoTipo'] ?? 'porcentaje') : 'porcentaje';
        $gValor = (float) ($b['generalProducto']['valor_comision']
            ?? $b['generalProductoValor']
            ?? $b['generalProductoPorcentaje']
            ?? 5);

        $genExistente = $db->query(
            "SELECT id FROM config_comisiones_productos WHERE nombre_producto = '__general__' LIMIT 1"
        )->fetch();
        if ($genExistente) {
            $db->prepare("
                UPDATE config_comisiones_productos
                SET porcentaje = ?, valor_fijo = ?, tipo = ?, updated_at = NOW()
                WHERE nombre_producto = '__general__'
            ")->execute([
                $gTipo === 'porcentaje' ? $gValor : 0,
                $gTipo === 'fijo' ? $gValor : null,
                $gTipo,
            ]);
        } else {
            $db->prepare("
                INSERT INTO config_comisiones_productos (nombre_producto, porcentaje, valor_fijo, tipo)
                VALUES ('__general__', ?, ?, ?)
            ")->execute([
                $gTipo === 'porcentaje' ? $gValor : 0,
                $gTipo === 'fijo' ? $gValor : null,
                $gTipo,
            ]);
        }

        if (isset($b['porProducto']) && is_array($b['porProducto'])) {
            // Preserva la fila __general__ al borrar las excepciones de producto
            $db->exec("DELETE FROM config_comisiones_productos WHERE nombre_producto != '__general__'");

            $stmt = $db->prepare("
                INSERT INTO config_comisiones_productos
                    (producto_id, hubspot_product_id, nombre_producto, porcentaje, valor_fijo, tipo)
                VALUES (?, ?, ?, ?, ?, ?)
            ");

            foreach ($b['porProducto'] as $p) {
                $tipo = in_array(($p['tipo_comision'] ?? $p['tipo'] ?? 'porcentaje'), ['porcentaje', 'fijo'], true)
                    ? ($p['tipo_comision'] ?? $p['tipo'])
                    : 'porcentaje';

                $valor = isset($p['valor_comision'])
                    ? (float) $p['valor_comision']
                    : (float) ($p['porcentaje'] ?? 5);

                $stmt->execute([
                    $p['producto_id'] ?? null,
                    $p['hubspot_product_id'] ?? $p['productoId'] ?? null,
                    $p['nombre_producto'] ?? $p['producto'] ?? '',
                    $tipo === 'porcentaje' ? $valor : 0,
                    $tipo === 'fijo' ? $valor : null,
                    $tipo,
                ]);
            }
        }

        $db->commit();
        jsonResponse(['ok' => true]);
    }

    errorResponse('Método no soportado', 405);

    function calcularComisionSegunRegla(float $monto, string $tipo, float $valor): float
    {
        if ($tipo === 'fijo') {
            return round($valor, 2);
        }
        return round($monto * $valor / 100, 2);
    }

} catch (PDOException $e) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    error_log('[comisiones.php] ' . $e->getMessage());
    errorResponse('Error de base de datos', 500);
}
