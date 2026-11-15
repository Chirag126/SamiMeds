/** Shared request guards: sign-in check, role permissions and circle ownership. */
import { HttpError, cookie, isHttps } from '../http.js';
import { config } from '../config.js';
import { C } from '../store/index.js';
import { can, readSession, RateLimiter } from '../services/auth.js';

export const SESSION_COOKIE = 'sm_sid';

/** Limits sign-in, setup and AI calls per IP or member (on top of the per-circle PIN lockout). */
export const loginLimiter = new RateLimiter({ limit: 30, windowMs: 15 * 60_000 });

/* ------------------------------------------------------------ middleware */

/** Loads the session, member and circle, or answers 401. */
export async function auth(ctx) {
  const session = await readSession(ctx.store, ctx.cookies[SESSION_COOKIE]);
  if (!session) throw new HttpError(401, 'Please sign in');
  const [member, circle] = await Promise.all([
    ctx.store.get(C.members, session.memberId),
    ctx.store.get(C.circles, session.circleId),
  ]);
  if (!member || !circle) throw new HttpError(401, 'Please sign in');
  Object.assign(ctx, { session, member, circle });
}

/** Allows the request only for roles with this permission (see PERMISSIONS in services/auth.js). */
export const allow = (action) => async (ctx) => {
  if (!can(ctx.member.role, action)) throw new HttpError(403, 'You do not have permission to do that');
};

/** Loads a record and checks it belongs to the caller's circle; 404 otherwise (never reveals other circles). */
export async function owned(ctx, collection, id) {
  const doc = await ctx.store.get(collection, id);
  if (!doc || doc.circleId !== ctx.circle.id) throw new HttpError(404, 'Not found');
  return doc;
}

export function setSessionCookie(ctx, token, maxAgeSec) {
  ctx.res.setHeader('set-cookie', cookie(SESSION_COOKIE, token, { maxAge: maxAgeSec, secure: config.isProduction || isHttps(ctx.req) }));
}
