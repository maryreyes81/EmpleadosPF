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
  const $email = document.getElementById('email');
  const $pass  = document.getElementById('password');

  // Si no hay formulario en esta página, no hacer nada
  if (!$form) return;


  const setMsg = (type, text) => {
    if (!$msg) return;
     $msg.className = `small mt-2 ${type ? 'text-' + type : ''}`;
    $msg.textContent = text || '';
  };

   // Limpia el mensaje al teclear
  [$email, $pass].forEach((el) => {
    el?.addEventListener('input', () => setMsg('', ''));
  });

  $form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!$email || !$pass) {
      setMsg('danger', 'Missing data (email/password).');
      return;
    }

    const email = ($email.value || '').trim();
    const password = $pass.value || '';

    // Validación mínima
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk || !password) {
      setMsg('danger', 'Type a valid Email and your Password.');
      return;
    }

    setMsg('muted', 'Validating…');

    // Evita dobles envíos
    const btn = $form.querySelector('[type="submit"]');
    if (btn) btn.disabled = true;

    try {
      const r = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      // Tolerar respuestas vacías o no-JSON
      const text = await r.text();
      let data;
      try { data = text ? JSON.parse(text) : null; } catch { data = null; }

      if (!r.ok || !data?.ok) {
        const errText = data?.error || `HTTP ${r.status} ${r.statusText}`;
        throw new Error(errText);
      }

      // Guarda datos de usuario / token si vienen en el payload
      if (data.user) sessionStorage.setItem('user', JSON.stringify(data.user));
      if (data.token) sessionStorage.setItem('token', data.token);

      // Redirige al dashboard (ajusta la ruta si es distinta)
      window.location.href = '/dashboard.html';
    } catch (err) {
      setMsg('danger', err.message || 'Unable to login.');
    } finally {
      if (btn) btn.disabled = false;
    }
  });
});