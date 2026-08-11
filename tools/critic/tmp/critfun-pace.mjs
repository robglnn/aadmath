import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--use-gl=angle','--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({viewport:{width:1280,height:720}})).newPage();
await p.goto('http://127.0.0.1:4788',{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:60000});
await p.waitForTimeout(2500);
const r = await p.evaluate(() => {
  const A = window.__ascent;
  const secs = [];
  for (const id of A.skillIds) {
    const t = A.task(id);
    if (t) secs.push({ id, kind: t.kind, s: A.itemSeconds(t) ?? null });
  }
  const plan = A.session.state();
  return { secs, plan };
});
console.log(JSON.stringify(r, null, 1).slice(0, 2000));
await b.close();
