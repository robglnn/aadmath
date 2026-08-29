import en from './en.js';
import es from './es.js';
import pl from './pl.js';
import { plural } from './plural.js';
import { typeset } from './typography.js';

const BUNDLES = { en, es, pl };
export const LOCALES = ['en', 'es', 'pl'];
export const LOCALE_NAMES = { en: 'English', es: 'Español', pl: 'Polski' };
/** What each language calls itself in a switcher, said in that language. */
export const LOCALE_SWITCH = {
  en: { short: 'EN', name: 'English', title: 'Play in English' },
  es: { short: 'ES', name: 'Español', title: 'Jugar en español' },
  pl: { short: 'PL', name: 'Polski', title: 'Graj po polsku' },
};

let current = 'en';
const listeners = new Set();

function detect() {
  let saved = null;
  try { saved = localStorage.getItem('ascent.locale'); } catch { saved = null; }
  if (saved && BUNDLES[saved]) return saved;
  const nav = (navigator.languages || [navigator.language || 'en']).map((l) => l.slice(0, 2));
  return nav.find((l) => BUNDLES[l]) || 'en';
}

export function initI18n() {
  current = detect();
  applyDocument();
  return current;
}

export function getLocale() {
  return current;
}

export function setLocale(loc) {
  if (!BUNDLES[loc] || loc === current) return;
  current = loc;
  try { localStorage.setItem('ascent.locale', loc); } catch { /* private mode */ }
  applyDocument();
  listeners.forEach((fn) => fn(loc));
  applyStatic();
}

export function onLocaleChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * The parts of the page that live outside the game's own DOM: the tab title,
 * the language of the document (which decides hyphenation and how a screen
 * reader pronounces every word on screen), and the description a share card
 * reads. Getting `lang` wrong makes a Polish sentence come out of a synthetic
 * English mouth, which is worse than no localisation at all.
 */
function applyDocument() {
  document.documentElement.lang = current;
  document.title = t('meta.title');
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute('content', t('meta.description'));
}

/**
 * Translate a dotted key. Missing keys fall back to English, then to the key
 * itself — never to an empty string, so a gap is visible rather than silent.
 *
 * `params` interpolates `{name}` placeholders; `«n|few:…|many:…»` alternants
 * are resolved against the same params for the active locale; and the result
 * is passed through the locale's own spacing rules before it reaches the DOM.
 */
export function t(key, params) {
  const val = lookup(BUNDLES[current], key) ?? lookup(BUNDLES.en, key) ?? key;
  // A key may hold a bank of alternative lines — the companion says one of
  // several things when you slip. Every line is localised; the caller picks.
  if (Array.isArray(val)) return val.map((s) => render(s, params));
  return render(val, params);
}

function render(raw, params) {
  if (typeof raw !== 'string') return raw;
  let out = params ? raw.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m)) : raw;
  out = plural(out, params, current);
  return typeset(out, current);
}

/** The same lookup with no typography, for places that need the raw source. */
export function raw(key) {
  return lookup(BUNDLES[current], key) ?? lookup(BUNDLES.en, key) ?? key;
}

/** True when the active locale defines this key in its own right. */
export function has(key) {
  return lookup(BUNDLES[current], key) !== undefined;
}

function lookup(bundle, key) {
  if (!bundle) return undefined;
  return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), bundle);
}

/** Fills every [data-i18n] element in the document. */
export function applyStatic(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
  });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
  });
}

/** Locale-correct number formatting — group separators differ across es/pl. */
export function num(n) {
  return new Intl.NumberFormat(current).format(n);
}

export function pct(x) {
  return new Intl.NumberFormat(current, { style: 'percent', maximumFractionDigits: 0 }).format(x);
}

/**
 * An arithmetic operator in the notation this reader was actually taught.
 *
 * Notation is not universal, and the two operators a first algebra course leans
 * on hardest are exactly the two that differ. A Polish fourteen-year-old has
 * never met `÷` in a lesson: division is written with a colon, `12 : 4`, from
 * the first year of school to the last. Spain teaches the colon too, and sets
 * multiplication with a raised dot rather than a cross. Printing `÷` at them is
 * the notational equivalent of printing an English sentence — it is legible,
 * and it says this game was made for somebody else.
 *
 * The colon is wrapped in `\mathbin` so TeX spaces it as an operator and not as
 * a relation; `x\mathbin{:}2` sets exactly like `x \div 2` and unlike `x : 2`.
 *
 * Returns strict-KaTeX source, so it composes with the generated notation
 * rather than sitting beside it as a glyph.
 */
const OPS = {
  div: { en: '\\div', es: '\\mathbin{:}', pl: '\\mathbin{:}' },
  times: { en: '\\times', es: '\\cdot', pl: '\\cdot' },
};
export function mathOp(op, locale = current) {
  const row = OPS[op];
  return (row && (row[locale] ?? row.en)) || '';
}

/**
 * A number for strict KaTeX, in the locale's own decimal mark.
 *
 * Every value this game asks for is an integer or an exact fraction, so this is
 * rarely reached — but the moment a decimal does appear, "0.5" is simply wrong
 * in Spanish and Polish, and it has to be wrong nowhere.
 */
export function numTex(n) {
  const s = num(n);
  const mark = new Intl.NumberFormat(current)
    .formatToParts(1.5).find((p) => p.type === 'decimal')?.value || '.';
  if (mark === '.') return s.replace(/ | /g, '\\,');
  // A comma is a punctuation atom in TeX and takes a space after it; the
  // decimal comma must not, or "3,5" is set as "3, 5".
  return s.replace(/ | /g, '\\,').replace(mark, '{,}');
}

export { plural, typeset };
