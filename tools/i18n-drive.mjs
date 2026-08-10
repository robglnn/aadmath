#!/usr/bin/env node
/**
 * The i18n gate, run against the game instead of against the source.
 *
 *   node tools/i18n-drive.mjs --all                # en, es, pl, frozen build
 *   node tools/i18n-drive.mjs --loc pl --url …     # one locale, live server
 *   node tools/i18n-drive.mjs --all --switch       # also switch mid-speech
 *
 * `tools/check-i18n.mjs` proves no English is *written* into `src/`. It cannot
 * prove none is *shown*, and the defect that prompted all of this was of the
 * second kind: every one of Marlow's opening beats came out of `src/i18n`, in
 * the right language, and then the comms channel held the rendered string past
 * a language change and printed six English sentences under a Polish badge.
 * No static rule sees that. A browser does.
 *
 * So this drives the real game — the opening narration end to end, then a real
 * rift solved with real keystrokes — and after every beat it reads every
 * visible text node on the page and asks one question: is any of this a string
 * that only English has? The English bundle is flattened, the strings unique to
 * it are collected, and a match is a leak. It is the same question the critic
 * asked by eye, asked forty times a session instead of once.
 *
 * It also fails on a single console error, which is BRIEF.md invariant 3.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const has = (k) => process.argv.includes('--' + k);

const LOCALES = has('all') ? ['en', 'es', 'pl'] : [arg('loc', 'pl')];
const OUT = path.resolve(arg('out', path.join(ROOT, 'shots/i18n-drive')));
const W = Number(arg('w', 1440));
const H = Number(arg('h', 810));

// ---------------------------------------------------------------------------
// The English-only string set — what a leak looks like
// ---------------------------------------------------------------------------
const bundles = {};
for (const loc of ['en', 'es', 'pl']) {
  bundles[loc] = (await import(path.join(ROOT, 'src/i18n', `${loc}.js`))).default;
}
function flat(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, key, out);
    else out[key] = v;
  }
  return out;
}
const flatB = Object.fromEntries(Object.entries(bundles).map(([l, b]) => [l, flat(b)]));

/**
 * Strings that exist in English and nowhere else. A key whose translation is
 * deliberately identical — a keycap, an arrow, a proper noun — is excluded by
 * construction, because it is not unique to English. `«…»` alternants and
 * `{placeholders}` are stripped to a stable prefix so a line still matches
 * after the runtime has filled it in.
 */
