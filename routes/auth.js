const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000
  };
}

router.get('/status', async (req, res) => {
  const r = await db.execute('SELECT COUNT(*) AS n FROM admin_users');
  res.json({ initialized: Number(r.rows[0].n) > 0 });
});

router.post('/setup', async (req, res) => {
  console.log('DIAG setup: 1 - début');
  const { username, password } = req.body;
  console.log('DIAG setup: 2 - body reçu', username);
  const existing = await db.execute('SELECT COUNT(*) AS n FROM admin_users');
  console.log('DIAG setup: 3 - requête DB faite');
  if (Number(existing.rows[0].n) > 0) {
    return res.status(403).json({ error: "Un compte administrateur existe déjà." });
  }
  if (!username || !password || password.length < 8) {
    return res.status(400).json({ error: 'Identifiant requis et mot de passe de 8 caractères minimum.' });
  }
  console.log('DIAG setup: 4 - avant bcrypt');
  const hash = bcrypt.hashSync(password, 10);
  console.log('DIAG setup: 5 - après bcrypt');
  await db.execute({
    sql: 'INSERT INTO admin_users (username, password_hash) VALUES (?, ?)',
    args: [username, hash]
  });
  console.log('DIAG setup: 6 - insertion DB faite');
  const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
  console.log('DIAG setup: 7 - token créé');
  res.cookie('admin_session', token, cookieOptions());
  console.log('DIAG setup: 8 - cookie posé, envoi réponse');
  res.json({ ok: true });
});

router.post('/login', async (req, res) => {
  console.log('DIAG login: 1 - début');
  const { username, password } = req.body;
  console.log('DIAG login: 2 - body reçu', username);
  const r = await db.execute({ sql: 'SELECT * FROM admin_users WHERE username = ?', args: [username] });
  console.log('DIAG login: 3 - requête DB faite');
  const user = r.rows[0];
  if (!user) {
    return res.status(401).json({ error: 'Identifiants invalides.' });
  }
  console.log('DIAG login: 4 - avant bcrypt');
  const valid = bcrypt.compareSync(password, user.password_hash);
  console.log('DIAG login: 5 - après bcrypt');
  if (!valid) {
    return res.status(401).json({ error: 'Identifiants invalides.' });
  }
  const token = jwt.sign({ username: user.username }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
  console.log('DIAG login: 6 - token créé');
  res.cookie('admin_session', token, cookieOptions());
  console.log('DIAG login: 7 - cookie posé, envoi réponse');
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  res.clearCookie('admin_session');
  res.json({ ok: true });
});

router.get('/me', requireAdmin, (req, res) => {
  res.json({ username: req.admin.username });
});

router.post('/change-password', requireAdmin, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const r = await db.execute({ sql: 'SELECT * FROM admin_users WHERE username = ?', args: [req.admin.username] });
  const user = r.rows[0];
  const valid = bcrypt.compareSync(currentPassword, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });
  }
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  await db.execute({
    sql: 'UPDATE admin_users SET password_hash = ? WHERE username = ?',
    args: [hash, req.admin.username]
  });
  res.json({ ok: true });
});

module.exports = router;
