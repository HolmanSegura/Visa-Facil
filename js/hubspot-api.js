/* ============================================================
   HUBSPOT-API.JS — Modo producción (proxy backend PHP)
   HubSpot CRM API v3  ·  Licencia Starter

   Todas las llamadas pasan por /api/hubspot-proxy.php.
   El token de Private App vive SOLO en el servidor (.env).
   El navegador NUNCA recibe ni envía el token.

   Uso:
     window.HubSpotAPI.obtenerProductos()
     window.HubSpotAPI.probarConexion()
   ============================================================ */
(function () {
  const cfg = {
    portalId: "50772182",
  };

  // Base del proxy — igual a api-client.js
  const PROXY_BASE = window.location.pathname.replace(/\/[^/]*$/, '').replace(/\/$/, '') + '/api/hubspot-proxy.php';

  function configurar(opciones = {}) {
    Object.assign(cfg, opciones);
    console.info("[HubSpot API] Config actualizada (proxy backend activo)");
  }

  /**
   * Llama al proxy PHP que reenvía a HubSpot con el token del servidor.
   * @param {string} method  GET | POST | PATCH
   * @param {string} path    Ruta completa de HubSpot, incluyendo query string
   * @param {*}      body    Objeto para el body (POST/PATCH)
   */
  async function req(method, path, body) {
    const url = `${PROXY_BASE}?path=${encodeURIComponent(path)}`;

    const opts = {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
    };
    if (body !== undefined) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);

    if (!res.ok) {
      let detalle = "";
      try { detalle = await res.text(); } catch (_) {}
      throw new Error(`HTTP ${res.status} ${method} ${path}: ${detalle.slice(0, 200)}`);
    }
    return res.json();
  }

  // -----------------------------------------------------------------
  // PRODUCTOS
  // -----------------------------------------------------------------

  const PROPS_PRODUCTO =
    "name,price,description,hs_sku,hs_product_type,tax_rate";

  async function obtenerProductos({ limite = 100, cursor } = {}) {
    let ruta = `/crm/v3/objects/products?limit=${limite}&properties=${PROPS_PRODUCTO}&archived=false`;
    if (cursor) ruta += `&after=${encodeURIComponent(cursor)}`;

    const data = await req("GET", ruta);
    console.log("[HubSpot] Respuesta productos:", data);
    return {
      productos: (data.results || []).map(normalizarProducto),
      siguiente: data.paging?.next?.after || null,
    };
  }

  async function obtenerTodosLosProductos() {
    const todos = [];
    let cursor = null;
    do {
      const { productos, siguiente } = await obtenerProductos({ cursor });
      todos.push(...productos);
      cursor = siguiente;
    } while (cursor);
    return todos;
  }

  function normalizarProducto(r) {
    const p = r.properties || {};
    return {
      id: r.id,
      nombre: p.name || "",
      descripcion: p.description || "",
      precio: parseFloat(p.price) || 0,
      sku: p.hs_sku || "",
      tipo: p.hs_product_type || "",
      tasaIva: parseFloat(p.tax_rate) || null,
    };
  }

  // -----------------------------------------------------------------
  // CONTACTOS
  // -----------------------------------------------------------------

  const PROPS_CONTACTO = "firstname,lastname,email,company,phone,jobtitle";

  /**
   * Si se pasa un email/término busca con el endpoint de búsqueda.
   * Sin argumento devuelve los primeros 50 contactos.
   */
  async function obtenerContactos(busquedaEmail) {
    if (busquedaEmail && busquedaEmail.length >= 2) {
      return buscarContactos(busquedaEmail);
    }

    const data = await req(
      "GET",
      `/crm/v3/objects/contacts?limit=50&properties=${PROPS_CONTACTO}&archived=false`,
    );
    console.log("[HubSpot] Respuesta contactos:", data);
    return (data.results || []).map(normalizarContacto);
  }

  async function buscarContactos(termino) {
    const body = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "email",
              operator: "CONTAINS_TOKEN",
              value: termino,
            },
          ],
        },
        {
          filters: [
            {
              propertyName: "firstname",
              operator: "CONTAINS_TOKEN",
              value: termino,
            },
          ],
        },
      ],
      properties: PROPS_CONTACTO.split(","),
      limit: 20,
    };
    const data = await req("POST", "/crm/v3/objects/contacts/search", body);
    console.log("[HubSpot] Respuesta búsqueda contactos:", data);
    return (data.results || []).map(normalizarContacto);
  }

  async function obtenerContactoPorId(id) {
    const data = await req(
      "GET",
      `/crm/v3/objects/contacts/${id}?properties=${PROPS_CONTACTO}`,
    );
    return normalizarContacto(data);
  }

  function normalizarContacto(r) {
    const p = r.properties || {};
    return {
      id: r.id,
      tipo: "contacto",
      nombre:
        `${p.firstname || ""} ${p.lastname || ""}`.trim() || p.email || "",
      email: p.email || "",
      empresa: p.company || "",
      telefono: p.phone || "",
      cargo: p.jobtitle || "",
    };
  }

  // -----------------------------------------------------------------
  // EMPRESAS (Companies)
  // -----------------------------------------------------------------

  const PROPS_EMPRESA = "name,domain,phone,city,industry";

  async function buscarEmpresas(termino) {
    const body = {
      filterGroups: [
        { filters: [{ propertyName: "name",   operator: "CONTAINS_TOKEN", value: termino }] },
        { filters: [{ propertyName: "domain", operator: "CONTAINS_TOKEN", value: termino }] },
      ],
      properties: PROPS_EMPRESA.split(","),
      limit: 20,
    };
    const data = await req("POST", "/crm/v3/objects/companies/search", body);
    console.log("[HubSpot] Respuesta búsqueda empresas:", data);
    return (data.results || []).map(normalizarEmpresa);
  }

  function normalizarEmpresa(r) {
    const p = r.properties || {};
    return {
      id: r.id,
      tipo: "empresa",
      nombre: p.name || "",
      email: "",
      empresa: p.name || "",
      dominio: p.domain || "",
      telefono: p.phone || "",
      ciudad: p.city || "",
    };
  }

  // -----------------------------------------------------------------
  // DEALS (Negocios)
  // -----------------------------------------------------------------

  const PROPS_DEAL = "dealname,amount,pipeline,dealstage,closedate,hubspot_owner_id";

  async function buscarDeals(termino) {
    const body = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "dealname",
              operator: "CONTAINS_TOKEN",
              value: termino,
            },
          ],
        },
      ],
      properties: PROPS_DEAL.split(","),
      limit: 20,
      sorts: [{ propertyName: "closedate", direction: "DESCENDING" }],
    };
    const data = await req("POST", "/crm/v3/objects/deals/search", body);
    console.log("[HubSpot] Respuesta búsqueda deals:", data);
    return (data.results || []).map(normalizarDeal);
  }

  async function obtenerDeals({ limite = 50 } = {}) {
    const data = await req(
      "GET",
      `/crm/v3/objects/deals?limit=${limite}&properties=${PROPS_DEAL}&archived=false`,
    );
    return (data.results || []).map(normalizarDeal);
  }

  function normalizarDeal(r) {
    const p = r.properties || {};
    return {
      id:          r.id,
      nombre:      p.dealname || "",
      monto:       parseFloat(p.amount) || 0,
      etapa:       p.dealstage || "",
      pipeline:    p.pipeline || "",
      fechaCierre: p.closedate || "",
      propietarioId: p.hubspot_owner_id || "",
    };
  }

  // -----------------------------------------------------------------
  // OWNERS (propietarios / asesores de HubSpot)
  // -----------------------------------------------------------------

  async function obtenerOwners() {
    const data = await req("GET", "/crm/v3/owners?archived=false&limit=100");
    console.log("[HubSpot] Respuesta owners:", data);
    return (data.results || []).map(r => ({
      id:        r.id,
      nombre:    `${r.firstName || ""} ${r.lastName || ""}`.trim() || r.email || "",
      email:     r.email || "",
      hubspotId: r.id,
    }));
  }

  // -----------------------------------------------------------------
  // CARGA Y APLICACIÓN DE OWNERS EN EL DOM
  // -----------------------------------------------------------------

  const CACHE_OWNERS_KEY = "hubspot:owners:v1";
  const CACHE_OWNERS_TTL = 15 * 60 * 1000; // 15 min

  function _esc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function _ini(nombre) {
    return (nombre || "?").split(" ").map(w => w[0] || "").join("").toUpperCase().slice(0, 2) || "?";
  }

  async function cargarYAplicarOwners() {
    let owners = null;

    // 1. Intentar desde caché
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_OWNERS_KEY) || "null");
      if (cached && Date.now() - cached.ts < CACHE_OWNERS_TTL && Array.isArray(cached.data)) {
        owners = cached.data;
      }
    } catch (_) {}

    // 2. Si no hay caché válida, pedir a HubSpot
    if (!owners) {
      try {
        owners = await obtenerOwners();
        localStorage.setItem(CACHE_OWNERS_KEY, JSON.stringify({ ts: Date.now(), data: owners }));
      } catch (e) {
        console.warn("[HubSpot] No se pudieron cargar owners:", e.message);
        return;
      }
    }

    if (!Array.isArray(owners) || owners.length === 0) return;

    window.ownersCatalogo = owners;

    const opHtml = owners.map(o => `<option value="${_esc(o.nombre)}">${_esc(o.nombre)}</option>`).join("");

    // Select propietario en modales "Crear cotización" y "Editar cotización"
    ["cot-propietario", "editar-cot-propietario"].forEach(selId => {
      const sel = document.getElementById(selId);
      if (sel && (!sel.options.length || sel.options[0]?.text === "Cargando…" || sel.options[0]?.text === "— Seleccionar —")) {
        sel.innerHTML = `<option value="">— Seleccionar —</option>` + opHtml;
      }
    });

    // Select asesor en reporte de comisiones
    const selAsesor = document.getElementById("rep-com-asesor");
    if (selAsesor && selAsesor.options.length <= 1) {
      selAsesor.innerHTML = `<option value="">Todos</option>` + opHtml;
    }

    // Lista de propietarios en el filtro pill (popover)
    const listaProp = document.getElementById("lista-propietarios");
    if (listaProp && !listaProp.hasChildNodes()) {
      listaProp.innerHTML = owners.map(o => `
        <label class="check-lista__item">
          <input type="checkbox" data-prop="${_esc(o.nombre)}"/>
          <span class="celda-avatar__circulo" style="width:22px;height:22px;font-size:10px;">${_ini(o.nombre)}</span>
          <span>${_esc(o.nombre)}</span>
        </label>`).join("");
    }

    // Lista de propietarios en filtros avanzados
    const listaAv = document.getElementById("avanzados-propietarios");
    if (listaAv && !listaAv.hasChildNodes()) {
      listaAv.innerHTML = owners.map(o => `
        <label class="check-lista__item">
          <input type="checkbox" data-avanzado-grupo="propietario" data-avanzado-val="${_esc(o.nombre)}"/>
          ${_esc(o.nombre)}
        </label>`).join("");
    }

    // Notificar a otros módulos que los owners están listos
    document.dispatchEvent(new CustomEvent("hubspot:owners-loaded", { detail: { owners } }));
    console.info(`[HubSpot] ${owners.length} owner(s) cargados y aplicados.`);
  }

  // -----------------------------------------------------------------
  // FACTURAS (proxy de Cotizaciones)
  //
  // Mapa de estados:
  //   borrador / en_revision → draft
  //   publicado              → open
  //   aprobado               → paid
  //   vencido                → overdue
  //   rechazado              → voided
  // -----------------------------------------------------------------

  const MAPA_ESTADOS = {
    borrador: "draft",
    en_revision: "draft",
    publicado: "open",
    aprobado: "paid",
    vencido: "overdue",
    rechazado: "voided",
  };

  /**
   * Persiste una cotización del frontend como Invoice de HubSpot.
   *
   * @param {Object} payload — campos de la cotización local:
   *   { titulo, estado, fechaVencimiento, moneda, cantidad, contactoId }
   * @returns Respuesta cruda de HubSpot (incluye `id`)
   */
  async function guardarCotizacionComoFactura(payload) {
    const properties = {
      hs_invoice_label: payload.titulo || "Cotización",
      hs_invoice_status: MAPA_ESTADOS[payload.estado] || "draft",
      hs_due_date: payload.fechaVencimiento || "",
      hs_currency_code: payload.moneda || "COP",
      hs_amount_billed: String(payload.cantidad || 0),
    };

    const body = { properties };

    if (payload.contactoId) {
      body.associations = [
        {
          to: { id: payload.contactoId },
          types: [
            { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 1 },
          ],
        },
      ];
    }

    return req("POST", "/crm/v3/objects/invoices", body);
  }

  async function actualizarFactura(id, campos) {
    return req("PATCH", `/crm/v3/objects/invoices/${id}`, {
      properties: campos,
    });
  }

  // -----------------------------------------------------------------
  // PRUEBA DE CONECTIVIDAD
  // -----------------------------------------------------------------

  async function testearConexion() {
    const pruebas = [
      {
        nombre: "Productos",
        ruta: "/crm/v3/objects/products?limit=1&properties=name",
      },
      {
        nombre: "Contactos",
        ruta: "/crm/v3/objects/contacts?limit=1&properties=firstname",
      },
      {
        nombre: "Facturas",
        ruta: "/crm/v3/objects/invoices?limit=1&properties=hs_invoice_label",
      },
    ];

    const resultados = await Promise.all(
      pruebas.map(async (p) => {
        try {
          const data = await req("GET", p.ruta);
          const total = data.total ?? data.results?.length ?? "?";
          return {
            nombre: p.nombre,
            estado: "ok",
            detalle: `${total} registros`,
          };
        } catch (e) {
          return { nombre: p.nombre, estado: "error", detalle: e.message };
        }
      }),
    );

    return { ok: resultados.every((r) => r.estado === "ok"), resultados };
  }

  async function probarConexion() {
    console.group("[HubSpot API] Prueba de conectividad");
    const { ok, resultados } = await testearConexion();
    resultados.forEach((r) => {
      console.log(
        `${r.estado === "ok" ? "✅" : "❌"} ${r.nombre}: ${r.detalle}`,
      );
    });
    console.log(ok ? "✅ Todas OK" : "❌ Hay errores");
    console.groupEnd();
    return { ok, resultados };
  }

  // -----------------------------------------------------------------
  // API PÚBLICA
  // -----------------------------------------------------------------

  document.addEventListener("DOMContentLoaded", () => {
    window.HubSpotAPI = {
      configurar,
      probarConexion,
      testearConexion,

      // Productos
      obtenerProductos,
      obtenerTodosLosProductos,

      // Contactos
      obtenerContactos,
      buscarContactos,
      obtenerContactoPorId,

      // Empresas
      buscarEmpresas,

      // Deals / Negocios
      buscarDeals,
      obtenerDeals,

      // Owners / Asesores
      obtenerOwners,

      // Facturas / Cotizaciones
      guardarCotizacionComoFactura,
      actualizarFactura,

      // Alias de compatibilidad con cotizaciones-productos.js
      crearFacturaDesdeCotizacion: (cot, contactoId, _lineas) =>
        guardarCotizacionComoFactura({ ...cot, contactoId }),

      _cfg: cfg,
    };

    // Cargar owners async y poblar selects / filtros
    cargarYAplicarOwners();

    console.info(
      "[HubSpot API] Listo. Para probar: await window.HubSpotAPI.probarConexion()",
    );
  });
})();
