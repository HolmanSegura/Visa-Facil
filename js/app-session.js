/* ============================================================
   JS/APP-SESSION.JS
   Gestión de sesión de usuario compartida entre todos los módulos.

   - Verifica la sesión PHP al cargar la página.
   - Si no hay sesión activa, redirige a login.html.
   - Expone window.AppSession con los datos del usuario.
   - Actualiza la UI del toolbar (nombre + popover de usuario).
   - Maneja logout.

   Se carga como primer script en cada página protegida.
   ============================================================ */
(function () {

  // Calcula la base igual que api-client.js para ser consistente
  const BASE = window.location.pathname.replace(/\/[^/]*$/, '').replace(/\/$/, '');

  /* ----------------------------------------------------------------
     Preloader — inyectado sincrónicamente antes de DOMContentLoaded.
     El CSS vive en extras.css (cargado antes que este script).
     El try-catch garantiza que un error aquí no bloquee check().
     ---------------------------------------------------------------- */
  try {
    const pl = document.createElement('div');
    pl.id = 'app-preloader';
    pl.setAttribute('aria-hidden', 'true');
    pl.innerHTML = '<img src="img/visafacil.png" alt="Visa Fácil"><div id="app-preloader-spinner"></div>';
    document.body.appendChild(pl);
  } catch (_) { /* no bloquear si falla */ }

  /* ----------------------------------------------------------------
     AppSession — API pública
     ---------------------------------------------------------------- */
  const AppSession = {
    user: null,       // { id, nombre, email, rol }
    _checked: false,

    /** Verifica sesión contra el backend. Redirige a HubSpot OAuth si no hay sesión. */
    async check() {
      // Mostrar error OAuth si viene en la URL (ej: usuario incorrecto)
      const params = new URLSearchParams(window.location.search);
      const hsErr  = params.get('hs_error');
      if (hsErr) this._mostrarErrorOAuth(hsErr, params.get('email'));

      try {
        const res  = await fetch(BASE + '/api/auth.php?action=check', { credentials: 'same-origin' });
        const data = await res.json();

        if (data.ok && data.user) {
          this.user     = data.user;
          this._checked = true;
          this._actualizarUI();
          return true;
        }
      } catch (e) {
        console.warn('[Session] No se pudo verificar sesión:', e.message);
      }

      // Sin sesión → redirigir a HubSpot OAuth
      window.location.href = BASE + '/api/auth.php?action=hs_login';
      return false;
    },

    /** Cierra la sesión actual y redirige a HubSpot para que vuelva a autenticarse. */
    async logout() {
      try {
        await fetch(BASE + '/api/auth.php?action=logout', {
          method: 'POST',
          credentials: 'same-origin',
        });
      } catch (_) { /* continúa igual */ }
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
      // Limpiar el parámetro de la URL sin recargar
      history.replaceState({}, '', window.location.pathname);
      // Mostrar con el sistema de toasts si está disponible, si no alerta básica
      if (typeof window.mostrarToast === 'function') {
        window.mostrarToast('⚠ ' + msg, 'error');
      } else {
        alert(msg);
      }
    },

    /** Actualiza el toolbar y el popover de usuario con los datos del usuario activo. */
    _actualizarUI() {
      const u = this.user;
      if (!u) return;

      document.getElementById('app-preloader')?.remove();

      // Nombre en el botón del toolbar
      const nameEl = document.querySelector('.toolbar__profile-name');
      if (nameEl) nameEl.textContent = u.nombre.split(' ')[0];

      // Popover de usuario
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      set('user-pop-nombre', u.nombre);
      set('user-pop-email',  u.email);
      set('user-pop-rol',    { admin: 'Administrador', asesor: 'Asesor', admin_caja: 'Admin de Caja' }[u.rol] || u.rol);

      // Avatar con iniciales
      const avatar = document.querySelector('.toolbar__avatar-iniciales');
      if (avatar) {
        avatar.textContent = u.nombre.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
      }

      // Pre-rellenar datos en el modal de perfil (si existe en la página)
      const pNombre = document.getElementById('perfil-nombre');
      const pEmail  = document.getElementById('perfil-email');
      if (pNombre) pNombre.textContent = u.nombre;
      if (pEmail)  pEmail.textContent  = u.email;

      // Ocultar controles de configuración de comisiones para no-admin
      if (u.rol !== 'admin') {
        document.querySelectorAll(
          '[data-accion="cab-config-comisiones"], #btn-configurar-comisiones'
        ).forEach(el => { el.hidden = true; });
      }
    }
  };

  window.AppSession = AppSession;

  /* ----------------------------------------------------------------
     Init: check al cargar el DOM + eventos de UI
     ---------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    AppSession.check();

    // Botón Cerrar sesión (en el popover de usuario)
    document.getElementById('btn-logout')?.addEventListener('click', () => {
      AppSession.logout();
    });

    // Botón Ir a HubSpot
    document.getElementById('btn-ir-hubspot')?.addEventListener('click', () => {
      window.open('https://app.hubspot.com/', '_blank', 'noopener');
    });
  });
})();
