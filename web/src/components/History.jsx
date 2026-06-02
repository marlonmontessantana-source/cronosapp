import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function History() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/occurrences/history')
      .then(({ history }) => setHistory(history))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="muted">Cargando…</p>;
  if (!history.length) return <div className="empty">Aún no has completado tareas. ¡Empieza a chulear! ✓</div>;

  // Agrupar por día de cumplimiento
  const groups = {};
  for (const h of history) {
    const day = (h.completed_at || '').slice(0, 10);
    (groups[day] ||= []).push(h);
  }

  return (
    <div>
      <h2 className="section">Historial</h2>
      {Object.entries(groups).map(([day, items]) => (
        <div className="card" key={day}>
          <div className="muted" style={{ fontWeight: 700, marginBottom: '0.4rem', textTransform: 'capitalize' }}>
            {day ? new Date(day + 'T00:00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Sin fecha'}
          </div>
          {items.map((h) => (
            <div className="list-row" key={h.id}>
              <span className="occ-check done" style={{ background: h.color, borderColor: h.color }}>✓</span>
              <div className="occ-main">
                <div className="occ-title">{h.title}</div>
                <div className="occ-meta">
                  Programada el {new Date(h.occurrence_date + 'T00:00:00').toLocaleDateString('es')}
                  {h.time ? ` · ${h.time}` : ''}
                  {h.status === 'skipped' ? ' · omitida' : ''}
                </div>
              </div>
              <span className="muted">{new Date(h.completed_at + 'Z').toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
