import { chromium } from 'playwright';
const b = await chromium.launch({args:['--use-gl=angle','--enable-unsafe-swiftshader']});
for (const loc of ['en','es','pl']) {
const c = await b.newContext({viewport:{width:844,height:390},hasTouch:true});
const p = await c.newPage();
await p.goto('http://127.0.0.1:5173',{waitUntil:'networkidle'});
await p.evaluate(()=>{try{localStorage.clear()}catch{}});
await p.reload({waitUntil:'networkidle'});
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await p.evaluate((l)=>window.__ascent.setLocale(l), loc);
await p.evaluate(()=>document.getElementById('boot')?.classList.add('gone'));
await p.waitForTimeout(2000);
const go = await p.waitForSelector('.ses-charter.show .sc-go',{timeout:60000}).catch(()=>null);
if (go) { await go.click(); await p.waitForTimeout(900); }
console.log(loc, await p.evaluate(()=>{
  const dump=(s)=>{const e=document.querySelector(s); if(!e) return s+':—';
    const r=e.getBoundingClientRect();
    return s+` ${Math.round(r.height)} [`+[...e.children].map(k=>k.className+':'+Math.round(k.getBoundingClientRect().height)).join(' ')+']';};
  return [dump('.ses-band'),dump('.gd-card'),dump('.meta-quest'),dump('#rig'),
    'gd-h='+getComputedStyle(document.getElementById('ui')).getPropertyValue('--gd-h')].join('\n   ');
}));
await c.close();
}
await b.close();
