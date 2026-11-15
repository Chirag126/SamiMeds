# 💊 SamiMeds — care that remembers

SamiMeds helps elderly people take their medicines and get to their doctor visits on time. Their family and caretakers share one care circle, so everyone stays informed.

It has **two very different screens**:

| 👵 Elder's screen (`/elder`) | 👪 Family & caretaker dashboard (`/family`) |
|---|---|
| Shows only what matters *now*: one big card with the pill's photo, the time and two huge buttons: **✅ I took it** and **⏰ Remind me in 15 min** | Tabs for Overview, Medicines, Visits, History, Alerts, Circle and Reports |
| Warm, changing sky (morning, afternoon, evening, night), confetti and a streak counter | Adherence stats, a missed-dose list, mood check-ins, the activity log and printable reports |

Each person signs in with the **care circle code + their own 4–6 digit PIN**, and their role decides which screen opens.

---

## ✨ Features

### Elder's screen (mobile-first)
- **One task per screen.** The "now" card shows the next due dose. Nothing else competes for attention.
- **Pill photo or drawn pill.** Family can upload a photo; otherwise a coloured pill (round, oval, capsule, drops…) is drawn.
- **I took it**, **Remind me in 15 min** (up to 3 times), and **Undo** for 8 seconds instead of "Are you sure?" pop-ups.
- **🔊 Read aloud** on every card, using the phone's built-in voice, with a slower speed option.
- **Text size** control (A / A+ / A++), remembered on the device.
- **Changes from family** appear as cards: *"Priya added Calcium + Vitamin D"* with **👍 OK** or **❓ I have a question**. A question emails the family. The elder stays in charge of their own care.
- **🩺 Doctor tab:** next visit in plain words ("Tomorrow, 11:00 AM — Heart doctor"), a tick-off "things to bring" checklist, and **Add to Google Calendar**.
- **🌼 My day:** a daily *How are you feeling?* (😊 / 😐 / 😟). "Not well" quietly emails the family and shows a Call button. Also a 7-day mood strip and a gentle daily tip.
- **📞 Help:** a big red **Call family now** button, one-tap calls to everyone in the circle, and settings.
- Bottom tab bar with big labelled icons, no hamburger menus, high contrast, 60–78 px buttons, and the time-of-day sky.

### Family & caretaker dashboard
- **Overview:** "needs attention" alerts (missed doses, elder questions, "not well", low stock), KPIs, today's timeline with *Mark taken / Skip / Undo*, a 7-day chart and recent changes.
- **Medicines:** add or edit with photo upload (resized on the phone), colour, shape, times, stock and refill threshold.
  - **✨ Quick add:** type *"Metformin 500mg twice a day after food, 60 tablets"* and the form fills itself. It uses **Gemini** when configured, with an offline parser as backup.
- **Visits:** book, edit, mark done or cancel; see how many checklist items the elder has packed; Google Calendar links.
- **History:** 7, 14 or 30 days, with adherence per day and per medicine, on-time rate, a mood strip and the full dose log.
- **Alerts:** every reminder email the system sent (or would send) and its delivery status.
- **Circle:** members and roles, add or remove people, change your PIN, emergency contact, timezone, and the full activity log.
- **Reports:** preview the weekly summary and email it now, or open the **printable one-page doctor summary**.

### Smart reminders and escalation
| When | What happens |
|---|---|
| 10 min before | Friendly "time for your medicine" email to the elder |
| Snoozed | Silence until the snooze ends, then one reminder |
| +30 min, not taken | Gentle second reminder to the elder |
| +60 min, not taken | **Family and caretakers are emailed** and the dose is marked *missed* |
| Day before / morning of a visit | Reminder to the elder and family, with the checklist and a calendar link |
| ~5 days of pills left | Refill alert to family (once per refill) |
| Sunday 7 PM | Weekly summary email to family |

After an outage the scheduler only sends the most relevant message, never a burst of emails. Doses more than 12 hours old are marked *missed* without an alert.

---

## ☁️ Google services

