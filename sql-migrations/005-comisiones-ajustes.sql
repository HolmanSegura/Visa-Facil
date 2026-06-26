-- ============================================================
-- 005-comisiones-ajustes.sql
-- Historial de ajustes manuales de comisión por factura.
-- Cada fila = un ajuste; el más reciente es el valor vigente.
-- La comisión "sugerida" se guarda para poder comparar siempre.
-- ============================================================

CREATE TABLE IF NOT EXISTS `comisiones_ajustes` (
  `id`                   INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `ingreso_factura_id`   INT UNSIGNED   NOT NULL,
  `comision_sugerida`    DECIMAL(15, 2) NOT NULL  COMMENT 'Calculada automáticamente en el momento del ajuste',
  `comision_anterior`    DECIMAL(15, 2) NULL       COMMENT 'Valor vigente antes de este ajuste (NULL = primer ajuste)',
  `comision_ajustada`    DECIMAL(15, 2) NOT NULL   COMMENT 'Nuevo valor aplicado',
  `motivo`               VARCHAR(500)   NULL,
  `usuario_id`           INT UNSIGNED   NULL,
  `created_at`           TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cajuste_factura`  (`ingreso_factura_id`),
  KEY `idx_cajuste_usuario`  (`usuario_id`),
  CONSTRAINT `fk_cajuste_factura`  FOREIGN KEY (`ingreso_factura_id`) REFERENCES `ingresos_factura` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cajuste_usuario`  FOREIGN KEY (`usuario_id`)         REFERENCES `usuarios` (`id`)         ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
