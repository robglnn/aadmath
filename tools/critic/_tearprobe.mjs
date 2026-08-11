import { chromium } from 'playwright';
const URL = 'http://127.0.0.1:4791';
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });

async function run(label, plan) {
  const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => !!window.__ascent);
  await p.evaluate(() => { window.__ascent.session.reset(); localStorage.removeItem('ascent.save'); });
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForFunction(() => !!window.__ascent);
  await p.waitForFunction(() => window.__ascent.session.state().phase === 'charter', null, { timeout: 60000 });
  const s0 = await p.evaluate(() => window.__ascent.session.state());
  await p.locator('.sc-go').click();
  await p.waitForTimeout(400);
  const seam = s0.run.seams[0].id;
  console.log(`\n### ${label}`);
  console.log(`ORDERS: target=${s0.run.target} tears on ${s0.run.seams.map((x) => x.id).join(',')}; startLeft=${JSON.stringify(s0.run.startLeft)}`);
  await p.evaluate((id) => window.__ascent.teleportTo(id), seam);
  await p.waitForTimeout(300);
  await plan(p, seam);
  await p.evaluate(() => window.__ascent.session.skipToClose());
  await p.waitForTimeout(500);
  const st = await p.evaluate(() => window.__ascent.session.state());
  console.log(`CLOSE:  tears=${st.run.tears}/${st.run.target} items=${st.run.items} misses=${st.run.misses}`);
  console.log(`        stalled=${JSON.stringify(st.run.report.stalled)} next=${JSON.stringify(st.run.report.next)}`);
  // what a second run would be handed
  await p.evaluate(() => { window.__ascent.session.toRest(); });
  await p.waitForTimeout(300);
  const st2 = await p.evaluate(() => { const r = window.__ascent.session.plan({ minutes: 20 }); return { target: r.target, seams: r.seams.map((s) => s.id), startLeft: r.startLeft }; });
  console.log(`RUN 2 ORDERS: target=${st2.target} on ${st2.seams.join(',')} startLeft=${JSON.stringify(st2.startLeft)}`);
  if (errs.length) console.log('ERRORS', errs.slice(0, 3));
  await p.close();
}

const answer = async (p, id, kind, n) => {
  for (let i = 0; i < n; i++) {
    await p.evaluate((x) => { if (!window.__ascent.panel.open) window.__ascent.openRiftById(x); }, id);
    await p.waitForTimeout(400);
    const ok = await p.evaluate((k) => window.__ascent.panel.open && window.__ascent.panel.demo(k), kind);
    if (!ok) { await p.evaluate(() => window.__ascent.panel.close()); await p.waitForTimeout(200); continue; }
    await p.waitForTimeout(kind === 'right' ? 3400 : 900);
    await p.evaluate(() => { if (window.__ascent.panel.open) window.__ascent.panel.close(); });
    await p.waitForTimeout(250);
  }
};

await run('ONE ITEM, CORRECT', async (p, id) => answer(p, id, 'right', 1));
await run('TEN MISSES', async (p, id) => answer(p, id, 'wrong', 10));
await b.close();
