<?php
/* ============================================================
   API/DIAGNOSTICO.PHP
   Herramienta de diagnóstico técnico controlada.
   Solo accesible para usuarios con sesión activa.

   GET /api/diagnostico.php           → diagnóstico completo
   GET /api/diagnostico.php?test=hs   → solo HubSpot
   GET /api/diagnostico.php?test=dapta → solo Dapta
   GET /api/diagnostico.php?test=bd   → solo base de datos

   Seguridad:
   - Requiere sesión PHP activa (usuario logueado).
   - NUNCA devuelve tokens completos.
   - Solo muestra si están configurados y si la conexión funciona.
   ============================================================ */

session_start();
require_once __DIR__ . '/db.php';

// Solo usuarios logueados
if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['ok' => false, 'error' => 'No autenticado. Inicia sesión primero.']);
    exit;
}

$test = $_GET['test'] ?? 'all';
$resultados = [];

/* ── 1. BASE DE DATOS ───────────────────────────────────── */
function testBD(): array {
    try {
        $db      = getDB();
        $dbName  = $db->query("SELECT DATABASE()")->fetchColumn();
        $counts  = [];
        foreach (['usuarios', 'cotizaciones', 'movimientos_caja', 'envios_email', 'config_comisiones_asesores'] as $tabla) {
            $counts[$tabla] = (int) $db->query("SELECT COUNT(*) FROM `{$tabla}`")->fetchColumn();
        }
        return [
            'estado'   => 'ok',
            'mensaje'  => "Conexión activa a BD: {$dbName}",
            'conteos'  => $counts,
        ];
    } catch (\PDOException $e) {
        return [
            'estado'  => 'error',
            'mensaje' => 'No se pudo conectar a la base de datos: ' . $e->getMessage(),
        ];
    }
}

/* ── 2. HUBSPOT ─────────────────────────────────────────── */
function testHubSpot(): array {
    $token = defined('HUBSPOT_TOKEN') ? HUBSPOT_TOKEN : ($_ENV['HUBSPOT_TOKEN'] ?? '');

    if (!$token) {
        return [
            'estado'  => 'error',
            'mensaje' => 'HUBSPOT_TOKEN no configurado en .env',
            'token'   => 'ausente',
        ];
    }

    if (!function_exists('curl_init')) {
        return [
            'estado'  => 'error',
            'mensaje' => 'La extensión PHP curl no está habilitada. Necesaria para el proxy.',
            'token'   => 'configurado (últimos 4: ' . substr($token, -4) . ')',
        ];
    }

    // Llamada de prueba mínima: leer 1 owner
    $url = 'https://api.hubapi.com/crm/v3/owners?limit=1&archived=false';
    $ch  = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $token,
            'Accept: application/json',
        ],
        CURLOPT_USERAGENT => 'VisaFacil/1.0 Diagnostico',
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    $tokenPreview = 'configurado (últimos 4: ' . substr($token, -4) . ')';

    if ($curlErr) {
        return [
            'estado'     => 'error',
            'mensaje'    => 'cURL no pudo conectar con HubSpot: ' . $curlErr,
            'http_code'  => null,
            'token'      => $tokenPreview,
        ];
    }

    $data = json_decode($response, true);

    if ($httpCode === 401) {
        return [
            'estado'    => 'error',
            'mensaje'   => 'Token inválido o expirado (HTTP 401). Genera un nuevo PAT en HubSpot.',
            'http_code' => 401,
            'token'     => $tokenPreview,
        ];
    }

    if ($httpCode === 403) {
        return [
            'estado'    => 'error',
            'mensaje'   => 'Token sin scopes suficientes (HTTP 403). Agrega crm.objects.owners.read en HubSpot Developer Portal.',
            'http_code' => 403,
            'token'     => $tokenPreview,
        ];
    }

    if ($httpCode >= 200 && $httpCode < 300) {
        $totalOwners = $data['total'] ?? count($data['results'] ?? []);
        // Verificar scopes adicionales intentando leer products
        $urlProd = 'https://api.hubapi.com/crm/v3/objects/products?limit=1&properties=name&archived=false';
        $ch2 = curl_init($urlProd);
        curl_setopt_array($ch2, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token],
        ]);
        $resp2 = curl_exec($ch2);
        $code2 = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
        curl_close($ch2);

        $scopeProductos = $code2 >= 200 && $code2 < 300 ? 'ok' : "HTTP {$code2}";

        return [
            'estado'          => 'ok',
            'mensaje'         => "Conexión activa con HubSpot. {$totalOwners} owner(s) detectado(s).",
            'http_code'       => $httpCode,
            'token'           => $tokenPreview,
            'scope_owners'    => 'ok',
            'scope_productos' => $scopeProductos,
            'portal_id'       => '50772182',
        ];
    }

    return [
        'estado'    => 'error',
        'mensaje'   => "HubSpot respondió HTTP {$httpCode}: " . mb_substr($response, 0, 200),
        'http_code' => $httpCode,
        'token'     => $tokenPreview,
    ];
}

