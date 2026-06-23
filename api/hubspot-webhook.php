<?php
/*
 * api/hubspot-webhook.php
 *
 * Procesa notificaciones de la app HubSpot cuando cambian propiedades
 * de una factura (Invoice, objectTypeId 0-53).
 *
 * Acciones según el evento recibido:
 *
 *   hs_invoice_status = paid
 *     → Upsert comisión del asesor   (gasto,   pendiente, ref: hs-inv-com-{id})
 *     → Upsert ingreso en efectivo   (ingreso, pagado,    ref: hs-inv-ing-{id})
 *       solo si metodo_pago = "efectivo"
 *
 *   hs_invoice_status = cancelled | voided
 *     → Soft-delete de ambos registros anteriores
 *
 *   hs_amount_billed  (cualquier valor)
 *     → Si la factura sigue pagada, actualiza montos (upsert)
 *
 * Suscripciones necesarias en la app HubSpot (Webhooks):
 *   Objeto: Factura (0-53) · Evento: Propiedad cambiada
 *     Propiedad 1: hs_invoice_status
 *     Propiedad 2: hs_amount_billed   ← para sincronizar ediciones de monto
 *
 * .env:
 *   HUBSPOT_TOKEN          = pat-nal-...   (Token de acceso)
 *   HUBSPOT_WEBHOOK_SECRET = ****-****-... (Secreto del cliente)
 */

require_once __DIR__ . '/db.php';

$raw = file_get_contents('php://input');

// ── 1. Verificar firma HubSpot ────────────────────────────
if (!verificarFirma($raw)) {
    http_response_code(403);
    exit('Forbidden');
}

// ── 2. Parsear payload ────────────────────────────────────
$eventos = json_decode($raw, true);

// Responder 200 inmediatamente — HubSpot reintenta si no recibe respuesta en 10 s
http_response_code(200);
header('Content-Type: application/json');
echo json_encode(['ok' => true]);
if (function_exists('fastcgi_finish_request')) {
    fastcgi_finish_request();
} else {
    ob_end_flush();
    flush();
}

if (!is_array($eventos) || empty($eventos)) exit;

// ── 3. Enrutar eventos ────────────────────────────────────
try {
    $db    = getDB();
    $token = HUBSPOT_TOKEN;

    foreach ($eventos as $e) {
        if (($e['subscriptionType'] ?? '') !== 'object.propertyChange') continue;
        if (($e['objectTypeId']     ?? '0-53') !== '0-53')              continue;

        $invoiceId     = (string) ($e['objectId']      ?? '');
        $propertyName  = (string) ($e['propertyName']  ?? '');
        $propertyValue = (string) ($e['propertyValue'] ?? '');

        if ($invoiceId === '' || $propertyName === '') continue;

        if ($propertyName === 'hs_invoice_status') {
            switch ($propertyValue) {
                case 'paid':
                    procesarFacturaPagada($db, $invoiceId, $token);
                    break;
                case 'cancelled':
                case 'voided':
                case 'void':
                    procesarAnulacion($db, $invoiceId);
                    break;
            }
        } elseif ($propertyName === 'hs_amount_billed') {
            // Sincroniza el monto si la factura ya estaba pagada
            procesarFacturaPagada($db, $invoiceId, $token);
        }
    }
} catch (Throwable $ex) {
    error_log('[hubspot-webhook] ' . $ex->getMessage());
}
exit;

// ─────────────────────────────────────────────────────────

/**
 * Procesa (o re-procesa) una factura pagada:
 *  - Upsert comisión del asesor   (gasto, pendiente)
 *  - Upsert ingreso en efectivo   (ingreso, pagado) — solo si metodo_pago = efectivo
 */
