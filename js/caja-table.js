/* ============================================================
   CAJA-TABLE.JS
   Tabla de movimientos: render, orden, paginación, click para
   abrir el panel de detalle a la derecha.
   ============================================================ */
(function () {

  class TablaCaja {
    constructor() {
      this.tbody = document.getElementById("tbody-cotizaciones");
      this.tabla = document.getElementById("tabla-cotizaciones");
      this.contPag = document.getElementById("pag-numeros");
      if (!this.tbody || !this.tabla) return;
      this.escucharEventos();
      this.renderizar();
    }

    construirFila(m) {
      const tr = document.createElement("tr");
      tr.dataset.id = m.id;

      // Fecha
      const tdFecha = document.createElement("td");
      tdFecha.textContent = window.fechaCorta(m.fecha);

      // Tipo (badge)
      const tdTipo = document.createElement("td");
      const iconoTipo = m.tipo === "ingreso"
        ? `<svg viewBox="0 0 12 12" width="10" height="10"><path fill="currentColor" d="M6 1 1 6h3v5h4V6h3L6 1Z"/></svg>`
        : `<svg viewBox="0 0 12 12" width="10" height="10"><path fill="currentColor" d="M6 11 1 6h3V1h4v5h3L6 11Z"/></svg>`;
      tdTipo.innerHTML = `
        <span class="tipo-badge tipo-badge--${m.tipo}">
          <span class="tipo-badge__icono">${iconoTipo}</span>
          ${window.etiquetaTipo(m.tipo)}
        </span>`;

      // Categoría
      const tdCat = document.createElement("td");
      tdCat.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px;">${window.iconoCategoria(m.categoria)} ${window.etiquetaCategoria(m.categoria)}</span>`;

      // Descripción
      const tdDesc = document.createElement("td");
      tdDesc.innerHTML = `<div class="celda-titulo"><a href="#" class="celda-titulo__link" title="${m.descripcion}">${m.descripcion}</a></div>`;

      // Responsable
      const tdResp = document.createElement("td");
      tdResp.innerHTML = `
        <div class="celda-avatar">
          <span class="celda-avatar__circulo">${window.obtenerIniciales(m.responsable)}</span>
          <span class="celda-avatar__nombre">${m.responsable}</span>
        </div>`;

      // Valor (color por tipo)
      const tdValor = document.createElement("td");
      tdValor.className = "celda--num";
      const signo = m.tipo === "ingreso" ? "+" : "−";
      tdValor.innerHTML = `<span class="valor-celda valor-celda--${m.tipo}">${signo} ${window.formatearMoneda(m.valor, m.moneda)}</span>`;

      // Estado
      const tdEstado = document.createElement("td");
      tdEstado.innerHTML = `
        <span class="estado-badge">
          <span class="estado-dot estado-dot--${m.estado}"></span>
          ${window.etiquetaEstado(m.estado)}
        </span>`;

      tr.append(tdFecha, tdTipo, tdCat, tdDesc, tdResp, tdValor, tdEstado);
      return tr;
    }

    renderizar() {
      const est = window.estadoApp;
      const inicio = (est.paginaActual - 1) * est.registrosPorPagina;
      const fin = inicio + est.registrosPorPagina;
      const subset = est.datosVisibles.slice(inicio, fin);

      this.tbody.innerHTML = "";

      if (subset.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 7;
        td.style.cssText = "padding:60px 16px;text-align:center;color:var(--color-texto-suave);";
        td.textContent = "No se encontraron movimientos.";
        tr.appendChild(td);
        this.tbody.appendChild(tr);

        this.actualizarPaginacion();
        return;
      }

      const frag = document.createDocumentFragment();
      subset.forEach(m => frag.appendChild(this.construirFila(m)));
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
        est.ordenColumna = columna;
        est.ordenDireccion = "asc";
      }

      const extractor = {
        fecha: it => new Date(it.fecha).getTime(),
        tipo: it => it.tipo,
        categoria: it => it.categoria,
        descripcion: it => it.descripcion.toLowerCase(),
        responsable: it => it.responsable.toLowerCase(),
        valor: it => it.valor,
        estado: it => it.estado
      };
      const fn = extractor[columna];
      if (!fn) return;

      const dir = est.ordenDireccion === "asc" ? 1 : -1;
      est.datosVisibles.sort((a, b) => {
        const va = fn(a), vb = fn(b);
        if (va < vb) return -1 * dir;
        if (va > vb) return 1 * dir;
        return 0;
      });

      // UI de headers
      this.tabla.querySelectorAll("th[data-columna]").forEach(th => {
        th.removeAttribute("data-orden");
        const ico = th.querySelector(".th__icono-orden");
        if (ico && th.dataset.columna !== columna) ico.remove();
      });
      const thA = this.tabla.querySelector(`th[data-columna="${columna}"]`);
      if (thA) {
        thA.dataset.orden = est.ordenDireccion;
        if (!thA.querySelector(".th__icono-orden")) {
          const ico = document.createElement("span");
          ico.className = "th__icono-orden";
          ico.innerHTML = `<svg viewBox="0 0 24 24" width="10" height="10"><path fill="none" stroke="currentColor" stroke-width="2" d="M12 4v15M6 14l6 6 6-6"/></svg>`;
          thA.appendChild(ico);
        }
      }
      est.paginaActual = 1;
      this.renderizar();
    }

    actualizarPaginacion() {
      if (!this.contPag) return;

      const est = window.estadoApp;
      const total = Math.max(1, Math.ceil(est.datosVisibles.length / est.registrosPorPagina));

      if (est.paginaActual > total) {
        est.paginaActual = total;
      }

      this.contPag.innerHTML = "";

      for (let i = 1; i <= total; i++) {
        const btn = document.createElement("button");
        btn.className = "pag-num";
        if (i === est.paginaActual) {
          btn.classList.add("pag-num--activo");
          btn.setAttribute("aria-current", "page");
        }
        btn.textContent = i;
        this.contPag.appendChild(btn);
      }

      const [bAnt, bSig] = document.querySelectorAll(".pag-btn--nav");
      if (bAnt) bAnt.disabled = est.paginaActual <= 1;
      if (bSig) bSig.disabled = est.paginaActual >= total;
    }

    cambiarPagina(p) {
      const est = window.estadoApp;
      const total = Math.ceil(est.datosVisibles.length / est.registrosPorPagina);
      if (p < 1 || p > total) return;
      est.paginaActual = p;
      this.renderizar();
    }

    escucharEventos() {
      // Orden por header
      this.tabla.querySelectorAll("th[data-columna]").forEach(th => {
        th.addEventListener("click", () => this.ordenarPorColumna(th.dataset.columna));
      });

      // Paginación
      if (this.contPag) {
        this.contPag.addEventListener("click", (e) => {
          const btn = e.target.closest(".pag-num");
          if (!btn) return;
          const n = parseInt(btn.textContent, 10);
          if (!isNaN(n)) this.cambiarPagina(n);
        });
      }
      const [bAnt, bSig] = document.querySelectorAll(".pag-btn--nav");
      if (bAnt) bAnt.addEventListener("click", () => this.cambiarPagina(window.estadoApp.paginaActual - 1));
      if (bSig) bSig.addEventListener("click", () => this.cambiarPagina(window.estadoApp.paginaActual + 1));

    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    window.tablaInstance = new TablaCaja();
  });
})();
