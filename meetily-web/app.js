/* =============================================
   APP.JS — Main application controller
   ============================================= */

/* ---- Router ---- */
const Views = {
  dashboard: { el: null, nav: null, title: 'Dashboard' },
  record:    { el: null, nav: null, title: 'New Recording' },
  meetings:  { el: null, nav: null, title: 'Meetings' },
  settings:  { el: null, nav: null, title: 'Settings' },
  detail:    { el: null, nav: null, title: 'Meeting Detail' },
};

let currentView = 'dashboard';
let currentMeetingId = null;

function showView(name) {
  const prev = document.getElementById('view' + cap(currentView));
  if (prev) prev.classList.remove('active');
  const next = document.getElementById('view' + cap(name));
  if (next) next.classList.add('active');

  // Nav highlight
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navBtn = document.getElementById('nav' + cap(name));
  if (navBtn) navBtn.classList.add('active');

  document.getElementById('topbarTitle').textContent = Views[name]?.title || '';
  currentView = name;

  // Close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');

  // Refresh view-specific content
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

  const confirmBtn = document.getElementById('modalConfirm');
  const cancelBtn = document.getElementById('modalCancel');

  const cleanup = () => overlay.classList.remove('open');
  const onC = () => { cleanup(); onConfirm(); };
  const onX = () => cleanup();

  confirmBtn.onclick = onC;
  cancelBtn.onclick = onX;
}

/* ---- Dashboard ---- */
function refreshDashboard() {
  const stats = Storage.getStats();
  document.getElementById('statMeetings').textContent = stats.count;
  document.getElementById('statTime').textContent = formatDuration(stats.totalSeconds);
  document.getElementById('statWords').textContent = stats.totalWords.toLocaleString();

  const container = document.getElementById('recentMeetings');
  const meetings = Storage.getMeetings().slice(0, 5);
  renderMeetingCards(container, meetings, true);
}

function formatDuration(s) {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m`;
}

function renderMeetingCards(container, meetings, showEmpty = true) {
  container.innerHTML = '';
  if (!meetings.length) {
    if (showEmpty) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎙️</div>
          <p>No meetings yet. Start your first recording!</p>
          <button class="btn-secondary" onclick="showView('record')">Start Recording</button>
        </div>`;
    }
    return;
  }
  meetings.forEach(m => {
    const card = document.createElement('div');
    card.className = 'meeting-card';
    card.innerHTML = `
      <div class="meeting-card-icon">🎙️</div>
      <div class="meeting-card-body">
        <div class="meeting-card-title">${escHtml(m.name || 'Untitled Meeting')}</div>
        <div class="meeting-card-meta">${formatDate(m.createdAt)} · ${formatDuration(m.durationSeconds || 0)} · ${(m.wordCount || 0).toLocaleString()} words</div>
      </div>
      <div class="meeting-card-arrow">›</div>`;
    card.addEventListener('click', () => openMeeting(m.id));
    container.appendChild(card);
  });
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ---- Meetings list ---- */
function refreshMeetingsList() {
  const container = document.getElementById('allMeetingsList');
  const meetings = Storage.getMeetings();
  renderMeetingCards(container, meetings, true);
}

/* ---- Recording ---- */
let recorder = null;
let interimEl = null;
let recordingData = null;

function initRecorder() {
  recorder = new MeetingRecorder({
    onTranscript({ final, interim }) {
      const body = document.getElementById('transcriptBody');
      // Remove placeholder
      const ph = body.querySelector('.transcript-placeholder');
      if (ph) ph.remove();

      if (final) {
        // Remove interim span if exists
        const interimSpan = body.querySelector('.interim');
        if (interimSpan) interimSpan.remove();

        const seg = document.createElement('div');
        seg.className = 'transcript-segment new';
        seg.innerHTML = `<div class="seg-time">${final.time}</div><div class="seg-text">${escHtml(final.text)}</div>`;
        body.appendChild(seg);
        body.scrollTop = body.scrollHeight;

        // Fade new highlight
        setTimeout(() => seg.classList.remove('new'), 2000);

        // Show save section
        document.getElementById('saveSection').style.display = 'block';
      }

      if (interim !== undefined) {
        let span = body.querySelector('.interim');
        if (!span) {
          span = document.createElement('div');
          span.className = 'transcript-segment interim';
          span.style.opacity = '0.5';
          span.style.fontStyle = 'italic';
          body.appendChild(span);
        }
        span.innerHTML = `<div class="seg-time">…</div><div class="seg-text">${escHtml(interim)}</div>`;
        if (!interim) span.remove();
        body.scrollTop = body.scrollHeight;
      }
    },

    onStop(result) {
      recordingData = result;
    }
  });

  // Check status dot
  const dot = document.getElementById('statusDot');
  if (recorder.isSupported) {
    dot.classList.add('ready');
    dot.title = 'Web Speech API ready';
  } else {
    dot.classList.add('unavailable');
    dot.title = 'Speech API not supported (use Chrome/Edge)';
  }

  // Draw idle waveform
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
      hint.textContent = 'Click again to stop';
    });
  } else {
    recorder.stop();
    btn.classList.remove('recording');
    dot.classList.remove('recording');
    statusText.textContent = 'Recording stopped';
    hint.textContent = 'Save your meeting below or start a new recording';
    document.getElementById('recTimer').textContent = '00:00';
  }
}

