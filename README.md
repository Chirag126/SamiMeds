# 💊 SamiMeds: care that remembers

[![CI](https://github.com/Chirag126/SamiMeds/actions/workflows/ci.yml/badge.svg)](https://github.com/Chirag126/SamiMeds/actions/workflows/ci.yml)
[![Secret check](https://github.com/Chirag126/SamiMeds/actions/workflows/secret-check.yml/badge.svg)](https://github.com/Chirag126/SamiMeds/actions/workflows/secret-check.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

SamiMeds helps elderly people take their medicines and reach their doctor visits on time, while their family and caretakers stay informed. The elder's screen is simple; the family's dashboard has the detail.

**Live demo:** https://samimeds.onrender.com. Tap **Kamla** (elder), **Chirag** (son) or **Anjali** (nurse) on the sign-in page. Circle code `DEMO`, PINs `2580` / `1357` / `2468`.

---

## ✨ Core features

### For the elder (mobile-first, one task at a time)
- **One big "take now" card** with the pill's photo or a drawn pill, the time, what it's for, and huge **✅ I took it** / **⏰ Remind me in 15 min** buttons. Undo instead of "Are you sure?" pop-ups.
- **🆘 I need help.** One button, with a confirm step, alerts the whole family by email and phone notification. The elder then sees who is coming ("💚 Chirag is on the way").
- **🔊 Read aloud**, **A / A+ / A++** text size, and **English ⇄ हिंदी** on every screen.
- **Stays in charge of their own care.** Every change the family makes appears as a card with **👍 OK** or **❓ I have a question**. A question alerts the family, and the elder sees when it's answered.
- **Doctor tab** in plain words ("Tomorrow, 11:00 AM: heart doctor"), with a tick-off "things to bring" list and Google Calendar links.
- **📷 Photo proof.** "I took it, send a photo to family." The family verifies it and the caretaker sees the result.
- Daily **mood check-in** (😊 😐 😟; "Not well" alerts the family), a big **📞 Call family** button, a time-of-day sky, a streak counter and confetti.

### For family and caretakers
- **Live sync.** A dose marked on the elder's phone shows on everyone's screen within a second, with no reload.
- **Smart escalation.** A reminder 10 min before the dose → a gentle second reminder at +30 min → **family emailed and notified at +60 min**. Snooze-aware, sends one alert per event, and is safe after downtime.
- **🧾 Prescription scan (Gemini).** Photograph the doctor's slip; the medicines are listed for the family to check and add.
- **✨ Quick add.** Type "Metformin 500mg twice a day after food, 60 tablets" and the form fills itself (Gemini, with an offline parser as fallback).
- **⌨️ Keyboard shortcut bar (phones).** Above the keyboard: ready answers for the box being typed in (500 mg, ½ tablet, after breakfast, 9 PM, Tomorrow, BP diary, +91, @gmail.com…), plus **Prev / Next**, **🎤 speak** (English or Hindi) and **Done**. It never covers the box or the Save button.
- **💡 Wrong-tab helper.** Type a doctor visit into the medicine form and a note offers **"Book it in Visits →"**. One tap switches tabs and fills in doctor, date, time and specialty. It works the other way for medicines, and for adding people.
- Refill tracking, appointment reminders, a weekly summary email, a **printable one-page doctor report**, a full activity log, and roles for family vs. caretaker.
- **🔔 Phone notifications (Web Push)** for every reminder and alert, even when the app is closed. Installable as an app (PWA).

---

## 🎯 Chosen vertical

**Healthcare: elderly care and medication management** (PromptWars challenge: *Elderly Care & Medication Management Platform*).

| The brief asks for | Where it is in SamiMeds |
|---|---|
| Help elders manage medicines, appointments and routines | Elder screen: "take now" card, doctor tab, mood check-in |
| Keep family and caretakers informed | Live sync, push notifications, emails, activity log |
| Shared ecosystem with secure, passcode-based access | Care circle code + a personal PIN per person; three roles |
| View, add, edit and manage medication schedules | Medicines tab, Gemini quick add, prescription scan, keyboard bar |
| Track adherence | History (7/14/30 days), on-time rate, streaks, photo proof |
| Monitor upcoming doctor appointments | Visits tab, plain-language doctor tab, Google Calendar |
| Email reminders for upcoming doses, missed medicines and appointments | Escalation engine + appointment reminders (Gmail API) |
| Go beyond a basic reminder app | SOS, photo proof, prescription scan, Hindi, read aloud, wrong-tab helper |
| Elder stays at the centre of their own care | Every change shows on the elder's screen with OK / I have a question |

---

## 🧭 Approach and logic

1. **Two screens for two kinds of user.** Elders need *less*: one task, big targets, plain words, no menus. Families need *more*: history, editing, alerts. The person's PIN decides which screen opens.
2. **The elder is never surprised.** Changes made by others are shown to the elder and can be questioned. Nothing about their care happens silently.
3. **Reminders escalate gently, then involve people.** The elder gets two chances (+0 and +30 min) before the family is told (+60 min). Snoozing delays the elder's reminders but never hides a missed dose from the family.
4. **Nothing waits on the network.** Buttons answer instantly; emails and notifications are sent in the background and their result is logged.
5. **AI helps, people decide.** Gemini drafts medicines from text or a prescription photo, but nothing is saved until a family member checks it. AI output is validated before use.
6. **Everything works without keys.** With no Google keys it runs in demo mode (in-memory store, offline parser, on-screen email log), so it's easy to try and test.

## ⚙️ How it works

```
Elder / family phones (PWA) ──HTTPS──▶ Node.js server (no framework)
   ▲  live updates (SSE)                ├─ routes/      one module per area (doses, medicines, sos, …)
   │  push notifications                ├─ services/    pure logic: escalation, adherence, refill, parsing
   │                                     └─ store/       Firestore (production) or in-memory (local/tests)
   │
   └── Web Push ◀── reminders ◀── scheduler tick (every minute, plus Cloud Scheduler / GitHub Actions)
                                         ├─ Gmail API (email over HTTPS)
                                         └─ Gemini API (quick add, prescription scan)
```

- **Scheduling.** Each tick creates the day's dose records and runs a **pure function** (`evaluateDose`) that decides which reminder, if any, is due. It is unit-tested minute by minute, including snoozes and server downtime.
- **Time zones.** Doses are scheduled in the elder's local wall-clock time, so daylight saving and server location never shift a reminder.
- **Live sync.** Every change publishes an event to the circle's open screens (Server-Sent Events); screens refresh themselves, but never while someone is typing.
- **Data.** Firestore stores circles, members (PINs hashed), medicines, doses, visits, moods, activity and notifications. All queries are scoped to the caller's circle.

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 📌 Assumptions

- One care circle per elder; each person has their own PIN. A phone is usually shared, so a circle code plus a short PIN is easier for elders than email and password.
- The elder's phone may be basic and the connection slow, so there is no frontend framework, files are small, and an offline shell is cached.
- Medicine times are fixed clock times; "as needed" medicines are out of scope.
- Photo proof and prescription scans support care at home. They don't replace a pharmacist's or doctor's advice, and AI-read prescriptions are always checked by a person.
- Indian context by default (Asia/Kolkata, +91, Hindi), but time zone and language are settings.

---

## ☁️ Google services

| Need | Service |
|---|---|
| Database | **Firestore** (persists across restarts; deny-all rules for direct access) |
| AI | **Gemini API**: quick add and prescription photo scan, with structured, validated output |
| Email | **Gmail API** over HTTPS (works where SMTP ports are blocked) |
| Appointments | **Google Calendar** "Add to calendar" links |
| Optional on Cloud Run | Cloud Scheduler, Cloud Storage (pill photos), Secret Manager (`deploy/deploy.sh`) |

## 🔒 Security

- PINs hashed with **scrypt** (per-PIN salt, constant-time compare). Weak PINs are rejected; PINs are unique per circle.
- **Lockout** after 5 wrong PINs, plus per-IP rate limits on sign-in, setup and AI calls.
- Random 256-bit session tokens, stored only as SHA-256 hashes, in `HttpOnly; Secure; SameSite=Strict` cookies.
- **CSRF** header on every state-changing call; **role permissions** (elder / family / caretaker); every record checked against the caller's circle (404 otherwise).
- Strict **Content-Security-Policy** (no inline scripts), `nosniff`, `frame-ancestors 'none'`, HSTS.
- Schema validation on every input, body size limits, image magic-byte checks, header-injection-safe email, and validated AI output.
- Push only to real push services; secrets only in environment variables; a **secret scanner** on every commit and PR; `npm audit` in CI; non-root container. See [SECURITY.md](SECURITY.md).

## ♿ Accessibility

Semantic landmarks, skip links, ARIA tabs with arrow-key navigation, `aria-live` updates, visible focus, WCAG AA contrast, 48–110 px touch targets, three text sizes, read aloud, **Hindi**, voice input, `prefers-reduced-motion`, and confirm steps for anything alarming (SOS).

## ⚡ Efficiency

No frontend framework, gzip on pages and API responses, ETag revalidation (cheap 304s), resized photos before upload, one scheduler for all circles, indexed Firestore queries with a fallback, and live updates instead of polling.

## 🧪 Testing

```bash
npm test          # 72 unit + API tests (node:test)
npm run coverage  # with coverage gate: lines ≥ 85%, functions ≥ 80% (server code ~92% lines)
npm run lint      # ESLint
```

CI runs lint, tests with the coverage gate, `npm audit` and the secret check on every pull request. The UI was also checked with Playwright on phone-sized screens, including three screens open at once for live sync, plus overflow, Hindi and keyboard-bar checks.

---

## 🚀 Run it

```bash
npm install
npm run dev                         # demo mode on http://localhost:8080
cp .env.example .env                # optional: add your own keys
node --env-file=.env src/server.js
```

### Deploy to Render
`render.yaml` describes the service. In Render → **Environment**, add the values from `.env.example` you need:

- `GOOGLE_SERVICE_ACCOUNT_JSON` for Firestore
- `GEMINI_API_KEY`
- `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` and `MAIL_FROM` for email
- `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` for push (`npm run push:keys`)

To keep reminders running while the free plan sleeps, add the GitHub secret `CRON_SECRET` and the variable `APP_URL`; the *Reminder tick* workflow then calls the app every 5 minutes.

<details>
<summary>Gmail API setup (about 10 minutes)</summary>

1. Google Cloud Console → *APIs & Services* → *Library* → enable **Gmail API**.
2. *Google Auth Platform* → set up as **External** → *Audience* → add your Gmail as a test user → **Publish app**. In Testing mode, refresh tokens expire after 7 days.
3. *Clients* → **Create client** → *Web application*, redirect URI `https://developers.google.com/oauthplayground`.
4. In the OAuth 2.0 Playground: ⚙️ → use your own credentials → scope `https://www.googleapis.com/auth/gmail.send` → authorize → exchange the code → copy the refresh token.
5. Add the three values on Render.
</details>

Deploy to Cloud Run instead: `PROJECT_ID=… ./deploy/deploy.sh`.

## 🗂️ Project layout

```
src/
  server.js, app.js      HTTP server, static files (gzip + ETag), security headers, CSRF
  routes/                one module per area: auth, doses, medicines, appointments, wellbeing,
                         activity, circle, sos, realtime, cron (+ middleware, shared schemas)
  services/              doses (escalation), appointments, care (today, stats, reports, scheduler),
                         auth, email + gmail, push, events (live sync), gemini + parser, photos, time…
  store/                 Firestore and in-memory stores with one interface
public/                  sign-in, elder, family, print pages; i18n (Hindi), keyboard bar, PWA files
test/                    node:test suites (services + full API)
docs/ARCHITECTURE.md     design notes
```

## 📄 License

[MIT](LICENSE) © 2026 Chirag Pardeshi. Third-party libraries keep their own licenses: `@google-cloud/firestore` and `@google-cloud/storage` (Apache-2.0), `nodemailer` (MIT-0), `web-push` (MPL-2.0).
