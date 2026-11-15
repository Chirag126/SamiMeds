/**
 * Sends email through the Gmail API over HTTPS (port 443).
 *
 * Why not SMTP? Many hosts, including Render's free plan, block the SMTP ports
 * (25/465/587). The Gmail API uses normal HTTPS, so it works everywhere.
 *
 * Setup: an OAuth client (ID + secret) and a refresh token with the
 * https://www.googleapis.com/auth/gmail.send scope. See README → "Email on Render".
 */
import { config } from '../config.js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const TIMEOUT_MS = 15_000;

export const gmailEnabled = () =>
  Boolean(config.gmail.clientId && config.gmail.clientSecret && config.gmail.refreshToken);

let cachedToken = null; // { value, expiresAt }

/** Test hook: forget the cached access token. */
export function resetGmailToken() {
  cachedToken = null;
}

/** Exchanges the long-lived refresh token for a short-lived access token (cached until it expires). */
export async function accessToken(fetchImpl = fetch, now = Date.now()) {
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) return cachedToken.value;
  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.gmail.clientId,
      client_secret: config.gmail.clientSecret,
      refresh_token: config.gmail.refreshToken,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    // invalid_grant usually means the refresh token expired or was revoked.
    throw new Error(`Gmail sign-in failed: ${data.error || res.status}${data.error === 'invalid_grant' ? ' (refresh token expired or revoked – create a new one)' : ''}`);
  }
  cachedToken = { value: data.access_token, expiresAt: now + (Number(data.expires_in) || 3600) * 1000 };
  return cachedToken.value;
}

/** Removes line breaks so a value can never add extra email headers. */
const oneLine = (s) => String(s ?? '').replace(/[\r\n]+/g, ' ').trim();

/** Encodes a header value that may contain emoji or Hindi (RFC 2047). */
const encodeWord = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`);

/** Wraps base64 at 76 characters, as email requires. */
const wrap = (b64) => b64.replace(/.{1,76}/g, '$&\r\n').trimEnd();

/** Builds a plain-text + HTML email (RFC 2822 / MIME). */
export function buildMime({ from, to, subject, text, html }, boundary = `sm_${Date.now().toString(36)}`) {
  const recipients = (Array.isArray(to) ? to : [to]).map(oneLine).filter(Boolean);
  if (!recipients.length) throw new Error('No recipients');
  return [
    `From: ${oneLine(from)}`,
    `To: ${recipients.join(', ')}`,
    `Subject: ${encodeWord(oneLine(subject))}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap(Buffer.from(text, 'utf8').toString('base64')),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap(Buffer.from(html, 'utf8').toString('base64')),
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

/** Sends one message through the Gmail API. */
export async function sendViaGmail(message, fetchImpl = fetch) {
  const token = await accessToken(fetchImpl);
  const raw = Buffer.from(buildMime({ from: config.gmail.from, ...message }), 'utf8').toString('base64url');
  const res = await fetchImpl(SEND_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ raw }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 401) cachedToken = null; // try a fresh token next time
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`Gmail API ${res.status}: ${data?.error?.message || 'send failed'}`);
  }
  return res.json();
}
