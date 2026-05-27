<?php
/* ============================================================
   API/DB.PHP
   Conexión PDO a MySQL (XAMPP/localhost).
   Carga credenciales desde el archivo .env de la raíz.
   ============================================================ */

define('ROOT_DIR', dirname(__DIR__));

// Carga .env si existe (formato KEY=value, una por línea)
$envFile = ROOT_DIR . '/.env';
if (file_exists($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) continue;
        [$key, $value] = explode('=', $line, 2);
        $_ENV[trim($key)] = trim($value);
    }
}

define('DB_HOST', $_ENV['DB_HOST'] ?? 'localhost');
define('DB_NAME', $_ENV['DB_NAME'] ?? 'visa_facil');
define('DB_USER', $_ENV['DB_USER'] ?? 'visafacildev');
define('DB_PASS', $_ENV['DB_PASS'] ?? '=V[#}sud]aNZbP$i');
define('DB_PORT', $_ENV['DB_PORT'] ?? '3306');

define('DAPTA_WEBHOOK_URL', $_ENV['DAPTA_WEBHOOK_URL'] ?? '');
define('DAPTA_API_KEY',     $_ENV['DAPTA_API_KEY']     ?? '');
define('HUBSPOT_TOKEN',     $_ENV['HUBSPOT_TOKEN']      ?? '');
define('UPLOADS_DIR',       ROOT_DIR . '/uploads/');
define('UPLOADS_URL',       '/uploads/');

function getDB(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
        DB_HOST, DB_PORT, DB_NAME
    );
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    return $pdo;
}

// Helper: respuesta JSON con CORS para desarrollo local
function jsonResponse(mixed $data, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function errorResponse(string $mensaje, int $status = 400): never {
    jsonResponse(['ok' => false, 'error' => $mensaje], $status);
}

// Maneja preflight OPTIONS para CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    exit(0);
}

// Body JSON del request
function getBody(): array {
    static $body = null;
    if ($body !== null) return $body;
    $raw  = file_get_contents('php://input');
    $body = $raw ? (json_decode($raw, true) ?? []) : [];
    return $body;
}