function procesarFacturaPagada(PDO $db, string $invoiceId, string $token): void
{
    $campos  = 'hs_amount_billed,hs_invoice_status,hubspot_owner_id,hs_invoice_label,punto_de_venta,hs_currency_code,metodo_pago';
    $invoice = hsGet("/crm/v3/objects/invoices/{$invoiceId}?properties={$campos}", $token);

    if (!$invoice || empty($invoice['properties'])) {
        error_log("[Webhook] No se pudo obtener factura #{$invoiceId}");
        return;
    }

    $p          = $invoice['properties'];
    $status     = $p['hs_invoice_status'] ?? '';
    $monto      = (float) ($p['hs_amount_billed'] ?? 0);
    $ownerId    = $p['hubspot_owner_id']   ?? null;
    $titulo     = $p['hs_invoice_label']   ?? "Factura #{$invoiceId}";
    $pdv        = $p['punto_de_venta']     ?? null;
    $moneda     = $p['hs_currency_code']   ?? 'COP';
    $metodoPago = strtolower(trim($p['metodo_pago'] ?? ''));

    // Solo procesar si la factura sigue pagada en HubSpot
    if ($status !== 'paid') {
        error_log("[Webhook] Factura #{$invoiceId} no está pagada (status={$status}), ignorando.");
        return;
    }

    if ($monto <= 0) {
        error_log("[Webhook] Factura #{$invoiceId}: monto={$monto}, sin valor que registrar.");
        return;
    }

    // ── Comisión del asesor ───────────────────────────────
    if ($ownerId) {
        $usuario = buscarUsuarioConComision($db, 'hubspot_owner_id', $ownerId);

        if (!$usuario) {
            // Fallback: buscar por email del owner en HubSpot
            $owner = hsGet("/crm/v3/owners/{$ownerId}", $token);
            if ($owner && !empty($owner['email'])) {
                $usuario = buscarUsuarioConComision($db, 'email', $owner['email']);
                if ($usuario) {
                    // Guardar para evitar esta llamada en el futuro
                    $db->prepare('UPDATE usuarios SET hubspot_owner_id = ? WHERE id = ?')
                       ->execute([$ownerId, $usuario['uid']]);
                }
            }
        }

        if ($usuario && (float) $usuario['porcentaje'] > 0) {
            $comision = (int) round($monto * ((float) $usuario['porcentaje'] / 100));
            if ($comision > 0) {
                upsertMovimiento($db, [
                    'referencia'     => "hs-inv-com-{$invoiceId}",
                    'tipo'           => 'gasto',
                    'descripcion'    => sprintf('Comisión %s%% — %s', $usuario['porcentaje'], $titulo),
                    'valor'          => $comision,
                    'moneda'         => $moneda,
                    'estado'         => 'pendiente',
                    'responsable_id' => $usuario['uid'],
                    'observaciones'  => sprintf(
                        'Factura HubSpot #%s · Base: %s %s · %s%%',
                        $invoiceId,
                        number_format($monto, 0, '.', '.'),
                        $moneda,
                        $usuario['porcentaje']
                    ),
                    'punto_venta'    => $pdv,
                    'categoria_id'   => buscarCategoria($db, 'comisiones'),
                ]);
                error_log(sprintf(
                    '[Webhook] Comisión %s: %s %s para %s (%s%% de %s) — Factura #%s',
                    upsertEsNuevo($db, "hs-inv-com-{$invoiceId}") ? 'registrada' : 'actualizada',
                    number_format($comision, 0, '.', '.'), $moneda,
                    $usuario['nombre'], $usuario['porcentaje'],
                    number_format($monto, 0, '.', '.'), $invoiceId
                ));
            }
        } else {
            error_log("[Webhook] Owner #{$ownerId} sin comisión activa — omitida para factura #{$invoiceId}.");
        }
    }

    // ── Ingreso en efectivo ───────────────────────────────
    if ($metodoPago === 'efectivo') {
        $respId = $ownerId ? buscarUsuarioId($db, $ownerId) : null;
        upsertMovimiento($db, [
            'referencia'     => "hs-inv-ing-{$invoiceId}",
            'tipo'           => 'ingreso',
            'descripcion'    => "Pago en efectivo — {$titulo}",
            'valor'          => (int) round($monto),
            'moneda'         => $moneda,
            'estado'         => 'pagado',
            'responsable_id' => $respId,
            'observaciones'  => "Factura HubSpot #{$invoiceId} · Método: efectivo",
            'punto_venta'    => $pdv,
            'categoria_id'   => buscarCategoriaIngreso($db),
        ]);
        error_log(sprintf(
            '[Webhook] Ingreso efectivo: %s %s — Factura #%s',
            number_format($monto, 0, '.', '.'), $moneda, $invoiceId
        ));
    } elseif ($metodoPago !== '') {
        error_log("[Webhook] Factura #{$invoiceId}: método de pago '{$metodoPago}' — sin ingreso en caja.");
    }
}

/**
 * Soft-delete de comisión e ingreso cuando la factura es cancelada o anulada.
 */
function procesarAnulacion(PDO $db, string $invoiceId): void
{
    $total = 0;
    foreach (["hs-inv-com-{$invoiceId}", "hs-inv-ing-{$invoiceId}"] as $ref) {
        $stmt = $db->prepare(
            'UPDATE movimientos_caja SET deleted_at = NOW() WHERE referencia = ? AND deleted_at IS NULL'
        );
        $stmt->execute([$ref]);
        $total += $stmt->rowCount();
    }
    if ($total > 0) {
        error_log("[Webhook] Anulados {$total} registro(s) para factura #{$invoiceId}");
    } else {
        error_log("[Webhook] Factura #{$invoiceId} anulada pero no había registros activos.");
    }
}

/**
 * INSERT si no existe registro activo con esa referencia; UPDATE si ya existe.
 * En el UPDATE solo modifica valor, descripcion y observaciones (no estado ni fecha).
 */
