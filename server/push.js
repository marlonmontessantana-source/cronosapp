import webpush from 'web-push';
import db from './db.js';

const PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@cronosapp.vetacreativa.co';

export const pushEnabled = Boolean(PUBLIC && PRIVATE);

if (pushEnabled) {
  webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
} else {
  console.warn('[push] VAPID keys no configuradas: las notificaciones push están desactivadas.');
}

export function getPublicKey() {
  return PUBLIC;
}

export function saveSubscription(userId, subscription) {
  db.prepare(
    `INSERT INTO push_subscriptions (user_id, endpoint, subscription_json)
     VALUES (?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, subscription_json = excluded.subscription_json`
  ).run(userId, subscription.endpoint, JSON.stringify(subscription));
}

export async function sendToUser(userId, payload) {
  if (!pushEnabled) return;
  const subs = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId);
  for (const row of subs) {
    try {
      await webpush.sendNotification(JSON.parse(row.subscription_json), JSON.stringify(payload));
    } catch (err) {
      // Suscripción caducada o inválida → eliminar.
      if (err.statusCode === 404 || err.statusCode === 410) {
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(row.id);
      } else {
        console.error('[push] error enviando notificación:', err.statusCode || err.message);
      }
    }
  }
}
