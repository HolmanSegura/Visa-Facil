/* ============================================================
   CAJA-MAIN.JS
   Datos de movimientos de caja, estado y utilidades.
   ============================================================ */

const movimientosCaja = [
  // ===== Mayo 2026 (mes en curso) =====
  { id: 1,  fecha: "2026-05-19", tipo: "gasto",   categoria: "alimentacion", descripcion: "Jugo natural para reunión cliente Acme", responsable: "Néstor Goyes",     valor: 8500,     moneda: "COP", estado: "pagado",    metodoPago: "efectivo",       observaciones: "Reunión presencial para revisión del proyecto. Cliente solicita seguimiento mensual.", cliente: "Acme Corp",            referencia: "REF-2026-0019", adjunto: "recibo_jugo.jpg" },
  { id: 2,  fecha: "2026-05-19", tipo: "gasto",   categoria: "transporte",   descripcion: "Taxi Bogotá Centro - visita comercial",   responsable: "Maria González",    valor: 22000,    moneda: "COP", estado: "pagado",    metodoPago: "efectivo",       observaciones: "Trayecto ida y vuelta desde oficina hasta cliente Acme Corp.",                          cliente: "Acme Corp",            referencia: "REF-2026-0020", adjunto: "factura_taxi.pdf" },
  { id: 3,  fecha: "2026-05-18", tipo: "ingreso", categoria: "servicios",    descripcion: "Pago parcial proyecto JMF Sistematización", responsable: "Néstor Goyes",   valor: 1500000,  moneda: "COP", estado: "pagado",    metodoPago: "transferencia",  observaciones: "Primer abono del 50% del proyecto JMF según cotización aceptada.",                       cliente: "JMF Construcciones",   referencia: "REF-2026-0018", adjunto: "comprobante_jmf.pdf" },
  { id: 4,  fecha: "2026-05-17", tipo: "gasto",   categoria: "papeleria",    descripcion: "Resma de papel + cartuchos impresora",    responsable: "Jennifer Acosta",  valor: 145000,   moneda: "COP", estado: "pagado",    metodoPago: "tarjeta",        observaciones: "Compra de suministros de oficina mensuales.",                                            cliente: "",                     referencia: "REF-2026-0017", adjunto: "factura_papelimundo.pdf" },
  { id: 5,  fecha: "2026-05-17", tipo: "gasto",   categoria: "publicidad",   descripcion: "Pauta Facebook Ads campaña Q2",            responsable: "Lizeth Carrillo",  valor: 580000,   moneda: "COP", estado: "pagado",    metodoPago: "tarjeta",        observaciones: "Campaña de remarketing dirigida a leads del Q1 que no convirtieron.",                    cliente: "",                     referencia: "REF-2026-0016", adjunto: "fb_invoice.pdf" },
  { id: 6,  fecha: "2026-05-16", tipo: "gasto",   categoria: "comisiones",   descripcion: "Comisión venta cierre cliente VTEX",       responsable: "Carlos Ramírez",   valor: 750000,   moneda: "COP", estado: "pendiente", metodoPago: "transferencia",  observaciones: "Pendiente validación con dirección comercial antes de transferir.",                      cliente: "VTEX Latam",           referencia: "REF-2026-0015", adjunto: null },
  { id: 7,  fecha: "2026-05-15", tipo: "ingreso", categoria: "servicios",    descripcion: "Cobro mantenimiento web - Mayo",           responsable: "Maria González",    valor: 1200000,  moneda: "COP", estado: "pagado",    metodoPago: "transferencia",  observaciones: "Cobro mensual por servicio de mantenimiento Premium.",                                   cliente: "Constructora Pacífico",referencia: "REF-2026-0014", adjunto: "factura_001234.pdf" },
  { id: 8,  fecha: "2026-05-14", tipo: "gasto",   categoria: "servicios",    descripcion: "Pago servicio internet oficina",           responsable: "Jennifer Acosta",  valor: 280000,   moneda: "COP", estado: "pagado",    metodoPago: "transferencia",  observaciones: "Factura mensual ETB plan empresarial 200 megas.",                                        cliente: "",                     referencia: "REF-2026-0013", adjunto: "etb_mayo.pdf" },
  { id: 9,  fecha: "2026-05-13", tipo: "gasto",   categoria: "alimentacion", descripcion: "Almuerzo equipo cierre proyecto",          responsable: "Néstor Goyes",     valor: 185000,   moneda: "COP", estado: "pagado",    metodoPago: "tarjeta",        observaciones: "Celebración del cierre del proyecto Migración CRM con todo el equipo.",                  cliente: "",                     referencia: "REF-2026-0012", adjunto: "recibo_restaurante.jpg" },
  { id: 10, fecha: "2026-05-12", tipo: "gasto",   categoria: "transporte",   descripcion: "Combustible camioneta empresa",            responsable: "Carlos Ramírez",   valor: 240000,   moneda: "COP", estado: "pagado",    metodoPago: "tarjeta",        observaciones: "Tanqueo Terpel.",                                                                        cliente: "",                     referencia: "REF-2026-0011", adjunto: "factura_terpel.pdf" },
  { id: 11, fecha: "2026-05-11", tipo: "ingreso", categoria: "servicios",    descripcion: "Anticipo Migración Vertex AI - Flordex",   responsable: "Carlos Ramírez",   valor: 14250000, moneda: "COP", estado: "pagado",    metodoPago: "transferencia",  observaciones: "50% inicial del proyecto de migración a Google Cloud Vertex AI.",                        cliente: "Flordex",              referencia: "REF-2026-0010", adjunto: "compr_flordex.pdf" },
  { id: 12, fecha: "2026-05-10", tipo: "gasto",   categoria: "tramites",     descripcion: "Renovación firma digital RUT",             responsable: "Maria González",    valor: 95000,    moneda: "COP", estado: "pagado",    metodoPago: "transferencia",  observaciones: "Renovación anual firma digital Certicámara.",                                            cliente: "",                     referencia: "REF-2026-0009", adjunto: "certicamara.pdf" },
  { id: 13, fecha: "2026-05-09", tipo: "gasto",   categoria: "publicidad",   descripcion: "Diseño piezas redes sociales (freelance)", responsable: "Lizeth Carrillo",  valor: 450000,   moneda: "COP", estado: "pendiente", metodoPago: "transferencia",  observaciones: "Diseñador freelance Juan Pérez. Pendiente envío comprobante para pago.",                 cliente: "",                     referencia: "REF-2026-0008", adjunto: null },
  { id: 14, fecha: "2026-05-08", tipo: "gasto",   categoria: "alimentacion", descripcion: "Café y tinto reunión cliente Innova",      responsable: "Néstor Goyes",     valor: 12000,    moneda: "COP", estado: "pagado",    metodoPago: "efectivo",       observaciones: "Café para reunión presencial en oficinas del cliente.",                                  cliente: "Innova Studio",        referencia: "REF-2026-0007", adjunto: null },
  { id: 15, fecha: "2026-05-07", tipo: "gasto",   categoria: "otros",        descripcion: "Suscripción mensual Figma y Notion",       responsable: "Jennifer Acosta",  valor: 165000,   moneda: "COP", estado: "pagado",    metodoPago: "tarjeta",        observaciones: "Pago mensual suscripciones SaaS del equipo de diseño y operaciones.",                    cliente: "",                     referencia: "REF-2026-0006", adjunto: "factura_saas.pdf" },
  { id: 16, fecha: "2026-05-06", tipo: "ingreso", categoria: "servicios",    descripcion: "Pago final landing pages MarketingPro",    responsable: "Néstor Goyes",     valor: 4200000,  moneda: "COP", estado: "pagado",    metodoPago: "transferencia",  observaciones: "Saldo final del proyecto de landing pages campaña Q1.",                                  cliente: "MarketingPro",         referencia: "REF-2026-0005", adjunto: "compr_marketingpro.pdf" },
  { id: 17, fecha: "2026-05-05", tipo: "gasto",   categoria: "transporte",   descripcion: "Domicilio mensajero - entrega contrato",   responsable: "Maria González",    valor: 18000,    moneda: "COP", estado: "pagado",    metodoPago: "efectivo",       observaciones: "Envío de contrato físico firmado a cliente.",                                            cliente: "Acme Corp",            referencia: "REF-2026-0004", adjunto: null },
  { id: 18, fecha: "2026-05-04", tipo: "gasto",   categoria: "comisiones",   descripcion: "Comisión asesor venta - cliente Tech",     responsable: "Carlos Ramírez",   valor: 1790000,  moneda: "COP", estado: "pendiente", metodoPago: "transferencia",  observaciones: "Comisión del 5% sobre venta de implementación e-commerce Shopify Plus.",                 cliente: "Tech Solutions SAS",   referencia: "REF-2026-0003", adjunto: null },
  { id: 19, fecha: "2026-05-03", tipo: "gasto",   categoria: "publicidad",   descripcion: "Google Ads campaña mensual",                responsable: "Lizeth Carrillo",  valor: 920000,   moneda: "COP", estado: "pagado",    metodoPago: "tarjeta",        observaciones: "Inversión mensual en SEM Google Ads.",                                                   cliente: "",                     referencia: "REF-2026-0002", adjunto: "google_invoice.pdf" },
  { id: 20, fecha: "2026-05-02", tipo: "gasto",   categoria: "papeleria",    descripcion: "Notarización documentos legales",           responsable: "Jennifer Acosta",  valor: 78000,    moneda: "COP", estado: "anulado",   metodoPago: "efectivo",       observaciones: "Documentos rechazados por errores formales. Se reprocesará.",                            cliente: "",                     referencia: "REF-2026-0001", adjunto: null },

  // ===== Abril 2026 (mes anterior) =====
  { id: 21, fecha: "2026-04-28", tipo: "ingreso", categoria: "servicios",    descripcion: "Pago Migración CRM HubSpot Acme",          responsable: "Maria González",    valor: 12250000, moneda: "COP", estado: "pagado",    metodoPago: "transferencia",  observaciones: "50% del proyecto Migración CRM.",                                                        cliente: "Acme Corp",            referencia: "REF-2026-0028", adjunto: "compr_acme.pdf" },
  { id: 22, fecha: "2026-04-25", tipo: "gasto",   categoria: "alimentacion", descripcion: "Cena equipo aniversario empresa",          responsable: "Néstor Goyes",     valor: 850000,   moneda: "COP", estado: "pagado",    metodoPago: "tarjeta",        observaciones: "Celebración 5 años Oblicua con todo el equipo.",                                         cliente: "",                     referencia: "REF-2026-0027", adjunto: "factura_cena.pdf" },
  { id: 23, fecha: "2026-04-20", tipo: "gasto",   categoria: "servicios",    descripcion: "Hosting AWS abril",                         responsable: "Carlos Ramírez",   valor: 1450000,  moneda: "COP", estado: "pagado",    metodoPago: "tarjeta",        observaciones: "Servidores AWS de producción y staging.",                                                cliente: "",                     referencia: "REF-2026-0026", adjunto: "aws_april.pdf" },
  { id: 24, fecha: "2026-04-15", tipo: "ingreso", categoria: "servicios",    descripcion: "Mantenimiento web abril - Premium",        responsable: "Maria González",    valor: 1200000,  moneda: "COP", estado: "pagado",    metodoPago: "transferencia",  observaciones: "",                                                                                       cliente: "Constructora Pacífico",referencia: "REF-2026-0025", adjunto: "factura_abril.pdf" },
  { id: 25, fecha: "2026-04-10", tipo: "gasto",   categoria: "publicidad",   descripcion: "LinkedIn Ads campaña B2B",                  responsable: "Lizeth Carrillo",  valor: 1100000,  moneda: "COP", estado: "pagado",    metodoPago: "tarjeta",        observaciones: "Campaña dirigida a directores de marketing en empresas medianas.",                       cliente: "",                     referencia: "REF-2026-0024", adjunto: "linkedin_inv.pdf" }
];

// Vistas predefinidas del módulo
const vistasIniciales = [
  {
    id: "todos",
    nombre: "Todos los movimientos",
    filtro: () => true,
    // Sin filtros pill: la vista muestra TODO, ninguna pill queda marcada
    filtrosPill: {},
    activa: true
  },
  {
    id: "gastos_mes",
    nombre: "Gastos del mes",
    filtro: (m) => {
      const f = new Date(m.fecha);
      return m.tipo === "gasto" && f.getFullYear() === 2026 && f.getMonth() === 4; // mayo
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
      const f = new Date(m.fecha);
      return m.tipo === "ingreso" && f.getFullYear() === 2026 && f.getMonth() === 4;
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
  datosOriginales: movimientosCaja,
  datosVisibles:   [...movimientosCaja],
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
  const hoy = new Date("2026-05-20");

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

document.addEventListener("DOMContentLoaded", () => {
  console.log("[Caja] Iniciando módulo de Caja...");
  window.estadoApp           = estadoApp;
  window.movimientosCaja     = movimientosCaja;
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

  actualizarDashboard();
});