import {
  api, h, mount, toast, setupTabs, medicineVisual, relativeDay, shortDate, timeAgo, time12, MOODS,
  resizeImage, registerServiceWorker, liveSync, pushStatus, pushCard, pickPhoto, busy,
} from './common.js';
import { startI18n, langButton } from './i18n.js';
import { setupKeyboardBar } from './kbar.js';
import { extractVisit } from './intent.js';

const $ = (id) => document.getElementById(id);
const state = { tabs: null, medNames: [], doctors: [], locations: [], me: null, tab: 'overview', historyDays: 7, editingMed: null, editingVisit: null, photoData: null, push: 'off' };
const can = (p) => Boolean(state.me?.permissions?.[p]);
const ROLE_ICON = { elderly: '👵', family: '👪', caretaker: '🧑‍⚕️' };
const ROLE_NAME = { elderly: 'Elder', family: 'Family', caretaker: 'Caretaker' };

/* ------------------------------------------------------------ boot */

async function boot() {
  registerServiceWorker();
  startI18n();
  $('logout').before(langButton({ className: 'btn btn-sm' }));
  state.me = await api('/api/me');
  renderHeader();
  $('logout').addEventListener('click', logout);

  const tabs = setupTabs($('tablist'), { onChange: (t) => { state.tab = t; load(t); } });
  state.tabs = tabs;
  setupKeyboardBar({
    providers: {
      medicineNames: () => state.medNames, doctors: () => state.doctors, locations: () => state.locations,
      scan: can('manageCare') ? scanPrescription : null,
    },
    onIntent: goToIntent,
  });
  refreshSuggestions();
  window.addEventListener('hashchange', () => { if (location.hash.slice(1) !== state.tab) tabs.select(location.hash.slice(1)); });
  setupMedicineDialog();
  setupVisitDialog();
  setInterval(() => { if (!document.hidden && state.tab === 'overview') load('overview'); }, 60_000);
  // Live sync: when the elder (or anyone) changes something, this screen updates by itself.
  liveSync(() => { if (canAutoRefresh()) reload(); });
  pushStatus().then((st) => { state.push = st; if (state.tab === 'alerts') reload(); });
}

function renderHeader() {
  const { circle, member } = state.me;
  $('circle-title').textContent = `${circle.elderName}'s care circle`;
  $('circle-sub').textContent = `${member.name} · ${ROLE_NAME[member.role]} · Circle code ${circle.code}`;
}

/** Removes "wrong tab" suggestions left over from earlier typing. */
const clearHints = () => document.querySelectorAll('.intent-hint').forEach((n) => n.remove());

/** Names, doctors and clinics already used in this circle, for the keyboard shortcuts. */
async function refreshSuggestions() {
  try {
    const [{ medicines }, { upcoming, past }] = await Promise.all([api('/api/medicines'), api('/api/appointments')]);
    state.medNames = [...new Set(medicines.map((m) => m.name))];
    const visits = [...upcoming, ...past];
    state.doctors = [...new Set(visits.map((a) => a.doctor).filter(Boolean))];
    state.locations = [...new Set(visits.map((a) => a.location).filter(Boolean))];
  } catch { /* suggestions are optional */ }
}

/**
 * "Wrong tab" helper: takes the person to where their text belongs and fills in
 * what can be understood from it.
 */
async function goToIntent(intent, { text }) {
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  clearHints();
  if (intent === 'visit') {
    state.tabs.select('visits');
    openVisit();
    const v = extractVisit(text);
    const form = $('visit-form');
    if (v.doctor) form.elements.doctor.value = v.doctor;
    if (v.specialty) form.elements.specialty.value = v.specialty;
    if (v.date) form.elements.date.value = v.date;
    if (v.time) form.elements.time.value = v.time;
    form.elements.notes.value = text;
    toast('Moved to Visits – please check the details');
  } else if (intent === 'medicine') {
    state.tabs.select('medicines');
    openMedicine();
    $('ai-text').value = text;
    $('ai-fill').click();
    toast('Moved to Medicines – filling the form for you');
  } else if (intent === 'member') {
    state.tabs.select('circle');
    toast('Moved to Circle – add the person here');
    setTimeout(() => document.querySelector('form[data-kind="member"] [name="name"]')?.focus(), 900);
  } else {
    state.tabs.select({ report: 'reports', history: 'history', alerts: 'alerts' }[intent] || 'overview');
  }
}

/** Don't refresh under someone's fingers: skip while they are typing or a dialog is open. */
function canAutoRefresh() {
  if (document.querySelector('dialog[open]')) return false;
  const active = document.activeElement;
  if (active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) return false;
  return state.tab !== 'circle';
}

async function logout() {
  await api('/api/auth/logout', { method: 'POST', body: {} }).catch(() => {});
  window.location.replace('/');
}

const loaders = {
  overview: renderOverview, medicines: renderMedicines, visits: renderVisits, history: renderHistory,
  alerts: renderAlerts, circle: renderCircle, reports: renderReports,
};

async function load(tab) {
  try {
    await loaders[tab]();
  } catch (err) {
    if (err.status !== 401) mount($(`panel-${tab}`), h('p', { class: 'info' }, `Couldn't load this section: ${err.message}`));
  }
}

const reload = () => load(state.tab);

async function act(promise, message) {
  try {
    await promise;
    if (message) toast(message);
    await reload();
  } catch (err) {
    toast(err.message);
  }
}

