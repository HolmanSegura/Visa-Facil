/* ============================================================
   COTIZACIONES-DEALS.JS
   Autocomplete de Deals/Negocios de HubSpot en el formulario
   de cotización.

   Al seleccionar un deal:
   - Rellena #cot-negocio con el nombre del deal.
   - Guarda el ID de HubSpot en #cot-deal-id (hidden).
   - Busca contactos/empresas asociados al deal en HubSpot y
     autocompleta #cot-cliente si está vacío.
   - Muestra un hint debajo del campo de negocio con el estado
     de la vinculación al cliente.

   DOM esperado (index.html):
     #negocio-autocomplete-wrap  → contenedor con position:relative
     #cot-negocio                → input de texto
     #negocio-sugerencias        → <ul> dropdown
     #cot-deal-id                → <input hidden> para el ID del deal
     #deal-cliente-hint          → <p> para mostrar feedback de asociación

   Fallback: si HubSpotAPI falla (CORS, token, etc.), muestra
   DEALS_MOCK para no bloquear el flujo.

   Expone: window.DealsAutocomplete
   ============================================================ */
(function () {

  const DEBOUNCE_MS = 300;

  let dealSeleccionado = null;
  let timerBusqueda    = null;

  // Datos de fallback cuando la API no responde
  const DEALS_MOCK = [
    { id: "mock-d1", nombre: "Sitio web Acme Corp",      etapa: "Presentación", monto: 4500000  },
    { id: "mock-d2", nombre: "CRM HubSpot JMF",          etapa: "Propuesta",    monto: 8200000  },
    { id: "mock-d3", nombre: "Shopify Work for Treats",   etapa: "Cierre",       monto: 35000000 },
    { id: "mock-d4", nombre: "Mantenimiento VTEX Latam",  etapa: "Ejecución",    monto: 1200000  },
    { id: "mock-d5", nombre: "Auditoría UX Virtud SAS",   etapa: "Propuesta",    monto: 4200000  },
  ];

  function mocksFiltrados(termino) {
    const q   = termino.toLowerCase();
    const hits = DEALS_MOCK.filter(d =>
      d.nombre.toLowerCase().includes(q) || d.etapa.toLowerCase().includes(q)
    );
    return hits.length > 0 ? hits : DEALS_MOCK;
  }

  function escHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function formatearMoneda(v) {
    return "COP " + new Intl.NumberFormat("es-CO").format(v);
  }

  // -----------------------------------------------------------------
  // RENDER DEL DROPDOWN
  // -----------------------------------------------------------------

  function mostrarSugerencias(lista, resultados, termino) {
    const input = document.getElementById("cot-negocio");

    if (!resultados || resultados.length === 0) {
      if (termino) {
        lista.innerHTML = `<li class="contacto-sugerencias__vacio">
          Sin resultados para <strong>${escHtml(termino)}</strong>.
          <span class="contacto-sug__hint">Si lo creaste en HubSpot hace menos de 2 min, espera y vuelve a buscar.</span>
        </li>`;
        lista.hidden = false;
        input?.setAttribute("aria-expanded", "true");
      } else {
        ocultarSugerencias(lista, input);
      }
      return;
    }

    lista.innerHTML = resultados.map((d, i) => `
      <li class="contacto-sugerencias__item"
          role="option"
          tabindex="-1"
          data-deal-idx="${i}">
        <span class="contacto-sug__nombre">${escHtml(d.nombre)}</span>
        <span class="contacto-sug__empresa">
          ${d.etapa ? escHtml(d.etapa) + " · " : ""}${d.monto > 0 ? formatearMoneda(d.monto) : "Sin monto"}
        </span>
      </li>
    `).join("");

    lista._resultados = resultados;
    lista.hidden      = false;
    input?.setAttribute("aria-expanded", "true");
  }

  function ocultarSugerencias(lista, input) {
    if (!lista) lista = document.getElementById("negocio-sugerencias");
    if (!input) input = document.getElementById("cot-negocio");
    if (lista) lista.hidden = true;
    if (input) input.setAttribute("aria-expanded", "false");
  }

  // -----------------------------------------------------------------
  // HINT DE CLIENTE VINCULADO
  // -----------------------------------------------------------------

  function setHint(texto, tipo) {
    const el = document.getElementById("deal-cliente-hint");
    if (!el) return;
    if (!texto) { el.hidden = true; el.textContent = ""; return; }
    el.className = "form-hint deal-hint" + (tipo ? " deal-hint--" + tipo : "");
    el.innerHTML = texto;
    el.hidden = false;
  }

  // -----------------------------------------------------------------
  // SELECCIÓN DE UN DEAL + CARGA DE ASOCIACIONES
  // -----------------------------------------------------------------

  function seleccionarDeal(deal) {
    dealSeleccionado = deal;

    const inputNombre = document.getElementById("cot-negocio");
    const inputId     = document.getElementById("cot-deal-id");

    if (inputNombre) inputNombre.value = deal.nombre || "";
    if (inputId)     inputId.value     = deal.id      || "";

    ocultarSugerencias();

    console.info(`[DealsAutocomplete] Deal seleccionado: "${deal.nombre}" (ID: ${deal.id})`);

    // Intentar vincular el cliente automáticamente (solo con API real)
    const esMock = String(deal.id).startsWith("mock-");
    if (!esMock && window.HubSpotAPI) {
      cargarAsociacionesDeal(deal);
    }
  }

  async function cargarAsociacionesDeal(deal) {
    setHint("Buscando contacto del negocio…", "cargando");

    try {
      const { contactIds, companyIds } = await window.HubSpotAPI.obtenerAsociacionesDeal(deal.id);

      // 1. Intentar contactos primero
      if (contactIds.length > 0) {
        const contacto = await window.HubSpotAPI.obtenerContactoPorId(contactIds[0]);
        if (contacto) {
          poblarCliente(contacto.nombre || contacto.email, contacto.id, contacto.email);
          const nombre = escHtml(contacto.nombre || contacto.email);
          setHint(
            `Contacto vinculado desde el negocio: <strong>${nombre}</strong>
             <button type="button" class="deal-hint__limpiar" id="deal-desvincular-cliente">Cambiar</button>`,
            "ok"
          );
          document.getElementById("deal-desvincular-cliente")?.addEventListener("click", () => {
            limpiarClienteVinculado();
            setHint("Cliente desvinculado. Puedes escribir otro.", "info");
          });
          return;
        }
      }

      // 2. Fallback a empresa
      if (companyIds.length > 0) {
        const empresa = await window.HubSpotAPI.obtenerEmpresaPorId(companyIds[0]);
        if (empresa) {
          poblarCliente(empresa.nombre, empresa.id, "");
          const nombre = escHtml(empresa.nombre);
          setHint(
            `Empresa vinculada desde el negocio: <strong>${nombre}</strong>
             <button type="button" class="deal-hint__limpiar" id="deal-desvincular-cliente">Cambiar</button>`,
            "ok"
          );
          document.getElementById("deal-desvincular-cliente")?.addEventListener("click", () => {
            limpiarClienteVinculado();
            setHint("Cliente desvinculado. Puedes escribir otro.", "info");
          });
          return;
        }
      }

      // 3. Sin asociaciones
      setHint(
        "Este negocio no tiene contactos asociados en HubSpot. " +
        "Puedes escribir el cliente manualmente en el campo de arriba.",
        "aviso"
      );
    } catch (e) {
      console.warn("[Deals] No se pudieron cargar asociaciones:", e.message);
      setHint("", null);
    }
  }

  function poblarCliente(nombre, id, email) {
    const inputNombre = document.getElementById("cot-cliente");
    const inputId     = document.getElementById("cot-contacto-id");
    const inputEmail  = document.getElementById("cot-email-destinatario");

    // Solo autocompleta si el campo está vacío (no pisamos lo que el usuario escribió)
    if (inputNombre && !inputNombre.value.trim()) inputNombre.value = nombre || "";
    if (inputId     && !inputId.value)            inputId.value     = id     || "";
    if (inputEmail  && email && !inputEmail.value) inputEmail.value = email;
  }

  function limpiarClienteVinculado() {
    const inputNombre = document.getElementById("cot-cliente");
    const inputId     = document.getElementById("cot-contacto-id");
    if (inputNombre) inputNombre.value = "";
    if (inputId)     inputId.value     = "";
    inputNombre?.focus();
  }

  // -----------------------------------------------------------------
  // BÚSQUEDA CON DEBOUNCE
  // -----------------------------------------------------------------

  async function buscarYRenderizar(termino) {
    const lista = document.getElementById("negocio-sugerencias");
    if (!lista) return;

    if (termino.length < 2) {
      ocultarSugerencias(lista);
      return;
    }

    if (!window.HubSpotAPI) {
      console.warn("[Deals] HubSpotAPI no disponible — mostrando mocks.");
      mostrarSugerencias(lista, mocksFiltrados(termino), termino);
      return;
    }

    try {
      const resultados = await window.HubSpotAPI.buscarDeals(termino);

      if (!Array.isArray(resultados)) {
        throw new Error("buscarDeals devolvió valor inesperado: " + JSON.stringify(resultados));
      }

      console.log(`[Deals] ${resultados.length} resultado(s) para "${termino}":`, resultados);
      mostrarSugerencias(lista, resultados.length > 0 ? resultados : [], termino);

    } catch (e) {
      console.error("[Deals] Error de API (fallback a mocks):", e);
      mostrarSugerencias(lista, mocksFiltrados(termino), termino);
    }
  }

  // -----------------------------------------------------------------
  // INIT DE EVENTOS
  // -----------------------------------------------------------------

  function init() {
    const input = document.getElementById("cot-negocio");
    const lista = document.getElementById("negocio-sugerencias");
    if (!input || !lista) return;

    // Escritura → debounce → búsqueda
    input.addEventListener("input", () => {
      clearTimeout(timerBusqueda);
      dealSeleccionado = null;
      // Limpiar el deal ID si el usuario escribe manualmente
      const idEl = document.getElementById("cot-deal-id");
      if (idEl) idEl.value = "";
      setHint("", null);

      const q = input.value.trim();
      if (q.length < 2) { ocultarSugerencias(lista, input); return; }
      timerBusqueda = setTimeout(() => buscarYRenderizar(q), DEBOUNCE_MS);
    });

    // Click en ítem
    lista.addEventListener("click", (e) => {
      const item = e.target.closest("[data-deal-idx]");
      if (!item || !lista._resultados) return;
      seleccionarDeal(lista._resultados[parseInt(item.dataset.dealIdx, 10)]);
    });

    // Teclado en el input
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        ocultarSugerencias(lista, input);
        return;
      }
      if (e.key === "ArrowDown" && !lista.hidden) {
        e.preventDefault();
        lista.querySelector("[data-deal-idx='0']")?.focus();
      }
    });

    // Navegación con flechas dentro de la lista
    lista.addEventListener("keydown", (e) => {
      const items = [...lista.querySelectorAll("[data-deal-idx]")];
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
        if (idx >= 0 && lista._resultados) seleccionarDeal(lista._resultados[idx]);
      } else if (e.key === "Escape") {
        ocultarSugerencias(lista, input);
        input.focus();
      }
    });

    // Click fuera del widget → cerrar
    document.addEventListener("click", (e) => {
      if (!e.target.closest("#negocio-autocomplete-wrap")) {
        ocultarSugerencias(lista, input);
      }
    });

    // Limpiar estado al cerrar el modal de cotización
    const modal = document.getElementById("modal-crear-cotizacion");
    if (modal) {
      new MutationObserver(() => {
        if (modal.hasAttribute("hidden")) {
          dealSeleccionado = null;
          const idEl = document.getElementById("cot-deal-id");
          if (idEl) idEl.value = "";
          setHint("", null);
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

    window.DealsAutocomplete = {
      getDealSeleccionado: () => dealSeleccionado,
      limpiar() {
        dealSeleccionado = null;
        const inputNombre = document.getElementById("cot-negocio");
        const inputId     = document.getElementById("cot-deal-id");
        if (inputNombre) inputNombre.value = "";
        if (inputId)     inputId.value     = "";
        setHint("", null);
        ocultarSugerencias();
      },
    };
  });
})();
