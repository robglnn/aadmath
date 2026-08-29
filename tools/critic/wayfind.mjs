#!/usr/bin/env node
/**
 * THE WAYFINDING GATE — does the world turn a lost player round, and does the
 * word on the card agree with the pixels beside it?
 *
 *   node tools/critic/wayfind.mjs               # build, serve, play, judge
 *   node tools/critic/wayfind.mjs --self-test   # plant every fault, prove it fires
 *   node tools/critic/wayfind.mjs --url http://127.0.0.1:5173
 *   node tools/critic/wayfind.mjs --headed --out shots/wayfind
 *
 * WHY THIS FILE EXISTS
 *
 * Two consecutive blind critics wrote the same sentence, and the second one
 * marked it the ONE gap the wave had not closed:
 *
 *   "88 m between rifts, four coarse direction buckets (AHEAD / TO YOUR LEFT /
 *    TO YOUR RIGHT / BEHIND YOU) and a 26px unlabelled orange triangle is not
 *    navigation. There is no compass, no path, no minimap, and nothing corrects
 *    a player walking the wrong way."
 *
 * A third critic then found the buckets were also INVERTED: the card said left
 * for a rift on the right, in three languages, on every frame. That is the
 * second handedness inversion this project has shipped — the client reported
 * the first himself, about the movement keys.
 *
 * `tools/critic/handed.mjs` covers the arithmetic: it cuts the real expressions
 * out of the real source files and proves each one refuses its own mirror
 * image. This gate covers the two things arithmetic cannot reach.
 *
 * ---------------------------------------------------------------------------
 * LEG 1 · THE WORD AND THE PIXELS
 * ---------------------------------------------------------------------------
 * A static gate proves a function returns 'right' for a target on the right. It
 * cannot prove that the STRING ON THE GLASS, in the locale that is loaded, on
 * the frame the player is looking at, names the side the marker is drawn on. In
 * between those two facts sit a bundle lookup, a cached `textContent`, a
 * projection, an edge clamp and four CSS rules, and the defect a critic
 * photographed lived in exactly that gap.
 *
 * So this leg turns the camera through a full circle with REAL ARROW KEYS and,
 * at every sample, reads three independent things:
 *
 *   the WORD   `.gd-dir`'s text, matched back to a bearing id through the live
 *              bundle, so it is the sentence a player reads and not an enum.
 *   the PIXELS `camera.project()` of the objective — the same matrix that put
 *              the frame on the screen.
 *   the ARROW  where `.gd-mark` actually sits, in client coordinates, read off
 *              `getBoundingClientRect`.
 *
 * All three must agree about the side. The gate is run in all three locales,
 * because the word is the only one of the three that changes with the bundle.
 *
 * ---------------------------------------------------------------------------
 * LEG 2 · THE WRONG-WAY RULE
 * ---------------------------------------------------------------------------
 * MEASURED on the build before this one: a cold critic held W with the
 * objective five metres away and kept holding it until the objective was 196 m
 * away, and the world did nothing whatever. (That run is often quoted as "72
 * continuous seconds". It is not: the distance fell four separate times in
 * between, and the longest stretch over which it never fell is 34.8 s. The
 * rule needs eight, so the correction is not close to the measurement — but the
 * number in the design document was wrong by a factor of two and is corrected
 * here rather than repeated.)
 *
 * `design/FIRST-90-SECONDS.md` §5.3 specifies three escalating responses, all
 * of them the WORLD and none of them the HUD, at 8 / 16 / 24 seconds — and
 * NOTHING at 32. This leg drives 180° off the road with real keys and asserts
 * all four of those, the fourth being silence:
 *
 *   8 s   the road ripples back toward the boots — read as the chevrons' own
 *         instanced colours, off the scene graph, not as a flag
 *  16 s   a vein of cipher motes lights along the correct heading — read as a
 *         named mesh in the scene with a live instance count
 *  24 s   one line of Marlow — read as text on the companion channel
 *  32 s   nothing new. An explorer is not lost, and a game that nags an
 *         explorer has misread the only signal that matters.
 *
 * ---------------------------------------------------------------------------
 * LEG 3 · THE NULL CONTROL — the leg that makes the other two evidence
 * ---------------------------------------------------------------------------
 * From a second cold boot, walk TOWARD the objective for the same 34 seconds
 * with the same keys. Every response must stay silent. A rule that fires on a
 * player who is doing the right thing is worse than no rule: it is the reason
 * gates get switched off, and it is the half of the house standard that
 * matters — *prove it stays quiet on the nearest honest content.*
 *
 * ---------------------------------------------------------------------------
 * LEG 4 · THE CORRECTION ACTUALLY CORRECTS
 * ---------------------------------------------------------------------------
 * A response nobody can act on is decoration. After the three responses have
 * fired, this leg steers by the COMPASS ARC ALONE — it reads the gold tick's
 * pixel position off the glass and presses the arrow key that moves it toward
 * the middle, which is exactly what the instrument asks a player to do — and
 * then walks. The distance to the objective must come back down. Nothing in
 * this leg reads a world position to steer by; if the arc is wrong, the walk
 * fails, which is the point.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS GATE MAY NOT DO
 * ---------------------------------------------------------------------------
 * It may not make progress through `window.__ascent`. Every metre is a real key
 * event and every turn is a real key event. It READS facts back — where a rift
 * is, what the scene graph holds, what the card says — which is the same class
 * of fact as a screenshot, and it drives nothing with them. Three rounds of
 * agents "fixed" rift interaction while verifying through `openRiftById()` and
 * shipped it broken twice; see tools/critic/coldplay.mjs and reachable.mjs.
 */
