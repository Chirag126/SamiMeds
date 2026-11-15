import { config } from '../config.js';
import { C } from '../store/index.js';
import { newId } from './auth.js';
import { sendPush, audienceFor } from './push.js';
import { publish } from './events.js';
import { gmailEnabled, sendViaGmail } from './gmail.js';

let transporterPromise = null;

/** Lazily creates a nodemailer transport (e.g. Gmail SMTP with an app password). */
async function transporter() {
  if (!config.smtp.host) return null;
  if (!transporterPromise) {
    transporterPromise = import('nodemailer')
      .then(({ default: nodemailer }) =>
        nodemailer.createTransport({
          host: config.smtp.host,
          port: config.smtp.port,
          secure: config.smtp.port === 465,
          auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
          // Fail fast instead of hanging for minutes when the host blocks SMTP.
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 20_000,
        }),
      )
      .catch((err) => {
        console.error('[email] nodemailer unavailable:', err.message);
        return null;
      });
  }
  return transporterPromise;
}

export const emailEnabled = () => gmailEnabled() || Boolean(config.smtp.host);

/** Which way email is sent: 'gmail-api' (HTTPS), 'smtp', or 'none'. */
export const emailTransport = () => (gmailEnabled() ? 'gmail-api' : config.smtp.host ? 'smtp' : 'none');

let testSender = null;
/** Test hook: replace real delivery with a function (message) => Promise. */
export function setEmailSender(fn) {
  testSender = fn;
}

/** Delivers one message using the best available transport. Throws on failure. */
async function deliver(message) {
  if (testSender) return testSender(message);
  if (gmailEnabled()) return sendViaGmail(message);
  const tx = await transporter();
  if (!tx) throw Object.assign(new Error('Email not configured – shown here only'), { notConfigured: true });
  return tx.sendMail({ from: config.smtp.from, ...message, to: message.to.join(', ') });
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Wraps plain text lines in a large, readable email layout. */
export function renderHtml(title, lines, cta) {
  const body = lines.map((l) => `<p style="font-size:18px;line-height:1.5;margin:0 0 12px">${escapeHtml(l)}</p>`).join('');
  const button = cta
    ? `<p><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:#1f7a4d;color:#fff;padding:14px 24px;border-radius:12px;font-size:18px;text-decoration:none">${escapeHtml(cta.label)}</a></p>`
    : '';
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#fff8ef;padding:24px;color:#2b2118">
<div style="max-width:560px;margin:auto;background:#fff;border-radius:16px;padding:24px">
<h1 style="font-size:24px;margin:0 0 16px">💊 ${escapeHtml(title)}</h1>${body}${button}
<p style="font-size:13px;color:#7a6a5a;margin-top:24px">Sent by SamiMeds care reminders.</p></div></body></html>`;
}

/**
 * Sends an email and always records it in the circle's notification log,
 * so families can see every reminder even when email isn't configured (demo mode).
 * The same message also goes to phones as a push notification, and open screens refresh.
 *
 * With `wait: false` it returns straight away (status "sending") and finishes in the
 * background – used when a person is waiting on a button.
 */
export async function sendEmail(store, { circleId, to, subject, lines, kind, cta }, { wait = true } = {}) {
  const recipients = [...new Set((to || []).filter(Boolean))];
  const record = {
    id: newId('n_'),
    circleId,
    at: new Date().toISOString(),
    kind,
    to: recipients,
    subject,
    preview: lines.join(' ').slice(0, 300),
    delivered: false,
    sending: recipients.length > 0,
    via: emailTransport(),
    error: recipients.length ? null : 'No email address on file',
  };
  await store.put(C.notifications, record);

  const finish = async () => {
    if (recipients.length) {
      try {
        await deliver({
          to: recipients,
          subject,
          text: lines.join('\n\n') + (cta ? `\n\n${cta.label}: ${cta.url}` : ''),
          html: renderHtml(subject, lines, cta),
        });
        record.delivered = true;
      } catch (err) {
        record.error = err.notConfigured ? err.message : `Send failed: ${err.message}`.slice(0, 200);
        if (err.notConfigured) console.log(`[email:simulated] ${kind} → ${recipients.join(', ')}: ${subject}`);
        else console.error('[email] send failed:', err.message);
      }
      record.sending = false;
      await store.put(C.notifications, record);
    }
    await sendPush(store, circleId, { roles: audienceFor(kind), title: subject, body: lines.slice(0, 2).join(' '), tag: kind, url: '/' });
    publish(circleId);
    return record;
  };

  if (wait) return finish();
  finish().catch((err) => console.error('[email] background send failed:', err));
  publish(circleId);
  return record;
}
