/* ============================================================
   COTIZACIONES-EMAIL.JS
   Envío de cotizaciones por correo y exportación de histórico
   a Excel (.xlsx) o CSV como fallback.

   CORREO:
   ┌───────────────────────────────────────────────────────┐
   │ Remitente fijo:  soporte@oblicua.co                   │
   │                                                       │
   │ Middleware: Dapta (webhook POST)                       │
   │   Envía un payload JSON estructurado a la URL         │
   │   configurada en DAPTA_WEBHOOK_URL. Dapta se encarga  │
   │   de construir y despachar el correo al destinatario. │
   │                                                       │
   │   Reemplaza el placeholder antes de deploy:           │
   │   const DAPTA_WEBHOOK_URL = "TU_WEBHOOK_DAPTA_AQUI"  │
   └───────────────────────────────────────────────────────┘

   EXCEL:
   ┌───────────────────────────────────────────────────────┐
   │ Usa SheetJS (XLSX) si está disponible (CDN).          │
   │ Genera un .xlsx con dos hojas:                        │
   │   1. Cotizaciones (resumen del histórico)             │
   │   2. Líneas de artículo (cotización activa, opcional) │
   │ Fallback a CSV si SheetJS no cargó.                   │
   └───────────────────────────────────────────────────────┘

   Expone: window.CotizacionEmail
   ============================================================ */
