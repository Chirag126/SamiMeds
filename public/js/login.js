import { api, setupTabs, buzz, registerServiceWorker } from './common.js';
import { startI18n, langButton } from './i18n.js';
import { setupKeyboardBar } from './kbar.js';

const $ = (id) => document.getElementById(id);
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* private mode */ } },
};

const home = (role) => (role === 'elderly' ? '/elder' : '/family');

async function init() {
  registerServiceWorker();
  startI18n();
  setupKeyboardBar();
  $('lang-slot').append(langButton({ className: 'btn btn-sm' }));

  // Already signed in? Go straight in.
  try {
    const me = await api('/api/me', { redirectOn401: false });
    window.location.replace(home(me.member.role));
    return;
  } catch { /* not signed in */ }

  setupTabs(document.querySelector('.seg'), { useHash: false });
  setupSignin();
  setupSetup();

  const cfg = await api('/api/config').catch(() => ({}));
  if (cfg.demo) {
    $('demo-box').hidden = false;
    document.querySelectorAll('.person').forEach((b) =>
      b.addEventListener('click', () => {
        $('code').value = 'DEMO';
        $('pin').value = b.dataset.pin;
        updateDots();
        $('signin-form').requestSubmit();
      }));
  }
}

/* ---------------- sign in */

function updateDots() {
  const len = $('pin').value.length;
  [...$('pin-dots').children].forEach((dot, i) => {
    dot.classList.toggle('on', i < len);
    dot.classList.toggle('extra', i >= 4 && i >= len);
  });
}

function showKnownCircle() {
  const code = store.get('sm_code');
  const name = store.get('sm_name');
  const known = Boolean(code);
  $('code-known').hidden = !known;
  $('code-field').hidden = known;
  if (known) {
    $('code').value = code;
    $('welcome-name').textContent = name ? `${name}'s circle` : `Circle ${code}`;
  }
}

function setupSignin() {
  const pin = $('pin');
  showKnownCircle();
  $('change-code').addEventListener('click', () => {
    store.del('sm_code');
    store.del('sm_name');
    $('code').value = '';
    showKnownCircle();
    $('code').focus();
  });

  pin.addEventListener('input', () => {
    pin.value = pin.value.replace(/\D/g, '').slice(0, 6);
    updateDots();
  });

  document.querySelector('.keypad').addEventListener('click', (e) => {
    const key = e.target.closest('button')?.dataset.key;
    if (!key) return;
    buzz(12);
    if (key === 'back') pin.value = pin.value.slice(0, -1);
    else if (pin.value.length < 6) pin.value += key;
    updateDots();
  });

  $('signin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('signin-error');
    err.textContent = '';
    const code = $('code').value.trim().toUpperCase();
    if (!code) { err.textContent = 'Please enter your care circle code.'; $('code').focus(); return; }
    if (pin.value.length < 4) { err.textContent = 'Your PIN has 4 to 6 numbers.'; return; }
    try {
      const res = await api('/api/auth/login', { method: 'POST', body: { code, pin: pin.value, remember: $('remember').checked }, redirectOn401: false });
      if ($('remember').checked) {
        store.set('sm_code', res.circle.code);
        store.set('sm_name', res.circle.elderName);
      }
      buzz(30);
      window.location.replace(home(res.member.role));
    } catch (ex) {
      err.textContent = ex.message;
      pin.value = '';
      updateDots();
      const pad = document.querySelector('.keypad');
      pad.classList.remove('shake');
      void pad.offsetWidth;
      pad.classList.add('shake');
      buzz([60, 40, 60]);
    }
  });
  updateDots();
}

/* ---------------- setup */

const TIMEZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Australia/Sydney', 'UTC'];

function setupSetup() {
  const tz = $('tz');
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
  for (const z of [...new Set([local, ...TIMEZONES])]) {
    const o = document.createElement('option');
    o.value = z;
    o.textContent = z.replace('_', ' ');
    tz.append(o);
  }
  tz.value = local;

  $('setup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const err = $('setup-error');
    err.textContent = '';
    const data = Object.fromEntries(new FormData(form));
    try {
      const res = await api('/api/circles', { method: 'POST', body: data, redirectOn401: false });
      store.set('sm_code', res.code);
      store.set('sm_name', res.circle.elderName);
      form.hidden = true;
      $('done-code').textContent = res.code;
      $('done-name').textContent = res.circle.elderName;
      $('setup-done').hidden = false;
      $('setup-done').focus();
    } catch (ex) {
      err.textContent = ex.message;
    }
  });
}

init();
