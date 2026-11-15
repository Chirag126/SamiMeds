import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMedicineText } from '../src/services/parser.js';
import { daysLeft, needsRefill, adjustStock } from '../src/services/refill.js';
import { evaluateAppointment, plainSpecialty } from '../src/services/appointments.js';
import { googleCalendarLink } from '../src/services/calendar.js';
import { localParts, localEpoch, addDays, formatTime12 } from '../src/services/time.js';
import { hashPin, verifyPin, isWeakPin, newCircleCode, RateLimiter } from '../src/services/auth.js';
import { v, validate, ValidationError } from '../src/services/validate.js';
import { sanitizeParsed } from '../src/services/gemini.js';
import { decodeDataUrl } from '../src/services/photos.js';

/* parser */
test('parses a once-daily description', () => {
  const r = parseMedicineText('Amlodipine 5mg once daily after breakfast');
  assert.equal(r.name, 'Amlodipine');
  assert.equal(r.dose, '5 mg');
  assert.deepEqual(r.times, ['09:00']);
  assert.equal(r.instructions, 'after breakfast');
});

test('parses twice a day with pack size and pills per dose', () => {
  const r = parseMedicineText('Metformin 500 mg 1 tablet twice a day after meals, 60 tablets');
  assert.deepEqual(r.times, ['09:00', '21:00']);
  assert.equal(r.stock, 60);
  assert.equal(r.pillsPerDose, 1);
});

test('understands medical shorthand and explicit times', () => {
  assert.equal(parseMedicineText('Paracetamol 650 mg TDS').times.length, 3);
  assert.deepEqual(parseMedicineText('Thyroxine 50 mcg at 6:30 am').times, ['06:30']);
  assert.deepEqual(parseMedicineText('Atorvastatin 10mg at night').times, ['21:30']);
});

/* refill */
test('refill maths', () => {
  const m = { active: true, stock: 10, pillsPerDose: 1, times: ['08:00', '20:00'], refillThresholdDays: 5 };
  assert.equal(daysLeft(m), 5);
  assert.equal(needsRefill(m), true);
  assert.equal(needsRefill({ ...m, stock: 40 }), false);
  assert.equal(daysLeft({ ...m, stock: null }), null);
  assert.equal(adjustStock(m, -1).stock, 9);
  assert.equal(adjustStock({ ...m, stock: 0 }, -1).stock, 0);
  assert.equal(adjustStock({ ...m, stock: 30, refillAlertSent: true }, 1).refillAlertSent, false);
});

/* appointments */
test('appointment reminders: day before, then morning, never after', () => {
  const appt = { status: 'upcoming', date: '2026-01-11', time: '11:00', dayBeforeSent: false, morningSent: false };
  assert.deepEqual(evaluateAppointment(appt, localEpoch('2026-01-10', '09:00')).actions, []);
  assert.deepEqual(evaluateAppointment(appt, localEpoch('2026-01-10', '12:00')).actions, ['day-before']);
  assert.deepEqual(evaluateAppointment({ ...appt, dayBeforeSent: true }, localEpoch('2026-01-11', '07:05')).actions, ['morning']);
  assert.deepEqual(evaluateAppointment(appt, localEpoch('2026-01-11', '12:00')).actions, []);
  assert.deepEqual(evaluateAppointment({ ...appt, status: 'cancelled' }, localEpoch('2026-01-10', '12:00')).actions, []);
});

test('early appointment gets its morning reminder 2h before', () => {
  const appt = { status: 'upcoming', date: '2026-01-11', time: '08:00', dayBeforeSent: true, morningSent: false };
  assert.deepEqual(evaluateAppointment(appt, localEpoch('2026-01-11', '05:59')).actions, []);
  assert.deepEqual(evaluateAppointment(appt, localEpoch('2026-01-11', '06:00')).actions, ['morning']);
});

test('plain-language specialties', () => {
  assert.equal(plainSpecialty('Cardiology'), 'Heart doctor');
  assert.equal(plainSpecialty('Podiatry'), 'Podiatry');
});

test('Google Calendar link carries date, timezone and checklist', () => {
  const url = new URL(googleCalendarLink({ doctor: 'Dr. Sharma', date: '2026-01-11', time: '11:00', checklist: ['BP diary'] }, 'Asia/Kolkata'));
  assert.equal(url.hostname, 'calendar.google.com');
  assert.equal(url.searchParams.get('dates'), '20260111T110000/20260111T120000');
  assert.equal(url.searchParams.get('ctz'), 'Asia/Kolkata');
  assert.match(url.searchParams.get('details'), /BP diary/);
});

/* time */
test('timezone conversion', () => {
  const p = localParts(new Date('2026-01-10T03:00:00Z'), 'Asia/Kolkata');
  assert.equal(p.date, '2026-01-10');
  assert.equal(p.minutes, 8 * 60 + 30);
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(formatTime12('00:05'), '12:05 AM');
  assert.equal(formatTime12('21:30'), '9:30 PM');
});

