/* ============================================================
   HUBSPOT-API.JS — Dev mode (llamadas directas + extensión CORS)
   HubSpot CRM API v3  ·  Licencia Starter

   Nota de licencia: sin objeto Quotes nativo → las cotizaciones
   se persisten como Invoices asociadas a Contacts y Products.

   Uso:
     window.HubSpotAPI.configurar({ token: "pat-..." })
     const productos = await window.HubSpotAPI.obtenerProductos()
   ============================================================ */
(function () {
  const API_BASE = "https://api.hubapi.com";

  const cfg = {
    token: "", // Reemplaza con tu token de acceso personal (PAT) de HubSpot
    portalId: "50772182",
  };

  function configurar(opciones = {}) {
    Object.assign(cfg, opciones);
    console.info(
      "[HubSpot API] Config actualizada — token:",
      cfg.token ? "***" + cfg.token.slice(-4) : "(vacío)",
    );
  }

  function headers() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.token}`,
    };
  }

  const CORS_PROXY = "https://corsproxy.io/?";

  async function req(method, path, body) {
    const target = `${API_BASE}${path}`;
    const url = `${CORS_PROXY}${encodeURIComponent(target)}`;

    const res = await fetch(url, {
      method,
      headers: headers(),
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });

    if (!res.ok) {
      let detalle = "";
      try {
        detalle = await res.text();
      } catch (_) {}
      throw new Error(
        `HTTP ${res.status} ${method} ${path}: ${detalle.slice(0, 200)}`,
      );
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
      nombre:
        `${p.firstname || ""} ${p.lastname || ""}`.trim() || p.email || "",
      email: p.email || "",
      empresa: p.company || "",
      telefono: p.phone || "",
      cargo: p.jobtitle || "",
    };
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

      // Facturas / Cotizaciones
      guardarCotizacionComoFactura,
      actualizarFactura,

      // Alias de compatibilidad con cotizaciones-productos.js
      crearFacturaDesdeCotizacion: (cot, contactoId, _lineas) =>
        guardarCotizacionComoFactura({ ...cot, contactoId }),

      _cfg: cfg,
    };

    console.info(
      "[HubSpot API] Listo. Para probar: await window.HubSpotAPI.probarConexion()",
    );
  });
})();
