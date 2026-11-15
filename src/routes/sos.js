/** SOS: the elder asks for help; family and caretakers are alerted, and the first to respond is shown to the elder. */
import { HttpError } from '../http.js';
import { config } from '../config.js';
import { C } from '../store/index.js';
import { newId } from '../services/auth.js';
import { circleMembers, familyEmails, logActivity } from '../services/care.js';
import { sendEmail } from '../services/email.js';
import { sendPush } from '../services/push.js';
import { formatTime12, localParts } from '../services/time.js';
import { allow, auth, owned } from './middleware.js';

/** A second SOS within this window re-uses the open alert instead of sending another. */
export const SOS_REPEAT_MS = 10 * 60_000;

/** @param {import('../http.js').Router} r */
export function registerSosRoutes(r) {
  r.post('/api/sos', auth, async (ctx) => {
    const open = (await ctx.store.query(C.activity, [['circleId', '==', ctx.circle.id], ['action', '==', 'sos']]))
      .find((a) => !a.respondedAt && Date.now() - Date.parse(a.at) < SOS_REPEAT_MS);
    if (open) return { sos: open, already: true };

    const at = new Date();
    const { minutes } = localParts(at, ctx.circle.timezone);
    const time = formatTime12(`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);
    const sos = {
      id: newId('sos_'), circleId: ctx.circle.id, at: at.toISOString(), action: 'sos', actorName: ctx.member.name, actorRole: ctx.member.role,
      detail: `${ctx.member.name} asked for help at ${time}`, forElderly: false, ack: null, respondedAt: null, respondedBy: null,
    };
    await ctx.store.put(C.activity, sos);

    const members = await circleMembers(ctx.store, ctx.circle.id);
    const callLine = ctx.member.phone ? `Call them now: ${ctx.member.phone}.` : 'Please call them now.';
    await sendEmail(ctx.store, {
      circleId: ctx.circle.id, to: familyEmails(members), kind: 'sos',
      subject: `🆘 ${ctx.member.name} needs help (${time})`,
      lines: [`${ctx.member.name} pressed the help button in SamiMeds at ${time}.`, callLine, 'Open SamiMeds and tap "I\'m on it" so they know someone is coming.'],
      cta: config.publicUrl ? { label: 'Open SamiMeds', url: `${config.publicUrl}/family` } : undefined,
    }, { wait: false });
    return { status: 201, data: { sos } };
  });

  /** Family or caretaker answers the alert: the elder sees who is coming. */
  r.post('/api/sos/:id/respond', auth, allow('settings'), async (ctx) => {
    const sos = await owned(ctx, C.activity, ctx.params.id);
    if (sos.action !== 'sos') throw new HttpError(404, 'Not found');
    if (sos.respondedAt) return { sos, already: true };
    const updated = { ...sos, respondedAt: new Date().toISOString(), respondedBy: ctx.member.name };
    await ctx.store.put(C.activity, updated);
    await logActivity(ctx.store, { circleId: ctx.circle.id, actor: ctx.member, action: 'sos-responded', detail: `${ctx.member.name} is responding to the help alert` });
    await sendPush(ctx.store, ctx.circle.id, {
      roles: ['elderly'], title: `💚 ${ctx.member.name} is on the way`, body: 'Help is coming. Stay where you are.', url: '/elder', tag: `sos-${sos.id}`,
    });
    return { sos: updated };
  });
}
