<?php
/* ============================================================
   API/CAJA.PHP
   REST endpoint para el módulo Caja (movimientos).

   Rutas:
     GET    /api/caja.php              → listar (con filtros)
     GET    /api/caja.php?id=N         → detalle con adjunto
     POST   /api/caja.php              → crear movimiento
     PATCH  /api/caja.php?id=N         → actualizar parcial
     DELETE /api/caja.php?id=N         → soft delete

   Filtros GET:
     tipo, categoria, estado, metodo_pago, responsable_id,
     cliente_id, busqueda, desde, hasta (fecha),
     pagina, por_pagina
   ============================================================ */

require_once __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int) $_GET['id'] : null;

try {
    $db = getDB();

    // ── GET detalle ──────────────────────────────────────────
    if ($method === 'GET' && $id) {
        $stmt = $db->prepare("
            SELECT
                m.*,
                u.nombre   AS responsable,
                cl.nombre  AS cliente_nombre,
                cat.nombre AS categoria_nombre,
                cat.icono  AS categoria_icono,
                a.nombre_original AS adjunto
            FROM movimientos_caja m
            LEFT JOIN usuarios      u   ON u.id   = m.responsable_id
            LEFT JOIN clientes      cl  ON cl.id  = m.cliente_id
            LEFT JOIN categorias_caja cat ON cat.id = m.categoria_id
            LEFT JOIN adjuntos      a   ON a.movimiento_caja_id = m.id
            WHERE m.id = :id AND m.deleted_at IS NULL
        ");
        $stmt->execute([':id' => $id]);
        $mov = $stmt->fetch();
        if (!$mov) errorResponse('Movimiento no encontrado', 404);
        jsonResponse(['ok' => true, 'data' => $mov]);
    }

    // ── GET listar ───────────────────────────────────────────
    if ($method === 'GET') {
        $where  = ['m.deleted_at IS NULL'];
        $params = [];

        if (!empty($_GET['tipo'])) {
            $where[]  = "m.tipo = ?";
            $params[] = $_GET['tipo'];
        }
        if (!empty($_GET['categoria'])) {
            $cats = array_map('trim', explode(',', $_GET['categoria']));
            $ph   = implode(',', array_fill(0, count($cats), '?'));
            $where[] = "cat.valor IN ($ph)";
            array_push($params, ...$cats);
        }
        if (!empty($_GET['estado'])) {
            $where[]  = "m.estado = ?";
            $params[] = $_GET['estado'];
        }
        if (!empty($_GET['metodo_pago'])) {
            $where[]  = "m.metodo_pago = ?";
            $params[] = $_GET['metodo_pago'];
        }
        if (!empty($_GET['responsable_id'])) {
            $where[]  = "m.responsable_id = ?";
            $params[] = (int) $_GET['responsable_id'];
        }
        if (!empty($_GET['cliente_id'])) {
            $where[]  = "m.cliente_id = ?";
            $params[] = (int) $_GET['cliente_id'];
        }
        if (!empty($_GET['busqueda'])) {
            $where[]  = "m.descripcion LIKE ?";
            $params[] = '%' . $_GET['busqueda'] . '%';
        }
        if (!empty($_GET['desde'])) {
            $where[]  = "m.fecha >= ?";
            $params[] = $_GET['desde'];
        }
        if (!empty($_GET['hasta'])) {
            $where[]  = "m.fecha <= ?";
            $params[] = $_GET['hasta'];
        }

        $pagina    = max(1, (int) ($_GET['pagina']    ?? 1));
        $porPagina = max(1, min(200, (int) ($_GET['por_pagina'] ?? 25)));
        $offset    = ($pagina - 1) * $porPagina;
        $whereStr  = 'WHERE ' . implode(' AND ', $where);

        $stmtCnt = $db->prepare("
            SELECT COUNT(*) FROM movimientos_caja m
            LEFT JOIN categorias_caja cat ON cat.id = m.categoria_id
            $whereStr
        ");
        $stmtCnt->execute($params);
        $total = (int) $stmtCnt->fetchColumn();

        $stmt = $db->prepare("
            SELECT
                m.id, m.fecha, m.tipo, m.descripcion,
                m.valor, m.moneda, m.estado, m.metodo_pago,
                m.referencia, m.observaciones,
                u.nombre   AS responsable,
                cl.nombre  AS cliente,
                cat.valor  AS categoria,
                cat.nombre AS categoria_nombre,
                cat.icono  AS categoria_icono,
                (SELECT a.nombre_original FROM adjuntos a WHERE a.movimiento_caja_id = m.id LIMIT 1) AS adjunto
            FROM movimientos_caja m
            LEFT JOIN usuarios        u   ON u.id   = m.responsable_id
            LEFT JOIN clientes        cl  ON cl.id  = m.cliente_id
            LEFT JOIN categorias_caja cat ON cat.id  = m.categoria_id
            $whereStr
            ORDER BY m.fecha DESC, m.id DESC
            LIMIT $porPagina OFFSET $offset
        ");
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        // Totales de la vista actual (sin paginación)
        $stmtTotales = $db->prepare("
            SELECT
                SUM(CASE WHEN m.tipo='ingreso' AND m.estado != 'anulado' THEN m.valor ELSE 0 END) AS total_ingresos,
                SUM(CASE WHEN m.tipo='gasto'   AND m.estado != 'anulado' THEN m.valor ELSE 0 END) AS total_gastos,
                SUM(CASE WHEN m.estado='pendiente' THEN m.valor ELSE 0 END) AS total_pendientes
            FROM movimientos_caja m
            LEFT JOIN categorias_caja cat ON cat.id = m.categoria_id
            $whereStr
        ");
        $stmtTotales->execute($params);
        $totales = $stmtTotales->fetch();

        jsonResponse([
            'ok'       => true,
            'data'     => $rows,
            'total'    => $total,
            'pagina'   => $pagina,
            'paginas'  => (int) ceil($total / $porPagina),
            'totales'  => [
                'ingresos'   => (float) ($totales['total_ingresos']  ?? 0),
                'gastos'     => (float) ($totales['total_gastos']    ?? 0),
                'pendientes' => (float) ($totales['total_pendientes'] ?? 0),
            ],
        ]);
    }

    // ── POST (crear) ─────────────────────────────────────────
    if ($method === 'POST') {
        $b = getBody();

        if (empty($b['descripcion'])) errorResponse('El campo descripcion es obligatorio');
        if (empty($b['tipo']))        errorResponse('El campo tipo es obligatorio (ingreso|gasto)');

        $categoriaId  = resolverCategoriaId($db, $b);
        $responsableId = resolverUsuarioId($db, $b);
        $clienteId    = resolverClienteId($db, $b);
        $referencia   = generarReferencia($db);

        $stmt = $db->prepare("
            INSERT INTO movimientos_caja
              (fecha, tipo, categoria_id, descripcion, responsable_id,
               valor, moneda, estado, metodo_pago, observaciones,
               cliente_id, cotizacion_id, referencia)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $b['fecha']          ?? date('Y-m-d'),
            $b['tipo'],
            $categoriaId,
            $b['descripcion'],
            $responsableId,
            $b['valor']          ?? 0,
            $b['moneda']         ?? 'COP',
            $b['estado']         ?? 'pendiente',
            $b['metodo_pago']    ?? null,
            $b['observaciones']  ?? null,
            $clienteId,
            $b['cotizacion_id']  ?? null,
            $referencia,
        ]);
        $newId = (int) $db->lastInsertId();

        jsonResponse(['ok' => true, 'id' => $newId, 'referencia' => $referencia], 201);
    }

    // ── PATCH (actualizar) ───────────────────────────────────
    if ($method === 'PATCH' && $id) {
        $b      = getBody();
        $campos = [];
        $vals   = [];

        $permitidos = [
            'fecha','tipo','descripcion','valor','moneda',
            'estado','metodo_pago','observaciones',
            'categoria_id','responsable_id','cliente_id','cotizacion_id'
        ];
        if (!empty($b['categoria'])) {
            $b['categoria_id'] = resolverCategoriaId($db, $b);
        }
        if (!empty($b['responsable'])) {
            $b['responsable_id'] = resolverUsuarioId($db, $b);
        }
        if (!empty($b['cliente'])) {
            $b['cliente_id'] = resolverClienteId($db, $b);
        }
        foreach ($permitidos as $c) {
            if (array_key_exists($c, $b)) {
                $campos[] = "`$c` = ?";
                $vals[]   = $b[$c];
            }
        }
        if (empty($campos)) errorResponse('Sin campos para actualizar');

        $vals[] = $id;
        $db->prepare("UPDATE movimientos_caja SET " . implode(', ', $campos) . " WHERE id = ? AND deleted_at IS NULL")
           ->execute($vals);

        jsonResponse(['ok' => true]);
    }

    // ── DELETE (soft delete) ─────────────────────────────────
    if ($method === 'DELETE' && $id) {
        $db->prepare("UPDATE movimientos_caja SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL")
           ->execute([$id]);
        jsonResponse(['ok' => true]);
    }

    errorResponse('Método no soportado', 405);

} catch (PDOException $e) {
    error_log('[caja.php] PDOException: ' . $e->getMessage());
    errorResponse('Error de base de datos', 500);
}

// ── Helpers ──────────────────────────────────────────────────

function resolverUsuarioId(PDO $db, array $b): ?int {
    if (!empty($b['responsable_id'])) return (int) $b['responsable_id'];
    if (!empty($b['responsable'])) {
        $s = $db->prepare("SELECT id FROM usuarios WHERE nombre = ? LIMIT 1");
        $s->execute([$b['responsable']]);
        $r = $s->fetch();
        return $r ? (int) $r['id'] : null;
    }
    return null;
}

function resolverClienteId(PDO $db, array $b): ?int {
    if (!empty($b['cliente_id'])) return (int) $b['cliente_id'];
    if (!empty($b['cliente'])) {
        $s = $db->prepare("SELECT id FROM clientes WHERE nombre = ? LIMIT 1");
        $s->execute([$b['cliente']]);
        $r = $s->fetch();
        if ($r) return (int) $r['id'];
        $db->prepare("INSERT INTO clientes (nombre) VALUES (?)")->execute([$b['cliente']]);
        return (int) $db->lastInsertId();
    }
    return null;
}

function resolverCategoriaId(PDO $db, array $b): int {
    if (!empty($b['categoria_id'])) return (int) $b['categoria_id'];
    $slug = $b['categoria'] ?? 'otros';
    $s = $db->prepare("SELECT id FROM categorias_caja WHERE valor = ? LIMIT 1");
    $s->execute([$slug]);
    $r = $s->fetch();
    return $r ? (int) $r['id'] : 8; // 8 = 'otros' por defecto
}

function generarReferencia(PDO $db): string {
    $anio = date('Y');
    $s    = $db->prepare("
        SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(referencia,'-',-1) AS UNSIGNED)), 0) + 1
        FROM movimientos_caja
        WHERE referencia LIKE ?
    ");
    $s->execute(["REF-$anio-%"]);
    $n = (int) $s->fetchColumn();
    return sprintf('REF-%s-%04d', $anio, $n);
}
