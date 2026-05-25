/* ============================================================
   CAJA-EXPORT.JS
   Exportación consolidada de movimientos a CSV (compatible Excel).

   Notas frontend:
   - Genera un .csv UTF-8 con BOM para que Excel lea correctamente
     tildes y eñes sin pasos extra.
   - Respeta el alcance elegido (visibles / todos).
   - Mantiene el mismo orden de columnas y los formatos legibles
     que se ven en la UI (categorías, métodos de pago, estados).
   - Si más adelante el backend ofrece un endpoint /export, basta
     reemplazar la función `exportar()` por una llamada fetch que
     traiga el blob. La capa de UI ya queda lista.
   ============================================================ */
(function () {

  // Orden y formato de las columnas exportadas. Centralizar aquí
  // facilita agregar/quitar columnas sin tocar el resto.
  const COLUMNAS_EXPORT = [
    { campo: "fecha",         titulo: "Fecha" },
    { campo: "referencia",    titulo: "Referencia",     format: v => v || "" },
    { campo: "tipo",          titulo: "Tipo",           format: v => v === "ingreso" ? "Ingreso" : "Gasto" },
    { campo: "categoria",     titulo: "Categoría",      format: v => window.etiquetaCategoria ? window.etiquetaCategoria(v) : v },
    { campo: "descripcion",   titulo: "Descripción" },
    { campo: "responsable",   titulo: "Responsable" },
    { campo: "cliente",       titulo: "Cliente",        format: v => v || "" },
    { campo: "valor",         titulo: "Valor" },
    { campo: "moneda",        titulo: "Moneda" },
    { campo: "metodoPago",    titulo: "Método de pago", format: v => window.etiquetaMetodoPago ? window.etiquetaMetodoPago(v) : v },
    { campo: "estado",        titulo: "Estado",         format: v => window.etiquetaEstado ? window.etiquetaEstado(v) : v },
    { campo: "observaciones", titulo: "Observaciones",  format: v => v || "" },
    { campo: "adjunto",       titulo: "Adjunto",        format: v => v || "" }
  ];

  /**
   * Escapa un valor para CSV según RFC 4180:
   * si contiene coma, comilla o salto de línea, va entre comillas
   * y las comillas internas se duplican.
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
    // BOM UTF-8 para que Excel reconozca la codificación al abrir el archivo
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
   * Exporta movimientos según alcance.
   * @param {"visibles"|"todos"} alcance
   */
  function exportar(alcance) {
    const est = window.estadoApp;
    if (!est) return;

    const filas = alcance === "todos"
      ? est.datosOriginales
      : est.datosVisibles;

    if (!filas || filas.length === 0) {
      window.mostrarToast("⚠ No hay movimientos para exportar");
      return;
    }

    const csv = aCSV(filas);
    descargarTexto(csv, nombreArchivo("caja-movimientos"));
    window.mostrarToast(`✓ ${filas.length} movimientos exportados a CSV`);
  }

  /**
   * Actualiza los contadores que muestra el popover de export
   * para que el usuario sepa cuántas filas saldrán antes de exportar.
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

    // Exponer para que caja-filters.js mantenga los contadores en sincronía
    window.actualizarContadoresExport = actualizarContadores;
    window.exportarMovimientosCSV     = exportar;
    // Reutilizables por caja-comisiones.js
    window.utilsExport = { aCSV, escaparCSV, descargarTexto, nombreArchivo, timestamp };

    // Primera actualización
    actualizarContadores();
  });
})();
