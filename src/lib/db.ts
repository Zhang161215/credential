import Database from "better-sqlite3";
import path from "path";
import bcrypt from "bcryptjs";

const DB_PATH = path.join(process.cwd(), "data", "credential.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initTables(_db);
  }
  return _db;
}

function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      balance INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      last_login_at TEXT,
      last_login_ip TEXT
    );

    CREATE TABLE IF NOT EXISTS user_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      count INTEGER NOT NULL DEFAULT 1,
      balance_after INTEGER NOT NULL,
      related_card_key TEXT,
      related_credential_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (related_credential_id) REFERENCES credentials(id)
    );

    CREATE INDEX IF NOT EXISTS idx_user_tx_user ON user_transactions(user_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_user_tx_type_time ON user_transactions(type, created_at);

    CREATE TABLE IF NOT EXISTS credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      content TEXT NOT NULL,
      is_redeemed INTEGER DEFAULT 0,
      redeemed_by_user_id INTEGER,
      redeemed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (redeemed_by_user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_cred_redeemed ON credentials(is_redeemed, id);

    CREATE TABLE IF NOT EXISTS card_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value INTEGER NOT NULL,
      is_used INTEGER DEFAULT 0,
      used_by_user_id INTEGER,
      used_at TEXT,
      used_ip TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (used_by_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );
  `);

  const defaultSettings: [string, string][] = [
    ["announcement", ""],
    ["contact_info", ""],
    ["contact_icon", "qq"],
    ["account_price", "100"],
    ["health_check_interval", "30"],
  ];
  const upsertSetting = db.prepare(
    "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)"
  );
  for (const [k, v] of defaultSettings) {
    upsertSetting.run(k, v);
  }

  const existing = db.prepare("SELECT id FROM admin WHERE username = ?").get("admin");
  if (!existing) {
    const password = process.env.ADMIN_INIT_PASSWORD || "admin123456";
    const hash = bcrypt.hashSync(password, 10);
    db.prepare("INSERT INTO admin (username, password_hash) VALUES (?, ?)").run("admin", hash);
  }

  // Migration: ensure user_transactions.count column exists for older DBs
  const cols = db
    .prepare("PRAGMA table_info(user_transactions)")
    .all() as { name: string }[];
  if (!cols.some((c) => c.name === "count")) {
    db.exec(
      "ALTER TABLE user_transactions ADD COLUMN count INTEGER NOT NULL DEFAULT 1"
    );
  }

  // Migration: add related_credential_ids column for batch redeem download support
  if (!cols.some((c) => c.name === "related_credential_ids")) {
    db.exec(
      "ALTER TABLE user_transactions ADD COLUMN related_credential_ids TEXT"
    );
    // Backfill: migrate existing single related_credential_id to JSON array
    db.exec(
      `UPDATE user_transactions
       SET related_credential_ids = '[' || related_credential_id || ']'
       WHERE related_credential_id IS NOT NULL AND related_credential_ids IS NULL`
    );
  }

  // Migration: multi-admin support - add columns to admin table
  const adminCols = db
    .prepare("PRAGMA table_info(admin)")
    .all() as { name: string }[];
  if (!adminCols.some((c) => c.name === "role")) {
    db.exec("ALTER TABLE admin ADD COLUMN role TEXT NOT NULL DEFAULT 'superadmin'");
  }
  if (!adminCols.some((c) => c.name === "slug")) {
    db.exec("ALTER TABLE admin ADD COLUMN slug TEXT");
  }
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_slug ON admin(slug)");
  if (!adminCols.some((c) => c.name === "display_name")) {
    db.exec("ALTER TABLE admin ADD COLUMN display_name TEXT");
  }
  if (!adminCols.some((c) => c.name === "created_at")) {
    db.exec("ALTER TABLE admin ADD COLUMN created_at TEXT");
  }
  if (!adminCols.some((c) => c.name === "created_by")) {
    db.exec("ALTER TABLE admin ADD COLUMN created_by INTEGER");
  }

  // Migration: add admin_id to credentials and card_keys
  const credCols = db
    .prepare("PRAGMA table_info(credentials)")
    .all() as { name: string }[];
  if (!credCols.some((c) => c.name === "admin_id")) {
    db.exec("ALTER TABLE credentials ADD COLUMN admin_id INTEGER REFERENCES admin(id)");
    // Backfill: assign all existing credentials to the first superadmin
    const firstAdmin = db.prepare("SELECT id FROM admin ORDER BY id ASC LIMIT 1").get() as { id: number } | undefined;
    if (firstAdmin) {
      db.exec(`UPDATE credentials SET admin_id = ${firstAdmin.id} WHERE admin_id IS NULL`);
    }
  }

  const cardCols = db
    .prepare("PRAGMA table_info(card_keys)")
    .all() as { name: string }[];
  if (!cardCols.some((c) => c.name === "admin_id")) {
    db.exec("ALTER TABLE card_keys ADD COLUMN admin_id INTEGER REFERENCES admin(id)");
    // Backfill: assign all existing card_keys to the first superadmin
    const firstAdmin = db.prepare("SELECT id FROM admin ORDER BY id ASC LIMIT 1").get() as { id: number } | undefined;
    if (firstAdmin) {
      db.exec(`UPDATE card_keys SET admin_id = ${firstAdmin.id} WHERE admin_id IS NULL`);
    }
  }

  // Create index for admin_id lookups
  db.exec("CREATE INDEX IF NOT EXISTS idx_cred_admin ON credentials(admin_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_card_admin ON card_keys(admin_id)");

  // Migration: credential_health table for health check feature
  db.exec(`
    CREATE TABLE IF NOT EXISTS credential_health (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      credential_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'unknown',
      five_hour_percent REAL,
      weekly_percent REAL,
      five_hour_reset_at TEXT,
      weekly_reset_at TEXT,
      error_message TEXT,
      checked_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (credential_id) REFERENCES credentials(id)
    );
    CREATE INDEX IF NOT EXISTS idx_health_cred ON credential_health(credential_id, checked_at DESC);
  `);
}
