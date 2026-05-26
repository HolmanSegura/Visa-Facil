<?php
/* ============================================================
   API/UPLOAD.PHP
   Subida de archivos adjuntos (recibos, facturas, comprobantes).

   POST /api/upload.php
     multipart/form-data:
       file              → archivo binario
       movimiento_caja_id → (opcional)
       cotizacion_id      → (opcional)

   Devuelve: { ok: true, id: N, url: "/uploads/..." }
   ============================================================ */

require_once __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    errorResponse('Solo POST', 405);
}

$maxBytes    = 10 * 1024 * 1024; // 10 MB
$tiposMime   = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
];

if (empty($_FILES['file'])) {
    errorResponse('No se recibió ningún archivo');
}

$file = $_FILES['file'];

if ($file['error'] !== UPLOAD_ERR_OK) {
    errorResponse('Error en la subida: código ' . $file['error']);
}
if ($file['size'] > $maxBytes) {
    errorResponse('El archivo supera el límite de 10 MB');
}

// Verificar tipo MIME real (no confiar en el del cliente)
$finfo    = new finfo(FILEINFO_MIME_TYPE);
$mimeReal = $finfo->file($file['tmp_name']);
if (!in_array($mimeReal, $tiposMime, true)) {
    errorResponse('Tipo de archivo no permitido: ' . $mimeReal);
}

// Nombre seguro en disco
$ext      = pathinfo($file['name'], PATHINFO_EXTENSION);
$nombre   = bin2hex(random_bytes(16)) . '.' . strtolower($ext);
$destDir  = UPLOADS_DIR;
if (!is_dir($destDir)) mkdir($destDir, 0755, true);
$destPath = $destDir . $nombre;

if (!move_uploaded_file($file['tmp_name'], $destPath)) {
    errorResponse('No se pudo mover el archivo al destino', 500);
}

try {
    $db    = getDB();
    $movId = !empty($_POST['movimiento_caja_id']) ? (int) $_POST['movimiento_caja_id'] : null;
    $cotId = !empty($_POST['cotizacion_id'])       ? (int) $_POST['cotizacion_id']      : null;

    $stmt = $db->prepare("
        INSERT INTO adjuntos
          (movimiento_caja_id, cotizacion_id, nombre_original,
           nombre_almacenado, ruta, tipo_mime, tamanio)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $movId,
        $cotId,
        $file['name'],
        $nombre,
        UPLOADS_URL . $nombre,
        $mimeReal,
        $file['size'],
    ]);
    $adjuntoId = (int) $db->lastInsertId();

    jsonResponse([
        'ok'  => true,
        'id'  => $adjuntoId,
        'url' => UPLOADS_URL . $nombre,
    ], 201);

} catch (PDOException $e) {
    error_log('[upload.php] ' . $e->getMessage());
    @unlink($destPath);
    errorResponse('Error guardando adjunto', 500);
}
