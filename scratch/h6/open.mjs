import { connect, shot, textDump } from './lib.mjs';
const { b, ctx, page } = await connect();
await ctx.clearCookies();
await page.addInitScript(() => {
  window.__h6 = { errs: [] };
  const ce = console.error.bind(console);
  console.error = (...a) => { try { window.__h6.errs.push('console.error: ' + a.map(x => (x && x.stack) || String(x)).join(' ')); } catch (e) {} ce(...a); };
  const cw = console.warn.bind(console);
  console.warn = (...a) => { try { window.__h6.errs.push('console.warn: ' + a.map(String).join(' ')); } catch (e) {} cw(...a); };
  window.addEventListener('error', e => window.__h6.errs.push('onerror: ' + (e.message || '') + ' @ ' + (e.filename || '')));
  window.addEventListener('unhandledrejection', e => window.__h6.errs.push('unhandledrejection: ' + String(e.reason)));
  try { localStorage.clear(); } catch (e) {}
});
await page.goto('http://127.0.0.1:4791/', { waitUntil: 'load' });
await page.waitForTimeout(1500);
await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(6000);
console.log(await textDump(page));
console.log('--- errs', JSON.stringify(await page.evaluate(() => window.__h6 && window.__h6.errs)));
await shot(page, '01-boot');
process.exit(0);
