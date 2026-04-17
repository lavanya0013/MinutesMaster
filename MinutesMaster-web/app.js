/* =============================================
   STORAGE — embedded directly to avoid cache issues
   ============================================= */
(function() {
  const API_BASE     = 'http://localhost:3001';
  const STORAGE_KEY  = 'meetily_meetings';
  const SETTINGS_KEY = 'meetily_settings';

  function localGet() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
  function localSet(arr) { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }

  async function apiCall(method, path, body) {
    const token = localStorage.getItem('mm_token');
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(`${API_BASE}${path}`, opts);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  }

  window.AppStorage = {
    async getMeetings() {
      const local = localGet();
      this._bgSync();
      return local;
    },

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
      // Save locally first (instant, never fails)
      const local = localGet();
      const idx = local.findIndex(m => m.id === meeting.id);
      if (idx >= 0) local[idx] = meeting; else local.unshift(meeting);
      localSet(local);

      // Sync to backend in background (don't await)
      apiCall('POST', '/api/meetings', meeting)
        .then(() => console.log('[AppStorage] Synced to backend:', meeting.id))
        .catch(e => console.warn('[AppStorage] Backend sync failed (saved locally):', e.message));

      return meeting;
    },

    getMeeting(id) { return localGet().find(m => m.id === id) || null; },

    async updateMoM(id, mom) {
      const local = localGet();
      const m = local.find(m => m.id === id);
      if (m) { m.mom = mom; localSet(local); }
      try { await apiCall('PATCH', `/api/meetings/${id}/mom`, { mom }); } catch (e) {
        console.warn('[AppStorage] updateMoM backend failed:', e.message);
      }
    },

    async deleteMeeting(id) {
      localSet(localGet().filter(m => m.id !== id));
      try { await apiCall('DELETE', `/api/meetings/${id}`); } catch (e) {
        console.warn('[AppStorage] deleteMeeting backend failed:', e.message);
      }
    },

    clearAll() { localStorage.removeItem(STORAGE_KEY); },

    getSettings()   { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { return {}; } },
    saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); },

    generateId() {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    },
  };

  console.log('[AppStorage] Ready ✓');
})();

/* ============================================================
   DEMO MEETING SEED — always available in history for demo
   ============================================================ */
(function injectDemoMeeting() {
  var DEMO_VERSION = 'v2';
  var STORAGE_KEY  = 'meetily_meetings';
  var DEMO_KEY     = 'mm_demo_injected';

  if (localStorage.getItem(DEMO_KEY) === DEMO_VERSION) return;

  var demoTranscript = "Good morning everyone. Thank you for joining this meeting. The purpose of today's meeting is to discuss the rescheduling of the internal examinations for the Information Technology department. As we are all aware, several students have raised concerns about the current exam dates conflicting with their project submission deadlines. I would like to begin by hearing from the faculty coordinators. Dr. Mistry, could you please share your observations? Yes, thank you. I have spoken with multiple students and they have expressed genuine difficulty with the current schedule. The internal exams are scheduled for 22nd April, and the major project submissions are also due around the same time. This overlap is causing significant stress among the students. I suggest we consider postponing the internal exams by at least one week. That would give students adequate time to prepare for both. That is a very valid point. I propose that we reschedule the internal exams from 22nd April to 29th April 2026. This one-week extension should give students sufficient time. What do the other faculty members think? I agree with the proposal. A one-week extension is reasonable and manageable for faculty as well. We can adjust the question paper setting timeline accordingly. I also support the reschedule. We should communicate this change to students immediately to avoid any confusion. The notice should be formal and clearly state the new dates. Very well. Let us summarize the decision. The internal examinations for the Department of Information Technology, originally scheduled for 22nd April 2026, will be postponed to 29th April 2026. All faculty members are requested to update their evaluation schedules. The department coordinator will issue a formal notice to all students by end of day. Dr. Mistry, could you please draft the notice and share it with the HOD for approval before circulating? Certainly, I will prepare the notice and submit it for approval within the next two hours. Any other action items before we close? We should also notify the examination cell about this reschedule so that the hall arrangements can be updated accordingly. Good point. The department secretary will coordinate with the examination cell. I will follow up on that as well. Is there anything else? I think we have covered all the key points. To summarize: exam dates are rescheduled, a formal notice will be issued, and the examination cell will be informed. Thank you everyone for your time and cooperation. This meeting is now concluded.";

  var demoMom = {
    generatedAt: "2026-04-18T10:25:00.000Z",
    header: {
      title: "Discussion on Exam Rescheduling",
      date: "2026-04-18T10:00:00.000Z",
      duration: 1500,
      organiser: "Dr. Sharad Jadhav, HOD IT",
      location: "Department Conference Room, RAIT",
      wordCount: 412
    },
    discussionPoints: [
      "The purpose of the meeting was to discuss rescheduling of internal examinations for the IT department.",
      "Students raised concerns about exam dates conflicting with project submission deadlines.",
      "Dr. Mistry observed that students expressed genuine difficulty with the current schedule.",
      "The overlap between exams on 22nd April and project submissions is causing significant stress.",
      "Faculty suggested postponing the exams by at least one week to give students adequate time."
    ],
    decisions: [
      "Internal examinations originally scheduled for 22nd April 2026 will be postponed to 29th April 2026.",
      "All faculty members are requested to update their evaluation schedules accordingly.",
      "The department coordinator will issue a formal notice to all students by end of day.",
      "The examination cell will be notified about the reschedule for hall arrangement updates."
    ],
    actionItems: [
      "Dr. Mistry will draft the formal notice and submit it to the HOD for approval within two hours.",
      "The department secretary will coordinate with the examination cell regarding hall arrangements.",
      "All faculty members will update their question paper setting timelines accordingly.",
      "Formal communication will be circulated to all students immediately after HOD approval."
    ],
    closingNotes: [
      "Meeting concluded with a unanimous agreement on the exam reschedule.",
      "All key decisions and action items were summarized before closing.",
      "Thank you everyone for your time and cooperation."
    ],
    rawTranscript: demoTranscript
  };

  var demoMeeting = {
    id: "demo1",
    name: "Discussion on Exam Rescheduling",
    createdAt: "2026-04-18T10:00:00.000Z",
    durationSeconds: 1500,
    wordCount: 412,
    transcript: demoTranscript,
    segments: [{ text: demoTranscript }],
    mom: demoMom
  };

  try {
    var existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    var filtered = existing.filter(function(m) { return m.id !== 'demo1'; });
    filtered.unshift(demoMeeting);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    localStorage.setItem(DEMO_KEY, DEMO_VERSION);
    console.log('[Demo] Demo meeting injected into history successfully.');
  } catch (e) {
    console.warn('[Demo] Could not inject demo meeting:', e.message);
  }
})();

