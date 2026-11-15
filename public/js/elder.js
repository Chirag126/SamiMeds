import {
  api, h, mount, toast, speak, canSpeak, buzz, setupTabs, medicineVisual, relativeDay, MOODS, registerServiceWorker,
} from './common.js';

const state = { me: null, today: null, moods: [], tab: 'now', rate: 0.9 };
const $ = (id) => document.getElementById(id);
const prefs = {
  get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

/* ------------------------------------------------------------ boot */

async function boot() {
  registerServiceWorker();
  applySize(prefs.get('sm_size', 'normal'));
  state.rate = Number(prefs.get('sm_rate', '0.9'));

  // Family members may open this screen too, to see exactly what the elder sees.
  state.me = await api('/api/me');
  const tabs = setupTabs($('tablist'), { onChange: (t) => { state.tab = t; render(); } });
  window.addEventListener('hashchange', () => { if (location.hash.slice(1) !== state.tab) tabs.select(location.hash.slice(1)); });

  $('size-btn').addEventListener('click', cycleSize);
  $('speak-all').addEventListener('click', () => speak(screenSpeech(), { rate: state.rate }));
  if (!canSpeak()) $('speak-all').hidden = true;

  await refresh();
  setInterval(refresh, 60_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
}

async function refresh() {
  try {
    const [today, moods] = await Promise.all([api('/api/today'), api('/api/moods?days=7')]);
    state.today = today;
    state.moods = moods.moods;
    renderHero();
    render();
  } catch (err) {
    if (err.status !== 401) toast("Can't connect right now. We'll try again soon.");
  }
}

/* ------------------------------------------------------------ hero */

function partOfDay(minutes) {
  if (minutes < 5 * 60 || minutes >= 21 * 60) return ['night', 'Good night', '🌙'];
  if (minutes < 12 * 60) return ['morning', 'Good morning', '☀️'];
  if (minutes < 17 * 60) return ['afternoon', 'Good afternoon', '🌤️'];
  return ['evening', 'Good evening', '🌇'];
}

function renderHero() {
  const [theme, greet, icon] = partOfDay(state.today.minutes);
  document.body.classList.remove('t-morning', 't-afternoon', 't-evening', 't-night');
  document.body.classList.add(`t-${theme}`);
  const first = state.me.member.role === 'elderly' ? state.me.member.name.split(' ')[0] : state.me.circle.elderName.split(' ')[0];
  $('hello').textContent = `${greet}, ${first} ${icon}`;
  $('today-label').textContent = state.today.dateLabel;
}

/* ------------------------------------------------------------ text size */

const SIZES = ['normal', 'large', 'xl'];
function applySize(size) {
  document.documentElement.dataset.size = SIZES.includes(size) ? size : 'normal';
}
function cycleSize() {
  const next = SIZES[(SIZES.indexOf(document.documentElement.dataset.size) + 1) % SIZES.length];
  applySize(next);
  prefs.set('sm_size', next);
  buzz(15);
  toast(next === 'normal' ? 'Normal text size' : next === 'large' ? 'Bigger text' : 'Biggest text');
  if (state.tab === 'help') render();
}

/* ------------------------------------------------------------ render */

function render() {
  if (!state.today) return;
  const panels = { now: renderNow, visits: renderVisits, day: renderDay, help: renderHelp };
  panels[state.tab]?.();
}

function whenLabel(dose) {
  const e = dose.elapsed;
  if (e < -1) return `In ${-e} min`;
  if (e <= 5) return 'Now';
  if (e < 60) return `${e} min ago`;
  return `${Math.floor(e / 60)} h ${e % 60} min late`;
}

function doseSpeech(dose) {
  const m = dose.medicine;
  return [
    `At ${dose.time12}, please take ${m.pillDescription || 'your medicine'}.`,
    `${m.name}${m.dose ? `, ${m.dose}` : ''}.`,
    m.purpose ? `${m.purpose}.` : '',
    m.instructions ? `Remember: ${m.instructions}.` : '',
  ].join(' ');
}

function renderNow() {
  const t = state.today;
  const parts = [];

  for (const u of t.updates) parts.push(updateCard(u));

  if (t.now) {
    const d = t.now;
    const m = d.medicine;
    const late = d.status === 'missed' || d.elapsed > 30;
    parts.push(h('article', { class: `due-card${late ? ' late' : ''}`, 'aria-labelledby': 'due-what' },
      h('div', { class: 'due-when' },
        h('span', { class: 'time-badge' }, `⏰ ${d.time12}`),
        h('span', { class: `chip ${late ? 'chip-rose' : 'chip-amber'}` }, whenLabel(d))),
      medicineVisual(m, 132),
      h('h1', { class: 'due-what', id: 'due-what' }, `Take ${m.pillDescription || 'your medicine'}`),
      h('p', { class: 'due-name' }, `${m.name}${m.dose ? ` · ${m.dose}` : ''}`),
      h('div', { class: 'due-tags' },
        m.instructions && h('span', { class: 'chip chip-blue' }, `🍽️ ${m.instructions}`),
        m.purpose && h('span', { class: 'chip chip-lilac' }, `💜 ${m.purpose}`)),
      late && h('p', { class: 'calm-next' }, "It's a little late, but you can still take it."),
      h('div', { class: 'due-actions' },
        h('button', { class: 'btn btn-primary big-btn', type: 'button', onclick: () => take(d) }, '✅ I took it'),
        h('div', { class: 'row-btns' },
          d.snoozeCount < 3 && d.status === 'pending'
            ? h('button', { class: 'btn btn-amber big-btn', type: 'button', onclick: () => snooze(d) }, '⏰ Remind me in 15 min')
            : h('span'),
          canSpeak() && h('button', { class: 'btn btn-soft big-btn', type: 'button', onclick: () => speak(doseSpeech(d), { rate: state.rate }) }, '🔊 Read aloud')))));
  } else {
    const next = t.next;
    const allDone = t.progress.total > 0 && t.progress.taken === t.progress.total;
    parts.push(h('section', { class: 'calm-card', 'aria-live': 'polite' },
      h('p', { class: 'calm-emoji', 'aria-hidden': 'true' }, allDone ? '🎉' : '🌿'),
      h('h1', { class: 'calm-title' }, allDone ? 'All medicines done today!' : 'Nothing to take right now'),
      t.snoozed && h('p', { class: 'calm-next' }, `⏰ I'll remind you soon about ${t.snoozed.medicine.name}.`),
      next && h('p', { class: 'calm-next' }, `Next: ${next.time12} – ${next.medicine.name}`),
      !next && !allDone && !t.snoozed && h('p', { class: 'calm-next' }, 'Enjoy your day 💛')));
  }

  parts.push(progressCard(t));

  if (t.doses.length) {
    parts.push(h('h2', { class: 'panel-title' }, "Today's medicines"));
    parts.push(h('ul', { class: 'dose-list' }, t.doses.map(doseRow)));
  } else {
    parts.push(h('p', { class: 'empty' }, 'No medicines for today. Your family can add them.'));
  }
  mount($('panel-now'), parts);
}

function progressCard(t) {
  const { taken, total } = t.progress;
  const pct = total ? taken / total : 0;
  const C = 2 * Math.PI * 40;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 96 96');
  svg.setAttribute('aria-hidden', 'true');
  const track = document.createElementNS(NS, 'circle');
  for (const [k, v] of Object.entries({ cx: 48, cy: 48, r: 40, fill: 'none', stroke: '#f1e6d8', 'stroke-width': 12 })) track.setAttribute(k, v);
  const bar = document.createElementNS(NS, 'circle');
  for (const [k, v] of Object.entries({ cx: 48, cy: 48, r: 40, fill: 'none', stroke: '#1c7a4b', 'stroke-width': 12, 'stroke-linecap': 'round', 'stroke-dasharray': `${C * pct} ${C}` })) bar.setAttribute(k, v);
  svg.append(track, bar);

  const message = !total ? 'No medicines today'
    : taken === total ? 'Wonderful – all done! 🌟'
      : taken === 0 ? "Let's start the day well 💪"
        : 'Doing great, keep going! 💚';
  return h('section', { class: 'card progress-card', 'aria-label': `${taken} of ${total} medicines taken today` },
    h('div', { class: 'ring' }, svg, h('span', { class: 'ring-text' }, `${taken}/${total}`)),
    h('div', { class: 'progress-words' },
      h('b', {}, message),
      h('span', {}, `${taken} of ${total} taken today`),
      t.streak > 0 && h('p', { class: 'streak' }, h('span', { class: 'chip chip-amber' }, `🌟 ${t.streak} day${t.streak > 1 ? 's' : ''} in a row`))));
}

const STATUS = {
  taken: ['chip-green', '✅ Taken'],
  missed: ['chip-rose', '⚠️ Missed'],
  skipped: ['', '➖ Skipped'],
};

function doseRow(d) {
  const snoozed = d.status === 'pending' && d.id === state.today.snoozed?.id;
  let chip = STATUS[d.status];
  if (!chip) chip = d.elapsed >= -30 ? ['chip-amber', snoozed ? '⏰ Soon' : '⏳ Now'] : ['chip-blue', '🕒 Later'];
  const canTakeHere = (d.status === 'pending' || d.status === 'missed') && d.elapsed >= -30;
  return h('li', { class: `dose-row${d.status === 'taken' ? ' done' : ''}` },
    medicineVisual(d.medicine, 54),
    h('div', {},
      h('b', {}, d.medicine.name),
      h('span', { class: 'when' }, `${d.time12} · ${d.medicine.pillDescription || ''}`)),
    canTakeHere
      ? h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => take(d), 'aria-label': `I took ${d.medicine.name}` }, '✅ Took it')
      : h('span', { class: `chip ${chip[0]}` }, chip[1]));
}