function upsertMovimiento(PDO $db, array $d): void
{
    $existing = $db->prepare(
        'SELECT id FROM movimientos_caja WHERE referencia = ? AND deleted_at IS NULL LIMIT 1'
    );
    $existing->execute([$d['referencia']]);
    $row = $existing->fetch();

    if ($row) {
        $db->prepare('
            UPDATE movimientos_caja
               SET valor        = :valor,
                   descripcion  = :desc,
                   observaciones = :obs,
                   punto_venta  = :pdv
             WHERE id = :id
        ')->execute([
            ':valor' => $d['valor'],
            ':desc'  => $d['descripcion'],
            ':obs'   => $d['observaciones'],
            ':pdv'   => $d['punto_venta'],
            ':id'    => $row['id'],
        ]);
    } else {
        $db->prepare('
            INSERT INTO movimientos_caja
              (fecha, tipo, descripcion, valor, moneda, estado,
               responsable_id, referencia, observaciones, punto_venta, categoria_id)
            VALUES
              (CURDATE(), :tipo, :desc, :valor, :moneda, :estado,
               :resp, :ref, :obs, :pdv, :cat)
        ')->execute([
            ':tipo'   => $d['tipo'],
            ':desc'   => $d['descripcion'],
            ':valor'  => $d['valor'],
            ':moneda' => $d['moneda'],
            ':estado' => $d['estado'],
            ':resp'   => $d['responsable_id'],
            ':ref'    => $d['referencia'],
            ':obs'    => $d['observaciones'],
            ':pdv'    => $d['punto_venta'],
            ':cat'    => $d['categoria_id'],
        ]);
    }
}

/** Retorna true si el registro con esa referencia ya existía (para logging). */
function upsertEsNuevo(PDO $db, string $referencia): bool
{
    $stmt = $db->prepare(
        'SELECT id FROM movimientos_caja WHERE referencia = ? AND deleted_at IS NULL LIMIT 1'
    );
    $stmt->execute([$referencia]);
    return !$stmt->fetch();
}

// ── Helpers ───────────────────────────────────────────────

function buscarUsuarioConComision(PDO $db, string $columna, string $valor): ?array
{
    if (!in_array($columna, ['email', 'hubspot_owner_id'], true)) return null;
    $stmt = $db->prepare("
        SELECT u.id AS uid, u.nombre, cca.porcentaje
        FROM usuarios u
        JOIN config_comisiones_asesores cca ON cca.usuario_id = u.id
        WHERE u.{$columna} = ? AND u.activo = 1 AND cca.activo = 1
        LIMIT 1
    ");
    $stmt->execute([$valor]);
    return $stmt->fetch() ?: null;
}

function buscarUsuarioId(PDO $db, string $ownerId): ?int
{
    $stmt = $db->prepare('SELECT id FROM usuarios WHERE hubspot_owner_id = ? AND activo = 1 LIMIT 1');
    $stmt->execute([$ownerId]);
    $row = $stmt->fetch();
    return $row ? (int) $row['id'] : null;
}

function buscarCategoria(PDO $db, string $valor): ?int
{
    $stmt = $db->prepare('SELECT id FROM categorias_caja WHERE valor = ? AND activo = 1 LIMIT 1');
    $stmt->execute([$valor]);
    $row = $stmt->fetch();
    return $row ? (int) $row['id'] : null;
}

function buscarCategoriaIngreso(PDO $db): ?int
{
    foreach (['ventas', 'servicios', 'honorarios', 'proyectos'] as $slug) {
        $id = buscarCategoria($db, $slug);
        if ($id !== null) return $id;
    }
    return null;
}

/**
 * Valida la firma HMAC de HubSpot (soporta v1, v2, v3).
 *
 *  v1 : SHA256(secret + body)
 *  v2 : SHA256(secret + method + url + body)
 *  v3 : HMAC-SHA256(secret, method + url + body + timestamp) + ventana 5 min
 */
function verificarFirma(string $raw): bool
{
    $secret    = HUBSPOT_WEBHOOK_SECRET;
    $version   = $_SERVER['HTTP_X_HUBSPOT_SIGNATURE_VERSION'] ?? 'v1';
    $signature = $_SERVER['HTTP_X_HUBSPOT_SIGNATURE']         ?? '';

    if ($secret === '') {
        error_log('[hubspot-webhook] ADVERTENCIA: HUBSPOT_WEBHOOK_SECRET no configurado.');
        return true;
    }
    if ($signature === '') return false;

    $method = $_SERVER['REQUEST_METHOD'] ?? 'POST';
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $url    = $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? '') . ($_SERVER['REQUEST_URI'] ?? '');

    switch ($version) {
        case 'v3':
            $timestamp = $_SERVER['HTTP_X_HUBSPOT_REQUEST_TIMESTAMP'] ?? '0';
            if (abs(time() * 1000 - (int) $timestamp) > 300000) return false;
            $expected = base64_encode(hash_hmac('sha256', $method . $url . $raw . $timestamp, $secret, true));
            break;
        case 'v2':
            $expected = hash('sha256', $secret . $method . $url . $raw);
            break;
        default: // v1
            $expected = hash('sha256', $secret . $raw);
    }

    return hash_equals($expected, $signature);
}

function hsGet(string $path, string $token): ?array
{
    $ch = curl_init("https://api.hubapi.com{$path}");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_HTTPHEADER     => [
            "Authorization: Bearer {$token}",
            'Content-Type: application/json',
        ],
    ]);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    if ($code !== 200 || !$resp) return null;
    return json_decode($resp, true) ?: null;
}
