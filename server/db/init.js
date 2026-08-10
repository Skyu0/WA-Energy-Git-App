// server/db/init.js
// Opens the SQLite database (creating the file on first run) and makes sure
// every table exists. SQLite is a real, file-based SQL database — perfectly
// production-capable for a site of this size, and it needs no separate
// database server to install or manage. If you outgrow it later, the SQL
// here is close enough to Postgres/MySQL that migrating is straightforward.

const path = require('path');
const Database = require('./sqlite-adapter');

// The database file lives here by default. On most hosts this is fine as-is.
// On platforms like Railway that require a separate persistent volume (so
// your data survives redeploys), set DB_PATH to wherever that volume is
// mounted (e.g. DB_PATH=/data/waenergy.sqlite) and it's used automatically.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'waenergy.sqlite');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  property_type TEXT,
  appliances_json TEXT DEFAULT '{}',
  wzn_balance INTEGER NOT NULL DEFAULT 2500,
  referral_code TEXT UNIQUE,
  referred_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  badge TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  images_json TEXT NOT NULL,
  specs_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plans (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image TEXT NOT NULL,
  specs_json TEXT NOT NULL,
  suitable TEXT NOT NULL,
  capacity_json TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  icon TEXT NOT NULL,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  more TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS testimonials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  stars INTEGER NOT NULL,
  text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS faqs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cart_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  qty INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                 -- 'quote' | 'wzn_attempt'
  items_json TEXT NOT NULL,           -- [{productId, name, qty}]
  status TEXT NOT NULL DEFAULT 'quote_requested',
  -- status progresses: quote_requested -> processing -> out_for_delivery -> delivered
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Every WZN credit an admin manually sends to a user, kept as an audit trail
-- (so "how much has this admin sent, and to whom" is always answerable).
CREATE TABLE IF NOT EXISTS admin_wzn_grants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  note TEXT,
  admin_username TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One-time 500 WZN referral rewards, logged so a referrer's reward is never
-- granted twice for the same referred signup.
CREATE TABLE IF NOT EXISTS referral_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(referred_id)
);
`);

module.exports = db;