function updateCard(u) {
  return h('article', { class: 'update-card', 'aria-label': 'A change from your family' },
    h('p', {}, h('span', { class: 'who' }, `💬 ${u.actorName}`), ' made a change:'),
    h('p', {}, u.detail),
    h('div', { class: 'row-btns' },
      h('button', { class: 'btn btn-primary', type: 'button', onclick: () => ack(u, 'ok') }, '👍 OK'),
      h('button', { class: 'btn', type: 'button', onclick: () => ack(u, 'question') }, '❓ I have a question')));
}

/* ------------------------------------------------------------ actions */

async function take(dose) {
  buzz(40);
  try {
    await api(`/api/doses/${encodeURIComponent(dose.id)}/take`, { method: 'POST', body: {} });
    confetti();
    toast(`Wonderful! ${dose.medicine.name} marked as taken ✅`, {
      duration: 8000,
      action: { label: 'Undo', run: () => undo(dose) },
    });
    await refresh();
  } catch (err) {
    toast(err.message);
  }
}

async function undo(dose) {
  try {
    await api(`/api/doses/${encodeURIComponent(dose.id)}/undo`, { method: 'POST', body: {} });
    toast('Okay, changed back.');
    await refresh();
  } catch (err) {
    toast(err.message);
  }
}

async function snooze(dose) {
  buzz(20);
  try {
    const res = await api(`/api/doses/${encodeURIComponent(dose.id)}/snooze`, { method: 'POST', body: {} });
    toast(`Okay! I'll remind you in ${res.minutes} minutes ⏰`);
    await refresh();
  } catch (err) {
    toast(err.message);
  }
}

