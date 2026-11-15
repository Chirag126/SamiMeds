# Architecture

## Goals
1. **Simple for the elder**: one task per screen, big targets, plain words, read aloud, Hindi.
2. **Reliable reminders**: correct in the elder's time zone, never duplicated, safe after downtime.
3. **Nothing blocks a person**: network work (email, push) runs in the background.
4. **Runs anywhere**: no framework, no build step; all Google services optional.

## Layers

| Layer | Folder | Responsibility |
|---|---|---|
| HTTP | `src/app.js`, `src/http.js` | Static files (gzip + ETag), security headers, CSRF check, JSON bodies, error handling |
| Routes | `src/routes/*.js` | One module per area; each exports `register…Routes(r)`. Guards in `middleware.js` (`auth`, `allow(permission)`, `owned`) |
| Services | `src/services/*.js` | Business logic. Core rules are **pure functions** (`evaluateDose`, `evaluateAppointment`, `adherence`, `streak`, `needsRefill`) so they're easy to test |
| Store | `src/store/*.js` | `get / put / del / query` over Firestore or memory; same interface, so tests run without Google |
| Client | `public/js/*.js` | Plain ES modules: `elder.js`, `family.js`, `login.js`; shared helpers in `common.js`; `i18n.js` (Hindi), `kbar.js` (keyboard bar), `intent.js` (wrong-tab helper) |

## Key flows

**Dose escalation** (`services/doses.js → evaluateDose`)

| Minutes after due | Action |
|---|---|
| −10 | Reminder to the elder |
| +30 | Gentle second reminder (unless snoozed) |
| +60 | Family + caretaker alerted; dose marked *missed* |
| > 12 h after an outage | Marked missed silently (no stale alarm) |

**Live sync** (`services/events.js`): every state-changing request publishes `change` to the circle's open Server-Sent Event streams; screens refresh after 250 ms (debounced), but not while a dialog is open or someone is typing.

**Photo proof**: elder uploads (marks the dose taken) → family verifies → caretaker is notified; undo deletes the photo.

**SOS**: elder confirms → one alert per 10 minutes (email + push to family and caretakers) → the first responder is shown to the elder.

## Data model (Firestore collections, prefixed `samimeds_`)
`circles`, `members` (PIN hash, role), `medicines`, `doses` (one per scheduled time), `appointments`, `moods`, `activity` (changes, questions, SOS), `notifications` (email log), `photos`, `push` (subscriptions), `sessions` (token hashes), `lockouts`.
