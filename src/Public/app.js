(() => {
  'use strict';

  // Usa el mismo origen del dashboard (evita líos localhost vs 127.0.0.1 y CSP)
  const API = window.location.origin;

  // ===== Helpers =====
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const setMsg = (el, type, text) => {
    if (!el) return;
    el.className = `small${type ? ' text-' + type : ''}`;
    el.textContent = text || '';
  };
  const valDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  const toYMD = (s) => {
    if (!s) return '';
    s = String(s).trim();
    return s.length >= 10 ? s.slice(0, 10) : s;
  };

  // ===== Sesión (opcional) =====
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
      // window.location.href = '/login.html';
      return null;
    }
  }

  // ===== API helpers =====
  async function fetchEmployees(params) {
    const qs  = new URLSearchParams(params);
    const url = `${API}/api/employees?${qs.toString()}`;

    const res  = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch {}

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

  async function createEmployee(payload) {
    const res  = await fetch(`${API}/api/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch {}
    if (!res.ok) throw new Error((data && (data.error || data.message)) || `HTTP ${res.status}`);
    return data; // { ok:true, emp_no: <id>, ... }
  }

  async function updateEmployee(emp_no, payload) {
    const res  = await fetch(`${API}/api/employees/${emp_no}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch {}
    if (!res.ok) throw new Error((data && (data.error || data.message)) || `HTTP ${res.status}`);
    return data; // { ok:true, data: {...} }
  }

  async function deleteEmployee(emp_no) {
    const res = await fetch(`${API}/api/employees/${emp_no}`, {
      method: 'DELETE',
      headers: { 'Accept': 'application/json' },
    });
    const text = await res.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch {}
    if (!res.ok) throw new Error((data && (data.error || data.message)) || `HTTP ${res.status}`);
    return data; // { ok:true, deleted:1 }
  }

  // ===== UI helpers =====
  function renderRows(rows) {
    const tbody = $('#tblFindBody');
    if (!tbody) return;

    const safeRows = Array.isArray(rows) ? rows : [];
    if (safeRows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-muted">Sin datos</td></tr>`;
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
        <td class="text-end">
          <button type="button" class="btn btn-sm btn-outline-primary btn-edit" data-id="${r.emp_no}">Update</button>
          <button type="button" class="btn btn-sm btn-outline-danger ms-1 btn-del" data-id="${r.emp_no}">Delete</button>
        </td>
      </tr>
    `).join('');
  }

  function clearFindForm() {
    const ids = ['f_emp_no','f_first_name','f_last_name','f_gender','f_birth_date','f_hire_date','f_limit','f_offset'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (id === 'f_limit') el.value = '20';
      else if (id === 'f_offset') el.value = '0';
      else el.value = '';
    });
  }

  // ===== App =====
  document.addEventListener('DOMContentLoaded', () => {
    // Badge de usuario + logout
    const user = ensureSession();
    if (user && $('#userBadge')) $('#userBadge').textContent = `${user.name} · ${user.email}`;
    $('#logoutBtn')?.addEventListener('click', () => {
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      window.location.href = '/login.html';
    });

    // ===== BÚSQUEDA =====
    const formFind      = $('#formFind');
    const findMsg       = $('#findMsg');
    const findInfo      = $('#findInfo');
    const btnFindClear  = $('#btnFindClear');

    formFind?.addEventListener('submit', async (e) => {
      e.preventDefault();
      setMsg(findMsg, '', 'Searching…');

      // Lee emp_no de forma robusta
      const empNoEl =
        document.getElementById('f_emp_no') ||
        document.querySelector('#emp_noFind, [name="f_emp_no"], [name="emp_no"], #emp_no');

      const empNoVal = (empNoEl && typeof empNoEl.value === 'string') ? empNoEl.value.trim() : '';
      console.log('[find] empNoEl:', empNoEl, 'empNoVal:', empNoVal);

      // Resto de filtros
      const params = {
        first_name: ($('#f_first_name')?.value || '').trim(),
        last_name:  ($('#f_last_name')?.value  || '').trim(),
        gender:     ($('#f_gender')?.value     || '').trim(),
        birth_date: ($('#f_birth_date')?.value || '').trim(),
        hire_date:  ($('#f_hire_date')?.value  || '').trim(),
        limit:      ($('#f_limit')?.value      || '20').trim(),
        offset:     ($('#f_offset')?.value     || '0').trim(),
      };

      try {
        // Si hay emp_no → busca por ID
        if (empNoVal !== '') {
          const n = Number(empNoVal);
          if (!Number.isInteger(n) || n <= 0) {
            setMsg(findMsg, 'danger', 'emp_no debe ser entero positivo');
            return;
          }

          const url = `${API}/api/employees/${n}`;
          console.log('[find] GET', url);

          const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
          const raw = await r.text();
          console.log('[find] status', r.status, 'body', raw);

          if (r.status === 404) {
            renderRows([]);
            findInfo && (findInfo.textContent = '0 resultados');
            setMsg(findMsg, 'warning', 'Empleado no encontrado.');
            return;
          }
          if (!r.ok) {
            let dataErr=null; try { dataErr = raw ? JSON.parse(raw) : null; } catch {}
            const msg = (dataErr && (dataErr.error || dataErr.message)) || `HTTP ${r.status}`;
            throw new Error(msg);
          }

          const row = raw ? JSON.parse(raw) : null;
          renderRows(row ? [row] : []);
          findInfo && (findInfo.textContent = row ? '1 resultado' : '0 resultados');
          setMsg(findMsg, 'success', '');
          return;
        }

        // Sin emp_no → lista
        console.log('[find] sin emp_no, params:', params);
        const result = await fetchEmployees(params);
        const rows   = Array.isArray(result?.rows) ? result.rows : [];
        const total  = (typeof result?.total === 'number') ? result.total : rows.length;

        renderRows(rows);
        findInfo && (findInfo.textContent = `mostrando ${rows.length} de ${total}`);
        setMsg(findMsg, 'success', '');
      } catch (err) {
        console.error('[find] error:', err);
        renderRows([]);
        findInfo && (findInfo.textContent = '');
        setMsg(findMsg, 'danger', err.message || 'Unable to fetch data.');
      }
    });

    // Clear
    btnFindClear?.addEventListener('click', () => {
      clearFindForm();
      renderRows([]);
      setMsg(findMsg, '', '');
      if (findInfo) findInfo.textContent = '';
      // formFind?.dispatchEvent(new Event('submit'));
    });

    // ===== Tabla: Update / Delete =====
    const tbody     = $('#tblFindBody');
    const formCreate = $('#formCreate');
    const createMsg  = $('#createMsg');

    // Si quieres que “Update” haga PUT inmediato sin pasar por el formulario, pon true:
    const AUTO_SAVE_ON_UPDATE = false;

    tbody?.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      const id = btn.dataset.id;
      if (!id) return;

      // DELETE
      if (btn.classList.contains('btn-del')) {
        if (!confirm(`¿Eliminar empleado #${id}?`)) return;
        try {
          await deleteEmployee(id);
          formFind?.dispatchEvent(new Event('submit')); // refresca
        } catch (err) {
          alert(err.message || 'No se pudo eliminar.');
        }
        return;
      }

      // UPDATE
      if (btn.classList.contains('btn-edit')) {
        const tr = btn.closest('tr');
        if (!tr) return;

        const firstName = tr.children[1]?.textContent?.trim() || '';
        const lastName  = tr.children[2]?.textContent?.trim() || '';
        const gender    = tr.children[3]?.textContent?.trim() || '';
        const birthDate = toYMD(tr.children[4]?.textContent || '');
        const hireDate  = toYMD(tr.children[5]?.textContent || '');

        if (AUTO_SAVE_ON_UPDATE) {
          // PUT inmediato
          try {
            await updateEmployee(id, { first_name: firstName, last_name: lastName, gender, birth_date: birthDate, hire_date: hireDate });
            setMsg(createMsg, 'success', `Employee #${id} updated.`);
            formFind?.dispatchEvent(new Event('submit'));
          } catch (err) {
            setMsg(createMsg, 'danger', err.message || 'Unable to update.');
          }
          return;
        }

        // Modo formulario
        const $empNo = $('#emp_no');
        if ($empNo) { $empNo.removeAttribute('disabled'); $empNo.value = id; }
        $('#first_name') && ($('#first_name').value = firstName);
        $('#last_name')  && ($('#last_name').value  = lastName);
        $('#gender')     && ($('#gender').value     = gender);
        $('#birth_date') && ($('#birth_date').value = birthDate);
        $('#hire_date')  && ($('#hire_date').value  = hireDate);

        // Cambia el texto del submit
        const submitBtn = $('#formCreate [type="submit"]');
        submitBtn && (submitBtn.textContent = 'Guardar cambios');

        // Mensaje
        setMsg(createMsg, '', `Editando registro #${id}`);

        // Scroll + foco + highlight para que “sí pase algo”
        const card = formCreate?.closest('.card');
        formCreate?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        $('#first_name')?.focus();
        if (card) {
          card.style.transition = 'box-shadow 0.3s ease';
          const oldShadow = card.style.boxShadow;
          card.style.boxShadow = '0 0 0 0.25rem rgba(13,110,253,.25)';
          setTimeout(() => { card.style.boxShadow = oldShadow; }, 600);
        }
      }
    });

    // ===== Form: Insert / Update =====
    const btnClear = $('#btnClear');

    formCreate?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const empNoInput = $('#emp_no'); // puede estar disabled/oculto
      const emp_no     = empNoInput ? empNoInput.value.trim() : '';
      const first_name = $('#first_name') ? $('#first_name').value.trim() : '';
      const last_name  = $('#last_name')  ? $('#last_name').value.trim()  : '';
      const birth_date = $('#birth_date') ? $('#birth_date').value : '';
      const gender     = $('#gender')     ? $('#gender').value     : '';
      const hire_date  = $('#hire_date')  ? $('#hire_date').value  : '';

      // Validaciones
      if (!first_name || !last_name || !gender || !birth_date || !hire_date) {
        setMsg(createMsg, 'danger', 'Por favor completa todos los campos requeridos.');
        return;
      }
      if (['M','F'].indexOf(gender) === -1) {
        setMsg(createMsg, 'danger', 'El género debe ser "M" o "F".');
        return;
      }
      if (!valDate(birth_date) || !valDate(hire_date)) {
        setMsg(createMsg, 'danger', 'Las fechas deben tener formato YYYY-MM-DD.');
        return;
      }

      const body = { first_name, last_name, birth_date, gender, hire_date };
      const editing = (empNoInput && !empNoInput.disabled && emp_no !== '');

      if (editing) {
        const n = Number(emp_no);
        if (!Number.isInteger(n) || n <= 0) {
          setMsg(createMsg, 'danger', 'emp_no debe ser un entero positivo.');
          return;
        }
      }

      const submitBtn = formCreate.querySelector('[type="submit"]');
      submitBtn && (submitBtn.disabled = true);
      setMsg(createMsg, '', editing ? 'Updating…' : 'Inserting…');

      try {
        if (editing) {
          console.log('[update] PUT', `${API}/api/employees/${emp_no}`, body);
          await updateEmployee(emp_no, body);
          setMsg(createMsg, 'success', `Employee #${emp_no} updated.`);
        } else {
          console.log('[insert] POST', `${API}/api/employees`, body);
          const data = await createEmployee(body);
          const shownId = (data && data.emp_no != null) ? data.emp_no : 'N/A';
          setMsg(createMsg, 'success', `Employee created with emp_no ${shownId}.`);
        }

        formCreate.reset();
        // volver a modo Insert
        empNoInput && empNoInput.setAttribute('disabled', 'disabled');
        const sb = $('#formCreate [type="submit"]');
        sb && (sb.textContent = 'Insert');

        // refresca resultados
        formFind?.dispatchEvent(new Event('submit'));
      } catch (err) {
        console.error('[formCreate] error:', err);
        setMsg(createMsg, 'danger', err.message || (editing ? 'Unable to update.' : 'Unable to create employee.'));
      } finally {
        submitBtn && (submitBtn.disabled = false);
      }
    });

    // Limpiar formulario (Insert/Update)
    btnClear?.addEventListener('click', () => {
      formCreate?.reset();
      $('#emp_no')?.setAttribute('disabled', 'disabled');
      const sb = $('#formCreate [type="submit"]');
      sb && (sb.textContent = 'Insert');
      setMsg(createMsg, '', '');
    });
  });
})();
