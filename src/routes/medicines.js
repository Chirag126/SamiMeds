/** Medicines: list, add, edit, stop, refill, pill photos, AI quick add and prescription scan. */
import { HttpError } from '../http.js';
import { newId } from '../services/auth.js';
import { logActivity, nowFor, prunePendingDoses } from '../services/care.js';
import { parseMedicine, scanPrescription } from '../services/gemini.js';
import { decodeDataUrl, deletePhoto, loadPhoto, savePhoto } from '../services/photos.js';
import { DEFAULT_REFILL_DAYS, needsRefill } from '../services/refill.js';
import { v, validate } from '../services/validate.js';
import { C } from '../store/index.js';
import { allow, auth, loginLimiter, owned } from './middleware.js';
import { medicineSchema, medicineView, SCAN_MAX_BYTES, times12 } from './shared.js';

/** @param {import('../http.js').Router} r */
export function registerMedicinesRoutes(r) {
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
}
