-- ============================================================
--  MIGRACIÓN 003 — Soporte para comisiones pendientes y webhook
--  Ejecutar UNA SOLA VEZ en phpMyAdmin o MySQL CLI.
--
--  Contexto:
--    El webhook HubSpot (api/hubspot-webhook.php) crea entradas
--    de comisión con estado='pendiente' cuando se cierra una
--    factura. El ENUM original solo tenía 'pagado' y 'anulado',
--    lo que causaría un error de truncación en MySQL.
--
--    La columna `referencia` se amplía para acomodar el formato
--    hs-inv-com-{invoiceId} usado por el webhook (máx ~25 chars).
-- ============================================================

USE visa_facil;

-- ── 1. Ampliar ENUM de estado en movimientos_caja ────────────
--    Agrega 'pendiente' como nuevo valor permitido.
--    'pagado' sigue siendo el DEFAULT para entradas manuales.
ALTER TABLE `movimientos_caja`
  MODIFY `estado`
    ENUM('pagado','pendiente','anulado')
    NOT NULL DEFAULT 'pagado';

-- ── 2. Ampliar referencia a VARCHAR(50) ──────────────────────
--    El formato REF-YYYY-NNNN ocupa ≤ 15 chars.
--    El formato del webhook hs-inv-com-{id} / hs-inv-ing-{id}
--    puede llegar a ~25 chars con IDs largos de HubSpot.
ALTER TABLE `movimientos_caja`
  MODIFY `referencia` VARCHAR(50) NULL DEFAULT NULL
    COMMENT 'REF-YYYY-NNNN (manual) o hs-inv-com/ing-{id} (webhook HubSpot)';

-- ── 3. Verificar resultado ───────────────────────────────────
SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, IS_NULLABLE, COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'visa_facil'
  AND TABLE_NAME   = 'movimientos_caja'
  AND COLUMN_NAME  IN ('estado', 'referencia')
ORDER BY ORDINAL_POSITION;
