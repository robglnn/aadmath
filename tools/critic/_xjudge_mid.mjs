/**
 * Sequenced, not deleted — and the ending after a chapter turn.
 *
 * Half of "one ceremony at a time" is trivially satisfiable by throwing one
 * away. So: in the world, with no session beat up, an answer that buys a rank
 * AND a chapter must produce the rite alone and then the plate alone. And a run
 * that ends while a chapter plate is queued must not print the plate through the
 * close card, nor lose it silently.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4831');
const OUT = path.resolve(arg('out', 'shots/xjudge-mid'));
await mkdir(OUT, { recursive: true });

const LAYERS = [['.rift', 'tear'], ['.meta-open', 'cold-open'], ['.meta-rite', 'rite'],
  ['.meta-turn', 'plate'], ['.meta-dossier', 'dossier'], ['.rp-scrim', 'report'],
  ['.ses-charter', 'orders'], ['.ses-close', 'close'], ['.ses-rest', 'break']];

const LIVE = `(sels) => {
  const cs = (el) => getComputedStyle(el);
  const op = (el) => { let o = 1; for (let n = el; n; n = n.parentElement) o *= +cs(n).opacity; return o; };
  const shown = (el) => {
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const c = cs(n); if (c.display === 'none' || c.visibility === 'hidden') return false;
    }
    return op(el) > 0.02;
  };
  const out = [];
  for (const [sel, name] of sels) for (const el of document.querySelectorAll(sel)) {
    if (!shown(el)) continue;
    let ink = 0;
    for (const n of el.querySelectorAll('*')) {
      if (!(n.textContent || '').trim()) continue;
      let kid = false; for (const c of n.children) if ((c.textContent || '').trim()) kid = true;
      if (kid || !shown(n)) continue;
      const r = n.getBoundingClientRect(); if (r.width > 1 && r.height > 1) ink++;
    }
    if (ink) out.push(name);
  }
  return out;
}`;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
const live = () => page.evaluate(new Function('s', `return (${LIVE})(s)`), LAYERS);

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent);
await page.evaluate(() => {
  window.__ascent.session.reset(); window.__ascent.story.reset();
  localStorage.removeItem('ascent.save'); localStorage.setItem('ascent.locale', 'en');
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent);
await page.waitForTimeout(1500);

// A real run, then a rank + a chapter off one answer, in the world.
await page.evaluate(() => { window.__ascent.session.plan(); });
await page.waitForFunction(() => window.__ascent.session.state().phase === 'charter');
await page.waitForTimeout(1400);
await page.locator('.sc-go').click();
await page.waitForTimeout(1000);
await page.evaluate(() => { const s = window.__ascent.story; for (let i = 0; i < 60 && s.state().toNext > 3; i++) s.grant(1); });
await page.evaluate(() => { window.__ascent.openRiftById('var-meaning'); });
await page.waitForTimeout(900);
await page.evaluate(() => { window.__ascent.panel.demo('right'); });
await page.waitForTimeout(1000);
await page.evaluate(() => { window.__ascent.panel.close(); });
await page.waitForTimeout(800);

const order = []; let bad = 0; let bumped = false;
let sawRite = false; let sawPlate = false;
for (let i = 0; i < 90; i++) {
  const l = await live();
  if (l.length > 1) { bad++; console.log(`  TWO AT ONCE: ${l.join(' + ')}`); await page.screenshot({ path: path.join(OUT, `two-${i}.png`) }); }
  if (l.length && order[order.length - 1] !== l[0]) order.push(l[0]);
  if (l.includes('rite')) {
    sawRite = true;
    if (!sawPlate) await page.screenshot({ path: path.join(OUT, 'rite.png') });
    if (!bumped) { bumped = true; await page.evaluate(() => { window.__ascent.story.seal(4); }); }
  }
  if (l.includes('plate')) { if (!sawPlate) await page.screenshot({ path: path.join(OUT, 'plate.png') }); sawPlate = true; }
  await page.waitForTimeout(150);
}
console.log(`  world sequence: ${order.join(' -> ') || '(nothing)'}   rite=${sawRite} plate=${sawPlate} twoAtOnce=${bad}`);

// --- a chapter turn queued as the run ends -------------------------------
await page.evaluate(() => { window.__ascent.story.seal(4); });
await page.waitForTimeout(80);
await page.evaluate(() => { window.__ascent.session.chargeTo(24); window.__ascent.session.skipToClose(); });
let bad2 = 0; const seq2 = [];
for (let i = 0; i < 60; i++) {
  const l = await live();
  if (l.length > 1) { bad2++; console.log(`  TWO AT ONCE (close): ${l.join(' + ')}`); await page.screenshot({ path: path.join(OUT, `close-two-${i}.png`) }); }
  if (l.length && seq2[seq2.length - 1] !== l[0]) seq2.push(l[0]);
  await page.waitForTimeout(150);
}
await page.screenshot({ path: path.join(OUT, 'close-after-chapter.png') });
console.log(`  close sequence: ${seq2.join(' -> ')}  twoAtOnce=${bad2}`);
console.log(`  console errors: ${errors.length}`);
for (const e of errors.slice(0, 6)) console.log('   ERR ' + e);
await browser.close();
process.exit(bad + bad2 + errors.length || !sawRite || !sawPlate ? 1 : 0);