import { chromium } from 'playwright';
import { build } from 'vite';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listenFree } from '../_freeport.mjs';
import { findings } from '../_findings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const OUT = path.resolve(ROOT, arg('out', 'shots/wayfind'));
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ttf': 'font/ttf', '.map': 'application/json', '.ico': 'image/x-icon',
};

// ===========================================================================
// THE JUDGEMENTS, as pure functions.
//
// Everything this gate concludes is decided here, off plain arrays, so
// `--self-test` can plant each defect by hand and watch the verdict move.
// Nothing in this section touches a browser.
// ===========================================================================

/** The window, in seconds, a response is allowed to land in around its step. */
export const SLACK = 2.5;
/** The three steps the design specifies, and the silence after them. */
export const STEPS = [8, 16, 24];
export const SILENCE_UNTIL = 32;

/**
 * LEG 1. Every sample must have the word, the projection and the marker on the
 * same side. `ndcx` is the objective's projected x in [-1, 1] with `front`
 * saying whether it is in front of the camera at all; `markDx` is the marker's
 * centre minus the viewport's centre, in px.
 *
 * @param {{locale:string, word:string, ndcx:number, front:boolean, markDx:number}[]} rows
 */
export function judgeSides(rows) {
  const problems = [];
  let checked = 0;
  for (const r of rows) {
    // Only a word that names a side can be checked against a side.
    const wants = r.word === 'left' || r.word === 'aheadLeft' || r.word === 'backLeft' ? -1
      : (r.word === 'right' || r.word === 'aheadRight' || r.word === 'backRight' ? 1 : 0);
    if (!wants) continue;
    // …and only where the projection has an opinion. Behind the camera it folds
    // the point through the origin, and near the axis there is no side at all.
    if (!r.front || Math.abs(r.ndcx) < 0.03) continue;
    checked++;
    const px = r.ndcx < 0 ? -1 : 1;
    if (px !== wants) {
      problems.push(`${r.locale}: the card says "${r.word}" for a rift the camera puts at ndc x ${r.ndcx.toFixed(2)}`);
    }
    if (Number.isFinite(r.markDx) && Math.abs(r.markDx) > 12 && Math.sign(r.markDx) !== wants) {
      problems.push(`${r.locale}: the card says "${r.word}" and the marker beside it is drawn ${r.markDx > 0 ? 'right' : 'left'} of centre (${Math.round(r.markDx)} px)`);
    }
  }
  return { checked, problems };
}

/**
 * LEG 2 / 3. One timeline of samples from one continuous walk.
 *
 * Each sample is `{ t, w, road, bait, marlow }`: the wall second, the gate's own
 * count of wrong-way seconds (see `walkAndWatch`), and whether each of the
 * three world responses is up at that instant. `road` and `bait` are measured
 * off the scene; `marlow` is latching (once said, said).
 *
 * The step windows are judged against `w`. The "did it run long enough" and
 * "was it silent afterwards" halves are judged against `w` too, because a walk
 * that never accumulated thirty-two wrong-way seconds has not measured the
 * silence whatever the wall clock says.
 *
 * @param {{t:number, w:number, road:boolean, bait:boolean, marlow:boolean}[]} s
 * @param {{expect:boolean}} opt  `expect:false` is the null control
 */
