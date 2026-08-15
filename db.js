const { createClient } = require('@libsql/client/web');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

// Crée les tables si elles n'existent pas encore, et applique les petites
// migrations nécessaires. server.js attend cette promesse avant de démarrer.
const ready = (async () => {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      session TEXT,
      description TEXT,
      techs TEXT,
      link TEXT,
      image TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS site_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      site_title TEXT,
      meta_description TEXT,
      background_image TEXT
    )
  `);

  await db.execute({
    sql: `INSERT OR IGNORE INTO site_settings (id, site_title, meta_description)
          VALUES (1, ?, ?)`,
    args: [
      'Tilus-Tech — Diagnostic, réparation, mise en ligne',
      "Conception de sites web, installation système et dépannage Windows à distance."
    ]
  });
})();

module.exports = { db, ready };
