-- ============================================================
-- 004-ingresos-factura.sql
-- Registro centralizado de todos los ingresos provenientes de
-- facturas HubSpot, independientemente del método de pago.
--
-- Separación de responsabilidades:
--   ingresos_factura  → fuente de verdad para cálculo de comisiones
--   movimientos_caja  → solo para efectivo (Caja Menor física)
--
-- Aplicar con XAMPP activo:
--   phpMyAdmin → Base visa_facil → SQL → pegar y ejecutar
-- ============================================================

-- 1. Nueva tabla
CREATE TABLE IF NOT EXISTS `ingresos_factura` (
  `id`             INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `hubspot_inv_id` VARCHAR(32)     NOT NULL             COMMENT 'objectId de la Invoice en HubSpot',
  `referencia`     VARCHAR(50)     NOT NULL             COMMENT 'hs-inv-{id}',
  `fecha_pago`     DATE            NOT NULL,
  `monto`          DECIMAL(15, 2)  NOT NULL,
  `moneda`         VARCHAR(3)      NOT NULL DEFAULT 'COP',
  `metodo_pago`    VARCHAR(20)     NOT NULL DEFAULT ''  COMMENT 'efectivo | transferencia | tarjeta | cheque | …',
  `titulo`         VARCHAR(255)    NULL,
  `punto_venta`    VARCHAR(100)    NULL,
  `asesor_id`      INT UNSIGNED    NULL,
  `mov_caja_id`    INT UNSIGNED    NULL                 COMMENT 'FK a movimientos_caja; solo cuando método=efectivo',
  `estado`         ENUM('activo','anulado') NOT NULL DEFAULT 'activo',
  `created_at`     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ingfact_ref`      (`referencia`),
  KEY `idx_ingfact_asesor`         (`asesor_id`),
  KEY `idx_ingfact_fecha`          (`fecha_pago`),
  KEY `idx_ingfact_estado`         (`estado`),
  CONSTRAINT `fk_ingfact_asesor`   FOREIGN KEY (`asesor_id`)   REFERENCES `usuarios` (`id`)          ON DELETE SET NULL,
  CONSTRAINT `fk_ingfact_movcaja`  FOREIGN KEY (`mov_caja_id`) REFERENCES `movimientos_caja` (`id`)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Retrocompatibilidad: marcar metodo_pago en entradas de efectivo ya existentes
UPDATE `movimientos_caja`
   SET `metodo_pago` = 'efectivo'
 WHERE `referencia` LIKE 'hs-inv-ing-%'
   AND `metodo_pago` IS NULL
   AND `deleted_at` IS NULL;
