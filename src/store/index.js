import { config } from '../config.js';
import { MemoryStore } from './memory.js';
import { FirestoreStore } from './firestore.js';

/** Builds the configured store. Falls back to memory if Firestore cannot load. */
export async function createStore(kind = config.store) {
  if (kind === 'firestore') {
    try {
      return await FirestoreStore.create(config.collectionPrefix, config.googleServiceAccountJson);
    } catch (err) {
      console.error('[store] Firestore unavailable, using in-memory store:', err.message);
    }
  }
  return new MemoryStore({ file: config.dataFile });
}

/** Collection names in one place. */
export const C = Object.freeze({
  circles: 'circles',
  members: 'members',
  medicines: 'medicines',
  photos: 'photos',
  doses: 'doses',
  appointments: 'appointments',
  moods: 'moods',
  activity: 'activity',
  notifications: 'notifications',
  sessions: 'sessions',
  lockouts: 'lockouts',
  push: 'push',
});
