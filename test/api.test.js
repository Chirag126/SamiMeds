import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { MemoryStore } from '../src/store/memory.js';
import { createApp } from '../src/app.js';
import { seedDemo, DEMO } from '../src/seed.js';
import { runTick, runCircleTick } from '../src/services/care.js';
import { C } from '../src/store/index.js';
import { localEpoch } from '../src/services/time.js';

let server;
let base;
const store = new MemoryStore();

before(async () => {
  await seedDemo(store);
  server = createServer(createApp(store));
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

/** Minimal client that keeps the session cookie. */
function client() {
  let cookie = '';
  return async (path, { method = 'GET', body, headers = {} } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        'X-Requested-With': 'SamiMeds',
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const data = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
    return { status: res.status, data, headers: res.headers };
  };
}

async function login(pin) {
  const c = client();
  const r = await c('/api/auth/login', { method: 'POST', body: { code: DEMO.code, pin } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return c;
}

test('security headers and static pages', async () => {
  const r = await client()('/');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await client()('/../package.json')).status, 404);
});

test('API requires sign in', async () => {
  assert.equal((await client()('/api/today')).status, 401);
});

test('state-changing calls need the CSRF header', async () => {
  const r = await client()('/api/auth/login', { method: 'POST', body: { code: 'DEMO', pin: '2580' }, headers: { 'X-Requested-With': '' } });
  assert.equal(r.status, 403);
});

test('session cookie is HttpOnly and SameSite=Strict', async () => {
  const r = await client()('/api/auth/login', { method: 'POST', body: { code: 'demo', pin: DEMO.pins.elderly } });
  assert.match(r.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
});

test('elder can see today and take a dose; stock goes down; undo restores', async () => {
  const elder = await login(DEMO.pins.elderly);
  const today = await elder('/api/today');
  assert.equal(today.status, 200);
  const dose = today.data.doses.find((d) => d.status === 'pending');
  assert.ok(dose, 'a pending dose exists');
  const before = await store.get(C.medicines, dose.medicineId);

  const taken = await elder(`/api/doses/${dose.id}/take`, { method: 'POST', body: {} });
  assert.equal(taken.data.dose.status, 'taken');
  if (before.stock != null) assert.equal((await store.get(C.medicines, dose.medicineId)).stock, before.stock - 1);

  const undone = await elder(`/api/doses/${dose.id}/undo`, { method: 'POST', body: {} });
  assert.notEqual(undone.data.dose.status, 'taken');
  if (before.stock != null) assert.equal((await store.get(C.medicines, dose.medicineId)).stock, before.stock);
});

test('roles: elder cannot manage members or read the alert log; caretaker cannot add members', async () => {
  const elder = await login(DEMO.pins.elderly);
  assert.equal((await elder('/api/members', { method: 'POST', body: { name: 'X', role: 'family', pin: '4826' } })).status, 403);
  assert.equal((await elder('/api/notifications')).status, 403);
  const care = await login(DEMO.pins.caretaker);
  assert.equal((await care('/api/members', { method: 'POST', body: { name: 'X', role: 'family', pin: '4826' } })).status, 403);
  assert.equal((await care('/api/notifications')).status, 200);
});

test('family adds a medicine, elder sees an update and can ask a question', async () => {
  const fam = await login(DEMO.pins.family);
  const r = await fam('/api/medicines', { method: 'POST', body: { name: 'Vitamin B12', dose: '500 mcg', times: ['23:59'], color: 'red', shape: 'round', stock: 30 } });
  assert.equal(r.status, 201);
  assert.equal(r.data.medicine.daysLeft, 30);

  const bad = await fam('/api/medicines', { method: 'POST', body: { name: '', times: ['8am'] } });
  assert.equal(bad.status, 400);

  const elder = await login(DEMO.pins.elderly);
  const today = await elder('/api/today');
  const update = today.data.updates.find((u) => u.detail.includes('Vitamin B12'));
  assert.ok(update);
  assert.equal((await elder(`/api/activity/${update.id}/ack`, { method: 'POST', body: { response: 'question' } })).status, 200);
  const notes = await fam('/api/notifications');
  assert.ok(notes.data.notifications.some((n) => n.kind === 'elder-question'));
});

test('cannot read another circle\'s data', async () => {
  const other = client();
  const created = await other('/api/circles', {
    method: 'POST',
    body: { elderName: 'Ram', elderPin: '4826', familyName: 'Sita', familyEmail: 'sita@example.com', familyPin: '7391', timezone: 'Asia/Kolkata' },
  });
  assert.equal(created.status, 201);
  assert.match(created.data.code, /^[A-Z2-9]{6}$/);
  const demoMed = (await store.query(C.medicines, [['circleId', '==', 'c_demo']]))[0];
  assert.equal((await other(`/api/medicines/${demoMed.id}`, { method: 'PUT', body: { name: 'hacked' } })).status, 404);
  assert.equal((await other(`/api/medicines/${demoMed.id}/photo`)).status, 404);
});

test('setup rejects weak and duplicate PINs', async () => {
  const c = client();
  const base = { elderName: 'A', familyName: 'B', familyEmail: 'b@example.com', timezone: 'Asia/Kolkata' };
  assert.equal((await c('/api/circles', { method: 'POST', body: { ...base, elderPin: '1234', familyPin: '7391' } })).status, 400);
  assert.equal((await c('/api/circles', { method: 'POST', body: { ...base, elderPin: '7391', familyPin: '7391' } })).status, 400);
  assert.equal((await c('/api/circles', { method: 'POST', body: { ...base, elderPin: '7391', familyPin: '4826', timezone: 'Mars/Base' } })).status, 400);
});

test('lockout after 5 wrong PINs', async () => {
  const c = client();
  await store.put(C.circles, { id: 'c_lock', code: 'LOCKME', elderName: 'L', timezone: 'UTC' });
  let last;
  for (let i = 0; i < 5; i += 1) last = await c('/api/auth/login', { method: 'POST', body: { code: 'LOCKME', pin: '9999' } });
  assert.equal(last.status, 401);
  const locked = await c('/api/auth/login', { method: 'POST', body: { code: 'LOCKME', pin: '9999' } });
  assert.equal(locked.status, 423);
});

test('mood "not well" notifies family', async () => {
  const elder = await login(DEMO.pins.elderly);
  const r = await elder('/api/moods', { method: 'POST', body: { mood: 'unwell' } });
  assert.equal(r.status, 201);
  assert.equal(r.data.notified, true);
});

test('appointments: create, checklist tick, calendar link, done', async () => {
  const fam = await login(DEMO.pins.family);
  const r = await fam('/api/appointments', { method: 'POST', body: { doctor: 'Dr. Rao', specialty: 'Neurology', date: '2099-01-05', time: '10:30', checklist: ['MRI'], notes: '' } });
  assert.equal(r.status, 201);
  assert.match(r.data.appointment.calendarUrl, /calendar\.google\.com/);
  assert.equal(r.data.appointment.plainSpecialty, 'Nerve & brain doctor');
  const elder = await login(DEMO.pins.elderly);
  const tick = await elder(`/api/appointments/${r.data.appointment.id}/checklist`, { method: 'POST', body: { index: 0, done: true } });
  assert.deepEqual(tick.data.checklistDone, [true]);
  const done = await fam(`/api/appointments/${r.data.appointment.id}`, { method: 'PUT', body: { status: 'done' } });
  assert.equal(done.data.appointment.status, 'done');
});

test('reports: weekly summary and doctor report', async () => {
  const fam = await login(DEMO.pins.family);
  const weekly = await fam('/api/reports/weekly');
  assert.ok(weekly.data.lines.length >= 4);
  const doctor = await fam('/api/reports/doctor');
  assert.ok(doctor.data.medicines.length > 0);
  assert.ok('overall' in doctor.data.stats);
});

test('AI quick-add falls back to the offline parser', async () => {
  const fam = await login(DEMO.pins.family);
  const r = await fam('/api/ai/parse-medicine', { method: 'POST', body: { text: 'Losartan 50mg twice daily' } });
  assert.equal(r.data.parsed.name, 'Losartan');
  assert.equal(r.data.parsed.times.length, 2);
});

test('cron endpoint needs the secret', async () => {
  assert.equal((await client()('/api/cron/tick', { method: 'POST', body: {} })).status, 401);
});

test('scheduler escalates a forgotten dose to the family exactly once', async () => {
  const circle = { id: 'c_tick', code: 'TICK01', elderName: 'Tara', timezone: 'UTC', lastWeeklySummary: '2026-01-11' };
  await store.put(C.circles, circle);
  await store.put(C.members, { id: 'm_t1', circleId: 'c_tick', name: 'Tara', role: 'elderly', email: 'tara@example.com', pinHash: 'x' });
  await store.put(C.members, { id: 'm_t2', circleId: 'c_tick', name: 'Son', role: 'family', email: 'son@example.com', pinHash: 'x' });
  await store.put(C.medicines, { id: 'med_t', circleId: 'c_tick', name: 'Pill', times: ['08:00'], active: true, stock: null, startEpoch: localEpoch('2026-01-12', 0) });

  const kinds = async (iso) => (await runCircleTick(store, circle, new Date(iso))).map((n) => n.kind);
  assert.deepEqual(await kinds('2026-01-12T07:52:00Z'), ['elder-upcoming']);
  assert.deepEqual(await kinds('2026-01-12T08:31:00Z'), ['elder-second']);
  assert.deepEqual(await kinds('2026-01-12T09:01:00Z'), ['family-missed']);
  assert.deepEqual(await kinds('2026-01-12T09:30:00Z'), []);
  const sent = (await store.query(C.notifications, [['circleId', '==', 'c_tick']])).find((n) => n.kind === 'family-missed');
  assert.deepEqual(sent.to, ['son@example.com']);

  const summary = await runTick(store, new Date('2026-01-12T10:00:00Z'));
  assert.ok(summary.circles >= 2);
});