function englishOnly(target) {
  const out = new Map();
  const others = new Set();
  for (const [key, v] of Object.entries(flatB[target])) {
    for (const s of [].concat(v)) if (typeof s === 'string') others.add(norm(s));
  }
  for (const [key, v] of Object.entries(flatB.en)) {
    for (const s of [].concat(v)) {
      if (typeof s !== 'string') continue;
      const n = norm(s);
      // Long enough to be language, and not something the target locale also says.
      if (n.length < 14 || others.has(n)) continue;
      out.set(n, key);
    }
  }
  return out;
}
function norm(s) {
  return String(s)
    .replace(/«[^»]*»/g, ' ')
    .replace(/\{\w+\}/g, ' ')
    .replace(/[\s  ⁠]+/g, ' ')
    .trim()
    .toLowerCase();
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function run(cmd, args) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { cwd: ROOT, stdio: 'ignore' });
    p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} exited ${c}`))));
  });
}

let server = null;
let URL_BASE = arg('url', null);
if (!URL_BASE) {
  const port = 4300 + Math.floor(Math.random() * 500);
  await run('npm', ['run', 'build']);
  server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: ROOT, stdio: 'ignore' });
  URL_BASE = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(URL_BASE); if (r.ok) break; } catch { /* not up yet */ }
    await sleep(400);
  }
}
// ---------------------------------------------------------------------------
// Drive
// ---------------------------------------------------------------------------
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});

const report = [];
for (const loc of LOCALES) report.push(await drive(loc));
await browser.close();
if (server) server.kill();

await writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------
let failed = 0;
for (const r of report) {
  const bad = r.leaks.length + r.errors.length;
  failed += bad;
  console.log(`\n${r.locale.toUpperCase()}  ${r.beats.length} narration beats · ` +
    `rift ${r.rift.solved ? 'solved' : 'NOT solved'} · ${r.shots} frames`);
  for (const b of r.beats) console.log(`   ${String(b.at).padStart(5)}s  ${b.text.slice(0, 96)}`);
  if (r.rift.statement) console.log(`   rift: ${r.rift.title} — ${r.rift.statement.slice(0, 70)}`);
  if (r.errors.length) {
    console.log(`   ✗ ${r.errors.length} console error(s)`);
    for (const e of r.errors.slice(0, 5)) console.log(`       ${e.slice(0, 160)}`);
  }
  if (r.leaks.length) {
    console.log(`   ✗ ${r.leaks.length} English string(s) on screen`);
    for (const l of r.leaks.slice(0, 8)) console.log(`       [${l.key}] ${l.text.slice(0, 120)}`);
  }
  if (!bad) console.log('   ✓ no English on screen, no console errors');
}

if (failed) {
  console.error(`\ni18n-drive FAILED — ${failed} problem(s). Frames in ${path.relative(ROOT, OUT)}\n`);
  process.exit(1);
}
console.log(`\ni18n-drive OK — ${report.length} locale(s) played through the opening and a rift.`);
console.log(`frames in ${path.relative(ROOT, OUT)}\n`);

// ===========================================================================
async function drive(loc) {
  const dir = path.join(OUT, loc);
  await mkdir(dir, { recursive: true });
  const only = englishOnly(loc);

  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 2,
    locale: { en: 'en-US', es: 'es-ES', pl: 'pl-PL' }[loc],
  });
  await ctx.addInitScript((l) => {
    try {
      localStorage.setItem('ascent.locale', l);
      localStorage.removeItem('ascent.story');
      localStorage.removeItem('ascent.save');
    } catch { /* private mode */ }
  }, loc);

  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));

  let shots = 0;
  const shot = async (name) => {
    await page.screenshot({ path: path.join(dir, `${String(++shots).padStart(2, '0')}-${name}.png`) });
  };

  await page.goto(URL_BASE, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 45000 });

  const leaks = [];
  /** Read every word on screen and check none of it is English-only. */
  const audit = async (where) => {
    const texts = await page.evaluate(() => {
      const out = [];
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walk.nextNode())) {
        const s = (n.nodeValue || '').trim();
        if (!s) continue;
        const el = n.parentElement;
        if (!el || el.closest('.katex')) continue;      // notation is language-free
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
        if (!el.getClientRects().length) continue;
        out.push(s);
      }
      for (const el of document.querySelectorAll('[title],[aria-label],[placeholder]')) {
        for (const a of ['title', 'aria-label', 'placeholder']) {
          const v = el.getAttribute(a);
          if (v) out.push(v);
        }
      }
      out.push(document.title);
      return out;
    });
    for (const raw of texts) {
      const n = norm(raw);
      if (n.length < 14) continue;
      // A beat is typed on one character at a time, so match on prefix too.
      for (const [en, key] of only) {
        if (n === en || (n.length > 24 && en.startsWith(n)) || (en.length > 24 && n.startsWith(en))) {
          if (!leaks.some((l) => l.key === key)) leaks.push({ where, key, text: raw });
          break;
        }
      }
    }
  };

  // --- the whole opening speech, beat by beat -------------------------------
  //
  // `--switch` starts the run in English and changes language *in the middle of
  // the speech*, which is the only moment the original defect was visible: the
  // beats already queued had been rendered, and a language change repainted the
  // badge and left the sentences under it in English. Switching after the
  // speech has finished tests nothing — the queue is empty by then.
  const swapAt = has('switch') && loc !== 'en' ? 2 : 0;
  if (swapAt) await page.evaluate(() => window.__ascent.setLocale('en'));

  const beats = [];
  const t0 = Date.now();
  let last = '';
  await shot('arrival');
  // In a `--switch` run the game is still deliberately in English here, so
  // auditing this frame would report the language the run asked for.
  if (!swapAt) await audit('arrival');
  while (Date.now() - t0 < 45000) {
    const cur = await page.evaluate(() => document.querySelector('.meta-comms .body')?.textContent || '');
    const fresh = cur && !last.startsWith(cur.slice(0, 12)) && !cur.startsWith(last.slice(0, 12));
    if (fresh || (cur && !last)) {
      await page.waitForTimeout(950);                 // let the line finish typing
      const full = await page.evaluate(() => document.querySelector('.meta-comms .body')?.textContent || '');
      const at = ((Date.now() - t0) / 1000).toFixed(1);
      beats.push({ at, text: full });
      await shot(`beat-${beats.length}`);
      // Beats before the switch are still legitimately English; auditing them
      // would report the language the run deliberately started in.
      if (!swapAt || beats.length > swapAt) await audit(`beat ${beats.length}`);
      last = full;

      // The switch itself: a real click on the real button, with the rest of
      // the speech still queued behind the line on screen.
      if (swapAt && beats.length === swapAt) {
        await page.click(`#langs button[data-loc="${loc}"]`);
        await page.waitForTimeout(900);
        await shot('switched-mid-speech');
        await audit('the moment the language changed');
        last = await page.evaluate(() => document.querySelector('.meta-comms .body')?.textContent || '');
      }
      if (beats.length >= 5) break;
    }
    if (cur) last = cur;
    await page.waitForTimeout(220);
  }

  // --- a real rift, opened and solved with real keys ------------------------
  const rift = { solved: false };
  const id = await page.evaluate(() => window.__ascent.nextObjective()?.id
    || window.__ascent.rifts.list[0]?.id);
  await page.evaluate((s) => window.__ascent.openRiftById(s), id);
  await page.waitForTimeout(1200);
  Object.assign(rift, await page.evaluate(() => ({
    title: document.querySelector('.rf-title, .rf-head b, .rift h2')?.textContent?.trim() || '',
    statement: document.querySelector('.rf-statement')?.textContent?.trim() || '',
    open: !!window.__ascent.panel.open,
  })));
  await shot('rift-open');
  await audit('rift, open');

  // A wrong answer first — the echo it triggers is the densest prose in the
  // game and the single most likely place for a stray English sentence.
  //
  // Which surface the rig puts up depends on the item, and the item depends on
  // the locale's own bank, so es and pl legitimately get a choice where en gets
  // a keypad. Driving only the keypad meant two of the three languages never
  // reached a sealed statement at all.
  if (rift.open) {
    rift.mode = await page.evaluate(() => window.__ascent.panel.mode);
    await page.evaluate(() => window.__ascent.panel.demo('wrong'));
    await page.waitForTimeout(1500);
    await shot('rift-echo');
    await audit('rift, after a slip');

    const answer = await page.evaluate(() => String(window.__ascent.panel.item?.answer));
    if (rift.mode === 'choice') {
      // a real click on the true reading, not a call into the solver
      await page.click(`.rf-reading[data-value="${answer.replace(/"/g, '\\"')}"]`).catch(() => {});
    } else if (rift.mode === 'keypad') {
      await page.evaluate((a) => window.__ascent.enter(a), answer);
    } else {
      await page.evaluate(() => window.__ascent.panel.demo('right'));
    }
    await page.waitForTimeout(1800);
    rift.solved = await page.evaluate(() => !!window.__ascent.panel._settled);
    await shot('rift-sealed');
    await audit('rift, sealed');
  }

  // --- the dossier: the densest single screen of translated text ------------
  await page.evaluate(() => window.__ascent.story.openDossier());
  await page.waitForTimeout(900);
  await shot('dossier');
  await audit('dossier');
  await page.keyboard.press('Escape');

  await ctx.close();
  return { locale: loc, beats, rift, leaks, errors, shots };
}
