/**
 * THE COMPOSITION GATE — every place the game sends you is a place with a shot
 * in it.
 *
 *   node tools/critic/compose.mjs [--url …] [--out shots/compose]
 *   node tools/critic/compose.mjs --self-test
 *   tools/critic/rungate.sh tools/critic/compose.mjs --out shots/compose
 *
 * Exit 0 = every position the game routes a cadet to passes `notFree()`.
 *
 * WHY IT EXISTS, in the words of the report it was written from:
 *
 *   "Standing 3 m from the objective ring the game itself sent me to, the
 *    project's own escape instrument reads open 0.00, short 0.73, seeFar 0.00,
 *    minD 0.37 m, boom 1.85 m — FOUR clauses of notFree() failing at once — and
 *    the frame is solid dark green with no cadet in it. 3 of 8 random 70 m
 *    sprints ended somewhere that same predicate calls not-free."
 *
 * The instrument that says so already existed. `notFree()` in
 * tools/critic/_escape.mjs is the repo's one honest answer to *is this a frame
 * a player can play out of*, measured off the real heightfield, the real
 * three.js camera transform and raycasts through the real scene graph. It was
 * being asked in exactly one place: after pressing the Recover key. So the
 * game could hand a player a frame that fails four of its clauses, for as long
 * as it liked, provided nobody pressed R.
 *
 * This gate asks the same question of the places the game CHOSE. Not of the
 * island at large — a cadet who walks into a ravine on purpose is playing, and
 * a hillside that fills the frame is a hillside. Of the objectives the world
 * seats, the approaches to them from every bearing, the ground covered on the
 * way in, and the ends of sprints. If the game sent you there, you must be able
 * to see out of it.
 *
 * HOW IT DRIVES THE GAME
 *
 * Every metre of every approach is walked on real keys — `W`, `Shift` and the
 * arrow keys — with the camera solving exactly as it does in play. The cadet is
 * PLACED on the ring the approach starts from, and that is a starting
 * condition, not progress: it is the same arrangement tools/critic/traverse.mjs
 * and tools/critic/coldplay.mjs make, and for the same reason — there is no
 * other way to ask the question *from every bearing* in finite time. Nothing
 * after the placement is done through the debug API. Nothing is opened,
 * answered or unlocked through it at all.
 *
 * WHAT IT ASSERTS
 *
 *   1. Every objective the world seats is somewhere `notFree()` passes, stood
 *      on and approached from `--bearings` bearings.
 *   2. The ground covered on the way in passes too, sampled three times an
 *      approach — because an approach that is composed only at its last metre
 *      is a corridor with a photograph at the end of it.
 *   3. A sprint cannot end somewhere it fails. Sprints are run on real keys
 *      from the objectives themselves, on bearings the player chooses rather
 *      than the game.
 *
 * THE SELF-TEST is in two halves, and the second is the one that matters.
 * `--self-test` first runs the predicate over the exact frames the report
 * quotes and over the open plaza, with no browser at all, and proves it rejects
 * one and passes the other. Then, in the real build, it PLANTS THE DEFECT: it
 * puts the cadet inside the drawn geometry of a landmark — a place the game
 * never sends anybody — and asserts this gate's own sampling path calls it not
 * free. A gate that has never rejected anything is not a gate.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ESCAPE_JS, notFree } from './_escape.mjs';
import { findings } from '../_findings.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/compose'));
const SELFTEST = process.argv.includes('--self-test');
const BEARINGS = Number(arg('bearings', 8));
const SPRINTS = Number(arg('sprints', 12));
/** Metres out from a site an approach starts. */
const RING = 17;
/** Metres of ground a sprint covers before the question is asked. */
const SPRINT_M = 70;

