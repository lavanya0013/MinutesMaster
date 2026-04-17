/* =============================================
   SERVER.JS — MinutesMaster Express API (Gmail OTP)
   ============================================= */
require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const bcrypt    = require('bcryptjs');
const db        = require('./db');
const {
  generateOTP, sendOTP, storeOTP, verifyOTP, isEmailVerified, clearOTP,
  hashPassword, verifyPassword, signToken, authMiddleware, verifyEmailSetup,
} = require('./auth');
const recordingsRouter = require('./routes/recordings');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── CORS ─────────────────────────────────────────────────────────────
app.use(cors({
  origin(origin, cb) {
    const ok = !origin || origin === 'null' ||
      /^file:\/\//.test(origin) ||
      /^https?:\/\/(localhost|127\.0\.0\.1)/.test(origin);
    cb(ok ? null : new Error('CORS'), ok);
  },
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));

// ─── Rate limiters ────────────────────────────────────────────────────
const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 5,
  message: { error: 'Too many OTP requests. Try again in an hour.' },
  standardHeaders: true, legacyHeaders: false,
});
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: { error: 'Too many requests.' } }));

// ─── Validators ───────────────────────────────────────────────────────
const isValidEmail    = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || '');
const isValidUsername = u => /^[a-zA-Z0-9_]{3,20}$/.test(u || '');
const isValidPassword = p => typeof p === 'string' && p.length >= 6;

// ═══════════════════════════ AUTH ROUTES ═══════════════════════════════

// POST /api/auth/send-otp  — send OTP to email
app.post('/api/auth/send-otp', otpLimiter, async (req, res) => {
  const email = (req.body.email || '').toLowerCase().trim();
  if (!isValidEmail(email))
    return res.status(400).json({ error: 'Enter a valid email address.' });
  try {
    const otp = generateOTP();
    storeOTP(email, otp);
    await sendOTP(email, otp);
    res.json({ success: true, message: 'OTP sent to your email address.' });
  } catch (e) { res.status(500).json({ error: `Failed to send OTP: ${e.message}` }); }
});

// POST /api/auth/verify-otp
app.post('/api/auth/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required.' });
  const r = verifyOTP(email, String(otp));
  if (!r.ok) return res.status(400).json({ error: r.error });
  res.json({ success: true, message: 'Email verified.' });
});

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  const email    = (req.body.email    || '').toLowerCase().trim();
  const username = (req.body.username || '').trim();
  const password = req.body.password;
  const phone    = req.body.phone;

  if (!isValidEmail(email))      return res.status(400).json({ error: 'Invalid email address.' });
  if (!isValidUsername(username)) return res.status(400).json({ error: 'Username: 3–20 chars (letters, numbers, _)' });
  if (!isValidPassword(password)) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  const verified = isEmailVerified(email);
  console.log(`[register] email=${email} verified=${verified}`);
  if (!verified) return res.status(400).json({ error: 'Email not verified. Complete OTP verification first.' });

  if (db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]))
    return res.status(409).json({ error: 'Username or email already registered.' });

  try {
    const hash = await hashPassword(password);
    db.run(
      'INSERT INTO users (username, email, phone, password_hash) VALUES (?, ?, ?, ?)',
      [username, email, phone || null, hash]
    );
    const user  = db.get('SELECT id FROM users WHERE email = ?', [email]);
    clearOTP(email);
    const token = signToken({ userId: user.id, username });
    res.status(201).json({ success: true, token, username });
  } catch (e) {
    console.error('Register error:', e);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });
  const user  = db.get('SELECT * FROM users WHERE username = ?', [username]);
  // Always run bcrypt to prevent timing attacks
  const valid = user
    ? await verifyPassword(password, user.password_hash)
    : await bcrypt.hash('dummy', 1).then(() => false);
  if (!user || !valid) return res.status(401).json({ error: 'Invalid username or password.' });
  const token = signToken({ userId: user.id, username: user.username });
  res.json({ success: true, token, username: user.username });
});

