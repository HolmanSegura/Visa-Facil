/* ============================================================
   CAJA-MAIN.JS
   Estado y utilidades. Datos cargados desde API.
   ============================================================ */

// Vistas predefinidas del módulo
const vistasIniciales = [
  {
    id: "todos",
    nombre: "Todos los movimientos",
    filtro: () => true,
    filtrosPill: {},
    activa: true
  },
  {
    id: "gastos_mes",
    nombre: "Gastos del mes",
    filtro: (m) => {
      const hoy = new Date();
      const f   = new Date(m.fecha);
      return m.tipo === "gasto" && f.getFullYear() === hoy.getFullYear() && f.getMonth() === hoy.getMonth();
    },
    filtrosPill: { tipo: ["gasto"], fecha: "mes" },
    activa: false
  },
  {
    id: "pendientes",
    nombre: "Pendientes",
    filtro: (m) => m.estado === "pendiente",
    filtrosPill: { estado: ["pendiente"] },
    activa: false
  },
  {
    id: "ingresos_mes",
    nombre: "Ingresos del mes",
    filtro: (m) => {
      const hoy = new Date();
      const f   = new Date(m.fecha);
      return m.tipo === "ingreso" && f.getFullYear() === hoy.getFullYear() && f.getMonth() === hoy.getMonth();
    },
    filtrosPill: { tipo: ["ingreso"], fecha: "mes" },
    activa: false
  },
  {
    id: "sin_conciliar",
    nombre: "Sin conciliar",
    filtro: (m) => m.estado === "pendiente" || m.estado === "borrador",
    // La vista combina "pendiente OR borrador" — no se refleja 1-a-1 en la pill de
    // Estado (que solo tiene pagado/pendiente/anulado). El filtro de la vista hace
    // el trabajo y dejamos las pills limpias para no engañar al usuario.
    filtrosPill: {},
    activa: false
  },
  {
    id: "publicidad",
    nombre: "Gastos de publicidad",
    filtro: (m) => m.categoria === "publicidad",
    filtrosPill: { categoria: ["publicidad"] },
    activa: false
  }
];

// Categorías del catálogo
const categoriasCatalogo = [
  { valor: "alimentacion", nombre: "Alimentación",        icono: "🍔" },
  { valor: "transporte",   nombre: "Transporte",          icono: "🚕" },
  { valor: "papeleria",    nombre: "Papelería",           icono: "📎" },
  { valor: "publicidad",   nombre: "Publicidad",          icono: "📣" },
  { valor: "comisiones",   nombre: "Comisiones",          icono: "💼" },
  { valor: "servicios",    nombre: "Servicios públicos",  icono: "💡" },
  { valor: "tramites",     nombre: "Trámites",            icono: "📋" },
  { valor: "otros",        nombre: "Otros",               icono: "📦" }
];

const estadoApp = {
  datosOriginales: [],
  datosVisibles:   [],
  paginaActual:    1,
  registrosPorPagina: 25,
  ordenColumna:    "fecha",
  ordenDireccion:  "desc",
  busquedaActual:  "",
  filtros: {
    tipo:       [],
    categoria:  [],
    fecha:      null,
    asesor:     [],
    estado:     []
  },
  vistas: vistasIniciales,
  vistaActivaId: "todos",
  configTabla: {
    altura: "default",
    zebra:  false
  }
};

/* ============================================================
   UTILIDADES
   ============================================================ */
function formatearMoneda(monto, moneda) {
  const prefijo = moneda === "USD" ? "US$" : (moneda || "COP");
  return `${prefijo} ${new Intl.NumberFormat("es-CO").format(monto)}`;
}

function formatearFecha(fechaIso) {
  if (!fechaIso) return "";
  const meses = ["ene.","feb.","mar.","abr.","may.","jun.","jul.","ago.","sep.","oct.","nov.","dic."];
  const f = new Date(fechaIso);
  return `${f.getDate()} de ${meses[f.getMonth()]} de ${f.getFullYear()}`;
}

function fechaCorta(fechaIso) {
  if (!fechaIso) return "";
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const f = new Date(fechaIso);
  return `${f.getDate()} ${meses[f.getMonth()]} ${f.getFullYear()}`;
}

