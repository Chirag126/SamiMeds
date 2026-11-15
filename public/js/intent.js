/**
 * "Wrong tab" helper: guesses what someone is trying to do from what they type,
 * so the app can offer to take them to the right place.
 *
 * Pure functions (no DOM), so they can be tested in Node.
 */

const MEDICINE = [
  /\b\d+(?:\.\d+)?\s?(?:mg|mcg|µg|ml|iu|units?)\b/i,
  /\b(?:tablets?|tabs?|capsules?|caps?|syrup|drops|injection|inhaler|puffs?)\b/i,
  /\b(?:od|bd|bid|tds|tid|qid|hs)\b/i,
  /\b(?:once|twice|thrice) (?:a |per )?(?:day|daily)\b/i,
  /\b(?:after|before) (?:food|meals?|breakfast|lunch|dinner)\b/i,
];

const VISIT = [
  /\bdr\.?\s+[a-z]/i,
  /\b(?:doctor|appointment|appt|clinic|hospital|check-?up|opd|consultation)\b/i,
  /\b(?:cardiolog\w*|ophthalmolog\w*|orthop\w*|neurolog\w*|endocrin\w*|dentist|dermatolog\w*|physician|nephrolog\w*)\b/i,
];

const MEMBER = [
  /\b(?:add|invite)\b.{0,30}\b(?:son|daughter|nurse|caretaker|family|member|grand(?:son|daughter))\b/i,
];

const PLACES = {
  report: /\b(?:weekly summary|report|print(?:out)?|pdf)\b/i,
  history: /\b(?:history|adherence|how many (?:doses|times)|missed doses)\b/i,
  alerts: /\b(?:notification|email log|reminder log|alerts?)\b/i,
};

const hits = (patterns, text) => patterns.filter((re) => re.test(text)).length;

/**
 * Which kind of thing the text describes: 'medicine' | 'visit' | 'member' | 'report' | 'history' | 'alerts' | null.
 * Only fairly sure answers are returned, so the helper doesn't pop up while someone types normally.
 */
export function detectIntent(raw) {
  const text = String(raw || '').trim();
  if (text.length < 6) return null;
  const med = hits(MEDICINE, text);
  const visit = hits(VISIT, text);
  const member = hits(MEMBER, text);
  if (member) return 'member';
  if (visit && visit >= med) return 'visit';
  if (med) return 'medicine';
  for (const [place, re] of Object.entries(PLACES)) if (re.test(text)) return place;
  return null;
}

/** What each form (or form field) is for. Fields not listed are never checked. */
export const FIELD_CONTEXT = {
  'medicine:name': 'medicine', 'medicine:ai': 'medicine', 'medicine:purpose': 'medicine', 'medicine:instructions': 'medicine',
  'visit:doctor': 'visit', 'visit:specialty': 'visit', 'visit:location': 'visit', 'visit:notes': 'visit',
  'member:name': 'member', 'member:relation': 'member',
};

/**
 * Returns the intent to suggest when the text doesn't belong where it is typed, or null.
 * Some mixes are normal and never flagged (e.g. "metformin" in a visit's notes is fine).
 */
export function wrongPlace(fieldKey, text) {
  const here = FIELD_CONTEXT[fieldKey];
  if (!here) return null;
  const intent = detectIntent(text);
  if (!intent || intent === here) return null;
  if (fieldKey === 'visit:notes' && intent === 'medicine') return null;
  if (fieldKey === 'medicine:purpose' && intent === 'visit') return null; // "For the heart doctor's advice"
  return intent;
}

/* ---------- pull useful details out of free text, to prefill the right form ---------- */

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const SPECIALTIES = [
  [/heart|cardio/i, 'Cardiology'], [/eye|ophthal/i, 'Ophthalmology'], [/sugar|diabet|endocrin/i, 'Endocrinology'],
  [/bone|knee|joint|ortho/i, 'Orthopedics'], [/skin|derma/i, 'Dermatology'], [/teeth|tooth|dental|dentist/i, 'Dentist'],
  [/kidney|nephro/i, 'Nephrology'], [/\bent\b|\bear\b|throat/i, 'ENT'], [/nerve|brain|neuro/i, 'Neurology'],
  [/lung|chest|pulmo/i, 'Pulmonology'], [/physician|general|family doctor/i, 'General physician'],
];

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function addDaysLocal(days, from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + days);
  return iso(d);
}

/** "Dr. Rao tomorrow 11am for heart" → { doctor, date, time, specialty } (any may be missing). */
export function extractVisit(raw, now = new Date()) {
  const text = String(raw || '');
  const out = {};
  const doc = /\bdr\.?\s*([a-z][a-z.'-]*(?:\s+[a-z][a-z.'-]*)?)/i.exec(text);
  if (doc) {
    const words = doc[1].split(/\s+/).filter((w) => !/^(?:at|on|for|tomorrow|today|next|in|this)$/i.test(w));
    if (words.length) out.doctor = `Dr. ${words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')}`;
  }
  const t = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(text);
  if (t) {
    let h = Number(t[1]) % 12;
    if (t[3].toLowerCase() === 'pm') h += 12;
    out.time = `${String(h).padStart(2, '0')}:${t[2] || '00'}`;
  }
  if (/\bday after tomorrow\b/i.test(text)) out.date = addDaysLocal(2, now);
  else if (/\btomorrow\b/i.test(text)) out.date = addDaysLocal(1, now);
  else if (/\btoday\b/i.test(text)) out.date = addDaysLocal(0, now);
  else if (/\bnext week\b/i.test(text)) out.date = addDaysLocal(7, now);
  else {
    const wd = WEEKDAYS.findIndex((d) => new RegExp(`\\b${d}\\b`, 'i').test(text));
    if (wd >= 0) out.date = addDaysLocal(((wd - now.getDay() + 7) % 7) || 7, now);
  }
  const spec = SPECIALTIES.find(([re]) => re.test(text));
  if (spec) out.specialty = spec[1];
  return out;
}

/** Human words for each place, used in the suggestion. */
export const INTENT_LABEL = {
  medicine: { what: 'This looks like a medicine.', go: 'Add it in Medicines' },
  visit: { what: 'This looks like a doctor visit.', go: 'Book it in Visits' },
  member: { what: 'This looks like adding a person.', go: 'Go to Circle' },
  report: { what: 'Looking for a report?', go: 'Open Reports' },
  history: { what: 'Looking for past doses?', go: 'Open History' },
  alerts: { what: 'Looking for reminders sent?', go: 'Open Alerts' },
};
