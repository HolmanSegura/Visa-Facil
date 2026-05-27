/* ============================================================
   FILTERS.JS
   Aplicación combinada de: vista activa + filtros pill + búsqueda.
   Único punto de orquestación del dataset visible.

   El filtro de "actividad" (Última actividad) admite dos formatos:
     - Preset (string):   "hoy" | "ayer" | "semana" | "mes" |
                          "mes_pasado" | "trimestre" | "anio"
     - Rango (objeto):    { desde: "YYYY-MM-DD", hasta: "YYYY-MM-DD" }
   Se aplica sobre `fechaCreacion`.
   ============================================================ */

(function () {

  // Fecha de referencia: en producción debería ser new Date().
  const HOY_REF = new Date("2026-05-20");

  function debounce(fn, wait = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function inicioDia(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function finDia(d) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  }

  // Resuelve un preset de fecha a un rango concreto
  function rangoDesdePreset(preset, hoy = HOY_REF) {
    const desde = new Date(hoy);
    switch (preset) {
      case "hoy":
        return { desde: inicioDia(hoy), hasta: finDia(hoy) };
      case "ayer":
        desde.setDate(hoy.getDate() - 1);
        return { desde: inicioDia(desde), hasta: finDia(desde) };
      case "semana":
        desde.setDate(hoy.getDate() - 6);
        return { desde: inicioDia(desde), hasta: finDia(hoy) };
      case "mes":
        return {
          desde: inicioDia(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
          hasta: finDia(hoy)
        };
      case "mes_pasado": {
        const ini = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
        return { desde: inicioDia(ini), hasta: finDia(fin) };
      }
      case "trimestre":
        desde.setMonth(hoy.getMonth() - 3);
        return { desde: inicioDia(desde), hasta: finDia(hoy) };
      case "anio":
        return {
          desde: inicioDia(new Date(hoy.getFullYear(), 0, 1)),
          hasta: finDia(hoy)
        };
      default:
        return null;
    }
  }

  function resolverRangoFecha(valorFiltro) {
    if (!valorFiltro) return null;
    if (typeof valorFiltro === "string") return rangoDesdePreset(valorFiltro);
    if (valorFiltro.desde || valorFiltro.hasta) {
      return {
        desde: valorFiltro.desde ? inicioDia(new Date(valorFiltro.desde)) : null,
        hasta: valorFiltro.hasta ? finDia(new Date(valorFiltro.hasta)) : null
      };
    }
    return null;
  }

  const ETIQUETAS_PRESET = {
    hoy:         "Hoy",
    ayer:        "Ayer",
    semana:      "Últimos 7 días",
    mes:         "Este mes",
    mes_pasado:  "Mes pasado",
    trimestre:   "Último trimestre",
    anio:        "Este año"
  };

  function fechaCorta(iso) {
    if (!iso) return "";
    const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
    const f = new Date(iso);
    return `${f.getDate()} ${meses[f.getMonth()]} ${f.getFullYear()}`;
  }

  function etiquetaFecha(valorFiltro) {
    if (!valorFiltro) return null;
    if (typeof valorFiltro === "string") return ETIQUETAS_PRESET[valorFiltro] || valorFiltro;
    if (valorFiltro.desde || valorFiltro.hasta) {
      if (valorFiltro.desde && valorFiltro.hasta) {
        return `${fechaCorta(valorFiltro.desde)} → ${fechaCorta(valorFiltro.hasta)}`;
      }
      if (valorFiltro.desde) return `Desde ${fechaCorta(valorFiltro.desde)}`;
      if (valorFiltro.hasta) return `Hasta ${fechaCorta(valorFiltro.hasta)}`;
    }
    return null;
  }

  class Filtros {
    constructor() {
      this.inputBusqueda = document.getElementById("input-buscar-tabla");
      this.escucharEventos();
    }

    /**
     * Punto único de actualización del dataset visible.
     * Aplica:
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

      // Filtro: actividad (preset o rango personalizado sobre fechaCreacion)
      if (est.filtros.actividad) {
        const rango = resolverRangoFecha(est.filtros.actividad);
        if (rango) {
          resultado = resultado.filter(it => {
            const fc = new Date(it.fechaCreacion);
            if (rango.desde && fc < rango.desde) return false;
            if (rango.hasta && fc > rango.hasta) return false;
            return true;
          });
        }
      }

      // Filtro: propietario
      if (est.filtros.propietario && est.filtros.propietario.length > 0) {
        resultado = resultado.filter(it => est.filtros.propietario.includes(it.responsable));
      }

      // Filtro: firma
      if (est.filtros.firma && est.filtros.firma.length > 0) {
        resultado = resultado.filter(it => est.filtros.firma.includes(it.estadoFirma));
      }

      // Filtro: moneda
      if (est.filtros.moneda && est.filtros.moneda.length > 0) {
        resultado = resultado.filter(it => est.filtros.moneda.includes(it.moneda));
      }

      est.datosVisibles = resultado;
      est.paginaActual = 1;

      if (window.tablaInstance) window.tablaInstance.renderizar();
      if (window.actualizarContadoresExport) window.actualizarContadoresExport();
      this.actualizarPillsUI();
    }

    /** Actualiza el estado visual de los pills (activos, contadores, etiqueta de fecha). */
    actualizarPillsUI() {
      const est = window.estadoApp;
      document.querySelectorAll(".filtro-pill").forEach(pill => {
        const tipo = pill.dataset.filtro;
        let count = 0;
        let etiqueta = null;

        if (tipo === "estado")      count = est.filtros.estado.length;
        if (tipo === "propietario") count = est.filtros.propietario.length;
        if (tipo === "firma")       count = est.filtros.firma.length;
        if (tipo === "moneda")      count = (est.filtros.moneda || []).length;
        if (tipo === "actividad") {
          etiqueta = etiquetaFecha(est.filtros.actividad);
          count = etiqueta ? 1 : 0;
        }

        const tieneValor = count > 0;
        pill.classList.toggle("tiene-valor", tieneValor);

        // Limpiar marcadores previos (contador o valor)
        pill.querySelectorAll(".filtro-pill__contador, .filtro-pill__valor").forEach(n => n.remove());

        if (tieneValor) {
          const caret = pill.querySelector("svg");
          if (tipo === "actividad" && etiqueta) {
            const v = document.createElement("span");
            v.className = "filtro-pill__valor";
            v.textContent = etiqueta;
            pill.insertBefore(v, caret);
          } else {
            const cont = document.createElement("span");
            cont.className = "filtro-pill__contador";
            cont.textContent = count;
            pill.insertBefore(cont, caret);
          }
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
      est.filtros.moneda = [];
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
    window.resolverRangoFecha = resolverRangoFecha;
    window.etiquetaFecha = etiquetaFecha;
    window.fechaCortaIso = fechaCorta;
  });
})();
