/**
 * Central configuration, read once from environment variables.
 * Every Google integration is optional so the app runs locally with zero setup.
 */
const env = process.env;

const bool = (value, fallback = false) =>
  value === undefined ? fallback : ['1', 'true', 'yes'].includes(String(value).toLowerCase());

const onCloudRun = Boolean(env.K_SERVICE);
const onRender = env.RENDER === 'true';
const hasGoogleCredentials = Boolean(env.GOOGLE_APPLICATION_CREDENTIALS || env.GOOGLE_SERVICE_ACCOUNT_JSON);

export const config = Object.freeze({
  port: Number(env.PORT) || 8080,
  isProduction: env.NODE_ENV === 'production' || onCloudRun || onRender,
  onCloudRun,
  onRender,

  /**
   * 'memory' or 'firestore'. Firestore is the default on Cloud Run, and anywhere
   * (e.g. Render) once Google credentials are provided.
   */
  store: env.STORE || (onCloudRun || hasGoogleCredentials ? 'firestore' : 'memory'),
  /** Service-account key as raw JSON or base64 – handy on hosts like Render. */
  googleServiceAccountJson: env.GOOGLE_SERVICE_ACCOUNT_JSON || '',
  dataFile: env.DATA_FILE || '',
  collectionPrefix: env.COLLECTION_PREFIX || 'samimeds_',

  demoMode: bool(env.DEMO_MODE),
  /**
   * Contact details for the demo circle's people. Kept in the environment,
   * not in the code, so real emails and phone numbers never land in the public repo.
   */
  demo: {
    elderEmail: env.DEMO_ELDER_EMAIL || '',
    familyEmail: env.DEMO_FAMILY_EMAIL || '',
    familyPhone: env.DEMO_FAMILY_PHONE || '',
    caretakerEmail: env.DEMO_CARETAKER_EMAIL || '',
    caretakerPhone: env.DEMO_CARETAKER_PHONE || '',
  },
  defaultTimezone: env.DEFAULT_TIMEZONE || 'Asia/Kolkata',
  // Render sets RENDER_EXTERNAL_URL automatically.
  publicUrl: (env.PUBLIC_URL || env.RENDER_EXTERNAL_URL || '').replace(/\/$/, ''),

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
