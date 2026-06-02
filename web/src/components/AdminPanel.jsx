import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function AdminPanel({ toast }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => api.get('/api/admin/users').then(({ users }) => setUsers(users)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const act = async (id, action) => {
    try {
      if (action === 'delete') {
        if (!confirm('¿Eliminar este usuario y todos sus datos?')) return;
        await api.del(`/api/admin/users/${id}`);
      } else {
        await api.post(`/api/admin/users/${id}/${action}`);
      }
      await load();
      toast('Hecho ✓');
    } catch (e) {
      toast(e.message);
    }
  };

  if (loading) return <p className="muted">Cargando…</p>;

  const pending = users.filter((u) => u.status === 'pending');
  const others = users.filter((u) => u.status !== 'pending');

  return (
    <div>
      <h2 className="section">Administración de usuarios</h2>

      {pending.length > 0 && (
        <>
          <p className="muted" style={{ marginBottom: '0.5rem' }}>Solicitudes pendientes de aprobación</p>
          <div className="card">
            {pending.map((u) => (
              <div className="list-row" key={u.id}>
                <div className="occ-main">
                  <div className="occ-title">{u.name}</div>
                  <div className="occ-meta">{u.email}</div>
                </div>
                <span className="pill pending">Pendiente</span>
                <button className="btn-primary" onClick={() => act(u.id, 'approve')}>Aprobar</button>
                <button className="btn-danger" onClick={() => act(u.id, 'reject')}>Rechazar</button>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="muted" style={{ margin: '1rem 0 0.5rem' }}>Todos los usuarios</p>
      <div className="card">
        {others.map((u) => (
          <div className="list-row" key={u.id}>
            <div className="occ-main">
              <div className="occ-title">{u.name} {u.role === 'admin' && <span className="pill admin">Admin</span>}</div>
              <div className="occ-meta">{u.email}</div>
            </div>
            <span className={'pill ' + u.status}>{u.status === 'approved' ? 'Aprobado' : u.status === 'rejected' ? 'Rechazado' : u.status}</span>
            {u.role !== 'admin' && (
              <>
                {u.status === 'rejected' && <button className="btn-ghost" onClick={() => act(u.id, 'approve')}>Aprobar</button>}
                {u.status === 'approved' && <button className="btn-ghost" onClick={() => act(u.id, 'reject')}>Suspender</button>}
                <button className="btn-danger" onClick={() => act(u.id, 'delete')}>Eliminar</button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
