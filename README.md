# 💊 SamiMeds — care that remembers

SamiMeds helps elderly people take their medicines and get to their doctor visits on time. Their family and caretakers share one care circle, so everyone stays informed.

It has **two very different screens**:

| 👵 Elder's screen (`/elder`) | 👪 Family & caretaker dashboard (`/family`) |
|---|---|
| Shows only what matters *now*: one big card with the pill's photo, the time and two huge buttons: **✅ I took it** and **⏰ Remind me in 15 min** | Tabs for Overview, Medicines, Visits, History, Alerts, Circle and Reports |
| Warm, changing sky (morning, afternoon, evening, night), confetti and a streak counter | Adherence stats, a missed-dose list, mood check-ins, the activity log and printable reports |

Each person signs in with the **care circle code + their own 4–6 digit PIN**, and their role decides which screen opens.

---

## 🎯 How it answers the challenge brief

| The brief asks for | Where it is in SamiMeds |
|---|---|
| Help the elderly manage medicines, appointments and routines | Elder's screen: one big "take now" card, doctor tab with checklist, daily mood check |
| Keep family and caretakers informed | Family dashboard, **live sync** between screens, push notifications and emails |
| Shared ecosystem with secure, passcode-based access | Care circle code + personal PIN, three roles (elder, family, caretaker) |
| View, add, edit and manage medication schedules | Medicines tab, **Gemini quick add** and **Gemini prescription photo scan** |
| Track adherence | History tab, streaks, on-time rate, **photo proof verified by family** |
| Monitor upcoming doctor appointments | Visits tab, plain-language doctor tab, Google Calendar links |
| Email reminders for upcoming doses, missed medications and appointments | Escalation: before the dose → +30 min → family alerted at +60 min; visit reminders |
| Go beyond a basic reminder app | Photo proof, prescription scan, Hindi, read aloud, refill tracking, weekly and doctor reports |
| The elder stays at the centre of their own care | Every change by family shows on the elder's screen with "OK" / "I have a question" |
| Accessible | Big text and buttons, text-size control, read aloud, **English ⇄ हिंदी**, keyboard and screen-reader support |

## ✨ Features

### New: sync, proof, scan, Hindi, notifications
- **Live sync.** When the elder marks a dose taken, the son's and nurse's screens update within a second (Server-Sent Events), with no reload.
- **Photo proof.** The elder can tap *"I took it – send a photo"*. Family sees the photo and taps **Looks right** or **Not right**; the caretaker sees the result. Only family can verify.
- **Prescription scan.** Take a photo of the doctor's slip; Gemini lists the medicines and the family adds them after checking each one.
- **English ⇄ हिंदी** switch on the sign-in, elder and family screens. Read aloud speaks Hindi too.
- **Keyboard shortcut bar (phones).** Above the keyboard: ready answers for the box being typed in (500 mg, after breakfast, 9 PM, Tomorrow, BP diary, +91, @gmail.com…), Prev / Next, 🎤 speak, and Done. It never covers the box being typed in or the Save button.
- **Wrong-tab helper.** Typing a doctor visit into the medicine form (or a medicine into a visit) shows a small note under the box with a button that takes you to the right tab and fills in what it understood.
- **Phone notifications (Web Push).** Reminders, missed-dose alerts, "took it", photo and verification updates arrive even when the app is closed.

### Elder's screen (mobile-first)
- **One task per screen.** The "now" card shows the next due dose. Nothing else competes for attention.
- **Pill photo or drawn pill.** Family can upload a photo; otherwise a coloured pill (round, oval, capsule, drops…) is drawn.
- **I took it**, **Remind me in 15 min** (up to 3 times), and **Undo** for 8 seconds instead of "Are you sure?" pop-ups.
- **🔊 Read aloud** on every card, using the phone's built-in voice, with a slower speed option.
- **Text size** control (A / A+ / A++), remembered on the device.
- **Changes from family** appear as cards: *"Chirag added Calcium + Vitamin D"* with **👍 OK** or **❓ I have a question**. A question emails the family. The elder stays in charge of their own care.
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
npm test               # unit + API tests (node:test)
npm run lint           # ESLint
npm run push:keys      # create Web Push keys for phone notifications
```

Demo circle code **`DEMO`**: Kamla (elder) `2580` · Chirag (son) `1357` · Anjali (nurse) `2468`.
The sign-in page also has one-tap demo buttons.

### 🔑 Keys & secrets
Copy `.env.example` to `.env`, fill in your values, and run `node --env-file=.env src/server.js`.
`.env` is ignored by git. `npm install` turns on a pre-commit hook (`npm run check:secrets`) that blocks
API keys, passwords and `.env` files, and a GitHub Action runs the same check on every PR.
On Render, put the same names under **Environment** instead.

## 🚀 Deploy to Render

`render.yaml` describes the service (Node 22, Singapore region, health check `/api/health`).
1. Render Dashboard → **Environment**: add `GEMINI_API_KEY`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`.
2. **Keep data across restarts (recommended):** create a Firestore database and a service-account key in Google Cloud,
   then paste the key JSON into `GOOGLE_SERVICE_ACCOUNT_JSON`. Without it, data is kept in memory, and the demo circle is re-created on every restart.
3. **Reminders while the free plan sleeps:** in GitHub → Settings → Secrets and variables → Actions, add the secret `CRON_SECRET` (same value as on Render) and the variable `APP_URL`.
   The *Reminder tick* workflow then calls the app every 5 minutes.

`GET /api/health` shows which store is active (`memory` or `firestore`).

### 📧 Email on Render (Gmail API)

Render's free plan blocks the SMTP ports (25, 465, 587), so Gmail SMTP times out there.
SamiMeds can send through the **Gmail API over HTTPS** instead. It is used automatically when these are set:
`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` (and `MAIL_FROM`).

1. **Google Cloud Console** (same project as Firestore) → *APIs & Services* → *Library* → enable **Gmail API**.
2. *OAuth consent screen* → External → add your Gmail as a test user → then **Publish app** (*In production*).
   In *Testing* mode Google expires the refresh token after 7 days.
3. *Credentials* → *Create credentials* → *OAuth client ID* → **Web application**,
   authorised redirect URI `https://developers.google.com/oauthplayground`.
4. Open the **OAuth 2.0 Playground** → ⚙️ → *Use your own OAuth credentials* → paste the client ID and secret.
   Scope: `https://www.googleapis.com/auth/gmail.send` → *Authorize* (sign in with the Gmail that should send) →
   *Exchange authorization code for tokens* → copy the **refresh token**.
5. Render → *Environment*: add the three values. The Alerts tab then says *"sent through the Gmail API"*.

Every button that sends email answers immediately and delivers in the background, so a slow or blocked mail
server never freezes the screen.

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
