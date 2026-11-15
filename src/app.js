import { stat } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { HttpError, readJson, sendJson, parseCookies } from './http.js';
import { buildApi } from './routes/api.js';
import { ValidationError } from './services/validate.js';
import { config } from './config.js';
import { publish } from './services/events.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

/** Friendly page routes → HTML files. */
const PAGES = { '/': 'index.html', '/elder': 'elder.html', '/family': 'family.html', '/print': 'print.html' };

export const SECURITY_HEADERS = {
  'content-security-policy': [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "style-src 'self'",
    "script-src 'self'",
    "connect-src 'self'",
    "font-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(self), microphone=(), geolocation=(), payment=()',
  'cross-origin-opener-policy': 'same-origin',
};

const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.webmanifest', '.svg', '.txt']);
const staticCache = new Map(); // path → { mtimeMs, raw, gz, etag }

const acceptsGzip = (req) => /\bgzip\b/.test(req.headers['accept-encoding'] || '');

/** Reads a static file once, keeps a gzipped copy, and re-reads only when it changes. */
async function loadStatic(full) {
  const info = await stat(full);
  if (!info.isFile()) return null;
  const cached = staticCache.get(full);
  if (cached && cached.mtimeMs === info.mtimeMs) return cached;
  const raw = await readFile(full);
  const entry = {
    mtimeMs: info.mtimeMs,
    raw,
    gz: COMPRESSIBLE.has(extname(full)) ? gzipSync(raw) : null,
    etag: `"${info.size.toString(16)}-${Math.round(info.mtimeMs).toString(16)}"`,
  };
  staticCache.set(full, entry);
  return entry;
}

async function serveStatic(req, res, pathname) {
  const file = PAGES[pathname] || pathname.slice(1);
  const full = normalize(join(PUBLIC_DIR, file));
  if (!full.startsWith(PUBLIC_DIR)) return false; // path traversal guard
  let entry;
  try {
    entry = await loadStatic(full);
  } catch {
    return false;
  }
  if (!entry) return false;
  const ext = extname(full);
  const headers = {
    'content-type': MIME[ext] || 'application/octet-stream',
    etag: entry.etag,
    vary: 'Accept-Encoding',
    // Always re-check with the server (cheap 304s) so a new deploy shows up at once.
    'cache-control': 'no-cache',
  };
  if (req.headers['if-none-match'] === entry.etag) {
    res.writeHead(304, headers);
    res.end();
    return true;
  }
  const body = entry.gz && acceptsGzip(req) ? entry.gz : entry.raw;
  if (body === entry.gz) headers['content-encoding'] = 'gzip';
  headers['content-length'] = body.length;
  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
  return true;
}

/** Builds the request handler. The store is injected so tests can use an in-memory one. */
export function createApp(store) {
  const api = buildApi();

  return async function handler(req, res) {
    for (const [k, val] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, val);
    if (config.isProduction) res.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains');

    res.acceptsGzip = acceptsGzip(req);
    const url = new URL(req.url, 'http://localhost');
    const { pathname } = url;

    try {
      if (pathname.startsWith('/api/')) {
        const found = api.match(req.method, pathname);
        if (!found) throw new HttpError(404, 'Not found');
        if (found.methodNotAllowed) throw new HttpError(405, 'Method not allowed');

        // CSRF defence: state-changing calls need our custom header (cookies are SameSite=Strict too).
        if (req.method !== 'GET' && req.method !== 'HEAD' && pathname !== '/api/cron/tick' &&
          req.headers['x-requested-with'] !== 'SamiMeds') {
          throw new HttpError(403, 'Missing request header');
        }

        const ctx = {
          req, res, store, url, query: url.searchParams, params: found.params,
          cookies: parseCookies(req.headers.cookie), body: {},
        };
        if (req.method === 'POST' || req.method === 'PUT') ctx.body = await readJson(req);

        let result;
        for (const fn of found.route.handlers) result = await fn(ctx);
        if (req.method !== 'GET' && ctx.circle) publish(ctx.circle.id); // refresh other open screens
        if (result === undefined) return; // handler streamed its own response
        if (result && typeof result.status === 'number' && 'data' in result) sendJson(res, result.status, result.data);
        else sendJson(res, 200, result);
        return;
      }

      if ((req.method === 'GET' || req.method === 'HEAD') && (await serveStatic(req, res, pathname))) return;
      throw new HttpError(404, 'Not found');
    } catch (err) {
      const status = err instanceof HttpError || err instanceof ValidationError ? err.status : 500;
      if (status === 500) console.error('[error]', req.method, pathname, err);
      if (res.headersSent) return res.end();
      if (!pathname.startsWith('/api/') && status === 404) {
        res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
        return res.end('<!doctype html><title>Not found</title><p style="font:20px sans-serif;padding:2rem">Page not found. <a href="/">Go home</a></p>');
      }
      sendJson(res, status, { error: status === 500 ? 'Something went wrong. Please try again.' : err.message, ...(err.extra || {}) });
    }
  };
}
