import { chromium } from 'playwright';
const URL = 'http://127.0.0.1:4711';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2500);

// Drive real rifts through the real panel, answering correctly.
for (let i = 0; i < 14; i++) {
  const opened = await page.evaluate(() => {
    const A = window.__ascent;
    const o = A.nextObjective();
    if (!o) return null;
    A.teleportTo(o.id);
    return A.openRiftById(o.id) ? o.id : null;
  });
  if (!opened) break;
  await page.waitForTimeout(900);
  const res = await page.evaluate(() => {
    const A = window.__ascent;
    const it = A.panel.item;
    if (!it) return { none: true };
    return { ans: String(it.answer), form: it.form, rep: it.rep, kind: A.panel.kind };
  });
  if (res.none) { await page.waitForTimeout(400); continue; }
  await page.waitForTimeout(1400); // simulate a human thinking, so time-on-task can tick
  const out = await page.evaluate((a) => window.__ascent.enter(a), res.ans);
  await page.waitForTimeout(900);
  await page.evaluate(() => window.__ascent.panel.close?.());
  await page.waitForTimeout(300);
  console.log(i, res.form, res.rep, '->', out && out.entry === out.answer ? 'right' : JSON.stringify(out));
}
const st = await page.evaluate(() => {
  const A = window.__ascent;
  return { session: A.session.state(), watch: A.watch(), report: !!A.report };
});
console.log('session', JSON.stringify(st.session));
await page.evaluate(() => document.querySelector('.rp-launch, [aria-label*="rogress"]')?.click());
await page.waitForTimeout(1200);
const txt = await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find((e) => e.className?.toString?.().includes('rp-doc') || e.className?.toString?.().includes('rp-panel'));
  return (el || document.body).innerText.slice(0, 1400);
});
console.log('--- report head ---\n' + txt);
await page.screenshot({ path: 'shots/crit-ped-realui.png' });
console.log('errors', errors.length, errors.slice(0, 4));
await browser.close();
