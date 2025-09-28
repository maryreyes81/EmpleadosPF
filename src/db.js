// src/db.js
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Carga .env (opcional). Si no hay DB_PASSWORD, usaremos el hardcoded.
dotenv.config({
  path: path.resolve(__dirname, '../.env'),
  override: true,
});

import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  // ← hardcoded fallback
  password: process.env.DB_PASSWORD ?? 'Mandarina8127!',
  database: process.env.DB_NAME || 'employees',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONN_LIMIT || 10),
  queueLimit: 0,
  dateStrings: true,
  supportBigNumbers: true,
  bigNumberStrings: true,
  // namedPlaceholders: true,
});

// Smoke test
try {
  const conn = await pool.getConnection();
  console.log('✅ MySQL pool OK →', {
    host: process.env.DB_HOST || 'localhost',
    db: process.env.DB_NAME || 'employees',
    user: process.env.DB_USER || 'root',
    hasPwdEnv: Boolean(process.env.DB_PASSWORD),
    usingHardcoded: !process.env.DB_PASSWORD,
  });
  conn.release();
} catch (err) {
  console.error('❌ MySQL pool ERROR:', err?.code || 'ERR', err?.message || err);
}

// Healthcheck DB
export async function ping() {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    return Number(rows?.[0]?.ok) === 1;
  } catch (e) {
    console.error('DB PING ERROR:', e?.code || e?.message || e);
    return false;
  }
}

// Helper de query (usa arrays)
export async function q(sql, params = []) {
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (err) {
    console.error('DB ERROR:', err?.code || 'ERR', err?.message || err, { sql, params });
    throw err;
  }
}

// Cierre ordenado
async function shutdown(signal) {
  try {
    console.log(`\n${signal} recibido. Cerrando pool MySQL…`);
    await pool.end();
    console.log('🟡 MySQL pool cerrado.');
  } catch (e) {
    console.error('Error cerrando pool:', e.message);
  } finally {
    process.exit(0);
  }
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
