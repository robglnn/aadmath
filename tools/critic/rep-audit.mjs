/**
 * Critic capture for the PROGRESS REPORT.
 * Plays the real game via window.__ascent until a realistic mid-session state
 * exists (some mastered, some proving, some practising, a lapse), then shoots
 * the real report at desktop + phone in EN/ES/PL.
 *
 *   node tools/critic/rep-audit.mjs --url http://127.0.0.1:PORT --out shots/x
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/rep-audit'));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
    '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const logs = [];
const shots = [];

async function session(w, h, tag, work) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('console', (m) => logs.push({ tag, type: m.type(), text: m.text() }));
  page.on('pageerror', (e) => logs.push({ tag, type: 'pageerror', text: e.message }));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  const r = await work(page, ctx);
  await ctx.close();
  return r;
}

/** Play the real learning loop. `wrongEvery` injects genuine errors. */
const PLAY = async (page, maxItems, wrongEvery) => page.evaluate(async ({ maxItems, wrongEvery }) => {
  const A = window.__ascent;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let n = 0, opened = 0;
  const log = [];
  while (n < maxItems) {
    const nx = A.nextObjective();
    if (!nx) break;
    if (!A.openRiftById(nx.id)) break;
    opened++;
    // answer up to 12 items inside this rift
    for (let k = 0; k < 12 && n < maxItems; k++) {
      const p = A.panel;
      if (!p || !p.open || !p.item) break;
      const ans = p.item.answer;
      const wrong = wrongEvery > 0 && n % wrongEvery === (wrongEvery - 1);
      const val = wrong ? (p.item.distractors?.[0]?.v ?? String(ans) + '9') : ans;
      A.enter(val);
      n++;
      await sleep(60);
    }
    if (A.panel?.open) A.panel.close?.();
    await sleep(60);
    log.push({ skill: nx.id, kind: nx.kind, n });
  }
  const st = A.state();
  return { items: n, opened, skills: st.skills, session: st.session, fps: st.fps, perf: st.perf };
}, { maxItems, wrongEvery });

const OPEN_REPORT = async (page) => {
  // The report refuses to open while a cutscene/rank-up takeover is busy, so
  // press the real button until the real modal is really on screen.
  for (let i = 0; i < 60; i++) {
    await page.evaluate(() => { window.__ascent.panel?.close?.(); });
    await page.click('.rp-launch', { force: true }).catch(() => {});
    await page.waitForTimeout(600);
    const on = await page.evaluate(() => !!document.querySelector('.rp-scrim.show'));
    if (on) break;
  }
  await page.waitForTimeout(700);
  const on = await page.evaluate(() => !!document.querySelector('.rp-scrim.show'));
  if (!on) throw new Error('report never opened');
};

// ---------------------------------------------------------------- desktop run
const summary = await session(1600, 900, 'desktop', async (page) => {
  // fresh
  await page.evaluate(() => localStorage.removeItem('ascent.save'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(1000);

  const played = await PLAY(page, 170, 7);
  const save = await page.evaluate(() => JSON.stringify({
    'ascent.save': localStorage.getItem('ascent.save'),
    'ascent.report': localStorage.getItem('ascent.report'),
    'ascent.run': localStorage.getItem('ascent.run'),
    'ascent.pace': localStorage.getItem('ascent.pace'),
  }));

  await OPEN_REPORT(page);
  await page.screenshot({ path: path.join(OUT, 'rep-1600-en.png') });
  shots.push('rep-1600-en.png');
  await page.screenshot({ path: path.join(OUT, 'rep-1600-en-full.png'), fullPage: false });

  // expand first two skills to show evidence
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.rp-skill .rp-row')];
    rows.slice(0, 2).forEach((r) => r.click());
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'rep-1600-en-detail.png') });
  shots.push('rep-1600-en-detail.png');

  // scroll the card body to the bottom to see the tail
  await page.evaluate(() => { const b = document.querySelector('.rp-body'); if (b) b.scrollTop = b.scrollHeight; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'rep-1600-en-bottom.png') });
  shots.push('rep-1600-en-bottom.png');

  for (const loc of ['es', 'pl']) {
    await page.evaluate((l) => window.__ascent.setLocale(l), loc);
    await page.waitForTimeout(500);
    await page.evaluate(() => { const b = document.querySelector('.rp-body'); if (b) b.scrollTop = 0; });
    await page.screenshot({ path: path.join(OUT, `rep-1600-${loc}.png`) });
    shots.push(`rep-1600-${loc}.png`);
    await page.evaluate(() => { const b = document.querySelector('.rp-body'); if (b) b.scrollTop = 700; });
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT, `rep-1600-${loc}-detail.png`) });
    shots.push(`rep-1600-${loc}-detail.png`);
  }

  const dump = await page.evaluate(() => {
    const txt = document.querySelector('.rp-card')?.innerText || '';
    return { text: txt, hasLaunch: !!document.querySelector('.rp-launch') };
  });
  return { played, save, dump };
});

await writeFile(path.join(OUT, 'desktop.json'), JSON.stringify(summary, null, 2));

// ------------------------------------------------------------------ phone run
await session(414, 896, 'phone', async (page, ctx) => {
  await page.evaluate((s) => {
    for (const [k, v] of Object.entries(JSON.parse(s))) if (v != null) localStorage.setItem(k, v);
  }, summary.save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, 'phone-414-world.png') });
  shots.push('phone-414-world.png');
  await OPEN_REPORT(page);
  await page.screenshot({ path: path.join(OUT, 'rep-414-en.png') });
  shots.push('rep-414-en.png');
  await page.evaluate(() => { const b = document.querySelector('.rp-body'); if (b) b.scrollTop = 620; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'rep-414-en-skills.png') });
  shots.push('rep-414-en-skills.png');
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.rp-skill .rp-row')];
    rows.slice(0, 1).forEach((r) => r.click());
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'rep-414-en-detail.png') });
  shots.push('rep-414-en-detail.png');
  for (const loc of ['es', 'pl']) {
    await page.evaluate((l) => window.__ascent.setLocale(l), loc);
    await page.waitForTimeout(500);
    await page.evaluate(() => { const b = document.querySelector('.rp-body'); if (b) b.scrollTop = 0; });
    await page.screenshot({ path: path.join(OUT, `rep-414-${loc}.png`) });
    shots.push(`rep-414-${loc}.png`);
    await page.evaluate(() => { const b = document.querySelector('.rp-body'); if (b) b.scrollTop = 620; });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, `rep-414-${loc}-skills.png`) });
    shots.push(`rep-414-${loc}-skills.png`);
  }
  return null;
});

const errors = logs.filter((l) => l.type === 'error' || l.type === 'pageerror');
await writeFile(path.join(OUT, 'report.json'), JSON.stringify({ shots, errors, logs }, null, 2));
console.log('items played:', summary.played.items, 'rifts opened:', summary.played.opened);
console.log('fps:', summary.played.fps, 'perf:', JSON.stringify(summary.played.perf));
console.log('errors:', errors.length);
for (const e of errors.slice(0, 10)) console.log('  !', e.tag, e.type, e.text.slice(0, 200));
console.log('--- report text (EN) ---\n' + summary.dump.text.slice(0, 4000));
await browser.close();
process.exit(errors.length ? 1 : 0);
