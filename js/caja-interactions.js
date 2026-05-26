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
    init() {
      document.addEventListener("click", (e) => {
        if (e.target.closest("[data-cerrar-detalle]")) this.cerrar();
      });

      // Acciones del panel
      const btnAnular = document.getElementById("detalle-anular");
      if (btnAnular) {
        btnAnular.addEventListener("click", () => {
          if (this.movimientoActual) {
            if (confirm(`¿Anular el movimiento "${this.movimientoActual.descripcion}"?`)) {
              this.movimientoActual.estado = "anulado";
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
          }
        });
      }

      const btnEditar = document.getElementById("detalle-editar");
      if (btnEditar) {
        btnEditar.addEventListener("click", () => {
          window.mostrarToast("✎ Función Editar (próximamente)");
        });
      }
    }
  };

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
        window.mostrarToast("📋 Catálogo de vistas (próximamente)");
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
      document.getElementById("g-fecha").value = "2026-05-20";
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

  /* ---------- INIT ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    Popovers.init();
    Modales.init();
    PanelConfig.init();
    PanelDetalle.init();

    initSelectorObjetos();
    initTabMenu();
    initTabAdd();
    initCabeceraMenu();
    initFormGasto();
    initEditarColumnas();
    initOrdenar();
    initFiltrosPill();
    initEditarFiltros();
    initConfigTabla();
    initTarjetasResumen();
    initTamanoPagina();

    initToggleFiltros();
    initVistaTabla();
    initDuplicarVista();

    window.Popovers = Popovers;
    window.Modales = Modales;
    window.PanelConfig = PanelConfig;
    window.PanelDetalle = PanelDetalle;

    console.log("[Caja] UI interactions inicializadas");
  });
})();