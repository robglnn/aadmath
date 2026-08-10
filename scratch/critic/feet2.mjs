import { chromium } from 'playwright';
const browser = await chromium.launch({ args:['--use-gl=angle','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
const page = await (await browser.newContext({viewport:{width:1280,height:720}})).newPage();
await page.goto('http://127.0.0.1:4788/',{waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.__ascent);
await page.waitForTimeout(2200);
console.log('legKeys', await page.evaluate(()=>Object.keys(window.__ascent.player.rig.legL)));

// sample foot world positions while sprinting on flat ground
await page.evaluate(()=>{ window.__ascent.player.pos.set(0,58.6,20); });
await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
await page.waitForTimeout(700);
const samples = await page.evaluate(async ()=>{
  const a=window.__ascent, T=a.THREE;
  const L=a.player.rig.legL, R=a.player.rig.legR;
  const pick = o => o.foot||o.shin||o.boot||o.lower||o.group||o;
  const fl=pick(L), fr=pick(R);
  const out=[]; const v=new T.Vector3();
  for(let i=0;i<70;i++){
    await new Promise(r=>requestAnimationFrame(r));
    fl.updateWorldMatrix(true,false); fr.updateWorldMatrix(true,false);
    const l=v.setFromMatrixPosition(fl.matrixWorld).clone();
    const r=new T.Vector3().setFromMatrixPosition(fr.matrixWorld);
    out.push({t:performance.now(), lx:+l.x.toFixed(3),ly:+l.y.toFixed(3),lz:+l.z.toFixed(3),
              rx:+r.x.toFixed(3),ry:+r.y.toFixed(3),rz:+r.z.toFixed(3),
              px:+a.player.pos.x.toFixed(3),pz:+a.player.pos.z.toFixed(3), py:+a.player.pos.y.toFixed(3)});
  }
  return out;
});
await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
console.log(JSON.stringify(samples));
await browser.close();
