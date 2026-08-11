/**
 * Critic driver: plays a FULL session to its close, in the real running game.
 *
 *   node tools/critic/session-drive.mjs --url http://127.0.0.1:4791 \
 *        --out shots/x --w 1600 --h 900 --loc en --mode correct
 *
 * modes: correct  — plays honestly, ends on a sealed tear that meets the goal
 *        wrong    — the clock runs out on a miss
 *        struggle — misses nearly everything, then the ceiling closes the run
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4791');
const OUT = path.resolve(arg('out', 'shots/session'));
const W = Number(arg('w', 1600));
const H = Number(arg('h', 900));
const LOC = arg('loc', 'en');
const MODE = arg('mode', 'correct');
const MOBILE = W < 700;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
    '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({
  viewport: { width: W, height: H }, deviceScaleFactor: 2,
  hasTouch: MOBILE, isMobile: MOBILE,
});
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => logs.push({ type: m.type(), text: m.text() }));
page.on('pageerror', (e) => logs.push({ type: 'pageerror', text: e.message + '\n' + (e.stack || '') }));

const notes = [];
const note = (s) => { notes.push(s); console.log('  · ' + s); };
const shots = [];
async function shot(name, ms = 250) {
  await page.waitForTimeout(ms);
  const f = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: f });
  shots.push(f);
}
const st = () => page.evaluate(() => window.__ascent.session.state());
const probe = () => page.evaluate(() => {
  const rift = document.querySelector('.rift');
  const vis = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    return {
      cls: el.className, display: cs.display, visibility: cs.visibility,
      opacity: +cs.opacity, w: Math.round(r.width), h: Math.round(r.height),
      painted: cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.01 && r.width > 4 && r.height > 4,
    };
  };
  const boxes = [...document.querySelectorAll('.ses-band, .ses-charter, .ses-close, .ses-rest, .hud-progress, [class*="progress"]')]
    .map((el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      return { cls: el.className, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
        vis: cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.01 }; });
  return {
    panelOpen: !!window.__ascent.panel.open,
    riftShow: !!rift?.classList.contains('show'),
    riftVis: vis(rift),
    keypadPainted: !!vis(document.querySelector('.rf-keypad, .rf-pad, .rf-keys'))?.painted,
    boxes,
    phase: window.__ascent.session.state().phase,
  };
});

async function overflow() {
  return page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      // text cut off inside its own box
      if (el.children.length === 0 && el.textContent.trim()) {
        if (el.scrollWidth > el.clientWidth + 2 && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll') {
          bad.push({ kind: 'clipX', cls: el.className || el.tagName, txt: el.textContent.trim().slice(0, 48), sw: el.scrollWidth, cw: el.clientWidth });
        }
        if (el.scrollHeight > el.clientHeight + 3 && cs.overflowY !== 'auto' && cs.overflowY !== 'scroll' && cs.overflow !== 'auto') {
          bad.push({ kind: 'clipY', cls: el.className || el.tagName, txt: el.textContent.trim().slice(0, 48), sh: el.scrollHeight, ch: el.clientHeight });
        }
      }
      // pushed off the viewport
      if (r.right > innerWidth + 2 || r.left < -2) {
        if (el.textContent.trim() && el.children.length === 0) {
          bad.push({ kind: 'offscreenX', cls: el.className || el.tagName, txt: el.textContent.trim().slice(0, 48), left: Math.round(r.left), right: Math.round(r.right) });
        }
      }
    }
    return bad.slice(0, 24);
  });
}

// --------------------------------------------------------------------------
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
// fresh learner, chosen language
await page.evaluate((l) => {
  window.__ascent.session.reset();
  localStorage.removeItem('ascent.save');
  localStorage.setItem('ascent.locale', l);
}, LOC);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(1200);
const loc = await page.evaluate(() => window.__ascent.locale());
note(`locale = ${loc}`);

// --- the orders ----------------------------------------------------------
await page.waitForFunction(() => window.__ascent.session.state().phase === 'charter', null, { timeout: 60000 });
await page.waitForTimeout(900);
await shot('a-orders', 400);
const plan0 = await st();
note(`plan: target=${plan0.run.target} tears, minutes=${plan0.run.minutes}, seams=${plan0.run.seams.map((s) => s.id + (s.hold ? '*' : '')).join(',')}`);
const clipOrders = await overflow();
if (clipOrders.length) note('CLIP@orders ' + JSON.stringify(clipOrders));

// press the real button on the card, with a real pointer
await page.locator('.sc-go').click();
await page.waitForTimeout(700);
const afterCharter = await st();
note(`phase after ORDERS button: ${afterCharter.phase}`);
await shot('b-band', 400);

// --- the run -------------------------------------------------------------
const tearReadings = [];
async function readTear() {
  const r = await page.evaluate(() => {
    const s = window.__ascent.session.state();
    return { tears: s.run?.tears, target: s.run?.target, items: s.run?.items, misses: s.run?.misses, focus: Math.round(s.run?.focus || 0) };
  });
  tearReadings.push(r);
  return r;
}

// stand at the first seam's rift so the real chain condition holds
const first = plan0.run.seams[0]?.id || 'var-meaning';
await page.evaluate((id) => window.__ascent.teleportTo(id), first);
await page.waitForTimeout(500);
await page.evaluate((id) => window.__ascent.openRiftById(id), first);
await page.waitForTimeout(700);

let n = 0;
let lastPanel = Date.now();
const maxItems = MODE === 'struggle' ? 26 : 40;
let struggleMisses = 0;
while (n < maxItems) {
  const s = await st();
  if (s.phase !== 'work' && s.phase !== 'charter') break;
  const open = await page.evaluate(() => window.__ascent.panel.open);
  if (!open) {
    if (Date.now() - lastPanel > 2600) {
      // no chain arrived — walk to the next objective and open it by hand
      const id = await page.evaluate(() => window.__ascent.nextObjective()?.id || null);
      if (id) {
        await page.evaluate((i) => window.__ascent.teleportTo(i), id);
        await page.waitForTimeout(350);
        await page.evaluate((i) => window.__ascent.openRiftById(i), id);
        lastPanel = Date.now();
      }
    }
    await page.waitForTimeout(300);
    continue;
  }
  lastPanel = Date.now();
  n++;
  let wrong = false;
  if (MODE === 'struggle') wrong = struggleMisses < 12;
  else if (MODE === 'wrong') wrong = n % 3 === 0;
  else wrong = n === 2; // one honest slip, so the echo beat is in the run

  if (n === 1) await shot('c-item', 500);
  if (wrong) {
    const did = await page.evaluate(() => window.__ascent.panel.demo('wrong'));
    struggleMisses++;
    if (n <= 2) await shot(`d-echo-${n}`, 900);
    await page.waitForTimeout(1100);
    // after a miss the card stays up; close it to move on
    if (MODE === 'struggle' && struggleMisses === 10) { await shot('e-struggle-band', 300); }
    if (!did) { await page.evaluate(() => window.__ascent.panel.close()); }
    else await page.evaluate(() => window.__ascent.panel.close());
    await page.waitForTimeout(400);
  } else {
    await page.evaluate(() => window.__ascent.panel.demo('right'));
    await page.waitForTimeout(900);
    if (n === 1 || n === 3) await shot(`f-seal-${n}`, 200);
    await page.waitForTimeout(2600); // the panel shuts itself at 2900ms
  }
  await readTear();

  // force the ending the mode asks for
  const s2 = await st();
  if (MODE === 'wrong' && s2.run && s2.run.tears >= s2.run.target - 2 && s2.phase === 'work') {
    // run the clock out, then miss: the close must land on a miss
    await page.evaluate(() => window.__ascent.session.chargeTo(24.6));
  }
  if (MODE === 'struggle' && n >= 14) await page.evaluate(() => window.__ascent.session.chargeTo(24.6));
  if (MODE === 'wrong' && n >= 12) await page.evaluate(() => window.__ascent.session.chargeTo(25.1));
}

// --- the close -----------------------------------------------------------
let closed = await page.waitForFunction(() => ['close', 'rest'].includes(window.__ascent.session.state().phase), null, { timeout: 20000 }).catch(() => null);
if (!closed) {
  note('run did not close on its own — forcing the ceiling');
  await page.evaluate(() => window.__ascent.session.skipToClose());
  await page.waitForTimeout(600);
}
// THE PROBE: sampled across the whole 460ms chain window and beyond
const closeProbes = [];
for (let i = 0; i < 14; i++) {
  closeProbes.push({ tMs: i * 250, ...(await probe()) });
  await page.waitForTimeout(250);
}
await shot('g-close', 300);
const clipClose = await overflow();
if (clipClose.length) note('CLIP@close ' + JSON.stringify(clipClose));
const rep = await page.evaluate(() => window.__ascent.session.state());
note(`close: tears=${rep.run.tears}/${rep.run.target} items=${rep.run.items} misses=${rep.run.misses} held=${JSON.stringify(rep.run.report?.held)} met=${rep.run.report?.met} stalled=${JSON.stringify(rep.run.report?.stalled)} minutes=${rep.run.report?.minutes} canMore=${rep.run.report?.canMore}`);

// --- the break -----------------------------------------------------------
const restBtn = await page.evaluate(() => {
  const el = document.querySelector('.ses-close');
  const btns = [...(el?.querySelectorAll('button') || [])];
  return btns.map((b, i) => ({ i, cls: b.className, txt: b.textContent.trim() }));
});
note('close buttons: ' + JSON.stringify(restBtn));
await page.locator('.ses-close .sx-rest').click();
await page.waitForTimeout(900);
const restProbes = [];
for (let i = 0; i < 10; i++) { restProbes.push({ tMs: i * 300, ...(await probe()) }); await page.waitForTimeout(300); }
await shot('h-rest', 400);
await page.waitForTimeout(4000);
await shot('i-rest-late', 400);
const clipRest = await overflow();
if (clipRest.length) note('CLIP@rest ' + JSON.stringify(clipRest));

const errors = logs.filter((l) => l.type === 'error' || l.type === 'pageerror');
const bad = [...closeProbes, ...restProbes].filter((p) => p.panelOpen || p.riftShow || p.keypadPainted);
console.log(`\n=== ${MODE} ${W}x${H} ${LOC} ===`);
console.log(`rift-behind-modal samples: ${bad.length}/${closeProbes.length + restProbes.length}`);
if (bad.length) console.log(JSON.stringify(bad.slice(0, 4), null, 1));
console.log(`console errors: ${errors.length}`);
errors.slice(0, 8).forEach((e) => console.log('  ! ' + e.text.split('\n')[0]));
await writeFile(path.join(OUT, 'session.json'), JSON.stringify({ MODE, W, H, LOC, notes, plan0: plan0.run, tearReadings, closeProbes, restProbes, report: rep.run?.report, errors, clip: { clipOrders, clipClose, clipRest } }, null, 2));
await browser.close();
process.exit(errors.length ? 2 : 0);
