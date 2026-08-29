import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/h-look'));
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
const errs=[]; page.on('pageerror',e=>errs.push(e.message)); page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2600);
const clear = () => page.evaluate(() => { const s=window.__ascent?.session; s?.charter?.hide?.(); s?.resolution?.hide?.(); s?.rest?.hide?.();
  for (const el of document.querySelectorAll('.ses-charter,.ses-close,.ses-rest')) el.classList.remove('show');
  document.getElementById('ui')?.classList.remove('ses-cine','ses-resting'); document.getElementById('boot')?.classList.add('gone'); }).catch(()=>{});
await clear();
await page.screenshot({ path: path.join(OUT, '00-arrival.png') });
// stand at a few places and look at the objective
const spots = [[0,20,'plaza'],[-2,-8,'out-of-plaza'],[10,-60,'corridor'],[35,-91,'the-wedge-spot'],[-30,-100,'north-vale'],[40,-115,'spine-flank']];
for (const [x,z,name] of spots) {
  await page.evaluate(([x,z])=>{ const a=window.__ascent; const h=a.islandAt(x,z); if(h!==null){a.player.pos.set(x,h+0.4,z); a.player.vel.set(0,0,0);} }, [x,z]);
  await page.waitForTimeout(900);
  // face the objective
  await page.evaluate(()=>{ const a=window.__ascent, W=a.world, p=a.player.pos;
    const o = a.afford?.state?.() ; const r = a.rifts.list.find(r=>!r.locked)||a.rifts.list[0];
    const h = W.headingTo ? W.headingTo(p.x,p.z,r.pos.x,r.pos.z) : {yaw:Math.atan2(r.pos.x-p.x,r.pos.z-p.z)};
    a.player.yaw = h.yaw; a.player.pitch = -0.10; a.player.cam.refound?.(); });
  await page.waitForTimeout(1400);
  await clear();
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}
console.log('errors', errs.length, errs.slice(0,3));
await browser.close();
