/* ============================================================
   CAJA-TABLE.JS
   Tabla de movimientos: render, orden y paginación dinámicos.
   Las columnas se generan desde estadoApp.columnasActivas.
   ============================================================ */
(function () {

  /* ---- Catálogo de columnas ---- */
  const COLUMNAS = {
    fecha: {
      th: "FECHA", thClass: "th",
      render(m) {
        const td = document.createElement("td");
        td.textContent = window.fechaCorta(m.fecha);
        return td;
      }
    },
    tipo: {
      th: "TIPO", thClass: "th",
      render(m) {
        const td = document.createElement("td");
        const ico = m.tipo === "ingreso"
          ? `<svg viewBox="0 0 12 12" width="10" height="10"><path fill="currentColor" d="M6 1 1 6h3v5h4V6h3L6 1Z"/></svg>`
          : `<svg viewBox="0 0 12 12" width="10" height="10"><path fill="currentColor" d="M6 11 1 6h3V1h4v5h3L6 11Z"/></svg>`;
        td.innerHTML = `<span class="tipo-badge tipo-badge--${m.tipo}"><span class="tipo-badge__icono">${ico}</span>${window.etiquetaTipo(m.tipo)}</span>`;
        return td;
      }
    },
    categoria: {
      th: "CATEGORÍA", thClass: "th",
      render(m) {
        const td = document.createElement("td");
        td.innerHTML = `<span>${window.etiquetaCategoria(m.categoria)}</span>`;
        return td;
      }
    },
    descripcion: {
      th: "DESCRIPCIÓN", thClass: "th",
      render(m) {
        const td = document.createElement("td");
        td.innerHTML = `<div class="celda-titulo"><a href="#" class="celda-titulo__link" title="${m.descripcion}">${m.descripcion}</a></div>`;
        return td;
      }
    },
    responsable: {
      th: "RESPONSABLE", thClass: "th",
      render(m) {
        const td = document.createElement("td");
        td.innerHTML = `<div class="celda-avatar"><span class="celda-avatar__circulo">${window.obtenerIniciales(m.responsable || "?")}</span><span class="celda-avatar__nombre">${m.responsable || "—"}</span></div>`;
        return td;
      }
    },
    valor: {
      th: "VALOR", thClass: "th th--num",
      render(m) {
        const td = document.createElement("td");
        td.className = "celda--num";
        const signo = m.tipo === "ingreso" ? "+" : "−";
        td.innerHTML = `<span class="valor-celda valor-celda--${m.tipo}">${signo} ${window.formatearMoneda(m.valor, m.moneda)}</span>`;
        return td;
      }
    },
    estado: {
      th: "ESTADO", thClass: "th",
      render(m) {
        const td = document.createElement("td");
        td.innerHTML = `<span class="estado-badge"><span class="estado-dot estado-dot--${m.estado}"></span>${window.etiquetaEstado(m.estado)}</span>`;
        return td;
      }
    },
    metodoPago: {
      th: "MÉTODO DE PAGO", thClass: "th",
      render(m) {
        const td = document.createElement("td");
        td.textContent = window.etiquetaMetodoPago(m.metodoPago) || "—";
        return td;
      }
    },
    referencia: {
      th: "REFERENCIA", thClass: "th",
      render(m) {
        const td = document.createElement("td");
        td.textContent = m.referencia || "—";
        return td;
      }
    },
    cliente: {
      th: "CLIENTE", thClass: "th",
      render(m) {
        const td = document.createElement("td");
        td.textContent = m.cliente || "—";
        return td;
      }
    },
    observaciones: {
      th: "OBSERVACIONES", thClass: "th",
      render(m) {
        const td = document.createElement("td");
        td.textContent = m.observaciones || "—";
        return td;
      }
    },
    puntoVenta: {
      th: "PUNTO DE VENTA", thClass: "th",
      render(m) {
        const td = document.createElement("td");
        td.textContent = m.puntoVenta || "—";
        return td;
      }
    }
  };

  const MAPA_TEXTO = {
    fecha: "Fecha", tipo: "Tipo", categoria: "Categoría",
    descripcion: "Descripción", responsable: "Responsable",
    valor: "Valor", estado: "Estado",
    metodoPago: "Método de pago", referencia: "Referencia",
    cliente: "Cliente relacionado", observaciones: "Observaciones",
    puntoVenta: "Punto de Venta"
  };

  const COLUMNAS_DEFECTO = ["fecha", "tipo", "categoria", "descripcion", "responsable", "valor", "estado"];

  /* ---- Clase principal ---- */
  class TablaCaja {
    constructor() {
      this.tbody = document.getElementById("tbody-cotizaciones");
      this.tabla = document.getElementById("tabla-cotizaciones");
      this.contPag = document.getElementById("pag-numeros");
      if (!this.tbody || !this.tabla) return;
      this.escucharEventos();
      this.renderizar();
    }

    actualizarCabecera() {
      const theadRow = this.tabla.querySelector("thead tr");
      if (!theadRow) return;
      const est = window.estadoApp;
      const cols = est.columnasActivas || COLUMNAS_DEFECTO;

      theadRow.innerHTML = cols.map(key => {
        const col = COLUMNAS[key];
        if (!col) return `<th class="th">${key}</th>`;
        const esOrden = est.ordenColumna === key;
        const claseExtra = esOrden ? " th--orden" : "";
        const dataOrden = esOrden ? ` data-orden="${est.ordenDireccion}"` : "";
        const iconoOrden = esOrden
          ? `<span class="th__icono-orden"><svg viewBox="0 0 24 24" width="10" height="10"><path fill="none" stroke="currentColor" stroke-width="2" d="M12 4v15M6 14l6 6 6-6"/></svg></span>`
          : "";
        return `<th data-columna="${key}" class="${col.thClass}${claseExtra}"${dataOrden}>${col.th}${iconoOrden}</th>`;
      }).join("");
    }

    construirFila(m) {
      const tr = document.createElement("tr");
      tr.dataset.id = m.id;
      const cols = window.estadoApp.columnasActivas || COLUMNAS_DEFECTO;
      cols.forEach(key => {
        const col = COLUMNAS[key];
        tr.appendChild(col ? col.render(m) : document.createElement("td"));
      });
      return tr;
    }

    renderizar() {
      this.actualizarCabecera();

      const est = window.estadoApp;
      const cols = est.columnasActivas || COLUMNAS_DEFECTO;
      const inicio = (est.paginaActual - 1) * est.registrosPorPagina;
      const subset = est.datosVisibles.slice(inicio, inicio + est.registrosPorPagina);

      this.tbody.innerHTML = "";

      if (subset.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = cols.length;
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
      this.aplicarOrden();
    }

    /** Ordena datosVisibles usando el estado actual (sin toglear dirección). */
    aplicarOrden() {
      const est = window.estadoApp;
      const extractor = {
        fecha: it => new Date(it.fecha).getTime(),
        tipo: it => it.tipo,
        categoria: it => it.categoria,
        descripcion: it => it.descripcion.toLowerCase(),
        responsable: it => (it.responsable || "").toLowerCase(),
        valor: it => it.valor,
        estado: it => it.estado,
        metodoPago: it => (it.metodoPago || ""),
        referencia: it => (it.referencia || "").toLowerCase(),
        cliente: it => (it.cliente || "").toLowerCase(),
        observaciones: it => (it.observaciones || "").toLowerCase(),
        puntoVenta: it => (it.puntoVenta || "").toLowerCase()
      };
      const fn = extractor[est.ordenColumna];
      if (!fn) return;
      const dir = est.ordenDireccion === "asc" ? 1 : -1;
      est.datosVisibles.sort((a, b) => {
        const va = fn(a), vb = fn(b);
        if (va < vb) return -1 * dir;
        if (va > vb) return 1 * dir;
        return 0;
      });

      est.paginaActual = 1;
      this.renderizar();
    }

    actualizarPaginacion() {
      if (!this.contPag) return;
      const est = window.estadoApp;
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
      const est = window.estadoApp;
      const total = Math.ceil(est.datosVisibles.length / est.registrosPorPagina);
      if (p < 1 || p > total) return;
      est.paginaActual = p;
      this.renderizar();
    }

    escucharEventos() {
      // Orden por header — delegación para que sobreviva reconstrucciones del thead
      this.tabla.addEventListener("click", e => {
        const th = e.target.closest("th[data-columna]");
        if (th && this.tabla.querySelector("thead")?.contains(th)) {
          this.ordenarPorColumna(th.dataset.columna);
        }
      });

      // Paginación
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
    window.COLUMNAS_CAJA = COLUMNAS;
    window.COLUMNAS_DEFECTO_CAJA = COLUMNAS_DEFECTO;
    window.MAPA_TEXTO_CAJA = MAPA_TEXTO;
    window.tablaInstance = new TablaCaja();
  });
})();
