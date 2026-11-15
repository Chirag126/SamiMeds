/** Scheduler entry point called by Cloud Scheduler / GitHub Actions. */
import { config } from '../config.js';
import { HttpError } from '../http.js';
import { safeEqual } from '../services/auth.js';
import { runTick } from '../services/care.js';

/** @param {import('../http.js').Router} r */
export function registerCronRoutes(r) {
  /* ---- scheduler (Cloud Scheduler → POST /api/cron/tick) */

  r.post('/api/cron/tick', async (ctx) => {
    const secret = ctx.req.headers['x-cron-secret'];
    if (!config.cronSecret || !secret || !safeEqual(secret, config.cronSecret)) throw new HttpError(401, 'Unauthorized');
    return runTick(ctx.store);
  });
}
