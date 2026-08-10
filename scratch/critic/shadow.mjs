import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const OUT = path.resolve(process.argv[2] || '/tmp/critic-shadow');
await mkdir(OUT, { recursive: true });
const W=1600,H=900;
const browser = await chromium.launch({ args:['--use-gl=angle','--ignore-gpu-blocklist','--enable-gpu-rasterization','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
const ctx = await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:2});
const page = await ctx.newPage();
const errs=[]; page.on('console',m=>{if(m.type()==='error')errs.push(m.text());}); page.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
await page.goto('http://127.0.0.1:4788/',{waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.__ascent);
await page.waitForTimeout(2000);
console.log('rifts', await page.evaluate(()=>window.__ascent.rifts.list.map(r=>r.id)));
console.log('sun', await page.evaluate(()=>{
  const a=window.__ascent; const out=[];
  a.scene.traverse(o=>{ if(o.isLight) out.push({type:o.type,pos:o.position.toArray().map(v=>+v.toFixed(2)),cast:!!o.castShadow, intensity:o.intensity, mapSize:o.shadow?.mapSize?.toArray?.()}); });
  return out;
}));
// how many meshes cast/receive
console.log('shadowStats', await page.evaluate(()=>{
  const a=window.__ascent; let cast=0,recv=0,mesh=0;
  a.scene.traverse(o=>{ if(o.isMesh){mesh++; if(o.castShadow)cast++; if(o.receiveShadow)recv++;} });
  return {mesh,cast,recv, shadowMapEnabled:a.engine.renderer.shadowMap.enabled, type:a.engine.renderer.shadowMap.type};
}));
await browser.close();
console.log('errs',errs);
