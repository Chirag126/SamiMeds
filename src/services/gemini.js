import { config } from '../config.js';
import { parseMedicineText } from './parser.js';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export const geminiEnabled = () => Boolean(config.geminiApiKey);

const MEDICINE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    dose: { type: 'STRING', description: 'Strength, e.g. "5 mg"' },
    pillDescription: { type: 'STRING', description: 'What to take each time, e.g. "1 tablet"' },
    pillsPerDose: { type: 'NUMBER' },
    times: { type: 'ARRAY', items: { type: 'STRING', description: '24h HH:MM' } },
    instructions: { type: 'STRING', description: 'e.g. "after breakfast"' },
    purpose: { type: 'STRING', description: 'What it is for, in 2-5 simple words an elderly person understands' },
    stock: { type: 'NUMBER', nullable: true },
  },
  required: ['name', 'times'],
};

async function callGemini(prompt, schema, { timeoutMs = 8000 } = {}) {
  const res = await fetch(`${ENDPOINT}/${encodeURIComponent(config.geminiModel)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': config.geminiApiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.1 },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty Gemini response');
  return JSON.parse(text);
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Keeps only well-formed fields from model output; never trusts it blindly. */
export function sanitizeParsed(raw, fallback) {
  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const times = Array.isArray(raw?.times) ? raw.times.filter((t) => TIME_RE.test(t)).slice(0, 8) : [];
  const ppd = Number(raw?.pillsPerDose);
  const stock = Number(raw?.stock);
  return {
    name: str(raw?.name, 80) || fallback.name,
    dose: str(raw?.dose, 40) || fallback.dose,
    pillDescription: str(raw?.pillDescription, 60) || fallback.pillDescription,
    pillsPerDose: Number.isFinite(ppd) && ppd > 0 && ppd <= 10 ? ppd : fallback.pillsPerDose,
    times: times.length ? [...new Set(times)].sort() : fallback.times,
    instructions: str(raw?.instructions, 120) || fallback.instructions,
    purpose: str(raw?.purpose, 80) || '',
    stock: Number.isInteger(stock) && stock >= 0 && stock < 10000 ? stock : fallback.stock,
  };
}

/** Turns free text into a medicine form. Gemini when configured, offline parser otherwise. */
export async function parseMedicine(text) {
  const local = parseMedicineText(text);
  if (!geminiEnabled()) return { ...local, purpose: '', source: 'local' };
  try {
    const prompt = `You help families set up medicine schedules for an elderly person in India.
Extract the medicine from this description. Use 24-hour HH:MM times that match the instructions
(e.g. after breakfast ≈ 09:00, after dinner ≈ 21:00). Keep "purpose" very simple (e.g. "For blood pressure").
Description: """${String(text).slice(0, 500)}"""`;
    const raw = await callGemini(prompt, MEDICINE_SCHEMA);
    return { ...sanitizeParsed(raw, local), source: 'gemini' };
  } catch (err) {
    console.warn('[gemini] falling back to local parser:', err.message);
    return { ...local, purpose: '', source: 'local' };
  }
}
