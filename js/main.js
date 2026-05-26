/* ============================================================
   MAIN.JS
   Punto de entrada: datos de ejemplo, estado y utilidades.
   ============================================================ */

const cotizaciones = [
  { id: 1,  titulo: "📋 JMF Sistematización de cotizaciones (Actualizada)", estado: "publicado", cantidad: 3560,     moneda: "USD", estadoFirma: "no_aplica", fechaCreacion: "2025-10-07", fechaVencimiento: "2026-12-31", responsable: "Néstor Goyes",     cliente: "JMF Construcciones",       negocio: "JMF Sistematización de cotizaciones" },
  { id: 2,  titulo: "📋 JMF Sistematización de cotizaciones",                estado: "vencido",   cantidad: 3600,     moneda: "COP", estadoFirma: "no_aplica", fechaCreacion: "2025-09-09", fechaVencimiento: "2025-11-30", responsable: "Néstor Goyes",     cliente: "JMF Construcciones",       negocio: "JMF Sistematización de cotizaciones" },
  { id: 3,  titulo: "Work for treats SEO - Step 2",                          estado: "vencido",   cantidad: 391,      moneda: "USD", estadoFirma: "no_aplica", fechaCreacion: "2025-04-15", fechaVencimiento: "2025-04-16", responsable: "Lizeth Carrillo",  cliente: "Work for treats",          negocio: "Work for treats SEO - Step 2" },
  { id: 4,  titulo: "VTEX - Milagros",                                       estado: "borrador",  cantidad: 16000000, moneda: "COP", estadoFirma: "no_aplica", fechaCreacion: "2024-03-26", fechaVencimiento: "2024-06-24", responsable: "Néstor Goyes",     cliente: "VTEX Latam",               negocio: "VTEX - Milagros" },
  { id: 5,  titulo: "VIRTUD - Internacionalización",                         estado: "vencido",   cantidad: 1608000,  moneda: "COP", estadoFirma: "no_aplica", fechaCreacion: "2024-05-18", fechaVencimiento: "2024-08-16", responsable: "Néstor Goyes",     cliente: "Virtud SAS",               negocio: "VIRTUD - Internacionalización" },
  { id: 6,  titulo: "Villegas Editores - Mejoras de procesos",               estado: "vencido",   cantidad: 8603400,  moneda: "COP", estadoFirma: "no_aplica", fechaCreacion: "2025-09-23", fechaVencimiento: "2025-12-22", responsable: "Néstor Goyes",     cliente: "Villegas Editores",        negocio: "Villegas Editores - Remisiones" },
  { id: 7,  titulo: "Villegas / Homologación Los Maestros",                  estado: "vencido",   cantidad: 5780000,  moneda: "COP", estadoFirma: "no_aplica", fechaCreacion: "2024-09-05", fechaVencimiento: "2024-12-31", responsable: "Néstor Goyes",     cliente: "Villegas Editores",        negocio: "Villegas / Homologación Los Maestros" },
  { id: 8,  titulo: "Vasquez Avenue",                                        estado: "vencido",   cantidad: 1989720,  moneda: "COP", estadoFirma: "no_aplica", fechaCreacion: "2025-07-10", fechaVencimiento: "2025-08-09", responsable: "Néstor Goyes",     cliente: "Vasquez Avenue Ltda",      negocio: "Vasquez Avenue" },
  { id: 9,  titulo: "Vanesa Sánchez - Sitio web constructora",               estado: "borrador",  cantidad: 0,        moneda: "COP", estadoFirma: "no_aplica", fechaCreacion: "2024-10-15", fechaVencimiento: "2024-11-14", responsable: "Néstor Goyes",     cliente: "Vanesa Sánchez",           negocio: "Sitio web constructora" },
  { id: 10, titulo: "TRANSPORTES COCOCARGA LTDA - Billy",                    estado: "borrador",  cantidad: 0,        moneda: "COP", estadoFirma: "no_aplica", fechaCreacion: "2025-07-14", fechaVencimiento: "2025-10-12", responsable: "Jennifer Acosta",  cliente: "Cococarga Ltda",           negocio: "TRANSCOCOL LTDA - Billy" },
  { id: 11, titulo: "Tienda en línea Shopify",                               estado: "vencido",   cantidad: 12060000, moneda: "COP", estadoFirma: "no_aplica", fechaCreacion: "2025-04-09", fechaVencimiento: "2025-06-08", responsable: "Lizeth Carrillo",  cliente: "Shopify CO",               negocio: "Tienda en línea Shopify" },
  { id: 12, titulo: "Tareas Oblicua",                                        estado: "borrador",  cantidad: 0,        moneda: "COP", estadoFirma: "no_aplica", fechaCreacion: "2025-10-20", fechaVencimiento: "2026-01-18", responsable: "Néstor Goyes",     cliente: "Oblicua",                  negocio: "Tareas Oblicua" },
  { id: 13, titulo: "Software pedidos B2B Papelería Cartagena",              estado: "vencido",   cantidad: 15104500, moneda: "COP", estadoFirma: "no_aplica", fechaCreacion: "2026-03-31", fechaVencimiento: "2026-04-10", responsable: "Néstor Goyes",     cliente: "Papelería Cartagena",      negocio: "Software pedidos B2B" },
  { id: 14, titulo: "Software costos y precios",                             estado: "publicado", cantidad: 7225000,  moneda: "COP", estadoFirma: "no_aplica", fechaCreacion: "2026-03-25", fechaVencimiento: "2026-05-24", responsable: "Néstor Goyes",     cliente: "Yaquut",                   negocio: "Control de Inventarios Yaquut" },
  { id: 15, titulo: "Sitios web internacionales / Dispapeles",               estado: "vencido",   cantidad: 19200000, moneda: "COP", estadoFirma: "no_aplica", fechaCreacion: "2025-03-20", fechaVencimiento: "2025-04-19", responsable: "Néstor Goyes",     cliente: "Dispapeles SA",            negocio: "Sitios web Internacionales / Dispapeles" },
  { id: 16, titulo: "Sitio web Mejora y soluciones + Diseño",                estado: "vencido",   cantidad: 18615000, moneda: "COP", estadoFirma: "no_aplica", fechaCreacion: "2025-09-30", fechaVencimiento: "2025-10-30", responsable: "Néstor Goyes",     cliente: "Mejora y soluciones",      negocio: "Sitio web Mejora y soluciones" },
  { id: 17, titulo: "Sitio web Mejora y soluciones",                         estado: "vencido",   cantidad: 12665000, moneda: "COP", estadoFirma: "no_aplica", fechaCreacion: "2025-09-30", fechaVencimiento: "2025-10-30", responsable: "Néstor Goyes",     cliente: "Mejora y soluciones",      negocio: "Sitio web Mejora y soluciones" },
  { id: 18, titulo: "Sitio web Laura Villegas 2026",                         estado: "publicado", cantidad: 17928000, moneda: "COP", estadoFirma: "no_aplica", fechaCreacion: "2025-12-01", fechaVencimiento: "2026-12-31", responsable: "Néstor Goyes",     cliente: "Laura Villegas",           negocio: "Sitio web Laura Villegas" },
  { id: 19, titulo: "Migración CRM HubSpot - Acme",                          estado: "aprobado",  cantidad: 24500000, moneda: "COP", estadoFirma: "firmado",    fechaCreacion: "2026-01-12", fechaVencimiento: "2026-04-12", responsable: "Maria González",    cliente: "Acme Corp",                negocio: "Migración CRM" },
  { id: 20, titulo: "Implementación e-commerce Shopify Plus",                estado: "en_revision", cantidad: 35800000, moneda: "COP", estadoFirma: "pendiente",  fechaCreacion: "2026-02-03", fechaVencimiento: "2026-05-03", responsable: "Carlos Ramírez",    cliente: "Tech Solutions SAS",       negocio: "E-commerce Shopify Plus" },
  { id: 21, titulo: "Diseño y desarrollo de landing pages",                  estado: "publicado", cantidad: 4200000,  moneda: "COP", estadoFirma: "no_aplica",  fechaCreacion: "2026-02-15", fechaVencimiento: "2026-03-15", responsable: "Néstor Goyes",     cliente: "MarketingPro",             negocio: "Landing pages campaña Q1" },
  { id: 22, titulo: "Consultoría SEO técnico",                               estado: "borrador",  cantidad: 6800000,  moneda: "COP", estadoFirma: "no_aplica",  fechaCreacion: "2026-03-01", fechaVencimiento: "2026-04-01", responsable: "Lizeth Carrillo",  cliente: "WebMaster Group",          negocio: "SEO 2026 Q1" },
  { id: 23, titulo: "Mantenimiento web mensual - Premium",                   estado: "aprobado",  cantidad: 1200000,  moneda: "COP", estadoFirma: "firmado",    fechaCreacion: "2026-01-20", fechaVencimiento: "2027-01-20", responsable: "Maria González",    cliente: "Constructora Pacífico",    negocio: "Mantenimiento web" },
  { id: 24, titulo: "Branding e identidad corporativa",                      estado: "en_revision", cantidad: 9500000,  moneda: "COP", estadoFirma: "pendiente",  fechaCreacion: "2026-02-22", fechaVencimiento: "2026-04-22", responsable: "Néstor Goyes",     cliente: "Innova Studio",            negocio: "Branding 2026" },
  { id: 25, titulo: "Integración API pasarela de pagos",                     estado: "vencido",   cantidad: 5400000,  moneda: "COP", estadoFirma: "expirado",   fechaCreacion: "2025-11-10", fechaVencimiento: "2026-01-10", responsable: "Carlos Ramírez",    cliente: "FinTech Andina",           negocio: "API Pagos" },
  { id: 26, titulo: "App móvil iOS y Android - MVP",                         estado: "borrador",  cantidad: 48000000, moneda: "COP", estadoFirma: "no_aplica",  fechaCreacion: "2026-03-10", fechaVencimiento: "2026-06-10", responsable: "Lizeth Carrillo",  cliente: "Startup Verde",            negocio: "App MVP" },
  { id: 27, titulo: "Capacitación equipo comercial HubSpot",                 estado: "publicado", cantidad: 3200000,  moneda: "COP", estadoFirma: "firmado",    fechaCreacion: "2026-04-01", fechaVencimiento: "2026-04-30", responsable: "Maria González",    cliente: "Grupo Empresarial Z",      negocio: "Capacitación HubSpot" },
  { id: 28, titulo: "Auditoría UX/UI plataforma actual",                     estado: "en_revision", cantidad: 7800000,  moneda: "COP", estadoFirma: "pendiente",  fechaCreacion: "2026-04-15", fechaVencimiento: "2026-05-15", responsable: "Néstor Goyes",     cliente: "Banco Mediano",            negocio: "Auditoría UX" },
  { id: 29, titulo: "Migración a Google Cloud Vertex AI",                    estado: "aprobado",  cantidad: 28500000, moneda: "COP", estadoFirma: "firmado",    fechaCreacion: "2026-05-01", fechaVencimiento: "2026-08-01", responsable: "Carlos Ramírez",    cliente: "Flordex",                  negocio: "Modelo predictivo Flordex" },
  { id: 30, titulo: "Soporte 24/7 sistemas críticos",                        estado: "publicado", cantidad: 14200000, moneda: "COP", estadoFirma: "firmado",    fechaCreacion: "2026-05-05", fechaVencimiento: "2027-05-05", responsable: "Lizeth Carrillo",  cliente: "Logística Express",        negocio: "Soporte 24/7" }
];

