/* ============================================================
   COTIZACIONES-DESCUENTOS.JS
   Motor de descuentos en tiempo real para el módulo de
   Cotizaciones.

   Soporta:
   - Descuentos por línea de artículo: % o valor fijo ($).
   - Descuento global sobre el subtotal: % o valor fijo ($).
   - Tasa de IVA configurable (por defecto 19 %).
   - Recálculo automático cada vez que cambia cualquier valor
     en la tabla de líneas o en el panel de descuento global.

   Contratos de DOM (IDs esperados en index.html):
   ┌─────────────────────────────────────────────────┐
   │ Tabla de líneas (cotizaciones-productos.js):    │
   │   data-linea-campo / data-linea-id en inputs    │
   │   data-linea-subtotal="<_id>" en <td> de total │
   │                                                 │
   │ Resumen de totales:                             │
   │   #cot-resumen-subtotal  → subtotal bruto       │
   │   #cot-resumen-descuento → descuento global     │
   │   #cot-resumen-iva       → monto de IVA         │
   │   #cot-resumen-total     → total final          │
   │                                                 │
   │ Descuento global (#cot-descuento-global):       │
   │   data-desc-campo="valor"   → input número      │
   │   data-desc-campo="tipo"    → select %/$        │
   │   data-desc-campo="motivo"  → input texto       │
   │                                                 │
   │ Tasa IVA: #cot-tasa-iva  (input número, %)     │
   └─────────────────────────────────────────────────┘

   Expone: window.DescuentosEngine
   ============================================================ */
