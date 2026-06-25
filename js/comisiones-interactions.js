/* ============================================================
   COMISIONES-INTERACTIONS.JS
   Popovers, modales, panel de detalle, config de comisiones
   y todas las interacciones UI del módulo Comisiones.
   ============================================================ */
(function () {

  /* ================================================================
     POPOVERS
     ================================================================ */
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
      if (top + rp.height > window.innerHeight - 10) { top = rt.top - rp.height - 6; if (top < 10) top = 10; }
      p.style.top = top + "px"; p.style.left = left + "px"; p.style.visibility = "visible";
    },
    abrir(id, trigger) {
      if (this.activo && this.activo.id === id) { this.cerrar(); return; }
      this.cerrar();
      const p = document.getElementById(id);
      if (!p) return;
      this.posicionar(p, trigger);
      this.activo = p; this.triggerActivo = trigger;
      if (trigger.setAttribute) trigger.setAttribute("aria-expanded", "true");
    },
    cerrar() {
      if (this.activo) this.activo.setAttribute("hidden", "");
      if (this.triggerActivo?.setAttribute) this.triggerActivo.setAttribute("aria-expanded", "false");
      this.activo = null; this.triggerActivo = null;
    },
    init() {
      document.addEventListener("click", e => {
        const t = e.target.closest("[data-popover]");
        if (t) { e.stopPropagation(); this.abrir(t.getAttribute("data-popover"), t); return; }
        if (this.activo && !this.activo.contains(e.target)) this.cerrar();
      });
      document.addEventListener("keydown", e => { if (e.key === "Escape" && this.activo) this.cerrar(); });
      window.addEventListener("resize", () => { if (this.activo && this.triggerActivo) this.posicionar(this.activo, this.triggerActivo); });
    }
  };

  /* ================================================================
     MODALES
     ================================================================ */
  const Modales = {
    abrir(id) {
      const m = typeof id === "string" ? document.getElementById(id) : id;
      if (!m) return;
      m.removeAttribute("hidden");
      document.body.style.overflow = "hidden";
    },
    cerrar(m) {
      if (!m) return;
      if (typeof m === "string") m = document.getElementById(m);
      m?.setAttribute("hidden", "");
      document.body.style.overflow = "";
    },
    init() {
      document.addEventListener("click", e => {
        if (e.target.closest("[data-cerrar-modal]")) {
          const o = e.target.closest(".modal-overlay");
          this.cerrar(o);
        }
        if (e.target.classList?.contains("modal-overlay")) this.cerrar(e.target);
      });
      document.addEventListener("keydown", e => {
        if (e.key === "Escape") {
          const o = document.querySelector(".modal-overlay:not([hidden])");
          if (o) this.cerrar(o);
        }
      });
    }
  };

  /* ================================================================
     PANEL CONFIGURACIÓN TABLA
     ================================================================ */
  const PanelConfig = {
    abrir() { const p = document.getElementById("panel-config-tabla"); if (p) { PanelDetalle.cerrar(); p.classList.add("abierto"); } },
    cerrar() { document.getElementById("panel-config-tabla")?.classList.remove("abierto"); },
    init() {
      document.getElementById("btn-config-tabla")?.addEventListener("click", () => this.abrir());
      document.addEventListener("click", e => { if (e.target.closest("[data-cerrar-panel]")) this.cerrar(); });
    }
  };

  /* ================================================================
     PANEL DE DETALLE DE COMISIÓN
     ================================================================ */
  const PanelDetalle = {
    filaActual: null,

    abrir(row) {
      const p = document.getElementById("panel-detalle-com");
      if (!p || !row) return;
      PanelConfig.cerrar();
      this.filaActual = row;
      this.renderizar(row);
      p.classList.add("abierto");

      document.querySelectorAll(".tabla-comisiones tbody tr.fila-activa")
        .forEach(tr => tr.classList.remove("fila-activa"));
      const fila = document.querySelector(`.tabla-comisiones tbody tr[data-id="${row.id}"]`);
      if (fila) fila.classList.add("fila-activa");
    },

    cerrar() {
      document.getElementById("panel-detalle-com")?.classList.remove("abierto");
      document.querySelectorAll(".tabla-comisiones tbody tr.fila-activa")
        .forEach(tr => tr.classList.remove("fila-activa"));
      this.filaActual = null;
    },

    renderizar(r) {
      const $ = id => document.getElementById(id);

      // Avatar
      const avatar = $("detalle-avatar");
      if (avatar) {
        avatar.className = "panel-detalle__avatar panel-detalle__avatar--comision";
        avatar.textContent = window.obtenerIniciales(r.responsable || "?");
        avatar.style.fontSize = "18px";
        avatar.style.fontWeight = "700";
        avatar.style.color = "#fff";
      }

      if ($("detalle-titulo")) $("detalle-titulo").textContent = r.responsable;
      if ($("detalle-subtitulo")) $("detalle-subtitulo").textContent = r.activo === false ? "Asesor inactivo" : "Asesor activo";

      const monto = $("detalle-monto");
      if (monto) {
        monto.textContent = window.formatearMoneda(r.teorico, "COP");
        monto.className = "panel-detalle__monto panel-detalle__monto--comision";
      }

      // Campos del desglose
      const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };

      set("detalle-ingresos", window.formatearMoneda(r.ingresos, "COP"));
      set("detalle-porcentaje", `${(r.porcentaje || 0).toFixed(1)}%`);
      set("detalle-teorico", window.formatearMoneda(r.teorico, "COP"));
      set("detalle-registrado", window.formatearMoneda(r.registrado, "COP"));
      set("detalle-pagos", r.pagos);

      const elDif = $("detalle-diferencia");
      if (elDif) {
        const signo = r.diferencia >= 0 ? "+" : "";
        elDif.textContent = signo + window.formatearMoneda(r.diferencia, "COP");
        elDif.style.color = r.diferencia > 0 ? "#059669" : r.diferencia < 0 ? "#dc2626" : "inherit";
      }

      if ($("detalle-estado")) {
        $("detalle-estado").innerHTML = `<span class="estado-badge"><span class="estado-dot estado-dot--${r.estado}"></span>${window.etiquetaEstado(r.estado)}</span>`;
      }

      // Período activo
      const per = window.estadoApp?.periodoActual;
      if ($("detalle-periodo") && per) {
        $("detalle-periodo").textContent = per.desde && per.hasta
          ? `${per.desde} → ${per.hasta}`
          : "Período completo";
      }

      // Lista de pagos individuales
      renderPagosRegistrados(r.responsable);
    },

    ejecutarAccion(accion) {
      const r = this.filaActual;
      if (!r) return;
      switch (accion) {
        case "config":
          if (window.AppSession?.user?.rol === 'admin') Modales.abrir("modal-config-comisiones");
          break;
        case "pago":
          abrirModalRegistrarPago(r);
          break;
        case "exportar":
          exportarFilaCSV(r);
          break;
      }
    },

    init() {
      document.addEventListener("click", e => {
        if (e.target.closest("[data-cerrar-detalle]")) this.cerrar();
      });
      document.addEventListener("click", e => {
        const btn = e.target.closest("[data-toggle-seccion]");
        if (!btn) return;
        btn.closest(".panel-detalle__seccion--colapsable")?.classList.toggle("colapsado");
      });
      document.addEventListener("click", e => {
        const btnCirc = e.target.closest("[data-accion-com]");
        if (btnCirc) { this.ejecutarAccion(btnCirc.dataset.accionCom); return; }
        const btnMenu = e.target.closest("[data-accion-com-menu]");
        if (btnMenu) { this.ejecutarAccion(btnMenu.dataset.accionComMenu); Popovers.cerrar(); }

        const btnEdit = e.target.closest("[data-editar-pago]");
        if (btnEdit) { abrirModalEditarPago(parseInt(btnEdit.dataset.editarPago, 10)); }
      });
    }
  };

  /* ================================================================
     PAGOS INDIVIDUALES — RENDER, EDITAR, ELIMINAR
     ================================================================ */

  function renderPagosRegistrados(asesor) {
    const lista = document.getElementById("lista-pagos-com");
    const badge = document.getElementById("detalle-pagos-badge");
    if (!lista) return;

    const pagos = (window.cajaPagosComisiones || [])
      .filter(m => m.responsable === asesor)
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    if (badge) badge.textContent = pagos.length;

    if (pagos.length === 0) {
      lista.innerHTML = `<p class="lista-pagos-com__vacia">Sin pagos registrados</p>`;
      return;
    }

    const esc = s => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    lista.innerHTML = pagos.map(m => `
      <div class="pago-com-item">
        <div class="pago-com-item__info">
          <span class="pago-com-item__fecha">${window.fechaCorta ? window.fechaCorta(m.fecha) : m.fecha}</span>
          <span class="pago-com-item__desc" title="${esc(m.descripcion)}">${esc(m.descripcion)}</span>
        </div>
        <span class="pago-com-item__valor">${window.formatearMoneda ? window.formatearMoneda(m.valor, m.moneda || "COP") : m.valor}</span>
        <button class="pago-com-item__edit" data-editar-pago="${m.id}" title="Editar pago">
          <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
            <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"/>
          </svg>
        </button>
      </div>
    `).join("");
  }

  async function recalcularFilaAsesor(asesor) {
    const row = window.estadoApp?.datosOriginales?.find(r => r.responsable === asesor);
    if (!row) return;

    try {
      const { desde, hasta } = window.estadoApp?.periodoActual || {};

      if (window.Api?.comisiones?.reporte) {
        const res = await window.Api.comisiones.reporte({ desde, hasta });
        if (res?.ok && Array.isArray(res.filas)) {
          const fresh = res.filas.find(r => r.responsable === asesor);
          if (fresh) {
            row.ingresos = parseFloat(fresh.ingresos) || 0;
            row.porcentaje = parseFloat(fresh.porcentaje) || 0;
            row.teorico = parseFloat(fresh.teorico) || 0;
            row.registrado = parseFloat(fresh.registrado) || 0;
            row.pagos = parseInt(fresh.pagos, 10) || 0;
            row.diferencia = parseFloat(fresh.diferencia) || 0;
            row.estado = window.derivarEstado?.(row) || fresh.estado || row.estado;
          }
        }
      }
    } catch (e) {
      console.warn("[Comisiones] No se pudo recalcular desde API:", e.message);
    }

    if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
    if (window.actualizarDashboard) window.actualizarDashboard();
    if (PanelDetalle.filaActual?.id === row.id) PanelDetalle.renderizar(row);
  }

  function abrirModalEditarPago(id) {
    const m = (window.cajaPagosComisiones || []).find(p => p.id === id);
    if (!m) return;

    document.getElementById("editar-pago-id").value = m.id;
    document.getElementById("editar-pago-asesor").value = m.responsable;
    document.getElementById("editar-pago-valor").value = m.valor;
    document.getElementById("editar-pago-fecha").value = m.fecha;
    document.getElementById("editar-pago-metodo").value = m.metodo_pago || "efectivo";
    document.getElementById("editar-pago-descripcion").value = m.descripcion;
    document.getElementById("editar-pago-observaciones").value = m.observaciones || "";

    const confirmar = document.getElementById("editar-pago-confirmar-eliminar");
    if (confirmar) confirmar.hidden = true;

    Modales.abrir("modal-editar-pago-com");
  }

  function initModalEditarPago() {
    const btnGuardar = document.getElementById("guardar-editar-pago-com");
    const btnEliminar = document.getElementById("eliminar-pago-com");
    const confirmar = document.getElementById("editar-pago-confirmar-eliminar");
    const btnConfirm = document.getElementById("confirmar-eliminar-pago-com");
    const btnCancelar = document.getElementById("cancelar-eliminar-pago-com");

    if (!btnGuardar) return;

    btnGuardar.addEventListener("click", async () => {
      const id = parseInt(document.getElementById("editar-pago-id").value, 10);
      const valor = parseFloat(document.getElementById("editar-pago-valor").value) || 0;
      const fecha = document.getElementById("editar-pago-fecha").value;
      const metodo = document.getElementById("editar-pago-metodo").value;
      const desc = document.getElementById("editar-pago-descripcion").value.trim();
      const obs = document.getElementById("editar-pago-observaciones").value.trim();

      if (!valor || valor <= 0) { window.mostrarToast("⚠ Ingresa un valor válido"); return; }
      if (!fecha) { window.mostrarToast("⚠ La fecha es obligatoria"); return; }

      try {
        btnGuardar.disabled = true;
        if (window.Api) {
          await window.Api.caja.actualizar(id, {
            valor, fecha, metodo_pago: metodo, descripcion: desc, observaciones: obs
          });
        }

        const idx = (window.cajaPagosComisiones || []).findIndex(p => p.id === id);
        if (idx >= 0) {
          const prev = window.cajaPagosComisiones[idx];
          window.cajaPagosComisiones[idx] = { ...prev, valor, fecha, metodo_pago: metodo, descripcion: desc, observaciones: obs };
          recalcularFilaAsesor(prev.responsable);
          renderPagosRegistrados(prev.responsable);
        }

        window.mostrarToast("✓ Pago actualizado");
        Modales.cerrar(document.getElementById("modal-editar-pago-com"));
      } catch (e) {
        window.mostrarToast("⚠ No se pudo guardar: " + e.message);
      } finally {
        btnGuardar.disabled = false;
      }
    });

    btnEliminar?.addEventListener("click", () => {
      if (confirmar) confirmar.hidden = false;
    });

    btnCancelar?.addEventListener("click", () => {
      if (confirmar) confirmar.hidden = true;
    });

    btnConfirm?.addEventListener("click", async () => {
      const id = parseInt(document.getElementById("editar-pago-id").value, 10);
      try {
        btnConfirm.disabled = true;
        if (window.Api) await window.Api.caja.eliminar(id);

        const m = (window.cajaPagosComisiones || []).find(p => p.id === id);
        const asesor = m?.responsable;
        window.cajaPagosComisiones = (window.cajaPagosComisiones || []).filter(p => p.id !== id);
        if (asesor) {
          recalcularFilaAsesor(asesor);
          renderPagosRegistrados(asesor);
        }

        window.mostrarToast("✓ Pago eliminado");
        Modales.cerrar(document.getElementById("modal-editar-pago-com"));
      } catch (e) {
        window.mostrarToast("⚠ No se pudo eliminar: " + e.message);
      } finally {
        btnConfirm.disabled = false;
      }
    });
  }

  function obtenerPeriodoActualCom() {
    const per = window.estadoApp?.periodoActual || {};
    return {
      desde: per.desde || "",
      hasta: per.hasta || ""
    };
  }

  async function listarComisionesPendientesAsesor(asesor) {
    if (!window.Api || !window.Api.caja) return [];

    const { desde, hasta } = obtenerPeriodoActualCom();

    const resp = await window.Api.caja.listar({
      tipo: "gasto",
      categoria: "comisiones",
      estado: "pendiente",
      desde,
      hasta,
      por_pagina: 200
    });

    if (!resp?.ok || !Array.isArray(resp.data)) return [];

    return resp.data.filter(m => (m.responsable || "") === asesor);
  }

  async function marcarMovimientoComisionPagado(id, payloadExtra = {}) {
    if (!window.Api || !window.Api.caja || !id) {
      throw new Error("API de Caja no disponible o id inválido");
    }

    return await window.Api.caja.actualizar(id, {
      estado: "pagado",
      ...payloadExtra
    });
  }

  async function pagarComisionesPendientesAsesor(asesor, extras = {}) {
    const pendientes = await listarComisionesPendientesAsesor(asesor);

    if (!pendientes.length) {
      return { ok: true, actualizados: 0, movimientos: [] };
    }

    const actualizados = [];
    for (const mov of pendientes) {
      await marcarMovimientoComisionPagado(mov.id, extras);
      actualizados.push(mov);
    }

    return {
      ok: true,
      actualizados: actualizados.length,
      movimientos: actualizados
    };
  }

  /* ================================================================
     REGISTRAR PAGO DE COMISIÓN
     ================================================================ */
  function abrirModalRegistrarPago(row) {
    const modal = document.getElementById("modal-registrar-pago-com");
    if (!modal) return;

    const hoy = new Date();
    const iso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;

    const selAsesor = document.getElementById("pago-com-asesor");
    const inValor = document.getElementById("pago-com-valor");
    const inFecha = document.getElementById("pago-com-fecha");
    const inDesc = document.getElementById("pago-com-descripcion");

    if (selAsesor) selAsesor.value = row.responsable;
    if (inValor) inValor.value = Math.max(0, row.teorico - row.registrado);
    if (inFecha) inFecha.value = iso;
    if (inDesc) inDesc.value = `Pago de comisión a ${row.responsable}`;

    Modales.abrir("modal-registrar-pago-com");
  }

  function initModalRegistrarPago() {
    const modal = document.getElementById("modal-registrar-pago-com");
    const btnGuar = document.getElementById("guardar-pago-com");
    if (!modal || !btnGuar) return;

    const selAsesor = document.getElementById("pago-com-asesor");

    if (selAsesor) {
      const nombres = Array.isArray(window.ownersCatalogo) && window.ownersCatalogo.length > 0
        ? window.ownersCatalogo.map(o => o.nombre).sort()
        : [...new Set((window.estadoApp?.datosOriginales || []).map(r => r.responsable))].sort();

      selAsesor.innerHTML = nombres.map(n => `<option value="${escHtml(n)}">${escHtml(n)}</option>`).join("");
    }

    btnGuar.addEventListener("click", async () => {
      const asesor = document.getElementById("pago-com-asesor")?.value;
      const fecha = document.getElementById("pago-com-fecha")?.value;
      const metodo = document.getElementById("pago-com-metodo")?.value || "transferencia";
      const desc = document.getElementById("pago-com-descripcion")?.value?.trim() || "";

      if (!asesor) {
        window.mostrarToast("Selecciona un asesor");
        return;
      }

      if (!fecha) {
        window.mostrarToast("La fecha es obligatoria");
        return;
      }

      try {
        btnGuar.disabled = true;

        const resultado = await pagarComisionesPendientesAsesor(asesor, {
          fecha,
          metodo_pago: metodo,
          observaciones: desc
        });

        if (!resultado.actualizados) {
          window.mostrarToast("No hay comisiones pendientes para este asesor en el período actual");
          return;
        }

        const row = window.estadoApp?.datosOriginales?.find(r => r.responsable === asesor);
        if (row) {
          row.registrado = row.teorico;
          row.diferencia = row.registrado - row.teorico;
          row.pagos = row.teorico > 0 ? row.pagos + resultado.actualizados : row.pagos;
          row.estado = window.derivarEstado?.(row) || "pagado";
        }

        if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
        if (window.actualizarDashboard) window.actualizarDashboard();
        if (window.recargarComisiones) {
          const per = window.estadoApp?.periodoActual || {};
          await window.recargarComisiones(per.desde, per.hasta);
        }

        if (PanelDetalle.filaActual?.responsable === asesor) {
          const filaActualizada = window.estadoApp?.datosOriginales?.find(r => r.responsable === asesor);
          if (filaActualizada) PanelDetalle.renderizar(filaActualizada);
        }

        window.mostrarToast(`${resultado.actualizados} comisión(es) marcadas como pagadas`);
        Modales.cerrar(modal);
      } catch (e) {
        console.error("[Comisiones] Error al marcar comisiones como pagadas:", e);
        window.mostrarToast("No se pudieron marcar las comisiones como pagadas");
      } finally {
        btnGuar.disabled = false;
      }
    });
  }

  /* ================================================================
     EXPORTAR A EXCEL (.xlsx)
     ================================================================ */
  function toXLSXBlob(aoa) {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comisiones");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
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

  function nombreArchivo(base) {
    const d = new Date();
    return `${base}_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.xlsx`;
  }

  function exportarFilaCSV(row) {
    const header = ["Asesor", "Ingresos base", "% Comisión", "Com. teórica", "Com. registrada", "# Pagos", "Diferencia", "Estado", "Activo"];
    const fila = [row.responsable, row.ingresos, row.porcentaje, row.teorico, row.registrado, row.pagos, row.diferencia, row.estado, row.activo ? "Sí" : "No"];
    descargarBlob(toXLSXBlob([header, fila]), nombreArchivo(`comision_${row.responsable.replace(/\s+/g, "_").toLowerCase()}`));
    window.mostrarToast("✓ Comisión exportada");
  }

  function exportarTodosCSV(alcance = "visibles") {
    const est = window.estadoApp;
    const datos = alcance === "todos" ? est.datosOriginales : est.datosVisibles;
    const header = ["Asesor", "Ingresos base", "% Comisión", "Com. teórica", "Com. registrada", "# Pagos", "Diferencia", "Estado", "Activo"];
    const filas = datos.map(r => [r.responsable, r.ingresos, r.porcentaje, r.teorico, r.registrado, r.pagos, r.diferencia, r.estado, r.activo ? "Sí" : "No"]);
    const totIng = datos.reduce((s, r) => s + r.ingresos, 0);
    const totTeo = datos.reduce((s, r) => s + r.teorico, 0);
    const totReg = datos.reduce((s, r) => s + r.registrado, 0);
    const totPag = datos.reduce((s, r) => s + r.pagos, 0);
    filas.push(["TOTAL", totIng, "", totTeo, totReg, totPag, totReg - totTeo, "", ""]);
    descargarBlob(toXLSXBlob([header, ...filas]), nombreArchivo("comisiones"));
    window.mostrarToast(`✓ ${datos.length} asesores exportados`);
  }

  /* ================================================================
     CONFIG COMISIONES — PERSISTENCIA
     ================================================================ */
  const KEY_LS = "caja:configComisiones";
  const DEFAULT_CFG = { version: 2, porAsesor: [], porProducto: [], generalProductoPorcentaje: 5 };

  function cargarConfig() {
    try {
      const raw = localStorage.getItem(KEY_LS);
      if (!raw) return clonarDefault();
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.porAsesor)) return clonarDefault();
      parsed.porAsesor = (parsed.porAsesor || []).map(a => ({
        ...a,
        activo: a.activo === undefined ? true : !!a.activo
      }));
      return Object.assign(clonarDefault(), parsed);
    } catch (e) {
      return clonarDefault();
    }
  }

  function guardarConfig(cfg) {
    try { localStorage.setItem(KEY_LS, JSON.stringify(cfg)); } catch (e) { /**/ }
    if (window.Api) {
      window.Api.comisiones.guardarConfig(cfg).catch(e =>
        console.warn("[Comisiones] guardarConfig API falló:", e.message)
      );
    }
  }

  function clonarDefault() {
    return JSON.parse(JSON.stringify(DEFAULT_CFG));
  }

  function asegurarConfigInicial() {
    const cfg = cargarConfig();
    if (cfg.porAsesor.length === 0 && window.estadoApp?.datosOriginales?.length > 0) {
      const unicos = [...new Set(
        window.estadoApp.datosOriginales.map(r => r.responsable).filter(Boolean)
      )].sort();
      cfg.porAsesor = unicos.map(n => ({
        responsable: n, porcentaje: 5, base: "por_venta", activo: true
      }));
      guardarConfig(cfg);
    }
    return cfg;
  }

  /* ================================================================
     CONFIG COMISIONES — RENDER MODAL
     ================================================================ */
  function escHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function renderConfigComisiones() {
    const cfg = cargarConfig();
    renderTabAsesor(cfg);
    renderTabProducto(cfg);
  }

  function renderTabAsesor(cfg) {
    const tbody = document.getElementById("config-comisiones-tbody-asesor");
    if (!tbody) return;

    // Mezclar config guardada con owners de HubSpot que aún no estén configurados
    let asesores = cfg.porAsesor.map(r => ({ ...r }));
    if (Array.isArray(window.ownersCatalogo)) {
      window.ownersCatalogo.forEach(owner => {
        if (!asesores.find(a => a.responsable === owner.nombre)) {
          asesores.push({ responsable: owner.nombre, porcentaje: 0, base: "ingresos", activo: true });
        }
      });
    }
    cfg = { ...cfg, porAsesor: asesores };

    if (cfg.porAsesor.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="tabla-config-comisiones__vacio">Los owners de HubSpot aparecerán aquí cuando se carguen.</td></tr>`;
      return;
    }
    tbody.innerHTML = cfg.porAsesor.map((row, idx) => {
      const activo = row.activo !== false;
      const iconToggle = activo
        ? `<svg viewBox="0 0 24 24" width="14" height="14" title="Inactivar"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2Zm0 2a8 8 0 1 1 0 16A8 8 0 0 1 12 4Zm0 3a5 5 0 1 0 0 10A5 5 0 0 0 12 7Z"/></svg>`
        : `<svg viewBox="0 0 24 24" width="14" height="14" title="Reactivar"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2Zm0 2a8 8 0 1 1 0 16A8 8 0 0 1 12 4Z"/></svg>`;
      return `
        <tr data-row-asesor="${idx}" data-responsable="${escHtml(row.responsable)}" data-activo="${activo}" class="${activo ? "" : "asesor-row--inactivo"}">
          <td>
            <div class="celda-avatar">
              <span class="celda-avatar__circulo" style="width:24px;height:24px;font-size:10px;">${window.obtenerIniciales(row.responsable)}</span>
              <span class="asesor-nombre">${escHtml(row.responsable)}</span>
              ${activo ? "" : `<span class="badge-inactivo">Inactivo</span>`}
            </div>
          </td>
          <td><div class="input-pct"><input type="number" class="form-input form-input--sm" min="0" max="100" step="0.1" value="${row.porcentaje}" data-field="porcentaje" ${activo ? "" : "disabled"}/><span class="input-pct__suffix">%</span></div></td>
          <td><button class="btn-icono-mini ${activo ? "btn-activo--on" : "btn-activo--off"}" data-accion-asesor="toggle-activo" title="${activo ? "Inactivar" : "Reactivar"}">${iconToggle}</button></td>
        </tr>`;
    }).join("");
  }

  function renderTabProducto(cfg) {
    const tbody = document.getElementById("config-comisiones-tbody-producto");
    if (!tbody) return;

    const inputGen = document.getElementById("config-com-general-pct");
    if (inputGen) inputGen.value = cfg.generalProductoPorcentaje ?? 5;

    if (cfg.porProducto.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="tabla-config-comisiones__vacio">Sin excepciones configuradas. Todos los productos usan la tasa general.</td></tr>`;
      return;
    }
    tbody.innerHTML = cfg.porProducto.map((row, idx) => `
      <tr data-row-producto="${idx}">
        <td><input type="text" class="form-input form-input--sm" data-field="producto-texto" data-autocomplete-prod value="${escHtml(row.producto)}" data-prod-id="${escHtml(row.productoId || "")}" placeholder="Busca un producto…" autocomplete="off" style="width:100%;max-width:260px;"/></td>
        <td><div class="input-pct"><input type="number" class="form-input form-input--sm" min="0" max="100" step="0.1" value="${row.porcentaje}" data-field="porcentaje"/><span class="input-pct__suffix">%</span></div></td>
        <td><button class="btn-icono-mini" data-accion-producto="quitar" title="Quitar"><svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M6 7h12l-1 13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 7Zm3-3h6l1 2h4v2H5V6h4l1-2Z"/></svg></button></td>
      </tr>`
    ).join("");
  }

  function leerConfigDesdeUI() {
    const cfg = clonarDefault();
    document.querySelectorAll("[data-row-asesor]").forEach(tr => {
      const nombre = tr.dataset.responsable || "";
      const activo = tr.dataset.activo !== "false";
      const pct = parseFloat(tr.querySelector('[data-field="porcentaje"]')?.value) || 0;
      const base = "por_venta";
      if (nombre) cfg.porAsesor.push({ responsable: nombre, porcentaje: pct, base, activo });
    });
    cfg.generalProductoPorcentaje = parseFloat(document.getElementById("config-com-general-pct")?.value) || 5;

    document.querySelectorAll("[data-row-producto]").forEach(tr => {
      const inputEl = tr.querySelector('[data-field="producto-texto"]');
      const prod = inputEl?.value?.trim() || "";
      const prodId = inputEl?.dataset?.prodId || "";
      const pct = parseFloat(tr.querySelector('[data-field="porcentaje"]')?.value) || 0;
      if (prod) cfg.porProducto.push({ productoId: prodId, producto: prod, porcentaje: pct });
    });
    return cfg;
  }

  /* ================================================================
     AUTOCOMPLETADO DE PRODUCTOS
     ================================================================ */
  const PRODUCTOS_FALLBACK = [
    { id: "ej-1", nombre: "Sitio web corporativo", precio: 4500000 },
    { id: "ej-2", nombre: "Tienda Shopify", precio: 8200000 },
    { id: "ej-3", nombre: "SEO técnico mensual", precio: 1200000 },
    { id: "ej-4", nombre: "Soporte y mantenimiento mensual", precio: 980000 },
    { id: "ej-5", nombre: "Consultoría HubSpot", precio: 2800000 }
  ];
  let catalogoProductos = [];

  async function cargarCatalogoProd(forzar = false) {
    if (catalogoProductos.length > 0 && !forzar) return catalogoProductos;
    try {
      if (window.Api) {
        const res = await window.Api.productos.listar();
        if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
          catalogoProductos = res.data;
          return catalogoProductos;
        }
      }
    } catch (_) { /* silencioso */ }
    catalogoProductos = PRODUCTOS_FALLBACK;
    return catalogoProductos;
  }

  function initAutocompletoProd(containerEl) {
    if (!containerEl) return;
    let dropdown = null, inputActivo = null;

    function obtenerCat() { return catalogoProductos.length ? catalogoProductos : PRODUCTOS_FALLBACK; }

    function cerrarDrop() { dropdown?.remove(); dropdown = null; inputActivo = null; }

    function mostrarDrop(input, termino) {
      cerrarDrop();
      const cat = obtenerCat();
      const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      const q = norm(termino);
      const filtrados = q.length < 1 ? cat.slice(0, 10) : cat.filter(p => norm(p.nombre).includes(q)).slice(0, 10);
      if (!filtrados.length) return;
      const ul = document.createElement("ul");
      ul.className = "prod-autocomplete__lista";
      ul._datos = filtrados;
      filtrados.forEach((p, i) => {
        const li = document.createElement("li");
        li.className = "prod-autocomplete__item";
        li.setAttribute("role", "option"); li.setAttribute("tabindex", "-1"); li.dataset.prodIdx = i;
        li.innerHTML = `<span class="prod-ac__nombre">${escHtml(p.nombre)}</span><span class="prod-ac__precio">${window.formatearMoneda(p.precio, "COP")}</span>`;
        ul.appendChild(li);
      });
      const rect = input.getBoundingClientRect();
      ul.style.cssText = `position:fixed;top:${rect.bottom + 4}px;left:${rect.left}px;width:${rect.width}px;z-index:9999;`;
      document.body.appendChild(ul);
      dropdown = ul; inputActivo = input;
    }

    function seleccionarProd(prod) {
      if (!prod || !inputActivo) return;
      inputActivo.value = prod.nombre; inputActivo.dataset.prodId = prod.id || "";
      const cap = inputActivo; cerrarDrop();
      cap.dispatchEvent(new CustomEvent("autocomplete:seleccionado", { bubbles: true, detail: prod }));
    }

    containerEl.addEventListener("input", e => { const in_ = e.target.closest("[data-autocomplete-prod]"); if (!in_) return; clearTimeout(in_._acT); in_._acT = setTimeout(() => mostrarDrop(in_, in_.value.trim()), 200); });
    containerEl.addEventListener("focusin", e => { const in_ = e.target.closest("[data-autocomplete-prod]"); if (!in_ || in_.value.trim().length < 1) return; mostrarDrop(in_, in_.value.trim()); });
    containerEl.addEventListener("keydown", e => {
      const in_ = e.target.closest("[data-autocomplete-prod]");
      if (in_) { if (e.key === "Escape") { cerrarDrop(); return; } if (e.key === "ArrowDown" && dropdown) { e.preventDefault(); dropdown.querySelector("[role='option']")?.focus(); return; } }
      if (!dropdown) return;
      const li = e.target.closest("[role='option']"); if (!li) return;
      const items = [...dropdown.querySelectorAll("[role='option']")]; const idx = items.indexOf(li);
      if (e.key === "ArrowDown") { e.preventDefault(); items[idx + 1]?.focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); idx <= 0 ? inputActivo?.focus() : items[idx - 1]?.focus(); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); seleccionarProd(dropdown._datos[parseInt(li.dataset.prodIdx, 10)]); }
      else if (e.key === "Escape") { cerrarDrop(); inputActivo?.focus(); }
    });
    document.addEventListener("click", e => {
      if (!dropdown) return;
      const li = e.target.closest(".prod-autocomplete__item");
      if (li && dropdown.contains(li)) { seleccionarProd(dropdown._datos[parseInt(li.dataset.prodIdx, 10)]); return; }
      if (!dropdown.contains(e.target) && !containerEl.contains(e.target)) cerrarDrop();
    });
  }

  /* ================================================================
     INIT MODAL CONFIG COMISIONES
     ================================================================ */
  function initModalConfigComisiones() {
    const modal = document.getElementById("modal-config-comisiones");
    if (!modal) return;

    new MutationObserver(() => {
      if (!modal.hasAttribute("hidden")) {
        renderConfigComisiones();
        cargarCatalogoProd();
      }
    }).observe(modal, { attributes: true, attributeFilter: ["hidden"] });

    // Tabs
    modal.querySelectorAll("[data-tab-comisiones]").forEach(tab => {
      tab.addEventListener("click", () => {
        const target = tab.dataset.tabComisiones;
        modal.querySelectorAll("[data-tab-comisiones]").forEach(t =>
          t.classList.toggle("config-comisiones__tab--activo", t === tab)
        );
        modal.querySelectorAll("[data-panel-comisiones]").forEach(p => {
          p.hidden = p.dataset.panelComisiones !== target;
        });
      });
    });

    // Click delegation
    modal.addEventListener("click", e => {
      const btnQ = e.target.closest('[data-accion-producto="quitar"]');
      if (btnQ) {
        btnQ.closest("tr").remove();
        const tbody = document.getElementById("config-comisiones-tbody-producto");
        if (tbody && !tbody.querySelectorAll("[data-row-producto]").length) {
          tbody.innerHTML = `<tr><td colspan="3" class="tabla-config-comisiones__vacio">Sin productos configurados.</td></tr>`;
        }
        return;
      }
      const btnT = e.target.closest('[data-accion-asesor="toggle-activo"]');
      if (btnT) {
        const tr = btnT.closest("tr");
        const eraActivo = tr.dataset.activo !== "false";
        const ahoraActivo = !eraActivo;
        tr.dataset.activo = ahoraActivo;
        tr.classList.toggle("asesor-row--inactivo", !ahoraActivo);
        tr.querySelectorAll("input,select").forEach(el => { el.disabled = !ahoraActivo; });
        const celda = tr.querySelector(".celda-avatar");
        const badge = celda?.querySelector(".badge-inactivo");
        if (ahoraActivo) {
          badge?.remove();
          btnT.classList.replace("btn-activo--off", "btn-activo--on");
          btnT.title = "Inactivar asesor";
        } else {
          if (celda && !badge) { const sp = document.createElement("span"); sp.className = "badge-inactivo"; sp.textContent = "Inactivo"; celda.appendChild(sp); }
          btnT.classList.replace("btn-activo--on", "btn-activo--off");
          btnT.title = "Reactivar asesor";
        }
      }
    });

    // Agregar producto
    document.getElementById("btn-agregar-producto-comision")?.addEventListener("click", () => {
      const tbody = document.getElementById("config-comisiones-tbody-producto");
      if (!tbody) return;
      cargarCatalogoProd();
      const vacia = tbody.querySelector(".tabla-config-comisiones__vacio");
      if (vacia) tbody.innerHTML = "";
      const idx = tbody.querySelectorAll("[data-row-producto]").length;
      const tr = document.createElement("tr");
      tr.dataset.rowProducto = idx;
      tr.innerHTML = `
        <td><input type="text" class="form-input form-input--sm" data-field="producto-texto" data-autocomplete-prod placeholder="Busca un producto…" autocomplete="off" style="width:100%;max-width:260px;"/></td>
        <td><div class="input-pct"><input type="number" class="form-input form-input--sm" min="0" max="100" step="0.1" value="5" data-field="porcentaje"/><span class="input-pct__suffix">%</span></div></td>
        <td><button class="btn-icono-mini" data-accion-producto="quitar" title="Quitar"><svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M6 7h12l-1 13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 7Zm3-3h6l1 2h4v2H5V6h4l1-2Z"/></svg></button></td>`;
      tbody.appendChild(tr);
      tr.querySelector("[data-autocomplete-prod]").focus();
    });

    initAutocompletoProd(modal);

    document.getElementById("btn-guardar-config-comisiones")?.addEventListener("click", () => {
      const cfg = leerConfigDesdeUI();
      guardarConfig(cfg);
      const act = cfg.porAsesor.filter(a => a.activo !== false).length;
      const inac = cfg.porAsesor.length - act;
      window.mostrarToast(`✓ Config guardada — ${act} asesor(es) activo(s)${inac > 0 ? `, ${inac} inactivo(s)` : ""}, ${cfg.porProducto.length} producto(s)`);
      Modales.cerrar(modal);
    });
  }

  /* ================================================================
     SELECTOR DE OBJETOS (popover módulos)
     ================================================================ */
  function initSelectorObjetos() {
    const popover = document.getElementById("popover-objetos");
    if (!popover) return;
    const input = popover.querySelector('[data-buscar="objetos"]');
    if (input) {
      input.addEventListener("input", e => {
        const q = e.target.value.toLowerCase();
        popover.querySelectorAll(".popover__item").forEach(it => {
          it.style.display = it.textContent.toLowerCase().includes(q) ? "" : "none";
        });
      });
    }
  }

  /* ================================================================
     TAB MENU
     ================================================================ */
  function initTabMenu() {
    let vistaTarget = null;
    document.addEventListener("click", e => {
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
    popover.addEventListener("click", e => {
      const item = e.target.closest("[data-accion]");
      if (!item || item.classList.contains("popover__item--deshabilitado")) return;
      const accion = item.dataset.accion;
      if (!vistaTarget || !window.vistasInstance) return;
      if (accion === "tab-rename") { Popovers.cerrar(); requestAnimationFrame(() => window.vistasInstance.iniciarEdicionInline(vistaTarget)); return; }
      if (accion === "tab-clonar") { window.vistasInstance.clonarVista(vistaTarget); Popovers.cerrar(); return; }
      if (accion === "tab-eliminar") { window.vistasInstance.cerrarVista(vistaTarget); Popovers.cerrar(); return; }
      Popovers.cerrar();
    });
  }

  /* ================================================================
     TAB +
     ================================================================ */
  function initTabAdd() {
    const popover = document.getElementById("popover-tab-add");
    if (!popover) return;
    popover.addEventListener("click", e => {
      const accion = e.target.closest("[data-accion]")?.dataset.accion;
      if (!accion) return;
      Popovers.cerrar();
      if (accion === "crear-vista" && window.vistasInstance?.crearVistaInline) window.vistasInstance.crearVistaInline();
      if (accion === "agregar-vista") Modales.abrir("modal-agregar-vista");
    });
  }

  /* ================================================================
     CABECERA MENÚ
     ================================================================ */
  function initCabeceraMenu() {
    const popover = document.getElementById("popover-cabecera-menu");
    if (popover) {
      popover.addEventListener("click", e => {
        const accion = e.target.closest("[data-accion]")?.dataset.accion;
        if (!accion) return;
        if (accion === "cab-config-comisiones") { if (window.AppSession?.user?.rol === 'admin') Modales.abrir("modal-config-comisiones"); Popovers.cerrar(); return; }
        if (accion === "cab-exportar-todos") { exportarTodosCSV("todos"); Popovers.cerrar(); return; }
        if (accion === "cab-exportar-visibles") { exportarTodosCSV("visibles"); Popovers.cerrar(); return; }
        Popovers.cerrar();
      });
    }
    // Botón principal "Configurar"
    document.getElementById("btn-configurar-comisiones")?.addEventListener("click", () => {
      if (window.AppSession?.user?.rol === 'admin') Modales.abrir("modal-config-comisiones");
    });
  }

  /* ================================================================
     FILTROS PILL: Asesor, Estado, Fecha
     ================================================================ */
  function poblarListaAsesores() {
    const listaAse = document.getElementById("lista-asesores");
    if (!listaAse) return;
    // Usar HubSpot owners si ya cargaron; de lo contrario, usar los del reporte
    const fuente = Array.isArray(window.ownersCatalogo) && window.ownersCatalogo.length > 0
      ? window.ownersCatalogo.map(o => o.nombre)
      : [...new Set(window.estadoApp.datosOriginales.map(r => r.responsable))];
    const previos = new Set([...listaAse.querySelectorAll("input:checked")].map(c => c.dataset.ase));
    listaAse.innerHTML = fuente.sort().map(n => `
      <label class="check-lista__item">
        <input type="checkbox" data-ase="${escHtml(n)}" ${previos.has(n) ? "checked" : ""}/>
        <span class="celda-avatar__circulo" style="width:22px;height:22px;font-size:10px;">${window.obtenerIniciales(n)}</span>
        ${escHtml(n)}
      </label>`).join("");
  }

  function initFiltrosPill() {
    // Poblar asesores desde HubSpot owners (o BD como fallback)
    const listaAse = document.getElementById("lista-asesores");
    if (listaAse) {
      poblarListaAsesores();
      listaAse.addEventListener("change", e => {
        if (e.target.matches('input[type="checkbox"]')) {
          window.estadoApp.filtros.asesor = [...listaAse.querySelectorAll("input:checked")].map(c => c.dataset.ase);
          if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
        }
      });
    }

    // Estado
    const popEst = document.getElementById("popover-filtro-estado");
    if (popEst) {
      popEst.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener("change", () => {
          window.estadoApp.filtros.estado = [...popEst.querySelectorAll("input:checked")].map(c => c.dataset.filtroVal);
          if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
        });
      });
    }

    // Fecha (presets + rango personalizado)
    const popFecha = document.getElementById("popover-filtro-fecha");
    if (popFecha) {
      popFecha.querySelectorAll(".popover__item[data-filtro-val]").forEach(it => {
        it.addEventListener("click", () => {
          const v = it.dataset.filtroVal;
          window.estadoApp.filtros.fecha = v || null;
          document.getElementById("filtro-fecha-desde") && (document.getElementById("filtro-fecha-desde").value = "");
          document.getElementById("filtro-fecha-hasta") && (document.getElementById("filtro-fecha-hasta").value = "");
          if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();

          // Recargar datos del período si hay API
          const rango = window.resolverRangoFecha?.(v);
          if (rango) {
            const desde = window.isoDesde?.(rango) || "";
            const hasta = window.isoHasta?.(rango) || "";
            if (desde && hasta && window.recargarComisiones) window.recargarComisiones(desde, hasta);
          }
          Popovers.cerrar();
        });
      });

      popFecha.querySelectorAll("[data-fecha-accion]").forEach(btn => {
        btn.addEventListener("click", e => {
          e.stopPropagation();
          const accion = btn.dataset.fechaAccion;
          const inDesde = document.getElementById("filtro-fecha-desde");
          const inHasta = document.getElementById("filtro-fecha-hasta");
          if (accion === "limpiar") {
            if (inDesde) inDesde.value = ""; if (inHasta) inHasta.value = "";
            window.estadoApp.filtros.fecha = null;
            if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
            Popovers.cerrar(); return;
          }
          if (accion === "aplicar") {
            const desde = inDesde?.value || ""; const hasta = inHasta?.value || "";
            if (!desde && !hasta) { window.mostrarToast("⚠ Selecciona al menos una fecha"); return; }
            if (desde && hasta && desde > hasta) { window.mostrarToast("⚠ La fecha 'Desde' no puede ser posterior a 'Hasta'"); return; }
            window.estadoApp.filtros.fecha = { desde: desde || null, hasta: hasta || null };
            if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
            if (desde && hasta && window.recargarComisiones) window.recargarComisiones(desde, hasta);
            Popovers.cerrar();
          }
        });
      });
    }
  }

  /* ================================================================
     AGREGAR FILTRO (botón +)
     ================================================================ */
  const PILLS_META = {
    asesor: { icono: "👤", nombre: "Asesor" },
    estado: { icono: "🔵", nombre: "Estado" },
    fecha: { icono: "📅", nombre: "Fecha" }
  };

  function pillEsVisible(id) {
    const p = document.querySelector(`.filtro-pill[data-filtro="${id}"]`);
    return p ? p.style.display !== "none" : false;
  }

  function mostrarPill(id, visible) {
    const p = document.querySelector(`.filtro-pill[data-filtro="${id}"]`);
    if (p) p.style.display = visible ? "" : "none";
  }

  function limpiarValorFiltro(id) {
    const est = window.estadoApp;
    if (id === "asesor") est.filtros.asesor = [];
    if (id === "estado") est.filtros.estado = [];
    if (id === "fecha") est.filtros.fecha = null;
  }

  function initFiltroAdd() {
    const pop = document.getElementById("popover-filtro-add");
    if (!pop) return;
    const buscarInput = pop.querySelector("#filtro-add-buscar");
    const lista = pop.querySelector("#filtro-add-lista");

    pop.addEventListener("click", e => {
      const item = e.target.closest(".popover__item[data-pill-id]");
      if (!item) return;
      mostrarPill(item.dataset.pillId, true);
      if (buscarInput) buscarInput.value = "";
      Popovers.cerrar();
    });

    if (buscarInput && lista) {
      buscarInput.addEventListener("input", () => {
        const q = buscarInput.value.trim().toLowerCase();
        lista.querySelectorAll(".popover__item[data-pill-id]").forEach(it => {
          it.style.display = q === "" || it.textContent.trim().toLowerCase().includes(q) ? "" : "none";
        });
      });
    }

    new MutationObserver(() => {
      if (!pop.hasAttribute("hidden")) {
        if (buscarInput) buscarInput.value = "";
        lista?.querySelectorAll(".popover__item[data-pill-id]").forEach(it => {
          it.style.display = "";
          it.classList.toggle("popover__item--seleccionado", pillEsVisible(it.dataset.pillId));
        });
      }
    }).observe(pop, { attributes: true, attributeFilter: ["hidden"] });
  }

  /* ================================================================
     EDITAR FILTROS RÁPIDOS (lápiz)
     ================================================================ */
  function poblarModalEditarFiltros() {
    const modal = document.getElementById("modal-editar-filtros");
    if (!modal) return;
    const lista = modal.querySelector("#lista-filtros-edit");
    const contador = modal.querySelector("#contador-filtros");
    if (!lista) return;

    const pillsVisibles = Object.entries(PILLS_META).filter(([id]) => pillEsVisible(id));
    if (contador) contador.textContent = pillsVisibles.length;

    const ICONO_TRASH = `<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M7 21q-.825 0-1.413-.588T5 19V6H4V4h5V3h6v1h5v2h-1v13q0 .825-.587 1.413T17 21H7Zm0-15v13h10V6H7Zm2 11h2V8H9v9Zm4 0h2V8h-2v9Z"/></svg>`;

    if (!pillsVisibles.length) {
      lista.innerHTML = `<p style="color:var(--color-texto-suave);font-size:var(--font-tam-sm);padding:var(--esp-3) 0">No hay filtros en la barra. Usa el botón + para agregar.</p>`;
    } else {
      lista.innerHTML = pillsVisibles.map(([id, meta]) => `
        <div class="popover-fila-editor__item">
          <div class="popover-fila-editor__icono">${meta.icono}</div>
          <select class="popover-fila-editor__select" disabled><option>${meta.nombre}</option></select>
          <button class="popover-fila-editor__remover" data-quitar-pill="${id}">${ICONO_TRASH}</button>
        </div>`).join("");
    }

    const btnLimpiar = modal.querySelector("[data-limpiar-valores]");
    if (btnLimpiar) {
      const hayValores = Object.keys(PILLS_META).some(id => {
        const v = window.estadoApp.filtros[id];
        return Array.isArray(v) ? v.length > 0 : !!v;
      });
      btnLimpiar.disabled = !hayValores;
    }
  }

  function initEditarFiltros() {
    const btn = document.getElementById("btn-edit-filtros");
    if (!btn) return;
    btn.addEventListener("click", () => { poblarModalEditarFiltros(); Modales.abrir("modal-editar-filtros"); });

    const modal = document.getElementById("modal-editar-filtros");
    if (!modal) return;
    modal.addEventListener("click", e => {
      const remover = e.target.closest("[data-quitar-pill]");
      if (remover) {
        e.stopPropagation();
        const filtroId = remover.dataset.quitarPill;
        mostrarPill(filtroId, false);
        limpiarValorFiltro(filtroId);
        if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
        poblarModalEditarFiltros(); return;
      }
      const limpiarVal = e.target.closest("[data-limpiar-valores]");
      if (limpiarVal) { if (window.filtrosInstance) window.filtrosInstance.limpiarFiltros(); poblarModalEditarFiltros(); return; }
      const agregar = e.target.closest("#btn-agregar-filtro-rapido");
      if (agregar) { Modales.cerrar(modal); const btnAdd = document.getElementById("btn-add-filtro"); if (btnAdd) Popovers.abrir("popover-filtro-add", btnAdd); }
    });
  }

  /* ================================================================
     ORDENAR
     ================================================================ */
  function initOrdenar() {
    const popover = document.getElementById("popover-ordenar");
    if (!popover) return;
    const select = popover.querySelector("#select-orden");
    const dirBtns = popover.querySelectorAll(".popover-ordenar__dir button");

    function sincronizarUI() {
      const est = window.estadoApp;
      if (select) select.value = est.ordenColumna;
      dirBtns.forEach(b => b.classList.toggle("activo", b.dataset.dir === est.ordenDireccion));
    }

    select?.addEventListener("change", e => {
      if (window.tablaInstance) { window.estadoApp.ordenColumna = e.target.value; window.tablaInstance.aplicarOrden(); }
    });
    dirBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        dirBtns.forEach(b => b.classList.remove("activo")); btn.classList.add("activo");
        window.estadoApp.ordenDireccion = btn.dataset.dir;
        if (window.tablaInstance) window.tablaInstance.aplicarOrden();
      });
    });
    new MutationObserver(() => { if (!popover.hasAttribute("hidden")) sincronizarUI(); }).observe(popover, { attributes: true, attributeFilter: ["hidden"] });
  }

  /* ================================================================
     CLICK EN FILAS
     ================================================================ */
  function initClickFilasCom() {
    const tbody = document.getElementById("tbody-comisiones");
    if (!tbody) return;

    tbody.addEventListener("click", e => {
      const btnVP = e.target.closest(".btn-vista-previa-fila");
      if (btnVP) {
        e.stopPropagation();
        const id = parseInt(btnVP.dataset.cotId, 10);
        const row = window.estadoApp.datosOriginales.find(r => r.id === id);
        if (row) PanelDetalle.abrir(row);
        return;
      }
      const linkTitulo = e.target.closest(".celda-titulo__link, .celda-avatar__nombre");
      if (linkTitulo) {
        e.preventDefault(); e.stopPropagation();
        const tr = linkTitulo.closest("tr[data-id]");
        if (!tr) return;
        const id = parseInt(tr.dataset.id, 10);
        const row = window.estadoApp.datosOriginales.find(r => r.id === id);
        if (row) PanelDetalle.abrir(row);
        return;
      }
    });

    tbody.addEventListener("mouseenter", e => {
      const tr = e.target.closest?.("tr[data-id]");
      if (!tr || tr.querySelector(".btn-vista-previa-fila")) return;
      const id = tr.dataset.id;
      const td = tr.querySelector(".celda-avatar")?.closest("td");
      if (!td) return;
      td.classList.add("td-vista-previa");
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "btn-vista-previa-fila"; btn.dataset.cotId = id; btn.textContent = "Vista previa";
      td.appendChild(btn);
    }, true);
  }

  /* ================================================================
     TOGGLE FILTROS RÁPIDOS
     ================================================================ */
  function initToggleFiltros() {
    const btn = document.getElementById("btn-toggle-filtros");
    const fila = document.getElementById("filtros-rapidos");
    if (!btn || !fila) return;
    btn.addEventListener("click", () => {
      const visible = !fila.hasAttribute("hidden");
      if (visible) { fila.setAttribute("hidden", ""); btn.classList.remove("btn--activo"); btn.setAttribute("aria-pressed", "false"); }
      else { fila.removeAttribute("hidden"); btn.classList.add("btn--activo"); btn.setAttribute("aria-pressed", "true"); }
    });
  }

  /* ================================================================
     EXPORTAR POPOVER
     ================================================================ */
  function initExportarToolbar() {
    function actualizarContadores() {
      const est = window.estadoApp;
      const elV = document.getElementById("export-cnt-visibles");
      const elT = document.getElementById("export-cnt-todos");
      if (elV) elV.textContent = `${est.datosVisibles.length} filas`;
      if (elT) elT.textContent = `${est.datosOriginales.length} filas`;
    }
    window.actualizarContadoresExport = actualizarContadores;

    const pop = document.getElementById("popover-export-opciones");
    if (!pop) return;
    pop.addEventListener("click", e => {
      const btn = e.target.closest("[data-export-alcance]");
      if (!btn) return;
      exportarTodosCSV(btn.dataset.exportAlcance);
      Popovers.cerrar();
    });

    new MutationObserver(() => { if (!pop.hasAttribute("hidden")) actualizarContadores(); }).observe(pop, { attributes: true, attributeFilter: ["hidden"] });
  }

  /* ================================================================
     PANEL CONFIG TABLA
     ================================================================ */
  function initConfigTabla() {
    const panel = document.getElementById("panel-config-tabla");
    if (!panel) return;
    panel.querySelectorAll('input[name="tamano-pag"]').forEach(rb => {
      rb.addEventListener("change", e => {
        const v = parseInt(e.target.value, 10);
        window.estadoApp.registrosPorPagina = v;
        window.estadoApp.paginaActual = 1;
        const lbl = document.getElementById("lbl-tamano");
        if (lbl) lbl.textContent = `${v} por página`;
        const radio = document.querySelector(`input[name="tamano-pag"][value="${v}"]`);
        if (radio) radio.checked = true;
        if (window.tablaInstance) window.tablaInstance.renderizar();
      });
    });
    panel.querySelectorAll('input[name="altura"]').forEach(rb => {
      rb.addEventListener("change", e => {
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

  /* ================================================================
     TAMAÑO DE PÁGINA (popover)
     ================================================================ */
  function initTamanoPagina() {
    const popover = document.getElementById("popover-tamano-pagina");
    if (!popover) return;
    popover.addEventListener("click", e => {
      const btn = e.target.closest("[data-page-size]");
      if (!btn) return;
      const v = parseInt(btn.dataset.pageSize, 10);
      if (!v) return;
      window.estadoApp.registrosPorPagina = v;
      window.estadoApp.paginaActual = 1;
      const lbl = document.getElementById("lbl-tamano");
      if (lbl) lbl.textContent = `${v} por página`;
      const radio = document.querySelector(`input[name="tamano-pag"][value="${v}"]`);
      if (radio) radio.checked = true;
      if (window.tablaInstance) window.tablaInstance.renderizar();
      Popovers.cerrar();
    });
  }

  /* ================================================================
     DUPLICAR VISTA ACTIVA
     ================================================================ */
  function initDuplicarVista() {
    document.getElementById("btn-duplicar-vista")?.addEventListener("click", () => {
      const id = window.estadoApp?.vistaActivaId;
      if (id && window.vistasInstance) window.vistasInstance.clonarVista(id);
    });
  }

  /* ================================================================
     MODAL AGREGAR VISTA
     ================================================================ */
  function initModalAgregarVista() {
    const modal = document.getElementById("modal-agregar-vista");
    if (!modal) return;

    const CATALOGO = {
      todos: { nombre: "Todos los asesores", descripcion: "Muestra todos los asesores sin filtros.", filtrosDesc: [], filtro: () => true },
      pendientes: { nombre: "Pendientes de pago", descripcion: "Asesores con comisión no pagada.", filtrosDesc: ["Estado: Pendiente, Parcial"], filtro: r => r.estado !== "pagado" },
      pagados: { nombre: "Pagados", descripcion: "Asesores con comisión pagada.", filtrosDesc: ["Estado: Pagado"], filtro: r => r.estado === "pagado" },
      activos: { nombre: "Solo activos", descripcion: "Asesores marcados como activos.", filtrosDesc: ["Activo: Sí"], filtro: r => r.activo !== false }
    };

    let vistaSeleccionada = "todos";

    const lista = document.getElementById("modal-vistas-lista");
    lista?.addEventListener("click", e => {
      const item = e.target.closest(".modal-vistas__item");
      if (!item || item.classList.contains("modal-vistas__item--agregada")) return;
      modal.querySelectorAll(".modal-vistas__item--seleccionado").forEach(i => i.classList.remove("modal-vistas__item--seleccionado"));
      item.classList.add("modal-vistas__item--seleccionado");
      vistaSeleccionada = item.dataset.vista;
    });

    document.getElementById("confirmar-agregar-vista")?.addEventListener("click", () => {
      if (!vistaSeleccionada) return;
      if (window.estadoApp?.vistas?.find(v => v.id === vistaSeleccionada)) {
        window.mostrarToast?.("Esa vista ya está en tus pestañas"); return;
      }
      const cat = CATALOGO[vistaSeleccionada];
      if (cat && window.vistasInstance) {
        window.vistasInstance.agregarVista(vistaSeleccionada, cat.nombre, cat.filtro);
        window.mostrarToast?.(`✓ Vista "${cat.nombre}" agregada`);
      }
      Modales.cerrar(modal);
    });

    new MutationObserver(() => {
      if (!modal.hidden) {
        modal.querySelectorAll(".modal-vistas__item").forEach(item => {
          item.classList.toggle("modal-vistas__item--agregada", !!window.estadoApp?.vistas?.find(v => v.id === item.dataset.vista));
        });
      }
    }).observe(modal, { attributes: true, attributeFilter: ["hidden"] });
  }

  /* ================================================================
     VISTA DE TABLA (tipo vista)
     ================================================================ */
  function initVistaTabla() {
    const popover = document.getElementById("popover-vista-tabla");
    if (!popover) return;
    popover.addEventListener("click", e => {
      const item = e.target.closest("[data-vista-tipo]");
      if (!item) return;
      popover.querySelectorAll("[data-vista-tipo]").forEach(i => i.classList.remove("popover__item--seleccionado"));
      item.classList.add("popover__item--seleccionado");
      const tipo = item.dataset.vistaTipo;
      const label = document.getElementById("lbl-vista-tabla");
      const nombres = { tabla: "Vista de tabla", tablero: "Vista de tablero", lista: "Vista de lista" };
      if (label) label.textContent = nombres[tipo] || "Vista de tabla";
      if (tipo !== "tabla") window.mostrarToast(`📋 La vista "${nombres[tipo]}" estará disponible próximamente`);
      Popovers.cerrar();
    });
  }

  /* ================================================================
     EDITAR COLUMNAS
     ================================================================ */
  function initEditarColumnas() {
    const modal = document.getElementById("modal-editar-columnas");
    const colDisp = document.getElementById("cols-disponibles");
    const colSel = document.getElementById("cols-seleccionadas");
    if (!modal || !colDisp || !colSel) return;

    const MAPA_TEXTO = window.MAPA_TEXTO_COM || {
      responsable: "Asesor", ingresos: "Ingresos base", porcentaje: "% Comisión",
      teorico: "Com. teórica", registrado: "Com. registrada",
      pagos: "# Pagos", diferencia: "Diferencia", estado: "Estado"
    };
    const texto = k => MAPA_TEXTO[k] || k;

    function contar() {
      const el = document.getElementById("contador-cols");
      if (el) el.textContent = colSel.querySelectorAll(".editar-columnas__seleccionada").length;
    }

    function crearItem(clave, fija) {
      const div = document.createElement("div");
      div.dataset.col = clave;
      if (fija) {
        div.className = "editar-columnas__seleccionada editar-columnas__seleccionada--fija";
        div.textContent = texto(clave);
      } else {
        div.className = "editar-columnas__seleccionada";
        div.draggable = true;
        div.innerHTML = `<span class="editar-columnas__drag">⋮⋮</span>${texto(clave)}<button type="button" class="editar-columnas__remover" aria-label="Quitar">×</button>`;
      }
      return div;
    }

    function sincronizar() {
      const cols = window.estadoApp?.columnasActivas || window.COLUMNAS_DEFECTO_COM || ["responsable", "ingresos", "porcentaje", "teorico", "registrado", "pagos", "diferencia", "estado"];
      colSel.innerHTML = "";
      cols.forEach(k => colSel.appendChild(crearItem(k, k === "responsable")));
      contar();
      colDisp.querySelectorAll("[data-col]").forEach(lbl => {
        const cb = lbl.querySelector("input[type=checkbox]");
        if (cb) cb.checked = cols.includes(lbl.dataset.col);
      });
    }

    let dragged = null;
    colSel.addEventListener("dragstart", e => {
      const row = e.target.closest(".editar-columnas__seleccionada:not(.editar-columnas__seleccionada--fija)");
      if (!row) { e.preventDefault(); return; }
      dragged = row; requestAnimationFrame(() => row.classList.add("dragging")); e.dataTransfer.effectAllowed = "move";
    });
    colSel.addEventListener("dragend", () => { dragged?.classList.remove("dragging"); dragged = null; });
    colSel.addEventListener("dragover", e => {
      e.preventDefault(); if (!dragged) return;
      const over = e.target.closest(".editar-columnas__seleccionada");
      if (!over || over === dragged || over.classList.contains("editar-columnas__seleccionada--fija")) return;
      const { top, height } = over.getBoundingClientRect();
      colSel.insertBefore(dragged, e.clientY < top + height / 2 ? over : over.nextSibling);
    });

    colDisp.addEventListener("change", e => {
      const cb = e.target.closest("input[type=checkbox]"); if (!cb) return;
      const lbl = cb.closest("[data-col]"); const clave = lbl?.dataset.col; if (!clave) return;
      if (cb.checked) { if (!colSel.querySelector(`[data-col="${clave}"]`)) { colSel.appendChild(crearItem(clave, false)); contar(); } }
      else { colSel.querySelector(`[data-col="${clave}"]`)?.remove(); contar(); }
    });
    colSel.addEventListener("click", e => {
      const btn = e.target.closest(".editar-columnas__remover"); if (!btn) return;
      const row = btn.closest(".editar-columnas__seleccionada"); const clave = row?.dataset.col;
      row?.remove(); contar();
      const cb = colDisp.querySelector(`[data-col="${clave}"] input[type=checkbox]`); if (cb) cb.checked = false;
    });

    document.getElementById("btn-aplicar-columnas")?.addEventListener("click", () => {
      const cols = [...colSel.querySelectorAll("[data-col]")].map(d => d.dataset.col).filter(Boolean);
      if (!cols.length) { window.mostrarToast?.("⚠ Agrega al menos una columna"); return; }
      window.estadoApp.columnasActivas = cols;
      if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
      else if (window.tablaInstance) window.tablaInstance.renderizar();
      Modales.cerrar(modal);
      window.mostrarToast?.(`✓ ${cols.length} columnas aplicadas`);
    });

    modal.querySelector(".modal__footer a.btn--link")?.addEventListener("click", e => {
      e.preventDefault();
      colSel.querySelectorAll(".editar-columnas__seleccionada:not(.editar-columnas__seleccionada--fija)").forEach(d => d.remove());
      colDisp.querySelectorAll("input[type=checkbox]").forEach(cb => cb.checked = false);
      contar();
    });

    document.getElementById("input-buscar-columnas")?.addEventListener("input", e => {
      const q = e.target.value.toLowerCase();
      colDisp.querySelectorAll(".editar-columnas__opt").forEach(opt => {
        opt.style.display = opt.textContent.toLowerCase().includes(q) ? "" : "none";
      });
    });

    document.getElementById("btn-editar-columnas")?.addEventListener("click", () => { sincronizar(); Modales.abrir("modal-editar-columnas"); });
    sincronizar();
  }

  /* ================================================================
     INIT
     ================================================================ */
  document.addEventListener("DOMContentLoaded", () => {
    Popovers.init();
    Modales.init();
    PanelConfig.init();
    PanelDetalle.init();

    asegurarConfigInicial();

    // Sincronizar config con API en background
    if (window.Api) {
      window.Api.comisiones.obtenerConfig()
        .then(resp => {
          if (resp && Array.isArray(resp.porAsesor)) {
            // Normalizar formato de API → formato JS antes de guardar en localStorage
            resp.porAsesor = resp.porAsesor.map(a => ({
              ...a,
              activo: !!a.activo
            }));
            if (Array.isArray(resp.porProducto)) {
              resp.porProducto = resp.porProducto.map(p => ({
                productoId: p.productoId ?? p.producto_id ?? null,
                producto: p.producto ?? p.nombre_producto ?? '',
                porcentaje: parseFloat(p.porcentaje) || 5
              }));
            }
            try { localStorage.setItem(KEY_LS, JSON.stringify(Object.assign(clonarDefault(), resp))); } catch (_) { /**/ }
          }
        })
        .catch(e => console.warn("[Comisiones] No se pudo sincronizar config:", e.message));
    }

    initSelectorObjetos();
    initTabMenu();
    initTabAdd();
    initModalAgregarVista();
    initCabeceraMenu();
    initModalConfigComisiones();
    initModalRegistrarPago();
    initModalEditarPago();
    initFiltrosPill();
    initFiltroAdd();
    initEditarFiltros();
    initOrdenar();
    initConfigTabla();
    initTamanoPagina();
    initExportarToolbar();
    initToggleFiltros();
    initVistaTabla();
    initDuplicarVista();
    initEditarColumnas();
    initClickFilasCom();

    window.Popovers = Popovers;
    window.Modales = Modales;
    window.PanelConfig = PanelConfig;
    window.PanelDetalle = PanelDetalle;

    console.log("[Comisiones] UI interactions inicializadas");
  });

  // Cuando HubSpot owners lleguen, actualizar listas de asesores
  document.addEventListener("hubspot:owners-loaded", ({ detail }) => {
    // Lista del filtro pill
    poblarListaAsesores();

    // Config modal — re-renderizar si está abierto
    const modalCfg = document.getElementById("modal-config-comisiones");
    if (modalCfg && !modalCfg.hasAttribute("hidden")) {
      renderConfigComisiones();
    }

    // Select del modal "Registrar pago" — re-poblar si está abierto
    const selAsesor = document.getElementById("pago-com-asesor");
    if (selAsesor && Array.isArray(detail?.owners)) {
      const previo = selAsesor.value;
      selAsesor.innerHTML = detail.owners
        .map(o => o.nombre).sort()
        .map(n => `<option value="${escHtml(n)}">${escHtml(n)}</option>`).join("");
      selAsesor.value = previo;
    }
  });
})();
