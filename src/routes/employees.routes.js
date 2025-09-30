// src/routes/employees.routes.js
import { Router } from 'express';
import { q } from '../db.js';

const router = Router();

/* =========================================================
   Middleware: desactivar caché en todas las respuestas del router
   ========================================================= */
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

/* =========================================================
   Helpers
   ========================================================= */
const ORDERABLE_EMP = new Set(['emp_no', 'first_name', 'last_name', 'gender', 'hire_date']);
const isTrue = (v) => v === '1' || v === 'true';
const reDate = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @openapi
 * components:
 *   schemas:
 *     Employee:
 *       type: object
 *       properties:
 *         emp_no:      { type: integer, example: 500001 }
 *         birth_date:  { type: string, format: date, example: "1990-05-10" }
 *         first_name:  { type: string, example: "Mary" }
 *         last_name:   { type: string, example: "Reyes" }
 *         gender:      { type: string, enum: [M, F], example: "F" }
 *         hire_date:   { type: string, format: date, example: "2020-01-15" }
 *     EmployeeCreate:
 *       type: object
 *       required: [birth_date, first_name, last_name, gender, hire_date]
 *       properties:
 *         birth_date:  { type: string, format: date, example: "1990-05-10" }
 *         first_name:  { type: string, example: "Mary" }
 *         last_name:   { type: string, example: "Reyes" }
 *         gender:      { type: string, enum: [M, F], example: "F" }
 *         hire_date:   { type: string, format: date, example: "2020-01-15" }
 */

/* =========================================================
   Handler común para listar empleados con filtros/paginación
   Usado por: GET /api/employees  y  GET /api/employees/find
   ========================================================= */
