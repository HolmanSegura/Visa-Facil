<?php
/* ============================================================
   API/EMAIL.PHP
   Proxy server-side para envío de correos vía Dapta webhook.

   Por qué existe:
   - Dapta rechaza requests desde browsers (CORS, seguridad).
   - La API key de Dapta no debe exponerse en el JS del cliente.
   - Este endpoint recibe el payload del frontend y lo reenvía
     a Dapta usando cURL desde el servidor.

   Adicionalmente registra cada intento en `envios_email`
   (tabla ya existente en database.sql) para trazabilidad.

   POST /api/email.php
   Body JSON: {
     cotizacion_id, destinatario, asunto, cuerpoHtml,
     cliente, cotizacion, lineas, totales, remitente
   }

   Respuesta:
   { ok: true, envio_id: 123 }   — éxito
   { ok: false, error: "..." }   — Dapta o BD fallaron
   ============================================================ */

require_once __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    errorResponse('Solo se acepta POST', 405);
}

$body = getBody();

$cotizacionId = isset($body['cotizacion']['id']) ? (int) $body['cotizacion']['id'] : 0;
$destinatario = trim($body['destinatario'] ?? '');
$asunto       = trim($body['asunto']       ?? '');

if (!$destinatario || !filter_var($destinatario, FILTER_VALIDATE_EMAIL)) {
    errorResponse('Destinatario inválido o ausente', 400);
}
if (!$asunto) {
    errorResponse('Asunto requerido', 400);
}

// Registrar intento en BD (estado "pendiente")
$envioId = null;
try {
    $db = getDB();
    if ($cotizacionId > 0) {
        $stmt = $db->prepare(
            "INSERT INTO envios_email (cotizacion_id, destinatario, asunto, estado)
             VALUES (?, ?, ?, 'pendiente')"
        );
        $stmt->execute([$cotizacionId, $destinatario, $asunto]);
        $envioId = (int) $db->lastInsertId();
    }
} catch (\PDOException $e) {
    error_log('[email.php] BD insert error: ' . $e->getMessage());
    // No bloqueamos el envío por error de BD
}

// Enviar a Dapta con cURL
$daptaUrl = defined('DAPTA_WEBHOOK_URL') ? DAPTA_WEBHOOK_URL : ($_ENV['DAPTA_WEBHOOK_URL'] ?? '');
$daptaKey = defined('DAPTA_API_KEY')     ? DAPTA_API_KEY     : ($_ENV['DAPTA_API_KEY']     ?? '');

if (!$daptaUrl) {
    actualizarEstadoEnvio($envioId, 'error', 'DAPTA_WEBHOOK_URL no configurado en .env');
    errorResponse('Servicio de correo no configurado en el servidor', 503);
}

$payload = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

$ch = curl_init($daptaUrl);
$headers = ['Content-Type: application/json'];
if ($daptaKey) {
    $headers[] = 'x-api-key: ' . $daptaKey;
}

curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_HTTPHEADER     => $headers,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_USERAGENT      => 'VisaFacil/1.0 EmailProxy',
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

if ($response === false || $curlErr) {
    $detalle = 'cURL error: ' . $curlErr;
    error_log('[email.php] ' . $detalle);
    actualizarEstadoEnvio($envioId, 'error', $detalle);
    errorResponse('No se pudo contactar el servicio de correo: ' . $curlErr, 502);
}

if ($httpCode < 200 || $httpCode >= 300) {
    $detalle = "Dapta respondió HTTP {$httpCode}: " . mb_substr($response, 0, 300);
    error_log('[email.php] ' . $detalle);
    actualizarEstadoEnvio($envioId, 'error', $detalle);
    errorResponse("Error del servicio de correo (HTTP {$httpCode})", 502);
}

// Éxito
actualizarEstadoEnvio($envioId, 'enviado');
jsonResponse([
    'ok'       => true,
    'envio_id' => $envioId,
    'message'  => "Correo enviado a {$destinatario}",
]);

/* ── HELPERS LOCALES ─────────────────────────────────── */

function actualizarEstadoEnvio(?int $id, string $estado, string $detalle = ''): void {
    if (!$id) return;
    try {
        $db   = getDB();
        $stmt = $db->prepare(
            "UPDATE envios_email
             SET estado = ?, error_detalle = ?,
                 enviado_at = IF(? = 'enviado', NOW(), NULL)
             WHERE id = ?"
        );
        $stmt->execute([$estado, $detalle ?: null, $estado, $id]);
    } catch (\PDOException $e) {
        error_log('[email.php] No se pudo actualizar estado: ' . $e->getMessage());
    }
}
