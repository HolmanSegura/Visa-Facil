/* ============================================================
   UI-INTERACTIONS.JS
   Lógica unificada para popovers (dropdowns flotantes),
   modales (overlay centrado) y panel lateral.

   Convención: cualquier botón con [data-popover="id"] abre el
   popover con ese id. Cualquier botón con [data-cerrar-modal]
   cierra el modal-overlay ancestro.
   ============================================================ */

(function () {

  /* ----------------------------------------------------------
     1. SISTEMA DE POPOVERS (dropdowns flotantes)
     ---------------------------------------------------------- */
  const Popovers = {
    activo: null,
    triggerActivo: null,

    /** Posiciona el popover relativo al trigger. */
    posicionar(popover, trigger) {
      const rectT = trigger.getBoundingClientRect();
      // Mostramos primero para medir
      popover.style.visibility = "hidden";
      popover.removeAttribute("hidden");

      const rectP = popover.getBoundingClientRect();
      const margenEspacio = 6;

      // Por defecto: debajo del trigger, alineado a la izquierda
      let top = rectT.bottom + margenEspacio;
      let left = rectT.left;

      // Si se sale por la derecha, alinear a la derecha del trigger
      if (left + rectP.width > window.innerWidth - 10) {
        left = rectT.right - rectP.width;
      }
      if (left < 10) left = 10;

      // Si se sale por abajo, mostrar arriba del trigger
      if (top + rectP.height > window.innerHeight - 10) {
        top = rectT.top - rectP.height - margenEspacio;
        if (top < 10) top = 10;
      }

      popover.style.top = top + "px";
      popover.style.left = left + "px";
      popover.style.visibility = "visible";
    },

    abrir(idPopover, trigger) {
      // Si ya estaba abierto este mismo: cerrar (toggle)
      if (this.activo && this.activo.id === idPopover) {
        this.cerrar();
        return;
      }
      this.cerrar();

      const popover = document.getElementById(idPopover);
      if (!popover) return;

      this.posicionar(popover, trigger);
      this.activo = popover;
      this.triggerActivo = trigger;
      if (trigger.setAttribute) trigger.setAttribute("aria-expanded", "true");
    },

    cerrar() {
      if (this.activo) {
        this.activo.setAttribute("hidden", "");
      }
      if (this.triggerActivo && this.triggerActivo.setAttribute) {
        this.triggerActivo.setAttribute("aria-expanded", "false");
      }
      this.activo = null;
      this.triggerActivo = null;
    },

    init() {
      // Toggle de popovers: cualquier elemento con data-popover
      document.addEventListener("click", (e) => {
        const trigger = e.target.closest("[data-popover]");
        if (trigger) {
          e.stopPropagation();
          const id = trigger.getAttribute("data-popover");
          this.abrir(id, trigger);
          return;
        }

        // Click fuera: cerrar
        if (this.activo && !this.activo.contains(e.target)) {
          this.cerrar();
        }
      });

      // ESC cierra el popover
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && this.activo) this.cerrar();
      });

      // Reposicionar si cambia el tamaño de la ventana
      window.addEventListener("resize", () => {
        if (this.activo && this.triggerActivo) {
          this.posicionar(this.activo, this.triggerActivo);
        }
      });
    }
  };

  /* ----------------------------------------------------------
     2. SISTEMA DE MODALES
     ---------------------------------------------------------- */
  const Modales = {
    abrir(idModal) {
      const modal = document.getElementById(idModal);
      if (!modal) return;
      modal.removeAttribute("hidden");
      document.body.style.overflow = "hidden";
    },

    cerrar(modal) {
      if (!modal) return;
      modal.setAttribute("hidden", "");
      document.body.style.overflow = "";
    },

    init() {
      // Cerrar modal con cualquier elemento [data-cerrar-modal]
      document.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-cerrar-modal]");
        if (btn) {
          const overlay = btn.closest(".modal-overlay");
          this.cerrar(overlay);
        }

        // Click sobre el overlay (fuera de .modal): cerrar
        if (e.target.classList && e.target.classList.contains("modal-overlay")) {
          this.cerrar(e.target);
        }
      });

      // ESC cierra modal abierto
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          const abierto = document.querySelector(".modal-overlay:not([hidden])");
          if (abierto) this.cerrar(abierto);
        }
      });
    }
  };

  /* ----------------------------------------------------------
     3. PANEL LATERAL (Configuración de la tabla)
     ---------------------------------------------------------- */
  const PanelLateral = {
    abrir() {
      const panel = document.getElementById("panel-config-tabla");
      if (panel) panel.classList.add("abierto");
    },
    cerrar() {
      const panel = document.getElementById("panel-config-tabla");
      if (panel) panel.classList.remove("abierto");
    },
    init() {
      const btn = document.getElementById("btn-config-tabla");
      if (btn) btn.addEventListener("click", () => this.abrir());

      document.addEventListener("click", (e) => {
        if (e.target.closest("[data-cerrar-panel]")) this.cerrar();
      });
    }
  };

  /* ----------------------------------------------------------
     4. HANDLERS ESPECÍFICOS DEL POPOVER OBJETOS (Cotizaciones)
     ---------------------------------------------------------- */
  function initSelectorObjetos() {
    const popover = document.getElementById("popover-objetos");
    if (!popover) return;

    // Buscador interno: filtra la lista
    const input = popover.querySelector('[data-buscar="objetos"]');
    if (input) {
      input.addEventListener("input", (e) => {
        const q = e.target.value.toLowerCase();
        popover.querySelectorAll(".popover__item").forEach(item => {
          item.style.display = item.textContent.toLowerCase().includes(q) ? "" : "none";
        });
      });
    }

    // Click en un objeto: cerrar popover
    popover.querySelectorAll(".popover__item").forEach(item => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        Popovers.cerrar();
      });
    });
  }

  /* ----------------------------------------------------------
     5. HANDLERS DEL MENÚ 3 PUNTOS DE TABS
     ---------------------------------------------------------- */
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

  /* ----------------------------------------------------------
     6. HANDLERS DEL BOTÓN + DE TABS
     ---------------------------------------------------------- */
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

  /* ----------------------------------------------------------
     7. MODAL: AGREGAR VISTA
     ---------------------------------------------------------- */
  function initModalAgregarVista() {
    const modal = document.getElementById("modal-agregar-vista");
    if (!modal) return;

    let vistaSeleccionada = "todas";

    // Catálogo de vistas disponibles desde el modal (filtro asociado)
    const catalogo = {
      pendiente_aceptacion: { nombre: "Pendiente de aceptación", filtro: (it) => (it.estado === "publicado" || it.estado === "en_revision") },
      pendiente_aprobacion: { nombre: "Pendiente de aprobación", filtro: (it) => it.estado === "en_revision" },
      todas: { nombre: "Todas las cotizaciones", filtro: () => true },
      vence_pronto: {
        nombre: "Vence pronto", filtro: (it) => {
          const hoy = new Date("2026-05-20");
          const venc = new Date(it.fechaVencimiento);
          const dias = (venc - hoy) / 86400000;
          return dias >= 0 && dias <= 30;
        }
      },
      rec_pendiente: { nombre: "Pendiente de aceptación", filtro: (it) => it.estado === "en_revision" }
    };

    // Click en item de la lista
    modal.querySelectorAll(".modal-vistas__item").forEach(item => {
      item.addEventListener("click", () => {
        modal.querySelectorAll(".modal-vistas__item").forEach(i =>
          i.classList.remove("modal-vistas__item--seleccionado")
        );
        item.classList.add("modal-vistas__item--seleccionado");
        vistaSeleccionada = item.dataset.vista;

        // Actualizar panel de detalle
        const cat = catalogo[vistaSeleccionada];
        if (cat) {
          modal.querySelector(".modal-vistas__detalle-titulo").innerHTML =
            `<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M4 4h16v16H4V4Zm2 2v12h12V6H6Z"/></svg>${cat.nombre}`;
        }
      });
    });

    // Botón Agregar
    const btnAgregar = modal.querySelector("#confirmar-agregar-vista");
    if (btnAgregar) {
      btnAgregar.addEventListener("click", () => {
        const cat = catalogo[vistaSeleccionada];
        if (cat && window.vistasInstance) {
          window.vistasInstance.agregarVista(vistaSeleccionada, cat.nombre, cat.filtro);
          window.mostrarToast(`✓ Vista "${cat.nombre}" agregada`);
        }
        Modales.cerrar(modal);
      });
    }
  }

  /* ----------------------------------------------------------
     8. MENÚ 3 PUNTOS DE CABECERA (derecha) + Configurar pagos
     ---------------------------------------------------------- */
  function initCabeceraMenu() {
    const popover = document.getElementById("popover-cabecera-menu");
    if (popover) {
      popover.addEventListener("click", (e) => {
        const accion = e.target.closest("[data-accion]")?.dataset.accion;
        if (!accion) return;
        if (accion === "cab-informes")            window.mostrarToast("🔗 Abriendo informes de cotizaciones...");
        if (accion === "cab-descargar")           window.mostrarToast("⬇ Descargando cotizaciones publicadas...");
        if (accion === "cab-config-comisiones")   Modales.abrir("modal-config-comisiones");
        if (accion === "cab-reporte-comisiones")  Modales.abrir("modal-reporte-comisiones");
        Popovers.cerrar();
      });
    }

    const btnPagos = document.getElementById("btn-config-pagos");
    if (btnPagos) {
      btnPagos.addEventListener("click", () => {
        window.mostrarToast("💳 Abriendo configuración de pagos online...");
      });
    }
  }

  /* ----------------------------------------------------------
     9. MODAL: CREAR COTIZACIÓN
     ---------------------------------------------------------- */
  function initCrearCotizacion() {
    const btn = document.getElementById("btn-crear-cotizacion");
    if (btn) {
      btn.addEventListener("click", () => {
        // Pre-poblar fechas
        const hoy = new Date("2026-05-20");
        const dentro30 = new Date("2026-05-20");
        dentro30.setDate(dentro30.getDate() + 30);
        const iso = (d) => d.toISOString().slice(0, 10);
        const fc = document.getElementById("cot-fecha-creacion");
        const fv = document.getElementById("cot-fecha-vencimiento");
        if (fc) fc.value = iso(hoy);
        if (fv) fv.value = iso(dentro30);
        Modales.abrir("modal-crear-cotizacion");
      });
    }

    const btnGuardar = document.getElementById("guardar-cotizacion");
    if (btnGuardar) {
      btnGuardar.addEventListener("click", () => {
        const titulo = document.getElementById("cot-titulo").value.trim();
        const cantidad = parseFloat(document.getElementById("cot-cantidad").value) || 0;
        const moneda = document.getElementById("cot-moneda").value;
        const estado = document.getElementById("cot-estado").value;
        const propietario = document.getElementById("cot-propietario").value;
        const negocio = document.getElementById("cot-negocio").value.trim();
        const fechaCreacion = document.getElementById("cot-fecha-creacion").value;
        const fechaVencimiento = document.getElementById("cot-fecha-vencimiento").value;
        const cliente = document.getElementById("cot-cliente").value.trim();

        if (!titulo) {
          window.mostrarToast("⚠ El título es obligatorio");
          return;
        }

        const nuevoId = Math.max(...window.estadoApp.datosOriginales.map(c => c.id)) + 1;
        const nueva = {
          id: nuevoId,
          titulo,
          estado: estado || "borrador",
          cantidad,
          moneda,
          estadoFirma: "no_aplica",
          fechaCreacion,
          fechaVencimiento,
          responsable: propietario || "Néstor Goyes",
          cliente: cliente || "—",
          negocio: negocio || titulo
        };

        window.estadoApp.datosOriginales.unshift(nueva);

        // Reset form
        document.getElementById("form-cotizacion").reset();

        // Cerrar modal
        Modales.cerrar(document.getElementById("modal-crear-cotizacion"));

        // Actualizar vistas y tabla
        if (window.vistasInstance) window.vistasInstance.renderizar();
        if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();

        window.mostrarToast(`✓ Cotización "${titulo}" creada`);
      });
    }
  }

  /* ----------------------------------------------------------
     10. EDITAR COLUMNAS + ORDENAR
     ---------------------------------------------------------- */
  function initEditarColumnas() {
    const btn = document.getElementById("btn-editar-columnas");
    if (btn) btn.addEventListener("click", () => Modales.abrir("modal-editar-columnas"));

    const modal = document.getElementById("modal-editar-columnas");
    if (!modal) return;

    // Filtro de búsqueda de columnas
    const inputBuscar = document.getElementById("input-buscar-columnas");
    if (inputBuscar) {
      inputBuscar.addEventListener("input", (e) => {
        const q = e.target.value.toLowerCase();
        modal.querySelectorAll(".editar-columnas__opt").forEach(opt => {
          opt.style.display = opt.textContent.toLowerCase().includes(q) ? "" : "none";
        });
      });
    }

    // Remover columna desde la lista derecha
    modal.querySelectorAll(".editar-columnas__remover").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const row = btn.closest(".editar-columnas__seleccionada");
        if (row) {
          row.remove();
          actualizarContador();
        }
      });
    });

    function actualizarContador() {
      const cont = document.getElementById("contador-cols");
      if (cont) {
        const total = modal.querySelectorAll(".editar-columnas__seleccionada").length;
        cont.textContent = total;
      }
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
          window.tablaInstance.ordenarPorColumna(e.target.value); // doble para mantener dir
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
  }

  /* ----------------------------------------------------------
     11. FILTROS PILL (Estado, Actividad, Propietario, Firma)
     ---------------------------------------------------------- */
  function initFiltrosPill() {
    // Poblar lista de propietarios dinámicamente
    const listaProp = document.getElementById("lista-propietarios");
    if (listaProp) {
      const propietariosUnicos = [...new Set(window.estadoApp.datosOriginales.map(c => c.responsable))].sort();
      listaProp.innerHTML = propietariosUnicos.map(nombre => `
        <label class="check-lista__item">
          <input type="checkbox" data-prop="${nombre}"/>
          <span class="celda-avatar__circulo" style="width:22px;height:22px;font-size:10px;">${window.obtenerIniciales(nombre)}</span>
          ${nombre}
        </label>
      `).join("");
    }

    // ESTADO
    const popEstado = document.getElementById("popover-filtro-estado");
    if (popEstado) {
      popEstado.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener("change", () => {
          const valores = [...popEstado.querySelectorAll('input[type="checkbox"]:checked')]
            .map(c => c.dataset.filtroVal);
          window.estadoApp.filtros.estado = valores;
          if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
        });
      });
    }

    // ACTIVIDAD — presets + rango personalizado
    const popAct = document.getElementById("popover-filtro-actividad");
    if (popAct) {
      // Presets (clic directo aplica)
      popAct.querySelectorAll(".popover__item[data-filtro-val]").forEach(it => {
        it.addEventListener("click", () => {
          const val = it.dataset.filtroVal;
          window.estadoApp.filtros.actividad = val || null;
          // Limpiar inputs del rango personalizado
          const inDesde = document.getElementById("filtro-actividad-desde");
          const inHasta = document.getElementById("filtro-actividad-hasta");
          if (inDesde) inDesde.value = "";
          if (inHasta) inHasta.value = "";
          if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
          Popovers.cerrar();
        });
      });

      // Rango personalizado: Aplicar / Limpiar
      popAct.querySelectorAll("[data-actividad-accion]").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const accion = btn.dataset.actividadAccion;
          const inDesde = document.getElementById("filtro-actividad-desde");
          const inHasta = document.getElementById("filtro-actividad-hasta");
          if (accion === "limpiar") {
            if (inDesde) inDesde.value = "";
            if (inHasta) inHasta.value = "";
            window.estadoApp.filtros.actividad = null;
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
            window.estadoApp.filtros.actividad = {
              desde: desde || null,
              hasta: hasta || null
            };
            if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
            Popovers.cerrar();
          }
        });
      });
    }

    // PROPIETARIO
    if (listaProp) {
      listaProp.addEventListener("change", (e) => {
        if (e.target.matches('input[type="checkbox"]')) {
          const valores = [...listaProp.querySelectorAll('input[type="checkbox"]:checked')]
            .map(c => c.dataset.prop);
          window.estadoApp.filtros.propietario = valores;
          if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
        }
      });
    }

    // FIRMA
    const popFirma = document.getElementById("popover-filtro-firma");
    if (popFirma) {
      popFirma.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener("change", () => {
          const valores = [...popFirma.querySelectorAll('input[type="checkbox"]:checked')]
            .map(c => c.dataset.filtroVal);
          window.estadoApp.filtros.firma = valores;
          if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
        });
      });
    }
  }

  /* ----------------------------------------------------------
     12. EDITAR FILTROS RÁPIDOS (lápiz)
     ---------------------------------------------------------- */
  function initEditarFiltros() {
    const btn = document.getElementById("btn-edit-filtros");
    if (btn) btn.addEventListener("click", () => Modales.abrir("modal-editar-filtros"));

    const modal = document.getElementById("modal-editar-filtros");
    if (!modal) return;

    modal.addEventListener("click", (e) => {
      const remover = e.target.closest(".popover-fila-editor__remover");
      if (remover) {
        e.stopPropagation();
        const row = remover.closest(".popover-fila-editor__item");
        if (row) row.remove();
        const total = modal.querySelectorAll(".popover-fila-editor__item").length;
        const cont = document.getElementById("contador-filtros");
        if (cont) cont.textContent = total;
      }
    });
  }

  /* ----------------------------------------------------------
     13. PANEL LATERAL: Configuración de la tabla
     ---------------------------------------------------------- */
  function initConfigTabla() {
    const panel = document.getElementById("panel-config-tabla");
    if (!panel) return;

    // Registros por página
    panel.querySelectorAll('input[name="tamano-pag"]').forEach(rb => {
      rb.addEventListener("change", (e) => {
        const valor = parseInt(e.target.value, 10);
        window.estadoApp.registrosPorPagina = valor;
        window.estadoApp.paginaActual = 1;
        if (window.tablaInstance) window.tablaInstance.renderizar();

        // Actualizar label del botón de paginación
        const lbl = document.getElementById("lbl-tamano");
        if (lbl) lbl.textContent = `${valor} por página`;
      });
    });

    // Altura de fila
    panel.querySelectorAll('input[name="altura"]').forEach(rb => {
      rb.addEventListener("change", (e) => {
        window.estadoApp.configTabla.altura = e.target.value;
        if (window.tablaInstance) window.tablaInstance.aplicarConfigTabla();
      });
    });

    // Switch zebra
    const sw = document.getElementById("switch-zebra");
    if (sw) {
      sw.addEventListener("click", () => {
        sw.classList.toggle("activo");
        window.estadoApp.configTabla.zebra = sw.classList.contains("activo");
        if (window.tablaInstance) window.tablaInstance.aplicarConfigTabla();
      });
    }
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

  /* ----------------------------------------------------------
     INIT GENERAL
     ---------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    Popovers.init();
    Modales.init();
    PanelLateral.init();

    initSelectorObjetos();
    initTabMenu();
    initTabAdd();
    initModalAgregarVista();
    initCabeceraMenu();
    initCrearCotizacion();
    initEditarColumnas();
    initOrdenar();
    initFiltrosPill();
    initEditarFiltros();
    initConfigTabla();
    initTamanoPagina();

    // Exponer para debug
    window.Popovers = Popovers;
    window.Modales = Modales;
    window.PanelLateral = PanelLateral;

    console.log("[UI] Interactions inicializadas correctamente");
  });
})();
