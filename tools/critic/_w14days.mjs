import { chromium } from 'playwright';
const b=await chromium.launch({args:['--use-gl=angle','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const p=await (await b.newContext({viewport:{width:1200,height:700}})).newPage();
await p.goto('http://127.0.0.1:4917',{waitUntil:'networkidle'});
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await p.evaluate(()=>{localStorage.clear();localStorage.setItem('ascent.locale','en');});
await p.reload({waitUntil:'networkidle'});
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
await p.waitForTimeout(2000);
const read=()=>p.evaluate(()=>{
  const A=window.__ascent;
  const s=A.story||{};
  const out={ storyKeys:Object.keys(s).slice(0,40) };
  try{out.days = s.days ? (typeof s.days==='function'? s.days(): s.days) : null;}catch(e){out.daysErr=String(e);}
  try{out.raw = JSON.parse(localStorage.getItem('ascent.save')||'{}').days||null;}catch(e){}
  out.wardens=A.wardens.state();
  return out;
});
for (let i=0;i<6;i++){
  // one real answer per day through the panel's own input path
  await p.evaluate(()=>{const A=window.__ascent;const r=A.rifts.list.find(x=>!x.sealed)||A.rifts.list[0];A.teleportTo(r.id);});
  await p.waitForTimeout(600);
  for(let k=0;k<8;k++){await p.keyboard.press('KeyE');await p.waitForTimeout(300);const o=await p.evaluate(()=>window.__ascent.panelInfo().open);if(o)break;}
  const c=await p.evaluate(()=>window.__ascent.panelInfo());
  if(c.open&&c.mode==='keypad'){for(const ch of String(c.answer??'')){await p.keyboard.press(ch==='-'?'Minus':ch);await p.waitForTimeout(40);}await p.keyboard.press('Enter');}
  else if(c.open&&c.mode==='choice'){const bt=p.locator('.rf-reading');const n=await bt.count();for(let j=0;j<n;j++){if(String(await bt.nth(j).getAttribute('data-value'))===String(c.answer)){await bt.nth(j).click().catch(()=>{});break;}}}
  await p.waitForTimeout(2500);
  console.log('day',i+1,JSON.stringify(await read()).slice(0,600));
  await p.evaluate(()=>window.__ascent.advanceDays(1));
  await p.waitForTimeout(400);
  await p.reload({waitUntil:'networkidle'});
  await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
  await p.waitForTimeout(2000);
}
console.log('FINAL',JSON.stringify(await read()).slice(0,800));
await b.close();
