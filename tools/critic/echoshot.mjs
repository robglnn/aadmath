/**
 * A TARGETED ECHO, PHOTOGRAPHED IN THE RUNNING GAME.
 *
 *   node tools/critic/echoshot.mjs --unit algebra1-l5 --out shots/echo
 *
 * WHY IT IS WRITTEN THIS WAY
 *
 * `tools/check-echo.mjs` proves that `counterexample()` returns computed
 * mathematics for every tagged slip in every unit. That is a claim about a
 * module. It is not a claim about the GAME: the same three rounds of agents who
 * "fixed" rift interaction while verifying it through `openRiftById()` are the
 * reason this repo has a rule about it. So this script may read facts back —
 * which rift the scheduler served, which wrong value the generator tagged, so
 * that it can be typed — and it may not make anything happen that way.
 *
 * Every state change below is a real mouse click, a real key, or a real
 * pointer-lock grab:
 *
 *   · the walk to the rift is `KeyW` held down with the mouse steering;
 *   · the rift is opened with `KeyE`;
 *   · the wrong answer is entered by CLICKING the keys of the on-screen pad,
 *     one glyph at a time, or by clicking a reading on the real button;
 *   · the answer is committed by clicking the real commit button;
 *   · the deeper layers are cut by clicking the real "one more layer" button.
 *
 * What comes out is a photograph of what a cadet sees after a named slip on a
 * Level 5 rift, plus the same column read back out of the DOM as text.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const UNIT = arg('unit', 'algebra1-l5');
const OUT = path.resolve(arg('out', 'shots/echo'));
const WANT = Number(arg('rifts', 4));
/** Which language to play in — chosen by CLICKING the switcher, as a player does. */
const LANG = arg('lang', '');
const HEADED = process.argv.includes('--headed');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: !HEADED,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.addInitScript(() => { try { localStorage.clear(); } catch { /* first load */ } });
await page.goto(`${URL}/?unit=${UNIT}`, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ascent?.player, null, { timeout: 60000 });
await page.waitForTimeout(1500);


/** A real click on the middle of a real element. */
async function clickEl(handle) {
  const box = await handle.boundingBox();
  if (!box) return false;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(90);
  return true;
}

