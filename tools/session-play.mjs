/**
 * Play a whole session to its ending, at a human's tempo, and photograph it.
 *
 * The difference between this and tools/session-shot.mjs is one line that is
 * not in it: this harness never calls `panel.close()` between items. That call
 * is what hid the defect the last critic found — main.js chains the next rift
 * 460 ms after a seal, and a harness that tears the panel down by hand is a
 * harness that never sees the chain fire underneath the close beat. Here a
 * sealed rift is left to shut itself, a missed one is dismissed with the same
 * X a thumb would use, and the ending is whatever the game actually does.
 *
 *   node tools/session-play.mjs --url http://127.0.0.1:4173 --out shots/x \
 *     --mode goal|wrong|struggle|extend|dayTwo [--w 1600] [--h 900] [--loc en]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/session-play'));
const W = Number(arg('w', 1600));
const H = Number(arg('h', 900));
const LOC = arg('loc', 'en');
const MODE = arg('mode', 'goal');
const TOUCH = process.argv.includes('--touch');

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
    '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({
  viewport: { width: W, height: H }, deviceScaleFactor: 2, locale: LOC,
  hasTouch: TOUCH, isMobile: TOUCH,
});
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push({ type: 'error', text: m.text() }); });
page.on('pageerror', (e) => logs.push({ type: 'pageerror', text: e.message + '\n' + (e.stack || '') }));

const shots = [];
const notes = [];
const say = (s) => { notes.push(s); console.log('  ' + s); };
async function shot(name, ms = 250) {
  await page.waitForTimeout(ms);
  const f = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: f });
  shots.push(path.basename(f));
  console.log('  shot', name);
}
const ax = (fn, a) => (a === undefined ? page.evaluate(fn) : page.evaluate(fn, a));

await page.addInitScript((loc) => {
  try { localStorage.setItem('ascent.locale', loc); } catch { /* ignore */ }
}, LOC);
if (MODE !== 'dayTwo') {
  await page.addInitScript(() => { try { localStorage.clear(); } catch { /* ignore */ } });
}
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });

// ---------------------------------------------------------------------------
// The one hand this harness lends the game.
// ---------------------------------------------------------------------------
await ax(() => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__hand = {
    /** Walk to the rift the scheduler is pointing at and go in. */
    async walkIn() {
      const a = window.__ascent;
      if (a.panel.open) return true;              // a chained rift is already up
      const obj = a.nextObjective();
      if (!obj) return false;
      a.teleportTo(obj.id);                        // stand at it, so the chain can fire
      await wait(60);
      return a.openRiftById(obj.id) && a.panel.open;
    },
    /** Answer the item on the surface, right or wrong, the way a hand does. */
    answer(good) {
      const a = window.__ascent;
      if (!a.panel.open) return null;
      const it = a.panel.item;
      const miss = (it.diagnostics || []).map((d) => d.value).find((v) => String(v) !== String(it.answer))
        ?? (it.distractors || []).find((v) => String(v) !== String(it.answer))
        ?? (Number.isFinite(Number(it.answer)) ? String(Number(it.answer) + 1) : 'nope');
      return a.enter(good ? it.answer : miss);
    },
    /** Everything a critic needs to know about what is on the glass. */
    probe() {
      const a = window.__ascent;
      const vis = (el) => {
        if (!el) return false;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.02) return false;
        const b = el.getBoundingClientRect();
        return b.width > 2 && b.height > 2;
      };
      const rift = document.querySelector('.rift');
      return {
        phase: a.session.state().phase,
        panelOpen: !!a.panel.open,
        riftVisible: vis(rift),
        keypadVisible: vis(document.querySelector('.rf-key')),
        setButtonVisible: !!vis(document.querySelector('.rf-commit, .rf-key.commit')),
        errorBoxVisible: vis(document.querySelector('.rf-wrong, .rf-err, .rf-bad')),
        closeShown: !!document.querySelector('.ses-close.show'),
        restShown: !!document.querySelector('.ses-rest.show'),
        charterShown: !!document.querySelector('.ses-charter.show'),
        bandShown: !!document.querySelector('.ses-band.show'),
      };
    },
  };
});

