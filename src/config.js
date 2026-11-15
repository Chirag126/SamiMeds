/**
 * Central configuration, read once from environment variables.
 * Every Google integration is optional so the app runs locally with zero setup.
 */
const env = process.env;

const bool = (value, fallback = false) =>
  value === undefined ? fallback : ['1', 'true', 'yes'].includes(String(value).toLowerCase());

const onCloudRun = Boolean(env.K_SERVICE);

export const config = Object.freeze({
  port: Number(env.PORT) || 8080,
  isProduction: env.NODE_ENV === 'production' || onCloudRun,
  onCloudRun,

  /** 'memory' (default locally) or 'firestore' (default on Cloud Run). */
  store: env.STORE || (onCloudRun ? 'firestore' : 'memory'),
  dataFile: env.DATA_FILE || '',
  collectionPrefix: env.COLLECTION_PREFIX || 'samimeds_',

  demoMode: bool(env.DEMO_MODE),
  defaultTimezone: env.DEFAULT_TIMEZONE || 'Asia/Kolkata',
  publicUrl: (env.PUBLIC_URL || '').replace(/\/$/, ''),

  /** Shared secret Cloud Scheduler sends in the X-Cron-Secret header. */
  cronSecret: env.CRON_SECRET || '',
  internalScheduler: bool(env.INTERNAL_SCHEDULER, !onCloudRun),

  geminiApiKey: env.GEMINI_API_KEY || '',
  geminiModel: env.GEMINI_MODEL || 'gemini-2.5-flash',

  photoBucket: env.PHOTO_BUCKET || '',

  smtp: {
    host: env.SMTP_HOST || '',
    port: Number(env.SMTP_PORT) || 465,
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || env.SMTP_USER || 'SamiMeds <no-reply@samimeds.app>',
  },

  session: {
    shortHours: 12,
    rememberDays: 30,
  },
  lockout: {
    maxFailures: 5,
    lockMinutes: 15,
  },
});
