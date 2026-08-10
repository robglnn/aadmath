import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const URL = 'http://127.0.0.1:4789';
const OUT = '/tmp/critic-w/surf';
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle','--ignore-gpu-blocklist','--enable-gpu-rasterization','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { if (m.type()==='error') logs.push(m.text()); });
page.on('pageerror', e => logs.push('PAGEERR '+e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(6000);
await page.evaluate(() => document.getElementById('boot')?.classList.add('gone'));
await page.mouse.click(800, 450);
await page.waitForTimeout(300);

async function settle(x,y,z,yaw,pitch,ms=2200) {
  for (let i=0;i<6;i++) {
    await page.evaluate(([x,y,z,yaw,pitch]) => {
      const a = window.__ascent;
      a.player.pos.set(x,y,z); a.player.vel.set(0,0,0);
      a.player.yaw = yaw; a.player.pitch = pitch;
      if (a.player.cam) { a.player.cam.yaw = yaw; a.player.cam.pitch = pitch; }
    }, [x,y,z,yaw,pitch]);
    await page.waitForTimeout(ms/6);
  }
}
async function gy(x,z){
  await page.evaluate(([x,z]) => { const a=window.__ascent; a.player.pos.set(x,240,z); a.player.vel.set(0,0,0); }, [x,z]);
  await page.waitForTimeout(4500);
  return page.evaluate(() => window.__ascent.player.pos.y);
}

// 1. peak2 seen from the terrace, level
const ty = await gy(62,-98);
await settle(62, ty+1.2, -98, Math.atan2(-92-62, -66-(-98)), -0.05);
await page.screenshot({ path: `${OUT}/peak2-from-terrace.png` });

// 2. stand on peak2 itself, look down at its skin
const p2 = await gy(-92,-66);
console.log('peak2 y', p2);
await settle(-92, p2+1.2, -66, 0.6, -0.35);
await page.screenshot({ path: `${OUT}/on-peak2.png` });

// 3. mid-slope of the Spine above the treeline
const s1 = await gy(50, -70);
console.log('spine slope y', s1);
await settle(50, s1+1.2, -70, Math.atan2(62-50, -98+70), -0.25);
await page.screenshot({ path: `${OUT}/spine-slope.png` });

// 4. plaza floor, same downward angle, for the surface comparison
const pz = await gy(0, 8);
await settle(0, pz+1.2, 8, Math.PI, -0.35);
await page.screenshot({ path: `${OUT}/plaza-floor.png` });

// 5. the north gulf from the terrace: the frame the lookout exists for
await settle(62, ty+1.2, -98, Math.PI, -0.02);
await page.screenshot({ path: `${OUT}/terrace-north.png` });

console.log('ERRORS', logs.length, logs.slice(0,5));
await browser.close();
