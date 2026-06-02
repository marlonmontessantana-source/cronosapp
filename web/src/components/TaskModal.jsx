import { useEffect, useState } from 'react';
import { api } from '../api.js';
import VoiceButton from './VoiceButton.jsx';

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6'];
const WEEKDAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

const REMINDER_OPTIONS = [
  [0, 'Sin recordatorio'],
  [5, '5 minutos antes'],
  [15, '15 minutos antes'],
  [30, '30 minutos antes'],
  [60, '1 hora antes'],
  [1440, '1 día antes'],
];

function todayYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Suma minutos a una hora 'HH:MM' (tope 23:59 dentro del mismo día).
function addMinutes(hhmm, minutes) {
  if (!/^\d{2}:\d{2}$/.test(hhmm || '')) return '';
  const [h, m] = hhmm.split(':').map(Number);
  let total = Math.min(h * 60 + m + minutes, 24 * 60 - 1);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function blank(date) {
  return {
    title: '', description: '', color: '#6366f1',
    start_date: date || todayYMD(), time: '09:00', end_time: '10:00',
    recurrence_type: 'none', recurrence_interval: 1,
    recurrence_weekdays: [], recurrence_end: '', reminder_minutes: 0,
  };
}

export default function TaskModal({ initial, defaultDate, prefill, voiceTranscript, onClose, onSaved }) {
  const [form, setForm] = useState(() => {
    if (initial) {
      return {
        ...initial,
        time: initial.time || '09:00',
        end_time: initial.end_time || addMinutes(initial.time || '09:00', 60),
        recurrence_end: initial.recurrence_end || '',
        recurrence_weekdays: initial.recurrence_weekdays
          ? String(initial.recurrence_weekdays).split(',').filter(Boolean).map(Number)
          : [],
      };
    }
    const base = blank(defaultDate);
    if (prefill) {
      const time = prefill.time || base.time;
      return {
        ...base,
        title: prefill.title || '',
        start_date: prefill.start_date || base.start_date,
        time,
        end_time: addMinutes(time, 60),
        recurrence_type: prefill.recurrence_type || 'none',
        recurrence_interval: prefill.recurrence_interval || 1,
        recurrence_weekdays: prefill.recurrence_weekdays || [],
      };
    }
    return base;
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [voiceNote, setVoiceNote] = useState(voiceTranscript ? `🎙️ "${voiceTranscript}"` : '');

  useEffect(() => {
    const onEsc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Al cambiar la hora de inicio, la de fin se reajusta para mantener 1 hora de duración.
  const setStart = (v) => setForm((f) => ({ ...f, time: v, end_time: addMinutes(v, 60) || f.end_time }));

  const toggleWeekday = (d) => {
    setForm((f) => {
      const has = f.recurrence_weekdays.includes(d);
      return {
        ...f,
        recurrence_weekdays: has
          ? f.recurrence_weekdays.filter((x) => x !== d)
          : [...f.recurrence_weekdays, d].sort(),
      };
    });
  };

  const applyVoice = (task, transcript) => {
    setVoiceNote(`🎙️ "${transcript}"`);
    setForm((f) => {
      const time = task.time || f.time;
      return {
        ...f,
        title: task.title || f.title,
        start_date: task.start_date || f.start_date,
        time,
        end_time: task.time ? addMinutes(time, 60) : f.end_time,
        recurrence_type: task.recurrence_type || 'none',
        recurrence_interval: task.recurrence_interval || 1,
        recurrence_weekdays: task.recurrence_weekdays?.length ? task.recurrence_weekdays : f.recurrence_weekdays,
      };
    });
  };

  const save = async () => {
    setError('');
    if (!form.title.trim()) return setError('El título es obligatorio');
    if (!/^\d{2}:\d{2}$/.test(form.time)) return setError('La hora de inicio es obligatoria');
    if (!/^\d{2}:\d{2}$/.test(form.end_time)) return setError('La hora de fin es obligatoria');
    setBusy(true);
    try {
      const payload = {
        ...form,
        recurrence_end: form.recurrence_end || null,
        recurrence_weekdays: form.recurrence_weekdays,
      };
      if (initial?.id) await api.put(`/api/tasks/${initial.id}`, payload);
      else await api.post('/api/tasks', payload);
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <h2>{initial?.id ? 'Editar tarea' : 'Nueva tarea'}</h2>
          <div className="spacer" />
          <VoiceButton onResult={applyVoice} onError={setError} />
          <button className="icon-btn" onClick={onClose} style={{ marginLeft: '0.5rem' }}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="msg error">{error}</div>}
          {voiceNote && <div className="msg ok">{voiceNote}</div>}

          <div>
            <label>Título</label>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Ej: Tomar medicamento"
            />
          </div>

          <div>
            <label>Descripción (opcional)</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Notas adicionales"
            />
          </div>

          <div>
            <label>Fecha de inicio</label>
            <input type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} required />
          </div>

          <div className="row-2">
            <div>
              <label>Hora de inicio *</label>
              <input type="time" value={form.time} onChange={(e) => setStart(e.target.value)} required />
            </div>
            <div>
              <label>Hora de fin *</label>
              <input type="time" value={form.end_time} onChange={(e) => set('end_time', e.target.value)} required />
            </div>
          </div>
          <p className="muted" style={{ marginTop: '-0.4rem' }}>Por defecto las tareas duran 1 hora; ajústalo si lo necesitas.</p>

          <div>
            <label>Repetición</label>
            <select value={form.recurrence_type} onChange={(e) => set('recurrence_type', e.target.value)}>
              <option value="none">No se repite</option>
              <option value="daily">Diariamente</option>
              <option value="weekly">Semanalmente</option>
              <option value="monthly">Mensualmente</option>
            </select>
          </div>

          {form.recurrence_type !== 'none' && (
            <div className="row-2">
              <div>
                <label>Cada</label>
                <input
                  type="number"
                  min="1"
                  value={form.recurrence_interval}
                  onChange={(e) => set('recurrence_interval', Math.max(1, parseInt(e.target.value, 10) || 1))}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <span className="muted">
                  {form.recurrence_type === 'daily' && 'día(s)'}
                  {form.recurrence_type === 'weekly' && 'semana(s)'}
                  {form.recurrence_type === 'monthly' && 'mes(es)'}
                </span>
              </div>
            </div>
          )}

          {form.recurrence_type === 'weekly' && (
            <div>
              <label>Días de la semana</label>
              <div className="weekday-picker">
                {WEEKDAY_LABELS.map((lbl, i) => (
                  <button
                    type="button"
                    key={i}
                    className={form.recurrence_weekdays.includes(i) ? 'on' : ''}
                    onClick={() => toggleWeekday(i)}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          )}

          {form.recurrence_type !== 'none' && (
            <div>
              <label>Finaliza (opcional)</label>
              <input type="date" value={form.recurrence_end} onChange={(e) => set('recurrence_end', e.target.value)} />
            </div>
          )}

          <div>
            <label>Recordatorio</label>
            <select
              value={form.reminder_minutes}
              onChange={(e) => set('reminder_minutes', parseInt(e.target.value, 10))}
            >
              {REMINDER_OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            {form.reminder_minutes > 0 && !form.time && (
              <p className="muted" style={{ marginTop: '0.3rem' }}>Define una hora para activar el recordatorio.</p>
            )}
          </div>

          <div>
            <label>Color</label>
            <div className="color-picker">
              {COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={form.color === c ? 'on' : ''}
                  style={{ background: c }}
                  onClick={() => set('color', c)}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={save} disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
