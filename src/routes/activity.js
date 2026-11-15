/** Activity log, the elder's "OK / I have a question" replies, reminder log, stats and reports. */
import { config } from '../config.js';
import { HttpError } from '../http.js';
import { buildDoctorReport, buildStats, buildWeeklySummary, circleMembers, familyEmails } from '../services/care.js';
import { emailEnabled, emailTransport, sendEmail } from '../services/email.js';
import { sendPush } from '../services/push.js';
import { v, validate } from '../services/validate.js';
import { C } from '../store/index.js';
import { allow, auth, owned } from './middleware.js';

/** @param {import('../http.js').Router} r */
export function registerActivityRoutes(r) {
  /* ---- activity, notifications, stats */

  r.get('/api/activity', auth, async (ctx) => {
    const list = await ctx.store.query(C.activity, [['circleId', '==', ctx.circle.id]]);
    return { activity: list.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 100) };
  });

  r.post('/api/activity/:id/ack', auth, async (ctx) => {
    const entry = await owned(ctx, C.activity, ctx.params.id);
    const { response } = validate({ response: v.enum(['ok', 'question']) }, ctx.body);
    // Tapping twice (or on two phones) must not send the family two alerts.
    if (entry.ack) return { ok: true, ack: entry.ack, already: true };
    const updated = { ...entry, ack: response, ackAt: new Date().toISOString(), ackBy: ctx.member.name };
    await ctx.store.put(C.activity, updated);
    if (response === 'question') {
      const members = await circleMembers(ctx.store, ctx.circle.id);
      await sendEmail(ctx.store, {
        circleId: ctx.circle.id, to: familyEmails(members), kind: 'elder-question',
        subject: `❓ ${ctx.circle.elderName} has a question about a change`,
        lines: [`${ctx.circle.elderName} would like to talk about this change:`, `"${entry.detail}" (by ${entry.actorName}).`, 'Please give them a call to explain.'],
        cta: config.publicUrl ? { label: 'Open SamiMeds', url: `${config.publicUrl}/family` } : undefined,
      }, { wait: false });
    }
    return { ok: true, ack: response };
  });

  /** Family or caretaker marks the elder's question as answered (e.g. after calling them). */
  r.post('/api/activity/:id/answer', auth, allow('settings'), async (ctx) => {
    const entry = await owned(ctx, C.activity, ctx.params.id);
    if (entry.ack !== 'question') throw new HttpError(409, 'There is no open question here');
    if (entry.answeredAt) return { ok: true, already: true };
    await ctx.store.put(C.activity, { ...entry, answeredAt: new Date().toISOString(), answeredBy: ctx.member.name });
    await sendPush(ctx.store, ctx.circle.id, {
      roles: ['elderly'], title: `✅ ${ctx.member.name} answered your question`,
      body: `About: ${entry.detail}`, url: '/elder', tag: `answer-${entry.id}`,
    });
    return { ok: true };
  });

  r.get('/api/notifications', auth, allow('settings'), async (ctx) => {
    const list = await ctx.store.query(C.notifications, [['circleId', '==', ctx.circle.id]]);
    return { notifications: list.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 100), emailEnabled: emailEnabled(), emailVia: emailTransport() };
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
    const record = await sendEmail(ctx.store, { circleId: ctx.circle.id, to: s.recipients, kind: 'weekly-summary', subject: s.subject, lines: s.lines }, { wait: false });
    return { notification: record };
  });

  r.get('/api/reports/doctor', auth, async (ctx) => buildDoctorReport(ctx.store, ctx.circle));
}
