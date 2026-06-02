import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import TaskModal from './TaskModal.jsx';

const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function pad(n) { return String(n).padStart(2, '0'); }
function ymd(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }

export default function Calendar({ toast }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [occByDate, setOccByDate] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [modal, setModal] = useState(null); // { initial?, defaultDate? }
  const [tasks, setTasks] = useState([]);

  const todayStr = useMemo(() => { const d = new Date(); return ymd(d.getFullYear(), d.getMonth(), d.getDate()); }, []);

  const range = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const startDow = first.getDay();
    const gridStart = new Date(cursor.y, cursor.m, 1 - startDow);
    const gridEnd = new Date(gridStart);
    gridEnd.setDate(gridEnd.getDate() + 41); // 6 semanas
    const f = ymd(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate());
    const t = ymd(gridEnd.getFullYear(), gridEnd.getMonth(), gridEnd.getDate());
    return { gridStart, from: f, to: t };
  }, [cursor]);

  const load = useCallback(async () => {
    const { occurrences } = await api.get(`/api/occurrences?from=${range.from}&to=${range.to}`);
    const map = {};
    for (const o of occurrences) {
      (map[o.date] ||= []).push(o);
    }
    setOccByDate(map);
    const { tasks } = await api.get('/api/tasks');
    setTasks(tasks);
  }, [range.from, range.to]);

  useEffect(() => { load(); }, [load]);

  const cells = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(range.gridStart);
      d.setDate(d.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [range.gridStart]);

  const toggle = async (occ) => {
    try {
      if (occ.status === 'done') {
        await api.post('/api/occurrences/uncomplete', { task_id: occ.task_id, date: occ.date });
      } else {
        await api.post('/api/occurrences/complete', { task_id: occ.task_id, date: occ.date });
        toast('Tarea completada ✓');
      }
      await load();
    } catch (e) {
      toast(e.message);
    }
  };

  const editTaskOfOcc = (occ) => {
    const t = tasks.find((x) => x.id === occ.task_id);
    if (t) setModal({ initial: t });
  };

  const deleteOcc = async (occ) => {
    if (!confirm(`¿Eliminar la tarea "${occ.title}"? Se borrarán todas sus repeticiones.`)) return;
    await api.del(`/api/tasks/${occ.task_id}`);
    setSelectedDate(null);
    await load();
    toast('Tarea eliminada');
  };

  const move = (delta) => {
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  const selectedOccs = selectedDate ? (occByDate[selectedDate] || []) : null;

  return (
    <div>
      <div className="cal-toolbar">
        <button className="icon-btn" onClick={() => move(-1)}>‹</button>
        <div className="cal-title">{MONTHS[cursor.m]} {cursor.y}</div>
        <button className="icon-btn" onClick={() => move(1)}>›</button>
        <button className="btn-ghost" onClick={() => { const d = new Date(); setCursor({ y: d.getFullYear(), m: d.getMonth() }); }}>Hoy</button>
        <div className="spacer" />
        <button className="btn-primary" onClick={() => setModal({ defaultDate: selectedDate || todayStr })}>+ Nueva tarea</button>
      </div>

      <div className="cal-grid">
        {DOW.map((d) => <div className="cal-dow" key={d}>{d}</div>)}
        {cells.map((d) => {
          const key = ymd(d.getFullYear(), d.getMonth(), d.getDate());
          const inMonth = d.getMonth() === cursor.m;
          const occs = occByDate[key] || [];
          return (
            <div
              key={key}
              className={'cal-cell' + (inMonth ? '' : ' dim') + (key === todayStr ? ' today' : '')}
              onClick={() => setSelectedDate(key)}
            >
              <span className="cal-daynum">{d.getDate()}</span>
              {occs.slice(0, 3).map((o, i) => (
                <span key={i} className={'chip' + (o.status === 'done' ? ' done' : '')} style={{ background: o.color }}>
                  <span className="dot" />{o.time ? o.time + ' ' : ''}{o.title}
                </span>
              ))}
              {occs.length > 3 && <span className="muted" style={{ fontSize: '0.7rem' }}>+{occs.length - 3} más</span>}
            </div>
          );
        })}
      </div>

      {selectedDate && (
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setSelectedDate(null)}>
          <div className="modal">
            <div className="modal-head">
              <h2 style={{ textTransform: 'capitalize' }}>
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h2>
              <div className="spacer" />
              <button className="btn-primary" onClick={() => setModal({ defaultDate: selectedDate })}>+ Tarea</button>
              <button className="icon-btn" onClick={() => setSelectedDate(null)} style={{ marginLeft: '0.5rem' }}>✕</button>
            </div>
            <div className="modal-body">
              {selectedOccs.length === 0 && <p className="empty">No hay tareas este día.</p>}
              <div className="day-list">
                {selectedOccs.map((o, i) => (
                  <div className="occ-row" key={i} style={{ borderLeftColor: o.color }}>
                    <button className={'occ-check' + (o.status === 'done' ? ' done' : '')} onClick={() => toggle(o)} title="Marcar como cumplida">
                      {o.status === 'done' ? '✓' : ''}
                    </button>
                    <div className="occ-main">
                      <div className={'occ-title' + (o.status === 'done' ? ' done' : '')}>{o.title}</div>
                      <div className="occ-meta">
                        {o.time ? `🕐 ${o.time}` : 'Todo el día'}
                        {o.recurrence_type !== 'none' && ' · 🔁 se repite'}
                        {o.description ? ` · ${o.description}` : ''}
                      </div>
                    </div>
                    <button className="icon-btn" title="Editar" onClick={() => editTaskOfOcc(o)}>✎</button>
                    <button className="icon-btn" title="Eliminar" onClick={() => deleteOcc(o)}>🗑</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <TaskModal
          initial={modal.initial}
          defaultDate={modal.defaultDate}
          onClose={() => setModal(null)}
          onSaved={async () => { setModal(null); await load(); toast('Tarea guardada ✓'); }}
        />
      )}
    </div>
  );
}
