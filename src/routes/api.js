import { Router, HttpError, readJson, cookie, isHttps, clientIp } from '../http.js';
import { config } from '../config.js';
import { C } from '../store/index.js';
import { v, validate } from '../services/validate.js';
import {
  ROLES, can, hashPin, isWeakPin, newCircleCode, newId, createSession, readSession, destroySession,
  checkLockout, recordFailure, clearFailures, findMemberByPin, verifyPin, RateLimiter, safeEqual,
} from '../services/auth.js';
import { isValidTimezone, addDays, formatTime12 } from '../services/time.js';
import { markTaken, markSnoozed, undoTaken, ESCALATION } from '../services/doses.js';
import { adjustStock, daysLeft, needsRefill, DEFAULT_REFILL_DAYS } from '../services/refill.js';
import { parseMedicine, geminiEnabled, scanPrescription } from '../services/gemini.js';
import { savePhoto, loadPhoto, deletePhoto, decodeDataUrl } from '../services/photos.js';
import { subscribe } from '../services/events.js';
import { pushEnabled, saveSubscription, removeSubscription, sendPush } from '../services/push.js';
import { sendEmail, emailEnabled } from '../services/email.js';
import {
  nowFor, circleMembers, publicMember, familyEmails, logActivity, buildToday, buildStats,
  buildWeeklySummary, buildDoctorReport, upcomingAppointments, decorateAppointment, prunePendingDoses, runTick,
} from '../services/care.js';

const times12 = (times) => times.map(formatTime12).join(', ');

export const SESSION_COOKIE = 'sm_sid';
const COLORS = ['white', 'yellow', 'orange', 'pink', 'red', 'blue', 'green', 'purple', 'brown'];
const SHAPES = ['round', 'oval', 'capsule', 'liquid', 'drops', 'injection', 'inhaler'];
const MOODS = ['good', 'okay', 'unwell'];

const proofId = (doseId) => `proof_${doseId}`;
const SCAN_MAX_BYTES = 650 * 1024;

const loginLimiter = new RateLimiter({ limit: 30, windowMs: 15 * 60_000 });

/* ------------------------------------------------------------ middleware */

async function auth(ctx) {
  const session = await readSession(ctx.store, ctx.cookies[SESSION_COOKIE]);
  if (!session) throw new HttpError(401, 'Please sign in');
  const [member, circle] = await Promise.all([
    ctx.store.get(C.members, session.memberId),
    ctx.store.get(C.circles, session.circleId),
  ]);
  if (!member || !circle) throw new HttpError(401, 'Please sign in');
  Object.assign(ctx, { session, member, circle });
}

const allow = (action) => async (ctx) => {
  if (!can(ctx.member.role, action)) throw new HttpError(403, 'You do not have permission to do that');
};

async function owned(ctx, collection, id) {
  const doc = await ctx.store.get(collection, id);
  if (!doc || doc.circleId !== ctx.circle.id) throw new HttpError(404, 'Not found');
  return doc;
}

function setSessionCookie(ctx, token, maxAgeSec) {
  ctx.res.setHeader('set-cookie', cookie(SESSION_COOKIE, token, { maxAge: maxAgeSec, secure: config.isProduction || isHttps(ctx.req) }));
}

/* --------------------------------------------------------------- schemas */

const memberSchema = {
  name: v.string({ min: 1, max: 60 }),
  role: v.enum(ROLES),
  relation: v.string({ max: 40, optional: true }),
  email: v.email({ optional: true }),
  phone: v.phone(),
  pin: v.pin(),
};

const medicineSchema = {
  name: v.string({ min: 1, max: 80 }),
  dose: v.string({ max: 40, optional: true }),
  pillDescription: v.string({ max: 60, optional: true }),
  purpose: v.string({ max: 80, optional: true }),
  instructions: v.string({ max: 120, optional: true }),
  times: v.array(v.time(), { min: 1, max: 8 }),
  color: v.enum(COLORS, { optional: true }),
  shape: v.enum(SHAPES, { optional: true }),
  stock: v.number({ min: 0, max: 9999, optional: true }),
  pillsPerDose: v.number({ min: 0.25, max: 10, optional: true }),
  refillThresholdDays: v.number({ min: 1, max: 30, integer: true, optional: true }),
  endDate: v.date({ optional: true }),
};

const appointmentSchema = {
  doctor: v.string({ min: 1, max: 80 }),
  specialty: v.string({ max: 60, optional: true }),
  date: v.date(),
  time: v.time(),
  location: v.string({ max: 160, optional: true }),
  notes: v.text({ max: 500 }),
  checklist: v.array(v.string({ min: 1, max: 60 }), { max: 12 }),
};

