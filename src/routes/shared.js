/** Request schemas and small helpers shared by several route modules. */
import { HttpError } from '../http.js';
import { v } from '../services/validate.js';
import { ROLES, isWeakPin, verifyPin } from '../services/auth.js';
import { isValidTimezone, formatTime12 } from '../services/time.js';
import { daysLeft, needsRefill } from '../services/refill.js';
import { circleMembers } from '../services/care.js';

const COLORS = ['white', 'yellow', 'orange', 'pink', 'red', 'blue', 'green', 'purple', 'brown'];
const SHAPES = ['round', 'oval', 'capsule', 'liquid', 'drops', 'injection', 'inhaler'];
export const MOODS = ['good', 'okay', 'unwell'];
export const SCAN_MAX_BYTES = 650 * 1024;

/** Storage id of the photo an elder sends as proof for a dose. */
export const proofId = (doseId) => `proof_${doseId}`;

/** "08:00, 21:00" → "8:00 AM, 9:00 PM" for activity messages. */
export const times12 = (times) => times.map(formatTime12).join(', ');

/* --------------------------------------------------------------- schemas */

export const memberSchema = {
  name: v.string({ min: 1, max: 60 }),
  role: v.enum(ROLES),
  relation: v.string({ max: 40, optional: true }),
  email: v.email({ optional: true }),
  phone: v.phone(),
  pin: v.pin(),
};

export const medicineSchema = {
  name: v.string({ min: 1, max: 80 }),
  dose: v.string({ max: 40, optional: true }),
  pillDescription: v.string({ max: 60, optional: true }),
  purpose: v.string({ max: 80, optional: true }),
  instructions: v.string({ max: 120, optional: true }),
  times: v.array(v.time(), { min: 1, max: 8 }),
  color: v.enum(COLORS, { optional: true }),
  shape: v.enum(SHAPES, { optional: true }),
  stock: v.number({ min: 0, max: 9999, optional: true }),
  pillsPerDose: v.number({ min: 0.25, max: 10, optional: true }),
  refillThresholdDays: v.number({ min: 1, max: 30, integer: true, optional: true }),
  endDate: v.date({ optional: true }),
};

export const appointmentSchema = {
  doctor: v.string({ min: 1, max: 80 }),
  specialty: v.string({ max: 60, optional: true }),
  date: v.date(),
  time: v.time(),
  location: v.string({ max: 160, optional: true }),
  notes: v.text({ max: 500 }),
  checklist: v.array(v.string({ min: 1, max: 60 }), { max: 12 }),
};

export const circleSettingsSchema = {
  elderName: v.string({ min: 1, max: 60 }),
  timezone: v.string({ min: 1, max: 60 }),
  emergencyPhone: v.phone(),
  emergencyName: v.string({ max: 60, optional: true }),
};

export function checkTimezone(tz) {
  if (!isValidTimezone(tz)) throw new HttpError(400, 'timezone: unknown timezone');
}

/** PINs are unique within a circle, because the PIN alone identifies the person. */
export async function assertPinFree(store, circleId, pin, exceptId) {
  const members = await circleMembers(store, circleId);
  for (const m of members) {
    if (m.id !== exceptId && (await verifyPin(pin, m.pinHash))) {
      throw new HttpError(409, 'That PIN is already used by someone in this circle. Please choose another.');
    }
  }
}

export function assertStrongPin(pin) {
  if (isWeakPin(pin)) throw new HttpError(400, 'pin: too easy to guess (avoid 1111 or 1234). Try a family date.');
}

/** A medicine with its computed days left and refill flag. */
export const medicineView = (m) => ({ ...m, daysLeft: daysLeft(m), needsRefill: needsRefill(m) });
