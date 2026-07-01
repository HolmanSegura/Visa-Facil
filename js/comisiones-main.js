/* ============================================================
   COMISIONES-MAIN.JS
   Estado global y utilidades del módulo de Comisiones.
   Fuente de datos: ingresos_factura con comision_sugerida
   y ajuste manual via comisiones_ajustes.
   ============================================================ */

const vistasInicialesCom = [
  {
    id: "todas",
    nombre: "Todas las facturas",
    filtro: () => true,
    filtrosPill: {},
    activa: true
  },
  {
    id: "ajustadas",
    nombre: "Con ajuste manual",
    filtro: (r) => r.comision_ajustada !== null && r.comision_ajustada !== undefined,
    filtrosPill: {},
    activa: false
  },
  {
    id: "sin_ajuste",
    nombre: "Sin ajustar",
    filtro: (r) => r.comision_ajustada === null || r.comision_ajustada === undefined,
    filtrosPill: {},
    activa: false
  }
];

// Mock para modo sin backend
const datosEjemploCom = [
 ];

const estadoApp = {
  datosOriginales: [],
  datosVisibles: [],
  paginaActual: 1,
  registrosPorPagina: 25,
  ordenColumna: "fecha_pago",
  ordenDireccion: "desc",
  busquedaActual: "",
  filtros: {
    asesor: [],
    fecha: null
  },
  vistas: vistasInicialesCom,
  vistaActivaId: "todas",
  periodoActual: { desde: "", hasta: "" },
  configTabla: { altura: "default", zebra: false },
  columnasActivas: ["asesor", "titulo", "fecha_pago", "monto", "porcentaje", "comision_sugerida", "comision_final", "estado_comision", "acciones"]
};

/* ============================================================
   UTILIDADES
   ============================================================ */
function formatearMoneda(monto, moneda) {
  const prefijo = moneda === "USD" ? "US$" : (moneda || "COP");
  return `${prefijo} ${new Intl.NumberFormat("es-CO").format(Math.round(monto || 0))}`;
}

function formatearFecha(fechaIso) {
  if (!fechaIso) return "";
  const meses = ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sep.", "oct.", "nov.", "dic."];
  const f = new Date(fechaIso + "T12:00:00");
  return `${f.getDate()} de ${meses[f.getMonth()]} de ${f.getFullYear()}`;
}

function fechaCorta(fechaIso) {
  if (!fechaIso) return "";
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const f = new Date(fechaIso + "T12:00:00");
  return `${f.getDate()} ${meses[f.getMonth()]} ${f.getFullYear()}`;
}

function obtenerIniciales(nombre) {
  return (nombre || "?").split(" ").filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase();
}

function mostrarToast(mensaje, duracion = 2800) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = mensaje;
  void toast.offsetWidth;
  toast.classList.add("visible");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("visible"), duracion);
}

function normalizarFactura(f) {
  const sugerida  = parseFloat(f.comision_sugerida) || 0;
  const ajustada  = f.comision_ajustada !== null && f.comision_ajustada !== undefined
                    ? parseFloat(f.comision_ajustada) : null;
  return {
    id:                    f.id,
    hubspot_inv_id:        f.hubspot_inv_id || "",
    titulo:                f.titulo || f.hubspot_inv_id || "—",
    fecha_pago:            f.fecha_pago || "",
    monto:                 parseFloat(f.monto) || 0,
    moneda:                f.moneda || "COP",
    metodo_pago:           f.metodo_pago || "",
    asesor:                f.asesor || "—",
    asesor_id:             f.asesor_id || null,
    porcentaje:            parseFloat(f.porcentaje) || 0,
    comision_sugerida:     sugerida,
    comision_ajustada:     ajustada,
    comision_final:        ajustada !== null ? ajustada : sugerida,
    ultimo_ajuste_at:      f.ultimo_ajuste_at || null,
    n_ajustes:             parseInt(f.n_ajustes, 10) || 0,
    comision_caja_id:      f.comision_caja_id ? parseInt(f.comision_caja_id, 10) : null,
    estado_comision:       f.estado_comision || null,
    comision_pagada_valor: parseFloat(f.comision_pagada_valor) || 0,
    comision_pagada_fecha: f.comision_pagada_fecha || null,
  };
}