function saveMeeting() {
  if (!recordingData && (!recorder || !recorder.allSegments.length)) {
    showToast('⚠️ Nothing to save — record some audio first');
    return;
  }
  const nameInput = document.getElementById('meetingName');
  const name = nameInput.value.trim() || `Meeting ${new Date().toLocaleDateString()}`;
  const segments = recordingData ? recordingData.segments : (recorder ? recorder.allSegments : []);
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
  showToast(`✅ Meeting "${name}" saved!`);

  // Reset UI
  nameInput.value = '';
  document.getElementById('transcriptBody').innerHTML = '<div class="transcript-placeholder">Transcription will appear here as you speak…</div>';
  document.getElementById('saveSection').style.display = 'none';
  document.getElementById('recTimer').textContent = '00:00';
  recordingData = null;
  recorder._drawIdleLine();

  // Open the saved meeting
  openMeeting(meeting.id);
}

/* ---- Meeting Detail ---- */
function openMeeting(id) {
  const m = Storage.getMeeting(id);
  if (!m) return;
  currentMeetingId = id;
  Views.detail.title = m.name || 'Meeting';
  document.getElementById('topbarTitle').textContent = m.name || 'Meeting';

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
      <div class="summary-placeholder">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        <p>Click "Generate Summary" to create an AI-powered summary.</p>
        <p class="hint">Requires <a href="https://ollama.ai" target="_blank">Ollama</a> running locally (port 11434), or configure an API in Settings.</p>
      </div>`;
  }

  // Reset to transcript tab
  showTab('transcript');

  // Switch all nav highlights off, open detail view
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('viewDetail').classList.add('active');
  currentView = 'detail';
}

function showTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.getElementById('tabTranscript').classList.toggle('active', name === 'transcript');
  document.getElementById('tabSummary').classList.toggle('active', name === 'summary');
}

/* ---- AI Summary ---- */
async function generateSummary() {
  const m = Storage.getMeeting(currentMeetingId);
  if (!m) return;
  if (!m.transcript) { showToast('⚠️ No transcript to summarize'); return; }

  const settings = Storage.getSettings();
  const provider = settings.aiProvider || 'ollama';
  const summaryEl = document.getElementById('detailSummary');

  summaryEl.innerHTML = `<div class="summary-loading"><div class="spinner"></div><p style="color:var(--text-secondary)">Generating summary…</p></div>`;

  try {
    let summary = '';

    if (provider === 'ollama') {
      summary = await callOllama(m.transcript, settings.ollamaModel || 'llama3');
    } else if (provider === 'openai' || provider === 'groq' || provider === 'custom') {
      summary = await callOpenAICompat(m.transcript, settings);
    } else {
      throw new Error('Unknown provider');
    }

    Storage.updateSummary(currentMeetingId, summary);
    summaryEl.innerHTML = `<div class="summary-text">${escHtml(summary)}</div>`;
    showToast('✅ Summary generated!');
  } catch (err) {
    summaryEl.innerHTML = `
      <div class="summary-placeholder">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        <p style="color:var(--red)">Failed: ${escHtml(err.message)}</p>
        <p class="hint">Make sure Ollama is running: <code>ollama serve</code></p>
      </div>`;
    showToast('❌ Summary failed — see details in the Summary tab');
  }
}

async function callOllama(text, model) {
  const prompt = buildPrompt(text);
  const res = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false }),
  });
  if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.response || '';
}

async function callOpenAICompat(text, settings) {
  const baseUrl = settings.baseUrl || 'https://api.openai.com/v1';
  const model = settings.modelName || 'gpt-4o';
  const apiKey = settings.apiKey || '';
  const prompt = buildPrompt(text);

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

function buildPrompt(transcript) {
  return `You are an expert meeting summarizer. Analyze the following meeting transcript and provide:

1. **Summary** (2-3 sentences overview)
2. **Key Discussion Points** (bullet points)
3. **Action Items** (what needs to be done, by whom if mentioned)
4. **Decisions Made** (key decisions reached)

Keep the summary concise and actionable.

TRANSCRIPT:
${transcript}`;
}

/* ---- Export ---- */
function exportMeeting(id) {
  const m = Storage.getMeeting(id);
  if (!m) return;
  const content = [
    `# ${m.name || 'Meeting'}`,
    `Date: ${formatDate(m.createdAt)}`,
    `Duration: ${formatDuration(m.durationSeconds || 0)}`,
    `Words: ${m.wordCount || 0}`,
    '',
    '## Transcript',
    m.transcript || '(no transcript)',
    '',
    m.summary ? '## AI Summary\n' + m.summary : '',
  ].join('\n');

  const blob = new Blob([content], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(m.name || 'meeting').replace(/\s+/g, '-')}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('📥 Meeting exported!');
}

