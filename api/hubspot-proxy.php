<?php
/* ============================================================
   API/HUBSPOT-PROXY.PHP
   Proxy server-side para la API de HubSpot CRM.

   Por qué existe:
   - El token de Private App NUNCA debe enviarse al navegador.
   - corsproxy.io no funciona en producción (CORS + seguridad).
   - Este proxy reenvía llamadas HubSpot usando cURL desde el
     servidor, donde el token permanece en .env.

   Uso desde el frontend (JS):
     fetch('/api/hubspot-proxy.php?path=/crm/v3/objects/products...')
     fetch('/api/hubspot-proxy.php?path=/crm/v3/owners...')

   Rutas permitidas (whitelist):
     /crm/v3/*   /crm/v4/*   /owners/*
     /marketing/*  (futuro)

   Método HTTP del proxy: hereda el del request original.
   Body: si POST, se reenvía el body JSON directamente.
   ============================================================ */

require_once __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];

// Preflight CORS
if ($method === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    exit(0);
}

$token = defined('HUBSPOT_TOKEN') ? HUBSPOT_TOKEN : ($_ENV['HUBSPOT_TOKEN'] ?? '');

if (!$token) {
    errorResponse('HubSpot token no configurado en el servidor (.env)', 503);
}

// La ruta viene URL-encoded en el parámetro ?path=
$encodedPath = $_GET['path'] ?? '';
if (!$encodedPath) {
    errorResponse('Parámetro "path" requerido', 400);
}

$path = urldecode($encodedPath);

// Whitelist de prefijos permitidos para evitar SSRF
$allowedPrefixes = ['/crm/', '/owners', '/marketing/', '/contacts/'];
$allowed = false;
foreach ($allowedPrefixes as $prefix) {
    if (strncmp($path, $prefix, strlen($prefix)) === 0) {
        $allowed = true;
        break;
    }
}

if (!$allowed) {
    errorResponse('Ruta HubSpot no permitida: ' . htmlspecialchars($path), 400);
}

$url = 'https://api.hubapi.com' . $path;

// Construir request cURL
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_TIMEOUT        => 20,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_USERAGENT      => 'VisaFacil/1.0 HubSpot-Proxy',
    CURLOPT_HTTPHEADER     => [
        'Authorization: Bearer ' . $token,
        'Content-Type: application/json',
        'Accept: application/json',
    ],
]);

if ($method === 'POST') {
    $body = file_get_contents('php://input');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body ?: '{}');
} elseif ($method === 'PATCH') {
    $body = file_get_contents('php://input');
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body ?: '{}');
}

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

if ($response === false) {
    error_log('[hubspot-proxy] cURL error: ' . $curlErr);
    errorResponse('Error de red al contactar HubSpot: ' . $curlErr, 502);
}

// Reenviar la respuesta al frontend tal como viene de HubSpot
http_response_code($httpCode);
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
echo $response;
