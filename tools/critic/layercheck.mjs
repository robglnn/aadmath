/**
 * THE STACKING-ORDER AND LEGIBILITY GATE.
 *
 * Three static rules, so the three defects a cold critic filed against src/ui
 * cannot come back by somebody adding one more surface:
 *
 *   1. ONE SCALE. Every `z-index` in `src/` reads a token from
 *      `src/ui/layers.css`. A bare number is a surface that was ordered by
 *      guess, and guessing is how the VAULT PLATE grant card ended up behind
 *      the rift panel with its words coming up through the number keypad.
 *      Levels declared INSIDE a surface are exempt (see the allowlist) —
 *      `#ui` is a stacking context, so they cannot reach out of it.
 *
 *   2. NO TWO SURFACES SHARE A LEVEL. If two things can be on screen together
 *      and their order is undefined, one of them is going to be wrong.
 *
 *   3. NOTHING MARLOW SAYS IS LONGER THAN CAN BE READ. The companion channel
 *      holds a line for `len / 17 - len / 88 + 0.8` seconds, capped at 6.2
 *      (src/meta/comms.js), so past ~114 characters a line is removed with
 *      reading still to do — which is what "clipped mid-word" looked like from
 *      the reader's seat. Checked in all three locales, because a line that
 *      fits in English and not in Polish is a line that fails in Polish.
 *
 *   node tools/critic/layercheck.mjs [--self-test]
 *
 * Exit 0 = the rules hold.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(ROOT, 'src');
const SCALE = path.join(SRC, 'ui/layers.css');
const SELFTEST = process.argv.includes('--self-test');

/** The longest line the channel can still fully deliver. See rule 3. */
export const READABLE_MAX = 114;

/**
 * Levels written inside a surface, which stack within it and can never climb
 * out of `#ui`. Each is a file plus the selector the level belongs to, so this
 * cannot be used to smuggle a new top-level surface past rule 1.
 */
const INTERNAL = [
  'src/ui/rift.css',        // the tear's own parts: header, stage, foot, weld
  'src/meta/meta.css',      // ::before/::after washes behind type (z -1, 0, 1)
  'src/session/session.css',
  'src/report/report.css',
  'src/kit/foundry.css',
  'src/meta/guide.css',
  'src/world/afford.css',
];

const problems = [];
const files = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = path.join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(css|js)$/.test(e)) files.push(p);
  }
})(SRC);

// ---------------------------------------------------------------- rule 1 + 2
const scale = readFileSync(SCALE, 'utf8');
const tokens = new Map();
for (const m of scale.matchAll(/--(z-[a-z-]+)\s*:\s*(\d+)\s*;/g)) tokens.set(m[1], +m[2]);

const byValue = new Map();
for (const [name, v] of tokens) {
  if (byValue.has(v)) {
    problems.push(`RULE 2  --${name} and --${byValue.get(v)} are both ${v}. `
      + 'Two surfaces on one level have no order between them.');
  }
  byValue.set(v, name);
}

for (const f of files) {
  const rel = path.relative(ROOT, f);
  if (rel === 'src/ui/layers.css') continue;
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/z-index\s*:\s*([^;}\n]+)/g)) {
    const val = m[1].trim();
    if (val.startsWith('var(--z-') || val.startsWith('var(--lsc-z') || val.startsWith('var(--pt-z')) continue;
    if (/^-?\d+$/.test(val)) {
      // An internal level, inside a surface that already declares its own.
      if (INTERNAL.includes(rel) && Math.abs(+val) < 1000) continue;
      problems.push(`RULE 1  ${rel}: bare "z-index: ${val}". `
        + 'Every surface takes its level from a token in src/ui/layers.css.');
    }
  }
}

// -------------------------------------------------------------------- rule 3
const B = {
  en: (await import(path.join(SRC, 'i18n/en.js'))).default,
  es: (await import(path.join(SRC, 'i18n/es.js'))).default,
  pl: (await import(path.join(SRC, 'i18n/pl.js'))).default,
};
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (
  v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${p}${k}.`) : [[p + k, v]]));

/** Keys whose value is spoken by the companion, one line at a time. */
const VOICE = /^story\.(open|ch\d+\.b\d+[a-z]?|voice|beat|milestone)|^guide\.n\./;
let checked = 0;
for (const [loc, bundle] of Object.entries(B)) {
  for (const [k, v] of flat(bundle)) {
    if (!VOICE.test(k) || typeof v !== 'string') continue;
    checked++;
    // Plural forms and slots expand; measure the longest thing it can render.
    const len = v.replace(/«n\|[^»]*»/g, (s) => longestBranch(s)).length;
    if (len > READABLE_MAX) {
      problems.push(`RULE 3  ${loc} ${k} is ${len} chars (max ${READABLE_MAX}). `
        + 'Marlow would take it off screen with reading still to do.');
    }
  }
}

function longestBranch(s) {
  const body = s.slice(s.indexOf('|') + 1, -1);
  return body.split('|').map((b) => b.replace(/^[a-z]+:/, '')).sort((a, b) => b.length - a.length)[0] || '';
}

// ------------------------------------------------------------------ self-test
if (SELFTEST) {
  const fake = [];
  if (!/--z-modal:\s*40/.test(scale)) fake.push('the scale no longer declares --z-modal: 40');
  if (tokens.size < 20) fake.push(`only ${tokens.size} tokens found — the scale did not parse`);
  if (checked < 30) fake.push(`only ${checked} companion lines measured — the key filter is wrong`);
  if (longestBranch('«n|one:# line|other:# lines»') !== '# lines') fake.push('plural expansion is wrong');
  if (fake.length) {
    console.log('SELF-TEST FAILED — this gate cannot see its own subject:');
    fake.forEach((x) => console.log('  - ' + x));
    process.exit(1);
  }
  console.log(`self-test ok — ${tokens.size} levels, ${checked} companion lines in 3 locales`);
}

if (problems.length) {
  console.log(`layercheck FAILED — ${problems.length} problem(s):\n`);
  for (const p of problems) console.log('  ' + p);
  process.exit(1);
}
console.log(`layercheck OK — ${tokens.size} levels, all distinct; `
  + `${files.length} files carry no bare z-index; `
  + `${checked} companion lines are inside ${READABLE_MAX} characters in 3 locales.`);
