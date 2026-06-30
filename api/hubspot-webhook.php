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
 *     → Upsert comisión del asesor   (movimientos_caja gasto, pendiente,
 *                                      ref: hs-inv-com-{id})
 *     → Upsert ingreso en ingresos_factura para TODOS los métodos de pago
 *                                      (ref: hs-inv-{id})
 *     → Upsert ingreso en Caja        (movimientos_caja ingreso, pagado,
 *                                      ref: hs-inv-ing-{id})
 *                                      TODOS los métodos de pago
 *
 *   hs_invoice_status = cancelled | voided
 *     → Soft-delete comisión e ingreso en movimientos_caja
 *     → Marcar ingresos_factura.estado = 'anulado'
 *
 *   hs_amount_billed  (cualquier valor)
 *     → Si la factura sigue pagada, actualiza montos (re-procesa)
 *
 * Suscripciones necesarias en la app HubSpot (Webhooks):
 *   Objeto: Factura (0-53) · Evento: Propiedad cambiada
 *     Propiedad 1: hs_invoice_status
 *     Propiedad 2: hs_amount_billed
 *     Propiedad 3: metodo_de_pago   ← propiedad personalizada de pago
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
        } elseif ($propertyName === 'hs_amount_billed' || $propertyName === 'metodo_de_pago') {
            // Re-sincroniza si la factura ya estaba pagada
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
 *  1. Upsert comisión del asesor en movimientos_caja (gasto, pendiente)
 *  2. Upsert ingreso en ingresos_factura — TODOS los métodos de pago
 *  3. Upsert ingreso en movimientos_caja  — SOLO si método = efectivo (Caja Menor)
 */
function procesarFacturaPagada(PDO $db, string $invoiceId, string $token): void
{
    $campos  = 'hs_amount_billed,hs_invoice_status,hubspot_owner_id,hs_invoice_label,hs_number,punto_de_venta,hs_currency_code,metodo_de_pago';
    $invoice = hsGet("/crm/v3/objects/invoices/{$invoiceId}?properties={$campos}", $token);

    if (!$invoice || empty($invoice['properties'])) {
        error_log("[Webhook] No se pudo obtener factura #{$invoiceId}");
        return;
    }

    $p          = $invoice['properties'];
    $status     = $p['hs_invoice_status'] ?? '';
    $monto      = (float) ($p['hs_amount_billed'] ?? 0);
    $ownerId    = $p['hubspot_owner_id']   ?? null;
    $titulo     = $p['hs_number'] ?? $p['hs_invoice_label'] ?? "Factura #{$invoiceId}";
    $pdv        = $p['punto_de_venta']     ?? null;
    $moneda     = $p['hs_currency_code']   ?? 'COP';
    $metodoPago = strtolower(trim($p['metodo_de_pago'] ?? ''));

    if ($status !== 'paid') {
        error_log("[Webhook] Factura #{$invoiceId} no está pagada (status={$status}), ignorando.");
        return;
    }

    if ($monto <= 0) {
        error_log("[Webhook] Factura #{$invoiceId}: monto={$monto}, sin valor que registrar.");
        return;
    }

    // ── 0. Datos relacionales de la factura (cliente + productos) ──
    $clienteNombre = obtenerClienteFactura($invoiceId, $token);
    $productosStr  = obtenerProductosFactura($invoiceId, $token);

    // ── 1. Comisión del asesor ────────────────────────────
    $asesorId = null;

    if ($ownerId) {
        $usuario = buscarUsuarioConComision($db, 'hubspot_owner_id', $ownerId);

        if (!$usuario) {
            $owner = hsGet("/crm/v3/owners/{$ownerId}", $token);
            if ($owner && !empty($owner['email'])) {
                $usuario = buscarUsuarioConComision($db, 'email', $owner['email']);
                if ($usuario) {
                    $db->prepare('UPDATE usuarios SET hubspot_owner_id = ? WHERE id = ?')
                       ->execute([$ownerId, $usuario['uid']]);
                }
            }
        }

        if ($usuario) {
            $asesorId = (int) $usuario['uid'];

<<<<<<< Updated upstream
            $tipoComision = $usuario['tipo'] ?? 'porcentaje';
            if ($tipoComision === 'fijo') {
                $comision    = (int) round((float) ($usuario['valor_fijo'] ?? 0));
                $descComision = sprintf('Comisión fija %s — %s', number_format($comision, 0, '.', '.'), $titulo);
                $obsComision  = sprintf('Factura HubSpot #%s · Comisión fija: %s %s', $invoiceId, number_format($comision, 0, '.', '.'), $moneda);
            } else {
                $comision    = (float) $usuario['porcentaje'] > 0
                    ? (int) round($monto * ((float) $usuario['porcentaje'] / 100))
                    : 0;
                $descComision = sprintf('Comisión %s%% — %s', $usuario['porcentaje'], $titulo);
                $obsComision  = sprintf('Factura HubSpot #%s · Base: %s %s · %s%%', $invoiceId, number_format($monto, 0, '.', '.'), $moneda, $usuario['porcentaje']);
            }

            if ($comision > 0) {
                upsertMovimiento($db, [
                    'referencia'     => "hs-inv-com-{$invoiceId}",
                    'tipo'           => 'gasto',
                    'descripcion'    => $descComision,
                    'valor'          => $comision,
                    'moneda'         => $moneda,
                    'estado'         => 'pendiente',
                    'responsable_id' => $asesorId,
                    'metodo_pago'    => null,
                    'observaciones'  => $obsComision,
                    'punto_venta'    => $pdv,
                    'categoria_id'   => buscarCategoria($db, 'comisiones'),
                ]);
                error_log(sprintf(
                    '[Webhook] Comisión: %s %s para %s (tipo: %s) — Factura #%s',
                    number_format($comision, 0, '.', '.'), $moneda,
                    $usuario['nombre'], $tipoComision, $invoiceId
                ));
=======
            $productoFactura = extraerProductoFactura($invoice, $titulo);
            $reglaProducto = $productoFactura ? buscarConfigProductoComision($db, $productoFactura) : null;
            $reglaAsesor = buscarConfigAsesorComision($db, $asesorId);

            $regla = $reglaProducto ?: $reglaAsesor;

            if ($regla) {
                $tipoComision = $regla['tipo_comision'] ?? 'porcentaje';
                $valorRegla = (float) ($regla['valor_comision'] ?? $regla['porcentaje'] ?? 0);
                $comision = calcularComisionWebhook($monto, $tipoComision, $valorRegla);

                if ($comision > 0) {
                    $descripcion = $tipoComision === 'fijo'
                        ? sprintf('Comisión fija %s — %s', number_format($valorRegla, 0, '.', '.'), $titulo)
                        : sprintf('Comisión %s%% — %s', rtrim(rtrim(number_format($valorRegla, 2, '.', ''), '0'), '.'), $titulo);

                    $observaciones = $tipoComision === 'fijo'
                        ? sprintf(
                            'Factura HubSpot #%s · Producto: %s · Comisión fija: %s %s',
                            $invoiceId,
                            $productoFactura['nombre'] ?? 'N/D',
                            number_format($valorRegla, 0, '.', '.'),
                            $moneda
                        )
                        : sprintf(
                            'Factura HubSpot #%s · Producto: %s · Base: %s %s · %s%%',
                            $invoiceId,
                            $productoFactura['nombre'] ?? 'N/D',
                            number_format($monto, 0, '.', '.'),
                            $moneda,
                            rtrim(rtrim(number_format($valorRegla, 2, '.', ''), '0'), '.')
                        );

                    upsertMovimiento($db, [
                        'referencia'     => "hs-inv-com-{$invoiceId}",
                        'tipo'           => 'gasto',
                        'descripcion'    => $descripcion,
                        'valor'          => (int) round($comision),
                        'moneda'         => $moneda,
                        'estado'         => 'pendiente',
                        'responsable_id' => $asesorId,
                        'metodo_pago'    => null,
                        'observaciones'  => $observaciones,
                        'punto_venta'    => $pdv,
                        'categoria_id'   => buscarCategoria($db, 'comisiones'),
                    ]);
                }
>>>>>>> Stashed changes
            } else {
                error_log("[Webhook] Asesor #{$ownerId} sin regla de comisión activa — omitida para factura #{$invoiceId}.");
            }
        } else {
            $asesorId = buscarUsuarioId($db, $ownerId);
        }
    }

    // ── 2. Ingreso en movimientos_caja — TODOS los métodos ──
    $metodoDesc = $metodoPago ?: 'otro';
    $obsIngreso  = sprintf('HubSpot %s · Método: %s', $invoiceId, $metodoDesc);
    if ($productosStr) $obsIngreso .= " · Productos: {$productosStr}";

    upsertMovimiento($db, [
        'referencia'     => "hs-inv-ing-{$invoiceId}",
        'tipo'           => 'ingreso',
        'descripcion'    => "{$titulo}",
        'valor'          => (int) round($monto),
        'moneda'         => $moneda,
        'estado'         => 'pagado',
        'responsable_id' => $asesorId,
        'metodo_pago'    => $metodoPago ?: null,
        'observaciones'  => $obsIngreso,
        'punto_venta'    => $pdv,
        'categoria_id'   => buscarCategoriaIngreso($db),
    ]);
    $movCajaId = buscarMovimientoId($db, "hs-inv-ing-{$invoiceId}");

    // Guardar cliente en el ingreso de caja
    if ($clienteNombre && $movCajaId) {
        $db->prepare('UPDATE movimientos_caja SET cliente = ? WHERE id = ? AND deleted_at IS NULL')
           ->execute([$clienteNombre, $movCajaId]);
    }

    error_log(sprintf(
        '[Webhook] Ingreso Caja: %s %s (método: %s) — %s%s',
        number_format($monto, 0, '.', '.'), $moneda, $metodoDesc, $titulo,
        $clienteNombre ? " · Cliente: {$clienteNombre}" : ''
    ));

    // ── 3. Ingreso en ingresos_factura — TODOS los métodos ─
    $productoFactura = isset($productoFactura) ? $productoFactura : extraerProductoFactura($invoice, $titulo);

    upsertIngreso($db, [
        'hubspot_inv_id' => $invoiceId,
        'referencia'     => "hs-inv-{$invoiceId}",
        'monto'          => $monto,
        'moneda'         => $moneda,
        'metodo_pago'    => $metodoPago,
        'titulo'         => $titulo,
        'punto_venta'    => $pdv,
        'asesor_id'      => $asesorId,
        'mov_caja_id'    => $movCajaId,
        'producto_id'    => $productoFactura['id'] ?? null,
        'producto_nombre'=> $productoFactura['nombre'] ?? null,
    ]);
    error_log(sprintf(
        '[Webhook] ingresos_factura: %s %s (método: %s) — %s',
        number_format($monto, 0, '.', '.'), $moneda,
        $metodoDesc, $titulo
    ));

    // ── 4. Vincular gasto de comisión → ingresos_factura ───
    $ingresoFacturaId = buscarIngresoFacturaId($db, "hs-inv-{$invoiceId}");
    if ($ingresoFacturaId) {
        $db->prepare('
            UPDATE movimientos_caja
               SET ingreso_factura_id = ?
             WHERE referencia = ? AND deleted_at IS NULL
        ')->execute([$ingresoFacturaId, "hs-inv-com-{$invoiceId}"]);
    }

    // Guardar cliente en el gasto de comisión
    if ($clienteNombre) {
        $db->prepare('UPDATE movimientos_caja SET cliente = ? WHERE referencia = ? AND deleted_at IS NULL')
           ->execute([$clienteNombre, "hs-inv-com-{$invoiceId}"]);
    }
}

/**
 * Soft-delete de comisión e ingreso en movimientos_caja;
 * marca ingresos_factura como anulado.
 */
function procesarAnulacion(PDO $db, string $invoiceId): void
{
    $totalMov = 0;
    foreach (["hs-inv-com-{$invoiceId}", "hs-inv-ing-{$invoiceId}"] as $ref) {
        $stmt = $db->prepare(
            'UPDATE movimientos_caja SET deleted_at = NOW() WHERE referencia = ? AND deleted_at IS NULL'
        );
        $stmt->execute([$ref]);
        $totalMov += $stmt->rowCount();
    }

    $stmtIng = $db->prepare(
        "UPDATE ingresos_factura SET estado = 'anulado', updated_at = NOW() WHERE referencia = ?"
    );
    $stmtIng->execute(["hs-inv-{$invoiceId}"]);
    $totalIng = $stmtIng->rowCount();

    error_log(sprintf(
        '[Webhook] Anulación factura #%s: %d mov_caja + %d ingresos_factura afectados.',
        $invoiceId, $totalMov, $totalIng
    ));
}

/**
 * INSERT si no existe registro activo con esa referencia; UPDATE si ya existe.
 * En el UPDATE solo modifica valor, descripcion, observaciones y punto_venta.
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
               SET valor         = :valor,
                   descripcion   = :desc,
                   observaciones = :obs,
                   punto_venta   = :pdv
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
               responsable_id, referencia, observaciones, punto_venta, categoria_id, metodo_pago)
            VALUES
              (CURDATE(), :tipo, :desc, :valor, :moneda, :estado,
               :resp, :ref, :obs, :pdv, :cat, :metodo)
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
            ':metodo' => $d['metodo_pago'] ?? null,
        ]);
    }
}

/**
 * Upsert en ingresos_factura (fuente de verdad para comisiones).
 * Al re-procesar una factura ya existente, actualiza monto, método y asesor;
 * reactiva el registro si estaba anulado.
 */
function upsertIngreso(PDO $db, array $d): void
{
    $existing = $db->prepare(
        'SELECT id FROM ingresos_factura WHERE referencia = ? LIMIT 1'
    );
    $existing->execute([$d['referencia']]);
    $row = $existing->fetch();

    if ($row) {
        $db->prepare('
            UPDATE ingresos_factura
               SET monto          = :monto,
                   metodo_pago    = :metodo,
                   titulo         = :titulo,
                   punto_venta    = :pdv,
                   asesor_id      = :asesor,
                   mov_caja_id    = COALESCE(:caja, mov_caja_id),
                   producto_id    = :producto_id,
                   producto_nombre= :producto_nombre,
                   estado         = "activo",
                   updated_at     = NOW()
             WHERE id = :id
        ')->execute([
            ':monto'          => $d['monto'],
            ':metodo'         => $d['metodo_pago'],
            ':titulo'         => $d['titulo'],
            ':pdv'            => $d['punto_venta'],
            ':asesor'         => $d['asesor_id'],
            ':caja'           => $d['mov_caja_id'],
            ':producto_id'    => $d['producto_id'] ?? null,
            ':producto_nombre'=> $d['producto_nombre'] ?? null,
            ':id'             => $row['id'],
        ]);
    } else {
        $db->prepare('
            INSERT INTO ingresos_factura
              (hubspot_inv_id, referencia, fecha_pago, monto, moneda, metodo_pago,
               titulo, punto_venta, asesor_id, mov_caja_id, producto_id, producto_nombre, estado)
            VALUES
              (:inv, :ref, CURDATE(), :monto, :moneda, :metodo,
               :titulo, :pdv, :asesor, :caja, :producto_id, :producto_nombre, "activo")
        ')->execute([
            ':inv'            => $d['hubspot_inv_id'],
            ':ref'            => $d['referencia'],
            ':monto'          => $d['monto'],
            ':moneda'         => $d['moneda'],
            ':metodo'         => $d['metodo_pago'],
            ':titulo'         => $d['titulo'],
            ':pdv'            => $d['punto_venta'],
            ':asesor'         => $d['asesor_id'],
            ':caja'           => $d['mov_caja_id'],
            ':producto_id'    => $d['producto_id'] ?? null,
            ':producto_nombre'=> $d['producto_nombre'] ?? null,
        ]);
    }
}

// ── Helpers ───────────────────────────────────────────────

function buscarUsuarioConComision(PDO $db, string $columna, string $valor): ?array
{
    if (!in_array($columna, ['email', 'hubspot_owner_id'], true)) return null;
    $stmt = $db->prepare("
        SELECT u.id AS uid, u.nombre, cca.tipo, cca.porcentaje, cca.valor_fijo
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

function buscarMovimientoId(PDO $db, string $referencia): ?int
{
    $stmt = $db->prepare(
        'SELECT id FROM movimientos_caja WHERE referencia = ? AND deleted_at IS NULL LIMIT 1'
    );
    $stmt->execute([$referencia]);
    $row = $stmt->fetch();
    return $row ? (int) $row['id'] : null;
}

function buscarIngresoFacturaId(PDO $db, string $referencia): ?int
{
    $stmt = $db->prepare(
        'SELECT id FROM ingresos_factura WHERE referencia = ? AND estado = "activo" LIMIT 1'
    );
    $stmt->execute([$referencia]);
    $row = $stmt->fetch();
    return $row ? (int) $row['id'] : null;
}

/**
 * Devuelve el nombre del primer contacto asociado a la factura,
 * o cadena vacía si no hay asociación o falla la llamada.
 */
function obtenerClienteFactura(string $invoiceId, string $token): string
{
    try {
        $assoc = hsGet("/crm/v3/objects/invoices/{$invoiceId}/associations/contacts?limit=1", $token);
        if (empty($assoc['results'][0]['id'])) return '';
        $contactId = $assoc['results'][0]['id'];
        $contact = hsGet("/crm/v3/objects/contacts/{$contactId}?properties=firstname,lastname,company", $token);
        if (empty($contact['properties'])) return '';
        $p = $contact['properties'];
        $nombre = trim(($p['firstname'] ?? '') . ' ' . ($p['lastname'] ?? ''));
        if ($nombre === '') $nombre = $p['company'] ?? '';
        return $nombre;
    } catch (Throwable $e) {
        error_log("[Webhook] obtenerClienteFactura #{$invoiceId}: " . $e->getMessage());
        return '';
    }
}

/**
 * Devuelve los nombres de los productos (line items) asociados a la factura,
 * separados por coma, o cadena vacía si no hay o falla.
 */
function obtenerProductosFactura(string $invoiceId, string $token): string
{
    try {
        $assoc = hsGet("/crm/v3/objects/invoices/{$invoiceId}/associations/line_items?limit=10", $token);
        if (empty($assoc['results'])) return '';
        $nombres = [];
        foreach ($assoc['results'] as $li) {
            if (empty($li['id'])) continue;
            $item = hsGet("/crm/v3/objects/line_items/{$li['id']}?properties=name", $token);
            if (!empty($item['properties']['name'])) {
                $nombres[] = $item['properties']['name'];
            }
        }
        return implode(', ', $nombres);
    } catch (Throwable $e) {
        error_log("[Webhook] obtenerProductosFactura #{$invoiceId}: " . $e->getMessage());
        return '';
    }
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

function calcularComisionWebhook(float $monto, string $tipo, float $valor): float
{
    if ($tipo === 'fijo') {
        return round($valor, 0);
    }
    return round($monto * $valor / 100, 0);
}

function buscarConfigAsesorComision(PDO $db, int $asesorId): ?array
{
    $stmt = $db->prepare("
        SELECT
            usuario_id,
            porcentaje,
            COALESCE(tipo_comision, 'porcentaje') AS tipo_comision,
            COALESCE(valor_comision, porcentaje, 0) AS valor_comision,
            activo
        FROM config_comisiones_asesores
        WHERE usuario_id = ? AND activo = 1
        LIMIT 1
    ");
    $stmt->execute([$asesorId]);
    return $stmt->fetch() ?: null;
}

function buscarConfigProductoComision(PDO $db, array $producto): ?array
{
    $id = $producto['id'] ?? null;
    $nombre = $producto['nombre'] ?? null;

    $stmt = $db->prepare("
        SELECT
            *,
            COALESCE(tipo_comision, 'porcentaje') AS tipo_comision,
            COALESCE(valor_comision, porcentaje, 0) AS valor_comision
        FROM config_comisiones_productos
        WHERE
            (? IS NOT NULL AND (hubspot_product_id = ? OR producto_id = ?))
            OR
            (? IS NOT NULL AND nombre_producto = ?)
        ORDER BY id DESC
        LIMIT 1
    ");
    $stmt->execute([$id, $id, $id, $nombre, $nombre]);
    return $stmt->fetch() ?: null;
}

function extraerProductoFactura(array $invoice, string $tituloFallback = 'Servicio'): array
{
    $props = $invoice['properties'] ?? [];

    return [
        'id' => $props['producto_id'] ?? $props['hs_product_id'] ?? null,
        'nombre' => $props['producto_nombre'] ?? $props['line_item_name'] ?? $tituloFallback,
    ];
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
