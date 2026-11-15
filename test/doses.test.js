import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  plannedDoses, evaluateDose, markTaken, markSnoozed, undoTaken, adherence, streak, pickNow, doseId, ESCALATION,
} from '../src/services/doses.js';
import { localEpoch } from '../src/services/time.js';

const med = { id: 'm1', circleId: 'c1', active: true, times: ['08:00', '20:00'] };
const dose = (overrides = {}) => ({ ...plannedDoses(med, '2026-01-10')[0], ...overrides });
const at = (time, date = '2026-01-10') => localEpoch(date, time);

test('plannedDoses creates one pending dose per time', () => {
  const list = plannedDoses(med, '2026-01-10');
  assert.equal(list.length, 2);
  assert.equal(list[0].id, doseId('m1', '2026-01-10', '08:00'));
  assert.equal(list[0].status, 'pending');
});

test('plannedDoses skips times before the medicine was added', () => {
  const list = plannedDoses(med, '2026-01-10', at('14:00'));
  assert.deepEqual(list.map((d) => d.time), ['20:00']);
});

test('inactive or ended medicines plan nothing', () => {
  assert.equal(plannedDoses({ ...med, active: false }, '2026-01-10').length, 0);
  assert.equal(plannedDoses({ ...med, endDate: '2026-01-09' }, '2026-01-10').length, 0);
});

test('no action well before the dose', () => {
  assert.deepEqual(evaluateDose(dose(), at('07:00')).actions, []);
});

test('upcoming reminder 10 minutes before', () => {
  const r = evaluateDose(dose(), at('07:50'));
  assert.deepEqual(r.actions, ['elder-upcoming']);
  assert.equal(r.updates.upcomingSent, true);
});

test('upcoming reminder is not sent twice', () => {
  assert.deepEqual(evaluateDose(dose({ upcomingSent: true }), at('07:55')).actions, []);
});

test('second reminder after 30 minutes', () => {
  const r = evaluateDose(dose({ upcomingSent: true }), at('08:30'));
  assert.deepEqual(r.actions, ['elder-second']);
});

test('family alerted after 60 minutes and dose marked missed', () => {
  const r = evaluateDose(dose({ upcomingSent: true, secondSent: true }), at('09:00'));
  assert.deepEqual(r.actions, ['family-missed']);
  assert.equal(r.updates.status, 'missed');
});

test('catching up after downtime sends only the family alert', () => {
  const r = evaluateDose(dose(), at('11:00'));
  assert.deepEqual(r.actions, ['family-missed']);
});

test('very old doses (after an outage) become missed without an alert', () => {
  const r = evaluateDose(dose(), at('08:00', '2026-01-11'));
  assert.deepEqual(r.actions, []);
  assert.equal(r.updates.status, 'missed');
});

test('taken doses never escalate', () => {
  assert.deepEqual(evaluateDose(dose({ status: 'taken' }), at('12:00')).actions, []);
});

test('snooze silences reminders until it ends, then reminds once', () => {
  const snoozed = markSnoozed(dose({ upcomingSent: true }), at('08:05'));
  assert.equal(snoozed.snoozeUntil, at('08:05') + ESCALATION.snoozeMinutes);
  assert.deepEqual(evaluateDose(snoozed, at('08:10')).actions, []);
  const r = evaluateDose(snoozed, at('08:21'));
  assert.deepEqual(r.actions, ['elder-snooze']);
  assert.deepEqual(evaluateDose({ ...snoozed, ...r.updates }, at('08:25')).actions, []);
});

test('snoozing cannot hide a missed dose from family', () => {
  const snoozed = markSnoozed(dose(), at('08:55'));
  assert.deepEqual(evaluateDose(snoozed, at('09:01')).actions, ['family-missed']);
});

test('snooze limit is enforced', () => {
  assert.throws(() => markSnoozed(dose({ snoozeCount: ESCALATION.maxSnoozes }), at('08:00')), /limit/);
});

test('markTaken records lateness and undo restores status', () => {
  const taken = markTaken(dose(), { nowEpoch: at('08:40'), at: 'iso', by: 'Kamla' });
  assert.equal(taken.status, 'taken');
  assert.equal(taken.lateMinutes, 40);
  assert.equal(undoTaken(taken, at('08:45')).status, 'pending');
  assert.equal(undoTaken(taken, at('09:30')).status, 'missed');
});

test('adherence counts settled doses only', () => {
  const doses = [
    dose({ status: 'taken', lateMinutes: 5 }),
    dose({ status: 'taken', lateMinutes: 50 }),
    dose({ status: 'missed' }),
    { ...dose(), time: '20:00' }, // still in the future
  ];
  const a = adherence(doses, at('12:00'));
  assert.deepEqual(a, { total: 3, taken: 2, onTime: 1, missed: 1, rate: 67 });
  assert.equal(adherence([], at('12:00')).rate, null);
});

test('streak counts consecutive fully-taken days', () => {
  const d = (date, status) => ({ date, status });
  const list = [
    d('2026-01-07', 'missed'), d('2026-01-08', 'taken'), d('2026-01-09', 'taken'), d('2026-01-09', 'taken'), d('2026-01-10', 'taken'),
  ];
  assert.equal(streak(list, '2026-01-10'), 3);
  assert.equal(streak([...list, d('2026-01-10', 'pending')], '2026-01-10'), 2);
});

test('pickNow shows the due dose and the next one', () => {
  const doses = plannedDoses({ ...med, times: ['08:00', '14:00', '20:00'] }, '2026-01-10');
  const r = pickNow(doses, at('13:45'));
  assert.equal(r.now.time, '14:00');
  assert.equal(r.next.time, '20:00');
  // A late dose stays on the card for 3 hours, then the card clears.
  assert.equal(pickNow(doses, at('10:30')).now.time, '08:00');
  assert.equal(pickNow(doses, at('11:30')).now, null);
});
