import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const OUT = path.resolve('/tmp/critic-shadow2');
await mkdir(OUT, { recursive: true });
const W=1600,H=900;
const browser = await chromium.launch({ args:['--use-gl=angle','--ignore-gpu-blocklist','--enable-gpu-rasterization','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
const ctx = await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:2});
const page = await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
await page.goto('http://127.0.0.1:4788/',{waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.__ascent);
await page.waitForTimeout(2200);
await page.addStyleTag({content:'.meta-comms,.meta-open{opacity:0!important}'});
await page.keyboard.down('KeyW'); await page.waitForTimeout(300); await page.keyboard.up('KeyW');
await page.waitForTimeout(900);

async function probe(tag, setup){
  await page.evaluate(setup);
  await page.waitForTimeout(900);
  const p = await page.evaluate(()=>{const a=window.__ascent;
    const v=new a.THREE.Vector3(a.player.pos.x,a.player.pos.y,a.player.pos.z); v.project(a.camera);
    return {fx:(v.x*.5+.5)*innerWidth, fy:(-v.y*.5+.5)*innerHeight, y:a.player.pos.y};});
  const clip={x:Math.max(0,Math.min(W-700,p.fx-350)), y:Math.max(0,Math.min(H-500,p.fy-200)), width:700, height:500};
  const A=(await page.screenshot({clip})).toString('base64');
  await page.evaluate(()=>{window.__ascent.player.root.visible=false;});
  await page.waitForTimeout(400);
  const B=(await page.screenshot({clip})).toString('base64');
  await page.evaluate(()=>{window.__ascent.player.root.visible=true;});
  const r = await page.evaluate(async ({a,b})=>{
    const load=s=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src='data:image/png;base64,'+s;});
    const [A,B]=await Promise.all([load(a),load(b)]);
    const c=document.createElement('canvas');c.width=A.width;c.height=A.height;const g=c.getContext('2d');
    g.drawImage(A,0,0);const da=g.getImageData(0,0,c.width,c.height);
    g.clearRect(0,0,c.width,c.height);g.drawImage(B,0,0);const db=g.getImageData(0,0,c.width,c.height);
    const out=g.createImageData(c.width,c.height);
    let px=0,sum=0,max=0,n=0;
    for(let i=0;i<da.data.length;i+=4){
      const la=0.2126*da.data[i]+0.7152*da.data[i+1]+0.0722*da.data[i+2];
      const lb=0.2126*db.data[i]+0.7152*db.data[i+1]+0.0722*db.data[i+2];
      // shadow = ground got darker when the rig is present, and the rig itself is not there
      const bright = lb; const d=lb-la;
      if(d>6 && bright>40){px++;sum+=d;if(d>max)max=d;}
      const v=Math.max(0,Math.min(255,d*6));
      out.data[i]=v;out.data[i+1]=v;out.data[i+2]=v;out.data[i+3]=255;n++;
    }
    g.putImageData(out,0,0);
    return {png:c.toDataURL().split(',')[1], frac:+(px/n).toFixed(4), mean:+(sum/Math.max(1,px)).toFixed(1), max:+max.toFixed(1)};
  },{a:A,b:B});
  await writeFile(path.join(OUT,tag+'-with.png'),Buffer.from(A,'base64'));
  await writeFile(path.join(OUT,tag+'-diff.png'),Buffer.from(r.png,'base64'));
  console.log(tag, JSON.stringify({y:+p.y.toFixed(1),frac:r.frac,mean:r.mean,max:r.max}));
}

// stand on the plaza
await probe('plaza-ground', ()=>{const a=window.__ascent; a.player.pos.set(0,58.6,8); a.player.vel.set(0,0,0);});
// hover 2.5 m over the plaza
await probe('plaza-air', ()=>{const a=window.__ascent; a.player.pos.set(0,61.2,8); a.player.vel.set(0,0,0);});
await probe('plaza-air5', ()=>{const a=window.__ascent; a.player.pos.set(0,63.6,8); a.player.vel.set(0,0,0);});
console.log('ERRORS',errs);
await browser.close();
