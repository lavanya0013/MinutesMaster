/* =============================================
   HELPERS/PROCESS-MEETING.JS
   Generate Summary, MoM, Notice from transcript
   ============================================= */

/**
 * Capitalize first letter of a string
 */
function cap1(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

/**
 * Split transcript into clean sentences
 */
function getSentences(transcript) {
  return (transcript.match(/[^.!?]+[.!?]+/g) || transcript.split('\n').filter(Boolean))
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(s => s.length > 10);
}

/**
 * Generate a short summary paragraph from the transcript
 */
function generateSummary(transcript) {
  const sentences = getSentences(transcript);
  const purposeKw = /\b(purpose|objective|reason|goal|agenda|discuss|inform|inform|review)\b/i;
  const decisionKw = /\b(decided|agreed|confirmed|resolved|postponed|rescheduled|approved|will be)\b/i;
  const actionKw = /\b(will|shall|must|requested|coordinate|notify|submit|draft|issue)\b/i;

  const purposeSentences = sentences.filter(s => purposeKw.test(s)).slice(0, 2);
  const decisionSentences = sentences.filter(s => decisionKw.test(s)).slice(0, 2);
  const actionSentences = sentences.filter(s => actionKw.test(s)).slice(0, 1);

  const picked = [...purposeSentences, ...decisionSentences, ...actionSentences];
  if (picked.length === 0) return cap1(sentences.slice(0, 3).join(' '));
  return cap1(picked.join(' '));
}

/**
 * Extract participants (any names mentioned after "Dr.", "Prof.", "Mr.", "Ms.")
 */
function extractParticipants(transcript) {
  const matches = transcript.match(/\b(Dr\.|Prof\.|Mr\.|Ms\.)\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?/g) || [];
  const unique = [...new Set(matches)];
  return unique.length > 0 ? unique : ['Department Faculty Members', 'Department Coordinator'];
}

/**
 * Extract key discussion points using keywords
 */
function extractDiscussion(transcript) {
  const sentences = getSentences(transcript);
  const kw = /\b(suggest|propose|concern|discuss|observe|raise|point|issue|overlap|conflict|difficulty|schedule|deadline)\b/i;
  const seen = new Set();
  const points = [];
  for (const s of sentences) {
    if (s.length < 20 || s.length > 300) continue;
    if (kw.test(s)) {
      const norm = s.toLowerCase().slice(0, 60);
      if (!seen.has(norm)) { seen.add(norm); points.push(cap1(s)); }
      if (points.length >= 5) break;
    }
  }
  if (points.length < 2) {
    const step = Math.max(1, Math.floor(sentences.length / 4));
    for (let i = 0; i < sentences.length && points.length < 4; i += step) {
      if (sentences[i].length > 20) points.push(cap1(sentences[i]));
    }
  }
  return points;
}

/**
 * Extract decisions
 */
function extractDecisions(transcript) {
  const sentences = getSentences(transcript);
  const kw = /\b(decided|agreed|confirmed|resolved|approved|postponed|rescheduled|will be|go ahead|finalized)\b/i;
  const seen = new Set();
  const decisions = [];
  for (const s of sentences) {
    if (s.length < 15 || s.length > 300) continue;
    if (kw.test(s)) {
      const norm = s.toLowerCase().slice(0, 60);
      if (!seen.has(norm)) { seen.add(norm); decisions.push(cap1(s)); }
      if (decisions.length >= 4) break;
    }
  }
  return decisions;
}

/**
 * Extract action items
 */
function extractActionItems(transcript) {
  const sentences = getSentences(transcript);
  const kw = /\b(will|shall|must|requested to|coordinate|notify|submit|draft|issue|prepare|follow up|inform|update)\b/i;
  const seen = new Set();
  const items = [];
  for (const s of sentences) {
    if (s.length < 15 || s.length > 300) continue;
    if (kw.test(s)) {
      const norm = s.toLowerCase().slice(0, 60);
      if (!seen.has(norm)) { seen.add(norm); items.push(cap1(s)); }
      if (items.length >= 6) break;
    }
  }
  return items;
}

/**
 * Extract old date and new date for notice
 */
function extractDateShift(transcript) {
  // Look for patterns like "22nd April" / "22 April" and "29th April"
  const dates = transcript.match(/\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+\d{4})?)\b/gi) || [];
  const unique = [...new Set(dates.map(d => d.trim()))];
  return {
    originalDate: unique[0] || '22nd April 2026',
    newDate: unique[1] || '29th April 2026',
  };
}

/**
 * Generate full Minutes of Meeting string
 */
function generateMoM(recording) {
  const { title, date, transcript } = recording;
  const participants = extractParticipants(transcript);
  const discussion   = extractDiscussion(transcript);
  const decisions    = extractDecisions(transcript);
  const actions      = extractActionItems(transcript);

  const lines = [];
  lines.push('MINUTES OF MEETING');
  lines.push('==================');
  lines.push(`Title    : ${title}`);
  lines.push(`Date     : ${date}`);
  lines.push(`Duration : ${recording.duration || '—'}`);
  lines.push('');
  lines.push('PARTICIPANTS:');
  participants.forEach(p => lines.push(`  • ${p}`));
  lines.push('');
  lines.push('KEY DISCUSSION POINTS:');
  discussion.forEach(d => lines.push(`  • ${d}`));
  lines.push('');
  lines.push('DECISIONS MADE:');
  if (decisions.length > 0) decisions.forEach(d => lines.push(`  • ${d}`));
  else lines.push('  • No explicit decisions recorded.');
  lines.push('');
  lines.push('ACTION ITEMS:');
  if (actions.length > 0) actions.forEach(a => lines.push(`  • ${a}`));
  else lines.push('  • No action items recorded.');
  lines.push('');
  lines.push('Meeting concluded successfully.');

  return lines.join('\n');
}

/**
 * Generate a formal Notice
 */
function generateNotice(recording) {
  const { transcript, date } = recording;
  const { originalDate, newDate } = extractDateShift(transcript);

  return `RAMRAO ADIK INSTITUTE OF TECHNOLOGY
Department of Information Technology
Academic Year 2025-26

NOTICE
------

Date: ${date}
Ref. No.: DYPU/RAIT/DOIT/2025/ODD/Notice/01

Subject: Rescheduling of Internal Examinations

All students of the Department of Information Technology are hereby informed that the Internal Examinations originally scheduled on ${originalDate} stand POSTPONED to ${newDate} due to scheduling conflicts with project submission deadlines.

Students are advised to note the revised examination schedule and prepare accordingly. No further changes to the schedule will be entertained.

For any queries, contact the Department Coordinator.

HOD IT
Dr. Sharad Jadhav
Department of Information Technology`;
}

/**
 * Main process function — returns { summary, mom, notice }
 */
function processMeeting(recording) {
  return {
    summary: generateSummary(recording.transcript),
    mom:     generateMoM(recording),
    notice:  generateNotice(recording),
  };
}

module.exports = { processMeeting };
