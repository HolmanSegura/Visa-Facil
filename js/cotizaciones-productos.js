/* ============================================================
   COTIZACIONES-PRODUCTOS.JS
   Integra el catálogo de Productos de HubSpot con el formulario
   de cotización.

   Flujo:
   1. Al abrir el modal de cotización, carga productos desde
      HubSpot API (o caché localStorage de 15 min).
   2. Provee un buscador para filtrar el catálogo.
   3. Al hacer clic en un producto lo agrega como línea de
      artículo en la tabla de la cotización.
   4. Cambios inline en la tabla (precio, cantidad, descuento)
      actualizan el estado y disparan el recálculo de totales
      a través de DescuentosEngine.

   Expone: window.ProductosCotizacion
   ============================================================ */
(function () {

  const CACHE_KEY = "hubspot:productos:v1";
  const CACHE_TTL = 15 * 60 * 1000; // 15 minutos

  // Estado del módulo
  let catalogo     = [];
  let lineas       = [];   // Líneas de artículo de la cotización activa
  let cargando     = false;

  // -----------------------------------------------------------------
  // CACHÉ LIGERA EN LOCALSTORAGE
  // -----------------------------------------------------------------

  function leerCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL) return null;
      return Array.isArray(data) && data.length > 0 ? data : null;
    } catch {
      return null;
    }
  }

  function escribirCache(productos) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: productos }));
    } catch { /* storage lleno — no es crítico */ }
  }

  // -----------------------------------------------------------------
  // DATOS DE EJEMPLO (fallback cuando la API no está configurada)
  // -----------------------------------------------------------------

  function datosEjemplo() {
    return [
      { id: "ej-1", nombre: "Sitio web corporativo",          descripcion: "Diseño y desarrollo responsive",          precio: 4500000,  sku: "WEB-001" },
      { id: "ej-2", nombre: "Tienda Shopify",                  descripcion: "E-commerce con integración de pagos",      precio: 8200000,  sku: "SHOP-001" },
      { id: "ej-3", nombre: "SEO técnico mensual",             descripcion: "Optimización en motores de búsqueda",      precio: 1200000,  sku: "SEO-001" },
      { id: "ej-4", nombre: "Soporte y mantenimiento mensual", descripcion: "Mantenimiento + soporte 20 h/mes",         precio: 980000,   sku: "SUP-001" },
      { id: "ej-5", nombre: "Consultoría HubSpot",             descripcion: "Configuración y onboarding CRM",          precio: 2800000,  sku: "CRM-001" },
      { id: "ej-6", nombre: "Integración API personalizada",   descripcion: "Desarrollo de integraciones a medida",     precio: 3600000,  sku: "API-001" },
      { id: "ej-7", nombre: "App móvil MVP (iOS y Android)",   descripcion: "Desarrollo multiplataforma React Native",  precio: 35000000, sku: "APP-001" },
      { id: "ej-8", nombre: "Migración Google Cloud",          descripcion: "Migración, configuración e IaC en GCP",   precio: 12000000, sku: "GCP-001" },
      { id: "ej-9", nombre: "Capacitación HubSpot (4 h)",      descripcion: "Sesión de formación para el equipo",      precio: 800000,   sku: "CAP-001" },
      { id: "ej-10",nombre: "Auditoría UX/UI",                 descripcion: "Evaluación heurística + mapa de mejoras", precio: 4200000,  sku: "UX-001" }
    ];
  }

  // -----------------------------------------------------------------
  // CARGA DE PRODUCTOS
  // -----------------------------------------------------------------

  async function cargarProductos({ forzar = false } = {}) {
    if (cargando) {
      // Llamada concurrente mientras la carga ya está en curso.
      // Muestra el indicador y espera a que el finally renderice.
      const lista = document.getElementById("productos-lista");
      if (lista && catalogo.length === 0) {
        lista.innerHTML = '<li class="productos-lista__vacio">Cargando catálogo…</li>';
      }
      return catalogo;
    }

    if (!forzar) {
      const cached = leerCache();
      if (cached) {
        catalogo = cached;
        renderizarResultadosBusqueda(); // asegurar que el catálogo se pinta
        return catalogo;
      }
    }

    cargando = true;
    actualizarUIBotonesCarga(true);

    try {
      const resultado = await window.HubSpotAPI.obtenerTodosLosProductos();
      catalogo = Array.isArray(resultado) && resultado.length > 0 ? resultado : datosEjemplo();
      if (Array.isArray(resultado) && resultado.length > 0) {
        escribirCache(catalogo);
        console.log(`[Productos] ${catalogo.length} producto(s) cargados desde HubSpot.`);
      } else {
        console.warn("[Productos] HubSpot devolvió 0 productos. Usando datos de ejemplo.");
      }
    } catch (e) {
      console.error("[Productos] Fallo al cargar catálogo (¿CORS habilitado?):", e);
      window.mostrarToast?.("⚠ No se pudo cargar el catálogo — usando datos de ejemplo");
      catalogo = datosEjemplo(); // garantizar fallback siempre
    } finally {
      cargando = false;
      actualizarUIBotonesCarga(false);
      renderizarResultadosBusqueda(); // pintar catálogo (éxito o fallback)
    }

    return catalogo;
  }

  function actualizarUIBotonesCarga(estado) {
    const btn = document.getElementById("btn-recargar-productos");
    if (!btn) return;
    btn.disabled    = estado;
    btn.textContent = estado ? "Cargando catálogo..." : "Actualizar catálogo";
  }

  // -----------------------------------------------------------------
  // GESTIÓN DE LÍNEAS DE ARTÍCULO
  // -----------------------------------------------------------------

  function agregarLinea(producto, cantidad = 1) {
    const existente = lineas.find(l => l.productoId === producto.id);
    if (existente) {
      existente.cantidad += cantidad;
    } else {
      lineas.push({
        _id:            `linea-${Date.now()}`,
        productoId:     producto.id,
        nombre:         producto.nombre,
        descripcion:    producto.descripcion || "",
        precioUnitario: producto.precio,
        cantidad:       cantidad,
        descuento:      0,
        tipoDescuento:  "porcentaje"
      });
    }
    renderizarLineas();
    window.DescuentosEngine?.recalcular(lineas);
  }

  function quitarLinea(lineaId) {
    lineas = lineas.filter(l => l._id !== lineaId);
    renderizarLineas();
    window.DescuentosEngine?.recalcular(lineas);
  }

  function actualizarCampoLinea(lineaId, campo, valor) {
    const linea = lineas.find(l => l._id === lineaId);
    if (!linea) return;
    linea[campo] = valor;
    // El recálculo visual lo lanza DescuentosEngine desde su listener de input/change
  }

  function limpiarLineas() {
    lineas = [];
    renderizarLineas();
    window.DescuentosEngine?.recalcular(lineas);
  }

  // -----------------------------------------------------------------
  // RENDER DE LÍNEAS EN EL DOM
  // -----------------------------------------------------------------

  function renderizarLineas() {
    const tbody = document.getElementById("cotizacion-lineas-tbody");
    if (!tbody) return;

    if (lineas.length === 0) {
      tbody.innerHTML = `
        <tr id="lineas-vacio">
          <td colspan="6" class="tabla-lineas__vacio">
            Busca un producto en el catálogo y haz clic para agregarlo.
            También puedes añadir una línea personalizada.
          </td>
        </tr>`;
      return;
    }

    const fmt = v => window.formatearMoneda ? window.formatearMoneda(v, "COP") : new Intl.NumberFormat("es-CO").format(v);

    tbody.innerHTML = lineas.map(l => {
      const subtotal = calcularSubtotalLinea(l);
      return `
        <tr data-linea-id="${l._id}">
          <td class="linea-td--nombre">
            <div class="linea-nombre">
              <span class="linea-nombre__texto">${escHtml(l.nombre)}</span>
              ${l.descripcion ? `<span class="linea-nombre__desc">${escHtml(l.descripcion)}</span>` : ""}
            </div>
          </td>
          <td class="linea-td--num">
            <input type="number" class="form-input form-input--sm"
              value="${l.precioUnitario}" min="0" step="100"
              data-linea-campo="precioUnitario" data-linea-id="${l._id}"
              aria-label="Precio unitario" />
          </td>
          <td class="linea-td--num">
            <input type="number" class="form-input form-input--sm"
              value="${l.cantidad}" min="1" step="1"
              data-linea-campo="cantidad" data-linea-id="${l._id}"
              aria-label="Cantidad" />
          </td>
          <td class="linea-td--desc">
            <div class="linea-desc-wrap">
              <input type="number" class="form-input form-input--sm"
                value="${l.descuento}" min="0"
                data-linea-campo="descuento" data-linea-id="${l._id}"
                aria-label="Descuento" />
              <select class="form-select form-select--sm"
                data-linea-campo="tipoDescuento" data-linea-id="${l._id}"
                aria-label="Tipo de descuento">
                <option value="porcentaje" ${l.tipoDescuento === "porcentaje" ? "selected" : ""}>%</option>
                <option value="fijo"       ${l.tipoDescuento === "fijo"       ? "selected" : ""}>$</option>
              </select>
            </div>
          </td>
          <td class="linea-td--num" data-linea-subtotal="${l._id}">
            ${fmt(subtotal)}
          </td>
          <td class="linea-td--accion">
            <button class="btn-icono-mini" data-quitar-linea="${l._id}" title="Quitar línea">
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path fill="currentColor" d="M6 7h12l-1 13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 7Zm3-3h6l1 2h4v2H5V6h4l1-2Z"/>
              </svg>
            </button>
          </td>
        </tr>`;
    }).join("");
  }

  function calcularSubtotalLinea(l) {
    const bruto = (l.precioUnitario || 0) * (l.cantidad || 1);
    if (!l.descuento || l.descuento <= 0) return bruto;
    if (l.tipoDescuento === "porcentaje") return bruto * (1 - Math.min(l.descuento, 100) / 100);
    return Math.max(0, bruto - l.descuento);
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // -----------------------------------------------------------------
  // BUSCADOR DE PRODUCTOS (lado derecho del picker)
  // -----------------------------------------------------------------

  function renderizarResultadosBusqueda(termino = "") {
    const lista = document.getElementById("productos-lista");
    if (!lista) return;

    const normalizar = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const q = normalizar(termino.trim());

    const filtrados = q.length < 1
      ? catalogo.slice(0, 25)
      : catalogo.filter(p =>
          normalizar(p.nombre).includes(q) ||
          normalizar(p.sku || "").includes(q) ||
          normalizar(p.descripcion || "").includes(q)
        );

    if (filtrados.length === 0) {
      lista.innerHTML = `<li class="productos-lista__vacio">Sin resultados para "${escHtml(termino)}"</li>`;
      return;
    }

    const fmt = v => window.formatearMoneda ? window.formatearMoneda(v, "COP") : new Intl.NumberFormat("es-CO").format(v);

    lista.innerHTML = filtrados.map(p => `
      <li class="productos-lista__item" data-agregar-producto="${p.id}" role="option" tabindex="0">
        <div class="prod-item__info">
          <span class="prod-item__nombre">${escHtml(p.nombre)}</span>
          ${p.sku ? `<span class="prod-item__sku">${escHtml(p.sku)}</span>` : ""}
        </div>
        <span class="prod-item__precio">${fmt(p.precio)}</span>
      </li>`
    ).join("");
  }

  // -----------------------------------------------------------------
  // INICIALIZACIÓN DE EVENTOS
  // -----------------------------------------------------------------

  function initEventos() {

    // Buscador de productos (con debounce)
    const inputBuscar = document.getElementById("input-buscar-producto");
    if (inputBuscar) {
      let timerBuscar;
      inputBuscar.addEventListener("input", () => {
        clearTimeout(timerBuscar);
        timerBuscar = setTimeout(() => renderizarResultadosBusqueda(inputBuscar.value), 180);
      });
    }

    // Click / Enter en ítem del catálogo → agregar línea
    const listaProductos = document.getElementById("productos-lista");
    if (listaProductos) {
      listaProductos.addEventListener("click", manejarSeleccionProducto);
      listaProductos.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") manejarSeleccionProducto(e);
      });
    }

    // Cambios en inputs/selects de las líneas (delega al contenedor)
    document.addEventListener("change", (e) => {
      const el = e.target;
      const { lineaCampo, lineaId } = el.dataset;
      if (!lineaCampo || !lineaId) return;

      const valor = el.tagName === "SELECT"
        ? el.value
        : parseFloat(el.value) || 0;

      actualizarCampoLinea(lineaId, lineaCampo, valor);
      // DescuentosEngine escucha este mismo evento para recalcular
    });

    // Quitar línea
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-quitar-linea]");
      if (btn) quitarLinea(btn.dataset.quitarLinea);
    });

    // Agregar línea personalizada
    document.getElementById("btn-agregar-linea-custom")
      ?.addEventListener("click", () => {
        agregarLinea({
          id:          `custom-${Date.now()}`,
          nombre:      "Servicio personalizado",
          descripcion: "",
          precio:      0,
          sku:         ""
        });
        // Poner foco en el input de nombre de la última fila
        requestAnimationFrame(() => {
          const inputs = document.querySelectorAll("[data-linea-campo='precioUnitario']");
          inputs[inputs.length - 1]?.focus();
        });
      });

    // Recargar catálogo manualmente
    document.getElementById("btn-recargar-productos")
      ?.addEventListener("click", async () => {
        await cargarProductos({ forzar: true });
        const inputB = document.getElementById("input-buscar-producto");
        renderizarResultadosBusqueda(inputB?.value || "");
        window.mostrarToast?.(`✓ ${catalogo.length} productos cargados`);
      });

    // Al abrir el modal de cotización, cargar productos y renderizar buscador
    const observer = new MutationObserver(() => {
      const modal = document.getElementById("modal-crear-cotizacion");
      if (modal && !modal.hasAttribute("hidden")) {
        cargarProductos().then(() => renderizarResultadosBusqueda());
      }
    });
    const modal = document.getElementById("modal-crear-cotizacion");
    if (modal) observer.observe(modal, { attributes: true, attributeFilter: ["hidden"] });
  }

  function manejarSeleccionProducto(e) {
    const item = e.target.closest("[data-agregar-producto]");
    if (!item) return;
    const prod = catalogo.find(p => p.id === item.dataset.agregarProducto);
    if (prod) {
      agregarLinea(prod);
      window.mostrarToast?.(`+ ${prod.nombre} agregado`);
    }
  }

  // -----------------------------------------------------------------
  // INIT
  // -----------------------------------------------------------------

  document.addEventListener("DOMContentLoaded", () => {
    initEventos();
    // Carga inicial silenciosa (usa caché si disponible)
    cargarProductos();

    window.ProductosCotizacion = {
      cargarProductos,
      agregarLinea,
      quitarLinea,
      actualizarCampoLinea,
      limpiarLineas,
      getLineas:             () => lineas,
      getCatalogo:           () => catalogo,
      calcularSubtotalLinea,
      renderizarLineas,
      renderizarResultadosBusqueda
    };
  });

})();
