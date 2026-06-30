/* ============================================================
   CAJA-COMISIONES.JS
   Configuración, cálculo automático y reporte de comisiones.

   Modelo de datos (localStorage "caja:configComisiones"):
   {
     version: 2,
     porAsesor: [
       { responsable: "Néstor Goyes", porcentaje: 5, base: "ingresos", activo: true }
     ],
     porProducto: [
       { productoId: "hs-123", producto: "Consultoría HubSpot", porcentaje: 8 }
     ]
   }

   Motor calcularComisionesAutomaticas(facturas):
   - Acepta facturas normalizadas de obtenerFacturas() o movimientos
     de caja con tipo === "ingreso".
   - Filtra por estados cerrados (paid / pagado / aprobado).
   - Prioridad 1: comisión por producto específico.
   - Prioridad 2: comisión global del asesor propietario.
   ============================================================ */
(function () {

  const KEY_LS         = "caja:configComisiones";
  const DEFAULT        = { version: 2, porAsesor: [], porProducto: [], generalProductoPorcentaje: 5 };
  const CACHE_KEY_PROD = "hubspot:productos:v1";   // clave compartida con cotizaciones-productos.js
  const CACHE_TTL_PROD = 15 * 60 * 1000;           // 15 minutos

  // Catálogo HubSpot en memoria (compartido entre renders)
  let catalogoProductos = [];
  let catalogoCargando  = false;

  // Fallback idéntico al de cotizaciones-productos.js — se usa cuando la
  // API no responde y el caché también está vacío.
  const PRODUCTOS_FALLBACK = [
    { id: "ej-1",  nombre: "Sitio web corporativo",          descripcion: "Diseño y desarrollo responsive",          precio: 4500000  },
    { id: "ej-2",  nombre: "Tienda Shopify",                  descripcion: "E-commerce con integración de pagos",      precio: 8200000  },
    { id: "ej-3",  nombre: "SEO técnico mensual",             descripcion: "Optimización en motores de búsqueda",      precio: 1200000  },
    { id: "ej-4",  nombre: "Soporte y mantenimiento mensual", descripcion: "Mantenimiento + soporte 20 h/mes",         precio: 980000   },
    { id: "ej-5",  nombre: "Consultoría HubSpot",             descripcion: "Configuración y onboarding CRM",          precio: 2800000  },
    { id: "ej-6",  nombre: "Integración API personalizada",   descripcion: "Desarrollo de integraciones a medida",     precio: 3600000  },
    { id: "ej-7",  nombre: "App móvil MVP (iOS y Android)",   descripcion: "Desarrollo multiplataforma React Native",  precio: 35000000 },
    { id: "ej-8",  nombre: "Migración Google Cloud",          descripcion: "Migración, configuración e IaC en GCP",   precio: 12000000 },
    { id: "ej-9",  nombre: "Capacitación HubSpot (4 h)",      descripcion: "Sesión de formación para el equipo",      precio: 800000   },
    { id: "ej-10", nombre: "Auditoría UX/UI",                 descripcion: "Evaluación heurística + mapa de mejoras", precio: 4200000  }
  ];

  // -----------------------------------------------------------------
  // UTILIDADES DE ESCAPE
  // -----------------------------------------------------------------
  function escHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // -----------------------------------------------------------------
  // PERSISTENCIA
  // -----------------------------------------------------------------
  function cargarConfig() {
    try {
      const raw = localStorage.getItem(KEY_LS);
      if (!raw) return clonarDefault();
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.porAsesor)) return clonarDefault();
      // Migrar registros sin campo `activo` (versión 1 → 2)
      parsed.porAsesor = (parsed.porAsesor || []).map(a =>
        a.activo === undefined ? { ...a, activo: true } : a
      );
      return Object.assign(clonarDefault(), parsed);
    } catch (e) {
      console.warn("[Comisiones] Config corrupta, usando default", e);
      return clonarDefault();
    }
  }

  function guardarConfig(cfg) {
    try {
      localStorage.setItem(KEY_LS, JSON.stringify(cfg));
    } catch (e) {
      console.warn("[Comisiones] No se pudo persistir config", e);
    }
    if (window.Api) {
      window.Api.comisiones.guardarConfig(cfg).catch(e =>
        console.warn("[Comisiones] API guardarConfig falló:", e.message)
      );
    }
  }

  async function sincronizarConfigConAPI() {
    if (!window.Api) return;
    try {
      const resp = await window.Api.comisiones.obtenerConfig();
      if (resp && Array.isArray(resp.porAsesor)) {
        const cfg = Object.assign(clonarDefault(), resp);
        localStorage.setItem(KEY_LS, JSON.stringify(cfg));
      }
    } catch (e) {
      console.warn("[Comisiones] No se pudo cargar config desde API:", e.message);
    }
  }

  function clonarDefault() {
    return JSON.parse(JSON.stringify(DEFAULT));
  }

  // -----------------------------------------------------------------
  // SEED INICIAL
  // Puebla la config con todos los responsables de los movimientos
  // (5% por defecto, activo: true) si nunca se ha configurado.
  // -----------------------------------------------------------------
  function asegurarConfigInicial() {
    const cfg = cargarConfig();
    if (cfg.porAsesor.length === 0 && window.estadoApp) {
      const unicos = [...new Set(
        window.estadoApp.datosOriginales.map(m => m.responsable).filter(Boolean)
      )].sort();
      cfg.porAsesor = unicos.map(n => ({
        responsable: n,
        porcentaje:  5,
        base:        "por_venta",
        activo:      true
      }));
      guardarConfig(cfg);
    }
    return cfg;
  }

  // -----------------------------------------------------------------
  // CATÁLOGO DE PRODUCTOS HUBSPOT
  // Orden de fuentes:
  //   1. Módulo cotizaciones-productos (ya cargado en memoria)
  //   2. Caché localStorage compartida (hubspot:productos:v1, TTL 15 min)
  //   3. API HubSpot a través del proxy CORS
  //   4. PRODUCTOS_FALLBACK (garantiza que el select nunca quede vacío)
  // -----------------------------------------------------------------
  async function cargarCatalogoProductos(forzar = false) {
    if (catalogoCargando) return catalogoProductos;
    if (catalogoProductos.length > 0 && !forzar) return catalogoProductos;

    // 1. Módulo de cotizaciones ya tiene el catálogo en memoria → reutilizar
    const enMemoria = window.ProductosCotizacion?.getCatalogo?.();
    if (Array.isArray(enMemoria) && enMemoria.length > 0 && !forzar) {
      catalogoProductos = enMemoria;
      console.log(`[Comisiones] Catálogo reutilizado de cotizaciones-productos (${catalogoProductos.length})`);
      return catalogoProductos;
    }

    // 2. Caché localStorage compartida
    if (!forzar) {
      try {
        const raw = localStorage.getItem(CACHE_KEY_PROD);
        if (raw) {
          const { ts, data } = JSON.parse(raw);
          if (Date.now() - ts < CACHE_TTL_PROD && Array.isArray(data) && data.length > 0) {
            catalogoProductos = data;
            console.log(`[Comisiones] Catálogo cargado desde caché (${catalogoProductos.length})`);
            return catalogoProductos;
          }
        }
      } catch (_) { /* caché corrupta — continuar */ }
    }

    // 3. Llamada a la API
    catalogoCargando = true;
    try {
      const productos = await window.HubSpotAPI?.obtenerTodosLosProductos?.();
      if (Array.isArray(productos) && productos.length > 0) {
        catalogoProductos = productos;
        console.log(`[Comisiones] Catálogo cargado desde HubSpot (${catalogoProductos.length})`);
      } else {
        console.warn("[Comisiones] HubSpot devolvió 0 productos — usando fallback de prueba.");
        catalogoProductos = PRODUCTOS_FALLBACK;
      }
    } catch (e) {
      console.warn("[Comisiones] No se pudo cargar catálogo HubSpot:", e.message);
      // 4. Fallback garantizado — el select nunca queda bloqueado en "Cargando…"
      catalogoProductos = PRODUCTOS_FALLBACK;
    } finally {
      catalogoCargando = false;
    }

    return catalogoProductos;
  }

  /** Genera los <option> del select de producto para una fila. */
  function opcionesProductos(selectedNombre = "") {
    // Si el catálogo aún está vacío (no debería ocurrir después del await,
    // pero por seguridad mostramos un placeholder no bloqueante).
    if (catalogoProductos.length === 0) {
      return selectedNombre
        ? `<option value="">Seleccionar producto…</option>
           <option value="${escHtml(selectedNombre)}" selected>${escHtml(selectedNombre)}</option>`
        : `<option value="">Sin productos disponibles</option>`;
    }

    const base = `<option value="">Seleccionar producto…</option>`;
    const opts = catalogoProductos.map(p => {
      const sel = p.nombre === selectedNombre ? "selected" : "";
      return `<option value="${escHtml(p.nombre)}" data-id="${escHtml(p.id)}" ${sel}>${escHtml(p.nombre)}</option>`;
    }).join("");
    return base + opts;
  }

  // -----------------------------------------------------------------
  // MOTOR DE CÁLCULO AUTOMÁTICO
  // -----------------------------------------------------------------

  /**
   * Dada una lista de facturas (invoices HubSpot normalizadas, o
   * movimientos de caja con tipo === "ingreso"), filtra las que están
   * cerradas/pagadas y calcula la comisión que corresponde a cada
   * línea de artículo aplicando las reglas de configuración.
   *
   * @param  {Array} facturas
   * @returns {Array} liquidaciones — listas para renderizar en tabla
   *   Cada objeto: { facturaId, facturaTitulo, responsable, producto,
   *                  fuente, porcentaje, base, comision, fecha }
   */
  function calcularComisionesAutomaticas(facturas) {
    if (!Array.isArray(facturas) || facturas.length === 0) return [];

    const cfg = cargarConfig();

    // Solo asesores activos participan en nuevos cálculos
    const asesoresActivos = cfg.porAsesor.filter(a => a.activo !== false);

    // Estados que identifican una venta cerrada / pagada
    const ESTADOS_CERRADOS = new Set(["paid", "pagado", "aprobado", "pago"]);

    const cerradas = facturas.filter(f => {
      const est = (f.estado || f.hs_invoice_status || "").toLowerCase().trim();
      return ESTADOS_CERRADOS.has(est);
    });

    const resultado = [];

    cerradas.forEach(factura => {
      const responsable = (
        factura.responsable || factura.propietario || factura.hs_owner || ""
      ).trim();

      // Asesor activo que coincide con el propietario de la factura
      const configAsesor = asesoresActivos.find(a =>
        a.responsable.toLowerCase() === responsable.toLowerCase()
      );

      // Construir líneas: si la factura tiene items explícitos los usa;
      // si no (Invoices HubSpot Starter), trata la factura como un ítem único.
      const lineas = Array.isArray(factura.lineas) && factura.lineas.length > 0
        ? factura.lineas
        : [{
            nombre:     factura.etiqueta || factura.titulo || factura.descripcion || "Servicio",
            productoId: null,
            subtotal:   factura.total ?? factura.cantidad ?? factura.valor ?? 0
          }];

      lineas.forEach(linea => {
        const montoBase = Number(linea.subtotal ?? linea.monto ?? linea.valor ?? 0);
        if (montoBase <= 0) return;

        // ── Prioridad 1: excepción por producto específico ───────────
        const configProducto = cfg.porProducto.find(p =>
          (p.productoId && p.productoId === linea.productoId) ||
          p.producto.toLowerCase() === (linea.nombre || "").toLowerCase()
        );

        // ── Prioridad 2: tasa general de productos ───────────────────
        const pctGeneral = cfg.generalProductoPorcentaje ?? 0;

        // ── Prioridad 3: tasa global del asesor ──────────────────────
        const pctAsesor = configAsesor?.porcentaje ?? 0;

        const pct  = configProducto ? configProducto.porcentaje : (pctGeneral > 0 ? pctGeneral : pctAsesor);
        const fuente = configProducto ? "producto" : (pctGeneral > 0 ? "producto_general" : "asesor");

        if (pct > 0) {
          resultado.push({
            facturaId:     factura.id,
            facturaTitulo: factura.etiqueta || factura.titulo || factura.descripcion || "",
            responsable,
            producto:      linea.nombre,
            fuente,
            porcentaje:    pct,
            base:          montoBase,
            comision:      Math.round(montoBase * pct / 100),
            fecha:         factura.creado || factura.fechaCreacion || factura.fecha || ""
          });
        }
        // Sin regla aplicable → sin comisión (no se registra)
      });
    });

    return resultado;
  }

  // -----------------------------------------------------------------
  // RENDER DEL MODAL DE CONFIGURACIÓN
  // -----------------------------------------------------------------

  function renderConfigComisiones() {
    const cfg = cargarConfig();
    renderTabAsesor(cfg);
    renderTabProducto(cfg);
  }

  function renderTabAsesor(cfg) {
    const tbody = document.getElementById("config-comisiones-tbody-asesor");
    if (!tbody) return;

    // Mezclar config guardada con owners de HubSpot que aún no estén configurados
    let asesores = cfg.porAsesor.map(r => ({ ...r }));
    if (Array.isArray(window.ownersCatalogo)) {
      window.ownersCatalogo.forEach(owner => {
        if (!asesores.find(a => a.responsable === owner.nombre)) {
          asesores.push({ responsable: owner.nombre, porcentaje: 0, base: "ingresos", activo: true });
        }
      });
    }
    cfg = { ...cfg, porAsesor: asesores };

    if (cfg.porAsesor.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="tabla-config-comisiones__vacio">Sin asesores. Los owners de HubSpot aparecerán aquí cuando se carguen.</td></tr>`;
      return;
    }

    tbody.innerHTML = cfg.porAsesor.map((row, idx) => {
      const activo = row.activo !== false;
      const iconToggle = activo
        ? `<svg viewBox="0 0 24 24" width="14" height="14" title="Inactivar"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2Zm0 2a8 8 0 1 1 0 16A8 8 0 0 1 12 4Zm0 3a5 5 0 1 0 0 10A5 5 0 0 0 12 7Z"/></svg>`
        : `<svg viewBox="0 0 24 24" width="14" height="14" title="Reactivar"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2Zm0 2a8 8 0 1 1 0 16A8 8 0 0 1 12 4Z"/></svg>`;

      return `
        <tr data-row-asesor="${idx}"
            data-responsable="${escHtml(row.responsable)}"
            data-activo="${activo}"
            class="${activo ? "" : "asesor-row--inactivo"}">
          <td>
            <div class="celda-avatar">
              <span class="celda-avatar__circulo" style="width:24px;height:24px;font-size:10px;">
                ${window.obtenerIniciales(row.responsable)}
              </span>
              <span class="asesor-nombre">${escHtml(row.responsable)}</span>
              ${activo ? "" : `<span class="badge-inactivo">Inactivo</span>`}
            </div>
          </td>
          <td>
            <div class="input-pct">
              <input type="number" class="form-input form-input--sm" min="0" max="100" step="0.1"
                     value="${row.porcentaje}" data-field="porcentaje" ${activo ? "" : "disabled"} />
              <span class="input-pct__suffix">%</span>
            </div>
          </td>
          <td>
            <button class="btn-icono-mini ${activo ? "btn-activo--on" : "btn-activo--off"}"
                    data-accion-asesor="toggle-activo"
                    title="${activo ? "Inactivar asesor (soft-delete)" : "Reactivar asesor"}">
              ${iconToggle}
            </button>
          </td>
        </tr>`;
    }).join("");
  }

  function renderTabProducto(cfg) {
    const tbody = document.getElementById("config-comisiones-tbody-producto");
    if (!tbody) return;

    const inputGen = document.getElementById("config-com-general-pct");
    if (inputGen) inputGen.value = cfg.generalProductoPorcentaje ?? 5;

    if (cfg.porProducto.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="tabla-config-comisiones__vacio">Sin excepciones configuradas. Todos los productos usan la tasa general.</td></tr>`;
      return;
    }

    tbody.innerHTML = cfg.porProducto.map((row, idx) => `
      <tr data-row-producto="${idx}">
        <td>
          <input type="text" class="form-input form-input--sm"
                 data-field="producto-texto" data-autocomplete-prod
                 value="${escHtml(row.producto)}"
                 data-prod-id="${escHtml(row.productoId || '')}"
                 placeholder="Busca un producto…" autocomplete="off"
                 style="width:100%;max-width:260px;" />
        </td>
        <td>
          <div class="input-pct">
            <input type="number" class="form-input form-input--sm" min="0" max="100" step="0.1"
                   value="${row.porcentaje}" data-field="porcentaje" />
            <span class="input-pct__suffix">%</span>
          </div>
        </td>
        <td>
          <button class="btn-icono-mini" data-accion-producto="quitar" title="Quitar">
            <svg viewBox="0 0 24 24" width="14" height="14">
              <path fill="currentColor" d="M6 7h12l-1 13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 7Zm3-3h6l1 2h4v2H5V6h4l1-2Z"/>
            </svg>
          </button>
        </td>
      </tr>`
    ).join("");
  }

  // -----------------------------------------------------------------
  // LEER CONFIG DESDE LA UI (antes de guardar)
  // -----------------------------------------------------------------
  function leerConfigDesdeUI() {
    const cfg = clonarDefault();

    document.querySelectorAll("[data-row-asesor]").forEach(tr => {
      const nombre = tr.dataset.responsable || "";
      const activo = tr.dataset.activo !== "false";
      const pct    = parseFloat(tr.querySelector('[data-field="porcentaje"]')?.value) || 0;
      const base   = "por_venta";
      if (nombre) cfg.porAsesor.push({ responsable: nombre, porcentaje: pct, base, activo });
    });

    cfg.generalProductoPorcentaje = parseFloat(document.getElementById("config-com-general-pct")?.value) || 5;

    document.querySelectorAll("[data-row-producto]").forEach(tr => {
      const inputEl = tr.querySelector('[data-field="producto-texto"]');
      const prod    = inputEl?.value?.trim() || "";
      const prodId  = inputEl?.dataset?.prodId || "";
      const pct     = parseFloat(tr.querySelector('[data-field="porcentaje"]')?.value) || 0;
      if (prod) cfg.porProducto.push({ productoId: prodId, producto: prod, porcentaje: pct });
    });

    return cfg;
  }

  // -----------------------------------------------------------------
  // AUTOCOMPLETADO DE PRODUCTOS — FÁBRICA REUTILIZABLE
  // Convierte cualquier input[data-autocomplete-prod] dentro de
  // containerEl en un buscador predictivo con dropdown flotante.
  // Usa delegación de eventos → funciona con inputs dinámicos.
  // Al seleccionar dispara: CustomEvent("autocomplete:seleccionado", { bubbles:true })
  // -----------------------------------------------------------------
  function initAutocompletoProd(containerEl) {
    if (!containerEl) return;

    let dropdown    = null;
    let inputActivo = null;

    function obtenerCatalogo() {
      if (catalogoProductos.length > 0) return catalogoProductos;
      try {
        const raw = localStorage.getItem(CACHE_KEY_PROD);
        if (raw) {
          const { ts, data } = JSON.parse(raw);
          if (Date.now() - ts < CACHE_TTL_PROD && Array.isArray(data) && data.length > 0) return data;
        }
      } catch (_) {}
      return PRODUCTOS_FALLBACK;
    }

    function cerrarDropdown() {
      dropdown?.remove();
      dropdown    = null;
      inputActivo = null;
    }

    function mostrarDropdown(input, termino) {
      cerrarDropdown();
      const cat  = obtenerCatalogo();
      const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      const q    = norm(termino);
      const filtrados = q.length < 1
        ? cat.slice(0, 10)
        : cat.filter(p =>
            norm(p.nombre).includes(q) ||
            norm(p.sku || "").includes(q) ||
            norm(p.descripcion || "").includes(q)
          ).slice(0, 10);

      if (filtrados.length === 0) return;

      const ul = document.createElement("ul");
      ul.className = "prod-autocomplete__lista";
      ul.setAttribute("role", "listbox");
      ul._datos = filtrados;

      filtrados.forEach((p, i) => {
        const li  = document.createElement("li");
        li.className = "prod-autocomplete__item";
        li.setAttribute("role", "option");
        li.setAttribute("tabindex", "-1");
        li.dataset.prodIdx = i;
        const fmt = window.formatearMoneda
          ? window.formatearMoneda(p.precio, "COP")
          : new Intl.NumberFormat("es-CO").format(p.precio);
        li.innerHTML =
          `<span class="prod-ac__nombre">${escHtml(p.nombre)}</span>` +
          (p.sku ? `<span class="prod-ac__sku">${escHtml(p.sku)}</span>` : "") +
          `<span class="prod-ac__precio">${fmt}</span>`;
        ul.appendChild(li);
      });

      const rect = input.getBoundingClientRect();
      ul.style.cssText = `position:fixed;top:${rect.bottom + 4}px;left:${rect.left}px;` +
                         `width:${rect.width}px;z-index:9999;`;
      document.body.appendChild(ul);
      dropdown    = ul;
      inputActivo = input;
    }

    function seleccionarProducto(prod) {
      if (!prod || !inputActivo) return;
      inputActivo.value              = prod.nombre;
      inputActivo.dataset.prodId     = prod.id    || "";
      inputActivo.dataset.prodPrecio = prod.precio != null ? prod.precio : 0;
      const captured = inputActivo;
      cerrarDropdown();
      captured.dispatchEvent(
        new CustomEvent("autocomplete:seleccionado", { bubbles: true, detail: prod })
      );
    }

    // Input con debounce → mostrar dropdown
    containerEl.addEventListener("input", (e) => {
      const input = e.target.closest("[data-autocomplete-prod]");
      if (!input) return;
      clearTimeout(input._acTimer);
      input._acTimer = setTimeout(() => mostrarDropdown(input, input.value.trim()), 200);
    });

    // Focus → abrir si ya hay texto
    containerEl.addEventListener("focusin", (e) => {
      const input = e.target.closest("[data-autocomplete-prod]");
      if (!input || input.value.trim().length < 1) return;
      mostrarDropdown(input, input.value.trim());
    });

    // Teclado en el input + dropdown
    containerEl.addEventListener("keydown", (e) => {
      const input = e.target.closest("[data-autocomplete-prod]");
      if (input) {
        if (e.key === "Escape") { cerrarDropdown(); return; }
        if (e.key === "ArrowDown" && dropdown) {
          e.preventDefault();
          dropdown.querySelector("[role='option']")?.focus();
          return;
        }
      }
      if (!dropdown) return;
      const li    = e.target.closest("[role='option']");
      if (!li) return;
      const items = [...dropdown.querySelectorAll("[role='option']")];
      const idx   = items.indexOf(li);
      if      (e.key === "ArrowDown")              { e.preventDefault(); items[idx + 1]?.focus(); }
      else if (e.key === "ArrowUp")                { e.preventDefault(); idx <= 0 ? inputActivo?.focus() : items[idx - 1]?.focus(); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); seleccionarProducto(dropdown._datos[parseInt(li.dataset.prodIdx, 10)]); }
      else if (e.key === "Escape")                 { cerrarDropdown(); inputActivo?.focus(); }
    });

    // Click en ítem o click fuera
    document.addEventListener("click", (e) => {
      if (!dropdown) return;
      const li = e.target.closest(".prod-autocomplete__item");
      if (li && dropdown.contains(li)) {
        seleccionarProducto(dropdown._datos[parseInt(li.dataset.prodIdx, 10)]);
        return;
      }
      if (!dropdown.contains(e.target) && !containerEl.contains(e.target)) {
        cerrarDropdown();
      }
    });
  }

  // -----------------------------------------------------------------
  // INIT DEL MODAL DE CONFIGURACIÓN
  // -----------------------------------------------------------------
  function initModalConfigComisiones() {
    const modal = document.getElementById("modal-config-comisiones");
    if (!modal) return;

    // Re-render al abrir. También precarga el catálogo en background.
    const observer = new MutationObserver(() => {
      if (!modal.hasAttribute("hidden")) {
        renderConfigComisiones();
        cargarCatalogoProductos(); // warm-up silencioso
      }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ["hidden"] });

    // Tabs
    modal.querySelectorAll("[data-tab-comisiones]").forEach(tab => {
      tab.addEventListener("click", () => {
        const target = tab.dataset.tabComisiones;
        modal.querySelectorAll("[data-tab-comisiones]").forEach(t =>
          t.classList.toggle("config-comisiones__tab--activo", t === tab)
        );
        modal.querySelectorAll("[data-panel-comisiones]").forEach(p => {
          p.hidden = p.dataset.panelComisiones !== target;
        });
      });
    });

    // Delegación de clicks del modal
    modal.addEventListener("click", async (e) => {

      // ── Quitar fila de producto (hard delete — solo afecta si no se guarda) ──
      const btnQuitarP = e.target.closest('[data-accion-producto="quitar"]');
      if (btnQuitarP) {
        btnQuitarP.closest("tr").remove();
        const tbody = document.getElementById("config-comisiones-tbody-producto");
        if (tbody && tbody.querySelectorAll("[data-row-producto]").length === 0) {
          tbody.innerHTML = `<tr><td colspan="3" class="tabla-config-comisiones__vacio">Sin productos configurados.</td></tr>`;
        }
        return;
      }

      // ── Toggle activo / inactivo de asesor (soft-delete) ────────────────────
      const btnToggle = e.target.closest('[data-accion-asesor="toggle-activo"]');
      if (btnToggle) {
        const tr        = btnToggle.closest("tr");
        const eraActivo = tr.dataset.activo !== "false";
        const ahoraActivo = !eraActivo;

        tr.dataset.activo = ahoraActivo;
        tr.classList.toggle("asesor-row--inactivo", !ahoraActivo);

        // Habilitar/deshabilitar inputs
        tr.querySelectorAll("input, select").forEach(el => {
          el.disabled = !ahoraActivo;
        });

        // Badge "Inactivo"
        const celda = tr.querySelector(".celda-avatar");
        const badge = celda?.querySelector(".badge-inactivo");
        if (ahoraActivo) {
          badge?.remove();
          btnToggle.classList.replace("btn-activo--off", "btn-activo--on");
          btnToggle.title = "Inactivar asesor (soft-delete)";
        } else {
          if (celda && !badge) {
            const sp = document.createElement("span");
            sp.className   = "badge-inactivo";
            sp.textContent = "Inactivo";
            celda.appendChild(sp);
          }
          btnToggle.classList.replace("btn-activo--on", "btn-activo--off");
          btnToggle.title = "Reactivar asesor";
        }
        return;
      }
    });

    // ── Agregar producto: inserta fila inmediatamente, precarga catálogo en bg ──
    const btnAdd = document.getElementById("btn-agregar-producto-comision");
    if (btnAdd) {
      btnAdd.addEventListener("click", () => {
        const tbody = document.getElementById("config-comisiones-tbody-producto");
        if (!tbody) return;

        // Pre-cargar catálogo en background (el autocomplete lo leerá al escribir)
        cargarCatalogoProductos();

        const vacia = tbody.querySelector(".tabla-config-comisiones__vacio");
        if (vacia) tbody.innerHTML = "";

        const idx = tbody.querySelectorAll("[data-row-producto]").length;
        const tr  = document.createElement("tr");
        tr.dataset.rowProducto = idx;
        tr.innerHTML = `
          <td>
            <input type="text" class="form-input form-input--sm"
                   data-field="producto-texto" data-autocomplete-prod
                   placeholder="Busca un producto…" autocomplete="off"
                   style="width:100%;max-width:260px;" />
          </td>
          <td>
            <div class="input-pct">
              <input type="number" class="form-input form-input--sm"
                     min="0" max="100" step="0.1" value="5" data-field="porcentaje" />
              <span class="input-pct__suffix">%</span>
            </div>
          </td>
          <td>
            <button class="btn-icono-mini" data-accion-producto="quitar" title="Quitar">
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path fill="currentColor" d="M6 7h12l-1 13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 7Zm3-3h6l1 2h4v2H5V6h4l1-2Z"/>
              </svg>
            </button>
          </td>`;
        tbody.appendChild(tr);
        tr.querySelector("[data-autocomplete-prod]").focus();
      });
    }

    // ── Autocomplete de productos en toda la tabla (delegación) ─────
    initAutocompletoProd(modal);

    // ── Guardar config ───────────────────────────────────────────────
    document.getElementById("btn-guardar-config-comisiones")
      ?.addEventListener("click", () => {
        const cfg = leerConfigDesdeUI();
        guardarConfig(cfg);
        const activos = cfg.porAsesor.filter(a => a.activo !== false).length;
        const inactivos = cfg.porAsesor.length - activos;
        window.mostrarToast?.(
          `✓ Config guardada — ${activos} asesor(es) activo(s)` +
          (inactivos > 0 ? `, ${inactivos} inactivo(s)` : "") +
          `, ${cfg.porProducto.length} producto(s)`
        );
        if (window.Modales) window.Modales.cerrar(modal);
      });
  }

  // -----------------------------------------------------------------
  // MODAL DE REPORTE DE COMISIONES
  // -----------------------------------------------------------------
  function fechaIso(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  let ultimoReporte = null;

  // ----- Resumen por asesor ------------------------------------
  function calcularReporte() {
    const desde        = document.getElementById("rep-com-desde")?.value  || "";
    const hasta        = document.getElementById("rep-com-hasta")?.value  || "";
    const asesorFiltro = document.getElementById("rep-com-asesor")?.value || "";

    if (!window.Api) return null;

    return window.Api.comisiones.reporte({ desde, hasta,
      ...(asesorFiltro ? { usuario_id: asesorFiltro } : {}) });
  }

  async function renderReporte() {
    const tbody = document.getElementById("rep-com-tbody");
    if (!tbody) return;

    const fmt = v => window.formatearMoneda(v, "COP");
    tbody.innerHTML = `<tr><td colspan="7" class="tabla-reporte-comisiones__vacio">Cargando…</td></tr>`;

    let resp;
    try {
      resp = await calcularReporte();
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="7" class="tabla-reporte-comisiones__vacio">Error: ${escHtml(e.message)}</td></tr>`;
      return;
    }
    if (!resp?.ok) return;

    const filas = resp.filas || [];
    ultimoReporte = { desde: resp.desde, hasta: resp.hasta, filas };

    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    if (filas.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="tabla-reporte-comisiones__vacio">Sin datos para el período seleccionado.</td></tr>`;
      ["rep-com-foot-ingresos","rep-com-foot-teorico","rep-com-foot-registrado","rep-com-foot-pagos","rep-com-foot-diff"]
        .forEach(id => setTxt(id, "—"));
      setTxt("rep-com-kpi-registrado", fmt(0));
      setTxt("rep-com-kpi-registrado-cnt", "0 movimientos");
      setTxt("rep-com-kpi-teorico", fmt(0));
      setTxt("rep-com-kpi-diff", fmt(0));
      return;
    }

    tbody.innerHTML = filas.map(f => {
      const clsDiff = f.diferencia > 0 ? "neg" : (f.diferencia < 0 ? "pos" : "");
      const badgeInactivo = f.activo ? "" : `<span class="badge-inactivo" style="margin-left:4px;">Inactivo</span>`;
      return `
        <tr class="${f.activo ? "" : "asesor-row--inactivo"}">
          <td>
            <div class="celda-avatar">
              <span class="celda-avatar__circulo" style="width:22px;height:22px;font-size:10px;">${window.obtenerIniciales(f.responsable)}</span>
              ${escHtml(f.responsable)}${badgeInactivo}
            </div>
          </td>
          <td class="num">${fmt(f.ingresos)}</td>
          <td class="num">${parseFloat(f.porcentaje || 0).toFixed(1)}%</td>
          <td class="num">${fmt(f.teorico)}</td>
          <td class="num">${fmt(f.registrado)}</td>
          <td class="num">${f.pagos}</td>
          <td class="num diff-${clsDiff}">${f.diferencia >= 0 ? "+" : ""}${fmt(f.diferencia)}</td>
        </tr>`;
    }).join("");

    const totIng = filas.reduce((s, f) => s + (f.ingresos   || 0), 0);
    const totTeo = filas.reduce((s, f) => s + (f.teorico    || 0), 0);
    const totReg = filas.reduce((s, f) => s + (f.registrado || 0), 0);
    const totPag = filas.reduce((s, f) => s + (f.pagos      || 0), 0);
    const totDif = totReg - totTeo;

    setTxt("rep-com-foot-ingresos",   fmt(totIng));
    setTxt("rep-com-foot-teorico",    fmt(totTeo));
    setTxt("rep-com-foot-registrado", fmt(totReg));
    setTxt("rep-com-foot-pagos",      totPag);
    setTxt("rep-com-foot-diff",       (totDif >= 0 ? "+" : "") + fmt(totDif));
    setTxt("rep-com-kpi-registrado",  fmt(totReg));
    setTxt("rep-com-kpi-registrado-cnt", `${totPag} movimientos`);
    setTxt("rep-com-kpi-teorico",     fmt(totTeo));

    const elDiff = document.getElementById("rep-com-kpi-diff");
    if (elDiff) {
      elDiff.textContent = (totDif >= 0 ? "+" : "") + fmt(totDif);
      elDiff.className   = "reporte-comisiones__kpi-valor " + (totDif > 0 ? "diff-neg" : totDif < 0 ? "diff-pos" : "");
    }
  }

  // ----- Init del modal ----------------------------------------
  function initModalReporteComisiones() {
    const modal = document.getElementById("modal-reporte-comisiones");
    if (!modal) return;

    const observer = new MutationObserver(() => {
      if (!modal.hasAttribute("hidden")) {
        prefijarFiltros();
        renderReporte();
      }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ["hidden"] });

    document.getElementById("btn-rep-com-aplicar")?.addEventListener("click", renderReporte);

    document.getElementById("btn-exportar-comisiones")?.addEventListener("click", () => {
      if (!ultimoReporte?.filas?.length) { window.mostrarToast?.("⚠ Sin datos para exportar"); return; }
      exportarReporteCSVResumen(ultimoReporte);
    });
  }

  function prefijarFiltros() {
    const inDesde = document.getElementById("rep-com-desde");
    const inHasta = document.getElementById("rep-com-hasta");
    if (inDesde && !inDesde.value) {
      const hoy = new Date();
      inDesde.value = fechaIso(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
    }
    if (inHasta && !inHasta.value) inHasta.value = fechaIso(new Date());
  }

  function exportarReporteCSVResumen(reporte) {
    const utils = window.utilsExport;
    if (!utils) return;
    const fmt    = v => v;
    const header = ["Asesor","Estado","Total facturado","% Comisión","Com. devengada","Com. registrada","# Pagos","Diferencia"];
    const filas  = reporte.filas.map(f => [
      f.responsable, f.activo ? "Activo" : "Inactivo",
      f.ingresos, f.porcentaje, f.teorico, f.registrado, f.pagos, f.diferencia
    ]);
    const totIng = reporte.filas.reduce((s, f) => s + (f.ingresos   || 0), 0);
    const totTeo = reporte.filas.reduce((s, f) => s + (f.teorico    || 0), 0);
    const totReg = reporte.filas.reduce((s, f) => s + (f.registrado || 0), 0);
    const totPag = reporte.filas.reduce((s, f) => s + (f.pagos      || 0), 0);
    filas.push(["TOTAL","",totIng,"",totTeo,totReg,totPag,totReg-totTeo]);
    const blob = utils.matrizAXLSX([header, ...filas]);
    utils.descargarBlob(blob, utils.nombreArchivo("reporte-comisiones-resumen"));
    window.mostrarToast?.(`✓ Exportado (${reporte.filas.length} asesores)`);
  }

  // -----------------------------------------------------------------
  // INIT
  // -----------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    asegurarConfigInicial();
    sincronizarConfigConAPI();
    initModalConfigComisiones();
    initModalReporteComisiones();

    window.configComisionesAPI = {
      cargarConfig,
      guardarConfig,
      calcularComisionesAutomaticas,
      cargarCatalogoProductos,
      initAutocompletoProd
    };

    console.info("[Comisiones] Módulo listo. Motor: window.configComisionesAPI.calcularComisionesAutomaticas(facturas)");
  });

  // Cuando HubSpot owners lleguen, re-renderizar el config si el modal está abierto
  document.addEventListener("hubspot:owners-loaded", ({ detail }) => {
    const modal = document.getElementById("modal-config-comisiones");
    if (modal && !modal.hasAttribute("hidden")) {
      renderConfigComisiones();
    }
    // Actualizar select de asesor del reporte con owners de HubSpot
    const selAsesor = document.getElementById("rep-com-asesor");
    if (selAsesor && Array.isArray(detail?.owners)) {
      const previo = selAsesor.value;
      selAsesor.innerHTML = `<option value="">Todos</option>` +
        detail.owners.map(o => `<option value="${escHtml(o.nombre)}">${escHtml(o.nombre)}</option>`).join("");
      selAsesor.value = previo;
    }
  });

})();
