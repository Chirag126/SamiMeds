/** Health check and public feature flags. */
import { config } from '../config.js';
import { emailEnabled } from '../services/email.js';
import { geminiEnabled } from '../services/gemini.js';

/** @param {import('../http.js').Router} r */
export function registerSystemRoutes(r) {

  r.get('/api/health', async (ctx) => ({
    ok: true,
    store: ctx.store.constructor.name === 'FirestoreStore' ? 'firestore' : 'memory',
  }));

  r.get('/api/config', async () => ({
    demo: config.demoMode,
    gemini: geminiEnabled(),
    email: emailEnabled(),
    lockoutAttempts: config.lockout.maxFailures,
  }));
}
