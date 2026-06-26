-- ============================================================
--  VISA FÁCIL — Base de datos MySQL para XAMPP / phpMyAdmin
--  Generado el: 2026-05-26
--  Engine:  InnoDB
--  Charset: utf8mb4_unicode_ci
--
--  Para importar: phpMyAdmin → Importar → seleccionar este archivo
--  Compatibilidad: MySQL 5.7+ (XAMPP 7.x / 8.x)
-- ============================================================

SET SQL_MODE   = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone  = "+00:00";
SET NAMES utf8mb4;

-- ============================================================
-- 1. BASE DE DATOS
-- ============================================================
CREATE DATABASE IF NOT EXISTS `visa_facil`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `visa_facil`;

-- Desactivar FK checks durante la creación para evitar orden de dependencias
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 2. USUARIOS
--    Asesores y administradores del sistema.
--    El campo `hubspot_owner_id` vincula al propietario en HubSpot.
-- ============================================================
CREATE TABLE IF NOT EXISTS `usuarios` (
  `id`                INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `nombre`            VARCHAR(120)     NOT NULL,
  `email`             VARCHAR(191)     NOT NULL,
  `password_hash`     VARCHAR(255)     NOT NULL DEFAULT '',
  `rol`               ENUM('admin','asesor','admin_caja') NOT NULL DEFAULT 'asesor',
  `hubspot_owner_id`  VARCHAR(80)      NULL DEFAULT NULL,
  `activo`            TINYINT(1)       NOT NULL DEFAULT 1,
  `created_at`        TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`        TIMESTAMP        NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_usuarios_email` (`email`),
  KEY `idx_usuarios_activo` (`activo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. CLIENTES
--    Empresas o personas que contratan servicios.
--    `hubspot_contact_id` vincula el registro al CRM.
-- ============================================================
CREATE TABLE IF NOT EXISTS `clientes` (
  `id`                  INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `nombre`              VARCHAR(200)  NOT NULL,
  `empresa`             VARCHAR(200)  NULL DEFAULT NULL,
  `email`               VARCHAR(191)  NULL DEFAULT NULL,
  `telefono`            VARCHAR(50)   NULL DEFAULT NULL,
  `hubspot_contact_id`  VARCHAR(80)   NULL DEFAULT NULL,
  `notas`               TEXT          NULL DEFAULT NULL,
  `created_at`          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`          TIMESTAMP     NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_clientes_hubspot` (`hubspot_contact_id`),
  KEY `idx_clientes_nombre` (`nombre`),
  KEY `idx_clientes_empresa` (`empresa`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. NEGOCIOS
--    Oportunidades / deals, agrupan una o más cotizaciones.
-- ============================================================
CREATE TABLE IF NOT EXISTS `negocios` (
  `id`               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `nombre`           VARCHAR(300)  NOT NULL,
  `cliente_id`       INT UNSIGNED  NULL DEFAULT NULL,
  `hubspot_deal_id`  VARCHAR(80)   NULL DEFAULT NULL,
  `created_at`       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`       TIMESTAMP     NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_negocios_cliente` (`cliente_id`),
  KEY `idx_negocios_hubspot` (`hubspot_deal_id`),
  CONSTRAINT `fk_negocios_cliente` FOREIGN KEY (`cliente_id`)
    REFERENCES `clientes` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. PRODUCTOS
--    Catálogo local de productos/servicios.
--    Se sincroniza con HubSpot Products mediante `hubspot_product_id`.
-- ============================================================
CREATE TABLE IF NOT EXISTS `productos` (
  `id`                  INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `hubspot_product_id`  VARCHAR(80)     NULL DEFAULT NULL,
  `nombre`              VARCHAR(300)    NOT NULL,
  `descripcion`         TEXT            NULL DEFAULT NULL,
  `precio`              DECIMAL(15, 2)  NOT NULL DEFAULT '0.00',
  `sku`                 VARCHAR(100)    NULL DEFAULT NULL,
  `tipo`                VARCHAR(100)    NULL DEFAULT NULL,
  `tasa_iva`            DECIMAL(5, 4)   NULL DEFAULT NULL COMMENT 'Ej: 0.19 = 19%. NULL = hereda tasa global',
  `activo`              TINYINT(1)      NOT NULL DEFAULT 1,
  `created_at`          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`          TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_productos_hubspot` (`hubspot_product_id`),
  KEY `idx_productos_sku` (`sku`),
  KEY `idx_productos_activo` (`activo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. COTIZACIONES
--    Módulo principal. Una cotización pertenece a un asesor,
--    un cliente y un negocio.
--    `hubspot_invoice_id` es el ID de la Invoice asociada en HubSpot
--    (ya que Starter no tiene objeto Quotes nativo).
-- ============================================================
CREATE TABLE IF NOT EXISTS `cotizaciones` (
  `id`                  INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `titulo`              VARCHAR(400)    NOT NULL,
  `estado`              ENUM('borrador','publicado','en_revision','aprobado','vencido','rechazado')
                          NOT NULL DEFAULT 'borrador',
  `estado_firma`        ENUM('no_aplica','pendiente','firmado','rechazado','expirado')
                          NOT NULL DEFAULT 'no_aplica',
  `moneda`              ENUM('COP','USD','EUR') NOT NULL DEFAULT 'COP',
  `cantidad`            DECIMAL(15, 2)  NOT NULL DEFAULT '0.00'
                          COMMENT 'Total de la cotización (puede diferir de la suma de líneas si se edita manualmente)',
  `descuento_global`    DECIMAL(15, 2)  NOT NULL DEFAULT '0.00',
  `tipo_descuento_global` ENUM('porcentaje','fijo') NOT NULL DEFAULT 'porcentaje',
  `tasa_iva`            DECIMAL(5, 4)   NOT NULL DEFAULT '0.1900',
  `fecha_creacion`      DATE            NOT NULL,
  `fecha_vencimiento`   DATE            NULL DEFAULT NULL,
  `usuario_id`          INT UNSIGNED    NULL DEFAULT NULL COMMENT 'Responsable/asesor',
  `cliente_id`          INT UNSIGNED    NULL DEFAULT NULL,
  `negocio_id`          INT UNSIGNED    NULL DEFAULT NULL,
  `hubspot_invoice_id`  VARCHAR(80)     NULL DEFAULT NULL,
  `punto_venta`         VARCHAR(100)    NULL DEFAULT NULL COMMENT 'Valor de la propiedad punto_de_venta en HubSpot Invoice',
  `notas`               TEXT            NULL DEFAULT NULL,
  `created_at`          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`          TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_cot_estado`       (`estado`),
  KEY `idx_cot_fecha_vence`  (`fecha_vencimiento`),
  KEY `idx_cot_usuario`      (`usuario_id`),
  KEY `idx_cot_cliente`      (`cliente_id`),
  KEY `idx_cot_negocio`      (`negocio_id`),
  KEY `idx_cot_hubspot`      (`hubspot_invoice_id`),
  KEY `idx_cot_deleted`      (`deleted_at`),
  CONSTRAINT `fk_cot_usuario`  FOREIGN KEY (`usuario_id`)  REFERENCES `usuarios` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_cot_cliente`  FOREIGN KEY (`cliente_id`)  REFERENCES `clientes` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_cot_negocio`  FOREIGN KEY (`negocio_id`)  REFERENCES `negocios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7. COTIZACION_LINEAS
--    Ítems / líneas de artículo de cada cotización.
--    `producto_id` es opcional: la línea puede ser un servicio
--    ad-hoc sin producto del catálogo.
-- ============================================================
CREATE TABLE IF NOT EXISTS `cotizacion_lineas` (
  `id`               INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `cotizacion_id`    INT UNSIGNED    NOT NULL,
  `producto_id`      INT UNSIGNED    NULL DEFAULT NULL,
  `nombre_producto`  VARCHAR(300)    NOT NULL COMMENT 'Copia del nombre al momento de crear la línea',
  `descripcion`      TEXT            NULL DEFAULT NULL,
  `precio_unitario`  DECIMAL(15, 2)  NOT NULL DEFAULT '0.00',
  `cantidad`         DECIMAL(10, 2)  NOT NULL DEFAULT '1.00',
  `descuento`        DECIMAL(10, 2)  NOT NULL DEFAULT '0.00',
  `tipo_descuento`   ENUM('porcentaje','fijo') NOT NULL DEFAULT 'porcentaje',
  `subtotal`         DECIMAL(15, 2)  NOT NULL DEFAULT '0.00'
                       COMMENT 'precio_unitario * cantidad − descuento calculado',
  `orden`            SMALLINT        NOT NULL DEFAULT 0,
  `created_at`       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_lineas_cotizacion` (`cotizacion_id`),
  KEY `idx_lineas_producto`   (`producto_id`),
  CONSTRAINT `fk_lineas_cotizacion` FOREIGN KEY (`cotizacion_id`)
    REFERENCES `cotizaciones` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_lineas_producto` FOREIGN KEY (`producto_id`)
    REFERENCES `productos` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 8. CATEGORIAS_CAJA
--    Catálogo de categorías del módulo Caja.
--    Se puede ampliar desde phpMyAdmin sin tocar código JS.
-- ============================================================
CREATE TABLE IF NOT EXISTS `categorias_caja` (
  `id`      SMALLINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `valor`   VARCHAR(60)        NOT NULL COMMENT 'Slug usado en el código JS: alimentacion, transporte…',
  `nombre`  VARCHAR(100)       NOT NULL,
  `icono`   VARCHAR(20)        NULL DEFAULT NULL COMMENT 'Emoji o clave de ícono',
  `activo`  TINYINT(1)         NOT NULL DEFAULT 1,
  `orden`   SMALLINT           NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_categorias_valor` (`valor`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 9. MOVIMIENTOS_CAJA
--    Ingresos y gastos del módulo Caja.
--    `referencia` es el código único REF-YYYY-NNNN.
--    `cotizacion_id` vincula un ingreso a la cotización pagada (opcional).
-- ============================================================
CREATE TABLE IF NOT EXISTS `movimientos_caja` (
  `id`             INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `fecha`          DATE            NOT NULL,
  `tipo`           ENUM('ingreso','gasto') NOT NULL,
  `categoria_id`   SMALLINT UNSIGNED NOT NULL,
  `descripcion`    VARCHAR(400)    NOT NULL,
  `responsable_id` INT UNSIGNED    NULL DEFAULT NULL,
  `valor`          DECIMAL(15, 2)  NOT NULL DEFAULT '0.00',
  `moneda`         ENUM('COP','USD','EUR') NOT NULL DEFAULT 'COP',
  `estado`         ENUM('pagado','pendiente','anulado') NOT NULL DEFAULT 'pagado',
  `metodo_pago`    ENUM('efectivo','transferencia','tarjeta','cheque') NULL DEFAULT NULL,
  `observaciones`  TEXT            NULL DEFAULT NULL,
  `punto_venta`    VARCHAR(100)    NULL DEFAULT NULL,
  `cliente_id`     INT UNSIGNED    NULL DEFAULT NULL,
  `cotizacion_id`  INT UNSIGNED    NULL DEFAULT NULL,
  `referencia`     VARCHAR(50)     NULL DEFAULT NULL COMMENT 'REF-YYYY-NNNN (manual) o hs-inv-com/ing-{id} (webhook HubSpot)',
  `created_at`     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`     TIMESTAMP       NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_mov_referencia` (`referencia`),
  KEY `idx_mov_fecha`          (`fecha`),
  KEY `idx_mov_tipo`           (`tipo`),
  KEY `idx_mov_estado`         (`estado`),
  KEY `idx_mov_categoria`      (`categoria_id`),
  KEY `idx_mov_responsable`    (`responsable_id`),
  KEY `idx_mov_cliente`        (`cliente_id`),
  KEY `idx_mov_cotizacion`     (`cotizacion_id`),
  CONSTRAINT `fk_mov_categoria`   FOREIGN KEY (`categoria_id`)   REFERENCES `categorias_caja` (`id`),
  CONSTRAINT `fk_mov_responsable` FOREIGN KEY (`responsable_id`) REFERENCES `usuarios` (`id`)      ON DELETE SET NULL,
  CONSTRAINT `fk_mov_cliente`     FOREIGN KEY (`cliente_id`)     REFERENCES `clientes` (`id`)      ON DELETE SET NULL,
  CONSTRAINT `fk_mov_cotizacion`  FOREIGN KEY (`cotizacion_id`)  REFERENCES `cotizaciones` (`id`)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 10. ADJUNTOS
--     Archivos adjuntos: recibos, facturas, comprobantes.
--     Puede vincularse a un movimiento de caja o a una cotización.
-- ============================================================
CREATE TABLE IF NOT EXISTS `adjuntos` (
  `id`                  INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `movimiento_caja_id`  INT UNSIGNED   NULL DEFAULT NULL,
  `cotizacion_id`       INT UNSIGNED   NULL DEFAULT NULL,
  `nombre_original`     VARCHAR(300)   NOT NULL COMMENT 'Nombre del archivo subido por el usuario',
  `nombre_almacenado`   VARCHAR(300)   NOT NULL COMMENT 'Nombre en disco (UUID + extensión)',
  `ruta`                VARCHAR(500)   NOT NULL COMMENT 'Ruta relativa desde la raíz del proyecto',
  `tipo_mime`           VARCHAR(100)   NULL DEFAULT NULL,
  `tamanio`             INT UNSIGNED   NULL DEFAULT NULL COMMENT 'Bytes',
  `created_at`          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_adj_movimiento` (`movimiento_caja_id`),
  KEY `idx_adj_cotizacion` (`cotizacion_id`),
  CONSTRAINT `fk_adj_movimiento` FOREIGN KEY (`movimiento_caja_id`)
    REFERENCES `movimientos_caja` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_adj_cotizacion` FOREIGN KEY (`cotizacion_id`)
    REFERENCES `cotizaciones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 11. CONFIG_COMISIONES_ASESORES
--     Porcentaje y base de cálculo de comisiones por asesor.
--     Un asesor puede tener solo un registro activo a la vez.
-- ============================================================
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

-- ============================================================
-- 12. CONFIG_COMISIONES_PRODUCTOS
--     Comisión especial por producto. Prioridad sobre la del asesor.
--     `producto_id` es NULL cuando el producto viene solo de HubSpot
--     y no tiene aún un registro local (se identifica por nombre).
-- ============================================================
CREATE TABLE IF NOT EXISTS `config_comisiones_productos` (
  `id`                  INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `producto_id`         INT UNSIGNED   NULL DEFAULT NULL,
  `hubspot_product_id`  VARCHAR(80)    NULL DEFAULT NULL,
  `nombre_producto`     VARCHAR(300)   NOT NULL COMMENT 'Copia del nombre en el momento de configurar',
  `porcentaje`          DECIMAL(5, 2)  NOT NULL DEFAULT '5.00',
  `created_at`          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_comis_prod_producto` (`producto_id`),
  CONSTRAINT `fk_comis_prod` FOREIGN KEY (`producto_id`)
    REFERENCES `productos` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 13. VISTAS_GUARDADAS
--     Filtros con nombre (tabs) guardados por módulo y usuario.
--     Las vistas del sistema (sistema=1) se muestran a todos.
-- ============================================================
CREATE TABLE IF NOT EXISTS `vistas_guardadas` (
  `id`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `usuario_id`  INT UNSIGNED  NULL DEFAULT NULL COMMENT 'NULL = compartida por todos',
  `modulo`      ENUM('cotizaciones','caja') NOT NULL,
  `nombre`      VARCHAR(150)  NOT NULL,
  `filtros_json` TEXT         NOT NULL COMMENT 'JSON con la definición de filtros activos',
  `activa`      TINYINT(1)    NOT NULL DEFAULT 0,
  `sistema`     TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '1 = vista de sistema, no borrable',
  `orden`       SMALLINT      NOT NULL DEFAULT 0,
  `created_at`  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_vistas_usuario_modulo` (`usuario_id`, `modulo`),
  CONSTRAINT `fk_vistas_usuario` FOREIGN KEY (`usuario_id`)
    REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 14. ENVIOS_EMAIL
--     Auditoría de correos enviados vía Dapta para cotizaciones.
-- ============================================================
CREATE TABLE IF NOT EXISTS `envios_email` (
  `id`              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `cotizacion_id`   INT UNSIGNED  NOT NULL,
  `destinatario`    VARCHAR(191)  NOT NULL,
  `asunto`          VARCHAR(400)  NOT NULL,
  `estado`          ENUM('enviado','pendiente','error') NOT NULL DEFAULT 'pendiente',
  `error_detalle`   TEXT          NULL DEFAULT NULL,
  `enviado_at`      TIMESTAMP     NULL DEFAULT NULL,
  `created_at`      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email_cotizacion` (`cotizacion_id`),
  CONSTRAINT `fk_email_cotizacion` FOREIGN KEY (`cotizacion_id`)
    REFERENCES `cotizaciones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 15. INGRESOS_FACTURA
--     Registro centralizado de todos los pagos de facturas HubSpot,
--     independientemente del método de pago.
--     Es la fuente de verdad para el cálculo de comisiones.
--     Los pagos en efectivo también crean una entrada en movimientos_caja
--     (Caja Menor), referenciada por mov_caja_id.
-- ============================================================
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
  `mov_caja_id`    INT UNSIGNED    NULL                 COMMENT 'FK a movimientos_caja cuando método=efectivo',
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

-- ============================================================
-- 16. COMISIONES_AJUSTES
--     Historial de ajustes manuales de comisión por factura.
--     El registro más reciente por ingreso_factura_id es el vigente.
-- ============================================================
CREATE TABLE IF NOT EXISTS `comisiones_ajustes` (
  `id`                   INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `ingreso_factura_id`   INT UNSIGNED   NOT NULL,
  `comision_sugerida`    DECIMAL(15, 2) NOT NULL  COMMENT 'Calculada automáticamente al momento del ajuste',
  `comision_anterior`    DECIMAL(15, 2) NULL       COMMENT 'Valor vigente antes de este ajuste (NULL = primero)',
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

-- ============================================================
-- Reactivar FK checks
-- ============================================================
SET FOREIGN_KEY_CHECKS = 1;


-- ============================================================
-- DATOS SEMILLA (SEED)
-- ============================================================

-- ── Categorías de Caja ──────────────────────────────────────
INSERT INTO `categorias_caja` (`valor`, `nombre`, `icono`, `orden`) VALUES
  ('alimentacion', 'Alimentación',       '🍔', 1),
  ('transporte',   'Transporte',         '🚕', 2),
  ('papeleria',    'Papelería',          '📎', 3),
  ('publicidad',   'Publicidad',         '📣', 4),
  ('comisiones',   'Comisiones',         '💼', 5),
  ('servicios',    'Servicios públicos', '💡', 6),
  ('tramites',     'Trámites',           '📋', 7),
  ('otros',        'Otros',              '📦', 8);

-- ── Usuarios (asesores del sistema) ─────────────────────────
-- Contraseña por defecto: Oblicua2026! (hash bcrypt — cambiar en producción)
INSERT INTO `usuarios` (`nombre`, `email`, `password_hash`, `rol`) VALUES
  ('Néstor Goyes',     'nestor@oblicua.co',    '$2y$12$placeholder_hash_nestor',   'admin'),
  ('Lizeth Carrillo',  'lizeth@oblicua.co',    '$2y$12$placeholder_hash_lizeth',   'asesor'),
  ('Jennifer Acosta',  'jennifer@oblicua.co',  '$2y$12$placeholder_hash_jennifer', 'admin_caja'),
  ('Maria González',   'maria@oblicua.co',     '$2y$12$placeholder_hash_maria',    'asesor'),
  ('Carlos Ramírez',   'carlos@oblicua.co',    '$2y$12$placeholder_hash_carlos',   'asesor');

-- ── Productos de catálogo (fallback / semilla) ───────────────
INSERT INTO `productos` (`nombre`, `descripcion`, `precio`, `sku`, `activo`) VALUES
  ('Sitio web corporativo',          'Diseño y desarrollo responsive',          4500000,  'WEB-001', 1),
  ('Tienda Shopify',                  'E-commerce con integración de pagos',      8200000,  'SHOP-001',1),
  ('SEO técnico mensual',             'Optimización en motores de búsqueda',      1200000,  'SEO-001', 1),
  ('Soporte y mantenimiento mensual', 'Mantenimiento + soporte 20 h/mes',         980000,   'SUP-001', 1),
  ('Consultoría HubSpot',             'Configuración y onboarding CRM',          2800000,  'CRM-001', 1),
  ('Integración API personalizada',   'Desarrollo de integraciones a medida',     3600000,  'API-001', 1),
  ('App móvil MVP (iOS y Android)',   'Desarrollo multiplataforma React Native',  35000000, 'APP-001', 1),
  ('Migración Google Cloud',          'Migración, configuración e IaC en GCP',   12000000, 'GCP-001', 1),
  ('Capacitación HubSpot (4 h)',      'Sesión de formación para el equipo',        800000,  'CAP-001', 1),
  ('Auditoría UX/UI',                 'Evaluación heurística + mapa de mejoras',  4200000,  'UX-001',  1);

-- ── Clientes de semilla ──────────────────────────────────────
INSERT INTO `clientes` (`nombre`) VALUES
  ('JMF Construcciones'),
  ('Work for treats'),
  ('VTEX Latam'),
  ('Virtud SAS'),
  ('Villegas Editores'),
  ('Vasquez Avenue Ltda'),
  ('Vanesa Sánchez'),
  ('Cococarga Ltda'),
  ('Shopify CO'),
  ('Oblicua'),
  ('Papelería Cartagena'),
  ('Yaquut'),
  ('Dispapeles SA'),
  ('Mejora y soluciones'),
  ('Laura Villegas'),
  ('Acme Corp'),
  ('Tech Solutions SAS'),
  ('MarketingPro'),
  ('WebMaster Group'),
  ('Constructora Pacífico'),
  ('Innova Studio'),
  ('FinTech Andina'),
  ('Startup Verde'),
  ('Grupo Empresarial Z'),
  ('Banco Mediano'),
  ('Flordex'),
  ('Logística Express');

-- ── Negocios de semilla ──────────────────────────────────────
INSERT INTO `negocios` (`nombre`, `cliente_id`) VALUES
  ('JMF Sistematización de cotizaciones',        (SELECT id FROM clientes WHERE nombre='JMF Construcciones'       LIMIT 1)),
  ('Work for treats SEO - Step 2',               (SELECT id FROM clientes WHERE nombre='Work for treats'          LIMIT 1)),
  ('VTEX - Milagros',                            (SELECT id FROM clientes WHERE nombre='VTEX Latam'               LIMIT 1)),
  ('VIRTUD - Internacionalización',              (SELECT id FROM clientes WHERE nombre='Virtud SAS'               LIMIT 1)),
  ('Villegas Editores - Remisiones',             (SELECT id FROM clientes WHERE nombre='Villegas Editores'        LIMIT 1)),
  ('Villegas / Homologación Los Maestros',       (SELECT id FROM clientes WHERE nombre='Villegas Editores'        LIMIT 1)),
  ('Vasquez Avenue',                             (SELECT id FROM clientes WHERE nombre='Vasquez Avenue Ltda'      LIMIT 1)),
  ('Sitio web constructora',                     (SELECT id FROM clientes WHERE nombre='Vanesa Sánchez'           LIMIT 1)),
  ('TRANSCOCOL LTDA - Billy',                    (SELECT id FROM clientes WHERE nombre='Cococarga Ltda'           LIMIT 1)),
  ('Tienda en línea Shopify',                    (SELECT id FROM clientes WHERE nombre='Shopify CO'               LIMIT 1)),
  ('Tareas Oblicua',                             (SELECT id FROM clientes WHERE nombre='Oblicua'                  LIMIT 1)),
  ('Software pedidos B2B',                       (SELECT id FROM clientes WHERE nombre='Papelería Cartagena'      LIMIT 1)),
  ('Control de Inventarios Yaquut',              (SELECT id FROM clientes WHERE nombre='Yaquut'                   LIMIT 1)),
  ('Sitios web Internacionales / Dispapeles',    (SELECT id FROM clientes WHERE nombre='Dispapeles SA'            LIMIT 1)),
  ('Sitio web Mejora y soluciones',              (SELECT id FROM clientes WHERE nombre='Mejora y soluciones'      LIMIT 1)),
  ('Sitio web Laura Villegas',                   (SELECT id FROM clientes WHERE nombre='Laura Villegas'           LIMIT 1)),
  ('Migración CRM',                              (SELECT id FROM clientes WHERE nombre='Acme Corp'                LIMIT 1)),
  ('E-commerce Shopify Plus',                    (SELECT id FROM clientes WHERE nombre='Tech Solutions SAS'       LIMIT 1)),
  ('Landing pages campaña Q1',                   (SELECT id FROM clientes WHERE nombre='MarketingPro'             LIMIT 1)),
  ('SEO 2026 Q1',                                (SELECT id FROM clientes WHERE nombre='WebMaster Group'          LIMIT 1)),
  ('Mantenimiento web',                          (SELECT id FROM clientes WHERE nombre='Constructora Pacífico'    LIMIT 1)),
  ('Branding 2026',                              (SELECT id FROM clientes WHERE nombre='Innova Studio'            LIMIT 1)),
  ('API Pagos',                                  (SELECT id FROM clientes WHERE nombre='FinTech Andina'           LIMIT 1)),
  ('App MVP',                                    (SELECT id FROM clientes WHERE nombre='Startup Verde'            LIMIT 1)),
  ('Capacitación HubSpot',                       (SELECT id FROM clientes WHERE nombre='Grupo Empresarial Z'      LIMIT 1)),
  ('Auditoría UX',                               (SELECT id FROM clientes WHERE nombre='Banco Mediano'            LIMIT 1)),
  ('Modelo predictivo Flordex',                  (SELECT id FROM clientes WHERE nombre='Flordex'                  LIMIT 1)),
  ('Soporte 24/7',                               (SELECT id FROM clientes WHERE nombre='Logística Express'        LIMIT 1));

-- ── Cotizaciones de semilla ──────────────────────────────────
INSERT INTO `cotizaciones`
  (`titulo`, `estado`, `estado_firma`, `moneda`, `cantidad`,
   `fecha_creacion`, `fecha_vencimiento`, `usuario_id`, `cliente_id`, `negocio_id`)
VALUES
  ('JMF Sistematización de cotizaciones (Actualizada)', 'publicado',  'no_aplica', 'USD',  3560,
   '2025-10-07','2026-12-31',
   (SELECT id FROM usuarios WHERE nombre='Néstor Goyes'    LIMIT 1),
   (SELECT id FROM clientes WHERE nombre='JMF Construcciones' LIMIT 1),
   (SELECT id FROM negocios WHERE nombre='JMF Sistematización de cotizaciones' LIMIT 1)),

  ('JMF Sistematización de cotizaciones', 'vencido', 'no_aplica', 'COP', 3600,
   '2025-09-09','2025-11-30',
   (SELECT id FROM usuarios WHERE nombre='Néstor Goyes'    LIMIT 1),
   (SELECT id FROM clientes WHERE nombre='JMF Construcciones' LIMIT 1),
   (SELECT id FROM negocios WHERE nombre='JMF Sistematización de cotizaciones' LIMIT 1)),

  ('Work for treats SEO - Step 2', 'vencido', 'no_aplica', 'USD', 391,
   '2025-04-15','2025-04-16',
   (SELECT id FROM usuarios WHERE nombre='Lizeth Carrillo' LIMIT 1),
   (SELECT id FROM clientes WHERE nombre='Work for treats' LIMIT 1),
   (SELECT id FROM negocios WHERE nombre='Work for treats SEO - Step 2' LIMIT 1)),

  ('VTEX - Milagros', 'borrador', 'no_aplica', 'COP', 16000000,
   '2024-03-26','2024-06-24',
   (SELECT id FROM usuarios WHERE nombre='Néstor Goyes'    LIMIT 1),
   (SELECT id FROM clientes WHERE nombre='VTEX Latam'      LIMIT 1),
   (SELECT id FROM negocios WHERE nombre='VTEX - Milagros' LIMIT 1)),

  ('VIRTUD - Internacionalización', 'vencido', 'no_aplica', 'COP', 1608000,
   '2024-05-18','2024-08-16',
   (SELECT id FROM usuarios WHERE nombre='Néstor Goyes'    LIMIT 1),
   (SELECT id FROM clientes WHERE nombre='Virtud SAS'      LIMIT 1),
   (SELECT id FROM negocios WHERE nombre='VIRTUD - Internacionalización' LIMIT 1)),

  ('Migración CRM HubSpot - Acme', 'aprobado', 'firmado', 'COP', 24500000,
   '2026-01-12','2026-04-12',
   (SELECT id FROM usuarios WHERE nombre='Maria González'  LIMIT 1),
   (SELECT id FROM clientes WHERE nombre='Acme Corp'       LIMIT 1),
   (SELECT id FROM negocios WHERE nombre='Migración CRM'   LIMIT 1)),

  ('Implementación e-commerce Shopify Plus', 'en_revision', 'pendiente', 'COP', 35800000,
   '2026-02-03','2026-05-03',
   (SELECT id FROM usuarios WHERE nombre='Carlos Ramírez'  LIMIT 1),
   (SELECT id FROM clientes WHERE nombre='Tech Solutions SAS' LIMIT 1),
   (SELECT id FROM negocios WHERE nombre='E-commerce Shopify Plus' LIMIT 1)),

  ('Diseño y desarrollo de landing pages', 'publicado', 'no_aplica', 'COP', 4200000,
   '2026-02-15','2026-03-15',
   (SELECT id FROM usuarios WHERE nombre='Néstor Goyes'    LIMIT 1),
   (SELECT id FROM clientes WHERE nombre='MarketingPro'    LIMIT 1),
   (SELECT id FROM negocios WHERE nombre='Landing pages campaña Q1' LIMIT 1)),

  ('Mantenimiento web mensual - Premium', 'aprobado', 'firmado', 'COP', 1200000,
   '2026-01-20','2027-01-20',
   (SELECT id FROM usuarios WHERE nombre='Maria González'  LIMIT 1),
   (SELECT id FROM clientes WHERE nombre='Constructora Pacífico' LIMIT 1),
   (SELECT id FROM negocios WHERE nombre='Mantenimiento web' LIMIT 1)),

  ('Migración a Google Cloud Vertex AI', 'aprobado', 'firmado', 'COP', 28500000,
   '2026-05-01','2026-08-01',
   (SELECT id FROM usuarios WHERE nombre='Carlos Ramírez'  LIMIT 1),
   (SELECT id FROM clientes WHERE nombre='Flordex'         LIMIT 1),
   (SELECT id FROM negocios WHERE nombre='Modelo predictivo Flordex' LIMIT 1));

-- ── Movimientos de Caja de semilla ───────────────────────────
INSERT INTO `movimientos_caja`
  (`fecha`, `tipo`, `categoria_id`, `descripcion`, `responsable_id`,
   `valor`, `moneda`, `estado`, `metodo_pago`, `observaciones`, `cliente_id`, `referencia`)
VALUES
  ('2026-05-19', 'gasto',   (SELECT id FROM categorias_caja WHERE valor='alimentacion' LIMIT 1),
   'Jugo natural para reunión cliente Acme',
   (SELECT id FROM usuarios WHERE nombre='Néstor Goyes'    LIMIT 1),
   8500, 'COP', 'pagado', 'efectivo',
   'Reunión presencial para revisión del proyecto.',
   (SELECT id FROM clientes WHERE nombre='Acme Corp'       LIMIT 1), 'REF-2026-0019'),

  ('2026-05-19', 'gasto',   (SELECT id FROM categorias_caja WHERE valor='transporte'   LIMIT 1),
   'Taxi Bogotá Centro - visita comercial',
   (SELECT id FROM usuarios WHERE nombre='Maria González'  LIMIT 1),
   22000, 'COP', 'pagado', 'efectivo',
   'Trayecto ida y vuelta desde oficina hasta cliente Acme Corp.',
   (SELECT id FROM clientes WHERE nombre='Acme Corp'       LIMIT 1), 'REF-2026-0020'),

  ('2026-05-18', 'ingreso', (SELECT id FROM categorias_caja WHERE valor='servicios'    LIMIT 1),
   'Pago parcial proyecto JMF Sistematización',
   (SELECT id FROM usuarios WHERE nombre='Néstor Goyes'    LIMIT 1),
   1500000, 'COP', 'pagado', 'transferencia',
   'Primer abono del 50% del proyecto JMF según cotización aceptada.',
   (SELECT id FROM clientes WHERE nombre='JMF Construcciones' LIMIT 1), 'REF-2026-0018'),

  ('2026-05-17', 'gasto',   (SELECT id FROM categorias_caja WHERE valor='papeleria'    LIMIT 1),
   'Resma de papel + cartuchos impresora',
   (SELECT id FROM usuarios WHERE nombre='Jennifer Acosta' LIMIT 1),
   145000, 'COP', 'pagado', 'tarjeta',
   'Compra de suministros de oficina mensuales.',
   NULL, 'REF-2026-0017'),

  ('2026-05-16', 'gasto',   (SELECT id FROM categorias_caja WHERE valor='comisiones'   LIMIT 1),
   'Comisión venta cierre cliente VTEX',
   (SELECT id FROM usuarios WHERE nombre='Carlos Ramírez'  LIMIT 1),
   750000, 'COP', 'pendiente', 'transferencia',
   'Pendiente validación con dirección comercial antes de transferir.',
   (SELECT id FROM clientes WHERE nombre='VTEX Latam'      LIMIT 1), 'REF-2026-0015'),

  ('2026-05-15', 'ingreso', (SELECT id FROM categorias_caja WHERE valor='servicios'    LIMIT 1),
   'Cobro mantenimiento web - Mayo',
   (SELECT id FROM usuarios WHERE nombre='Maria González'  LIMIT 1),
   1200000, 'COP', 'pagado', 'transferencia',
   'Cobro mensual por servicio de mantenimiento Premium.',
   (SELECT id FROM clientes WHERE nombre='Constructora Pacífico' LIMIT 1), 'REF-2026-0014'),

  ('2026-05-11', 'ingreso', (SELECT id FROM categorias_caja WHERE valor='servicios'    LIMIT 1),
   'Anticipo Migración Vertex AI - Flordex',
   (SELECT id FROM usuarios WHERE nombre='Carlos Ramírez'  LIMIT 1),
   14250000, 'COP', 'pagado', 'transferencia',
   '50% inicial del proyecto de migración a Google Cloud Vertex AI.',
   (SELECT id FROM clientes WHERE nombre='Flordex'         LIMIT 1), 'REF-2026-0010'),

  ('2026-05-06', 'ingreso', (SELECT id FROM categorias_caja WHERE valor='servicios'    LIMIT 1),
   'Pago final landing pages MarketingPro',
   (SELECT id FROM usuarios WHERE nombre='Néstor Goyes'    LIMIT 1),
   4200000, 'COP', 'pagado', 'transferencia',
   'Saldo final del proyecto de landing pages campaña Q1.',
   (SELECT id FROM clientes WHERE nombre='MarketingPro'    LIMIT 1), 'REF-2026-0005'),

  ('2026-04-28', 'ingreso', (SELECT id FROM categorias_caja WHERE valor='servicios'    LIMIT 1),
   'Pago Migración CRM HubSpot Acme',
   (SELECT id FROM usuarios WHERE nombre='Maria González'  LIMIT 1),
   12250000, 'COP', 'pagado', 'transferencia',
   '50% del proyecto Migración CRM.',
   (SELECT id FROM clientes WHERE nombre='Acme Corp'       LIMIT 1), 'REF-2026-0028'),

  ('2026-04-20', 'gasto',   (SELECT id FROM categorias_caja WHERE valor='servicios'    LIMIT 1),
   'Hosting AWS abril',
   (SELECT id FROM usuarios WHERE nombre='Carlos Ramírez'  LIMIT 1),
   1450000, 'COP', 'pagado', 'tarjeta',
   'Servidores AWS de producción y staging.',
   NULL, 'REF-2026-0026');

-- ── Config comisiones: 5% por defecto a todos los asesores ──
INSERT INTO `config_comisiones_asesores` (`usuario_id`, `porcentaje`, `base`, `activo`)
SELECT `id`, 5.00, 'ingresos', 1 FROM `usuarios`;

-- ── Vistas del sistema ───────────────────────────────────────
INSERT INTO `vistas_guardadas` (`usuario_id`, `modulo`, `nombre`, `filtros_json`, `sistema`, `orden`) VALUES
  (NULL, 'cotizaciones', 'Todas las cotizaciones',     '{}',                                           1, 0),
  (NULL, 'cotizaciones', 'Pendiente de aceptación',    '{"estado":["publicado","en_revision"]}',       1, 1),
  (NULL, 'cotizaciones', 'Pendiente de revisión',      '{"estado":["en_revision"]}',                   1, 2),
  (NULL, 'cotizaciones', 'Pendiente de firma',         '{"estadoFirma":["pendiente"]}',                1, 3),
  (NULL, 'cotizaciones', 'Mis borradores',             '{"estado":["borrador"]}',                      1, 4),
  (NULL, 'caja',         'Todos los movimientos',      '{}',                                           1, 0),
  (NULL, 'caja',         'Gastos del mes',             '{"tipo":["gasto"],"fecha":"mes"}',             1, 1),
  (NULL, 'caja',         'Pendientes',                 '{"estado":["pendiente"]}',                     1, 2),
  (NULL, 'caja',         'Ingresos del mes',           '{"tipo":["ingreso"],"fecha":"mes"}',           1, 3),
  (NULL, 'caja',         'Gastos de publicidad',       '{"categoria":["publicidad"]}',                 1, 4);

-- ── Migración: Punto de Venta en movimientos_caja y cotizaciones ─
-- Ejecutar solo en instalaciones existentes (no aplica a instalaciones nuevas):
-- ALTER TABLE `movimientos_caja` ADD COLUMN `punto_venta` VARCHAR(100) NULL DEFAULT NULL AFTER `observaciones`;
-- ALTER TABLE `cotizaciones`     ADD COLUMN `punto_venta` VARCHAR(100) NULL DEFAULT NULL AFTER `hubspot_invoice_id`;
