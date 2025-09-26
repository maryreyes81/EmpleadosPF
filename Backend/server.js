// server.js
const express = require('express');
const morgan  = require('morgan');
const mysql   = require('mysql2');
const cors    = require('cors');

const app = express();
const PORT = 3000;

// ───────────────── Middlewares ─────────────────
app.use(express.json());
app.use(morgan('dev'));

// CORS DEV (abre todo). En producción, restringe "origin".
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Accept'] }));

// ───────────────── DB ─────────────────
const db = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'Mandarina8127!',
  database: 'employees',
  charset: 'utf8mb4',
});

db.connect(err => {
  if (err) {
    console.error('❌ Error MySQL:', err.message);
    process.exit(1);
  }
  console.log('✅ Conexión MySQL OK');
});

// ───────────────── Utilidades ─────────────────
const ORDERABLE_EMP = new Set(['emp_no', 'first_name', 'last_name', 'gender', 'hire_date']);
const isTrue = (v) => v === '1' || v === 'true';

// ───────────────── Rutas ─────────────────

// 🏠 Salud
app.get('/', (_req, res) => res.send('API OK ✅'));

// GET /api/employees?page=1&pageSize=20&orderBy=last_name&direction=desc
app.get('/api/employees', (req, res) => {
  const page = Math.max(parseInt(req.query.page || '1', 10) || 1, 1);
  const pageSizeRaw = parseInt(req.query.pageSize || '20', 10);
  const pageSize = Math.min(Math.max(pageSizeRaw || 20, 1), 100);
  const offset = (page - 1) * pageSize;

  const orderBy = (req.query.orderBy || 'emp_no').toString();
  const direction = (req.query.direction || 'asc').toString().toLowerCase();
  if (!ORDERABLE_EMP.has(orderBy)) {
    return res.status(400).json({ error: `orderBy inválido. Usa: ${[...ORDERABLE_EMP].join(', ')}` });
  }
  const dir = direction === 'desc' ? 'DESC' : 'ASC';

  // 1) total
  const countSql = 'SELECT COUNT(*) AS total FROM employees';
  db.query(countSql, (errCount, countRows) => {
    if (errCount) return res.status(500).json({ error: 'DB error' });
    const total = countRows[0].total;

    // 2) datos paginados
    const dataSql = `
      SELECT emp_no, first_name, last_name, gender, hire_date
      FROM employees
      ORDER BY ${orderBy} ${dir}, emp_no ASC
      LIMIT ? OFFSET ?
    `;
    db.query(dataSql, [pageSize, offset], (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json({ page, pageSize, total, orderBy, direction: dir.toLowerCase(), data: rows });
    });
  });
});

// Detalle simple
// GET /api/employees/10001
app.get('/api/employees/:emp_no', (req, res) => {
  const emp_no = Number(req.params.emp_no);
  if (!Number.isInteger(emp_no) || emp_no <= 0) return res.status(400).json({ error: 'emp_no debe ser entero positivo' });

  db.query('SELECT * FROM employees WHERE emp_no = ?', [emp_no], (err, rows) => {
    if (err) return res.status(500).json({ error: 'No se pudo obtener el empleado' });
    if (rows.length === 0) return res.status(404).json({ message: 'Empleado no encontrado' });
    res.json(rows[0]);
  });
});

// Detalle extendido (salario/título/depto actuales)
// GET /api/employees/10001/full
app.get('/api/employees/:emp_no/full', (req, res) => {
  const emp_no = Number(req.params.emp_no);
  if (!Number.isInteger(emp_no) || emp_no <= 0) return res.status(400).json({ error: 'emp_no debe ser entero positivo' });

  const sql = `
    SELECT e.*,
           s.salary           AS current_salary,
           t.title            AS current_title,
           d.dept_no          AS current_dept_no,
           d.dept_name        AS current_dept_name
    FROM employees e
    LEFT JOIN salaries s
      ON s.emp_no = e.emp_no AND s.to_date = '9999-01-01'
    LEFT JOIN titles t
      ON t.emp_no = e.emp_no AND t.to_date = '9999-01-01'
    LEFT JOIN dept_emp de
      ON de.emp_no = e.emp_no AND de.to_date = '9999-01-01'
    LEFT JOIN departments d
      ON d.dept_no = de.dept_no
    WHERE e.emp_no = ?
    LIMIT 1
  `;
  db.query(sql, [emp_no], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (rows.length === 0) return res.status(404).json({ message: 'Empleado no encontrado' });
    res.json(rows[0]);
  });
});

