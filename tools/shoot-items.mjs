import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const args = process.argv.slice(2);
const urlAt = args.indexOf('--url');
const URL = urlAt >= 0 ? args[urlAt + 1] : 'http://127.0.0.1:5173';
const OUT = args.find((a, i) => !a.startsWith('--') && (i === 0 || args[i - 1] !== '--url')) || 'shots/ped-items';
await mkdir(OUT, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const logs = [];
p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
p.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent);
await p.waitForTimeout(2600);
const cases = [
  ['ee-graph', 'eval-expr', 'ee-graph', 3, 'none', 'en'],
  ['bs-graph', 'both-sides', 'bs-graph', 4, 'none', 'en'],
  ['vm-table', 'var-meaning', 'vm-table', 3, 'none', 'en'],
  ['ee-table', 'eval-expr', 'ee-table', 4, 'none', 'en'],
  ['oa-balance', 'one-step-add', 'oa-balance', 2, 'none', 'en'],
  ['ds-area', 'distribute', 'ds-area', 3, 'none', 'en'],
  ['lt-perimeter', 'like-terms', 'lt-perimeter', 3, 'none', 'en'],
  ['bs-special', 'both-sides', 'bs-special', 4, 'none', 'en'],
  ['ts-model', 'two-step', 'ts-model', 4, 'none', 'en'],
  ['oo-dispute', 'order-ops', 'oo-dispute', 3, 'none', 'en'],
  ['ms-bracket-partial', 'multi-step', 'ms-bracket', 4, 'partial', 'en'],
  ['bs-context-es', 'both-sides', 'bs-context', 4, 'none', 'es'],
  ['ts-context-pl', 'two-step', 'ts-context', 3, 'full', 'pl'],
  ['ds-factor-pl', 'distribute', 'ds-factor', 4, 'none', 'pl'],
  // The longest situations in the bank, in every language, because a wide
  // situation deck is only an improvement if the widest sentence in it still
  // fits the rig.
  ['vm-position', 'var-meaning', 'vm-position', 4, 'none', 'en'],
  ['vm-context-pl', 'var-meaning', 'vm-context', 3, 'none', 'pl'],
  ['ee-context-es', 'eval-expr', 'ee-context', 3, 'none', 'es'],
  ['oa-context-full', 'one-step-add', 'oa-context', 3, 'full', 'en'],
];
for (const [name, skill, form, d, scaffold, loc] of cases) {
  await p.evaluate((l) => document.querySelector(`.langs [data-loc="${l}"]`)?.click(), loc);
  await p.waitForTimeout(120);
  await p.evaluate(() => window.__ascent.panel.close());
  await p.waitForTimeout(120);
  const info = await p.evaluate(([s, f, dd, sc]) => window.__ascent.showItem(s, { form: f, difficulty: dd, scaffold: sc, seed: 4242 }), [skill, form, d, scaffold]);
  await p.waitForTimeout(650);
  await p.screenshot({ path: `${OUT}/${name}.png` });
  console.log(name, JSON.stringify(info));
}
console.log('errors', logs.length); logs.slice(0, 8).forEach((l) => console.log('  !', l));
await b.close();
process.exit(logs.length ? 2 : 0);
