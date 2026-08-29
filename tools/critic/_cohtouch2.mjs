/** COHERENCE: the six verbs, on a phone, read straight off the input state. */
import { chromium } from 'playwright';
const URL = process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] : 'http://127.0.0.1:4917';
const W = 390, H = 844;
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const tp = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
const P = (x, y, id = 1) => ({ x: Math.round(x), y: Math.round(y), id, radiusX: 12, radiusY: 12, force: 1 });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
await page.waitForTimeout(5000);
// hand the frame back
for (let i = 0; i < 40; i++) {
  if (!(await page.evaluate(() => !!window.__ascent.input.uiOpen))) break;
  const b = await page.evaluate(() => { for (const q of ['.ses-charter.show .sc-go', '.fdy .fdy-close', '.rf-x']) { const e = document.querySelector(q); if (!e) continue; const r = e.getBoundingClientRect(); const c = getComputedStyle(e); if (r.width > 1 && c.visibility !== 'hidden' && c.pointerEvents !== 'none' && Number(c.opacity) > 0.05) return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]; } return null; });
  if (b) { await tp('touchStart', [P(b[0], b[1])]); await page.waitForTimeout(70); await tp('touchEnd', [P(b[0], b[1])]); }
  await page.waitForTimeout(500);
}
const read = () => page.evaluate(() => {
  const i = window.__ascent.input, L = window.__ascent.player.loco || {}, p = window.__ascent.player;
  const up = [...document.querySelectorAll('.fdy, .mnu, .ses-charter, .ses-close, .ses-rest, .rf, .rp')]
    .filter((e) => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e);
      return r.width > 1 && r.height > 1 && c.display !== 'none' && c.visibility !== 'hidden' && Number(c.opacity) > 0.15; })
    .map((e) => e.className);
  return { moveMag: +(i.moveMag || 0).toFixed(2), sprint: !!i.sprint, source: i.source, uiOpen: !!i.uiOpen,
    menu: !!window.__ascent.menu?.open, panel: !!window.__ascent.panel?.open, up,
    padOn: !!document.getElementById('touchpad')?.classList.contains('on'),
    touchActive: !!i.touch?.active, speedN: +(L.speedN || 0).toFixed(2), dashT: +(L.dashT || 0).toFixed(2),
    gliding: !!L.gliding, grounded: !!p.grounded, y: +p.pos.y.toFixed(2) };
});
const home = await page.evaluate(() => { const e = document.querySelector('#touchpad .home'); const r = e.getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]; });
const btn = (a) => page.evaluate((k) => { const e = document.querySelector(`#touchpad .btn[data-a="${k}"]`); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]; }, a);

console.log('rest:            ' + JSON.stringify(await read()));
// --- the stick, half way and then to the rim -----------------------------
await tp('touchStart', [P(home[0], home[1])]);
await page.waitForTimeout(120);
for (const dy of [-25, -50, -80, -120, -160]) {
  await tp('touchMove', [P(home[0], home[1] + dy)]);
  await page.waitForTimeout(320);
  console.log(`stick ${String(-dy).padStart(3)}px:   ` + JSON.stringify(await read()));
}
await page.waitForTimeout(1600);
console.log('stick held 2s:   ' + JSON.stringify(await read()));
await tp('touchEnd', [P(home[0], home[1] - 160)]);
await page.waitForTimeout(400);
console.log('stick released:  ' + JSON.stringify(await read()));
// --- each button, one at a time, from a clean hand -----------------------
for (const a of ['jump', 'dash', 'glide']) {
  const b = await btn(a); if (!b) { console.log(`${a}: NO BUTTON`); continue; }
  const before = await read();
  await tp('touchStart', [P(b[0], b[1], 9)]);
  await page.waitForTimeout(a === 'glide' ? 40 : 100);
  const during = [];
  for (let i = 0; i < (a === 'glide' ? 14 : 8); i++) { during.push(await read()); await page.waitForTimeout(120); }
  await tp('touchEnd', [P(b[0], b[1], 9)]);
  await page.waitForTimeout(900);
  const rise = Math.max(...during.map((d) => d.y)) - before.y;
  const fired = a === 'jump' ? during.some((d) => !d.grounded) || rise > 0.4
    : a === 'dash' ? during.some((d) => d.dashT > 0)
      : during.some((d) => d.gliding);
  console.log(`${a.padEnd(6)} button: ${fired ? 'FIRES' : 'NOTHING'}  rise ${rise.toFixed(2)} m  ` +
    `grounded ${during.map((d) => (d.grounded ? 'g' : '.')).join('')} dashT ${Math.max(...during.map((d) => d.dashT))} glide ${during.some((d) => d.gliding)}`);
}
// --- glide, properly: jump, then hold glide while in the air -------------
{
  const j = await btn('jump'), g = await btn('glide');
  await tp('touchStart', [P(j[0], j[1], 11)]); await page.waitForTimeout(90); await tp('touchEnd', [P(j[0], j[1], 11)]);
  await page.waitForTimeout(320);
  await tp('touchStart', [P(g[0], g[1], 12)]);
  const seen = [];
  for (let i = 0; i < 16; i++) { seen.push(await read()); await page.waitForTimeout(130); }
  await tp('touchEnd', [P(g[0], g[1], 12)]);
  console.log(`jump then hold glide: airborne ${seen.some((s) => !s.grounded)}  gliding ${seen.some((s) => s.gliding)}  peak y ${Math.max(...seen.map((s) => s.y)).toFixed(2)}`);
}
// --- build: is there any way to place a piece with a thumb? --------------
const build = await page.evaluate(() => {
  const bar = document.getElementById('buildbar');
  const r = bar?.getBoundingClientRect(); const c = bar ? getComputedStyle(bar) : null;
  const slots = bar ? [...bar.querySelectorAll('button, [data-slot], li')].map((e) => { const q = e.getBoundingClientRect(); const cc = getComputedStyle(e); return { cls: e.className, w: Math.round(q.width), h: Math.round(q.height), pe: cc.pointerEvents, tag: e.tagName }; }) : [];
  return { shown: !!(r && r.width > 1 && c.display !== 'none' && c.visibility !== 'hidden' && Number(c.opacity) > 0.05), slots,
    padHasBuild: !!document.querySelector('#touchpad .btn[data-a="fire"], #touchpad .btn[data-a="build"]') };
});
console.log('build on the phone: ' + JSON.stringify(build));
await browser.close();
