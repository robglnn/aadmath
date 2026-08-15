/**
 * The far end of the ladder, said out loud (temporary probe).
 * Gets to 219 seals, lets every chapter beat drain, then crosses 220, 280 and
 * 340 one tear at a time and reads the real transcript back.
 */
import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://127.0.0.1:4490';
const b = await chromium.launch({ args: ['--use-gl=angle','--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport:{width:1280,height:800} })).newPage();
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
await p.addInitScript(()=>{try{localStorage.clear()}catch{}});
await p.goto(URL,{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:60000});
await p.waitForTimeout(3000);
await p.evaluate(()=>window.__ascent.story.seal(219));
// let the cold open and every chapter plate drain — a turn clears the channel
await p.waitForTimeout(60000);
for (const to of [220, 280, 340]) {
  await p.evaluate((n)=>{ const s=window.__ascent.story.state().seals; window.__ascent.story.seal(Math.max(1, n-s)); }, to);
  await p.waitForTimeout(14000);
}
const said = await p.evaluate(()=>window.__ascent.story.said().map(s=>({tag:s.tag,text:s.text})));
console.log('milestone beats actually spoken:');
for (const s of said.filter(x=>(x.tag||'').includes('mile'))) console.log(`   ${s.tag}  ${s.text.slice(0,88)}`);
console.log(`seals ${await p.evaluate(()=>window.__ascent.story.state().seals)}  errors ${errs.length}`);
await b.close();
