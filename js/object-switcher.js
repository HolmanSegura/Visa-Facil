/* ============================================================
   OBJECT-SWITCHER.JS
   Dropdown para cambiar entre Cotizaciones (index.html)
   y Caja (caja.html).
   ============================================================ */

(function () {
  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("btn-selector-objeto");
    const lista = document.getElementById("selector-objeto-lista");
    const label = document.getElementById("selector-objeto-label");

    if (!btn || !lista || !label) return;

    function toggleLista(forceOpen) {
      const isOpen =
        typeof forceOpen === "boolean"
          ? forceOpen
          : !lista.classList.contains("selector-objeto__lista--abierto");

      lista.classList.toggle("selector-objeto__lista--abierto", isOpen);
      btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }

    // Abrir/cerrar al hacer click en el botón
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleLista();
    });

    // Click en opción -> navegar a la URL correspondiente
    lista.addEventListener("click", (e) => {
      const opcion = e.target.closest(".selector-objeto__opcion");
      if (!opcion) return;
      const url = opcion.dataset.url;
      const nombre = opcion.dataset.objeto;
      if (nombre) {
        label.textContent = nombre;
      }
      toggleLista(false);
      if (url) {
        window.location.href = url;
      }
    });

    // Cerrar al hacer click fuera
    document.addEventListener("click", (e) => {
      if (!lista.classList.contains("selector-objeto__lista--abierto")) return;
      const dentro = e.target.closest(".selector-objeto--dropdown");
      if (!dentro) {
        toggleLista(false);
      }
    });

    // ESC para cerrar
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        toggleLista(false);
      }
    });
  });
})();