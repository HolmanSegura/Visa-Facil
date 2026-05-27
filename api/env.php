<?php
/* ============================================================
   API/ENV.PHP
   Expone al frontend las claves de configuración del .env que
   no son sensibles de base de datos.
   Solo devuelve lo que el JS necesita para operar.
   ============================================================ */

require_once __DIR__ . '/db.php';

jsonResponse([
    'ok'                => true,
    'hubspot_token'     => HUBSPOT_TOKEN,
    'dapta_webhook_url' => DAPTA_WEBHOOK_URL,
    'dapta_api_key'     => DAPTA_API_KEY,
]);
