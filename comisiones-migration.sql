-- ============================================================
--  VISA FÁCIL — Migración: módulo Comisiones
--  Ejecutar en phpMyAdmin sobre la base `visa_facil`.
--  Seguro de re-ejecutar (usa IF NOT EXISTS / INSERT IGNORE).
-- ============================================================

USE `visa_facil`;

-- ── 1. Tabla configuración de comisiones por asesor ──────────
CREATE TABLE IF NOT EXISTS `config_comisiones_asesores` (
  `id`           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `usuario_id`   INT UNSIGNED    NOT NULL,
  `porcentaje`   DECIMAL(5, 2)   NOT NULL DEFAULT '5.00',
  `base`         ENUM('ventas_cerradas','ingresos','por_venta') NOT NULL DEFAULT 'ingresos',
  `activo`       TINYINT(1)      NOT NULL DEFAULT 1,
  `created_at`   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_comis_asesor` (`usuario_id`),
  CONSTRAINT `fk_comis_asesor` FOREIGN KEY (`usuario_id`)
    REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 2. Tabla configuración de comisiones por producto ────────
CREATE TABLE IF NOT EXISTS `config_comisiones_productos` (
  `id`                  INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `producto_id`         INT UNSIGNED   NULL DEFAULT NULL,
  `hubspot_product_id`  VARCHAR(80)    NULL DEFAULT NULL,
  `nombre_producto`     VARCHAR(300)   NOT NULL COMMENT 'Copia del nombre al momento de configurar',
  `porcentaje`          DECIMAL(5, 2)  NOT NULL DEFAULT '5.00',
  `created_at`          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_comis_prod_producto` (`producto_id`),
  CONSTRAINT `fk_comis_prod` FOREIGN KEY (`producto_id`)
    REFERENCES `productos` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 3. Config por defecto: 5% para todos los asesores ────────
--       INSERT IGNORE omite silenciosamente duplicados.
INSERT IGNORE INTO `config_comisiones_asesores`
  (`usuario_id`, `porcentaje`, `base`, `activo`)
SELECT `id`, 5.00, 'ingresos', 1
FROM `usuarios`
WHERE `deleted_at` IS NULL;

-- ── 4. Ampliar ENUM de módulos en vistas guardadas ───────────
--       Permite persistir vistas del módulo Comisiones en el futuro.
ALTER TABLE `vistas_guardadas`
  MODIFY `modulo` ENUM('cotizaciones','caja','comisiones') NOT NULL;
