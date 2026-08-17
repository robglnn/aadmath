/**
 * Did removing the shop's contact-open change the coldplay edge run?
 *
 * The gate sprints "straight ahead, at the gulf" from a cold spawn. The foundry
 * deck sits thirteen metres ahead of that spawn, and until today walking within
 * 6.4 m of it opened a full-screen panel — which also stopped the sprint dead.
 * If that bearing passes inside 6.4 m, then the shop was an accidental brake on
 * this test, and its removal is why the cadet now leaves the shard at full
 * speed and glides far enough out to beat the six-second catch.
 *
 * Measures, does not argue: the closest the sprint ever comes to the crucible,
 * and where the cadet is when the gate's clock runs out.
 */
import { chromium } from 'playwright';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4500);
await page.mouse.click(800, 450);

const OPEN_R = 6.4;   // the radius the shop used to open itself inside

await page.keyboard.down('ShiftLeft');
await page.keyboard.down('KeyW');

let minD = Infinity, minAt = 0;
const track = [];
const t0 = Date.now();
while ((Date.now() - t0) / 1000 < 11) {
  await page.waitForTimeout(220);
  const f = await page.evaluate(() => {
    const a = window.__ascent, p = a.player.pos;
    const fd = a.kit.state().foundry;
    return {
      x: p.x, y: p.y, z: p.z, d: fd.d, shopOpen: fd.open,
      ground: a.islandAt(p.x, p.z), grounded: !!a.player.grounded,
      gliding: !!a.player.gliding, speed: a.player.speed,
      caught: a.player.caught | 0,
    };
  });
  const el = (Date.now() - t0) / 1000;
  if (f.d < minD) { minD = f.d; minAt = el; }
  track.push({ el: +el.toFixed(1), ...f });
}
await page.keyboard.up('KeyW');
await page.keyboard.up('ShiftLeft');

const last = track[track.length - 1];
const outAt6 = track.find((t) => t.el >= 6.1) || last;

console.log(`closest approach to the crucible: ${minD.toFixed(1)} m at ${minAt.toFixed(1)}s`);
console.log(`  the shop's old contact radius was ${OPEN_R} m — `
  + (minD < OPEN_R
    ? 'THIS SPRINT WENT THROUGH IT. The panel used to open here and stop the run.'
    : 'this sprint never entered it; the shop is not involved.'));
console.log(`at 6.1s (the gate's deadline): ${Math.hypot(outAt6.x, outAt6.z).toFixed(0)} m from the plaza, `
  + `y=${outAt6.y.toFixed(0)}, ground=${outAt6.ground === null ? 'open air' : 'solid'}, `
  + `gliding=${outAt6.gliding}, caught=${outAt6.caught}`);
console.log(`at 11s: ${Math.hypot(last.x, last.z).toFixed(0)} m out, y=${last.y.toFixed(0)}, `
  + `ground=${last.ground === null ? 'open air' : 'solid'}, caught=${last.caught}`);

await browser.close();
