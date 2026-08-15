const express = require('express');
const multer = require('multer');
const { db } = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 Mo max
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new Error('Format non pris en charge. Utilisez JPG, PNG ou WEBP.'));
    }
    cb(null, true);
  }
});

function serialize(row) {
  return {
    site_title: row.site_title,
    meta_description: row.meta_description,
    background_image: row.background_image,
    site_name: row.site_name,
    phone: row.phone,
    email: row.email,
    logo_image: row.logo_image,
    social_links: row.social_links ? JSON.parse(row.social_links) : []
  };
}

// GET /api/settings — public
router.get('/', async (req, res) => {
  const r = await db.execute('SELECT * FROM site_settings WHERE id = 1');
  res.json(serialize(r.rows[0]));
});

// PUT /api/settings — protégé
router.put('/', requireAdmin, async (req, res) => {
  const { site_title, meta_description, site_name, phone, email, social_links } = req.body;
  await db.execute({
    sql: `UPDATE site_settings SET
            site_title = ?, meta_description = ?, site_name = ?,
            phone = ?, email = ?, social_links = ?
          WHERE id = 1`,
    args: [
      (site_title || '').trim(),
      (meta_description || '').trim(),
      (site_name || '').trim(),
      (phone || '').trim(),
      (email || '').trim(),
      JSON.stringify(Array.isArray(social_links) ? social_links : [])
    ]
  });
  const r = await db.execute('SELECT * FROM site_settings WHERE id = 1');
  res.json(serialize(r.rows[0]));
});

// POST /api/settings/background — protégé
router.post('/background', requireAdmin, (req, res) => {
  upload.single('background')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Aucune image reçue.' });
    const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    await db.execute({ sql: 'UPDATE site_settings SET background_image = ? WHERE id = 1', args: [dataUrl] });
    res.json({ background_image: dataUrl });
  });
});

// DELETE /api/settings/background — protégé
router.delete('/background', requireAdmin, async (req, res) => {
  await db.execute('UPDATE site_settings SET background_image = NULL WHERE id = 1');
  res.json({ ok: true });
});

// POST /api/settings/logo — protégé
router.post('/logo', requireAdmin, (req, res) => {
  upload.single('logo')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Aucune image reçue.' });
    const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    await db.execute({ sql: 'UPDATE site_settings SET logo_image = ? WHERE id = 1', args: [dataUrl] });
    res.json({ logo_image: dataUrl });
  });
});

// DELETE /api/settings/logo — protégé
router.delete('/logo', requireAdmin, async (req, res) => {
  await db.execute('UPDATE site_settings SET logo_image = NULL WHERE id = 1');
  res.json({ ok: true });
});

module.exports = router;