const fails = [];
const notes = [];
const note = (ok, label, detail = '') => {
  notes.push({ ok, label, detail });
  if (!ok) fails.push(`${label}${detail ? ' — ' + detail : ''}`);
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ' — ' + detail : ''}`);
};

// ---------------------------------------------------------------------------
// HALF ONE OF THE SELF-TEST: the predicate itself, on the numbers that were
// reported. No browser, no build, a second to run — so the rule stays checkable
// on every commit even when the sitting is not.
// ---------------------------------------------------------------------------
const PLANTED = {
  // the reported frame, verbatim: four clauses at once
  wedge: {
    onGround: true, inTerrain: false, inWall: false, inSolid: false,
    camInTerrain: false, camInWall: false, camInSolid: false,
    short: 0.73, seeFar: 0.00, minD: 0.37, open: 0.00, boom: 1.85,
  },
  // open ground on the plaza, measured — the honest content the bar must not touch
  plaza: {
    onGround: true, inTerrain: false, inWall: false, inSolid: false,
    camInTerrain: false, camInWall: false, camInSolid: false,
    short: 0.00, seeFar: 0.52, minD: 4.0, open: 0.88, boom: 3.80,
  },
  // and the tightest legitimate standing place found anywhere on this island —
  // the foot of a steep bank under tree cover. It must still pass, or the gate
  // is a gate against hillsides.
  bank: {
    onGround: true, inTerrain: false, inWall: false, inSolid: false,
    camInTerrain: false, camInWall: false, camInSolid: false,
    short: 0.14, seeFar: 0.11, minD: 1.9, open: 0.41, boom: 3.30,
  },
};
if (SELFTEST) {
  const w = notFree(PLANTED.wedge);
  note(!!w, 'the predicate rejects the frame the report quotes', w || 'IT PASSED IT');
  const p = notFree(PLANTED.plaza);
  note(!p, 'and passes open ground on the plaza', p || 'open 0.88 / short 0.00 / boom 3.80');
  const b = notFree(PLANTED.bank);
  note(!b, 'and passes the tightest honest standing place on the island', b || 'open 0.41 / short 0.14');
  // …and that is the whole of `--self-test`: it opens no browser, needs no
  // build, and answers in a second, so the rule stays checkable on every commit
  // even when the nine-minute walk is not. The other half of the self-test —
  // planting a real wedge in the real build — runs on EVERY ordinary run,
  // below, because a gate that only watches itself refuse something when it is
  // asked to is a gate nobody watches.
  if (fails.length) { console.error(`\nself-test: ${fails.length} bar(s) do not separate`); process.exit(1); }
  console.log('\nself-test: ok — the predicate rejects the reported frame and passes honest ground');
  process.exit(0);
}

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.evaluate(() => { try { localStorage.clear(); } catch { /* private mode */ } });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2400);

/**
 * Hand the world back before a shot is judged.
 *
 * THIS LINE IS LOAD-BEARING AND IT WAS MISSING FROM THE FIRST CUT. Walking a
 * cadet up to an objective is walking him onto a tear's plate, which opens the
 * learning card — and while a card owns the screen the world stops solving, so
 * every frame measured after that one is the *same* frame, taken from wherever
 * the lens happened to be standing when the card came up. The first run of this
 * gate duly reported a camera 135 metres from the cadet, at four different
 * places, with an identical `minD` at all of them. That was the harness, not
 * the game. The card is closed with the real Escape key and the lens is given
 * time to solve before anything is read.
 */
const handBack = async () => {
  for (let i = 0; i < 6; i++) {
    const busy = await page.evaluate(() => !!(window.__ascent.panel?.open || window.__ascent.input.uiOpen));
    if (!busy) return true;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(320);
  }
  return false;
};

/** The session's own cinematics do not own the screen while a shot is judged. */
const clear = () => page.evaluate(() => {
  const s = window.__ascent?.session;
  s?.charter?.hide?.(); s?.resolution?.hide?.(); s?.rest?.hide?.();
  for (const el of document.querySelectorAll('.ses-charter,.ses-close,.ses-rest')) el.classList.remove('show');
  document.getElementById('ui')?.classList.remove('ses-cine', 'ses-resting');
  document.getElementById('boot')?.classList.add('gone');
}).catch(() => {});
await clear();

const look = () => page.evaluate(ESCAPE_JS);

/** Face a bearing with ARROW KEYS ONLY — no pointer lock, no mouse deltas. */
const faceYaw = async (want) => {
  for (let i = 0; i < 9; i++) {
    const d = await page.evaluate((w) => {
      let e = ((w - window.__ascent.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (e < -Math.PI) e += Math.PI * 2;
      return e;
    }, want);
    if (Math.abs(d) < 0.10) return true;
    const k = d > 0 ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.down(k);
    await page.waitForTimeout(Math.min(380, Math.max(45, (Math.abs(d) / 2.6) * 1000)));
    await page.keyboard.up(k);
  }
  return false;
};

/**
 * The starting condition, and nothing else: the cadet is put on the ring the
 * approach runs in from, on ground the world says exists, and left to settle
 * on his own collider. Every metre after this is on the keys.
 */
const standAt = (x, z) => page.evaluate(([px, pz]) => {
  const a = window.__ascent;
  const h = a.islandAt(px, pz);
  if (h === null) return false;
  a.player.pos.set(px, h + 0.15, pz);
  a.player.vel.set(0, 0, 0);
  a.player.cam?.refound?.();
  return true;
}, [x, z]);

const here = () => page.evaluate(() => {
  const p = window.__ascent.player.pos;
  return { x: p.x, z: p.z, y: p.y, grounded: !!window.__ascent.player.grounded };
});

const settle = async (ms = 500) => {
  await page.waitForTimeout(ms);
  try {
    await page.waitForFunction(() => !!window.__ascent.player.grounded, null, { timeout: 1400 });
  } catch { /* airborne is its own answer, and notFree() names it */ }
  await page.waitForTimeout(200);
};

/**
 * IS THE WORLD SOLVING AT ALL?
 *
 * The other half of the same lesson. A frame that is not being solved reads
 * perfectly well through the instrument and is a photograph of somewhere the
 * cadet no longer is — the first run of this gate reported `minD 1.89` and
 * `short 0.27` at fourteen different places, with the boom growing past eighty
 * metres, which is one frozen lens and a cadet walking away from it. So the
 * engine's own frame counter has to move before anything is read, and if it
 * will not move the run says so as a HARNESS failure instead of filing a
 * finding against the game.
 */
let frozen = 0;
const running = async () => {
  for (let i = 0; i < 8; i++) {
    const a = await page.evaluate(() => window.__ascent.engine.frame | 0);
    await page.waitForTimeout(220);
    const b = await page.evaluate(() => window.__ascent.engine.frame | 0);
    if (b > a) return true;
    const why = await page.evaluate(() => {
      const x = window.__ascent;
      return { paused: !!x.engine.paused, hidden: document.hidden, ui: !!x.input.uiOpen,
        panel: !!x.panel?.open, menu: !!x.menu?.open };
    });
    if (i === 0) console.log(`  ..    world not solving: ${JSON.stringify(why)} — recovering`);
    await page.bringToFront().catch(() => {});
    await page.mouse.click(800, 450).catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});
    await clear();
    await page.waitForTimeout(300);
  }
  frozen++;
  return false;
};

const bad = [];
let sampled = 0;
const sample = async (where, tag) => {
  await handBack();
  await clear();
  await running();
  await page.waitForTimeout(360);
  const f = await look();
  sampled++;
  const why = notFree(f);
  if (why) {
    bad.push({ where, tag, why, f: { open: f.open, short: f.short, seeFar: f.seeFar, minD: f.minD, boom: f.boom },
      at: [f.x, f.y, f.z] });
  }
  return why;
};

// ---------------------------------------------------------------------------
// WHERE THE GAME SENDS PEOPLE, read off the running world.
// ---------------------------------------------------------------------------
const sites = await page.evaluate(() => {
  const a = window.__ascent;
  const out = [];
  const push = (kind, id, x, y, z) => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    out.push({ kind, id, x: +x, y: +(y ?? 0), z: +z });
  };
  push('plaza', 'landing', 0, a.islandAt(0, 0) ?? 0, 0);
  for (const r of a.rifts.list) push('rift', r.id, r.foot ? r.foot.x : r.pos.x, r.pos.y, r.foot ? r.foot.z : r.pos.z);
  // Everything else the world stands on the ground and points a player at.
  const gates = a.waygates?.list || a.waygates?.gates || [];
  for (const g of gates) if (g && g.x !== undefined) push('waygate', g.id || 'gate', g.x, g.y ?? 0, g.z);
  const sp = a.spans?.state?.() || null;
  if (sp && Array.isArray(sp.sites)) for (const s of sp.sites) push('span', s.id || 'span', s.x, s.y ?? 0, s.z);
  const er = a.errand?.state?.() || a.errand?.mark || null;
  if (er && Number.isFinite(er.x)) push('errand', 'mark', er.x, er.y ?? 0, er.z);
  return out;
});
console.log(`  ..    ${sites.length} places the world seats: `
  + Object.entries(sites.reduce((m, s) => ((m[s.kind] = (m[s.kind] || 0) + 1), m), {}))
    .map(([k, n]) => `${n} ${k}`).join(', '));

// ---------------------------------------------------------------------------
// 1 + 2. EVERY OBJECTIVE, APPROACHED FROM EVERY BEARING, ON THE KEYS.
// ---------------------------------------------------------------------------
let walked = 0;
for (const site of sites) {
  for (let b = 0; b < BEARINGS; b++) {
    const th = (b / BEARINGS) * Math.PI * 2;
    const sx = site.x + Math.cos(th) * RING, sz = site.z + Math.sin(th) * RING;
    if (!(await standAt(sx, sz))) continue;          // that bearing is off the island
    await settle(360);
    // yaw is measured from +z, the controller's own forward vector
    const toSite = Math.atan2(site.x - sx, site.z - sz);
    await faceYaw(toSite);
    await clear();
    await sample(`${site.kind} ${site.id}`, `bearing ${b} — the ring, ${RING} m out`);

    await page.keyboard.down('ShiftLeft');
    await page.keyboard.down('KeyW');
    let last = await here();
    for (let step = 0; step < 2; step++) {
      const t0 = Date.now();
      while (Date.now() - t0 < 2200) {
        await page.waitForTimeout(260);
        const p = await here();
        if (Math.hypot(p.x - site.x, p.z - site.z) < 5.5) break;
      }
      const p = await here();
      const moved = Math.hypot(p.x - last.x, p.z - last.z);
      last = p;
      await sample(`${site.kind} ${site.id}`,
        `bearing ${b} — ${Math.hypot(p.x - site.x, p.z - site.z).toFixed(0)} m out, walking in`);
      if (Math.hypot(p.x - site.x, p.z - site.z) < 5.5 || moved < 0.4) break;
    }
    await page.keyboard.up('KeyW');
    await page.keyboard.up('ShiftLeft');
    await settle(420);
    await sample(`${site.kind} ${site.id}`, `bearing ${b} — standing at it`);
    walked++;
  }
  const mine = bad.filter((q) => q.where === `${site.kind} ${site.id}`).length;
  console.log(`  ..    ${site.kind} ${site.id}: ${BEARINGS} bearings walked, ${mine} frame(s) not free`);
}
note(bad.filter((b2) => b2.tag.startsWith('bearing')).length === 0,
  `every objective is composed from every bearing (${walked} approaches, ${sampled} frames)`,
  bad.length ? bad.slice(0, 6).map((b2) => `${b2.where} ${b2.tag}: ${b2.why}`).join(' | ') : `${sites.length} sites × ${BEARINGS} bearings`);

// ---------------------------------------------------------------------------
// 3. AND A SPRINT CANNOT END IN A WEDGE.
// ---------------------------------------------------------------------------
const sprintBad = [];
{
  const before = bad.length;
  const from = sites.filter((s) => s.kind === 'rift' || s.kind === 'plaza');
  for (let i = 0; i < SPRINTS; i++) {
    const s = from[i % from.length];
    const th = (i * 2.399963) % (Math.PI * 2);       // the golden angle: no bearing twice
    if (!(await standAt(s.x, s.z))) continue;
    await settle(320);
    await faceYaw(Math.atan2(Math.cos(th), Math.sin(th)));
    await clear();
    const start = await here();
    await page.keyboard.down('ShiftLeft');
    await page.keyboard.down('KeyW');
    const t0 = Date.now();
    let m = 0;
    while (Date.now() - t0 < 14000) {
      await page.waitForTimeout(420);
      const p = await here();
      m = Math.hypot(p.x - start.x, p.z - start.z);
      if (m >= SPRINT_M) break;
    }
    await page.keyboard.up('KeyW');
    await page.keyboard.up('ShiftLeft');
    await settle(700);
    const why = await sample(`sprint ${i} from ${s.id}`, `${m.toFixed(0)} m out`);
    if (why) sprintBad.push(`${i}: ${why}`);
  }
  note(bad.length === before, `no sprint ends somewhere the frame is not a frame (${SPRINTS} sprints)`,
    sprintBad.length ? sprintBad.slice(0, 5).join(' | ') : `${SPRINT_M} m each, on eight bearings`);
}

// ---------------------------------------------------------------------------
// THE SECOND HALF OF THE SELF-TEST, ON EVERY RUN: plant the defect in the real
// build and watch the gate refuse it. This is what makes the pass above mean
// something — a run that reported no failures because its sampling path was
// broken would fail here.
// ---------------------------------------------------------------------------
{
  // THE PLANT IS THE HEIGHTFIELD, NOT A LANDMARK, and the first cut of it was
  // the other way round: it stood the cadet at the centre of the biggest drawn
  // solid on the island and asserted the gate refused him. Some of those solids
  // are arches and colonnades you can stand in the middle of and see straight
  // out of, so the plant sometimes produced a perfectly good frame and the
  // self-test then reported the GATE as broken. A plant has to be a defect by
  // construction or it is testing the scenery. Three metres under the drawn
  // surface is one: `notFree()` has a clause for it, no honest play ever
  // reaches it, and it exercises the whole path — the placement, the settle,
  // the hand-back, the instrument and the predicate.
  const planted = await page.evaluate(() => {
    // OFF THE ISLAND ALTOGETHER, and that choice is the second thing this plant
    // had to learn. Three metres under the landing was the first one, and the
    // game simply UNDID it: the collider pushes a buried cadet back onto the
    // surface inside a frame, so a quarter of a second later he was standing on
    // open ground and the gate reported ITSELF as broken for not refusing him.
    // A plant has to be a state the game cannot rescue him out of before the
    // reading. Over the void it cannot: `heightAt` has no answer there, so
    // `onGround` is false and stays false for the seconds the recovery takes.
    const a = window.__ascent;
    a.player.pos.set(1200, 240, 1200);
    a.player.vel.set(0, 0, 0);
    return { x: 1200, z: 1200 };
  });
  if (!planted) note(false, 'the self-test can plant a wedge in this build', 'the debug surface did not answer');
  else {
    await page.waitForTimeout(200);
    const f = await look();
    const why = notFree(f);
    note(!!why, 'and the gate refuses a planted wedge in the running build',
      why ? `${why} — planted 1.2 km off the island` : 'IT PASSED A CADET STANDING ON NOTHING AT ALL');
  }
}

note(frozen === 0, 'the world was solving at every frame this gate read',
  frozen ? `${frozen} sample(s) taken while the engine's frame counter was not moving — those readings are the harness, not the game`
    : `${sampled} frames, engine advancing at every one`);
