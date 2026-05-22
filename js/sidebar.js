/* ============================================================
   SIDEBAR.JS
   Lógica del menú lateral colapsable.
   Persiste el estado en localStorage.
   ============================================================ */

(function () {
  const CLAVE_STORAGE = "cot-sidebar-estado";

  class Sidebar {
    constructor() {
      this.elementoSidebar = document.getElementById("sidebar");
      this.botonToggle     = document.getElementById("btn-toggle-sidebar");

      if (!this.elementoSidebar || !this.botonToggle) {
        console.warn("[Sidebar] No se encontraron los elementos.");
        return;
      }

      this.restaurarEstado();
      this.botonToggle.addEventListener("click", () => this.alternar());

      // Atajo de teclado: Ctrl+B (igual que VS Code)
      document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
          e.preventDefault();
          this.alternar();
        }
      });
    }

    /** Alterna entre colapsado y expandido. */
    alternar() {
      this.elementoSidebar.classList.toggle("sidebar--colapsado");
      this.persistirEstado();
    }

    /** Guarda el estado actual en localStorage. */
    persistirEstado() {
      const colapsado = this.elementoSidebar.classList.contains("sidebar--colapsado");
      try {
        localStorage.setItem(CLAVE_STORAGE, colapsado ? "1" : "0");
      } catch (err) {
        console.warn("[Sidebar] No se pudo guardar el estado:", err);
      }
    }

    /** Recupera el estado guardado en localStorage. */
    restaurarEstado() {
      try {
        const guardado = localStorage.getItem(CLAVE_STORAGE);
        if (guardado === "0") {
          // 0 = expandido por defecto
          this.elementoSidebar.classList.remove("sidebar--colapsado");
        } else {
          // 1 o null = colapsado por defecto (coherente con la captura)
          this.elementoSidebar.classList.add("sidebar--colapsado");
        }
      } catch (err) {
        console.warn("[Sidebar] No se pudo leer el estado:", err);
      }
    }
  }

  // Inicializar al cargar el DOM
  document.addEventListener("DOMContentLoaded", () => {
    window.sidebarInstance = new Sidebar();
  });
})();
