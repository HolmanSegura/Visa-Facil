<?php
/* ============================================================
   API/DEV-LOGIN.PHP
   ⚠ SOLO PARA DESARROLLO LOCAL — eliminar en producción.

   Crea una sesión autenticada sin pasar por el formulario.
   Solo funciona desde localhost / 127.0.0.1.

   Uso:
     http://localhost/Visa-Facil/api/dev-login.php
     → Inicia sesión como Néstor Goyes (admin) y redirige al inicio
   ============================================================ */

// Bloquear en producción
$ip = $_SERVER['REMOTE_ADDR'] ?? '';
$ipPermitidas = ['127.0.0.1', '::1', 'localhost'];
if (!in_array($ip, $ipPermitidas, true)) {
    http_response_code(403);
    die('Acceso denegado. Este endpoint solo funciona en localhost.');
}

session_start();
require_once __DIR__ . '/db.php';

// Obtener el usuario admin de la base de datos
$db   = getDB();
$stmt = $db->prepare("SELECT id, nombre, email, rol FROM usuarios WHERE email = 'nestor@oblicua.co' AND activo = 1 LIMIT 1");
$stmt->execute();
$user = $stmt->fetch();

if (!$user) {
    die('Usuario de prueba no encontrado en la BD. Verifica que la semilla esté importada.');
}

session_regenerate_id(true);
$_SESSION['user_id'] = (int) $user['id'];
$_SESSION['user']    = [
    'id'     => (int) $user['id'],
    'nombre' => $user['nombre'],
    'email'  => $user['email'],
    'rol'    => $user['rol'],
];

// Redirigir al módulo indicado (o a cotizaciones por defecto)
$destino = match ($_GET['ir'] ?? '') {
    'caja'       => '../caja.html',
    'comisiones' => '../comisiones.html',
    default      => '../index.html',
};

header('Location: ' . $destino);
exit;
