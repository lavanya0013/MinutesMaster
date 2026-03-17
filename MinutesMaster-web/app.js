/* =============================================
   APP.JS — MinutesMaster main controller
   ============================================= */

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
function refreshDashboard() {
  const stats = Storage.getStats();
  document.getElementById('statMeetings').textContent = stats.count;
  document.getElementById('statTime').textContent = formatDuration(stats.totalSeconds);
  document.getElementById('statWords').textContent = stats.totalWords.toLocaleString();
  renderMeetingCards('recentMeetings', Storage.getMeetings().slice(0, 5));
}

/* ---- Meetings list ---- */
function refreshMeetingsList() {
  renderMeetingCards('allMeetingsList', Storage.getMeetings());
}

function renderMeetingCards(containerId, meetings) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  if (!meetings.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎙️</div>
        <p>No meetings yet. Start your first recording.</p>
        <button class="btn-primary btn-sm" onclick="showView('record')">New Recording</button>
      </div>`;
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

function saveMeeting() {
  const segments = recordingData
    ? recordingData.segments
    : (recorder ? recorder.allSegments : []);

  if (!segments.length) {
    showToast('Nothing recorded yet — speak something first');
    return;
  }

  const nameInput = document.getElementById('meetingName');
  const name = nameInput.value.trim() || `Meeting — ${new Date().toLocaleDateString()}`;
  const durationSeconds = recordingData ? recordingData.durationSeconds : 0;
  const fullText = segments.map(s => s.text).join(' ');
  const wordCount = fullText.split(/\s+/).filter(Boolean).length;

  const meeting = {
    id: Storage.generateId(),
    name,
    createdAt: new Date().toISOString(),
    durationSeconds,
    wordCount,
    transcript: fullText,
    segments,
    summary: null,
  };

  Storage.saveMeeting(meeting);
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
}

/* ---- Meeting Detail ---- */
function openMeeting(id) {
  const m = Storage.getMeeting(id);
  if (!m) return;
  currentMeetingId = id;

  document.getElementById('detailTitle').textContent = m.name || 'Untitled Meeting';
  document.getElementById('detailDate').textContent = formatDate(m.createdAt);
  document.getElementById('detailDuration').textContent = formatDuration(m.durationSeconds || 0);
  document.getElementById('detailWords').textContent = `${(m.wordCount || 0).toLocaleString()} words`;
  document.getElementById('detailTranscript').textContent = m.transcript || '(No transcript recorded)';

  const summaryEl = document.getElementById('detailSummary');
  if (m.summary) {
    summaryEl.innerHTML = `<div class="summary-text">${escHtml(m.summary)}</div>`;
  } else {
    summaryEl.innerHTML = `
      <div class="empty-panel">
        <p>No summary yet. Click Generate Summary above.</p>
        <p class="hint-text">Requires <a href="https://ollama.ai" target="_blank">Ollama</a> running locally, or configure a provider in Settings.</p>
      </div>`;
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
  document.getElementById('tabSummary').classList.toggle('active', name === 'summary');
}

/* ---- AI Summary ---- */
async function generateSummary() {
  const m = Storage.getMeeting(currentMeetingId);
  if (!m) return;
  if (!m.transcript) { showToast('No transcript to summarize'); return; }

  const settings = Storage.getSettings();
  const provider = settings.aiProvider || 'ollama';
  const summaryEl = document.getElementById('detailSummary');

  summaryEl.innerHTML = `<div class="loading-wrap"><div class="spinner"></div><span>Generating summary…</span></div>`;

  try {
    let summary = '';
    if (provider === 'ollama') {
      summary = await callOllama(m.transcript, settings.ollamaModel || 'llama3');
    } else {
      summary = await callOpenAICompat(m.transcript, settings);
    }
    Storage.updateSummary(currentMeetingId, summary);
    summaryEl.innerHTML = `<div class="summary-text">${escHtml(summary)}</div>`;
    showToast('Summary generated');
  } catch (err) {
    summaryEl.innerHTML = `
      <div class="empty-panel">
        <p style="color:#dc2626">Error: ${escHtml(err.message)}</p>
        <p class="hint-text">Make sure Ollama is running: <code>ollama serve</code></p>
      </div>`;
    showToast('Summary failed — see the Summary tab for details');
  }
}

async function callOllama(text, model) {
  const res = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: buildPrompt(text), stream: false }),
  });
  if (!res.ok) throw new Error(`Ollama returned ${res.status}`);
  const data = await res.json();
  return data.response || '';
}

async function callOpenAICompat(text, settings) {
  const baseUrl = settings.baseUrl || 'https://api.openai.com/v1';
  const model = settings.modelName || 'gpt-4o';
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey || ''}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: buildPrompt(text) }],
    }),
  });
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

function buildPrompt(transcript) {
  return `You are a professional meeting note-taker. Analyze the transcript below and produce:

1. Summary (2-3 sentences)
2. Key Discussion Points (bullet list)
3. Action Items (what needs to be done, and by whom if mentioned)
4. Decisions Made

Be concise and clear.

TRANSCRIPT:
${transcript}`;
}

/* ---- Export ---- */
function exportMeeting(id) {
  const m = Storage.getMeeting(id);
  if (!m) return;
  const lines = [
    `# ${m.name || 'Meeting'}`,
    `Date: ${formatDate(m.createdAt)}`,
    `Duration: ${formatDuration(m.durationSeconds || 0)}`,
    `Words: ${m.wordCount || 0}`,
    '',
    '## Transcript',
    m.transcript || '(no transcript)',
  ];
  if (m.summary) lines.push('', '## AI Summary', m.summary);
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(m.name || 'meeting').replace(/\s+/g, '-')}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Meeting exported as Markdown');
}

