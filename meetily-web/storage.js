/* =============================================
   STORAGE.JS — localStorage meeting management
   ============================================= */

const STORAGE_KEY = 'meetily_meetings';
const SETTINGS_KEY = 'meetily_settings';

const Storage = {
  getMeetings() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch { return []; }
  },

  saveMeeting(meeting) {
    const meetings = this.getMeetings();
    const existing = meetings.findIndex(m => m.id === meeting.id);
    if (existing >= 0) meetings[existing] = meeting;
    else meetings.unshift(meeting);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meetings));
    return meeting;
  },

  getMeeting(id) {
    return this.getMeetings().find(m => m.id === id) || null;
  },

  updateSummary(id, summary) {
    const meetings = this.getMeetings();
    const m = meetings.find(m => m.id === id);
    if (m) {
      m.summary = summary;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(meetings));
    }
  },

  deleteMeeting(id) {
    const meetings = this.getMeetings().filter(m => m.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meetings));
  },

  clearAll() {
    localStorage.removeItem(STORAGE_KEY);
  },

  getSettings() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    } catch { return {}; }
  },

  saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },

  getStats() {
    const meetings = this.getMeetings();
    const totalWords = meetings.reduce((acc, m) => acc + (m.wordCount || 0), 0);
    const totalSeconds = meetings.reduce((acc, m) => acc + (m.durationSeconds || 0), 0);
    return {
      count: meetings.length,
      totalWords,
      totalSeconds,
    };
  },

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
};
