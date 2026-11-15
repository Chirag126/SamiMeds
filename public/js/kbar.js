/**
 * Smart shortcut bar that sits just above the phone keyboard.
 *
 * - Shows ready-made answers for the box being typed in (tap instead of typing)
 * - Prev / Next to move between boxes, 🎤 to speak, Done to close the keyboard
 * - Stays above the keyboard on Android and iPhone (visualViewport), and scrolls
 *   the box being typed in so the bar never covers it
 * - Phones only: hidden with a mouse and keyboard
 * - "Wrong tab" helper: if what is typed belongs somewhere else, a small note
 *   appears under the box (in the page flow, so it never covers anything)
 */
import { h } from './common.js';
import { getLang } from './i18n.js';
import { wrongPlace, INTENT_LABEL, addDaysLocal } from './intent.js';

const TEXTY = new Set(['text', 'email', 'tel', 'number', 'search', 'password', 'date', 'time', 'url']);
const FORM_KIND = { 'med-form': 'medicine', 'visit-form': 'visit', 'setup-form': 'setup', 'signin-form': 'signin' };

const RELATIONS = ['Son', 'Daughter', 'Daughter-in-law', 'Son-in-law', 'Grandson', 'Granddaughter', 'Nurse', 'Neighbour'];
const replace = (values) => values.map((v) => (typeof v === 'string' ? { label: v, value: v } : v)).map((c) => ({ mode: 'replace', ...c }));

/** Fixed shortcuts for each kind of box. Values are saved in English so everyone's data stays consistent. */
const STATIC_CHIPS = {
  'medicine:dose': replace(['5 mg', '10 mg', '20 mg', '25 mg', '40 mg', '50 mg', '100 mg', '250 mg', '500 mg', '1000 mg']),
  'medicine:pillDescription': replace(['1 tablet', '½ tablet', '2 tablets', '1 capsule', '5 ml', '10 ml', '1 drop in each eye', '1 puff']),
  'medicine:purpose': replace(['For blood pressure', 'For sugar (diabetes)', 'For heart', 'For cholesterol', 'For thyroid', 'For pain', 'For acidity', 'For strong bones', 'For sleep', 'Vitamin']),
  'medicine:instructions': ['after breakfast', 'before breakfast', 'after lunch', 'after dinner', 'at bedtime', 'after food', 'before food', 'with water', 'empty stomach']
    .map((v) => ({ label: v, value: v, mode: 'append', sep: ', ' })),
  'medicine:time': replace([
    { label: '🌅 7 AM', value: '07:00' }, { label: '🌅 8 AM', value: '08:00' }, { label: '☀️ 9 AM', value: '09:00' },
    { label: '☀️ 2 PM', value: '14:00' }, { label: '🌇 6 PM', value: '18:00' }, { label: '🌙 9 PM', value: '21:00' },
    { label: '🛏️ 9:30 PM', value: '21:30' },
  ]),
  'medicine:stock': replace(['10', '15', '30', '60', '90']),
  'medicine:pillsPerDose': replace([{ label: '½', value: '0.5' }, '1', '2']),
  'medicine:refillThresholdDays': replace(['3', '5', '7']),
  'medicine:ai': ['once daily', 'twice a day', 'three times a day', 'after food', 'at bedtime', '30 tablets']
    .map((v) => ({ label: v, value: v, mode: 'append', sep: ' ' })),
  'visit:specialty': replace([
    { label: 'Heart', value: 'Cardiology' }, { label: 'Sugar', value: 'Endocrinology' }, { label: 'Eye', value: 'Ophthalmology' },
    { label: 'Bones', value: 'Orthopedics' }, { label: 'Family doctor', value: 'General physician' }, { label: 'Nerves', value: 'Neurology' },
    { label: 'Teeth', value: 'Dentist' }, { label: 'Skin', value: 'Dermatology' },
  ]),
  'visit:time': replace([
    { label: '9 AM', value: '09:00' }, { label: '10 AM', value: '10:00' }, { label: '11 AM', value: '11:00' }, { label: '12 PM', value: '12:00' },
    { label: '4 PM', value: '16:00' }, { label: '5 PM', value: '17:00' }, { label: '6 PM', value: '18:00' },
  ]),
  'visit:checklist': ['Old reports', 'BP diary', 'Sugar diary', 'Medicine list', 'Reading glasses', 'ID card', 'Insurance card']
    .map((v) => ({ label: v, value: v, mode: 'line' })),
  'visit:notes': ['Routine check-up', 'Follow-up', 'Fasting – no breakfast', 'Bring fasting sugar report']
    .map((v) => ({ label: v, value: v, mode: 'append', sep: '. ' })),
  'member:relation': replace(RELATIONS),
  'setup:familyRelation': replace(RELATIONS),
  'settings:timezone': replace(['Asia/Kolkata']),
};

