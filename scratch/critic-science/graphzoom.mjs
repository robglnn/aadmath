import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 3 })).newPage();
await page.goto('http://127.0.0.1:4787/?unit=algebra1-l2', { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
await page.waitForTimeout(2500);
const meta = await page.evaluate(() => {
  const r = window.__ascent.showItem('slope-rate', { difficulty: 4, form: 'sr-graph', seed: 12345 });
  const it = window.__ascent.panel.item;
  return { answer: String(r.answer), latex: it.latex, prompt: it.prompt, plot: JSON.stringify(it.plot || it.graph || it.points || null) };
});
console.log(JSON.stringify(meta, null, 1));
await page.waitForTimeout(1200);
const el = await page.$('#rift svg, #rift canvas, .rf-plot, [class*="plot"]');
if (el) await el.screenshot({ path: 'shots/science-l2/ZOOM-graph.png' });
else console.log('no plot element found');
await browser.close();