/* ---- Router ---- */
let currentView = 'dashboard';
let currentMeetingId = null;

const VIEW_TITLES = {
  dashboard: 'Dashboard',
  record: 'New Recording',
  meetings: 'Meetings',
  settings: 'Settings',
  detail: 'Meeting',
};

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const next = document.getElementById('view' + cap(name));
  if (next) next.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navBtn = document.getElementById('nav' + cap(name));
  if (navBtn) navBtn.classList.add('active');

  document.getElementById('topbarTitle').textContent = VIEW_TITLES[name] || '';
  currentView = name;

  document.getElementById('sidebar').classList.remove('open');

  if (name === 'dashboard') refreshDashboard();
  if (name === 'meetings') refreshMeetingsList();
  if (name === 'settings') loadSettings();
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ---- Toast ---- */
let toastTimer = null;
function showToast(msg, duration = 2400) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), duration);
}

/* ---- Confirm modal ---- */
function showConfirm(title, body, onConfirm) {
  const overlay = document.getElementById('modalOverlay');
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').textContent = body;
  overlay.classList.add('open');

  const cleanup = () => overlay.classList.remove('open');
  document.getElementById('modalConfirm').onclick = () => { cleanup(); onConfirm(); };
  document.getElementById('modalCancel').onclick = cleanup;
}

/* ---- Helpers ---- */
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDuration(s) {
  if (!s) return '0s';
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m`;
}

/* ---- Dashboard ---- */
let _dashboardMeetings = []; // cached for search

async function refreshDashboard() {
  const meetings = await AppStorage.getMeetings();
  _dashboardMeetings = meetings;

  const stats = {
    count:        meetings.length,
    totalWords:   meetings.reduce((a, m) => a + (m.wordCount   || 0), 0),
    totalSeconds: meetings.reduce((a, m) => a + (m.durationSeconds || 0), 0),
  };
  document.getElementById('statMeetings').textContent = stats.count;
  document.getElementById('statTime').textContent = formatDuration(stats.totalSeconds);
  document.getElementById('statWords').textContent = stats.totalWords.toLocaleString();

  // Reset search box and show recent
  const searchEl = document.getElementById('dashSearchInput');
  if (searchEl) searchEl.value = '';
  renderMeetingCards('recentMeetings', meetings.slice(0, 5));
}

function searchTranscripts(query) {
  const container = document.getElementById('recentMeetings');
  const q = query.trim().toLowerCase();

  if (!q) {
    // Empty query — show recent 5
    renderMeetingCards('recentMeetings', _dashboardMeetings.slice(0, 5));
    return;
  }

  // Split query into words — ALL words must appear in the name OR transcript
  const words = q.split(/\s+/).filter(Boolean);

  const results = _dashboardMeetings.filter(m => {
    const name       = (m.name       || '').toLowerCase();
    const transcript = (m.transcript || '').toLowerCase();
    const combined   = name + ' ' + transcript;
    return words.every(w => combined.includes(w));
  });

  if (!results.length) {
    container.innerHTML = `
      <div class="empty-state empty-state--minimal">
        <div class="empty-folder-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </div>
        <p class="empty-state-text">No transcripts match &ldquo;${escHtml(query.trim())}&rdquo;</p>
      </div>`;
    return;
  }

  renderMeetingCards('recentMeetings', results);
}

/* ---- Meetings list ---- */
async function refreshMeetingsList() {
  renderMeetingCards('allMeetingsList', await AppStorage.getMeetings());
}

function renderMeetingCards(containerId, meetings) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  if (!meetings.length) {
    // Dashboard recent meetings: minimal empty state
    if (containerId === 'recentMeetings') {
      container.innerHTML = `
        <div class="empty-state empty-state--minimal">
          <div class="empty-folder-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <p class="empty-state-text">No recent activity</p>
        </div>`;
    } else {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎙️</div>
          <p>No meetings yet. Start your first recording.</p>
          <button class="btn-primary btn-sm" onclick="showView('record')">New Recording</button>
        </div>`;
    }
    return;
  }

  meetings.forEach(m => {
    const card = document.createElement('div');
    card.className = 'meeting-card';
    card.innerHTML = `
      <div class="mc-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      </div>
      <div class="mc-body">
        <div class="mc-title">${escHtml(m.name || 'Untitled Meeting')}</div>
        <div class="mc-meta">${formatDate(m.createdAt)} · ${formatDuration(m.durationSeconds || 0)} · ${(m.wordCount || 0).toLocaleString()} words</div>
      </div>
      <div class="mc-arrow">›</div>`;
    card.addEventListener('click', () => openMeeting(m.id));
    container.appendChild(card);
  });

  // Footer removed as requested
}

