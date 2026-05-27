/* ============================================================
   CAJA-INTERACTIONS.JS
   Popovers, modales, panel lateral de detalle y configuración
   del módulo Caja.
   ============================================================ */
(function () {

  /* ---------- POPOVERS ---------- */
  const Popovers = {
    activo: null, triggerActivo: null,
    posicionar(p, t) {
      const rt = t.getBoundingClientRect();
      p.style.visibility = "hidden";
      p.removeAttribute("hidden");
      const rp = p.getBoundingClientRect();
      let top = rt.bottom + 6;
      let left = rt.left;
      if (left + rp.width > window.innerWidth - 10) left = rt.right - rp.width;
      if (left < 10) left = 10;
      if (top + rp.height > window.innerHeight - 10) {
        top = rt.top - rp.height - 6;
        if (top < 10) top = 10;
      }
      p.style.top = top + "px";
      p.style.left = left + "px";
      p.style.visibility = "visible";
    },
    abrir(id, trigger) {
      if (this.activo && this.activo.id === id) { this.cerrar(); return; }
      this.cerrar();
      const p = document.getElementById(id);
      if (!p) return;
      this.posicionar(p, trigger);
      this.activo = p;
      this.triggerActivo = trigger;
      if (trigger.setAttribute) trigger.setAttribute("aria-expanded", "true");
    },
    cerrar() {
      if (this.activo) this.activo.setAttribute("hidden", "");
      if (this.triggerActivo && this.triggerActivo.setAttribute) {
        this.triggerActivo.setAttribute("aria-expanded", "false");
      }
      this.activo = null;
      this.triggerActivo = null;
    },
    init() {
      document.addEventListener("click", (e) => {
        const t = e.target.closest("[data-popover]");
        if (t) { e.stopPropagation(); this.abrir(t.getAttribute("data-popover"), t); return; }
        if (this.activo && !this.activo.contains(e.target)) this.cerrar();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && this.activo) this.cerrar();
      });
      window.addEventListener("resize", () => {
        if (this.activo && this.triggerActivo) this.posicionar(this.activo, this.triggerActivo);
      });
    }
  };

  /* ---------- MODALES ---------- */
  const Modales = {
    abrir(id) {
      const m = document.getElementById(id);
      if (!m) return;
      m.removeAttribute("hidden");
      document.body.style.overflow = "hidden";
    },
    cerrar(m) {
      if (!m) return;
      m.setAttribute("hidden", "");
      document.body.style.overflow = "";
    },
    init() {
      document.addEventListener("click", (e) => {
        const b = e.target.closest("[data-cerrar-modal]");
        if (b) {
          const o = b.closest(".modal-overlay");
          this.cerrar(o);
        }
        if (e.target.classList && e.target.classList.contains("modal-overlay")) this.cerrar(e.target);
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          const o = document.querySelector(".modal-overlay:not([hidden])");
          if (o) this.cerrar(o);
        }
      });
    }
  };

  /* ---------- PANEL CONFIGURACIÓN ---------- */
  const PanelConfig = {
    abrir() {
      const p = document.getElementById("panel-config-tabla");
      if (p) {
        // Cerrar panel de detalle si está abierto (no superponer)
        PanelDetalle.cerrar();
        p.classList.add("abierto");
      }
    },
    cerrar() {
      const p = document.getElementById("panel-config-tabla");
      if (p) p.classList.remove("abierto");
    },
    init() {
      const btn = document.getElementById("btn-config-tabla");
      if (btn) btn.addEventListener("click", () => this.abrir());
      document.addEventListener("click", (e) => {
        if (e.target.closest("[data-cerrar-panel]")) this.cerrar();
      });
    }
  };

  /* ---------- EDITAR MOVIMIENTO ---------- */
  const EditarMovimiento = {
    _mov: null,

    abrir(mov) {
      if (!mov) return;
      this._mov = mov;
      const titulo = document.getElementById("editar-mov-titulo");
      if (titulo) titulo.textContent = `Editar ${mov.tipo === "ingreso" ? "ingreso" : "gasto"}`;

      document.getElementById("editar-mov-id").value = mov.id;
      document.getElementById("editar-mov-tipo").value = mov.tipo;
      document.getElementById("editar-categoria").value = mov.categoria || "otros";
      document.getElementById("editar-valor").value = mov.valor || 0;
      document.getElementById("editar-moneda").value = mov.moneda || "COP";
      document.getElementById("editar-fecha").value = mov.fecha || "";
      document.getElementById("editar-responsable").value = mov.responsable || "";
      document.getElementById("editar-metodo").value = mov.metodoPago || "efectivo";
      document.getElementById("editar-descripcion").value = mov.descripcion || "";
      document.getElementById("editar-estado").value = mov.estado || "pagado";
      document.getElementById("editar-cliente").value = mov.cliente || "";
      document.getElementById("editar-observaciones").value = mov.observaciones || "";

      Modales.abrir("modal-editar-movimiento");
    },

    guardar() {
      const id = parseInt(document.getElementById("editar-mov-id").value, 10);
      const mov = window.estadoApp.datosOriginales.find(m => m.id === id);
      if (!mov) return;

      mov.categoria    = document.getElementById("editar-categoria").value;
      mov.valor        = parseFloat(document.getElementById("editar-valor").value) || 0;
      mov.moneda       = document.getElementById("editar-moneda").value;
      mov.fecha        = document.getElementById("editar-fecha").value;
      mov.responsable  = document.getElementById("editar-responsable").value;
      mov.metodoPago   = document.getElementById("editar-metodo").value;
      mov.descripcion  = document.getElementById("editar-descripcion").value.trim();
      mov.estado       = document.getElementById("editar-estado").value;
      mov.cliente      = document.getElementById("editar-cliente").value.trim();
      mov.observaciones = document.getElementById("editar-observaciones").value.trim();

      if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
      if (window.actualizarDashboard) window.actualizarDashboard();
      if (window.vistasInstance) window.vistasInstance.renderizar();

      if (PanelDetalle.movimientoActual?.id === id) PanelDetalle.renderizar(mov);

      Modales.cerrar(document.getElementById("modal-editar-movimiento"));
      window.mostrarToast("✓ Movimiento actualizado");
    },

    init() {
      const btnGuardar = document.getElementById("guardar-editar-movimiento");
      if (btnGuardar) btnGuardar.addEventListener("click", () => this.guardar());
    }
  };

  /* ---------- PANEL DE DETALLE DE MOVIMIENTO ---------- */
  const PanelDetalle = {
    movimientoActual: null,
    abrir(mov) {
      const p = document.getElementById("panel-detalle-movimiento");
      if (!p || !mov) return;
      PanelConfig.cerrar();
      this.movimientoActual = mov;
      this.renderizar(mov);
      p.classList.add("abierto");

      document.querySelectorAll(".tabla-cotizaciones tbody tr.fila-activa")
        .forEach(tr => tr.classList.remove("fila-activa"));
      const fila = document.querySelector(`.tabla-cotizaciones tbody tr[data-id="${mov.id}"]`);
      if (fila) fila.classList.add("fila-activa");
    },
    cerrar() {
      const p = document.getElementById("panel-detalle-movimiento");
      if (p) p.classList.remove("abierto");
      this.movimientoActual = null;
      // Quitar fila activa
      document.querySelectorAll(".tabla-cotizaciones tbody tr.fila-activa")
        .forEach(tr => tr.classList.remove("fila-activa"));
    },
    renderizar(m) {
      const $ = (id) => document.getElementById(id);

      // Avatar grande
      const avatar = $("detalle-avatar");
      avatar.className = "panel-detalle__avatar panel-detalle__avatar--" + m.tipo;
      avatar.innerHTML = m.tipo === "ingreso"
        ? `<svg viewBox="0 0 24 24" width="24" height="24"><path fill="#fff" d="M12 3 5 10h4v8h6v-8h4l-7-7Z"/></svg>`
        : `<svg viewBox="0 0 24 24" width="24" height="24"><path fill="#fff" d="M12 21 5 14h4V6h6v8h4l-7 7Z"/></svg>`;

      $("detalle-titulo").textContent = m.descripcion;
      $("detalle-subtitulo").textContent = `${window.etiquetaCategoria(m.categoria)} · ${m.referencia}`;

      const monto = $("detalle-monto");
      const signo = m.tipo === "ingreso" ? "+ " : "− ";
      monto.textContent = signo + window.formatearMoneda(m.valor, m.moneda);
      monto.className = "panel-detalle__monto panel-detalle__monto--" + m.tipo;

      $("detalle-tipo").innerHTML = `<span class="tipo-badge tipo-badge--${m.tipo}">${window.etiquetaTipo(m.tipo)}</span>`;
      $("detalle-fecha").textContent = window.formatearFecha(m.fecha);
      $("detalle-responsable").textContent = m.responsable;
      $("detalle-metodo").textContent = window.etiquetaMetodoPago(m.metodoPago);
      $("detalle-estado").innerHTML = `<span class="estado-badge"><span class="estado-dot estado-dot--${m.estado}"></span>${window.etiquetaEstado(m.estado)}</span>`;

      $("detalle-categoria").textContent = window.etiquetaCategoria(m.categoria);
      $("detalle-cliente").textContent = m.cliente || "—";
      $("detalle-observaciones").textContent = m.observaciones || "Sin observaciones registradas.";

      // Adjunto
      const adjunto = $("detalle-adjunto");
      if (m.adjunto) {
        adjunto.innerHTML = `
          <div class="panel-detalle__adjunto-icono"><svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"/></svg></div>
          <div style="flex:1;">
            <div style="color:var(--color-texto);font-weight:500;">${m.adjunto}</div>
            <div style="font-size:11px;">Click para descargar</div>
          </div>`;
        adjunto.style.cursor = "pointer";
      } else {
        adjunto.innerHTML = `
          <div class="panel-detalle__adjunto-icono" style="opacity:0.5;"><svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"/></svg></div>
          <div style="flex:1;font-style:italic;">Sin adjuntos</div>`;
        adjunto.style.cursor = "default";
      }

      $("actividad-creador").textContent = m.responsable;
      $("actividad-creacion").textContent = window.formatearFecha(m.fecha);
      $("actividad-actualizacion").textContent = window.formatearFecha(m.fecha);
    },
    ejecutarAccion(accion) {
      const m = this.movimientoActual;
      if (!m) return;
      switch (accion) {
        case "editar":
          EditarMovimiento.abrir(m);
          break;

        case "duplicar": {
          const nuevoId = Math.max(...window.estadoApp.datosOriginales.map(x => x.id)) + 1;
          const copia = { ...m, id: nuevoId, descripcion: m.descripcion + " (copia)", estado: "pendiente" };
          window.estadoApp.datosOriginales.unshift(copia);
          if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
          if (window.actualizarDashboard) window.actualizarDashboard();
          if (window.vistasInstance) window.vistasInstance.renderizar();
          window.mostrarToast(`✓ Movimiento duplicado`);
          break;
        }

        case "descargar":
          descargarMovimientoComoPDF(m);
          break;

        case "anular":
          if (confirm(`¿Anular el movimiento "${m.descripcion}"?`)) {
            m.estado = "anulado";
              if (window.Api) {
                window.Api.caja.actualizar(this.movimientoActual.id, { estado: "anulado" }).catch(e =>
                  console.warn("[Caja] API anular movimiento falló:", e.message)
                );
              }
            if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
            if (window.actualizarDashboard) window.actualizarDashboard();
            if (window.vistasInstance) window.vistasInstance.renderizar();
            window.mostrarToast("✓ Movimiento anulado");
            this.cerrar();
          }
          break;
      }
    },

    init() {
      document.addEventListener("click", (e) => {
        if (e.target.closest("[data-cerrar-detalle]")) this.cerrar();
      });

      // Toggle de secciones colapsables (chevron)
      document.addEventListener("click", (e) => {
        const titulo = e.target.closest("[data-toggle-seccion]");
        if (!titulo) return;
        const seccion = titulo.closest(".panel-detalle__seccion--colapsable");
        if (seccion) seccion.classList.toggle("colapsado");
      });

      // Botones circulares y popover de acciones — delegación
      document.addEventListener("click", (e) => {
        const btnCirc = e.target.closest("[data-accion-caja]");
        if (btnCirc) { this.ejecutarAccion(btnCirc.dataset.accionCaja); return; }

        const btnMenu = e.target.closest("[data-accion-caja-menu]");
        if (btnMenu) {
          this.ejecutarAccion(btnMenu.dataset.accionCajaMenu);
          Popovers.cerrar();
        }
      });
    }
  };

  /* ---------- DESCARGA PDF DE MOVIMIENTO ---------- */
  function descargarMovimientoComoPDF(m) {
    const estilos = [...document.querySelectorAll('link[rel="stylesheet"]')]
      .map(l => `<link rel="stylesheet" href="${l.href}">`)
      .join("\n");

    const signo = m.tipo === "ingreso" ? "+" : "−";
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${m.descripcion}</title>
  ${estilos}
  <style>
    @page { size: A4; margin: 20mm; }
    body { font-family: Inter, sans-serif; color: #111; background: #fff; margin: 0; }
    .mov-pdf { max-width: 680px; margin: 0 auto; }
    .mov-pdf__cabecera { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; }
    .mov-pdf__empresa { font-size: 22px; font-weight: 700; color: #111; }
    .mov-pdf__tipo { font-size: 13px; color: #6b7280; margin-top: 4px; }
    .mov-pdf__monto { font-size: 28px; font-weight: 700; }
    .mov-pdf__monto--ingreso { color: #059669; }
    .mov-pdf__monto--gasto { color: #dc2626; }
    .mov-pdf__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 32px; margin-bottom: 32px; }
    .mov-pdf__campo-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
    .mov-pdf__campo-valor { font-size: 14px; color: #111; }
    .mov-pdf__obs { border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #374151; }
    .mov-pdf__pie { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
  </style>
</head>
<body>
  <div class="mov-pdf">
    <div class="mov-pdf__cabecera">
      <div>
        <div class="mov-pdf__empresa">Oblicua</div>
        <div class="mov-pdf__tipo">Comprobante de ${window.etiquetaTipo ? window.etiquetaTipo(m.tipo) : m.tipo}</div>
      </div>
      <div class="mov-pdf__monto mov-pdf__monto--${m.tipo}">${signo} ${window.formatearMoneda ? window.formatearMoneda(m.valor, m.moneda) : m.valor}</div>
    </div>
    <div class="mov-pdf__grid">
      <div><div class="mov-pdf__campo-label">Descripción</div><div class="mov-pdf__campo-valor">${m.descripcion}</div></div>
      <div><div class="mov-pdf__campo-label">Referencia</div><div class="mov-pdf__campo-valor">${m.referencia || "—"}</div></div>
      <div><div class="mov-pdf__campo-label">Fecha</div><div class="mov-pdf__campo-valor">${window.formatearFecha ? window.formatearFecha(m.fecha) : m.fecha}</div></div>
      <div><div class="mov-pdf__campo-label">Categoría</div><div class="mov-pdf__campo-valor">${window.etiquetaCategoria ? window.etiquetaCategoria(m.categoria) : m.categoria}</div></div>
      <div><div class="mov-pdf__campo-label">Responsable</div><div class="mov-pdf__campo-valor">${m.responsable}</div></div>
      <div><div class="mov-pdf__campo-label">Método de pago</div><div class="mov-pdf__campo-valor">${window.etiquetaMetodoPago ? window.etiquetaMetodoPago(m.metodoPago) : m.metodoPago}</div></div>
      <div><div class="mov-pdf__campo-label">Estado</div><div class="mov-pdf__campo-valor">${window.etiquetaEstado ? window.etiquetaEstado(m.estado) : m.estado}</div></div>
      <div><div class="mov-pdf__campo-label">Cliente</div><div class="mov-pdf__campo-valor">${m.cliente || "—"}</div></div>
    </div>
    ${m.observaciones ? `<div class="mov-pdf__campo-label" style="margin-bottom:8px;">Observaciones</div><div class="mov-pdf__obs">${m.observaciones}</div>` : ""}
    <div class="mov-pdf__pie">Generado por Sistema de Caja · Oblicua</div>
  </div>
  <scr` + `ipt>
    window.addEventListener("load", function() {
      window.print();
      setTimeout(function() { window.close(); }, 300);
    });
  </scr` + `ipt>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const ventana = window.open(url, "_blank");
    if (!ventana) window.mostrarToast("⚠ Permite ventanas emergentes para descargar el PDF");
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  /* ---------- SELECTOR DE OBJETOS ---------- */
  function initSelectorObjetos() {
    const popover = document.getElementById("popover-objetos");
    if (!popover) return;
    const input = popover.querySelector('[data-buscar="objetos"]');
    if (input) {
      input.addEventListener("input", (e) => {
        const q = e.target.value.toLowerCase();
        popover.querySelectorAll(".popover__item").forEach(it => {
          it.style.display = it.textContent.toLowerCase().includes(q) ? "" : "none";
        });
      });
    }
  }

  /* ---------- TAB MENU ---------- */
  function initTabMenu() {
    let vistaTarget = null;

    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".tab__menu");
      if (btn) {
        vistaTarget = btn.dataset.vistaTarget;

        const vista = window.estadoApp?.vistas?.find(v => v.id === vistaTarget);
        const popover = document.getElementById("popover-tab-menu");

        if (popover) {
          popover.querySelector('[data-accion="tab-rename"]')?.classList.toggle("popover__item--deshabilitado", !!vista?.fija);
          popover.querySelector('[data-accion="tab-eliminar"]')?.classList.toggle("popover__item--deshabilitado", !!vista?.fija);
        }
      }
    }, true);

    const popover = document.getElementById("popover-tab-menu");
    if (!popover) return;

    popover.addEventListener("click", (e) => {
      const item = e.target.closest("[data-accion]");
      if (!item || item.classList.contains("popover__item--deshabilitado")) return;

      const accion = item.dataset.accion;
      if (!vistaTarget || !window.vistasInstance) return;

      if (accion === "tab-rename") {
        Popovers.cerrar();
        requestAnimationFrame(() => {
          window.vistasInstance.iniciarEdicionInline(vistaTarget);
        });
        return;
      }

      if (accion === "tab-clonar") {
        window.vistasInstance.clonarVista(vistaTarget);
        Popovers.cerrar();
        return;
      }

      if (accion === "tab-eliminar") {
        window.vistasInstance.cerrarVista(vistaTarget);
        Popovers.cerrar();
        return;
      }

      Popovers.cerrar();
    });
  }

  /* ---------- TAB + ---------- */
  function initTabAdd() {
    const popover = document.getElementById("popover-tab-add");
    if (!popover) return;
    popover.addEventListener("click", (e) => {
      const accion = e.target.closest("[data-accion]")?.dataset.accion;
      if (!accion) return;
      Popovers.cerrar();
      if (accion === "crear-vista") {
        if (window.vistasInstance && typeof window.vistasInstance.crearVistaInline === "function") {
          window.vistasInstance.crearVistaInline();
        }
      }
      if (accion === "agregar-vista") {
        Modales.abrir("modal-agregar-vista");
      }
    });
  }

  /* ---------- CABECERA MENU ----------
     El botón "Exportar" del toolbar abre un popover (data-popover) gestionado
     por `caja-export.js`. Aquí solo manejamos las opciones secundarias
     del menú de 3 puntos. */
  function initCabeceraMenu() {
    const popover = document.getElementById("popover-cabecera-menu");
    if (popover) {
      popover.addEventListener("click", (e) => {
        const accion = e.target.closest("[data-accion]")?.dataset.accion;
        if (!accion) return;
        if (accion === "cab-informes") {
          mostrarInformesCaja();
          Popovers.cerrar();
          return;
        }
        if (accion === "cab-cierre")              window.mostrarToast("🔒 Iniciando cierre diario de caja...");
        if (accion === "cab-config-comisiones")   Modales.abrir("modal-config-comisiones");
        if (accion === "cab-reporte-comisiones")  Modales.abrir("modal-reporte-comisiones");
        Popovers.cerrar();
      });
    }
  }

  /**
   * Modal de Informes de caja: agrupa por categoría con conteos y total.
   */
  function mostrarInformesCaja() {
    const est = window.estadoApp;
    if (!est) return;

    const ingresos = est.datosOriginales.filter(m => m.tipo === "ingreso");
    const gastos   = est.datosOriginales.filter(m => m.tipo === "gasto");
    const totalIng = ingresos.reduce((s, m) => s + (m.valor || 0), 0);
    const totalGas = gastos.reduce((s, m) => s + (m.valor || 0), 0);

    const kpis = document.getElementById("informes-kpis");
    if (kpis) {
      kpis.innerHTML = `
        <div class="reporte-comisiones__kpi">
          <div class="reporte-comisiones__kpi-titulo">Total ingresos</div>
          <div class="reporte-comisiones__kpi-valor">${window.formatearMoneda(totalIng, "COP")}</div>
          <div class="reporte-comisiones__kpi-sub">${ingresos.length} movimientos</div>
        </div>
        <div class="reporte-comisiones__kpi">
          <div class="reporte-comisiones__kpi-titulo">Total gastos</div>
          <div class="reporte-comisiones__kpi-valor">${window.formatearMoneda(totalGas, "COP")}</div>
          <div class="reporte-comisiones__kpi-sub">${gastos.length} movimientos</div>
        </div>
        <div class="reporte-comisiones__kpi">
          <div class="reporte-comisiones__kpi-titulo">Balance</div>
          <div class="reporte-comisiones__kpi-valor">${window.formatearMoneda(totalIng - totalGas, "COP")}</div>
          <div class="reporte-comisiones__kpi-sub">Ingresos − Gastos</div>
        </div>
      `;
    }

    // Agrupar por categoría
    const grupos = {};
    est.datosOriginales.forEach(m => {
      const k = m.categoria || "—";
      if (!grupos[k]) grupos[k] = { count: 0, total: 0 };
      grupos[k].count++;
      grupos[k].total += (m.tipo === "gasto" ? -1 : 1) * (m.valor || 0);
    });

    const tbody = document.getElementById("informes-tbody");
    if (tbody) {
      tbody.innerHTML = Object.keys(grupos).sort().map(k => `
        <tr>
          <td>${window.etiquetaCategoria ? window.etiquetaCategoria(k) : k}</td>
          <td class="num">${grupos[k].count}</td>
          <td class="num">${window.formatearMoneda(grupos[k].total, "COP")}</td>
        </tr>
      `).join("");
    }

    Modales.abrir("modal-informes");
  }

  /* ---------- REGISTRAR GASTO / INGRESO ---------- */
  function initFormGasto() {
    const btnG        = document.getElementById("btn-registrar-gasto");
    const btnI        = document.getElementById("btn-registrar-ingreso");
    const modal       = document.getElementById("modal-registrar-gasto");
    const tituloModal = modal?.querySelector(".modal__titulo");
    const tipoInput   = document.getElementById("form-tipo-mov");
    const selectCat   = document.getElementById("g-categoria");
    const inputValor  = document.getElementById("g-valor");
    const wrapProd    = document.getElementById("g-producto-comision-wrap");
    const inputProd   = document.getElementById("g-producto-comision");
    const selectResp  = document.getElementById("g-responsable");
    const inputDesc   = document.getElementById("g-descripcion");

    // Activar / desactivar el bloque de comisión
    function modoComision(activo) {
      if (wrapProd) wrapProd.hidden = !activo;
      if (inputValor) {
        inputValor.readOnly = activo;
        inputValor.classList.toggle("form-input--readonly", activo);
        if (!activo) inputValor.value = "";
      }
      if (!activo && inputProd) {
        inputProd.value = "";
        delete inputProd.dataset.prodId;
        delete inputProd.dataset.prodPrecio;
      }
    }

    // Calcular comisión cuando hay producto + responsable
    function calcularComisionGasto() {
      if (selectCat?.value !== "comisiones") return;
      const precio      = parseFloat(inputProd?.dataset?.prodPrecio) || 0;
      const responsable = selectResp?.value?.trim() || "";
      const producto    = inputProd?.value?.trim()  || "";
      const prodId      = inputProd?.dataset?.prodId || "";
      if (!precio || !responsable || !producto) return;

      let cfg = { porAsesor: [], porProducto: [] };
      try { cfg = JSON.parse(localStorage.getItem("caja:configComisiones")) || cfg; } catch (_) {}

      // Prioridad 1: regla por producto
      const reglaProd = (cfg.porProducto || []).find(p =>
        (p.productoId && p.productoId === prodId) ||
        (p.producto || "").toLowerCase() === producto.toLowerCase()
      );
      // Prioridad 2: regla del asesor activo
      const reglaAsesor = (cfg.porAsesor || [])
        .filter(a => a.activo !== false)
        .find(a => (a.responsable || "").toLowerCase() === responsable.toLowerCase());

      const regla = reglaProd || reglaAsesor;
      if (!regla) {
        window.mostrarToast?.("⚠ Sin regla de comisión para ese producto/asesor");
        return;
      }

      const comision = Math.round(precio * regla.porcentaje / 100);
      if (inputValor) inputValor.value = comision;
      if (inputDesc)  inputDesc.value  = `Pago de comisión a ${responsable} por venta de ${producto}`;
    }

    function abrirComo(tipo) {
      tipoInput.value = tipo;
      modoComision(false);  // siempre resetear al abrir

      if (tipo === "ingreso") {
        tituloModal.textContent = "Registrar ingreso";
        selectCat.innerHTML = `
          <option value="servicios">Cobro por servicios</option>
          <option value="otros">Reembolso</option>
          <option value="otros">Otros ingresos</option>`;
      } else {
        tituloModal.textContent = "Registrar gasto";
        selectCat.innerHTML = `
          <option value="alimentacion">Alimentación</option>
          <option value="transporte">Transporte</option>
          <option value="papeleria">Papelería</option>
          <option value="publicidad">Publicidad</option>
          <option value="comisiones">Comisiones</option>
          <option value="servicios">Servicios públicos</option>
          <option value="tramites">Trámites</option>
          <option value="otros">Otros</option>`;
      }
      document.getElementById("g-fecha").value = new Date().toISOString().split("T")[0];
      Modales.abrir("modal-registrar-gasto");
    }

    if (btnG) btnG.addEventListener("click", () => abrirComo("gasto"));
    if (btnI) btnI.addEventListener("click", () => abrirComo("ingreso"));

    // Cambio de categoría → toggle modo comisión
    if (selectCat) {
      selectCat.addEventListener("change", () => {
        modoComision(selectCat.value === "comisiones");
        calcularComisionGasto();
      });
    }

    // Responsable cambia mientras la categoría es "comisiones" → recalcular
    if (selectResp) {
      selectResp.addEventListener("change", calcularComisionGasto);
    }

    // Autocomplete seleccionó un producto → recalcular
    if (modal) {
      modal.addEventListener("autocomplete:seleccionado", calcularComisionGasto);
    }

    const btnGuardar = document.getElementById("guardar-movimiento");
    if (btnGuardar) {
      btnGuardar.addEventListener("click", async () => {
        const tipo          = tipoInput.value;
        const categoria     = selectCat.value;
        const valor         = parseFloat(inputValor.value) || 0;
        const moneda        = document.getElementById("g-moneda").value;
        const fecha         = document.getElementById("g-fecha").value;
        const responsable   = selectResp.value;
        const metodoPago    = document.getElementById("g-metodo").value;
        const descripcion   = inputDesc.value.trim();
        const estado        = document.getElementById("g-estado").value;
        const cliente       = document.getElementById("g-cliente").value.trim();
        const observaciones = document.getElementById("g-observaciones").value.trim();

        if (!descripcion) { window.mostrarToast("⚠ La descripción es obligatoria"); return; }
        if (!valor || valor <= 0) { window.mostrarToast("⚠ Ingresa un valor válido"); return; }
        if (!fecha) { window.mostrarToast("⚠ La fecha es obligatoria"); return; }

        const nuevo = {
          fecha, tipo, categoria, descripcion, responsable,
          valor, moneda, estado, metodoPago, observaciones,
          cliente, adjunto: null
        };

        if (window.Api) {
          try {
            btnGuardar.disabled = true;
            const resp = await window.Api.caja.crear(nuevo);
            nuevo.id        = resp.id;
            nuevo.referencia = resp.referencia ?? ("REF-" + new Date(fecha).getFullYear() + "-" + String(resp.id).padStart(4, "0"));
          } catch (e) {
            console.warn("[Caja] API crear movimiento falló, usando ID local:", e.message);
          } finally {
            btnGuardar.disabled = false;
          }
        }
        if (!nuevo.id) {
          nuevo.id = window.estadoApp.datosOriginales.length
            ? Math.max(...window.estadoApp.datosOriginales.map(m => m.id)) + 1
            : 1;
          nuevo.referencia = "REF-" + new Date(fecha).getFullYear() + "-" + String(nuevo.id).padStart(4, "0");
        }

        window.estadoApp.datosOriginales.unshift(nuevo);

        document.getElementById("form-gasto").reset();
        modoComision(false);  // limpiar modo comisión tras guardar
        Modales.cerrar(modal);

        if (window.vistasInstance) window.vistasInstance.renderizar();
        if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
        if (window.actualizarDashboard) window.actualizarDashboard();

        const etiq = tipo === "ingreso" ? "Ingreso" : "Gasto";
        window.mostrarToast(`✓ ${etiq} de ${window.formatearMoneda(valor, moneda)} registrado`);
      });
    }

    // Inicializar autocomplete para el modal de gasto (carga diferida via API)
    if (modal) {
      window.configComisionesAPI?.initAutocompletoProd?.(modal);
    }
  }

  /* ---------- EDITAR COLUMNAS Y ORDENAR ---------- */
  function initEditarColumnas() {
    const btn = document.getElementById("btn-editar-columnas");
    if (btn) btn.addEventListener("click", () => Modales.abrir("modal-editar-columnas"));

    const modal = document.getElementById("modal-editar-columnas");
    if (!modal) return;

    const colDisponibles  = modal.querySelector(".editar-columnas__col:first-child .editar-columnas__lista");
    const colSeleccionadas = modal.querySelector(".editar-columnas__col:last-child .editar-columnas__lista");

    function actualizarContador() {
      const cont = document.getElementById("contador-cols");
      if (cont && colSeleccionadas) {
        cont.textContent = colSeleccionadas.querySelectorAll(".editar-columnas__seleccionada").length;
      }
    }

    function crearSeleccionada(texto) {
      const div = document.createElement("div");
      div.className = "editar-columnas__seleccionada";
      div.innerHTML = `<span class="editar-columnas__drag">⋮⋮</span>${texto}<button class="editar-columnas__remover">×</button>`;
      return div;
    }

    // Buscar
    const inputBuscar = modal.querySelector('input[type="search"]');
    if (inputBuscar) {
      inputBuscar.addEventListener("input", (e) => {
        const q = e.target.value.toLowerCase();
        modal.querySelectorAll(".editar-columnas__opt").forEach(opt => {
          opt.style.display = opt.textContent.toLowerCase().includes(q) ? "" : "none";
        });
      });
    }

    // Check izquierda → agrega/quita derecha
    if (colDisponibles) {
      colDisponibles.addEventListener("change", (e) => {
        const cb = e.target.closest('input[type="checkbox"]');
        if (!cb) return;
        const label = cb.closest(".editar-columnas__opt");
        const texto = label ? label.textContent.trim() : "";
        if (!texto) return;
        if (cb.checked) {
          const yaExiste = [...colSeleccionadas.querySelectorAll(".editar-columnas__seleccionada")]
            .some(d => d.textContent.replace("⋮⋮", "").replace("×", "").trim() === texto);
          if (!yaExiste) {
            colSeleccionadas.appendChild(crearSeleccionada(texto));
            actualizarContador();
          }
        } else {
          [...colSeleccionadas.querySelectorAll(".editar-columnas__seleccionada")]
            .forEach(d => {
              if (d.textContent.replace("⋮⋮", "").replace("×", "").trim() === texto) {
                d.remove(); actualizarContador();
              }
            });
        }
      });
    }

    // Remover desde derecha
    if (colSeleccionadas) {
      colSeleccionadas.addEventListener("click", (e) => {
        const x = e.target.closest(".editar-columnas__remover");
        if (!x) return;
        e.stopPropagation();
        const row = x.closest(".editar-columnas__seleccionada");
        if (row) {
          const texto = row.textContent.replace("⋮⋮", "").replace("×", "").trim();
          row.remove();
          actualizarContador();
          [...modal.querySelectorAll(".editar-columnas__opt")]
            .forEach(lbl => {
              if (lbl.textContent.trim() === texto) {
                const cb = lbl.querySelector('input[type="checkbox"]');
                if (cb) cb.checked = false;
              }
            });
        }
      });
    }

    // Aplicar
    const btnAplicar = modal.querySelector(".modal__footer .btn--naranja");
    if (btnAplicar) {
      btnAplicar.addEventListener("click", () => {
        const total = colSeleccionadas?.querySelectorAll(".editar-columnas__seleccionada").length || 0;
        Modales.cerrar(modal);
        window.mostrarToast(`✓ Configuración de columnas aplicada (${total} columnas)`);
      });
    }
  }

  function initOrdenar() {
    const popover = document.getElementById("popover-ordenar");
    if (!popover) return;
    const select = popover.querySelector("#select-orden");
    if (select) {
      select.addEventListener("change", (e) => {
        if (window.tablaInstance) {
          window.estadoApp.ordenColumna = e.target.value;
          window.tablaInstance.ordenarPorColumna(e.target.value);
          window.tablaInstance.ordenarPorColumna(e.target.value);
        }
      });
    }
    popover.querySelectorAll(".popover-ordenar__dir button").forEach(btn => {
      btn.addEventListener("click", () => {
        popover.querySelectorAll(".popover-ordenar__dir button").forEach(b => b.classList.remove("activo"));
        btn.classList.add("activo");
        window.estadoApp.ordenDireccion = btn.dataset.dir;
        if (window.tablaInstance) window.tablaInstance.renderizar();
      });
    });

    // Buscador interno (si existe)
    const inputBuscar = popover.querySelector(".popover__buscar-input");
    if (inputBuscar) {
      inputBuscar.addEventListener("input", (e) => {
        const q = e.target.value.toLowerCase();
        popover.querySelectorAll(".popover__lista .popover__item").forEach(item => {
          item.style.display = item.textContent.toLowerCase().includes(q) ? "" : "none";
        });
      });
    }

    popover.querySelectorAll(".popover__lista .popover__item").forEach(it => {
      it.addEventListener("click", () => {
        popover.querySelectorAll(".popover__lista .popover__item")
          .forEach(i => i.classList.remove("popover__item--seleccionado"));
        it.classList.add("popover__item--seleccionado");
        window.mostrarToast(`Ordenando por: ${it.textContent.trim()}`);
      });
    });
  }

  /* ---------- TOGGLE FILTROS RÁPIDOS ---------- */
  function initToggleFiltros() {
    const btn = document.getElementById("btn-toggle-filtros");
    const fila = document.getElementById("filtros-rapidos");
    if (!btn || !fila) return;
    btn.addEventListener("click", () => {
      const visible = !fila.hasAttribute("hidden");
      if (visible) {
        fila.setAttribute("hidden", "");
        btn.classList.remove("btn--activo");
        btn.setAttribute("aria-pressed", "false");
      } else {
        fila.removeAttribute("hidden");
        btn.classList.add("btn--activo");
        btn.setAttribute("aria-pressed", "true");
      }
    });
  }

  /* ---------- VISTA DE TABLA ---------- */
  function initVistaTabla() {
    const popover = document.getElementById("popover-vista-tabla");
    if (!popover) return;
    popover.addEventListener("click", (e) => {
      const item = e.target.closest("[data-vista-tipo]");
      if (!item) return;
      popover.querySelectorAll("[data-vista-tipo]")
        .forEach(i => i.classList.remove("popover__item--seleccionado"));
      item.classList.add("popover__item--seleccionado");
      const tipo = item.dataset.vistaTipo;
      const label = document.getElementById("lbl-vista-tabla");
      const nombres = { tabla: "Vista de tabla", tablero: "Vista de tablero", lista: "Vista de lista" };
      if (label) label.textContent = nombres[tipo] || "Vista de tabla";
      if (tipo === "tabla") {
        window.mostrarToast("✓ Mostrando vista de tabla");
      } else {
        window.mostrarToast(`📋 La vista "${nombres[tipo]}" estará disponible próximamente`);
      }
      Popovers.cerrar();
    });
  }

  /* ---------- BOTÓN VISTA PREVIA EN FILA (columna Descripción) ---------- */
  function initClickFilasCaja() {
    const tbody = document.getElementById("tbody-cotizaciones");
    if (!tbody) return;

    tbody.addEventListener("click", (e) => {
      const btnVP = e.target.closest(".btn-vista-previa-fila");
      if (btnVP) {
        e.stopPropagation();
        const id = parseInt(btnVP.dataset.cotId, 10);
        const mov = window.estadoApp.datosOriginales.find(m => m.id === id);
        if (mov && window.PanelDetalle) window.PanelDetalle.abrir(mov);
        return;
      }

      const linkTitulo = e.target.closest(".celda-titulo__link");
      if (linkTitulo) {
        e.preventDefault();
        e.stopPropagation();
        const tr = linkTitulo.closest("tr[data-id]");
        if (!tr) return;
        const id = parseInt(tr.dataset.id, 10);
        const mov = window.estadoApp.datosOriginales.find(m => m.id === id);
        if (mov) EditarMovimiento.abrir(mov);
        return;
      }
    });

    tbody.addEventListener("mouseenter", (e) => {
      const tr = e.target.closest && e.target.closest("tr[data-id]");
      if (!tr) return;
      if (tr.querySelector(".btn-vista-previa-fila")) return;
      const id = tr.dataset.id;
      const td = tr.querySelector(".celda-titulo")?.closest("td");
      if (!td) return;
      td.classList.add("td-vista-previa");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-vista-previa-fila";
      btn.dataset.cotId = id;
      btn.textContent = "Vista previa";
      td.appendChild(btn);
    }, true);
  }

  /* ---------- DUPLICAR VISTA ACTIVA ---------- */
  function initDuplicarVista() {
    const btn = document.getElementById("btn-duplicar-vista");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const id = window.estadoApp?.vistaActivaId;
      if (id && window.vistasInstance) {
        window.vistasInstance.clonarVista(id);
      }
    });
  }

  /* ---------- FILTROS PILL ---------- */
  function initFiltrosPill() {
    // Poblar categorías
    const listaCat = document.getElementById("lista-categorias");
    if (listaCat) {
      listaCat.innerHTML = window.categoriasCatalogo.map(c => `
        <label class="check-lista__item">
          <input type="checkbox" data-cat="${c.valor}"/>
          <span>${c.icono}</span>
          ${c.nombre}
        </label>
      `).join("");
      listaCat.addEventListener("change", (e) => {
        if (e.target.matches('input[type="checkbox"]')) {
          window.estadoApp.filtros.categoria = [...listaCat.querySelectorAll('input:checked')].map(c => c.dataset.cat);
          if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
        }
      });
    }

    // Poblar asesores
    const listaAse = document.getElementById("lista-asesores");
    if (listaAse) {
      const unicos = [...new Set(window.estadoApp.datosOriginales.map(m => m.responsable))].sort();
      listaAse.innerHTML = unicos.map(n => `
        <label class="check-lista__item">
          <input type="checkbox" data-ase="${n}"/>
          <span class="celda-avatar__circulo" style="width:22px;height:22px;font-size:10px;">${window.obtenerIniciales(n)}</span>
          ${n}
        </label>
      `).join("");
      listaAse.addEventListener("change", (e) => {
        if (e.target.matches('input[type="checkbox"]')) {
          window.estadoApp.filtros.asesor = [...listaAse.querySelectorAll('input:checked')].map(c => c.dataset.ase);
          if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
        }
      });
    }

    // TIPO
    const popTipo = document.getElementById("popover-filtro-tipo");
    if (popTipo) {
      popTipo.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener("change", () => {
          window.estadoApp.filtros.tipo = [...popTipo.querySelectorAll('input:checked')].map(c => c.dataset.filtroVal);
          if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
        });
      });
    }

    // FECHA — presets + rango personalizado
    const popFecha = document.getElementById("popover-filtro-fecha");
    if (popFecha) {
      // Presets (clic directo aplica)
      popFecha.querySelectorAll(".popover__item[data-filtro-val]").forEach(it => {
        it.addEventListener("click", () => {
          const v = it.dataset.filtroVal;
          window.estadoApp.filtros.fecha = v || null;
          // Limpiar inputs del rango personalizado
          const inDesde = document.getElementById("filtro-fecha-desde");
          const inHasta = document.getElementById("filtro-fecha-hasta");
          if (inDesde) inDesde.value = "";
          if (inHasta) inHasta.value = "";
          if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
          Popovers.cerrar();
        });
      });

      // Rango personalizado: Aplicar / Limpiar
      popFecha.querySelectorAll("[data-fecha-accion]").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const accion = btn.dataset.fechaAccion;
          const inDesde = document.getElementById("filtro-fecha-desde");
          const inHasta = document.getElementById("filtro-fecha-hasta");
          if (accion === "limpiar") {
            if (inDesde) inDesde.value = "";
            if (inHasta) inHasta.value = "";
            window.estadoApp.filtros.fecha = null;
            if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
            Popovers.cerrar();
            return;
          }
          if (accion === "aplicar") {
            const desde = inDesde ? inDesde.value : "";
            const hasta = inHasta ? inHasta.value : "";
            if (!desde && !hasta) {
              window.mostrarToast("⚠ Selecciona al menos una fecha");
              return;
            }
            if (desde && hasta && desde > hasta) {
              window.mostrarToast("⚠ La fecha 'Desde' no puede ser posterior a 'Hasta'");
              return;
            }
            window.estadoApp.filtros.fecha = {
              desde: desde || null,
              hasta: hasta || null
            };
            if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
            Popovers.cerrar();
          }
        });
      });
    }

    // ESTADO
    const popEst = document.getElementById("popover-filtro-estado");
    if (popEst) {
      popEst.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener("change", () => {
          window.estadoApp.filtros.estado = [...popEst.querySelectorAll('input:checked')].map(c => c.dataset.filtroVal);
          if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
        });
      });
    }
  }

  /* ---------- EDITAR FILTROS RÁPIDOS ---------- */
  function initEditarFiltros() {
    const btn = document.getElementById("btn-edit-filtros");
    if (btn) btn.addEventListener("click", () => Modales.abrir("modal-editar-filtros"));

    const modal = document.getElementById("modal-editar-filtros");
    if (!modal) return;
    modal.addEventListener("click", (e) => {
      const r = e.target.closest(".popover-fila-editor__remover");
      if (r) {
        e.stopPropagation();
        const row = r.closest(".popover-fila-editor__item");
        if (row) row.remove();
        const cont = document.getElementById("contador-filtros");
        if (cont) cont.textContent = modal.querySelectorAll(".popover-fila-editor__item").length;
      }
    });
  }

  /* ---------- PANEL CONFIG ---------- */
  function initConfigTabla() {
    const panel = document.getElementById("panel-config-tabla");
    if (!panel) return;
    panel.querySelectorAll('input[name="tamano-pag"]').forEach(rb => {
      rb.addEventListener("change", (e) => {
        const v = parseInt(e.target.value, 10);
        aplicarTamanoPagina(v);
      });
    });
    panel.querySelectorAll('input[name="altura"]').forEach(rb => {
      rb.addEventListener("change", (e) => {
        window.estadoApp.configTabla.altura = e.target.value;
        if (window.tablaInstance) window.tablaInstance.aplicarConfigTabla();
      });
    });
    const sw = document.getElementById("switch-zebra");
    if (sw) sw.addEventListener("click", () => {
      sw.classList.toggle("activo");
      window.estadoApp.configTabla.zebra = sw.classList.contains("activo");
      if (window.tablaInstance) window.tablaInstance.aplicarConfigTabla();
    });
  }

  /* ---------- TARJETAS RESUMEN ----------
     Las tarjetas son sólo informativas: muestran los totales
     calculados a partir de la vista activa. Ya no son clickeables
     ni aplican filtros. La actualización de sus valores la
     dispara `aplicarFiltros()` (caja-filters.js) llamando a
     `actualizarDashboard()` cada vez que cambia la vista o un
     filtro. */
  function initTarjetasResumen() {
    // intencionalmente vacío: sin listeners de click
  }

  function aplicarTamanoPagina(v) {
    window.estadoApp.registrosPorPagina = v;
    window.estadoApp.paginaActual = 1;

    const lbl = document.getElementById("lbl-tamano");
    if (lbl) lbl.textContent = `${v} por página`;

    const radio = document.querySelector(`input[name="tamano-pag"][value="${v}"]`);
    if (radio) radio.checked = true;

    if (window.tablaInstance) window.tablaInstance.renderizar();
  }

  function initTamanoPagina() {
    const popover = document.getElementById("popover-tamano-pagina");
    if (!popover) return;

    popover.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-page-size]");
      if (!btn) return;

      const v = parseInt(btn.dataset.pageSize, 10);
      if (!v) return;

      aplicarTamanoPagina(v);
      Popovers.cerrar();
    });
  }

  /* ---------- MODAL AGREGAR VISTA ---------- */
  function initModalAgregarVista() {
    const modal = document.getElementById("modal-agregar-vista");
    if (!modal) return;

    const CATALOGO = {
      todos: {
        nombre: "Todos los movimientos",
        categoria: "sistema",
        creador: "Proporcionado por el sistema",
        tipo: "Tabla",
        descripcion: "Muestra todos los movimientos sin ningún filtro aplicado.",
        filtrosDesc: [],
        filtro: () => true
      },
      solo_ingresos: {
        nombre: "Solo ingresos",
        categoria: "sistema",
        creador: "Proporcionado por el sistema",
        tipo: "Tabla",
        descripcion: "Muestra únicamente los movimientos de tipo ingreso.",
        filtrosDesc: ["Tipo: Ingreso"],
        filtro: (m) => m.tipo === "ingreso"
      },
      solo_gastos: {
        nombre: "Solo gastos",
        categoria: "sistema",
        creador: "Proporcionado por el sistema",
        tipo: "Tabla",
        descripcion: "Muestra únicamente los movimientos de tipo gasto.",
        filtrosDesc: ["Tipo: Gasto"],
        filtro: (m) => m.tipo === "gasto"
      },
      gastos_mes: {
        nombre: "Gastos del mes",
        categoria: "sistema",
        creador: "Proporcionado por el sistema",
        tipo: "Tabla",
        descripcion: "Gastos registrados durante el mes en curso.",
        filtrosDesc: ["Tipo: Gasto", "Fecha: Mes actual"],
        filtro: (m) => {
          const f = new Date(m.fecha);
          const hoy = new Date();
          return m.tipo === "gasto" && f.getFullYear() === hoy.getFullYear() && f.getMonth() === hoy.getMonth();
        }
      },
      ingresos_mes: {
        nombre: "Ingresos del mes",
        categoria: "sistema",
        creador: "Proporcionado por el sistema",
        tipo: "Tabla",
        descripcion: "Ingresos registrados durante el mes en curso.",
        filtrosDesc: ["Tipo: Ingreso", "Fecha: Mes actual"],
        filtro: (m) => {
          const f = new Date(m.fecha);
          const hoy = new Date();
          return m.tipo === "ingreso" && f.getFullYear() === hoy.getFullYear() && f.getMonth() === hoy.getMonth();
        }
      },
      pendientes: {
        nombre: "Pendientes",
        categoria: "sistema",
        creador: "Proporcionado por el sistema",
        tipo: "Tabla",
        descripcion: "Movimientos cuyo pago aún no ha sido procesado.",
        filtrosDesc: ["Estado: Pendiente"],
        filtro: (m) => m.estado === "pendiente"
      },
      sin_conciliar: {
        nombre: "Sin conciliar",
        categoria: "sistema",
        creador: "Proporcionado por el sistema",
        tipo: "Tabla",
        descripcion: "Movimientos pendientes o en borrador que requieren conciliación.",
        filtrosDesc: ["Estado: Pendiente", "Estado: Borrador"],
        filtro: (m) => m.estado === "pendiente" || m.estado === "borrador"
      },
      publicidad: {
        nombre: "Gastos de publicidad",
        categoria: "admin",
        creador: "Recomendado por administrador",
        tipo: "Tabla",
        descripcion: "Todos los gastos asociados a campañas publicitarias y marketing.",
        filtrosDesc: ["Categoría: Publicidad"],
        filtro: (m) => m.categoria === "publicidad"
      }
    };

    let vistaSeleccionada = "todos";
    const inputBuscar = document.getElementById("modal-vistas-buscar");
    const selectCat = document.getElementById("modal-vistas-categoria");
    const lista = document.getElementById("modal-vistas-lista");

    function estaAgregada(id) {
      return !!(window.estadoApp?.vistas?.find(v => v.id === id));
    }

    function actualizarEstadoAgregadas() {
      modal.querySelectorAll(".modal-vistas__item").forEach(item => {
        item.classList.toggle("modal-vistas__item--agregada", estaAgregada(item.dataset.vista));
      });
    }

    function actualizarDetalle(id) {
      const cat = CATALOGO[id];
      if (!cat) return;

      document.getElementById("modal-vistas-det-titulo").textContent = cat.nombre;
      document.getElementById("modal-vistas-det-desc").textContent = cat.descripcion;
      document.getElementById("modal-vistas-det-creador").textContent = cat.creador;
      document.getElementById("modal-vistas-det-tipo").textContent = cat.tipo;

      const filtrosEl = document.getElementById("modal-vistas-det-filtros");
      filtrosEl.innerHTML = cat.filtrosDesc.length === 0
        ? `<span class="modal-vistas__vacio">Esta vista no tiene filtros aplicados.</span>`
        : `<ul class="modal-vistas__filtros-lista">${cat.filtrosDesc.map(f =>
            `<li><span class="modal-vistas__filtro-dot"></span>${f}</li>`
          ).join("")}</ul>`;

      const cabecera = modal.querySelector(".modal-vistas__detalle-cabecera");
      let badge = modal.querySelector(".modal-vistas__ya-agregada");
      if (estaAgregada(id)) {
        if (!badge) {
          badge = document.createElement("div");
          badge.className = "modal-vistas__ya-agregada";
          badge.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z"/></svg> Ya está en tus vistas`;
          cabecera.insertAdjacentElement("afterend", badge);
        }
      } else {
        badge?.remove();
      }
    }

    function filtrarLista() {
      const q = (inputBuscar?.value || "").toLowerCase().trim();
      const cat = selectCat?.value || "";
      const visiblePorGrupo = {};

      modal.querySelectorAll(".modal-vistas__item").forEach(item => {
        const nombre = (item.querySelector(".modal-vistas__item-nombre")?.textContent || "").toLowerCase();
        const itemCat = item.dataset.categoria || "";
        const visible = (!q || nombre.includes(q)) && (!cat || itemCat === cat);
        item.style.display = visible ? "" : "none";
        if (visible) visiblePorGrupo[itemCat] = true;
      });

      modal.querySelectorAll(".modal-vistas__grupo").forEach(g => {
        const gCat = g.dataset.grupo;
        g.style.display = (!cat || gCat === cat) && visiblePorGrupo[gCat] ? "" : "none";
      });
    }

    lista?.addEventListener("click", (e) => {
      const item = e.target.closest(".modal-vistas__item");
      if (!item || item.classList.contains("modal-vistas__item--agregada")) return;
      modal.querySelectorAll(".modal-vistas__item--seleccionado").forEach(i => i.classList.remove("modal-vistas__item--seleccionado"));
      item.classList.add("modal-vistas__item--seleccionado");
      vistaSeleccionada = item.dataset.vista;
      actualizarDetalle(vistaSeleccionada);
    });

    inputBuscar?.addEventListener("input", filtrarLista);
    selectCat?.addEventListener("change", filtrarLista);

    const btnAgregar = document.getElementById("confirmar-agregar-vista");
    if (btnAgregar) {
      btnAgregar.addEventListener("click", () => {
        if (!vistaSeleccionada) return;
        if (estaAgregada(vistaSeleccionada)) {
          window.mostrarToast?.("Esa vista ya está en tus pestañas");
          return;
        }
        const cat = CATALOGO[vistaSeleccionada];
        if (cat && window.vistasInstance) {
          window.vistasInstance.agregarVista(vistaSeleccionada, cat.nombre, cat.filtro);
          window.mostrarToast?.(`✓ Vista "${cat.nombre}" agregada`);
        }
        Modales.cerrar(modal);
      });
    }

    new MutationObserver(() => {
      if (!modal.hidden) {
        actualizarEstadoAgregadas();
        modal.querySelectorAll(".modal-vistas__item--seleccionado").forEach(i => i.classList.remove("modal-vistas__item--seleccionado"));
        const preferido = modal.querySelector(`.modal-vistas__item[data-vista="todos"]:not(.modal-vistas__item--agregada)`)
          || modal.querySelector(".modal-vistas__item:not(.modal-vistas__item--agregada)");
        if (preferido) {
          preferido.classList.add("modal-vistas__item--seleccionado");
          vistaSeleccionada = preferido.dataset.vista;
        }
        actualizarDetalle(vistaSeleccionada);
        if (inputBuscar) inputBuscar.value = "";
        if (selectCat) selectCat.value = "";
        filtrarLista();
      }
    }).observe(modal, { attributes: true, attributeFilter: ["hidden"] });
  }

  /* ---------- INIT ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    Popovers.init();
    Modales.init();
    PanelConfig.init();
    PanelDetalle.init();

    initSelectorObjetos();
    initTabMenu();
    initTabAdd();
    initModalAgregarVista();
    initCabeceraMenu();
    initFormGasto();
    initEditarColumnas();
    initOrdenar();
    initFiltrosPill();
    initEditarFiltros();
    initConfigTabla();
    initTarjetasResumen();
    initTamanoPagina();

    EditarMovimiento.init();
    initToggleFiltros();
    initVistaTabla();
    initDuplicarVista();
    initClickFilasCaja();

    window.Popovers = Popovers;
    window.Modales = Modales;
    window.PanelConfig = PanelConfig;
    window.PanelDetalle = PanelDetalle;

    console.log("[Caja] UI interactions inicializadas");
  });
})();