async function probe() { return ax(() => window.__hand.probe()); }
async function sstate() { return ax(() => window.__ascent.session.state()); }

/**
 * One turn, played out. A sealed rift is left to close itself; a missed one is
 * read and then dismissed with the X, which is what a person does with an echo.
 */
async function turn(good) {
  if (!await ax(() => window.__hand.walkIn())) return false;
  await page.waitForTimeout(320);
  await ax((g) => window.__hand.answer(g), good);
  if (good) {
    // the seal animation, then the panel shuts on its own (rift.js, 2900 ms)
    for (let i = 0; i < 60 && await ax(() => window.__ascent.panel.open); i++) {
      await page.waitForTimeout(120);
    }
    // …and main.js chains the next one 460 ms later. Give it the chance.
    await page.waitForTimeout(620);
  } else {
    await page.waitForTimeout(1400);              // read the echo
    await page.click('#rf-close', { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(420);
  }
  return true;
}

/** The band, with nothing on top of it. */
async function bandShot(name) {
  if (await ax(() => window.__ascent.panel.open)) {
    await page.click('#rf-close', { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(500);
  }
  await shot(name, 700);
}

/** Watch the ending for three seconds: the chain window is 460 ms wide. */
async function watchEnding(tag) {
  const seen = [];
  for (let i = 0; i < 12; i++) {
    seen.push(await probe());
    await page.waitForTimeout(280);
  }
  const bad = seen.filter((p) => p.panelOpen || p.riftVisible);
  say(`${tag}: ${seen.length} samples over 3.4s — panelOpen/riftVisible in ${bad.length}`);
  return { seen, clean: bad.length === 0 };
}

// ---------------------------------------------------------------------------
// The opening
// ---------------------------------------------------------------------------
console.log(`mode ${MODE} · ${W}x${H} · ${LOC}`);
await page.waitForFunction(() => document.querySelector('.ses-charter.show'), null, { timeout: 90000 });
await shot('01-orders', 1500);
const plan = await sstate();
say(`orders: run ${plan.run.index}, target ${plan.run.target} tears, ${plan.run.minutes} min, back=${!!plan.last}`);
await page.click('.sc-go');
await shot('02-run-begins', 900);

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------
const result = { mode: MODE, locale: LOC, viewport: [W, H] };

if (MODE === 'goal' || MODE === 'extend' || MODE === 'dayTwo') {
  for (let i = 0; i < 60; i++) {
    const st = await sstate();
    if (st.phase !== 'work') break;
    if (!await turn(true)) break;
    if (i === 3) await bandShot('03-mid-run');
  }
} else if (MODE === 'wrong') {
  for (let i = 0; i < 4; i++) await turn(true);
  await bandShot('03-mid-run');
  await ax(() => window.__ascent.session.chargeTo(24.7));
  await ax(() => window.__hand.walkIn());
  await page.waitForTimeout(340);
  await ax(() => window.__hand.answer(false));
  await page.waitForTimeout(1500);
  await shot('04-echo-up', 200);
  const held = await probe();
  say(`with the echo up, phase=${held.phase} closeShown=${held.closeShown} (must be work/false)`);
  result.echoHeldTheClose = held.phase === 'work' && !held.closeShown;
  await page.click('#rf-close');
} else if (MODE === 'struggle') {
  for (let i = 0; i < 11; i++) {
    if (!await turn(false)) break;
    if (i === 5) await bandShot('03-mid-run');
  }
  const mid = await sstate();
  say(`after 11 misses: tears ${mid.run.tears}/${mid.run.target}, items ${mid.run.items}, echoes ${mid.run.echoes}`);
  result.bandMoved = (mid.run.items || 0) > 0;
  await ax(() => window.__ascent.session.chargeTo(24.7));
  await ax(() => window.__hand.walkIn());
  await page.waitForTimeout(300);
  await ax(() => window.__hand.answer(false));
  await page.waitForTimeout(1400);
  await page.click('#rf-close');
}

// ---------------------------------------------------------------------------
// The ending
// ---------------------------------------------------------------------------
await page.waitForFunction(() => document.querySelector('.ses-close.show'), null, { timeout: 40000 });
await shot('05-close', 2400);
result.closeWatch = (await watchEnding('close')).clean;
result.report = await ax(() => window.__ascent.session.state().run.report);
say(`report: ${JSON.stringify(result.report)}`);
result.closeText = await ax(() => document.querySelector('.ses-close .sx-in')?.innerText.replace(/\n+/g, ' | '));
say(`close reads: ${result.closeText}`);

if (MODE === 'extend') {
  const before = await sstate();
  await page.click('.sx-more');
  await page.waitForTimeout(700);
  const after = await sstate();
  say(`extend: run ${before.run.index}->${after.run.index}, tears ${before.run.tears}->${after.run.tears}, target ${before.run.target}->${after.run.target}, ext ${after.run.extensions}`);
  result.extendKeepsRun = after.run.index === before.run.index && after.run.tears === before.run.tears;
  await shot('06-extended-band', 700);
  // …and take it to the ceiling, where the offer has to be gone.
  await ax(() => window.__ascent.session.chargeTo(25.2));
  await page.waitForFunction(() => document.querySelector('.ses-close.show'), null, { timeout: 40000 });
  await shot('07-close-capped', 2200);
  result.capped = await ax(() => {
    const b = document.querySelector('.sx-more');
    return { moreHidden: !!b.hidden, cap: document.querySelector('.sx-cap')?.textContent || '' };
  });
  say(`ceiling: ${JSON.stringify(result.capped)}`);
  result.closeWatch2 = (await watchEnding('close-capped')).clean;
}

// the break — the beat whose whole premise is looking at something far away
await page.click('.sx-rest');
await shot('08-break', 2600);
result.restWatch = (await watchEnding('break')).clean;
await page.waitForTimeout(3000);
await shot('09-break-quiet', 9000);
await ax(() => document.querySelector('.sr-skip')?.click());
await shot('10-stand-down', 1500);
await ax(() => document.querySelector('.sr-off')?.click());
await shot('11-channel-closed', 1400);

// ---------------------------------------------------------------------------
// Day two: the same browser, the same profile, a fresh load.
// ---------------------------------------------------------------------------
if (MODE === 'dayTwo') {
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
  // What is on the glass four seconds in — the moment the last critic caught a
  // six-row checklist over a black screen.
  await page.waitForTimeout(4000);
  await shot('12-four-seconds-in', 0);
  result.atFourSeconds = await ax(() => ({
    bootGone: !!document.getElementById('boot')?.classList.contains('gone'),
    charterShown: !!document.querySelector('.ses-charter.show'),
  }));
  say(`four seconds in: ${JSON.stringify(result.atFourSeconds)}`);
  await page.waitForFunction(() => document.querySelector('.ses-charter.show'), null, { timeout: 60000 });
  await shot('13-day-two-orders', 1400);
  result.dayTwo = await ax(() => ({
    back: document.querySelector('.sc-back')?.textContent || '',
    kick: document.querySelector('.sc-kick')?.textContent || '',
    eta: document.querySelector('.sc-eta')?.textContent || '',
    bootGone: !!document.getElementById('boot')?.classList.contains('gone'),
  }));
  say(`day two: ${JSON.stringify(result.dayTwo)}`);
}

result.errors = logs;
result.shots = shots;
result.notes = notes;
await writeFile(path.join(OUT, 'play.json'), JSON.stringify(result, null, 2));
console.log(`\nshots -> ${OUT}`);
console.log(`console errors: ${logs.length}`);
logs.slice(0, 8).forEach((e) => console.log('  ! ' + e.text.split('\n')[0]));
await browser.close();
process.exit(logs.length ? 2 : 0);