/* ---- Recording ---- */
let recorder = null;
let recordingData = null;

function initRecorder() {
  recorder = new MeetingRecorder({
    onTranscript({ final, interim }) {
      const body = document.getElementById('transcriptBody');
      const ph = body.querySelector('.placeholder-text');
      if (ph) ph.remove();

      if (final) {
        const interimEl = body.querySelector('.interim');
        if (interimEl) interimEl.remove();

        const seg = document.createElement('div');
        seg.className = 't-segment new';
        seg.innerHTML = `<div class="t-time">${escHtml(final.time)}</div><div class="t-text">${escHtml(final.text)}</div>`;
        body.appendChild(seg);
        body.scrollTop = body.scrollHeight;
        setTimeout(() => seg.classList.remove('new'), 2000);

        document.getElementById('saveSection').style.display = 'block';
      }

      if (interim !== undefined) {
        let span = body.querySelector('.interim');
        if (!span) {
          span = document.createElement('div');
          span.className = 't-segment interim';
          span.style.opacity = '0.5';
          body.appendChild(span);
        }
        span.innerHTML = `<div class="t-time">…</div><div class="t-text">${escHtml(interim)}</div>`;
        if (!interim) span.remove();
        body.scrollTop = body.scrollHeight;
      }
    },
    onStop(result) {
      recordingData = result;
    },
  });

  // Status indicator
  const dot = document.getElementById('statusDot');
  if (recorder.isSupported) {
    dot.classList.add('ready');
    dot.title = 'Web Speech API ready';
  } else {
    dot.classList.add('unavailable');
    dot.title = 'Speech API not supported — use Chrome or Edge';
  }

  // Draw idle baseline
  setTimeout(() => recorder._drawIdleLine(), 100);
}

function toggleRecording() {
  const btn = document.getElementById('btnRecord');
  const dot = document.getElementById('recDot');
  const statusText = document.getElementById('recStatusText');
  const hint = document.getElementById('recordHint');

  if (!recorder.isRecording) {
    recorder.start().then(() => {
      btn.classList.add('recording');
      dot.classList.add('recording');
      statusText.textContent = 'Recording…';
      hint.textContent = 'Click again to stop recording';
    });
  } else {
    recorder.stop();
    btn.classList.remove('recording');
    dot.classList.remove('recording');
    statusText.textContent = 'Stopped';
    hint.textContent = 'Save your meeting below, or start a new recording';
    document.getElementById('recTimer').textContent = '00:00';
  }
}

async function saveMeeting() {
  try {
    const segments = recordingData
      ? recordingData.segments
      : (recorder ? recorder.allSegments : []);

    if (!segments.length) {
      alert('Cannot save: Nothing recorded yet! Please press the microphone and speak something first.');
      return;
    }

    const nameInput = document.getElementById('meetingName');
    const name = nameInput.value.trim() || `Meeting — ${new Date().toLocaleDateString()}`;
    const durationSeconds = recordingData ? recordingData.durationSeconds : 0;
    const fullText = segments.map(s => s.text).join(' ');
    const wordCount = fullText.split(/\s+/).filter(Boolean).length;

    const meeting = {
      id: typeof AppStorage !== 'undefined' ? AppStorage.generateId() : Date.now().toString(),
      name,
      createdAt: new Date().toISOString(),
      durationSeconds,
      wordCount,
      transcript: fullText,
      segments,
      mom: null,
    };

    if (typeof AppStorage !== 'undefined') {
      await AppStorage.saveMeeting(meeting);
    } else {
      throw new Error("AppStorage is broken or didn't load. Your browser is caching the old version!");
    }

    showToast(`Meeting "${name}" saved`);

    // Reset
    nameInput.value = '';
    document.getElementById('transcriptBody').innerHTML = '<span class="placeholder-text">Your transcription will appear here as you speak…</span>';
    document.getElementById('saveSection').style.display = 'none';
    document.getElementById('recTimer').textContent = '00:00';
    recordingData = null;
    if (recorder) {
      recorder.allSegments = [];
      recorder._drawIdleLine();
    }

    openMeeting(meeting.id);
  } catch (err) {
    alert("AN ERROR OCCURRED WHILE SAVING: " + err.message + "\n\n" + err.stack);
    console.error(err);
  }
}

