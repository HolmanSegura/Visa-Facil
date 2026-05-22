/* ============================================================
   CAJA-FILTERS.JS
   Orquestador de filtros del módulo Caja:
   vista + búsqueda + filtros pill (tipo, categoría, fecha,
   responsable, estado).
   ============================================================ */
(function () {

  function debounce(fn, wait = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(null, args), wait); };
  }

  class Filtros {
    constructor() {
      this.inputBusqueda = document.getElementById("input-buscar-tabla");
      this.escucharEventos();
    }

    aplicarFiltros() {
      const est = window.estadoApp;
      const vista = est.vistas.find(v => v.id === est.vistaActivaId) || est.vistas[0];
      let r = est.datosOriginales.filter(vista.filtro);

      // Búsqueda
      if (est.busquedaActual.trim()) {
        const q = est.busquedaActual.trim().toLowerCase();
        r = r.filter(m =>
          m.descripcion.toLowerCase().includes(q) ||
          m.responsable.toLowerCase().includes(q) ||
          (m.referencia || "").toLowerCase().includes(q) ||
          (m.cliente || "").toLowerCase().includes(q)
        );
      }

      // Tipo
      if (est.filtros.tipo.length > 0) {
        r = r.filter(m => est.filtros.tipo.includes(m.tipo));
      }

      // Categoría
      if (est.filtros.categoria.length > 0) {
        r = r.filter(m => est.filtros.categoria.includes(m.categoria));
      }

      // Fecha
      if (est.filtros.fecha) {
        const hoy = new Date("2026-05-20");
        const val = est.filtros.fecha;
        r = r.filter(m => {
          const f = new Date(m.fecha);
          if (val === "hoy")       return f.toDateString() === hoy.toDateString();
          if (val === "semana") {
            const inicioSemana = new Date(hoy);
            inicioSemana.setDate(hoy.getDate() - 7);
            return f >= inicioSemana && f <= hoy;
          }
          if (val === "mes")       return f.getFullYear() === hoy.getFullYear() && f.getMonth() === hoy.getMonth();
          if (val === "trimestre") {
            const ini = new Date(hoy); ini.setMonth(hoy.getMonth() - 3);
            return f >= ini && f <= hoy;
          }
          return true;
        });
      }

      // Asesor / Responsable
      if (est.filtros.asesor.length > 0) {
        r = r.filter(m => est.filtros.asesor.includes(m.responsable));
      }

      // Estado
      if (est.filtros.estado.length > 0) {
        r = r.filter(m => est.filtros.estado.includes(m.estado));
      }

      est.datosVisibles = r;
      est.paginaActual = 1;
      if (window.tablaInstance) window.tablaInstance.renderizar();
      if (window.actualizarDashboard) window.actualizarDashboard();
      this.actualizarPillsUI();
    }

    actualizarPillsUI() {
      const est = window.estadoApp;
      document.querySelectorAll(".filtro-pill").forEach(pill => {
        const tipo = pill.dataset.filtro;
        let count = 0;
        if (tipo === "tipo")      count = est.filtros.tipo.length;
        if (tipo === "categoria") count = est.filtros.categoria.length;
        if (tipo === "fecha")     count = est.filtros.fecha ? 1 : 0;
        if (tipo === "asesor")    count = est.filtros.asesor.length;
        if (tipo === "estado")    count = est.filtros.estado.length;

        const tieneValor = count > 0;
        pill.classList.toggle("tiene-valor", tieneValor);

        const prev = pill.querySelector(".filtro-pill__contador");
        if (prev) prev.remove();

        if (tieneValor) {
          const c = document.createElement("span");
          c.className = "filtro-pill__contador";
          c.textContent = count;
          const caret = pill.querySelector("svg");
          pill.insertBefore(c, caret);
        }
      });
    }

    /**
     * Sincroniza los checkboxes y botones DENTRO de cada popover de filtro
     * con el estado actual en `estadoApp.filtros`. Se llama cuando cambia
     * la vista (tab) para que al abrir un popover el usuario vea
     * pre-marcados los valores que corresponden a esa vista.
     */
    sincronizarPopoversUI() {
      const est = window.estadoApp;

      // Tipo (checkboxes con data-filtro-val)
      const popTipo = document.getElementById("popover-filtro-tipo");
      if (popTipo) {
        popTipo.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          cb.checked = est.filtros.tipo.includes(cb.dataset.filtroVal);
        });
      }

      // Estado (checkboxes con data-filtro-val)
      const popEst = document.getElementById("popover-filtro-estado");
      if (popEst) {
        popEst.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          cb.checked = est.filtros.estado.includes(cb.dataset.filtroVal);
        });
      }

      // Categoría (checkboxes con data-cat — se pueblan dinámicamente)
      const listaCat = document.getElementById("lista-categorias");
      if (listaCat) {
        listaCat.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          cb.checked = est.filtros.categoria.includes(cb.dataset.cat);
        });
      }

      // Asesor / Responsable (checkboxes con data-ase — se pueblan dinámicamente)
      const listaAse = document.getElementById("lista-asesores");
      if (listaAse) {
        listaAse.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          cb.checked = est.filtros.asesor.includes(cb.dataset.ase);
        });
      }

      // Fecha (botones single-select, no checkboxes) — highlight del activo
      const popFecha = document.getElementById("popover-filtro-fecha");
      if (popFecha) {
        popFecha.querySelectorAll(".popover__item").forEach(btn => {
          const val = btn.dataset.filtroVal;
          // No marcar el botón "Limpiar" (val vacío)
          btn.classList.toggle("popover__item--activo", val !== "" && val === est.filtros.fecha);
        });
      }
    }

    buscar(texto) {
      window.estadoApp.busquedaActual = texto;
      this.aplicarFiltros();
    }

    escucharEventos() {
      if (this.inputBusqueda) {
        const buscarD = debounce((v) => this.buscar(v), 300);
        this.inputBusqueda.addEventListener("input", (e) => buscarD(e.target.value));
        this.inputBusqueda.addEventListener("keydown", (e) => {
          if (e.key === "Escape") { e.target.value = ""; this.buscar(""); }
        });
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    window.filtrosInstance = new Filtros();
  });
})();