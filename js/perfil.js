/* ============================================================
   JS/PERFIL.JS
   Modal de perfil de usuario: cambio de contraseña.
   Depende de: app-session.js, ui-interactions.js
   ============================================================ */
(function () {
  const BASE = window.location.pathname.replace(/\/[^/]*$/, '').replace(/\/$/, '');

  function abrirModal() {
    const modal = document.getElementById('modal-perfil');
    if (!modal) return;
    // Limpiar el formulario antes de abrir
    modal.querySelectorAll('input[type="password"]').forEach(i => { i.value = ''; });
    const err = document.getElementById('perfil-error');
    if (err) { err.textContent = ''; err.hidden = true; }
    window.Modales?.abrir('modal-perfil');
  }

  async function guardarPassword(e) {
    e.preventDefault();

    const actual    = document.getElementById('perfil-pwd-actual')?.value   || '';
    const nueva     = document.getElementById('perfil-pwd-nueva')?.value    || '';
    const confirma  = document.getElementById('perfil-pwd-confirma')?.value || '';
    const errEl     = document.getElementById('perfil-error');
    const btn       = document.getElementById('btn-perfil-guardar');

    function mostrarError(msg) {
      if (errEl) { errEl.textContent = msg; errEl.hidden = false; }
    }

    if (!actual || !nueva || !confirma) {
      mostrarError('Completa todos los campos.'); return;
    }
    if (nueva.length < 8) {
      mostrarError('La nueva contraseña debe tener al menos 8 caracteres.'); return;
    }
    if (nueva !== confirma) {
      mostrarError('Las contraseñas nuevas no coinciden.'); return;
    }

    const textoOrig = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }
    if (errEl) { errEl.hidden = true; }

    try {
      const res  = await fetch(BASE + '/api/auth.php?action=cambiar_password', {
        method:      'POST',
        credentials: 'same-origin',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ password_actual: actual, password_nueva: nueva, password_confirma: confirma }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        mostrarError(data.message || data.error || 'Error al cambiar la contraseña.');
        return;
      }

      window.Modales?.cerrar(document.getElementById('modal-perfil'));
      window.mostrarToast?.('✓ Contraseña actualizada correctamente');
    } catch (err) {
      mostrarError('Error de conexión. Intenta de nuevo.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = textoOrig; }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Botón "Mi perfil" en el popover de usuario
    document.getElementById('btn-perfil')?.addEventListener('click', () => {
      window.Popovers?.cerrar?.();
      abrirModal();
    });

    // Submit del formulario
    document.getElementById('form-cambiar-password')?.addEventListener('submit', guardarPassword);

    // Toggle visibilidad de contraseña
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-toggle-pwd]');
      if (!btn) return;
      const targetId = btn.getAttribute('data-toggle-pwd');
      const input    = document.getElementById(targetId);
      if (!input) return;
      const mostrar  = input.type === 'password';
      input.type     = mostrar ? 'text' : 'password';
      btn.setAttribute('aria-label', mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña');
      btn.querySelector('.pwd-eye-show')?.classList.toggle('hidden', mostrar);
      btn.querySelector('.pwd-eye-hide')?.classList.toggle('hidden', !mostrar);
    });
  });

  window.PerfilModal = { abrir: abrirModal };
})();
