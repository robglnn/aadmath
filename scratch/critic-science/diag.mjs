import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
await page.goto('http://127.0.0.1:4787/?unit=algebra1-l2', { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
await page.waitForTimeout(2500);

const out = await page.evaluate(() => {
  const a = window.__ascent;
  const rows = [];
  for (const skill of a.content().nodes) {
    for (const f of (a.formsBySkill[skill] || [])) {
      for (let s = 0; s < 30; s++) {
        let it;
        try { it = a.showItem(skill, { difficulty: 4, form: f.id, seed: 1000 + s * 7 }); } catch { continue; }
        const item = a.panel.item;
        const diags = (item.diagnostics || []).map((d) => ({ v: String(d.value ?? d.entry ?? ''), m: d.misconception }));
        const named = new Set(diags.map((d) => d.v));
        // probe a spread of plausible wrong entries that are NOT declared
        const ans = Number(item.answer);
        const probes = [];
        if (Number.isFinite(ans)) for (const d of [1, 2, 3, -1, -2, 5, 10]) probes.push(String(ans + d));
        for (const p of probes) {
          if (named.has(p)) continue;
          const r = a.enter(p);
          if (r && r.misconception) rows.push({ skill, form: f.id, seed: 1000 + s * 7, answer: String(item.answer), entry: p, named: r.misconception, declared: diags });
        }
        a.panel.hide?.();
      }
    }
  }
  return rows;
});
console.log('OFF-LIST ENTRIES GIVEN A MISCONCEPTION NAME:', out.length);
for (const r of out) console.log(JSON.stringify(r));
await browser.close();
