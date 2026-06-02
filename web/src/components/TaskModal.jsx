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

function blank(date) {
  return {
    title: '', description: '', color: '#6366f1',
    start_date: date || todayYMD(), time: '',
    recurrence_type: 'none', recurrence_interval: 1,
    recurrence_weekdays: [], recurrence_end: '', reminder_minutes: 0,
  };
}

export default function TaskModal({ initial, defaultDate, onClose, onSaved }) {
  const [form, setForm] = useState(() => {
    if (initial) {
      return {
        ...initial,
        time: initial.time || '',
        recurrence_end: initial.recurrence_end || '',
        recurrence_weekdays: initial.recurrence_weekdays
          ? String(initial.recurrence_weekdays).split(',').filter(Boolean).map(Number)
          : [],
      };
    }
    return blank(defaultDate);
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [voiceNote, setVoiceNote] = useState('');

  useEffect(() => {
    const onEsc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

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
    setForm((f) => ({
      ...f,
      title: task.title || f.title,
      start_date: task.start_date || f.start_date,
      time: task.time || f.time,
      recurrence_type: task.recurrence_type || 'none',
      recurrence_interval: task.recurrence_interval || 1,
      recurrence_weekdays: task.recurrence_weekdays?.length ? task.recurrence_weekdays : f.recurrence_weekdays,
    }));
  };

  const save = async () => {
    setError('');
    if (!form.title.trim()) return setError('El título es obligatorio');
    setBusy(true);
    try {
      const payload = {
        ...form,
        time: form.time || null,
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

          <div className="row-2">
            <div>
              <label>Fecha de inicio</label>
              <input type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
            </div>
            <div>
              <label>Hora (opcional)</label>
              <input type="time" value={form.time} onChange={(e) => set('time', e.target.value)} />
            </div>
          </div>

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
