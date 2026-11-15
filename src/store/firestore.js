/**
 * Google Cloud Firestore store. Uses Application Default Credentials,
 * so on Cloud Run it works with the service account and no keys.
 */
export class FirestoreStore {
  constructor(db, prefix = '') {
    this.db = db;
    this.prefix = prefix;
  }

  static async create(prefix) {
    const { Firestore } = await import('@google-cloud/firestore');
    const db = new Firestore({ ignoreUndefinedProperties: true });
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
