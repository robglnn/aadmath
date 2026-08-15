import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle','--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport:{width:1280,height:800} })).newPage();
await p.addInitScript(()=>{try{localStorage.clear()}catch{}});
await p.goto(process.argv[2]||'http://127.0.0.1:4489',{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:60000});
await p.waitForTimeout(2500);
await p.evaluate(()=>{ for(let i=0;i<80;i++) window.__ascent.earn(6,'vein'); });
await p.waitForTimeout(1600);
console.log(JSON.stringify(await p.evaluate(()=>{
  const r=(s)=>{const e=document.querySelector(s); if(!e) return null; const b=e.getBoundingClientRect(); return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)};};
  const rows=[...document.querySelectorAll('.led-row')].map(e=>{const b=e.getBoundingClientRect();return {cls:e.className,x:Math.round(b.x),w:Math.round(b.width),h:Math.round(b.height)};});
  return {ledger:r('.ledger'), comms:r('.meta-comms'), rows};
}),null,1));
await b.close();
