import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://127.0.0.1:5173';
const b = await chromium.launch({ args:['--use-gl=angle','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
const ctx = await b.newContext({ viewport:{width:1280,height:720} });
const page = await ctx.newPage();
await page.addInitScript(()=>{ try{ localStorage.clear(); }catch{} });
await page.goto(URL,{waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await page.waitForTimeout(2500);
const out = await page.evaluate(()=>{
  const A=window.__ascent;
  const prof=[];
  for(let z=26;z>=-40;z-=2) prof.push([z, A.islandAt(0,z)]);
  // pairwise rift distances
  const L=A.rifts.list; const pairs=[];
  for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){
    const d=Math.hypot(L[i].foot.x-L[j].foot.x, L[i].foot.z-L[j].foot.z);
    if(d<20) pairs.push([L[i].id,L[j].id,+d.toFixed(2)]);
  }
  return {prof, pairs, spawnHead:A.player.yaw ?? null, camDir: (()=>{const v=new A.THREE.Vector3();A.camera.getWorldDirection(v);return [+v.x.toFixed(2),+v.y.toFixed(2),+v.z.toFixed(2)];})()};
});
console.log(JSON.stringify(out.pairs));
console.log('camDir',out.camDir);
console.log(out.prof.map(([z,h])=>`z=${z} h=${h===null?'NULL':h.toFixed(1)}`).join('\n'));
await b.close();
