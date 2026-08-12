import { chromium } from 'playwright';
const b = await chromium.launch({args:['--use-gl=angle','--enable-unsafe-swiftshader']});
const c = await b.newContext({viewport:{width:844,height:390},hasTouch:true});
const p = await c.newPage();
await p.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});
await p.evaluate(()=>{try{localStorage.clear()}catch{}});
await p.reload({waitUntil:'networkidle'});
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await p.evaluate(()=>document.getElementById('boot')?.classList.add('gone'));
await p.waitForTimeout(2000);
const go = await p.waitForSelector('.ses-charter.show .sc-go',{timeout:60000}).catch(()=>null);
if (go) { await go.click(); await p.waitForTimeout(900); }
console.log(await p.evaluate(()=>{
  const out=[];
  for (const root of ['#ui','#app']) for (const e of document.querySelectorAll(root+' > *')) {
    const cs=getComputedStyle(e); if(cs.position==='static') continue;
    const r=e.getBoundingClientRect();
    out.push(`${(e.className||e.id||e.tagName).toString().slice(0,26).padEnd(28)} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)} z=${cs.zIndex} op=${(+cs.opacity).toFixed(2)} vis=${cs.visibility.slice(0,4)}`);
  }
  return out.join('\n');
}));
await b.close();
