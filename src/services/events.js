/**
 * Live sync between screens (Server-Sent Events).
 * When anything changes in a care circle, every open screen of that circle
 * is told to refresh – so a dose the elder marks as taken appears on the
 * son's and nurse's dashboards within a second.
 */
const streams = new Map(); // circleId → Set<ServerResponse>
const MAX_PER_CIRCLE = 40;
const HEARTBEAT_MS = 25_000;

export function subscribe(circleId, res) {
  if (!streams.has(circleId)) streams.set(circleId, new Set());
  const set = streams.get(circleId);
  if (set.size >= MAX_PER_CIRCLE) {
    const oldest = set.values().next().value;
    oldest.end();
    set.delete(oldest);
  }
  set.add(res);
  const beat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);
  beat.unref?.();
  res.on('close', () => {
    clearInterval(beat);
    set.delete(res);
    if (!set.size) streams.delete(circleId);
  });
}

export function publish(circleId, type = 'change') {
  const set = streams.get(circleId);
  if (!set) return 0;
  for (const res of set) res.write(`event: ${type}\ndata: ${Date.now()}\n\n`);
  return set.size;
}

export const listenerCount = (circleId) => streams.get(circleId)?.size ?? 0;
