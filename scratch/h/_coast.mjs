/**
 * WHERE DOES THE CADET KEEP LEAVING THE ISLAND?
 *
 * The eighteen-minute sitting reports 215 fall-catches — one every five
 * seconds. This drives the same walk the traffic gate drives and records the
 * position on every catch, plus where the recovery put him down.
 */
import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4802');
const MIN = Number(arg('minutes', 5));
const W = 1600, H = 900;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2500);
const handBack = async () => {
  for (let i = 0; i < 8; i++) {
    if (!(await page.evaluate(() => !!window.__ascent.input.uiOpen))) return;
    let hit = false;
    for (const s of ['.sc-go', '.sx-more', '.sr-skip', '.fdy-close', '.rf-x']) {
      const el = await page.$(s);
      if (el && await el.isVisible().catch(() => false)) { await el.click().catch(() => {}); hit = true; break; }
    }
    if (!hit) await page.keyboard.press('Escape');
    await page.waitForTimeout(350);
  }
};
await handBack();
await page.evaluate(() => {
  const a = window.__ascent;
  const S = { events: [], lastC: a.player.caught | 0, lastR: a.player.recoveries | 0, last: performance.now() };
  window.__CO = S;
  const tick = () => {
    try {
      const p = a.player.pos;
      const c = a.player.caught | 0, r = a.player.recoveries | 0;
      if (c !== S.lastC || r !== S.lastR) {
        S.events.push({ t: +(performance.now() / 1000).toFixed(1), kind: c !== S.lastC ? 'caught' : 'recovered',
          x: +p.x.toFixed(0), z: +p.z.toFixed(0), y: +p.y.toFixed(0),
          g: a.islandAt(p.x, p.z) === null ? null : +a.islandAt(p.x, p.z).toFixed(0) });
        S.lastC = c; S.lastR = r;
        setTimeout(() => {
          const q = a.player.pos;
          S.events.push({ t: +(performance.now() / 1000).toFixed(1), kind: 'setdown',
            x: +q.x.toFixed(0), z: +q.z.toFixed(0), y: +q.y.toFixed(0),
            g: a.islandAt(q.x, q.z) === null ? null : +a.islandAt(q.x, q.z).toFixed(0) });
        }, 400);
      }
    } catch {}
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const cx = Math.round(W / 2), cy = Math.round(H / 2);
let mx = cx;
const t0 = Date.now();
await page.keyboard.down('KeyW');
while ((Date.now() - t0) / 1000 < MIN * 60) {
  await handBack();
  const w = await page.evaluate(() => {
    const mark = document.querySelector('.gd-mark');
    if (!mark || !mark.classList.contains('show')) return null;
    const r = mark.getBoundingClientRect();
    return { x: r.left + r.width / 2, edge: mark.classList.contains('edge') };
  });
  if (w) {
    const off = w.x - cx;
    if (Math.abs(off) > 40 || w.edge) {
      const step = Math.max(-160, Math.min(160, off * (w.edge ? 1.6 : 0.7))) || 120;
      mx = Math.max(4, Math.min(W - 4, mx + step));
      await page.mouse.move(mx, cy);
      if (mx <= 8 || mx >= W - 8) mx = cx;
    }
  }
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE');
}
await page.keyboard.up('KeyW');
const out = await page.evaluate(() => ({ ev: window.__CO.events, rec: window.__ascent.player.recoveries | 0, c: window.__ascent.player.caught | 0 }));
console.log(`${MIN} min: recoveries ${out.rec}, catches ${out.c}, ${out.ev.length} events`);
for (const e of out.ev.slice(0, 60)) console.log(`  ${String(e.t).padStart(7)}s ${e.kind.padEnd(10)} at ${String(e.x).padStart(5)},${String(e.z).padStart(5)} y=${String(e.y).padStart(5)} ground=${e.g === null ? 'OPEN AIR' : e.g}`);
console.log('errors', errs.length);
await browser.close();
