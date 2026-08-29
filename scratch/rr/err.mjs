import { chromium } from 'playwright';
const b = await chromium.launch({args:['--use-gl=angle','--enable-unsafe-swiftshader']});
const p = await (await b.newContext()).newPage();
p.on('console',m=>console.log(m.type(),m.text().slice(0,300)));
p.on('pageerror',e=>console.log('PAGEERROR',e.message.slice(0,500)));
await p.goto(process.argv[2],{waitUntil:'networkidle'});
await p.waitForTimeout(4000);
console.log('ascent?', await p.evaluate(()=>!!window.__ascent));
await b.close();