export function judgeEpisode(s, opt = {}) {
  const expect = opt.expect !== false;
  const problems = [];
  const clock = (r) => (Number.isFinite(r.w) ? r.w : r.t);
  const firstAt = (key) => {
    const hit = s.find((r) => r[key]);
    return hit ? clock(hit) : null;
  };
  const at = { road: firstAt('road'), bait: firstAt('bait'), marlow: firstAt('marlow') };
  const names = { road: 'the road ripples back toward the boots', bait: 'a vein of motes lights along the correct heading', marlow: 'one line from Marlow' };
  const keys = ['road', 'bait', 'marlow'];

  if (!expect) {
    for (const k of keys) {
      if (at[k] !== null) problems.push(`walking TOWARD the objective, ${names[k]} fired at ${at[k].toFixed(1)} s — the rule is measuring the clock, not the direction`);
    }
    return { at, problems, span: s.length ? clock(s[s.length - 1]) : 0 };
  }

  keys.forEach((k, i) => {
    const want = STEPS[i];
    if (at[k] === null) {
      problems.push(`after ${(s.length ? clock(s[s.length - 1]) : 0).toFixed(0)} s of walking away, ${names[k]} never happened (expected about ${want} s)`);
      return;
    }
    if (Math.abs(at[k] - want) > SLACK) {
      problems.push(`${names[k]} landed at ${at[k].toFixed(1)} s, not ${want} s (+-${SLACK})`);
    }
  });
  // …in that order, and never out of it.
  const seen = keys.map((k) => at[k]).filter((v) => v !== null);
  for (let i = 1; i < seen.length; i++) {
    if (seen[i] < seen[i - 1]) { problems.push('the responses arrived out of order; each one is meant to escalate the one before it'); break; }
  }
  // …AND THERE IS NEVER A FOURTH. Anything that turns on for the first time
  // after the third step is a game nagging an explorer.
  const last = s.length ? Math.max(...s.map(clock)) : 0;
  if (last < SILENCE_UNTIL) {
    problems.push(`the walk only ran ${last.toFixed(0)} s; the silence after ${SILENCE_UNTIL} s is half the rule and was never measured`);
  }
  const third = at.marlow ?? STEPS[2];
  for (const r of s) {
    if (clock(r) <= third + SLACK) continue;
    for (const k of Object.keys(r)) {
      if (k === 't' || k === 'w' || keys.includes(k)) continue;
      if (r[k]) problems.push(`a fourth response ("${k}") appeared at ${r.t.toFixed(1)} s; the rule stops at three`);
    }
  }
  return { at, problems, span: last };
}

/** LEG 4. The distance must come back down once the player follows the arc. */
export function judgeRecovery(peak, after) {
  const problems = [];
  if (!(after < peak - 8)) {
    problems.push(`steering by the compass arc alone, the objective went from ${peak.toFixed(0)} m to ${after.toFixed(0)} m — the correction points somewhere the player cannot follow`);
  }
  return { problems, peak, after };
}

// ===========================================================================
// The browser half
// ===========================================================================
const PASS = '\x1b[32m', FAIL = '\x1b[31m', OFF = '\x1b[0m';
let bad = 0;
/** Every failed note, kept so the findings ledger can print what actually broke. */
const notes = [];
function note(ok, what, detail = '') {
  if (!ok) { bad++; notes.push(`${what}${detail ? ` — ${detail}` : ''}`); }
  console.log(`  ${ok ? ' ok  ' : `${FAIL}FAIL${OFF} `} ${what}${detail ? ` — ${detail}` : ''}`);
}

/** Read the bearing ids the bundle knows, so a word can be matched to an id. */
const READ_WORDS = () => {
  const t = window.__ascent.t;
  const ids = ['ahead', 'aheadRight', 'right', 'backRight', 'behind', 'backLeft', 'left', 'aheadLeft', 'here'];
  const out = {};
  for (const id of ids) out[t('guide.rel.' + id)] = id;
  return out;
};

/** One sample of the three independent readings LEG 1 compares. */
const READ_SIDE = (words) => {
  const a = window.__ascent, T = a.THREE;
  const dir = document.querySelector('.gd-dir');
  const g = a.story?.guide?.() || null;
  if (!dir || !g) return null;
  const word = words[dir.textContent] || null;
  const rift = (a.rifts.list || []).find((r) => r.id === g.skill);
  if (!rift) return null;
  const p = new T.Vector3(rift.pos.x, rift.pos.y, rift.pos.z);
  const view = p.clone().applyMatrix4(a.camera.matrixWorldInverse);
  const front = view.z < 0;
  p.project(a.camera);
  const mark = document.querySelector('.gd-mark');
  const box = mark && mark.classList.contains('show') ? mark.getBoundingClientRect() : null;
  return {
    word, ndcx: p.x, front,
    markDx: box ? (box.left + box.width / 2) - innerWidth / 2 : NaN,
    dist: g.metres,
  };
};

