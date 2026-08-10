import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const OUT = path.resolve('/tmp/critic-sweep');
await mkdir(OUT, { recursive: true });
const W=1600,H=900;
const browser = await chromium.launch({ args:['--use-gl=angle','--ignore-gpu-blocklist','--enable-gpu-rasterization','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
const ctx = await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:1});
const page = await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(e.message)); page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await page.goto('http://127.0.0.1:4788/',{waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.__ascent);
await page.waitForTimeout(2200);
await page.addStyleTag({content:'.meta-comms,.meta-open{opacity:0!important}'});
await page.keyboard.down('KeyW'); await page.waitForTimeout(300); await page.keyboard.up('KeyW');
await page.mouse.move(W/2,H/2); await page.mouse.click(W/2,H/2); await page.waitForTimeout(200); await page.keyboard.press('KeyQ');
await page.waitForTimeout(600);

// how close does the lens sit to the geometry? measure per-frame over a long sprint
const results=[];
for (let d=0; d<8; d++){
  await page.evaluate(()=>{ const a=window.__ascent; a.player.pos.set(0,58.5,26); a.player.vel.set(0,0,0); });
  await page.waitForTimeout(500);
  // aim the camera by nudging the mouse: yaw is driven by mouse dx
  const target = d*Math.PI/4;
  await page.evaluate((t)=>{ const a=window.__ascent; a.player.yaw=t; if(a.player.cam) a.player.cam.yaw=t; }, target);
  await page.waitForTimeout(300);
  await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
  let worst=null;
  for (let i=0;i<18;i++){
    await page.waitForTimeout(120);
    const m = await page.evaluate(()=>{
      const a=window.__ascent, T=a.THREE;
      const cam=a.camera;
      // nearest scene surface in front of the lens, in any of 9 directions
      const rc=new T.Raycaster(); rc.far=2.0;
      const solids=[]; a.scene.traverse(o=>{ if(o.isMesh&&o.visible&&o!==a.player.root&&!a.player.root.getObjectById?.(o.id)) solids.push(o); });
      let min=99;
      const dirs=[[0,0,-1],[0.5,0,-1],[-0.5,0,-1],[0,0.5,-1],[0,-0.5,-1],[1,0,0],[-1,0,0],[0,-1,0]];
      for(const d of dirs){
        const v=new T.Vector3(...d).normalize().applyQuaternion(cam.quaternion);
        rc.set(cam.position, v);
        const hit=rc.intersectObjects(solids,false)[0];
        if(hit && hit.distance<min) min=hit.distance;
      }
      return { min:+min.toFixed(3), y:+a.player.pos.y.toFixed(1), boom:+(a.player.cam?.boom??0).toFixed(2) };
    });
    if(!worst || m.min<worst.min) worst=m;
  }
  await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
  await page.waitForTimeout(200);
  await page.screenshot({path:path.join(OUT,`dir${d}.png`)});
  results.push({dir:d, ...worst});
  console.log('dir',d,JSON.stringify(worst));
}
console.log('ERRORS',errs);
await browser.close();
