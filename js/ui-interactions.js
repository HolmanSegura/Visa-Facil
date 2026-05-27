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
      if (panel) {
        // Cerrar panel de detalle si está abierto (no superponer)
        PanelDetalleCotizacion.cerrar();
        panel.classList.add("abierto");
      }
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
     3.a.2 EDITAR / ENVIAR COTIZACIÓN (desde el panel)
     ---------------------------------------------------------- */
  const EditarCotizacion = {
    _cot: null,

    abrir(cot) {
      if (!cot) return;
      this._cot = cot;
      document.getElementById("editar-cot-id").value = cot.id;
      document.getElementById("editar-cot-nombre").value = cot.titulo || "";
      document.getElementById("editar-cot-estado").value = cot.estado || "borrador";
      document.getElementById("editar-cot-moneda").value = cot.moneda || "COP";
      document.getElementById("editar-cot-propietario").value = cot.responsable || "";
      document.getElementById("editar-cot-fvencimiento").value = cot.fechaVencimiento || "";
      document.getElementById("editar-cot-cliente").value = cot.cliente || "";
      Modales.abrir("modal-editar-cotizacion");
    },

    guardar() {
      const id = parseInt(document.getElementById("editar-cot-id").value, 10);
      const cot = window.estadoApp.datosOriginales.find(c => c.id === id);
      if (!cot) return;

      cot.titulo           = document.getElementById("editar-cot-nombre").value.trim();
      cot.estado           = document.getElementById("editar-cot-estado").value;
      cot.moneda           = document.getElementById("editar-cot-moneda").value;
      cot.responsable      = document.getElementById("editar-cot-propietario").value;
      cot.fechaVencimiento = document.getElementById("editar-cot-fvencimiento").value;
      cot.cliente          = document.getElementById("editar-cot-cliente").value.trim();

      if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
      if (window.vistasInstance) window.vistasInstance.renderizar();
      if (PanelDetalleCotizacion.cotActual?.id === id) PanelDetalleCotizacion.renderizar(cot);

      Modales.cerrar(document.getElementById("modal-editar-cotizacion"));
      window.mostrarToast("✓ Cotización actualizada");
    },

    init() {
      const btn = document.getElementById("guardar-editar-cotizacion");
      if (btn) btn.addEventListener("click", () => this.guardar());
    }
  };

  const EnviarCotizacion = {
    abrir(cot) {
      if (!cot) return;
      document.getElementById("enviar-cot-id").value = cot.id;
      document.getElementById("enviar-cot-asunto").value = `Cotización: ${cot.titulo}`;
      document.getElementById("enviar-cot-destinatario").value = "";
      document.getElementById("enviar-cot-mensaje").value =
        `Hola,\n\nAdjunto encontrarás la cotización "${cot.titulo}" para su revisión.\n\nQuedamos atentos a sus comentarios.`;
      Modales.abrir("modal-enviar-cotizacion");
    },

    enviar() {
      const destinatario = document.getElementById("enviar-cot-destinatario").value.trim();
      if (!destinatario) {
        document.getElementById("enviar-cot-destinatario").focus();
        return;
      }
      Modales.cerrar(document.getElementById("modal-enviar-cotizacion"));
      window.mostrarToast(`✓ Cotización enviada a ${destinatario}`);
    },

    init() {
      const btn = document.getElementById("confirmar-enviar-cotizacion");
      if (btn) btn.addEventListener("click", () => this.enviar());
    }
  };

  /* ----------------------------------------------------------
     3.b PANEL LATERAL: Detalle de cotización
     ---------------------------------------------------------- */
  const PanelDetalleCotizacion = {
    cotActual: null,

    abrir(cot) {
      if (!cot) return;
      const panel = document.getElementById("panel-detalle-cotizacion");
      if (!panel) return;
      PanelLateral.cerrar();
      this.cotActual = cot;
      this.renderizar(cot);

      panel.classList.add("abierto");
      document.querySelectorAll(".tabla-cotizaciones tbody tr.fila-activa")
        .forEach(tr => tr.classList.remove("fila-activa"));
      const fila = document.querySelector(`.tabla-cotizaciones tbody tr[data-id="${cot.id}"]`);
      if (fila) fila.classList.add("fila-activa");
    },

    cerrar() {
      const panel = document.getElementById("panel-detalle-cotizacion");
      if (panel) panel.classList.remove("abierto");
      document.querySelectorAll(".tabla-cotizaciones tbody tr.fila-activa")
        .forEach(tr => tr.classList.remove("fila-activa"));
      this.cotActual = null;
    },

    renderizar(c) {
      const $ = (id) => document.getElementById(id);
      const ref = "N.º " + new Date(c.fechaCreacion || Date.now())
        .toISOString().slice(0, 10).replace(/-/g, "") + "-" + String(c.id).padStart(9, "0");

      $("detalle-cot-titulo").textContent = c.titulo;
      $("detalle-cot-monto").textContent = window.formatearMoneda(c.cantidad, c.moneda);
      $("detalle-cot-numero").textContent = ref;
      $("detalle-cot-estado").innerHTML = `
        <span class="estado-badge">
          <span class="estado-dot estado-dot--${c.estado}"></span>
          ${window.etiquetaEstado(c.estado)}
        </span>`;
      $("detalle-cot-propietario").innerHTML = `
        <span class="celda-avatar__circulo">${window.obtenerIniciales(c.responsable)}</span>
        <span class="celda-avatar__nombre">${c.responsable}</span>`;
      $("detalle-cot-cliente").textContent = c.cliente || "—";
      $("detalle-cot-negocio").textContent = c.negocio || "—";
      $("detalle-cot-fcreacion").textContent = window.formatearFecha(c.fechaCreacion);
      $("detalle-cot-fvencimiento").textContent = window.formatearFecha(c.fechaVencimiento);
      $("detalle-cot-firma").textContent = window.etiquetaFirma(c.estadoFirma);

      // Guardar el número de referencia para la vista previa
      c._refNumber = ref;
    },

    init() {
      // Cerrar
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

      // Acciones rápidas (Retirar, Clonar, Descargar, Copiar)
      const acciones = document.querySelectorAll("[data-accion-cot]");
      acciones.forEach(btn => {
        btn.addEventListener("click", () => {
          const accion = btn.dataset.accionCot;
          this.ejecutarAccion(accion);
        });
      });

      // Popover de acciones del panel
      document.addEventListener("click", (e) => {
        const item = e.target.closest("[data-accion-cot-menu]");
        if (!item) return;
        const accion = item.dataset.accionCotMenu;
        const c = this.cotActual;
        switch (accion) {
          case "editar":
            EditarCotizacion.abrir(c);
            break;
          case "vista-previa":
            VistaPreviaCotizacion.abrir(c);
            break;
          case "enviar":
            EnviarCotizacion.abrir(c);
            break;
          case "eliminar":
            if (c && confirm(`¿Eliminar la cotización "${c.titulo}"?`)) {
              const idx = window.estadoApp.datosOriginales.findIndex(x => x.id === c.id);
              if (idx !== -1) window.estadoApp.datosOriginales.splice(idx, 1);
              if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
              if (window.vistasInstance) window.vistasInstance.renderizar();
              this.cerrar();
              window.mostrarToast("✓ Cotización eliminada");
            }
            break;
        }
        Popovers.cerrar();
      });
    },

    ejecutarAccion(accion) {
      const c = this.cotActual;
      if (!c) return;
      switch (accion) {
        case "retirar":
          if (confirm(`¿Retirar la cotización "${c.titulo}"?`)) {
            c.estado = "borrador";
            if (window.Api) {
              window.Api.cotizaciones.actualizar(c.id, { estado: "borrador" }).catch(e =>
                console.warn("[UI] API retirar cotización falló:", e.message)
              );
            }
            if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
            if (window.vistasInstance) window.vistasInstance.renderizar();
            window.mostrarToast("✓ Cotización retirada");
            this.cerrar();
          }
          break;

        case "clonar": {
          const nuevoId = Math.max(...window.estadoApp.datosOriginales.map(x => x.id)) + 1;
          const clon = { ...c, id: nuevoId, titulo: c.titulo + " (copia)", estado: "borrador", estadoFirma: "no_aplica" };
          window.estadoApp.datosOriginales.unshift(clon);
          if (window.Api) {
            const datosApi = { ...clon };
            delete datosApi.id;
            window.Api.cotizaciones.crear(datosApi)
              .then(resp => { if (resp.id) clon.id = resp.id; })
              .catch(e => console.warn("[UI] API clonar cotización falló:", e.message));
          }
          if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
          if (window.vistasInstance) window.vistasInstance.renderizar();
          window.mostrarToast(`✓ Cotización clonada: "${clon.titulo}"`);
          break;
        }

        case "descargar":
          VistaPreviaCotizacion.renderizar(c);
          descargarVistaPreviaComoPDF(c);
          break;

        case "copiar":
          const url = `${window.location.origin}/quote/${c.id}`;
          if (navigator.clipboard) {
            navigator.clipboard.writeText(url).then(() => {
              window.mostrarToast("✓ Enlace copiado al portapapeles");
            }).catch(() => {
              window.mostrarToast(`🔗 ${url}`);
            });
          } else {
            window.mostrarToast(`🔗 ${url}`);
          }
          break;
      }
    }
  };

  /* ----------------------------------------------------------
     3.c VISTA PREVIA PÚBLICA (overlay full-screen)
     ---------------------------------------------------------- */
  const VistaPreviaCotizacion = {
    cotActual: null,

    abrir(cot) {
      if (!cot) {
        cot = PanelDetalleCotizacion.cotActual;
      }
      if (!cot) return;
      this.cotActual = cot;
      this.renderizar(cot);
      const overlay = document.getElementById("vista-previa-cotizacion");
      if (overlay) {
        overlay.removeAttribute("hidden");
        document.body.style.overflow = "hidden";
      }
    },

    cerrar() {
      const overlay = document.getElementById("vista-previa-cotizacion");
      if (overlay) {
        overlay.setAttribute("hidden", "");
        document.body.style.overflow = "";
      }
      this.cotActual = null;
    },

    renderizar(c) {
      const $ = (id) => document.getElementById(id);
      const ref = c._refNumber || ("N.º " + new Date(c.fechaCreacion || Date.now())
        .toISOString().slice(0, 10).replace(/-/g, "") + "-" + String(c.id).padStart(9, "0"));
      const moneda = c.moneda || "COP";

      $("vp-titulo").textContent = c.titulo;

      // Lado izquierdo (cliente)
      $("vp-cliente-nombre").textContent = c.cliente || "—";
      $("vp-cliente-dir").textContent = c.cliente ? "Bogotá, Colombia" : "";
      $("vp-cliente-contacto-nombre").textContent = c.cliente ? c.cliente : "";
      $("vp-cliente-contacto-email").textContent = c.cliente ? "contacto@cliente.com" : "";
      $("vp-cliente-contacto-tel").textContent = "";

      $("vp-referencia").textContent = "Referencia: " + ref.replace("N.º ", "");
      $("vp-fcreacion").textContent = "Cotización creada: " + window.formatearFecha(c.fechaCreacion);
      $("vp-fvencimiento").textContent = "La cotización se vence: " + window.formatearFecha(c.fechaVencimiento);

      // Lado derecho (preparado por)
      $("vp-preparado-por").textContent = c.responsable;

      // Total grande arriba
      const totalStr = window.formatearMoneda(c.cantidad, moneda);
      $("vp-total-grande").textContent = totalStr;
      $("vp-total-final").textContent = totalStr;

      // Producto único (simulado a partir del título + cantidad)
      const subtotal = c.cantidad;
      $("vp-productos-tbody").innerHTML = `
        <tr>
          <td>${c.titulo.replace(/^[^a-zA-Z]+/, "")}</td>
          <td class="num">1</td>
          <td class="num">${window.formatearMoneda(subtotal, moneda)}</td>
        </tr>
      `;
      $("vp-subtotal").textContent = window.formatearMoneda(subtotal, moneda);

      // Descuento: oculto por defecto (no hay info en el modelo)
      $("vp-fila-desc").hidden = true;

      // Comentarios y términos: defaults amables
      $("vp-comentarios").textContent =
        "Estamos emocionados por iniciar tu proyecto. Si tienes preguntas, contáctanos.";
      $("vp-terminos").textContent =
        "Forma de pago: a definir con el cliente al aceptar la cotización.";
    },

    init() {
      document.addEventListener("click", (e) => {
        if (e.target.closest("[data-cerrar-vista-previa]")) this.cerrar();
        // Click sobre el overlay (fuera del contenido) cierra
        const overlay = document.getElementById("vista-previa-cotizacion");
        if (e.target === overlay) this.cerrar();
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          const overlay = document.getElementById("vista-previa-cotizacion");
          if (overlay && !overlay.hasAttribute("hidden")) this.cerrar();
        }
      });

      const btnDescargar = document.getElementById("btn-vp-descargar");
      if (btnDescargar) {
        btnDescargar.addEventListener("click", () => {
          descargarVistaPreviaComoPDF(this.cotActual);
        });
      }
    }
  };

  /* ----------------------------------------------------------
     3.d CLICKS EN FILAS DE LA TABLA (abrir panel de detalle)
     ---------------------------------------------------------- */
  function initClickFilas() {
    const tbody = document.getElementById("tbody-cotizaciones");
    if (!tbody) return;

    // Delegación: clicks sobre filas
    tbody.addEventListener("click", (e) => {
      // Botón "Vista previa": abre el panel de detalle lateral
      const btnVP = e.target.closest(".btn-vista-previa-fila");
      if (btnVP) {
        e.stopPropagation();
        const id = parseInt(btnVP.dataset.cotId, 10);
        const cot = window.estadoApp.datosOriginales.find(c => c.id === id);
        if (cot) PanelDetalleCotizacion.abrir(cot);
        return;
      }

      // Click en el enlace del título: abre el modal de edición
      const linkTitulo = e.target.closest(".celda-titulo__link");
      if (linkTitulo) {
        e.preventDefault();
        e.stopPropagation();
        const tr = linkTitulo.closest("tr[data-id]");
        if (!tr) return;
        const id = parseInt(tr.dataset.id, 10);
        const cot = window.estadoApp.datosOriginales.find(c => c.id === id);
        if (cot) VistaPreviaCotizacion.abrir(cot);
        return;
      }

    });

    // Hover: inyectar el botón "Vista previa" si no existe
    tbody.addEventListener("mouseenter", (e) => {
      const tr = e.target.closest && e.target.closest("tr[data-id]");
      if (!tr) return;
      if (tr.querySelector(".btn-vista-previa-fila")) return;
      const id = tr.dataset.id;
      const td = tr.querySelector("td:first-child");
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

    const CATALOGO = {
      pendiente_aceptacion: {
        nombre: "Pendiente de aceptación",
        categoria: "hubspot",
        creador: "Proporcionado por HubSpot",
        tipo: "Tabla",
        descripcion: "Cotizaciones enviadas al cliente que aún no han sido aceptadas ni rechazadas.",
        filtrosDesc: ["Estado: Publicado", "Estado: En revisión"],
        filtro: (it) => it.estado === "publicado" || it.estado === "en_revision"
      },
      pendiente_aprobacion: {
        nombre: "Pendiente de aprobación",
        categoria: "hubspot",
        creador: "Proporcionado por HubSpot",
        tipo: "Tabla",
        descripcion: "Cotizaciones que requieren aprobación interna antes de ser enviadas al cliente.",
        filtrosDesc: ["Estado: En revisión"],
        filtro: (it) => it.estado === "en_revision"
      },
      todas: {
        nombre: "Todas las cotizaciones",
        categoria: "hubspot",
        creador: "Proporcionado por HubSpot",
        tipo: "Tabla",
        descripcion: "Muestra todas las cotizaciones sin ningún filtro aplicado.",
        filtrosDesc: [],
        filtro: () => true
      },
      vence_pronto: {
        nombre: "Vence pronto",
        categoria: "hubspot",
        creador: "Proporcionado por HubSpot",
        tipo: "Tabla",
        descripcion: "Cotizaciones cuya fecha de vencimiento cae dentro de los próximos 30 días.",
        filtrosDesc: ["Fecha de vencimiento: Próximos 30 días"],
        filtro: (it) => {
          const hoy = new Date();
          const venc = new Date(it.fechaVencimiento);
          const dias = (venc - hoy) / 86400000;
          return dias >= 0 && dias <= 30;
        }
      },
      rec_pendiente: {
        nombre: "Pendiente de aceptación",
        categoria: "admin",
        creador: "Recomendado por administrador",
        tipo: "Tabla",
        descripcion: "Vista del equipo de ventas para el seguimiento de cotizaciones pendientes.",
        filtrosDesc: ["Estado: En revisión", "Propietario: Equipo de ventas"],
        filtro: (it) => it.estado === "en_revision"
      }
    };

    let vistaSeleccionada = "todas";
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

    // Selección de ítem por delegación
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

    // Botón Agregar
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

    // Resetear estado cada vez que el modal se abre
    new MutationObserver(() => {
      if (!modal.hidden) {
        actualizarEstadoAgregadas();
        modal.querySelectorAll(".modal-vistas__item--seleccionado").forEach(i => i.classList.remove("modal-vistas__item--seleccionado"));
        const preferido = modal.querySelector(`.modal-vistas__item[data-vista="todas"]:not(.modal-vistas__item--agregada)`)
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

  /* ----------------------------------------------------------
     8. MENÚ 3 PUNTOS DE CABECERA (derecha) + Configurar pagos
     ---------------------------------------------------------- */
  function initCabeceraMenu() {
    const popover = document.getElementById("popover-cabecera-menu");
    if (popover) {
      popover.addEventListener("click", (e) => {
        const accion = e.target.closest("[data-accion]")?.dataset.accion;
        if (!accion) return;

        if (accion === "cab-informes") {
          mostrarInformesCotizaciones();
          Popovers.cerrar();
          return;
        }
        if (accion === "cab-descargar") {
          descargarPublicadas();
          Popovers.cerrar();
          return;
        }
        if (accion === "cab-config-comisiones") Modales.abrir("modal-config-comisiones");
        if (accion === "cab-reporte-comisiones") Modales.abrir("modal-reporte-comisiones");
        Popovers.cerrar();
      });
    }

    // Botón "Configurar pagos online": abre modal real
    const btnPagos = document.getElementById("btn-config-pagos");
    if (btnPagos) {
      btnPagos.addEventListener("click", () => {
        Modales.abrir("modal-config-pagos");
      });
    }

    // Guardar config de pagos
    const btnGuardarPagos = document.getElementById("btn-guardar-config-pagos");
    if (btnGuardarPagos) {
      btnGuardarPagos.addEventListener("click", () => {
        Modales.cerrar(document.getElementById("modal-config-pagos"));
        window.mostrarToast("✓ Configuración de pagos guardada");
      });
    }
  }

  /**
   * Modal de Informes de cotizaciones: agrupa por estado y muestra totales.
   */
  function mostrarInformesCotizaciones() {
    const est = window.estadoApp;
    if (!est) return;

    // Agrupar por estado
    const grupos = {};
    est.datosOriginales.forEach(c => {
      const k = c.estado || "—";
      if (!grupos[k]) grupos[k] = { count: 0, total: 0 };
      grupos[k].count++;
      grupos[k].total += (c.cantidad || 0);
    });

    // KPIs
    const total = est.datosOriginales.length;
    const aprobadas = (grupos["aprobado"]?.count || 0) + (grupos["publicado"]?.count || 0);
    const montoTotal = est.datosOriginales.reduce((s, c) => s + (c.cantidad || 0), 0);

    const kpis = document.getElementById("informes-kpis");
    if (kpis) {
      kpis.innerHTML = `
        <div class="reporte-comisiones__kpi">
          <div class="reporte-comisiones__kpi-titulo">Total cotizaciones</div>
          <div class="reporte-comisiones__kpi-valor">${total}</div>
        </div>
        <div class="reporte-comisiones__kpi">
          <div class="reporte-comisiones__kpi-titulo">Aprobadas / Publicadas</div>
          <div class="reporte-comisiones__kpi-valor">${aprobadas}</div>
        </div>
        <div class="reporte-comisiones__kpi">
          <div class="reporte-comisiones__kpi-titulo">Monto total (COP)</div>
          <div class="reporte-comisiones__kpi-valor">${window.formatearMoneda(montoTotal, "COP")}</div>
        </div>
      `;
    }

    const tbody = document.getElementById("informes-tbody");
    if (tbody) {
      tbody.innerHTML = Object.keys(grupos).sort().map(k => `
        <tr>
          <td>${window.etiquetaEstado(k)}</td>
          <td class="num">${grupos[k].count}</td>
          <td class="num">${window.formatearMoneda(grupos[k].total, "COP")}</td>
        </tr>
      `).join("");
    }

    Modales.abrir("modal-informes");
  }

  /**
   * Abre una ventana de impresión con el contenido de la vista previa
   * para que el usuario pueda guardarlo como PDF.
   */
  function descargarVistaPreviaComoPDF(cot) {
    const contenido = document.querySelector(".vista-previa__contenido");
    if (!contenido) return;

    const estilos = [...document.querySelectorAll('link[rel="stylesheet"]')]
      .map(l => `<link rel="stylesheet" href="${l.href}">`)
      .join("\n");

    const titulo = cot ? cot.titulo : "cotizacion";
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${titulo}</title>
  ${estilos}
  <style>
    @page { size: A4; margin: 15mm; }
    body { margin: 0; background: #fff; font-family: Inter, sans-serif; }
    .vista-previa__contenido { max-width: 100%; padding: 0; }
    .vista-previa__acciones { display: none !important; }
  </style>
</head>
<body>
  <div class="vista-previa__contenido">
    ${contenido.innerHTML}
  </div>
  <script>
    window.addEventListener("load", function () {
      window.print();
      setTimeout(function () { window.close(); }, 300);
    });
  </scr` + `ipt>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const ventana = window.open(url, "_blank");
    if (!ventana) {
      window.mostrarToast("⚠ Permite ventanas emergentes para descargar el PDF");
    }
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  /**
   * Descarga directa de las cotizaciones publicadas (CSV).
   */
  function descargarPublicadas() {
    const est = window.estadoApp;
    if (!est) return;
    const publicadas = est.datosOriginales.filter(c => c.estado === "publicado");
    if (publicadas.length === 0) {
      window.mostrarToast("⚠ No hay cotizaciones publicadas para descargar");
      return;
    }
    if (window.utilsExport) {
      const csv = window.utilsExport.aCSV(publicadas);
      const nombre = window.utilsExport.nombreArchivo("cotizaciones-publicadas");
      window.utilsExport.descargarTexto(csv, nombre);
      window.mostrarToast(`✓ ${publicadas.length} cotizaciones publicadas descargadas`);
    } else if (window.exportarCotizacionesCSV) {
      // Fallback: usar exportador estándar con un swap temporal de datosVisibles
      const original = est.datosVisibles;
      est.datosVisibles = publicadas;
      window.exportarCotizacionesCSV("visibles");
      est.datosVisibles = original;
    }
  }

  /* ----------------------------------------------------------
     9. MODAL: CREAR COTIZACIÓN
     ---------------------------------------------------------- */
  function initCrearCotizacion() {
    const btn = document.getElementById("btn-crear-cotizacion");
    if (btn) {
      btn.addEventListener("click", () => {
        // Pre-poblar fechas con la fecha actual
        const hoy = new Date();
        const dentro30 = new Date();
        dentro30.setDate(dentro30.getDate() + 30);

        const iso = d => d.toISOString().slice(0, 10);

        const fc = document.getElementById("cot-fecha-creacion");
        const fv = document.getElementById("cot-fecha-vencimiento");

        if (fc) fc.value = iso(hoy);
        if (fv) fv.value = iso(dentro30);

        Modales.abrir("modal-crear-cotizacion");
      });
    }

    const btnGuardar = document.getElementById("guardar-cotizacion");
    if (btnGuardar) {
      btnGuardar.addEventListener("click", async () => {
        const titulo = document.getElementById("cot-titulo").value.trim();
        const cantidad = parseFloat(document.getElementById("cot-cantidad").value) || 0;
        const moneda = document.getElementById("cot-moneda").value;
        const estado = document.getElementById("cot-estado").value;
        const propietario = document.getElementById("cot-propietario").value;
        const fechaCreacion = document.getElementById("cot-fecha-creacion").value;
        const fechaVencimiento = document.getElementById("cot-fecha-vencimiento").value;
        const cliente = document.getElementById("cot-cliente").value.trim();

        if (!titulo) {
          window.mostrarToast("⚠ El título es obligatorio");
          return;
        }
        if (cantidad <= 0 && estado !== "borrador") {
          window.mostrarToast("⚠ Agrega al menos un producto/línea antes de guardar");
          return;
        }

        const nueva = {
          titulo,
          estado: estado || "borrador",
          cantidad,
          moneda,
          estadoFirma: "no_aplica",
          fechaCreacion,
          fechaVencimiento,
          responsable: propietario || "Néstor Goyes",
          cliente: cliente || "—"
        };

        if (window.Api) {
          try {
            btnGuardar.disabled = true;
            const resp = await window.Api.cotizaciones.crear(nueva);
            nueva.id = resp.id;
          } catch (e) {
            console.warn("[UI] API crear cotización falló, usando ID local:", e.message);
          } finally {
            btnGuardar.disabled = false;
          }
        }
        if (!nueva.id) {
          nueva.id = window.estadoApp.datosOriginales.length
            ? Math.max(...window.estadoApp.datosOriginales.map(c => c.id)) + 1
            : 1;
        }

        window.estadoApp.datosOriginales.unshift(nueva);

        // Reset form
        document.getElementById("form-cotizacion").reset();
        document.getElementById("cot-cantidad").value = "0";

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
    const modal          = document.getElementById("modal-editar-columnas");
    const colDisp        = document.getElementById("cols-disponibles");
    const colSel         = document.getElementById("cols-seleccionadas");
    if (!modal || !colDisp || !colSel) return;

    // Mapa local de respaldo (no depende de que table.js haya corrido antes)
    const MAPA_TEXTO = {
      titulo: "Título", estado: "Estado", cantidad: "Cantidad",
      firma: "Estado de la firma", propietario: "Propietario",
      creacion: "Fecha de creación", vencimiento: "Fecha de vencimiento",
      negocio: "Nombre del negocio"
    };
    const texto = k => (window.COLUMNA_A_TEXTO || MAPA_TEXTO)[k] || k;

    /* ---- Contador ---- */
    function contar() {
      const el = document.getElementById("contador-cols");
      if (el) el.textContent = colSel.querySelectorAll(".editar-columnas__seleccionada").length;
    }

    /* ---- Fábrica de items del panel derecho ---- */
    function crearItem(clave, fija) {
      const div = document.createElement("div");
      div.dataset.col = clave;
      if (fija) {
        div.className = "editar-columnas__seleccionada editar-columnas__seleccionada--fija";
        div.textContent = texto(clave);
      } else {
        div.className = "editar-columnas__seleccionada";
        div.draggable = true;
        div.innerHTML =
          `<span class="editar-columnas__drag">⋮⋮</span>` +
          texto(clave) +
          `<button type="button" class="editar-columnas__remover" aria-label="Quitar">×</button>`;
      }
      return div;
    }

    /* ---- Sincronizar modal → refleja el estado actual de la tabla ---- */
    function sincronizar() {
      const cols = window.estadoApp?.columnasActivas
        || window.COLUMNAS_DEFECTO
        || Object.keys(MAPA_TEXTO);

      // Panel derecho: reconstruir en el orden de columnasActivas
      colSel.innerHTML = "";
      cols.forEach(k => colSel.appendChild(crearItem(k, k === "titulo")));
      contar();

      // Checkboxes del panel izquierdo
      colDisp.querySelectorAll("[data-col]").forEach(lbl => {
        const cb = lbl.querySelector("input[type=checkbox]");
        if (cb) cb.checked = cols.includes(lbl.dataset.col);
      });
    }

    /* ---- Drag & Drop en panel derecho ---- */
    let dragged = null;

    colSel.addEventListener("dragstart", e => {
      const row = e.target.closest(
        ".editar-columnas__seleccionada:not(.editar-columnas__seleccionada--fija)"
      );
      if (!row) { e.preventDefault(); return; }
      dragged = row;
      // rAF evita que el navegador capture el estado "dragging" en el ghost
      requestAnimationFrame(() => row.classList.add("dragging"));
      e.dataTransfer.effectAllowed = "move";
    });

    colSel.addEventListener("dragend", () => {
      dragged?.classList.remove("dragging");
      dragged = null;
    });

    colSel.addEventListener("dragover", e => {
      e.preventDefault();
      if (!dragged) return;
      const over = e.target.closest(".editar-columnas__seleccionada");
      // No permitir soltar sobre o antes de la columna fija
      if (!over || over === dragged || over.classList.contains("editar-columnas__seleccionada--fija")) return;
      const { top, height } = over.getBoundingClientRect();
      colSel.insertBefore(dragged, e.clientY < top + height / 2 ? over : over.nextSibling);
    });

    /* ---- Checkbox panel izquierdo ↔ panel derecho ---- */
    colDisp.addEventListener("change", e => {
      const cb = e.target.closest("input[type=checkbox]");
      if (!cb) return;
      const lbl   = cb.closest("[data-col]");
      const clave = lbl?.dataset.col;
      if (!clave) return;

      if (cb.checked) {
        if (!colSel.querySelector(`[data-col="${clave}"]`)) {
          colSel.appendChild(crearItem(clave, false));
          contar();
        }
      } else {
        colSel.querySelector(`[data-col="${clave}"]`)?.remove();
        contar();
      }
    });

    /* ---- Botón × en panel derecho ---- */
    colSel.addEventListener("click", e => {
      const btn = e.target.closest(".editar-columnas__remover");
      if (!btn) return;
      const row   = btn.closest(".editar-columnas__seleccionada");
      const clave = row?.dataset.col;
      row?.remove();
      contar();
      // Desmarcar checkbox correspondiente
      const cb = colDisp.querySelector(`[data-col="${clave}"] input[type=checkbox]`);
      if (cb) cb.checked = false;
    });

    /* ---- Aplicar: actualiza columnasActivas y re-renderiza tabla ---- */
    document.getElementById("btn-aplicar-columnas")?.addEventListener("click", () => {
      const cols = [...colSel.querySelectorAll("[data-col]")]
        .map(d => d.dataset.col)
        .filter(Boolean);

      if (!cols.length) {
        window.mostrarToast?.("⚠ Agrega al menos una columna");
        return;
      }

      window.estadoApp.columnasActivas = cols;

      // filtrosInstance.aplicarFiltros() ya llama tablaInstance.renderizar() al final
      if (window.filtrosInstance)     window.filtrosInstance.aplicarFiltros();
      else if (window.tablaInstance)  window.tablaInstance.renderizar();

      Modales.cerrar(modal);
      window.mostrarToast?.(`✓ ${cols.length} columnas aplicadas`);
    });

    /* ---- "Eliminar todas" ---- */
    modal.querySelector(".modal__footer a.btn--link")?.addEventListener("click", e => {
      e.preventDefault();
      colSel.querySelectorAll(
        ".editar-columnas__seleccionada:not(.editar-columnas__seleccionada--fija)"
      ).forEach(d => d.remove());
      colDisp.querySelectorAll("input[type=checkbox]").forEach(cb => cb.checked = false);
      contar();
    });

    /* ---- Búsqueda en panel izquierdo ---- */
    document.getElementById("input-buscar-columnas")?.addEventListener("input", e => {
      const q = e.target.value.toLowerCase();
      colDisp.querySelectorAll(".editar-columnas__opt").forEach(opt => {
        opt.style.display = opt.textContent.toLowerCase().includes(q) ? "" : "none";
      });
    });

    /* ---- Botón que abre el modal ---- */
    document.getElementById("btn-editar-columnas")?.addEventListener("click", () => {
      sincronizar();
      Modales.abrir("modal-editar-columnas");
    });

    // Inicializar el panel derecho al cargar la página
    sincronizar();
  }

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

    if (select) {
      select.addEventListener("change", (e) => {
        if (window.tablaInstance) {
          window.estadoApp.ordenColumna = e.target.value;
          window.tablaInstance.aplicarOrden();
        }
      });
    }

    dirBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        dirBtns.forEach(b => b.classList.remove("activo"));
        btn.classList.add("activo");
        window.estadoApp.ordenDireccion = btn.dataset.dir;
        if (window.tablaInstance) window.tablaInstance.aplicarOrden();
      });
    });

    // Sincronizar UI al abrir el popover
    new MutationObserver(() => {
      if (!popover.hasAttribute("hidden")) sincronizarUI();
    }).observe(popover, { attributes: true, attributeFilter: ["hidden"] });
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

    // MONEDA (pill opcional)
    const popMoneda = document.getElementById("popover-filtro-moneda");
    if (popMoneda) {
      popMoneda.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener("change", () => {
          const valores = [...popMoneda.querySelectorAll('input[type="checkbox"]:checked')]
            .map(c => c.dataset.filtroVal);
          window.estadoApp.filtros.moneda = valores;
          if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
        });
      });
    }
  }

  /* ----------------------------------------------------------
     12. AGREGAR FILTRO RÁPIDO (botón +)
     ---------------------------------------------------------- */
  const _PILLS_META_COT = {
    estado:      { icono: "𝑓𝑥", nombre: "Estado" },
    actividad:   { icono: "📅", nombre: "Última actividad" },
    propietario: { icono: "☑",  nombre: "Propietario" },
    firma:       { icono: "𝑓𝑥", nombre: "Estado de la firma" },
    moneda:      { icono: "$",  nombre: "Moneda" },
  };

  function _pillEsVisible(filtroId) {
    const p = document.querySelector(`.filtro-pill[data-filtro="${filtroId}"]`);
    return p ? p.style.display !== "none" : false;
  }

  function _mostrarPill(filtroId, visible) {
    const p = document.querySelector(`.filtro-pill[data-filtro="${filtroId}"]`);
    if (p) p.style.display = visible ? "" : "none";
  }

  function _limpiarValorFiltro(filtroId) {
    const est = window.estadoApp;
    if (filtroId === "estado")      est.filtros.estado = [];
    if (filtroId === "actividad")   est.filtros.actividad = null;
    if (filtroId === "propietario") est.filtros.propietario = [];
    if (filtroId === "firma")       est.filtros.firma = [];
    if (filtroId === "moneda")      est.filtros.moneda = [];
  }

  function initFiltroAdd() {
    const pop = document.getElementById("popover-filtro-add");
    if (!pop) return;

    const buscarInput = pop.querySelector("#filtro-add-buscar");
    const lista = pop.querySelector("#filtro-add-lista");

    // Clic en un ítem: mostrar la pill y cerrar
    pop.addEventListener("click", (e) => {
      const item = e.target.closest(".popover__item[data-pill-id]");
      if (!item) return;
      const pillId = item.dataset.pillId;
      _mostrarPill(pillId, true);
      if (buscarInput) buscarInput.value = "";
      Popovers.cerrar();
      _poblarModalEditarFiltros();
    });

    // Búsqueda en tiempo real
    if (buscarInput && lista) {
      buscarInput.addEventListener("input", () => {
        const q = buscarInput.value.trim().toLowerCase();
        lista.querySelectorAll(".popover__item[data-pill-id]").forEach(item => {
          const texto = item.textContent.trim().toLowerCase();
          item.style.display = q === "" || texto.includes(q) ? "" : "none";
        });
      });
    }

    // Sincronizar estado visual al abrir: ocultar ítems de pills ya visibles
    new MutationObserver(() => {
      if (!pop.hasAttribute("hidden")) {
        if (buscarInput) buscarInput.value = "";
        lista && lista.querySelectorAll(".popover__item[data-pill-id]").forEach(item => {
          item.style.display = "";
          const visible = _pillEsVisible(item.dataset.pillId);
          item.classList.toggle("popover__item--seleccionado", visible);
        });
      }
    }).observe(pop, { attributes: true, attributeFilter: ["hidden"] });
  }

  /* ----------------------------------------------------------
     12b. EDITAR FILTROS RÁPIDOS (lápiz)
     ---------------------------------------------------------- */
  function initEditarFiltros() {
    const btn = document.getElementById("btn-edit-filtros");
    if (!btn) return;

    btn.addEventListener("click", () => {
      _poblarModalEditarFiltros();
      Modales.abrir("modal-editar-filtros");
    });

    const modal = document.getElementById("modal-editar-filtros");
    if (!modal) return;

    modal.addEventListener("click", (e) => {
      // Quitar pill de la barra (papelera)
      const remover = e.target.closest("[data-quitar-pill]");
      if (remover) {
        e.stopPropagation();
        const filtroId = remover.dataset.quitarPill;
        _mostrarPill(filtroId, false);
        _limpiarValorFiltro(filtroId);
        if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
        _poblarModalEditarFiltros();
        return;
      }

      // Limpiar solo los valores (no ocultar pills)
      const limpiarVal = e.target.closest("[data-limpiar-valores]");
      if (limpiarVal) {
        if (window.filtrosInstance) window.filtrosInstance.limpiarFiltros();
        _poblarModalEditarFiltros();
        return;
      }

      // Agregar filtro rápido → abrir popover +
      const agregar = e.target.closest("#btn-agregar-filtro-rapido");
      if (agregar) {
        Modales.cerrar(modal);
        const btnAdd = document.getElementById("btn-add-filtro");
        if (btnAdd) Popovers.abrir("popover-filtro-add", btnAdd);
      }
    });
  }

  function _poblarModalEditarFiltros() {
    const modal = document.getElementById("modal-editar-filtros");
    if (!modal) return;
    const lista = modal.querySelector("#lista-filtros-edit");
    const contador = modal.querySelector("#contador-filtros");
    if (!lista) return;

    // Pills visibles = filas del modal
    const pillsVisibles = Object.entries(_PILLS_META_COT)
      .filter(([id]) => _pillEsVisible(id));

    if (contador) contador.textContent = pillsVisibles.length;

    const ICONO_TRASH = `<svg viewBox="0 0 24 24" width="14" height="14">
      <path fill="currentColor" d="M7 21q-.825 0-1.413-.588T5 19V6H4V4h5V3h6v1h5v2h-1v13q0 .825-.587 1.413T17 21H7Zm0-15v13h10V6H7Zm2 11h2V8H9v9Zm4 0h2V8h-2v9Z"/>
    </svg>`;

    if (pillsVisibles.length === 0) {
      lista.innerHTML = `<p style="color:var(--color-texto-suave);font-size:var(--font-tam-sm);padding:var(--esp-3) 0">
        No hay filtros en la barra. Usa el botón + para agregar.
      </p>`;
    } else {
      lista.innerHTML = pillsVisibles.map(([id, meta]) => `
        <div class="popover-fila-editor__item">
          <div class="popover-fila-editor__icono">${meta.icono}</div>
          <select class="popover-fila-editor__select" disabled>
            <option>${meta.nombre}</option>
          </select>
          <button class="popover-fila-editor__remover" data-quitar-pill="${id}" aria-label="Quitar filtro">
            ${ICONO_TRASH}
          </button>
        </div>`).join("");
    }

    // Habilitar/deshabilitar "Limpiar valores"
    const btnLimpiar = modal.querySelector("[data-limpiar-valores]");
    if (btnLimpiar) {
      const hayValores = Object.entries(_PILLS_META_COT).some(([id]) => {
        const est = window.estadoApp;
        if (!est) return false;
        const v = est.filtros[id];
        return Array.isArray(v) ? v.length > 0 : !!v;
      });
      btnLimpiar.disabled = !hayValores;
    }
  }

  /* ----------------------------------------------------------
     12c. FILTROS AVANZADOS
     ---------------------------------------------------------- */
  function initFiltrosAvanzados() {
    document.querySelectorAll(".filtro-avanzados").forEach(btn => {
      btn.addEventListener("click", () => {
        _sincronizarFiltrosAvanzados();
        Modales.abrir("modal-filtros-avanzados");
      });
    });

    const modal = document.getElementById("modal-filtros-avanzados");
    if (!modal) return;

    // Aplicar desde el modal
    const btnAplicar = modal.querySelector("[data-avanzados-aplicar]");
    if (btnAplicar) {
      btnAplicar.addEventListener("click", () => {
        _leerFiltrosAvanzados();
        if (window.filtrosInstance) window.filtrosInstance.aplicarFiltros();
        Modales.cerrar(modal);
      });
    }

    // Limpiar todo desde el modal
    const btnLimpiar = modal.querySelector("[data-avanzados-limpiar]");
    if (btnLimpiar) {
      btnLimpiar.addEventListener("click", () => {
        modal.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; });
        modal.querySelectorAll('input[type="date"]').forEach(inp => { inp.value = ""; });
        if (window.filtrosInstance) window.filtrosInstance.limpiarFiltros();
        Modales.cerrar(modal);
      });
    }
  }

  function _sincronizarFiltrosAvanzados() {
    const modal = document.getElementById("modal-filtros-avanzados");
    if (!modal) return;
    const est = window.estadoApp;

    // Poblar propietarios dinámicamente si aún no están
    const listaP = modal.querySelector("#avanzados-propietarios");
    if (listaP && !listaP.hasChildNodes()) {
      const propietarios = [...new Set(est.datosOriginales.map(c => c.responsable))].filter(Boolean).sort();
      listaP.innerHTML = propietarios.map(n => `
        <label class="check-lista__item">
          <input type="checkbox" data-avanzado-grupo="propietario" data-avanzado-val="${n}"/>
          ${n}
        </label>`).join("");
    }

    modal.querySelectorAll('input[type="checkbox"][data-avanzado-grupo][data-avanzado-val]').forEach(cb => {
      const grupo = cb.dataset.avanzadoGrupo;
      const val   = cb.dataset.avanzadoVal;
      const filtro = est.filtros[grupo];
      cb.checked = Array.isArray(filtro) ? filtro.includes(val) : false;
    });
  }

  function _leerFiltrosAvanzados() {
    const modal = document.getElementById("modal-filtros-avanzados");
    if (!modal) return;
    const est = window.estadoApp;
    ["estado", "propietario", "firma", "moneda"].forEach(grupo => {
      const cbs = modal.querySelectorAll(`input[type="checkbox"][data-avanzado-grupo="${grupo}"]:checked`);
      est.filtros[grupo] = [...cbs].map(cb => cb.dataset.avanzadoVal);
    });
    // Fecha (actividad)
    const desde = modal.querySelector('[data-avanzado-fecha="desde"]');
    const hasta = modal.querySelector('[data-avanzado-fecha="hasta"]');
    if (desde || hasta) {
      const d = desde ? desde.value : "";
      const h = hasta ? hasta.value : "";
      est.filtros.actividad = (d || h) ? { desde: d || null, hasta: h || null } : null;
    }
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
     14. TOGGLE FILTROS RÁPIDOS (mostrar/ocultar la fila)
     ---------------------------------------------------------- */
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

  /* ----------------------------------------------------------
     15. VISTA DE TABLA (selector de tipo de vista)
     ---------------------------------------------------------- */
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

  /* ----------------------------------------------------------
     16. DUPLICAR VISTA ACTIVA (botón del toolbar)
     ---------------------------------------------------------- */
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

  /* ----------------------------------------------------------
     17. MODAL AGREGAR VISTA: búsqueda + categoría
         (Funcionalidad integrada en initModalAgregarVista)
     ---------------------------------------------------------- */
  function initModalVistasExtras() {}
  document.addEventListener("DOMContentLoaded", () => {
    Popovers.init();
    Modales.init();
    PanelLateral.init();
    PanelDetalleCotizacion.init();
    VistaPreviaCotizacion.init();
    EditarCotizacion.init();
    EnviarCotizacion.init();

    initSelectorObjetos();
    initTabMenu();
    initTabAdd();
    initModalAgregarVista();
    initCabeceraMenu();
    initCrearCotizacion();
    initEditarColumnas();
    initOrdenar();
    initFiltrosPill();
    initFiltroAdd();
    initEditarFiltros();
    initFiltrosAvanzados();
    initConfigTabla();
    initTamanoPagina();

    initToggleFiltros();
    initVistaTabla();
    initDuplicarVista();
    initModalVistasExtras();
    initClickFilas();

    // Exponer para debug
    window.Popovers = Popovers;
    window.Modales = Modales;
    window.PanelLateral = PanelLateral;
    window.PanelDetalleCotizacion = PanelDetalleCotizacion;
    window.VistaPreviaCotizacion = VistaPreviaCotizacion;

    console.log("[UI] Interactions inicializadas correctamente");
  });
})();
