/* ============================================================
   COMISIONES-MAIN.JS
   Estado global y utilidades del módulo de Comisiones.
   Carga datos desde API (comisiones.php?reporte=1) o usa
   datos de ejemplo cuando el backend no está disponible.
   ============================================================ */

const vistasInicialesCom = [
  {
    id: "todos",
    nombre: "Todos los asesores",
    filtro: () => true,
    filtrosPill: {},
    activa: true
  },
  {
    id: "pendientes",
    nombre: "Pendientes de pago",
    filtro: (r) => r.estado !== "pagado",
    filtrosPill: { estado: ["pendiente", "parcial"] },
    activa: false
  },
  {
    id: "pagados",
    nombre: "Pagados",
    filtro: (r) => r.estado === "pagado",
    filtrosPill: { estado: ["pagado"] },
    activa: false
  },
  {
    id: "activos",
    nombre: "Solo activos",
    filtro: (r) => r.activo !== false,
    filtrosPill: {},
    activa: false
  }
];

// Datos estáticos de ejemplo para modo sin backend
const datosEjemploCom = [
  {
    id: 1,
    responsable:  "Néstor Goyes",
    ingresos:     15000000,
    porcentaje:   5,
    teorico:      750000,
    registrado:   750000,
    pagos:        2,
    diferencia:   0,
    estado:       "pagado",
    activo:       true
  },
  {
    id: 2,
    responsable:  "Laura Herrera",
    ingresos:     8500000,
    porcentaje:   5,
    teorico:      425000,
    registrado:   200000,
    pagos:        1,
    diferencia:   -225000,
    estado:       "parcial",
    activo:       true
  },
  {
    id: 3,
    responsable:  "Carlos Mejía",
    ingresos:     12000000,
    porcentaje:   5,
    teorico:      600000,
    registrado:   600000,
    pagos:        3,
    diferencia:   0,
    estado:       "pagado",
    activo:       true
  },
  {
    id: 4,
    responsable:  "Ana Rodríguez",
    ingresos:     5200000,
    porcentaje:   3,
    teorico:      156000,
    registrado:   0,
    pagos:        0,
    diferencia:   -156000,
    estado:       "pendiente",
    activo:       true
  },
  {
    id: 5,
    responsable:  "David Castillo",
    ingresos:     0,
    porcentaje:   5,
    teorico:      0,
    registrado:   0,
    pagos:        0,
    diferencia:   0,
    estado:       "pagado",
    activo:       false
  }
];

