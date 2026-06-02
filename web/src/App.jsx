import { useEffect, useState, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext.jsx';
import { useTheme } from './contexts/ThemeContext.jsx';
import { enablePush, notificationsGranted } from './push.js';
import Login from './components/Login.jsx';
import Calendar from './components/Calendar.jsx';
import History from './components/History.jsx';
import AdminPanel from './components/AdminPanel.jsx';

export default function App() {
  const { user, loading, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [tab, setTab] = useState('calendar');
  const [toastMsg, setToastMsg] = useState('');
  const [pushOn, setPushOn] = useState(false);

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  }, []);

  useEffect(() => { setPushOn(notificationsGranted()); }, [user]);

  const handlePush = async () => {
    const { ok, reason } = await enablePush();
    if (ok) { setPushOn(true); toast('Notificaciones activadas 🔔'); }
    else toast(reason);
  };

  if (loading) {
    return <div className="auth-wrap"><p className="muted">Cargando…</p></div>;
  }

  if (!user) return <Login />;

  return (
    <div>
      <header className="app-header">
        <div className="logo">
          <img src="/icon.svg" alt="" />
          <span>CronosApp</span>
        </div>

        <nav className="tabs" style={{ marginLeft: '0.6rem' }}>
          <button className={'tab' + (tab === 'calendar' ? ' active' : '')} onClick={() => setTab('calendar')}>📅 Calendario</button>
          <button className={'tab' + (tab === 'history' ? ' active' : '')} onClick={() => setTab('history')}>📜 Historial</button>
          {user.role === 'admin' && (
            <button className={'tab' + (tab === 'admin' ? ' active' : '')} onClick={() => setTab('admin')}>👥 Usuarios</button>
          )}
        </nav>

        <div className="spacer" />

        {!pushOn && (
          <button className="icon-btn" title="Activar notificaciones" onClick={handlePush}>🔔</button>
        )}
        <button className="icon-btn" onClick={toggle} title={theme === 'dark' ? 'Modo día' : 'Modo noche'}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button className="btn-ghost" onClick={logout} title={user.name}>Salir</button>
      </header>

      <main className="container">
        {tab === 'calendar' && <Calendar toast={toast} />}
        {tab === 'history' && <History />}
        {tab === 'admin' && user.role === 'admin' && <AdminPanel toast={toast} />}
      </main>

      {toastMsg && <div className="toast">{toastMsg}</div>}
    </div>
  );
}