/** Date shortcuts are worked out when shown, so "Tomorrow" is always right. */
function dateChips() {
  return replace([
    { label: 'Today', value: addDaysLocal(0) }, { label: 'Tomorrow', value: addDaysLocal(1) },
    { label: 'In 3 days', value: addDaysLocal(3) }, { label: 'Next week', value: addDaysLocal(7) },
    { label: 'In 2 weeks', value: addDaysLocal(14) },
  ]);
}

/** e.g. 'medicine:dose', 'visit:date', 'member:relation', or 'any:email'. */
export function fieldKey(el) {
  const form = el.closest('form');
  const kind = form?.dataset.kind || FORM_KIND[form?.id] || 'any';
  if (el.id === 'ai-text') return 'medicine:ai';
  if (el.closest('#times')) return 'medicine:time';
  if (el.type === 'email') return `${kind}:email`;
  if (el.type === 'tel') return `${kind}:tel`;
  return `${kind}:${el.name || el.id || el.type}`;
}

function chipsFor(key, el, providers) {
  if (key.endsWith(':email')) {
    return ['@gmail.com', '@yahoo.com', '@outlook.com'].map((v) => ({ label: v, value: v, mode: 'suffix' }));
  }
  if (key.endsWith(':tel')) return [{ label: '+91', value: '+91', mode: 'prefix' }];
  if (key === 'visit:date') return dateChips();
  if (key === 'medicine:name') {
    const names = (providers.medicineNames?.() || []).slice(0, 8);
    return [
      providers.scan && { label: '📷 Scan prescription', action: providers.scan },
      ...replace(names),
    ].filter(Boolean);
  }
  if (key === 'visit:doctor') {
    return [{ label: 'Dr. ', value: 'Dr. ', mode: 'start' }, ...replace((providers.doctors?.() || []).slice(0, 6))];
  }
  if (key === 'visit:location') return replace((providers.locations?.() || []).slice(0, 5));
  if (el.type === 'password' || /pin/i.test(el.name)) return []; // never suggest PINs
  return STATIC_CHIPS[key] || [];
}

/** Puts a chip's value into the box the way that chip is meant to work. */
export function applyChip(current, chip) {
  const now = String(current || '');
  switch (chip.mode) {
    case 'append':
      if (now.toLowerCase().includes(chip.value.toLowerCase())) return now;
      return now.trim() ? `${now.trim().replace(/[,.]$/, '')}${chip.sep}${chip.value}` : chip.value;
    case 'line':
      if (now.split('\n').some((l) => l.trim().toLowerCase() === chip.value.toLowerCase())) return now;
      return now.trim() ? `${now.replace(/\s+$/, '')}\n${chip.value}` : chip.value;
    case 'prefix':
      return now.startsWith(chip.value) ? now : `${chip.value}${now.replace(/^0+/, '')}`;
    case 'suffix':
      return now.includes('@') ? now.replace(/@.*$/, chip.value) : `${now}${chip.value}`;
    case 'start':
      return now.trim() ? now : chip.value;
    default:
      return chip.value;
  }
}

const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

/**
 * Turns the bar on for this page.
 * providers: { medicineNames(), doctors(), locations(), scan() }
 * onIntent(intent, { el, key, text }): called when "Take me there" is tapped.
 */
