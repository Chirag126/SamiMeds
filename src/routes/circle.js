/** Circle settings and members (add, edit, change PIN, remove). */
import { HttpError } from '../http.js';
import { can, hashPin, newId } from '../services/auth.js';
import { circleMembers, logActivity, publicMember } from '../services/care.js';
import { v, validate } from '../services/validate.js';
import { C } from '../store/index.js';
import { allow, auth, owned } from './middleware.js';
import { assertPinFree, assertStrongPin, checkTimezone, circleSettingsSchema, memberSchema } from './shared.js';

/** @param {import('../http.js').Router} r */
export function registerCircleRoutes(r) {
  /* ---- circle & members */

  r.put('/api/circle', auth, allow('settings'), async (ctx) => {
    const body = validate(circleSettingsSchema, ctx.body, { partial: true });
    if (body.timezone) checkTimezone(body.timezone);
    const updated = { ...ctx.circle, ...body };
    await ctx.store.put(C.circles, updated);
    await logActivity(ctx.store, { circleId: ctx.circle.id, actor: ctx.member, action: 'settings-updated', detail: 'Updated circle settings' });
    return { circle: { elderName: updated.elderName, timezone: updated.timezone, emergencyPhone: updated.emergencyPhone, emergencyName: updated.emergencyName } };
  });

  r.get('/api/members', auth, async (ctx) => ({ members: (await circleMembers(ctx.store, ctx.circle.id)).map(publicMember) }));

  r.post('/api/members', auth, allow('manageMembers'), async (ctx) => {
    const body = validate(memberSchema, ctx.body);
    assertStrongPin(body.pin);
    const members = await circleMembers(ctx.store, ctx.circle.id);
    if (members.length >= 12) throw new HttpError(400, 'A circle can have up to 12 people');
    if (body.role === 'elderly' && members.some((m) => m.role === 'elderly')) throw new HttpError(400, 'This circle already has an elder');
    await assertPinFree(ctx.store, ctx.circle.id, body.pin);
    const { pin, ...rest } = body;
    const member = { id: newId('m_'), circleId: ctx.circle.id, ...rest, pinHash: await hashPin(pin), createdAt: new Date().toISOString() };
    await ctx.store.put(C.members, member);
    await logActivity(ctx.store, { circleId: ctx.circle.id, actor: ctx.member, action: 'member-added', detail: `Added ${member.name} as ${member.role}`, forElderly: true });
    return { status: 201, data: { member: publicMember(member) } };
  });

  r.put('/api/members/:id', auth, async (ctx) => {
    const target = await owned(ctx, C.members, ctx.params.id);
    const self = target.id === ctx.member.id;
    if (!self && !can(ctx.member.role, 'manageMembers')) throw new HttpError(403, 'You can only change your own details');
    const schema = { name: memberSchema.name, relation: memberSchema.relation, email: memberSchema.email, phone: memberSchema.phone, pin: v.pin() };
    const body = validate(schema, ctx.body, { partial: true });
    const updated = { ...target };
    for (const k of ['name', 'relation', 'email', 'phone']) if (k in body) updated[k] = body[k];
    if (body.pin) {
      assertStrongPin(body.pin);
      await assertPinFree(ctx.store, ctx.circle.id, body.pin, target.id);
      updated.pinHash = await hashPin(body.pin);
    }
    await ctx.store.put(C.members, updated);
    return { member: publicMember(updated) };
  });

  r.delete('/api/members/:id', auth, allow('manageMembers'), async (ctx) => {
    const target = await owned(ctx, C.members, ctx.params.id);
    if (target.role === 'elderly') throw new HttpError(400, 'The elder cannot be removed from their own circle');
    if (target.id === ctx.member.id) throw new HttpError(400, 'You cannot remove yourself');
    await ctx.store.del(C.members, target.id);
    const sessions = await ctx.store.query(C.sessions, [['memberId', '==', target.id]]);
    for (const s of sessions) await ctx.store.del(C.sessions, s.id);
    await logActivity(ctx.store, { circleId: ctx.circle.id, actor: ctx.member, action: 'member-removed', detail: `Removed ${target.name}`, forElderly: true });
    return { ok: true };
  });
}
