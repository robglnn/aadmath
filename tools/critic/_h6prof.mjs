import { chromium } from 'playwright';
const b=await chromium.launch({headless:true,args:['--use-gl=angle','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const page=await (await b.newContext({viewport:{width:800,height:600}})).newPage();
await page.goto('http://127.0.0.1:4777',{waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await page.waitForTimeout(3000);
const out=await page.evaluate(()=>{
  const A=window.__ascent, h=A.world.heightAt;
  const caches=A.caches.state().at;
  const res=[];
  for(const c of caches){
    const ang=Math.atan2(c.x,c.z);
    const prof=[];
    for(let r=0;r<=166;r+=8){ prof.push([r, Math.round(h(Math.sin(ang)*r, Math.cos(ang)*r))]); }
    res.push({i:c.i,cx:c.x,cy:Math.round(c.y),cz:c.z,dist:Math.round(Math.hypot(c.x,c.z)),prof});
  }
  // spans too
  const spans=A.spans.state().at.map(s=>({i:s.i,x:s.x,y:s.y,z:s.z,dist:Math.round(Math.hypot(s.x,s.z)),need:s.need}));
  return {res,spans, maxH: (()=>{let m=0,at=null;for(let x=-160;x<=160;x+=8)for(let z=-160;z<=160;z+=8){const y=h(x,z);if(y>m){m=y;at=[x,z]}}return {m:Math.round(m),at}})()};
});
console.log(JSON.stringify(out,null,1));
await b.close();
