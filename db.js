const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'agents.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Users ────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    credits INTEGER NOT NULL DEFAULT 4,
    role TEXT NOT NULL DEFAULT 'user',
    avatar_color TEXT NOT NULL DEFAULT '#4f8ef7',
    bio TEXT NOT NULL DEFAULT '',
    stripe_customer_id TEXT,
    suspended INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Safe column additions (ignored if already exist)
const existingCols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
if (!existingCols.includes('credits')) db.exec("ALTER TABLE users ADD COLUMN credits INTEGER NOT NULL DEFAULT 4");
if (!existingCols.includes('role')) db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
if (!existingCols.includes('avatar_color')) db.exec("ALTER TABLE users ADD COLUMN avatar_color TEXT NOT NULL DEFAULT '#4f8ef7'");
if (!existingCols.includes('bio')) db.exec("ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT ''");
if (!existingCols.includes('stripe_customer_id')) db.exec("ALTER TABLE users ADD COLUMN stripe_customer_id TEXT");
if (!existingCols.includes('suspended')) db.exec("ALTER TABLE users ADD COLUMN suspended INTEGER NOT NULL DEFAULT 0");

// ── System Settings ──────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  )
`);
// Seed defaults if missing
const settingDefaults = { default_credits: '4', announcement: '' };
const insertSetting = db.prepare('INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(settingDefaults)) insertSetting.run(k, v);

// ── Conversations ─────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Chat',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// ── Messages ──────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('user','model')),
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// ── Credit History ─────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS credit_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL DEFAULT -1,
    reason TEXT DEFAULT 'chat',
    balance_after INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// ── Password Reset Tokens ──────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
  )
`);

// ── Projects ──────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'gemini',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// ── Project Files ─────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS project_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, path)
  )
`);

module.exports = db;