const vistasIniciales = [
  { id: "todas", nombre: "Todas las cotizaciones", filtro: () => true, activa: true },
  {
    id: "vence_pronto",
    nombre: "Vence pronto",
    filtro: (it) => {
      const hoy = new Date("2026-05-20");
      const venc = new Date(it.fechaVencimiento);
      const dias = (venc - hoy) / 86400000;
      return dias >= 0 && dias <= 30;
    },
    activa: false
  },
  {
    id: "pendiente_aceptacion",
    nombre: "Pendiente de aceptación",
    filtro: (it) => (it.estado === "publicado" || it.estado === "en_revision"),
    activa: false
  },
  {
    id: "pendiente_revision",
    nombre: "Pendiente de revisión",
    filtro: (it) => it.estado === "en_revision",
    activa: false
  },
  {
    id: "pendiente_firma",
    nombre: "Pendiente de firma",
    filtro: (it) => it.estadoFirma === "pendiente",
    activa: false
  },
  {
    id: "borradores_propios",
    nombre: "Mis borradores",
    filtro: (it) => it.estado === "borrador" && it.responsable === "Néstor Goyes",
    activa: false
  }
];

const estadoApp = {
  datosOriginales: cotizaciones,
  datosVisibles:   [...cotizaciones],
  paginaActual:    1,
  registrosPorPagina: 25,
  ordenColumna:    "titulo",
  ordenDireccion:  "desc",
  busquedaActual:  "",
  filtros: {
    estado:      [],
    actividad:   null,
    propietario: [],
    firma:       []
  },
  vistas: vistasIniciales,
  vistaActivaId: "todas",
  configTabla: {
    altura: "default",
    zebra:  false
  }
};

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

