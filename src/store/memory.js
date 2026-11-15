import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';

/** Applies one [field, op, value] filter to a document. */
export function matches(doc, [field, op, value]) {
  const actual = doc[field];
  switch (op) {
    case '==': return actual === value;
    case '!=': return actual !== value;
    case '>=': return actual >= value;
    case '<=': return actual <= value;
    case '>': return actual > value;
    case '<': return actual < value;
    case 'in': return Array.isArray(value) && value.includes(actual);
    default: throw new Error(`Unsupported operator ${op}`);
  }
}

/**
 * In-memory document store with optional JSON-file persistence.
 * Same interface as the Firestore store so the rest of the app never knows the difference.
 */
export class MemoryStore {
  constructor({ file = '' } = {}) {
    this.file = file;
    this.data = new Map();
    this.saveTimer = null;
    if (file && existsSync(file)) {
      const raw = JSON.parse(readFileSync(file, 'utf8'));
      for (const [name, docs] of Object.entries(raw)) {
        this.data.set(name, new Map(Object.entries(docs)));
      }
    }
  }

  col(name) {
    if (!this.data.has(name)) this.data.set(name, new Map());
    return this.data.get(name);
  }

  async get(name, id) {
    const doc = this.col(name).get(id);
    return doc ? structuredClone(doc) : null;
  }

  async put(name, doc) {
    if (!doc?.id) throw new Error('Document needs an id');
    this.col(name).set(doc.id, structuredClone(doc));
    this.scheduleSave();
    return doc;
  }

  async del(name, id) {
    this.col(name).delete(id);
    this.scheduleSave();
  }

  async query(name, filters = []) {
    const out = [];
    for (const doc of this.col(name).values()) {
      if (filters.every((f) => matches(doc, f))) out.push(structuredClone(doc));
    }
    return out;
  }

  scheduleSave() {
    if (!this.file || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.flush();
    }, 200);
    this.saveTimer.unref?.();
  }

  flush() {
    if (!this.file) return;
    const out = {};
    for (const [name, docs] of this.data) out[name] = Object.fromEntries(docs);
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(out));
    renameSync(tmp, this.file);
  }
}