async function ack(update, response) {
  try {
    await api(`/api/activity/${encodeURIComponent(update.id)}/ack`, { method: 'POST', body: { response } });
    toast(response === 'ok' ? 'Thank you 👍' : `We've asked your family to call you 📞`);
    await refresh();
  } catch (err) {
    toast(err.message);
  }
}

function confetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#ffcb52', '#1c7a4b', '#ff9ec4', '#7cc0ff', '#ffa94d', '#c3a3ff'];
  const wrap = h('div', { class: 'confetti', 'aria-hidden': 'true' });
  for (let i = 0; i < 36; i += 1) {
    const bit = document.createElement('i');
    bit.style.left = `${Math.random() * 100}%`;
    bit.style.background = colors[i % colors.length];
    bit.style.animationDelay = `${Math.random() * 0.3}s`;
    wrap.append(bit);
  }
  document.body.append(wrap);
  setTimeout(() => wrap.remove(), 2200);
}

/* ------------------------------------------------------------ doctor tab */

function renderVisits() {
  const appts = state.today.appointments;
  if (!appts.length) {
    mount($('panel-visits'), h('section', { class: 'calm-card' },
      h('p', { class: 'calm-emoji', 'aria-hidden': 'true' }, '🩺'),
      h('h1', { class: 'calm-title' }, 'No doctor visits booked'),
      h('p', { class: 'calm-next' }, 'Your family will add them here.')));
    return;
  }
  const [a, ...rest] = appts;
  const speech = `${relativeDay(a.date, state.today.date)} at ${a.time12}, you will visit ${a.doctor}${a.plainSpecialty ? `, the ${a.plainSpecialty}` : ''}. ${a.location ? `At ${a.location}.` : ''} ${a.checklist.length ? `Please bring: ${a.checklist.join(', ')}.` : ''}`;
  mount($('panel-visits'),
    h('article', { class: 'visit-card', 'aria-labelledby': 'visit-title' },
      h('p', { class: 'visit-day' }, `🗓️ ${relativeDay(a.date, state.today.date)}, ${a.time12}`),
      h('h1', { class: 'visit-doc', id: 'visit-title' }, a.doctor),
      a.plainSpecialty && h('p', { class: 'visit-line' }, `🩺 ${a.plainSpecialty}`),
      a.location && h('p', { class: 'visit-line' }, `📍 ${a.location}`),
      a.notes && h('p', { class: 'visit-line' }, `📝 ${a.notes}`),
      a.checklist.length > 0 && h('div', { class: 'bring' },
        h('h2', { class: 'panel-title' }, 'Things to bring'),
        a.checklist.map((item, i) => {
          const done = Boolean(a.checklistDone?.[i]);
          return h('button', {
            class: 'bring-item', type: 'button', role: 'checkbox', 'aria-checked': String(done),
            onclick: () => toggleBring(a, i, !done),
          }, h('span', { class: 'box', 'aria-hidden': 'true' }, done ? '✓' : ''), item);
        })),
      h('div', { class: 'due-actions' },
        h('a', { class: 'btn btn-soft big-btn', href: a.calendarUrl, target: '_blank', rel: 'noopener' }, '📅 Add to Google Calendar'),
        canSpeak() && h('button', { class: 'btn big-btn', type: 'button', onclick: () => speak(speech, { rate: state.rate }) }, '🔊 Read aloud'))),
    rest.length > 0 && h('h2', { class: 'panel-title' }, 'Later visits'),
    rest.map((r) => h('div', { class: 'mini-visit' },
      h('span', {}, `${r.doctor}${r.plainSpecialty ? ` · ${r.plainSpecialty}` : ''}`),
      h('span', {}, `${relativeDay(r.date, state.today.date)}, ${r.time12}`))));
}

