const { createClient } = require('@libsql/client/web');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

// Réessaie automatiquement en cas de coupure réseau passagère avec Turso
const rawExecute = db.execute.bind(db);
db.execute = async (arg) => {
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try {
      return await rawExecute(arg);
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 200 * (i + 1)));
    }
  }
  throw lastErr;
};

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

  // Migrations douces : ajoute les nouvelles colonnes si elles n'existent pas encore
  const info = await db.execute('PRAGMA table_info(site_settings)');
  const cols = info.rows.map((r) => r.name);
  const migrations = [
    ['site_name', 'ALTER TABLE site_settings ADD COLUMN site_name TEXT'],
    ['phone', 'ALTER TABLE site_settings ADD COLUMN phone TEXT'],
    ['email', 'ALTER TABLE site_settings ADD COLUMN email TEXT'],
    ['logo_image', 'ALTER TABLE site_settings ADD COLUMN logo_image TEXT'],
    ['social_links', 'ALTER TABLE site_settings ADD COLUMN social_links TEXT']
  ];
  for (const [col, sql] of migrations) {
    if (!cols.includes(col)) {
      await db.execute(sql);
    }
  }

  // Valeurs par défaut pour les nouvelles colonnes, seulement si elles sont vides
  await db.execute({
    sql: `UPDATE site_settings SET
            site_name = COALESCE(site_name, ?),
            email = COALESCE(email, ?),
            social_links = COALESCE(social_links, ?)
          WHERE id = 1`,
    args: ['Tilus-Tech', 'contact@tilus-tech.dev', '[]']
  });
})();

module.exports = { db, ready };
