import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const OUT = path.resolve('/tmp/critic-shadowdiff');
await mkdir(OUT, { recursive: true });
const W=1600,H=900;
const browser = await chromium.launch({ args:['--use-gl=angle','--ignore-gpu-blocklist','--enable-gpu-rasterization','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
const ctx = await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:2});
const page = await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
await page.goto('http://127.0.0.1:4788/',{waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.__ascent);
await page.waitForTimeout(2200);
await page.addStyleTag({content:'.meta-comms,.meta-open,.hud,[class*="hud"],[class*="meta-"]{opacity:0 !important}'});
await page.keyboard.down('KeyW'); await page.waitForTimeout(300); await page.keyboard.up('KeyW');
await page.waitForTimeout(1200);

const p = await page.evaluate(()=>{const a=window.__ascent;
  const v=new a.THREE.Vector3(a.player.pos.x,a.player.pos.y,a.player.pos.z); v.project(a.camera);
  return {fx:(v.x*.5+.5)*innerWidth, fy:(-v.y*.5+.5)*innerHeight};});
const clip = {x:Math.max(0,p.fx-320), y:Math.max(0,p.fy-380), width:640, height:560};

const a = (await page.screenshot({clip})).toString('base64');
await page.evaluate(()=>{ window.__ascent.player.root.visible=false; });
await page.waitForTimeout(500);
const b = (await page.screenshot({clip})).toString('base64');
await page.evaluate(()=>{ window.__ascent.player.root.visible=true; });

const res = await page.evaluate(async ({a,b})=>{
  const load = s => new Promise(r=>{const i=new Image(); i.onload=()=>r(i); i.src='data:image/png;base64,'+s;});
  const [A,B] = await Promise.all([load(a),load(b)]);
  const c = document.createElement('canvas'); c.width=A.width; c.height=A.height;
  const g = c.getContext('2d');
  g.drawImage(A,0,0); const da = g.getImageData(0,0,c.width,c.height);
  g.clearRect(0,0,c.width,c.height); g.drawImage(B,0,0); const db = g.getImageData(0,0,c.width,c.height);
  const out = g.createImageData(c.width,c.height);
  let maxDark=0, darkPx=0, sum=0, n=0;
  for(let i=0;i<da.data.length;i+=4){
    const la = 0.2126*da.data[i]+0.7152*da.data[i+1]+0.0722*da.data[i+2];
    const lb = 0.2126*db.data[i]+0.7152*db.data[i+1]+0.0722*db.data[i+2];
    const d = lb-la; // positive = darker with the rig present  => shadow
    if (d>4){ darkPx++; sum+=d; if(d>maxDark) maxDark=d; }
    const v = Math.max(0, Math.min(255, d*6));
    out.data[i]=v; out.data[i+1]=v; out.data[i+2]=v; out.data[i+3]=255;
    n++;
  }
  g.putImageData(out,0,0);
  return { png: c.toDataURL().split(',')[1], maxDark:+maxDark.toFixed(1), darkFrac:+(darkPx/n).toFixed(4), meanDark:+(sum/Math.max(1,darkPx)).toFixed(2), w:c.width,h:c.height };
}, {a,b});
await writeFile(path.join(OUT,'with.png'), Buffer.from(a,'base64'));
await writeFile(path.join(OUT,'without.png'), Buffer.from(b,'base64'));
await writeFile(path.join(OUT,'diff.png'), Buffer.from(res.png,'base64'));
console.log(JSON.stringify({maxDark:res.maxDark, darkFrac:res.darkFrac, meanDark:res.meanDark, errs}));
await browser.close();