async function toggleBring(appt, index, done) {
  buzz(15);
  try {
    const res = await api(`/api/appointments/${encodeURIComponent(appt.id)}/checklist`, { method: 'POST', body: { index, done } });
    appt.checklistDone = res.checklistDone;
    renderVisits();
    const btn = $('panel-visits').querySelectorAll('.bring-item')[index];
    btn?.focus();
  } catch (err) {
    toast(err.message);
  }
}

/* ------------------------------------------------------------ my day tab */

const TIPS = [
  ['💧', 'Sip some water', 'A glass of water now and then keeps you fresh.'],
  ['🚶', 'A little walk', 'Ten slow minutes outside is good for the heart.'],
  ['🌞', 'Morning sunshine', 'A few minutes of sun helps your bones.'],
  ['📞', 'Call a friend', 'A chat with someone you love brightens the day.'],
  ['🧘', 'Deep breaths', 'Breathe in slowly… and out. Do it 5 times.'],
  ['🍎', 'Fresh fruit', 'A piece of fruit is a sweet, healthy snack.'],
  ['😴', 'Rest well', 'A short afternoon rest is perfectly fine.'],
];

function renderDay() {
  const today = state.today;
  const current = today.mood?.mood;
  const tip = TIPS[new Date(`${today.date}T00:00:00Z`).getUTCDate() % TIPS.length];
  const emergency = state.me.circle.emergencyPhone;
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(`${today.date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const mood = state.moods.find((m) => m.date === ds);
    days.push(h('div', { 'aria-label': `${d.toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'UTC' })}: ${mood ? MOODS[mood.mood].label : 'no answer'}` },
      h('span', { 'aria-hidden': 'true' }, mood ? MOODS[mood.mood].emoji : '·'),
      d.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' })));
  }

  mount($('panel-day'),
    h('section', { class: 'card' },
      h('h1', { class: 'panel-title' }, 'How are you feeling today?'),
      h('p', { class: 'visit-line' }, 'Tap one. Your family will see it.'),
      h('div', { class: 'mood-grid', role: 'group', 'aria-label': 'Choose your mood' },
        Object.entries(MOODS).map(([key, m]) => h('button', {
          class: `mood-btn ${key}`, type: 'button', 'aria-pressed': String(current === key), onclick: () => setMood(key),
        }, h('span', { 'aria-hidden': 'true' }, m.emoji), m.label))),
      current === 'good' && h('p', { class: 'calm-next' }, 'So happy to hear that! 💛'),
      current === 'okay' && h('p', { class: 'calm-next' }, 'Take it easy today. 🌿'),
      current === 'unwell' && h('div', { class: 'due-actions' },
        h('p', { class: 'calm-next' }, "We've let your family know 💛"),
        emergency && h('a', { class: 'btn btn-danger big-btn', href: `tel:${emergency}` }, `📞 Call ${state.me.circle.emergencyName || 'family'}`))),
    h('section', { class: 'card' },
      h('h2', { class: 'panel-title' }, 'This week'),
      h('div', { class: 'week-strip' }, days)),
    h('section', { class: 'tip-card' },
      h('span', { class: 'tip-emoji', 'aria-hidden': 'true' }, tip[0]),
      h('div', {}, h('b', {}, `Today's little idea: ${tip[1]}`), h('span', {}, tip[2]))));
}

