const express = require('express');
const multer = require('multer');
const { db } = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Stockage en mémoire (pas de disque) : l'image part directement en base64 vers Turso.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 Mo max — reste léger une fois stocké en base64
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new Error('Format non pris en charge. Utilisez JPG, PNG ou WEBP.'));
    }
    cb(null, true);
  }
});

router.get('/', async (req, res) => {
  const r = await db.execute('SELECT site_title, meta_description, background_image FROM site_settings WHERE id = 1');
  res.json(r.rows[0]);
});

router.put('/', requireAdmin, async (req, res) => {
  const { site_title, meta_description } = req.body;
  await db.execute({
    sql: 'UPDATE site_settings SET site_title = ?, meta_description = ? WHERE id = 1',
    args: [(site_title || '').trim(), (meta_description || '').trim()]
  });
  const r = await db.execute('SELECT site_title, meta_description, background_image FROM site_settings WHERE id = 1');
  res.json(r.rows[0]);
});

router.post('/background', requireAdmin, (req, res) => {
  upload.single('background')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Aucune image reçue.' });

    const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    await db.execute({ sql: 'UPDATE site_settings SET background_image = ? WHERE id = 1', args: [dataUrl] });
    res.json({ background_image: dataUrl });
  });
});

router.delete('/background', requireAdmin, async (req, res) => {
  await db.execute("UPDATE site_settings SET background_image = NULL WHERE id = 1");
  res.json({ ok: true });
});

module.exports = router;
