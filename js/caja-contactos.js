/* ============================================================
   CAJA-CONTACTOS.JS
   Autocomplete de contactos HubSpot para los campos "Cliente"
   en los modales de registrar gasto/ingreso y editar movimiento.

   Instancias:
     #g-cliente       → #caja-gasto-contacto-sugerencias
     #editar-cliente  → #caja-editar-contacto-sugerencias

   Al seleccionar: rellena el input con el nombre del contacto.
   ============================================================ */
(function () {

  const DEBOUNCE_MS = 300;

  const MOCKS = [
    { nombre: "Néstor Goyes",   empresa: "Oblicua Digital",  email: "nestor@oblicua.co",      tipo: "contacto" },
    { nombre: "María González", empresa: "Tech Solutions",   email: "maria@techsolutions.co",  tipo: "contacto" },
    { nombre: "Carlos Ramírez", empresa: "Startup Labs",     email: "carlos@startuplabs.co",   tipo: "contacto" },
    { nombre: "Oblicua Digital",empresa: "Oblicua Digital",  email: "",                        tipo: "empresa"  },
    { nombre: "Tech Solutions", empresa: "Tech Solutions",   email: "",                        tipo: "empresa"  },
  ];

  function escHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function mocksFiltrados(q) {
    const lq = q.toLowerCase();
    const r = MOCKS.filter(c =>
      c.nombre.toLowerCase().includes(lq) ||
      c.empresa.toLowerCase().includes(lq) ||
      c.email.toLowerCase().includes(lq)
    );
    return r.length > 0 ? r : MOCKS;
  }

  // -----------------------------------------------------------------
  // FÁBRICA: conecta un <input> con su <ul> dropdown
  // -----------------------------------------------------------------
  function crearAutocomplete({ inputEl, listaEl, modalEl }) {
    if (!inputEl || !listaEl) return;

    let timer = null;

    function mostrar(resultados) {
      if (!resultados.length) { ocultar(); return; }

      listaEl.innerHTML = resultados.map((c, i) => {
        const esEmpresa = c.tipo === "empresa";
        const badge = `<span class="contacto-sug__tipo contacto-sug__tipo--${esEmpresa ? "empresa" : "contacto"}">${esEmpresa ? "Empresa" : "Contacto"}</span>`;
        const sub = esEmpresa
          ? ""
          : (c.empresa ? `<span class="contacto-sug__empresa">${escHtml(c.empresa)}</span>` : "") +
            (c.email   ? `<span class="contacto-sug__email">${escHtml(c.email)}</span>`    : "");
        return `<li class="contacto-sugerencias__item" role="option" tabindex="-1" data-idx="${i}">
          <span class="contacto-sug__nombre">${escHtml(c.nombre)}</span>${badge}${sub}
        </li>`;
      }).join("");

      listaEl._resultados = resultados;
      listaEl.hidden = false;
      inputEl.setAttribute("aria-expanded", "true");
    }

    function ocultar() {
      listaEl.hidden = true;
      inputEl.setAttribute("aria-expanded", "false");
    }

    function seleccionar(contacto) {
      inputEl.value = contacto.nombre || contacto.empresa || "";
      ocultar();
    }

    async function buscar(termino) {
      if (termino.length < 2) { ocultar(); return; }

      if (!window.HubSpotAPI) {
        mostrar(mocksFiltrados(termino));
        return;
      }

      try {
        const [contactos, empresas] = await Promise.all([
          window.HubSpotAPI.obtenerContactos(termino),
          window.HubSpotAPI.buscarEmpresas(termino).catch(() => []),
        ]);
        const resultados = [
          ...(Array.isArray(contactos) ? contactos : []),
          ...(Array.isArray(empresas)  ? empresas  : []),
        ];
        mostrar(resultados.length ? resultados : mocksFiltrados(termino));
      } catch (_) {
        mostrar(mocksFiltrados(termino));
      }
    }

    // Escritura con debounce
    inputEl.addEventListener("input", () => {
      clearTimeout(timer);
      const q = inputEl.value.trim();
      if (q.length < 2) { ocultar(); return; }
      timer = setTimeout(() => buscar(q), DEBOUNCE_MS);
    });

    // Click en ítem
    listaEl.addEventListener("click", (e) => {
      const item = e.target.closest("[data-idx]");
      if (!item || !listaEl._resultados) return;
      seleccionar(listaEl._resultados[parseInt(item.dataset.idx, 10)]);
    });

    // Teclado en el input
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { ocultar(); return; }
      if (e.key === "ArrowDown" && !listaEl.hidden) {
        e.preventDefault();
        listaEl.querySelector("[data-idx]")?.focus();
      }
    });

    // Navegación por flechas dentro de la lista
    listaEl.addEventListener("keydown", (e) => {
      const items = [...listaEl.querySelectorAll("[data-idx]")];
      const idx   = items.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); items[idx + 1]?.focus(); }
      else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (idx <= 0) { inputEl.focus(); return; }
        items[idx - 1]?.focus();
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (idx >= 0 && listaEl._resultados) seleccionar(listaEl._resultados[idx]);
      } else if (e.key === "Escape") {
        ocultar(); inputEl.focus();
      }
    });

    // Click fuera → cerrar
    document.addEventListener("click", (e) => {
      if (!e.target.closest(`#${listaEl.id}`) && e.target !== inputEl) ocultar();
    });

    // Limpiar al cerrar el modal
    if (modalEl) {
      new MutationObserver(() => {
        if (modalEl.hasAttribute("hidden")) { ocultar(); inputEl.value = ""; }
      }).observe(modalEl, { attributes: true, attributeFilter: ["hidden"] });
    }
  }

  // -----------------------------------------------------------------
  // INIT
  // -----------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    crearAutocomplete({
      inputEl: document.getElementById("g-cliente"),
      listaEl: document.getElementById("caja-gasto-contacto-sugerencias"),
      modalEl: document.getElementById("modal-registrar-gasto"),
    });

    crearAutocomplete({
      inputEl: document.getElementById("editar-cliente"),
      listaEl: document.getElementById("caja-editar-contacto-sugerencias"),
      modalEl: document.getElementById("modal-editar-movimiento"),
    });
  });

})();
