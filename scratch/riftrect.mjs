import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4791');
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const c = await b.newContext({ viewport: { width: 414, height: 896 } });
const p = await c.newPage();
await p.goto(URL, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => !!window.__ascent, null, { timeout: 90000 });
await p.waitForTimeout(2500);
await p.evaluate(() => window.__ascent.openRiftById('var-meaning'));
await p.waitForTimeout(800);
console.log(JSON.stringify(await p.evaluate(() => {
  const r = (s) => { const e = document.querySelector(s); if (!e) return null; const x = e.getBoundingClientRect(); return { t: +x.top.toFixed(1), b: +x.bottom.toFixed(1), h: +x.height.toFixed(1) }; };
  const cs = getComputedStyle(document.querySelector('#ui'));
  return {
    win: innerHeight, app: r('#app'), ui: r('#ui'), rift: r('.rift'), frame: r('.rf-frame'), plate: r('#rf-plate'),
    uiPad: [cs.paddingTop, cs.paddingBottom], safe: getComputedStyle(document.documentElement).getPropertyValue('--safe'),
    riftPad: getComputedStyle(document.querySelector('.rift')).padding,
  };
}), null, 1));
await b.close();
