import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4577');
const OUT = path.resolve(arg('out', 'shots/fun-open'));
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--disable-gpu-vsync'] });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('ERR', m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
const t0 = Date.now();
let seen = new Set();
for (let i = 0; i < 90; i++) {
  const s = await page.evaluate(() => {
    const a = window.__ascent;
    const vis = [...document.querySelectorAll('[class*="ses-"], [class*="rite"], [class*="dossier"], .cmm, .beckon, .afford')].filter((e) => e.offsetParent && (e.innerText || '').trim());
    return {
      phase: a.state().session.phase,
      charter: !!document.querySelector('.ses-charter.show'),
      band: (document.querySelector('.ses-band')?.innerText || '').replace(/\n/g, ' | '),
      voice: (document.querySelector('.cmm-line, .comms .line, [class*="cmm"]')?.innerText || '').slice(0, 120),
      vis: vis.map((e) => e.className.split(' ')[0]).slice(0, 8),
    };
  });
  const key = JSON.stringify(s);
  if (!seen.has(key)) { seen.add(key); console.log(`t=${((Date.now() - t0) / 1000).toFixed(1)}s ${key}`); }
  if (s.charter) { await page.screenshot({ path: path.join(OUT, 'charter.png') }); console.log('CHARTER TEXT:', (await page.evaluate(() => document.querySelector('.ses-charter.show').innerText)).replace(/\n/g, ' | ')); break; }
  await page.waitForTimeout(1000);
}
await page.screenshot({ path: path.join(OUT, 'final.png') });
console.log('final phase', await page.evaluate(() => window.__ascent.state().session.phase));
await browser.close();