function primerDiaMes(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function fechaIsoHoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ============================================================
   DASHBOARD
   ============================================================ */
function actualizarDashboard() {
  const datos = estadoApp.datosVisibles;

  const totFacturado  = datos.reduce((s, r) => s + r.monto, 0);
  const totSugerida   = datos.reduce((s, r) => s + r.comision_sugerida, 0);
  const totFinal      = datos.reduce((s, r) => s + r.comision_final, 0);
  const conAjuste     = datos.filter(r => r.comision_ajustada !== null).length;
  const difAjuste     = totFinal - totSugerida;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  set("card-teorico",          formatearMoneda(totFacturado, "COP"));
  set("card-teorico-count",    `${datos.length} factura(s)`);

  set("card-registrado",       formatearMoneda(totSugerida, "COP"));
  set("card-registrado-count", `${datos.filter(r => r.porcentaje > 0).length} con % configurado`);

  const elFinal = document.getElementById("card-diferencia");
  if (elFinal) {
    elFinal.textContent = formatearMoneda(totFinal, "COP");
    elFinal.className   = "tarjeta-resumen__valor";
  }
  set("card-dif-sub", difAjuste !== 0
    ? (difAjuste > 0 ? "+" : "") + formatearMoneda(difAjuste, "COP") + " vs sugerida"
    : "Sin diferencia");

  set("card-pendientes",       conAjuste > 0 ? conAjuste.toString() : "0");
  set("card-pendientes-count", `factura(s) ajustada(s) manualmente`);
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  console.log("[Comisiones] Iniciando módulo de Comisiones (facturas)...");

  window.estadoApp        = estadoApp;
  window.formatearMoneda  = formatearMoneda;
  window.formatearFecha   = formatearFecha;
  window.fechaCorta       = fechaCorta;
  window.obtenerIniciales = obtenerIniciales;
  window.mostrarToast     = mostrarToast;
  window.actualizarDashboard = actualizarDashboard;
  window.normalizarFactura   = normalizarFactura;

  estadoApp.periodoActual = { desde: "", hasta: "" };

  let cargadoDesdeAPI = false;

  try {
    if (window.Api) {
      const res = await window.Api.comisiones.ajustes({});
      if (res?.ok && Array.isArray(res.data)) {
        estadoApp.datosOriginales = res.data.map(normalizarFactura);
        estadoApp.datosVisibles   = [...estadoApp.datosOriginales];
        cargadoDesdeAPI = true;
        console.info(`[Comisiones] ${estadoApp.datosOriginales.length} facturas cargadas desde API.`);
      }
    }
  } catch (e) {
    console.warn("[Comisiones] API no disponible, usando datos de ejemplo:", e.message);
  }

  if (!cargadoDesdeAPI) {
    estadoApp.datosOriginales = datosEjemploCom.map(normalizarFactura);
    estadoApp.datosVisibles   = [...estadoApp.datosOriginales];
  }

  if (window.vistasInstance)  window.vistasInstance.renderizar();
  if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
  actualizarDashboard();
  cargarResumenAsesores("", "");
});

/* ============================================================
   RESUMEN POR ASESOR
   ============================================================ */
function renderResumenAsesores(filas, desde, hasta) {
  const tbody = document.getElementById("resumen-asesores-tbody");
  const lblPeriodo = document.getElementById("resumen-periodo");
  if (!tbody) return;

  if (lblPeriodo && desde && hasta) {
    lblPeriodo.textContent = `${fechaCorta(desde)} – ${fechaCorta(hasta)}`;
  }

  if (!filas || filas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="resumen-asesores__vacio">Sin comisiones registradas en este período</td></tr>`;
    return;
  }

  tbody.innerHTML = filas.map(f => {
    const devengado  = f.teorico    || 0;
    const pagado     = f.registrado || 0;
    const porPagar   = devengado - pagado;
    const ini        = obtenerIniciales(f.responsable);
    const clsPorPagar = porPagar > 0 ? "resumen-asesores__por-pagar--positivo"
                       : "resumen-asesores__por-pagar--cero";
    return `<tr>
      <td>
        <div class="resumen-asesores__asesor">
          <div class="resumen-asesores__avatar">${ini}</div>
          <span class="resumen-asesores__nombre">${f.responsable}</span>
        </div>
      </td>
      <td class="resumen-asesores__celda-num">${f.total || 0}</td>
      <td class="resumen-asesores__celda-num">${formatearMoneda(devengado, "COP")}</td>
      <td class="resumen-asesores__celda-num">${formatearMoneda(pagado, "COP")}</td>
      <td class="resumen-asesores__celda-num ${clsPorPagar}">${formatearMoneda(porPagar, "COP")}</td>
    </tr>`;
  }).join("");
}

async function cargarResumenAsesores(desde, hasta) {
  const tbody = document.getElementById("resumen-asesores-tbody");
  if (!tbody || !window.Api) return;
  try {
    const res = await window.Api.comisiones.reporte({ desde, hasta });
    if (res?.ok && Array.isArray(res.filas)) {
      renderResumenAsesores(res.filas, desde, hasta);
    } else {
      renderResumenAsesores([], desde, hasta);
    }
  } catch (e) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="resumen-asesores__vacio">No disponible</td></tr>`;
    console.warn("[Comisiones] No se pudo cargar el resumen por asesor:", e.message);
  }
}

/* ============================================================
   API PÚBLICA: recargar con nuevo período
   ============================================================ */
window.recargarComisiones = async function (desde, hasta) {
  estadoApp.periodoActual = { desde, hasta };
  try {
    if (window.Api) {
      const res = await window.Api.comisiones.ajustes({ desde, hasta });
      if (res?.ok && Array.isArray(res.data)) {
        estadoApp.datosOriginales = res.data.map(normalizarFactura);
        estadoApp.datosVisibles   = [...estadoApp.datosOriginales];
        if (window.vistasInstance)  window.vistasInstance.renderizar();
        if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
        actualizarDashboard();
        cargarResumenAsesores(desde, hasta);
        return;
      }
    }
  } catch (e) {
    mostrarToast("⚠ No se pudo recargar el período seleccionado");
    console.warn("[Comisiones] recargarComisiones falló:", e.message);
  }
  if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
  actualizarDashboard();
  cargarResumenAsesores(desde, hasta);
};
