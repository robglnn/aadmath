import { generate } from '../../../src/learn/generators.js';
import { formsFor } from '../../../src/content/registry.js';
import { analogueFor } from '../../../src/learn/scaffold.js';
import { ladderOf, ladderNotation, echoScript } from '../../../src/learn/echo.js';
import { allUnits, loadUnit } from '../../_courses.mjs';
import EN from '../../../content/lang/items.en.js';

for (const u of await allUnits()) await loadUnit(u.unit).catch(() => {});
const graph = JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../../../content/graph/algebra1-l2.json', import.meta.url), 'utf8'));
const norm = (t) => String(t).replace(/\s+/g, '');
const kinds = { flat: [], restate: [], leak: [], nomath: [] };

for (const n of graph.nodes) {
  for (const form of formsFor(n.id) || []) {
    for (let d = form.dMin; d <= form.dMax; d++) {
      for (let i = 0; i < 6; i++) {
        let item;
        try { item = generate(n.id, d, (i * 15485863 + d * 6151 + n.id.length * 97) >>> 0, { form: form.id, strict: true }); } catch { continue; }
        const ex = analogueFor(item, { difficulty: d, seed: item.seed });
        const entry = (item.diagnostics || [])[0]?.value ?? null;
        const rungs = ladderOf(item, ex, entry);
        if (new Set(rungs).size !== rungs.length) {
          const dupe = rungs.map((r, ri) => [ri, r]).filter(([ri, r]) => rungs.indexOf(r) !== ri);
          kinds.flat.push({ k: `${n.id}/${form.id}/d${d}`, tiers: dupe.map(([ri]) => ri + 1), sample: String(rungs[dupe[0][0]]).slice(0, 150) });
        }
        for (const dg of (item.diagnostics || []).slice(0, 3)) {
          const first = echoScript({ item, analogue: ex, entry: dg.value, tier: 1 }).rows;
          const math = first.filter((r) => r.latex);
          if (!math.length) { kinds.nomath.push({ k: `${n.id}/${form.id}/d${d}`, entry: dg.value, rows: JSON.stringify(first).slice(0, 200) }); continue; }
          if (math.length === 1 && norm(math[0].latex) === norm(item.latex) && math[0].why === EN['echo.theTear']) {
            kinds.restate.push({ k: `${n.id}/${form.id}/d${d}`, entry: dg.value, prompt: item.latex, ans: item.answer, mis: dg.misconception });
          }
        }
        const digits = (s) => (String(s).replace(/\^\s*\{?-?\d+\}?/g, '').match(/\d+/g) || []);
        const live = new Set(digits(item.answer));
        const notation = ladderNotation(item, ex, entry).join(' ');
        // An honest leak test. For a single-value answer the L1 rule is right:
        // any digit of it on screen is copyable. For a COMPOSITE answer -- a
        // rule, a rate, a point -- a stray 1 inside a coordinate is not the
        // answer, so the test is whether the answer itself is legible.
        const composite = live.size > 1;
        let leak = null;
        if (composite) {
          if (norm(notation).includes(norm(item.answer))) leak = String(item.answer);
          else if (ex && digits(ex.answer).some((x) => live.has(x))) leak = 'analogue answer shares a component';
        } else {
          for (const nmb of digits(notation)) if (live.has(nmb)) { leak = nmb; break; }
        }
        if (leak) kinds.leak.push({ k: `${n.id}/${form.id}/d${d}`, num: leak, ans: item.answer, where: notation.slice(0, 220) });
      }
    }
  }
}
for (const [k, v] of Object.entries(kinds)) {
  console.log(`\n===== ${k.toUpperCase()} (${v.length}) =====`);
  const byKey = {};
  for (const x of v) (byKey[x.k] = byKey[x.k] || []).push(x);
  for (const [key, list] of Object.entries(byKey)) {
    console.log(`  ${key}  x${list.length}`);
    console.log('     ' + JSON.stringify(list[0]).slice(0, 400));
  }
}
