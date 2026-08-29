/**
 * Photograph the Level 2 learning surfaces in the real running game.
 *
 *   node scratch/l2/shots.mjs --url http://127.0.0.1:PORT --out shots/l2 [--loc es]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/l2'));
const LOC = arg('loc', 'en');
const W = Number(arg('w', 1600));
const H = Number(arg('h', 900));

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));

await page.goto(`${URL}/?unit=algebra1-l2`, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch { /* private mode */ } });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 45000 });
await page.evaluate((l) => window.__ascent.setLocale(l), LOC);
await page.waitForTimeout(2500);

const SKILLS = [
  'inequality-one-step', 'inequality-two-step', 'inequality-multi-step', 'compound-inequality',
  'literal-equations', 'ratio-proportion', 'slope-rate', 'graph-linear', 'write-linear',
  'system-substitution', 'system-elimination',
];

const report = [];
for (const skill of SKILLS) {
  for (const band of [1, 4]) {
    const ok = await page.evaluate(async ([s, b]) => {
      const a = window.__ascent;
      a.panel?.close?.();
      await new Promise((r) => setTimeout(r, 260));
      return a.openRiftById(s, { difficulty: b }) !== false;
    }, [skill, band]);
    await page.waitForTimeout(900);
    const seen = await page.evaluate(() => {
      const p = window.__ascent.panel;
      const el = document.querySelector('.rift');
      return {
        open: !!p?.open,
        mode: p?.mode || null,
        skill: p?.item?.skill || null,
        form: p?.item?.form || null,
        band: p?.item?.difficulty ?? null,
        stem: (el?.querySelector('#rf-stem')?.innerText || '').trim(),
        prompt: (el?.querySelector('#rf-prompt')?.innerText || '').trim(),
        answer: p?.item?.answer || null,
        katexErr: el ? el.querySelectorAll('.katex-error').length : -1,
      };
    });
    const name = `${skill}-d${band}-${LOC}`;
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    report.push({ name, ok, ...seen });
    console.log(`${name.padEnd(38)} mode=${String(seen.mode).padEnd(8)} form=${String(seen.form).padEnd(16)} katexErr=${seen.katexErr}  "${seen.stem.slice(0, 60)}"`);
  }
}

// The plot surface, driven by hand: arrow keys, then Seal.
await page.evaluate(async () => {
  const a = window.__ascent;
  a.panel?.close?.();
  await new Promise((r) => setTimeout(r, 260));
  a.openRiftById('graph-linear', { difficulty: 2, form: 'gl-plot-points' });
});
await page.waitForTimeout(1200);
const plot = await page.evaluate(() => ({
  mode: window.__ascent.panel?.mode,
  knobs: document.querySelectorAll('.rf-plot .knob').length,
  read: document.querySelector('.rf-plot-read .val')?.innerText || '',
}));
console.log('plot surface:', JSON.stringify(plot));
await page.screenshot({ path: path.join(OUT, `plot-surface-${LOC}.png`) });
if (plot.mode === 'plot') {
  await page.click('.rf-plot .knob');
  for (let i = 0; i < 3; i++) { await page.keyboard.press('ArrowUp'); await page.waitForTimeout(90); }
  await page.screenshot({ path: path.join(OUT, `plot-dragged-${LOC}.png`) });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, `plot-miss-echo-${LOC}.png`) });
}

await writeFile(path.join(OUT, `report-${LOC}.json`), JSON.stringify({ report, plot, logs }, null, 2));
console.log(logs.length ? `\nCONSOLE ERRORS (${logs.length}):\n` + logs.slice(0, 6).join('\n') : '\nno console errors');
await browser.close();
process.exit(logs.length ? 1 : 0);
