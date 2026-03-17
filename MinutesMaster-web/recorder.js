/* =============================================
   RECORDER.JS — Audio recording + Web Speech API
   ============================================= */

class MeetingRecorder {
  constructor({ onTranscript, onStop }) {
    this.onTranscript = onTranscript;
    this.onStop = onStop;

    this.recognition = null;
    this.isRecording = false;
    this.startTime = null;
    this.timerInterval = null;
    this.allSegments = [];

    this.canvas = document.getElementById('waveCanvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.analyser = null;
    this.animFrame = null;
    this.mediaStream = null;
    this.audioCtx = null;

    this._initSpeechAPI();
  }

  get isSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  _initSpeechAPI() {
    if (!this.isSupported) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SR();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (e) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      if (final) {
        const seg = { time: this._elapsed(), text: final.trim() };
        this.allSegments.push(seg);
        this.onTranscript({ final: seg, interim: '' });
      } else {
        this.onTranscript({ final: null, interim: interim.trim() });
      }
    };

    this.recognition.onerror = (e) => {
      if (e.error === 'no-speech') return;
      if (e.error === 'aborted') return;
      console.warn('Speech recognition error:', e.error);
    };

    this.recognition.onend = () => {
      if (this.isRecording) {
        try { this.recognition.start(); } catch (_) {}
      }
    };
  }

  _elapsed() {
    if (!this.startTime) return '0:00';
    const s = Math.floor((Date.now() - this.startTime) / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  _startTimer() {
    const el = document.getElementById('recTimer');
    this.startTime = Date.now();
    this.timerInterval = setInterval(() => {
      if (!this.startTime) return;
      const s = Math.floor((Date.now() - this.startTime) / 1000);
      const mm = String(Math.floor(s / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      if (el) el.textContent = `${mm}:${ss}`;
    }, 500);
  }

  _stopTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    const elapsed = this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0;
    this.startTime = null;
    return elapsed;
  }

  async _startWaveform() {
    if (!this.ctx) return;
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      const src = this.audioCtx.createMediaStreamSource(this.mediaStream);
      src.connect(this.analyser);
      this._drawWave();
    } catch (e) {
      console.warn('Waveform not available:', e);
    }
  }

  _stopWaveform() {
    cancelAnimationFrame(this.animFrame);
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.analyser = null;
    if (this.ctx) this._drawIdleLine();
  }

  _drawIdleLine() {
    if (!this.ctx) return;
    const c = this.canvas;
    c.width = c.offsetWidth * window.devicePixelRatio;
    const w = c.width, h = c.height;
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.strokeStyle = '#e2e4e9';
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.moveTo(0, h / 2);
    this.ctx.lineTo(w, h / 2);
    this.ctx.stroke();
  }

  _drawWave() {
    if (!this.analyser || !this.ctx) return;
    const c = this.canvas;
    c.width = c.offsetWidth * window.devicePixelRatio;
    const w = c.width, h = c.height;
    const buf = new Uint8Array(this.analyser.frequencyBinCount);

    const draw = () => {
      this.animFrame = requestAnimationFrame(draw);
      this.analyser.getByteTimeDomainData(buf);
      this.ctx.clearRect(0, 0, w, h);
      this.ctx.strokeStyle = '#2563eb';
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      const sliceW = w / buf.length;
      let x = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = buf[i] / 128.0;
        const y = (v * h) / 2;
        i === 0 ? this.ctx.moveTo(x, y) : this.ctx.lineTo(x, y);
        x += sliceW;
      }
      this.ctx.lineTo(w, h / 2);
      this.ctx.stroke();
    };
    draw();
  }

  async start() {
    if (this.isRecording) return;
    if (!this.isSupported) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }
    this.isRecording = true;
    this.allSegments = [];
    this._startTimer();
    await this._startWaveform();
    try { this.recognition.start(); } catch (_) {}
  }

  stop() {
    if (!this.isRecording) return null;
    this.isRecording = false;
    const durationSeconds = this._stopTimer();
    this._stopWaveform();
    try { this.recognition.stop(); } catch (_) {}
    const result = { segments: [...this.allSegments], durationSeconds };
    this.allSegments = [];
    this.onStop(result);
    return result;
  }
}
