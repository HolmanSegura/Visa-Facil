/* ============================================================
   COMISIONES-FILTERS.JS
   Filtros del módulo Comisiones: asesor, estado, fecha.

   El filtro de fecha controla el período de reporte:
   - Si hay backend: llama a window.recargarComisiones(desde, hasta)
   - Si es modo estático: los datos no cambian (ya reflejan el período)

   Filtros de asesor y estado operan localmente sobre datosVisibles.
   ============================================================ */
(function () {

  const HOY_REF = new Date();

  function debounce(fn, wait = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(null, args), wait); };
  }

  function inicioDia(d) {
    const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
  }

  function finDia(d) {
    const x = new Date(d); x.setHours(23, 59, 59, 999); return x;
  }

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
        desde.setDate(hoy.getDate() - 6);
        return { desde: inicioDia(desde), hasta: finDia(hoy) };
      case "mes":
        return {
          desde: inicioDia(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
          hasta: finDia(hoy)
        };
      case "mes_pasado": {
        const iniMes = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        const finMes = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
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

  function resolverRangoFecha(valorFiltro) {
    if (!valorFiltro) return null;
    if (typeof valorFiltro === "string") return rangoDesdePreset(valorFiltro);
    if (valorFiltro.desde || valorFiltro.hasta) {
      return {
        desde: valorFiltro.desde ? inicioDia(new Date(valorFiltro.desde)) : null,
        hasta: valorFiltro.hasta ? finDia(new Date(valorFiltro.hasta))   : null
      };
    }
    return null;
  }

  function isoDesde(rango) {
    if (!rango || !rango.desde) return "";
    const d = rango.desde;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  function isoHasta(rango) {
    if (!rango || !rango.hasta) return "";
    const d = rango.hasta;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  const ETIQUETAS_PRESET = {
    hoy:        "Hoy",
    ayer:       "Ayer",
    semana:     "Últimos 7 días",
    mes:        "Este mes",
    mes_pasado: "Mes pasado",
    trimestre:  "Último trimestre",
    anio:       "Este año"
  };

  function etiquetaFecha(valorFiltro) {
    if (!valorFiltro) return null;
    if (typeof valorFiltro === "string") return ETIQUETAS_PRESET[valorFiltro] || valorFiltro;
    if (valorFiltro.desde || valorFiltro.hasta) {
      const corto = iso => window.fechaCorta ? window.fechaCorta(iso) : iso;
      if (valorFiltro.desde && valorFiltro.hasta)
        return `${corto(valorFiltro.desde)} → ${corto(valorFiltro.hasta)}`;
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
      const est   = window.estadoApp;
      const vista = est.vistas.find(v => v.id === est.vistaActivaId) || est.vistas[0];
      let r = est.datosOriginales.filter(vista.filtro);

      // Búsqueda por asesor o título de factura
      if (est.busquedaActual.trim()) {
        const q = est.busquedaActual.trim().toLowerCase();
        r = r.filter(row =>
          (row.asesor  || "").toLowerCase().includes(q) ||
          (row.titulo  || "").toLowerCase().includes(q)
        );
      }

      // Filtro asesor
      if (est.filtros.asesor && est.filtros.asesor.length > 0) {
        r = r.filter(row => est.filtros.asesor.includes(row.asesor));
      }

      est.datosVisibles = r;
      est.paginaActual  = 1;

      if (window.tablaInstance)        window.tablaInstance.renderizar();
      if (window.actualizarDashboard)  window.actualizarDashboard();
      this.actualizarPillsUI();
    }

    actualizarPillsUI() {
      const est = window.estadoApp;
      document.querySelectorAll(".filtro-pill").forEach(pill => {
        const tipo = pill.dataset.filtro;
        let count   = 0;
        let etiqueta = null;

        if (tipo === "asesor") count = (est.filtros.asesor || []).length;
        if (tipo === "estado") count = (est.filtros.estado || []).length;
        if (tipo === "fecha") {
          etiqueta = etiquetaFecha(est.filtros.fecha);
          count    = etiqueta ? 1 : 0;
        }

        const tieneValor = count > 0;
        pill.classList.toggle("tiene-valor", tieneValor);
        pill.querySelectorAll(".filtro-pill__contador, .filtro-pill__valor").forEach(n => n.remove());

        if (tieneValor) {
          const caret = pill.querySelector("svg");
          if (tipo === "fecha" && etiqueta) {
            const v = document.createElement("span");
            v.className   = "filtro-pill__valor";
            v.textContent = etiqueta;
            pill.insertBefore(v, caret);
          } else {
            const c = document.createElement("span");
            c.className   = "filtro-pill__contador";
            c.textContent = count;
            pill.insertBefore(c, caret);
          }
        }
      });
    }

    sincronizarPopoversUI() {
      const est = window.estadoApp;

      // Asesor
      const listaAse = document.getElementById("lista-asesores");
      if (listaAse) {
        listaAse.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          cb.checked = (est.filtros.asesor || []).includes(cb.dataset.ase);
        });
      }

      // Estado
      const popEst = document.getElementById("popover-filtro-estado");
      if (popEst) {
        popEst.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          cb.checked = (est.filtros.estado || []).includes(cb.dataset.filtroVal);
        });
      }

      // Fecha
      const popFecha = document.getElementById("popover-filtro-fecha");
      if (popFecha) {
        const esPreset = typeof est.filtros.fecha === "string";
        popFecha.querySelectorAll(".popover__item[data-filtro-val]").forEach(btn => {
          btn.classList.toggle("popover__item--activo", esPreset && btn.dataset.filtroVal === est.filtros.fecha);
        });
        const inDesde = document.getElementById("filtro-fecha-desde");
        const inHasta = document.getElementById("filtro-fecha-hasta");
        if (inDesde && inHasta) {
          if (est.filtros.fecha && typeof est.filtros.fecha === "object") {
            inDesde.value = est.filtros.fecha.desde || "";
            inHasta.value = est.filtros.fecha.hasta || "";
          } else {
            inDesde.value = ""; inHasta.value = "";
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
      est.filtros.asesor  = [];
      est.filtros.estado  = [];
      est.filtros.fecha   = null;
      if (this.inputBusqueda) this.inputBusqueda.value = "";
      this.aplicarFiltros();
    }

    escucharEventos() {
      if (this.inputBusqueda) {
        const buscarD = debounce(v => this.buscar(v), 300);
        this.inputBusqueda.addEventListener("input",  e => buscarD(e.target.value));
        this.inputBusqueda.addEventListener("keydown", e => {
          if (e.key === "Escape") { e.target.value = ""; this.buscar(""); }
        });
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    window.filtrosInstance    = new Filtros();
    window.resolverRangoFecha = resolverRangoFecha;
    window.etiquetaFechaCom   = etiquetaFecha;
    window.isoDesde           = isoDesde;
    window.isoHasta           = isoHasta;
  });
})();
