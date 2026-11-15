import { C } from '../store/index.js';
import { config } from '../config.js';
import { newId } from './auth.js';
import { localParts, addDays, localEpoch, formatTime12, friendlyDate } from './time.js';
import {
  plannedDoses, evaluateDose, adherence, adherenceByMedicine, streak, pickNow, elapsedMinutes,
} from './doses.js';
import { daysLeft, needsRefill } from './refill.js';
import { evaluateAppointment, plainSpecialty } from './appointments.js';
import { googleCalendarLink } from './calendar.js';
import { sendEmail } from './email.js';
import { publish } from './events.js';

export const nowFor = (circle, date = new Date()) => localParts(date, circle.timezone);

const appUrl = (path = '/') => (config.publicUrl ? `${config.publicUrl}${path}` : '');
const cta = (label, path) => (config.publicUrl ? { label, url: appUrl(path) } : undefined);

/* ---------------------------------------------------------------- people */

export async function circleMembers(store, circleId) {
  return store.query(C.members, [['circleId', '==', circleId]]);
}

export const publicMember = (m) => ({
  id: m.id, name: m.name, role: m.role, email: m.email || '', phone: m.phone || '', relation: m.relation || '',
});

export function elderOf(members) {
  return members.find((m) => m.role === 'elderly') || null;
}

export const familyEmails = (members) =>
  members.filter((m) => m.role !== 'elderly' && m.email).map((m) => m.email);

export const elderEmails = (members) =>
  members.filter((m) => m.role === 'elderly' && m.email).map((m) => m.email);

/* -------------------------------------------------------------- activity */

export async function logActivity(store, { circleId, actor, action, detail, forElderly = false }) {
  const entry = {
    id: newId('a_'),
    circleId,
    at: new Date().toISOString(),
    actorName: actor?.name || 'SamiMeds',
    actorRole: actor?.role || 'system',
    action,
    detail: String(detail || '').slice(0, 300),
    // The elder sees changes others make to their care, and can respond.
    forElderly: forElderly && actor?.role !== 'elderly',
    ack: null,
  };
  await store.put(C.activity, entry);
  return entry;
}

/* ----------------------------------------------------------------- doses */

export async function activeMedicines(store, circleId) {
  const meds = await store.query(C.medicines, [['circleId', '==', circleId]]);
  return meds.filter((m) => m.active);
}

/**
 * Makes sure a dose record exists for every scheduled time on the given dates.
 * Returns all doses (existing + new) for those dates.
 */
export async function ensureDoses(store, circleId, medicines, dates) {
  const existing = await store.query(C.doses, [['circleId', '==', circleId], ['date', 'in', dates]]);
  const have = new Set(existing.map((d) => d.id));
  const created = [];
  for (const med of medicines) {
    for (const date of dates) {
      for (const dose of plannedDoses(med, date, med.startEpoch ?? -Infinity)) {
        if (have.has(dose.id)) continue;
        dose.medicineName = med.name;
        await store.put(C.doses, dose);
        created.push(dose);
      }
    }
  }
  return [...existing, ...created];
}

/** Removes pending doses that no longer match a medicine's schedule (after edit/delete). */
export async function prunePendingDoses(store, medicine, fromDate) {
  const doses = await store.query(C.doses, [['medicineId', '==', medicine.id]]);
  for (const d of doses) {
    const stillScheduled = medicine.active && medicine.times.includes(d.time);
    if (d.status === 'pending' && d.date >= fromDate && !stillScheduled) await store.del(C.doses, d.id);
  }
}

export async function dosesBetween(store, circleId, from, to) {
  const list = await store.query(C.doses, [['circleId', '==', circleId], ['date', '>=', from]]);
  return list.filter((d) => d.date <= to);
}

function decorateDose(dose, medsById, nowEpoch) {
  const med = medsById.get(dose.medicineId);
  return {
    ...dose,
    elapsed: elapsedMinutes(dose, nowEpoch),
    time12: formatTime12(dose.time),
    medicine: med
      ? {
        id: med.id, name: med.name, dose: med.dose, pillDescription: med.pillDescription, purpose: med.purpose,
        instructions: med.instructions, color: med.color, shape: med.shape, hasPhoto: Boolean(med.hasPhoto), photoVersion: med.photoVersion,
      }
      : { id: dose.medicineId, name: dose.medicineName || 'Medicine (removed)' },
  };
}

