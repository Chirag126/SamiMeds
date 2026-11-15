import { localEpoch, toMinutes, addDays, dateRange } from './time.js';

/** Escalation timings, in minutes relative to the scheduled dose time. */
export const ESCALATION = Object.freeze({
  upcomingAt: -10, // friendly "coming up" reminder to the elder
  secondAt: 30, // gentle second reminder if not taken
  familyAt: 60, // family/caretaker alert, dose marked missed
  onTimeWindow: 30, // taken within 30 min counts as on time
  snoozeMinutes: 15,
  maxSnoozes: 3,
  dueSoonWindow: 30, // show on the elder's "now" card this many minutes early
  staleAfter: 12 * 60, // after an outage, doses older than this become missed silently
});

export const doseId = (medicineId, date, time) => `${medicineId}_${date}_${time.replace(':', '')}`;

/**
 * Builds the pending dose instances for one medicine on one date.
 * Times earlier than the moment the medicine was added (on its first day) are skipped,
 * so adding a medicine at 2 PM never triggers a "missed 8 AM dose" alert.
 */
export function plannedDoses(medicine, date, startEpoch = -Infinity) {
  if (!medicine.active) return [];
  if (medicine.endDate && date > medicine.endDate) return [];
  return medicine.times
    .filter((t) => localEpoch(date, t) >= startEpoch)
    .map((time) => ({
      id: doseId(medicine.id, date, time),
      circleId: medicine.circleId,
      medicineId: medicine.id,
      date,
      time,
      status: 'pending',
      takenAt: null,
      takenBy: null,
      lateMinutes: null,
      snoozeUntil: null,
      snoozeCount: 0,
      upcomingSent: false,
      secondSent: false,
      snoozeNotified: true,
      familyAlerted: false,
    }));
}

/** Minutes elapsed since the dose was due (negative if still in the future). */
export function elapsedMinutes(dose, nowEpoch) {
  return nowEpoch - localEpoch(dose.date, dose.time);
}

/**
 * Pure escalation step. Returns the field updates and the notifications to send.
 * When the server catches up after downtime it only sends the most relevant message,
 * never a burst of three emails.
 */
export function evaluateDose(dose, nowEpoch) {
  const actions = [];
  const updates = {};
  if (dose.status !== 'pending') return { updates, actions };

  const elapsed = elapsedMinutes(dose, nowEpoch);

  if (elapsed >= ESCALATION.staleAfter && !dose.familyAlerted) {
    // Too old to be useful as an alert (e.g. the server was down overnight).
    Object.assign(updates, { status: 'missed', familyAlerted: true, upcomingSent: true, secondSent: true, snoozeNotified: true });
    return { updates, actions };
  }

  if (elapsed >= ESCALATION.familyAt) {
    if (!dose.familyAlerted) {
      actions.push('family-missed');
      Object.assign(updates, { familyAlerted: true, upcomingSent: true, secondSent: true, snoozeNotified: true });
    }
    updates.status = 'missed';
    return { updates, actions };
  }

  // Snoozed: wait until the snooze ends, then remind once.
  if (dose.snoozeUntil != null && nowEpoch < dose.snoozeUntil) return { updates, actions };
  if (dose.snoozeUntil != null && !dose.snoozeNotified) {
    actions.push('elder-snooze');
    Object.assign(updates, { snoozeNotified: true, upcomingSent: true });
    if (elapsed >= ESCALATION.secondAt) updates.secondSent = true;
    return { updates, actions };
  }

  if (elapsed >= ESCALATION.secondAt) {
    if (!dose.secondSent) {
      actions.push('elder-second');
      Object.assign(updates, { secondSent: true, upcomingSent: true });
    }
  } else if (elapsed >= ESCALATION.upcomingAt && !dose.upcomingSent) {
    actions.push('elder-upcoming');
    updates.upcomingSent = true;
  }
  return { updates, actions };
}

/** Applies a "taken" mark. Returns the updated dose. */
export function markTaken(dose, { nowEpoch, at, by }) {
  const late = Math.max(0, elapsedMinutes(dose, nowEpoch));
  return { ...dose, status: 'taken', takenAt: at, takenBy: by, lateMinutes: late, snoozeUntil: null };
}

