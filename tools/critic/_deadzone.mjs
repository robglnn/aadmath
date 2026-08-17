/**
 * Map the dead zone: for every rift, from every bearing, does the objective
 * card offer EITHER a direction OR a working prompt?
 */
import { chromium } from 'playwright';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4500);

const handBack = async () => {
  for (let i = 0; i < 8; i++) {
    if (!(await page.evaluate(() => !!window.__ascent.input.uiOpen))) return true;
    let hit = false;
    for (const sel of ['.sc-go', '.ses-charter button', '.ses-rest button', '.rf-x']) {
      const b = await page.$(sel);
      if (b && await b.isVisible()) { await b.click().catch(() => {}); hit = true; break; }
    }
    if (!hit) await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
  }
  return !(await page.evaluate(() => !!window.__ascent.input.uiOpen));
};
await handBack();
await page.waitForTimeout(2000);

const RADII = [6, 7, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 14, 18];
const BEARINGS = 8;

const targets = await page.evaluate(() => window.__ascent.rifts.list
  .filter((r) => !r.locked).map((r) => ({ id: r.id, x: r.foot.x, y: r.foot.y, z: r.foot.z })));
console.log('unlocked rifts:', targets.map((t) => t.id).join(', '));

const out = [];
for (const tgt of targets) {
  for (const rad of RADII) {
    for (let b = 0; b < BEARINGS; b++) {
      const th = (b / BEARINGS) * Math.PI * 2;
      const placed = await page.evaluate(({ tgt, th, rad }) => {
        const a = window.__ascent;
        const x = tgt.x + Math.cos(th) * rad, z = tgt.z + Math.sin(th) * rad;
        const h = a.islandAt(x, z);
        if (h === null) return false;
        a.player.pos.set(x, h + 0.55, z);
        a.player.vel.set(0, 0, 0);
        return true;
      }, { tgt, th, rad });
      if (!placed) continue;
      await page.waitForTimeout(560);
      const s = await page.evaluate(() => {
        const a = window.__ascent;
        const g = a.story.guide();
        const dirEl = document.querySelector('.gd-dir');
        return {
          uiOpen: !!a.input.uiOpen,
          panel: !!a.panel?.open,
          objSkill: g && g.skill, metres: g && g.metres,
          dirText: dirEl ? dirEl.textContent.trim() : '',
          promptShown: !!document.querySelector('.gd-prompt.show'),
          marker: !!document.querySelector('.gd-mark.show'),
          nearId: a.rifts.nearest(a.player.pos)?.id || null,
        };
      });
      out.push({ rift: tgt.id, rad, b, ...s });
      if (s.panel || s.uiOpen) await handBack();
    }
  }
}

const HERE = /standing in it|bajo los pies|w środku/i;
const bad = out.filter((r) => !r.uiOpen && HERE.test(r.dirText) && !r.promptShown);
const nothing = out.filter((r) => !r.uiOpen && !r.promptShown && !r.marker && HERE.test(r.dirText));
console.log(`\nsamples: ${out.length}`);
console.log(`says "standing in it" with NO prompt: ${bad.length}`);
const byRad = {};
for (const x of bad) byRad[x.rad] = (byRad[x.rad] || 0) + 1;
console.log('by radius:', JSON.stringify(byRad));
console.log('examples:', JSON.stringify(bad.slice(0, 6)));
console.log(`\nno direction, no marker, no prompt (TOTAL DEAD): ${nothing.length}`);
const n2 = {};
for (const x of nothing) n2[x.rad] = (n2[x.rad] || 0) + 1;
console.log('by radius:', JSON.stringify(n2));

// distance table
const tbl = {};
for (const x of out) {
  const k = x.rad;
  tbl[k] = tbl[k] || { prompt: 0, here: 0, marker: 0, n: 0 };
  tbl[k].n++;
  if (x.promptShown) tbl[k].prompt++;
  if (HERE.test(x.dirText)) tbl[k].here++;
  if (x.marker) tbl[k].marker++;
}
console.log('\nradius  n  prompt  saysHere  marker');
for (const k of Object.keys(tbl).sort((a, b) => a - b)) {
  const v = tbl[k];
  console.log(`  ${String(k).padStart(5)}  ${v.n}   ${v.prompt}     ${v.here}      ${v.marker}`);
}

await browser.close();
