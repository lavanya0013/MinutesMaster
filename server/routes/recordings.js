/* =============================================
   ROUTES/RECORDINGS.JS — Demo Recordings API
   ============================================= */
const express = require('express');
const path    = require('path');
const fs      = require('fs');
const { processMeeting } = require('../helpers/processMeeting');

const router     = express.Router();
const DATA_FILE  = path.join(__dirname, '../data/recordings.json');

/** Load recordings from JSON file */
function loadRecordings() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

// ─── GET /api/recordings  — list all (id, title, date, duration) ──────
router.get('/', (req, res) => {
  const recordings = loadRecordings();
  const list = recordings.map(({ id, title, date, duration, createdAt, wordCount }) => ({
    id, title, date, duration, createdAt, wordCount,
  }));
  res.json(list);
});

// ─── GET /api/recordings/:id  — single recording with transcript ──────
router.get('/:id', (req, res) => {
  const recordings = loadRecordings();
  const rec = recordings.find(r => r.id === req.params.id);
  if (!rec) return res.status(404).json({ error: 'Recording not found.' });
  res.json({
    id: rec.id,
    title: rec.title,
    date: rec.date,
    duration: rec.duration,
    createdAt: rec.createdAt,
    wordCount: rec.wordCount,
    transcript: rec.transcript,
  });
});

// ─── POST /api/recordings/:id/process  — generate summary/MoM/notice ─
router.post('/:id/process', (req, res) => {
  const recordings = loadRecordings();
  const rec = recordings.find(r => r.id === req.params.id);
  if (!rec) return res.status(404).json({ error: 'Recording not found.' });
  const result = processMeeting(rec);
  res.json(result);
});

module.exports = router;
