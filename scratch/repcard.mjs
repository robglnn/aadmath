/**
 * One card, three languages.
 *
 * Restores the save the real 17-minute drive left behind, opens the report with
 * the P key, expands the one line whose claim the cold reader caught the report
 * lying about — a sight-read whose proving run then stumbled — and photographs
 * it in EN, ES and PL. Nothing here plays the game; the state came from a real
 * drive (shots/repcheck/repcheck.json).
 */
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const URL = process.argv[2] || 'http://127.0.0.1:4477';
const OUT = path.resolve('shots/repcard');
const WANT = process.argv[3] || 'one-step-mul';
await mkdir(OUT, { recursive: true });

const run = JSON.parse(await readFile('shots/repcheck/repcheck.json', 'utf8'));
const cap = run.checkpoints[run.checkpoints.length - 1];

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL, { waitUntil: 'load' });
await page.evaluate(({ save, ledger }) => {
  localStorage.clear();
  localStorage.setItem('ascent.save', JSON.stringify(save));
  localStorage.setItem('ascent.report', JSON.stringify(ledger));
}, { save: cap.save, ledger: cap.ledger });
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(3500);

for (const loc of ['en', 'es', 'pl']) {
  await page.evaluate((l) => window.__ascent.setLocale(l), loc);
  await page.waitForTimeout(700);
  for (let i = 0; i < 20 && !(await page.evaluate(() => !!document.querySelector('.rp-scrim.show'))); i++) {
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(500);
  // Expand only the line under test, then scroll it to the top of the card.
  await page.evaluate((want) => {
    const rows = [...document.querySelectorAll('.rp-skill')];
    for (const a of rows) {
      const open = a.querySelector('.rp-row')?.getAttribute('aria-expanded') === 'true';
      if (open) a.querySelector('.rp-row').click();
    }
    const idx = window.__ascent.report.snapshot().skills.findIndex((s) => s.id === want);
    const art = rows[idx];
    art?.querySelector('.rp-row')?.click();
    setTimeout(() => art?.scrollIntoView({ block: 'start' }), 200);
  }, WANT);
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, `card-${WANT}-${loc}.png`) });
  const text = await page.evaluate(() => {
    const art = [...document.querySelectorAll('.rp-skill')].find((a) => a.querySelector('.rp-detail:not([hidden])'));
    return (art?.innerText || '').replace(/\n{2,}/g, '\n');
  });
  console.log(`\n===== ${loc.toUpperCase()} =====\n${text}`);
}
console.log('\nconsole errors:', errors.length, errors.slice(0, 3).join(' | '));
await browser.close();
