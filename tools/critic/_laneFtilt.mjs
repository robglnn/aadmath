import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { ESCAPE_JS, notFree } from '/Users/harrison/dev/aadmath/tools/critic/_escape.mjs';
const URL = process.argv[2];
const src = JSON.parse(readFileSync('/Users/harrison/dev/aadmath/shots/laneF-compose-before/compose.json','utf8'));
const bad = src.bad.filter((b)=>/reaches|wall/.test(b.why)).slice(0, 12);
const browser = await chromium.launch({ args: ['--use-gl=angle','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-gpu-vsync'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2600);
for (const b of bad) {
  const [x,,z] = b.at;
  const ok = await page.evaluate(([px,pz])=>{ const a=window.__ascent; const h=a.islandAt(px,pz); if(h===null) return false;
    a.player.pos.set(px,h+0.15,pz); a.player.vel.set(0,0,0); a.player.cam?.refound?.(); return true; }, [x,z]);
  if (!ok) continue;
  await page.waitForTimeout(1100);
  const f = await page.evaluate(ESCAPE_JS);
  const r = await page.evaluate(()=>{ const c=window.__ascent.player.cam; return { tilt:+(c.tilt??-1).toFixed(3), want:+(c._tiltWant??-1).toFixed(3), lift:+(c.lift??-1).toFixed(2), el:+(c._axisEl??0).toFixed(3), hit:+(c._hit??0).toFixed(2) }; });
  console.log(`${String(b.where).padEnd(20)} tilt ${r.tilt} want ${r.want} lift ${r.lift} axisEl ${r.el} boom ${r.hit} | seeFar ${f.seeFar} short ${f.short} open ${f.open} -> ${notFree(f)||'FREE'}`);
}
await browser.close();
