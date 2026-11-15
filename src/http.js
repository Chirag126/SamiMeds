import { gzipSync } from 'node:zlib';

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export const MAX_BODY_BYTES = 700 * 1024; // room for one resized pill photo

export async function readJson(req, limit = MAX_BODY_BYTES) {
  const type = req.headers['content-type'] || '';
  const hasBody = Number(req.headers['content-length'] || 0) > 0 || req.headers['transfer-encoding'];
  if (!hasBody) return {};
  if (!type.startsWith('application/json')) throw new HttpError(415, 'Send JSON please');
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'Request is too large');
    chunks.push(chunk);
  }
  if (!size) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

export function sendJson(res, status, data, headers = {}) {
  let body = Buffer.from(JSON.stringify(data));
  const all = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers };
  if (res.acceptsGzip && body.length > 1024) {
    body = gzipSync(body);
    all['content-encoding'] = 'gzip';
    all.vary = 'Accept-Encoding';
  }
  all['content-length'] = body.length;
  res.writeHead(status, all);
  res.end(body);
}

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (k) out[k] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function cookie(name, value, { maxAge, secure }) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Strict'];
  if (maxAge != null) parts.push(`Max-Age=${maxAge}`);
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (typeof fwd === 'string' ? fwd.split(',')[0].trim() : '') || req.socket.remoteAddress || 'unknown';
}

export const isHttps = (req) => req.headers['x-forwarded-proto'] === 'https' || Boolean(req.socket.encrypted);

/** Tiny path router: '/api/medicines/:id' style patterns. */
export class Router {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, ...handlers) {
    const keys = [];
    const regex = new RegExp(
      `^${pattern.replace(/\/:(\w+)/g, (_, k) => {
        keys.push(k);
        return '/([^/]+)';
      })}$`,
    );
    this.routes.push({ method, regex, keys, handlers });
    return this;
  }

  get(p, ...h) { return this.add('GET', p, ...h); }
  post(p, ...h) { return this.add('POST', p, ...h); }
  put(p, ...h) { return this.add('PUT', p, ...h); }
  delete(p, ...h) { return this.add('DELETE', p, ...h); }

  match(method, path) {
    let pathMatched = false;
    for (const r of this.routes) {
      const m = r.regex.exec(path);
      if (!m) continue;
      pathMatched = true;
      if (r.method !== method) continue;
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      return { route: r, params };
    }
    return pathMatched ? { methodNotAllowed: true } : null;
  }
}
