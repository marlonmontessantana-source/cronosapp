import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login'); // login | register
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setOk('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        const data = await register(name, email, password);
        if (data.user?.status !== 'approved') {
          setOk(data.message);
          setMode('login');
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <div className="logo">
          <img src="/icon.svg" alt="" />
          CronosApp
        </div>
        <h1>{mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}</h1>
        <p className="sub">
          {mode === 'login'
            ? 'Accede a tu calendario de tareas.'
            : 'El primer registro será el administrador de la app.'}
        </p>

        {error && <div className="msg error">{error}</div>}
        {ok && <div className="msg ok">{ok}</div>}

        {mode === 'register' && (
          <div className="field">
            <label>Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" required />
          </div>
        )}
        <div className="field">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tucorreo@ejemplo.com"
            required
          />
        </div>
        <div className="field">
          <label>Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            required
          />
        </div>

        <button className="btn-primary" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Procesando…' : mode === 'login' ? 'Entrar' : 'Registrarme'}
        </button>

        <p className="sub" style={{ marginTop: '1.1rem', marginBottom: 0, textAlign: 'center' }}>
          {mode === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
          <button
            type="button"
            className="switch-link"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
              setOk('');
            }}
          >
            {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
          </button>
        </p>
      </form>
    </div>
  );
}
