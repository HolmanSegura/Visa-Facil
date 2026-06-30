<?php
/* ============================================================
   API/AUTH.PHP
   Gestión de sesiones internas del sistema Visa Fácil.

   IMPORTANTE: El token HubSpot (Private App) es una credencial
   de integración del BACKEND — no representa una sesión de
   usuario individual de HubSpot. Este módulo implementa
   autenticación interna con la tabla `usuarios`.

   Para login OAuth real de HubSpot se necesitaría una app
   pública con scopes OAuth2 — esto queda documentado como
   evolución futura. Por ahora: sesión interna segura.

   Endpoints:
     GET  ?action=check    → devuelve sesión activa o {ok:false}
     POST ?action=login    → body: {email, password}
     POST ?action=logout   → destruye la sesión

   Seguridad:
   - Contraseña inicial: APP_PASSWORD en .env ("Oblicua2026!")
   - Al primer login con APP_PASSWORD se upgradea el hash a bcrypt
   - Sesión PHP estándar con cookie HttpOnly + SameSite=Lax
   ============================================================ */

// Configurar sesión segura antes de iniciarla
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_samesite', 'Lax');
ini_set('session.use_strict_mode', 1);

session_start();
require_once __DIR__ . '/db.php';

$action = $_GET['action'] ?? $_POST['action'] ?? 'check';

// Preflight CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    exit(0);
}

switch ($action) {
    case 'check':
        jsonResponse(buildSessionResponse());
        break;

    case 'hs_login':
        handleHubSpotLogin();
        break;

    case 'hs_callback':
        handleHubSpotCallback();
        break;

    case 'login':
        handleLogin();
        break;

    case 'logout':
        handleLogout();
        break;

    case 'cambiar_password':
        handleCambiarPassword();
        break;

    default:
        errorResponse('Acción no válida', 400);
}

/* ── HELPERS ───────────────────────────────────────────── */

function buildSessionResponse(): array {
    if (empty($_SESSION['user_id']) || empty($_SESSION['user'])) {
        return ['ok' => false];
    }

    // Auto-refrescar el access token de HubSpot si está próximo a vencer
    if (!empty($_SESSION['hs_expires_at']) && time() > $_SESSION['hs_expires_at']) {
        $refreshed = hsRefreshToken($_SESSION['hs_refresh_token'] ?? '');
        if ($refreshed) {
            $_SESSION['hs_access_token'] = $refreshed['access_token'];
            $_SESSION['hs_expires_at']   = time() + ($refreshed['expires_in'] ?? 1800) - 60;
            if (!empty($refreshed['refresh_token'])) {
                $_SESSION['hs_refresh_token'] = $refreshed['refresh_token'];
            }
        } else {
            // Refresh falló → sesión expirada, forzar re-login con HubSpot
            session_destroy();
            return ['ok' => false, 'reason' => 'hs_session_expired'];
        }
    }

    return ['ok' => true, 'user' => $_SESSION['user']];
}

/* ── HUBSPOT OAUTH ──────────────────────────────────────── */

function handleHubSpotLogin(): void {
    $clientId    = $_ENV['HUBSPOT_CLIENT_ID']    ?? '';
    $redirectUri = $_ENV['HUBSPOT_REDIRECT_URI'] ?? '';

    if (!$clientId) {
        errorResponse('HUBSPOT_CLIENT_ID no configurado', 500);
    }

    // Token CSRF para verificar el callback
    $state = bin2hex(random_bytes(16));
    $_SESSION['hs_oauth_state'] = $state;

    $url = 'https://app.hubspot.com/oauth/authorize?' . http_build_query([
        'client_id'    => $clientId,
        'redirect_uri' => $redirectUri,
        'scope'        => 'crm.objects.owners.read crm.objects.contacts.read',
        'state'        => $state,
    ]);

    header("Location: {$url}");
    exit;
}