function obtenerIniciales(nombre) {
  return nombre.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]).join("");
}

function etiquetaCategoria(valor) {
  const cat = categoriasCatalogo.find(c => c.valor === valor);
  return cat ? cat.nombre : valor;
}

function iconoCategoria(valor) {
  const cat = categoriasCatalogo.find(c => c.valor === valor);
  return cat ? cat.icono : "📦";
}

function etiquetaEstado(estado) {
  return ({ pagado: "Pagado", pendiente: "Pendiente", anulado: "Anulado" })[estado] || estado;
}

function etiquetaTipo(tipo) {
  return tipo === "ingreso" ? "Ingreso" : "Gasto";
}

function etiquetaMetodoPago(metodo) {
  return ({ efectivo: "Efectivo", transferencia: "Transferencia", tarjeta: "Tarjeta", cheque: "Cheque" })[metodo] || metodo;
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

/**
 * Calcula y actualiza las tarjetas resumen del dashboard.
 * Usa `datosVisibles` (lo que está filtrado por la vista activa
 * + filtros pill + búsqueda) para que las tarjetas reflejen
 * siempre la información de la pestaña seleccionada.
 *
 * Además, calcula el cambio porcentual del mes actual contra
 * el mes inmediatamente anterior para mostrar "↑ X% vs mes ant."
 * o "↓ X% vs mes ant." de forma dinámica en cada tarjeta.
 */
function actualizarDashboard() {
  const datos = estadoApp.datosVisibles;
  const hoy = new Date();

  // Claves "YYYY-M" para clasificar movimientos por mes
  const claveDe = (f) => `${f.getFullYear()}-${f.getMonth()}`;
  const claveActual = claveDe(hoy);
  const claveAnterior = claveDe(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1));
  const enMes = (m, clave) => claveDe(new Date(m.fecha)) === clave;

  // Mes actual
  const gastosMes   = datos.filter(m => m.tipo === "gasto"   && enMes(m, claveActual));
  const ingresosMes = datos.filter(m => m.tipo === "ingreso" && enMes(m, claveActual));
  const pendientes  = datos.filter(m => m.estado === "pendiente");

  // Mes anterior (para comparativo)
  const gastosMesAnt   = datos.filter(m => m.tipo === "gasto"   && enMes(m, claveAnterior));
  const ingresosMesAnt = datos.filter(m => m.tipo === "ingreso" && enMes(m, claveAnterior));

  // Totales mes actual
  const totalGastos     = gastosMes.reduce((s, m) => s + m.valor, 0);
  const totalIngresos   = ingresosMes.reduce((s, m) => s + m.valor, 0);
  const totalPendientes = pendientes.reduce((s, m) => s + m.valor, 0);
  const balance         = totalIngresos - totalGastos;

  // Totales mes anterior
  const totalGastosAnt   = gastosMesAnt.reduce((s, m) => s + m.valor, 0);
  const totalIngresosAnt = ingresosMesAnt.reduce((s, m) => s + m.valor, 0);
  const balanceAnt       = totalIngresosAnt - totalGastosAnt;

  // ----- Valores principales -----
  document.getElementById("card-gastos").textContent         = formatearMoneda(totalGastos, "COP");
  document.getElementById("card-gastos-count").textContent   = gastosMes.length;
  document.getElementById("card-ingresos").textContent       = formatearMoneda(totalIngresos, "COP");
  document.getElementById("card-ingresos-count").textContent = ingresosMes.length;

  const elBalance = document.getElementById("card-balance");
  elBalance.textContent = formatearMoneda(balance, "COP");
  elBalance.classList.remove("tarjeta-resumen__valor--negativo", "tarjeta-resumen__valor--positivo");
  if (balance > 0) elBalance.classList.add("tarjeta-resumen__valor--positivo");
  if (balance < 0) elBalance.classList.add("tarjeta-resumen__valor--negativo");

  document.getElementById("card-pendientes").textContent       = formatearMoneda(totalPendientes, "COP");
  document.getElementById("card-pendientes-count").textContent = pendientes.length;

  // ----- Cambios % vs mes anterior -----
  pintarCambio("card-gastos-cambio",   totalGastos,   totalGastosAnt);
  pintarCambio("card-ingresos-cambio", totalIngresos, totalIngresosAnt);
  pintarCambio("card-balance-cambio",  balance,       balanceAnt);

  // ----- Pendientes: estado neutro, sólo cambia el texto según count -----
  const elPend = document.getElementById("card-pendientes-cambio");
  if (elPend) {
    elPend.classList.remove("tarjeta-resumen__cambio--up", "tarjeta-resumen__cambio--down");
    elPend.textContent = pendientes.length > 0 ? "Requiere atención" : "Sin pendientes";
  }
}

