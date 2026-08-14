const express = require('express');
const { db } = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

function serialize(row) {
  return { ...row, techs: row.techs ? JSON.parse(row.techs) : [] };
}

router.get('/', async (req, res) => {
  const r = await db.execute('SELECT * FROM projects ORDER BY created_at DESC');
  res.json(r.rows.map(serialize));
});

router.post('/', requireAdmin, async (req, res) => {
  const { title, session, description, techs, link, image } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Le titre est obligatoire.' });
  }
  const result = await db.execute({
    sql: `INSERT INTO projects (title, session, description, techs, link, image)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      title.trim(),
      (session || '').trim(),
      (description || '').trim(),
      JSON.stringify(Array.isArray(techs) ? techs : []),
      (link || '').trim(),
      (image || '').trim()
    ]
  });
  const r = await db.execute({
    sql: 'SELECT * FROM projects WHERE id = ?',
    args: [result.lastInsertRowid]
  });
  res.status(201).json(serialize(r.rows[0]));
});

router.put('/:id', requireAdmin, async (req, res) => {
  const { title, session, description, techs, link, image } = req.body;
  const existingR = await db.execute({ sql: 'SELECT * FROM projects WHERE id = ?', args: [req.params.id] });
  const existing = existingR.rows[0];
  if (!existing) return res.status(404).json({ error: 'Projet introuvable.' });

  await db.execute({
    sql: `UPDATE projects SET title=?, session=?, description=?, techs=?, link=?, image=? WHERE id=?`,
    args: [
      title?.trim() || existing.title,
      session?.trim() ?? existing.session,
      description?.trim() ?? existing.description,
      JSON.stringify(Array.isArray(techs) ? techs : JSON.parse(existing.techs || '[]')),
      link?.trim() ?? existing.link,
      image?.trim() ?? existing.image,
      req.params.id
    ]
  });
  const r = await db.execute({ sql: 'SELECT * FROM projects WHERE id = ?', args: [req.params.id] });
  res.json(serialize(r.rows[0]));
});

router.delete('/:id', requireAdmin, async (req, res) => {
  await db.execute({ sql: 'DELETE FROM projects WHERE id = ?', args: [req.params.id] });
  res.json({ ok: true });
});

module.exports = router;
