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

    case 'login':
        handleLogin();
        break;

    case 'logout':
        handleLogout();
        break;

    default:
        errorResponse('Acción no válida', 400);
}

/* ── HELPERS ───────────────────────────────────────────── */

function buildSessionResponse(): array {
    if (!empty($_SESSION['user_id']) && !empty($_SESSION['user'])) {
        return ['ok' => true, 'user' => $_SESSION['user']];
    }
    return ['ok' => false];
}

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
