import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await (await b.newContext({viewport:{width:1280,height:720}})).newPage();
await p.goto('http://127.0.0.1:5173', { waitUntil:'networkidle' });
await p.waitForFunction(() => !!window.__ascent, null, {timeout:30000});
await p.waitForTimeout(3000);
console.log(await p.evaluate(() => {
  const a = window.__ascent;
  let lo = Infinity, hi = -Infinity, n=0;
  const R = 200;
  for (let x=-R;x<=R;x+=4) for (let z=-R;z<=R;z+=4){
    const h = a.islandAt(x,z);
    if (typeof h==='number' && isFinite(h)) { n++; if(h<lo)lo=h; if(h>hi)hi=h; }
  }
  // coast radius sample
  const rs=[];
  for (let ang=0; ang<6.28; ang+=0.6){
    let r=0; for(let rr=0;rr<300;rr+=2){ if(a.islandAt(Math.cos(ang)*rr, Math.sin(ang)*rr)!==null) r=rr; }
    rs.push(Math.round(r));
  }
  return { lo, hi, n, coast: rs, spawn: {...a.player.pos} };
}));
await b.close();
