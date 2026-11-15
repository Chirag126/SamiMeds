/** Doctor visits: list, book, edit, cancel and the elder's "things to bring" checklist. */
import { HttpError } from '../http.js';
import { newId } from '../services/auth.js';
import { decorateAppointment, logActivity, upcomingAppointments } from '../services/care.js';
import { formatTime12 } from '../services/time.js';
import { v, validate } from '../services/validate.js';
import { C } from '../store/index.js';
import { allow, auth, owned } from './middleware.js';
import { appointmentSchema } from './shared.js';

/** @param {import('../http.js').Router} r */
export function registerAppointmentsRoutes(r) {
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
}
