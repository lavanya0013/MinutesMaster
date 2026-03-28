/* =============================================
   AUTH.JS — OTP via Gmail, JWT, bcrypt
   ============================================= */
const bcrypt       = require('bcryptjs');
const jwt          = require('jsonwebtoken');
const nodemailer   = require('nodemailer');
const db           = require('./db');

const JWT_SECRET       = process.env.JWT_SECRET || 'mm_fallback_secret';
const OTP_EXPIRY_MS    = 10 * 60 * 1000; // 10 minutes
const MAX_OTP_ATTEMPTS = 5;

// ─── Email transporter (lazy init) ───────────────────────────────────────────
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const user = process.env.GMAIL_USER || '';
  const pass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, ''); // remove spaces
  if (!user || user === 'your_gmail@gmail.com' || !pass) return null;
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
  return transporter;
}

// Verify Gmail connection on startup (call this from server.js)
async function verifyEmailSetup() {
  const t = getTransporter();
  if (!t) {
    console.warn('\n⚠️  Gmail not configured — OTPs will print to console (DEV MODE).');
    console.warn('   Add GMAIL_USER + GMAIL_APP_PASSWORD to server/.env\n');
    return false;
  }
  try {
    await t.verify();
    console.log(`\n📧  Gmail ready — sending from ${process.env.GMAIL_USER}`);
    return true;
  } catch (e) {
    console.error('\n❌  Gmail authentication FAILED:', e.message);
    console.error('   Check GMAIL_USER and GMAIL_APP_PASSWORD in server/.env');
    console.error('   Make sure 2-Step Verification is ON and App Password is correct.\n');
    transporter = null; // reset so DEV MODE kicks in
    return false;
  }
}

// ─── OTP ─────────────────────────────────────────────────────────────────────

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendOTP(email, otp) {
  const t = getTransporter();

  // DEV MODE — Gmail not configured or failed auth
  if (!t) {
    console.log(`\n📧 [DEV MODE] OTP for ${email}: ${otp}`);
    console.log(`   (Configure Gmail in server/.env for real emails)\n`);
    return { success: true, simulated: true };
  }

  const mailOptions = {
    from:    `"MinutesMaster" <${process.env.GMAIL_USER}>`,
    to:      email,
    subject: 'Your MinutesMaster OTP',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:420px;margin:0 auto;padding:32px;border:1px solid #e2e4e9;border-radius:8px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;">
          <div style="background:#2563eb;width:32px;height:32px;border-radius:5px;display:flex;align-items:center;justify-content:center;">
            <span style="color:white;font-size:18px;">🎙</span>
          </div>
          <strong style="font-size:16px;color:#111318;">MinutesMaster</strong>
        </div>
        <h2 style="font-size:20px;color:#111318;margin:0 0 8px;">Your OTP Code</h2>
        <p style="color:#5a5f72;font-size:14px;margin:0 0 24px;">Use this OTP to verify your email address. It expires in <strong>10 minutes</strong>.</p>
        <div style="background:#eff4ff;border:1px solid #2563eb;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px;">
          <span style="font-size:36px;font-weight:700;letter-spacing:0.3em;color:#2563eb;">${otp}</span>
        </div>
        <p style="color:#9499ad;font-size:12px;margin:0;">Do not share this OTP with anyone. If you did not request this, ignore this email.</p>
      </div>
    `,
  };

  try {
    console.log(`\n📧 Sending OTP to ${email}...`);
    const info = await t.sendMail(mailOptions);
    console.log(`✅ Email sent — Message ID: ${info.messageId}\n`);
    return { success: true };
  } catch (e) {
    console.error(`\n❌ Failed to send email to ${email}:`, e.message);
    // Fall back: print OTP to console so user isn't blocked
    console.log(`📧 [FALLBACK] OTP for ${email}: ${otp}\n`);
    throw e;
  }
}

function storeOTP(email, otp) {
  const key       = email.toLowerCase().trim();
  const expiresAt = Date.now() + OTP_EXPIRY_MS;
  db.run(
    `INSERT INTO otp_store (email, otp_code, expires_at, attempts, verified) VALUES (?, ?, ?, 0, 0)
     ON CONFLICT(email) DO UPDATE SET otp_code=excluded.otp_code, expires_at=excluded.expires_at, attempts=0, verified=0`,
    [key, otp, expiresAt]
  );
}

function verifyOTP(email, code) {
  const key = email.toLowerCase().trim();
  const row = db.get('SELECT * FROM otp_store WHERE email = ?', [key]);
  if (!row) return { ok: false, error: 'No OTP found. Please request a new one.' };
  if (Date.now() > Number(row.expires_at)) {
    db.run('DELETE FROM otp_store WHERE email = ?', [key]);
    return { ok: false, error: 'OTP expired. Please request a new one.' };
  }
  if (Number(row.attempts) >= MAX_OTP_ATTEMPTS)
    return { ok: false, error: 'Too many wrong attempts. Please request a new OTP.' };
  if (row.otp_code !== String(code)) {
    db.run('UPDATE otp_store SET attempts = attempts + 1 WHERE email = ?', [key]);
    return { ok: false, error: 'Incorrect OTP. Please try again.' };
  }
  db.run('UPDATE otp_store SET verified = 1 WHERE email = ?', [key]);
  return { ok: true };
}

function isEmailVerified(email) {
  const key = email.toLowerCase().trim();
  const row = db.get('SELECT verified, expires_at FROM otp_store WHERE email = ?', [key]);
  console.log(`[isEmailVerified] key=${key} row=`, row);
  if (!row) return false;
  const verified  = Number(row.verified)  === 1;
  const notExpired = Date.now() <= Number(row.expires_at);
  console.log(`[isEmailVerified] verified=${verified} notExpired=${notExpired}`);
  return verified && notExpired;
}

function clearOTP(email) {
  db.run('DELETE FROM otp_store WHERE email = ?', [email.toLowerCase().trim()]);
}

// ─── Password ────────────────────────────────────────────────────────────────
function hashPassword(plain)         { return bcrypt.hash(plain, 12); }
function verifyPassword(plain, hash) { return bcrypt.compare(plain, hash); }

// ─── JWT ─────────────────────────────────────────────────────────────────────
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d', issuer: 'minutesmaster' });
}
function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET, { issuer: 'minutesmaster' }); }
  catch { return null; }
}

// ─── Middleware ───────────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer '))
    return res.status(401).json({ error: 'Authentication required.' });
  const payload = verifyToken(header.slice(7));
  if (!payload)
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  req.userId   = payload.userId;
  req.username = payload.username;
  next();
}

module.exports = {
  generateOTP, sendOTP, storeOTP, verifyOTP, isEmailVerified, clearOTP,
  hashPassword, verifyPassword, signToken, verifyToken, authMiddleware,
  verifyEmailSetup,
};
