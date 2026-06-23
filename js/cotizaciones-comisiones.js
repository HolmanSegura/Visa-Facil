/* ============================================================
   COTIZACIONES-COMISIONES.JS
   Tareas 4 y 5 — configuración y reporte de comisiones para el
   módulo de Cotizaciones.

   Modelo:
     - "Ventas cerradas" = cotizaciones con estado === 'aprobado'
     - "Pipeline activo" = cotizaciones con estado === 'publicado'
                           o 'en_revision' (oportunidades vivas)
     - "Comisión teórica" = Total vendido × % configurado del asesor
     - El período aplica sobre `fechaCreacion`.

   Persistencia:
     - Comparte la misma clave de localStorage que el módulo Caja
       (`caja:configComisiones`). Lo que se configura en un módulo
       aplica también al otro — los porcentajes pertenecen a personas,
       no a módulos.
     - Cuando el backend exponga endpoints, basta reemplazar
       `cargarConfig()` y `guardarConfig()` por llamadas HTTP.
   ============================================================ */
(function () {

  const KEY_LS  = "caja:configComisiones";  // misma clave que módulo Caja
  const DEFAULT = {
    version: 1,
    porAsesor: [],
    porProducto: [],
    generalProductoPorcentaje: 5
  };

  // Catálogo de productos HubSpot en memoria
  const CACHE_KEY_PROD = "hubspot:productos:v1";
  const CACHE_TTL_PROD = 15 * 60 * 1000;
  let catalogoProductos = [];

  function escHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  async function cargarCatalogoProductos() {
    if (catalogoProductos.length > 0) return catalogoProductos;

    // 1. Reutilizar catálogo del módulo de cotizaciones si ya está en memoria
    const enMemoria = window.ProductosCotizacion?.getCatalogo?.();
    if (Array.isArray(enMemoria) && enMemoria.length > 0) {
      catalogoProductos = enMemoria;
      return catalogoProductos;
    }

    // 2. localStorage cache
    try {
      const raw = localStorage.getItem(CACHE_KEY_PROD);
      if (raw) {
        const { ts, data } = JSON.parse(raw);
        if (Date.now() - ts < CACHE_TTL_PROD && Array.isArray(data) && data.length > 0) {
          catalogoProductos = data;
          return catalogoProductos;
        }
      }
    } catch (_) {}

    // 3. HubSpot API
    try {
      if (window.HubSpotAPI) {
        const prods = await window.HubSpotAPI.obtenerTodosLosProductos();
        if (Array.isArray(prods) && prods.length > 0) {
          catalogoProductos = prods;
          return catalogoProductos;
        }
      }
    } catch (e) {
      console.warn("[Comisiones-Cot] No se pudo cargar catálogo HubSpot:", e.message);
    }

    return catalogoProductos;
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
      return Object.assign(clonarDefault(), parsed);
    } catch (e) {
      console.warn("[Comisiones-Cot] Config corrupta, usando default", e);
      return clonarDefault();
    }
  }

  function guardarConfig(cfg) {
    try {
      localStorage.setItem(KEY_LS, JSON.stringify(cfg));
    } catch (e) {
      console.warn("[Comisiones-Cot] No se pudo persistir config", e);
    }
    if (window.Api) {
      window.Api.comisiones.guardarConfig(cfg).catch(e =>
        console.warn("[Comisiones-Cot] API guardarConfig falló:", e.message)
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
      console.warn("[Comisiones-Cot] No se pudo cargar config desde API:", e.message);
    }
  }

  function clonarDefault() {
    return JSON.parse(JSON.stringify(DEFAULT));
  }

  // -----------------------------------------------------------------
  // SEED: si nunca se ha configurado, sembramos a partir de los
  // responsables visibles en las cotizaciones (5% por defecto).
  // -----------------------------------------------------------------
  function asegurarConfigInicial() {
    const cfg = cargarConfig();
    if (cfg.porAsesor.length === 0 && window.estadoApp) {
      const unicos = [...new Set(window.estadoApp.datosOriginales.map(c => c.responsable))].sort();
      cfg.porAsesor = unicos.map(n => ({
        responsable: n,
        porcentaje:  5,
        base:        "por_venta"
      }));
      guardarConfig(cfg);
    }
    return cfg;
  }

  // -----------------------------------------------------------------
  // MODAL: CONFIGURAR COMISIONES (Task 4)
  // -----------------------------------------------------------------
  function filaAsesor(row, idx) {
    const ini = (window.obtenerIniciales || (n => (n||"?")[0]))(row.responsable);
    return `
      <tr data-row-asesor="${idx}">
        <td>
          <div class="celda-avatar">
            <span class="celda-avatar__circulo" style="width:24px;height:24px;font-size:10px;">${ini}</span>
            ${escHtml(row.responsable)}
          </div>
        </td>
        <td>
          <div class="input-pct">
            <input type="number" class="form-input form-input--sm" min="0" max="100" step="0.1"
                   value="${row.porcentaje}" data-field="porcentaje" />
            <span class="input-pct__suffix">%</span>
          </div>
        </td>
        <td>
          <button class="btn-icono-mini" data-accion-asesor="quitar" title="Quitar">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M6 7h12l-1 13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 7Zm3-3h6l1 2h4v2H5V6h4l1-2Z"/></svg>
          </button>
        </td>
      </tr>`;
  }

  function renderConfigComisiones() {
    const cfg = cargarConfig();

    // Tab Asesor — mezclar config guardada con owners de HubSpot
    const tbodyA = document.getElementById("config-comisiones-tbody-asesor");
    if (tbodyA) {
      let asesores = cfg.porAsesor.map(r => ({ ...r }));

      // Agregar owners de HubSpot que aún no estén en la config
      if (Array.isArray(window.ownersCatalogo)) {
        window.ownersCatalogo.forEach(owner => {
          if (!asesores.find(a => a.responsable === owner.nombre)) {
            asesores.push({ responsable: owner.nombre, porcentaje: 0, base: "ventas_cerradas" });
          }
        });
      }

      tbodyA.innerHTML = asesores.length
        ? asesores.map(filaAsesor).join("")
        : `<tr><td colspan="4" class="tabla-config-comisiones__vacio">No hay asesores configurados. Los owners de HubSpot aparecerán aquí cuando se carguen.</td></tr>`;
    }

    // Tab Producto
    const tbodyP = document.getElementById("config-comisiones-tbody-producto");
    if (tbodyP) {
      const inputGen = document.getElementById("config-com-general-pct");
      if (inputGen) inputGen.value = cfg.generalProductoPorcentaje ?? 5;

      if (cfg.porProducto.length === 0) {
        tbodyP.innerHTML = `<tr><td colspan="3" class="tabla-config-comisiones__vacio">Sin excepciones configuradas. Todos los productos usan la tasa general.</td></tr>`;
      } else {
        tbodyP.innerHTML = cfg.porProducto.map((row, idx) => `
          <tr data-row-producto="${idx}">
            <td>
              <input type="text" class="form-input form-input--sm" value="${escHtml(row.producto)}"
                     data-field="producto" data-autocomplete-prod placeholder="Buscar producto HubSpot…"/>
            </td>
            <td>
              <div class="input-pct">
                <input type="number" class="form-input form-input--sm" min="0" max="100" step="0.1"
                       value="${row.porcentaje}" data-field="porcentaje"/>
                <span class="input-pct__suffix">%</span>
              </div>
            </td>
            <td>
              <button class="btn-icono-mini" data-accion-producto="quitar" title="Quitar">
                <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M6 7h12l-1 13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 7Zm3-3h6l1 2h4v2H5V6h4l1-2Z"/></svg>
              </button>
            </td>
          </tr>`).join("");
      }
    }

    // Cargar catálogo de productos en background si no está listo
    cargarCatalogoProductos();
  }

  function leerConfigDesdeUI() {
    const cfg = clonarDefault();

    document.querySelectorAll("[data-row-asesor]").forEach(tr => {
      const nombre = tr.querySelector(".celda-avatar")?.textContent.trim() || "";
      const pct    = parseFloat(tr.querySelector('[data-field="porcentaje"]').value) || 0;
      const base   = "por_venta";
      if (nombre) cfg.porAsesor.push({ responsable: nombre, porcentaje: pct, base });
    });

    cfg.generalProductoPorcentaje = parseFloat(document.getElementById("config-com-general-pct")?.value) || 5;

    document.querySelectorAll("[data-row-producto]").forEach(tr => {
      const prod = tr.querySelector('[data-field="producto"]').value.trim();
      const pct  = parseFloat(tr.querySelector('[data-field="porcentaje"]').value) || 0;
      if (prod) cfg.porProducto.push({ producto: prod, porcentaje: pct });
    });

    return cfg;
  }

  function initModalConfigComisiones() {
    const modal = document.getElementById("modal-config-comisiones");
    if (!modal) return;

    const observer = new MutationObserver(() => {
      if (!modal.hasAttribute("hidden")) renderConfigComisiones();
    });
    observer.observe(modal, { attributes: true, attributeFilter: ["hidden"] });

    // Tabs
    modal.querySelectorAll("[data-tab-comisiones]").forEach(tab => {
      tab.addEventListener("click", () => {
        const target = tab.dataset.tabComisiones;
        modal.querySelectorAll("[data-tab-comisiones]").forEach(t =>
          t.classList.toggle("config-comisiones__tab--activo", t === tab));
        modal.querySelectorAll("[data-panel-comisiones]").forEach(p => {
          if (p.dataset.panelComisiones === target) p.removeAttribute("hidden");
          else p.setAttribute("hidden", "");
        });
      });
    });

    // Quitar filas
    modal.addEventListener("click", (e) => {
      const btnA = e.target.closest('[data-accion-asesor="quitar"]');
      if (btnA) { btnA.closest("tr").remove(); return; }
      const btnP = e.target.closest('[data-accion-producto="quitar"]');
      if (btnP) {
        btnP.closest("tr").remove();
        const tbody = document.getElementById("config-comisiones-tbody-producto");
        if (tbody && tbody.children.length === 0) {
          tbody.innerHTML = `<tr><td colspan="3" class="tabla-config-comisiones__vacio">No hay productos configurados todavía.</td></tr>`;
        }
      }
    });

    // Agregar producto (con autocomplete de HubSpot)
    const btnAdd = document.getElementById("btn-agregar-producto-comision");
    if (btnAdd) {
      btnAdd.addEventListener("click", () => {
        const tbody = document.getElementById("config-comisiones-tbody-producto");
        if (!tbody) return;
        const vacia = tbody.querySelector(".tabla-config-comisiones__vacio");
        if (vacia) tbody.innerHTML = "";
        const idx = tbody.querySelectorAll("[data-row-producto]").length;
        const tr = document.createElement("tr");
        tr.dataset.rowProducto = idx;
        tr.innerHTML = `
          <td><input type="text" class="form-input form-input--sm" data-field="producto" data-autocomplete-prod placeholder="Buscar producto HubSpot…"/></td>
          <td>
            <div class="input-pct">
              <input type="number" class="form-input form-input--sm" min="0" max="100" step="0.1" value="5" data-field="porcentaje"/>
              <span class="input-pct__suffix">%</span>
            </div>
          </td>
          <td>
            <button class="btn-icono-mini" data-accion-producto="quitar">
              <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M6 7h12l-1 13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 7Zm3-3h6l1 2h4v2H5V6h4l1-2Z"/></svg>
            </button>
          </td>`;
        tbody.appendChild(tr);
        tr.querySelector('[data-field="producto"]').focus();
      });
    }

    // Autocomplete de productos en el tab "Por producto"
    initAutocompletoProd(modal);

    // Guardar
    const btnGuardar = document.getElementById("btn-guardar-config-comisiones");
    if (btnGuardar) {
      btnGuardar.addEventListener("click", () => {
        const cfg = leerConfigDesdeUI();
        guardarConfig(cfg);
        window.mostrarToast(`✓ Configuración guardada (${cfg.porAsesor.length} asesores, ${cfg.porProducto.length} productos)`);
        if (window.Modales) window.Modales.cerrar(modal);
      });
    }
  }

  // -----------------------------------------------------------------
  // AUTOCOMPLETE DE PRODUCTOS EN TAB "POR PRODUCTO"
  // -----------------------------------------------------------------

  function initAutocompletoProd(containerEl) {
    if (!containerEl) return;
    let dropdown = null, inputActivo = null;

    function obtenerCat() {
      return catalogoProductos.length ? catalogoProductos : [];
    }

    function cerrarDrop() { dropdown?.remove(); dropdown = null; inputActivo = null; }

    function mostrarDrop(input, termino) {
      cerrarDrop();
      const cat = obtenerCat();
      if (!cat.length) return;
      const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      const q = norm(termino);
      const filtrados = q.length < 1 ? cat.slice(0, 10) : cat.filter(p => norm(p.nombre || "").includes(q) || norm(p.sku || "").includes(q)).slice(0, 10);
      if (!filtrados.length) return;

      const ul = document.createElement("ul");
      ul.className = "prod-autocomplete__lista";
      ul._datos = filtrados;
      filtrados.forEach((p, i) => {
        const li = document.createElement("li");
        li.className = "prod-autocomplete__item";
        li.setAttribute("role", "option");
        li.setAttribute("tabindex", "-1");
        li.dataset.prodIdx = i;
        const precio = p.precio ? (window.formatearMoneda ? window.formatearMoneda(p.precio, "COP") : `COP ${p.precio}`) : "";
        li.innerHTML = `<span class="prod-ac__nombre">${escHtml(p.nombre)}</span>${precio ? `<span class="prod-ac__precio">${escHtml(precio)}</span>` : ""}`;
        ul.appendChild(li);
      });

      const rect = input.getBoundingClientRect();
      ul.style.cssText = `position:fixed;top:${rect.bottom + 4}px;left:${rect.left}px;width:${rect.width}px;z-index:9999;`;
      document.body.appendChild(ul);
      dropdown = ul;
      inputActivo = input;
    }

    function seleccionarProd(prod) {
      if (!prod || !inputActivo) return;
      inputActivo.value = prod.nombre;
      inputActivo.dataset.prodId = prod.id || "";
      const cap = inputActivo;
      cerrarDrop();
      cap.dispatchEvent(new CustomEvent("autocomplete:seleccionado", { bubbles: true, detail: prod }));
    }

    containerEl.addEventListener("input", e => {
      const inp = e.target.closest("[data-autocomplete-prod]");
      if (!inp) return;
      clearTimeout(inp._acT);
      inp._acT = setTimeout(async () => {
        await cargarCatalogoProductos();
        mostrarDrop(inp, inp.value.trim());
      }, 200);
    });

    containerEl.addEventListener("focusin", e => {
      const inp = e.target.closest("[data-autocomplete-prod]");
      if (!inp) return;
      cargarCatalogoProductos().then(() => {
        if (inp.value.trim().length >= 0) mostrarDrop(inp, inp.value.trim());
      });
    });

    containerEl.addEventListener("keydown", e => {
      const inp = e.target.closest("[data-autocomplete-prod]");
      if (inp) {
        if (e.key === "Escape") { cerrarDrop(); return; }
        if (e.key === "ArrowDown" && dropdown) { e.preventDefault(); dropdown.querySelector("[role='option']")?.focus(); return; }
      }
      if (!dropdown) return;
      const li = e.target.closest("[role='option']");
      if (!li) return;
      const items = [...dropdown.querySelectorAll("[role='option']")];
      const idx = items.indexOf(li);
      if      (e.key === "ArrowDown")              { e.preventDefault(); items[idx + 1]?.focus(); }
      else if (e.key === "ArrowUp")                { e.preventDefault(); idx <= 0 ? inputActivo?.focus() : items[idx - 1]?.focus(); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); seleccionarProd(dropdown._datos[parseInt(li.dataset.prodIdx, 10)]); }
      else if (e.key === "Escape")                 { cerrarDrop(); inputActivo?.focus(); }
    });

    document.addEventListener("click", e => {
      if (!dropdown) return;
      const li = e.target.closest(".prod-autocomplete__item");
      if (li && dropdown.contains(li)) { seleccionarProd(dropdown._datos[parseInt(li.dataset.prodIdx, 10)]); return; }
      if (!dropdown.contains(e.target) && !containerEl.contains(e.target)) cerrarDrop();
    });
  }

  // -----------------------------------------------------------------
  // MODAL: REPORTE DE COMISIONES (Task 5)
  // -----------------------------------------------------------------
  function fechaIso(d) {
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, "0");
    const dd   = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // Estado de la última consulta (para exportar)
  let ultimoReporte = null;

  const ESTADOS_CERRADA = ["aprobado"];
  const ESTADOS_PIPELINE = ["publicado", "en_revision"];

  function calcularReporte() {
    const cfg = cargarConfig();
    const est = window.estadoApp;
    if (!est) return null;

    const desde = document.getElementById("rep-com-desde").value;
    const hasta = document.getElementById("rep-com-hasta").value;
    const asesorFiltro = document.getElementById("rep-com-asesor").value;

    // Filtrar por rango (sobre fechaCreacion)
    let cots = est.datosOriginales.slice();
    if (desde) cots = cots.filter(c => c.fechaCreacion >= desde);
    if (hasta) cots = cots.filter(c => c.fechaCreacion <= hasta);

    // Normalizar todo a COP para totales agregados
    // (en un sistema real existiría tasa de cambio; aquí asumimos
    // que las pocas en USD se reportan tal cual para simplicidad)
    const normalizar = (cot) => cot.cantidad; // placeholder, sin conversión

    const responsables = [...new Set(cots.map(c => c.responsable))];
    const filas = responsables
      .filter(r => !asesorFiltro || r === asesorFiltro)
      .map(r => {
        const propias  = cots.filter(c => c.responsable === r);
        const cerradas = propias.filter(c => ESTADOS_CERRADA.includes(c.estado));
        const pipeline = propias.filter(c => ESTADOS_PIPELINE.includes(c.estado));

        const totalVendido  = cerradas.reduce((s, c) => s + normalizar(c), 0);
        const totalPipeline = pipeline.reduce((s, c) => s + normalizar(c), 0);

        const cfgAsesor = cfg.porAsesor.find(c => c.responsable === r);
        const pct = cfgAsesor ? cfgAsesor.porcentaje : 0;
        const teorico = Math.round(totalVendido * pct / 100);

        return {
          responsable: r,
          cerradas: cerradas.length,
          totalVendido,
          porcentaje: pct,
          teorico,
          pipeline: pipeline.length,
          totalPipeline
        };
      })
      .filter(f => f.cerradas > 0 || f.pipeline > 0)
      .sort((a, b) => b.totalVendido - a.totalVendido);

    return { desde, hasta, asesorFiltro, filas };
  }

  function renderReporte() {
    const reporte = calcularReporte();
    if (!reporte) return;
    ultimoReporte = reporte;

    const tbody = document.getElementById("rep-com-tbody");
    if (!tbody) return;

    if (reporte.filas.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="tabla-reporte-comisiones__vacio">Sin datos para el período seleccionado.</td></tr>`;
      ["rep-com-foot-cerradas","rep-com-foot-vendido","rep-com-foot-teorico","rep-com-foot-pipeline"].forEach(id => {
        const el = document.getElementById(id); if (el) el.textContent = "—";
      });
      document.getElementById("rep-com-kpi-cerradas").textContent = "0";
      document.getElementById("rep-com-kpi-vendido").textContent  = window.formatearMoneda(0, "COP");
      document.getElementById("rep-com-kpi-teorico").textContent  = window.formatearMoneda(0, "COP");
      return;
    }

    tbody.innerHTML = reporte.filas.map(f => `
      <tr>
        <td>
          <div class="celda-avatar">
            <span class="celda-avatar__circulo" style="width:22px;height:22px;font-size:10px;">${window.obtenerIniciales(f.responsable)}</span>
            ${f.responsable}
          </div>
        </td>
        <td class="num">${f.cerradas}</td>
        <td class="num">${window.formatearMoneda(f.totalVendido, "COP")}</td>
        <td class="num">${f.porcentaje.toFixed(1)}%</td>
        <td class="num">${window.formatearMoneda(f.teorico, "COP")}</td>
        <td class="num">${f.pipeline} · <span style="color:var(--color-texto-debil);font-size:11px;">${window.formatearMoneda(f.totalPipeline, "COP")}</span></td>
      </tr>`).join("");

    // Totales
    const totCer = reporte.filas.reduce((s, f) => s + f.cerradas, 0);
    const totVen = reporte.filas.reduce((s, f) => s + f.totalVendido, 0);
    const totTeo = reporte.filas.reduce((s, f) => s + f.teorico, 0);
    const totPipCnt = reporte.filas.reduce((s, f) => s + f.pipeline, 0);
    const totPipVal = reporte.filas.reduce((s, f) => s + f.totalPipeline, 0);

    document.getElementById("rep-com-foot-cerradas").textContent  = totCer;
    document.getElementById("rep-com-foot-vendido").textContent   = window.formatearMoneda(totVen, "COP");
    document.getElementById("rep-com-foot-teorico").textContent   = window.formatearMoneda(totTeo, "COP");
    document.getElementById("rep-com-foot-pipeline").textContent  = `${totPipCnt} · ${window.formatearMoneda(totPipVal, "COP")}`;

    // KPIs
    document.getElementById("rep-com-kpi-cerradas").textContent = totCer;
    const subCer = document.getElementById("rep-com-kpi-cerradas-sub");
    if (subCer) subCer.textContent = `Estado: Aprobado · ${reporte.filas.length} asesores`;
    document.getElementById("rep-com-kpi-vendido").textContent  = window.formatearMoneda(totVen, "COP");
    document.getElementById("rep-com-kpi-teorico").textContent  = window.formatearMoneda(totTeo, "COP");
  }

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
      if (!ultimoReporte || ultimoReporte.filas.length === 0) {
        window.mostrarToast("⚠ No hay datos para exportar");
        return;
      }
      exportarReporteCSV(ultimoReporte);
    });
  }

  function prefijarFiltros() {
    const inDesde = document.getElementById("rep-com-desde");
    const inHasta = document.getElementById("rep-com-hasta");
    const select  = document.getElementById("rep-com-asesor");

    if (inDesde && !inDesde.value) {
      // Default: año actual hasta hoy
      const hoy = new Date();
      const ini = new Date(hoy.getFullYear(), 0, 1);
      inDesde.value = fechaIso(ini);
    }
    if (inHasta && !inHasta.value) {
      inHasta.value = fechaIso(new Date());
    }

    // #rep-com-asesor ya viene poblado desde HubSpot owners (hubspot-api.js)
  }

  function exportarReporteCSV(reporte) {
    const utils = window.utilsExport;
    if (!utils) return;

    const header = ["Asesor", "# Cotizaciones cerradas", "Total vendido", "% Comisión", "Comisión teórica", "# Cotizaciones en pipeline", "Valor pipeline"];
    const filas = reporte.filas.map(f => [
      f.responsable,
      f.cerradas,
      f.totalVendido,
      f.porcentaje,
      f.teorico,
      f.pipeline,
      f.totalPipeline
    ]);

    // Totales
    const totCer = reporte.filas.reduce((s, f) => s + f.cerradas, 0);
    const totVen = reporte.filas.reduce((s, f) => s + f.totalVendido, 0);
    const totTeo = reporte.filas.reduce((s, f) => s + f.teorico, 0);
    const totPipCnt = reporte.filas.reduce((s, f) => s + f.pipeline, 0);
    const totPipVal = reporte.filas.reduce((s, f) => s + f.totalPipeline, 0);
    filas.push(["TOTAL", totCer, totVen, "", totTeo, totPipCnt, totPipVal]);

    const blob = utils.matrizAXLSX([header, ...filas]);
    utils.descargarBlob(blob, utils.nombreArchivo("reporte-comisiones-cotizaciones"));
    window.mostrarToast(`✓ Reporte exportado (${reporte.filas.length} asesores)`);
  }

  // -----------------------------------------------------------------
  // INIT
  // -----------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    asegurarConfigInicial();
    sincronizarConfigConAPI();
    initModalConfigComisiones();
    initModalReporteComisiones();
    window.configComisionesAPI = { cargarConfig, guardarConfig };
  });

  // Cuando HubSpot owners lleguen, actualizar el modal si está abierto
  document.addEventListener("hubspot:owners-loaded", ({ detail }) => {
    const modal = document.getElementById("modal-config-comisiones");
    if (modal && !modal.hasAttribute("hidden")) {
      renderConfigComisiones();
    }
    // Actualizar select de asesor con owners de HubSpot (fuente de verdad)
    const selAsesor = document.getElementById("rep-com-asesor");
    if (selAsesor && Array.isArray(detail?.owners)) {
      const previo = selAsesor.value;
      selAsesor.innerHTML = `<option value="">Todos</option>` +
        detail.owners.map(o => `<option value="${escHtml(o.nombre)}">${escHtml(o.nombre)}</option>`).join("");
      selAsesor.value = previo;
    }
  });
})();
