/**
 * Offline "smart" parser for medicine descriptions such as
 *   "Amlodipine 5mg once daily after breakfast"
 *   "Metformin 500 mg 1 tablet twice a day after meals, 60 tablets"
 * Used when Gemini isn't configured, and as a safety net if Gemini fails.
 */

const MEAL_TIMES = [
  [/before breakfast|empty stomach/i, '07:30'],
  [/after breakfast|with breakfast/i, '09:00'],
  [/before lunch/i, '12:30'],
  [/after lunch|with lunch/i, '14:00'],
  [/before dinner/i, '19:30'],
  [/after dinner|with dinner/i, '21:00'],
  [/bed ?time|at night|night|\bhs\b/i, '21:30'],
  [/morning/i, '08:00'],
  [/evening/i, '18:00'],
  [/afternoon/i, '14:00'],
];

const DEFAULT_TIMES = {
  1: ['09:00'],
  2: ['09:00', '21:00'],
  3: ['08:00', '14:00', '20:00'],
  4: ['08:00', '12:00', '16:00', '20:00'],
};

function frequency(text) {
  if (/\b(four times|qid|4 times)\b/i.test(text)) return 4;
  if (/\b(thrice|three times|tds|tid|3 times|every 8 ?h(ou)?rs?)\b/i.test(text)) return 3;
  if (/\b(twice|two times|bd|bid|2 times|every 12 ?h(ou)?rs?)\b/i.test(text)) return 2;
  if (/\b(once|one time|od|daily|every day|1 time)\b/i.test(text)) return 1;
  return null;
}

function explicitTimes(text) {
  const found = [];
  const re = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi;
  let m;
  while ((m = re.exec(text))) {
    let h = Number(m[1]) % 12;
    if (m[3].toLowerCase() === 'pm') h += 12;
    found.push(`${String(h).padStart(2, '0')}:${m[2] || '00'}`);
  }
  return found;
}

export function parseMedicineText(input) {
  const text = String(input || '').trim();
  const result = {
    name: '',
    dose: '',
    pillDescription: '',
    times: [],
    instructions: '',
    pillsPerDose: 1,
    stock: null,
  };
  if (!text) return result;

  const doseMatch = text.match(/(\d+(?:\.\d+)?)\s?(mg|mcg|µg|g|ml|iu|units?)\b/i);
  if (doseMatch) result.dose = `${doseMatch[1]} ${doseMatch[2].toLowerCase()}`;

  const nameEnd = doseMatch ? doseMatch.index : text.search(/\b(once|twice|thrice|daily|\d)/i);
  result.name = text
    .slice(0, nameEnd > 0 ? nameEnd : undefined)
    .replace(/[,-]+$/, '')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join(' ')
    .replace(/^\w/, (c) => c.toUpperCase());

  const pills = text.match(/\b(\d+|one|two|half)\s+(tablets?|tabs?|capsules?|caps?|pills?)\b/i);
  if (pills) {
    const n = { one: 1, two: 2, half: 0.5 }[pills[1].toLowerCase()] ?? Number(pills[1]);
    if (/^\d+$/.test(pills[1]) && Number(pills[1]) >= 10) {
      result.stock = n; // "60 tablets" is a pack size, not a dose
    } else {
      result.pillsPerDose = n;
      result.pillDescription = `${pills[1]} ${pills[2].toLowerCase()}`;
    }
  }
  const pack = text.match(/\b(\d{2,3})\s*(tablets?|tabs?|capsules?|pills?)\b/i);
  if (pack) result.stock = Number(pack[1]);

  const inst = text.match(/\b((?:before|after|with)\s+(?:food|meals?|breakfast|lunch|dinner)|empty stomach|at bed ?time|at night)\b/i);
  if (inst) result.instructions = inst[1].toLowerCase();

  const explicit = explicitTimes(text);
  const count = frequency(text);
  if (explicit.length) {
    result.times = explicit;
  } else {
    const mealTimes = [];
    for (const [re, time] of MEAL_TIMES) {
      if (re.test(text) && !mealTimes.includes(time)) mealTimes.push(time);
    }
    if (count && mealTimes.length === count) result.times = mealTimes;
    else if (count === 1 && mealTimes.length) result.times = [mealTimes[0]];
    else if (count) result.times = DEFAULT_TIMES[count];
    else if (mealTimes.length) result.times = mealTimes.slice(0, 4);
    else result.times = DEFAULT_TIMES[1];
  }
  result.times = [...new Set(result.times)].sort();
  if (!result.pillDescription) result.pillDescription = `${result.pillsPerDose === 0.5 ? 'half' : result.pillsPerDose} tablet`;
  return result;
}