/* auth */
test('PIN hashing round-trip', async () => {
  const hash = await hashPin('4826');
  assert.match(hash, /^scrypt\$/);
  assert.equal(await verifyPin('4826', hash), true);
  assert.equal(await verifyPin('4827', hash), false);
  assert.equal(await verifyPin('4826', 'garbage'), false);
});

test('weak PINs are rejected', () => {
  for (const p of ['1111', '1234', '987654', '000000']) assert.equal(isWeakPin(p), true, p);
  for (const p of ['4826', '1947', '2580']) assert.equal(isWeakPin(p), false, p);
});

test('circle codes avoid confusing characters', () => {
  for (let i = 0; i < 50; i += 1) assert.match(newCircleCode(), /^[A-HJKMNP-Z2-9]{6}$/);
});

test('rate limiter', () => {
  const rl = new RateLimiter({ limit: 2, windowMs: 1000 });
  assert.equal(rl.allow('a', 0), true);
  assert.equal(rl.allow('a', 1), true);
  assert.equal(rl.allow('a', 2), false);
  assert.equal(rl.allow('a', 2000), true);
});

/* validation */
test('validation cleans and rejects input', () => {
  const schema = { name: v.string({ min: 1, max: 5 }), t: v.time(), e: v.email({ optional: true }) };
  assert.deepEqual(validate(schema, { name: ' Ab ', t: '08:00', e: '' }), { name: 'Ab', t: '08:00', e: '' });
  assert.throws(() => validate(schema, { name: 'toolong', t: '08:00' }), ValidationError);
  assert.throws(() => validate(schema, { name: 'a', t: '25:00' }), /time/);
  assert.throws(() => validate(schema, { name: 'a', t: '08:00', e: 'nope' }), /email/);
  assert.throws(() => validate(schema, []), /JSON object/);
  assert.deepEqual(validate(schema, { t: '09:00' }, { partial: true }), { t: '09:00' });
});

/* AI output is never trusted blindly */
test('Gemini output is sanitised', () => {
  const fallback = parseMedicineText('Aspirin 75 mg once daily');
  const r = sanitizeParsed({ name: 'Aspirin', times: ['9am', '08:00', '25:00'], pillsPerDose: 99, stock: -3 }, fallback);
  assert.deepEqual(r.times, ['08:00']);
  assert.equal(r.pillsPerDose, fallback.pillsPerDose);
  assert.equal(r.stock, fallback.stock);
});

/* photos */
test('photo upload checks type and magic bytes', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]).toString('base64');
  assert.equal(decodeDataUrl(`data:image/png;base64,${png}`).contentType, 'image/png');
  assert.throws(() => decodeDataUrl(`data:image/png;base64,${Buffer.from('<svg>hi</svg>').toString('base64')}`), /valid image/);
  assert.throws(() => decodeDataUrl('data:image/svg+xml;base64,AAAA'), /JPEG, PNG or WebP/);
});

/* Render / Firestore credentials */
test('service-account key accepted as raw JSON or base64', async () => {
  const { parseServiceAccount } = await import('../src/store/firestore.js');
  const key = { project_id: 'p', client_email: 'a@p.iam.gserviceaccount.com', private_key: 'k' };
  assert.equal(parseServiceAccount(JSON.stringify(key)).project_id, 'p');
  assert.equal(parseServiceAccount(Buffer.from(JSON.stringify(key)).toString('base64')).client_email, key.client_email);
  assert.equal(parseServiceAccount(''), null);
  assert.throws(() => parseServiceAccount('{"project_id":"p"}'), /missing/);
});

test('Firestore query falls back when a composite index is missing', async () => {
  const { FirestoreStore } = await import('../src/store/firestore.js');
  const docs = [{ id: 'a', circleId: 'c', date: '2026-01-01' }, { id: 'b', circleId: 'c', date: '2026-01-09' }, { id: 'x', circleId: 'z', date: '2026-01-09' }];
  const fakeDb = {
    collection: () => {
      const make = (filters) => ({
        where: (f, op, v) => make([...filters, [f, op, v]]),
        get: async () => {
          if (filters.some(([, op]) => op !== '==')) throw Object.assign(new Error('The query requires an index'), { code: 9 });
          return { docs: docs.filter((d) => filters.every(([f, , v]) => d[f] === v)).map((d) => ({ data: () => d })) };
        },
      });
      return make([]);
    },
  };
  const store = new FirestoreStore(fakeDb, 'p_');
  const warn = console.warn; console.warn = () => {};
  const out = await store.query('doses', [['circleId', '==', 'c'], ['date', '>=', '2026-01-05']]);
  console.warn = warn;
  assert.deepEqual(out.map((d) => d.id), ['b']);
});

