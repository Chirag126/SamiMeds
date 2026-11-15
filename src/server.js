import { createServer } from 'node:http';
import { config } from './config.js';
import { createStore } from './store/index.js';
import { createApp } from './app.js';
import { runTick } from './services/care.js';
import { seedDemo } from './seed.js';

const store = await createStore();

if (config.demoMode) {
  const result = await seedDemo(store);
  console.log(result.created
    ? `[demo] Seeded demo circle ${result.code} – elder PIN ${result.pins.elderly}, family ${result.pins.family}, caretaker ${result.pins.caretaker}`
    : `[demo] Demo circle ${result.code} ready`);
}

const server = createServer(createApp(store));
server.listen(config.port, () => {
  console.log(`SamiMeds listening on http://localhost:${config.port} (store: ${store.constructor.name})`);
});

// Locally (and on always-on hosts) run reminders in-process every minute.
// On Cloud Run, Cloud Scheduler calls POST /api/cron/tick instead.
if (config.internalScheduler) {
  const tick = () => runTick(store).catch((err) => console.error('[tick]', err));
  setInterval(tick, 60_000).unref();
  setTimeout(tick, 5_000).unref();
}

const shutdown = () => {
  server.close(() => {
    store.flush?.();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5_000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
