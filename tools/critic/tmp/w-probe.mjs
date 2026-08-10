import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const URL = 'http://127.0.0.1:4789';
const OUT = '/tmp/critic-w/probe';
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
page.on('pageerror', e => errs.push('PAGEERR '+e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(6000);
await page.evaluate(() => document.getElementById('boot')?.classList.add('gone'));
await page.mouse.click(800,450);

async function settle(x,y,z,yaw,pitch,ms=2400) {
  for (let i=0;i<8;i++) {
    await page.evaluate(([x,y,z,yaw,pitch]) => {
      const a = window.__ascent;
      a.player.pos.set(x,y,z); a.player.vel.set(0,0,0);
      a.player.yaw = yaw; a.player.pitch = pitch;
      if (a.player.cam) { a.player.cam.yaw = yaw; a.player.cam.pitch = pitch; }
    }, [x,y,z,yaw,pitch]);
    await page.waitForTimeout(ms/8);
  }
}
async function mean(name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  return page.evaluate(() => {
    const c = document.querySelector('canvas');
    const g = document.createElement('canvas'); g.width = 160; g.height = 90;
    const x = g.getContext('2d'); x.drawImage(c, 0, 0, 160, 90);
    const d = x.getImageData(0,0,160,90).data; let s = 0;
    for (let i=0;i<d.length;i+=4) s += (d[i]+d[i+1]+d[i+2])/3;
    return +(s/(d.length/4)).toFixed(1);
  });
}

// the dark spot the run passed through
for (const [x,y,z] of [[43,62,-81],[43,66,-81],[45,70,-79],[42,80,-85]]) {
  await settle(x,y,z, 0.6, -0.05, 1400);
  const m = await mean(`dark-${x}_${y}_${z}`);
  console.log('brightness at', x,y,z, m);
}

// wide hero of the island from above (a matte-painting check, not a standable one)
await settle(0, 340, 520, Math.PI, -0.32, 2600);
await mean('hero-air');
// the badlands
const b = [40, 106];
await settle(b[0], 120, b[1], Math.PI*1.05, -0.12, 2400);
await mean('badlands');
// the lake / coast
await settle(-120, 90, 60, Math.PI*0.4, -0.05, 2400);
await mean('coast');
console.log('ERRORS', errs.length, errs.slice(0,4));
await browser.close();
