/* ============================================================
   JS/APP-SESSION.JS
   Gestión de sesión de usuario compartida entre todos los módulos.

   - Verifica la sesión PHP al cargar la página.
   - Si no hay sesión activa, redirige a HubSpot OAuth.
   - Expone window.AppSession con los datos del usuario.
   - Actualiza la UI del toolbar (nombre + popover de usuario).
   - Maneja logout.

   El check() arranca INMEDIATAMENTE al cargar el script
   (no espera DOMContentLoaded) para minimizar el tiempo que
   el preloader está visible.
   ============================================================ */
(function () {

  const BASE = window.location.pathname.replace(/\/[^/]*$/, '').replace(/\/$/, '');

  /* ----------------------------------------------------------------
     Preloader — el div vive inline en el HTML (ver <body> de cada
     página). Solo lo crea aquí como respaldo por si el HTML cambia.
     ---------------------------------------------------------------- */
  try {
    if (!document.getElementById('app-preloader')) {
      const pl = document.createElement('div');
      pl.id = 'app-preloader';
      pl.setAttribute('aria-hidden', 'true');
      pl.innerHTML = '<img src="img/visafacil.png" alt="Visa Fácil"><div id="app-preloader-spinner"></div>';
      document.body.appendChild(pl);
    }
  } catch (_) {}

  /* ----------------------------------------------------------------
     Safety net: si por cualquier razón el preloader sigue visible
     después de 10 s, lo elimina para que la página no quede bloqueada.
     ---------------------------------------------------------------- */
  const _safetyTimer = setTimeout(() => _ocultarPreloader(), 10000);

  function _ocultarPreloader() {
    clearTimeout(_safetyTimer);
    const pl = document.getElementById('app-preloader');
    if (!pl) return;
    pl.classList.add('app-preloader--saliendo');
    setTimeout(() => pl.remove(), 280);
  }

  /* ----------------------------------------------------------------
     AppSession — API pública
     ---------------------------------------------------------------- */
  const AppSession = {
    user: null,
    _checked: false,

    /** Verifica sesión contra el backend. Redirige a HubSpot OAuth si no hay sesión. */
    async check() {
      const params = new URLSearchParams(window.location.search);
      const hsErr  = params.get('hs_error');
      if (hsErr) this._mostrarErrorOAuth(hsErr, params.get('email'));

      try {
        const ctrl  = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 12000);
        const res   = await fetch(BASE + '/api/auth.php?action=check', {
          credentials: 'same-origin',
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        const data = await res.json();

        if (data.ok && data.user) {
          this.user     = data.user;
          this._checked = true;
          // _actualizarUI necesita el DOM; espera si todavía está cargando.
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this._actualizarUI(), { once: true });
          } else {
            this._actualizarUI();
          }
          return true;
        }
      } catch (e) {
        console.warn('[Session] No se pudo verificar sesión:', e.message);
      }

      // Sin sesión → redirigir a HubSpot OAuth
      window.location.href = BASE + '/api/auth.php?action=hs_login';
      return false;
    },

    /** Cierra la sesión y redirige a HubSpot. */
    async logout() {
      try {
        await fetch(BASE + '/api/auth.php?action=logout', {
          method: 'POST',
          credentials: 'same-origin',
        });
      } catch (_) {}
      window.location.href = BASE + '/api/auth.php?action=hs_login';
    },

    /** Muestra un toast con el motivo del error OAuth. */
    _mostrarErrorOAuth(error, email) {
      const MENSAJES = {
        wrong_portal:         'Esta cuenta de HubSpot no corresponde al portal de Visa Fácil.',
        user_not_registered:  `El usuario ${email || ''} no está registrado en el sistema. Contacta al administrador.`,
        token_exchange_failed:'No se pudo completar la autenticación con HubSpot. Intenta de nuevo.',
        invalid_state:        'Sesión de autenticación inválida. Intenta de nuevo.',
        hs_session_expired:   'Tu sesión de HubSpot expiró. Vuelve a iniciar sesión.',
      };
      const msg = MENSAJES[error] || `Error de autenticación: ${error}`;
      history.replaceState({}, '', window.location.pathname);
      if (typeof window.mostrarToast === 'function') {
        window.mostrarToast('⚠ ' + msg, 'error');
      } else {
        alert(msg);
      }
    },

    /** Quita el preloader y actualiza el toolbar con los datos del usuario. */
    _actualizarUI() {
      const u = this.user;
      if (!u) return;

      _ocultarPreloader();

      const nameEl = document.querySelector('.toolbar__profile-name');
      if (nameEl) nameEl.textContent = u.nombre.split(' ')[0];

      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      set('user-pop-nombre', u.nombre);
      set('user-pop-email',  u.email);
      set('user-pop-rol',    { admin: 'Administrador', asesor: 'Asesor', admin_caja: 'Admin de Caja' }[u.rol] || u.rol);

      const avatar = document.querySelector('.toolbar__avatar-iniciales');
      if (avatar) {
        avatar.textContent = u.nombre.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
      }

      const pNombre = document.getElementById('perfil-nombre');
      const pEmail  = document.getElementById('perfil-email');
      if (pNombre) pNombre.textContent = u.nombre;
      if (pEmail)  pEmail.textContent  = u.email;

      if (u.rol !== 'admin') {
        document.querySelectorAll(
          '[data-accion="cab-config-comisiones"], #btn-configurar-comisiones'
        ).forEach(el => { el.hidden = true; });
      }
    }
  };

  window.AppSession = AppSession;

  /* ----------------------------------------------------------------
     Inicia la verificación INMEDIATAMENTE — no espera DOMContentLoaded.
     El fetch es async y no bloquea el render. Si la respuesta llega
     antes de que el DOM esté listo, _actualizarUI espera al evento.
     ---------------------------------------------------------------- */
  AppSession.check();

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-logout')?.addEventListener('click', () => AppSession.logout());
    document.getElementById('btn-ir-hubspot')?.addEventListener('click', () => {
      window.open('https://app.hubspot.com/', '_blank', 'noopener');
    });
  });
})();
