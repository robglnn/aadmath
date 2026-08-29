import { registerPack } from '/Users/harrison/dev/aadmath/src/content/registry.js';
import { generate } from '/Users/harrison/dev/aadmath/src/learn/generators.js';
import { echoScript } from '/Users/harrison/dev/aadmath/src/learn/echo.js';
import pack from '/Users/harrison/dev/aadmath/src/content/packs/algebra1-l2.js';
registerPack(pack);
for (const [skill, form, d] of [['literal-equations','le-formula',3],['slope-rate','sr-standard',4],['graph-linear','gl-standard',4],['write-linear','wl-standard',4],['rule-from-table','rft-input',3],['slope-rate','sr-table',2],['inequality-multi-step','im-bracket',2]]) {
  const it = generate(skill, d, 12345, { form, strict: true, record: false });
  console.log('---', skill, form, 'check', JSON.stringify(it.check), 'answer', it.answer);
  for (const dg of (it.diagnostics||[]).slice(0,2)) {
    const rows = echoScript({ item: it, analogue: null, entry: dg.value, tier: 1 }).rows;
    console.log('   entry', dg.value, '->', JSON.stringify(rows.map(r=>r.latex||r.text)));
  }
}