/* ── 3. DAPTA ───────────────────────────────────────────── */
function testDapta(): array {
    $url = defined('DAPTA_WEBHOOK_URL') ? DAPTA_WEBHOOK_URL : ($_ENV['DAPTA_WEBHOOK_URL'] ?? '');
    $key = defined('DAPTA_API_KEY')     ? DAPTA_API_KEY     : ($_ENV['DAPTA_API_KEY']     ?? '');

    if (!$url) {
        return [
            'estado'  => 'error',
            'mensaje' => 'DAPTA_WEBHOOK_URL no configurado en .env',
            'url'     => 'ausente',
            'api_key' => $key ? 'configurada' : 'ausente',
        ];
    }

    if (!function_exists('curl_init')) {
        return [
            'estado'  => 'error',
            'mensaje' => 'curl no habilitado en PHP',
            'url'     => substr($url, 0, 40) . '…',
        ];
    }

    // No enviamos un email real — solo verificamos que el endpoint sea alcanzable
    // con un payload vacío (espera un 4xx de validación, NO un 200)
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode(['_test' => true]),
        CURLOPT_HTTPHEADER     => array_filter([
            'Content-Type: application/json',
            $key ? "x-api-key: {$key}" : null,
        ]),
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_USERAGENT      => 'VisaFacil/1.0 Diagnostico',
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    $urlPreview = substr($url, 0, 45) . (strlen($url) > 45 ? '…' : '');

    if ($curlErr) {
        return [
            'estado'  => 'error',
            'mensaje' => 'No se pudo alcanzar el webhook de Dapta: ' . $curlErr,
            'url'     => $urlPreview,
            'api_key' => $key ? 'configurada' : 'ausente',
        ];
    }

    // 200/201 = Dapta aceptó (posiblemente envió algo — solo para test)
    // 4xx = Dapta rechazó por payload inválido, pero el endpoint sí existe y responde
    // 401/403 = API key incorrecta
    if ($httpCode === 401 || $httpCode === 403) {
        return [
            'estado'  => 'error',
            'mensaje' => "API key de Dapta incorrecta o sin permisos (HTTP {$httpCode})",
            'url'     => $urlPreview,
            'api_key' => $key ? 'configurada (posiblemente inválida)' : 'ausente',
        ];
    }

    $alcanzable = ($httpCode >= 200 && $httpCode < 500);
    return [
        'estado'   => $alcanzable ? 'ok' : 'error',
        'mensaje'  => $alcanzable
            ? "Webhook de Dapta alcanzable (HTTP {$httpCode}). Envíos reales funcionarán si la API key es válida."
            : "Dapta respondió HTTP {$httpCode} — revisar URL.",
        'url'      => $urlPreview,
        'http_code'=> $httpCode,
        'api_key'  => $key ? 'configurada' : 'ausente',
    ];
}

/* ── 4. PHP / SERVIDOR ──────────────────────────────────── */
function testServidor(): array {
    $extensiones = [
        'curl'       => extension_loaded('curl'),
        'pdo_mysql'  => extension_loaded('pdo_mysql'),
        'json'       => extension_loaded('json'),
        'mbstring'   => extension_loaded('mbstring'),
        'openssl'    => extension_loaded('openssl'),
    ];
    $sessionPath = session_save_path() ?: sys_get_temp_dir();
    $sessionOk   = is_writable($sessionPath);

    $faltantes = array_keys(array_filter($extensiones, fn($v) => !$v));

    return [
        'estado'       => empty($faltantes) && $sessionOk ? 'ok' : 'error',
        'php_version'  => PHP_VERSION,
        'extensiones'  => $extensiones,
        'session_path' => $sessionPath,
        'session_writable' => $sessionOk,
        'faltantes'    => $faltantes,
        'mensaje'      => empty($faltantes) && $sessionOk
            ? 'Entorno PHP correcto para todas las funcionalidades.'
            : 'Faltan: ' . implode(', ', $faltantes) . (!$sessionOk ? ', sesión sin escritura' : ''),
    ];
}

/* ── EJECUTAR TESTS ─────────────────────────────────────── */
if ($test === 'all' || $test === 'bd')     $resultados['bd']       = testBD();
if ($test === 'all' || $test === 'hs')     $resultados['hubspot']  = testHubSpot();
if ($test === 'all' || $test === 'dapta')  $resultados['dapta']    = testDapta();
if ($test === 'all' || $test === 'server') $resultados['servidor'] = testServidor();

$todoOk = array_reduce($resultados, fn($carry, $r) => $carry && ($r['estado'] === 'ok'), true);

jsonResponse([
    'ok'         => $todoOk,
    'timestamp'  => date('Y-m-d H:i:s'),
    'usuario'    => $_SESSION['user']['nombre'] ?? 'desconocido',
    'resultados' => $resultados,
]);
