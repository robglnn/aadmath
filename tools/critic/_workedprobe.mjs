import { chromium } from 'playwright';
const URL = 'http://127.0.0.1:4791';
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent);
await p.evaluate(() => { window.__ascent.session.reset(); localStorage.removeItem('ascent.save'); });
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent);
await p.waitForFunction(() => window.__ascent.session.state().phase === 'charter', null, { timeout: 60000 });
const s0 = await p.evaluate(() => window.__ascent.session.state());
console.log('ORDERS text:', await p.evaluate(() => document.querySelector('.sc-goal').textContent));
console.log('seam rows:', await p.evaluate(() => [...document.querySelectorAll('.sc-seams li')].map((l) => l.textContent.replace(/\s+/g, ' ').trim())));
console.log('eta:', await p.evaluate(() => document.querySelector('.sc-eta').textContent));
console.log('target', s0.run.target, 'startLeft', JSON.stringify(s0.run.startLeft));
await p.locator('.sc-go').click();
await p.waitForTimeout(400);
const first = s0.run.seams[0].id;
await p.evaluate((id) => window.__ascent.teleportTo(id), first);
await p.waitForTimeout(300);
await p.evaluate((id) => window.__ascent.openRiftById(id), first);
for (let i = 0; i < 40; i++) {
  const s = await p.evaluate(() => window.__ascent.session.state().phase);
  if (s !== 'work') break;
  const open = await p.evaluate(() => window.__ascent.panel.open);
  if (!open) {
    const id = await p.evaluate(() => window.__ascent.nextObjective()?.id || null);
    if (id) { await p.evaluate((x) => window.__ascent.teleportTo(x), id); await p.waitForTimeout(250); await p.evaluate((x) => window.__ascent.openRiftById(x), id); }
    await p.waitForTimeout(400); continue;
  }
  const sk = await p.evaluate(() => window.__ascent.panel.opts?.skillId);
  await p.evaluate(() => window.__ascent.panel.demo('right'));
  await p.waitForTimeout(3400);
  const st = await p.evaluate(() => window.__ascent.session.state());
  console.log(` item ${i + 1}: skill=${sk} tears=${st.run.tears}/${st.run.target} band=${JSON.stringify(st.run.worked)}`);
}
const st = await p.evaluate(() => window.__ascent.session.state());
console.log('WORKED PER LINE:', JSON.stringify(st.run.worked), 'tears', st.run.tears, 'phase', st.phase);
await b.close();