/**
 * The three world responses, read off the scene graph and the DOM — and the
 * four raw world facts this gate needs to run ITS OWN clock (see `judgeEpisode`).
 */
const READ_WORLD = (base) => {
  const a = window.__ascent, T = a.THREE;
  const scene = a.scene;
  let bait = false, roadMax = 0;
  scene.traverse((o) => {
    if (o.name === 'wrongway-bait') bait = !!(o.visible && o.count > 0);
    if (o.name === 'road-trace' && o.instanceColor && o.count > 0) {
      const arr = o.instanceColor.array;
      for (let i = 0; i < o.count * 3; i++) if (arr[i] > roadMax) roadMax = arr[i];
    }
  });
  // The chevrons brighten by a factor of 2.15 while the road is calling, so a
  // peak past 1.5x the quiet baseline is the road and not the ordinary pulse.
  const road = base > 0 ? roadMax > base * 1.5 : false;
  // Marlow's channel TYPES its sentence, so the text on the glass is a prefix
  // of the line for the two seconds it is landing. Read it as a prefix, and
  // demand enough of it that no other line in the bundle could match.
  const said = window.__ascent.t('afford.lost');
  const body = document.querySelector('.meta-comms .body');
  const txt = (body && body.textContent || '').trim();
  const marlow = txt.length >= 10 && said.startsWith(txt);
  // ---- the raw facts, for the gate's own stopwatch ------------------------
  const g = a.story?.guide?.() || null;
  const rift = g && (a.rifts.list || []).find((r) => r.id === g.skill);
  let bearing = null;
  if (rift) {
    const f = new T.Vector3();
    a.camera.getWorldDirection(f);
    const vx = rift.pos.x - a.camera.position.x, vz = rift.pos.z - a.camera.position.z;
    bearing = Math.abs(Math.atan2(f.x * vz - f.z * vx, f.x * vx + f.z * vz) * 180 / Math.PI);
  }
  // …and the survey mark the world is currently lighting, if any
  // (src/world/errand.js). A cadet walking at THAT is not lost, and the rule
  // holds its clock while he does — so this gate has to know about it too.
  const lit = a.errand?.bearing?.() || null;
  let markOff = null;
  if (lit) {
    const f = new T.Vector3();
    a.camera.getWorldDirection(f);
    const vx = lit.pos.x - a.camera.position.x, vz = lit.pos.z - a.camera.position.z;
    markOff = Math.abs(Math.atan2(f.x * vz - f.z * vx, f.x * vx + f.z * vz) * 180 / Math.PI);
  }
  const v = a.player.vel;
  return {
    roadMax, road, bait, marlow, bearing, markOff,
    speed: v ? Math.hypot(v.x, v.z) : 0,
    dist: g && Number.isFinite(g.metres) ? g.metres : null,
    // the same expression src/main.js hands the world as `isBusy`
    busy: !!(a.panel?.open || a.session?.blocking?.()),
  };
};

async function serve() {
  const out = await mkdtemp(path.join(tmpdir(), 'wayfind-'));
  await build({ root: ROOT, base: './', logLevel: 'error', build: { target: 'es2022', outDir: out, emptyOutDir: true, sourcemap: false } });
  const server = createServer(async (req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    try {
      const body = await readFile(path.join(out, rel));
      res.writeHead(200, { 'content-type': MIME[path.extname(rel)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end('nope'); }
  });
  const port = await listenFree(server);
  return { url: `http://127.0.0.1:${port}`, server, out };
}

/** Take whatever full-frame card is standing, the way a player takes it. */
async function takeTheFrame(page, budget = 14000) {
  const t0 = Date.now();
  const buttons = ['.ses-charter.show .sc-go', '.ses-close.show .sx-rest', '.ses-rest.show .sr-again',
    '.ses-rest.show .sr-skip', '.fdy.show .fdy-close'];
  while (Date.now() - t0 < budget) {
    if (!(await page.evaluate(() => !!window.__ascent.input?.uiOpen).catch(() => false))) return true;
    let pressed = false;
    for (const sel of buttons) {
      const el = page.locator(sel).first();
      if (await el.count() && await el.isVisible().catch(() => false)) {
        await el.click({ timeout: 3000, force: true }).catch(() => {});
        pressed = true;
        break;
      }
    }
    if (!pressed) await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
  }
  return false;
}

async function coldBoot(page, url) {
  await page.goto(`${url}/index.html`, { waitUntil: 'load' });
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* private mode */ } });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 45000 });
  await page.waitForTimeout(3800);
  await takeTheFrame(page);
}

