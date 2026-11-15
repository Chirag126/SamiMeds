# Security policy

SamiMeds holds health information about elderly people, so security is treated as a feature.

## Reporting a vulnerability

Please email **pardeshichirag250@gmail.com** with the details and steps to reproduce. Don't open a public issue for security problems. You'll get a reply within 3 days.

## How data is protected

| Area | Protection |
|---|---|
| Sign-in | Circle code + personal PIN; PINs hashed with scrypt and a per-PIN salt; weak PINs rejected; lockout after 5 wrong tries; per-IP rate limits |
| Sessions | 256-bit random tokens stored only as SHA-256 hashes; `HttpOnly`, `Secure`, `SameSite=Strict` cookies; 12 h, or 30 days with "Remember this phone" |
| Access | Role permissions (elder / family / caretaker); every record is checked against the caller's circle and other circles get 404 |
| Requests | CSRF header on state-changing calls; schema validation; body size limits; image magic-byte checks |
| Browser | Strict Content-Security-Policy (no inline scripts), `nosniff`, `frame-ancestors 'none'`, HSTS, DOM building without `innerHTML` |
| Outbound | Push only to real push services; email headers can't be injected; AI output validated before use |
| Database | Firestore rules deny all direct access; only the server (service account) reads and writes |
| Secrets | Environment variables only; `.env` ignored; a pre-commit hook and a CI job block keys and tokens; `npm audit` in CI |
