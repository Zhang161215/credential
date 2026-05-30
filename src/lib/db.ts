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
    ["account_price", "100"],
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
}