test('prescription scan output is cleaned', async () => {
  const { sanitizeScan } = await import('../src/services/gemini.js');
  const out = sanitizeScan({ medicines: [
    { name: 'Telmisartan', dose: '40 mg', times: ['09:00', 'bad'], pillsPerDose: 1, purpose: 'For blood pressure' },
    { name: '', times: ['08:00'] },
    { name: 'Pantoprazole', times: [] },
  ] });
  assert.deepEqual(out.map((m) => m.name), ['Telmisartan', 'Pantoprazole']);
  assert.deepEqual(out[0].times, ['09:00']);
  assert.deepEqual(out[1].times, ['09:00']);
  assert.deepEqual(sanitizeScan({}), []);
});

test('push goes to the right people', async () => {
  const { audienceFor, validateSubscription } = await import('../src/services/push.js');
  assert.deepEqual(audienceFor('elder-upcoming'), ['elderly']);
  assert.deepEqual(audienceFor('family-missed'), ['family', 'caretaker']);
  assert.deepEqual(audienceFor('elder-question'), ['family', 'caretaker']);
  assert.equal(audienceFor('appointment-morning').length, 3);
  assert.throws(() => validateSubscription({ endpoint: 'http://fcm.googleapis.com/x', keys: {} }), /unknown push service/);
});

test('Hindi translation: phrases, patterns and untouched family text', async () => {
  const { toHindi } = await import('../public/js/i18n.js');
  assert.equal(toHindi('✅ I took it'), '✅ मैंने ले ली');
  assert.equal(toHindi('In 6 min'), '6 मिनट में');
  assert.equal(toHindi('Sunday, 15 November'), 'रविवार, 15 नवंबर');
  assert.equal(toHindi('⏳ Due 4 min ago'), '⏳ 4 मिनट पहले लेनी थी');
  assert.equal(toHindi('Amlodipine'), 'Amlodipine');
  assert.equal(toHindi('BP diary, Old reports, Medicine list'), 'BP diary, Old reports, Medicine list');
});

/* Gmail API email (works where SMTP is blocked) */
test('Gmail: MIME message is valid and header injection is impossible', async () => {
  const { buildMime } = await import('../src/services/gmail.js');
  const mime = buildMime({
    from: 'SamiMeds <a@gmail.com>', to: ['x@example.com\r\nBcc: evil@example.com'], subject: '💊 Hello\r\nBcc: evil@example.com',
    text: 'नमस्ते', html: '<p>hi</p>',
  }, 'B');
  const headers = mime.split('\r\n\r\n')[0];
  assert.doesNotMatch(headers, /^Bcc:/m);
  assert.match(headers, /^Subject: =\?UTF-8\?B\?/m);
  assert.match(mime, /Content-Type: text\/plain; charset=UTF-8/);
  const textPart = mime.split('--B')[1].split('\r\n\r\n')[1];
  assert.equal(Buffer.from(textPart.replace(/\r\n/g, ''), 'base64').toString('utf8'), 'नमस्ते');
});

test('Gmail: refreshes the token once, then sends with it', async () => {
  const { config } = await import('../src/config.js');
  Object.assign(config.gmail, { clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh', from: 'me@gmail.com' });
  const gmail = await import('../src/services/gmail.js');
  gmail.resetGmailToken();
  const calls = [];
  const fakeFetch = async (url, opts) => {
    calls.push({ url, opts });
    if (url.includes('oauth2')) return { ok: true, status: 200, json: async () => ({ access_token: 'tok', expires_in: 3600 }) };
    return { ok: true, status: 200, json: async () => ({ id: 'msg1' }) };
  };
  try {
    assert.equal(gmail.gmailEnabled(), true);
    await gmail.sendViaGmail({ to: ['a@b.com'], subject: 'Hi', text: 't', html: 'h' }, fakeFetch);
    await gmail.sendViaGmail({ to: ['a@b.com'], subject: 'Hi', text: 't', html: 'h' }, fakeFetch);
    assert.equal(calls.filter((c) => c.url.includes('oauth2')).length, 1);
    const send = calls.find((c) => c.url.includes('gmail.googleapis.com'));
    assert.equal(send.opts.headers.authorization, 'Bearer tok');
    assert.ok(JSON.parse(send.opts.body).raw);
    gmail.resetGmailToken();
    const bad = async () => ({ ok: false, status: 400, json: async () => ({ error: 'invalid_grant' }) });
    await assert.rejects(gmail.sendViaGmail({ to: ['a@b.com'], subject: 'x', text: 't', html: 'h' }, bad), /refresh token expired/);
  } finally {
    Object.assign(config.gmail, { clientId: '', clientSecret: '', refreshToken: '' });
    gmail.resetGmailToken();
  }
});
