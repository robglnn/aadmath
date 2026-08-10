import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url'), OUT = path.resolve(arg('out'));
await mkdir(OUT, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--disable-gpu-vsync'] });
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
await page.waitForTimeout(2800);
await page.evaluate(() => { document.getElementById('boot')?.classList.add('gone'); document.getElementById('ui').style.display='none'; });
await page.evaluate(() => { const a=window.__ascent; a.player.pos.set(0,(a.world.heightAt(0,26)??12)+0.4,26); a.player.vel.set(0,0,0); a.player.yaw=Math.PI; a.player.pitch=-0.14; a.player.cam?.snap?.(); });
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT, 'all.png') });
for (const n of ['farlands','ranges']) {
  await page.evaluate((n) => { window.__ascent.scene.getObjectByName(n).visible = false; }, n);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'no-' + n + '.png') });
  await page.evaluate((n) => { window.__ascent.scene.getObjectByName(n).visible = true; }, n);
}
// only farlands: hide island + everything else
await page.evaluate(() => { const s=window.__ascent.scene; s.traverse(o=>{ if(o.name==='island'||o.name==='ranges') o.visible=false; }); });
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, 'no-island-ranges.png') });
await b.close();
