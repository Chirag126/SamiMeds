/* Shared helpers: API calls, safe DOM building, toasts, speech, pill art. */

export class ApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function api(path, { method = 'GET', body, redirectOn401 = true } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: {
      'X-Requested-With': 'SamiMeds',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && redirectOn401) {
    window.location.replace('/');
    throw new ApiError(401, 'Please sign in');
  }
  if (!res.ok) throw new ApiError(res.status, data.error || 'Something went wrong', data);
  return data;
}

/**
 * Builds DOM nodes without innerHTML (no XSS).
 * h('button', { class: 'btn', onclick: fn, 'aria-label': 'x' }, 'Text', child)
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'text') el.textContent = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function mount(el, ...children) {
  el.replaceChildren();
  append(el, children);
}

/* ---------- toasts */
let toastWrap;
export function toast(message, { action, duration = 4000 } = {}) {
  if (!toastWrap) {
    toastWrap = h('div', { class: 'toast-wrap', role: 'status', 'aria-live': 'polite' });
    document.body.append(toastWrap);
  }
  const node = h('div', { class: 'toast' }, h('span', {}, message));
  let timer;
  const close = () => {
    clearTimeout(timer);
    node.remove();
  };
  if (action) {
    node.append(h('button', { class: 'btn btn-sm', type: 'button', onclick: () => { close(); action.run(); } }, action.label));
  }
  toastWrap.append(node);
  timer = setTimeout(close, duration);
  return close;
}

/* ---------- speech (read aloud) */
export function canSpeak() {
  return 'speechSynthesis' in window;
}

export function speak(text, { rate = 0.9 } = {}) {
  if (!canSpeak()) {
    toast('Read aloud is not available on this device');
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate;
  const voices = window.speechSynthesis.getVoices();
  const hindi = document.documentElement.lang === 'hi';
  u.voice = (hindi
    ? voices.find((v) => v.lang === 'hi-IN') || voices.find((v) => v.lang.startsWith('hi'))
    : voices.find((v) => v.lang === 'en-IN') || voices.find((v) => v.lang.startsWith('en'))) || null;
  u.lang = u.voice?.lang || (hindi ? 'hi-IN' : 'en-IN');
  window.speechSynthesis.speak(u);
}

export function buzz(ms = 40) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}

/* ---------- formatting */
export function time12(hhmm) {
  const [hRaw, m] = hhmm.split(':').map(Number);
  const suffix = hRaw >= 12 ? 'PM' : 'AM';
  return `${hRaw % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function relativeDay(dateStr, today) {
  const diff = Math.round((Date.parse(dateStr) - Date.parse(today)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function shortDate(dateStr) {
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function timeAgo(iso) {
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export const MOODS = {
  good: { emoji: '😊', label: 'Good' },
  okay: { emoji: '😐', label: 'Okay' },
  unwell: { emoji: '😟', label: 'Not well' },
};

/* ---------- pill art (SVG, no inline styles so it passes our CSP) */
const SVG_NS = 'http://www.w3.org/2000/svg';
const PILL_COLORS = {
  white: ['#ffffff', '#d9cfc4'], yellow: ['#ffd84d', '#d9a800'], orange: ['#ffa94d', '#d9731a'],
  pink: ['#ff9ec4', '#d9608f'], red: ['#ff6b6b', '#c23b3b'], blue: ['#7cc0ff', '#3b82c4'],
  green: ['#7ddc9a', '#3a9d5c'], purple: ['#c3a3ff', '#7c55c9'], brown: ['#c99a6b', '#8a5f36'],
};

function s(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

export function pillArt(color = 'white', shape = 'round', { size = 72, label = '' } = {}) {
  const [fill, edge] = PILL_COLORS[color] || PILL_COLORS.white;
  const svg = s('svg', { viewBox: '0 0 100 100', width: size, height: size, class: 'pill-art', role: 'img', 'aria-label': label || `${color} ${shape}` });
  svg.append(s('circle', { cx: 50, cy: 50, r: 48, fill: '#fff4e4' }));
  switch (shape) {
    case 'capsule': {
      const g = s('g', { transform: 'rotate(-35 50 50)' });
      g.append(
        s('rect', { x: 18, y: 36, width: 64, height: 28, rx: 14, fill, stroke: edge, 'stroke-width': 3 }),
        s('path', { d: 'M50 36 h18 a14 14 0 0 1 0 28 h-18 z', fill: '#ffffff', stroke: edge, 'stroke-width': 3 }),
        s('rect', { x: 26, y: 41, width: 18, height: 5, rx: 2.5, fill: '#ffffff', opacity: 0.6 }),
      );
      svg.append(g);
      break;
    }
    case 'oval':
      svg.append(
        s('ellipse', { cx: 50, cy: 50, rx: 32, ry: 21, fill, stroke: edge, 'stroke-width': 3 }),
        s('line', { x1: 50, y1: 32, x2: 50, y2: 68, stroke: edge, 'stroke-width': 2.5 }),
      );
      break;
    case 'drops':
    case 'liquid':
      svg.append(
        s('path', { d: 'M50 16 C 64 36 74 48 74 62 a24 24 0 0 1 -48 0 C26 48 36 36 50 16 z', fill, stroke: edge, 'stroke-width': 3 }),
        s('ellipse', { cx: 42, cy: 60, rx: 5, ry: 9, fill: '#ffffff', opacity: 0.65 }),
      );
      break;
    case 'injection':
      svg.append(
        s('rect', { x: 30, y: 40, width: 40, height: 20, rx: 4, fill, stroke: edge, 'stroke-width': 3 }),
        s('rect', { x: 70, y: 46, width: 16, height: 8, fill: edge }),
        s('line', { x1: 14, y1: 50, x2: 30, y2: 50, stroke: edge, 'stroke-width': 4 }),
      );
      break;
    case 'inhaler':
      svg.append(
        s('rect', { x: 36, y: 18, width: 26, height: 46, rx: 8, fill, stroke: edge, 'stroke-width': 3 }),
        s('rect', { x: 30, y: 60, width: 40, height: 20, rx: 6, fill: '#ffffff', stroke: edge, 'stroke-width': 3 }),
      );
      break;
    default:
      svg.append(
        s('circle', { cx: 50, cy: 50, r: 27, fill, stroke: edge, 'stroke-width': 3 }),
        s('line', { x1: 30, y1: 50, x2: 70, y2: 50, stroke: edge, 'stroke-width': 2.5 }),
        s('ellipse', { cx: 41, cy: 40, rx: 7, ry: 4, fill: '#ffffff', opacity: 0.7 }),
      );
  }
  return svg;
}

/** Photo if the family uploaded one, otherwise the drawn pill. */
export function medicineVisual(med, size = 72) {
  if (med?.hasPhoto) {
    return h('img', {
      class: 'pill-photo', src: `/api/medicines/${encodeURIComponent(med.id)}/photo?v=${med.photoVersion || 1}`,
      alt: `Photo of ${med.name}`, width: size, height: size, loading: 'lazy',
    });
  }
  return pillArt(med?.color, med?.shape, { size, label: `${med?.color || ''} ${med?.shape || 'pill'} – ${med?.name || ''}` });
}

/** Accessible tab list: arrow keys, Home/End, aria-selected, hash sync. */
export function setupTabs(tablist, { onChange, useHash = true } = {}) {
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  const select = (tab, focus = false) => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    }
    if (focus) tab.focus();
    if (useHash) history.replaceState(null, '', `#${tab.dataset.tab}`);
    onChange?.(tab.dataset.tab);
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => { buzz(15); select(t); });
    t.addEventListener('keydown', (e) => {
      const map = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: tabs.length - 1 };
      if (!(e.key in map)) return;
      e.preventDefault();
      select(tabs[(map[e.key] + tabs.length) % tabs.length], true);
    });
  });
  const initial = tabs.find((t) => useHash && `#${t.dataset.tab}` === location.hash) || tabs[0];
  select(initial);
  return { select: (name) => select(tabs.find((t) => t.dataset.tab === name) || tabs[0]) };
}