function exportAll() {
  const meetings = Storage.getMeetings();
  if (!meetings.length) { showToast('No meetings to export'); return; }
  const data = JSON.stringify(meetings, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `meetily-export-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('📦 All meetings exported!');
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

  // Browser compat check
  const compat = document.getElementById('compatStatus');
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    compat.style.color = 'var(--green)';
    compat.textContent = '✓ Web Speech API supported in this browser';
  } else {
    compat.style.color = 'var(--red)';
    compat.textContent = '✗ Web Speech API not supported — please use Chrome or Edge';
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
  const settings = {
    aiProvider: provider,
    ollamaModel: document.getElementById('ollamaModel').value.trim(),
    apiKey: document.getElementById('apiKey').value.trim(),
    baseUrl: document.getElementById('baseUrl').value.trim(),
    modelName: document.getElementById('modelName').value.trim(),
  };
  Storage.saveSettings(settings);
  const fb = document.getElementById('settingsFeedback');
  fb.textContent = '✓ Settings saved successfully!';
  setTimeout(() => fb.textContent = '', 3000);
}

/* ---- Event listeners ---- */
document.addEventListener('DOMContentLoaded', () => {
  // Init recorder
  initRecorder();

  // Nav
  document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });

  // Sidebar toggle
  document.getElementById('menuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
  document.getElementById('sidebarClose').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
  });

  // Record controls
  document.getElementById('btnRecord').addEventListener('click', toggleRecording);
  document.getElementById('quickRecord').addEventListener('click', () => showView('record'));
  document.getElementById('emptyStartBtn')?.addEventListener('click', () => showView('record'));

  document.getElementById('clearTranscript').addEventListener('click', () => {
    document.getElementById('transcriptBody').innerHTML = '<div class="transcript-placeholder">Transcription will appear here as you speak…</div>';
    document.getElementById('saveSection').style.display = 'none';
    if (recorder) recorder.allSegments = [];
    recordingData = null;
  });

  document.getElementById('btnSaveMeeting').addEventListener('click', saveMeeting);

  // Detail controls
  document.getElementById('btnBack').addEventListener('click', () => {
    showView('meetings');
  });

  document.getElementById('btnDeleteDetail').addEventListener('click', () => {
    showConfirm('Delete Meeting', 'This will permanently delete this meeting and its transcript.', () => {
      Storage.deleteMeeting(currentMeetingId);
      showToast('Meeting deleted');
      showView('meetings');
    });
  });

  document.getElementById('btnExportDetail').addEventListener('click', () => {
    exportMeeting(currentMeetingId);
  });

  document.getElementById('btnGenerateSummary').addEventListener('click', generateSummary);

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => showTab(btn.dataset.tab));
  });

  // Export all
  document.getElementById('exportAllBtn').addEventListener('click', exportAll);

  // Settings
  document.getElementById('aiProvider').addEventListener('change', (e) => updateProviderFields(e.target.value));
  document.getElementById('btnSaveSettings').addEventListener('click', saveSettings);

  document.getElementById('btnClearAll').addEventListener('click', () => {
    showConfirm('Clear All Meetings', 'This will permanently delete ALL your meetings. This cannot be undone.', () => {
      Storage.clearAll();
      showToast('All meetings cleared');
      refreshDashboard();
    });
  });

  // Init dashboard
  refreshDashboard();
  loadSettings();
});