async function setMood(mood) {
  buzz(25);
  try {
    const res = await api('/api/moods', { method: 'POST', body: { mood } });
    state.today.mood = res.mood;
    const others = state.moods.filter((m) => m.date !== res.mood.date);
    state.moods = [res.mood, ...others];
    renderDay();
    toast(mood === 'unwell' ? 'Your family has been told 💛' : 'Thank you for telling us!');
  } catch (err) {
    toast(err.message);
  }
}

/* ------------------------------------------------------------ help tab */

function renderHelp() {
  const { circle, members, member } = state.me;
  const size = document.documentElement.dataset.size;
  const callable = members.filter((m) => m.phone && m.id !== member.id);
  mount($('panel-help'),
    circle.emergencyPhone
      ? h('a', { class: 'sos', href: `tel:${circle.emergencyPhone}` }, h('span', { 'aria-hidden': 'true' }, '📞'), `Call ${circle.emergencyName || 'family'} now`)
      : h('p', { class: 'empty' }, 'Ask your family to add an emergency phone number.'),
    callable.length > 0 && h('div', { class: 'call-list' },
      h('h2', { class: 'panel-title' }, 'Call someone'),
      callable.map((m) => h('a', { class: 'btn call-btn', href: `tel:${m.phone}` },
        h('span', {}, `${m.role === 'caretaker' ? '🧑‍⚕️' : '👪'} ${m.name}${m.relation ? ` (${m.relation})` : ''}`), h('span', { 'aria-hidden': 'true' }, '📞')))),
    h('section', { class: 'setting' },
      h('h3', {}, 'Text size'),
      h('div', { class: 'size-choices', role: 'group', 'aria-label': 'Text size' },
        [['normal', 'A', 's1', 'Normal'], ['large', 'A', 's2', 'Bigger'], ['xl', 'A', 's3', 'Biggest']].map(([key, label, cls, name]) =>
          h('button', {
            class: `btn ${cls}`, type: 'button', 'aria-pressed': String(size === key), 'aria-label': `${name} text`,
            onclick: () => { applySize(key); prefs.set('sm_size', key); renderHelp(); },
          }, label)))),
    canSpeak() && h('section', { class: 'setting' },
      h('h3', {}, 'Reading voice speed'),
      h('div', { class: 'row-btns' },
        [['0.75', '🐢 Slower'], ['0.9', '🙂 Normal']].map(([rate, label]) => h('button', {
          class: 'btn', type: 'button', 'aria-pressed': String(String(state.rate) === rate),
          onclick: () => { state.rate = Number(rate); prefs.set('sm_rate', rate); speak('This is how I will read to you.', { rate: state.rate }); renderHelp(); },
        }, label)))),
    h('div', { class: 'small-links' },
      h('a', { class: 'btn btn-ghost btn-sm', href: '/family' }, '📋 Full details'),
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: logout }, '🚪 Sign out')));
}

async function logout() {
  await api('/api/auth/logout', { method: 'POST', body: {} }).catch(() => {});
  window.location.replace('/');
}

/* ------------------------------------------------------------ read whole screen */

function screenSpeech() {
  const t = state.today;
  if (state.tab === 'now') {
    if (t.now) return doseSpeech(t.now);
    return `You have taken ${t.progress.taken} of ${t.progress.total} medicines today. ${t.next ? `Next is ${t.next.medicine.name} at ${t.next.time12}.` : ''}`;
  }
  if (state.tab === 'visits') {
    const a = t.appointments[0];
    return a ? `Your next doctor visit is ${relativeDay(a.date, t.date)} at ${a.time12} with ${a.doctor}.` : 'No doctor visits are booked.';
  }
  if (state.tab === 'day') return 'How are you feeling today? Tap good, okay, or not well.';
  return 'Tap the big red button to call your family.';
}

boot();
