import { C } from './store/index.js';
import { hashPin, newId } from './services/auth.js';
import { localParts, addDays, localEpoch } from './services/time.js';
import { plannedDoses } from './services/doses.js';
import { config } from './config.js';

export const DEMO = Object.freeze({
  code: 'DEMO',
  pins: { elderly: '2580', family: '1357', caretaker: '2468' },
});

/** Deterministic pseudo-random so the demo history looks the same every time. */
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/** Creates a lively demo care circle (idempotent). */
export async function seedDemo(store, at = new Date()) {
  const existing = await store.query(C.circles, [['code', '==', DEMO.code]]);
  if (existing.length) return { created: false, code: DEMO.code, pins: DEMO.pins };

  const tz = config.defaultTimezone;
  const now = localParts(at, tz);
  const iso = at.toISOString();
  const circle = {
    id: 'c_demo', code: DEMO.code, elderName: 'Kamla Devi', timezone: tz,
    emergencyPhone: config.demo.familyPhone, emergencyName: 'Chirag', createdAt: iso, lastWeeklySummary: null,
  };
  await store.put(C.circles, circle);

  const members = [
    { name: 'Kamla Devi', role: 'elderly', relation: '', email: config.demo.elderEmail, phone: '', pin: DEMO.pins.elderly },
    { name: 'Chirag', role: 'family', relation: 'Son', email: config.demo.familyEmail, phone: config.demo.familyPhone, pin: DEMO.pins.family },
    { name: 'Anjali', role: 'caretaker', relation: 'Nurse', email: config.demo.caretakerEmail, phone: config.demo.caretakerPhone, pin: DEMO.pins.caretaker },
  ];
  for (const m of members) {
    const { pin, ...rest } = m;
    await store.put(C.members, { id: `m_demo_${m.role}`, circleId: circle.id, ...rest, pinHash: await hashPin(pin), createdAt: iso });
  }

  // One medicine due right about now, so the elder's big "now" card is visible in the demo.
  const soon = Math.min(23 * 60 + 45, Math.floor((now.minutes + 10) / 15) * 15);
  const soonTime = `${String(Math.floor(soon / 60)).padStart(2, '0')}:${String(soon % 60).padStart(2, '0')}`;

  const startEpoch = localEpoch(addDays(now.date, -8), 0);
  const meds = [
    { name: 'Metformin', dose: '500 mg', pillDescription: '1 white tablet', purpose: 'For sugar (diabetes)', instructions: 'after food', times: ['09:00', '21:00'], color: 'white', shape: 'round', stock: 40 },
    { name: 'Amlodipine', dose: '5 mg', pillDescription: '1 small pink tablet', purpose: 'For blood pressure', instructions: 'with water, after breakfast', times: ['08:00'], color: 'pink', shape: 'round', stock: 4 },
    { name: 'Calcium + Vitamin D', dose: '500 mg', pillDescription: '1 yellow capsule', purpose: 'For strong bones', instructions: 'after lunch', times: ['14:00'], color: 'yellow', shape: 'capsule', stock: 30 },
    { name: 'Atorvastatin', dose: '10 mg', pillDescription: '1 white oval tablet', purpose: 'For cholesterol', instructions: 'at bedtime', times: ['21:30'], color: 'white', shape: 'oval', stock: 25 },
    { name: 'Eye drops', dose: '', pillDescription: '1 drop in each eye', purpose: 'For dry eyes', instructions: 'tilt head back gently', times: [soonTime], color: 'blue', shape: 'drops', stock: null, startToday: true },
  ].map((m, i) => ({
    id: `med_demo_${i}`, circleId: circle.id, ...m, pillsPerDose: 1, refillThresholdDays: 5, active: true, hasPhoto: false,
    refillAlertSent: false, startEpoch: m.startToday ? now.epoch - 30 : startEpoch, createdAt: iso, updatedAt: iso, createdBy: 'Chirag',
  }));
  for (const m of meds) {
    const { startToday: _startToday, ...doc } = m;
    await store.put(C.medicines, doc);
  }

  // Seven days of history: mostly on time, a couple late, two missed.
  const rand = rng(42);
  for (let back = 7; back >= 0; back -= 1) {
    const date = addDays(now.date, -back);
    for (const med of meds) {
      if (med.startToday && back > 0) continue;
      for (const dose of plannedDoses(med, date, med.startEpoch)) {
        const due = localEpoch(date, dose.time);
        if (back === 0 && due > now.epoch - 61) continue; // leave upcoming doses for the live demo
        const roll = rand();
        const missed = back > 0 && roll < 0.06;
        const late = Math.round(roll < 0.2 ? 35 + rand() * 40 : rand() * 20);
        await store.put(C.doses, {
          ...dose,
          medicineName: med.name,
          status: missed ? 'missed' : 'taken',
          takenAt: missed ? null : iso,
          takenBy: missed ? null : 'Kamla Devi',
          lateMinutes: missed ? null : late,
          upcomingSent: true, secondSent: true, snoozeNotified: true, familyAlerted: missed,
        });
      }
    }
  }

  const moods = ['good', 'good', 'okay', 'good', 'good', 'good', 'good'];
  for (let back = 7; back >= 1; back -= 1) {
    const date = addDays(now.date, -back);
    await store.put(C.moods, { id: `mo_demo_${back}`, circleId: circle.id, date, mood: moods[back - 1], at: `${date}T04:00:00.000Z`, by: 'Kamla Devi' });
  }

  await store.put(C.appointments, {
    id: 'ap_demo_1', circleId: circle.id, doctor: 'Dr. Sharma', specialty: 'Cardiology', date: addDays(now.date, 1), time: '11:00',
    location: 'City Heart Clinic, MG Road', notes: 'Routine BP check-up', checklist: ['BP diary', 'Old reports', 'Reading glasses', 'Medicine list'],
    checklistDone: [false, false, false, false], status: 'upcoming', dayBeforeSent: true, morningSent: false, createdAt: iso, createdBy: 'Chirag',
  });
  await store.put(C.appointments, {
    id: 'ap_demo_2', circleId: circle.id, doctor: 'Dr. Mehta', specialty: 'Ophthalmology', date: addDays(now.date, 10), time: '16:30',
    location: 'Vision Eye Care, Station Road', notes: 'Eye pressure check', checklist: ['Spectacles', 'Eye drops'],
    checklistDone: [false, false], status: 'upcoming', dayBeforeSent: false, morningSent: false, createdAt: iso, createdBy: 'Anjali',
  });
  await store.put(C.appointments, {
    id: 'ap_demo_0', circleId: circle.id, doctor: 'Dr. Iyer', specialty: 'General physician', date: addDays(now.date, -5), time: '10:00',
    location: 'Family Clinic', notes: 'Sugar test reviewed – all fine', checklist: [], checklistDone: [], status: 'done',
    dayBeforeSent: true, morningSent: true, createdAt: iso, createdBy: 'Chirag',
  });

  await store.put(C.activity, {
    id: newId('a_'), circleId: circle.id, at: iso, actorName: 'Chirag', actorRole: 'family', action: 'medicine-added',
    detail: 'Added Calcium + Vitamin D 500 mg at 2:00 PM', forElderly: true, ack: null,
  });
  await store.put(C.activity, {
    id: newId('a_'), circleId: circle.id, at: new Date(at.getTime() - 3_600_000).toISOString(), actorName: 'Anjali', actorRole: 'caretaker',
    action: 'appointment-added', detail: `Booked Dr. Mehta on ${addDays(now.date, 10)} at 4:30 PM`, forElderly: true, ack: 'ok',
  });

  return { created: true, code: DEMO.code, pins: DEMO.pins };
}
