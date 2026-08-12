#!/usr/bin/env node
/**
 * Rebuild the bundles as they stood BEFORE this language pass, by inverting
 * every edit table in this directory, and measure them with the SAME checker
 * that measures them now.
 *
 *   node tools/lang/baseline.mjs
 *
 * Why bother: the honest way to report "before and after" is to run one ruler
 * over both. Quoting a before-number taken with an earlier revision of the
 * heuristics would flatter the after-number by exactly the amount the ruler
 * changed, which is the oldest trick in the book and the least interesting one.
 *
 * Nothing is written into src/. The reconstructed bundles land in a scratch
 * directory and the checker is pointed at them there.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, cpSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const WORK = path.join(ROOT, 'scratch', 'lang-baseline');

// Applied in this order; inverted in reverse.
const ORDER = {
  en: ['en-pass1.mjs', 'en-pass2.mjs', 'en-pass3.mjs', 'en-pass4.mjs', 'en-pass5.mjs'],
  es: ['es-pass1.mjs', 'es-pass2.mjs', 'es-pass3-gender.mjs', 'es-pass4.mjs'],
  pl: ['pl-pass1.mjs', 'pl-pass2.mjs', 'pl-pass3-gender.mjs', 'pl-pass4-gender.mjs',
    'pl-pass5-buttons.mjs', 'pl-pass6.mjs', 'pl-pass7.mjs', 'pl-pass8.mjs'],
};

mkdirSync(path.join(WORK, 'src'), { recursive: true });
cpSync(path.join(ROOT, 'src/i18n'), path.join(WORK, 'src/i18n'), { recursive: true });

let reverted = 0;
let stale = 0;
for (const [loc, tables] of Object.entries(ORDER)) {
  const file = path.join(WORK, 'src/i18n', `${loc}.js`);
  let src = readFileSync(file, 'utf8');
  for (const t of [...tables].reverse()) {
    const pairs = (await import(pathToFileURL(path.join(HERE, t)).href)).default;
    for (const [from, to] of [...pairs].reverse()) {
      if (src.includes(to)) { src = src.replace(to, from); reverted++; }
      else stale++;                       // another builder has since edited this key
    }
  }
  writeFileSync(file, src);
}

// The checker resolves bundles relative to its own location, so it runs from a
// scratch tree that mirrors the two directories it needs.
mkdirSync(path.join(WORK, 'tools/lang'), { recursive: true });
cpSync(path.join(ROOT, 'tools/check-language.mjs'), path.join(WORK, 'tools/check-language.mjs'));
for (const f of readdirSync(HERE)) cpSync(path.join(HERE, f), path.join(WORK, 'tools/lang', f));

console.log(`reconstructed the pre-pass bundles: ${reverted} edits reverted, ${stale} keys since changed by someone else\n`);
console.log('══ BEFORE ' + '═'.repeat(60));
console.log(execFileSync('node', [path.join(WORK, 'tools/check-language.mjs'), '--stats'], { encoding: 'utf8' }));
console.log('══ AFTER ' + '═'.repeat(61));
console.log(execFileSync('node', [path.join(ROOT, 'tools/check-language.mjs'), '--stats'], { encoding: 'utf8' }));