/* ------------------------------------------------------------ today view */

export async function buildToday(store, circle) {
  const now = nowFor(circle);
  const meds = await activeMedicines(store, circle.id);
  const allMeds = await store.query(C.medicines, [['circleId', '==', circle.id]]);
  const medsById = new Map(allMeds.map((m) => [m.id, m]));
  const yesterday = addDays(now.date, -1);

  const recent = await ensureDoses(store, circle.id, meds, [yesterday, now.date]);
  const todays = recent
    .filter((d) => d.date === now.date)
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((d) => decorateDose(d, medsById, now.epoch));
  const picks = pickNow(recent, now.epoch);
  const decorate = (d) => (d ? decorateDose(d, medsById, now.epoch) : null);

  const history = await dosesBetween(store, circle.id, addDays(now.date, -60), now.date);
  const appts = await upcomingAppointments(store, circle);
  const moods = await store.query(C.moods, [['circleId', '==', circle.id], ['date', '==', now.date]]);
  const updates = (await store.query(C.activity, [['circleId', '==', circle.id], ['forElderly', '==', true]]))
    .filter((a) => !a.ack)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 3);

  return {
    date: now.date,
    dateLabel: friendlyDate(now.date),
    minutes: now.minutes,
    doses: todays,
    now: decorate(picks.now),
    next: decorate(picks.next),
    snoozed: decorate(picks.snoozed),
    progress: {
      taken: todays.filter((d) => d.status === 'taken').length,
      total: todays.filter((d) => d.status !== 'skipped').length,
    },
    streak: streak(history.filter((d) => d.date < now.date || d.status !== 'pending'), now.date),
    nextAppointment: appts[0] || null,
    appointments: appts,
    mood: moods.sort((a, b) => b.at.localeCompare(a.at))[0] || null,
    updates,
    lowStock: meds.filter(needsRefill).map((m) => ({ id: m.id, name: m.name, daysLeft: daysLeft(m) })),
  };
}

/* ---------------------------------------------------------- appointments */

export function decorateAppointment(appt, circle) {
  return {
    ...appt,
    time12: formatTime12(appt.time),
    dateLabel: friendlyDate(appt.date),
    plainSpecialty: plainSpecialty(appt.specialty),
    calendarUrl: googleCalendarLink(appt, circle.timezone),
  };
}

export async function upcomingAppointments(store, circle) {
  const now = nowFor(circle);
  const list = await store.query(C.appointments, [['circleId', '==', circle.id]]);
  return list
    .filter((a) => a.status === 'upcoming' && localEpoch(a.date, a.time) >= now.epoch - 120)
    .sort((a, b) => localEpoch(a.date, a.time) - localEpoch(b.date, b.time))
    .map((a) => decorateAppointment(a, circle));
}

/* ---------------------------------------------------------------- stats */

export async function buildStats(store, circle, days = 7) {
  const now = nowFor(circle);
  const from = addDays(now.date, -(days - 1));
  const doses = await dosesBetween(store, circle.id, from, now.date);
  const meds = await store.query(C.medicines, [['circleId', '==', circle.id]]);
  const moods = (await store.query(C.moods, [['circleId', '==', circle.id], ['date', '>=', from]]))
    .sort((a, b) => a.at.localeCompare(b.at));

  const daily = [];
  for (let d = from; d <= now.date; d = addDays(d, 1)) {
    const list = doses.filter((x) => x.date === d);
    const dayMoods = moods.filter((m) => m.date === d);
    daily.push({ date: d, ...adherence(list, now.epoch), mood: dayMoods.at(-1)?.mood || null });
  }
  const byMed = adherenceByMedicine(doses, now.epoch);
  return {
    from,
    to: now.date,
    overall: adherence(doses, now.epoch),
    daily,
    medicines: meds.map((m) => ({
      id: m.id, name: m.name, active: m.active, daysLeft: daysLeft(m), ...(byMed[m.id] || adherence([], now.epoch)),
    })),
    moods: moods.map((m) => ({ date: m.date, mood: m.mood, at: m.at })),
    missed: doses
      .filter((d) => d.status === 'missed')
      .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))
      .map((d) => ({ ...d, time12: formatTime12(d.time), medicineName: meds.find((m) => m.id === d.medicineId)?.name || d.medicineName })),
  };
}

