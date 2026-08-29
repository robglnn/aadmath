import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/h-gates'));
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
const errs=[]; page.on('pageerror',e=>errs.push(e.message)); page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2600);
const clear = () => page.evaluate(() => { const s=window.__ascent?.session; s?.charter?.hide?.(); s?.resolution?.hide?.(); s?.rest?.hide?.();
  for (const el of document.querySelectorAll('.ses-charter,.ses-close,.ses-rest')) el.classList.remove('show');
  document.getElementById('ui')?.classList.remove('ses-cine','ses-resting'); document.getElementById('boot')?.classList.add('gone');
  document.querySelector('.meta-comms')?.classList.remove('show');
  for (const el of document.querySelectorAll('.cold,.meta-cold,.coldopen')) el.classList.remove('show'); }).catch(()=>{});
await clear();
const st = await page.evaluate(() => window.__ascent.waygates.state());
console.log('waygates', JSON.stringify(st.at.map(a=>({k:a.key,x:Math.round(a.x),z:Math.round(a.z),ans:a.answer}))));
let i=0;
for (const g of st.at.slice(0,5)) {
  // stand 34 m in front of the gate, looking at it
  await page.evaluate((g) => {
    const a = window.__ascent;
    const w = a.waygates.list.find(c=>c.key===g.key);
    const yaw = w.yaw;
    const bx = g.x - Math.sin(yaw)*34, bz = g.z - Math.cos(yaw)*34;
    const h = a.islandAt(bx,bz);
    a.player.pos.set(bx, (h===null?g.y:h)+0.4, bz);
    a.player.vel.set(0,0,0);
    a.player.yaw = yaw; a.player.pitch = -0.02; a.player.cam.refound?.();
  }, g);
  await page.waitForTimeout(1500);
  await clear();
  await page.screenshot({ path: path.join(OUT, `gate-${i++}-${g.key.replace(/[^a-z0-9]/gi,'_')}.png`) });
}
console.log('errors', errs.length, errs.slice(0,3));
await browser.close();