(function () {

  // Tasa de IVA por defecto — ajustable con #cot-tasa-iva
  let tasaIva = 0.19;

  // Estado del descuento global (se sincroniza con el DOM)
  const descGlobal = {
    valor:  0,
    tipo:   "porcentaje",  // "porcentaje" | "fijo"
    motivo: ""
  };

  // -----------------------------------------------------------------
  // CÁLCULOS PUROS (sin efectos secundarios)
  // -----------------------------------------------------------------

  /**
   * Subtotal de una línea después de aplicar su descuento individual.
   * Se reutiliza también en cotizaciones-productos.js.
   */
  function calcularSubtotalLinea(l) {
    const bruto = (l.precioUnitario || 0) * (l.cantidad || 1);
    if (!l.descuento || l.descuento <= 0) return bruto;

    if (l.tipoDescuento === "porcentaje") {
      return bruto * (1 - Math.min(l.descuento, 100) / 100);
    }
    return Math.max(0, bruto - l.descuento);
  }

  /**
   * Calcula todos los totales de la cotización.
   *
   * @param {Array}  lineas        - Líneas de artículo del módulo de productos.
   * @param {Object} descuentoG    - Descuento global { valor, tipo }.
   * @param {number} iva           - Tasa de IVA (ej: 0.19).
   * @returns {{ subtotalBruto, descGlobalValor, subtotalNeto, iva, total }}
   */
  function calcularTotales(lineas, descuentoG, iva) {
    const subtotalBruto = lineas.reduce((acc, l) => acc + calcularSubtotalLinea(l), 0);

    let descGlobalValor = 0;
    if (descuentoG.valor > 0) {
      descGlobalValor = descuentoG.tipo === "porcentaje"
        ? subtotalBruto * (Math.min(descuentoG.valor, 100) / 100)
        : Math.min(descuentoG.valor, subtotalBruto);
    }

    const subtotalNeto = Math.max(0, subtotalBruto - descGlobalValor);
    const montoIva     = Math.round(subtotalNeto * iva);
    const total        = subtotalNeto + montoIva;

    return {
      subtotalBruto:  Math.round(subtotalBruto),
      descGlobalValor: Math.round(descGlobalValor),
      subtotalNeto:   Math.round(subtotalNeto),
      iva:            montoIva,
      total:          Math.round(total)
    };
  }

  // -----------------------------------------------------------------
  // ACTUALIZACIONES DEL DOM
  // -----------------------------------------------------------------

  const fmt = v => window.formatearMoneda
    ? window.formatearMoneda(v, "COP")
    : new Intl.NumberFormat("es-CO").format(v);

  /** Actualiza la celda de subtotal de una línea específica. */
  function actualizarCeldaLinea(lineaId, valor) {
    const celda = document.querySelector(`[data-linea-subtotal="${lineaId}"]`);
    if (celda) celda.textContent = fmt(valor);
  }

  /** Actualiza el panel de resumen de totales. */
  function actualizarPanelResumen(totales) {
    const set = (id, texto) => {
      const el = document.getElementById(id);
      if (el) el.textContent = texto;
    };

    set("cot-resumen-subtotal",  fmt(totales.subtotalBruto));
    set("cot-resumen-iva",       fmt(totales.iva));
    set("cot-resumen-total",     fmt(totales.total));

    // Fila de descuento: solo visible cuando hay descuento aplicado
    const filaDesc = document.getElementById("cot-resumen-fila-descuento");
    const elDesc   = document.getElementById("cot-resumen-descuento");
    if (totales.descGlobalValor > 0) {
      if (elDesc)   elDesc.textContent = `- ${fmt(totales.descGlobalValor)}`;
      if (filaDesc) filaDesc.hidden = false;
    } else {
      if (filaDesc) filaDesc.hidden = true;
    }

    // Porcentaje de descuento global visible junto al campo
    const etiqPct = document.getElementById("cot-desc-pct-label");
    if (etiqPct && totales.subtotalBruto > 0 && totales.descGlobalValor > 0) {
      const pct = ((totales.descGlobalValor / totales.subtotalBruto) * 100).toFixed(1);
      etiqPct.textContent = `(${pct}% del subtotal)`;
      etiqPct.hidden = false;
    } else if (etiqPct) {
      etiqPct.hidden = true;
    }
  }

  // -----------------------------------------------------------------
  // RECÁLCULO PRINCIPAL
  // -----------------------------------------------------------------

  /**
   * Recalcula todos los subtotales de líneas y el resumen de totales.
   * Debe llamarse después de cualquier cambio de valor.
   *
   * @param {Array} lineas - Líneas actuales desde ProductosCotizacion.getLineas()
   * @returns {Object} totales calculados
   */
  function recalcular(lineas) {
    // 1. Actualizar subtotales individuales de cada línea
    lineas.forEach(l => actualizarCeldaLinea(l._id, calcularSubtotalLinea(l)));

    // 2. Calcular y actualizar el resumen
    const totales = calcularTotales(lineas, descGlobal, tasaIva);
    actualizarPanelResumen(totales);

    // 3. Notificar a otros módulos (p.ej. cotizaciones-email.js)
    document.dispatchEvent(new CustomEvent("cotizacion:totales", { detail: { totales, lineas } }));

    return totales;
  }

  // -----------------------------------------------------------------
  // SINCRONIZACIÓN DEL DESCUENTO GLOBAL DESDE EL DOM
  // -----------------------------------------------------------------

  function leerDescuentoGlobalDesdeDOM() {
    const cont = document.getElementById("cot-descuento-global");
    if (!cont) return;

    const inputValor  = cont.querySelector('[data-desc-campo="valor"]');
    const selectTipo  = cont.querySelector('[data-desc-campo="tipo"]');
    const inputMotivo = cont.querySelector('[data-desc-campo="motivo"]');

    descGlobal.valor  = parseFloat(inputValor?.value)  || 0;
    descGlobal.tipo   = selectTipo?.value               || "porcentaje";
    descGlobal.motivo = inputMotivo?.value?.trim()      || "";
  }

  function initDescuentoGlobal() {
    const cont = document.getElementById("cot-descuento-global");
    if (!cont) return;

    cont.addEventListener("input",  onCambioDescuentoGlobal);
    cont.addEventListener("change", onCambioDescuentoGlobal);
  }

  function onCambioDescuentoGlobal() {
    leerDescuentoGlobalDesdeDOM();
    const lineas = window.ProductosCotizacion?.getLineas?.() || [];
    recalcular(lineas);
  }

  // -----------------------------------------------------------------
  // ESCUCHA CAMBIOS EN LAS LÍNEAS (delegado en document)
  // Se dispara cuando cotizaciones-productos.js actualiza su estado
  // -----------------------------------------------------------------

  function initCambiosLineas() {
    // input: respuesta inmediata mientras se escribe
    document.addEventListener("input", (e) => {
      if (!esCampoLinea(e.target)) return;
      requestAnimationFrame(triggerRecalculo);
    });

    // change: respuesta al salir del campo o al cambiar el select
    document.addEventListener("change", (e) => {
      if (!esCampoLinea(e.target)) return;
      requestAnimationFrame(triggerRecalculo);
    });
  }

  function esCampoLinea(el) {
    return Boolean(el?.dataset?.lineaCampo && el?.dataset?.lineaId);
  }

  function triggerRecalculo() {
    const lineas = window.ProductosCotizacion?.getLineas?.() || [];
    recalcular(lineas);
  }

  // -----------------------------------------------------------------
  // TASA DE IVA CONFIGURABLE
  // -----------------------------------------------------------------

  function initConfigIva() {
    const inputIva = document.getElementById("cot-tasa-iva");
    if (!inputIva) return;

    // Precargar valor
    inputIva.value = (tasaIva * 100).toFixed(0);

    inputIva.addEventListener("input", () => {
      const nueva = (parseFloat(inputIva.value) || 0) / 100;
      tasaIva = Math.max(0, Math.min(nueva, 1)); // clamp 0–100%
      triggerRecalculo();
    });
  }

  // -----------------------------------------------------------------
  // INIT
  // -----------------------------------------------------------------

  document.addEventListener("DOMContentLoaded", () => {
    initDescuentoGlobal();
    initCambiosLineas();
    initConfigIva();

    window.DescuentosEngine = {
      recalcular,
      calcularTotales,
      calcularSubtotalLinea,

      /** Lee y devuelve el estado actual del descuento global. */
      getDescuentoGlobal: () => ({ ...descGlobal }),

      /** Aplica un descuento global programáticamente. */
      setDescuentoGlobal(d) {
        Object.assign(descGlobal, d);
        // Sincronizar con el DOM si el panel existe
        const cont = document.getElementById("cot-descuento-global");
        if (cont) {
          const iv = cont.querySelector('[data-desc-campo="valor"]');
          const st = cont.querySelector('[data-desc-campo="tipo"]');
          if (iv) iv.value = d.valor ?? descGlobal.valor;
          if (st) st.value = d.tipo  ?? descGlobal.tipo;
        }
        const lineas = window.ProductosCotizacion?.getLineas?.() || [];
        recalcular(lineas);
      },

      /** Devuelve la tasa de IVA actual (0–1). */
      getTasaIva: () => tasaIva,

      /** Cambia la tasa de IVA programáticamente (valor entre 0 y 1). */
      setTasaIva(nueva) {
        tasaIva = Math.max(0, Math.min(nueva, 1));
        const el = document.getElementById("cot-tasa-iva");
        if (el) el.value = (tasaIva * 100).toFixed(0);
        triggerRecalculo();
      }
    };
  });

})();
