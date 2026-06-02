import cron from 'node-cron';
import db from './db.js';
import { expandOccurrences } from './recurrence.js';
import { sendToUser, pushEnabled } from './push.js';

// Cada minuto: busca ocurrencias cuya hora de recordatorio cae en el minuto actual
// (hora local del servidor) y envía push una sola vez (sent_reminders).
function tick() {
  if (!pushEnabled) return;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;

  const tasks = db
    .prepare("SELECT * FROM tasks WHERE active = 1 AND reminder_minutes > 0 AND time IS NOT NULL AND time != ''")
    .all();

  for (const task of tasks) {
    // Considera hoy y ayer (por si el recordatorio cruza medianoche con anticipación grande).
    const dates = expandOccurrences(task, dayOffset(today, -1), today);
    for (const date of dates) {
      const [hh, mm] = task.time.split(':').map(Number);
      const occ = new Date(`${date}T00:00:00`);
      occ.setHours(hh, mm, 0, 0);
      const remindAt = new Date(occ.getTime() - task.reminder_minutes * 60000);
      // ¿El recordatorio cae dentro del minuto actual?
      if (
        remindAt.getFullYear() === now.getFullYear() &&
        remindAt.getMonth() === now.getMonth() &&
        remindAt.getDate() === now.getDate() &&
        remindAt.getHours() === now.getHours() &&
        remindAt.getMinutes() === now.getMinutes()
      ) {
        const already = db
          .prepare('SELECT 1 FROM sent_reminders WHERE task_id = ? AND occurrence_date = ?')
          .get(task.id, date);
        // No recordar tareas ya completadas.
        const done = db
          .prepare("SELECT 1 FROM completions WHERE task_id = ? AND occurrence_date = ? AND status = 'done'")
          .get(task.id, date);
        if (already || done) continue;
        db.prepare('INSERT OR IGNORE INTO sent_reminders (task_id, occurrence_date) VALUES (?, ?)').run(
          task.id,
          date
        );
        sendToUser(task.user_id, {
          title: `⏰ ${task.title}`,
          body: task.reminder_minutes >= 60
            ? `Programada para las ${task.time}`
            : `En ${task.reminder_minutes} min (${task.time})`,
          url: '/',
        });
      }
    }
  }
}

function dayOffset(ymd, n) {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function startScheduler() {
  if (!pushEnabled) return;
  cron.schedule('* * * * *', () => {
    try {
      tick();
    } catch (err) {
      console.error('[scheduler] error:', err.message);
    }
  });
  console.log('[scheduler] recordatorios activos (cada minuto).');
}