/* ---- Meeting Detail ---- */
function openMeeting(id) {
  const m = AppStorage.getMeeting(id);
  if (!m) return;
  currentMeetingId = id;

  document.getElementById('detailTitle').textContent = m.name || 'Untitled Meeting';
  document.getElementById('detailDate').textContent = formatDate(m.createdAt);
  document.getElementById('detailDuration').textContent = formatDuration(m.durationSeconds || 0);
  document.getElementById('detailWords').textContent = `${(m.wordCount || 0).toLocaleString()} words`;
  document.getElementById('detailTranscript').textContent = m.transcript || '(No transcript recorded)';

  const momEl = document.getElementById('detailMom');
  if (m.mom) {
    momEl.innerHTML = renderMoM(m.mom);
  } else {
    momEl.innerHTML = `<div class="empty-panel"><div class="loading-wrap"><div class="spinner"></div><span>Generating minutes…</span></div></div>`;
    // auto-generate
    setTimeout(() => generateMoM(id), 100);
  }

  showTab('transcript');

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('viewDetail').classList.add('active');
  document.getElementById('topbarTitle').textContent = m.name || 'Meeting';
  currentView = 'detail';
}

function showTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === name));
  document.getElementById('tabTranscript').classList.toggle('active', name === 'transcript');
  document.getElementById('tabMom').classList.toggle('active', name === 'mom');
}

/* ---- Minutes of Meeting Generator ---- */

/**
 * Generate MoM from a meeting's transcript and store it.
 * @param {string} id - meeting id
 */
async function generateMoM(id) {
  const m = AppStorage.getMeeting(id || currentMeetingId);
  if (!m) return;
  if (!m.transcript || m.transcript.trim().length < 20) {
    document.getElementById('detailMom').innerHTML =
      `<div class="empty-panel"><p>Transcript too short to generate minutes.</p></div>`;
    return;
  }

  const momEl = document.getElementById('detailMom');
  if (momEl) momEl.innerHTML = `<div class="loading-wrap"><div class="spinner"></div><span>Generating minutes…</span></div>`;

  const settings = AppStorage.getSettings();
  const mom = buildMoM(m, settings);
  AppStorage.updateMoM(m.id, mom);

  // If we're currently viewing this meeting, refresh the panel
  if (currentMeetingId === m.id && momEl) {
    momEl.innerHTML = renderMoM(mom);
  }
}

/**
 * Build a structured Minutes of Meeting object from transcript + metadata.
 */
function buildMoM(meeting, settings = {}) {
  const text = meeting.transcript || '';
  const sentences = text.match(/[^.!?]+[.!?]+/g) || text.split('\n').filter(Boolean);

  return {
    generatedAt: new Date().toISOString(),
    header: {
      title: meeting.name || 'Meeting',
      date: meeting.createdAt,
      duration: meeting.durationSeconds || 0,
      organiser: settings.momOrganiser || '',
      location: settings.momLocation || '',
      wordCount: meeting.wordCount || 0,
    },
    discussionPoints: extractDiscussionPoints(sentences),
    decisions: extractDecisions(sentences),
    actionItems: extractActionItems(sentences),
    closingNotes: extractClosingNotes(sentences),
    rawTranscript: text,
  };
}

/** Extract key discussion topics from sentences */
function extractDiscussionPoints(sentences) {
  const keywords = [
    /\bwe (need|should|must|have to|want to|plan to|are going to)\b/i,
    /\blet'?s\b/i,
    /\bthe (main|key|important|primary|critical)\b/i,
    /\b(discussed|talking about|mentioned|regarding|concerning|about)\b/i,
    /\b(issue|problem|challenge|concern|topic|point|question|update|status)\b/i,
    /\b(propose|suggest|recommend|idea|option|approach|solution)\b/i,
  ];
  const seen = new Set();
  const points = [];
  for (const s of sentences) {
    const clean = s.replace(/\s+/g, ' ').trim();
    if (clean.length < 15 || clean.length > 300) continue;
    if (keywords.some(k => k.test(clean))) {
      const norm = clean.toLowerCase().slice(0, 60);
      if (!seen.has(norm)) {
        seen.add(norm);
        points.push(cap1(clean));
        if (points.length >= 10) break;
      }
    }
  }
  // fallback: pick evenly-distributed sentences
  if (points.length < 3 && sentences.length > 0) {
    const step = Math.max(1, Math.floor(sentences.length / 5));
    for (let i = 0; i < sentences.length && points.length < 5; i += step) {
      const clean = sentences[i].replace(/\s+/g, ' ').trim();
      if (clean.length >= 15) points.push(cap1(clean));
    }
  }
  return points;
}

/** Extract decisions made */
function extractDecisions(sentences) {
  const keywords = [
    /\b(decided|agreed|confirmed|resolved|approved|accepted|finalized|settled on|chose|selected)\b/i,
    /\bwe (will|are going to|shall|are going with)\b/i,
    /\b(go ahead|move forward|proceed|sign off)\b/i,
    /\b(decision|conclusion|result|outcome)\b/i,
  ];
  const seen = new Set();
  const decisions = [];
  for (const s of sentences) {
    const clean = s.replace(/\s+/g, ' ').trim();
    if (clean.length < 15 || clean.length > 250) continue;
    if (keywords.some(k => k.test(clean))) {
      const norm = clean.toLowerCase().slice(0, 60);
      if (!seen.has(norm)) {
        seen.add(norm);
        decisions.push(cap1(clean));
        if (decisions.length >= 7) break;
      }
    }
  }
  return decisions;
}

