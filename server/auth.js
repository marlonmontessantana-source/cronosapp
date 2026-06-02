import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
const COOKIE_NAME = 'cronos_token';
const isProd = process.env.NODE_ENV === 'production';

function setAuthCookie(res, user) {
  const token = jwt.sign(
    { id: user.id, role: user.role, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, status: u.status };
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
    if (!user || user.status !== 'approved') {
      return res.status(401).json({ error: 'Sesión inválida' });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Solo administradores' });
  next();
}

export function registerAuthRoutes(app) {
  app.post('/api/auth/register', async (req, res) => {
    const { email, password, name } = req.body || {};
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    const normEmail = String(email).trim().toLowerCase();
    const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(normEmail);
    if (exists) return res.status(409).json({ error: 'Ese email ya está registrado' });

    const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
    const isFirst = count === 0;
    const role = isFirst ? 'admin' : 'user';
    const status = isFirst ? 'approved' : 'pending';
    const hash = await bcrypt.hash(String(password), 10);

    const info = db
      .prepare('INSERT INTO users (email, password_hash, name, role, status) VALUES (?, ?, ?, ?, ?)')
      .run(normEmail, hash, String(name).trim(), role, status);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);

    if (status === 'approved') {
      setAuthCookie(res, user);
      return res.json({ user: publicUser(user), message: 'Cuenta de administrador creada' });
    }
    return res.json({
      user: publicUser(user),
      message: 'Cuenta creada. Un administrador debe aprobarte antes de iniciar sesión.',
    });
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña obligatorios' });
    const normEmail = String(email).trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normEmail);
    if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });
    const ok = await bcrypt.compare(String(password), user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas' });
    if (user.status === 'pending') {
      return res.status(403).json({ error: 'Tu cuenta está pendiente de aprobación por un administrador' });
    }
    if (user.status === 'rejected') {
      return res.status(403).json({ error: 'Tu cuenta fue rechazada' });
    }
    setAuthCookie(res, user);
    res.json({ user: publicUser(user) });
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ user: publicUser(req.user) });
  });
}
