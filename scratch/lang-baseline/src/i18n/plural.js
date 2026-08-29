/**
 * Grammatical number — for the languages that actually have it.
 *
 * English and Spanish get away with two forms. Polish does not: a noun after a
 * numeral takes the nominative plural for 2–4 and the genitive plural from 5
 * up, and the verb changes with it. "Ubyło 8 ton" is right; "ubyło 3 ton" is
 * the kind of mistake that tells a Polish fourteen-year-old, in the first
 * sentence they read, that nobody who speaks their language looked at this.
 *
 * So a bundle string may carry inline alternants:
 *
 *   'Przy ostatnim zrzucie «b|few:ubyły|many:ubyło» z ładowni {b} «b|few:tony|many:ton».'
 *
 * `«count|category:text|category:text»` picks a branch with `Intl.PluralRules`
 * for the active locale. `#` inside a branch prints the count. Categories that
 * a locale never selects are simply never reached, so the same key can carry
 * Polish's five and English's two without either language paying for the other.
 *
 * The alternants deliberately use no braces: the content pipeline checks that
 * every locale of a key interpolates exactly the same `{placeholders}`, and
 * this must not disturb that check.
 */

const CACHE = new Map();

function rulesFor(locale) {
  let r = CACHE.get(locale);
  if (r === undefined) {
    try { r = new Intl.PluralRules(locale); } catch { r = null; }
    CACHE.set(locale, r);
  }
  return r;
}

/**
 * Where to look when the branch a locale asked for was not written. Falling
 * back to `other` first is right for every language here; the longer chains
 * exist so a half-written Polish string degrades to a real word rather than to
 * the raw source.
 */
const FALLBACK = {
  zero: ['zero', 'many', 'other', 'few', 'one'],
  one: ['one', 'other', 'few', 'many'],
  two: ['two', 'few', 'other', 'many'],
  few: ['few', 'many', 'other', 'one'],
  many: ['many', 'few', 'other', 'one'],
  other: ['other', 'many', 'few', 'one'],
};

const NUM = new Map();
function fmt(n, locale) {
  let f = NUM.get(locale);
  if (!f) { try { f = new Intl.NumberFormat(locale); } catch { f = null; } NUM.set(locale, f); }
  return f ? f.format(n) : String(n);
}

/**
 * Expand every `«…»` alternant in `str` against `params` for `locale`.
 * Strings without alternants are returned untouched and uncopied.
 */
export function plural(str, params, locale = 'en') {
  const s = String(str);
  if (s.indexOf('«') < 0) return s;
  return s.replace(/«([^»]*)»/g, (whole, body) => {
    const parts = body.split('|');
    const name = parts.shift().trim();
    const raw = params ? params[name] : undefined;
    const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(/[^\d.-]/g, ''));
    const branches = new Map();
    for (const p of parts) {
      const at = p.indexOf(':');
      if (at < 0) continue;
      branches.set(p.slice(0, at).trim(), p.slice(at + 1));
    }
    if (!branches.size) return whole;

    const rules = rulesFor(locale);
    let cat = 'other';
    if (Number.isFinite(n) && rules) cat = rules.select(n);
    else if (Number.isFinite(n)) cat = n === 1 ? 'one' : 'other';

    let chosen;
    for (const key of FALLBACK[cat] || ['other']) {
      if (branches.has(key)) { chosen = branches.get(key); break; }
    }
    if (chosen === undefined) chosen = branches.values().next().value;
    return chosen.replace(/#/g, Number.isFinite(n) ? fmt(n, locale) : '');
  });
}

export default plural;