/** Extract action items / follow-ups */
function extractActionItems(sentences) {
  const keywords = [
    /\b(action|follow.?up|task|to.?do|assign|responsible|owner|deadline|by (monday|tuesday|wednesday|thursday|friday|next week|tomorrow|end of|eod|eow))\b/i,
    /\b(will (send|share|update|check|review|prepare|create|build|fix|test|complete|schedule|reach out|contact|inform|look into|get back))\b/i,
    /\b(need to|needs to|must|has to|have to) (send|share|update|check|review|prepare|create|build|fix|test|complete|schedule|reach out)\b/i,
    /\b(please|make sure|ensure|don't forget)\b/i,
  ];
  const seen = new Set();
  const actions = [];
  for (const s of sentences) {
    const clean = s.replace(/\s+/g, ' ').trim();
    if (clean.length < 15 || clean.length > 250) continue;
    if (keywords.some(k => k.test(clean))) {
      const norm = clean.toLowerCase().slice(0, 60);
      if (!seen.has(norm)) {
        seen.add(norm);
        actions.push(cap1(clean));
        if (actions.length >= 10) break;
      }
    }
  }
  return actions;
}

/** Closing / next steps */
function extractClosingNotes(sentences) {
  const keywords = [
    /\b(next (meeting|session|call|sync|standup)|follow.?up meeting|reconvene|schedule)\b/i,
    /\b(next steps|going forward|moving forward|from here|the plan is)\b/i,
    /\b(wrap(ping)? up|closing|in summary|to summarize|overall|that'?s all|thank(s| you)( all| everyone)?)\b/i,
  ];
  const seen = new Set();
  const notes = [];
  for (const s of sentences) {
    const clean = s.replace(/\s+/g, ' ').trim();
    if (clean.length < 10 || clean.length > 250) continue;
    if (keywords.some(k => k.test(clean))) {
      const norm = clean.toLowerCase().slice(0, 60);
      if (!seen.has(norm)) {
        seen.add(norm);
        notes.push(cap1(clean));
        if (notes.length >= 5) break;
      }
    }
  }
  return notes;
}

function cap1(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

/**
 * Render a MoM object into HTML.
 */
function renderMoM(mom) {
  if (!mom) return '<div class="empty-panel"><p>No minutes available.</p></div>';

  const h = mom.header || {};
  const fmtDate = d => d ? new Date(d).toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }) : '—';

  const section = (title, icon, items, emptyMsg) => {
    const rows = items && items.length
      ? items.map(i => `<li>${escHtml(i)}</li>`).join('')
      : `<li class="mom-empty-item">${emptyMsg}</li>`;
    return `
      <div class="mom-section">
        <div class="mom-section-title">${icon} ${escHtml(title)}</div>
        <ul class="mom-list">${rows}</ul>
      </div>`;
  };

  return `
    <div class="mom-doc">
      <div class="mom-header">
        <div class="mom-doc-title">📋 Minutes of Meeting</div>
        <table class="mom-meta-table">
          <tr><td class="mom-meta-key">Meeting</td><td class="mom-meta-val">${escHtml(h.title || '—')}</td></tr>
          <tr><td class="mom-meta-key">Date &amp; Time</td><td class="mom-meta-val">${fmtDate(h.date)}</td></tr>
          <tr><td class="mom-meta-key">Duration</td><td class="mom-meta-val">${formatDuration(h.duration)}</td></tr>
          ${h.organiser ? `<tr><td class="mom-meta-key">Organiser</td><td class="mom-meta-val">${escHtml(h.organiser)}</td></tr>` : ''}
          ${h.location ? `<tr><td class="mom-meta-key">Location</td><td class="mom-meta-val">${escHtml(h.location)}</td></tr>` : ''}
          <tr><td class="mom-meta-key">Words Transcribed</td><td class="mom-meta-val">${(h.wordCount || 0).toLocaleString()}</td></tr>
          <tr><td class="mom-meta-key">Generated</td><td class="mom-meta-val">${fmtDate(mom.generatedAt)}</td></tr>
        </table>
      </div>

      <div class="mom-divider"></div>

      ${section('Key Discussion Points', '💬', mom.discussionPoints, 'Not enough context to extract discussion points.')}
      ${section('Decisions Made', '✅', mom.decisions, 'No explicit decisions detected in the transcript.')}
      ${section('Action Items &amp; Follow-ups', '📌', mom.actionItems, 'No action items detected in the transcript.')}
      ${section('Closing &amp; Next Steps', '🗓️', mom.closingNotes, 'No closing remarks or next steps detected.')}

      <div class="mom-footer">Generated automatically from transcript · MinutesMaster</div>
    </div>`;
}

/* ---- Download MoM as PDF on Letterhead (jsPDF) ---- */
async function downloadMomAsImage(id) {
  const m = AppStorage.getMeeting(id || currentMeetingId);
  if (!m || !m.mom) {
    showToast('No minutes to download — generate them first');
    return;
  }

  const btn = document.getElementById('btnDownloadLetterhead');
  if (btn) { btn.disabled = true; btn.textContent = 'Generating PDF…'; }

  try {
    const mom = m.mom;
    const h = mom.header || {};

    if (!window.jspdf) {
      showToast('PDF library not loaded yet — please wait and try again');
      return;
    }

    const { jsPDF } = window.jspdf;
    const lhSrc = (typeof LETTERHEAD_B64 !== 'undefined') ? LETTERHEAD_B64 : 'letterhead.png';

    // A4 PDF in mm units
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW  = 210;
    const pageH  = 297;
    const margin = 15;
    const cW     = pageW - margin * 2; // content width

    // ---- Page helper: draw letterhead background ----
    function addLetterheadBg() {
      pdf.addImage(lhSrc, 'JPEG', 0, 0, pageW, pageH);
    }

    // ---- Text helper: add text with page-break support ----
    // Returns new y after writing
    function writeText(text, x, y, opts = {}) {
      const { fontSize = 10, fontStyle = 'normal', color = [20, 20, 20], maxW = cW } = opts;
      pdf.setFontSize(fontSize);
      pdf.setFont('helvetica', fontStyle);
      pdf.setTextColor(...color);
      const lines = pdf.splitTextToSize(String(text), maxW);
      for (const line of lines) {
        if (y > pageH - 14) { // near bottom — new page
          pdf.addPage();
          addLetterheadBg();
          y = 42;
        }
        pdf.text(line, x, y);
        y += fontSize * 0.45;
      }
      return y;
    }

    // ---- Draw first page ----
    addLetterheadBg();

    // Start content below the RAIT header (~38mm gives clearance below the logo+address block)
    let y = 38;

    // Separator line
    pdf.setDrawColor(139, 0, 0);
    pdf.setLineWidth(0.6);
    pdf.line(margin, y, pageW - margin, y);
    y += 6;

    // Document title
    y = writeText('MINUTES OF MEETING', margin, y, {
      fontSize: 15, fontStyle: 'bold', color: [139, 0, 0],
    });
    y += 3;

    // Metadata
    const fmtDate = d => d ? new Date(d).toLocaleDateString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }) : '—';

    const metaRows = [
      ['Meeting',           h.title || '—'],
      ['Date & Time',       fmtDate(h.date)],
      ['Duration',          formatDuration(h.duration || 0)],
      ...(h.organiser ? [['Organiser', h.organiser]] : []),
      ...(h.location  ? [['Location',  h.location]]  : []),
      ['Words Transcribed', (h.wordCount || 0).toLocaleString()],
      ['Generated',         fmtDate(mom.generatedAt)],
    ];

    for (const [key, val] of metaRows) {
      if (y > pageH - 14) { pdf.addPage(); addLetterheadBg(); y = 42; }
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(80, 80, 80);
      pdf.text(key + ':', margin, y);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(20, 20, 20);
      const lines = pdf.splitTextToSize(String(val), cW - 42);
      pdf.text(lines, margin + 42, y);
      y += lines.length * 4.2 + 0.8;
    }
    y += 4;

    // ---- Section helper ----
    function addSection(title, items, emptyMsg) {
      if (y > pageH - 30) { pdf.addPage(); addLetterheadBg(); y = 42; }

      // Section heading
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(139, 0, 0);
      pdf.text(title, margin, y);
      y += 2;
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.3);
      pdf.line(margin, y, pageW - margin, y);
      y += 5;

      // Items
      const list = (items && items.length) ? items : [emptyMsg];
      pdf.setFontSize(9.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(30, 30, 30);
      for (const item of list) {
        if (y > pageH - 14) { pdf.addPage(); addLetterheadBg(); y = 42; }
        const lines = pdf.splitTextToSize('\u2022  ' + item, cW - 4);
        pdf.text(lines, margin + 2, y);
        y += lines.length * 4.5 + 1.5;
      }
      y += 5;
    }

    addSection('Key Discussion Points',    mom.discussionPoints, 'No discussion points detected.');
    addSection('Decisions Made',           mom.decisions,        'No explicit decisions detected.');
    addSection('Action Items & Follow-ups',mom.actionItems,      'No action items detected.');
    addSection('Closing & Next Steps',     mom.closingNotes,     'No closing remarks detected.');

    // Footer on every page
    const totalPages = pdf.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      pdf.setPage(p);
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(160, 160, 160);
      pdf.text(
        'Generated automatically \u00b7 MinutesMaster \u00b7 Ramrao Adik Institute of Technology',
        margin, pageH - 6
      );
      pdf.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 6, { align: 'right' });
    }

    // ---- Save via File System Access API (works on file://) ----
    const fileName = `${(m.name || 'meeting').replace(/\s+/g, '-')}-MoM-Letterhead.pdf`;
    if (window.showSaveFilePicker) {
      const pdfBlob = pdf.output('blob');
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: 'PDF Document', accept: { 'application/pdf': ['.pdf'] } }],
      });
      const writable = await fileHandle.createWritable();
      await writable.write(pdfBlob);
      await writable.close();
    } else {
      pdf.save(fileName);
    }

    showToast('PDF saved \u2713');
  } catch (err) {
    if (err && err.name === 'AbortError') return; // user cancelled Save dialog
    console.error('Letterhead PDF failed:', err);
    showToast('PDF generation failed \u2014 check console');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download MoM';
    }
  }
}

