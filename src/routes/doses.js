/** Today's view and dose actions: take, snooze, undo, skip, and photo proof with family verification. */
import { HttpError } from '../http.js';
import { buildToday, logActivity, nowFor } from '../services/care.js';
import { ESCALATION, markSnoozed, markTaken, undoTaken } from '../services/doses.js';
import { deletePhoto, loadPhoto, savePhoto } from '../services/photos.js';
import { sendPush } from '../services/push.js';
import { adjustStock } from '../services/refill.js';
import { addDays, formatTime12 } from '../services/time.js';
import { v, validate } from '../services/validate.js';
import { C } from '../store/index.js';
import { allow, auth, owned } from './middleware.js';
import { proofId } from './shared.js';

/** @param {import('../http.js').Router} r */
export function registerDosesRoutes(r) {
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
}
