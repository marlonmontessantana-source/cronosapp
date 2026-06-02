import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// La ruta de datos es configurable para apuntar a un volumen persistente en producción.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'cronosapp.db'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name          TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user',     -- 'admin' | 'user'
    status        TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    description         TEXT NOT NULL DEFAULT '',
    color               TEXT NOT NULL DEFAULT '#6366f1',
    start_date          TEXT NOT NULL,               -- 'YYYY-MM-DD'
    time                TEXT NOT NULL DEFAULT '09:00', -- 'HH:MM' hora de inicio (obligatoria)
    end_time            TEXT NOT NULL DEFAULT '10:00', -- 'HH:MM' hora de fin
    recurrence_type     TEXT NOT NULL DEFAULT 'none', -- none|daily|weekly|monthly
    recurrence_interval INTEGER NOT NULL DEFAULT 1,   -- cada N
    recurrence_weekdays TEXT NOT NULL DEFAULT '',     -- CSV 0-6 (0=domingo) para weekly
    recurrence_end      TEXT,                          -- 'YYYY-MM-DD' o null
    reminder_minutes    INTEGER NOT NULL DEFAULT 0,    -- 0 = sin recordatorio
    active              INTEGER NOT NULL DEFAULT 1,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS completions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id         INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    occurrence_date TEXT NOT NULL,                    -- 'YYYY-MM-DD'
    status          TEXT NOT NULL DEFAULT 'done',     -- done|skipped
    completed_at    TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(task_id, occurrence_date)
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint          TEXT NOT NULL UNIQUE,
    subscription_json TEXT NOT NULL,
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sent_reminders (
    task_id         INTEGER NOT NULL,
    occurrence_date TEXT NOT NULL,
    sent_at         TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (task_id, occurrence_date)
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
  CREATE INDEX IF NOT EXISTS idx_completions_user ON completions(user_id);
`);

// --- Migraciones para bases de datos existentes ---
const taskCols = db.prepare('PRAGMA table_info(tasks)').all().map((c) => c.name);
if (!taskCols.includes('end_time')) {
  db.exec("ALTER TABLE tasks ADD COLUMN end_time TEXT NOT NULL DEFAULT '10:00'");
}
// Toda tarea debe tener hora de inicio; rellenar las que vinieran sin hora ("todo el día").
db.exec("UPDATE tasks SET time = '09:00' WHERE time IS NULL OR time = ''");
// Hora de fin por defecto = inicio + 1 hora cuando falte.
db.exec("UPDATE tasks SET end_time = substr(time(time, '+1 hour'), 1, 5) WHERE end_time IS NULL OR end_time = ''");

export default db;
