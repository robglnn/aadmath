import { chromium } from 'playwright';
const b = await chromium.launch({args:['--use-gl=angle','--enable-unsafe-swiftshader']});
const p = await (await b.newContext()).newPage();
p.on('console', m=>console.log('['+m.type()+']', m.text().slice(0,600)));
p.on('pageerror', e=>console.log('[pageerror]', e.message.slice(0,600)));
await p.goto(process.argv[2], {waitUntil:'networkidle'});
await p.waitForTimeout(6000);
await b.close();