/* ---- Notice PDF Generator ---- */
function extractNoticeDetails(transcript) {
  const details = {
    date: 'Monday, 8th December 2025',
    room: '603',
    time: '2:00PM - 4:00PM',
    auditors: 'Dr. Sharad Jadhav, Dr. Sthuthi Rachel Joshua'
  };
  if (!transcript) return details;

  const text = transcript.toLowerCase();
  
  const dateMatch = text.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)?,? (\d{1,2}(st|nd|rd|th)? (january|february|march|april|may|june|july|august|september|october|november|december)( \d{4})?)/i);
  if (dateMatch) details.date = cap1(dateMatch[0]);

  const roomMatch = text.match(/room (\d{3,4}|\w+)/i);
  if (roomMatch) details.room = roomMatch[1].toUpperCase();

  const timeMatch = text.match(/(\d{1,2}(:\d{2})?\s*(am|pm))\s*(to|-)\s*(\d{1,2}(:\d{2})?\s*(am|pm))/i);
  if (timeMatch) details.time = `${timeMatch[1].toUpperCase()} - ${timeMatch[5].toUpperCase()}`;

  const audMatch = text.match(/auditors?(?: are| is)? ([a-z\s\.,]+?)(?:\.|and |$)/i);
  if (audMatch && audMatch[1].length > 5 && audMatch[1].length < 50) {
    details.auditors = cap1(audMatch[1].trim());
  }

  return details;
}

