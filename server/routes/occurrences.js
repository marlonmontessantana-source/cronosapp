import express from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';
import { expandOccurrences } from '../recurrence.js';

const router = express.Router();
router.use(requireAuth);

// Ocurrencias en un rango, cruzadas con sus completados.
// GET /api/occurrences?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', (req, res) => {
  const { from, to } = req.query;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(to || '')) {
    return res.status(400).json({ error: 'Parámetros from/to inválidos' });
  }
  const tasks = db
    .prepare('SELECT * FROM tasks WHERE user_id = ? AND active = 1')
    .all(req.user.id);

  const completions = db
    .prepare(
      'SELECT task_id, occurrence_date, status, completed_at FROM completions WHERE user_id = ? AND occurrence_date BETWEEN ? AND ?'
    )
    .all(req.user.id, from, to);
  const compMap = new Map();
  for (const c of completions) compMap.set(`${c.task_id}|${c.occurrence_date}`, c);

  const occurrences = [];
  for (const task of tasks) {
    const dates = expandOccurrences(task, from, to);
    for (const date of dates) {
      const c = compMap.get(`${task.id}|${date}`);
      occurrences.push({
        task_id: task.id,
        title: task.title,
        description: task.description,
        color: task.color,
        time: task.time,
        end_time: task.end_time,
        date,
        recurrence_type: task.recurrence_type,
        status: c ? c.status : 'pending',
        completed_at: c ? c.completed_at : null,
      });
    }
  }
  occurrences.sort((a, b) =>
    a.date === b.date ? (a.time || '').localeCompare(b.time || '') : a.date.localeCompare(b.date)
  );
  res.json({ occurrences });
});

// Marcar como cumplida ("chulear")
router.post('/complete', (req, res) => {
  const { task_id, date, status } = req.body || {};
  if (!task_id || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
    return res.status(400).json({ error: 'task_id y date son obligatorios' });
  }
  const task = db.prepare('SELECT id FROM tasks WHERE id = ? AND user_id = ?').get(task_id, req.user.id);
  if (!task) return res.status(404).json({ error: 'Tarea no encontrada' });
  const st = status === 'skipped' ? 'skipped' : 'done';
  db.prepare(
    `INSERT INTO completions (task_id, user_id, occurrence_date, status, completed_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(task_id, occurrence_date)
     DO UPDATE SET status = excluded.status, completed_at = datetime('now')`
  ).run(task_id, req.user.id, date, st);
  res.json({ ok: true, status: st });
});

// Deshacer chuleo
router.post('/uncomplete', (req, res) => {
  const { task_id, date } = req.body || {};
  if (!task_id || !date) return res.status(400).json({ error: 'task_id y date obligatorios' });
  db.prepare('DELETE FROM completions WHERE task_id = ? AND user_id = ? AND occurrence_date = ?').run(
    task_id,
    req.user.id,
    date
  );
  res.json({ ok: true });
});

// Historial: completados ordenados por fecha de cumplimiento descendente
router.get('/history', (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.id, c.task_id, c.occurrence_date, c.status, c.completed_at,
              t.title, t.color, t.time, t.end_time
       FROM completions c JOIN tasks t ON t.id = c.task_id
       WHERE c.user_id = ?
       ORDER BY c.completed_at DESC
       LIMIT 500`
    )
    .all(req.user.id);
  res.json({ history: rows });
});

export default router;
