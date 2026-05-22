/* ============================================================
   VIEWS.JS
   Gestión de tabs/vistas. Cada vista filtra el dataset y
   muestra su conteo dinámicamente.
   ============================================================ */

(function () {

  class GestorVistas {
    constructor() {
      this.contenedor = document.getElementById("tabs-vistas");
      this.editandoId = null;
      this.nombreOriginalEdicion = "";
      if (!this.contenedor) return;
      this.renderizar();
      this.escucharEventos();
    }

    contarPorVista(vista) {
      return window.estadoApp.datosOriginales.filter(vista.filtro).length;
    }

    obtenerVista(id) {
      return window.estadoApp.vistas.find(v => v.id === id) || null;
    }

    esVistaFija(vista) {
      return !!vista?.fija;
    }

    slugSeguro(texto = "") {
      return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 40) || "vista";
    }

    generarIdClon(vista) {
      return `${vista.id || this.slugSeguro(vista.nombre)}_copia_${Date.now()}`;
    }

    construirTab(vista) {
      const tab = document.createElement("div");
      const fija = this.esVistaFija(vista);

      tab.className = "tab" + (vista.activa ? " tab--activo" : "");
      tab.setAttribute("role", "tab");
      tab.setAttribute("data-vista-id", vista.id);
      tab.setAttribute("aria-selected", vista.activa ? "true" : "false");
      tab.setAttribute("tabindex", "0");

      if (fija) tab.dataset.vistaFija = "true";

      const count = this.contarPorVista(vista);
      const puedeCerrar = !fija;

      tab.innerHTML = `
      <span class="tab__titulo" data-tab-titulo>${vista.nombre}</span>
      <span class="tab__badge">${count}</span>
      <button
        class="tab__menu"
        type="button"
        data-popover="popover-tab-menu"
        data-vista-target="${vista.id}"
        aria-label="Opciones de la vista">
        <svg viewBox="0 0 32 32" width="12" height="12" aria-hidden="true">
          <circle cx="16" cy="6" r="3" fill="currentColor"></circle>
          <circle cx="16" cy="16" r="3" fill="currentColor"></circle>
          <circle cx="16" cy="26" r="3" fill="currentColor"></circle>
        </svg>
      </button>
      ${puedeCerrar ? `
        <button
          class="tab__cerrar"
          type="button"
          aria-label="Cerrar vista"
          data-cerrar-vista="${vista.id}">
          <svg viewBox="0 0 32 32" width="10" height="10" aria-hidden="true">
            <path fill="currentColor" d="m3 5 2-2 11 11 11-11 2 2-11 11 11 11-2 2-11-11-11 11-2-2 11-11L3 5Z"></path>
          </svg>
        </button>
      ` : ""}
    `;

      return tab;
    }

    renderizar() {
      this.contenedor.innerHTML = "";
      window.estadoApp.vistas.forEach(vista => {
        this.contenedor.appendChild(this.construirTab(vista));
      });

      if (this.actualizarFlechas) {
        requestAnimationFrame(() => this.actualizarFlechas());
      }
    }

    activarVista(id) {
      const est = window.estadoApp;
      est.vistas.forEach(v => v.activa = (v.id === id));
      est.vistaActivaId = id;

      const vista = est.vistas.find(v => v.id === id);
      const fp = (vista && vista.filtrosPill) || {};

      if (est.filtros && (
        "tipo" in est.filtros ||
        "categoria" in est.filtros ||
        "fecha" in est.filtros ||
        "asesor" in est.filtros
      )) {
        est.filtros = {
          tipo: Array.isArray(fp.tipo) ? [...fp.tipo] : [],
          categoria: Array.isArray(fp.categoria) ? [...fp.categoria] : [],
          fecha: fp.fecha != null ? fp.fecha : null,
          asesor: Array.isArray(fp.asesor) ? [...fp.asesor] : [],
          estado: Array.isArray(fp.estado) ? [...fp.estado] : []
        };
      } else {
        est.filtros = {
          estado: Array.isArray(fp.estado) ? [...fp.estado] : [],
          actividad: fp.actividad != null ? fp.actividad : null,
          propietario: Array.isArray(fp.propietario) ? [...fp.propietario] : [],
          firma: Array.isArray(fp.firma) ? [...fp.firma] : []
        };
      }

      if (window.filtrosInstance?.sincronizarPopoversUI) {
        window.filtrosInstance.sincronizarPopoversUI();
      }

      if (window.filtrosInstance) {
        window.filtrosInstance.aplicarFiltros();
      } else if (vista) {
        est.datosVisibles = est.datosOriginales.filter(vista.filtro);
        est.paginaActual = 1;
        if (window.tablaInstance) window.tablaInstance.renderizar();
      }

      this.renderizar();
    }

    agregarVista(id, nombre, filtro, extras = {}) {
      if (window.estadoApp.vistas.find(v => v.id === id)) {
        window.mostrarToast?.("Esa vista ya existe");
        return null;
      }

      const nuevaVista = {
        id,
        nombre,
        filtro,
        activa: false,
        fija: !!extras.fija,
        filtrosPill: extras.filtrosPill ? { ...extras.filtrosPill } : {}
      };

      window.estadoApp.vistas.push(nuevaVista);
      this.renderizar();
      return nuevaVista;
    }

    renombrarVista(id, nuevoNombre) {
      const vista = this.obtenerVista(id);
      if (!vista || this.esVistaFija(vista)) return false;

      const limpio = (nuevoNombre || "").trim().replace(/\s+/g, " ");
      if (!limpio) return false;
      if (limpio === vista.nombre) return true;

      vista.nombre = limpio;
      this.renderizar();
      window.mostrarToast?.("✓ Vista renombrada");
      return true;
    }

    clonarVista(id) {
      const vista = this.obtenerVista(id);
      if (!vista) return null;

      const nueva = this.agregarVista(
        this.generarIdClon(vista),
        `${vista.nombre} (copia)`,
        vista.filtro,
        {
          filtrosPill: vista.filtrosPill ? { ...vista.filtrosPill } : {},
          fija: false
        }
      );

      if (!nueva) return null;

      this.activarVista(nueva.id);
      window.mostrarToast?.("✓ Vista clonada");
      return nueva;
    }

    cerrarVista(id) {
      const vista = this.obtenerVista(id);
      if (!vista || this.esVistaFija(vista)) return;

      const idx = window.estadoApp.vistas.findIndex(v => v.id === id);
      if (idx === -1) return;

      const eraActiva = window.estadoApp.vistas[idx].activa;
      window.estadoApp.vistas.splice(idx, 1);

      if (eraActiva) {
        const fallback = window.estadoApp.vistas.find(v => v.fija) || window.estadoApp.vistas[0];
        if (fallback) this.activarVista(fallback.id);
      } else {
        this.renderizar();
      }

      window.mostrarToast?.("✓ Vista eliminada");
    }

    iniciarEdicionInline(id) {
      const vista = this.obtenerVista(id);
      if (!vista || this.esVistaFija(vista)) return;

      this.editandoId = id;
      this.nombreOriginalEdicion = vista.nombre;

      const tab = this.contenedor.querySelector(`.tab[data-vista-id="${id}"]`);
      const titulo = tab?.querySelector("[data-tab-titulo]");
      if (!titulo) return;

      titulo.setAttribute("contenteditable", "true");
      titulo.setAttribute("spellcheck", "false");
      titulo.classList.add("tab__titulo--editando");

      const rango = document.createRange();
      rango.selectNodeContents(titulo);

      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(rango);

      titulo.focus();
    }

    confirmarEdicionInline(id) {
      const tab = this.contenedor.querySelector(`.tab[data-vista-id="${id}"]`);
      const titulo = tab?.querySelector("[data-tab-titulo]");
      if (!titulo) return;

      const nuevo = titulo.textContent.trim();
      const ok = this.renombrarVista(id, nuevo);

      if (!ok) {
        this.cancelarEdicionInline(id);
        return;
      }

      this.editandoId = null;
      this.nombreOriginalEdicion = "";
    }

    cancelarEdicionInline(id) {
      const vista = this.obtenerVista(id);
      if (!vista) return;

      const tab = this.contenedor.querySelector(`.tab[data-vista-id="${id}"]`);
      const titulo = tab?.querySelector("[data-tab-titulo]");
      if (titulo) {
        titulo.textContent = this.nombreOriginalEdicion || vista.nombre;
        titulo.removeAttribute("contenteditable");
        titulo.removeAttribute("spellcheck");
        titulo.classList.remove("tab__titulo--editando");
        titulo.blur();
      }

      this.editandoId = null;
      this.nombreOriginalEdicion = "";
    }

    finalizarEdicionDOM(id) {
      const tab = this.contenedor.querySelector(`.tab[data-vista-id="${id}"]`);
      const titulo = tab?.querySelector("[data-tab-titulo]");
      if (!titulo) return;

      titulo.removeAttribute("contenteditable");
      titulo.removeAttribute("spellcheck");
      titulo.classList.remove("tab__titulo--editando");
    }

    escucharEventos() {
      this.contenedor.addEventListener("click", (e) => {
        const cerrar = e.target.closest("[data-cerrar-vista]");
        if (cerrar) {
          e.stopPropagation();
          this.cerrarVista(cerrar.dataset.cerrarVista);
          return;
        }

        const menu = e.target.closest(".tab__menu");
        if (menu) return;

        const titulo = e.target.closest("[data-tab-titulo]");
        if (titulo?.isContentEditable) {
          e.stopPropagation();
          return;
        }

        const tab = e.target.closest(".tab");
        if (tab && tab.dataset.vistaId) this.activarVista(tab.dataset.vistaId);
      });

      this.contenedor.addEventListener("keydown", (e) => {
        const titulo = e.target.closest("[data-tab-titulo]");
        if (!titulo || !titulo.isContentEditable) return;

        const id = titulo.closest(".tab")?.dataset.vistaId;
        if (!id) return;

        if (e.key === "Enter") {
          e.preventDefault();
          this.finalizarEdicionDOM(id);
          this.confirmarEdicionInline(id);
        }

        if (e.key === "Escape") {
          e.preventDefault();
          this.finalizarEdicionDOM(id);
          this.cancelarEdicionInline(id);
        }
      });

      this.contenedor.addEventListener("blur", (e) => {
        const titulo = e.target.closest("[data-tab-titulo]");
        if (!titulo || !titulo.isContentEditable) return;

        const id = titulo.closest(".tab")?.dataset.vistaId;
        if (!id) return;

        this.finalizarEdicionDOM(id);
        this.confirmarEdicionInline(id);
      }, true);

      const btnLeft = document.getElementById("btn-tab-scroll-left");
      const btnRight = document.getElementById("btn-tab-scroll-right");
      const tabs = this.contenedor;

      this.actualizarFlechas = () => {
        if (!btnLeft || !btnRight || !tabs) return;

        const scrollLeft = Math.ceil(tabs.scrollLeft);
        const maxScroll = Math.max(0, tabs.scrollWidth - tabs.clientWidth);
        const hayOverflow = maxScroll > 1;

        const estaAlInicio = scrollLeft <= 1;
        const estaAlFinal = scrollLeft >= maxScroll - 1;

        btnLeft.hidden = !hayOverflow || estaAlInicio;
        btnRight.hidden = !hayOverflow || estaAlFinal;
      };

      if (btnLeft && btnRight) {
        btnLeft.addEventListener("click", () => {
          tabs.scrollBy({ left: -180, behavior: "smooth" });
          requestAnimationFrame(this.actualizarFlechas);
        });

        btnRight.addEventListener("click", () => {
          tabs.scrollBy({ left: 180, behavior: "smooth" });
          requestAnimationFrame(this.actualizarFlechas);
        });

        tabs.addEventListener("scroll", this.actualizarFlechas);
        window.addEventListener("resize", this.actualizarFlechas);

        requestAnimationFrame(this.actualizarFlechas);
        setTimeout(this.actualizarFlechas, 60);
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    window.vistasInstance = new GestorVistas();
  });
})();