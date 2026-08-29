import { chromium } from 'playwright';
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>=0?process.argv[i+1]:d;};
const b=await chromium.launch({args:['--use-gl=angle','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await (await b.newContext({viewport:{width:1280,height:720}})).newPage();
await p.goto(arg('url','http://127.0.0.1:4996'),{waitUntil:'networkidle'});
await p.waitForFunction(()=>!!window.__ascent,null,{timeout:30000});
for (const w of [0, 1000, 3000, 6000]) {
  await p.waitForTimeout(w ? 1000 : 0);
  console.log('t~'+w, JSON.stringify(await p.evaluate(()=>window.__ascent.deck())));
}
await b.close();
