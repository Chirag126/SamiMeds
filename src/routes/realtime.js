/** Live sync between open screens (Server-Sent Events) and phone notifications (Web Push). */
import { config } from '../config.js';
import { HttpError } from '../http.js';
import { subscribe } from '../services/events.js';
import { pushEnabled, removeSubscription, saveSubscription, sendPush } from '../services/push.js';
import { auth } from './middleware.js';

/** @param {import('../http.js').Router} r */
export function registerRealtimeRoutes(r) {
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
}
