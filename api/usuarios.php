<?php
/* ============================================================
   API/USUARIOS.PHP
   Listado de usuarios activos (asesores / admin).

   Rutas:
     GET /api/usuarios.php             → listar activos
     GET /api/usuarios.php?id=N        → detalle
   ============================================================ */

require_once __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int) $_GET['id'] : null;

try {
    $db = getDB();

    if ($method === 'GET' && $id) {
        $stmt = $db->prepare("
            SELECT id, nombre, email, rol, hubspot_owner_id
            FROM usuarios
            WHERE id = :id AND activo = 1 AND deleted_at IS NULL
        ");
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        if (!$row) errorResponse('Usuario no encontrado', 404);
        jsonResponse(['ok' => true, 'data' => $row]);
    }

    if ($method === 'GET') {
        $stmt = $db->query("
            SELECT id, nombre, email, rol, hubspot_owner_id
            FROM usuarios
            WHERE activo = 1 AND deleted_at IS NULL
            ORDER BY nombre ASC
        ");
        jsonResponse(['ok' => true, 'data' => $stmt->fetchAll()]);
    }

    errorResponse('Método no soportado', 405);

} catch (PDOException $e) {
    error_log('[usuarios.php] PDOException: ' . $e->getMessage());
    errorResponse('Error de base de datos', 500);
}
