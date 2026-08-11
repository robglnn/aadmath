import { chromium } from 'playwright';
const b = await chromium.launch({args:['--use-gl=angle','--ignore-gpu-blocklist','--enable-gpu-rasterization','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit']});
for(const [W,H] of [[414,896],[1280,720]]){
 const p = await (await b.newContext({viewport:{width:W,height:H},deviceScaleFactor:2,hasTouch:W<700,isMobile:W<700})).newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
 await p.goto('http://127.0.0.1:4791',{waitUntil:'networkidle'});
 await p.waitForFunction(()=>!!window.__ascent); await p.waitForTimeout(3000);
 const perf = await p.evaluate(async()=>{const a=window.__ascent;
  a.player.pos.set(0,(a.player.groundAt(0,26)??12)+0.4,26); a.player.vel.set(0,0,0); a.player.yaw=Math.PI; a.player.pitch=-0.14;
  await new Promise(r=>setTimeout(r,900));
  const dts=[];let last=performance.now();
  await new Promise(res=>{let n=0;const step=()=>{const t=performance.now();dts.push(t-last);last=t;if(++n<160)requestAnimationFrame(step);else res();};requestAnimationFrame(step);});
  const s=dts.slice(40).sort((x,y)=>x-y); const q=p=>s[Math.floor(s.length*p)];
  return {fps:1000/q(0.5),low:1000/q(0.99),p95:q(0.95),scale:a.fx.renderScale,pr:a.engine.renderer.getPixelRatio(),tier:a.fx.tier};});
 console.log(`${W}x${H}: median ${perf.fps.toFixed(1)} fps, 1% low ${perf.low.toFixed(1)}, p95 ${perf.p95.toFixed(1)}ms, renderScale ${perf.scale.toFixed(2)}, pr ${perf.pr.toFixed(2)}, fxTier ${perf.tier}, errors ${errs.length}`);
 await p.close();
}
await b.close();
