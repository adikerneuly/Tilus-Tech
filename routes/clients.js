const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { requireClient } = require('../middleware/auth');

const router = express.Router();

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 jours
  };
}

function setClientSession(res, client) {
  const token = jwt.sign(
    { id: client.id, email: client.email, name: client.name },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
  res.cookie('client_session', token, cookieOptions());
}

// POST /api/clients/signup — création d'un compte client (nom, courriel, mot de passe)
router.post('/signup', async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !name.trim() || !email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Nom et courriel valide requis.' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Mot de passe de 8 caractères minimum requis.' });
  }
  const cleanEmail = email.trim().toLowerCase();
  const existing = await db.execute({ sql: 'SELECT id FROM clients WHERE email = ?', args: [cleanEmail] });
  if (existing.rows[0]) {
    return res.status(409).json({ error: 'Un compte existe déjà avec ce courriel. Connectez-vous plutôt.' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const result = await db.execute({
    sql: 'INSERT INTO clients (name, email, phone, password_hash) VALUES (?, ?, ?, ?)',
    args: [name.trim(), cleanEmail, (phone || '').trim(), hash]
  });
  const client = { id: result.lastInsertRowid, name: name.trim(), email: cleanEmail };
  setClientSession(res, client);
  res.status(201).json({ ok: true, client });
});

// POST /api/clients/login — connexion par courriel + mot de passe
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !isValidEmail(email) || !password) {
    return res.status(400).json({ error: 'Courriel et mot de passe requis.' });
  }
  const cleanEmail = email.trim().toLowerCase();
  const r = await db.execute({ sql: 'SELECT * FROM clients WHERE email = ?', args: [cleanEmail] });
  const client = r.rows[0];
  if (!client) {
    return res.status(404).json({ error: "Aucun compte trouvé avec ce courriel. Inscrivez-vous d'abord." });
  }
  const valid = bcrypt.compareSync(password, client.password_hash || '');
  if (!valid) {
    return res.status(401).json({ error: 'Identifiants invalides.' });
  }
  setClientSession(res, { id: client.id, name: client.name, email: client.email });
  res.json({ ok: true, client: { id: client.id, name: client.name, email: client.email, phone: client.phone } });
});

// POST /api/clients/logout
router.post('/logout', (req, res) => {
  res.clearCookie('client_session');
  res.json({ ok: true });
});

// GET /api/clients/me — vérifie la session courante
router.get('/me', requireClient, async (req, res) => {
  const r = await db.execute({ sql: 'SELECT id, name, email, phone FROM clients WHERE id = ?', args: [req.client.id] });
  if (!r.rows[0]) return res.status(404).json({ error: 'Compte introuvable.' });
  res.json(r.rows[0]);
});

module.exports = router;
