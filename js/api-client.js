/* ============================================================
   JS/API-CLIENT.JS
   Cliente HTTP liviano para los endpoints PHP de la API local.
   Reemplaza el acceso a datos hardcodeados en main.js y caja-main.js.

   Uso:
     const cots = await window.Api.cotizaciones.listar({ estado: "aprobado" })
     const mov  = await window.Api.caja.crear({ tipo: "ingreso", ... })
   ============================================================ */
(function () {

  // Deriva la ruta base de la URL actual de la página, no del root del servidor.
  // Así funciona tanto en http://localhost/Visa-Facil/ como en http://localhost/
  const BASE = (
    document.querySelector('base')?.getAttribute('href') ||
    window.location.pathname.replace(/\/[^/]*$/, '')
  ).replace(/\/$/, '') + '/api';

  // Convierte un objeto de parámetros a query string
  function toQS(params = {}) {
    const p = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    return p.length ? "?" + p.join("&") : "";
  }

  async function request(method, path, body, params) {
    const url  = BASE + path + (params ? toQS(params) : "");
    const opts = {
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (body !== undefined) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    let data;
    try { data = await res.json(); } catch { data = {}; }

    if (!res.ok) {
      const msg = data?.error || `HTTP ${res.status}`;
      throw new Error(`[API] ${method} ${path} → ${msg}`);
    }
    return data;
  }

  // ── Cotizaciones ──────────────────────────────────────────
  const cotizaciones = {
    listar:  (filtros)  => request("GET",    "/cotizaciones.php", undefined, filtros),
    obtener: (id)       => request("GET",    `/cotizaciones.php`, undefined, { id }),
    crear:   (datos)    => request("POST",   "/cotizaciones.php", datos),
    actualizar: (id, d) => request("PATCH",  `/cotizaciones.php`, d, { id }),
    eliminar:   (id)    => request("DELETE", `/cotizaciones.php`, undefined, { id }),
  };

  // ── Caja ─────────────────────────────────────────────────
  const caja = {
    listar:     (filtros)  => request("GET",    "/caja.php", undefined, filtros),
    obtener:    (id)       => request("GET",    "/caja.php", undefined, { id }),
    crear:      (datos)    => request("POST",   "/caja.php", datos),
    actualizar: (id, d)    => request("PATCH",  "/caja.php", d, { id }),
    eliminar:   (id)       => request("DELETE", "/caja.php", undefined, { id }),
  };

  // ── Productos ─────────────────────────────────────────────
  const productos = {
    listar:   (filtros)  => request("GET",  "/productos.php", undefined, filtros),
    sincronizar: (items) => request("POST", "/productos.php", items),
  };

  // ── Usuarios ──────────────────────────────────────────────
  const usuarios = {
    listar:  ()   => request("GET", "/usuarios.php"),
    obtener: (id) => request("GET", "/usuarios.php", undefined, { id }),
  };

  // ── Categorías de Caja ────────────────────────────────────
  const categorias = {
    listar: () => request("GET", "/categorias-caja.php"),
  };

  // ── Comisiones ────────────────────────────────────────────
  const comisiones = {
    obtenerConfig: ()           => request("GET",  "/comisiones.php"),
    guardarConfig: (datos)      => request("PUT",  "/comisiones.php", datos),
    reporte:    (filtros)       => request("GET",  "/comisiones.php", undefined, { reporte: 1, ...filtros }),
    ajustes:    (filtros)       => request("GET",  "/comisiones.php", undefined, { ajustes: 1, ...filtros }),
    ajustar:    (datos)         => request("POST", "/comisiones.php", datos,     { ajuste: 1 }),
    historial:  (factura_id)    => request("GET",  "/comisiones.php", undefined, { historial: 1, factura_id }),
  };

  const ingresos = {
    listar:  (filtros = {}) => request("GET", "/ingresos.php", undefined, filtros),
    resumen: (filtros = {}) => request("GET", "/ingresos.php", undefined, { resumen: 1, ...filtros }),
  };

  // ── Upload ────────────────────────────────────────────────
  async function subirAdjunto(file, { movimiento_caja_id, cotizacion_id } = {}) {
    const fd = new FormData();
    fd.append("file", file);
    if (movimiento_caja_id) fd.append("movimiento_caja_id", movimiento_caja_id);
    if (cotizacion_id)      fd.append("cotizacion_id",      cotizacion_id);

    const res  = await fetch(BASE + "/upload.php", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Error subiendo archivo");
    return data;
  }

  async function cargarEnvConfig() {
    try {
      const res  = await fetch(BASE + "/env.php");
      const data = await res.json();
      if (!data?.ok) return;

      window.AppConfig = {
        hubspot_token:     data.hubspot_token     || "",
        dapta_webhook_url: data.dapta_webhook_url || "",
        dapta_api_key:     data.dapta_api_key     || "",
      };

      // Auto-configurar HubSpot si tiene token
      if (window.AppConfig.hubspot_token && window.HubSpotAPI) {
        window.HubSpotAPI.configurar({ token: window.AppConfig.hubspot_token });
      }

      console.info("[API Client] Config de entorno cargada.");
    } catch (e) {
      console.warn("[API Client] No se pudo cargar config de entorno:", e.message);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    window.Api = { cotizaciones, caja, productos, comisiones, ingresos, usuarios, categorias, subirAdjunto };
    console.info("[API Client] Listo. Endpoints base:", BASE);
    cargarEnvConfig();
  });

})();
