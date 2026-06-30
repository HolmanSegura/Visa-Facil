/* ============================================================
   COTIZACIONES-EMAIL.JS
   Envío de cotizaciones por correo y exportación de histórico
   a Excel (.xlsx) o CSV como fallback.

   CORREO:
   ┌───────────────────────────────────────────────────────┐
   │ Remitente fijo:  contabilidadvisafacil@gmail.com      │
   │ Reply-To:        email del asesor (HubSpot owner)     │
   │                                                       │
   │ Middleware: Dapta (webhook POST)                       │
   │   Envía un payload JSON estructurado a la URL         │
   │   configurada en DAPTA_WEBHOOK_URL. Dapta se encarga  │
   │   de construir y despachar el correo al destinatario. │
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
  const REMITENTE = "contabilidadvisafacil@gmail.com";
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
    return `Cotización: ${cot.titulo || "Sin título"} — Visa Fácil Internacional`;
  }

  function obtenerEmailAsesor(cot) {
    const owners = window.ownersCatalogo;
    if (!Array.isArray(owners) || !cot.responsable) return "";
    const owner = owners.find(o => o.nombre === cot.responsable);
    return owner?.email || "";
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

    const emailAsesor = obtenerEmailAsesor(cot);
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
      `Asesor: ${cot.responsable || "—"}${emailAsesor ? " · " + emailAsesor : ""}`,
      "",
      "Para aceptar esta cotización o solicitar cambios, contacta directamente a tu asesor.",
      "",
      `—————`,
      `Enviado por contabilidadvisafacil@gmail.com · Visa Fácil Internacional SAS`,
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

    const emailAsesor = obtenerEmailAsesor(cot);

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Cotización — Visa Fácil Internacional</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f4f4f4;color:#333333;">

<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:30px 0;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,0.1);">

        <!-- HEADER -->
        <tr>
          <td style="background-color:#003366;padding:25px;text-align:center;">
            <img src="https://50772182.fs1.hubspotusercontent-na1.net/hubfs/50772182/LOGO%20VISA%20FACIL%202025.jpeg"
                 alt="Visa Fácil Logo" width="180"
                 style="display:block;margin:0 auto;">
          </td>
        </tr>

        <!-- SALUDO -->
        <tr>
          <td style="padding:28px 28px 0;">
            <h2 style="color:#003366;margin:0 0 12px;font-size:20px;">
              Estimado/a <span style="text-transform:capitalize;">${escHtml(cot.cliente || "cliente")}</span>,
            </h2>
            <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#444;">
              Adjunto encontrará la cotización <strong>${escHtml(cot.titulo)}</strong> elaborada por su asesor.
              Quedo atento/a a sus comentarios.
            </p>
            <p style="margin:0 0 8px;font-size:13px;color:#777;">
              Válida hasta: <strong>${fmtF(cot.fechaVencimiento)}</strong>
              &nbsp;·&nbsp; Moneda: <strong>${escHtml(cot.moneda || "COP")}</strong>
            </p>
          </td>
        </tr>

        <!-- TABLA DE PRODUCTOS -->
        ${lineas && lineas.length > 0 ? `
        <tr>
          <td style="padding:20px 28px 0;">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border-collapse:collapse;font-size:13px;">
              <thead>
                <tr style="background-color:#f8f9fa;">
                  <th style="padding:9px 10px;text-align:left;border-bottom:2px solid #003366;color:#003366;font-weight:700;">Descripción</th>
                  <th style="padding:9px 10px;text-align:right;border-bottom:2px solid #003366;color:#003366;font-weight:700;white-space:nowrap;">P. Unitario</th>
                  <th style="padding:9px 10px;text-align:center;border-bottom:2px solid #003366;color:#003366;font-weight:700;">Cant.</th>
                  <th style="padding:9px 10px;text-align:center;border-bottom:2px solid #003366;color:#003366;font-weight:700;">Dcto.</th>
                  <th style="padding:9px 10px;text-align:right;border-bottom:2px solid #003366;color:#003366;font-weight:700;">Total</th>
                </tr>
              </thead>
              <tbody>${filasLineas}</tbody>
            </table>
          </td>
        </tr>` : ""}

        <!-- TOTALES -->
        <tr>
          <td style="padding:16px 28px 0;">
            <table width="280" cellpadding="0" cellspacing="0"
                   style="margin-left:auto;font-size:13px;border-collapse:collapse;">
              <tr>
                <td style="padding:5px 0;color:#777;">Subtotal</td>
                <td style="padding:5px 0;text-align:right;">${fmt(subtotalB)}</td>
              </tr>
              ${descValor > 0 ? `
              <tr>
                <td style="padding:5px 0;color:#777;">Descuento</td>
                <td style="padding:5px 0;text-align:right;color:#cc0000;">− ${fmt(descValor)}</td>
              </tr>` : ""}
              <tr>
                <td style="padding:5px 0;color:#777;">IVA (${(iva * 100).toFixed(0)}%)</td>
                <td style="padding:5px 0;text-align:right;">${fmt(montoIva)}</td>
              </tr>
              <tr>
                <td colspan="2"><hr style="border:none;border-top:2px solid #003366;margin:8px 0;"></td>
              </tr>
              <tr>
                <td style="padding:4px 0;font-weight:700;font-size:15px;color:#003366;">TOTAL</td>
                <td style="padding:4px 0;text-align:right;font-weight:700;font-size:15px;color:#003366;">${fmt(totalFinal)}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- TIP -->
        <tr>
          <td style="padding:20px 28px;">
            <p style="margin:0;background-color:#fff8e1;padding:12px 14px;font-size:13px;
                       color:#8a6d3b;border-radius:4px;border-left:3px solid #f5c6cb;line-height:1.5;">
              💡 <strong>Tip:</strong> Agrega nuestro correo y número de WhatsApp a tus contactos
              para recibir todas las notificaciones de tu proceso a tiempo.
            </p>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background-color:#f8f9fa;padding:20px 28px;text-align:center;border-top:3px solid #003366;">
            <p style="margin:0 0 6px;font-size:14px;font-weight:bold;color:#003366;">
              Tu asesor de contacto
            </p>
            <p style="margin:0 0 4px;font-size:14px;color:#333;">
              ${escHtml(cot.responsable || "Visa Fácil")}
            </p>
            ${emailAsesor ? `
            <p style="margin:0 0 10px;font-size:13px;">
              <a href="mailto:${escHtml(emailAsesor)}" style="color:#003366;">
                ${escHtml(emailAsesor)}
              </a>
            </p>` : ""}
            <p style="margin:10px 0 4px;font-size:13px;color:#555;">
              📞 (+57) 302 261 1777 &nbsp;|&nbsp; (+57) 300 587 7788
            </p>
            <p style="margin:12px 0 0;font-size:12px;color:#999;line-height:1.6;">
              <strong>Visa Fácil Internacional SAS</strong><br>
              Carrera 50 # 24 - 60, Bogotá, D.C.<br>
              Facilitadores expertos en procesos migratorios desde 1999.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

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
    const tasaIva     = window.DescuentosEngine?.getTasaIva?.() ?? 0.19;
    const emailAsesor = obtenerEmailAsesor(cot);

    return {
      // Metadatos del envío
      remitente:   REMITENTE,
      replyTo:     emailAsesor || REMITENTE,
      destinatario,
      asunto: construirAsunto(cot),
      fechaEnvio: new Date().toISOString(),

      // Datos del cliente / negocio
      cliente: {
        nombre:      cot.cliente || "",
        empresa:     cot.cliente || "",
        negocio:     cot.negocio || "",
        responsable: cot.responsable || "",
        emailAsesor,
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

    // Notificar a otros módulos (ej: historial de emails en ui-interactions.js)
    document.dispatchEvent(new CustomEvent("cotizacion:emailEnviado", {
      detail: { cotizacionId: cot.id, destinatario }
    }));

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
      console.error("[Email] utilsExport no encontrado.");
      window.mostrarToast?.("⚠ No se pudo exportar");
      return;
    }

    const encHead = [
      "ID", "Título", "Cliente", "Estado", "Monto",
      "Moneda", "Propietario", "Fecha creación", "Fecha vencimiento",
    ];
    const filas = datos.map((c) => [
      c.id, c.titulo, c.cliente || "", c.estado, c.cantidad,
      c.moneda, c.responsable || "", c.fechaCreacion, c.fechaVencimiento,
    ]);

    const blob = utils.matrizAXLSX([encHead, ...filas]);
    utils.descargarBlob(blob, `${nombre}.xlsx`);
    window.mostrarToast?.(`✓ Excel exportado (${datos.length} cotizaciones)`);
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

      // Validar campos obligatorios antes de enviar
      if (!cot.titulo) {
        window.mostrarToast?.("⚠ La cotización debe tener nombre");
        return;
      }
      if (!cot.cliente) {
        window.mostrarToast?.("⚠ La cotización debe tener empresa o cliente");
        return;
      }
      if (!cot.responsable) {
        window.mostrarToast?.("⚠ La cotización debe tener propietario");
        return;
      }
      const _pv = cot.puntoVenta || document.getElementById("cot-punto-venta")?.value || "";
      if (!_pv) {
        window.mostrarToast?.("⚠ La cotización debe tener punto de venta");
        return;
      }
      const _lineas = cot.lineas?.length
        ? cot.lineas
        : (window.ProductosCotizacion?.getLineas?.() || []);
      if (_lineas.length === 0 && !(cot.cantidad > 0)) {
        window.mostrarToast?.("⚠ La cotización debe tener al menos un producto");
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
      "[CotizacionEmail] Módulo listo. Remitente:", REMITENTE,
      "| Reply-To: email asesor (window.ownersCatalogo)",
      "| Webhook Dapta:", getDaptaUrl(),
    );
  });
})();
