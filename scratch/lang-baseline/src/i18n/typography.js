/**
 * Typography that is part of the language, not part of the theme.
 *
 * Spanish and Polish both hold a rule English does not: a one-letter word may
 * not be left hanging at the end of a line. Polish typesetting treats "i", "w",
 * "z", "o", "a", "u" as bound to the word that follows; Spanish does the same
 * with "y", "o", "e", "u", "a". A line that ends on a lone "w" is the visual
 * equivalent of a spelling mistake — it is the first thing a Polish reader
 * notices and the last thing a translation memory ever fixes.
 *
 * The same pass keeps a number glued to its unit ("8 t", "13 kr.", "30 %"),
 * which every one of these languages wants and which matters here because the
 * numbers are generated and the panel is narrow.
 *
 * Mathematics is left strictly alone. Prose in this game carries inline
 * notation between `$…$` or backticks, and that notation goes to strict KaTeX,
 * where a no-break space is a hard error. Those spans are cut out before
 * anything is touched and put back afterwards.
 */

const NB = ' ';

// One-letter words that must not end a line, per locale.
const ORPHANS = {
  pl: 'aiouwzAIOUWZ',
  es: 'yoaeuYOAEU',
};

// Units that must stay with the number in front of them.
const UNITS = {
  pl: ['t', 'kr.', 'kg', 'm', 'km', 'h', '%'],
  es: ['t', 'kg', 'm', 'km', 'h', '%'],
  en: ['t', 'kg', 'm', 'km', 'h', '%'],
};

/**
 * The interrupting dash, per language.
 *
 * English sets it as an em dash. Polish does not: the parenthetical dash is the
 * *półpauza* — an en dash — set with spaces, and an em dash in Polish prose
 * reads as an untranslated English one. It is also the one mark that must not
 * open a line, so it is bound to the word in front of it and the break is
 * allowed to fall after it instead.
 *
 * Spanish is deliberately left alone. The RAE's raya is an em dash and is
 * correct here; its spacing rule depends on whether the dash opens an inciso or
 * separates a title, which is a distinction no regular expression can make.
 */
const DASH = {
  pl: [/ +[—–] +/g, `${NB}– `],
};

const CACHE = new Map();

function passFor(locale) {
  if (CACHE.has(locale)) return CACHE.get(locale);
  const letters = ORPHANS[locale];
  const units = UNITS[locale] || UNITS.en;
  const orphan = letters
    ? new RegExp(`(^|[\\s(\\[„«"'—–-])([${letters}]) +`, 'g')
    : null;
  const unit = new RegExp(`(\\d) +(${units.map((u) => u.replace('.', '\\.')).join('|')})(?![\\w])`, 'g');
  const dash = DASH[locale];
  const fn = (s) => {
    let out = s;
    if (dash) out = out.replace(dash[0], dash[1]);
    if (orphan) out = out.replace(orphan, `$1$2${NB}`);
    return out.replace(unit, `$1${NB}$2`);
  };
  CACHE.set(locale, fn);
  return fn;
}

// KaTeX renders each run inside an inline-block, and a browser will happily
// break the line straight after one — stranding the comma that follows "$k$"
// at the head of the next line, which is a typographic error in every language
// and unmissable in a narrow panel. A word joiner does not stop it: the break
// comes from the box, not from the text. So the punctuation is moved inside the
// maths instead, braced so TeX gives it no spacing of its own; "k{,}" sets
// exactly as "k," and cannot be split.
const PULL_IN = { ',': '{,}', '.': '{.}', ';': '{;}', ':': '{:}' };
// Anything not safe to move into maths still gets a joiner, which is enough
// where the neighbour is ordinary text.
const JOIN = '⁠';
const AFTER = /[)\]}»”’…%!?]/;          // may not start a line
const BEFORE = /[(\[{«„“‘¿¡]/;          // may not end one

/**
 * Apply the locale's spacing rules to prose, leaving every `$…$` and
 * `` `…` `` span exactly as it was.
 */
export function typeset(str, locale = 'en') {
  const src = String(str ?? '');
  if (!src) return src;
  const pass = passFor(locale);
  if (src.indexOf('$') < 0 && src.indexOf('`') < 0) return pass(src);

  let out = '';
  let i = 0;
  let plain = '';
  while (i < src.length) {
    const ch = src[i];
    if (ch === '$' || ch === '`') {
      const end = src.indexOf(ch, i + 1);
      if (end > i + 1) {
        // an opening bracket or quote must not be left behind on the old line
        if (BEFORE.test(plain[plain.length - 1] || '')) plain += JOIN;
        const body = src.slice(i + 1, end);
        const next = src[end + 1] || '';
        const pulled = PULL_IN[next];
        // Only pull punctuation in where the span really is mathematics: a
        // trailing backslash or an open group would swallow the brace.
        if (pulled && !/\\[a-zA-Z]*$/.test(body)) {
          out += pass(plain) + ch + body + pulled + ch;
          plain = '';
          i = end + 2;
          continue;
        }
        out += pass(plain) + src.slice(i, end + 1);
        if (AFTER.test(next)) out += JOIN;
        plain = '';
        i = end + 1;
        continue;
      }
    }
    plain += ch;
    i++;
  }
  return out + pass(plain);
}

export default typeset;
