# 📋 Cotizaciones HubSpot Clone — Iteración 2

Réplica educativa del módulo de Cotizaciones de un CRM tipo HubSpot.
HTML5 + CSS3 + Vanilla JS, sin frameworks.

## 🆕 Cambios de la iteración 2

### Layout
- **Panel principal flotante** con margen de 24px en los 4 lados (efecto card sobre el navy).
- Sombra suave, esquinas redondeadas en las 4 esquinas.

### Funcionalidades nuevas

1. **Botón "Cotizaciones"** → Dropdown con buscador, "Usadas recientemente" y "Todos los objetos" (Carritos, Clientes de partners, Contactos, Cotizaciones, Empresas, Negocios, Productos, Pedidos, Tareas).

2. **Tabs de vistas** funcionales:
   - Cada tab muestra el **conteo real** de cotizaciones que cumplen su filtro.
   - Click en tab filtra la tabla en tiempo real.
   - 3 puntos por tab: Cambiar nombre · Clonar · Gestionar lo que se comparte · Eliminar.
   - Botón **+**: Crear nueva vista · Agregar vista (modal con vistas predefinidas de HubSpot).

3. **Modal "Agregar vista"** con dos columnas: lista de vistas + panel de detalle.

4. **Tarjetas de pago** con logos (VISA / MC / AMEX / ACH) + **"Configurar pagos online"** funcional (toast).

5. **Menú 3 puntos cabecera derecha**: Ir a informes · Editar propiedades · Restaurar registros · Descargar.

6. **Modal "Crear cotización"** con todos los campos del API de HubSpot Quotes:
   - hs_title, hs_quote_amount, hs_currency, hs_expiration_date, hs_quote_status, hubspot_owner_id, hs_deal_name, términos, etc.

7. **Panel lateral "Configuración de tabla"** (engranaje):
   - 25 / 50 / 100 por página.
   - Altura de fila: Compacto / Predeterminado / Cómodo.
   - Toggle "Zebra striping".

8. **Modal "Editar columnas"** con buscador, lista por categoría (Asociaciones, Información del presupuesto) y panel derecho con columnas seleccionadas.

9. **Dropdown "Ordenar"** con select de propiedad, botones Z→A / A→Z, buscador y lista de propiedades.

10. **Filtros pill funcionales**:
    - Estado (multi-select: publicado, vencido, borrador, aprobado, en revisión).
    - Última actividad (hoy, 7d, 30d, 90d).
    - Propietario (lista dinámica desde los datos).
    - Estado de la firma (multi-select).
    - Cada pill muestra contador de selecciones activas.

11. **Botón "+"** de filtros: dropdown con "Agregar un filtro rápido" + buscador.

12. **Lápiz "Editar filtros rápidos"**: modal con contador 4/10 y filtros eliminables.

## 📁 Estructura

```
proyecto-cotizaciones-hubspot/
├── index.html
├── css/
│   ├── variables.css        — Design tokens
│   ├── reset.css            — Normalize
│   ├── components.css       — Botones, badges, avatares, toast
│   ├── layout.css           — Grid 3-zonas + panel flotante
│   ├── global-toolbar.css   — Topbar oscura
│   ├── sidebar.css          — Sidebar lateral
│   ├── main-content.css     — Tabla, paginación, filtros
│   └── popovers.css         — Sistema unificado de popovers/modales/panel
└── js/
    ├── main.js              — Datos, estado, utilidades
    ├── sidebar.js           — Colapso del sidebar
    ├── views.js             — Gestor de tabs/vistas
    ├── table.js             — Render, ordenamiento, paginación
    ├── filters.js           — Orquestador de filtros (vista + búsqueda + pills)
    └── ui-interactions.js   — Popovers, modales y panel lateral
```

## 🚀 Ejecución

Abrir `index.html` en cualquier navegador moderno. Sin dependencias ni build.

## 🎨 Convenciones

- **BEM en español**: `.tab__menu--activo`, `.filtro-pill__contador`.
- **Acento teal** `#00a4bd` (HubSpot original es naranja, se cambió para diferenciarse).
- **Naranja HubSpot** `#ff7a59` se usa SOLO dentro de modales (botones Aplicar/Guardar).
- **Modal overlay** z-index: 300 · **Popovers** z-index: 250 · **Panel lateral** z-index: 200.

## 📡 Datos

Dataset de demo: 30 cotizaciones realistas con estados variados (publicado, vencido, borrador, aprobado, en revisión), montos en COP y USD, fechas que abarcan 2024-2027.