function handleHubSpotCallback(): void {
    $code        = $_GET['code']  ?? '';
    $state       = $_GET['state'] ?? '';
    $errorParam  = $_GET['error'] ?? '';

    // Error explícito de HubSpot (ej: usuario canceló)
    if ($errorParam) {
        header('Location: /?hs_error=' . urlencode($errorParam));
        exit;
    }

    // Verificar CSRF state
    if (!$state || $state !== ($_SESSION['hs_oauth_state'] ?? '')) {
        header('Location: /?hs_error=invalid_state');
        exit;
    }
    unset($_SESSION['hs_oauth_state']);

    // Canjear código por tokens
    $tokens = hsExchangeCode($code);
    if (!$tokens || empty($tokens['access_token'])) {
        header('Location: /?hs_error=token_exchange_failed');
        exit;
    }

    // Verificar que el portal sea el de Visa Fácil
    $userInfo  = hsGetTokenInfo($tokens['access_token']);
    $portalId  = (int) ($_ENV['HUBSPOT_PORTAL_ID'] ?? 0);

    if (!$userInfo) {
        header('Location: /?hs_error=cannot_get_user_info');
        exit;
    }
    if ($portalId && (int)($userInfo['hub_id'] ?? 0) !== $portalId) {
        header('Location: /?hs_error=wrong_portal');
        exit;
    }

    $hsEmail = $userInfo['user'] ?? '';   // email del usuario de HubSpot

    // Buscar usuario local por email
    try {
        $db   = getDB();
        $stmt = $db->prepare(
            "SELECT id, nombre, email, rol FROM usuarios
             WHERE email = ? AND activo = 1 AND deleted_at IS NULL LIMIT 1"
        );
        $stmt->execute([$hsEmail]);
        $user = $stmt->fetch();
    } catch (\PDOException $e) {
        error_log('[auth.php] hs_callback DB error: ' . $e->getMessage());
        header('Location: /?hs_error=db_error');
        exit;
    }

    if (!$user) {
        // El email de HubSpot no tiene cuenta en Visa Fácil
        header('Location: /?hs_error=user_not_registered&email=' . urlencode($hsEmail));
        exit;
    }

    // Crear sesión
    session_regenerate_id(true);

    $_SESSION['user_id']          = (int) $user['id'];
    $_SESSION['user']             = [
        'id'     => (int) $user['id'],
        'nombre' => $user['nombre'],
        'email'  => $user['email'],
        'rol'    => $user['rol'],
    ];
    $_SESSION['hs_access_token']  = $tokens['access_token'];
    $_SESSION['hs_refresh_token'] = $tokens['refresh_token']  ?? '';
    $_SESSION['hs_expires_at']    = time() + ($tokens['expires_in'] ?? 1800) - 60;

    header('Location: /');
    exit;
}

/* ── HTTP helpers HubSpot ───────────────────────────────── */

function hsExchangeCode(string $code): ?array {
    $clientId     = $_ENV['HUBSPOT_CLIENT_ID']     ?? '';
    $clientSecret = $_ENV['HUBSPOT_CLIENT_SECRET'] ?? '';
    $redirectUri  = $_ENV['HUBSPOT_REDIRECT_URI']  ?? '';

    $ch = curl_init('https://api.hubapi.com/oauth/v1/token');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query([
            'grant_type'    => 'authorization_code',
            'client_id'     => $clientId,
            'client_secret' => $clientSecret,
            'redirect_uri'  => $redirectUri,
            'code'          => $code,
        ]),
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_TIMEOUT    => 10,
    ]);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($code !== 200 || !$resp) return null;
    return json_decode($resp, true) ?: null;
}

function hsRefreshToken(string $refreshToken): ?array {
    if (!$refreshToken) return null;

    $ch = curl_init('https://api.hubapi.com/oauth/v1/token');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query([
            'grant_type'    => 'refresh_token',
            'client_id'     => $_ENV['HUBSPOT_CLIENT_ID']     ?? '',
            'client_secret' => $_ENV['HUBSPOT_CLIENT_SECRET'] ?? '',
            'refresh_token' => $refreshToken,
        ]),
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_TIMEOUT    => 10,
    ]);
    $resp     = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$resp) return null;
    return json_decode($resp, true) ?: null;
}

function hsGetTokenInfo(string $accessToken): ?array {
    $ch = curl_init("https://api.hubapi.com/oauth/v1/access-tokens/{$accessToken}");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
    ]);
    $resp     = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$resp) return null;
    return json_decode($resp, true) ?: null;
}

/* ── LOGIN INTERNO (fallback) ───────────────────────────── */