export function setupKeyboardBar({ providers = {}, onIntent } = {}) {
  const touch = () => window.matchMedia('(pointer: coarse)').matches;
  let active = null;
  let listening = null;

  const chipsBox = h('div', { class: 'kbar-chips', role: 'group', 'aria-label': 'Quick answers' });
  const keep = (e) => e.preventDefault(); // tapping the bar must not close the keyboard
  const navBtn = (label, aria, onclick) => h('button', { type: 'button', class: 'kbar-btn', 'aria-label': aria, onpointerdown: keep, onmousedown: keep, onclick }, label);
  const micBtn = SpeechRecognition ? navBtn('🎤', 'Speak instead of typing', () => toggleMic()) : null;
  const bar = h('div', { class: 'kbar', role: 'toolbar', 'aria-label': 'Typing shortcuts', hidden: true },
    chipsBox,
    h('div', { class: 'kbar-row' },
      h('div', { class: 'kbar-nav' },
        navBtn('▲ Prev', 'Previous box', () => move(-1)),
        navBtn('▼ Next', 'Next box', () => move(1)),
        micBtn),
      navBtn('Done', 'Close the keyboard', () => active?.blur())));

  function fields(el) {
    const scope = el.closest('form') || el.closest('dialog') || document;
    return [...scope.querySelectorAll('input, textarea, select')].filter((f) =>
      !f.disabled && !f.closest('[hidden]') && f.type !== 'hidden' && f.type !== 'file' && f.type !== 'checkbox' && f.type !== 'radio' && f.offsetParent !== null);
  }

  function move(step) {
    if (!active) return;
    const list = fields(active);
    const next = list[list.indexOf(active) + step];
    if (next) next.focus();
  }

  function setValue(el, value) {
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    if (el.setSelectionRange && /^(text|search|tel|url|email)$/.test(el.type)) {
      try { el.setSelectionRange(value.length, value.length); } catch { /* some types don't allow it */ }
    }
  }

  function renderChips(el) {
    const key = fieldKey(el);
    const chips = chipsFor(key, el, providers);
    chipsBox.replaceChildren(...chips.map((chip) => h('button', {
      type: 'button', class: `kbar-chip${chip.action ? ' kbar-action' : ''}`, onpointerdown: keep, onmousedown: keep,
      onclick: () => {
        if (chip.action) {
          el.blur();
          chip.action();
          return;
        }
        setValue(el, applyChip(el.value, chip));
        checkPlace(el);
      },
    }, chip.label)));
    chipsBox.hidden = !chips.length;
  }

  /** Keeps the bar right above the keyboard and the box being typed in visible. */
  function position() {
    if (bar.hidden) return;
    const vv = window.visualViewport;
    const keyboard = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
    bar.style.bottom = `${keyboard}px`;
    const space = bar.offsetHeight + keyboard;
    document.documentElement.style.setProperty('--kbar-space', `${space}px`);
    if (!active) return;
    const box = active.getBoundingClientRect();
    const barTop = bar.getBoundingClientRect().top;
    if (box.bottom > barTop - 8 || box.top < 0) active.scrollIntoView({ block: 'center' });
  }

  function show(el) {
    active = el;
    const host = el.closest('dialog[open]') || document.body; // a modal hides everything outside it
    if (bar.parentElement !== host) host.append(bar);
    renderChips(el);
    bar.hidden = false;
    document.documentElement.classList.add('kbar-open');
    requestAnimationFrame(position);
    setTimeout(position, 350); // after the keyboard finishes opening
  }

  function hide() {
    active = null;
    bar.hidden = true;
    document.documentElement.classList.remove('kbar-open');
    document.documentElement.style.removeProperty('--kbar-space');
    listening?.stop();
  }

  function toggleMic() {
    if (!active || !SpeechRecognition) return;
    if (listening) {
      listening.stop();
      return;
    }
    const el = active;
    const rec = new SpeechRecognition();
    rec.lang = getLang() === 'hi' ? 'hi-IN' : 'en-IN';
    rec.interimResults = false;
    rec.onresult = (e) => {
      const said = [...e.results].map((r) => r[0].transcript).join(' ').trim();
      if (said) setValue(el, el.value.trim() ? `${el.value.trim()} ${said}` : said);
      checkPlace(el);
    };
    rec.onend = () => {
      listening = null;
      micBtn?.classList.remove('listening');
    };
    listening = rec;
    micBtn?.classList.add('listening');
    try {
      rec.start();
    } catch {
      rec.onend();
    }
  }

  /* ---- wrong tab helper: an in-flow note under the box, never on top of anything */
  let hintTimer;
  function checkPlace(el) {
    if (!onIntent) return;
    const key = fieldKey(el);
    const intent = wrongPlace(key, el.value);
    const holder = el.closest('.field, fieldset, .ai-box') || el;
    let hint = holder.nextElementSibling?.classList.contains('intent-hint') ? holder.nextElementSibling : null;
    if (!intent || el.dataset.intentDismissed === intent) {
      hint?.remove();
      return;
    }
    const label = INTENT_LABEL[intent];
    const fresh = h('div', { class: 'intent-hint', role: 'status' },
      h('span', {}, `💡 ${label.what}`),
      h('button', { type: 'button', class: 'btn btn-sm btn-primary', onclick: () => onIntent(intent, { el, key, text: el.value }) }, `${label.go} →`),
      h('button', {
        type: 'button', class: 'btn btn-sm btn-ghost', 'aria-label': 'Hide this suggestion',
        onclick: () => { el.dataset.intentDismissed = intent; fresh.remove(); },
      }, '✕'));
    if (hint) hint.replaceWith(fresh);
    else holder.after(fresh);
  }

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => checkPlace(el), 450);
  });

  document.addEventListener('focusin', (e) => {
    const el = e.target;
    const typing = (el instanceof HTMLInputElement && TEXTY.has(el.type)) || el instanceof HTMLTextAreaElement;
    if (typing && touch()) show(el);
  });
  document.addEventListener('focusout', () => {
    // Wait a moment: focus may be moving to the next box.
    setTimeout(() => {
      const el = document.activeElement;
      const typing = (el instanceof HTMLInputElement && TEXTY.has(el.type)) || el instanceof HTMLTextAreaElement;
      if (!typing) hide();
    }, 120);
  });
  window.visualViewport?.addEventListener('resize', position);
  window.visualViewport?.addEventListener('scroll', position);
  window.addEventListener('resize', position);

  return { show, hide, checkPlace };
}
