import { chromium } from 'playwright';
const URL = 'http://127.0.0.1:4399';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
page.on('console', (m) => console.log('[page]', m.type(), m.text()));
await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent);
await page.waitForTimeout(16000);
await page.keyboard.press('Digit2');
await page.waitForTimeout(400);

await page.evaluate(() => {
  addEventListener('mousedown', (e) => {
    const chain = [];
    for (let n = e.target; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      chain.push(`${n.tagName}.${n.className}|op=${cs.opacity}|cur=${cs.cursor}|pe=${cs.pointerEvents}`);
    }
    console.log('DOWN target chain: ' + chain.join('  <<  '));
    console.log('worldPointer=' + window.__ascent.input.worldPointer(e) + ' locked=' + window.__ascent.input.locked + ' uiOpen=' + window.__ascent.input.uiOpen);
  }, true);
});
const box = await page.evaluate(() => document.querySelector('#buildbar .slot').getBoundingClientRect().toJSON());
console.log('ui class', await page.evaluate(() => document.getElementById('ui').className));
console.log('buildbar pe/op', await page.evaluate(() => { const b=document.getElementById('buildbar'); const cs=getComputedStyle(b); return cs.pointerEvents+' '+cs.opacity+' '+JSON.stringify(b.getBoundingClientRect()); }));
console.log('elemFromPoint', await page.evaluate((b) => { const e=document.elementFromPoint(b.x+b.width/2,b.y+14); return e? e.tagName+'.'+e.className : 'none'; }, box));
const b4 = await page.evaluate(() => window.__ascent.builder.solids.owned);
await page.mouse.click(box.x + box.width / 2, box.y + 14);
await page.waitForTimeout(700);
console.log('owned', b4, '->', await page.evaluate(() => window.__ascent.builder.solids.owned));
console.log('slot', await page.evaluate(() => window.__ascent.builder.slot));
await browser.close();
