<?php
/* ============================================================
   API/COTIZACIONES.PHP
   REST endpoint para el módulo de Cotizaciones.

   Rutas:
     GET    /api/cotizaciones.php          → listar (con filtros)
     GET    /api/cotizaciones.php?id=N     → detalle con líneas
     POST   /api/cotizaciones.php          → crear
     PATCH  /api/cotizaciones.php?id=N     → actualizar parcial
     DELETE /api/cotizaciones.php?id=N     → soft delete

   Filtros GET disponibles (query string):
     estado, estado_firma, moneda, usuario_id, cliente_id,
     busqueda (LIKE en título), desde, hasta (por fecha_creacion),
     pagina (default 1), por_pagina (default 25)
   ============================================================ */

require_once __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int) $_GET['id'] : null;

try {
    $db = getDB();

    // ── GET /cotizaciones.php?id=N ───────────────────────────
    if ($method === 'GET' && $id) {
        $sql = "
            SELECT
                c.*,
                u.nombre  AS responsable,
                cl.nombre AS cliente_nombre,
                n.nombre  AS negocio_nombre
            FROM cotizaciones c
            LEFT JOIN usuarios u  ON u.id  = c.usuario_id
            LEFT JOIN clientes cl ON cl.id = c.cliente_id
            LEFT JOIN negocios n  ON n.id  = c.negocio_id
            WHERE c.id = :id AND c.deleted_at IS NULL
        ";
        $stmt = $db->prepare($sql);
        $stmt->execute([':id' => $id]);
        $cot = $stmt->fetch();

        if (!$cot) errorResponse('Cotización no encontrada', 404);

        // Cargar líneas de artículo
        $stmtL = $db->prepare("
            SELECT l.*, p.sku FROM cotizacion_lineas l
            LEFT JOIN productos p ON p.id = l.producto_id
            WHERE l.cotizacion_id = :id
            ORDER BY l.orden, l.id
        ");
        $stmtL->execute([':id' => $id]);
        $cot['lineas'] = $stmtL->fetchAll();

        jsonResponse(['ok' => true, 'data' => $cot]);
    }

    // ── GET /cotizaciones.php (listar) ───────────────────────
    if ($method === 'GET') {
        $where  = ['c.deleted_at IS NULL'];
        $params = [];

        if (!empty($_GET['estado'])) {
            $estados = array_map('trim', explode(',', $_GET['estado']));
            $ph = implode(',', array_fill(0, count($estados), '?'));
            $where[]  = "c.estado IN ($ph)";
            array_push($params, ...$estados);
        }
        if (!empty($_GET['estado_firma'])) {
            $where[]    = "c.estado_firma = ?";
            $params[]   = $_GET['estado_firma'];
        }
        if (!empty($_GET['moneda'])) {
            $where[]    = "c.moneda = ?";
            $params[]   = $_GET['moneda'];
        }
        if (!empty($_GET['usuario_id'])) {
            $where[]    = "c.usuario_id = ?";
            $params[]   = (int) $_GET['usuario_id'];
        }
        if (!empty($_GET['cliente_id'])) {
            $where[]    = "c.cliente_id = ?";
            $params[]   = (int) $_GET['cliente_id'];
        }
        if (!empty($_GET['busqueda'])) {
            $where[]    = "c.titulo LIKE ?";
            $params[]   = '%' . $_GET['busqueda'] . '%';
        }
        if (!empty($_GET['desde'])) {
            $where[]    = "c.fecha_creacion >= ?";
            $params[]   = $_GET['desde'];
        }
        if (!empty($_GET['hasta'])) {
            $where[]    = "c.fecha_creacion <= ?";
            $params[]   = $_GET['hasta'];
        }

        $pagina    = max(1, (int) ($_GET['pagina']    ?? 1));
        $porPagina = max(1, min(200, (int) ($_GET['por_pagina'] ?? 25)));
        $offset    = ($pagina - 1) * $porPagina;

        $whereStr = 'WHERE ' . implode(' AND ', $where);

        // Total para paginación
        $stmtCnt = $db->prepare("SELECT COUNT(*) FROM cotizaciones c $whereStr");
        $stmtCnt->execute($params);
        $total = (int) $stmtCnt->fetchColumn();

        $sql = "
            SELECT
                c.id, c.titulo, c.estado, c.estado_firma,
                c.moneda, c.cantidad, c.fecha_creacion, c.fecha_vencimiento,
                u.nombre  AS responsable,
                cl.nombre AS cliente,
                n.nombre  AS negocio
            FROM cotizaciones c
            LEFT JOIN usuarios u  ON u.id  = c.usuario_id
            LEFT JOIN clientes cl ON cl.id = c.cliente_id
            LEFT JOIN negocios n  ON n.id  = c.negocio_id
            $whereStr
            ORDER BY c.fecha_creacion DESC
            LIMIT $porPagina OFFSET $offset
        ";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        jsonResponse([
            'ok'       => true,
            'data'     => $rows,
            'total'    => $total,
            'pagina'   => $pagina,
            'paginas'  => (int) ceil($total / $porPagina),
        ]);
    }

    // ── POST (crear) ─────────────────────────────────────────
    if ($method === 'POST') {
        $b = getBody();

        if (empty($b['titulo'])) errorResponse('El campo titulo es obligatorio');

        // Resolver IDs de usuario y cliente (aceptar nombre o id)
        $usuarioId = resolverUsuarioId($db, $b);
        $clienteId = resolverClienteId($db, $b);
        $negocioId = resolverNegocioId($db, $b, $clienteId);

        $stmt = $db->prepare("
            INSERT INTO cotizaciones
              (titulo, estado, estado_firma, moneda, cantidad,
               descuento_global, tipo_descuento_global, tasa_iva,
               fecha_creacion, fecha_vencimiento,
               usuario_id, cliente_id, negocio_id, notas)
            VALUES
              (:titulo, :estado, :estado_firma, :moneda, :cantidad,
               :desc_global, :tipo_desc, :tasa_iva,
               :fecha_creacion, :fecha_vencimiento,
               :usuario_id, :cliente_id, :negocio_id, :notas)
        ");
        $stmt->execute([
            ':titulo'           => $b['titulo'],
            ':estado'           => $b['estado']          ?? 'borrador',
            ':estado_firma'     => $b['estado_firma']     ?? 'no_aplica',
            ':moneda'           => $b['moneda']           ?? 'COP',
            ':cantidad'         => $b['cantidad']         ?? 0,
            ':desc_global'      => $b['descuento_global'] ?? 0,
            ':tipo_desc'        => $b['tipo_descuento_global'] ?? 'porcentaje',
            ':tasa_iva'         => $b['tasa_iva']         ?? 0.19,
            ':fecha_creacion'   => $b['fecha_creacion']   ?? date('Y-m-d'),
            ':fecha_vencimiento'=> $b['fecha_vencimiento'] ?? null,
            ':usuario_id'       => $usuarioId,
            ':cliente_id'       => $clienteId,
            ':negocio_id'       => $negocioId,
            ':notas'            => $b['notas']            ?? null,
        ]);
        $newId = (int) $db->lastInsertId();

        // Insertar líneas si las trae el request
        if (!empty($b['lineas']) && is_array($b['lineas'])) {
            insertarLineas($db, $newId, $b['lineas']);
        }

        jsonResponse(['ok' => true, 'id' => $newId], 201);
    }

    // ── PATCH (actualizar) ───────────────────────────────────
    if ($method === 'PATCH' && $id) {
        $b      = getBody();
        $campos = [];
        $vals   = [];

        $permitidos = [
            'titulo','estado','estado_firma','moneda','cantidad',
            'descuento_global','tipo_descuento_global','tasa_iva',
            'fecha_creacion','fecha_vencimiento','notas',
            'usuario_id','cliente_id','negocio_id','hubspot_invoice_id'
        ];
        foreach ($permitidos as $c) {
            if (array_key_exists($c, $b)) {
                $campos[] = "`$c` = ?";
                $vals[]   = $b[$c];
            }
        }
        if (empty($campos)) errorResponse('Sin campos para actualizar');

        $vals[] = $id;
        $db->prepare("UPDATE cotizaciones SET " . implode(', ', $campos) . " WHERE id = ? AND deleted_at IS NULL")
           ->execute($vals);

        if (isset($b['lineas'])) {
            $db->prepare("DELETE FROM cotizacion_lineas WHERE cotizacion_id = ?")->execute([$id]);
            insertarLineas($db, $id, $b['lineas']);
        }

        jsonResponse(['ok' => true]);
    }

    // ── DELETE (soft delete) ─────────────────────────────────
    if ($method === 'DELETE' && $id) {
        $db->prepare("UPDATE cotizaciones SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL")
           ->execute([$id]);
        jsonResponse(['ok' => true]);
    }

    errorResponse('Método no soportado', 405);

} catch (PDOException $e) {
    error_log('[cotizaciones.php] PDOException: ' . $e->getMessage());
    errorResponse('Error de base de datos', 500);
}

