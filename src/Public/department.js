(function () {
  'use strict';
  var API = window.location.origin;

  // Helpers DOM
  function $(s) { return document.querySelector(s); }
  function setMsg(el, type, text) {
    if (!el) return;
    el.className = 'small' + (type ? ' text-' + type : '');
    el.textContent = text || '';
  }

  var form    = $('#formDept');
  var msg     = $('#msg');
  var tbody   = $('#tblBody');
  var info    = $('#listInfo');
  var sel     = $('#deptSelect');
  var limitI  = $('#limit');
  var offsetI = $('#offset');
  var btnClear= $('#btnClear');

  var DEPTS = new Map();

  function renderRows(rows, dept_no, dept_name) {
    if (!tbody) return;
    var arr = Array.isArray(rows) ? rows : [];
    if (arr.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Without data</td></tr>';
      return;
    }
    var html = arr.map(function (r) {
      return (
        '<tr>' +
          '<td>' + (r.emp_no != null ? r.emp_no : '') + '</td>' +
          '<td>' + (r.first_name || '') + '</td>' +
          '<td>' + (r.last_name  || '') + '</td>' +
          '<td>' + (dept_no      || '') + '</td>' +
          '<td>' + (dept_name    || '') + '</td>' +
        '</tr>'
      );
    }).join('');
    tbody.innerHTML = html;
  }

  function qs(obj) {
    var u = new URLSearchParams();
    Object.keys(obj).forEach(function (k) { u.set(k, obj[k]); });
    return u.toString();
  }

  async function loadDepartments() {
    setMsg(msg, '', 'Loading departaments…');
    try {
      var r = await fetch(API + '/api/employees/departments', { headers: { Accept: 'application/json' } });
      var text = await r.text();
      console.log('[departments] status', r.status, 'len', text.length);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var rows = text ? JSON.parse(text) : [];
      if (!Array.isArray(rows)) throw new Error('Invalid data');

      if (!sel) return;
      sel.innerHTML = '<option value="">Selecciona…</option>' + rows.map(function (d) {
        return '<option value="' + d.dept_no + '">' + d.dept_no + ' — ' + d.dept_name + '</option>';
      }).join('');

      rows.forEach(function (d) { DEPTS.set(String(d.dept_no).toUpperCase(), d.dept_name); });
      setMsg(msg, 'success', '');

      // Autoseleccionar el primero con datos y consultar
      if (rows.length > 0) {
        sel.value = rows[0].dept_no;
        // dispara una consulta inicial
        if (form) form.dispatchEvent(new Event('submit'));
      } else {
        setMsg(msg, 'warning', 'There no departments on the catalog.');
      }
    } catch (e) {
      console.error('departments error:', e);
      setMsg(msg, 'danger', e.message || 'Unable to load departments');
    }
  }

  async function fetchEmployeesByDept(dept_no, limit, offset) {
    var url = API + '/api/employees/' + encodeURIComponent(dept_no) + '/employees?' +
              qs({ limit: String(limit), offset: String(offset) });
    var r = await fetch(url, { headers: { Accept: 'application/json' } });
    var text = await r.text();
    console.log('[dept employees] GET', url, 'status', r.status, 'len', text.length);
    var data = null; try { data = text ? JSON.parse(text) : null; } catch (_e) {}
    if (!r.ok) {
      var m = (data && (data.error || data.message)) || 'HTTP ' + r.status;
      throw new Error(m);
    }
    return Array.isArray(data) ? data : [];
  }

  // Submit del formulario
  if (form) form.addEventListener('submit', async function (e) {
    e.preventDefault();
    setMsg(msg, '', 'Loading…');

    var dept_no = (sel && typeof sel.value === 'string') ? sel.value.trim().toUpperCase() : '';
    var limit   = Math.min(Math.max(Number((limitI && limitI.value) || '20'), 1), 100);
    var offset  = Math.max(Number((offsetI && offsetI.value) || '0'), 0);

    if (!dept_no) { setMsg(msg, 'danger', 'Select a department.'); return; }
    var dept_name = DEPTS.get(dept_no) || '';

    try {
      var rows = await fetchEmployeesByDept(dept_no, limit, offset);
      renderRows(rows, dept_no, dept_name);
      if (info) info.textContent = 'Showing ' + rows.length + ' employees from ' + dept_no + ' — ' + dept_name;
      setMsg(msg, 'success', '');
    } catch (err) {
      console.error('fetch by dept error:', err);
      renderRows([], dept_no, dept_name);
      if (info) info.textContent = '';
      setMsg(msg, 'danger', err.message || 'Unable to fetch data');
    }
  });

  // Consultar automáticamente al cambiar el select (calidad de vida)
  if (sel && form) sel.addEventListener('change', function () {
    form.dispatchEvent(new Event('submit'));
  });

  // Limpiar
  if (btnClear) btnClear.addEventListener('click', function () {
    if (sel) sel.value = '';
    if (limitI) limitI.value = '20';
    if (offsetI) offsetI.value = '0';
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Sin datos</td></tr>';
    if (info) info.textContent = '';
    setMsg(msg, '', '');
  });

  // Init
  document.addEventListener('DOMContentLoaded', loadDepartments);
})();