// Búsqueda por nombre/apellido
// GET /api/employees/search?q=Geor&limit=20
app.get('/api/employees/search', (req, res) => {
  const q = (req.query.q || '').trim();
  let limit = parseInt(req.query.limit || '20', 10);
  limit = Number.isNaN(limit) ? 20 : Math.min(Math.max(limit, 1), 100);
  if (!q) return res.status(400).json({ error: 'Parámetro q requerido' });

  const like = `%${q}%`;
  const sql = `
    SELECT e.emp_no, e.first_name, e.last_name, e.gender, e.hire_date
    FROM employees e
    WHERE e.first_name LIKE ?
       OR e.last_name  LIKE ?
       OR CONCAT(e.first_name,' ',e.last_name) LIKE ?
    ORDER BY e.emp_no
    LIMIT ?
  `;
  db.query(sql, [like, like, like, limit], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

// Salario (actual o historial)
// GET /api/employees/10001/salary
// GET /api/employees/10001/salary?current=1
app.get('/api/employees/:emp_no/salary', (req, res) => {
  const emp_no = Number(req.params.emp_no);
  if (!Number.isInteger(emp_no) || emp_no <= 0) return res.status(400).json({ error: 'emp_no debe ser entero positivo' });
  const currentOnly = isTrue(req.query.current);

  let sql = `
    SELECT salary, from_date, to_date
    FROM salaries
    WHERE emp_no = ?
  `;
  const params = [emp_no];
  if (currentOnly) sql += ` AND to_date = '9999-01-01'`;
  sql += ` ORDER BY from_date DESC LIMIT 100`;

  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(currentOnly ? (rows[0] || null) : rows);
  });
});

// Títulos (actual o historial)
// GET /api/employees/10001/titles
// GET /api/employees/10001/titles?current=1
app.get('/api/employees/:emp_no/titles', (req, res) => {
  const emp_no = Number(req.params.emp_no);
  if (!Number.isInteger(emp_no) || emp_no <= 0) return res.status(400).json({ error: 'emp_no debe ser entero positivo' });
  const currentOnly = isTrue(req.query.current);

  let sql = `
    SELECT title, from_date, to_date
    FROM titles
    WHERE emp_no = ?
  `;
  const params = [emp_no];
  if (currentOnly) sql += ` AND to_date = '9999-01-01'`;
  sql += ` ORDER BY from_date DESC LIMIT 100`;

  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(currentOnly ? (rows[0] || null) : rows);
  });
});

