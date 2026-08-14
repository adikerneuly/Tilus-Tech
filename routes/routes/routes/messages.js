const express = require('express');
const rateLimit = require('express-rate-limit');
const { db } = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de messages envoyés. Réessayez plus tard.' }
});

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post('/', contactLimiter, async (req, res) => {
  const { name, email, message } = req.body;
  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Adresse courriel invalide.' });
  }
  await db.execute({
    sql: 'INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)',
    args: [name.trim().slice(0, 200), email.trim().slice(0, 200), message.trim().slice(0, 4000)]
  });
  res.status(201).json({ ok: true });
});

router.get('/', requireAdmin, async (req, res) => {
  const r = await db.execute('SELECT * FROM contact_messages ORDER BY created_at DESC');
  res.json(r.rows);
});

router.patch('/:id/read', requireAdmin, async (req, res) => {
  await db.execute({ sql: 'UPDATE contact_messages SET read = 1 WHERE id = ?', args: [req.params.id] });
  res.json({ ok: true });
});

router.delete('/:id', requireAdmin, async (req, res) => {
  await db.execute({ sql: 'DELETE FROM contact_messages WHERE id = ?', args: [req.params.id] });
  res.json({ ok: true });
});

module.exports = router;
