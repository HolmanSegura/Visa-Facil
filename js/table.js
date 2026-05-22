/* ============================================================
   TABLE.JS
   Renderizado, ordenamiento y paginación de la tabla de
   cotizaciones.
   ============================================================ */

(function () {

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

    /** Construye una fila HTML a partir de un objeto de cotización. */
    construirFila(item) {
      const tr = document.createElement("tr");
      tr.dataset.id = item.id;

      // --- Columna: Título (link) ---
      const tdTitulo = document.createElement("td");
      tdTitulo.innerHTML = `
        <div class="celda-titulo">
          <a href="#" class="celda-titulo__link" title="${item.titulo}">${item.titulo}</a>
        </div>`;

      // --- Columna: Estado (badge con dot) ---
      const tdEstado = document.createElement("td");
      tdEstado.innerHTML = `
        <span class="estado-badge">
          <span class="estado-dot estado-dot--${item.estado}"></span>
          ${window.etiquetaEstado(item.estado)}
        </span>`;

      // --- Columna: Cantidad ---
      const tdCantidad = document.createElement("td");
      tdCantidad.className = "celda--num";
      tdCantidad.textContent = window.formatearMoneda(item.cantidad, item.moneda);

      // --- Columna: Estado de la firma ---
      const tdFirma = document.createElement("td");
      tdFirma.textContent = window.etiquetaFirma(item.estadoFirma);

      // --- Columna: Propietario (avatar + nombre) ---
      const tdResp = document.createElement("td");
      tdResp.innerHTML = `
        <div class="celda-avatar">
          <span class="celda-avatar__circulo">${window.obtenerIniciales(item.responsable)}</span>
          <span class="celda-avatar__nombre">${item.responsable}</span>
        </div>`;

      // --- Columna: Fecha de creación ---
      const tdCreado = document.createElement("td");
      tdCreado.textContent = window.formatearFecha(item.fechaCreacion);

      // --- Columna: Fecha de vencimiento ---
      const tdVence = document.createElement("td");
      tdVence.textContent = window.formatearFecha(item.fechaVencimiento);

      // --- Columna: Nombre del negocio ---
      const tdNegocio = document.createElement("td");
      tdNegocio.textContent = item.negocio;

      tr.append(tdTitulo, tdEstado, tdCantidad, tdFirma, tdResp, tdCreado, tdVence, tdNegocio);
      return tr;
    }

    /** Renderiza la tabla completa según el estado actual. */
    renderizar() {
      const est = window.estadoApp;
      const inicio = (est.paginaActual - 1) * est.registrosPorPagina;
      const fin = inicio + est.registrosPorPagina;
      const subset = est.datosVisibles.slice(inicio, fin);

      this.tbody.innerHTML = "";

      if (subset.length === 0) {
        const trVacio = document.createElement("tr");
        const tdVacio = document.createElement("td");
        tdVacio.colSpan = 8;
        tdVacio.style.padding = "60px 16px";
        tdVacio.style.textAlign = "center";
        tdVacio.style.color = "var(--color-texto-suave)";
        tdVacio.textContent = "No se encontraron resultados.";
        trVacio.appendChild(tdVacio);
        this.tbody.appendChild(trVacio);
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

      // Alternar dirección si es la misma columna
      if (est.ordenColumna === columna) {
        est.ordenDireccion = est.ordenDireccion === "asc" ? "desc" : "asc";
      } else {
        est.ordenColumna = columna;
        est.ordenDireccion = "asc";
      }

      // Mapa: columna -> función de extracción del valor a comparar
      const extractor = {
        titulo: it => it.titulo.toLowerCase(),
        estado: it => it.estado,
        cantidad: it => it.cantidad,
        firma: it => it.estadoFirma,
        propietario: it => it.responsable.toLowerCase(),
        creacion: it => new Date(it.fechaCreacion).getTime(),
        vencimiento: it => new Date(it.fechaVencimiento).getTime(),
        negocio: it => (it.negocio || "").toLowerCase()
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

      // Actualizar UI de los encabezados
      this.tabla.querySelectorAll("th[data-columna]").forEach(th => {
        th.removeAttribute("data-orden");
        const iconoExistente = th.querySelector(".th__icono-orden");
        if (iconoExistente && th.dataset.columna !== columna) {
          iconoExistente.remove();
        }
      });

      const thActivo = this.tabla.querySelector(`th[data-columna="${columna}"]`);
      if (thActivo) {
        thActivo.dataset.orden = est.ordenDireccion;
        if (!thActivo.querySelector(".th__icono-orden")) {
          const ico = document.createElement("span");
          ico.className = "th__icono-orden";
          ico.innerHTML = `<svg viewBox="0 0 24 24" width="10" height="10"><path fill="none" stroke="currentColor" stroke-width="2" d="M12 4v15M6 14l6 6 6-6"/></svg>`;
          thActivo.appendChild(ico);
        }
      }

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

        if (i === est.paginaActual) {
          btn.setAttribute("aria-current", "page");
        }

        this.contenedorPag.appendChild(btn);
      }

      const [btnAnterior, btnSiguiente] = document.querySelectorAll(".pag-btn--nav");
      if (btnAnterior) btnAnterior.disabled = est.paginaActual <= 1;
      if (btnSiguiente) btnSiguiente.disabled = est.paginaActual >= total;

      const lblTamano = document.getElementById("lbl-tamano");
      if (lblTamano) {
        lblTamano.textContent = `${est.registrosPorPagina} por página`;
      }
    }

    /** Cambia la página actual y rerrenderiza. */
    cambiarPagina(nuevaPagina) {
      const est = window.estadoApp;
      const total = Math.max(1, Math.ceil(est.datosVisibles.length / est.registrosPorPagina));
      if (nuevaPagina < 1 || nuevaPagina > total) return;
      est.paginaActual = nuevaPagina;
      this.renderizar();

      // Scroll al inicio de la tabla
      const wrapper = document.querySelector(".tabla-wrapper");
      if (wrapper) wrapper.scrollTop = 0;
    }

    /** Cablea todos los handlers de eventos. */
    escucharEventos() {

      // Click en headers para ordenar
      this.tabla.querySelectorAll("th[data-columna]").forEach(th => {
        th.addEventListener("click", () => {
          this.ordenarPorColumna(th.dataset.columna);
        });
      });

      // Click en números de paginación
      if (this.contenedorPag) {
        this.contenedorPag.addEventListener("click", (e) => {
          const btn = e.target.closest(".pag-num");
          if (!btn) return;
          const numero = parseInt(btn.textContent, 10);
          if (!isNaN(numero)) this.cambiarPagina(numero);
        });
      }

      // Click en botones Anterior / Siguiente
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

      // El botón "Crear cotización" se conecta en ui-interactions.js (abre modal)
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

      // Remover clases previas
      this.tabla.classList.remove("tabla--compacto", "tabla--default", "tabla--comodo", "tabla--zebra");

      this.tabla.classList.add(`tabla--${est.configTabla.altura}`);
      if (est.configTabla.zebra) this.tabla.classList.add("tabla--zebra");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    window.tablaInstance = new TablaCotizaciones();
  });
})();
