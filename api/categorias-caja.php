<?php
/* ============================================================
   API/CATEGORIAS-CAJA.PHP
   Listado de categorías de movimientos de caja.

   GET /api/categorias-caja.php  → todas las activas
   ============================================================ */

require_once __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];

try {
    $db = getDB();

    if ($method === 'GET') {
        $stmt = $db->query("
            SELECT id, valor, nombre, icono
            FROM categorias_caja
            WHERE activo = 1
            ORDER BY orden ASC, nombre ASC
        ");
        jsonResponse(['ok' => true, 'data' => $stmt->fetchAll()]);
    }

    errorResponse('Método no soportado', 405);

} catch (PDOException $e) {
    error_log('[categorias-caja.php] ' . $e->getMessage());
    errorResponse('Error de base de datos', 500);
}
