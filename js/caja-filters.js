/* ============================================================
   CAJA-FILTERS.JS
   Orquestador de filtros del módulo Caja:
   vista + búsqueda + filtros pill (tipo, categoría, fecha,
   responsable, estado).

   El filtro de fecha admite dos formatos:
     - Preset (string):   "hoy" | "ayer" | "semana" | "mes" |
                          "mes_pasado" | "trimestre" | "anio"
     - Rango (objeto):    { desde: "YYYY-MM-DD", hasta: "YYYY-MM-DD" }
   ============================================================ */
(function () {

  const HOY_REF = new Date();

  function debounce(fn, wait = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(null, args), wait); };
  }

  // Normaliza una fecha al inicio del día (00:00) para comparaciones consistentes
  function inicioDia(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  // Normaliza una fecha al final del día (23:59:59.999) para que el "hasta" sea inclusivo
  function finDia(d) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  }

  // Resuelve un preset de fecha a un rango {desde, hasta} concreto
  function rangoDesdePreset(preset, hoy = HOY_REF) {
    const desde = new Date(hoy);
    const hasta = new Date(hoy);

    switch (preset) {
      case "hoy":
        return { desde: inicioDia(hoy), hasta: finDia(hoy) };
      case "ayer":
        desde.setDate(hoy.getDate() - 1);
        return { desde: inicioDia(desde), hasta: finDia(desde) };
      case "semana":
        desde.setDate(hoy.getDate() - 6);  // últimos 7 días incluyendo hoy
        return { desde: inicioDia(desde), hasta: finDia(hoy) };
      case "mes":
        return {
          desde: inicioDia(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
          hasta: finDia(hoy)
        };
      case "mes_pasado": {
        const iniMes = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        const finMes = new Date(hoy.getFullYear(), hoy.getMonth(), 0); // día 0 del mes actual = último del anterior
        return { desde: inicioDia(iniMes), hasta: finDia(finMes) };
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

  // Mapea cualquier valor del filtro de fecha (preset string o {desde,hasta}) a un rango concreto
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

  // Etiquetas legibles para los presets
  const ETIQUETAS_PRESET = {
    hoy:         "Hoy",
    ayer:        "Ayer",
    semana:      "Últimos 7 días",
    mes:         "Este mes",
    mes_pasado:  "Mes pasado",
    trimestre:   "Último trimestre",
    anio:        "Este año"
  };

  // Devuelve la etiqueta para mostrar dentro de la pill cuando hay un filtro de fecha
  function etiquetaFecha(valorFiltro) {
    if (!valorFiltro) return null;
    if (typeof valorFiltro === "string") return ETIQUETAS_PRESET[valorFiltro] || valorFiltro;
    if (valorFiltro.desde || valorFiltro.hasta) {
      const corto = (iso) => window.fechaCorta ? window.fechaCorta(iso) : iso;
      if (valorFiltro.desde && valorFiltro.hasta) {
        return `${corto(valorFiltro.desde)} → ${corto(valorFiltro.hasta)}`;
      }
      if (valorFiltro.desde) return `Desde ${corto(valorFiltro.desde)}`;
      if (valorFiltro.hasta) return `Hasta ${corto(valorFiltro.hasta)}`;
    }
    return null;
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
          (m.referencia    || "").toLowerCase().includes(q) ||
          (m.cliente       || "").toLowerCase().includes(q) ||
          (m.puntoVenta    || "").toLowerCase().includes(q)
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

      // Fecha (preset o rango personalizado)
      if (est.filtros.fecha) {
        const rango = resolverRangoFecha(est.filtros.fecha);
        if (rango) {
          r = r.filter(m => {
            const f = new Date(m.fecha);
            if (rango.desde && f < rango.desde) return false;
            if (rango.hasta && f > rango.hasta) return false;
            return true;
          });
        }
      }

      // Asesor / Responsable
      if (est.filtros.asesor.length > 0) {
        r = r.filter(m => est.filtros.asesor.includes(m.responsable));
      }

      // Estado
      if (est.filtros.estado.length > 0) {
        r = r.filter(m => est.filtros.estado.includes(m.estado));
      }

      // Método de pago
      if (est.filtros.metodoPago && est.filtros.metodoPago.length > 0) {
        r = r.filter(m => est.filtros.metodoPago.includes(m.metodoPago));
      }

      // Punto de Venta
      if (est.filtros.puntoVenta && est.filtros.puntoVenta.length > 0) {
        r = r.filter(m => est.filtros.puntoVenta.includes(m.puntoVenta));
      }

      est.datosVisibles = r;
      est.paginaActual = 1;
      if (window.tablaInstance)        window.tablaInstance.renderizar();
      if (window.actualizarDashboard)  window.actualizarDashboard();
      if (window.actualizarContadoresExport) window.actualizarContadoresExport();
      this.actualizarPillsUI();
    }

    actualizarPillsUI() {
      const est = window.estadoApp;
      document.querySelectorAll(".filtro-pill").forEach(pill => {
        const tipo = pill.dataset.filtro;
        let count = 0;
        let etiqueta = null;

        if (tipo === "tipo")      count = est.filtros.tipo.length;
        if (tipo === "categoria") count = est.filtros.categoria.length;
        if (tipo === "fecha") {
          etiqueta = etiquetaFecha(est.filtros.fecha);
          count = etiqueta ? 1 : 0;
        }
        if (tipo === "asesor")     count = est.filtros.asesor.length;
        if (tipo === "estado")     count = est.filtros.estado.length;
        if (tipo === "metodoPago") count = (est.filtros.metodoPago || []).length;
        if (tipo === "puntoVenta") count = (est.filtros.puntoVenta || []).length;

        const tieneValor = count > 0;
        pill.classList.toggle("tiene-valor", tieneValor);

        // Limpiar contadores previos
        pill.querySelectorAll(".filtro-pill__contador, .filtro-pill__valor").forEach(n => n.remove());

        if (tieneValor) {
          const caret = pill.querySelector("svg");
          if (tipo === "fecha" && etiqueta) {
            // Para fecha mostramos la etiqueta legible (no un número)
            const v = document.createElement("span");
            v.className = "filtro-pill__valor";
            v.textContent = etiqueta;
            pill.insertBefore(v, caret);
          } else {
            const c = document.createElement("span");
            c.className = "filtro-pill__contador";
            c.textContent = count;
            pill.insertBefore(c, caret);
          }
        }
      });
    }

    /**
     * Sincroniza los checkboxes y botones DENTRO de cada popover de filtro
     * con el estado actual en `estadoApp.filtros`.
     */
    sincronizarPopoversUI() {
      const est = window.estadoApp;

      // Tipo
      const popTipo = document.getElementById("popover-filtro-tipo");
      if (popTipo) {
        popTipo.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          cb.checked = est.filtros.tipo.includes(cb.dataset.filtroVal);
        });
      }

      // Estado
      const popEst = document.getElementById("popover-filtro-estado");
      if (popEst) {
        popEst.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          cb.checked = est.filtros.estado.includes(cb.dataset.filtroVal);
        });
      }

      // Categoría
      const listaCat = document.getElementById("lista-categorias");
      if (listaCat) {
        listaCat.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          cb.checked = est.filtros.categoria.includes(cb.dataset.cat);
        });
      }

      // Asesor / Responsable
      const listaAse = document.getElementById("lista-asesores");
      if (listaAse) {
        listaAse.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          cb.checked = est.filtros.asesor.includes(cb.dataset.ase);
        });
      }

      // Punto de Venta
      const listaPdv = document.getElementById("lista-puntos-venta");
      if (listaPdv) {
        listaPdv.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          cb.checked = (est.filtros.puntoVenta || []).includes(cb.dataset.pdv);
        });
      }

      // Fecha — solo resaltar el preset si el filtro es un string preset
      const popFecha = document.getElementById("popover-filtro-fecha");
      if (popFecha) {
        const esPreset = typeof est.filtros.fecha === "string";
        popFecha.querySelectorAll(".popover__item").forEach(btn => {
          const val = btn.dataset.filtroVal;
          btn.classList.toggle("popover__item--activo", esPreset && val === est.filtros.fecha);
        });
        // Sincronizar inputs del rango personalizado
        const inDesde = document.getElementById("filtro-fecha-desde");
        const inHasta = document.getElementById("filtro-fecha-hasta");
        if (inDesde && inHasta) {
          if (est.filtros.fecha && typeof est.filtros.fecha === "object") {
            inDesde.value = est.filtros.fecha.desde || "";
            inHasta.value = est.filtros.fecha.hasta || "";
          } else {
            inDesde.value = "";
            inHasta.value = "";
          }
        }
      }
    }

    buscar(texto) {
      window.estadoApp.busquedaActual = texto;
      this.aplicarFiltros();
    }

    limpiarFiltros() {
      const est = window.estadoApp;
      est.busquedaActual = "";
      est.filtros.tipo = [];
      est.filtros.categoria = [];
      est.filtros.fecha = null;
      est.filtros.asesor = [];
      est.filtros.estado = [];
      est.filtros.metodoPago = [];
      est.filtros.puntoVenta = [];
      if (this.inputBusqueda) this.inputBusqueda.value = "";
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
    // Exponer utilidades para que otros módulos puedan reusar la lógica
    window.resolverRangoFecha = resolverRangoFecha;
    window.etiquetaFecha = etiquetaFecha;
  });
})();
