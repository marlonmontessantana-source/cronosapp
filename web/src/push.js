import { api } from './api.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/**
 * Pide permiso de notificaciones y suscribe al usuario al push.
 * Devuelve { ok, reason }.
 */
export async function enablePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'Tu navegador no soporta notificaciones push.' };
  }
  const { key, enabled } = await api.get('/api/push/vapidPublicKey');
  if (!enabled || !key) {
    return { ok: false, reason: 'Las notificaciones no están configuradas en el servidor.' };
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, reason: 'Permiso de notificaciones denegado.' };
  }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
  }
  await api.post('/api/push/subscribe', { subscription: sub });
  return { ok: true };
}

export function notificationsGranted() {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}
