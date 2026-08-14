require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { ready } = require('./db');
const authRoutes = require('./routes/auth');
const projectsRoutes = require('./routes/projects');
const messagesRoutes = require('./routes/messages');
const settingsRoutes = require('./routes/settings');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('changez_moi')) {
  console.warn('\n⚠️  ATTENTION : JWT_SECRET n\'est pas défini ou utilise la valeur par défaut.');
  console.warn('   Générez-en un vrai avant de déployer : node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\n');
}
if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.warn('\n⚠️  ATTENTION : TURSO_DATABASE_URL ou TURSO_AUTH_TOKEN manquant. La base de données ne pourra pas se connecter.\n');
}

const app = express();

app.use(helmet());

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:4000',
  credentials: true
}));

app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());

app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 120 }));

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/settings', settingsRoutes);

// Sert le site statique (frontend/index.html)
app.use(express.static(path.join(__dirname, 'public')));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur.' });
});

const PORT = process.env.PORT || 4000;

// On attend que les tables Turso soient prêtes avant d'accepter des requêtes.
ready
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Tilus-Tech API démarrée sur le port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Impossible de se connecter à la base de données Turso :', err);
    process.exit(1);
  });
