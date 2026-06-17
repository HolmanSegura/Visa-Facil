-- ============================================================
-- Migración 001
-- Aplica a: producción (visafacil.oblicua.co)
-- Fecha:    2026-06-12
--
-- Ejecutar en phpMyAdmin → SQL, o via CLI:
--   mysql -u usuario -p visa_facil < 001_add_hubspot_deal_id_to_negocios.sql
--
-- Seguro para re-ejecutar: ADD COLUMN IF NOT EXISTS no falla si ya existe.
-- ============================================================

-- 1. hubspot_deal_id en negocios (causa del error 500 al crear cotizaciones con negocio)
ALTER TABLE `negocios`
  ADD COLUMN IF NOT EXISTS `hubspot_deal_id` VARCHAR(80) NULL DEFAULT NULL AFTER `cliente_id`,
  ADD INDEX IF NOT EXISTS `idx_negocios_hubspot` (`hubspot_deal_id`);

-- 2. hubspot_invoice_id en cotizaciones (por precaución, usada en PATCH)
ALTER TABLE `cotizaciones`
  ADD COLUMN IF NOT EXISTS `hubspot_invoice_id` VARCHAR(80) NULL DEFAULT NULL AFTER `negocio_id`,
  ADD INDEX IF NOT EXISTS `idx_cot_hubspot` (`hubspot_invoice_id`);
