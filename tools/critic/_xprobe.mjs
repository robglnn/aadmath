/** Targeted probe of the close card's shelf at one viewport/locale. */
import { chromium } from 'playwright';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4791');
const W = Number(arg('w', 390)); const H = Number(arg('h', 844)); const LOC = arg('loc', 'pl');
const OUT = path.resolve(arg('out', 'shots/critX/probe'));
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: W < 700, isMobile: W < 700 });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent);
await page.evaluate((l) => { localStorage.removeItem('ascent.save'); localStorage.setItem('ascent.locale', l); }, LOC);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent);
await page.waitForTimeout(2000);
await page.waitForFunction(() => window.__ascent.session.state().phase === 'charter', null, { timeout: 60000 }).catch(() => {});
await page.locator('.sc-go').click().catch(() => {});
await page.waitForTimeout(600);
// a handful of real items so the card has content, then the ceiling
const first = await page.evaluate(() => window.__ascent.nextObjective()?.id);
await page.evaluate((id) => window.__ascent.openRiftById(id), first);
for (let i = 0; i < 6; i++) {
  const open = await page.evaluate(() => window.__ascent.panel.open);
  if (!open) {
    const id = await page.evaluate(() => window.__ascent.nextObjective()?.id);
    await page.evaluate((x) => window.__ascent.openRiftById(x), id);
    await page.waitForTimeout(400);
  }
  await page.evaluate(() => window.__ascent.panel.demo('right'));
  await page.waitForTimeout(2600);
}
await page.evaluate(() => window.__ascent.panel.close());
await page.evaluate(() => window.__ascent.session.skipToClose());

// catch the shelf mid-fade and photograph it
await page.waitForFunction(() => {
  const a = document.querySelector('.ses-close .sx-acts');
  if (!a) return false; const o = parseFloat(getComputedStyle(a).opacity);
  return o > 0.55 && o < 0.95;
}, null, { timeout: 15000 }).catch(() => console.log('no mid-fade sample'));
await page.screenshot({ path: path.join(OUT, `fade-${W}-${LOC}.png`) });
console.log('fade opacity', await page.evaluate(() => getComputedStyle(document.querySelector('.ses-close .sx-acts')).opacity));

for (const t of [900, 1800, 2600, 4000, 6000]) {
  await page.waitForTimeout(t === 900 ? 900 : 800);
  const d = await page.evaluate(() => {
    const el = document.querySelector('.ses-close');
    const inn = el?.querySelector('.sx-in');
    const acts = el?.querySelector('.sx-acts');
    const cap = el?.querySelector('.sx-cap');
    const sign = el?.querySelector('.sx-sign');
    const rest = el?.querySelector('.sx-rest');
    const R = (n) => { if (!n) return null; const r = n.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; };
    const cs = acts && getComputedStyle(acts);
    const rr = rest?.getBoundingClientRect();
    const pts = [];
    if (rr) for (const f of [0.15, 0.5, 0.85]) {
      const x = rr.left + rr.width * f, y = rr.top + rr.height / 2;
      const e = document.elementFromPoint(x, y);
      pts.push({ f, el: e ? String(e.className || e.tagName) : null });
    }
    return {
      cls: el?.className, scroll: inn ? { top: Math.round(inn.scrollTop), h: inn.scrollHeight, c: inn.clientHeight } : null,
      acts: { rect: R(acts), pos: cs?.position, bg: cs?.backgroundColor, z: cs?.zIndex, op: cs?.opacity },
      cap: { rect: R(cap), txt: cap?.textContent.slice(0, 40) },
      sign: { rect: R(sign) }, rest: { rect: R(rest), txt: rest?.textContent },
      pts,
      capBottomVsActsTop: cap && acts ? Math.round(cap.getBoundingClientRect().bottom - acts.getBoundingClientRect().top) : null,
    };
  });
  console.log(JSON.stringify(d));
}
await page.screenshot({ path: path.join(OUT, `probe-${W}-${LOC}.png`) });
console.log('errors', errs.length, errs.slice(0, 3));
await browser.close();
