/* ============================================================
   FILTERS.JS
   Aplicación combinada de: vista activa + filtros pill +
   búsqueda. Único punto de orquestación del dataset visible.
   ============================================================ */

(function () {

  function debounce(fn, wait = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  class Filtros {
    constructor() {
      this.inputBusqueda = document.getElementById("input-buscar-tabla");
      this.escucharEventos();
    }

    /**
     * Punto único de actualización del dataset visible.
     * Se aplica:
     *   1. Filtro de vista activa (tab)
     *   2. Búsqueda de texto
     *   3. Filtros pill (estado, actividad, propietario, firma)
     */
    aplicarFiltros() {
      const est = window.estadoApp;
      const vistaActiva = est.vistas.find(v => v.id === est.vistaActivaId) || est.vistas[0];
      let resultado = est.datosOriginales.filter(vistaActiva.filtro);

      // Búsqueda por texto
      if (est.busquedaActual.trim()) {
        const q = est.busquedaActual.trim().toLowerCase();
        resultado = resultado.filter(item =>
          item.titulo.toLowerCase().includes(q) ||
          (item.cliente || "").toLowerCase().includes(q) ||
          item.responsable.toLowerCase().includes(q) ||
          (item.negocio || "").toLowerCase().includes(q)
        );
      }

      // Filtro: estado (multi-select)
      if (est.filtros.estado && est.filtros.estado.length > 0) {
        resultado = resultado.filter(it => est.filtros.estado.includes(it.estado));
      }

      // Filtro: actividad (últimos N días desde fecha creación)
      if (est.filtros.actividad) {
        const hoy = new Date("2026-05-20");
        const valor = est.filtros.actividad;
        const dias = valor === "hoy" ? 0 : parseInt(valor, 10);
        resultado = resultado.filter(it => {
          const fc = new Date(it.fechaCreacion);
          const diff = (hoy - fc) / 86400000;
          return diff >= 0 && diff <= (dias === 0 ? 1 : dias);
        });
      }

      // Filtro: propietario
      if (est.filtros.propietario && est.filtros.propietario.length > 0) {
        resultado = resultado.filter(it => est.filtros.propietario.includes(it.responsable));
      }

      // Filtro: firma
      if (est.filtros.firma && est.filtros.firma.length > 0) {
        resultado = resultado.filter(it => est.filtros.firma.includes(it.estadoFirma));
      }

      est.datosVisibles = resultado;
      est.paginaActual = 1;

      if (window.tablaInstance) window.tablaInstance.renderizar();
      this.actualizarPillsUI();
    }

    /** Actualiza el estado visual de los pills (activos, contadores). */
    actualizarPillsUI() {
      const est = window.estadoApp;
      document.querySelectorAll(".filtro-pill").forEach(pill => {
        const tipo = pill.dataset.filtro;
        let count = 0;
        if (tipo === "estado")      count = est.filtros.estado.length;
        if (tipo === "propietario") count = est.filtros.propietario.length;
        if (tipo === "firma")       count = est.filtros.firma.length;
        if (tipo === "actividad")   count = est.filtros.actividad ? 1 : 0;

        const tieneValor = count > 0;
        pill.classList.toggle("tiene-valor", tieneValor);

        // Limpiar contadores previos
        const contadorPrevio = pill.querySelector(".filtro-pill__contador");
        if (contadorPrevio) contadorPrevio.remove();

        if (tieneValor) {
          const cont = document.createElement("span");
          cont.className = "filtro-pill__contador";
          cont.textContent = count;
          // Insertar antes del caret SVG
          const caret = pill.querySelector("svg");
          pill.insertBefore(cont, caret);
        }
      });
    }

    buscar(texto) {
      window.estadoApp.busquedaActual = texto;
      this.aplicarFiltros();
    }

    limpiarFiltros() {
      const est = window.estadoApp;
      est.busquedaActual = "";
      est.filtros.estado = [];
      est.filtros.actividad = null;
      est.filtros.propietario = [];
      est.filtros.firma = [];
      if (this.inputBusqueda) this.inputBusqueda.value = "";
      this.aplicarFiltros();
    }

    escucharEventos() {
      if (this.inputBusqueda) {
        const buscarDebounced = debounce((valor) => this.buscar(valor), 300);
        this.inputBusqueda.addEventListener("input", (e) => buscarDebounced(e.target.value));
        this.inputBusqueda.addEventListener("keydown", (e) => {
          if (e.key === "Escape") {
            e.target.value = "";
            this.buscar("");
          }
        });
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    window.filtrosInstance = new Filtros();
  });
})();
