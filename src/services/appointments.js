import { localEpoch } from './time.js';

/**
 * Pure reminder logic for a doctor appointment.
 *  - "day-before": from 24h before until 3h before
 *  - "morning": from 7 AM on the day (or 2h before an early visit) until the visit
 * If both are due at once only the morning reminder goes out.
 */
export function evaluateAppointment(appt, nowEpoch) {
  const actions = [];
  const updates = {};
  if (appt.status !== 'upcoming') return { actions, updates };

  const at = localEpoch(appt.date, appt.time);
  if (nowEpoch >= at) return { actions, updates };

  const morningAt = Math.min(localEpoch(appt.date, '07:00'), at - 120);
  if (!appt.morningSent && nowEpoch >= morningAt) {
    actions.push('morning');
    Object.assign(updates, { morningSent: true, dayBeforeSent: true });
    return { actions, updates };
  }
  if (!appt.dayBeforeSent && nowEpoch >= at - 1440 && nowEpoch < at - 180) {
    actions.push('day-before');
    updates.dayBeforeSent = true;
  }
  return { actions, updates };
}

export const SPECIALTY_PLAIN = {
  cardiology: 'Heart doctor',
  cardiologist: 'Heart doctor',
  endocrinology: 'Sugar / hormone doctor',
  diabetologist: 'Sugar doctor',
  orthopedics: 'Bone & joint doctor',
  orthopedic: 'Bone & joint doctor',
  ophthalmology: 'Eye doctor',
  ophthalmologist: 'Eye doctor',
  neurology: 'Nerve & brain doctor',
  neurologist: 'Nerve & brain doctor',
  nephrology: 'Kidney doctor',
  pulmonology: 'Lung doctor',
  dermatology: 'Skin doctor',
  ent: 'Ear, nose & throat doctor',
  dentist: 'Teeth doctor',
  physician: 'Family doctor',
  'general physician': 'Family doctor',
};

/** Friendly words for a specialty, for the elder's screen. */
export function plainSpecialty(specialty) {
  if (!specialty) return '';
  return SPECIALTY_PLAIN[specialty.trim().toLowerCase()] || specialty;
}