(function () {
  const REMITENTE = "soporte@oblicua.co";
  // Valores por defecto — se sobreescriben desde .env vía window.AppConfig
  const DAPTA_WEBHOOK_URL_DEFAULT =
    "https://api.dapta.ai/api/9c9ae2b4d48889fa/envio-cotizaciones";
  const DAPTA_API_KEY_DEFAULT = ""; // Se configura desde .env vía window.AppConfig.dapta_api_key

  function getDaptaUrl() {
    return window.AppConfig?.dapta_webhook_url || DAPTA_WEBHOOK_URL_DEFAULT;
  }
  function getDaptaKey() {
    return window.AppConfig?.dapta_api_key || DAPTA_API_KEY_DEFAULT;
  }

  // -----------------------------------------------------------------
  // CONSTRUCCIÓN DEL CONTENIDO DEL CORREO
  // -----------------------------------------------------------------

  function construirAsunto(cot) {
    return `Cotización: ${cot.titulo || "Sin título"} — Oblicua Digital`;
  }

  function construirCuerpoTexto(cot, lineas, totales) {
    const fmt = (v) => new Intl.NumberFormat("es-CO").format(v);
    const fmtF = (f) =>
      f
        ? new Date(f + "T12:00:00").toLocaleDateString("es-CO", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "—";

    const itemsLineas = (lineas || [])
      .map(
        (l) =>
          `  • ${l.nombre}  |  Precio: ${fmt(l.precioUnitario)}  |  Cant: ${l.cantidad}${l.descuento > 0 ? `  |  Dcto: ${l.descuento}${l.tipoDescuento === "porcentaje" ? "%" : " $"}` : ""}`,
      )
      .join("\n");

    return [
      `Cotización: ${cot.titulo}`,
      `Cliente:    ${cot.cliente || "—"}`,
      `Negocio:    ${cot.negocio || "—"}`,
      `Válida hasta: ${fmtF(cot.fechaVencimiento)}`,
      "",
      "PRODUCTOS / SERVICIOS:",
      itemsLineas || "  (sin líneas de artículo)",
      "",
      `Subtotal:   ${fmt(totales?.subtotalBruto ?? cot.cantidad ?? 0)} COP`,
      totales?.descGlobalValor > 0
        ? `Descuento:  - ${fmt(totales.descGlobalValor)} COP`
        : "",
      `IVA (${((totales ? (window.DescuentosEngine?.getTasaIva?.() ?? 0.19) : 0.19) * 100).toFixed(0)}%):  ${fmt(totales?.iva ?? 0)} COP`,
      `TOTAL:      ${fmt(totales?.total ?? cot.cantidad ?? 0)} COP`,
      "",
      `Propietario: ${cot.responsable || "—"}`,
      "",
      "Para aceptar esta cotización o solicitar cambios, responde a este correo.",
      "",
      `—————`,
      `Enviado por soporte@oblicua.co · Oblicua Digital`,
    ]
      .filter((l) => l !== null && l !== undefined)
      .join("\n");
  }

  function construirCuerpoHTML(cot, lineas, totales) {
    const fmt = (v) =>
      new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
      }).format(v);
    const fmtF = (f) =>
      f
        ? new Date(f + "T12:00:00").toLocaleDateString("es-CO", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "—";
    const iva = window.DescuentosEngine?.getTasaIva?.() ?? 0.19;

    const filasLineas = (lineas || [])
      .map(
        (l) => `
      <tr>
        <td style="padding:7px 10px;border-bottom:1px solid #edf2f7;">${l.nombre}${l.descripcion ? `<br><small style="color:#718096;">${l.descripcion}</small>` : ""}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #edf2f7;text-align:right;white-space:nowrap;">${fmt(l.precioUnitario)}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #edf2f7;text-align:center;">${l.cantidad}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #edf2f7;text-align:center;">${l.descuento > 0 ? (l.tipoDescuento === "porcentaje" ? l.descuento + "%" : fmt(l.descuento)) : "—"}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #edf2f7;text-align:right;white-space:nowrap;font-weight:500;">${fmt(window.ProductosCotizacion?.calcularSubtotalLinea?.(l) ?? l.precioUnitario * l.cantidad)}</td>
      </tr>`,
      )
      .join("");

    const totalFinal = totales?.total ?? cot.cantidad ?? 0;
    const subtotalB = totales?.subtotalBruto ?? cot.cantidad ?? 0;
    const descValor = totales?.descGlobalValor ?? 0;
    const montoIva = totales?.iva ?? 0;

    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px;background:#f7fafc;font-family:Inter,Arial,sans-serif;color:#2d3748;">
  <div style="max-width:640px;margin:0 auto;">

    <!-- Header -->
    <div style="background:#1a202c;padding:22px 28px;border-radius:10px 10px 0 0;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="color:#fff;font-size:18px;font-weight:700;">Oblicua Digital</div>
        <div style="color:#a0aec0;font-size:12px;margin-top:2px;">soporte@oblicua.co</div>
      </div>
      <div style="color:#fff;font-size:13px;text-align:right;">
        <div style="font-weight:600;">${escHtml(cot.titulo)}</div>
        <div style="color:#a0aec0;font-size:11px;margin-top:2px;">Válida hasta: ${fmtF(cot.fechaVencimiento)}</div>
      </div>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;">
      <p style="margin:0 0 16px;">Estimado/a <strong>${escHtml(cot.cliente || "cliente")}</strong>,</p>
      <p style="margin:0 0 20px;color:#4a5568;">Compartimos la cotización <strong>${escHtml(cot.titulo)}</strong> para su revisión y aprobación.</p>

      ${
        lineas && lineas.length > 0
          ? `
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">
        <thead>
          <tr style="background:#f7fafc;">
            <th style="padding:9px 10px;text-align:left;border-bottom:2px solid #e2e8f0;font-weight:600;color:#4a5568;">Descripción</th>
            <th style="padding:9px 10px;text-align:right;border-bottom:2px solid #e2e8f0;font-weight:600;color:#4a5568;white-space:nowrap;">P. Unitario</th>
            <th style="padding:9px 10px;text-align:center;border-bottom:2px solid #e2e8f0;font-weight:600;color:#4a5568;">Cant.</th>
            <th style="padding:9px 10px;text-align:center;border-bottom:2px solid #e2e8f0;font-weight:600;color:#4a5568;">Dcto.</th>
            <th style="padding:9px 10px;text-align:right;border-bottom:2px solid #e2e8f0;font-weight:600;color:#4a5568;">Total</th>
          </tr>
        </thead>
        <tbody>${filasLineas}</tbody>
      </table>`
          : ""
      }

      <!-- Resumen de totales -->
      <table style="width:260px;margin-left:auto;font-size:13px;border-collapse:collapse;">
        <tr>
          <td style="padding:5px 0;color:#718096;">Subtotal</td>
          <td style="padding:5px 0;text-align:right;">${fmt(subtotalB)}</td>
        </tr>
        ${
          descValor > 0
            ? `
        <tr>
          <td style="padding:5px 0;color:#718096;">Descuento</td>
          <td style="padding:5px 0;text-align:right;color:#e53e3e;">- ${fmt(descValor)}</td>
        </tr>`
            : ""
        }
        <tr>
          <td style="padding:5px 0;color:#718096;">IVA (${(iva * 100).toFixed(0)}%)</td>
          <td style="padding:5px 0;text-align:right;">${fmt(montoIva)}</td>
        </tr>
        <tr style="border-top:2px solid #2d3748;">
          <td style="padding:10px 0 5px;font-weight:700;font-size:15px;">Total</td>
          <td style="padding:10px 0 5px;text-align:right;font-weight:700;font-size:15px;">${fmt(totalFinal)}</td>
        </tr>
      </table>

      <hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0;">

      <table style="font-size:12px;color:#718096;width:100%;">
        <tr><td>Propietario:</td><td>${escHtml(cot.responsable || "—")}</td></tr>
        <tr><td>Moneda:</td><td>${cot.moneda || "COP"}</td></tr>
        <tr><td>Negocio:</td><td>${escHtml(cot.negocio || "—")}</td></tr>
      </table>

      <div style="margin-top:24px;padding:14px 18px;background:#f7fafc;border-radius:6px;border-left:3px solid #4299e1;font-size:13px;color:#4a5568;">
        Para aceptar esta cotización o solicitar modificaciones, responde directamente a este correo.
      </div>
    </div>

    <!-- Footer -->
    <p style="text-align:center;font-size:11px;color:#a0aec0;margin-top:16px;">
      Enviado desde <strong>soporte@oblicua.co</strong> · Oblicua Digital
    </p>
  </div>
</body>
</html>`;
  }

  function escHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // -----------------------------------------------------------------
  // ENVÍO VÍA DAPTA (webhook POST)
  // Construye el payload completo y lo despacha al webhook.
  // Dapta recibe el JSON y se encarga de componer y enviar el correo.
  // -----------------------------------------------------------------

  /**
   * Arma el payload estructurado para Dapta.
   * @param {Object} cot         - Objeto cotización del frontend.
   * @param {string} destinatario - Email del destinatario.
   * @param {Array}  lineas       - Líneas de artículo de la cotización.
   * @param {Object} totales      - Resultado de DescuentosEngine.recalcular().
   */
  function construirPayloadDapta(cot, destinatario, lineas, totales) {
    const tasaIva = window.DescuentosEngine?.getTasaIva?.() ?? 0.19;

    return {
      // Metadatos del envío
      remitente: REMITENTE,
      destinatario,
      asunto: construirAsunto(cot),
      fechaEnvio: new Date().toISOString(),

      // Datos del cliente / negocio
      cliente: {
        nombre: cot.cliente || "",
        empresa: cot.cliente || "",
        negocio: cot.negocio || "",
        responsable: cot.responsable || "",
      },

      // Cabecera de la cotización
      cotizacion: {
        id: cot.id ?? null,
        titulo: cot.titulo || "",
        estado: cot.estado || "borrador",
        moneda: cot.moneda || "COP",
        fechaCreacion: cot.fechaCreacion || "",
        fechaVencimiento: cot.fechaVencimiento || "",
      },

      // Líneas de artículo con subtotal calculado por línea
      lineas: (lineas || []).map((l) => ({
        nombre: l.nombre || "",
        descripcion: l.descripcion || "",
        sku: l.sku || "",
        precioUnitario: l.precioUnitario ?? 0,
        cantidad: l.cantidad ?? 1,
        descuento: l.descuento ?? 0,
        tipoDescuento: l.tipoDescuento || "porcentaje",
        subtotal:
          window.DescuentosEngine?.calcularSubtotalLinea?.(l) ??
          l.precioUnitario * l.cantidad,
      })),

      // Resumen financiero
      totales: {
        subtotal: totales?.subtotalBruto ?? cot.cantidad ?? 0,
        descuento: totales?.descGlobalValor ?? 0,
        tasaIva,
        iva: totales?.iva ?? 0,
        total: totales?.total ?? cot.cantidad ?? 0,
      },

      // Cuerpo HTML preconstruido para que Dapta lo use directamente
      // o lo procese a través de su propio template.
      cuerpoHtml: construirCuerpoHTML(cot, lineas, totales),
    };
  }

  /**
   * Envía el payload a través del backend PHP (/api/email.php),
   * que a su vez llama a Dapta con cURL desde el servidor.
   * Esto evita los problemas de CORS y mantiene la API key segura.
   */
  async function enviarPorDapta(payload) {
    const base = window.location.pathname.replace(/\/[^/]*$/, '').replace(/\/$/, '');
    const res  = await fetch(base + '/api/email.php', {
      method:      'POST',
      credentials: 'same-origin',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify(payload),
    });

    if (!res.ok) {
      let detalle = "";
      try {
        detalle = await res.text();
      } catch (_) {
        /* noop */
      }
      throw new Error(
        `Dapta respondió ${res.status}: ${detalle.slice(0, 200)}`,
      );
    }

    return res.json().catch(() => ({}));
  }

  // -----------------------------------------------------------------
  // FUNCIÓN PÚBLICA: ENVIAR COTIZACIÓN
  // -----------------------------------------------------------------

  /**
   * Punto de entrada principal para enviar una cotización.
   * Gestiona la validación, construcción del payload y el manejo
   * de estados de éxito / error. El estado del botón (disabled)
   * lo maneja el listener en initEventos().
   *
   * @param {Object} cot          - Cotización activa.
   * @param {string} destinatario - Email del destinatario.
   * @returns {boolean} true si el envío fue exitoso.
   */
  async function enviarCotizacion(cot, destinatario) {
    if (!destinatario?.includes("@")) {
      window.mostrarToast?.("⚠ Ingresa un correo de destino válido");
      return false;
    }

    const lineas = window.ProductosCotizacion?.getLineas?.() || [];
    const totales = window.DescuentosEngine?.recalcular?.(lineas) || null;
    const payload = construirPayloadDapta(cot, destinatario, lineas, totales);

    await enviarPorDapta(payload);

    window.mostrarToast?.(`✓ Cotización enviada a ${destinatario}`);
    return true;
  }

  // -----------------------------------------------------------------
  // EXPORTACIÓN A EXCEL (.xlsx) — usa SheetJS vía CDN
  // Si SheetJS no está cargado, exporta a CSV como fallback.
  // -----------------------------------------------------------------

  function timestamp() {
    const n = new Date();
    return `${n.getFullYear()}${String(n.getMonth() + 1).padStart(2, "0")}${String(n.getDate()).padStart(2, "0")}-${String(n.getHours()).padStart(2, "0")}${String(n.getMinutes()).padStart(2, "0")}`;
  }

  /**
   * Exporta el histórico de cotizaciones a Excel o CSV.
   *
   * @param {Array}  datos           - Array de cotizaciones a exportar.
   * @param {Object} opts
   * @param {string} opts.nombre     - Nombre base del archivo (sin extensión).
   * @param {boolean} opts.incluirLineas - Agrega hoja con líneas de la cotización activa.
   */
  function exportarHistorico(datos, opts = {}) {
    const {
      nombre = `historico-cotizaciones-${timestamp()}`,
      incluirLineas = false,
    } = opts;

    if (!datos || datos.length === 0) {
      window.mostrarToast?.("⚠ No hay cotizaciones para exportar");
      return;
    }

    // Usar SheetJS si está disponible
    if (typeof XLSX !== "undefined") {
      exportarExcel(datos, nombre, incluirLineas);
    } else {
      exportarCSVFallback(datos, nombre);
    }
  }

  function exportarExcel(datos, nombre, incluirLineas) {
    const wb = XLSX.utils.book_new();

    // ---- Hoja 1: Resumen de cotizaciones ----
    const encHead = [
      "ID",
      "Título",
      "Cliente",
      "Negocio",
      "Estado",
      "Monto",
      "Moneda",
      "Propietario",
      "Estado firma",
      "Fecha creación",
      "Fecha vencimiento",
    ];
    const filas = datos.map((c) => [
      c.id,
      c.titulo,
      c.cliente || "",
      c.negocio || "",
      window.etiquetaEstado ? window.etiquetaEstado(c.estado) : c.estado,
      c.cantidad,
      c.moneda,
      c.responsable || "",
      window.etiquetaFirma
        ? window.etiquetaFirma(c.estadoFirma)
        : c.estadoFirma || "",
      c.fechaCreacion,
      c.fechaVencimiento,
    ]);

    const wsRes = XLSX.utils.aoa_to_sheet([encHead, ...filas]);
    wsRes["!cols"] = [
      { wch: 6 },
      { wch: 52 },
      { wch: 26 },
      { wch: 32 },
      { wch: 14 },
      { wch: 18 },
      { wch: 7 },
      { wch: 22 },
      { wch: 16 },
      { wch: 14 },
      { wch: 16 },
    ];

    // Estilo de encabezado (solo disponible en XLSX Pro — en la versión libre aplica como text)
    XLSX.utils.book_append_sheet(wb, wsRes, "Cotizaciones");

    // ---- Hoja 2: Líneas de artículo (cotización activa) ----
    if (incluirLineas) {
      const lineas = window.ProductosCotizacion?.getLineas?.() || [];
      if (lineas.length > 0) {
        const encLineas = [
          "ID Línea",
          "Producto",
          "Descripción",
          "Precio unitario",
          "Cantidad",
          "Descuento",
          "Tipo descuento",
          "Subtotal línea",
        ];
        const filasL = lineas.map((l) => {
          const sub =
            window.DescuentosEngine?.calcularSubtotalLinea?.(l) ??
            l.precioUnitario * l.cantidad;
          return [
            l._id,
            l.nombre,
            l.descripcion || "",
            l.precioUnitario,
            l.cantidad,
            l.descuento,
            l.tipoDescuento,
            Math.max(0, sub),
          ];
        });

        // Totales al pie
        const totales = window.DescuentosEngine?.recalcular?.(lineas);
        if (totales) {
          filasL.push([]);
          filasL.push([
            "",
            "",
            "Subtotal bruto",
            "",
            "",
            "",
            "",
            totales.subtotalBruto,
          ]);
          if (totales.descGlobalValor > 0) {
            filasL.push([
              "",
              "",
              "Descuento global",
              "",
              "",
              "",
              "",
              -totales.descGlobalValor,
            ]);
          }
          filasL.push([
            "",
            "",
            `IVA (${(window.DescuentosEngine.getTasaIva() * 100).toFixed(0)}%)`,
            "",
            "",
            "",
            "",
            totales.iva,
          ]);
          filasL.push(["", "", "TOTAL", "", "", "", "", totales.total]);
        }

        const wsLineas = XLSX.utils.aoa_to_sheet([encLineas, ...filasL]);
        wsLineas["!cols"] = [
          { wch: 18 },
          { wch: 34 },
          { wch: 38 },
          { wch: 16 },
          { wch: 8 },
          { wch: 10 },
          { wch: 14 },
          { wch: 18 },
        ];
        XLSX.utils.book_append_sheet(wb, wsLineas, "Líneas");
      }
    }

    XLSX.writeFile(wb, `${nombre}.xlsx`);
    window.mostrarToast?.(`✓ Excel exportado (${datos.length} cotizaciones)`);
  }

  function exportarCSVFallback(datos, nombre) {
    const utils = window.utilsExport;
    if (!utils) {
      console.error(
        "[Email] SheetJS no disponible y utilsExport no encontrado. Agrega el CDN de SheetJS en index.html.",
      );
      window.mostrarToast?.("⚠ No se pudo exportar: SheetJS no está cargado");
      return;
    }

    const encHead = [
      "ID",
      "Título",
      "Cliente",
      "Estado",
      "Monto",
      "Moneda",
      "Propietario",
      "Fecha creación",
      "Fecha vencimiento",
    ];
    const filas = datos.map((c) => [
      c.id,
      c.titulo,
      c.cliente || "",
      c.estado,
      c.cantidad,
      c.moneda,
      c.responsable || "",
      c.fechaCreacion,
      c.fechaVencimiento,
    ]);
    const csv =
      "﻿" +
      [encHead, ...filas]
        .map((r) => r.map((v) => utils.escaparCSV(v)).join(","))
        .join("\r\n");

    utils.descargarTexto(csv, `${nombre}.csv`);
    window.mostrarToast?.(
      `✓ CSV exportado (${datos.length} cotizaciones) — Instala SheetJS para .xlsx`,
    );
  }

  // -----------------------------------------------------------------
  // HELPERS PARA OBTENER LA COTIZACIÓN ACTIVA
  // -----------------------------------------------------------------

  function obtenerCotizacionActiva() {
    // 1. Modal de cotización abierto con data-cotizacion-id
    const modal = document.getElementById("modal-crear-cotizacion");
    if (modal && !modal.hasAttribute("hidden")) {
      const id = parseInt(modal.dataset.cotizacionId, 10);
      if (id)
        return (
          window.estadoApp?.datosOriginales?.find((c) => c.id === id) || null
        );

      // Si es una cotización nueva (no guardada aún), construirla desde el formulario
      return construirCotizacionDesdeForm();
    }

    // 2. Fila seleccionada en la tabla
    const fila = document.querySelector(
      "tr[data-id][aria-selected='true'], tr[data-id].seleccionado",
    );
    if (fila?.dataset.id) {
      return (
        window.estadoApp?.datosOriginales?.find(
          (c) => c.id === parseInt(fila.dataset.id, 10),
        ) || null
      );
    }

    return null;
  }

  function construirCotizacionDesdeForm() {
    return {
      id: null,
      titulo:
        document.getElementById("cot-titulo")?.value?.trim() || "Sin título",
      cliente: document.getElementById("cot-cliente")?.value?.trim() || "",
      negocio: document.getElementById("cot-negocio")?.value?.trim() || "",
      estado: document.getElementById("cot-estado")?.value || "borrador",
      cantidad: parseFloat(document.getElementById("cot-cantidad")?.value) || 0,
      moneda: document.getElementById("cot-moneda")?.value || "COP",
      responsable: document.getElementById("cot-propietario")?.value || "",
      fechaCreacion: document.getElementById("cot-fecha-creacion")?.value || "",
      fechaVencimiento:
        document.getElementById("cot-fecha-vencimiento")?.value || "",
      estadoFirma: "no_aplica",
    };
  }

  // -----------------------------------------------------------------
  // INICIALIZACIÓN DE EVENTOS
  // -----------------------------------------------------------------

  function initEventos() {
    // Botón "Enviar cotización por correo"
    document.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-accion-email='enviar']");
      if (!btn) return;

      const inputEmail = document.getElementById("cot-email-destinatario");
      const destinatario = inputEmail?.value?.trim();
      const cot = obtenerCotizacionActiva();

      if (!cot) {
        window.mostrarToast?.("⚠ No hay cotización activa para enviar");
        return;
      }

      // Estado: cargando
      const textoOriginal = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Enviando…";

      try {
        await enviarCotizacion(cot, destinatario);
        // El toast de éxito lo emite enviarCotizacion()
      } catch (err) {
        console.error(
          "[CotizacionEmail] Error al enviar vía Dapta:",
          err.message,
        );
        window.mostrarToast?.(`Error al enviar: ${err.message}`);
      } finally {
        // Restaurar botón independientemente del resultado
        btn.disabled = false;
        btn.textContent = textoOriginal;
      }
    });

    // Botones de exportación del histórico
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-accion-email='exportar']");
      if (!btn) return;

      const est = window.estadoApp;
      if (!est) {
        window.mostrarToast?.("⚠ Sin datos");
        return;
      }

      const alcance = btn.dataset.alcance || "visibles";
      const incluirLineas = btn.dataset.incluirLineas === "true";
      const datos =
        alcance === "todos" ? est.datosOriginales : est.datosVisibles;

      exportarHistorico(datos, { incluirLineas });
    });

    // Sincronizar campo de cantidad con totales cuando DescuentosEngine no está activo
    document.addEventListener("cotizacion:totales", (e) => {
      const totalEl = document.getElementById("cot-cantidad");
      if (totalEl && e.detail?.totales?.total) {
        totalEl.value = e.detail.totales.total;
      }
    });
  }

  // -----------------------------------------------------------------
  // INIT
  // -----------------------------------------------------------------

  document.addEventListener("DOMContentLoaded", () => {
    initEventos();

    window.CotizacionEmail = {
      REMITENTE,
      get DAPTA_WEBHOOK_URL() {
        return getDaptaUrl();
      },
      enviarCotizacion,
      construirPayloadDapta,
      exportarHistorico,
      construirCuerpoHTML,
      obtenerCotizacionActiva,
    };

    console.info(
      "[CotizacionEmail] Módulo listo. Remitente:",
      REMITENTE,
      "| Webhook Dapta:",
      getDaptaUrl(),
    );
  });
})();
