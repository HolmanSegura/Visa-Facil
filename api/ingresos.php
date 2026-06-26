<?php
/* ============================================================
   API/INGRESOS.PHP
   Consulta de ingresos de facturas HubSpot (ingresos_factura).
   Fuente de verdad para el cálculo de comisiones.

   GET /api/ingresos.php
       ?desde=YYYY-MM-DD  (default: primer día del año)
       ?hasta=YYYY-MM-DD  (default: hoy)
       ?asesor_id=N
       ?metodo_pago=efectivo|transferencia|tarjeta|cheque
       ?pagina=N          (default: 1)
       ?por_pagina=N      (default: 50, máx: 200)

   GET /api/ingresos.php?resumen=1
       → Totales agrupados por asesor y método de pago.
         Incluye link a mov_caja_id cuando existe entrada en Caja Menor.
   ============================================================ */

require_once __DIR__ . '/db.php';

try {
    $db = getDB();

    $desde    = $_GET['desde']      ?? date('Y-01-01');
    $hasta    = $_GET['hasta']      ?? date('Y-m-d');
    $asesorId = !empty($_GET['asesor_id'])   ? (int) $_GET['asesor_id'] : null;
    $metodo   = !empty($_GET['metodo_pago']) ? $_GET['metodo_pago']     : null;

    // ── Resumen agrupado ──────────────────────────────────
    if (!empty($_GET['resumen'])) {
        $sql = "
            SELECT i.asesor_id,
                   u.nombre                                           AS asesor,
                   i.metodo_pago,
                   COUNT(*)                                           AS n_facturas,
                   SUM(i.monto)                                       AS total,
                   i.moneda
            FROM ingresos_factura i
            LEFT JOIN usuarios u ON u.id = i.asesor_id
            WHERE i.estado = 'activo'
              AND i.fecha_pago BETWEEN :desde AND :hasta
        ";
        $params = [':desde' => $desde, ':hasta' => $hasta];

        if ($asesorId) { $sql .= " AND i.asesor_id = :asesor"; $params[':asesor'] = $asesorId; }
        if ($metodo)   { $sql .= " AND i.metodo_pago = :metodo"; $params[':metodo'] = $metodo; }

        $sql .= " GROUP BY i.asesor_id, i.metodo_pago, i.moneda ORDER BY total DESC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        jsonResponse(['ok' => true, 'desde' => $desde, 'hasta' => $hasta, 'data' => $stmt->fetchAll()]);
    }

    // ── Lista paginada ────────────────────────────────────
    $pagina    = max(1, (int) ($_GET['pagina']    ?? 1));
    $porPagina = min(200, max(10, (int) ($_GET['por_pagina'] ?? 50)));
    $offset    = ($pagina - 1) * $porPagina;

    $where  = "i.estado = 'activo' AND i.fecha_pago BETWEEN :desde AND :hasta";
    $params = [':desde' => $desde, ':hasta' => $hasta];

    if ($asesorId) { $where .= " AND i.asesor_id = :asesor"; $params[':asesor'] = $asesorId; }
    if ($metodo)   { $where .= " AND i.metodo_pago = :metodo"; $params[':metodo'] = $metodo; }

    // Total de registros para paginación
    $stmtN = $db->prepare("SELECT COUNT(*) FROM ingresos_factura i WHERE {$where}");
    $stmtN->execute($params);
    $total = (int) $stmtN->fetchColumn();

    // Registros de la página
    $sql = "
        SELECT i.id,
               i.hubspot_inv_id,
               i.referencia,
               i.fecha_pago,
               i.monto,
               i.moneda,
               i.metodo_pago,
               i.titulo,
               i.punto_venta,
               i.asesor_id,
               u.nombre  AS asesor,
               i.mov_caja_id,
               i.estado,
               i.created_at
        FROM ingresos_factura i
        LEFT JOIN usuarios u ON u.id = i.asesor_id
        WHERE {$where}
        ORDER BY i.fecha_pago DESC, i.id DESC
        LIMIT :lim OFFSET :off
    ";
    $stmt = $db->prepare($sql);
    foreach ($params as $k => $v) $stmt->bindValue($k, $v);
    $stmt->bindValue(':lim', $porPagina, PDO::PARAM_INT);
    $stmt->bindValue(':off', $offset,    PDO::PARAM_INT);
    $stmt->execute();

    jsonResponse([
        'ok'        => true,
        'total'     => $total,
        'pagina'    => $pagina,
        'por_pagina'=> $porPagina,
        'desde'     => $desde,
        'hasta'     => $hasta,
        'data'      => $stmt->fetchAll(),
    ]);

} catch (PDOException $e) {
    error_log('[ingresos.php] ' . $e->getMessage());
    errorResponse('Error de base de datos', 500);
}
