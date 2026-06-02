import express from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';

const router = express.Router();
router.use(requireAuth);

const VALID_RECURRENCE = new Set(['none', 'daily', 'weekly', 'monthly']);

function sanitizeTask(body) {
  const t = {
    title: String(body.title || '').trim(),
    description: String(body.description || '').trim(),
    color: String(body.color || '#6366f1'),
    start_date: String(body.start_date || '').trim(),
    time: body.time ? String(body.time).trim() : null,
    recurrence_type: VALID_RECURRENCE.has(body.recurrence_type) ? body.recurrence_type : 'none',
    recurrence_interval: Math.max(1, parseInt(body.recurrence_interval, 10) || 1),
    recurrence_weekdays: Array.isArray(body.recurrence_weekdays)
      ? body.recurrence_weekdays.join(',')
      : String(body.recurrence_weekdays || ''),
    recurrence_end: body.recurrence_end ? String(body.recurrence_end).trim() : null,
    reminder_minutes: Math.max(0, parseInt(body.reminder_minutes, 10) || 0),
    active: body.active === false ? 0 : 1,
  };
  return t;
}

function validate(t) {
  if (!t.title) return 'El título es obligatorio';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.start_date)) return 'Fecha de inicio inválida';
  if (t.time && !/^\d{2}:\d{2}$/.test(t.time)) return 'Hora inválida';
  return null;
}

// Listar definiciones de tareas del usuario
router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.user.id);
  res.json({ tasks: rows });
});

// Crear
router.post('/', (req, res) => {
  const t = sanitizeTask(req.body || {});
  const err = validate(t);
  if (err) return res.status(400).json({ error: err });
  const info = db
    .prepare(
      `INSERT INTO tasks
       (user_id, title, description, color, start_date, time, recurrence_type,
        recurrence_interval, recurrence_weekdays, recurrence_end, reminder_minutes, active)
       VALUES (@user_id, @title, @description, @color, @start_date, @time, @recurrence_type,
        @recurrence_interval, @recurrence_weekdays, @recurrence_end, @reminder_minutes, @active)`
    )
    .run({ ...t, user_id: req.user.id });
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid);
  res.json({ task });
});

// Actualizar
router.put('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Tarea no encontrada' });
  const t = sanitizeTask({ ...existing, ...req.body });
  const err = validate(t);
  if (err) return res.status(400).json({ error: err });
  db.prepare(
    `UPDATE tasks SET title=@title, description=@description, color=@color, start_date=@start_date,
      time=@time, recurrence_type=@recurrence_type, recurrence_interval=@recurrence_interval,
      recurrence_weekdays=@recurrence_weekdays, recurrence_end=@recurrence_end,
      reminder_minutes=@reminder_minutes, active=@active
     WHERE id=@id AND user_id=@user_id`
  ).run({ ...t, id: existing.id, user_id: req.user.id });
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(existing.id);
  res.json({ task });
});

// Eliminar
router.delete('/:id', (req, res) => {
  const info = db
    .prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
  res.json({ ok: true });
});

export default router;