export function markSnoozed(dose, nowEpoch) {
  if (dose.status !== 'pending') throw new Error('Only pending doses can be snoozed');
  if (dose.snoozeCount >= ESCALATION.maxSnoozes) throw new Error('Snooze limit reached');
  return {
    ...dose,
    snoozeUntil: nowEpoch + ESCALATION.snoozeMinutes,
    snoozeCount: dose.snoozeCount + 1,
    snoozeNotified: false,
  };
}

export function undoTaken(dose, nowEpoch) {
  const elapsed = elapsedMinutes(dose, nowEpoch);
  return {
    ...dose,
    status: elapsed >= ESCALATION.familyAt ? 'missed' : 'pending',
    takenAt: null,
    takenBy: null,
    lateMinutes: null,
  };
}

/** A dose "counts" toward adherence once it is taken, skipped or past the missed threshold. */
export function isSettled(dose, nowEpoch) {
  return dose.status === 'taken' || dose.status === 'missed' || dose.status === 'skipped' ||
    elapsedMinutes(dose, nowEpoch) >= ESCALATION.familyAt;
}

/** Adherence summary over a list of doses. */
export function adherence(doses, nowEpoch) {
  const settled = doses.filter((d) => isSettled(d, nowEpoch) && d.status !== 'skipped');
  const taken = settled.filter((d) => d.status === 'taken');
  const onTime = taken.filter((d) => (d.lateMinutes ?? 0) <= ESCALATION.onTimeWindow);
  const missed = settled.length - taken.length;
  return {
    total: settled.length,
    taken: taken.length,
    onTime: onTime.length,
    missed,
    rate: settled.length ? Math.round((taken.length / settled.length) * 100) : null,
  };
}

/**
 * Number of consecutive fully-taken days, ending today (if today is complete)
 * or yesterday. Days without any scheduled dose are skipped, not counted.
 */
export function streak(doses, today) {
  const byDate = new Map();
  for (const d of doses) {
    if (!byDate.has(d.date)) byDate.set(d.date, []);
    byDate.get(d.date).push(d);
  }
  const allTaken = (list) => list.every((d) => d.status === 'taken' || d.status === 'skipped');

  let count = 0;
  let day = today;
  const todays = byDate.get(today);
  if (todays && allTaken(todays)) count += 1;
  day = addDays(today, -1);
  const earliest = [...byDate.keys()].sort()[0];
  while (earliest && day >= earliest) {
    const list = byDate.get(day);
    if (list) {
      if (!allTaken(list)) break;
      count += 1;
    }
    day = addDays(day, -1);
  }
  return count;
}

/** Per-medicine adherence, used for the history bars. */
export function adherenceByMedicine(doses, nowEpoch) {
  const groups = new Map();
  for (const d of doses) {
    if (!groups.has(d.medicineId)) groups.set(d.medicineId, []);
    groups.get(d.medicineId).push(d);
  }
  return Object.fromEntries([...groups].map(([id, list]) => [id, adherence(list, nowEpoch)]));
}

/** Picks the dose for the elder's big "now" card and the next one after it. */
export function pickNow(doses, nowEpoch) {
  const pending = doses
    .filter((d) => d.status === 'pending' || d.status === 'missed')
    .sort((a, b) => localEpoch(a.date, a.time) - localEpoch(b.date, b.time));

  const visible = pending.filter((d) => {
    const elapsed = elapsedMinutes(d, nowEpoch);
    const snoozed = d.snoozeUntil != null && nowEpoch < d.snoozeUntil;
    // Missed doses stay visible for 3 hours so the elder can still take them late.
    return !snoozed && elapsed >= -ESCALATION.dueSoonWindow && elapsed < 180;
  });
  const now = visible[0] || null;
  const next = pending.find((d) => d !== now && elapsedMinutes(d, nowEpoch) < -ESCALATION.dueSoonWindow) || null;
  const snoozed = pending.find((d) => d.snoozeUntil != null && nowEpoch < d.snoozeUntil) || null;
  return { now, next, snoozed };
}

export function datesBetween(from, to) {
  return dateRange(from, to);
}

export { toMinutes };
