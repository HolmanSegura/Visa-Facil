/* ============================================================
   CAJA-COMISIONES.JS
   Tareas 4 y 5 — configuración y reporte de comisiones.

   Modelo frontend (contrato propuesto para el backend):
     configComisiones = {
       version:  1,
       porAsesor: [
         { responsable: "Néstor Goyes", porcentaje: 5, base: "ingresos" }
       ],
       porProducto: [
         { producto: "Implementación Shopify", porcentaje: 8 }
       ]
     }

   Persistencia: localStorage (clave "caja:configComisiones").
   Cuando el backend exponga endpoints, basta reemplazar
   `cargarConfig()` y `guardarConfig()` por llamadas HTTP.
   ============================================================ */
(function () {

  const KEY_LS  = "caja:configComisiones";
  const DEFAULT = {
    version: 1,
    porAsesor: [],
    porProducto: []
  };

  // -----------------------------------------------------------------
  // PERSISTENCIA (placeholder frontend)
  // -----------------------------------------------------------------
  function cargarConfig() {
    try {
      const raw = localStorage.getItem(KEY_LS);
      if (!raw) return clonarDefault();
      const parsed = JSON.parse(raw);
      // Validación mínima del shape esperado
      if (!parsed || !Array.isArray(parsed.porAsesor)) return clonarDefault();
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
  }

  function clonarDefault() {
    return JSON.parse(JSON.stringify(DEFAULT));
  }

  // -----------------------------------------------------------------
  // SEED: si nunca se ha configurado, sembramos a partir de los
  // responsables que aparecen en los movimientos (5% por defecto).
  // -----------------------------------------------------------------
  function asegurarConfigInicial() {
    const cfg = cargarConfig();
    if (cfg.porAsesor.length === 0 && window.estadoApp) {
      const unicos = [...new Set(window.estadoApp.datosOriginales.map(m => m.responsable))].sort();
      cfg.porAsesor = unicos.map(n => ({
        responsable: n,
        porcentaje:  5,
        base:        "ingresos"
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

    // --- Tab Asesor ---
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
              <option value="ingresos"  ${row.base === "ingresos"  ? "selected" : ""}>Ingresos del asesor</option>
              <option value="por_venta" ${row.base === "por_venta" ? "selected" : ""}>Por venta cerrada</option>
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

    // --- Tab Producto ---
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

    // Re-render al abrir
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

    // Quitar fila asesor
    modal.addEventListener("click", (e) => {
      const btnA = e.target.closest('[data-accion-asesor="quitar"]');
      if (btnA) { btnA.closest("tr").remove(); return; }
      const btnP = e.target.closest('[data-accion-producto="quitar"]');
      if (btnP) {
        btnP.closest("tr").remove();
        // Si quedó vacío, mostrar estado vacío
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
        // Si está el placeholder vacío, eliminarlo
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

  // Estado mientras el modal está abierto
  let ultimoReporte = null;

  function calcularReporte() {
    const cfg = cargarConfig();
    const est = window.estadoApp;
    if (!est) return null;

    const desde = document.getElementById("rep-com-desde").value;
    const hasta = document.getElementById("rep-com-hasta").value;
    const asesorFiltro = document.getElementById("rep-com-asesor").value;

    // Filtrar por rango
    let movs = est.datosOriginales.slice();
    if (desde) movs = movs.filter(m => m.fecha >= desde);
    if (hasta) movs = movs.filter(m => m.fecha <= hasta);

    // Agrupar por responsable
    const responsables = [...new Set(movs.map(m => m.responsable))];
    const filas = responsables
      .filter(r => !asesorFiltro || r === asesorFiltro)
      .map(r => {
        const ingresos   = movs.filter(m => m.responsable === r && m.tipo === "ingreso");
        const comisPagos = movs.filter(m => m.responsable === r && m.tipo === "gasto" && m.categoria === "comisiones");

        const totalIngresos   = ingresos.reduce((s, m) => s + m.valor, 0);
        const totalRegistrado = comisPagos.reduce((s, m) => s + m.valor, 0);

        const cfgAsesor = cfg.porAsesor.find(c => c.responsable === r);
        const pct = cfgAsesor ? cfgAsesor.porcentaje : 0;
        const totalTeorico = Math.round(totalIngresos * pct / 100);
        const diff = totalRegistrado - totalTeorico;

        return {
          responsable: r,
          ingresos: totalIngresos,
          porcentaje: pct,
          teorico: totalTeorico,
          registrado: totalRegistrado,
          pagos: comisPagos.length,
          diferencia: diff
        };
      })
      .filter(f => f.ingresos > 0 || f.registrado > 0)  // ocultar filas sin datos
      .sort((a, b) => b.registrado - a.registrado);

    return { desde, hasta, asesorFiltro, filas };
  }

  function renderReporte() {
    const reporte = calcularReporte();
    if (!reporte) return;
    ultimoReporte = reporte;

    const tbody = document.getElementById("rep-com-tbody");
    if (!tbody) return;

    if (reporte.filas.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="tabla-reporte-comisiones__vacio">Sin datos para el período seleccionado.</td></tr>`;
      ["rep-com-foot-ingresos","rep-com-foot-teorico","rep-com-foot-registrado","rep-com-foot-pagos","rep-com-foot-diff"].forEach(id => {
        const el = document.getElementById(id); if (el) el.textContent = "—";
      });
      document.getElementById("rep-com-kpi-registrado").textContent = window.formatearMoneda(0, "COP");
      document.getElementById("rep-com-kpi-registrado-cnt").textContent = "0 movimientos";
      document.getElementById("rep-com-kpi-teorico").textContent = window.formatearMoneda(0, "COP");
      document.getElementById("rep-com-kpi-diff").textContent = window.formatearMoneda(0, "COP");
      return;
    }

    tbody.innerHTML = reporte.filas.map(f => {
      const clsDiff = f.diferencia > 0 ? "neg" : (f.diferencia < 0 ? "pos" : "");
      return `
        <tr>
          <td>
            <div class="celda-avatar">
              <span class="celda-avatar__circulo" style="width:22px;height:22px;font-size:10px;">${window.obtenerIniciales(f.responsable)}</span>
              ${f.responsable}
            </div>
          </td>
          <td class="num">${window.formatearMoneda(f.ingresos, "COP")}</td>
          <td class="num">${f.porcentaje.toFixed(1)}%</td>
          <td class="num">${window.formatearMoneda(f.teorico, "COP")}</td>
          <td class="num">${window.formatearMoneda(f.registrado, "COP")}</td>
          <td class="num">${f.pagos}</td>
          <td class="num diff-${clsDiff}">${f.diferencia >= 0 ? "+" : ""}${window.formatearMoneda(f.diferencia, "COP")}</td>
        </tr>`;
    }).join("");

    // Totales
    const totIng = reporte.filas.reduce((s, f) => s + f.ingresos, 0);
    const totTeo = reporte.filas.reduce((s, f) => s + f.teorico, 0);
    const totReg = reporte.filas.reduce((s, f) => s + f.registrado, 0);
    const totPag = reporte.filas.reduce((s, f) => s + f.pagos, 0);
    const totDif = totReg - totTeo;

    document.getElementById("rep-com-foot-ingresos").textContent   = window.formatearMoneda(totIng, "COP");
    document.getElementById("rep-com-foot-teorico").textContent    = window.formatearMoneda(totTeo, "COP");
    document.getElementById("rep-com-foot-registrado").textContent = window.formatearMoneda(totReg, "COP");
    document.getElementById("rep-com-foot-pagos").textContent      = totPag;
    document.getElementById("rep-com-foot-diff").textContent       = (totDif >= 0 ? "+" : "") + window.formatearMoneda(totDif, "COP");

    // KPIs
    document.getElementById("rep-com-kpi-registrado").textContent = window.formatearMoneda(totReg, "COP");
    document.getElementById("rep-com-kpi-registrado-cnt").textContent = `${totPag} movimientos`;
    document.getElementById("rep-com-kpi-teorico").textContent = window.formatearMoneda(totTeo, "COP");
    const elDiff = document.getElementById("rep-com-kpi-diff");
    elDiff.textContent = (totDif >= 0 ? "+" : "") + window.formatearMoneda(totDif, "COP");
    elDiff.className = "reporte-comisiones__kpi-valor " + (totDif > 0 ? "diff-neg" : totDif < 0 ? "diff-pos" : "");
  }

  function initModalReporteComisiones() {
    const modal = document.getElementById("modal-reporte-comisiones");
    if (!modal) return;

    // Cuando se abre: prefijar filtros, poblar select de asesores y renderizar
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
      const hoy = new Date("2026-05-20");
      const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      inDesde.value = fechaIso(ini);
    }
    if (inHasta && !inHasta.value) {
      inHasta.value = fechaIso(new Date("2026-05-20"));
    }

    if (select && window.estadoApp) {
      const previo = select.value;
      const unicos = [...new Set(window.estadoApp.datosOriginales.map(m => m.responsable))].sort();
      select.innerHTML = `<option value="">Todos</option>` + unicos.map(n => `<option value="${n}">${n}</option>`).join("");
      select.value = previo;
    }
  }

  function exportarReporteCSV(reporte) {
    const utils = window.utilsExport;
    if (!utils) return;

    const header = ["Asesor", "Ingresos del período", "% Comisión", "Comisión teórica", "Comisión registrada", "# Pagos", "Diferencia"];
    const filas = reporte.filas.map(f => [
      f.responsable,
      f.ingresos,
      f.porcentaje,
      f.teorico,
      f.registrado,
      f.pagos,
      f.diferencia
    ]);

    // Totales
    const totIng = reporte.filas.reduce((s, f) => s + f.ingresos, 0);
    const totTeo = reporte.filas.reduce((s, f) => s + f.teorico, 0);
    const totReg = reporte.filas.reduce((s, f) => s + f.registrado, 0);
    const totPag = reporte.filas.reduce((s, f) => s + f.pagos, 0);
    filas.push(["TOTAL", totIng, "", totTeo, totReg, totPag, totReg - totTeo]);

    // Metadata
    const meta = [
      `# Reporte de comisiones`,
      `# Período: ${reporte.desde || "—"} a ${reporte.hasta || "—"}`,
      `# Asesor: ${reporte.asesorFiltro || "Todos"}`,
      `# Generado: ${new Date().toLocaleString("es-CO")}`,
      ``
    ].join("\r\n");

    const lineas = [header, ...filas].map(row =>
      row.map(v => utils.escaparCSV(v)).join(",")
    ).join("\r\n");

    const csv = "\uFEFF" + meta + lineas;
    utils.descargarTexto(csv, utils.nombreArchivo("reporte-comisiones"));
    window.mostrarToast(`✓ Reporte exportado (${reporte.filas.length} asesores)`);
  }

  // -----------------------------------------------------------------
  // INIT
  // -----------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    asegurarConfigInicial();
    initModalConfigComisiones();
    initModalReporteComisiones();
    window.configComisionesAPI = { cargarConfig, guardarConfig };
  });
})();
