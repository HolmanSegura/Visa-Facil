# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Visa-Fácil is a vanilla HTML/CSS/JavaScript CRM-style web app for Oblicua (a digital agency). It has two modules:
- **Cotizaciones** (`index.html`) — quotation management
- **Caja** (`caja.html`) — income/expense cash box

No build step, no framework, no npm. Open the HTML files directly in a browser or serve with any static file server (e.g., `npx serve .` or VS Code Live Server).

## Architecture

### Module system
Each JS file wraps its code in an IIFE and exposes a public API via `window.*`:
```js
(function () {
  // private
  window.MyModule = { publicMethod };
})();
```
Script load order in the HTML matters — modules must be declared before their dependents.

### State model (`estadoApp`)
Both modules use a global state object (`window.estadoApp` for Cotizaciones, same pattern in `caja-main.js` for Caja):
```js
estadoApp = {
  datosOriginales: [...],   // source array — never mutate
  datosVisibles:   [...],   // current filtered/sorted subset
  vistas: [...],            // named filter presets
  filtros: { ... },         // active pill filters
  orden: { campo, dir }     // sort state
}
```
To update the UI: mutate `estadoApp.datosVisibles`, then call the table renderer to re-render the DOM.

### Data flow for filtering
1. User interaction triggers a filter/view/search change
2. `filters.js` (or `caja-filters.js`) combines active view + pills + search text → new `datosVisibles`
3. Table module re-renders from `datosVisibles`

Data is hardcoded in `js/main.js` (cotizaciones array) and `js/caja-main.js`. There is no backend — localStorage is used only for persisting named views and commission configs.

### localStorage keys
- `caja:configComisiones` — commission rate config for Caja
- Views (vistas) are persisted per module

## JS Module Map

| File | Purpose |
|------|---------|
| `js/main.js` | Cotizaciones source data, `estadoApp`, utility functions |
| `js/caja-main.js` | Caja source data, state, utilities |
| `js/table.js` | Renders the quotations table, pagination, sorting |
| `js/caja-table.js` | Renders the cash box table |
| `js/filters.js` | Filter combinator for Cotizaciones |
| `js/caja-filters.js` | Filter combinator for Caja |
| `js/views.js` | Named filter views (tabs) for Cotizaciones |
| `js/caja-views.js` | Named filter views for Caja |
| `js/ui-interactions.js` | Popovers, modals, slide-in panels — singleton manager |
| `js/sidebar.js` | Sidebar collapse/expand, nav item active state |
| `js/object-switcher.js` | Toolbar object-type switcher dropdown |
| `js/hubspot-api.js` | HubSpot CRM API v3 wrapper (`window.HubSpotAPI`) |
| `js/cotizaciones-*.js` | Feature modules: commissions, products, emails, export, detail panel |
| `js/caja-*.js` | Feature modules: commissions, interactions, export, detail panel |

## CSS Architecture

Stylesheets load in cascade order (defined in HTML `<head>`):
1. `variables.css` — all design tokens (colors, spacing `--esp-*`, typography, shadows)
2. `reset.css`
3. `components.css`, `layout.css`, `global-toolbar.css`, `sidebar.css`
4. `main-content.css`, `popovers.css`, `extras.css`
5. Module-specific: `caja.css`

**Always** use tokens from `variables.css` for colors and spacing. Spacing tokens are 4px-based: `--esp-1` = 4px, `--esp-2` = 8px, etc.

Class naming follows BEM: `.sidebar__item--activo`, `.celda-titulo__link`.

## HubSpot Integration

`window.HubSpotAPI` wraps HubSpot CRM v3. Configure it with a Private App token:
```js
window.HubSpotAPI.configurar({ token: "pat-na1-..." })
```

**Important constraints:**
- HubSpot Starter has no native Quotes object → quotations are stored as Invoices linked to Contacts and Products
- Calls in dev use `corsproxy.io` as a CORS proxy — not suitable for production
- Portal ID is `50772182`
- The token must come from a `.env` file or be injected at runtime — never hardcode in source

## MySQL / XAMPP Backend (opcional)

El proyecto puede correr en modo estático (datos hardcodeados) o conectado a MySQL vía XAMPP.

**Activar el backend:**
1. Copiar `.env.example` → `.env` y completar credenciales
2. Importar `database.sql` en phpMyAdmin (ver pasos abajo)
3. Colocar el proyecto en `C:\xampp\htdocs\visa-facil\`
4. Iniciar Apache + MySQL en XAMPP
5. Abrir `http://localhost/visa-facil/`

**Archivos del backend:**
- `api/db.php` — conexión PDO + helpers `jsonResponse()` / `errorResponse()`
- `api/cotizaciones.php` — CRUD REST cotizaciones
- `api/caja.php` — CRUD REST movimientos de caja
- `api/productos.php` — catálogo productos (GET / upsert desde HubSpot)
- `api/comisiones.php` — config y reporte de comisiones
- `api/upload.php` — subida de adjuntos (multipart/form-data)
- `js/api-client.js` — cliente fetch, expone `window.Api.*`
- `uploads/` — carpeta de adjuntos (excluida de git)

**Modo degradado:** Si Apache/MySQL no está activo, `window.Api` lanza excepción que se captura silenciosamente y el módulo sigue con los datos de ejemplo del array JS.

**Esquema de tablas:**
`usuarios` → `cotizaciones` → `cotizacion_lineas` → `productos`
`usuarios` → `movimientos_caja` → `categorias_caja`
`movimientos_caja` / `cotizaciones` → `adjuntos`
`usuarios` → `config_comisiones_asesores`
`productos` → `config_comisiones_productos`

## Adding New Features

**New filter pill**: add a filter definition to `filtros` in the relevant `main.js`, then add the pill rendering in `filters.js` and its handler.

**New table column**: add the field to the data array in `main.js`, render it in `table.js`'s row-building function, and add the corresponding CSS column width in `variables.css` or `main-content.css`.

**New modal/panel**: use the `window.UIInteractions` singleton to register and open it consistently with existing behavior.

**New API operation**: add a function to `hubspot-api.js` following the `req(method, path, body)` helper pattern.
