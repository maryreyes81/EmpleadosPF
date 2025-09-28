// src/server.js
import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger/swagger.js';

import employeesRouter from './routes/employees.routes.js';
import authRouter from './routes/auth.routes.js';
import { ping } from './db.js'; 

dotenv.config();

// Instancia de Express
const app = express();
app.disable('etag');

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Middlewares
app.use(express.json());
app.use(morgan('dev'));

// CORS (en prod, restringe origin)
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
  })
);

// __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Archivos estáticos (frontend en ./public)
app.use(express.static(path.join(__dirname, 'public')));

// Rutas API
app.use('/api/auth', authRouter);
app.use('/api/employees', employeesRouter);

// Swagger UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Healthcheck
app.get('/health', async (_req, res) => {
  try {
    const ok = await ping();
    res.json({ status: 'ok', db: ok ? 'up' : 'down' });
  } catch {
    res.status(500).json({ status: 'error' });
  }
});

// 404 para cualquier cosa bajo /api que no exista
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
  console.log(`Swagger UI en             http://localhost:${PORT}/docs`);
});


// POST /api/time   { "latitude": 25.67, "longitude": -100.31 }
app.post('/api/time', async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'latitude y longitude deben ser números' });
    }
    const url = `https://timeapi.io/api/Time/current/coordinate?latitude=${latitude}&longitude=${longitude}`;
    const r = await fetch(url); // Node 18+ tiene fetch global
    if (!r.ok) return res.status(r.status).json({ error: 'Fallo consultando el servicio de hora' });
    const t = await r.json();
    res.json({ timezone: t.timeZone, date: t.date, time: t.time, dateTime: t.dateTime, utcOffset: t.utcOffset, raw: t });
  } catch (err) {
    console.error('Error /api/time:', err);
    res.status(500).json({ error: 'No se pudo obtener la hora' });
  }
});

// (Opcional) Silenciar ruido de DevTools y favicon 404
app.get('/.well-known/appspecific/com.chrome.devtools.json', (_req, res) => res.sendStatus(204));
app.get('/favicon.ico', (_req, res) => res.sendStatus(204));