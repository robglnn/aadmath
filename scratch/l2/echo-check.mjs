/** The echo / scaffold / diagnosis checks validate-items runs on Level 1, run on Level 2. */
import { registerPack } from '/Users/harrison/dev/aadmath/src/content/registry.js';
import { generate } from '/Users/harrison/dev/aadmath/src/learn/generators.js';
import { analogueFor } from '/Users/harrison/dev/aadmath/src/learn/scaffold.js';
import { echoScript, ladderOf, ladderNotation } from '/Users/harrison/dev/aadmath/src/learn/echo.js';
import { diagnose } from '/Users/harrison/dev/aadmath/src/learn/diagnose.js';
import ITEM_EN from '/Users/harrison/dev/aadmath/content/lang/items.en.js';
import pack from '/Users/harrison/dev/aadmath/src/content/packs/algebra1-l2.js';
registerPack(pack);

const norm = (t) => String(t).replace(/\s+/g, '');
const problems = [];
let ladders = 0, flat = 0, thin = 0, leaky = 0, noAnalogue = 0, offList = 0, checked = 0;
for (const [skill, forms] of Object.entries(pack.skills)) {
  for (const form of forms) {
    for (let d = form.dMin; d <= form.dMax; d++) {
      for (let i = 0; i < 6; i++) {
        let item;
        try { item = generate(skill, d, (i * 15485863 + d * 6151 + skill.length * 97) >>> 0, { form: form.id, strict: true, record: false }); }
        catch { continue; }
        checked++;
        let ex = null;
        try { ex = analogueFor(item, { difficulty: d, seed: item.seed }); } catch { ex = null; }
        if (!ex) { noAnalogue++; problems.push(`scaffold: ${skill}/${form.id}/d${d} has no faded analogue`); }
        const entry = (item.diagnostics || [])[0]?.value ?? null;
        const rungs = ladderOf(item, ex, entry);
        ladders++;
        if (new Set(rungs).size !== rungs.length) { flat++; problems.push(`echo: ${skill}/${form.id}/d${d} renders two identical layers`); }
        for (const dg of (item.diagnostics || []).slice(0, 3)) {
          const first = echoScript({ item, analogue: ex, entry: dg.value, tier: 1 }).rows;
          const math = first.filter((r) => r.latex);
          if (!math.length) { thin++; problems.push(`echo: ${skill}/${form.id}/d${d} answers a slip with no mathematics`); continue; }
          if (math.length === 1 && norm(math[0].latex) === norm(item.latex) && math[0].why === ITEM_EN['echo.theTear']) {
            thin++; problems.push(`echo: ${skill}/${form.id}/d${d} answers "${dg.value}" by restating the prompt`);
          }
        }
        // The leak rule is about an analogue drawn from a DIFFERENT problem.
        // When none was available the ladder shows the learner's own prompt,
        // opened rather than printed, and its numbers are already on screen.
        const digits = (s) => (String(s).replace(/\^\s*\{?-?\d+\}?/g, '').match(/\d+/g) || []);
        const live = ex ? new Set(digits(item.answer)) : new Set();
        for (const nmb of digits(ladderNotation(item, ex, entry).join(' '))) {
          if (live.has(nmb)) { leaky++; problems.push(`echo: ${skill}/${form.id}/d${d} prints the live answer "${nmb}" in the trace`); break; }
        }
        // diagnosis must never name a misconception the item cannot produce
        const known = new Set((item.diagnostics || []).map((x) => norm(x.value)));
        for (const probe of ['0', '1', '-1', '99', '7/3', 'x > 0', 'y = x']) {
          if (known.has(norm(probe))) continue;
          const named = diagnose(item, probe);
          // A near miss really is an arithmetic slip: the shipped gate allows a
          // value within two of the answer to be named one.
          const near = Math.abs(Number(probe) - Number(item.answer)) <= 2;
          if (named && named !== 'arith-slip' && !near && !(item.diagnostics || []).some((x) => x.misconception === named)) {
            offList++; problems.push(`diagnose: ${skill}/${form.id}/d${d} names "${named}" for the off-list entry "${probe}"`);
          }
        }
      }
    }
  }
}
console.log(`checked ${checked} Level 2 items`);
console.log(`echo: ${ladders - flat}/${ladders} ladders strictly deepen, ${thin} answer a slip with no mathematics, ${leaky} print the live answer`);
console.log(`scaffold: ${ladders - noAnalogue}/${ladders} have a faded analogue`);
console.log(`diagnose: ${offList} off-list entries were given a name (must be 0)`);
if (problems.length) {
  const byForm = new Map();
  for (const p of problems) {
    const m = /([a-z-]+\/[a-z0-9-]+)/.exec(p.split(': ')[1] || '');
    const key = `${p.split(':')[0]} ${m ? m[1] : '?'}`;
    byForm.set(key, (byForm.get(key) || 0) + 1);
  }
  console.log(`\nFAIL — ${problems.length} problem(s) over ${byForm.size} (kind, form) pairs:`);
  for (const [k, n] of [...byForm].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${k}`);
  process.exit(1);
}
console.log('PASS');
