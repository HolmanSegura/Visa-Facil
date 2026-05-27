/* ============================================================
   TABLE.JS
   Renderizado, ordenamiento y paginación de la tabla de
   cotizaciones. Las columnas se generan dinámicamente a
   partir de estadoApp.columnasActivas.
   ============================================================ */

(function () {

  /* ---------- CATÁLOGO DE COLUMNAS ---------- */
  const COLUMNAS_CATALOGO = {
    titulo: {
      th: "TÍTULO",
      thClass: "th",
      renderCell(item) {
        const td = document.createElement("td");
        td.innerHTML = `<div class="celda-titulo"><a href="#" class="celda-titulo__link" title="${item.titulo}">${item.titulo}</a></div>`;
        return td;
      }
    },
    estado: {
      th: "ESTADO",
      thClass: "th",
      renderCell(item) {
        const td = document.createElement("td");
        td.innerHTML = `<span class="estado-badge"><span class="estado-dot estado-dot--${item.estado}"></span>${window.etiquetaEstado(item.estado)}</span>`;
        return td;
      }
    },
    cantidad: {
      th: "CANTIDAD",
      thClass: "th th--num",
      renderCell(item) {
        const td = document.createElement("td");
        td.className = "celda--num";
        td.textContent = window.formatearMoneda(item.cantidad, item.moneda);
        return td;
      }
    },
    firma: {
      th: "ESTADO DE LA FIRMA",
      thClass: "th",
      renderCell(item) {
        const td = document.createElement("td");
        td.textContent = window.etiquetaFirma(item.estadoFirma);
        return td;
      }
    },
    propietario: {
      th: "PROPIETARIO",
      thClass: "th",
      renderCell(item) {
        const td = document.createElement("td");
        td.innerHTML = `<div class="celda-avatar"><span class="celda-avatar__circulo">${window.obtenerIniciales(item.responsable)}</span><span class="celda-avatar__nombre">${item.responsable}</span></div>`;
        return td;
      }
    },
    creacion: {
      th: "FECHA DE CREACIÓN",
      thClass: "th",
      renderCell(item) {
        const td = document.createElement("td");
        td.textContent = window.formatearFecha(item.fechaCreacion);
        return td;
      }
    },
    vencimiento: {
      th: "FECHA DE VENCIMIENTO",
      thClass: "th",
      renderCell(item) {
        const td = document.createElement("td");
        td.textContent = window.formatearFecha(item.fechaVencimiento);
        return td;
      }
    },
    negocio: {
      th: "NOMBRE DEL NEGOCIO",
      thClass: "th",
      renderCell(item) {
        const td = document.createElement("td");
        td.textContent = item.negocio || "—";
        return td;
      }
    }
  };

  // Mapeo texto del modal → clave interna
  const TEXTO_A_COLUMNA = {
    "Título": "titulo",
    "Estado": "estado",
    "Cantidad": "cantidad",
    "Estado de la firma": "firma",
    "Propietario": "propietario",
    "Fecha de creación": "creacion",
    "Fecha de vencimiento": "vencimiento",
    "Nombre del negocio": "negocio"
  };

  const COLUMNA_A_TEXTO = Object.fromEntries(
    Object.entries(TEXTO_A_COLUMNA).map(([k, v]) => [v, k])
  );

  const COLUMNAS_DEFECTO = [
    "titulo", "estado", "cantidad", "firma",
    "propietario", "creacion", "vencimiento", "negocio"
  ];

  /* ---------- CLASE TABLA ---------- */
  class TablaCotizaciones {
    constructor() {
      this.tbody = document.getElementById("tbody-cotizaciones");
      this.tabla = document.getElementById("tabla-cotizaciones");
      this.contenedorPag = document.getElementById("pag-numeros");

      if (!this.tbody || !this.tabla) {
        console.warn("[Tabla] No se encontró la tabla.");
        return;
      }

      this.escucharEventos();
      this.renderizar();
    }

    /** Reconstruye la fila <tr> del header según columnas activas. */
    actualizarCabecera() {
      const theadRow = this.tabla.querySelector("thead tr");
      if (!theadRow) return;
      const est = window.estadoApp;
      const cols = est.columnasActivas || COLUMNAS_DEFECTO;

      theadRow.innerHTML = cols.map(key => {
        const col = COLUMNAS_CATALOGO[key];
        if (!col) return `<th class="th">${key}</th>`;
        const esOrden = est.ordenColumna === key;
        const claseExtra = esOrden ? " th--orden" : "";
        const iconoOrden = esOrden
          ? `<span class="th__icono-orden"><svg viewBox="0 0 24 24" width="10" height="10"><path fill="none" stroke="currentColor" stroke-width="2" d="M12 4v15M6 14l6 6 6-6"/></svg></span>`
          : "";
        const dataOrden = esOrden ? ` data-orden="${est.ordenDireccion}"` : "";
        return `<th data-columna="${key}" class="${col.thClass}${claseExtra}"${dataOrden}>${col.th}${iconoOrden}</th>`;
      }).join("");
    }

    /** Construye una fila <tr> a partir de un objeto de cotización. */
    construirFila(item) {
      const tr = document.createElement("tr");
      tr.dataset.id = item.id;
      const cols = window.estadoApp.columnasActivas || COLUMNAS_DEFECTO;
      cols.forEach(key => {
        const col = COLUMNAS_CATALOGO[key];
        tr.appendChild(col ? col.renderCell(item) : document.createElement("td"));
      });
      return tr;
    }

    /** Renderiza la tabla completa según el estado actual. */
    renderizar() {
      this.actualizarCabecera();

      const est = window.estadoApp;
      const cols = est.columnasActivas || COLUMNAS_DEFECTO;
      const inicio = (est.paginaActual - 1) * est.registrosPorPagina;
      const fin = inicio + est.registrosPorPagina;
      const subset = est.datosVisibles.slice(inicio, fin);

      this.tbody.innerHTML = "";

      if (subset.length === 0) {
        const trVacio = document.createElement("tr");
        const tdVacio = document.createElement("td");
        tdVacio.colSpan = cols.length;
        tdVacio.style.padding = "60px 16px";
        tdVacio.style.textAlign = "center";
        tdVacio.style.color = "var(--color-texto-suave)";
        tdVacio.textContent = "No se encontraron resultados.";
        trVacio.appendChild(tdVacio);
        this.tbody.appendChild(trVacio);
        this.actualizarPaginacion();
        return;
      }

      const fragmento = document.createDocumentFragment();
      subset.forEach(item => fragmento.appendChild(this.construirFila(item)));
      this.tbody.appendChild(fragmento);

      this.aplicarConfigTabla();
      this.actualizarPaginacion();
    }

    /** Reordena los datos visibles por columna y dirección. */
    ordenarPorColumna(columna) {
      const est = window.estadoApp;
      if (est.ordenColumna === columna) {
        est.ordenDireccion = est.ordenDireccion === "asc" ? "desc" : "asc";
      } else {
        est.ordenColumna = columna;
        est.ordenDireccion = "asc";
      }

      const extractor = {
        titulo:      it => it.titulo.toLowerCase(),
        estado:      it => it.estado,
        cantidad:    it => it.cantidad,
        firma:       it => it.estadoFirma,
        propietario: it => it.responsable.toLowerCase(),
        creacion:    it => new Date(it.fechaCreacion).getTime(),
        vencimiento: it => new Date(it.fechaVencimiento).getTime(),
        negocio:     it => (it.negocio || "").toLowerCase()
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

      est.paginaActual = 1;
      this.renderizar();
    }

    /** Actualiza el indicador visual de paginación. */
    actualizarPaginacion() {
      if (!this.contenedorPag) return;

      const est = window.estadoApp;
      const total = Math.max(1, Math.ceil(est.datosVisibles.length / est.registrosPorPagina));

      this.contenedorPag.innerHTML = "";

      for (let i = 1; i <= total; i++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "pag-num" + (i === est.paginaActual ? " pag-num--activo" : "");
        btn.textContent = i;
        if (i === est.paginaActual) btn.setAttribute("aria-current", "page");
        this.contenedorPag.appendChild(btn);
      }

      const [btnAnterior, btnSiguiente] = document.querySelectorAll(".pag-btn--nav");
      if (btnAnterior) btnAnterior.disabled = est.paginaActual <= 1;
      if (btnSiguiente) btnSiguiente.disabled = est.paginaActual >= total;

      const lblTamano = document.getElementById("lbl-tamano");
      if (lblTamano) lblTamano.textContent = `${est.registrosPorPagina} por página`;
    }

    /** Cambia la página actual y re-renderiza. */
    cambiarPagina(nuevaPagina) {
      const est = window.estadoApp;
      const total = Math.max(1, Math.ceil(est.datosVisibles.length / est.registrosPorPagina));
      if (nuevaPagina < 1 || nuevaPagina > total) return;
      est.paginaActual = nuevaPagina;
      this.renderizar();
      const wrapper = document.querySelector(".tabla-wrapper");
      if (wrapper) wrapper.scrollTop = 0;
    }

    /** Cablea todos los handlers de eventos. */
    escucharEventos() {
      // Delegación en la tabla para ordenar por columna
      this.tabla.addEventListener("click", (e) => {
        const th = e.target.closest("th[data-columna]");
        if (th && this.tabla.querySelector("thead")?.contains(th)) {
          this.ordenarPorColumna(th.dataset.columna);
        }
      });

      // Paginación por número
      if (this.contenedorPag) {
        this.contenedorPag.addEventListener("click", (e) => {
          const btn = e.target.closest(".pag-num");
          if (!btn) return;
          const numero = parseInt(btn.textContent, 10);
          if (!isNaN(numero)) this.cambiarPagina(numero);
        });
      }

      // Anterior / Siguiente
      const [btnAnterior, btnSiguiente] = document.querySelectorAll(".pag-btn--nav");
      if (btnAnterior) {
        btnAnterior.addEventListener("click", () =>
          this.cambiarPagina(window.estadoApp.paginaActual - 1)
        );
      }
      if (btnSiguiente) {
        btnSiguiente.addEventListener("click", () =>
          this.cambiarPagina(window.estadoApp.paginaActual + 1)
        );
      }

      const btnCrear = document.getElementById("btn-crear-cotizacion");
      if (btnCrear) {
        btnCrear.disabled = false;
        btnCrear.removeAttribute("aria-disabled");
      }
    }

    /** Aplica clases de configuración de tabla (altura, zebra). */
    aplicarConfigTabla() {
      const est = window.estadoApp;
      if (!this.tabla) return;
      this.tabla.classList.remove("tabla--compacto", "tabla--default", "tabla--comodo", "tabla--zebra");
      this.tabla.classList.add(`tabla--${est.configTabla.altura}`);
      if (est.configTabla.zebra) this.tabla.classList.add("tabla--zebra");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    // Inicializar columnas activas en el estado si no existe
    if (window.estadoApp && !window.estadoApp.columnasActivas) {
      window.estadoApp.columnasActivas = [...COLUMNAS_DEFECTO];
    }

    // Exponer globalmente para uso en ui-interactions.js
    window.COLUMNAS_CATALOGO  = COLUMNAS_CATALOGO;
    window.TEXTO_A_COLUMNA   = TEXTO_A_COLUMNA;
    window.COLUMNA_A_TEXTO   = COLUMNA_A_TEXTO;
    window.COLUMNAS_DEFECTO  = COLUMNAS_DEFECTO;

    window.tablaInstance = new TablaCotizaciones();
  });
})();
