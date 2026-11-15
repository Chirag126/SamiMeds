/**
 * Timezone helpers.
 * All scheduling works in the elder's *local wall-clock* time, expressed as
 * "local epoch minutes" (days since 1970-01-01 × 1440 + minutes of day).
 * That avoids offset arithmetic and daylight-saving surprises.
 */

const formatterCache = new Map();

function formatter(tz) {
  if (!formatterCache.has(tz)) {
    formatterCache.set(
      tz,
      new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        weekday: 'short',
      }),
    );
  }
  return formatterCache.get(tz);
}

export function isValidTimezone(tz) {
  try {
    formatter(tz);
    return true;
  } catch {
    return false;
  }
}

const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Local date ("YYYY-MM-DD"), minutes of day and weekday for an instant in a timezone. */
export function localParts(date, tz) {
  const parts = Object.fromEntries(formatter(tz).formatToParts(date).map((p) => [p.type, p.value]));
  const dateStr = `${parts.year}-${parts.month}-${parts.day}`;
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  return { date: dateStr, minutes, weekday: WEEKDAYS[parts.weekday], epoch: localEpoch(dateStr, minutes) };
}

export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function dayNumber(dateStr) {
  return Math.floor(Date.parse(`${dateStr}T00:00:00Z`) / 86_400_000);
}

/** Local epoch minutes for a date + minutes (or "HH:MM"). */
export function localEpoch(dateStr, time) {
  const minutes = typeof time === 'string' ? toMinutes(time) : time;
  return dayNumber(dateStr) * 1440 + minutes;
}

export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Inclusive list of dates from `from` to `to`. */
export function dateRange(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function formatTime12(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function friendlyDate(dateStr) {
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}