/* ------------------------------------------------------------ overview */

const STATUS_CHIP = {
  taken: ['chip-green', '✅ Taken'], missed: ['chip-rose', '⚠️ Missed'], skipped: ['', '➖ Skipped'],
};

function doseStatusChip(d) {
  if (STATUS_CHIP[d.status]) return STATUS_CHIP[d.status];
  if (d.snoozeUntil != null && d.elapsed < 60 && d.elapsed > -30) return ['chip-amber', '⏰ Snoozed'];
  if (d.elapsed >= 0) return ['chip-amber', `⏳ Due ${d.elapsed} min ago`];
  return ['chip-blue', '🕒 Upcoming'];
}

function doseActions(d) {
  const out = [];
  if ((d.status === 'pending' && d.elapsed >= -60) || d.status === 'missed') {
    out.push(h('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: busy(() => act(api(`/api/doses/${encodeURIComponent(d.id)}/take`, { method: 'POST', body: {} }), 'Marked as taken')) }, 'Mark taken'));
    if (can('skipDose')) out.push(h('button', { class: 'btn btn-sm', type: 'button', onclick: () => skipDose(d) }, 'Skip'));
  }
  if (d.status === 'taken') {
    out.push(h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => act(api(`/api/doses/${encodeURIComponent(d.id)}/undo`, { method: 'POST', body: {} }), 'Changed back') }, 'Undo'));
  }
  return out;
}

const proofUrl = (d) => `/api/doses/${encodeURIComponent(d.id)}/proof?v=${d.proof.version || 1}`;

function proofChip(d) {
  if (!d.proof) return null;
  if (d.proof.status === 'verified') return h('span', { class: 'chip chip-green' }, `📷 Verified by ${d.proof.verifiedBy}`);
  if (d.proof.status === 'rejected') return h('span', { class: 'chip chip-rose' }, `📷 Needs a check (${d.proof.verifiedBy})`);
  return h('span', { class: 'chip chip-blue' }, '📷 Photo waiting for check');
}

const verify = (d, ok) => act(api(`/api/doses/${encodeURIComponent(d.id)}/verify`, { method: 'POST', body: { ok } }), ok ? 'Photo verified ✅' : 'Marked for a second look');