function exportAll() {
  const meetings = Storage.getMeetings();
  if (!meetings.length) { showToast('No meetings to export'); return; }
  const blob = new Blob([JSON.stringify(meetings, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `minutesmaster-export-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('All meetings exported');
}

/* ---- Settings ---- */
function loadSettings() {
  const s = Storage.getSettings();
  const provider = s.aiProvider || 'ollama';
  document.getElementById('aiProvider').value = provider;
  document.getElementById('ollamaModel').value = s.ollamaModel || 'llama3';
  document.getElementById('apiKey').value = s.apiKey || '';
  document.getElementById('baseUrl').value = s.baseUrl || '';
  document.getElementById('modelName').value = s.modelName || '';
  updateProviderFields(provider);

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

function updateProviderFields(provider) {
  document.getElementById('settingOllamaModel').classList.toggle('hidden', provider !== 'ollama');
  document.getElementById('settingApiKey').classList.toggle('hidden', provider === 'ollama');
  document.getElementById('settingBaseUrl').classList.toggle('hidden', provider !== 'custom');
  document.getElementById('settingModel').classList.toggle('hidden', provider === 'ollama');
}

function saveSettings() {
  const provider = document.getElementById('aiProvider').value;
  Storage.saveSettings({
    aiProvider: provider,
    ollamaModel: document.getElementById('ollamaModel').value.trim(),
    apiKey: document.getElementById('apiKey').value.trim(),
    baseUrl: document.getElementById('baseUrl').value.trim(),
    modelName: document.getElementById('modelName').value.trim(),
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
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
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
      Storage.deleteMeeting(currentMeetingId);
      showToast('Meeting deleted');
      showView('meetings');
    }));
  document.getElementById('btnExportDetail').addEventListener('click', () =>
    exportMeeting(currentMeetingId));
  document.getElementById('btnGenerateSummary').addEventListener('click', generateSummary);

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn =>
    btn.addEventListener('click', () => showTab(btn.dataset.tab)));

  // Meetings view
  document.getElementById('exportAllBtn').addEventListener('click', exportAll);

  // Settings
  document.getElementById('aiProvider').addEventListener('change', e =>
    updateProviderFields(e.target.value));
  document.getElementById('btnSaveSettings').addEventListener('click', saveSettings);
  document.getElementById('btnClearAll').addEventListener('click', () =>
    showConfirm('Clear All Meetings', 'This will permanently delete ALL your meetings and cannot be undone.', () => {
      Storage.clearAll();
      showToast('All meetings cleared');
      refreshDashboard();
    }));

  // Initial load
  refreshDashboard();
  loadSettings();
});
