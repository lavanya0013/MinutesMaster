/* =============================================
   STORAGE.JS — meeting management
   Dual-write: SQLite backend API + localStorage cache
   ============================================= */

const API_BASE     = 'http://localhost:3001';
const STORAGE_KEY  = 'meetily_meetings';
const SETTINGS_KEY = 'meetily_settings';

/* ─── Local cache helpers ─── */
function localGet()       { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
function localSet(arr)    { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }

/* ─── Low-level API helper ─── */
async function apiCall(method, path, body) {
  const token = localStorage.getItem('mm_token');
  const opts  = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const r   = await fetch(`${API_BASE}${path}`, opts);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}

window.AppStorage = {
  /* ─── Meetings ─── */

  // Returns local meetings IMMEDIATELY, then syncs backend in background
  async getMeetings() {
    const local = localGet();
    // Background sync — don't block or await
    this._bgSync();
    return local;
  },

  // Sync with server silently in background
  _bgSyncTimer: null,
  _bgSync() {
    clearTimeout(this._bgSyncTimer);
    this._bgSyncTimer = setTimeout(async () => {
      try {
        const r = await apiCall('GET', '/api/meetings');
        if (Array.isArray(r.meetings) && r.meetings.length > 0) {
          const local  = localGet();
          const apiIds = new Set(r.meetings.map(m => m.id));
          const merged = [...r.meetings, ...local.filter(m => !apiIds.has(m.id))];
          localSet(merged);
        }
      } catch { /* server unreachable — ignore */ }
    }, 200);
  },

  async saveMeeting(meeting) {
    // 1. Save to local cache immediately (optimistic/synchronous)
    const local = localGet();
    const idx   = local.findIndex(m => m.id === meeting.id);
    if (idx >= 0) local[idx] = meeting; else local.unshift(meeting);
    localSet(local);

    // 2. Sync to backend in the background (DO NOT AWAIT - prevents UI from hanging if server is stuck)
    apiCall('POST', '/api/meetings', meeting)
      .then(() => console.log('[Storage.saveMeeting] Synced to backend:', meeting.id))
      .catch(e => console.warn('[Storage.saveMeeting] Backend sync failed (saved locally):', e.message));

    return meeting;
  },

  getMeeting(id) {
    return localGet().find(m => m.id === id) || null;
  },

  async updateMoM(id, mom) {
    const local = localGet();
    const m     = local.find(m => m.id === id);
    if (m) { m.mom = mom; localSet(local); }
    try { await apiCall('PATCH', `/api/meetings/${id}/mom`, { mom }); } catch (e) {
      console.warn('[Storage.updateMoM] Backend sync failed:', e.message);
    }
  },

  async deleteMeeting(id) {
    localSet(localGet().filter(m => m.id !== id));
    try { await apiCall('DELETE', `/api/meetings/${id}`); } catch (e) {
      console.warn('[Storage.deleteMeeting] Backend sync failed:', e.message);
    }
  },

  clearAll() { localStorage.removeItem(STORAGE_KEY); },

  /* ─── Settings (local only) ─── */
  getSettings()   { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { return {}; } },
  saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); },

  /* ─── Stats (computed from local cache) ─── */
  getStats() {
    const meetings = localGet();
    return {
      count:        meetings.length,
      totalWords:   meetings.reduce((a, m) => a + (m.wordCount        || 0), 0),
      totalSeconds: meetings.reduce((a, m) => a + (m.durationSeconds  || 0), 0),
    };
  },

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  },
};
