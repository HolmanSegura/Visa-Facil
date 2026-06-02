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
    porProducto: []
  };

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
        base:        "ventas_cerradas"
      }));
      guardarConfig(cfg);
    }
    return cfg;
  }

  // -----------------------------------------------------------------
  // MODAL: CONFIGURAR COMISIONES (Task 4)
  // -----------------------------------------------------------------
  function renderConfigComisiones() {
    const cfg = cargarConfig();

    // Tab Asesor
    const tbodyA = document.getElementById("config-comisiones-tbody-asesor");
    if (tbodyA) {
      tbodyA.innerHTML = cfg.porAsesor.map((row, idx) => `
        <tr data-row-asesor="${idx}">
          <td>
            <div class="celda-avatar">
              <span class="celda-avatar__circulo" style="width:24px;height:24px;font-size:10px;">${window.obtenerIniciales(row.responsable)}</span>
              ${row.responsable}
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
            <select class="form-select form-select--sm" data-field="base">
              <option value="ventas_cerradas" ${row.base === "ventas_cerradas" ? "selected" : ""}>Ventas cerradas</option>
              <option value="ingresos"        ${row.base === "ingresos"        ? "selected" : ""}>Ingresos cobrados</option>
              <option value="por_venta"       ${row.base === "por_venta"       ? "selected" : ""}>Por venta cerrada</option>
            </select>
          </td>
          <td>
            <button class="btn-icono-mini" data-accion-asesor="quitar" title="Quitar">
              <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M6 7h12l-1 13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 7Zm3-3h6l1 2h4v2H5V6h4l1-2Z"/></svg>
            </button>
          </td>
        </tr>
      `).join("");
    }

    // Tab Producto
    const tbodyP = document.getElementById("config-comisiones-tbody-producto");
    if (tbodyP) {
      if (cfg.porProducto.length === 0) {
        tbodyP.innerHTML = `<tr><td colspan="3" class="tabla-config-comisiones__vacio">No hay productos configurados todavía. Usa el botón "+ Agregar producto" para empezar.</td></tr>`;
      } else {
        tbodyP.innerHTML = cfg.porProducto.map((row, idx) => `
          <tr data-row-producto="${idx}">
            <td>
              <input type="text" class="form-input form-input--sm" value="${row.producto}" data-field="producto" placeholder="Ej: Implementación Shopify"/>
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
          </tr>
        `).join("");
      }
    }
  }

  function leerConfigDesdeUI() {
    const cfg = clonarDefault();

    document.querySelectorAll("[data-row-asesor]").forEach(tr => {
      const nombre = tr.querySelector(".celda-avatar")?.textContent.trim() || "";
      const pct    = parseFloat(tr.querySelector('[data-field="porcentaje"]').value) || 0;
      const base   = tr.querySelector('[data-field="base"]').value;
      if (nombre) cfg.porAsesor.push({ responsable: nombre, porcentaje: pct, base });
    });

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

    // Agregar producto
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
          <td><input type="text" class="form-input form-input--sm" data-field="producto" placeholder="Nombre del producto"/></td>
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

    if (select && window.estadoApp) {
      const previo = select.value;
      const unicos = [...new Set(window.estadoApp.datosOriginales.map(c => c.responsable))].sort();
      select.innerHTML = `<option value="">Todos</option>` + unicos.map(n => `<option value="${n}">${n}</option>`).join("");
      select.value = previo;
    }
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

    const meta = [
      `# Reporte de comisiones — Cotizaciones`,
      `# Período (por fecha de creación): ${reporte.desde || "—"} a ${reporte.hasta || "—"}`,
      `# Asesor: ${reporte.asesorFiltro || "Todos"}`,
      `# Definición de "cerrada": estado = aprobado`,
      `# Definición de "pipeline": estado = publicado o en_revision`,
      `# Generado: ${new Date().toLocaleString("es-CO")}`,
      ``
    ].join("\r\n");

    const lineas = [header, ...filas].map(row =>
      row.map(v => utils.escaparCSV(v)).join(",")
    ).join("\r\n");

    const csv = "\uFEFF" + meta + lineas;
    utils.descargarTexto(csv, utils.nombreArchivo("reporte-comisiones-cotizaciones"));
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
})();