/* -------------------------------------------------------------- reports */

const MOOD_WORD = { good: 'Good 😊', okay: 'Okay 😐', unwell: 'Not well 😟' };

export async function buildWeeklySummary(store, circle) {
  const stats = await buildStats(store, circle, 7);
  const members = await circleMembers(store, circle.id);
  const appts = await store.query(C.appointments, [['circleId', '==', circle.id]]);
  const done = appts.filter((a) => a.status === 'done' && a.date >= stats.from && a.date <= stats.to);
  const upcoming = await upcomingAppointments(store, circle);
  const meds = await activeMedicines(store, circle.id);
  const moodCounts = stats.moods.reduce((acc, m) => ({ ...acc, [m.mood]: (acc[m.mood] || 0) + 1 }), {});

  const lines = [
    `Weekly summary for ${circle.elderName} (${friendlyDate(stats.from)} – ${friendlyDate(stats.to)}).`,
    stats.overall.total
      ? `Medicines: ${stats.overall.taken} of ${stats.overall.total} doses taken (${stats.overall.rate}%), ${stats.overall.onTime} on time.`
      : 'Medicines: no doses were due this week.',
    stats.missed.length
      ? `Missed: ${stats.missed.slice(0, 5).map((d) => `${d.medicineName} on ${d.date} at ${d.time12}`).join('; ')}${stats.missed.length > 5 ? '…' : ''}.`
      : 'No missed doses this week. 🌟',
    `Doctor visits: ${done.length} done${upcoming[0] ? `, next is ${upcoming[0].doctor} on ${upcoming[0].dateLabel} at ${upcoming[0].time12}` : ', none booked'}.`,
    stats.moods.length
      ? `Mood: ${Object.entries(moodCounts).map(([k, n]) => `${MOOD_WORD[k]} ×${n}`).join(', ')}.`
      : 'Mood: no check-ins this week.',
  ];
  const low = meds.filter(needsRefill);
  if (low.length) lines.push(`Running low: ${low.map((m) => `${m.name} (${daysLeft(m)} days left)`).join(', ')}.`);

  return { subject: `SamiMeds weekly summary – ${circle.elderName}`, lines, stats, recipients: familyEmails(members) };
}

export async function buildDoctorReport(store, circle) {
  const stats = await buildStats(store, circle, 30);
  const meds = await activeMedicines(store, circle.id);
  const members = await circleMembers(store, circle.id);
  const appts = (await store.query(C.appointments, [['circleId', '==', circle.id]]))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6)
    .map((a) => decorateAppointment(a, circle));
  return {
    generatedAt: new Date().toISOString(),
    circle: { elderName: circle.elderName, timezone: circle.timezone, emergencyPhone: circle.emergencyPhone },
    caregivers: members.filter((m) => m.role !== 'elderly').map(publicMember),
    medicines: meds.map((m) => ({
      name: m.name, dose: m.dose, pillDescription: m.pillDescription, purpose: m.purpose, instructions: m.instructions,
      times: m.times.map(formatTime12), adherence: stats.medicines.find((x) => x.id === m.id),
    })),
    stats,
    appointments: appts,
  };
}

/* -------------------------------------------------------------- scheduler */

function doseEmail(action, dose, med, circle) {
  const what = `${med?.pillDescription || 'your medicine'} – ${med?.name || dose.medicineName}${med?.dose ? ` ${med.dose}` : ''}`;
  const when = formatTime12(dose.time);
  const extra = med?.instructions ? `Remember: ${med.instructions}.` : '';
  switch (action) {
    case 'elder-upcoming':
      return { subject: `💊 ${when}: time for ${med?.name || 'your medicine'}`, lines: [`Hello ${circle.elderName},`, `At ${when} please take ${what}.`, extra, 'Tap "I took it" in SamiMeds when done.'] };
    case 'elder-second':
      return { subject: `🔔 Gentle reminder: ${med?.name || 'medicine'} (${when})`, lines: [`Hello ${circle.elderName},`, `Your ${when} medicine is still waiting: ${what}.`, extra, 'Tap "I took it" once you have taken it.'] };
    case 'elder-snooze':
      return { subject: `⏰ Reminder: ${med?.name || 'medicine'} now`, lines: [`Hello ${circle.elderName},`, `You asked us to remind you. Please take ${what} now.`, extra] };
    default:
      return { subject: `⚠️ ${circle.elderName} hasn't confirmed the ${when} ${med?.name || 'medicine'}`, lines: [`${circle.elderName} has not confirmed taking ${what} that was due at ${when} on ${friendlyDate(dose.date)}.`, 'You may want to give them a call to check in.'] };
  }
}

