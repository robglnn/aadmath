import en from '../../content/lang/items.en.js';
import es from '../../content/lang/items.es.js';
import pl from '../../content/lang/items.pl.js';
// Grammatical number and the locale's own spacing rules. Item prose is
// generated around numbers that change every draw, and Polish inflects the
// noun after them; both passes are pure string work owned by src/i18n.
import { plural } from '../i18n/plural.js';
import { typeset } from '../i18n/typography.js';

export const ITEM_BUNDLES = { en, es, pl };
export const ITEM_LOCALES = Object.keys(ITEM_BUNDLES);

/**
 * Item prose is separated from the mathematics on purpose.
 *
 * `item.latex` carries only notation — numerals, letters, operators — so it is
 * identical in every language and can be verified by machine. Everything a
 * learner *reads* (the situation, the question, the reason attached to each
 * worked line) comes from here, and exists in full in EN, ES and PL.
 */
export function makeT(locale, { strict = false } = {}) {
  const b = ITEM_BUNDLES[locale] || en;
  return function T(key, params) {
    let s = b[key];
    if (s == null) {
      if (strict) throw new Error(`missing item string "${key}" for locale "${locale}"`);
      s = en[key] ?? key;
    }
    if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
    return typeset(plural(s, params, locale), locale);
  };
}
