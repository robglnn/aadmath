// Vocabulary sweep helper: exact-string replacements with a found-count assertion.
// Usage: node scratch/vocab-apply.mjs <jsonfile>
// JSON: { "file": "src/i18n/en.js", "edits": [["find","replace",count?], ...] }
import fs from 'node:fs';
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let src = fs.readFileSync(spec.file, 'utf8');
let bad = 0;
for (const [find, repl, want = 1] of spec.edits) {
  const n = src.split(find).length - 1;
  if (n !== want) { console.error(`MISS (${n}!=${want}): ${find.slice(0, 90)}`); bad++; continue; }
  src = src.split(find).join(repl);
}
if (bad) { console.error(`${bad} failed — nothing written`); process.exit(1); }
fs.writeFileSync(spec.file, src);
console.log(`ok — ${spec.edits.length} edits in ${spec.file}`);