// Departamentos del empleado (actual o historial)
// GET /api/employees/10001/departments
// GET /api/employees/10001/departments?current=1
app.get('/api/employees/:emp_no/departments', (req, res) => {
  const emp_no = Number(req.params.emp_no);
  if (!Number.isInteger(emp_no) || emp_no <= 0) return res.status(400).json({ error: 'emp_no debe ser entero positivo' });
  const currentOnly = isTrue(req.query.current);

  let sql = `
    SELECT d.dept_no, d.dept_name, de.from_date, de.to_date
    FROM dept_emp de
    JOIN departments d ON d.dept_no = de.dept_no
    WHERE de.emp_no = ?
  `;
  const params = [emp_no];
  if (currentOnly) sql += ` AND de.to_date = '9999-01-01'`;
  sql += ` ORDER BY de.from_date DESC LIMIT 100`;

  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

// Catálogo de departamentos
// GET /api/departments
app.get('/api/departments', (_req, res) => {
  db.query(`SELECT dept_no, dept_name FROM departments ORDER BY dept_name`, (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

// Empleados actuales por departamento (paginado)
// GET /api/departments/d005/employees?limit=20&offset=0
app.get('/api/departments/:dept_no/employees', (req, res) => {
  const dept_no = (req.params.dept_no || '').toString().trim().toUpperCase();
  if (!dept_no) return res.status(400).json({ error: 'dept_no inválido' });

  let limit  = parseInt(req.query.limit  || '20', 10);
  let offset = parseInt(req.query.offset || '0',  10);
  limit  = Number.isNaN(limit)  ? 20 : Math.min(Math.max(limit, 1), 100);
  offset = Number.isNaN(offset) ? 0  : Math.max(offset, 0);

  const sql = `
    SELECT e.emp_no, e.first_name, e.last_name, e.gender, e.hire_date
    FROM employees e
    JOIN dept_emp de ON de.emp_no = e.emp_no
    WHERE de.dept_no = ?
      AND de.to_date = '9999-01-01'
    ORDER BY e.emp_no
    LIMIT ? OFFSET ?
  `;
  db.query(sql, [dept_no, limit, offset], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

// Alta de empleado (emp_no opcional → MAX+1)
// POST /api/employees
app.post('/api/employees', (req, res) => {
  let { emp_no, birth_date, first_name, last_name, gender, hire_date } = req.body;

  // Normaliza y valida
  gender = (gender || '').toString().trim().toUpperCase();
  const REQUIRED = { birth_date, first_name, last_name, gender, hire_date };
  for (const [k, v] of Object.entries(REQUIRED)) {
    if (!v) return res.status(400).json({ error: `Falta el campo requerido: ${k}` });
  }
  if (!['M', 'F'].includes(gender)) {
    return res.status(400).json({ error: 'gender debe ser "M" o "F"' });
  }
  const reDate = /^\d{4}-\d{2}-\d{2}$/;
  if (!reDate.test(birth_date) || !reDate.test(hire_date)) {
    return res.status(400).json({ error: 'birth_date y hire_date deben ser YYYY-MM-DD' });
  }

  const doInsert = (id) => {
    const sql = `
      INSERT INTO employees (emp_no, birth_date, first_name, last_name, gender, hire_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const params = [id, birth_date, first_name, last_name, gender, hire_date];
    db.query(sql, params, (err) => {
      if (err) {
        if (err.errno === 1062 || err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ error: `emp_no ${id} ya existe` });
        }
        return res.status(500).json({ error: 'DB error', detail: err.message });
      }
      res.status(201).set('Location', `/api/employees/${id}`).json({
        message: 'Empleado creado',
        emp_no: id,
        data: { emp_no: id, birth_date, first_name, last_name, gender, hire_date }
      });
    });
  };

  // Si mandan emp_no, úsalo; si no, MAX+1 (para prácticas)
  if (emp_no != null && emp_no !== '') {
    const id = Number(emp_no);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'emp_no debe ser entero positivo' });
    return doInsert(id);
  }
  db.query('SELECT COALESCE(MAX(emp_no), 0) AS max_id FROM employees', (e, rows) => {
    if (e) return res.status(500).json({ error: 'DB error', detail: e.message });
    const nextId = Number(rows[0].max_id) + 1;
    doInsert(nextId);
  });
});

// Hora local por lat/lon (usa timeapi.io)
// POST /api/time   { "latitude": 25.67, "longitude": -100.31 }
app.post('/api/time', async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'latitude y longitude deben ser números' });
    }
    const url = `https://timeapi.io/api/Time/current/coordinate?latitude=${latitude}&longitude=${longitude}`;
    const r = await fetch(url);
    if (!r.ok) return res.status(r.status).json({ error: 'Fallo consultando el servicio de hora' });
    const t = await r.json();
    res.json({ timezone: t.timeZone, date: t.date, time: t.time, dateTime: t.dateTime, utcOffset: t.utcOffset, raw: t });
  } catch (err) {
    console.error('Error /api/time:', err);
    res.status(500).json({ error: 'No se pudo obtener la hora' });
  }
});

// Silenciar ruido de DevTools y favicon 404 (opcional)
app.get('/.well-known/appspecific/com.chrome.devtools.json', (_req, res) => res.sendStatus(204));
app.get('/favicon.ico', (_req, res) => res.sendStatus(204));

// 404 JSON
app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada', path: req.originalUrl }));

// Start
app.listen(PORT, () => console.log(`🚀 http://localhost:${PORT}`));
