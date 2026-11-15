/**
 * Tiny schema validation. Each rule returns the cleaned value or throws ValidationError.
 */
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

const fail = (field, msg) => {
  throw new ValidationError(`${field}: ${msg}`);
};

export const v = {
  string: ({ max = 200, min = 0, optional = false } = {}) => (val, field) => {
    if (val == null || val === '') {
      if (optional) return '';
      if (min > 0) fail(field, 'is required');
      return '';
    }
    if (typeof val !== 'string') fail(field, 'must be text');
    const s = val.trim().replace(/[\u0000-\u001f\u007f]/g, ' ');
    if (s.length < min) fail(field, `must be at least ${min} characters`);
    if (s.length > max) fail(field, `must be at most ${max} characters`);
    return s;
  },
  text: ({ max = 1000 } = {}) => (val, field) => {
    if (val == null) return '';
    if (typeof val !== 'string') fail(field, 'must be text');
    if (val.length > max) fail(field, `must be at most ${max} characters`);
    return val.trim();
  },
  enum: (values, { optional = false } = {}) => (val, field) => {
    if ((val == null || val === '') && optional) return null;
    if (!values.includes(val)) fail(field, `must be one of ${values.join(', ')}`);
    return val;
  },
  number: ({ min = -Infinity, max = Infinity, optional = false, integer = false } = {}) => (val, field) => {
    if (val == null || val === '') {
      if (optional) return null;
      fail(field, 'is required');
    }
    const n = Number(val);
    if (!Number.isFinite(n)) fail(field, 'must be a number');
    if (integer && !Number.isInteger(n)) fail(field, 'must be a whole number');
    if (n < min || n > max) fail(field, `must be between ${min} and ${max}`);
    return n;
  },
  bool: () => (val) => Boolean(val),
  time: () => (val, field) => {
    if (typeof val !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(val)) fail(field, 'must be a time like 08:30');
    return val;
  },
  date: ({ optional = false } = {}) => (val, field) => {
    if ((val == null || val === '') && optional) return null;
    if (typeof val !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(val) || Number.isNaN(Date.parse(val))) {
      fail(field, 'must be a date like 2026-01-31');
    }
    return val;
  },
  email: ({ optional = false } = {}) => (val, field) => {
    if (val == null || val === '') {
      if (optional) return '';
      fail(field, 'is required');
    }
    const s = String(val).trim().toLowerCase();
    if (s.length > 254 || !/^[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}$/i.test(s)) fail(field, 'must be a valid email');
    return s;
  },
  phone: ({ optional = true } = {}) => (val, field) => {
    if (val == null || val === '') {
      if (optional) return '';
      fail(field, 'is required');
    }
    const s = String(val).trim();
    if (!/^\+?[\d\s-]{6,20}$/.test(s)) fail(field, 'must be a phone number');
    return s.replace(/[\s-]/g, '');
  },
  pin: () => (val, field) => {
    const s = String(val ?? '');
    if (!/^\d{4,6}$/.test(s)) fail(field, 'must be 4 to 6 digits');
    return s;
  },
  array: (item, { max = 20, min = 0 } = {}) => (val, field) => {
    if (val == null) val = [];
    if (!Array.isArray(val)) fail(field, 'must be a list');
    if (val.length < min) fail(field, `needs at least ${min} item(s)`);
    if (val.length > max) fail(field, `can have at most ${max} items`);
    return val.map((x, i) => item(x, `${field}[${i}]`));
  },
};

/** Validates `input` against `schema`. With `partial`, missing keys are skipped (for updates). */
export function validate(schema, input, { partial = false } = {}) {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) {
    throw new ValidationError('Request body must be a JSON object');
  }
  const out = {};
  for (const [key, rule] of Object.entries(schema)) {
    if (partial && !(key in input)) continue;
    out[key] = rule(input[key], key);
  }
  return out;
}
