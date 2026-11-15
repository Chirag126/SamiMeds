/**
 * Google Cloud Firestore store.
 * On Cloud Run it uses the service account automatically (no keys).
 * Elsewhere (e.g. Render) it uses GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.
 */

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

  async query(name, filters = []) {
    let q = this.ref(name);
    for (const [field, op, value] of filters) q = q.where(field, op, value);
    const snap = await q.get();
    return snap.docs.map((d) => d.data());
  }
}
