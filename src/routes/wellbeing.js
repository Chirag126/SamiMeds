/** Daily mood check-in ("Not well" alerts the family, at most once an hour). */
import { newId } from '../services/auth.js';
import { circleMembers, familyEmails, nowFor } from '../services/care.js';
import { sendEmail } from '../services/email.js';
import { addDays } from '../services/time.js';
import { v, validate } from '../services/validate.js';
import { C } from '../store/index.js';
import { auth } from './middleware.js';
import { MOODS } from './shared.js';

/** @param {import('../http.js').Router} r */
export function registerWellbeingRoutes(r) {
  /* ---- wellbeing */

  r.post('/api/moods', auth, async (ctx) => {
    const { mood } = validate({ mood: v.enum(MOODS) }, ctx.body);
    const now = nowFor(ctx.circle);
    const entry = { id: newId('mo_'), circleId: ctx.circle.id, date: now.date, mood, at: new Date().toISOString(), by: ctx.member.name };
    await ctx.store.put(C.moods, entry);
    // Only alert once per hour, even if "Not well" is tapped again and again.
    const recent = (await ctx.store.query(C.moods, [['circleId', '==', ctx.circle.id], ['date', '==', now.date]]))
      .filter((m) => m.id !== entry.id && m.mood === 'unwell' && Date.now() - Date.parse(m.at) < 60 * 60_000);
    let notified = false;
    if (mood === 'unwell' && recent.length) notified = true;
    else if (mood === 'unwell') {
      const members = await circleMembers(ctx.store, ctx.circle.id);
      await sendEmail(ctx.store, {
        circleId: ctx.circle.id, to: familyEmails(members), kind: 'mood-unwell',
        subject: `💛 ${ctx.circle.elderName} said they are not feeling well`,
        lines: [`${ctx.circle.elderName} tapped "Not well" in their daily check-in.`, 'A quick call would mean a lot.'],
      }, { wait: false });
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
}
