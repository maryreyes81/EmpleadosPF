// src/routes/auth.routes.js
import { Router } from 'express';
import { pool } from '../db.js';
import bcrypt from 'bcryptjs';

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Auth
 *     description: Autenticación de usuarios
 * components:
 *   schemas:
 *     AuthLoginRequest:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: "mary.reyes@empresa.com"
 *         password:
 *           type: string
 *           example: "123456"
 *     AuthUser:
 *       type: object
 *       properties:
 *         emp_no:
 *           type: integer
 *           example: 10001
 *         email:
 *           type: string
 *           format: email
 *           example: "mary.reyes@empresa.com"
 *         name:
 *           type: string
 *           example: "Mary Reyes"
 *     AuthLoginResponse:
 *       type: object
 *       properties:
 *         ok:
 *           type: boolean
 *           example: true
 *         user:
 *           $ref: '#/components/schemas/AuthUser'
 *     AuthErrorResponse:
 *       type: object
 *       properties:
 *         ok:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *           example: "Credenciales inválidas"
 */

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Iniciar sesión
 *     description: Verifica credenciales en `employee_auth` y devuelve datos básicos del usuario.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthLoginRequest'
 *     responses:
 *       200:
 *         description: Login correcto
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthLoginResponse'
 *       400:
 *         description: Faltan campos requeridos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthErrorResponse'
 *       401:
 *         description: Credenciales inválidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthErrorResponse'
 *       403:
 *         description: Acceso deshabilitado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthErrorResponse'
 *       500:
 *         description: Error del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthErrorResponse'
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'email y password son requeridos' });
    }

    // Busca el usuario en employee_auth y su nombre en employees
    const sql = `
      SELECT ea.emp_no, ea.email, ea.password_hash, ea.access,
             e.first_name, e.last_name
      FROM employee_auth ea
      JOIN employees e ON e.emp_no = ea.emp_no
      WHERE ea.email = ?
      LIMIT 1
    `;
    const [rows] = await pool.query(sql, [String(email).toLowerCase()]);
    if (!rows.length) {
      return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
    }

    const u = rows[0];
    if (u.access !== 'Y') {
      return res.status(403).json({ ok: false, error: 'Acceso deshabilitado' });
    }

    // Soporte hash bcrypt o texto plano legado
    let valid = false;
    const hash = String(u.password_hash || '');
    if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
      valid = await bcrypt.compare(password, hash);
    } else {
      valid = (password === hash);
    }

    if (!valid) {
      return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
    }

    // OK
    return res.json({
      ok: true,
      user: {
        emp_no: u.emp_no,
        email: u.email,
        name: `${u.first_name} ${u.last_name}`,
      },
    });
  } catch (err) {
    console.error('POST /api/auth/login error:', err);
    res.status(500).json({ ok: false, error: 'Error del servidor' });
  }
});

export default router;
