/* =============================================
   AUTH.JS — Shared API client for auth pages
   Loaded by auth.html and register.html
   ============================================= */

const API_BASE = 'http://localhost:3001';

const AuthAPI = {
  _call: async (path, body) => {
    const r = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return r.json();
  },

  sendOTP:       email              => AuthAPI._call('/api/auth/send-otp',     { email }),
  verifyOTP:    (email, otp)        => AuthAPI._call('/api/auth/verify-otp',   { email, otp }),
  register:     (email, username, password, phone) =>
                                       AuthAPI._call('/api/auth/register',     { email, username, password, phone }),
  login:        (username, password) => AuthAPI._call('/api/auth/login',       { username, password }),
  forgotSendOTP: email              => AuthAPI._call('/api/auth/forgot/send-otp', { email }),
  forgotReset:  (email, otp, newPassword) =>
                                       AuthAPI._call('/api/auth/forgot/reset', { email, otp, newPassword }),

  /* Called in index.html — checks token validity, redirects if invalid */
  async checkAuth() {
    const token = localStorage.getItem('mm_token');
    if (!token) { window.location.href = 'auth.html'; return null; }
    try {
      const r = await fetch(`${API_BASE}/api/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) { this.logout(); return null; }
      return (await r.json()).user;
    } catch {
      // Server unreachable — allow local-only mode (stored token present)
      return { username: localStorage.getItem('mm_username') || 'User', offline: true };
    }
  },

  logout() {
    localStorage.removeItem('mm_token');
    localStorage.removeItem('mm_username');
    window.location.href = 'auth.html';
  },

  getToken() { return localStorage.getItem('mm_token'); },
  getUsername(){ return localStorage.getItem('mm_username') || 'User'; },
};