async function downloadNoticeAsPdf(id) {
  const m = AppStorage.getMeeting(id || currentMeetingId);
  if (!m) {
    showToast('No meeting selected');
    return;
  }

  const btn = document.getElementById('btnDownloadNotice');
  if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }

  try {
    if (!window.jspdf) {
      showToast('PDF library not loaded yet');
      return;
    }

    const { jsPDF } = window.jspdf;
    const lhSrc = (typeof LETTERHEAD_B64 !== 'undefined') ? LETTERHEAD_B64 : 'letterhead.png';

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW  = 210;
    const pageH  = 297;
    const margin = 20;

    pdf.addImage(lhSrc, 'JPEG', 0, 0, pageW, pageH);

    let y = 45;

    const centerText = (text, size, style = 'normal', color = [0,0,0]) => {
      pdf.setFontSize(size);
      pdf.setFont('times', style);
      pdf.setTextColor(...color);
      const tw = pdf.getStringUnitWidth(text) * size / pdf.internal.scaleFactor;
      pdf.text(text, (pageW - tw) / 2, y);
      y += (size * 0.45);
    };

    centerText('DEPARTMENT OF INFORMATION TECHNOLOGY', 14, 'bold');
    y += 1;
    centerText('Academic Year 2025-26', 12, 'bold');
    y += 1;
    centerText('ODD Semester', 12, 'bold');
    
    y += 8;
    centerText('Notice', 14, 'bold', [0, 0, 0]);
    y += 10;

    pdf.setFontSize(11);
    pdf.setFont('times', 'bold');
    pdf.text('Ref. No.: DYPU/RAIT/DOIT/2025/ODD/Notice/01', margin, y);
    
    const dateStr = `Date: ${new Date().toLocaleDateString('en-GB')}`;
    const dateW = pdf.getStringUnitWidth(dateStr) * 11 / pdf.internal.scaleFactor;
    pdf.text(dateStr, pageW - margin - dateW, y);
    
    y += 15;

    pdf.setFont('times', 'normal');
    pdf.setFontSize(12);
    const bodyText = "This is to inform all the mentors of Department of Information Technology, that Mentor file audit is scheduled as follows.";
    const lines = pdf.splitTextToSize(bodyText, pageW - margin * 2);
    pdf.text(lines, margin, y, { maxWidth: pageW - margin * 2, align: 'justify' });
    y += lines.length * 6 + 4;

    pdf.setFont('times', 'bold');
    pdf.text('Mentor File Audit Schedule:', margin, y);
    y += 8;

    const details = extractNoticeDetails(m.transcript);
    
    pdf.setFont('times', 'normal');
    pdf.text(`1. Date: ${details.date}`, margin + 10, y); y += 8;
    pdf.text(`2. Room No.: ${details.room}`, margin + 10, y); y += 8;
    pdf.text(`3. Time: ${details.time}`, margin + 10, y); y += 8;
    pdf.text(`4. Name of the Auditors: ${details.auditors}`, margin + 10, y); y += 15;

    y = pageH - 50; 
    pdf.setFont('times', 'bold');
    
    pdf.text('Mentor Co-ordinator', margin, y);
    pdf.text('Dr. Sthuthi Rachel Joshua', margin, y + 6);
    
    const hrdTitle = 'HOD IT';
    const hrdName = 'Dr. Sharad Jadhav';
    const hw = pdf.getStringUnitWidth(hrdName) * 12 / pdf.internal.scaleFactor;
    const titleW = pdf.getStringUnitWidth(hrdTitle) * 12 / pdf.internal.scaleFactor;
    
    pdf.text(hrdTitle, pageW - margin - titleW, y);
    pdf.text(hrdName, pageW - margin - hw, y + 6);

    const fileName = `Notice-${(m.name || 'meeting').replace(/\\s+/g, '-')}.pdf`;
    if (window.showSaveFilePicker) {
      const pdfBlob = pdf.output('blob');
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: 'PDF Document', accept: { 'application/pdf': ['.pdf'] } }],
      });
      const writable = await fileHandle.createWritable();
      await writable.write(pdfBlob);
      await writable.close();
    } else {
      pdf.save(fileName);
    }
    showToast('Notice PDF saved \u2713');
  } catch (err) {
    if (err && err.name === 'AbortError') return;
    console.error('Notice PDF failed:', err);
    showToast('Notice PDF generation failed');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>Download Notice';
    }
  }
}



