import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const URL = 'http://127.0.0.1:4789';
const OUT = '/tmp/critic-w/shots';
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle','--ignore-gpu-blocklist','--enable-gpu-rasterization','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { if (m.type()==='error') logs.push(m.text()); });
page.on('pageerror', e => logs.push('PAGEERR '+e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(3000);
await page.evaluate(() => document.getElementById('boot')?.classList.add('gone'));
await page.mouse.click(800, 450);
await page.waitForTimeout(400);

const shot = async (n, ms=350) => { await page.waitForTimeout(ms); await page.screenshot({ path: `${OUT}/${n}.png` }); };

// where do we start?
const start = await page.evaluate(() => {
  const a = window.__ascent;
  return { pos: a.player.pos.toArray(), peak: ({x:62,z:-98}), yaw: a.player.yaw };
});
console.log('start', JSON.stringify(start));

// steer toward the peak while running; auto-steer each 100ms
await page.evaluate(() => {
  const a = window.__ascent;
  window.__steer = setInterval(() => {
    const p = a.player.pos, P = ({x:62,z:-98});
    const want = Math.atan2(P.x - p.x, P.z - p.z);
    let d = want - a.player.yaw;
    while (d > Math.PI) d -= 2*Math.PI; while (d < -Math.PI) d += 2*Math.PI;
    a.player.yaw += d * 0.25;
    a.player.cam.yaw = a.player.yaw;
    window.__trace = window.__trace || [];
    window.__trace.push([Math.round(p.x), Math.round(p.y), Math.round(p.z)]);
  }, 100);
});
await page.keyboard.down('KeyW');
await page.keyboard.down('ShiftLeft');
for (let i = 0; i < 14; i++) {
  await page.waitForTimeout(2000);
  const st = await page.evaluate(() => { const p = window.__ascent.player.pos; const P = ({x:62,z:-98}); return { p: [Math.round(p.x),Math.round(p.y),Math.round(p.z)], d: Math.round(Math.hypot(p.x-P.x, p.z-P.z)) }; });
  console.log('t', i*2+2, JSON.stringify(st));
  if (i % 3 === 0) await shot(`walk-${i}`, 50);
  if (st.d < 6) break;
  // jump occasionally to clear ledges
  await page.keyboard.press('Space');
}
await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
await page.evaluate(() => clearInterval(window.__steer));
await page.waitForTimeout(1200);
const fin = await page.evaluate(() => { const p = window.__ascent.player.pos; const P = ({x:62,z:-98}); return { pos:[Math.round(p.x),Math.round(p.y),Math.round(p.z)], dist: Math.round(Math.hypot(p.x-P.x,p.z-P.z)), trace: window.__trace.filter((_,i)=>i%8===0) }; });
console.log('FINAL', JSON.stringify(fin));
await shot('walk-final');
console.log('ERRORS', logs.length, logs.slice(0,5));
await browser.close();
