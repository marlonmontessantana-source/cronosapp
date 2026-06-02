import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { registerAuthRoutes } from './auth.js';
import tasksRouter from './routes/tasks.js';
import occurrencesRouter from './routes/occurrences.js';
import adminRouter from './routes/admin.js';
import pushRouter from './routes/push.js';
import { startScheduler } from './scheduler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.set('trust proxy', 1); // detrás del proxy de Easypanel/Nginx
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// --- API ---
registerAuthRoutes(app);
app.use('/api/tasks', tasksRouter);
app.use('/api/occurrences', occurrencesRouter);
app.use('/api/admin', adminRouter);
app.use('/api/push', pushRouter);
app.get('/api/health', (req, res) => res.json({ ok: true }));

// --- Frontend estático (build de Vite) ---
const webDist = path.join(__dirname, '..', 'web', 'dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  // SPA fallback (no interceptar /api)
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) =>
    res.send('<h1>CronosApp API</h1><p>Frontend no compilado. Ejecuta <code>npm run build</code>.</p>')
  );
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[cronosapp] escuchando en puerto ${PORT}`);
  startScheduler();
});
