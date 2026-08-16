import { chromium } from 'playwright';
const b = await chromium.launchServer({ headless: true, port: 9987, wsPath: 'w13',
  args: ['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-features=DarkMode'] });
console.log('WS', b.wsEndpoint());
await new Promise(()=>{});
