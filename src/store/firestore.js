/**
 * Google Cloud Firestore store.
 * On Cloud Run it uses the service account automatically (no keys).
 * Elsewhere (e.g. Render) it uses GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.
 */

import { matches } from './memory.js';

const FAILED_PRECONDITION = 9; // Firestore's code for "this query needs an index"

/** Parses a service-account key given as raw JSON or base64-encoded JSON. */
export function parseServiceAccount(value) {
  if (!value) return null;
  const text = value.trim().startsWith('{') ? value : Buffer.from(value, 'base64').toString('utf8');
  const key = JSON.parse(text);
  if (!key.client_email || !key.private_key || !key.project_id) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email, private_key or project_id');
  }
  return key;
}

export class FirestoreStore {
  constructor(db, prefix = '') {
    this.db = db;
    this.prefix = prefix;
    this.warned = new Set();
  }

  static async create(prefix, serviceAccountJson = '') {
    const { Firestore } = await import('@google-cloud/firestore');
    const key = parseServiceAccount(serviceAccountJson);
    const db = new Firestore({
      ignoreUndefinedProperties: true,
      ...(key && {
        projectId: key.project_id,
        credentials: { client_email: key.client_email, private_key: key.private_key },
      }),
    });
    // Fail fast with a clear message if credentials or the database are wrong.
    await db.collection(`${prefix}circles`).limit(1).get();
    return new FirestoreStore(db, prefix);
  }

  ref(name) {
    return this.db.collection(this.prefix + name);
  }

  async get(name, id) {
    const snap = await this.ref(name).doc(id).get();
    return snap.exists ? snap.data() : null;
  }

  async put(name, doc) {
    if (!doc?.id) throw new Error('Document needs an id');
    await this.ref(name).doc(doc.id).set(doc);
    return doc;
  }

  async del(name, id) {
    await this.ref(name).doc(id).delete();
  }

  async run(name, filters) {
    let q = this.ref(name);
    for (const [field, op, value] of filters) q = q.where(field, op, value);
    const snap = await q.get();
    return snap.docs.map((d) => d.data());
  }

  /**
   * Runs the query on Firestore. If a composite index is missing, it still works:
   * the equality filters run on Firestore and the rest are applied here.
   * Create the indexes in firestore.indexes.json to make these queries fully indexed.
   */
  async query(name, filters = []) {
    try {
      return await this.run(name, filters);
    } catch (err) {
      if (err?.code !== FAILED_PRECONDITION) throw err;
      if (!this.warned.has(name)) {
        this.warned.add(name);
        console.warn(`[firestore] Missing index for "${this.prefix}${name}" – using a slower fallback. ${err.message}`);
      }
      const equal = filters.filter(([, op]) => op === '==');
      const rest = filters.filter(([, op]) => op !== '==');
      const docs = await this.run(name, equal);
      return docs.filter((doc) => rest.every((f) => matches(doc, f)));
    }
  }
}
