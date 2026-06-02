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
     AppSession — API pública
     ---------------------------------------------------------------- */
  const AppSession = {
    user: null,       // { id, nombre, email, rol }
    _checked: false,

    /** Verifica sesión contra el backend. Redirige al login si no hay sesión. */
    async check() {
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

      // Sin sesión → redirigir a login
      const next = encodeURIComponent(window.location.href);
      window.location.href = BASE + '/login.html?next=' + next;
      return false;
    },

    /** Cierra la sesión actual y redirige a login. */
    async logout() {
      try {
        await fetch(BASE + '/api/auth.php?action=logout', {
          method: 'POST',
          credentials: 'same-origin',
        });
      } catch (_) { /* continúa igual */ }
      window.location.href = BASE + '/login.html';
    },

    /** Actualiza el toolbar y el popover de usuario con los datos del usuario activo. */
    _actualizarUI() {
      const u = this.user;
      if (!u) return;

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