async function listEmployees(req, res) {
  try {
    let {
      first_name = '',
      last_name  = '',
      gender     = '',
      birth_date = '',
      hire_date  = '',
      limit      = '20',
      offset     = '0',
    } = req.query;

    // Validaciones básicas
    if (gender) {
      gender = String(gender).trim().toUpperCase();
      if (!['M', 'F'].includes(gender)) {
        return res.status(400).json({ error: 'gender debe ser M o F' });
      }
    }
    if (birth_date && !reDate.test(birth_date)) {
      return res.status(400).json({ error: 'birth_date debe ser YYYY-MM-DD' });
    }
    if (hire_date && !reDate.test(hire_date)) {
      return res.status(400).json({ error: 'hire_date debe ser YYYY-MM-DD' });
    }

    const lim = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const off = Math.max(parseInt(offset, 10) || 0, 0);

    // WHERE dinámico
    const where = [];
    const params = [];
    if (first_name) { where.push('e.first_name LIKE ?'); params.push(`%${first_name}%`); }
    if (last_name)  { where.push('e.last_name  LIKE ?'); params.push(`%${last_name }%`); }
    if (gender)     { where.push('e.gender = ?');        params.push(gender); }
    if (birth_date) { where.push('e.birth_date = ?');    params.push(birth_date); }
    if (hire_date)  { where.push('e.hire_date  = ?');    params.push(hire_date); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // total (para paginado)
    const [{ total }] = await q(
      `SELECT COUNT(*) AS total FROM employees e ${whereSql}`,
      params
    );

    // datos
    const rows = await q(
      `
      SELECT e.emp_no, e.first_name, e.last_name, e.gender, e.birth_date, e.hire_date
      FROM employees e
      ${whereSql}
      ORDER BY e.emp_no ASC
      LIMIT ? OFFSET ?
      `,
      [...params, lim, off]
    );

    // Header útil para el front
    res.set('X-Total-Count', String(total));
    return res.json({ rows, total, limit: lim, offset: off });
  } catch (err) {
    console.error('GET /api/employees (listEmployees) error:', err);
    return res.status(500).json({ error: 'Error al consultar empleados' });
  }
}

/* =========================================================
   GET /api/employees  (filtros + paginado)
   ========================================================= */
/**
 * @openapi
 * /api/employees:
 *   get:
 *     tags: [Employees]
 *     summary: Listar empleados con filtros y paginado
 *     parameters:
 *       - in: query
 *         name: first_name
 *         schema: { type: string }
 *       - in: query
 *         name: last_name
 *         schema: { type: string }
 *       - in: query
 *         name: gender
 *         schema: { type: string, enum: [M, F] }
 *       - in: query
 *         name: birth_date
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: hire_date
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, minimum: 0, default: 0 }
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/', listEmployees);

/* =========================================================
   Alias: GET /api/employees/find  (para compatibilidad con el front)
   ⚠️ Colocar ANTES de las rutas con parámetros /:emp_no
   ========================================================= */
router.get('/find', listEmployees);

/* =========================================================
   GET /api/employees/search?q=Geor&limit=20  (búsqueda rápida)
   ========================================================= */
/**
 * @openapi
 * /api/employees/search:
 *   get:
 *     tags: [Employees]
 *     summary: Búsqueda rápida por nombre/apellido
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200: { description: OK }
 *       400: { description: Falta parámetro q }
 */
router.get('/search', async (req, res) => {
  try {
    const qtext = (req.query.q || '').trim();
    let limit = parseInt(req.query.limit || '20', 10);
    limit = Number.isNaN(limit) ? 20 : Math.min(Math.max(limit, 1), 100);
    if (!qtext) return res.status(400).json({ error: 'Parámetro q requerido' });

    const like = `%${qtext}%`;
    const rows = await q(
      `
      SELECT e.emp_no, e.first_name, e.last_name, e.gender, e.hire_date
      FROM employees e
      WHERE e.first_name LIKE ?
         OR e.last_name  LIKE ?
         OR CONCAT(e.first_name,' ',e.last_name) LIKE ?
      ORDER BY e.emp_no
      LIMIT ?
      `,
      [like, like, like, limit]
    );
    return res.json(rows);
  } catch (err) {
    console.error('GET /api/employees/search error:', err);
    return res.status(500).json({ error: 'DB error' });
  }
});

/* =========================================================
   Catálogo de departamentos
   GET /api/employees/departments
   ========================================================= */
/**
 * @openapi
 * /api/employees/departments:
 *   get:
 *     tags: [Employees]
 *     summary: Catálogo de departamentos
 *     responses:
 *       200: { description: OK }
 */
router.get('/departments', async (_req, res) => {
  try {
    const rows = await q(
      'SELECT dept_no, dept_name FROM departments ORDER BY dept_name'
    );
    return res.json(rows);
  } catch (err) {
    console.error('GET /api/employees/departments error:', err);
    return res.status(500).json({ error: 'DB error' });
  }
});

/* =========================================================
   Empleados actuales por departamento (paginado)
   GET /api/employees/:dept_no/employees?limit=20&offset=0
   (colocado ANTES de /:emp_no para no colisionar)
   ========================================================= */
/**
 * @openapi
 * /api/employees/{dept_no}/employees:
 *   get:
 *     tags: [Employees]
 *     summary: Empleados actuales por departamento (paginado)
 *     parameters:
 *       - in: path
 *         name: dept_no
 *         required: true
 *         schema: { type: string, example: "d005" }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, minimum: 0, default: 0 }
 *     responses:
 *       200: { description: OK }
 *       400: { description: dept_no inválido }
 */
router.get('/:dept_no/employees', async (req, res) => {
  try {
    const dept_no = (req.params.dept_no || '').toString().trim().toUpperCase();
    if (!dept_no) return res.status(400).json({ error: 'dept_no inválido' });

    let limit = parseInt(req.query.limit || '20', 10);
    let offset = parseInt(req.query.offset || '0', 10);
    limit  = Number.isNaN(limit)  ? 20 : Math.min(Math.max(limit, 1), 100);
    offset = Number.isNaN(offset) ? 0  : Math.max(offset, 0);

    const rows = await q(
      `
      SELECT e.emp_no, e.first_name, e.last_name, e.gender, e.hire_date
      FROM employees e
      JOIN dept_emp de ON de.emp_no = e.emp_no
      WHERE de.dept_no = ?
        AND de.to_date = '9999-01-01'
      ORDER BY e.emp_no
      LIMIT ? OFFSET ?
      `,
      [dept_no, limit, offset]
    );

    return res.json(rows);
  } catch (err) {
    console.error('GET /api/employees/:dept_no/employees error:', err);
    return res.status(500).json({ error: 'DB error' });
  }
});

/* =========================================================
   Detalle simple
   GET /api/employees/10001
   ========================================================= */
/**
 * @openapi
 * /api/employees/{emp_no}:
 *   get:
 *     tags: [Employees]
 *     summary: Obtener empleado por ID
 *     parameters:
 *       - in: path
 *         name: emp_no
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 *       400: { description: emp_no inválido }
 *       404: { description: No encontrado }
 */
router.get('/:emp_no', async (req, res) => {
  try {
    const emp_no = Number(req.params.emp_no);
    if (!Number.isInteger(emp_no) || emp_no <= 0) {
      return res.status(400).json({ error: 'emp_no debe ser entero positivo' });
    }

    const rows = await q('SELECT * FROM employees WHERE emp_no = ?', [emp_no]);
    if (!rows.length) return res.status(404).json({ message: 'Empleado no encontrado' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('GET /api/employees/:emp_no error:', err);
    return res.status(500).json({ error: 'No se pudo obtener el empleado' });
  }
});

/* =========================================================
   Detalle extendido (salario/título/depto actuales)
   GET /api/employees/:emp_no/full
   ========================================================= */
/**
 * @openapi
 * /api/employees/{emp_no}/full:
 *   get:
 *     tags: [Employees]
 *     summary: Detalle extendido (salario/título/depto actuales)
 *     parameters:
 *       - in: path
 *         name: emp_no
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 *       400: { description: emp_no inválido }
 *       404: { description: No encontrado }
 */
router.get('/:emp_no/full', async (req, res) => {
  try {
    const emp_no = Number(req.params.emp_no);
    if (!Number.isInteger(emp_no) || emp_no <= 0) {
      return res.status(400).json({ error: 'emp_no debe ser entero positivo' });
    }

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
    const rows = await q(sql, [emp_no]);
    if (!rows.length) return res.status(404).json({ message: 'Empleado no encontrado' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('GET /api/employees/:emp_no/full error:', err);
    return res.status(500).json({ error: 'DB error' });
  }
});

/* =========================================================
   Salario (actual o historial)
   GET /api/employees/:emp_no/salary[?current=1]
   ========================================================= */
/**
 * @openapi
 * /api/employees/{emp_no}/salary:
 *   get:
 *     tags: [Employees]
 *     summary: Salario actual o historial
 *     parameters:
 *       - in: path
 *         name: emp_no
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: current
 *         schema: { type: string, enum: ["0","1","true","false"] }
 *     responses:
 *       200: { description: OK }
 *       400: { description: emp_no inválido }
 */
router.get('/:emp_no/salary', async (req, res) => {
  try {
    const emp_no = Number(req.params.emp_no);
    if (!Number.isInteger(emp_no) || emp_no <= 0) {
      return res.status(400).json({ error: 'emp_no debe ser entero positivo' });
    }
    const currentOnly = isTrue(req.query.current);

    let sql = `
      SELECT salary, from_date, to_date
      FROM salaries
      WHERE emp_no = ?
    `;
    const params = [emp_no];
    if (currentOnly) sql += ` AND to_date = '9999-01-01'`;
    sql += ` ORDER BY from_date DESC LIMIT 100`;

    const rows = await q(sql, params);
    return res.json(currentOnly ? (rows[0] || null) : rows);
  } catch (err) {
    console.error('GET /api/employees/:emp_no/salary error:', err);
    return res.status(500).json({ error: 'DB error' });
  }
});

/* =========================================================
   Títulos (actual o historial)
   GET /api/employees/:emp_no/titles[?current=1]
   ========================================================= */
/**
 * @openapi
 * /api/employees/{emp_no}/titles:
 *   get:
 *     tags: [Employees]
 *     summary: Títulos (actual o historial)
 *     parameters:
 *       - in: path
 *         name: emp_no
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: current
 *         schema: { type: string, enum: ["0","1","true","false"] }
 *     responses:
 *       200: { description: OK }
 *       400: { description: emp_no inválido }
 */
router.get('/:emp_no/titles', async (req, res) => {
  try {
    const emp_no = Number(req.params.emp_no);
    if (!Number.isInteger(emp_no) || emp_no <= 0) {
      return res.status(400).json({ error: 'emp_no debe ser entero positivo' });
    }
    const currentOnly = isTrue(req.query.current);

    let sql = `
      SELECT title, from_date, to_date
      FROM titles
      WHERE emp_no = ?
    `;
    const params = [emp_no];
    if (currentOnly) sql += ` AND to_date = '9999-01-01'`;
    sql += ` ORDER BY from_date DESC LIMIT 100`;

    const rows = await q(sql, params);
    return res.json(currentOnly ? (rows[0] || null) : rows);
  } catch (err) {
    console.error('GET /api/employees/:emp_no/titles error:', err);
    return res.status(500).json({ error: 'DB error' });
  }
});

/* =========================================================
   Departamentos del empleado (actual o historial)
   GET /api/employees/:emp_no/departments[?current=1]
   ========================================================= */
/**
 * @openapi
 * /api/employees/{emp_no}/departments:
 *   get:
 *     tags: [Employees]
 *     summary: Departamentos del empleado (actual o historial)
 *     parameters:
 *       - in: path
 *         name: emp_no
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: current
 *         schema: { type: string, enum: ["0","1","true","false"] }
 *     responses:
 *       200: { description: OK }
 *       400: { description: emp_no inválido }
 */
router.get('/:emp_no/departments', async (req, res) => {
  try {
    const emp_no = Number(req.params.emp_no);
    if (!Number.isInteger(emp_no) || emp_no <= 0) {
      return res.status(400).json({ error: 'emp_no debe ser entero positivo' });
    }
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

    const rows = await q(sql, params);
    return res.json(rows);
  } catch (err) {
    console.error('GET /api/employees/:emp_no/departments error:', err);
    return res.status(500).json({ error: 'DB error' });
  }
});

/* =========================================================
   Alta de empleado (emp_no autogenerado: MAX+1)
   POST /api/employees
   Body: { birth_date, first_name, last_name, gender, hire_date }
   ========================================================= */
/**
 * @openapi
 * /api/employees:
 *   post:
 *     tags: [Employees]
 *     summary: Crear empleado
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmployeeCreate'
 *     responses:
 *       201:
 *         description: Creado
 *       400:
 *         description: Datos inválidos (formato o campos faltantes)
 *       409:
 *         description: Conflicto (emp_no duplicado)
 *       500:
 *         description: Error en DB
 */
router.post('/', async (req, res) => {
  try {
    let { birth_date, first_name, last_name, gender, hire_date } = req.body;

    // Normaliza y valida
    gender = (gender || '').toString().trim().toUpperCase();
    const REQUIRED = { birth_date, first_name, last_name, gender, hire_date };
    for (const [k, v] of Object.entries(REQUIRED)) {
      if (!v) return res.status(400).json({ error: `Falta el campo requerido: ${k}` });
    }
    if (!reDate.test(birth_date) || !reDate.test(hire_date)) {
      return res.status(400).json({ error: 'birth_date y hire_date deben ser YYYY-MM-DD' });
    }
    if (!['M', 'F'].includes(gender)) {
      return res.status(400).json({ error: 'gender debe ser "M" o "F"' });
    }

    // 1) Siguiente emp_no
    const [{ max_id }] = await q(
      'SELECT COALESCE(MAX(emp_no), 0) AS max_id FROM employees'
    );
    const nextId = Number(max_id) + 1;

    // 2) Insert
    await q(
      `
      INSERT INTO employees (emp_no, birth_date, first_name, last_name, gender, hire_date)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [nextId, birth_date, first_name, last_name, gender, hire_date]
    );

    // 3) Respuesta
    return res
      .status(201)
      .set('Location', `/api/employees/${nextId}`)
      .json({
        ok: true,
        message: 'Empleado creado',
        emp_no: nextId,
        data: { emp_no: nextId, birth_date, first_name, last_name, gender, hire_date },
      });

  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY' || err?.errno === 1062) {
      return res.status(409).json({ error: 'Conflicto de emp_no' });
    }
    console.error('POST /api/employees error:', err);
    return res.status(500).json({ error: 'DB error' });
  }
});

/* =========================================================
   Actualizar empleado
   PUT /api/employees/:emp_no
   Body: { birth_date, first_name, last_name, gender, hire_date }
   ========================================================= */
/**
 * @openapi
 * /api/employees/{emp_no}:
 *   put:
 *     tags: [Employees]
 *     summary: Actualizar empleado
 *     parameters:
 *       - in: path
 *         name: emp_no
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmployeeCreate'
 *     responses:
 *       200:
 *         description: Actualizado
 *       400:
 *         description: Datos inválidos
 *       404:
 *         description: Empleado no encontrado
 *       500:
 *         description: Error en DB
 */
router.put('/:emp_no', async (req, res) => {
  try {
    const emp_no = Number(req.params.emp_no);
    if (!Number.isInteger(emp_no) || emp_no <= 0) {
      return res.status(400).json({ error: 'emp_no debe ser entero positivo' });
    }

    let { birth_date, first_name, last_name, gender, hire_date } = req.body;

    // Validaciones mínimas
    if (!birth_date || !first_name || !last_name || !gender || !hire_date) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }
    if (!reDate.test(birth_date) || !reDate.test(hire_date)) {
      return res.status(400).json({ error: 'birth_date y hire_date deben ser YYYY-MM-DD' });
    }
    gender = String(gender).trim().toUpperCase();
    if (!['M', 'F'].includes(gender)) {
      return res.status(400).json({ error: 'gender debe ser "M" o "F"' });
    }

    // ¿Existe?
    const rows = await q('SELECT emp_no FROM employees WHERE emp_no = ?', [emp_no]);
    if (!rows.length) return res.status(404).json({ error: 'Empleado no encontrado' });

    // Update
    await q(
      `
      UPDATE employees
      SET birth_date = ?, first_name = ?, last_name = ?, gender = ?, hire_date = ?
      WHERE emp_no = ?
      `,
      [birth_date, first_name, last_name, gender, hire_date, emp_no]
    );

    // Devuelve el registro actualizado
    const [updated] = await q(
      'SELECT emp_no, birth_date, first_name, last_name, gender, hire_date FROM employees WHERE emp_no = ?',
      [emp_no]
    );
    return res.json({ ok: true, message: 'Empleado actualizado', data: updated });

  } catch (err) {
    console.error('PUT /api/employees/:emp_no error:', err);
    return res.status(500).json({ error: 'DB error' });
  }
});

/* =========================================================
   Eliminar empleado
   DELETE /api/employees/:emp_no
   ========================================================= */
/**
 * @openapi
 * /api/employees/{emp_no}:
 *   delete:
 *     tags: [Employees]
 *     summary: Eliminar empleado
 *     parameters:
 *       - in: path
 *         name: emp_no
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Eliminado }
 *       404: { description: Empleado no encontrado }
 *       409: { description: Tiene registros relacionados }
 *       500: { description: Error en DB }
 */
router.delete('/:emp_no', async (req, res) => {
  try {
    const emp_no = Number(req.params.emp_no);
    if (!Number.isInteger(emp_no) || emp_no <= 0) {
      return res.status(400).json({ error: 'emp_no debe ser entero positivo' });
    }

    // ¿Existe?
    const rows = await q('SELECT emp_no FROM employees WHERE emp_no = ?', [emp_no]);
    if (!rows.length) return res.status(404).json({ error: 'Empleado no encontrado' });

    // Si tienes FKs sin cascade, elimina primero hijos:
    // await q('DELETE FROM salaries  WHERE emp_no = ?', [emp_no]);
    // await q('DELETE FROM titles    WHERE emp_no = ?', [emp_no]);
    // await q('DELETE FROM dept_emp  WHERE emp_no = ?', [emp_no]);

    const result = await q('DELETE FROM employees WHERE emp_no = ?', [emp_no]);
    return res.json({ ok: true, deleted: 1 });

  } catch (err) {
    console.error('DELETE /api/employees/:emp_no error:', err);
    // Error típico de FK: ER_ROW_IS_REFERENCED_2
    if (err?.code === 'ER_ROW_IS_REFERENCED_2' || err?.errno === 1451) {
      return res.status(409).json({ error: 'No se puede eliminar: tiene registros relacionados' });
    }
    return res.status(500).json({ error: 'DB error' });
  }
});

export default router;