/**
 * Turn with real arrow keys until the STRAIGHT LINE to the objective is
 * `wantDeg` degrees away from where the cadet is looking.
 *
 * The bearing is READ off the camera matrix and the rift's own position — the
 * same class of fact as a screenshot — and every degree of the turn is a key
 * event. It is the straight line rather than the road because that is what a
 * lost player is doing: walking away from the thing, not away from a route
 * they have never seen. (`src/world/afford.js` measures the trigger the same
 * way, and its comment carries the measurement that says why.)
 */
async function faceOff(page, wantDeg, budgetMs = 25000) {
  const t0 = Date.now();
  let held = null;
  const hold = async (code) => {
    if (held === code) return;
    if (held) await page.keyboard.up(held);
    held = code;
    if (code) await page.keyboard.down(code);
  };
  while (Date.now() - t0 < budgetMs) {
    const err = await page.evaluate(() => {
      const a = window.__ascent, T = a.THREE;
      const g = a.story?.guide?.() || null;
      const rift = g && (a.rifts.list || []).find((r) => r.id === g.skill);
      if (!rift) return null;
      const f = new T.Vector3();
      a.camera.getWorldDirection(f);
      const vx = rift.pos.x - a.camera.position.x, vz = rift.pos.z - a.camera.position.z;
      // positive = the objective is to the RIGHT (src/world/bearing.js)
      return Math.atan2(f.x * vz - f.z * vx, f.x * vx + f.z * vz) * 180 / Math.PI;
    });
    if (err === null) { await hold(null); return null; }
    const d = ((err - wantDeg + 540) % 360) - 180;
    if (Math.abs(d) < 8) { await hold(null); return err; }
    await hold(d > 0 ? 'ArrowRight' : 'ArrowLeft');
    await page.waitForTimeout(70);
  }
  await hold(null);
  return null;
}

/**
 * The road's quiet brightness, measured over a second and a half of a cadet
 * who has done nothing at all.
 *
 * It has to be taken BEFORE the walk is set up rather than at the moment W goes
 * down, because turning on the spot is part of setting the walk up and the
 * baseline would then be measured against whatever state the turn had already
 * produced. The maximum over the window, not one sample: the chevrons pulse,
 * so a single reading lands anywhere on that wave.
 */
async function quietRoad(page) {
  let base = 0;
  for (let i = 0; i < 8; i++) {
    const r = await page.evaluate(READ_WORLD, 0).catch(() => null);
    if (r && r.roadMax > base) base = r.roadMax;
    await page.waitForTimeout(180);
  }
  return base;
}

/** Hold W and sample the world every `step` ms for `secs` seconds. */
async function walkAndWatch(page, secs, base, step = 250) {
  await page.keyboard.down('KeyW');
  const t0 = Date.now();
  const rows = [];
  let marlow = false;
  let peak = 0;
  /* THE GATE RUNS ITS OWN STOPWATCH, off raw world facts, and never reads the
     rule's own clock.
     The design counts EIGHT SECONDS OF CONTINUOUS WRONG-WAY WALKING, which is
     not eight seconds of wall clock: a cadet holding W into a rock face
     travels half a metre a second and goes nowhere, and a probe logged six
     unbroken seconds of exactly that in the middle of one flight. Judging
     against the wall clock would report the game as six seconds late for being
     stuck. So the gate accumulates the same three conditions the design states
     — moving, more than 90 degrees off the bearing to the rift, distance not
     falling — from `speed`, `bearing` and `dist`, which are readings off the
     player and the camera and nothing to do with `src/world/afford.js`. If the
     rule's CONDITION is wrong the null control catches it; this is only about
     which second to call second number eight. */
  let ww = 0, low = Infinity, prev = Date.now();
  while ((Date.now() - t0) / 1000 < secs) {
    await page.waitForTimeout(step);
    const w = await page.evaluate(READ_WORLD, base).catch(() => null);
    if (!w) continue;
    marlow = marlow || w.marlow;
    if (Number.isFinite(w.dist)) peak = Math.max(peak, w.dist);
    const now = Date.now();
    const dt = (now - prev) / 1000; prev = now;
    /* …and it holds while a card owns the frame, and while the cadet is walking
       at the survey mark the world itself lit — for the same two reasons the
       rule does: nobody is walking anywhere with a full-frame beat on the
       glass, and a cadet going where the game asked him to go is not lost.
       This gate reimplements those conditions from raw readings — the camera,
       the boots, two world positions — rather than reading the rule's own
       clock, so the two are independent implementations that have to agree.
       The condition SET is not what this leg proves; the null control below is
       what proves the set, by walking the right way and requiring silence. */
    if (Number.isFinite(w.dist) && !w.busy && !(w.markOff !== null && w.markOff < 60)) {
      if (w.dist < low - 1.5) low = w.dist;
      const off = w.bearing !== null && w.bearing > 90;
      const away = w.dist >= low - 1.5;
      if (!off || !away) { ww = Math.max(0, ww - dt * 2); if (ww === 0) low = Infinity; }
      else if (w.speed >= 0.5) ww += dt;
    }
    rows.push({ t: (now - t0) / 1000, w: ww, road: w.road, bait: w.bait, marlow });
  }
  await page.keyboard.up('KeyW');
  return { rows, base, peak };
}

