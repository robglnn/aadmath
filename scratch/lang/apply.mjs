#!/usr/bin/env node
/**
 * Apply a {key: {en, es, pl}} patch to content/lang/items.*.js in place.
 * One key is one line in each bundle, so the rewrite is a line swap.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = '/Users/harrison/dev/aadmath';
const file = process.argv[2];
if (!file) { console.error('usage: apply.mjs <patch.mjs>'); process.exit(1); }
const patch = (await import(pathToFileURL(path.resolve(file)).href)).default;

const q = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

let changed = 0;
for (const loc of ['en', 'es', 'pl']) {
  const p = path.join(ROOT, 'content/lang', `items.${loc}.js`);
  let src = fs.readFileSync(p, 'utf8');
  const lines = src.split('\n');
  for (const [key, tr] of Object.entries(patch)) {
    const text = tr[loc];
    if (text == null) { console.error(`MISSING ${loc} for ${key}`); process.exit(1); }
    const at = lines.findIndex((l) => l.trimStart().startsWith(`'${key}':`));
    if (at < 0) { console.error(`NOT FOUND ${loc} ${key}`); process.exit(1); }
    const indent = lines[at].match(/^\s*/)[0];
    lines[at] = `${indent}'${key}': ${q(text)},`;
    changed++;
  }
  fs.writeFileSync(p, lines.join('\n'));
}
console.log(`patched ${Object.keys(patch).length} keys × 3 locales (${changed} lines)`);
