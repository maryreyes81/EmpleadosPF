(() => {
  'use strict';

  // Usa el mismo origen del dashboard (evita líos localhost vs 127.0.0.1 y CSP)
  const API = window.location.origin;

  // Helpers DOM
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const setMsg = (el, type, text) => {
    if (!el) return;
    el.className = `small ${type ? 'text-' + type : ''}`;
    el.textContent = text || '';
  };
  const valDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

  // ====== Sesión (opcional) ======
  function ensureSession() {
    try {
      const user = JSON.parse(
        sessionStorage.getItem('user') ||
        localStorage.getItem('user') ||
        'null'
      );
      if (!user) throw new Error('NO_SESSION');
      return user;
    } catch {
      // Si quieres forzar login, descomenta:
      // window.location.href = '/login.html';
      return null;
    }
  }

  // ====== Normaliza la respuesta de /api/employees a { rows, total } ======
  async function fetchEmployees(params) {
    const qs  = new URLSearchParams(params);
    const url = `${API}/api/employees?${qs.toString()}`;

    const res  = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const text = await res.text(); // tolera respuestas vacías
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }

    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    if (Array.isArray(data)) return { rows: data, total: data.length };
    if (data && Array.isArray(data.rows)) {
      const total = (typeof data.total === 'number') ? data.total : data.rows.length;
      return { rows: data.rows, total };
    }
    return { rows: [], total: 0 };
  }

  // ====== Render de la tabla ======
  function renderRows(rows) {
    const tbody = $('#tblFindBody');
    if (!tbody) return;

    const safeRows = Array.isArray(rows) ? rows : [];
    if (safeRows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-muted">Sin datos</td></tr>`;
      return;
    }

    tbody.innerHTML = safeRows.map(r => `
      <tr>
        <td>${r.emp_no ?? ''}</td>
        <td>${r.first_name ?? ''}</td>
        <td>${r.last_name ?? ''}</td>
        <td>${r.gender ?? ''}</td>
        <td>${r.birth_date ?? ''}</td>
        <td>${r.hire_date ?? ''}</td>
      </tr>
    `).join('');
  }

  // ====== Insertar empleado ======
  async function createEmployee(payload) {
    const res  = await fetch(`${API}/api/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let data; try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
    return data; // esperado { ok:true, emp_no: <id> }
  }

  document.addEventListener('DOMContentLoaded', () => {
    // ====== Badge de usuario + Logout ======
    const user = ensureSession();
    if (user && $('#userBadge')) $('#userBadge').textContent = `${user.name} · ${user.email}`;

    $('#logoutBtn')?.addEventListener('click', () => {
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      window.location.href = '/login.html';
    });

    // ====== BÚSQUEDA ======
    const formFind = $('#formFind');
    const findMsg  = $('#findMsg');
    const findInfo = $('#findInfo');

    formFind?.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('FormFind submit');
      setMsg(findMsg, '', 'Buscando…');

      const params = {
        first_name: $('#f_first_name')?.value || '',
        last_name:  $('#f_last_name')?.value || '',
        gender:     $('#f_gender')?.value || '',
        birth_date: $('#f_birth_date')?.value || '',
        hire_date:  $('#f_hire_date')?.value || '',
        limit:      $('#f_limit')?.value || '20',
        offset:     $('#f_offset')?.value || '0',
      };

      try {
        const result = await fetchEmployees(params);
        const rows   = Array.isArray(result?.rows) ? result.rows : [];
        const total  = (typeof result?.total === 'number') ? result.total : rows.length;

        renderRows(rows);
        if (findInfo) findInfo.textContent = `mostrando ${rows.length} de ${total}`;
        setMsg(findMsg, 'success', '');
      } catch (err) {
        renderRows([]);
        if (findInfo) findInfo.textContent = '';
        setMsg(findMsg, 'danger', err.message || 'No se pudo obtener empleados');
      }
    });

    // Carga inicial automática (si hay formulario)
    formFind?.dispatchEvent(new Event('submit'));

    // ====== INSERTAR ======
    const formCreate = $('#formCreate');
    const createMsg  = $('#createMsg');
    const btnClear   = $('#btnClear');

    formCreate?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const empNoInput = $('#emp_no'); // puede estar disabled/oculto
      const emp_no     = empNoInput ? empNoInput.value.trim() : '';
      const first_name = $('#first_name')?.value.trim();
      const last_name  = $('#last_name')?.value.trim();
      const birth_date = $('#birth_date')?.value;
      const gender     = $('#gender')?.value;
      const hire_date  = $('#hire_date')?.value;

      // Validaciones mínimo viables
      if (!first_name || !last_name || !gender || !birth_date || !hire_date) {
        return setMsg(createMsg, 'danger', 'Por favor completa todos los campos requeridos.');
      }
      if (!['M', 'F'].includes(gender)) {
        return setMsg(createMsg, 'danger', 'El género debe ser "M" o "F".');
      }
      if (!valDate(birth_date) || !valDate(hire_date)) {
        return setMsg(createMsg, 'danger', 'Las fechas deben tener formato YYYY-MM-DD.');
      }

      const body = { first_name, last_name, birth_date, gender, hire_date };
      if (emp_no !== '') {
        const n = Number(emp_no);
        if (!Number.isInteger(n) || n <= 0) {
          return setMsg(createMsg, 'danger', 'emp_no debe ser un entero positivo.');
        }
        body.emp_no = n;
      }

      const submitBtn = formCreate.querySelector('[type="submit"]');
      submitBtn && (submitBtn.disabled = true);
      setMsg(createMsg, '', 'Insertando…');

      try {
        const data = await createEmployee(body);
        setMsg(createMsg, 'success', `Empleado creado con emp_no ${data?.emp_no ?? 'N/A'}.`);
        formCreate.reset();
        // refresca la tabla si existe búsqueda
        formFind?.dispatchEvent(new Event('submit'));
      } catch (err) {
        setMsg(createMsg, 'danger', err.message || 'No se pudo crear el empleado.');
      } finally {
        submitBtn && (submitBtn.disabled = false);
      }
    });

    // ====== LIMPIAR ======
    btnClear?.addEventListener('click', () => {
      formCreate?.reset();
      setMsg(createMsg, '', '');
    });
  });
})();
