/* ============================================================
   COTIZACIONES-EXPORT.JS
   Exportación consolidada de cotizaciones a CSV (compatible Excel).

   Notas frontend:
   - Genera un .csv UTF-8 con BOM para que Excel lea tildes/eñes
     correctamente sin pasos extra.
   - Respeta el alcance elegido (visibles / todos).
   - Usa las etiquetas legibles del módulo (estado, firma) en vez
     de los códigos internos.
   - Si más adelante el backend ofrece un endpoint /export, basta
     reemplazar `exportar()` por una llamada fetch que traiga el blob.
   ============================================================ */
(function () {

  // Orden y formato de las columnas exportadas.
  const COLUMNAS_EXPORT = [
    { campo: "id",                titulo: "ID" },
    { campo: "titulo",            titulo: "Título" },
    { campo: "cliente",           titulo: "Cliente",           format: v => v || "" },
    { campo: "negocio",           titulo: "Negocio",           format: v => v || "" },
    { campo: "estado",            titulo: "Estado",            format: v => window.etiquetaEstado ? window.etiquetaEstado(v) : v },
    { campo: "cantidad",          titulo: "Cantidad" },
    { campo: "moneda",            titulo: "Moneda" },
    { campo: "responsable",       titulo: "Propietario" },
    { campo: "estadoFirma",       titulo: "Estado firma",      format: v => window.etiquetaFirma ? window.etiquetaFirma(v) : v },
    { campo: "fechaCreacion",     titulo: "Fecha creación" },
    { campo: "fechaVencimiento",  titulo: "Fecha vencimiento" }
  ];

  /**
   * Escapa un valor para CSV según RFC 4180.
   */
  function escaparCSV(v) {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function aCSV(filas) {
    const head = COLUMNAS_EXPORT.map(c => escaparCSV(c.titulo)).join(",");
    const body = filas.map(f =>
      COLUMNAS_EXPORT.map(c => {
        const valor = c.format ? c.format(f[c.campo]) : f[c.campo];
        return escaparCSV(valor);
      }).join(",")
    ).join("\r\n");
    return "\uFEFF" + head + "\r\n" + body;
  }

  function descargarTexto(contenido, nombre, mime = "text/csv;charset=utf-8") {
    const blob = new Blob([contenido], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function timestamp() {
    const f = new Date();
    const yyyy = f.getFullYear();
    const mm   = String(f.getMonth() + 1).padStart(2, "0");
    const dd   = String(f.getDate()).padStart(2, "0");
    const hh   = String(f.getHours()).padStart(2, "0");
    const mi   = String(f.getMinutes()).padStart(2, "0");
    return `${yyyy}${mm}${dd}-${hh}${mi}`;
  }

  function nombreArchivo(prefijo, ext = "csv") {
    return `${prefijo}-${timestamp()}.${ext}`;
  }

  /**
   * Exporta cotizaciones según alcance.
   * @param {"visibles"|"todos"} alcance
   */
  function exportar(alcance) {
    const est = window.estadoApp;
    if (!est) return;

    const filas = alcance === "todos"
      ? est.datosOriginales
      : est.datosVisibles;

    if (!filas || filas.length === 0) {
      window.mostrarToast("⚠ No hay cotizaciones para exportar");
      return;
    }

    const csv = aCSV(filas);
    descargarTexto(csv, nombreArchivo("cotizaciones"));
    window.mostrarToast(`✓ ${filas.length} cotizaciones exportadas a CSV`);
  }

  /**
   * Actualiza los contadores que muestra el popover de export.
   */
  function actualizarContadores() {
    const est = window.estadoApp;
    if (!est) return;
    const elVis = document.getElementById("export-cnt-visibles");
    const elTod = document.getElementById("export-cnt-todos");
    if (elVis) elVis.textContent = `${est.datosVisibles.length} filas (filtros aplicados)`;
    if (elTod) elTod.textContent = `${est.datosOriginales.length} filas (sin filtros)`;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const popover = document.getElementById("popover-export-opciones");
    if (popover) {
      popover.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-export-alcance]");
        if (!btn) return;
        const alcance = btn.dataset.exportAlcance;
        exportar(alcance);
        if (window.Popovers) window.Popovers.cerrar();
      });
    }

    window.actualizarContadoresExport  = actualizarContadores;
    window.exportarCotizacionesCSV     = exportar;
    // Reutilizables por cotizaciones-comisiones.js
    window.utilsExport = { aCSV, escaparCSV, descargarTexto, nombreArchivo, timestamp };

    actualizarContadores();
  });
})();
