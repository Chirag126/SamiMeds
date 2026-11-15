import { scrypt, randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { config } from '../config.js';
import { C } from '../store/index.js';

const scryptAsync = promisify(scrypt);
const KEY_LEN = 32;

export const ROLES = Object.freeze(['elderly', 'caretaker', 'family']);

/** What each role may do. Elderly people stay in control of their own care. */
export const PERMISSIONS = Object.freeze({
  view: ['elderly', 'caretaker', 'family'],
  takeDose: ['elderly', 'caretaker', 'family'],
  manageCare: ['elderly', 'caretaker', 'family'],
  skipDose: ['caretaker', 'family'],
  verifyProof: ['family'],
  settings: ['caretaker', 'family'],
  manageMembers: ['family'],
});

export const can = (role, action) => PERMISSIONS[action]?.includes(role) ?? false;

export async function hashPin(pin) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(pin, salt, KEY_LEN);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPin(pin, stored) {
  const [scheme, saltB64, hashB64] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scryptAsync(String(pin), Buffer.from(saltB64, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}

/** Rejects PINs that are trivially guessable (all same digit or a straight run). */
export function isWeakPin(pin) {
  if (/^(\d)\1+$/.test(pin)) return true;
  const digits = [...pin].map(Number);
  const up = digits.every((d, i) => i === 0 || d === digits[i - 1] + 1);
  const down = digits.every((d, i) => i === 0 || d === digits[i - 1] - 1);
  return up || down;
}

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L confusion

export function newCircleCode(length = 6) {
  const bytes = randomBytes(length);
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

export const newId = (prefix = '') => prefix + randomBytes(9).toString('base64url');

const tokenHash = (token) => createHash('sha256').update(token).digest('hex');

export function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function createSession(store, member, { remember = false } = {}) {
  const token = randomBytes(32).toString('base64url');
  const maxAgeSec = remember ? config.session.rememberDays * 86_400 : config.session.shortHours * 3_600;
  await store.put(C.sessions, {
    id: tokenHash(token),
    circleId: member.circleId,
    memberId: member.id,
    expiresAt: Date.now() + maxAgeSec * 1000,
  });
  return { token, maxAgeSec };
}

export async function readSession(store, token) {
  if (!token || token.length > 100) return null;
  const session = await store.get(C.sessions, tokenHash(token));
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    await store.del(C.sessions, session.id);
    return null;
  }
  return session;
}

export async function destroySession(store, token) {
  if (token) await store.del(C.sessions, tokenHash(token));
}

/** Per-circle lockout after repeated wrong PINs. */
export async function checkLockout(store, code, now = Date.now()) {
  const rec = await store.get(C.lockouts, code);
  if (rec?.lockedUntil && rec.lockedUntil > now) {
    return { locked: true, retryAfterSec: Math.ceil((rec.lockedUntil - now) / 1000) };
  }
  return { locked: false };
}

export async function recordFailure(store, code, now = Date.now()) {
  const rec = (await store.get(C.lockouts, code)) || { id: code, failures: 0, lockedUntil: 0 };
  if (rec.lockedUntil && rec.lockedUntil <= now) {
    rec.failures = 0;
    rec.lockedUntil = 0;
  }
  rec.failures += 1;
  if (rec.failures >= config.lockout.maxFailures) {
    rec.lockedUntil = now + config.lockout.lockMinutes * 60_000;
  }
  await store.put(C.lockouts, rec);
  return { attemptsLeft: Math.max(0, config.lockout.maxFailures - rec.failures), locked: rec.lockedUntil > now };
}

export async function clearFailures(store, code) {
  await store.del(C.lockouts, code);
}

/** Finds the member of a circle whose PIN matches. PINs are unique within a circle. */
export async function findMemberByPin(store, circleId, pin) {
  const members = await store.query(C.members, [['circleId', '==', circleId]]);
  for (const m of members) {
    if (await verifyPin(pin, m.pinHash)) return m;
  }
  return null;
}

/** Simple in-memory IP limiter as a second line of defence against brute force. */
export class RateLimiter {
  constructor({ limit, windowMs }) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.hits = new Map();
  }

  allow(key, now = Date.now()) {
    const entry = this.hits.get(key);
    if (!entry || entry.reset < now) {
      this.hits.set(key, { count: 1, reset: now + this.windowMs });
      if (this.hits.size > 10_000) this.prune(now);
      return true;
    }
    entry.count += 1;
    return entry.count <= this.limit;
  }

  prune(now) {
    for (const [k, e] of this.hits) if (e.reset < now) this.hits.delete(k);
  }
}
