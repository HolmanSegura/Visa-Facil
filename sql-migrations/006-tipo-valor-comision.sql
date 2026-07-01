-- ============================================================
-- 006-tipo-valor-comision.sql
-- Agrega columnas tipo y valor_fijo a las tablas de config
-- de comisiones. Seguro de re-ejecutar (ADD COLUMN IF NOT EXISTS).
-- ============================================================

ALTER TABLE `config_comisiones_asesores`
  ADD COLUMN IF NOT EXISTS `tipo`       ENUM('porcentaje','fijo') NOT NULL DEFAULT 'porcentaje'
      AFTER `usuario_id`,
  ADD COLUMN IF NOT EXISTS `valor_fijo` DECIMAL(15, 2) NULL DEFAULT NULL
      AFTER `porcentaje`;

ALTER TABLE `config_comisiones_productos`
  ADD COLUMN IF NOT EXISTS `tipo`       ENUM('porcentaje','fijo') NOT NULL DEFAULT 'porcentaje'
      AFTER `nombre_producto`,
  ADD COLUMN IF NOT EXISTS `valor_fijo` DECIMAL(15, 2) NULL DEFAULT NULL
      AFTER `porcentaje`;