// POST /api/auth/forgot/send-otp — send OTP to registered email
app.post('/api/auth/forgot/send-otp', otpLimiter, async (req, res) => {
  const { email } = req.body;
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  // Don't reveal if email is registered
  const user = db.get('SELECT id FROM users WHERE email = ?', [email]);
  if (!user) return res.json({ success: true, message: 'If this email is registered, an OTP will be sent.' });
  try {
    const otp = generateOTP();
    storeOTP(email, otp);
    await sendOTP(email, otp);
    res.json({ success: true, message: 'OTP sent to your registered email.' });
  } catch (e) { res.status(500).json({ error: `Failed to send OTP: ${e.message}` }); }
});

// POST /api/auth/forgot/reset
app.post('/api/auth/forgot/reset', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) return res.status(400).json({ error: 'All fields required.' });
  if (!isValidPassword(newPassword))  return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  const r = verifyOTP(email, String(otp));
  if (!r.ok) return res.status(400).json({ error: r.error });
  const user = db.get('SELECT id FROM users WHERE email = ?', [email]);
  if (!user) return res.status(400).json({ error: 'Email not registered.' });
  try {
    db.run('UPDATE users SET password_hash = ? WHERE id = ?', [await hashPassword(newPassword), user.id]);
    clearOTP(email);
    res.json({ success: true, message: 'Password reset. Please log in.' });
  } catch { res.status(500).json({ error: 'Reset failed.' }); }
});

// GET /api/me
app.get('/api/me', authMiddleware, (req, res) => {
  const user = db.get('SELECT id, username, email, phone, created_at FROM users WHERE id = ?', [req.userId]);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user });
});

// ═══════════════════════════ MEETINGS ROUTES ════════════════════════════

app.get('/api/meetings', authMiddleware, (req, res) => {
  const rows = db.all(
    'SELECT id, name, created_at, duration_seconds, word_count, transcript, mom_json FROM meetings WHERE user_id = ? ORDER BY created_at DESC',
    [req.userId]
  );
  res.json({ meetings: rows.map(m => ({
    id: m.id, name: m.name, createdAt: m.created_at,
    durationSeconds: Number(m.duration_seconds), wordCount: Number(m.word_count),
    transcript: m.transcript,
    mom: m.mom_json ? (() => { try { return JSON.parse(m.mom_json); } catch { return null; } })() : null,
  })) });
});

app.post('/api/meetings', authMiddleware, (req, res) => {
  const { id, name, createdAt, durationSeconds, wordCount, transcript, mom } = req.body;
  if (!id) return res.status(400).json({ error: 'Meeting ID required.' });
  try {
    db.run(
      `INSERT INTO meetings (id, user_id, name, created_at, duration_seconds, word_count, transcript, mom_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, duration_seconds=excluded.duration_seconds,
       word_count=excluded.word_count, transcript=excluded.transcript, mom_json=excluded.mom_json`,
      [id, req.userId, name || 'Untitled', createdAt || new Date().toISOString(),
       durationSeconds || 0, wordCount || 0, transcript || '', mom ? JSON.stringify(mom) : null]
    );
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Save failed.' }); }
});

app.patch('/api/meetings/:id/mom', authMiddleware, (req, res) => {
  const row = db.get('SELECT id FROM meetings WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!row) return res.status(404).json({ error: 'Meeting not found.' });
  db.run('UPDATE meetings SET mom_json = ? WHERE id = ?', [JSON.stringify(req.body.mom), req.params.id]);
  res.json({ success: true });
});

app.delete('/api/meetings/:id', authMiddleware, (req, res) => {
  const row = db.get('SELECT id FROM meetings WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!row) return res.status(404).json({ error: 'Meeting not found.' });
  db.run('DELETE FROM meetings WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// ═══════════════════════════ DEMO RECORDINGS ═══════════════════════════
app.use('/api/recordings', recordingsRouter);

app.get('/api/health', (_, res) => res.json({ ok: true }));
app.use((_, res) => res.status(404).json({ error: 'Not found.' }));
app.use((err, req, res, _n) => { console.error(err); res.status(500).json({ error: 'Server error.' }); });

// ─── Start ────────────────────────────────────────────────────────────
db.initDb().then(async () => {
  await verifyEmailSetup(); // test Gmail on startup
  app.listen(PORT, () => {
    console.log(`\n✅  MinutesMaster Server → http://localhost:${PORT}`);
    console.log(`📁  Database: minutesmaster.db.bin\n`);
  });
}).catch(err => { console.error('DB init failed:', err); process.exit(1); });