export function registerServiceWorker() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

/** Resizes an image file to a small JPEG data URL (keeps uploads light on mobile data). */
export function resizeImage(file, max = 480, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Please choose a photo'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that photo'));
    };
    img.src = url;
  });
}

/* ---------- live sync: refresh when anyone in the circle changes something */
export function liveSync(onChange) {
  if (!('EventSource' in window)) return null;
  let timer;
  const source = new EventSource('/api/events');
  source.addEventListener('change', () => {
    clearTimeout(timer);
    timer = setTimeout(onChange, 250); // several quick changes → one refresh
  });
  return source;
}

/* ---------- phone notifications (Web Push) */
const b64ToBytes = (b64) => Uint8Array.from(atob(b64.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

/** 'unsupported' | 'unavailable' (server has no keys) | 'denied' | 'on' | 'off' */
export async function pushStatus() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  const { enabled } = await api('/api/push/key').catch(() => ({ enabled: false }));
  if (!enabled) return 'unavailable';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

export async function enablePush() {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications were not allowed. You can allow them in your browser settings.');
  const { publicKey } = await api('/api/push/key');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) }));
  await api('/api/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON() } });
  await api('/api/push/test', { method: 'POST', body: {} });
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await api('/api/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } }).catch(() => {});
  await sub.unsubscribe();
}

/**
 * A small settings card to turn phone notifications on or off.
 * `rerender` is called after a change so the card shows the new state.
 */
export function pushCard(status, rerender) {
  const messages = {
    unsupported: 'This browser cannot show notifications. On iPhone, first add SamiMeds to the Home Screen.',
    unavailable: 'Notifications are not set up on this server yet.',
    denied: 'Notifications are blocked. Allow them in your browser settings to turn this on.',
    on: 'Reminders will pop up on this phone, even when SamiMeds is closed.',
    off: 'Get reminders on this phone, even when SamiMeds is closed.',
  };
  const run = async (fn, done) => {
    try {
      await fn();
      toast(done);
    } catch (err) {
      toast(err.message);
    }
    rerender();
  };
  return h('section', { class: 'setting push-card' },
    h('h3', {}, '🔔 Notifications on this phone'),
    h('p', {}, messages[status] || messages.off),
    status === 'off' && h('button', { class: 'btn btn-primary', type: 'button', onclick: () => run(enablePush, 'Notifications are on 🔔') }, '🔔 Turn on notifications'),
    status === 'on' && h('div', { class: 'row-btns' },
      h('button', { class: 'btn', type: 'button', onclick: () => run(() => api('/api/push/test', { method: 'POST', body: {} }), 'Test sent – check your notifications') }, 'Send a test'),
      h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => run(disablePush, 'Notifications are off') }, 'Turn off')));
}

/** Opens the camera (or photo picker) and returns a small JPEG data URL, or null if cancelled. */
export function pickPhoto({ capture = 'environment', max = 640, quality = 0.8 } = {}) {
  return new Promise((resolve, reject) => {
    const input = h('input', { type: 'file', accept: 'image/*', capture, hidden: true });
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return resolve(null);
      resizeImage(file, max, quality).then(resolve, reject);
    });
    input.addEventListener('cancel', () => { input.remove(); resolve(null); });
    document.body.append(input);
    input.click();
  });
}
