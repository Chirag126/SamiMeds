#!/usr/bin/env node
/**
 * Stops secrets from reaching GitHub.
 *   node scripts/check-secrets.mjs           → checks files staged for commit (used by the git hook)
 *   node scripts/check-secrets.mjs --all     → checks every tracked file
 * Exits with code 1 and explains what to fix if anything looks like a secret.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';

const all = process.argv.includes('--all');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });

const files = (all ? git('ls-files') : git('diff', '--cached', '--name-only', '--diff-filter=ACMR'))
  .split('\n')
  .filter(Boolean);

/** Files that must never be committed at all. */
const FORBIDDEN_FILE = [
  /(^|\/)\.env$/, /(^|\/)\.env\.(?!example$)[^/]+$/, /\.pem$/, /\.p12$/, /\.key$/,
  /service-account.*\.json$/, /firebase-adminsdk.*\.json$/, /(^|\/)credentials\.json$/,
];

/** Content that looks like a real secret. */
const PATTERNS = [
  ['Google / Gemini API key', /AIza[0-9A-Za-z_-]{35}/],
  ['Private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['Service-account key', /"private_key_id"\s*:\s*"[0-9a-f]{20,}"/],
  ['GitHub token', /gh[pousr]_[0-9A-Za-z]{30,}/],
  ['Filled-in secret variable', /^[ \t]*(?:SMTP_PASS|GEMINI_API_KEY|CRON_SECRET|VAPID_PRIVATE_KEY)[ \t]*=[ \t]*[^\s#]/m],
];

const problems = [];
for (const file of files) {
  if (FORBIDDEN_FILE.some((re) => re.test(file))) {
    problems.push(`${file}: this file holds secrets and must not be committed`);
    continue;
  }
  if (!existsSync(file)) continue;
  let text;
  try {
    text = all ? readFileSync(file, 'utf8') : git('show', `:${file}`);
  } catch {
    continue;
  }
  if (text.includes('\u0000')) continue; // binary file
  for (const [name, re] of PATTERNS) {
    // Code and docs may mention variable names; only .env-style files assign real values.
    if (name === 'Filled-in secret variable' && !basename(file).startsWith('.env')) continue;
    if (re.test(text)) problems.push(`${file}: looks like it contains a ${name}`);
  }
}

if (problems.length) {
  console.error('\n🚫 Possible secrets found – commit blocked:\n');
  for (const p of problems) console.error(`  • ${p}`);
  console.error('\nPut real values in .env (ignored by git) or in Render → Environment.');
  console.error('Keep .env.example with empty values. To unstage a file: git restore --staged <file>\n');
  process.exit(1);
}
console.log(`✅ No secrets found in ${files.length} file(s).`);
