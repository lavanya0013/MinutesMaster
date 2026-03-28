/* =============================================
   DB.JS — sql.js (pure-JS SQLite, no native build)
   ============================================= */
const path = require('path');
const fs   = require('fs');

const DB_PATH = path.join(__dirname, 'minutesmaster.db.bin');

let SQL, db;

async function initDb() {
  if (db) return db;
  const initSqlJs = require('sql.js');
  SQL = await initSqlJs();

  // Load existing DB or create fresh
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  // Schema — email is now the primary login/OTP identifier
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT UNIQUE NOT NULL COLLATE NOCASE,
      email         TEXT UNIQUE NOT NULL COLLATE NOCASE,
      phone         TEXT,
      password_hash TEXT NOT NULL,
      created_at    TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS meetings (
      id               TEXT    PRIMARY KEY,
      user_id          INTEGER NOT NULL,
      name             TEXT    DEFAULT 'Untitled',
      created_at       TEXT,
      duration_seconds INTEGER DEFAULT 0,
      word_count       INTEGER DEFAULT 0,
      transcript       TEXT    DEFAULT '',
      mom_json         TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS otp_store (
      email      TEXT    PRIMARY KEY,
      otp_code   TEXT    NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts   INTEGER DEFAULT 0,
      verified   INTEGER DEFAULT 0
    );
  `);

  persist();

  // ── Schema migration: old otp_store used 'phone', new uses 'email' ──────────
  try {
    const cols = db.all(`PRAGMA table_info(otp_store)`).map(c => c.name);
    if (cols.includes('phone') && !cols.includes('email')) {
      console.log('🔧 Migrating otp_store schema (phone → email)...');
      db.run('DROP TABLE IF EXISTS otp_store');
      db.run(`CREATE TABLE otp_store (
        email      TEXT    PRIMARY KEY,
        otp_code   TEXT    NOT NULL,
        expires_at INTEGER NOT NULL,
        attempts   INTEGER DEFAULT 0,
        verified   INTEGER DEFAULT 0
      )`);
      persist();
      console.log('✅ otp_store migrated successfully.');
    }
  } catch (e) { console.warn('Schema migration warning:', e.message); }

  return db;
}

function persist() {
  if (!db) return;
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

function run(sql, params = []) { db.run(sql, params); persist(); }

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) { const r = stmt.getAsObject(); stmt.free(); return r; }
  stmt.free(); return null;
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

module.exports = { initDb, run, get, all, persist };
