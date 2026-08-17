const express = require('express');
const { db } = require('../db');
const { requireClient, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const VALID_STATUSES = ['en_attente', 'en_cours', 'termine'];

// POST /api/appointments — un client prend un rendez-vous
router.post('/', requireClient, async (req, res) => {
  const { service, appt_date, appt_time, notes } = req.body;
  if (!service || !service.trim() || !appt_date || !appt_time) {
    return res.status(400).json({ error: 'Service, date et heure requis.' });
  }
  const result = await db.execute({
    sql: `INSERT INTO appointments (client_id, service, appt_date, appt_time, notes, status)
          VALUES (?, ?, ?, ?, ?, 'en_attente')`,
    args: [req.client.id, service.trim(), appt_date, appt_time, (notes || '').trim()]
  });
  const r = await db.execute({ sql: 'SELECT * FROM appointments WHERE id = ?', args: [result.lastInsertRowid] });
  res.status(201).json(r.rows[0]);
});

// GET /api/appointments/mine — les rendez-vous du client connecté
router.get('/mine', requireClient, async (req, res) => {
  const r = await db.execute({
    sql: 'SELECT * FROM appointments WHERE client_id = ? ORDER BY appt_date, appt_time',
    args: [req.client.id]
  });
  res.json(r.rows);
});

// DELETE /api/appointments/:id/cancel — le client annule son propre rendez-vous en attente
router.delete('/:id/cancel', requireClient, async (req, res) => {
  const r = await db.execute({ sql: 'SELECT * FROM appointments WHERE id = ?', args: [req.params.id] });
  const appt = r.rows[0];
  if (!appt || appt.client_id !== req.client.id) {
    return res.status(404).json({ error: 'Rendez-vous introuvable.' });
  }
  if (appt.status !== 'en_attente') {
    return res.status(400).json({ error: 'Ce rendez-vous ne peut plus être annulé.' });
  }
  await db.execute({ sql: 'DELETE FROM appointments WHERE id = ?', args: [req.params.id] });
  res.json({ ok: true });
});

// GET /api/appointments — liste complète, admin uniquement
router.get('/', requireAdmin, async (req, res) => {
  const r = await db.execute(`
    SELECT a.*, c.name AS client_name, c.email AS client_email, c.phone AS client_phone
    FROM appointments a
    JOIN clients c ON c.id = a.client_id
    ORDER BY a.appt_date, a.appt_time
  `);
  res.json(r.rows);
});

// PATCH /api/appointments/:id/status — admin change le statut
router.patch('/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Statut invalide.' });
  }
  await db.execute({ sql: 'UPDATE appointments SET status = ? WHERE id = ?', args: [status, req.params.id] });
  res.json({ ok: true });
});

// DELETE /api/appointments/:id — admin supprime un rendez-vous
router.delete('/:id', requireAdmin, async (req, res) => {
  await db.execute({ sql: 'DELETE FROM appointments WHERE id = ?', args: [req.params.id] });
  res.json({ ok: true });
});

module.exports = router;
