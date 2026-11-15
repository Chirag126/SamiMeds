import { createHash } from 'node:crypto';
import { config } from '../config.js';
import { C } from '../store/index.js';
import { ValidationError } from './validate.js';

/** Only real browser push services are accepted, so the server can't be pointed at arbitrary URLs. */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/, /\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/, /\.push\.apple\.com$/,
];

let sender = null; // (subscription, payload) => Promise – replaceable in tests
let senderPromise = null;

export const pushEnabled = () => Boolean(sender || (config.vapid.publicKey && config.vapid.privateKey));

/** Test hook: replace the real web-push sender. */
export function setPushSender(fn) {
  sender = fn;
}

async function getSender() {
  if (sender) return sender;
  if (!pushEnabled()) return null;
  if (!senderPromise) {
    senderPromise = import('web-push')
      .then(({ default: webpush }) => {
        webpush.setVapidDetails(config.vapid.subject, config.vapid.publicKey, config.vapid.privateKey);
        return (sub, payload) => webpush.sendNotification(sub, payload, { TTL: 3600, urgency: 'high' });
      })
      .catch((err) => {
        console.error('[push] web-push unavailable:', err.message);
        return null;
      });
  }
  return senderPromise;
}

const subId = (endpoint) => `ps_${createHash('sha256').update(endpoint).digest('hex').slice(0, 40)}`;

export function validateSubscription(input) {
  const endpoint = String(input?.endpoint || '');
  const p256dh = String(input?.keys?.p256dh || '');
  const auth = String(input?.keys?.auth || '');
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    throw new ValidationError('subscription: invalid endpoint');
  }
  if (url.protocol !== 'https:' || endpoint.length > 1000 || !PUSH_HOSTS.some((re) => re.test(url.hostname))) {
    throw new ValidationError('subscription: unknown push service');
  }
  if (!/^[\w-]{20,200}=*$/.test(p256dh) || !/^[\w-]{10,60}=*$/.test(auth)) {
    throw new ValidationError('subscription: invalid keys');
  }
  return { endpoint, keys: { p256dh, auth } };
}

export async function saveSubscription(store, member, input) {
  const subscription = validateSubscription(input);
  const doc = {
    id: subId(subscription.endpoint), circleId: member.circleId, memberId: member.id, role: member.role,
    subscription, createdAt: new Date().toISOString(),
  };
  await store.put(C.push, doc);
  return doc;
}

export async function removeSubscription(store, member, endpoint) {
  const doc = await store.get(C.push, subId(String(endpoint || '')));
  if (doc && doc.memberId === member.id) await store.del(C.push, doc.id);
}

/**
 * Sends a push notification to people in a circle.
 * `roles` picks who (e.g. ['family', 'caretaker']); `exceptMemberId` skips the person who caused it.
 * Expired subscriptions are cleaned up. Never throws – push is best-effort.
 */
export async function sendPush(store, circleId, { roles, memberId, exceptMemberId, title, body, url = '/', tag }) {
  try {
    const send = await getSender();
    if (!send) return 0;
    const all = await store.query(C.push, [['circleId', '==', circleId]]);
    const targets = all.filter((s) =>
      (!roles || roles.includes(s.role)) && (!memberId || s.memberId === memberId) && s.memberId !== exceptMemberId);
    const payload = JSON.stringify({ title: String(title).slice(0, 120), body: String(body || '').slice(0, 240), url, tag });
    let sent = 0;
    await Promise.all(targets.map(async (t) => {
      try {
        await send(t.subscription, payload);
        sent += 1;
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) await store.del(C.push, t.id);
        else console.warn('[push] send failed:', err?.statusCode || err?.message);
      }
    }));
    return sent;
  } catch (err) {
    console.warn('[push] skipped:', err.message);
    return 0;
  }
}

/** Who gets a push for each kind of reminder email. */
export function audienceFor(kind) {
  if (kind === 'elder-question') return ['family', 'caretaker'];
  if (kind.startsWith('elder-')) return ['elderly'];
  if (kind.startsWith('appointment-')) return ['elderly', 'family', 'caretaker'];
  return ['family', 'caretaker'];
}
