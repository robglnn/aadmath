/**
 * SCRATCH PROBE (lane F): the printable teacher record, measured as INK.
 * Every text-bearing element inside the printed sheet, at several paper widths,
 * in EN / ES / PL, under @media print. Reports anything whose ink crosses the
 * right edge of the sheet or of its own clipping ancestor. Also emits a PDF.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4173');
const TAG = arg('tag', 'before');
await mkdir('shots/laneF', { recursive: true });

const MEASURE = `(() => {
  const root = document.querySelector('.rp-sheet') || document.querySelector('.rp-doc');
  if (!root) return { missing: true };
  const R = root.getBoundingClientRect();
  const rng = document.createRange();
  const out = { sheet: { w: +R.width.toFixed(1), left: +R.left.toFixed(1), right: +R.right.toFixed(1) }, ink: [], clip: [] };
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (!n.nodeValue || !n.nodeValue.trim()) continue;
    const el = n.parentElement;
    if (!el) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
    rng.selectNodeContents(n);
    const r = rng.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const past = r.right - R.right;
    if (past > 0.5) out.ink.push({ sel: el.className || el.tagName, text: n.nodeValue.trim().slice(0, 40), past: +past.toFixed(1) });
  }
  const all = [root, ...root.querySelectorAll('*')];
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none') continue;
    const hidesX = /hidden|clip/.test(cs.overflowX);
    const scrollsX = /auto|scroll/.test(cs.overflowX);
    const cut = el.scrollWidth - el.clientWidth;
    if (cut > 1 && (hidesX || scrollsX)) {
      out.clip.push({ sel: el.className || el.tagName, overflowX: cs.overflowX, cut,
        text: (el.textContent || '').trim().slice(0, 46) });
    }
  }
  return out;
})()`;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
// 703 = A4 (210mm) minus @page 12mm side margins, at 96dpi — the layout width
// Chrome's print engine actually gives the document. 1600 = the window a
// teacher has open, which emulateMedia() keeps and the printer does not.
for (const W of [703, 794, 1600]) {
  const ctx = await browser.newContext({ viewport: { width: W, height: 1100 } });
  const page = await ctx.newPage();
  await page.goto(`${URL}/?unit=algebra1-l2`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(1800);
  for (let i = 0; i < 8; i++) {
    if (await page.evaluate(() => !!document.querySelector('.rp-scrim.show'))) break;
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(650);
  }
  await page.locator('.rp-teacher').first().click({ timeout: 20000 });
  await page.waitForTimeout(800);
  for (const loc of ['en', 'es', 'pl']) {
    await page.evaluate((l) => window.__ascent.setLocale(l), loc);
    await page.waitForTimeout(700);
    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(350);
    const r = await page.evaluate(MEASURE);
    console.log(`w=${String(W).padEnd(5)} ${loc}  sheet ${r.sheet.w}px  ink-past-edge ${r.ink.length}  clipping-boxes ${r.clip.length}`);
    for (const i of r.ink.slice(0, 6)) console.log(`        INK  "${i.text}" past by ${i.past}px  (${i.sel})`);
    for (const c of r.clip.slice(0, 6)) console.log(`        BOX  .${c.sel} overflowX:${c.overflowX} cut ${c.cut}px  "${c.text}"`);
    if (W === 703) {
      await page.screenshot({ path: `shots/laneF/${TAG}-print-${loc}.png`, fullPage: true });
      await page.pdf({ path: `shots/laneF/${TAG}-record-${loc}.pdf`, format: 'A4', printBackground: false });
    }
    await page.emulateMedia({ media: 'screen' });
  }
  await ctx.close();
}
await browser.close();
