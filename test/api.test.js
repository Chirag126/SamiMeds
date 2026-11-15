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
after(() => { server.closeAllConnections(); server.close(); });

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

/* ---------- live sync, push, photo proof, prescription scan, compression ---------- */

const PNG = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]).toString('base64')}`;
const pendingDose = async (c) => (await c('/api/today')).data.doses.find((d) => d.status === 'pending');

test('static files are gzipped and revalidated with ETag', async () => {
  const res = await fetch(`${base}/js/common.js`, { headers: { 'accept-encoding': 'gzip' } });
  assert.equal(res.headers.get('content-encoding'), 'gzip');
  const etag = res.headers.get('etag');
  assert.ok(etag);
  const again = await fetch(`${base}/js/common.js`, { headers: { 'if-none-match': etag } });
  assert.equal(again.status, 304);
});

test('live sync: other screens are told when the elder takes a dose', async () => {
  const elder = await login(DEMO.pins.elderly);
  // open the caretaker's event stream using the same cookie
  const cookieRes = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'X-Requested-With': 'SamiMeds', 'content-type': 'application/json' }, body: JSON.stringify({ code: DEMO.code, pin: DEMO.pins.caretaker }) });
  const cookie = cookieRes.headers.get('set-cookie').split(';')[0];
  const ac = new AbortController();
  const stream = await fetch(`${base}/api/events`, { headers: { cookie }, signal: ac.signal });
  assert.equal(stream.headers.get('content-type'), 'text/event-stream');
  const reader = stream.body.getReader();
  const dose = await pendingDose(elder);
  await elder(`/api/doses/${dose.id}/take`, { method: 'POST', body: {} });
  let text = '';
  while (!text.includes('event: change')) {
    const { value, done } = await reader.read();
    if (done) break;
    text += Buffer.from(value).toString();
  }
  ac.abort();
  assert.match(text, /event: change/);
  await elder(`/api/doses/${dose.id}/undo`, { method: 'POST', body: {} });
  assert.equal((await client()('/api/events')).status, 401);
});

test('push: only real push services are accepted; family is notified when the elder takes a dose', async () => {
  const { setPushSender } = await import('../src/services/push.js');
  const sent = [];
  setPushSender(async (sub, payload) => { sent.push({ endpoint: sub.endpoint, ...JSON.parse(payload) }); });
  const keys = { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) };
  const fam = await login(DEMO.pins.family);
  const elder = await login(DEMO.pins.elderly);
  assert.equal((await fam('/api/push/subscribe', { method: 'POST', body: { subscription: { endpoint: 'https://evil.example.com/x', keys } } })).status, 400);
  assert.equal((await fam('/api/push/subscribe', { method: 'POST', body: { subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/family1', keys } } })).status, 201);
  assert.equal((await elder('/api/push/subscribe', { method: 'POST', body: { subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/elder1', keys } } })).status, 201);
  assert.equal((await fam('/api/push/test', { method: 'POST', body: {} })).data.sent, 1);

  sent.length = 0;
  const dose = await pendingDose(elder);
  await elder(`/api/doses/${dose.id}/take`, { method: 'POST', body: {} });
  assert.equal(sent.length, 1);
  assert.match(sent[0].endpoint, /family1/);
  assert.match(sent[0].title, /took/);
  await elder(`/api/doses/${dose.id}/undo`, { method: 'POST', body: {} });

  // expired subscriptions are removed
  setPushSender(async () => { throw Object.assign(new Error('gone'), { statusCode: 410 }); });
  await fam('/api/push/test', { method: 'POST', body: {} });
  setPushSender(async (sub, payload) => { sent.push({ endpoint: sub.endpoint, ...JSON.parse(payload) }); });
  assert.equal((await fam('/api/push/test', { method: 'POST', body: {} })).data.sent, 0);
});

test('photo proof: elder sends a photo, only family can verify, caretaker sees the result', async () => {
  const elder = await login(DEMO.pins.elderly);
  const fam = await login(DEMO.pins.family);
  const care = await login(DEMO.pins.caretaker);
  const dose = await pendingDose(elder);

  assert.equal((await elder(`/api/doses/${dose.id}/proof`, { method: 'PUT', body: { dataUrl: 'data:text/html;base64,PGI+' } })).status, 400);
  const sentPhoto = await elder(`/api/doses/${dose.id}/proof`, { method: 'PUT', body: { dataUrl: PNG } });
  assert.equal(sentPhoto.data.dose.status, 'taken');
  assert.equal(sentPhoto.data.dose.proof.status, 'pending');

  const img = await fetch(`${base}/api/doses/${dose.id}/proof`, { headers: { cookie: '' } });
  assert.equal(img.status, 401);
  assert.equal((await care(`/api/doses/${dose.id}/verify`, { method: 'POST', body: { ok: true } })).status, 403);
  assert.equal((await elder(`/api/doses/${dose.id}/verify`, { method: 'POST', body: { ok: true } })).status, 403);

  const verified = await fam(`/api/doses/${dose.id}/verify`, { method: 'POST', body: { ok: true } });
  assert.equal(verified.data.dose.proof.status, 'verified');
  assert.equal(verified.data.dose.proof.verifiedBy, 'Chirag');
  const seenByCaretaker = (await care('/api/today')).data.doses.find((d) => d.id === dose.id);
  assert.equal(seenByCaretaker.proof.status, 'verified');

  // undo removes the photo
  await fam(`/api/doses/${dose.id}/undo`, { method: 'POST', body: {} });
  assert.equal((await care('/api/today')).data.doses.find((d) => d.id === dose.id).proof, null);
  assert.equal((await fam(`/api/doses/${dose.id}/verify`, { method: 'POST', body: { ok: true } })).status, 409);
});

test('prescription scan needs Gemini and validates the image', async () => {
  const fam = await login(DEMO.pins.family);
  assert.equal((await fam('/api/ai/scan-prescription', { method: 'POST', body: { dataUrl: 'nope' } })).status, 400);
  assert.equal((await fam('/api/ai/scan-prescription', { method: 'POST', body: { dataUrl: PNG } })).status, 503);
});

/* ---------- "I have a question": instant, one alert, answerable ---------- */

test('question: replies at once even when email is slow, sends one alert, family can answer', async () => {
  const { setEmailSender } = await import('../src/services/email.js');
  const delivered = [];
  // Simulate a host that blocks SMTP: every send hangs for a long time.
  setEmailSender((m) => new Promise((resolve) => setTimeout(() => { delivered.push(m); resolve(); }, 3000)));
  try {
    const fam = await login(DEMO.pins.family);
    const elder = await login(DEMO.pins.elderly);
    await fam('/api/members/m_demo_family', { method: 'PUT', body: { email: 'chirag@example.com' } });
    await fam('/api/medicines', { method: 'POST', body: { name: 'Folic Acid', times: ['23:30'] } });
    const update = (await elder('/api/today')).data.updates.find((u) => u.detail.includes('Folic Acid'));

    const started = Date.now();
    const first = await elder(`/api/activity/${update.id}/ack`, { method: 'POST', body: { response: 'question' } });
    assert.ok(Date.now() - started < 1500, 'the elder gets an answer without waiting for email');
    assert.equal(first.data.ack, 'question');

    // tapping again (or on a second phone) sends nothing more
    for (let i = 0; i < 4; i += 1) {
      const again = await elder(`/api/activity/${update.id}/ack`, { method: 'POST', body: { response: 'question' } });
      assert.equal(again.data.already, true);
    }
    const alerts = (await fam('/api/notifications')).data.notifications.filter((n) => n.kind === 'elder-question' && n.preview.includes('Folic Acid'));
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].sending, true);

    // the elder keeps seeing the question until the family answers
    let today = (await elder('/api/today')).data;
    assert.ok(today.openQuestions.some((q) => q.id === update.id));

    assert.equal((await elder(`/api/activity/${update.id}/answer`, { method: 'POST', body: {} })).status, 403);
    assert.equal((await fam(`/api/activity/${update.id}/answer`, { method: 'POST', body: {} })).status, 200);
    today = (await elder('/api/today')).data;
    assert.ok(!today.openQuestions.some((q) => q.id === update.id));
    assert.ok(today.answered.some((a) => a.id === update.id && a.answeredBy === 'Chirag'));

    // background delivery finishes and the log is updated
    await new Promise((r) => setTimeout(r, 3300));
    const done = (await fam('/api/notifications')).data.notifications.find((n) => n.id === alerts[0].id);
    assert.equal(done.sending, false);
    assert.equal(done.delivered, true);
    assert.equal(delivered.length, 1);
  } finally {
    setEmailSender(null);
  }
});

test('"Not well" tapped again within an hour alerts the family only once', async () => {
  const elder = await login(DEMO.pins.elderly);
  const fam = await login(DEMO.pins.family);
  const count = async () => (await fam('/api/notifications')).data.notifications.filter((n) => n.kind === 'mood-unwell').length;
  const before = await count();
  await elder('/api/moods', { method: 'POST', body: { mood: 'unwell' } });
  await elder('/api/moods', { method: 'POST', body: { mood: 'unwell' } });
  await elder('/api/moods', { method: 'POST', body: { mood: 'unwell' } });
  assert.ok((await count()) - before <= 1);
});
