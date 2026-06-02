import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import TaskModal from './TaskModal.jsx';

const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function pad(n) { return String(n).padStart(2, '0'); }
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function startOfWeek(d) { return addDays(d, -d.getDay()); } // domingo

export default function Calendar({ toast }) {
  const [view, setView] = useState('month'); // month | week | day
  const [anchor, setAnchor] = useState(() => new Date());
  const [occByDate, setOccByDate] = useState({});
  const [selectedDate, setSelectedDate] = useState(null); // solo para el modal de día en vista Mes
  const [modal, setModal] = useState(null); // { initial?, defaultDate? }
  const [tasks, setTasks] = useState([]);

  const todayStr = useMemo(() => ymd(new Date()), []);

  // Rango de datos a pedir según la vista.
  const range = useMemo(() => {
    if (view === 'day') {
      const f = ymd(anchor);
      return { from: f, to: f, gridStart: new Date(anchor) };
    }
    if (view === 'week') {
      const ws = startOfWeek(anchor);
      return { from: ymd(ws), to: ymd(addDays(ws, 6)), gridStart: ws };
    }
    // month
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const gridStart = addDays(first, -first.getDay());
    const gridEnd = addDays(gridStart, 41);
    return { from: ymd(gridStart), to: ymd(gridEnd), gridStart };
  }, [view, anchor]);

  const load = useCallback(async () => {
    const { occurrences } = await api.get(`/api/occurrences?from=${range.from}&to=${range.to}`);
    const map = {};
    for (const o of occurrences) (map[o.date] ||= []).push(o);
    setOccByDate(map);
    const { tasks } = await api.get('/api/tasks');
    setTasks(tasks);
  }, [range.from, range.to]);

  useEffect(() => { load(); }, [load]);

  const monthCells = useMemo(() => {
    if (view !== 'month') return [];
    return Array.from({ length: 42 }, (_, i) => addDays(range.gridStart, i));
  }, [view, range.gridStart]);

  const weekDays = useMemo(() => {
    if (view !== 'week') return [];
    return Array.from({ length: 7 }, (_, i) => addDays(range.gridStart, i));
  }, [view, range.gridStart]);

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
    setAnchor((a) => {
      if (view === 'month') return new Date(a.getFullYear(), a.getMonth() + delta, 1);
      if (view === 'week') return addDays(a, delta * 7);
      return addDays(a, delta);
    });
  };

  const goToday = () => setAnchor(new Date());

  // Al hacer clic en un día (vista Mes/Semana) saltamos a la vista Día de esa fecha.
  const openDay = (dateStr) => {
    setAnchor(new Date(dateStr + 'T00:00:00'));
    setView('day');
  };

  const title = useMemo(() => {
    if (view === 'day') {
      return anchor.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    if (view === 'week') {
      const ws = startOfWeek(anchor);
      const we = addDays(ws, 6);
      const sameMonth = ws.getMonth() === we.getMonth();
      const a = ws.toLocaleDateString('es', { day: 'numeric', month: sameMonth ? undefined : 'short' });
      const b = we.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
      return `${a} – ${b}`;
    }
    return `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;
  }, [view, anchor]);

  // Fila de ocurrencia reutilizable (vista Semana/Día y modal).
  const OccRow = ({ o }) => (
    <div className="occ-row" style={{ borderLeftColor: o.color }}>
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
  );

  const selectedOccs = selectedDate ? (occByDate[selectedDate] || []) : null;
  const defaultAddDate = view === 'month' ? (selectedDate || todayStr) : ymd(anchor);

  return (
    <div>
      <div className="cal-toolbar">
        <button className="icon-btn" onClick={() => move(-1)} title="Anterior">‹</button>
        <div className="cal-title">{title}</div>
        <button className="icon-btn" onClick={() => move(1)} title="Siguiente">›</button>
        <button className="btn-ghost" onClick={goToday}>Hoy</button>

        <div className="view-switch">
          {[['month', 'Mes'], ['week', 'Semana'], ['day', 'Día']].map(([v, label]) => (
            <button key={v} className={'view-tab' + (view === v ? ' active' : '')} onClick={() => setView(v)}>{label}</button>
          ))}
        </div>

        <div className="spacer" />
        <button className="btn-primary" onClick={() => setModal({ defaultDate: defaultAddDate })}>+ Nueva tarea</button>
      </div>

      {/* ---------- Vista MES ---------- */}
      {view === 'month' && (
        <div className="cal-grid">
          {DOW.map((d) => <div className="cal-dow" key={d}>{d}</div>)}
          {monthCells.map((d) => {
            const key = ymd(d);
            const inMonth = d.getMonth() === anchor.getMonth();
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
      )}

      {/* ---------- Vista SEMANA ---------- */}
      {view === 'week' && (
        <div className="week-grid">
          {weekDays.map((d) => {
            const key = ymd(d);
            const occs = occByDate[key] || [];
            const isToday = key === todayStr;
            return (
              <div className={'week-col' + (isToday ? ' today' : '')} key={key}>
                <button className="week-col-head" onClick={() => openDay(key)} title="Ver el día">
                  <span className="week-dow">{DOW[d.getDay()]}</span>
                  <span className={'week-num' + (isToday ? ' today' : '')}>{d.getDate()}</span>
                </button>
                <div className="week-col-body">
                  {occs.length === 0 && <span className="week-empty">—</span>}
                  {occs.map((o, i) => (
                    <button
                      key={i}
                      className={'chip week-chip' + (o.status === 'done' ? ' done' : '')}
                      style={{ background: o.color }}
                      onClick={() => toggle(o)}
                      title={(o.status === 'done' ? 'Desmarcar' : 'Marcar como cumplida') + `: ${o.title}`}
                    >
                      <span className="dot">{o.status === 'done' ? '✓' : ''}</span>
                      {o.time ? o.time + ' ' : ''}{o.title}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---------- Vista DÍA ---------- */}
      {view === 'day' && (
        <div className="day-view">
          {(occByDate[ymd(anchor)] || []).length === 0 && (
            <div className="empty">No hay tareas este día. Pulsa “+ Nueva tarea” para agregar una.</div>
          )}
          <div className="day-list">
            {(occByDate[ymd(anchor)] || []).map((o, i) => <OccRow o={o} key={i} />)}
          </div>
        </div>
      )}

      {/* ---------- Modal de detalle de día (vista Mes) ---------- */}
      {selectedDate && (
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setSelectedDate(null)}>
          <div className="modal">
            <div className="modal-head">
              <h2 style={{ textTransform: 'capitalize' }}>
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h2>
              <div className="spacer" />
              <button className="btn-ghost" onClick={() => { openDay(selectedDate); setSelectedDate(null); }}>Ver día</button>
              <button className="btn-primary" onClick={() => setModal({ defaultDate: selectedDate })} style={{ marginLeft: '0.4rem' }}>+ Tarea</button>
              <button className="icon-btn" onClick={() => setSelectedDate(null)} style={{ marginLeft: '0.5rem' }}>✕</button>
            </div>
            <div className="modal-body">
              {selectedOccs.length === 0 && <p className="empty">No hay tareas este día.</p>}
              <div className="day-list">
                {selectedOccs.map((o, i) => <OccRow o={o} key={i} />)}
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
