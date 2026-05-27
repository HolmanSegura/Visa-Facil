/* ============================================================
   MAIN.JS
   Punto de entrada: estado y utilidades. Datos cargados desde API.
   ============================================================ */

const vistasIniciales = [
  {
    id: "todas",
    nombre: "Todas las cotizaciones",
    filtro: () => true,
    activa: true,
  },
  {
    id: "vence_pronto",
    nombre: "Vence pronto",
    filtro: (it) => {
      const hoy = new Date();
      const venc = new Date(it.fechaVencimiento);
      const dias = (venc - hoy) / 86400000;
      return dias >= 0 && dias <= 30;
    },
    activa: false,
  },
  {
    id: "pendiente_aceptacion",
    nombre: "Pendiente de aceptación",
    filtro: (it) => it.estado === "publicado" || it.estado === "en_revision",
    activa: false,
  },
  {
    id: "pendiente_revision",
    nombre: "Pendiente de revisión",
    filtro: (it) => it.estado === "en_revision",
    activa: false,
  },
  {
    id: "pendiente_firma",
    nombre: "Pendiente de firma",
    filtro: (it) => it.estadoFirma === "pendiente",
    activa: false,
  },
  {
    id: "borradores_propios",
    nombre: "Mis borradores",
    filtro: (it) =>
      it.estado === "borrador" && it.responsable === "Néstor Goyes",
    activa: false,
  },
];

const estadoApp = {
  datosOriginales: [],
  datosVisibles: [],
  paginaActual: 1,
  registrosPorPagina: 25,
  ordenColumna: "titulo",
  ordenDireccion: "desc",
  busquedaActual: "",
  filtros: {
    estado: [],
    actividad: null,
    propietario: [],
    firma: [],
  },
  vistas: vistasIniciales,
  vistaActivaId: "todas",
  configTabla: {
    altura: "default",
    zebra: false,
  },
};

function formatearMoneda(monto, moneda) {
  const prefijo = moneda === "USD" ? "US$" : moneda || "COP";
  return `${prefijo} ${new Intl.NumberFormat("es-CO").format(monto)}`;
}

function formatearFecha(fechaIso) {
  if (!fechaIso) return "";
  const meses = [
    "ene.",
    "feb.",
    "mar.",
    "abr.",
    "may.",
    "jun.",
    "jul.",
    "ago.",
    "sep.",
    "oct.",
    "nov.",
    "dic.",
  ];
  const f = new Date(fechaIso);
  return `${f.getDate()} de ${meses[f.getMonth()]} de ${f.getFullYear()}`;
}

function obtenerIniciales(nombre) {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
}

function etiquetaEstado(estado) {
  const mapa = {
    publicado: "Publicado",
    aprobado: "Aprobado",
    vencido: "Vencido",
    borrador: "Borrador",
    en_revision: "En revisión",
    rechazado: "Rechazado",
  };
  return mapa[estado] || estado;
}

function etiquetaFirma(firma) {
  const mapa = {
    pendiente: "Pendiente",
    firmado: "Firmado",
    rechazado: "Rechazado",
    expirado: "Expirado",
    no_aplica: "No aplicable",
  };
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
  window.estadoApp = estadoApp;
  window.formatearMoneda = formatearMoneda;
  window.formatearFecha = formatearFecha;
  window.obtenerIniciales = obtenerIniciales;
  window.etiquetaEstado = etiquetaEstado;
  window.etiquetaFirma = etiquetaFirma;
  window.mostrarToast = mostrarToast;

  // Carga usuarios desde BD y puebla los selects de propietario/asesor
  try {
    const resU = await window.Api.usuarios.listar();
    if (resU.ok && Array.isArray(resU.data)) {
      window.usuariosCatalogo = resU.data;
      const opciones = resU.data
        .map(u => `<option value="${u.nombre}">${u.nombre}</option>`)
        .join("");
      const selProp = document.getElementById("cot-propietario");
      if (selProp) selProp.innerHTML = opciones;
      // Reporte de comisiones: mantiene opción "Todos" al inicio
      const selAsesor = document.getElementById("rep-com-asesor");
      if (selAsesor) {
        selAsesor.innerHTML = `<option value="">Todos</option>` + opciones;
      }
    }
  } catch (e) {
    console.warn("[App] No se pudieron cargar usuarios desde la API:", e.message);
  }

  try {
    const res = await window.Api.cotizaciones.listar({ por_pagina: 200 });

    if (res.ok && Array.isArray(res.data)) {
      const normalizados = res.data.map((c) => ({
        id: c.id,
        titulo: c.titulo,
        estado: c.estado,
        estadoFirma: c.estado_firma,
        moneda: c.moneda,
        cantidad: parseFloat(c.cantidad) || 0,
        fechaCreacion: c.fecha_creacion,
        fechaVencimiento: c.fecha_vencimiento,
        responsable: c.responsable || "",
        cliente: c.cliente_nombre || c.cliente || "",
        negocio: c.negocio_nombre || c.negocio || "",
      }));
      estadoApp.datosOriginales = normalizados;
      estadoApp.datosVisibles   = [...normalizados];
      console.info(`[App] ${normalizados.length} cotizaciones cargadas.`);
      if (window.vistasInstance)  window.vistasInstance.renderizar();
      if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
    }
  } catch (e) {
    console.error(
      "[App] Error al cargar cotizaciones desde la API:",
      e.message,
    );
    mostrarToast("⚠ No se pudo conectar con la base de datos");
  }
});
