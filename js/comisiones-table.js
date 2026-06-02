/* ============================================================
   COMISIONES-TABLE.JS
   Tabla de comisiones: render, orden y paginación.
   Columnas: responsable, ingresos, porcentaje, teorico,
             registrado, pagos, diferencia, estado.
   ============================================================ */
(function () {

  const COLUMNAS = {
    responsable: {
      th: "ASESOR", thClass: "th",
      render(r) {
        const td = document.createElement("td");
        const badge = r.activo === false
          ? `<span class="badge-inactivo" style="margin-left:6px">Inactivo</span>`
          : "";
        td.innerHTML = `<div class="celda-avatar">
          <span class="celda-avatar__circulo">${window.obtenerIniciales(r.responsable || "?")}</span>
          <span class="celda-avatar__nombre">${r.responsable || "—"}${badge}</span>
        </div>`;
        return td;
      }
    },
    ingresos: {
      th: "INGRESOS BASE", thClass: "th th--num",
      render(r) {
        const td = document.createElement("td");
        td.className = "celda--num";
        td.innerHTML = `<span class="valor-celda">${window.formatearMoneda(r.ingresos, "COP")}</span>`;
        return td;
      }
    },
    porcentaje: {
      th: "% COM.", thClass: "th th--num",
      render(r) {
        const td = document.createElement("td");
        td.className = "celda--num";
        td.innerHTML = `<span class="pct-badge">${(r.porcentaje || 0).toFixed(1)}%</span>`;
        return td;
      }
    },
    teorico: {
      th: "COM. TEÓRICA", thClass: "th th--num",
      render(r) {
        const td = document.createElement("td");
        td.className = "celda--num";
        td.innerHTML = `<span class="valor-celda">${window.formatearMoneda(r.teorico, "COP")}</span>`;
        return td;
      }
    },
    registrado: {
      th: "COM. REGISTRADA", thClass: "th th--num",
      render(r) {
        const td = document.createElement("td");
        td.className = "celda--num";
        td.innerHTML = `<span class="valor-celda">${window.formatearMoneda(r.registrado, "COP")}</span>`;
        return td;
      }
    },
    pagos: {
      th: "# PAGOS", thClass: "th th--num",
      render(r) {
        const td = document.createElement("td");
        td.className = "celda--num";
        td.textContent = r.pagos;
        return td;
      }
    },
    diferencia: {
      th: "DIFERENCIA", thClass: "th th--num",
      render(r) {
        const td  = document.createElement("td");
        td.className = "celda--num";
        const cls = r.diferencia > 0 ? "valor-celda--pos"
                  : r.diferencia < 0 ? "valor-celda--neg"
                  : "valor-celda--cero";
        const signo = r.diferencia > 0 ? "+" : "";
        td.innerHTML = `<span class="valor-celda ${cls}">${signo}${window.formatearMoneda(r.diferencia, "COP")}</span>`;
        return td;
      }
    },
    estado: {
      th: "ESTADO", thClass: "th",
      render(r) {
        const td = document.createElement("td");
        td.innerHTML = `<span class="estado-badge"><span class="estado-dot estado-dot--${r.estado}"></span>${window.etiquetaEstado(r.estado)}</span>`;
        return td;
      }
    }
  };

  const MAPA_TEXTO = {
    responsable: "Asesor",
    ingresos:    "Ingresos base",
    porcentaje:  "% Comisión",
    teorico:     "Com. teórica",
    registrado:  "Com. registrada",
    pagos:       "# Pagos",
    diferencia:  "Diferencia",
    estado:      "Estado"
  };

  const COLUMNAS_DEFECTO = ["responsable", "ingresos", "porcentaje", "teorico", "registrado", "pagos", "diferencia", "estado"];

  /* ---- Clase principal ---- */
  class TablaComisiones {
    constructor() {
      this.tbody  = document.getElementById("tbody-comisiones");
      this.tabla  = document.getElementById("tabla-comisiones");
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
        const col       = COLUMNAS[key];
        if (!col) return `<th class="th">${key}</th>`;
        const esOrden   = est.ordenColumna === key;
        const claseExtra = esOrden ? " th--orden" : "";
        const dataOrden  = esOrden ? ` data-orden="${est.ordenDireccion}"` : "";
        const iconoOrden = esOrden
          ? `<span class="th__icono-orden"><svg viewBox="0 0 24 24" width="10" height="10"><path fill="none" stroke="currentColor" stroke-width="2" d="M12 4v15M6 14l6 6 6-6"/></svg></span>`
          : "";
        return `<th data-columna="${key}" class="${col.thClass}${claseExtra}"${dataOrden}>${col.th}${iconoOrden}</th>`;
      }).join("");
    }

    construirFila(r) {
      const tr   = document.createElement("tr");
      tr.dataset.id = r.id;
      const cols = window.estadoApp.columnasActivas || COLUMNAS_DEFECTO;
      cols.forEach(key => {
        const col = COLUMNAS[key];
        tr.appendChild(col ? col.render(r) : document.createElement("td"));
      });
      return tr;
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
        td.textContent   = "No se encontraron registros de comisiones.";
        tr.appendChild(td);
        this.tbody.appendChild(tr);
        this.actualizarPaginacion();
        return;
      }

      const frag = document.createDocumentFragment();
      subset.forEach(r => frag.appendChild(this.construirFila(r)));
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
      if (est.ordenColumna === columna) {
        est.ordenDireccion = est.ordenDireccion === "asc" ? "desc" : "asc";
      } else {
        est.ordenColumna   = columna;
        est.ordenDireccion = "asc";
      }
      this.aplicarOrden();
    }

    aplicarOrden() {
      const est = window.estadoApp;
      const extractor = {
        responsable: it => (it.responsable || "").toLowerCase(),
        ingresos:    it => it.ingresos,
        porcentaje:  it => it.porcentaje,
        teorico:     it => it.teorico,
        registrado:  it => it.registrado,
        pagos:       it => it.pagos,
        diferencia:  it => it.diferencia,
        estado:      it => it.estado
      };
      const fn  = extractor[est.ordenColumna];
      if (!fn) return;
      const dir = est.ordenDireccion === "asc" ? 1 : -1;
      est.datosVisibles.sort((a, b) => {
        const va = fn(a), vb = fn(b);
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
        btn.className = "pag-num" + (i === est.paginaActual ? " pag-num--activo" : "");
        if (i === est.paginaActual) btn.setAttribute("aria-current", "page");
        btn.textContent = i;
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
    window.tablaInstance = new TablaComisiones();
  });
})();
