/**
 * How often does the world pick the cadet up? Real keys, one bearing after
 * another, no objective — the walk a player does when they are exploring.
 */
import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4802');
const MIN = Number(arg('minutes', 6));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(3000);
const handBack = async () => {
  for (let i = 0; i < 8; i++) {
    if (!(await page.evaluate(() => !!window.__ascent.input.uiOpen))) return;
    let hit = false;
    for (const sel of ['.sc-go', '.sx-more', '.sr-skip', '.fdy-close', '.rf-x']) {
      const el = await page.$(sel);
      if (el && await el.isVisible().catch(() => false)) { await el.click().catch(() => {}); hit = true; break; }
    }
    if (!hit) await page.keyboard.press('Escape');
    await page.waitForTimeout(350);
  }
};
// …and an instrument for the thing the report is about: the drawn island
// standing over the cadet or over the lens, and a crushed camera boom.
await page.evaluate(() => {
  const a = window.__ascent, T = a.THREE;
  const S = { last: performance.now(), inP: 0, inC: 0, blind: 0, blindRun: 0, beige: 0, frames: 0, worst: null };
  window.__RM = S;
  const cam = new T.Vector3();
  const tick = (now) => {
    const dt = Math.min(0.2, (now - S.last) / 1000); S.last = now;
    try {
      S.frames++;
      const p = a.player.pos;
      a.camera.getWorldPosition(cam);
      const gp = a.islandAt(p.x, p.z);
      const gc = a.islandAt(cam.x, cam.z);
      if (gp !== null && gp - (p.y + 1.5) > S.inP) { S.inP = gp - (p.y + 1.5); S.worst = [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)]; }
      if (gc !== null && gc - cam.y > S.inC) S.inC = gc - cam.y;
      const hit = a.player.cam && typeof a.player.cam._hit === 'number' ? a.player.cam._hit : 99;
      S.blindRun = hit < 2.2 ? S.blindRun + dt : 0;
      if (S.blindRun > S.blind) S.blind = S.blindRun;
    } catch { /* mid-teardown */ }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await handBack();
const t0 = Date.now();
let turns = 0;
await page.keyboard.down('KeyW');
await page.keyboard.down('ShiftLeft');
while ((Date.now() - t0) / 1000 < MIN * 60) {
  await handBack();
  // change bearing every few seconds, the way a person looking around does
  const k = Math.random() < 0.5 ? 'ArrowLeft' : 'ArrowRight';
  await page.keyboard.down(k);
  await page.waitForTimeout(200 + Math.random() * 500);
  await page.keyboard.up(k);
  turns++;
  await page.waitForTimeout(2500);
}
await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
const out = await page.evaluate(() => {
  const a = window.__ascent, p = a.player.pos, S = window.__RM;
  return { rec: a.player.recoveries | 0, caught: a.player.caught | 0, x: +p.x.toFixed(0), z: +p.z.toFixed(0),
    inP: +S.inP.toFixed(2), inC: +S.inC.toFixed(2), blind: +S.blind.toFixed(1), worst: S.worst, frames: S.frames,
    stats: a.world.routeStats ? a.world.routeStats() : null };
});
console.log(`${MIN} min of roaming, ${turns} turns: recoveries ${out.rec}, catches ${out.caught}, ended at ${out.x},${out.z}`);
console.log(`inside: cadet ${out.inP} m, lens ${out.inC} m${out.worst ? ' worst at ' + out.worst.join(',') : ''}; crushed boom worst ${out.blind}s over ${out.frames} frames`);
console.log('one-way share', out.stats ? (out.stats.oneWayShare * 100).toFixed(2) + '%' : 'n/a', ' errors', errs.length);
await browser.close();