/**
 * One scheduler pass for one circle: dose escalation, appointment reminders,
 * refill alerts and the Sunday-evening weekly summary.
 */
export async function runCircleTick(store, circle, at = new Date()) {
  const now = nowFor(circle, at);
  const sent = [];
  const members = await circleMembers(store, circle.id);
  const elder = elderEmails(members);
  const family = familyEmails(members);
  const meds = await activeMedicines(store, circle.id);
  const medsById = new Map(meds.map((m) => [m.id, m]));

  const doses = await ensureDoses(store, circle.id, meds, [addDays(now.date, -1), now.date]);
  for (const dose of doses) {
    const { updates, actions } = evaluateDose(dose, now.epoch);
    if (!Object.keys(updates).length) continue;
    await store.put(C.doses, { ...dose, ...updates });
    if (updates.status) publish(circle.id);
    for (const action of actions) {
      const med = medsById.get(dose.medicineId);
      const mail = doseEmail(action, dose, med, circle);
      const to = action === 'family-missed' ? family : elder;
      sent.push(await sendEmail(store, { circleId: circle.id, to, kind: action, subject: mail.subject, lines: mail.lines.filter(Boolean), cta: cta('Open SamiMeds', '/') }));
    }
  }

  const appts = await store.query(C.appointments, [['circleId', '==', circle.id], ['status', '==', 'upcoming']]);
  for (const appt of appts) {
    const { updates, actions } = evaluateAppointment(appt, now.epoch);
    if (!actions.length) continue;
    await store.put(C.appointments, { ...appt, ...updates });
    const a = decorateAppointment(appt, circle);
    const lines = [
      `${circle.elderName} has a doctor visit on ${a.dateLabel} at ${a.time12}.`,
      `Doctor: ${appt.doctor}${appt.specialty ? ` (${a.plainSpecialty})` : ''}.`,
      appt.location && `Where: ${appt.location}.`,
      appt.checklist?.length && `Please bring: ${appt.checklist.join(', ')}.`,
    ].filter(Boolean);
    const subject = actions[0] === 'morning'
      ? `🩺 Today ${a.time12}: visit to ${appt.doctor}`
      : `🩺 Coming up: ${appt.doctor} on ${a.dateLabel}`;
    sent.push(await sendEmail(store, { circleId: circle.id, to: [...elder, ...family], kind: `appointment-${actions[0]}`, subject, lines, cta: { label: 'Add to Google Calendar', url: a.calendarUrl } }));
  }

  for (const med of meds) {
    if (needsRefill(med) && !med.refillAlertSent) {
      await store.put(C.medicines, { ...med, refillAlertSent: true });
      sent.push(await sendEmail(store, {
        circleId: circle.id, to: family, kind: 'refill', subject: `🛒 Refill soon: ${med.name} for ${circle.elderName}`,
        lines: [`${med.name} has about ${daysLeft(med)} day(s) left (${med.stock} pills).`, 'Please arrange a refill and update the stock in SamiMeds.'],
      }));
    }
  }

  if (now.weekday === 0 && now.minutes >= 19 * 60 && circle.lastWeeklySummary !== now.date) {
    await store.put(C.circles, { ...circle, lastWeeklySummary: now.date });
    const summary = await buildWeeklySummary(store, circle);
    sent.push(await sendEmail(store, { circleId: circle.id, to: summary.recipients, kind: 'weekly-summary', subject: summary.subject, lines: summary.lines }));
  }
  return sent;
}

export async function runTick(store, at = new Date()) {
  const circles = await store.query(C.circles, []);
  let sent = 0;
  for (const circle of circles) {
    try {
      sent += (await runCircleTick(store, circle, at)).length;
    } catch (err) {
      console.error(`[tick] circle ${circle.id} failed:`, err);
    }
  }
  return { circles: circles.length, notifications: sent };
}