function handleLogin(): void {
    $body     = getBody();
    $email    = trim($body['email']    ?? '');
    $password = $body['password'] ?? '';

    if (!$email || !$password) {
        errorResponse('Email y contraseña son requeridos', 400);
    }

    try {
        $db   = getDB();
        $stmt = $db->prepare(
            "SELECT id, nombre, email, password_hash, rol
             FROM usuarios
             WHERE email = ? AND activo = 1 AND deleted_at IS NULL
             LIMIT 1"
        );
        $stmt->execute([$email]);
        $user = $stmt->fetch();
    } catch (\PDOException $e) {
        error_log('[auth.php] DB error: ' . $e->getMessage());
        errorResponse('Error interno del servidor', 500);
        return;
    }

    if (!$user) {
        errorResponse('Credenciales incorrectas', 401);
    }

    // Contraseña de arranque desde .env — se usa cuando hash es placeholder
    $appPassword = $_ENV['APP_PASSWORD'] ?? 'Oblicua2026!';
    $hashActual  = $user['password_hash'] ?? '';

    $valido = false;

    if (strpos($hashActual, '$2y$') === 0 && strpos($hashActual, 'placeholder') === false) {
        // Hash bcrypt real
        $valido = password_verify($password, $hashActual);
    } else {
        // Hash placeholder → verificar contra APP_PASSWORD
        $valido = ($password === $appPassword);
        if ($valido) {
            // Upgrade automático: guardar hash bcrypt real
            $nuevoHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
            try {
                $db->prepare("UPDATE usuarios SET password_hash = ? WHERE id = ?")
                   ->execute([$nuevoHash, $user['id']]);
            } catch (\PDOException $e) {
                error_log('[auth.php] No se pudo actualizar hash: ' . $e->getMessage());
            }
        }
    }

    if (!$valido) {
        // Pequeño delay para mitigar fuerza bruta
        usleep(300000); // 300 ms
        errorResponse('Credenciales incorrectas', 401);
    }

    // Regenerar ID de sesión para prevenir session fixation
    session_regenerate_id(true);

    $userData = [
        'id'     => (int) $user['id'],
        'nombre' => $user['nombre'],
        'email'  => $user['email'],
        'rol'    => $user['rol'],
    ];

    $_SESSION['user_id'] = $userData['id'];
    $_SESSION['user']    = $userData;

    jsonResponse(['ok' => true, 'user' => $userData]);
}

function handleCambiarPassword(): void {
    if (empty($_SESSION['user_id'])) {
        errorResponse('Sesión no activa', 401);
    }

    $body        = getBody();
    $actual      = $body['password_actual']  ?? '';
    $nueva       = $body['password_nueva']   ?? '';
    $confirmacion = $body['password_confirma'] ?? '';

    if (!$actual || !$nueva || !$confirmacion) {
        errorResponse('Todos los campos son requeridos', 400);
    }
    if (strlen($nueva) < 8) {
        errorResponse('La nueva contraseña debe tener al menos 8 caracteres', 400);
    }
    if ($nueva !== $confirmacion) {
        errorResponse('Las contraseñas nuevas no coinciden', 400);
    }

    try {
        $db   = getDB();
        $stmt = $db->prepare(
            "SELECT password_hash FROM usuarios WHERE id = ? AND activo = 1 AND deleted_at IS NULL LIMIT 1"
        );
        $stmt->execute([$_SESSION['user_id']]);
        $row = $stmt->fetch();
    } catch (\PDOException $e) {
        error_log('[auth.php] cambiar_password DB error: ' . $e->getMessage());
        errorResponse('Error interno del servidor', 500);
        return;
    }

    if (!$row) {
        errorResponse('Usuario no encontrado', 404);
    }

    $appPassword = $_ENV['APP_PASSWORD'] ?? 'Oblicua2026!';
    $hashActual  = $row['password_hash'] ?? '';

    $valido = (strpos($hashActual, '$2y$') === 0 && strpos($hashActual, 'placeholder') === false)
        ? password_verify($actual, $hashActual)
        : ($actual === $appPassword);

    if (!$valido) {
        usleep(300000);
        errorResponse('La contraseña actual es incorrecta', 401);
    }

    $nuevoHash = password_hash($nueva, PASSWORD_BCRYPT, ['cost' => 12]);
    try {
        $db->prepare("UPDATE usuarios SET password_hash = ? WHERE id = ?")
           ->execute([$nuevoHash, $_SESSION['user_id']]);
    } catch (\PDOException $e) {
        error_log('[auth.php] cambiar_password update error: ' . $e->getMessage());
        errorResponse('No se pudo actualizar la contraseña', 500);
        return;
    }

    jsonResponse(['ok' => true, 'message' => 'Contraseña actualizada correctamente']);
}

function handleLogout(): void {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(
            session_name(), '', time() - 42000,
            $p['path'], $p['domain'], $p['secure'], $p['httponly']
        );
    }
    session_destroy();
    jsonResponse(['ok' => true]);
}