async function run() {
  await mkdir(OUT, { recursive: true });
  let url = arg('url', null);
  let served = null, browser = null;
  const done = async () => {
    try { served?.server.close(); } catch { /* already down */ }
    try { await browser?.close(); } catch { /* already down */ }
    if (served?.out) await rm(served.out, { recursive: true, force: true });
  };
  try {
    if (!url) { served = await serve(); url = served.url; }
    browser = await chromium.launch({ headless: !has('--headed'), args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    console.log('\nASCENT — the wayfinding gate\n');

    // ---- LEG 1 · the word and the pixels ---------------------------------
    console.log('1. the word on the card, the projection and the marker name the same side');
    await coldBoot(page, url);
    const rows = [];
    for (const loc of ['en', 'es', 'pl']) {
      await page.evaluate((l) => window.__ascent.setLocale(l), loc);
      await page.waitForTimeout(500);
      const words = await page.evaluate(READ_WORDS);
      for (let i = 0; i < 20; i++) {
        // a real key, held for a real number of milliseconds
        await page.keyboard.down('ArrowRight');
        await page.waitForTimeout(150);
        await page.keyboard.up('ArrowRight');
        await page.waitForTimeout(120);
        const r = await page.evaluate(READ_SIDE, words).catch(() => null);
        if (r && r.word) rows.push({ locale: loc, ...r });
      }
    }
    await page.evaluate(() => window.__ascent.setLocale('en'));
    await page.waitForTimeout(400);
    const sides = judgeSides(rows);
    note(sides.problems.length === 0 && sides.checked >= 12,
      'every left-or-right word matches the pixels the player is looking at',
      `${sides.checked} left/right reading(s) over ${rows.length} sample(s) in 3 locales` + (sides.problems.length ? `\n         ${sides.problems.slice(0, 6).join('\n         ')}` : ''));
    await page.screenshot({ path: path.join(OUT, '01-bearing.png') });

    // ---- LEG 3 · the null control, FIRST ---------------------------------
    // Before the rule is asked to fire, prove it is capable of staying quiet.
    // If this leg fails, nothing below is evidence.
    console.log('\n2. the control: the same walk, TOWARD the objective');
    await coldBoot(page, url);
    const ctlBase = await quietRoad(page);
    await faceOff(page, 0);
    const ctl = await walkAndWatch(page, SILENCE_UNTIL + 2, ctlBase);
    const ctlV = judgeEpisode(ctl.rows, { expect: false });
    note(ctlV.problems.length === 0, `${(SILENCE_UNTIL + 2)} s of walking the right way sets nothing off`,
      ctlV.problems.join('; ') || `${ctl.rows.length} samples, road ${ctlV.at.road ?? 'never'}, bait ${ctlV.at.bait ?? 'never'}, Marlow ${ctlV.at.marlow ?? 'never'}`);
    await page.screenshot({ path: path.join(OUT, '02-control.png') });
    if (ctlV.problems.length) {
      console.log('\nthe control failed: the rule fires on a player doing the right thing. Nothing below is evidence.');
      await done();
      return 1;
    }

    // ---- LEG 2 · the wrong-way rule --------------------------------------
    console.log('\n3. walking away from the objective, the WORLD answers three times and then stops');
    await coldBoot(page, url);
    const awayBase = await quietRoad(page);
    note(awayBase > 0, 'the road on the ground is drawn before the walk starts, and is quiet',
      `peak chevron colour ${awayBase.toFixed(2)} over 1.4 s of standing still`);
    const faced = await faceOff(page, 180);
    note(faced !== null, 'a cold player can be turned to face away from the rift with the arrow keys',
      faced === null ? 'no bearing was ever readable' : `${Math.round(faced)} deg off the straight line to it`);
    // Long enough in WALL seconds to bank SILENCE_UNTIL + 4 WRONG-WAY seconds
    // even with a stall or two in it. The judge reads the wrong-way clock.
    const away = await walkAndWatch(page, SILENCE_UNTIL * 2, awayBase);
    const awayV = judgeEpisode(away.rows, { expect: true });
    note(awayV.problems.length === 0, 'three world responses at 8 / 16 / 24 s, and none after',
      awayV.problems.length
        ? awayV.problems.join('\n         ')
        : `road ${awayV.at.road.toFixed(1)} s, motes ${awayV.at.bait.toFixed(1)} s, Marlow ${awayV.at.marlow.toFixed(1)} s, silent to ${awayV.span.toFixed(0)} s`);
    await page.screenshot({ path: path.join(OUT, '03-wrongway.png') });

    // ---- LEG 4 · and the correction corrects -----------------------------
    console.log('\n4. steering by the compass arc alone brings the objective back');
    // Nothing here reads a world position. The only input to the steering is
    // the gold tick's pixel position on the arc — the instrument the player has.
    let held = null;
    const hold = async (c) => { if (held === c) return; if (held) await page.keyboard.up(held); held = c; if (c) await page.keyboard.down(c); };
    const t0 = Date.now();
    let after = away.peak;
    await page.keyboard.down('KeyW');
    // Long enough for the walk to be decisive rather than marginal: the
    // wrong-way leg leaves the cadet up to two hundred metres out, often on the
    // rim with the verge in the way, and a bar of eight metres cleared by
    // seventeen is a pass that says nothing. Forty seconds at a walking pace is
    // most of the way home from anywhere on this shard.
    while (Date.now() - t0 < 40000) {
      const tick = await page.evaluate(() => {
        const s = window.__ascent.afford?.state?.();
        const h = s?.heading;
        if (!h) return null;
        return { dx: h.gold - h.width / 2, beyond: h.beyond };
      });
      if (tick) {
        if (Math.abs(tick.dx) > 14) await hold(tick.dx > 0 ? 'ArrowRight' : 'ArrowLeft');
        else await hold(null);
      }
      await page.waitForTimeout(90);
      const d = await page.evaluate(() => window.__ascent.story?.guide?.()?.metres ?? null);
      if (Number.isFinite(d)) after = Math.min(after, d);
    }
    await hold(null);
    await page.keyboard.up('KeyW');
    const rec = judgeRecovery(away.peak, after);
    note(rec.problems.length === 0, 'a player who follows the arc gets back to the rift',
      rec.problems.join('; ') || `${rec.peak.toFixed(0)} m at the far point, ${rec.after.toFixed(0)} m after following the arc`);
    await page.screenshot({ path: path.join(OUT, '04-recovered.png') });

    note(errors.length === 0, 'the running game logged no console error', errors.slice(0, 3).join(' | '));

    console.log(bad ? `\n${FAIL}WAYFINDING: ${bad} failure(s)${OFF}` : `\n${PASS}WAYFINDING: clean${OFF}`);
    await done();
    /* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. Wayfinding is the
       shipped route by construction: the card, the arrow and the compass are
       what a learner with no query string is steering by. */
    return findings('check:wayfind', { scope: 'route' }).route(notes).report();
  } catch (e) {
    console.error('wayfind: ' + (e && e.stack ? e.stack : e));
    await done();
    return findings('check:wayfind', { scope: 'route' })
      .route(`the gate could not finish: ${e && e.message ? e.message : e}`).report();
  }
}

// ===========================================================================
// --self-test: plant every fault this gate exists to catch.
// ===========================================================================
function selfTest() {
  let n = 0;
  const check = (ok, what) => { if (!ok) { n++; console.log(`  ${FAIL}FAIL${OFF} ${what}`); } else console.log(`   ok   ${what}`); };
  console.log('\nwayfinding self-test — plant the fault, prove the verdict moves\n');

  // ---- LEG 1 -------------------------------------------------------------
  const honestSides = [
    { locale: 'en', word: 'right', ndcx: 0.62, front: true, markDx: 340 },
    { locale: 'en', word: 'left', ndcx: -0.55, front: true, markDx: -300 },
    { locale: 'es', word: 'aheadRight', ndcx: 0.21, front: true, markDx: 120 },
    { locale: 'pl', word: 'backLeft', ndcx: -0.80, front: true, markDx: -410 },
    { locale: 'en', word: 'ahead', ndcx: 0.01, front: true, markDx: 4 },
    { locale: 'en', word: 'behind', ndcx: 0.9, front: false, markDx: -500 },
  ];
  check(judgeSides(honestSides).problems.length === 0, 'sides: an instrument that agrees with the pixels is silent');
  check(judgeSides(honestSides).checked === 4, 'sides: it checks the four readings that name a side and skips the two that do not');
  const mirrored = honestSides.map((r) => ({ ...r, ndcx: -r.ndcx, markDx: -r.markDx }));
  check(judgeSides(mirrored).problems.length >= 4, 'sides: mirroring the world fires on every left-or-right reading');
  const wordOnly = honestSides.map((r) => ({ ...r, word: r.word === 'right' ? 'left' : (r.word === 'left' ? 'right' : r.word) }));
  check(judgeSides(wordOnly).problems.length >= 2, 'sides: swapping ONLY the word — the exact defect shipped — fires');
  const arrowOnly = honestSides.map((r) => ({ ...r, markDx: -r.markDx }));
  check(judgeSides(arrowOnly).problems.length >= 2, 'sides: an arrow drawn on the far side from its own word fires');
  check(judgeSides([{ locale: 'en', word: 'right', ndcx: 0.004, front: true, markDx: 2 }]).problems.length === 0,
    'sides: a rift on the axis has no side, and is not reported as one');

  // ---- LEG 2 / 3 ---------------------------------------------------------
  const timeline = (opts = {}) => {
    const out = [];
    for (let t = 0; t <= (opts.span ?? 36); t += 0.25) {
      out.push({
        t, w: t,
        road: t >= (opts.road ?? 8),
        bait: t >= (opts.bait ?? 16) && t < (opts.baitEnd ?? 999),
        marlow: t >= (opts.marlow ?? 24),
        ...(opts.fourth && t >= opts.fourth ? { shove: true } : {}),
      });
    }
    return out;
  };
  check(judgeEpisode(timeline()).problems.length === 0, 'episode: the specified rule — 8 / 16 / 24 and silence — passes');
  check(judgeEpisode(timeline({ road: 99, bait: 99, marlow: 99 })).problems.length === 3,
    'episode: the build as it was — a walk away with NO response at all — fires on all three');
  check(judgeEpisode(timeline({ bait: 99 })).problems.length >= 1, 'episode: a missing middle response fires');
  check(judgeEpisode(timeline({ marlow: 30 })).problems.length >= 1, 'episode: a response two seconds outside its window fires');
  check(judgeEpisode(timeline({ road: 24, marlow: 8 })).problems.some((p) => /out of order/.test(p)),
    'episode: responses that escalate backwards fire');
  check(judgeEpisode(timeline({ fourth: 32 })).problems.some((p) => /fourth response/.test(p)),
    'episode: a FOURTH response — the game nagging an explorer — fires');
  check(judgeEpisode(timeline({ span: 26 })).problems.some((p) => /silence/.test(p)),
    'episode: a walk too short to measure the silence is not allowed to pass');
  check(judgeEpisode(timeline({ road: 99, bait: 99, marlow: 99 }), { expect: false }).problems.length === 0,
    'control: a quiet walk toward the objective passes');
  check(judgeEpisode(timeline({ road: 8 }), { expect: false }).problems.length >= 1,
    'control: a rule that fires on somebody doing the right thing fires this gate');

  // ---- LEG 4 -------------------------------------------------------------
  check(judgeRecovery(140, 42).problems.length === 0, 'recovery: following the arc and closing 98 m passes');
  check(judgeRecovery(140, 139).problems.length === 1, 'recovery: an arc that leads nowhere fires');
  check(judgeRecovery(140, 134).problems.length === 1, 'recovery: drifting six metres closer is not a correction');

  console.log(n ? `\n${FAIL}self-test: ${n} failure(s)${OFF}` : `\n${PASS}self-test: ok — every leg refuses its own planted fault and stays quiet on the honest one${OFF}`);
  return n ? 1 : 0;
}

if (has('--self-test')) process.exit(selfTest());
else process.exit(await run());