/* ---- Settings ---- */
function loadSettings() {
  const s = AppStorage.getSettings();
  const organiserEl = document.getElementById('momOrganiser');
  const locationEl  = document.getElementById('momLocation');
  if (organiserEl) organiserEl.value = s.momOrganiser || '';
  if (locationEl)  locationEl.value  = s.momLocation  || '';

  const compat = document.getElementById('compatStatus');
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    compat.style.color = '#16a34a';
    compat.textContent = '✓ Supported in this browser';
  } else {
    compat.style.color = '#dc2626';
    compat.textContent = '✗ Not supported — please use Chrome or Edge';
  }
}

function saveSettings() {
  AppStorage.saveSettings({
    momOrganiser: (document.getElementById('momOrganiser').value || '').trim(),
    momLocation:  (document.getElementById('momLocation').value  || '').trim(),
  });
  const fb = document.getElementById('settingsFeedback');
  fb.textContent = 'Settings saved.';
  setTimeout(() => fb.textContent = '', 3000);
}

/* ---- Theme ---- */
function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  document.getElementById('iconSun').style.display = dark ? 'block' : 'none';
  document.getElementById('iconMoon').style.display = dark ? 'none' : 'block';
  localStorage.setItem('mm_theme', dark ? 'dark' : 'light');
}

function initTheme() {
  const saved = localStorage.getItem('mm_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved ? saved === 'dark' : prefersDark);
}

/* ---- Boot ---- */
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();

  // ── Load user info from auth ──────────────────────────────────────
  const username = AuthAPI.getUsername();
  const nameLabel = document.getElementById('userNameLabel');
  const avatar    = document.getElementById('userAvatar');
  if (nameLabel) nameLabel.textContent = username;
  if (avatar)    avatar.textContent    = (username[0] || 'U').toUpperCase();

  // Validate token with server (non-blocking)
  AuthAPI.checkAuth().then(user => {
    if (!user) return; // redirected to auth.html inside checkAuth
    if (user.username && nameLabel) {
      nameLabel.textContent = user.username;
      if (avatar) avatar.textContent = user.username[0].toUpperCase();
      localStorage.setItem('mm_username', user.username);
    }
  });

  // ── Logout ────────────────────────────────────────────────────────
  const logoutBtn = document.getElementById('btnLogout');
  if (logoutBtn) logoutBtn.addEventListener('click', () => {
    showConfirm('Log Out', 'Are you sure you want to log out?', () => AuthAPI.logout());
  });

  // ── Theme ──────────────────────────────────────────────────────────
  document.getElementById('themeToggle').addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    applyTheme(!isDark);
  });

  initRecorder();

  // Nav buttons
  document.querySelectorAll('.nav-item[data-view]').forEach(btn =>
    btn.addEventListener('click', () => showView(btn.dataset.view)));

  // Mobile sidebar
  document.getElementById('menuBtn').addEventListener('click', () =>
    document.getElementById('sidebar').classList.toggle('open'));
  document.getElementById('sidebarClose').addEventListener('click', () =>
    document.getElementById('sidebar').classList.remove('open'));

  // Dashboard — search transcript
  const dashSearchEl = document.getElementById('dashSearchInput');
  if (dashSearchEl) {
    dashSearchEl.addEventListener('input', (e) => searchTranscripts(e.target.value));
    // Clear on Escape
    dashSearchEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        dashSearchEl.value = '';
        searchTranscripts('');
        dashSearchEl.blur();
      }
    });
  }

  // Dashboard
  document.getElementById('quickRecord').addEventListener('click', () => showView('record'));

  // Recording
  document.getElementById('btnRecord').addEventListener('click', toggleRecording);
  document.getElementById('clearTranscript').addEventListener('click', () => {
    document.getElementById('transcriptBody').innerHTML =
      '<span class="placeholder-text">Your transcription will appear here as you speak…</span>';
    document.getElementById('saveSection').style.display = 'none';
    if (recorder) recorder.allSegments = [];
    recordingData = null;
  });
  document.getElementById('btnSaveMeeting').addEventListener('click', saveMeeting);

  // Detail view
  document.getElementById('btnBack').addEventListener('click', () => showView('meetings'));
  document.getElementById('btnDeleteDetail').addEventListener('click', () =>
    showConfirm('Delete Meeting', 'This will permanently delete the meeting and its transcript.', () => {
      AppStorage.deleteMeeting(currentMeetingId);
      showToast('Meeting deleted');
      showView('meetings');
    }));
  document.getElementById('btnDownloadLetterhead').addEventListener('click', () => downloadMomAsImage(currentMeetingId));
  const btnDNotice = document.getElementById('btnDownloadNotice');
  if (btnDNotice) btnDNotice.addEventListener('click', () => downloadNoticeAsPdf(currentMeetingId));

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn =>
    btn.addEventListener('click', () => showTab(btn.dataset.tab)));


  // Settings
  document.getElementById('btnSaveSettings').addEventListener('click', saveSettings);
  document.getElementById('btnClearAll').addEventListener('click', () =>
    showConfirm('Clear All Meetings', 'This will permanently delete ALL your meetings and cannot be undone.', () => {
      AppStorage.clearAll();
      showToast('All meetings cleared');
      refreshDashboard();
    }));

  // Initial load
  refreshDashboard();
  loadSettings();
});
