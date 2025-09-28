 // login.js
'use strict';

const API = window.location.origin;

function ready(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn);
  } else {
    fn();
  }
}

ready(() => {
  const $form = document.getElementById('loginForm');
  const $msg  = document.getElementById('loginMsg');

  // Si no hay formulario en esta página, no hacer nada
  if (!$form) return;

  const $email = document.getElementById('email');
  const $pass  = document.getElementById('password');

  const setMsg = (type, text) => {
    if (!$msg) return;
    $msg.className = `small mt-2 text-${type}`;
    $msg.textContent = text;
  };

  $form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validar que existan los inputs
    if (!$email || !$pass) {
      setMsg('danger', 'Missing data (email/password).');
      return;
    }

    const email = ($email.value || '').trim();
    const password = $pass.value || '';

    if (!email || !password) {
      setMsg('danger', 'Type your Email and Password.');
      return;
    }

    setMsg('muted', 'Validating…');

    try {
      const r = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok || !data.ok) {
        const errText = data?.error || `HTTP ${r.status} ${r.statusText}`;
        throw new Error(errText);
      }

      // Guardar algo de info (opcional)
      sessionStorage.setItem('user', JSON.stringify(data.user));

      // Redirigir
      window.location.href = '/dashboard.html'; // ajusta la ruta real
    } catch (err) {
      setMsg('danger', err.message || 'Unable to login.');
    }
  });
});