/** A card for a photo the elder sent: family verifies it, the caretaker sees the result. */
function proofCard(d) {
  const who = state.me.circle.elderName.split(' ')[0];
  return h('div', { class: 'proof-card' },
    h('a', { href: proofUrl(d), target: '_blank', rel: 'noopener', 'aria-label': 'Open the photo in full size' },
      h('img', { src: proofUrl(d), alt: `Photo sent by ${who} for ${d.medicine.name}`, loading: 'lazy' })),
    h('div', {},
      h('b', {}, `📷 ${who} sent a photo: ${d.medicine.name} (${d.time12})`),
      h('small', {}, `${timeAgo(d.proof.at)}`),
      can('verifyProof')
        ? h('div', { class: 'med-actions' },
          h('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: busy(() => verify(d, true)) }, '✅ Looks right'),
          h('button', { class: 'btn btn-sm', type: 'button', onclick: busy(() => verify(d, false)) }, '⚠️ Not right'))
        : h('span', { class: 'chip chip-blue' }, 'Waiting for family to check')));
}

function skipDose(d) {
  const reason = window.prompt(`Why skip ${d.medicine.name} at ${d.time12}? (optional – e.g. doctor said so)`);
  if (reason === null) return;
  act(api(`/api/doses/${encodeURIComponent(d.id)}/skip`, { method: 'POST', body: { reason } }), 'Dose skipped');
}

async function renderOverview() {
  const [today, stats, activity] = await Promise.all([api('/api/today'), api('/api/stats?days=7'), api('/api/activity')]);
  const questions = activity.activity.filter((a) => a.ack === 'question' && !a.answeredAt);
  const elderPhone = state.me.members.find((m) => m.role === 'elderly')?.phone;
  const missedToday = today.doses.filter((d) => d.status === 'missed');
  const elder = state.me.circle.elderName.split(' ')[0];

  const alerts = [
    ...today.doses.filter((d) => d.proof?.status === 'pending').map(proofCard),
    ...questions.slice(0, 5).map((q) => h('div', { class: 'alert-item lilac' },
      h('span', {}, `❓ ${elder} has a question about: “${q.detail}”`, h('small', { class: 'alert-when' }, ` · ${timeAgo(q.ackAt || q.at)}`)),
      h('div', { class: 'row-actions' },
        elderPhone && h('a', { class: 'btn btn-sm', href: `tel:${elderPhone}` }, `📞 Call ${elder}`),
        can('settings') && h('button', {
          class: 'btn btn-sm btn-primary', type: 'button',
          onclick: busy(() => act(api(`/api/activity/${encodeURIComponent(q.id)}/answer`, { method: 'POST', body: {} }), `${elder} will see that you answered 💚`)),
        }, '✅ Answered')))),
    today.mood?.mood === 'unwell' && h('div', { class: 'alert-item rose' }, h('span', {}, `😟 ${elder} said they are not feeling well today (${timeAgo(today.mood.at)}).`)),
    ...missedToday.map((d) => h('div', { class: 'alert-item rose' },
      h('span', {}, `⚠️ ${d.medicine.name} at ${d.time12} hasn't been confirmed.`),
      h('div', { class: 'row-actions' }, doseActions(d)))),
    ...today.lowStock.map((m) => h('div', { class: 'alert-item amber' },
      h('span', {}, `🛒 ${m.name} is running low – about ${m.daysLeft} day(s) left.`),
      h('button', { class: 'btn btn-sm', type: 'button', onclick: () => { location.hash = 'medicines'; document.getElementById('tab-medicines').click(); } }, 'Refill'))),
  ].filter(Boolean);

  const o = stats.overall;
  const mood = today.mood ? MOODS[today.mood.mood] : null;
  const next = today.nextAppointment;

  mount($('panel-overview'),
    alerts.length ? h('div', { class: 'alerts-strip', role: 'region', 'aria-label': 'Needs attention' }, alerts)
      : h('div', { class: 'info' }, `💚 All calm. Nothing needs your attention right now.`),
    h('div', { class: 'kpis' },
      kpi('green', `${today.progress.taken}/${today.progress.total}`, 'Taken today'),
      kpi('blue', o.rate == null ? '–' : `${o.rate}%`, '7-day adherence'),
      kpi(o.missed ? 'rose' : 'green', String(o.missed), 'Missed this week'),
      kpi('amber', today.streak ? `🌟 ${today.streak}` : '0', 'Day streak'),
      kpi('lilac', mood ? `${mood.emoji} ${mood.label}` : '–', 'Mood today'),
      kpi('blue', next ? `${relativeDay(next.date, today.date)}` : '–', next ? `${next.doctor} · ${next.time12}` : 'No visit booked')),
    h('div', { class: 'two-col' },
      h('section', { class: 'card' },
        h('h2', { class: 'section-title' }, `Today · ${today.dateLabel}`),
        today.doses.length
          ? h('ul', { class: 'rows' }, today.doses.map((d) => {
            const [cls, label] = doseStatusChip(d);
            return h('li', { class: 'row' },
              medicineVisual(d.medicine, 46),
              h('div', {}, h('b', {}, `${d.time12} · ${d.medicine.name}`),
                h('small', {}, d.status === 'taken' ? `by ${d.takenBy}${d.lateMinutes > 30 ? `, ${d.lateMinutes} min late` : ''}` : (d.medicine.pillDescription || ''))),
              h('div', { class: 'row-actions' }, h('span', { class: `chip ${cls}` }, label), proofChip(d),
                d.proof && h('a', { class: 'btn btn-sm btn-ghost', href: proofUrl(d), target: '_blank', rel: 'noopener' }, 'View photo'), doseActions(d)));
          }))
          : h('p', { class: 'empty' }, 'No medicines yet. Add them in the Medicines tab.')),
      h('section', { class: 'card' },
        h('h2', { class: 'section-title' }, 'Last 7 days'),
        dailyBars(stats.daily),
        h('h3', { class: 'section-title' }, 'Recent changes'),
        h('ul', { class: 'feed' }, activity.activity.slice(0, 4).map(activityItem)))));
}

function kpi(tone, value, label) {
  return h('div', { class: `kpi ${tone}` }, h('b', {}, value), h('span', {}, label));
}

function dailyBars(daily) {
  return h('div', { class: 'bars', role: 'img', 'aria-label': `Daily adherence: ${daily.map((d) => `${shortDate(d.date)} ${d.rate ?? 'no doses'}${d.rate != null ? '%' : ''}`).join(', ')}` },
    daily.map((d) => {
      const fill = h('div', { class: `bar-fill${d.rate != null && d.rate < 60 ? ' bad' : d.rate != null && d.rate < 90 ? ' low' : ''}` });
      fill.style.height = `${d.rate ?? 0}%`;
      return h('div', { class: 'bar-col' },
        h('div', { class: 'bar-track' }, fill),
        h('small', {}, d.rate == null ? '–' : `${d.rate}%`),
        h('small', {}, new Date(`${d.date}T12:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' })));
    }));
}

function activityItem(a) {
  const ackLabel = a.ack === 'ok' ? h('span', { class: 'chip chip-green' }, '👍 Seen')
    : a.ack === 'question' && a.answeredAt ? h('span', { class: 'chip chip-green' }, `✅ Answered by ${a.answeredBy}`)
      : a.ack === 'question' ? h('span', { class: 'chip chip-lilac' }, '❓ Has a question') : null;
  return h('li', {},
    h('span', { class: 'icon', 'aria-hidden': 'true' }, ROLE_ICON[a.actorRole] || '🤖'),
    h('div', {}, h('b', {}, a.detail), h('small', {}, `${a.actorName} · ${timeAgo(a.at)} `), ackLabel));
}

/* ------------------------------------------------------------ medicines */

async function renderMedicines() {
  const { medicines } = await api('/api/medicines');
  mount($('panel-medicines'),
    h('div', { class: 'panel-head' },
      h('h2', {}, 'Medicines'),
      can('manageCare') && h('div', { class: 'med-actions' },
        h('button', { class: 'btn btn-soft', type: 'button', onclick: scanPrescription }, '📷 Scan a prescription'),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => openMedicine() }, '＋ Add medicine'))),
    medicines.length
      ? h('div', { class: 'med-grid' }, medicines.map(medCard))
      : h('div', { class: 'card empty' }, h('p', {}, '💊 No medicines yet.'), h('p', {}, 'Tap “Add medicine” – you can just describe it in plain words.')));
}

function medCard(m) {
  const refillBox = h('div', { class: 'refill-inline', hidden: true });
  const input = h('input', { type: 'number', min: 1, max: 1000, inputmode: 'numeric', 'aria-label': `Pills to add for ${m.name}`, placeholder: 'e.g. 30' });
  refillBox.append(input,
    h('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: () => act(api(`/api/medicines/${m.id}/refill`, { method: 'POST', body: { add: Number(input.value) } }), `Stock updated for ${m.name}`) }, 'Add'));

  return h('article', { class: 'med-card' },
    h('div', { class: 'med-top' },
      medicineVisual(m, 64),
      h('div', {},
        h('h3', {}, `${m.name}${m.dose ? ` · ${m.dose}` : ''}`),
        h('p', { class: 'muted' }, [m.pillDescription, m.instructions].filter(Boolean).join(' · ')))),
    m.purpose && h('p', {}, `💜 ${m.purpose}`),
    h('div', { class: 'time-chips' }, m.times.map((t) => h('span', { class: 'chip chip-blue' }, `🕒 ${time12(t)}`))),
    m.daysLeft != null && h('p', {}, h('span', { class: `chip ${m.needsRefill ? 'chip-rose' : 'chip-green'}` },
      `${m.needsRefill ? '🛒' : '📦'} ${m.stock} left · about ${m.daysLeft} day(s)`)),
    can('manageCare') && h('div', { class: 'med-actions' },
      h('button', { class: 'btn btn-sm', type: 'button', onclick: () => openMedicine(m) }, '✏️ Edit'),
      h('button', { class: 'btn btn-sm', type: 'button', onclick: () => { refillBox.hidden = !refillBox.hidden; if (!refillBox.hidden) input.focus(); } }, '📦 Refill'),
      h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => stopMedicine(m) }, '🛑 Stop')),
    refillBox);
}

/* ---- prescription scan (Gemini reads the photo; the family reviews before anything is saved) */

async function scanPrescription() {
  let dataUrl;
  try {
    dataUrl = await pickPhoto({ max: 1400, quality: 0.75 });
  } catch (err) {
    toast(err.message);
    return;
  }
  if (!dataUrl) return;
  const dialog = $('scan-dialog');
  const body = $('scan-body');
  mount(body, h('div', { class: 'spinner', role: 'progressbar', 'aria-label': 'Reading the prescription' }), h('p', { class: 'empty' }, 'Reading the prescription with Gemini…'));
  dialog.showModal();
  try {
    const { medicines } = await api('/api/ai/scan-prescription', { method: 'POST', body: { dataUrl } });
    renderScan(medicines);
  } catch (err) {
    mount(body, h('p', { class: 'info' }, err.message));
  }
}

function renderScan(medicines) {
  const body = $('scan-body');
  if (!medicines.length) {
    mount(body, h('p', { class: 'info' }, 'No medicines could be read from that photo. Try a clearer, well-lit picture.'));
    return;
  }
  const rows = medicines.map((m) => {
    const status = h('span', { class: 'row-actions' });
    const add = async () => {
      try {
        await api('/api/medicines', { method: 'POST', body: { ...m, color: 'white', shape: 'round' } });
        mount(status, h('span', { class: 'chip chip-green' }, '✅ Added'));
        if (state.tab === 'medicines') renderMedicines();
      } catch (err) {
        toast(err.message);
      }
    };
    const edit = () => {
      $('scan-dialog').close();
      openMedicine();
      fillMedicineForm({ ...m, color: 'white', shape: 'round' });
      $('ai-box').hidden = true;
    };
    mount(status,
      h('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: add }, '＋ Add'),
      h('button', { class: 'btn btn-sm', type: 'button', onclick: edit }, '✏️ Edit first'));
    return h('li', { class: 'row scan-row' },
      h('span', { class: 'scan-icon', 'aria-hidden': 'true' }, '💊'),
      h('div', {}, h('b', {}, `${m.name}${m.dose ? ` · ${m.dose}` : ''}`),
        h('small', {}, [m.pillDescription, m.times.map(time12).join(', '), m.instructions, m.purpose].filter(Boolean).join(' · '))),
      status);
  });
  mount(body,
    h('p', { class: 'info' }, `Gemini found ${medicines.length} medicine(s). Please check each one against the prescription before adding.`),
    h('ul', { class: 'rows' }, rows));
}

function stopMedicine(m) {
  if (!window.confirm(`Stop ${m.name}? Future reminders will be removed. Past history is kept.`)) return;
  act(api(`/api/medicines/${m.id}`, { method: 'DELETE' }), `${m.name} stopped`);
}

const COLORS = ['white', 'yellow', 'orange', 'pink', 'red', 'blue', 'green', 'purple', 'brown'];

function addTimeInput(value = '') {
  const input = h('input', { type: 'time', value, required: true, 'aria-label': 'Dose time' });
  const item = h('div', { class: 'time-item' }, input,
    h('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'aria-label': 'Remove this time', onclick: () => { if ($('times').children.length > 1) item.remove(); } }, '✕'));
  $('times').append(item);
  return input;
}

function setupMedicineDialog() {
  const dialog = $('med-dialog');
  const form = $('med-form');
  mount($('swatches'), COLORS.map((c) => h('label', { class: 'swatch', title: c },
    h('input', { type: 'radio', name: 'color', value: c, 'aria-label': c }), h('span', { class: `sw-${c}` }))));
  $('add-time').addEventListener('click', () => addTimeInput().focus());
  dialog.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => dialog.close()));

  $('photo').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      state.photoData = await resizeImage(file);
      mount($('photo-preview'), h('img', { src: state.photoData, alt: '' }));
    } catch (err) {
      toast(err.message);
    }
  });

  $('ai-fill').addEventListener('click', async () => {
    const text = $('ai-text').value.trim();
    if (text.length < 3) { $('ai-note').textContent = 'Type a short description first.'; return; }
    $('ai-note').textContent = 'Reading…';
    try {
      const { parsed } = await api('/api/ai/parse-medicine', { method: 'POST', body: { text } });
      fillMedicineForm(parsed, { keepColor: true });
      $('ai-note').textContent = parsed.source === 'gemini' ? '✨ Filled by Gemini – please check it' : '✨ Filled – please check it';
    } catch (err) {
      $('ai-note').textContent = err.message;
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    $('med-error').textContent = '';
    const fd = new FormData(form);
    const times = [...$('times').querySelectorAll('input')].map((i) => i.value).filter(Boolean);
    const num = (k) => (fd.get(k) === '' || fd.get(k) == null ? null : Number(fd.get(k)));
    const body = {
      name: fd.get('name'), dose: fd.get('dose'), pillDescription: fd.get('pillDescription'), purpose: fd.get('purpose'),
      instructions: fd.get('instructions'), times, color: fd.get('color') || 'white', shape: fd.get('shape'),
      stock: num('stock'), pillsPerDose: num('pillsPerDose') ?? 1, refillThresholdDays: num('refillThresholdDays') ?? 5,
    };
    if (!body.name?.trim()) { $('med-error').textContent = 'Please enter the medicine name.'; return; }
    if (!times.length) { $('med-error').textContent = 'Please add at least one time.'; return; }
    try {
      const res = state.editingMed
        ? await api(`/api/medicines/${state.editingMed.id}`, { method: 'PUT', body })
        : await api('/api/medicines', { method: 'POST', body });
      if (state.photoData) await api(`/api/medicines/${res.medicine.id}/photo`, { method: 'PUT', body: { dataUrl: state.photoData } });
      dialog.close();
      refreshSuggestions();
      toast(state.editingMed ? 'Medicine updated' : `${body.name} added 💊`);
      reload();
    } catch (err) {
      $('med-error').textContent = err.message;
    }
  });
}

function fillMedicineForm(m, { keepColor = false } = {}) {
  const form = $('med-form');
  for (const k of ['name', 'dose', 'pillDescription', 'purpose', 'instructions']) {
    if (m[k] != null && (m[k] !== '' || !keepColor)) form.elements[k].value = m[k];
  }
  if (m.stock != null || !keepColor) form.elements.stock.value = m.stock ?? '';
  form.elements.pillsPerDose.value = m.pillsPerDose ?? 1;
  if (m.refillThresholdDays) form.elements.refillThresholdDays.value = m.refillThresholdDays;
  if (m.shape) form.elements.shape.value = m.shape;
  if (!keepColor || m.color) {
    const c = form.querySelector(`input[name="color"][value="${m.color || 'white'}"]`);
    if (c) c.checked = true;
  }
  $('times').replaceChildren();
  (m.times?.length ? m.times : ['09:00']).forEach((t) => addTimeInput(t));
}

function openMedicine(m = null) {
  clearHints();
  state.editingMed = m;
  state.photoData = null;
  const form = $('med-form');
  form.reset();
  $('med-error').textContent = '';
  $('ai-note').textContent = '';
  $('ai-text').value = '';
  $('ai-box').hidden = Boolean(m);
  $('med-dialog-title').textContent = m ? `Edit ${m.name}` : 'Add medicine';
  fillMedicineForm(m || { color: 'white', shape: 'round', times: ['09:00'], pillsPerDose: 1, refillThresholdDays: 5 });
  mount($('photo-preview'), m ? medicineVisual(m, 84) : '📷');
  $('med-dialog').showModal();
  (m ? form.elements.name : $('ai-text')).focus();
}

/* ------------------------------------------------------------ visits */

async function renderVisits() {
  const { upcoming, past } = await api('/api/appointments');
  mount($('panel-visits'),
    h('div', { class: 'panel-head' },
      h('h2', {}, 'Doctor visits'),
      can('manageCare') && h('button', { class: 'btn btn-primary', type: 'button', onclick: () => openVisit() }, '＋ Book a visit')),
    h('p', { class: 'muted' }, 'Reminder emails go out the day before and on the morning of each visit.'),
    upcoming.length ? upcoming.map((a) => visitCard(a, false)) : h('div', { class: 'card empty' }, '🩺 No upcoming visits.'),
    past.length > 0 && h('h3', { class: 'section-title' }, 'Past & cancelled'),
    past.map((a) => visitCard(a, true)));
}

function visitCard(a, isPast) {
  const ticked = (a.checklistDone || []).filter(Boolean).length;
  return h('article', { class: `visit${isPast ? ' past' : ''}` },
    h('div', { class: 'panel-head' },
      h('h3', {}, `${a.doctor}${a.specialty ? ` · ${a.specialty}` : ''}`),
      h('span', { class: `chip ${a.status === 'done' ? 'chip-green' : a.status === 'cancelled' ? '' : 'chip-blue'}` },
        a.status === 'upcoming' ? `🗓️ ${a.dateLabel}, ${a.time12}` : a.status === 'done' ? `✅ Done · ${shortDate(a.date)}` : `✕ Cancelled · ${shortDate(a.date)}`)),
    a.location && h('p', {}, `📍 ${a.location}`),
    a.checklist.length > 0 && h('p', {}, `🎒 Bring: ${a.checklist.join(', ')} `, h('span', { class: 'chip chip-amber' }, `${ticked}/${a.checklist.length} packed`)),
    a.notes && h('p', { class: 'muted' }, `📝 ${a.notes}`),
    h('div', { class: 'med-actions' },
      a.status === 'upcoming' && h('a', { class: 'btn btn-sm btn-soft', href: a.calendarUrl, target: '_blank', rel: 'noopener' }, '📅 Google Calendar'),
      can('manageCare') && a.status === 'upcoming' && [
        h('button', { class: 'btn btn-sm', type: 'button', onclick: () => act(api(`/api/appointments/${a.id}`, { method: 'PUT', body: { status: 'done' } }), 'Marked as done') }, '✅ Done'),
        h('button', { class: 'btn btn-sm', type: 'button', onclick: () => openVisit(a) }, '✏️ Edit'),
        h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => { if (window.confirm('Cancel this visit?')) act(api(`/api/appointments/${a.id}`, { method: 'PUT', body: { status: 'cancelled' } }), 'Visit cancelled'); } }, 'Cancel visit'),
      ],
      can('manageCare') && isPast && h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => { if (window.confirm('Delete this visit from the record?')) act(api(`/api/appointments/${a.id}`, { method: 'DELETE' }), 'Deleted'); } }, '🗑️ Delete')));
}

function setupVisitDialog() {
  $('scan-dialog').querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => $('scan-dialog').close()));
  const dialog = $('visit-dialog');
  const form = $('visit-form');
  dialog.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => dialog.close()));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    $('visit-error').textContent = '';
    const fd = new FormData(form);
    const body = {
      doctor: fd.get('doctor'), specialty: fd.get('specialty'), date: fd.get('date'), time: fd.get('time'),
      location: fd.get('location'), notes: fd.get('notes'),
      checklist: String(fd.get('checklist') || '').split('\n').map((s) => s.trim()).filter(Boolean),
    };
    if (!body.doctor.trim() || !body.date || !body.time) { $('visit-error').textContent = 'Doctor, date and time are needed.'; return; }
    try {
      if (state.editingVisit) await api(`/api/appointments/${state.editingVisit.id}`, { method: 'PUT', body });
      else await api('/api/appointments', { method: 'POST', body });
      dialog.close();
      refreshSuggestions();
      toast(state.editingVisit ? 'Visit updated' : 'Visit booked 🩺');
      reload();
    } catch (err) {
      $('visit-error').textContent = err.message;
    }
  });
}

function openVisit(a = null) {
  clearHints();
  state.editingVisit = a;
  const form = $('visit-form');
  form.reset();
  $('visit-error').textContent = '';
  $('visit-dialog-title').textContent = a ? 'Edit visit' : 'Book a doctor visit';
  if (a) {
    for (const k of ['doctor', 'specialty', 'date', 'time', 'location', 'notes']) form.elements[k].value = a[k] || '';
    form.elements.checklist.value = a.checklist.join('\n');
  }
  $('visit-dialog').showModal();
  form.elements.doctor.focus();
}

/* ------------------------------------------------------------ history */

async function renderHistory() {
  const days = state.historyDays;
  const [stats, doses] = await Promise.all([api(`/api/stats?days=${days}`), api(`/api/doses?days=${days}`)]);
  const o = stats.overall;
  const range = h('div', { class: 'seg-sm', role: 'group', 'aria-label': 'Time range' },
    [7, 14, 30].map((d) => h('button', {
      type: 'button', 'aria-pressed': String(d === days), onclick: () => { state.historyDays = d; renderHistory(); },
    }, `${d} days`)));

  mount($('panel-history'),
    h('div', { class: 'panel-head' }, h('h2', {}, 'History'), range),
    h('div', { class: 'kpis' },
      kpi('blue', o.rate == null ? '–' : `${o.rate}%`, 'Doses taken'),
      kpi('green', String(o.onTime), 'On time (within 30 min)'),
      kpi(o.missed ? 'rose' : 'green', String(o.missed), 'Missed'),
      kpi('lilac', String(stats.moods.length), 'Mood check-ins')),
    h('div', { class: 'two-col' },
      h('section', { class: 'card' },
        h('h3', { class: 'section-title' }, 'Each day'),
        dailyBars(days > 14 ? stats.daily.slice(-14) : stats.daily),
        days > 14 && h('p', { class: 'muted' }, 'Showing the last 14 days in the chart.')),
      h('section', { class: 'card' },
        h('h3', { class: 'section-title' }, 'By medicine'),
        stats.medicines.filter((m) => m.total > 0).map((m) => {
          const fill = h('div', { class: `bar-fill${m.rate < 60 ? ' bad' : m.rate < 90 ? ' low' : ''}` });
          fill.style.width = `${m.rate}%`;
          return h('div', { class: 'hbar' }, h('span', {}, m.name), h('div', { class: 'bar-track', role: 'img', 'aria-label': `${m.name}: ${m.rate}%` }, fill), h('span', {}, `${m.rate}%`));
        }),
        h('h3', { class: 'section-title' }, 'Mood'),
        stats.moods.length
          ? h('div', { class: 'mood-strip' }, stats.daily.filter((d) => d.mood).map((d) => h('span', {}, h('i', { 'aria-hidden': 'true' }, MOODS[d.mood].emoji), shortDate(d.date))))
          : h('p', { class: 'muted' }, 'No check-ins yet.'))),
    h('section', {},
      h('h3', { class: 'section-title' }, 'Dose log'),
      h('div', { class: 'table-wrap' },
        h('table', {},
          h('caption', { class: 'sr-only' }, `Dose log for the last ${days} days`),
          h('thead', {}, h('tr', {}, ['Date', 'Time', 'Medicine', 'Status', 'By', 'Late'].map((c) => h('th', { scope: 'col' }, c)))),
          h('tbody', {}, doses.doses.map((d) => {
            const [cls, label] = STATUS_CHIP[d.status] || ['chip-blue', '🕒 Pending'];
            return h('tr', {},
              h('td', {}, shortDate(d.date)), h('td', {}, time12(d.time)), h('td', {}, d.medicineName || '–'),
              h('td', {}, h('span', { class: `chip ${cls}` }, label)), h('td', {}, d.takenBy || '–'),
              h('td', {}, d.lateMinutes ? `${d.lateMinutes} min` : '–'));
          }))))));
}

/* ------------------------------------------------------------ alerts */

const KIND_ICON = {
  'elder-upcoming': '💊', 'elder-second': '🔔', 'elder-snooze': '⏰', 'family-missed': '⚠️', 'appointment-day-before': '🩺',
  'appointment-morning': '🩺', refill: '🛒', 'weekly-summary': '📊', 'mood-unwell': '😟', 'elder-question': '❓',
};

async function renderAlerts() {
  if (!can('settings')) {
    mount($('panel-alerts'),
      pushCard(state.push, async () => { state.push = await pushStatus(); renderAlerts(); }),
      h('p', { class: 'info' }, 'Only family and caretakers can see the reminder log.'));
    return;
  }
  const { notifications, emailEnabled, emailVia } = await api('/api/notifications');
  mount($('panel-alerts'),
    h('div', { class: 'panel-head' }, h('h2', {}, 'Reminders & alerts')),
    pushCard(state.push, async () => { state.push = await pushStatus(); renderAlerts(); }),
    h('p', { class: 'info' }, emailEnabled
      ? (emailVia === 'gmail-api' ? '📧 Emails are sent through the Gmail API. Every reminder is also listed here.' : '📧 Emails are being sent. Every reminder is also listed here.')
      : '📧 Email sending isn\'t set up on this server, so reminders are listed here instead of being sent.'),
    h('p', { class: 'muted' }, 'How it works: a reminder 10 min before each dose → a gentle second reminder 30 min after → family is emailed if it is still not taken after 1 hour.'),
    notifications.length
      ? h('ul', { class: 'feed' }, notifications.map((n) => h('li', {},
        h('span', { class: 'icon', 'aria-hidden': 'true' }, KIND_ICON[n.kind] || '📧'),
        h('div', {},
          h('b', {}, n.subject),
          h('small', {}, `${timeAgo(n.at)} · to ${n.to.length ? n.to.join(', ') : 'nobody'} · `),
          n.sending
            ? h('span', { class: 'chip chip-blue' }, 'Sending…')
            : h('span', { class: `chip ${n.delivered ? 'chip-green' : 'chip-amber'}` }, n.delivered ? 'Sent' : (n.error || 'Not sent')),
          h('p', { class: 'muted' }, n.preview)))))
      : h('div', { class: 'card empty' }, '🔕 No reminders yet.'));
}

/* ------------------------------------------------------------ circle */

async function renderCircle() {
  const [{ members }, { activity }] = await Promise.all([api('/api/members'), api('/api/activity')]);
  const { circle, member } = state.me;

  const memberForm = can('manageMembers') && h('form', { class: 'card', novalidate: true, onsubmit: addMember, dataset: { kind: 'member' } },
    h('h3', { class: 'section-title' }, '＋ Add someone to the circle'),
    h('div', { class: 'grid-2' },
      field('Name *', h('input', { name: 'name', required: true, maxlength: 60 })),
      field('Role', h('select', { name: 'role' }, h('option', { value: 'family' }, 'Family'), h('option', { value: 'caretaker' }, 'Caretaker / nurse'),
        !members.some((m) => m.role === 'elderly') && h('option', { value: 'elderly' }, 'Elder'))),
      field('Relation', h('input', { name: 'relation', maxlength: 40, placeholder: 'Son, nurse…' })),
      field('Email', h('input', { name: 'email', type: 'email', placeholder: 'for alerts' })),
      field('Phone', h('input', { name: 'phone', type: 'tel', inputmode: 'tel' })),
      field('Their PIN (4–6 digits) *', h('input', { name: 'pin', type: 'password', inputmode: 'numeric', maxlength: 6, autocomplete: 'new-password', required: true }))),
    h('p', { class: 'form-error', role: 'alert' }),
    h('button', { class: 'btn btn-primary', type: 'submit' }, 'Add to circle'));

  const settingsForm = can('settings') && h('form', { class: 'card', novalidate: true, onsubmit: saveSettings, dataset: { kind: 'settings' } },
    h('h3', { class: 'section-title' }, '⚙️ Circle settings'),
    h('div', { class: 'grid-2' },
      field("Elder's name", h('input', { name: 'elderName', value: circle.elderName, maxlength: 60, required: true })),
      field('Time zone', h('input', { name: 'timezone', value: circle.timezone, maxlength: 60 })),
      field('Emergency contact name', h('input', { name: 'emergencyName', value: circle.emergencyName || '', maxlength: 60 })),
      field('Emergency phone (big red button)', h('input', { name: 'emergencyPhone', type: 'tel', value: circle.emergencyPhone || '' }))),
    h('p', { class: 'form-error', role: 'alert' }),
    h('button', { class: 'btn btn-primary', type: 'submit' }, 'Save settings'));

  const pinForm = h('form', { class: 'card', novalidate: true, onsubmit: changePin, dataset: { kind: 'pin' } },
    h('h3', { class: 'section-title' }, '🔑 Change my PIN'),
    field('New PIN (4–6 digits)', h('input', { name: 'pin', type: 'password', inputmode: 'numeric', maxlength: 6, autocomplete: 'new-password' })),
    h('p', { class: 'form-error', role: 'alert' }),
    h('button', { class: 'btn', type: 'submit' }, 'Update PIN'));

  mount($('panel-circle'),
    h('div', { class: 'panel-head' }, h('h2', {}, 'Care circle'), h('span', { class: 'chip chip-amber' }, `Circle code: ${circle.code}`)),
    h('div', { class: 'people' }, members.map((m) => h('div', { class: 'person-card' },
      h('div', { class: 'who' }, h('span', { class: 'avatar', 'aria-hidden': 'true' }, ROLE_ICON[m.role]),
        h('div', {}, h('b', {}, `${m.name}${m.id === member.id ? ' (you)' : ''}`), h('small', { class: 'muted' }, ` ${ROLE_NAME[m.role]}${m.relation ? ` · ${m.relation}` : ''}`))),
      m.email && h('small', {}, `📧 ${m.email}`),
      m.phone && h('a', { href: `tel:${m.phone}` }, `📞 ${m.phone}`),
      can('manageMembers') && m.role !== 'elderly' && m.id !== member.id &&
        h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => { if (window.confirm(`Remove ${m.name} from the circle?`)) act(api(`/api/members/${m.id}`, { method: 'DELETE' }), `${m.name} removed`); } }, 'Remove')))),
    h('div', { class: 'two-col' }, h('div', { class: 'panel' }, memberForm, settingsForm), h('div', { class: 'panel' }, pinForm,
      h('section', { class: 'card' },
        h('h3', { class: 'section-title' }, '🕘 Activity log'),
        h('p', { class: 'muted' }, 'Every change is recorded, and the elder can say “OK” or “I have a question”.'),
        h('ul', { class: 'feed' }, activity.slice(0, 30).map(activityItem))))));
}

function field(label, input) {
  return h('label', { class: 'field' }, h('span', {}, label), input);
}

async function submitForm(e, fn, message) {
  e.preventDefault();
  const form = e.currentTarget;
  const err = form.querySelector('.form-error');
  err.textContent = '';
  try {
    await fn(Object.fromEntries(new FormData(form)));
    toast(message);
    form.reset();
    state.me = await api('/api/me');
    renderHeader();
    reload();
  } catch (ex) {
    err.textContent = ex.message;
  }
}

const addMember = (e) => submitForm(e, (data) => api('/api/members', { method: 'POST', body: data }), 'Added to the circle 👪');
const saveSettings = (e) => submitForm(e, (data) => api('/api/circle', { method: 'PUT', body: data }), 'Settings saved');
const changePin = (e) => submitForm(e, (data) => api(`/api/members/${state.me.member.id}`, { method: 'PUT', body: { pin: data.pin } }), 'Your PIN was changed');

/* ------------------------------------------------------------ reports */

async function renderReports() {
  const weekly = await api('/api/reports/weekly');
  mount($('panel-reports'),
    h('div', { class: 'panel-head' }, h('h2', {}, 'Reports')),
    h('div', { class: 'two-col' },
      h('section', { class: 'card' },
        h('h3', { class: 'section-title' }, '📊 Weekly summary'),
        h('p', { class: 'muted' }, 'Sent automatically every Sunday evening to family and caretakers.'),
        h('div', { class: 'report-lines' }, weekly.lines.map((l) => h('p', {}, l))),
        can('settings') && h('p', {}, h('button', {
          class: 'btn btn-primary', type: 'button',
          onclick: busy(() => act(api('/api/reports/weekly/send', { method: 'POST', body: {} }).then((r) => {
            if (r.notification.error) toast(`Saved to Alerts (${r.notification.error})`);
          }), 'Sending the weekly summary 📧 – see the Alerts tab')),
        }, `📧 Email it now to ${weekly.recipients.length} people`))),
      h('section', { class: 'card' },
        h('h3', { class: 'section-title' }, '🩺 For the doctor'),
        h('p', {}, 'A clean one-page summary: medicines, how well they were taken in the last 30 days, missed doses, mood and recent visits.'),
        h('p', {}, h('a', { class: 'btn btn-primary', href: '/print', target: '_blank', rel: 'noopener' }, '🖨️ Open printable summary')))));
}

boot().catch((err) => { if (err.status !== 401) toast(err.message); });
