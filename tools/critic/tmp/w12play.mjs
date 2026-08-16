/** Critic: play REAL Algebra I Level 2 items in the real game. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = arg('out', 'shots/w12-l2play');
await mkdir(OUT, { recursive: true });

const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const errs = [];
pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
pg.on('pageerror', (e) => errs.push('pageerror: ' + e.message));

await pg.goto(`${URL}/?unit=algebra1-l2`, { waitUntil: 'load' });
await pg.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await pg.waitForTimeout(2500);

const content = await pg.evaluate(() => window.__ascent.content());
console.log('CONTENT:', JSON.stringify(content));

const clearBeats = async () => pg.evaluate(() => {
  document.querySelectorAll('.beat, .sn-card, .rp-modal').forEach((e) => e.remove?.());
});

// --- play N items on a given skill, capturing modes and echo text -----------
async function playSkill(skillId, n, { wrongFirst = false } = {}) {
  const seen = [];
  for (let i = 0; i < n; i++) {
    await clearBeats();
    const opened = await pg.evaluate((id) => window.__ascent.openRiftById(id), skillId);
    if (!opened) { seen.push({ err: 'openRiftById false' }); break; }
    await pg.waitForTimeout(700);
    const info = await pg.evaluate(() => {
      const p = window.__ascent.panel;
      const it = p.item || {};
      return {
        open: p.open, mode: p.mode, skill: it.skill, form: it.form, rep: it.rep,
        difficulty: it.difficulty, answer: String(it.answer),
        prompt: (document.querySelector('.rf-prompt')?.innerText || '').slice(0, 260),
        stem: (document.querySelector('.rf-stem')?.innerText || '').slice(0, 260),
        distractors: (it.distractors || []).map((d) => ({ v: String(d.value), tag: d.tag || d.misconception || null })),
      };
    });
    if (wrongFirst && i === 0) {
      await pg.evaluate(() => window.__ascent.panel.demo('wrong'));
      await pg.waitForTimeout(900);
      info.echo = await pg.evaluate(() => ({
        html: (document.querySelector('.rf-echo')?.innerText || '').slice(0, 900),
        tiers: [...document.querySelectorAll('.rf-echo-line, .rf-echo-step')].map((e) => e.innerText.slice(0, 200)),
      }));
      await pg.screenshot({ path: `${OUT}/echo-${skillId}.png` });
    }
    await pg.evaluate(() => window.__ascent.panel.demo('right'));
    await pg.waitForTimeout(700);
    seen.push(info);
    await pg.evaluate(() => window.__ascent.panel.close?.());
    await pg.waitForTimeout(250);
  }
  return seen;
}

const REPORT = {};
for (const s of ['graph-linear', 'slope-rate', 'system-elimination', 'compound-inequality', 'write-linear']) {
  REPORT[s] = await playSkill(s, 4, { wrongFirst: true });
  console.log('\n=== ' + s + ' ===');
  for (const r of REPORT[s]) console.log(JSON.stringify(r).slice(0, 1200));
}

// --- force the plot surface and photograph it -------------------------------
let plotShot = false;
for (let i = 0; i < 40 && !plotShot; i++) {
  await clearBeats();
  await pg.evaluate((id) => window.__ascent.openRiftById(id), 'graph-linear');
  await pg.waitForTimeout(600);
  const m = await pg.evaluate(() => window.__ascent.panel.mode);
  if (m === 'plot') {
    await pg.screenshot({ path: `${OUT}/plot-surface.png` });
    const d = await pg.evaluate(() => ({
      prompt: document.querySelector('.rf-prompt')?.innerText,
      hasSvg: !!document.querySelector('.rf-plot svg, .plot svg, svg'),
      cls: [...document.querySelectorAll('[class*=plot]')].map((e) => e.className).slice(0, 12),
    }));
    console.log('PLOT:', JSON.stringify(d));
    plotShot = true;
  }
  await pg.evaluate(() => window.__ascent.panel.close?.());
  await pg.waitForTimeout(150);
}
console.log('plot surface reached:', plotShot);

// --- the report: what standards does a teacher see for L2? ------------------
await clearBeats();
const rep = await pg.evaluate(() => {
  const g = window.__ascent.report;
  const out = {};
  try { out.openable = typeof g?.open === 'function'; } catch { out.openable = false; }
  return out;
});
console.log('REPORT api:', JSON.stringify(rep));
await pg.evaluate(() => window.__ascent.report?.open?.());
await pg.waitForTimeout(1500);
await pg.screenshot({ path: `${OUT}/report.png`, fullPage: false });
const chips = await pg.evaluate(() => ({
  chips: [...document.querySelectorAll('.rp-chip')].map((c) => c.innerText).slice(0, 40),
  rows: [...document.querySelectorAll('.rp-std-row, .rp-cov-row')].length,
  text: (document.querySelector('.rp-body, .rp-panel, .rp')?.innerText || '').slice(0, 1500),
}));
console.log('REPORT CHIPS:', JSON.stringify(chips).slice(0, 2500));

console.log('\nconsole errors:', errs.length);
for (const e of errs.slice(0, 10)) console.log('  ERR', e);
await b.close();