function obtenerIniciales(nombre) {
  return nombre.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]).join("");
}

function etiquetaEstado(estado) {
  const mapa = { publicado: "Publicado", aprobado: "Aprobado", vencido: "Vencido", borrador: "Borrador", en_revision: "En revisión", rechazado: "Rechazado" };
  return mapa[estado] || estado;
}

function etiquetaFirma(firma) {
  const mapa = { pendiente: "Pendiente", firmado: "Firmado", rechazado: "Rechazado", expirado: "Expirado", no_aplica: "No aplicable" };
  return mapa[firma] || firma;
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

document.addEventListener("DOMContentLoaded", async () => {
  console.log("[App] Iniciando módulo de cotizaciones...");
  window.estadoApp        = estadoApp;
  window.formatearMoneda  = formatearMoneda;
  window.formatearFecha   = formatearFecha;
  window.obtenerIniciales = obtenerIniciales;
  window.etiquetaEstado   = etiquetaEstado;
  window.etiquetaFirma    = etiquetaFirma;
  window.mostrarToast     = mostrarToast;

  // ── Carga desde API cuando está disponible ─────────────────
  // Si window.Api existe (api-client.js cargado y servidor PHP activo),
  // reemplaza los datos de ejemplo con los reales de la base de datos.
  // Si no, el módulo sigue funcionando con los datos hardcodeados de arriba.
  if (window.Api) {
    try {
      const res = await window.Api.cotizaciones.listar({ por_pagina: 200 });
      if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
        // Normalizar campos de la API al mismo contrato que usan los módulos JS
        const normalizados = res.data.map(c => ({
          id:               c.id,
          titulo:           c.titulo,
          estado:           c.estado,
          estadoFirma:      c.estado_firma,
          moneda:           c.moneda,
          cantidad:         parseFloat(c.cantidad) || 0,
          fechaCreacion:    c.fecha_creacion,
          fechaVencimiento: c.fecha_vencimiento,
          responsable:      c.responsable  || "",
          cliente:          c.cliente       || "",
          negocio:          c.negocio       || "",
        }));
        estadoApp.datosOriginales = normalizados;
        estadoApp.datosVisibles   = [...normalizados];
        console.info(`[App] ${normalizados.length} cotizaciones cargadas desde la API.`);
      }
    } catch (e) {
      console.warn("[App] API no disponible, usando datos de ejemplo:", e.message);
    }
  }
});