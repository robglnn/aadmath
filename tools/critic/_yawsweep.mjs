import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const OUT = 'scratch/yaw';
await mkdir(OUT, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--disable-gpu-vsync'] });
const c = await b.newContext({ viewport: { width: 900, height: 560 }, deviceScaleFactor: 1 });
const p = await c.newPage();
await p.goto('http://127.0.0.1:4711', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await p.waitForTimeout(3000);
await p.evaluate(() => { document.getElementById('boot')?.classList.add('gone'); document.getElementById('ui').style.display='none'; window.__ascent.engine.quality.enabled=false; });
for (let i=0;i<8;i++){
  const yaw = i*Math.PI/4;
  await p.evaluate((y)=>{const a=window.__ascent;a.player.pos.set(2,60,8);a.player.vel.set(0,0,0);a.player.yaw=y;a.player.pitch=-0.45;},yaw);
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/yaw${i}.png` });
}
await b.close();
