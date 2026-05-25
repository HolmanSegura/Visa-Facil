/* ============================================================
   COTIZACIONES-CONTACTOS.JS
   Autocomplete de contactos HubSpot en el campo "Empresa o
   cliente" del modal de cotización.

   Al seleccionar un contacto:
   - Rellena #cot-cliente con el nombre del contacto.
   - Guarda el ID de HubSpot en #cot-contacto-id (hidden).
   - Inyecta el email en #cot-email-destinatario si tiene.

   DOM esperado (index.html):
     #contacto-autocomplete-wrap  → contenedor relativo
     #cot-cliente                 → input de texto
     #contacto-sugerencias        → <ul> dropdown flotante
     #cot-contacto-id             → <input hidden> para el ID
     #cot-email-destinatario      → input del destinatario (email)
   ============================================================ */
(function () {

  const DEBOUNCE_MS = 300;

  let contactoSeleccionado = null;
  let timerBusqueda        = null;

  // Contactos de prueba usados cuando la API no responde (CORS, sin token, etc.)
  const CONTACTOS_MOCK = [
    { id: "mock-1", nombre: "Néstor Goyes",   empresa: "Oblicua Digital", email: "nestor@oblicua.co",       telefono: "", cargo: "CEO" },
    { id: "mock-2", nombre: "María González", empresa: "Tech Solutions",  email: "maria@techsolutions.co",  telefono: "", cargo: "Gerente" },
    { id: "mock-3", nombre: "Carlos Ramírez", empresa: "Startup Labs",    email: "carlos@startuplabs.co",   telefono: "", cargo: "Fundador" }
  ];

  function mocksFiltrados(termino) {
    const q = termino.toLowerCase();
    const coinciden = CONTACTOS_MOCK.filter(c =>
      c.nombre.toLowerCase().includes(q)  ||
      c.empresa.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    );
    return coinciden.length > 0 ? coinciden : CONTACTOS_MOCK;
  }

  function escHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // -----------------------------------------------------------------
  // RENDER DEL DROPDOWN
  // -----------------------------------------------------------------

  function mostrarSugerencias(lista, resultados) {
    const input = document.getElementById("cot-cliente");

    if (!resultados.length) {
      ocultarSugerencias(lista, input);
      return;
    }

    lista.innerHTML = resultados.map((c, i) => `
      <li class="contacto-sugerencias__item"
          role="option"
          tabindex="-1"
          data-contacto-idx="${i}">
        <span class="contacto-sug__nombre">${escHtml(c.nombre || c.email)}</span>
        ${c.empresa ? `<span class="contacto-sug__empresa">${escHtml(c.empresa)}</span>` : ""}
        ${c.email   ? `<span class="contacto-sug__email">${escHtml(c.email)}</span>`     : ""}
      </li>
    `).join("");

    lista._resultados    = resultados;
    lista.hidden         = false;
    input?.setAttribute("aria-expanded", "true");
  }

  function ocultarSugerencias(lista, input) {
    if (!lista) lista = document.getElementById("contacto-sugerencias");
    if (!input) input = document.getElementById("cot-cliente");
    if (lista) lista.hidden = true;
    if (input) input.setAttribute("aria-expanded", "false");
  }

  // -----------------------------------------------------------------
  // SELECCIÓN DE UN CONTACTO
  // -----------------------------------------------------------------

  function seleccionarContacto(contacto) {
    contactoSeleccionado = contacto;

    const inputNombre = document.getElementById("cot-cliente");
    const inputId     = document.getElementById("cot-contacto-id");
    const inputEmail  = document.getElementById("cot-email-destinatario");

    if (inputNombre) inputNombre.value = contacto.nombre || contacto.empresa || "";
    if (inputId)     inputId.value     = contacto.id     || "";
    if (inputEmail && contacto.email)  inputEmail.value  = contacto.email;

    ocultarSugerencias();
  }

  // -----------------------------------------------------------------
  // BÚSQUEDA CON DEBOUNCE
  // -----------------------------------------------------------------

  async function buscarYRenderizar(termino) {
    const lista = document.getElementById("contacto-sugerencias");
    if (!lista) return;

    if (termino.length < 2) {
      ocultarSugerencias(lista);
      return;
    }

    // Sin API disponible → mostrar mocks directamente
    if (!window.HubSpotAPI) {
      console.warn("[Contactos] HubSpotAPI no disponible — usando contactos de prueba.");
      mostrarSugerencias(lista, mocksFiltrados(termino));
      return;
    }

    try {
      const resultados = await window.HubSpotAPI.obtenerContactos(termino);

      if (!Array.isArray(resultados)) {
        throw new Error("obtenerContactos devolvió un valor inesperado: " + JSON.stringify(resultados));
      }

      console.log(`[Contactos] ${resultados.length} resultado(s) para "${termino}":`, resultados);
      mostrarSugerencias(lista, resultados);
    } catch (e) {
      // CORS, red caída, 401, etc. → siempre mostrar mocks para no romper el flujo
      console.error("[Contactos] Error de API (fallback a mocks de prueba):", e);
      mostrarSugerencias(lista, mocksFiltrados(termino));
    }
  }

  // -----------------------------------------------------------------
  // INIT DE EVENTOS
  // -----------------------------------------------------------------

  function init() {
    const input = document.getElementById("cot-cliente");
    const lista = document.getElementById("contacto-sugerencias");
    if (!input || !lista) return;

    // Escritura → debounce → búsqueda
    input.addEventListener("input", () => {
      clearTimeout(timerBusqueda);
      contactoSeleccionado = null;
      const q = input.value.trim();
      if (q.length < 2) { ocultarSugerencias(lista, input); return; }
      timerBusqueda = setTimeout(() => buscarYRenderizar(q), DEBOUNCE_MS);
    });

    // Click en ítem
    lista.addEventListener("click", (e) => {
      const item = e.target.closest("[data-contacto-idx]");
      if (!item || !lista._resultados) return;
      seleccionarContacto(lista._resultados[parseInt(item.dataset.contactoIdx, 10)]);
    });

    // Teclado en el input
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        ocultarSugerencias(lista, input);
        return;
      }
      if (e.key === "ArrowDown" && !lista.hidden) {
        e.preventDefault();
        lista.querySelector("[data-contacto-idx='0']")?.focus();
      }
    });

    // Navegación con flechas dentro de la lista
    lista.addEventListener("keydown", (e) => {
      const items = [...lista.querySelectorAll("[data-contacto-idx]")];
      const idx   = items.indexOf(document.activeElement);

      if (e.key === "ArrowDown") {
        e.preventDefault();
        items[idx + 1]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (idx <= 0) { input.focus(); return; }
        items[idx - 1]?.focus();
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (idx >= 0 && lista._resultados) seleccionarContacto(lista._resultados[idx]);
      } else if (e.key === "Escape") {
        ocultarSugerencias(lista, input);
        input.focus();
      }
    });

    // Click fuera del widget → cerrar
    document.addEventListener("click", (e) => {
      if (!e.target.closest("#contacto-autocomplete-wrap")) {
        ocultarSugerencias(lista, input);
      }
    });

    // Limpiar estado al cerrar el modal
    const modal = document.getElementById("modal-crear-cotizacion");
    if (modal) {
      new MutationObserver(() => {
        if (modal.hasAttribute("hidden")) {
          contactoSeleccionado = null;
          const idEl = document.getElementById("cot-contacto-id");
          if (idEl) idEl.value = "";
          ocultarSugerencias(lista, input);
        }
      }).observe(modal, { attributes: true, attributeFilter: ["hidden"] });
    }
  }

  // -----------------------------------------------------------------
  // INIT
  // -----------------------------------------------------------------

  document.addEventListener("DOMContentLoaded", () => {
    init();

    window.ContactosAutocomplete = {
      getContactoSeleccionado: () => contactoSeleccionado,
      limpiar() {
        contactoSeleccionado = null;
        const el = document.getElementById("cot-contacto-id");
        if (el) el.value = "";
        ocultarSugerencias();
      }
    };
  });

})();
