/** Defect 5: is the progress panel closeable by keyboard after the Learner Record opens? */
import { chromium } from 'playwright';
const URL = 'http://127.0.0.1:4321';
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
await page.waitForTimeout(3500);
await page.keyboard.press('KeyW'); await page.waitForTimeout(600);
const shown = (sel) => page.evaluate((s) => { const el = document.querySelector(s); return !!el && el.classList.contains('show'); }, sel);
const report = () => shown('.rp-scrim');
const rec = () => shown('.rp-doc-host');
async function tap(k, ms = 700) { await page.keyboard.press(k); await page.waitForTimeout(ms); }

await tap('KeyP');
console.log('1. P opens the progress panel:', await report());
await tap('Escape');
console.log('2. Escape closes it:', !(await report()));
await tap('KeyP');
console.log('3. P opens it again:', await report());
// open the Learner Record
const t = await page.$('.rp-teacher');
console.log('   teacher button found:', !!t);
if (t) { await t.click(); await page.waitForTimeout(900); }
console.log('4. the Learner Record is open:', await rec());
await tap('Escape');
console.log('5. Escape closes the record:', !(await rec()), '  (record still open =', await rec(), ')');
await tap('Escape');
console.log('6. Escape closes the progress panel:', !(await report()), '  (panel still open =', await report(), ')');
await tap('KeyP');
console.log('7. P toggles the panel:', await report() ? 'panel open' : 'panel closed');
await tap('KeyP');
console.log('8. P again:', await report() ? 'panel open' : 'panel closed');
console.log('errors', errs.length, errs.slice(0,3));
await b.close();
