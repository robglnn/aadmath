/**
 * EVERY SORTING BOARD THE ROUTE ACTUALLY DRAWS, cut out of the shipped file.
 *
 * The boards are not rebuilt here and no rule of `_sort`'s is restated. The
 * real routing chain and the real pure prefix of `_sort` are executed through
 * `tools/critic/riftsurfaces.mjs`, so which cards reach the sorter, which order
 * the chips lie in and which order the BAYS lie in are all decided by
 * `src/ui/rift.js` as it stands on disk. A change to that file is what runs
 * here on the next build.
 *
 * The bay headers are the strings a learner reads, taken from `src/i18n` in the
 * locale the card was drawn in — not the machine key — because a rule like "the
 * chip with no letter goes in the bay with the longest header" is a rule about
 * what is printed, and `PURE NUMBERS`, `NÚMEROS PUROS` and `CZYSTE LICZBY` are
 * not the same length as each other or as the empty string.
 */
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { generate, SKILLS, FORMS_BY_SKILL } from '../../src/learn/generators.js';
import en from '../../src/i18n/en.js';
import es from '../../src/i18n/es.js';
import pl from '../../src/i18n/pl.js';
import { typeset } from '../../src/i18n/typography.js';
import { allUnits, loadUnit, routeUnits, ROOT } from '../_courses.mjs';
import { realSurfaces } from './riftsurfaces.mjs';

export const LOCALES = ['en', 'es', 'pl'];

const BUNDLES = { en, es, pl };
/**
 * The header a bay prints, in the locale the card was drawn in.
 *
 * The bundle is read directly rather than through `setLocale`, which writes to
 * `document` and there is no document here. Everything else is what `t` does:
 * the `{v}` slot filled, the locale's own spacing rule applied, and the
 * backticks — which mark the span `texProse` hands to KaTeX — taken off, so
 * what is left is the glyphs a learner reads off the bay.
 */
export function headerOf(part, locale) {
  const b = BUNDLES[locale] || en;
  const raw = part ? b.rift.sort.vars : b.rift.sort.nums;
  const filled = String(raw).replace(/\{(\w+)\}/g, (m, k) => (k === 'v' ? part : m));
  return typeset(filled, locale).replace(/`/g, '');
}

/**
 * @param {number} seeds how many seeds per band
 * @returns {Promise<{route:object[], preview:object[], forms:Map<string,number>}>}
 */
export async function routeBoards(seeds = 12) {
  for (const { unit } of await allUnits()) await loadUnit(unit);
  const { road } = await routeUnits();
  const onRoute = new Set(road.map((u) => u.id));
  const surf = await realSurfaces();
  const unitOf = new Map();
  for (const { unit } of await allUnits()) {
    const g = JSON.parse(await readFile(path.join(ROOT, 'content', unit.graph), 'utf8'));
    for (const n of g.nodes) unitOf.set(n.id, unit.id);
  }
  const route = [], preview = [], forms = new Map();
  for (const skill of SKILLS) {
    const where = onRoute.has(unitOf.get(skill)) ? route : preview;
    for (const form of FORMS_BY_SKILL[skill] || []) {
      for (let d = form.dMin; d <= form.dMax; d++) {
        for (let s = 0; s < seeds; s++) {
          const seed = s * 7919 + d * 131;
          for (const loc of LOCALES) {
            let it;
            try { it = generate(skill, d, seed, { locale: loc, form: form.id, strict: true, record: false }); }
            catch { continue; }
            if (!it) continue;
            let r;
            try { r = surf.route(it, seed); } catch { continue; }
            if (r.name !== 'sort') continue;
            const { chipOrder, bayOrder } = r.chips;
            const bays = bayOrder.map((p) => headerOf(p, loc));
            where.push({
              chips: chipOrder.map((x) => (x.part ? (x.c === 1 ? x.part : x.c === -1 ? `-${x.part}` : `${x.c}${x.part}`) : String(x.c))),
              truth: chipOrder.map((x) => bayOrder.indexOf(x.part)),
              bays,
              parts: bayOrder.slice(),
              // THE CARD, not the row. The same card is drawn once per locale
              // and its mathematics does not change, so the three copies carry
              // the same chips in the same order into the same bays. Counting
              // them as three boards trebles every chi-square and lets a copy
              // of a fitted card land in the held-out half. See `playSorter`.
              card: `${skill}|${form.id}|${d}|${seed}`,
              where: `${skill}/${form.id}`,
            });
            if (where === route) forms.set(`${skill}/${form.id}`, (forms.get(`${skill}/${form.id}`) || 0) + 1);
          }
        }
      }
    }
  }
  return { route, preview, forms };
}