| Need | Service |
|---|---|
| Hosting | **Cloud Run** (`Dockerfile`, `deploy/deploy.sh`) |
| Database | **Firestore** (`src/store/firestore.js`, `firestore.indexes.json`) |
| Reminders every 5 min | **Cloud Scheduler** → `POST /api/cron/tick` |
| Quick-add medicine | **Gemini API** (structured JSON output, validated before use) |
| Pill photos | **Cloud Storage** (optional; otherwise stored in Firestore) |
| Secrets | **Secret Manager** (cron secret, Gemini key, SMTP password) |
| Appointments | **Google Calendar** "Add to calendar" links |
| Email | Gmail SMTP (app password) via nodemailer |

Every integration is optional. Locally the app runs with **zero dependencies installed**, using an in-memory store, an offline parser and an on-screen email log.

---

## 🔒 Security

- PINs hashed with **scrypt** and a per-PIN salt, compared in constant time. Weak PINs (`1111`, `1234`) are rejected, and PINs are unique within a circle.
- **Lockout** after 5 wrong PINs for 15 minutes, plus a per-IP rate limit.
- Session tokens are random 256-bit values, stored only as SHA-256 hashes, in `HttpOnly; SameSite=Strict; Secure` cookies. They expire after 12 h, or 30 days with "Remember this phone".
- **CSRF:** a required custom header on every state-changing call, plus SameSite cookies.
- **Role-based permissions** (`elderly`, `caretaker`, `family`), and every record is checked against the caller's circle.
- A strict **Content-Security-Policy** (no inline scripts or styles), `nosniff`, `frame-ancestors 'none'`, HSTS in production.
- The UI is built with DOM APIs, never `innerHTML` with data. Input is validated with schemas, and request bodies are size-limited.
- Photo uploads are checked by type *and* magic bytes. Gemini output is sanitised before use.
- The container runs as a non-root user, and secrets come from Secret Manager.

## ♿ Accessibility
Semantic landmarks, a skip link, ARIA tabs with arrow-key navigation, `aria-live` toasts, `role="checkbox"` checklist items, visible focus rings, WCAG AA contrast, 48 px+ touch targets, text scaling, read-aloud, `prefers-reduced-motion` support, and labels on every icon.

## 📱 Mobile
Installable **PWA** (manifest, icons, service worker with offline shell), safe-area insets, a numeric keypad for the PIN, the camera for pill photos (`capture="environment"`), gentle haptic feedback, and auto-refresh when the app comes back to the foreground.

---

## 🚀 Run locally

```bash
npm run dev            # demo mode on http://localhost:8080
npm test               # 50 unit + API tests (node:test, no extra packages)
```

Demo circle code **`DEMO`**: Kamla (elder) `2580` · Priya (daughter) `1357` · Ravi (nurse) `2468`.
The sign-in page also has one-tap demo buttons.

Optional settings are in `.env.example` (run with `node --env-file=.env src/server.js`).

## ☁️ Deploy to Cloud Run

```bash
PROJECT_ID=your-project REGION=asia-south1 \
GEMINI_API_KEY=... SMTP_USER=you@gmail.com SMTP_PASS=app-password \
./deploy/deploy.sh
```

This enables the APIs, creates Firestore and its indexes, stores the secrets in Secret Manager, deploys to Cloud Run and creates the Cloud Scheduler job.

## 🗂️ Project layout

```
src/
  server.js            entry: HTTP server, demo seed, in-process scheduler (local)
  app.js               static files, security headers, CSRF check, error handling
  routes/api.js        REST API (auth, doses, medicines, visits, moods, reports, members, cron)
  services/
    doses.js           escalation, snooze, adherence, streaks (pure functions)
    appointments.js    visit reminders, plain-language specialties
    care.js            today view, stats, weekly/doctor reports, scheduler tick
    auth.js            PIN hashing, sessions, lockout, roles
    gemini.js parser.js  AI quick-add + offline fallback
    email.js photos.js calendar.js refill.js time.js validate.js
  store/               memory (local) and Firestore stores, same interface
public/                index (sign in), elder, family, print + css/js, PWA files
test/                  node:test suites
```
