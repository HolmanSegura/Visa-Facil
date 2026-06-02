-- ============================================================
--  MIGRACIÓN 002 — Agregar hubspot_deal_id a negocios
--  Ejecutar en phpMyAdmin si se importa desde cero.
--  (Ya ejecutada automáticamente en BD local el 2026-06-01)
-- ============================================================

USE visa_facil;

ALTER TABLE negocios
    ADD COLUMN IF NOT EXISTS hubspot_deal_id VARCHAR(80) NULL DEFAULT NULL AFTER nombre,
    ADD INDEX IF NOT EXISTS idx_negocios_hs_deal (hubspot_deal_id);

-- Verificar resultado
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'visa_facil' AND TABLE_NAME = 'negocios'
ORDER BY ORDINAL_POSITION;
