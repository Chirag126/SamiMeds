/**
 * REST API: composes the route modules into one router.
 * Each module owns one area of the app; shared guards live in middleware.js.
 */
import { Router } from '../http.js';
import { registerSystemRoutes } from './system.js';
import { registerAuthRoutes } from './auth.js';
import { registerDosesRoutes } from './doses.js';
import { registerMedicinesRoutes } from './medicines.js';
import { registerAppointmentsRoutes } from './appointments.js';
import { registerWellbeingRoutes } from './wellbeing.js';
import { registerActivityRoutes } from './activity.js';
import { registerCircleRoutes } from './circle.js';
import { registerRealtimeRoutes } from './realtime.js';
import { registerCronRoutes } from './cron.js';
import { registerSosRoutes } from './sos.js';

export { SESSION_COOKIE } from './middleware.js';

export function buildApi() {
  const r = new Router();
  registerSystemRoutes(r);
  registerAuthRoutes(r);
  registerDosesRoutes(r);
  registerMedicinesRoutes(r);
  registerAppointmentsRoutes(r);
  registerWellbeingRoutes(r);
  registerActivityRoutes(r);
  registerCircleRoutes(r);
  registerRealtimeRoutes(r);
  registerSosRoutes(r);
  registerCronRoutes(r);
  return r;
}
