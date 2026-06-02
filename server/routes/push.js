import express from 'express';
import { requireAuth } from '../auth.js';
import { getPublicKey, saveSubscription, pushEnabled, sendToUser } from '../push.js';

const router = express.Router();

router.get('/vapidPublicKey', (req, res) => {
  res.json({ key: getPublicKey(), enabled: pushEnabled });
});

router.post('/subscribe', requireAuth, (req, res) => {
  const sub = req.body?.subscription;
  if (!sub || !sub.endpoint) return res.status(400).json({ error: 'Suscripción inválida' });
  saveSubscription(req.user.id, sub);
  res.json({ ok: true });
});

// Notificación de prueba
router.post('/test', requireAuth, async (req, res) => {
  await sendToUser(req.user.id, {
    title: 'CronosApp',
    body: '¡Las notificaciones funcionan! 🎉',
  });
  res.json({ ok: true });
});

export default router;