const circleSettingsSchema = {
  elderName: v.string({ min: 1, max: 60 }),
  timezone: v.string({ min: 1, max: 60 }),
  emergencyPhone: v.phone(),
  emergencyName: v.string({ max: 60, optional: true }),
};

function checkTimezone(tz) {
  if (!isValidTimezone(tz)) throw new HttpError(400, 'timezone: unknown timezone');
}

async function assertPinFree(store, circleId, pin, exceptId) {
  const members = await circleMembers(store, circleId);
  for (const m of members) {
    if (m.id !== exceptId && (await verifyPin(pin, m.pinHash))) {
      throw new HttpError(409, 'That PIN is already used by someone in this circle. Please choose another.');
    }
  }
}

function assertStrongPin(pin) {
  if (isWeakPin(pin)) throw new HttpError(400, 'pin: too easy to guess (avoid 1111 or 1234). Try a family date.');
}

const medicineView = (m) => ({ ...m, daysLeft: daysLeft(m), needsRefill: needsRefill(m) });

/* ---------------------------------------------------------------- routes */

export function buildApi() {
  const r = new Router();

  r.get('/api/health', async (ctx) => ({
    ok: true,
    store: ctx.store.constructor.name === 'FirestoreStore' ? 'firestore' : 'memory',
  }));

  r.get('/api/config', async () => ({
    demo: config.demoMode,
    gemini: geminiEnabled(),
    email: emailEnabled(),
    lockoutAttempts: config.lockout.maxFailures,
  }));

  /* ---- setup & login */

  r.post('/api/circles', async (ctx) => {
    if (!loginLimiter.allow(`setup:${clientIp(ctx.req)}`)) throw new HttpError(429, 'Too many attempts, try later');
    const body = validate({
      elderName: v.string({ min: 1, max: 60 }),
      elderPin: v.pin(),
      elderEmail: v.email({ optional: true }),
      familyName: v.string({ min: 1, max: 60 }),
      familyRelation: v.string({ max: 40, optional: true }),
      familyEmail: v.email(),
      familyPhone: v.phone(),
      familyPin: v.pin(),
      timezone: v.string({ min: 1, max: 60 }),
    }, ctx.body);
    checkTimezone(body.timezone);
    assertStrongPin(body.elderPin);
    assertStrongPin(body.familyPin);
    if (body.elderPin === body.familyPin) throw new HttpError(400, 'Each person needs their own PIN');

    let code = newCircleCode();
    while (await ctx.store.query(C.circles, [['code', '==', code]]).then((l) => l.length)) code = newCircleCode();

    const circle = {
      id: newId('c_'), code, elderName: body.elderName, timezone: body.timezone,
      emergencyPhone: body.familyPhone, emergencyName: body.familyName, createdAt: new Date().toISOString(), lastWeeklySummary: null,
    };
    const elder = {
      id: newId('m_'), circleId: circle.id, name: body.elderName, role: 'elderly', relation: '', email: body.elderEmail,
      phone: '', pinHash: await hashPin(body.elderPin), createdAt: circle.createdAt,
    };
    const family = {
      id: newId('m_'), circleId: circle.id, name: body.familyName, role: 'family', relation: body.familyRelation,
      email: body.familyEmail, phone: body.familyPhone, pinHash: await hashPin(body.familyPin), createdAt: circle.createdAt,
    };
    await ctx.store.put(C.circles, circle);
    await ctx.store.put(C.members, elder);
    await ctx.store.put(C.members, family);
    await logActivity(ctx.store, { circleId: circle.id, actor: family, action: 'circle-created', detail: `Care circle created for ${circle.elderName}` });

    const { token, maxAgeSec } = await createSession(ctx.store, family, { remember: true });
    setSessionCookie(ctx, token, maxAgeSec);
    return { status: 201, data: { code, member: publicMember(family), circle: { elderName: circle.elderName } } };
  });

  r.post('/api/auth/login', async (ctx) => {
    if (!loginLimiter.allow(`login:${clientIp(ctx.req)}`)) throw new HttpError(429, 'Too many attempts. Please wait 15 minutes.');
    const body = validate({
      code: v.string({ min: 4, max: 12 }),
      pin: v.pin(),
      remember: v.bool(),
    }, ctx.body);
    const code = body.code.toUpperCase();
    const lock = await checkLockout(ctx.store, code);
    if (lock.locked) {
      throw new HttpError(423, `Too many wrong PINs. Try again in ${Math.ceil(lock.retryAfterSec / 60)} minutes.`, { retryAfterSec: lock.retryAfterSec });
    }
    const [circle] = await ctx.store.query(C.circles, [['code', '==', code]]);
    const member = circle ? await findMemberByPin(ctx.store, circle.id, body.pin) : null;
    if (!member) {
      const { attemptsLeft } = await recordFailure(ctx.store, code);
      throw new HttpError(401, attemptsLeft ? `That PIN didn't match. ${attemptsLeft} tries left.` : 'Too many wrong PINs. Please wait 15 minutes.', { attemptsLeft });
    }
    await clearFailures(ctx.store, code);
    const { token, maxAgeSec } = await createSession(ctx.store, member, { remember: body.remember });
    setSessionCookie(ctx, token, maxAgeSec);
    return { member: publicMember(member), circle: { elderName: circle.elderName, code: circle.code } };
  });

  r.post('/api/auth/logout', async (ctx) => {
    await destroySession(ctx.store, ctx.cookies[SESSION_COOKIE]);
    ctx.res.setHeader('set-cookie', cookie(SESSION_COOKIE, '', { maxAge: 0, secure: config.isProduction }));
    return { ok: true };
  });

  r.get('/api/me', auth, async (ctx) => {
    const members = await circleMembers(ctx.store, ctx.circle.id);
    return {
      member: publicMember(ctx.member),
      permissions: Object.fromEntries(['manageCare', 'skipDose', 'settings', 'manageMembers', 'verifyProof'].map((p) => [p, can(ctx.member.role, p)])),
      circle: {
        code: ctx.circle.code, elderName: ctx.circle.elderName, timezone: ctx.circle.timezone,
        emergencyPhone: ctx.circle.emergencyPhone, emergencyName: ctx.circle.emergencyName,
      },
      members: members.map(publicMember),
      features: { gemini: geminiEnabled(), email: emailEnabled(), push: pushEnabled() },
    };
  });

  /* ---- today & doses */

  r.get('/api/today', auth, async (ctx) => buildToday(ctx.store, ctx.circle));

  /** Marks a dose taken, updates stock, and tells the rest of the circle. */
  async function takeDose(ctx, dose) {
    if (dose.status === 'taken') return dose;
    const now = nowFor(ctx.circle);
    const updated = markTaken(dose, { nowEpoch: now.epoch, at: new Date().toISOString(), by: ctx.member.name });
    await ctx.store.put(C.doses, updated);
    const med = await ctx.store.get(C.medicines, dose.medicineId);
    if (med) await ctx.store.put(C.medicines, adjustStock(med, -1));
    const name = med?.name || dose.medicineName || 'medicine';
    if (ctx.member.role === 'elderly') {
      await sendPush(ctx.store, ctx.circle.id, {
        roles: ['family', 'caretaker'], title: `✅ ${ctx.circle.elderName} took ${name}`,
        body: `${formatTime12(dose.time)} dose marked as taken.`, url: '/family', tag: `taken-${dose.id}`,
      });
    } else {
      await logActivity(ctx.store, { circleId: ctx.circle.id, actor: ctx.member, action: 'dose-taken', detail: `Marked ${name} (${formatTime12(dose.time)}) as taken` });
    }
    return updated;
  }

  r.post('/api/doses/:id/take', auth, allow('takeDose'), async (ctx) => {
    const dose = await owned(ctx, C.doses, ctx.params.id);
    return { dose: await takeDose(ctx, dose) };
  });

  /* ---- photo proof: the elder sends a photo, family verifies it, the caretaker sees the result */

  r.put('/api/doses/:id/proof', auth, allow('takeDose'), async (ctx) => {
    const dose = await takeDose(ctx, await owned(ctx, C.doses, ctx.params.id));
    await savePhoto(ctx.store, ctx.circle.id, proofId(dose.id), ctx.body?.dataUrl);
    const updated = { ...dose, proof: { status: 'pending', at: new Date().toISOString(), by: ctx.member.name, version: Date.now() } };
    await ctx.store.put(C.doses, updated);
    await sendPush(ctx.store, ctx.circle.id, {
      roles: ['family'], exceptMemberId: ctx.member.id, title: `📷 ${ctx.member.name} sent a medicine photo`,
      body: `${dose.medicineName || 'Medicine'} (${formatTime12(dose.time)}) – tap to check it.`, url: '/family', tag: `proof-${dose.id}`,
    });
    return { dose: updated };
  });

  r.get('/api/doses/:id/proof', auth, async (ctx) => {
    const dose = await owned(ctx, C.doses, ctx.params.id);
    const photo = dose.proof ? await loadPhoto(ctx.store, ctx.circle.id, proofId(dose.id)) : null;
    if (!photo) throw new HttpError(404, 'No photo');
    ctx.res.writeHead(200, { 'content-type': photo.contentType, 'cache-control': 'private, max-age=3600', 'x-content-type-options': 'nosniff' });
    ctx.res.end(photo.buf);
    return undefined;
  });

  r.post('/api/doses/:id/verify', auth, allow('verifyProof'), async (ctx) => {
    const dose = await owned(ctx, C.doses, ctx.params.id);
    if (!dose.proof) throw new HttpError(409, 'There is no photo to check for this dose');
    const { ok } = validate({ ok: v.bool() }, ctx.body);
    const proof = { ...dose.proof, status: ok ? 'verified' : 'rejected', verifiedBy: ctx.member.name, verifiedAt: new Date().toISOString() };
    const updated = { ...dose, proof };
    await ctx.store.put(C.doses, updated);
    const what = `${dose.medicineName || 'medicine'} (${formatTime12(dose.time)})`;
    await logActivity(ctx.store, { circleId: ctx.circle.id, actor: ctx.member, action: 'proof-checked', detail: ok ? `Checked the photo for ${what}: looks right ✅` : `Checked the photo for ${what}: needs a second look ⚠️` });
    await sendPush(ctx.store, ctx.circle.id, {
      roles: ['caretaker'], title: ok ? `✅ ${ctx.member.name} verified ${what}` : `⚠️ ${ctx.member.name}: please check ${what}`,
      body: ok ? `${ctx.circle.elderName}'s photo was checked.` : `The photo from ${ctx.circle.elderName} did not look right.`, url: '/family', tag: `verify-${dose.id}`,
    });
    if (ok) {
      await sendPush(ctx.store, ctx.circle.id, { roles: ['elderly'], title: `👍 ${ctx.member.name} saw your photo`, body: 'Well done for taking your medicine!', url: '/elder', tag: `verify-${dose.id}` });
    }
    return { dose: updated };
  });

  r.post('/api/doses/:id/snooze', auth, allow('takeDose'), async (ctx) => {
    const dose = await owned(ctx, C.doses, ctx.params.id);
    try {
      const updated = markSnoozed(dose, nowFor(ctx.circle).epoch);
      await ctx.store.put(C.doses, updated);
      return { dose: updated, minutes: ESCALATION.snoozeMinutes };
    } catch (err) {
      throw new HttpError(409, err.message);
    }
  });

  r.post('/api/doses/:id/undo', auth, allow('takeDose'), async (ctx) => {
    const dose = await owned(ctx, C.doses, ctx.params.id);
    if (dose.status !== 'taken') throw new HttpError(409, 'This dose is not marked as taken');
    const minutesSince = (Date.now() - Date.parse(dose.takenAt)) / 60_000;
    if (ctx.member.role === 'elderly' && minutesSince > 30) throw new HttpError(403, 'Please ask family to change this');
    const updated = { ...undoTaken(dose, nowFor(ctx.circle).epoch), proof: null };
    await ctx.store.put(C.doses, updated);
    if (dose.proof) await deletePhoto(ctx.store, ctx.circle.id, proofId(dose.id));
    const med = await ctx.store.get(C.medicines, dose.medicineId);
    if (med) await ctx.store.put(C.medicines, adjustStock(med, +1));
    return { dose: updated };
  });

  r.post('/api/doses/:id/skip', auth, allow('skipDose'), async (ctx) => {
    const dose = await owned(ctx, C.doses, ctx.params.id);
    const { reason } = validate({ reason: v.string({ max: 120, optional: true }) }, ctx.body);
    if (dose.status === 'taken') throw new HttpError(409, 'Already taken');
    const updated = { ...dose, status: 'skipped', skipReason: reason, takenBy: ctx.member.name };
    await ctx.store.put(C.doses, updated);
    await logActivity(ctx.store, { circleId: ctx.circle.id, actor: ctx.member, action: 'dose-skipped', detail: `Skipped ${dose.medicineName || 'dose'} at ${dose.time}${reason ? ` – ${reason}` : ''}` });
    return { dose: updated };
  });

  r.get('/api/doses', auth, async (ctx) => {
    const now = nowFor(ctx.circle);
    const days = Math.min(90, Math.max(1, Number(ctx.query.get('days')) || 7));
    const list = await ctx.store.query(C.doses, [['circleId', '==', ctx.circle.id], ['date', '>=', addDays(now.date, -(days - 1))]]);
    return { doses: list.filter((d) => d.date <= now.date).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)) };
  });

  /* ---- medicines */

  r.get('/api/medicines', auth, async (ctx) => {
    const meds = await ctx.store.query(C.medicines, [['circleId', '==', ctx.circle.id]]);
    return { medicines: meds.filter((m) => m.active).sort((a, b) => a.times[0].localeCompare(b.times[0])).map(medicineView) };
  });

  r.post('/api/medicines', auth, allow('manageCare'), async (ctx) => {
    const body = validate(medicineSchema, ctx.body);
    const now = nowFor(ctx.circle);
    const med = {
      id: newId('med_'), circleId: ctx.circle.id, ...body,
      times: [...new Set(body.times)].sort(),
      color: body.color || 'white', shape: body.shape || 'round',
      pillsPerDose: body.pillsPerDose ?? 1, refillThresholdDays: body.refillThresholdDays ?? DEFAULT_REFILL_DAYS,
      active: true, hasPhoto: false, refillAlertSent: false,
      startEpoch: now.epoch, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: ctx.member.name,
    };
    await ctx.store.put(C.medicines, med);
    await logActivity(ctx.store, { circleId: ctx.circle.id, actor: ctx.member, action: 'medicine-added', detail: `Added ${med.name}${med.dose ? ` ${med.dose}` : ''} at ${times12(med.times)}`, forElderly: true });
    return { status: 201, data: { medicine: medicineView(med) } };
  });

  r.put('/api/medicines/:id', auth, allow('manageCare'), async (ctx) => {
    const med = await owned(ctx, C.medicines, ctx.params.id);
    const body = validate(medicineSchema, ctx.body, { partial: true });
    const now = nowFor(ctx.circle);
    const updated = { ...med, ...body, updatedAt: new Date().toISOString() };
    if (body.times) {
      updated.times = [...new Set(body.times)].sort();
      // New times only start from now, so an edit never creates an instant "missed" alert.
      if (updated.times.some((t) => !med.times.includes(t))) updated.startEpoch = now.epoch;
    }
    if ('stock' in body && !needsRefill(updated)) updated.refillAlertSent = false;
    await ctx.store.put(C.medicines, updated);
    await prunePendingDoses(ctx.store, updated, now.date);
    await logActivity(ctx.store, { circleId: ctx.circle.id, actor: ctx.member, action: 'medicine-updated', detail: `Updated ${updated.name} (${times12(updated.times)})`, forElderly: true });
    return { medicine: medicineView(updated) };
  });

  r.delete('/api/medicines/:id', auth, allow('manageCare'), async (ctx) => {
    const med = await owned(ctx, C.medicines, ctx.params.id);
    const updated = { ...med, active: false, updatedAt: new Date().toISOString() };
    await ctx.store.put(C.medicines, updated);
    await prunePendingDoses(ctx.store, updated, nowFor(ctx.circle).date);
    await deletePhoto(ctx.store, ctx.circle.id, med.id);
    await logActivity(ctx.store, { circleId: ctx.circle.id, actor: ctx.member, action: 'medicine-stopped', detail: `Stopped ${med.name}`, forElderly: true });
    return { ok: true };
  });

  r.post('/api/medicines/:id/refill', auth, allow('manageCare'), async (ctx) => {
    const med = await owned(ctx, C.medicines, ctx.params.id);
    const { add } = validate({ add: v.number({ min: 1, max: 1000, integer: true }) }, ctx.body);
    const updated = { ...med, stock: (med.stock ?? 0) + add, updatedAt: new Date().toISOString() };
    updated.refillAlertSent = needsRefill(updated) ? med.refillAlertSent : false;
    await ctx.store.put(C.medicines, updated);
    await logActivity(ctx.store, { circleId: ctx.circle.id, actor: ctx.member, action: 'medicine-refilled', detail: `Added ${add} to ${med.name} (now ${updated.stock})` });
    return { medicine: medicineView(updated) };
  });

  r.put('/api/medicines/:id/photo', auth, allow('manageCare'), async (ctx) => {
    const med = await owned(ctx, C.medicines, ctx.params.id);
    await savePhoto(ctx.store, ctx.circle.id, med.id, ctx.body?.dataUrl);
    await ctx.store.put(C.medicines, { ...med, hasPhoto: true, photoVersion: Date.now() });
    return { ok: true };
  });

  r.get('/api/medicines/:id/photo', auth, async (ctx) => {
    const photo = await loadPhoto(ctx.store, ctx.circle.id, ctx.params.id);
    if (!photo) throw new HttpError(404, 'No photo');
    ctx.res.writeHead(200, { 'content-type': photo.contentType, 'cache-control': 'private, max-age=86400', 'x-content-type-options': 'nosniff' });
    ctx.res.end(photo.buf);
    return undefined;
  });

  r.post('/api/ai/parse-medicine', auth, allow('manageCare'), async (ctx) => {
    if (!loginLimiter.allow(`ai:${ctx.member.id}`)) throw new HttpError(429, 'Please slow down');
    const { text } = validate({ text: v.string({ min: 3, max: 500 }) }, ctx.body);
    return { parsed: await parseMedicine(text) };
  });

  /* ---- appointments */

  r.get('/api/appointments', auth, async (ctx) => {
    const all = await ctx.store.query(C.appointments, [['circleId', '==', ctx.circle.id]]);
    const upcoming = await upcomingAppointments(ctx.store, ctx.circle);
    const ids = new Set(upcoming.map((a) => a.id));
    const past = all.filter((a) => !ids.has(a.id)).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)).slice(0, 20);
    return { upcoming, past: past.map((a) => decorateAppointment(a, ctx.circle)) };
  });

  r.post('/api/appointments', auth, allow('manageCare'), async (ctx) => {
    const body = validate(appointmentSchema, ctx.body);
    const appt = {
      id: newId('ap_'), circleId: ctx.circle.id, ...body, status: 'upcoming', checklistDone: body.checklist.map(() => false),
      dayBeforeSent: false, morningSent: false, createdAt: new Date().toISOString(), createdBy: ctx.member.name,
    };
    await ctx.store.put(C.appointments, appt);
    await logActivity(ctx.store, { circleId: ctx.circle.id, actor: ctx.member, action: 'appointment-added', detail: `Booked ${appt.doctor} on ${appt.date} at ${formatTime12(appt.time)}`, forElderly: true });
    return { status: 201, data: { appointment: decorateAppointment(appt, ctx.circle) } };
  });

  r.put('/api/appointments/:id', auth, allow('manageCare'), async (ctx) => {
    const appt = await owned(ctx, C.appointments, ctx.params.id);
    const body = validate({ ...appointmentSchema, status: v.enum(['upcoming', 'done', 'cancelled']) }, ctx.body, { partial: true });
    const updated = { ...appt, ...body };
    if (body.checklist) updated.checklistDone = body.checklist.map((item) => appt.checklistDone?.[appt.checklist.indexOf(item)] ?? false);
    if (body.date || body.time) Object.assign(updated, { dayBeforeSent: false, morningSent: false });
    await ctx.store.put(C.appointments, updated);
    const verb = body.status === 'done' ? 'Marked visit done' : body.status === 'cancelled' ? 'Cancelled visit' : 'Updated visit';
    await logActivity(ctx.store, { circleId: ctx.circle.id, actor: ctx.member, action: 'appointment-updated', detail: `${verb}: ${updated.doctor} (${updated.date} ${updated.time})`, forElderly: body.status !== 'done' });
    return { appointment: decorateAppointment(updated, ctx.circle) };
  });

  r.delete('/api/appointments/:id', auth, allow('manageCare'), async (ctx) => {
    const appt = await owned(ctx, C.appointments, ctx.params.id);
    await ctx.store.del(C.appointments, appt.id);
    await logActivity(ctx.store, { circleId: ctx.circle.id, actor: ctx.member, action: 'appointment-deleted', detail: `Removed visit to ${appt.doctor} on ${appt.date}`, forElderly: true });
    return { ok: true };
  });

  r.post('/api/appointments/:id/checklist', auth, async (ctx) => {
    const appt = await owned(ctx, C.appointments, ctx.params.id);
    const { index, done } = validate({ index: v.number({ min: 0, max: 11, integer: true }), done: v.bool() }, ctx.body);
    if (index >= appt.checklist.length) throw new HttpError(400, 'No such item');
    const checklistDone = appt.checklist.map((_, i) => (i === index ? done : Boolean(appt.checklistDone?.[i])));
    await ctx.store.put(C.appointments, { ...appt, checklistDone });
    return { checklistDone };
  });

  /* ---- wellbeing */

  r.post('/api/moods', auth, async (ctx) => {
    const { mood } = validate({ mood: v.enum(MOODS) }, ctx.body);
    const now = nowFor(ctx.circle);
    const entry = { id: newId('mo_'), circleId: ctx.circle.id, date: now.date, mood, at: new Date().toISOString(), by: ctx.member.name };
    await ctx.store.put(C.moods, entry);
    let notified = false;
    if (mood === 'unwell') {
      const members = await circleMembers(ctx.store, ctx.circle.id);
      await sendEmail(ctx.store, {
        circleId: ctx.circle.id, to: familyEmails(members), kind: 'mood-unwell',
        subject: `💛 ${ctx.circle.elderName} said they are not feeling well`,
        lines: [`${ctx.circle.elderName} tapped "Not well" in their daily check-in.`, 'A quick call would mean a lot.'],
      });
      notified = true;
    }
    return { status: 201, data: { mood: entry, notified } };
  });

  r.get('/api/moods', auth, async (ctx) => {
    const now = nowFor(ctx.circle);
    const days = Math.min(90, Math.max(1, Number(ctx.query.get('days')) || 14));
    const list = await ctx.store.query(C.moods, [['circleId', '==', ctx.circle.id], ['date', '>=', addDays(now.date, -(days - 1))]]);
    return { moods: list.sort((a, b) => b.at.localeCompare(a.at)) };
  });

  /* ---- activity, notifications, stats */

  r.get('/api/activity', auth, async (ctx) => {
    const list = await ctx.store.query(C.activity, [['circleId', '==', ctx.circle.id]]);
    return { activity: list.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 100) };
  });

  r.post('/api/activity/:id/ack', auth, async (ctx) => {
    const entry = await owned(ctx, C.activity, ctx.params.id);
    const { response } = validate({ response: v.enum(['ok', 'question']) }, ctx.body);
    await ctx.store.put(C.activity, { ...entry, ack: response, ackAt: new Date().toISOString(), ackBy: ctx.member.name });
    if (response === 'question') {
      const members = await circleMembers(ctx.store, ctx.circle.id);
      await sendEmail(ctx.store, {
        circleId: ctx.circle.id, to: familyEmails(members), kind: 'elder-question',
        subject: `❓ ${ctx.circle.elderName} has a question about a change`,
        lines: [`${ctx.circle.elderName} would like to talk about this change:`, `"${entry.detail}" (by ${entry.actorName}).`, 'Please give them a call to explain.'],
      });
    }
    return { ok: true };
  });

  r.get('/api/notifications', auth, allow('settings'), async (ctx) => {
    const list = await ctx.store.query(C.notifications, [['circleId', '==', ctx.circle.id]]);
    return { notifications: list.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 100), emailEnabled: emailEnabled() };
  });

  r.get('/api/stats', auth, async (ctx) => {
    const days = Math.min(90, Math.max(1, Number(ctx.query.get('days')) || 7));
    return buildStats(ctx.store, ctx.circle, days);
  });

  r.get('/api/reports/weekly', auth, async (ctx) => {
    const s = await buildWeeklySummary(ctx.store, ctx.circle);
    return { subject: s.subject, lines: s.lines, recipients: s.recipients };
  });

  r.post('/api/reports/weekly/send', auth, allow('settings'), async (ctx) => {
    const s = await buildWeeklySummary(ctx.store, ctx.circle);
    const record = await sendEmail(ctx.store, { circleId: ctx.circle.id, to: s.recipients, kind: 'weekly-summary', subject: s.subject, lines: s.lines });
    return { notification: record };
  });

  r.get('/api/reports/doctor', auth, async (ctx) => buildDoctorReport(ctx.store, ctx.circle));

  /* ---- circle & members */

  r.put('/api/circle', auth, allow('settings'), async (ctx) => {
    const body = validate(circleSettingsSchema, ctx.body, { partial: true });
    if (body.timezone) checkTimezone(body.timezone);
    const updated = { ...ctx.circle, ...body };
    await ctx.store.put(C.circles, updated);
    await logActivity(ctx.store, { circleId: ctx.circle.id, actor: ctx.member, action: 'settings-updated', detail: 'Updated circle settings' });
    return { circle: { elderName: updated.elderName, timezone: updated.timezone, emergencyPhone: updated.emergencyPhone, emergencyName: updated.emergencyName } };
  });

  r.get('/api/members', auth, async (ctx) => ({ members: (await circleMembers(ctx.store, ctx.circle.id)).map(publicMember) }));

  r.post('/api/members', auth, allow('manageMembers'), async (ctx) => {
    const body = validate(memberSchema, ctx.body);
    assertStrongPin(body.pin);
    const members = await circleMembers(ctx.store, ctx.circle.id);
    if (members.length >= 12) throw new HttpError(400, 'A circle can have up to 12 people');
    if (body.role === 'elderly' && members.some((m) => m.role === 'elderly')) throw new HttpError(400, 'This circle already has an elder');
    await assertPinFree(ctx.store, ctx.circle.id, body.pin);
    const { pin, ...rest } = body;
    const member = { id: newId('m_'), circleId: ctx.circle.id, ...rest, pinHash: await hashPin(pin), createdAt: new Date().toISOString() };
    await ctx.store.put(C.members, member);
    await logActivity(ctx.store, { circleId: ctx.circle.id, actor: ctx.member, action: 'member-added', detail: `Added ${member.name} as ${member.role}`, forElderly: true });
    return { status: 201, data: { member: publicMember(member) } };
  });

  r.put('/api/members/:id', auth, async (ctx) => {
    const target = await owned(ctx, C.members, ctx.params.id);
    const self = target.id === ctx.member.id;
    if (!self && !can(ctx.member.role, 'manageMembers')) throw new HttpError(403, 'You can only change your own details');
    const schema = { name: memberSchema.name, relation: memberSchema.relation, email: memberSchema.email, phone: memberSchema.phone, pin: v.pin() };
    const body = validate(schema, ctx.body, { partial: true });
    const updated = { ...target };
    for (const k of ['name', 'relation', 'email', 'phone']) if (k in body) updated[k] = body[k];
    if (body.pin) {
      assertStrongPin(body.pin);
      await assertPinFree(ctx.store, ctx.circle.id, body.pin, target.id);
      updated.pinHash = await hashPin(body.pin);
    }
    await ctx.store.put(C.members, updated);
    return { member: publicMember(updated) };
  });

  r.delete('/api/members/:id', auth, allow('manageMembers'), async (ctx) => {
    const target = await owned(ctx, C.members, ctx.params.id);
    if (target.role === 'elderly') throw new HttpError(400, 'The elder cannot be removed from their own circle');
    if (target.id === ctx.member.id) throw new HttpError(400, 'You cannot remove yourself');
    await ctx.store.del(C.members, target.id);
    const sessions = await ctx.store.query(C.sessions, [['memberId', '==', target.id]]);
    for (const s of sessions) await ctx.store.del(C.sessions, s.id);
    await logActivity(ctx.store, { circleId: ctx.circle.id, actor: ctx.member, action: 'member-removed', detail: `Removed ${target.name}`, forElderly: true });
    return { ok: true };
  });

  /* ---- AI: read a prescription photo */

  r.post('/api/ai/scan-prescription', auth, allow('manageCare'), async (ctx) => {
    if (!loginLimiter.allow(`scan:${ctx.member.id}`)) throw new HttpError(429, 'Please slow down');
    const image = decodeDataUrl(ctx.body?.dataUrl, SCAN_MAX_BYTES);
    try {
      return { medicines: await scanPrescription(image) };
    } catch (err) {
      if (err.status === 503) throw new HttpError(503, err.message);
      console.warn('[gemini] prescription scan failed:', err.message);
      throw new HttpError(502, 'Could not read that photo. Please try a clearer picture, or add the medicine by hand.');
    }
  });

  /* ---- live sync: open screens are told when something in their circle changes */

  r.get('/api/events', auth, async (ctx) => {
    ctx.res.writeHead(200, {
      'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no',
    });
    ctx.res.write('retry: 4000\n\n');
    subscribe(ctx.circle.id, ctx.res);
    return undefined;
  });

  /* ---- phone notifications (Web Push) */

  r.get('/api/push/key', auth, async () => ({ enabled: pushEnabled(), publicKey: config.vapid.publicKey }));

  r.post('/api/push/subscribe', auth, async (ctx) => {
    if (!pushEnabled()) throw new HttpError(503, 'Notifications are not set up on this server');
    await saveSubscription(ctx.store, ctx.member, ctx.body?.subscription);
    return { status: 201, data: { ok: true } };
  });

  r.post('/api/push/unsubscribe', auth, async (ctx) => {
    await removeSubscription(ctx.store, ctx.member, ctx.body?.endpoint);
    return { ok: true };
  });

  r.post('/api/push/test', auth, async (ctx) => {
    const sent = await sendPush(ctx.store, ctx.circle.id, {
      memberId: ctx.member.id, title: '🔔 SamiMeds notifications are on', body: `Hello ${ctx.member.name}! Reminders will arrive like this.`, url: '/',
    });
    return { sent };
  });

  /* ---- scheduler (Cloud Scheduler → POST /api/cron/tick) */

  r.post('/api/cron/tick', async (ctx) => {
    const secret = ctx.req.headers['x-cron-secret'];
    if (!config.cronSecret || !secret || !safeEqual(secret, config.cronSecret)) throw new HttpError(401, 'Unauthorized');
    return runTick(ctx.store);
  });

  return r;
}
