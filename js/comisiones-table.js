/* ============================================================
   COMISIONES-TABLE.JS
   Tabla de ingresos facturados con comisión sugerida y ajuste
   manual inline.
   Columnas: asesor, titulo, fecha_pago, monto, porcentaje,
             comision_sugerida, comision_final, acciones
   ============================================================ */
(function () {

  function escHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    const f = new Date(iso + "T12:00:00");
    return `${f.getDate()} ${meses[f.getMonth()]} ${f.getFullYear()}`;
  }

  const COLUMNAS = {
    asesor: {
      th: "ASESOR", thClass: "th",
      sort: r => (r.asesor || "").toLowerCase(),
      render(r) {
        const td = document.createElement("td");
        td.innerHTML = `<div class="celda-avatar">
          <span class="celda-avatar__circulo">${window.obtenerIniciales(r.asesor)}</span>
          <span class="celda-avatar__nombre">${escHtml(r.asesor)}</span>
        </div>`;
        return td;
      }
    },
    titulo: {
      th: "FACTURA", thClass: "th",
      sort: r => (r.titulo || "").toLowerCase(),
      render(r) {
        const td = document.createElement("td");
        td.innerHTML = `<span class="factura-titulo">${escHtml(r.titulo)}</span>
          <span class="factura-ref">${escHtml(r.hubspot_inv_id)}</span>`;
        return td;
      }
    },
    fecha_pago: {
      th: "FECHA PAGO", thClass: "th",
      sort: r => r.fecha_pago || "",
      render(r) {
        const td = document.createElement("td");
        td.className = "fecha-celda";
        td.textContent = fmtDate(r.fecha_pago);
        return td;
      }
    },
    monto: {
      th: "FACTURADO", thClass: "th th--num",
      sort: r => r.monto,
      render(r) {
        const td = document.createElement("td");
        td.className = "celda--num";
        td.innerHTML = `<span class="valor-celda">${window.formatearMoneda(r.monto, r.moneda || "COP")}</span>`;
        return td;
      }
    },
    porcentaje: {
      th: "% COM.", thClass: "th th--num",
      sort: r => r.porcentaje,
      render(r) {
        const td = document.createElement("td");
        td.className = "celda--num";
        td.innerHTML = `<span class="pct-badge">${(r.porcentaje || 0).toFixed(1)}%</span>`;
        return td;
      }
    },
    comision_sugerida: {
      th: "COM. SUGERIDA", thClass: "th th--num",
      sort: r => r.comision_sugerida,
      render(r) {
        const td = document.createElement("td");
        td.className = "celda--num";
        td.innerHTML = `<span class="valor-celda">${window.formatearMoneda(r.comision_sugerida, "COP")}</span>`;
        return td;
      }
    },
    comision_final: {
      th: "COM. FINAL", thClass: "th th--num",
      sort: r => r.comision_final,
      render(r) {
        const td = document.createElement("td");
        td.className = "celda--num com-celda-ajustada";
        const esAjustada = r.comision_ajustada !== null && Math.round(r.comision_ajustada) !== Math.round(r.comision_sugerida);
        const badge      = esAjustada
          ? `<span class="badge-ajustado" title="Ajustado manualmente">Ajustado</span>`
          : "";
        td.innerHTML = `
          <span class="com-valor-display">${window.formatearMoneda(r.comision_final, "COP")}${badge}</span>
          <div class="com-editor" hidden>
            <input type="number" class="form-input form-input--sm com-input-ajuste"
                   value="${r.comision_final}" min="0" step="1000" style="width:130px" />
            <input type="text" class="form-input form-input--sm com-input-motivo"
                   placeholder="Motivo…" style="width:180px" />
            <button class="btn btn--xs btn--naranja com-btn-guardar">Guardar</button>
            <button class="btn btn--xs btn--ghost com-btn-cancelar">Cancelar</button>
          </div>`;
        return td;
      }
    },
    estado_comision: {
      th: "COMISIÓN", thClass: "th",
      sort: r => r.estado_comision || "sin_registro",
      render(r) {
        const td = document.createElement("td");
        const estado = r.estado_comision || (r.comision_caja_id ? "pendiente" : "sin_registro");
        const cfg = {
          pagado:       { label: "Pagada",       cls: "com-estado--pagada" },
          pendiente:    { label: "Pendiente",     cls: "com-estado--pendiente" },
          sin_registro: { label: "Sin registro",  cls: "com-estado--sin-registro" },
        };
        const { label, cls } = cfg[estado] || cfg.sin_registro;
        td.innerHTML = `<span class="com-estado-badge ${cls}">${label}</span>`;
        return td;
      }
    },
    acciones: {
      th: "", thClass: "th",
      sort: null,
      render(r) {
        const td = document.createElement("td");
        td.className = "com-acciones";
        const btnHist = r.n_ajustes > 0
          ? `<button class="btn-icono-mini com-btn-historial" title="Ver historial (${r.n_ajustes})">
               <svg viewBox="0 0 24 24" width="13" height="13"><path fill="currentColor" d="M13 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7v3l4-4-4-4v3Zm-1 5v5l4.25 2.52.77-1.33-3.52-2.09V8H12Z"/></svg>
               <span class="historial-cnt">${r.n_ajustes}</span>
             </button>`
          : "";
        td.innerHTML = `
          <button class="btn-icono-mini com-btn-editar" title="Ajustar comisión">
            <svg viewBox="0 0 24 24" width="13" height="13"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"/></svg>
          </button>
          ${btnHist}`;
        return td;
      }
    }
  };

  const COLUMNAS_DEFECTO = ["asesor", "titulo", "fecha_pago", "monto", "porcentaje", "comision_sugerida", "comision_final", "estado_comision", "acciones"];

  const MAPA_TEXTO = {
    asesor:            "Asesor",
    titulo:            "Factura",
    fecha_pago:        "Fecha de pago",
    monto:             "Valor facturado",
    porcentaje:        "% Comisión",
    comision_sugerida: "Com. sugerida",
    comision_final:    "Com. final",
    estado_comision:   "Estado comisión",
    acciones:          ""
  };

  class TablaComisiones {
    constructor() {
      this.tbody   = document.getElementById("tbody-comisiones");
      this.tabla   = document.getElementById("tabla-comisiones");
      this.contPag = document.getElementById("pag-numeros");
      if (!this.tbody || !this.tabla) return;
      this.escucharEventos();
      this.renderizar();
    }

    actualizarCabecera() {
      const theadRow = this.tabla.querySelector("thead tr");
      if (!theadRow) return;
      const est  = window.estadoApp;
      const cols = est.columnasActivas || COLUMNAS_DEFECTO;

      theadRow.innerHTML = cols.map(key => {
        const col = COLUMNAS[key];
        if (!col) return `<th class="th">${key}</th>`;
        if (!col.sort) return `<th class="${col.thClass}">${col.th}</th>`;
        const esOrden    = est.ordenColumna === key;
        const claseExtra = esOrden ? " th--orden" : "";
        const dataOrden  = esOrden ? ` data-orden="${est.ordenDireccion}"` : "";
        const icono      = esOrden
          ? `<span class="th__icono-orden"><svg viewBox="0 0 24 24" width="10" height="10"><path fill="none" stroke="currentColor" stroke-width="2" d="M12 4v15M6 14l6 6 6-6"/></svg></span>`
          : "";
        return `<th data-columna="${key}" class="${col.thClass}${claseExtra}"${dataOrden}>${col.th}${icono}</th>`;
      }).join("");
    }

    // Devuelve [trDatos, trHistorial] para cada factura
    construirFilas(r) {
      const cols  = window.estadoApp.columnasActivas || COLUMNAS_DEFECTO;
      const trD   = document.createElement("tr");
      trD.dataset.facturaId = r.id;
      cols.forEach(key => {
        const col = COLUMNAS[key];
        trD.appendChild(col ? col.render(r) : document.createElement("td"));
      });

      const trH   = document.createElement("tr");
      trH.className         = "historial-row";
      trH.dataset.forFactura = r.id;
      trH.hidden            = true;
      const tdH = document.createElement("td");
      tdH.colSpan = cols.length;
      const div   = document.createElement("div");
      div.className = "historial-comision";
      div.id        = `historial-${r.id}`;
      tdH.appendChild(div);
      trH.appendChild(tdH);

      return [trD, trH];
    }

    renderizar() {
      this.actualizarCabecera();

      const est    = window.estadoApp;
      const cols   = est.columnasActivas || COLUMNAS_DEFECTO;
      const inicio = (est.paginaActual - 1) * est.registrosPorPagina;
      const subset = est.datosVisibles.slice(inicio, inicio + est.registrosPorPagina);

      this.tbody.innerHTML = "";

      if (subset.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = cols.length;
        td.style.cssText = "padding:60px 16px;text-align:center;color:var(--color-texto-suave);";
        td.textContent   = "No se encontraron facturas para este período.";
        tr.appendChild(td);
        this.tbody.appendChild(tr);
        this.actualizarPaginacion();
        return;
      }

      const frag = document.createDocumentFragment();
      subset.forEach(r => this.construirFilas(r).forEach(tr => frag.appendChild(tr)));
      this.tbody.appendChild(frag);

      this.aplicarConfigTabla();
      this.actualizarPaginacion();
    }

    aplicarConfigTabla() {
      const est = window.estadoApp;
      this.tabla.classList.remove("tabla--compacto", "tabla--default", "tabla--comodo", "tabla--zebra");
      this.tabla.classList.add(`tabla--${est.configTabla.altura}`);
      if (est.configTabla.zebra) this.tabla.classList.add("tabla--zebra");
    }

    ordenarPorColumna(columna) {
      const est = window.estadoApp;
      if (!COLUMNAS[columna]?.sort) return;
      est.ordenDireccion = est.ordenColumna === columna && est.ordenDireccion === "asc" ? "desc" : "asc";
      est.ordenColumna   = columna;
      this.aplicarOrden();
    }

    aplicarOrden() {
      const est = window.estadoApp;
      const col = COLUMNAS[est.ordenColumna];
      if (!col?.sort) return;
      const dir = est.ordenDireccion === "asc" ? 1 : -1;
      est.datosVisibles.sort((a, b) => {
        const va = col.sort(a), vb = col.sort(b);
        if (va < vb) return -1 * dir;
        if (va > vb) return  1 * dir;
        return 0;
      });
      est.paginaActual = 1;
      this.renderizar();
    }

    actualizarPaginacion() {
      if (!this.contPag) return;
      const est   = window.estadoApp;
      const total = Math.max(1, Math.ceil(est.datosVisibles.length / est.registrosPorPagina));
      if (est.paginaActual > total) est.paginaActual = total;

      this.contPag.innerHTML = "";
      for (let i = 1; i <= total; i++) {
        const btn = document.createElement("button");
        btn.className   = "pag-num" + (i === est.paginaActual ? " pag-num--activo" : "");
        btn.textContent = i;
        if (i === est.paginaActual) btn.setAttribute("aria-current", "page");
        this.contPag.appendChild(btn);
      }
      const [bAnt, bSig] = document.querySelectorAll(".pag-btn--nav");
      if (bAnt) bAnt.disabled = est.paginaActual <= 1;
      if (bSig) bSig.disabled = est.paginaActual >= total;
    }

    cambiarPagina(p) {
      const est   = window.estadoApp;
      const total = Math.ceil(est.datosVisibles.length / est.registrosPorPagina);
      if (p < 1 || p > total) return;
      est.paginaActual = p;
      this.renderizar();
    }

    escucharEventos() {
      this.tabla.addEventListener("click", e => {
        const th = e.target.closest("th[data-columna]");
        if (th && this.tabla.querySelector("thead")?.contains(th)) {
          this.ordenarPorColumna(th.dataset.columna);
        }
      });

      this.contPag?.addEventListener("click", e => {
        const btn = e.target.closest(".pag-num");
        if (!btn) return;
        const n = parseInt(btn.textContent, 10);
        if (!isNaN(n)) this.cambiarPagina(n);
      });

      const [bAnt, bSig] = document.querySelectorAll(".pag-btn--nav");
      bAnt?.addEventListener("click", () => this.cambiarPagina(window.estadoApp.paginaActual - 1));
      bSig?.addEventListener("click", () => this.cambiarPagina(window.estadoApp.paginaActual + 1));
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (window.estadoApp && !window.estadoApp.columnasActivas) {
      window.estadoApp.columnasActivas = [...COLUMNAS_DEFECTO];
    }
    window.COLUMNAS_COM         = COLUMNAS;
    window.COLUMNAS_DEFECTO_COM = COLUMNAS_DEFECTO;
    window.MAPA_TEXTO_COM       = MAPA_TEXTO;
    window.tablaInstance        = new TablaComisiones();
  });
})();
