/* ============================================================
   COTIZACIONES-EXPORT.JS  —  Exportación de cotizaciones a Excel (.xlsx)
   Requiere SheetJS (XLSX global) cargado antes de este script.
   ============================================================ */
(function () {

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

  function celda(col, fila) {
    const v = col.format ? col.format(fila[col.campo]) : fila[col.campo];
    return v === null || v === undefined ? "" : v;
  }

  function toXLSXBlob(aoa) {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cotizaciones");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  function matrizAXLSX(rows2D) {
    return toXLSXBlob(rows2D.map(r => r.map(v => (v === null || v === undefined) ? "" : v)));
  }

  function aXLSX(filas) {
    const head = COLUMNAS_EXPORT.map(c => c.titulo);
    const rows = filas.map(f => COLUMNAS_EXPORT.map(c => celda(c, f)));
    return toXLSXBlob([head, ...rows]);
  }

  function descargarBlob(blob, nombre) {
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

  function nombreArchivo(prefijo, ext = "xlsx") {
    return `${prefijo}-${timestamp()}.${ext}`;
  }

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

    descargarBlob(aXLSX(filas), nombreArchivo("cotizaciones"));
    window.mostrarToast(`✓ ${filas.length} cotizaciones exportadas a Excel`);
  }

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
        exportar(btn.dataset.exportAlcance);
        if (window.Popovers) window.Popovers.cerrar();
      });
    }

    window.actualizarContadoresExport = actualizarContadores;
    window.exportarCotizacionesCSV    = exportar;  // alias heredado
    window.utilsExport = { aXLSX, matrizAXLSX, descargarBlob, nombreArchivo, timestamp };

    actualizarContadores();
  });
})();