/** Walk to the nearest rift the lattice has opened, with W and the mouse. */
async function walkToARift() {
  const target = await page.evaluate(() => {
    const a = window.__ascent;
    const p = a.player.pos;
    let best = null; let bd = Infinity;
    for (const r of a.rifts?.list || []) {
      if (r.locked || r.sealed) continue;
      const d = Math.hypot(r.pos.x - p.x, r.pos.z - p.z);
      if (d < bd) { bd = d; best = r; }
    }
    return best ? { id: best.id, x: best.pos.x, z: best.pos.z } : null;
  });
  if (!target) return null;
  await page.mouse.move(800, 450);
  await page.mouse.click(800, 450);
  await page.waitForTimeout(250);
  let held = false;
  for (let i = 0; i < 260; i++) {
    const err = await page.evaluate((t) => {
      const a = window.__ascent; const p = a.player.pos;
      const want = Math.atan2(t.x - p.x, t.z - p.z);
      let d = ((want - a.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (d < -Math.PI) d += Math.PI * 2;
      return { d, dist: Math.hypot(t.x - p.x, t.z - p.z) };
    }, target);
    if (Math.abs(err.d) > 0.06) await page.mouse.move(800 - err.d * 240, 450, { steps: 2 });
    if (!held) { await page.keyboard.down('KeyW'); held = true; }
    await page.waitForTimeout(110);
    const open = await page.evaluate(() => !!window.__ascent.panel?.open);
    if (open) { if (held) await page.keyboard.up('KeyW'); return target.id; }
    if (err.dist < 4.5) break;
  }
  if (held) await page.keyboard.up('KeyW');
  for (const key of ['KeyE', 'KeyF', 'Enter']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(450);
    if (await page.evaluate(() => !!window.__ascent.panel?.open)) return target.id;
  }
  return null;
}

/**
 * Enter a value by clicking the real pad, one glyph at a time.
 *
 * Every cap publishes the character it writes as `data-g`, so the pad is asked
 * which glyphs it can emit rather than being told. A leading minus is the SIGN
 * cap on a value pad and a real minus on an expression pad, and both are tried.
 */
async function typeOnThePad(value) {
  const caps = await page.$$('.rf-pad .rf-key[data-g]');
  if (!caps.length) return false;
  const byGlyph = new Map();
  for (const k of caps) {
    const g = await k.evaluate((el) => el.dataset.g);
    if (g && !byGlyph.has(g)) byGlyph.set(g, k);
  }
  // The bank writes its answers in LaTeX and the pad's caps are printed with
  // the glyphs a hand can see, so the notation is rewritten into those glyphs —
  // and only into glyphs the pad has just said it can emit.
  let text = String(value).trim()
    .replace(/\\left|\\right/g, '')
    .replace(/\\sqrt\s*\{([^{}]*)\}/g, '√$1')
    .replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '$1/$2')
    .replace(/\\pm/g, '±')
    .replace(/\\cdot|\\times/g, '*')
    .replace(/\^\s*\{([^{}]*)\}/g, '^$1')
    .replace(/\s+/g, '');
  if (text.startsWith('-') && !byGlyph.has('-') && byGlyph.has('sign')) {
    text = text.slice(1);
    for (const ch of text) if (!byGlyph.has(ch)) return false;
    for (const ch of text) if (!await clickEl(byGlyph.get(ch))) return false;
    return clickEl(byGlyph.get('sign'));
  }
  for (const ch of text) if (!byGlyph.has(ch)) return false;
  for (const ch of text) if (!await clickEl(byGlyph.get(ch))) return false;
  return true;
}

// The language is chosen the way a player chooses it: by pressing the switcher
// in the HUD. Nothing here writes to storage or calls into the game — and if
// the switcher cannot be pressed from where the walk starts, that is said out
// loud rather than quietly photographed in English under a Polish filename.
if (LANG) {
  let took = false;
  try {
    const btn = await page.$(`[data-loc="${LANG}"]`);
    if (btn) { await btn.click({ timeout: 4000 }); await page.waitForTimeout(800); }
    took = (await page.evaluate(() => document.documentElement.lang)) === LANG;
  } catch { took = false; }
  if (!took) {
    console.error(`the ${LANG} switcher cannot be pressed from here — the HUD language`
      + ' group is behind an overlay at this point in the run, so this capture would'
      + ' be an English frame under another name. Stopping.');
    await browser.close();
    process.exit(2);
  }
  console.log(`playing in ${LANG}`);
}

const shots = [];
for (let n = 0; n < WANT; n++) {
  const riftId = await walkToARift();
  if (!riftId) { console.log(`  (no rift reached on approach ${n + 1})`); break; }
  await page.waitForTimeout(700);
  // The dev server full-reloads whenever another builder saves a file, which
  // takes the page out from under the walk. That is the build process, not the
  // game: wait for the rig to come back rather than reporting it as a defect.
  try { await page.waitForFunction(() => !!window.__ascent?.panel, null, { timeout: 20000 }); }
  catch { console.log('  (the page reloaded under the walk; stopping here)'); break; }
  // READ, DO NOT DRIVE: which item was served, and which wrong value the
  // generator itself tagged with a misconception.
  const served = await page.evaluate(() => {
    const p = window.__ascent.panel;
    if (!p?.item) return null;
    const dg = (p.item.diagnostics || [])[0] || null;
    return {
      skill: p.item.skill, form: p.item.form, mode: p.mode,
      latex: p.item.latex, answer: String(p.item.answer),
      entry: dg ? String(dg.value) : null, mis: dg ? dg.misconception : null,
    };
  });
  if (!served || !served.entry) {
    console.log(`  (${served ? served.skill + ' declares no tagged slip' : 'no item on the card'})`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(500); continue;
  }

  let entered = false;
  if (served.mode === 'choice') {
    const btns = await page.$$('.rf-reading');
    for (const b of btns) {
      const v = await b.evaluate((el) => el.dataset.value || '');
      if (v && v !== served.answer) { entered = await clickEl(b); break; }
    }
  } else {
    entered = await typeOnThePad(served.entry);
    if (entered) {
      const commit = await page.$('.rf-pad .rf-key.commit');
      if (!commit) entered = false;
      else if (await commit.evaluate((el) => el.disabled)) entered = false;
      else entered = await clickEl(commit);
    }
  }
  if (!entered) {
    console.log(`  (could not enter "${served.entry}" on the ${served.mode} surface)`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(500); continue;
  }
  await page.waitForTimeout(900);

  const echo = await page.evaluate(() => {
    const box = document.querySelector('#rf-echo');
    if (!box) return null;
    const rows = [...box.querySelectorAll('.rf-echo-math')].map((m) => m.textContent.trim());
    const whys = [...box.querySelectorAll('.rf-echo-why')].map((m) => m.textContent.trim());
    return { visible: !!box.offsetParent, rows, whys, depth: (document.querySelector('#rf-echo-depth') || {}).textContent };
  });
  const name = `${String(n + 1).padStart(2, '0')}-${served.skill}-layer1${LANG ? '-' + LANG : ''}`;
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  shots.push({ shot: `${name}.png`, ...served, echo });
  console.log(`\n${served.skill}/${served.form}  [${served.mis}]  entered "${served.entry}"`);
  console.log(`   prompt ${served.latex}`);
  for (let i = 0; i < (echo?.rows.length || 0); i++) {
    console.log(`   ${echo.rows[i]}`);
    if (echo.whys[i]) console.log(`       · ${echo.whys[i]}`);
  }

  // …and one more layer, cut with the real button: the worked analogue.
  const more = await page.$('#rf-hint');
  if (more) {
    await clickEl(more);
    await page.waitForTimeout(700);
    const name2 = `${String(n + 1).padStart(2, '0')}-${served.skill}-layer2${LANG ? '-' + LANG : ''}`;
    await page.screenshot({ path: path.join(OUT, `${name2}.png`) });
    const deeper = await page.evaluate(() => {
      const box = document.querySelector('#rf-echo');
      return box ? [...box.querySelectorAll('.rf-echo-math, .rf-echo-step')].map((m) => m.textContent.trim()).slice(0, 12) : [];
    });
    shots[shots.length - 1].layer2 = { shot: `${name2}.png`, rows: deeper };
    console.log(`   — one layer deeper —`);
    for (const r of deeper) console.log(`   ${r}`);
  }
  // …then seal it honestly, on the same real surface, so the scheduler moves
  // on and the next rift is a different node rather than this one again.
  if (served.mode === 'choice') {
    const btns = await page.$$('.rf-reading');
    for (const b of btns) {
      const v = await b.evaluate((el) => el.dataset.value || '');
      if (v === served.answer) { await clickEl(b); break; }
    }
  } else if (await typeOnThePad(served.answer)) {
    const commit = await page.$('.rf-pad .rf-key.commit');
    if (commit && !(await commit.evaluate((el) => el.disabled))) await clickEl(commit);
  }
  await page.waitForTimeout(1600);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(900);
  // Walk clear of the ring, or the next approach opens the rift just left.
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(1400);
  await page.keyboard.up('KeyS');
}

await writeFile(path.join(OUT, `echoes${LANG ? '-' + LANG : ''}.json`), JSON.stringify({ unit: UNIT, shots, errors }, null, 2));
console.log(`\n${shots.length} rift(s) photographed into ${OUT}`);
if (errors.length) { console.error(`\n${errors.length} console error(s):`); for (const e of errors.slice(0, 8)) console.error('  ' + e); }
await browser.close();
process.exit(shots.length && !errors.length ? 0 : 1);
