import express from 'express';
import db from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';

const router = express.Router();
router.use(requireAuth, requireAdmin);

// Listar todos los usuarios
router.get('/users', (req, res) => {
  const users = db
    .prepare('SELECT id, email, name, role, status, created_at FROM users ORDER BY created_at ASC')
    .all();
  res.json({ users });
});

function setStatus(req, res, status) {
  const id = Number(req.params.id);
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (target.role === 'admin') return res.status(400).json({ error: 'No se puede modificar a un administrador' });
  db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, id);
  res.json({ ok: true });
}

router.post('/users/:id/approve', (req, res) => setStatus(req, res, 'approved'));
router.post('/users/:id/reject', (req, res) => setStatus(req, res, 'rejected'));

router.delete('/users/:id', (req, res) => {
  const id = Number(req.params.id);
  const target = db.prepare('SELECT role FROM users WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (target.role === 'admin') return res.status(400).json({ error: 'No se puede eliminar a un administrador' });
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true });
});

export default router;