// ── Helpers ──────────────────────────────────────────────────

function resolverUsuarioId(PDO $db, array $b): ?int {
    if (!empty($b['usuario_id'])) return (int) $b['usuario_id'];
    if (!empty($b['responsable'])) {
        $s = $db->prepare("SELECT id FROM usuarios WHERE nombre = ? LIMIT 1");
        $s->execute([$b['responsable']]);
        $row = $s->fetch();
        return $row ? (int) $row['id'] : null;
    }
    return null;
}

function resolverClienteId(PDO $db, array $b): ?int {
    if (!empty($b['cliente_id'])) return (int) $b['cliente_id'];
    if (!empty($b['cliente'])) {
        $s = $db->prepare("SELECT id FROM clientes WHERE nombre = ? LIMIT 1");
        $s->execute([$b['cliente']]);
        $row = $s->fetch();
        if ($row) return (int) $row['id'];
        // Auto-crear cliente si no existe
        $db->prepare("INSERT INTO clientes (nombre) VALUES (?)")->execute([$b['cliente']]);
        return (int) $db->lastInsertId();
    }
    return null;
}

function resolverNegocioId(PDO $db, array $b, ?int $clienteId): ?int {
    if (!empty($b['negocio_id'])) return (int) $b['negocio_id'];
    if (!empty($b['negocio'])) {
        $dealId = !empty($b['hubspot_deal_id']) ? $b['hubspot_deal_id'] : null;

        // Buscar por nombre primero
        $s = $db->prepare("SELECT id FROM negocios WHERE nombre = ? LIMIT 1");
        $s->execute([$b['negocio']]);
        $row = $s->fetch();

        if ($row) {
            // Actualizar hubspot_deal_id si viene informado y era NULL
            if ($dealId) {
                $db->prepare("UPDATE negocios SET hubspot_deal_id = ? WHERE id = ? AND (hubspot_deal_id IS NULL OR hubspot_deal_id = '')")
                   ->execute([$dealId, (int) $row['id']]);
            }
            return (int) $row['id'];
        }

        // Crear nuevo negocio
        $db->prepare("INSERT INTO negocios (nombre, hubspot_deal_id, cliente_id) VALUES (?, ?, ?)")
           ->execute([$b['negocio'], $dealId, $clienteId]);
        return (int) $db->lastInsertId();
    }
    return null;
}

function insertarLineas(PDO $db, int $cotId, array $lineas): void {
    $stmt = $db->prepare("
        INSERT INTO cotizacion_lineas
          (cotizacion_id, producto_id, nombre_producto, descripcion,
           precio_unitario, cantidad, descuento, tipo_descuento, subtotal, orden)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    foreach ($lineas as $i => $l) {
        $pu  = (float) ($l['precioUnitario'] ?? $l['precio_unitario'] ?? 0);
        $qty = (float) ($l['cantidad'] ?? 1);
        $dsc = (float) ($l['descuento'] ?? 0);
        $td  = $l['tipoDescuento'] ?? $l['tipo_descuento'] ?? 'porcentaje';
        $sub = $td === 'porcentaje'
            ? $pu * $qty * (1 - $dsc / 100)
            : $pu * $qty - $dsc;
        $stmt->execute([
            $cotId,
            $l['productoId'] ?? $l['producto_id'] ?? null,
            $l['nombre'] ?? $l['nombre_producto'] ?? 'Servicio',
            $l['descripcion'] ?? null,
            $pu, $qty, $dsc, $td,
            round($sub, 2),
            $i
        ]);
    }
}
