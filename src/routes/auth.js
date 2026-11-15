/** Care circle setup, sign in / out and the signed-in member's profile. */
import { config } from '../config.js';
import { clientIp, cookie, HttpError } from '../http.js';
import {
  can, checkLockout, clearFailures, createSession, destroySession, findMemberByPin, hashPin, newCircleCode, newId, recordFailure,
} from '../services/auth.js';
import { circleMembers, logActivity, publicMember } from '../services/care.js';
import { emailEnabled, emailTransport } from '../services/email.js';
import { geminiEnabled } from '../services/gemini.js';
import { pushEnabled } from '../services/push.js';
import { v, validate } from '../services/validate.js';
import { C } from '../store/index.js';
import { auth, loginLimiter, SESSION_COOKIE, setSessionCookie } from './middleware.js';
import { assertStrongPin, checkTimezone } from './shared.js';

/** @param {import('../http.js').Router} r */
export function registerAuthRoutes(r) {
  /* ---- setup & login */

  r.post('/api/circles', async (ctx) => {
    if (!loginLimiter.allow(`setup:${clientIp(ctx.req)}`)) throw new HttpError(429, 'Too many attempts, try later');
    const body = validate({
      elderName: v.string({ min: 1, max: 60 }),
      elderPin: v.pin(),
      elderEmail: v.email({ optional: true }),
      familyName: v.string({ min: 1, max: 60 }),
      familyRelation: v.string({ max: 40, optional: true }),
      familyEmail: v.email(),
      familyPhone: v.phone(),
      familyPin: v.pin(),
      timezone: v.string({ min: 1, max: 60 }),
    }, ctx.body);
    checkTimezone(body.timezone);
    assertStrongPin(body.elderPin);
    assertStrongPin(body.familyPin);
    if (body.elderPin === body.familyPin) throw new HttpError(400, 'Each person needs their own PIN');

    let code = newCircleCode();
    while (await ctx.store.query(C.circles, [['code', '==', code]]).then((l) => l.length)) code = newCircleCode();

    const circle = {
      id: newId('c_'), code, elderName: body.elderName, timezone: body.timezone,
      emergencyPhone: body.familyPhone, emergencyName: body.familyName, createdAt: new Date().toISOString(), lastWeeklySummary: null,
    };
    const elder = {
      id: newId('m_'), circleId: circle.id, name: body.elderName, role: 'elderly', relation: '', email: body.elderEmail,
      phone: '', pinHash: await hashPin(body.elderPin), createdAt: circle.createdAt,
    };
    const family = {
      id: newId('m_'), circleId: circle.id, name: body.familyName, role: 'family', relation: body.familyRelation,
      email: body.familyEmail, phone: body.familyPhone, pinHash: await hashPin(body.familyPin), createdAt: circle.createdAt,
    };
    await ctx.store.put(C.circles, circle);
    await ctx.store.put(C.members, elder);
    await ctx.store.put(C.members, family);
    await logActivity(ctx.store, { circleId: circle.id, actor: family, action: 'circle-created', detail: `Care circle created for ${circle.elderName}` });

    const { token, maxAgeSec } = await createSession(ctx.store, family, { remember: true });
    setSessionCookie(ctx, token, maxAgeSec);
    return { status: 201, data: { code, member: publicMember(family), circle: { elderName: circle.elderName } } };
  });

  r.post('/api/auth/login', async (ctx) => {
    if (!loginLimiter.allow(`login:${clientIp(ctx.req)}`)) throw new HttpError(429, 'Too many attempts. Please wait 15 minutes.');
    const body = validate({
      code: v.string({ min: 4, max: 12 }),
      pin: v.pin(),
      remember: v.bool(),
    }, ctx.body);
    const code = body.code.toUpperCase();
    const lock = await checkLockout(ctx.store, code);
    if (lock.locked) {
      throw new HttpError(423, `Too many wrong PINs. Try again in ${Math.ceil(lock.retryAfterSec / 60)} minutes.`, { retryAfterSec: lock.retryAfterSec });
    }
    const [circle] = await ctx.store.query(C.circles, [['code', '==', code]]);
    const member = circle ? await findMemberByPin(ctx.store, circle.id, body.pin) : null;
    if (!member) {
      const { attemptsLeft } = await recordFailure(ctx.store, code);
      throw new HttpError(401, attemptsLeft ? `That PIN didn't match. ${attemptsLeft} tries left.` : 'Too many wrong PINs. Please wait 15 minutes.', { attemptsLeft });
    }
    await clearFailures(ctx.store, code);
    const { token, maxAgeSec } = await createSession(ctx.store, member, { remember: body.remember });
    setSessionCookie(ctx, token, maxAgeSec);
    return { member: publicMember(member), circle: { elderName: circle.elderName, code: circle.code } };
  });

  r.post('/api/auth/logout', async (ctx) => {
    await destroySession(ctx.store, ctx.cookies[SESSION_COOKIE]);
    ctx.res.setHeader('set-cookie', cookie(SESSION_COOKIE, '', { maxAge: 0, secure: config.isProduction }));
    return { ok: true };
  });

  r.get('/api/me', auth, async (ctx) => {
    const members = await circleMembers(ctx.store, ctx.circle.id);
    return {
      member: publicMember(ctx.member),
      permissions: Object.fromEntries(['manageCare', 'skipDose', 'settings', 'manageMembers', 'verifyProof'].map((p) => [p, can(ctx.member.role, p)])),
      circle: {
        code: ctx.circle.code, elderName: ctx.circle.elderName, timezone: ctx.circle.timezone,
        emergencyPhone: ctx.circle.emergencyPhone, emergencyName: ctx.circle.emergencyName,
      },
      members: members.map(publicMember),
      features: { gemini: geminiEnabled(), email: emailEnabled(), emailVia: emailTransport(), push: pushEnabled() },
    };
  });
}
