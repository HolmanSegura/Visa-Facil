<?php
/* ============================================================
   API/PRODUCTOS.PHP
   Catálogo local de productos/servicios.
   Sirve como caché persistente de los productos de HubSpot.

   GET  /api/productos.php                → todos los activos
   GET  /api/productos.php?busqueda=SEO   → búsqueda por nombre/sku
   POST /api/productos.php                → crear/upsert desde HubSpot
   ============================================================ */

require_once __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];

try {
    $db = getDB();

    if ($method === 'GET') {
        $where  = ['deleted_at IS NULL', 'activo = 1'];
        $params = [];

        if (!empty($_GET['busqueda'])) {
            $q        = '%' . $_GET['busqueda'] . '%';
            $where[]  = '(nombre LIKE ? OR sku LIKE ? OR descripcion LIKE ?)';
            array_push($params, $q, $q, $q);
        }

        $whereStr = 'WHERE ' . implode(' AND ', $where);
        $stmt = $db->prepare("SELECT * FROM productos $whereStr ORDER BY nombre LIMIT 200");
        $stmt->execute($params);
        jsonResponse(['ok' => true, 'data' => $stmt->fetchAll()]);
    }

    // Upsert por hubspot_product_id — usado para sincronizar el catálogo
    if ($method === 'POST') {
        $b = getBody();
        if (empty($b)) errorResponse('Body vacío');

        // Acepta array de productos o producto único
        $items = isset($b[0]) ? $b : [$b];
        $stmt  = $db->prepare("
            INSERT INTO productos
              (hubspot_product_id, nombre, descripcion, precio, sku, tipo, tasa_iva)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              nombre      = VALUES(nombre),
              descripcion = VALUES(descripcion),
              precio      = VALUES(precio),
              sku         = VALUES(sku),
              tipo        = VALUES(tipo),
              tasa_iva    = VALUES(tasa_iva),
              updated_at  = NOW()
        ");

        $guardados = 0;
        foreach ($items as $p) {
            $stmt->execute([
                $p['id']          ?? $p['hubspot_product_id'] ?? null,
                $p['nombre']      ?? $p['name']               ?? '',
                $p['descripcion'] ?? $p['description']        ?? null,
                $p['precio']      ?? $p['price']              ?? 0,
                $p['sku']         ?? null,
                $p['tipo']        ?? null,
                $p['tasaIva']     ?? $p['tasa_iva']           ?? null,
            ]);
            $guardados++;
        }
        jsonResponse(['ok' => true, 'guardados' => $guardados]);
    }

    errorResponse('Método no soportado', 405);

} catch (PDOException $e) {
    error_log('[productos.php] ' . $e->getMessage());
    errorResponse('Error de base de datos', 500);
}
