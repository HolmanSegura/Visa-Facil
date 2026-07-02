<?php
/*
 * api/sync-facturas.php
 *
 * Sincronización retroactiva de facturas HubSpot — por lotes.
 * Cada request procesa N facturas (default 12) para no superar
 * el timeout de 100 s de Cloudflare.
 *
 * Uso:
 *   GET ?desde=2026-06-29                        ← primer lote
 *   GET ?desde=2026-06-29&after=CURSOR           ← lote siguiente
 *   GET ?desde=2026-06-29&dry_run=1              ← solo cuenta, no inserta
 *   GET ?desde=2026-06-29&limite=10              ← facturas por lote (max 20)
 *
 * Respuesta JSON:
 *   { ok, lote_procesado, lote_errores, total_lote,
 *     siguiente_after, hay_mas, detalle[] }
 */

define('HS_WEBHOOK_FUNCTIONS_ONLY', true);
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/hubspot-webhook.php';

// ── Auth ──────────────────────────────────────────────────
session_start();
if (empty($_SESSION['user_id']) || ($_SESSION['user']['rol'] ?? '') !== 'admin') {
    http_response_code(401);
    exit(json_encode(['ok' => false, 'error' => 'Acceso restringido a administradores']));
}

header('Content-Type: application/json; charset=utf-8');
set_time_limit(90); // 90 s por lote

// ── Parámetros ────────────────────────────────────────────
$desde  = $_GET['desde']   ?? '2026-06-29';
$hasta  = $_GET['hasta']   ?? date('Y-m-d');
$after  = $_GET['after']   ?? null;   // cursor de paginación de HubSpot
$limite = min(20, max(1, (int) ($_GET['limite'] ?? 12)));
$dryRun = ($_GET['dry_run'] ?? '0') === '1';
$token  = HUBSPOT_TOKEN;

if (!$token) {
    exit(json_encode(['ok' => false, 'error' => 'HUBSPOT_TOKEN no configurado en .env']));
}

$desdeMs = (int) (strtotime($desde . 'T00:00:00Z') * 1000);
$hastaMs = (int) (strtotime($hasta . 'T23:59:59Z') * 1000);
$db      = getDB();

$propiedades = [
    'hs_amount_billed', 'hs_invoice_status', 'hubspot_owner_id',
    'hs_invoice_label', 'hs_number', 'punto_de_venta',
    'hs_currency_code', 'metodo_de_pago', 'hs_payment_date',
];

// ── Una sola página de resultados ─────────────────────────
$body = [
    'filterGroups' => [[
        'filters' => [
            ['propertyName' => 'hs_invoice_status', 'operator' => 'EQ',  'value' => 'paid'],
            ['propertyName' => 'hs_payment_date',   'operator' => 'GTE', 'value' => (string) $desdeMs],
            ['propertyName' => 'hs_payment_date',   'operator' => 'LTE', 'value' => (string) $hastaMs],
        ],
    ]],
    'properties' => $propiedades,
    'limit'      => $limite,
    'sorts'      => [['propertyName' => 'hs_payment_date', 'direction' => 'ASCENDING']],
];
if ($after !== null) {
    $body['after'] = $after;
}

$resp = hsPostConReintento('/crm/v3/objects/invoices/search', $token, $body);

if (!$resp || !isset($resp['results'])) {
    exit(json_encode(['ok' => false, 'error' => 'No se pudo conectar con HubSpot']));
}

$procesadas    = 0;
$errores       = 0;
$detalle       = [];
$siguienteAfter = $resp['paging']['next']['after'] ?? null;

foreach ($resp['results'] as $invoice) {
    $invoiceId = (string) ($invoice['id'] ?? '');
    if (!$invoiceId) continue;

    $p      = $invoice['properties'] ?? [];
    $titulo = $p['hs_number'] ?? $p['hs_invoice_label'] ?? "Factura #{$invoiceId}";
    $monto  = (float) ($p['hs_amount_billed'] ?? 0);

    $stmt = $db->prepare('SELECT id FROM ingresos_factura WHERE referencia = ? LIMIT 1');
    $stmt->execute(["hs-inv-{$invoiceId}"]);
    $accion = $stmt->fetch() ? 'actualizar' : 'crear';

    if ($dryRun) {
        $detalle[] = ['id' => $invoiceId, 'titulo' => $titulo, 'monto' => $monto, 'accion' => $accion];
        $procesadas++;
        continue;
    }

    try {
        procesarFacturaPagada($db, $invoiceId, $token);
        $procesadas++;
        $detalle[] = ['id' => $invoiceId, 'titulo' => $titulo, 'monto' => $monto, 'accion' => $accion, 'ok' => true];
    } catch (Throwable $e) {
        $errores++;
        $detalle[] = ['id' => $invoiceId, 'titulo' => $titulo, 'accion' => $accion, 'ok' => false, 'error' => $e->getMessage()];
        error_log("[sync-facturas] Error #{$invoiceId}: " . $e->getMessage());
    }

    // Pausa entre facturas — respetar rate limit HubSpot (110 req/10 s)
    usleep(600000); // 600 ms → ~11 llamadas/s por factura
}

echo json_encode([
    'ok'             => true,
    'dry_run'        => $dryRun,
    'desde'          => $desde,
    'hasta'          => $hasta,
    'lote_procesado' => $procesadas,
    'lote_errores'   => $errores,
    'total_lote'     => count($resp['results']),
    'hay_mas'        => $siguienteAfter !== null,
    'siguiente_after'=> $siguienteAfter,
    'detalle'        => $detalle,
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

// ── Helper POST con reintento en 429 ──────────────────────
function hsPostConReintento(string $path, string $token, array $body, int $intentos = 3): ?array
{
    for ($i = 0; $i < $intentos; $i++) {
        $ch = curl_init("https://api.hubapi.com{$path}");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($body),
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_HTTPHEADER     => [
                "Authorization: Bearer {$token}",
                'Content-Type: application/json',
            ],
        ]);
        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);

        if ($code === 429) { sleep(11); continue; }
        if ($code >= 200 && $code < 300 && $resp) return json_decode($resp, true) ?: null;
        return null;
    }
    return null;
}
