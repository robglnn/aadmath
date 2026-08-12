#!/usr/bin/env node
/**
 * Apply a table of exact string replacements to one bundle file.
 *
 *   node tools/lang/apply.mjs <file> <table.mjs>
 *
 * Every `from` must appear exactly once. A miss or a duplicate aborts the whole
 * run and writes nothing, so a concurrent edit by another builder can never be
 * half-overwritten — the tree is either untouched or fully updated.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [, , file, table] = process.argv;
if (!file || !table) { console.error('usage: apply.mjs <file> <table.mjs>'); process.exit(2); }

const abs = path.resolve(file);
const pairs = (await import(pathToFileURL(path.resolve(table)).href)).default;
let src = readFileSync(abs, 'utf8');

const bad = [];
for (const [from] of pairs) {
  const n = src.split(from).length - 1;
  if (n !== 1) bad.push(`${n === 0 ? 'MISSING' : `${n}x DUPLICATE`}: ${from.slice(0, 100)}`);
}
if (bad.length) {
  console.error(`${bad.length} of ${pairs.length} replacements do not match exactly once. Nothing written.\n`);
  for (const b of bad) console.error('  ' + b);
  process.exit(1);
}

for (const [from, to] of pairs) src = src.replace(from, to);
writeFileSync(abs, src);
console.log(`${pairs.length} replacements applied to ${path.relative(process.cwd(), abs)}`);
