/**
 * Language switch (English ⇄ हिंदी) for every screen.
 *
 * The screens are written in English. When Hindi is chosen, this module translates
 * text as it appears on the page (and keeps translating as the page updates),
 * using the exact phrases and patterns below. Anything the family typed themselves
 * (medicine names, notes) is left as written.
 */
import { EXACT, PATTERNS } from './i18n-hi.js';

const KEY = 'sm_lang';
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT']);
const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];

export function getLang() {
  try {
    return localStorage.getItem(KEY) === 'hi' ? 'hi' : 'en';
  } catch {
    return 'en';
  }
}

export function setLang(lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch { /* private mode */ }
  window.location.reload();
}

/** Turns 'In {n} min' into a regular expression with one capture group per {name}. */
function compile(template) {
  const names = [];
  const source = template
    .replace(/[.*+?^$()|[\]\\]/g, '\\$&')
    .replace(/\{(\w+)\}/g, (_, name) => {
      names.push(name);
      return '(.+?)';
    });
  return { regex: new RegExp(`^${source}$`, 's'), names };
}

// Most specific patterns (most fixed text) are tried first.
const fixedLength = (template) => template.replace(/\{\w+\}/g, '').length;
const compiled = [...PATTERNS]
  .sort((a, b) => fixedLength(b[0]) - fixedLength(a[0]))
  .map(([en, hi]) => ({ ...compile(en), hi }));

/** Translates one phrase to Hindi. Returns the input when there is no translation. */
export function toHindi(text) {
  if (!text) return text;
  if (text in EXACT) return EXACT[text];
  for (const { regex, names, hi } of compiled) {
    const match = regex.exec(text);
    if (!match) continue;
    // Captured pieces (e.g. "Tomorrow") are translated too when they are known phrases.
    const out = hi.replace(/\{(\w+)\}/g, (_, name) => toHindi(match[names.indexOf(name) + 1]));
    if (out !== text) return out; // otherwise a later, more specific pattern may fit
  }
  return text;
}

/** Translates a phrase for the current language (used for speech and messages). */
export const tr = (text) => (getLang() === 'hi' ? toHindi(text) : text);

function translateTextNode(node) {
  const raw = node.nodeValue || '';
  const core = raw.trim();
  if (!core) return;
  const out = toHindi(core);
  if (out !== core) node.nodeValue = raw.replace(core, out);
}

function translateElement(el) {
  for (const attr of ATTRS) {
    const value = el.getAttribute?.(attr);
    if (value) {
      const out = toHindi(value);
      if (out !== value) el.setAttribute(attr, out);
    }
  }
}

function translateTree(root) {
  if (root.nodeType === Node.TEXT_NODE) {
    if (!SKIP.has(root.parentElement?.tagName) && !root.parentElement?.closest('[data-no-i18n]')) translateTextNode(root);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE || root.closest?.('[data-no-i18n]')) return;
  translateElement(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!SKIP.has(node.parentElement?.tagName) && !node.parentElement?.closest('[data-no-i18n]')) translateTextNode(node);
    } else {
      translateElement(node);
    }
  }
}

/** Call once per page. Does nothing in English. */
export function startI18n() {
  const lang = getLang();
  document.documentElement.lang = lang === 'hi' ? 'hi' : 'en';
  if (lang !== 'hi') return;
  translateTree(document.body);
  if (document.title) document.title = document.title.split(' – ').map(toHindi).join(' – ');
  new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'characterData') translateTree(m.target);
      else if (m.type === 'attributes') translateElement(m.target);
      else m.addedNodes.forEach(translateTree);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

/** A button that switches language. `compact` gives the small round version for the elder's screen. */
export function langButton({ compact = false, className = '' } = {}) {
  const hindi = getLang() === 'hi';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.dataset.noI18n = '';
  btn.lang = hindi ? 'en' : 'hi';
  btn.textContent = compact ? (hindi ? 'EN' : 'हिं') : (hindi ? '🌐 English' : '🌐 हिंदी');
  btn.setAttribute('aria-label', hindi ? 'Switch to English' : 'हिंदी में बदलें');
  btn.addEventListener('click', () => setLang(hindi ? 'en' : 'hi'));
  return btn;
}