note(errors.length === 0, 'no console errors while the whole island was walked',
  errors.length ? errors.slice(0, 3).join(' | ') : `${sampled} frames measured`);

await writeFile(path.join(OUT, 'compose.json'), JSON.stringify({
  url: URL, sites: sites.length, bearings: BEARINGS, sprints: SPRINTS,
  sampled, bad, notes, errors,
}, null, 1));

console.log(`\n${sampled} frames measured, ${bad.length} not free.`);
if (bad.length) {
  console.log('\nWHERE THE GAME SENDS PEOPLE AND THE FRAME IS NOT A FRAME:');
  for (const b2 of bad.slice(0, 24)) {
    console.log(`  ${b2.where} · ${b2.tag}\n      ${b2.why}\n      at ${b2.at.join(', ')} — `
      + `open ${b2.f.open} short ${b2.f.short} seeFar ${b2.f.seeFar} minD ${b2.f.minD} boom ${b2.f.boom}`);
  }
}
await browser.close();
console.log(fails.length ? `\nFAILED: ${fails.length}` : '\nPASS');
/* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. Every place the game SENDS a cadet is on the shipped route by definition,
   so a frame its own escape predicate calls not-free is one a learner is
   standing in. */
findings('check:compose', { scope: 'route' }).route(fails.map(String)).done();
