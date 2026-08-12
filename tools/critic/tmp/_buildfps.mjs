/** Frame cost with the build verb actually in use: hand out, grid up, a box
 *  standing around the cadet so the seal fill runs every frame. */
import { chromium } from 'playwright';
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>=0?process.argv[i+1]:d;};
const URL=arg('url','http://127.0.0.1:5173');
const b=await chromium.launch({args:['--use-gl=angle','--ignore-gpu-blocklist','--disable-gpu-vsync','--disable-frame-rate-limit']});
const c=await b.newContext({viewport:{width:1600,height:900},deviceScaleFactor:2});
const p=await c.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.goto(URL,{waitUntil:'networkidle'});
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await p.waitForTimeout(3500);
await p.keyboard.press('Digit1'); await p.waitForTimeout(500);
// three walls around him, via the rig (this measures frame cost, not aim)
await p.evaluate(()=>{ const a=window.__ascent,bd=a.builder; bd.charge=1e6; bd.maxCharge=1e6;
  for (const y of [0,Math.PI/2,Math.PI]) { a.player.yaw=y; bd.place(); } a.player.yaw=-Math.PI/2; });
const run = async (label) => {
  await p.evaluate(()=>{window.__f=[];const g=()=>{window.__f.push(performance.now());requestAnimationFrame(g);};requestAnimationFrame(g);});
  await p.waitForTimeout(4000);
  const d = await p.evaluate(()=>{const f=window.__f,o=[];for(let i=1;i<f.length;i++)o.push(f[i]-f[i-1]);o.sort((x,y)=>x-y);return o;});
  const q=(k)=>d[Math.floor(d.length*k)];
  console.log(`${label.padEnd(22)} median ${q(0.5).toFixed(2)}ms = ${(1000/q(0.5)).toFixed(1)}fps   p95 ${q(0.95).toFixed(1)}ms`);
};
await run('hand out + 3 walls');
// hold the trigger so target() + the seal fill run under load
await p.mouse.move(1180,520);
await run('preview live');
console.log('errors', errs.length, errs.slice(0,2).join(' | '));
await b.close();