const estadoApp = {
  datosOriginales:      [],
  datosVisibles:        [],
  paginaActual:         1,
  registrosPorPagina:   25,
  ordenColumna:         "responsable",
  ordenDireccion:       "asc",
  busquedaActual:       "",
  filtros: {
    asesor:  [],
    estado:  [],
    fecha:   null
  },
  vistas:         vistasInicialesCom,
  vistaActivaId:  "todos",
  periodoActual:  { desde: "", hasta: "" },
  configTabla:    { altura: "default", zebra: false },
  columnasActivas: ["responsable", "ingresos", "porcentaje", "teorico", "registrado", "pagos", "diferencia", "estado"]
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

function etiquetaEstado(estado) {
  return ({ pagado: "Pagado", pendiente: "Pendiente", parcial: "Parcial" })[estado] || estado;
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

function derivarEstado(row) {
  if (!row.teorico || row.teorico <= 0) return "pagado";
  if (!row.registrado || row.registrado <= 0) return "pendiente";
  if (row.registrado >= row.teorico) return "pagado";
  return "parcial";
}

function normalizarFilaCom(f, idx) {
  const registrado = parseFloat(f.registrado)  || 0;
  const teorico    = parseFloat(f.teorico)     || 0;
  const diferencia = registrado - teorico;
  const row = {
    id:          f.usuario_id ?? (idx + 1),
    responsable: f.responsable || "",
    ingresos:    parseFloat(f.ingresos)   || 0,
    porcentaje:  parseFloat(f.porcentaje) || 0,
    teorico,
    registrado,
    pagos:       parseInt(f.pagos, 10) || 0,
    diferencia,
    activo:      f.activo !== false
  };
  row.estado = derivarEstado(row);
  return row;
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

  const totTeorico    = datos.reduce((s, r) => s + r.teorico, 0);
  const totRegistrado = datos.reduce((s, r) => s + r.registrado, 0);
  const totDif        = totRegistrado - totTeorico;
  const conDeuda      = datos.filter(r => r.estado !== "pagado");
  const montoDeuda    = conDeuda.reduce((s, r) => s + Math.max(0, r.teorico - r.registrado), 0);

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  set("card-teorico",        formatearMoneda(totTeorico, "COP"));
  set("card-teorico-count",  `${datos.filter(r => r.activo).length} asesor(es)`);

  set("card-registrado",     formatearMoneda(totRegistrado, "COP"));
  set("card-registrado-count", `${datos.filter(r => r.estado === "pagado").length} pagado(s)`);

  const elDif = document.getElementById("card-diferencia");
  if (elDif) {
    elDif.textContent = (totDif >= 0 ? "+" : "") + formatearMoneda(totDif, "COP");
    elDif.className = "tarjeta-resumen__valor" +
      (totDif > 0 ? " tarjeta-resumen__valor--positivo" :
       totDif < 0 ? " tarjeta-resumen__valor--negativo" : "");
  }
  set("card-dif-sub", totDif >= 0 ? "Con excedente" : "Con déficit");

  set("card-pendientes",       formatearMoneda(montoDeuda, "COP"));
  set("card-pendientes-count", conDeuda.length);
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  console.log("[Comisiones] Iniciando módulo de Comisiones...");

  window.estadoApp           = estadoApp;
  window.formatearMoneda     = formatearMoneda;
  window.formatearFecha      = formatearFecha;
  window.fechaCorta          = fechaCorta;
  window.obtenerIniciales    = obtenerIniciales;
  window.etiquetaEstado      = etiquetaEstado;
  window.mostrarToast        = mostrarToast;
  window.actualizarDashboard = actualizarDashboard;
  window.derivarEstado       = derivarEstado;
  window.normalizarFilaCom   = normalizarFilaCom;

  // Período por defecto: mes actual
  const hoy   = new Date();
  const desde = primerDiaMes(hoy);
  const hasta = fechaIsoHoy();
  estadoApp.periodoActual = { desde, hasta };

  let cargadoDesdeAPI = false;

  try {
    if (window.Api) {
      const res = await window.Api.comisiones.reporte({ desde, hasta });
      if (res && res.ok && Array.isArray(res.filas) && res.filas.length > 0) {
        estadoApp.datosOriginales = res.filas.map(normalizarFilaCom);
        estadoApp.datosVisibles   = [...estadoApp.datosOriginales];
        cargadoDesdeAPI = true;
        console.info(`[Comisiones] ${estadoApp.datosOriginales.length} asesores cargados desde API.`);
      }
    }
  } catch (e) {
    console.warn("[Comisiones] API no disponible, usando datos de ejemplo:", e.message);
  }

  if (!cargadoDesdeAPI) {
    estadoApp.datosOriginales = datosEjemploCom;
    estadoApp.datosVisibles   = [...datosEjemploCom];
  }

  if (window.vistasInstance)  window.vistasInstance.renderizar();
  if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
  actualizarDashboard();
});

/* ============================================================
   MERGE HUBSPOT OWNERS → tabla principal
   Cuando lleguen los owners de HubSpot, agregar los que no
   tienen actividad en BD para que aparezcan en el listado.
   ============================================================ */
document.addEventListener("hubspot:owners-loaded", ({ detail }) => {
  const owners = detail?.owners;
  if (!Array.isArray(owners) || owners.length === 0) return;

  let modificado = false;
  owners.forEach(owner => {
    const existe = estadoApp.datosOriginales.find(
      r => r.responsable === owner.nombre
    );
    if (!existe) {
      estadoApp.datosOriginales.push(normalizarFilaCom({
        responsable: owner.nombre,
        ingresos:    0,
        porcentaje:  0,
        teorico:     0,
        registrado:  0,
        pagos:       0,
        activo:      true
      }, estadoApp.datosOriginales.length));
      modificado = true;
    }
  });

  if (modificado) {
    if (window.vistasInstance)  window.vistasInstance.renderizar();
    if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
    actualizarDashboard();
    console.info(`[Comisiones] Owners HubSpot fusionados: ${estadoApp.datosOriginales.length} total.`);
  }
});

/* ============================================================
   API PÚBLICA: recargar con nuevo período
   ============================================================ */
window.recargarComisiones = async function (desde, hasta) {
  estadoApp.periodoActual = { desde, hasta };
  try {
    if (window.Api) {
      const res = await window.Api.comisiones.reporte({ desde, hasta });
      if (res && res.ok && Array.isArray(res.filas)) {
        estadoApp.datosOriginales = res.filas.map(normalizarFilaCom);
        // Preservar owners de HubSpot sin actividad en el período
        if (Array.isArray(window.ownersCatalogo)) {
          window.ownersCatalogo.forEach((owner, i) => {
            if (!estadoApp.datosOriginales.find(r => r.responsable === owner.nombre)) {
              estadoApp.datosOriginales.push(normalizarFilaCom(
                { responsable: owner.nombre, ingresos: 0, porcentaje: 0, teorico: 0, registrado: 0, pagos: 0, activo: true },
                estadoApp.datosOriginales.length + i
              ));
            }
          });
        }
        estadoApp.datosVisibles = [...estadoApp.datosOriginales];
        if (window.vistasInstance)  window.vistasInstance.renderizar();
        if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
        actualizarDashboard();
        return;
      }
    }
  } catch (e) {
    mostrarToast("⚠ No se pudo recargar el período seleccionado");
    console.warn("[Comisiones] recargarComisiones falló:", e.message);
  }
  // Sin API: solo re-aplicar filtros sobre los datos actuales
  if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
  actualizarDashboard();
};