/**
 * Calcula y aplica el % de cambio mes actual vs mes anterior
 * a una tarjeta. Maneja casos borde: sin dato previo, dato previo
 * cero, valores negativos (relevante para Balance).
 */
function pintarCambio(idEl, actual, anterior) {
  const el = document.getElementById(idEl);
  if (!el) return;

  el.classList.remove("tarjeta-resumen__cambio--up", "tarjeta-resumen__cambio--down");

  // Sin dato comparable
  if (anterior === 0) {
    el.textContent = actual === 0 ? "Sin datos previos" : "Nuevo este mes";
    return;
  }

  // Usamos abs en el denominador para que el signo del cambio
  // refleje la dirección real incluso si "anterior" es negativo
  // (caso típico del Balance: puede pasar de -X a +Y).
  const pct = ((actual - anterior) / Math.abs(anterior)) * 100;
  const pctRedondo = Math.round(pct);

  if (pctRedondo > 0) {
    el.classList.add("tarjeta-resumen__cambio--up");
    el.textContent = `↑ ${pctRedondo}% vs mes ant.`;
  } else if (pctRedondo < 0) {
    el.classList.add("tarjeta-resumen__cambio--down");
    el.textContent = `↓ ${Math.abs(pctRedondo)}% vs mes ant.`;
  } else {
    el.textContent = `= 0% vs mes ant.`;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("[Caja] Iniciando módulo de Caja...");
  window.estadoApp           = estadoApp;
  window.categoriasCatalogo  = categoriasCatalogo;
  window.formatearMoneda     = formatearMoneda;
  window.formatearFecha      = formatearFecha;
  window.fechaCorta          = fechaCorta;
  window.obtenerIniciales    = obtenerIniciales;
  window.etiquetaCategoria   = etiquetaCategoria;
  window.iconoCategoria      = iconoCategoria;
  window.etiquetaEstado      = etiquetaEstado;
  window.etiquetaTipo        = etiquetaTipo;
  window.etiquetaMetodoPago  = etiquetaMetodoPago;
  window.mostrarToast        = mostrarToast;
  window.actualizarDashboard = actualizarDashboard;

  try {
    const res = await window.Api.caja.listar({ por_pagina: 200 });
    if (res.ok && Array.isArray(res.data)) {
      const normalizados = res.data.map(m => ({
        id:            m.id,
        fecha:         m.fecha,
        tipo:          m.tipo,
        categoria:     m.categoria_nombre || m.categoria || "otros",
        descripcion:   m.descripcion,
        responsable:   m.responsable      || "",
        valor:         parseFloat(m.valor) || 0,
        moneda:        m.moneda           || "COP",
        estado:        m.estado,
        metodoPago:    m.metodo_pago      || "",
        observaciones: m.observaciones    || "",
        cliente:       m.cliente_nombre   || m.cliente || "",
        referencia:    m.referencia       || "",
        adjunto:       m.adjunto          || null,
      }));
      estadoApp.datosOriginales = normalizados;
      estadoApp.datosVisibles   = [...normalizados];
      console.info(`[Caja] ${normalizados.length} movimientos cargados.`);
      if (window.vistasInstance)  window.vistasInstance.renderizar();
      if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
    }
  } catch (e) {
    console.error("[Caja] Error al cargar movimientos desde la API:", e.message);
    mostrarToast("⚠ No se pudo conectar con la base de datos");
  }

  actualizarDashboard();
});