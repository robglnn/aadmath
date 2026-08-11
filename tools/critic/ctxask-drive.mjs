/**
 * Read the repaired word problems off the real learning surface.
 *
 * Not the bundle, not the generator — the pixels and the DOM of the running
 * game, in all three languages, for every situation whose question was asking
 * for the wrong object. Prints the rendered prompt so a human can check that
 * the noun the story counts is the noun the question asks for, and screenshots
 * each one.
 *
 *   node tools/critic/ctxask-drive.mjs --url http://127.0.0.1:5173 --out shots/ctxask
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/ctxask'));
const W = Number(arg('w', 1280));
const H = Number(arg('h', 720));

// Every situation whose question this pass re-pointed. The deck deals itself
// out before it repeats, so a seed alone does not pin a framing once a session
// has drawn from the deck — the harness draws until the running game hands it
// the situation it came for, which is also proof the game can still deal it.
const CASES = [
  ['hullPatches', 'var-meaning', 'vm-context'],
  ['nestedPatches', 'var-meaning', 'vm-compose'],
  ['oreSkips', 'var-meaning', 'vm-context'],
  ['saltBlocks', 'var-meaning', 'vm-context'],
  ['soundBuoys', 'var-meaning', 'vm-context'],
  ['nestedBuoys', 'var-meaning', 'vm-compose'],
  ['filters', 'var-meaning', 'vm-context'],
  ['printPlates', 'var-meaning', 'vm-context'],
  ['seedVaults', 'var-meaning', 'vm-context'],
  ['nestedPacks', 'var-meaning', 'vm-compose'],
];
const LOCALES = ['en', 'es', 'pl'];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(2200);

const rows = [];
for (const loc of LOCALES) {
  await page.evaluate((l) => window.__ascent.setLocale(l), loc);
  await page.waitForTimeout(250);
  for (const [name, skill, form] of CASES) {
    const info = await page.evaluate(([s, f, want]) => {
      const A = window.__ascent;
      for (let seed = 1; seed <= 4000; seed++) {
        if (A.panel.open) A.panel.close?.();
        const r = A.showItem(s, { form: f, seed, difficulty: 3 });
        const scene = String(A.panel.item?.scene || '');
        if (scene.split('+').includes('ctx.' + want)) return { ...r, seed, scene };
      }
      return { seed: null, scene: 'NOT DEALT' };
    }, [skill, form, name]);
    await page.waitForTimeout(320);
    // What the learner actually reads: the prompt as the DOM renders it.
    const text = await page.evaluate(() => {
      const node = document.getElementById('rf-statement-in') || document.getElementById('rf-stem');
      return node ? node.innerText.replace(/\s+/g, ' ').trim() : '(no prompt node found)';
    });
    rows.push({ locale: loc, scene: name, seed: info.seed, drew: info.scene, form: info.form, rep: info.rep, answer: info.answer, text });
    await page.screenshot({ path: path.join(OUT, `${loc}-${name}.png`) });
    await page.evaluate(() => window.__ascent.panel.close?.());
    await page.waitForTimeout(120);
  }
}

// The report screen, which is where standards depth has to be legible.
//
// It has to have something to report first, so the real loop is played through
// the real scheduler, and then the `eval-expr` line — the one that used to read
// "HELD 100% · TEKS 7.7, A.12(B)" with no depth on any chip — is expanded and
// read in each language.
await page.evaluate(() => { if (window.__ascent.panel.open) window.__ascent.panel.close(); });
await page.evaluate(async () => {
  const A = window.__ascent;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 140; i++) {
    const nx = A.nextObjective();
    if (!nx) break;
    if (A.panel.open) A.panel.close();
    await sleep(10);
    if (!A.openRiftById(nx.id)) break;
    await sleep(25);
    const item = A.panel.item;
    if (!item) break;
    A.enter(item.answer);
    await sleep(25);
    if (A.panel.open) A.panel.close();
    await sleep(10);
  }
});
await page.evaluate(() => {
  window.__ascent.session?.charter?.hide?.();
  for (const el of document.querySelectorAll('.ses-charter,.ses-close,.ses-rest')) el.classList.remove('show');
  document.getElementById('ui')?.classList.remove('ses-cine', 'ses-resting');
});
await page.waitForTimeout(400);

for (const loc of LOCALES) {
  await page.evaluate((l) => window.__ascent.setLocale(l), loc);
  await page.waitForTimeout(250);
  await page.evaluate(() => window.__ascent.report.show());
  await page.waitForTimeout(700);
  const opened = await page.evaluate(() => {
    // The rows carry no skill id, so the line is found by the name the active
    // locale gives it — which is what a reader would do.
    const want = window.__ascent.t('skills.eval-expr');
    const rows = [...document.querySelectorAll('.rp-skill')];
    const row = rows.find((r) => r.querySelector('.rp-name')?.textContent === want) || rows[0];
    const btn = row?.querySelector('.rp-row');
    if (btn && btn.getAttribute('aria-expanded') !== 'true') btn.click();
    return row?.querySelector('.rp-name')?.textContent || null;
  });
  await page.waitForTimeout(500);
  // The chips live inside the expanded detail, which opens below the fold.
  await page.evaluate(() => {
    const std = document.querySelector('.rp-detail:not([hidden]) .rp-std');
    std?.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `report-${loc}.png`) });
  const chips = await page.evaluate(() => [...document.querySelectorAll('.rp-chip')]
    .map((c) => `${c.closest('.rp-std-grp')?.querySelector('.rp-std-lab')?.textContent || '?'}: ${c.innerText.replace(/\s+/g, ' ')} [${c.dataset.depth}]`));
  const sum = await page.evaluate(() => document.querySelector('.rp-std-sum')?.textContent || '');
  rows.push({ locale: loc, scene: `report(${opened})`, text: chips.join(' | ') + '  ||  ' + sum });
  await page.evaluate(() => window.__ascent.report.close());
  await page.waitForTimeout(200);
}

await writeFile(path.join(OUT, 'read.json'), JSON.stringify({ rows, logs }, null, 1));
for (const r of rows) console.log(`[${r.locale}] ${r.scene}${r.seed ? ` (seed ${r.seed})` : ''}: ${r.text}`);
console.log(`\nconsole errors/warnings: ${logs.length}`);
for (const l of logs.slice(0, 10)) console.log('  ' + l);
await browser.close();
process.exit(logs.filter((l) => l.startsWith('error') || l.startsWith('pageerror')).length ? 1 : 0);
