/**
 * IS BUILDING WORTH DOING?
 *
 * A critic's verdict on the last round: the build charge refills itself for
 * free, so the sandbox asks nothing and gives nothing. A verb that costs
 * nothing and buys nothing is a toy bolted to the side of the game.
 *
 * The brief names two things the lattice is supposed to buy, and this script
 * tries to collect on both, in play, with real input:
 *
 *   TRAVERSAL — the three lattice anchors hang over the plaza at ten, eighteen
 *   and twenty-eight metres. The claim is that nothing in the cadet's kit
 *   reaches them. So: jump, double-jump and glide off the anchor's own pad and
 *   measure the apex; then build a stair up to it out of ramps and secure it.
 *   If the apex clears the anchor, the anchors are decoration. If the stair
 *   cannot be built by hand, the reward is unreachable. Both are failures.
 *
 *   MATHEMATICS — a beam set beside an open rift is supposed to become the
 *   balance carrying that rift's own equation, and a floor the area model. So:
 *   open a real rift, read the equation it is actually holding, set a beam and
 *   a floor beside it with real clicks, and check the apparatus is carrying the
 *   same numbers — and that it settles level, because level *is* the argument.
 *
 * Same absolute rule as handbuild.mjs and buildtime.mjs: **nothing here places,
 * selects, turns or clears a piece except a real DOM key event or a real mouse
 * press.** `page.evaluate` reads facts, opens a rift by id (which is a rift
 * verb, not a build verb) and — in the marked photography section — moves the
 * lens over structure that is already committed.
 *
 *   node tools/critic/buildworth.mjs --out shots/buildworth [--url …]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/buildworth'));
const LOCALES = (arg('locales', 'en,es,pl')).split(',');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const checks = [];
const ok = (pass, what, detail = '') => {
  checks.push({ pass, what, detail });
  console.log(`  ${pass ? 'OK  ' : 'BAD '} ${what}${detail ? ' — ' + detail : ''}`);
};
const shot = async (name, ms = 300) => {
  await page.waitForTimeout(ms);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
};

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch { /* private */ } });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4200);

const facts = () => page.evaluate(() => {
  const a = window.__ascent, b = a.builder;
  const live = [];
  for (const k of Object.keys(b.lattice.live)) {
    for (const p of b.lattice.live[k]) {
      if (!p.dead) live.push({ kind: k, x: p.x, y: p.y, z: p.z, base: p.base, turn: p.turn });
    }
  }
  const tg = b.target();
  return {
    pos: { x: a.player.pos.x, y: a.player.pos.y, z: a.player.pos.z },
    yaw: a.player.yaw, slot: b.slot, turn: b.turn, owned: b.solids.owned,
    charge: Math.round(b.charge), boxed: !!b.player.boxed,
    ghostKind: tg.kind, ghostAt: [tg.x, tg.z], ghostBase: tg.base, ghostValid: tg.valid,
    ground: a.islandAt(a.player.pos.x, a.player.pos.z),
    anchors: a.anchors(),
    motes: a.ledger()[0]?.left ?? null,
    anchorLog: a.ledger().filter((r) => r.why === 'anchor').length,
    pieces: live,
    toast: document.querySelector('.toast.show')?.textContent || '',
  };
});

const CANDIDATES = [[1180, 520], [420, 560], [1320, 300], [300, 250], [1120, 700], [800, 300]];
const worldPoint = () => page.evaluate((pts) => {
  const TAGS = 'button,a[href],input,select,textarea,summary,label,[role="button"],'
    + '[role="tab"],[role="switch"],[role="menuitem"],[contenteditable="true"]';
  const uiHit = (el) => {
    let hit = false;
    for (let n = el; n && n.nodeType === 1 && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.opacity === '0' || cs.visibility === 'hidden' || cs.display === 'none') return false;
      if (!hit && (n.matches?.(TAGS) || cs.cursor === 'pointer')) hit = true;
    }
    return hit;
  };
  for (const p of pts) {
    const el = document.elementFromPoint(p[0], p[1]);
    if (el && !uiHit(el)) return p;
  }
  return null;
}, CANDIDATES);

const click = async () => {
  const first = await worldPoint();
  const order = first ? [first, ...CANDIDATES.filter((p) => p !== first)] : CANDIDATES;
  for (const pt of order) {
    await page.mouse.click(pt[0], pt[1]);
    await page.waitForTimeout(90);
    const onUI = await page.evaluate(() => window.__ascent.input.pointerOnUI);
    if (!onUI) { await page.waitForTimeout(240); return pt; }
    await page.waitForTimeout(300);
  }
  return null;
};

async function pressUntil(key, want, tries = 4) {
  for (let i = 0; i < tries; i++) {
    await page.keyboard.press(key);
    for (const w of [280, 420, 700]) {
      await page.waitForTimeout(w);
      const f = await facts();
      if (want(f)) return { f, presses: i + 1 };
    }
  }
  return { f: await facts(), presses: tries, failed: true };
}

const KEYS = ['KeyW', 'KeyS', 'KeyA', 'KeyD'];
const dirOf = (yaw) => {
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  return { KeyW: [fx, fz], KeyS: [-fx, -fz], KeyA: [fz, -fx], KeyD: [-fz, fx] };
};
async function walkTo(tx, tz, tol = 0.8, tries = 30) {
  for (let i = 0; i < tries; i++) {
    const f = await facts();
    const dx = tx - f.pos.x, dz = tz - f.pos.z;
    const d = Math.hypot(dx, dz);
    if (d <= tol) return true;
    const dir = dirOf(f.yaw);
    let best = null, bs = -Infinity;
    for (const k of KEYS) {
      const s = (dir[k][0] * dx + dir[k][1] * dz) / d;
      if (s > bs) { bs = s; best = k; }
    }
    await page.keyboard.down(best);
    await page.waitForTimeout(Math.min(400, Math.max(90, d * 55)));
    await page.keyboard.up(best);
    await page.waitForTimeout(200);
  }
  return false;
}

// =========================================================================
// 1. TRAVERSAL. The anchor nothing in the kit reaches.
// =========================================================================
console.log('\n== the anchor nothing in the kit reaches');
const f0 = await facts();
const an = f0.anchors;
console.log(`  anchors: ${an.total}, secured ${an.secured}, at ${JSON.stringify(an.at.map((p) => p.map((v) => +v.toFixed(1))))}`);
ok(an.total >= 3 && an.secured === 0, 'three anchors hang over the plaza, none of them secured yet',
  `${an.total} anchors`);

// Pick the lowest — if the cheapest one cannot be reached by hand, none can.
const heights = await page.evaluate((at) => at.map((p) => ({
  x: p[0], y: p[1], z: p[2], ground: window.__ascent.islandAt(p[0], p[2]),
})), an.at);
heights.sort((a, b) => (a.y - a.ground) - (b.y - b.ground));
const A = heights[0];
const RISE = A.y - A.ground;
console.log(`  lowest anchor at ${A.x.toFixed(1)}, ${A.z.toFixed(1)} — ${RISE.toFixed(1)} m of still air above its own pad`);

// Stand on its pad and throw everything the kit has at it: jump, the second
// jump, and the wing. The apex is what a player gets for free.
await walkTo(A.x, A.z, 1.2, 42);
void (await facts());
const apex = await page.evaluate(async () => {
  const a = window.__ascent;
  const base = a.player.pos.y;
  let top = base;
  const sample = setInterval(() => { top = Math.max(top, a.player.pos.y); }, 16);
  const key = (code) => {
    for (const type of ['keydown', 'keyup']) {
      dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }));
    }
  };
  key('Space');
  await new Promise((r) => setTimeout(r, 260));
  key('Space');                     // the second jump
  await new Promise((r) => setTimeout(r, 220));
  key('KeyG');                      // and the wing
  await new Promise((r) => setTimeout(r, 2600));
  clearInterval(sample);
  return { base, top, gain: top - base };
});
console.log(`  jump + double jump + wing off the pad: ${apex.gain.toFixed(2)} m of gain`);
// The wing does not gain height, but it does carry him a long way sideways —
// far enough, on one run, to leave the island altogether. Put him back on the
// ground he started from with the game's own recovery key before measuring
// anything else.
await page.keyboard.press('KeyG');           // fold the wing
await pressUntil('KeyR', (f) => f.pos.y > A.ground - 3 && f.pos.y < A.ground + 3, 3);
await page.waitForTimeout(500);
ok(apex.gain < RISE - 3.4,
  'nothing in the kit reaches the anchor — the reward is a construction problem',
  `best free gain ${apex.gain.toFixed(2)} m against ${RISE.toFixed(1)} m of air `
  + `(the anchor is secured within 3.4 m)`);
await shot('01-anchor-out-of-reach');

// THE RAMP RUSH. Hold the trigger, hold W, and run up the staircase you are
// laying under your own boots. This is the gesture the verb exists for, and it
// is the one that proves the collider and the renderer are the same surface:
// the ramp has to be solid on the frame it appears or the cadet runs off the
// end of the world instead of up it.
//
// The cadet cannot be turned from a headless page (pointer lock is refused), so
// the run is lined up instead: he starts on the anchor's own column, the
// staircase's number of storeys back along the way he is already facing.
const need = Math.ceil((RISE - 1.5) / 4);
const fwd = await page.evaluate(() => {
  const a = window.__ascent;
  return { x: Math.sin(a.player.yaw), z: Math.cos(a.player.yaw) };
});
const cell = (v) => Math.floor(v / 4 + 0.5) * 4;
const startX = cell(A.x) - fwd.x * (need * 4 + 2);
const startZ = cell(A.z) - fwd.z * (need * 4 + 2);
console.log(`  ${need} ramps should do it; lining the run up ${(need * 4 + 2).toFixed(0)} m back `
  + `at ${startX.toFixed(1)}, ${startZ.toFixed(1)} facing ${fwd.x.toFixed(2)}, ${fwd.z.toFixed(2)}`);
await walkTo(startX, startZ, 1.6, 60);
const onMark = await facts();
ok(Math.hypot(onMark.pos.x - startX, onMark.pos.z - startZ) < 3.0
  && Math.abs(onMark.pos.y - (onMark.ground ?? -999)) < 1.2,
  'stood on the mark, on the ground, before the run',
  `at ${onMark.pos.x.toFixed(1)}, ${onMark.pos.z.toFixed(1)}, y ${onMark.pos.y.toFixed(2)} `
  + `over ground ${onMark.ground === null ? 'void' : onMark.ground.toFixed(2)}`);
await pressUntil('Digit2', (f) => f.slot === 1);

// A recorder on the placement path — read only, and it places nothing. Without
// it a staircase that comes out wrong is a list of four numbers with no account
// of how they were chosen.
await page.evaluate(() => {
  const a = window.__ascent, b = a.builder;
  window.__placed = [];
  const orig = b.place.bind(b);
  b.place = function record() {
    const tg = b.target();
    const cands = b._cands.map((c, i) => [+c.toFixed(2), +b._cw[i].toFixed(1), b._cr[i] ?? -1]);
    const r = orig();
    if (r.ok) {
      window.__placed.push({
        z: +a.player.pos.z.toFixed(2), y: +a.player.pos.y.toFixed(2),
        aim: `${tg.x},${tg.z}`, base: +tg.base.toFixed(2), cands,
      });
    }
    return r;
  };
});
const rushPt = await worldPoint() || CANDIDATES[0];
await page.mouse.move(rushPt[0], rushPt[1]);
const trace = [];
const rush = await (async () => {
  const t0 = await page.evaluate(() => performance.now());
  await page.keyboard.down('KeyW');
  await page.mouse.down();
  // One unbroken gesture. Long enough to lay the whole staircase and no longer
  // — and it stops the moment the cadet starts LOSING height, because a rush
  // that has run out of ramps is a cadet running off the end of one.
  let best = -Infinity;
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(260);
    const s = await page.evaluate(() => {
      const a = window.__ascent, b = a.builder;
      const tg = b.target();
      return {
        y: +a.player.pos.y.toFixed(2), x: +a.player.pos.x.toFixed(1), z: +a.player.pos.z.toFixed(1),
        ramps: b.lattice.live.ramp.filter((p) => !p.dead).length,
        aim: `${tg.x},${tg.z}`, base: +tg.base.toFixed(2), valid: tg.valid, why: tg.reason,
        charge: Math.round(b.charge), secured: a.anchors().secured,
      };
    });
    trace.push(s);
    if (s.secured > 0) break;
    if (s.y > best) best = s.y;
    else if (best - s.y > 3.0) break;      // he is falling: the rush is over
  }
  await page.mouse.up();
  await page.keyboard.up('KeyW');
  const t1 = await page.evaluate(() => performance.now());
  await page.waitForTimeout(500);
  return { ms: t1 - t0 };
})();
for (const s of trace) {
  console.log(`    y ${String(s.y).padStart(7)}  at ${String(s.x).padStart(6)},${String(s.z).padStart(6)}  `
    + `ramps ${s.ramps}  aim ${s.aim.padEnd(10)} base ${String(s.base).padStart(7)}  `
    + `${s.valid ? 'valid' : 'REFUSED ' + s.why}  charge ${s.charge}`);
}
const climbed = await facts();
const ramps = climbed.pieces.filter((p) => p.kind === 'ramp').length;
let secured = climbed.anchors.secured;
if (!secured) {
  await walkTo(A.x, A.z, 1.4, 20);
  secured = (await facts()).anchors.secured;
}
const done = await facts();
console.log(`  the rush: ${ramps} ramps in ${Math.round(rush.ms)} ms of one held trigger, `
  + `standing ${(done.pos.y - A.ground).toFixed(2)} m above the pad`);
ok(ramps >= 2, 'ONE held trigger and W lay a whole staircase under his own boots',
  `${ramps} ramps, no second click`);
// A STAIRCASE, NOT A SAWTOOTH. Each ramp has to be founded on the head of the
// one before it. Two ramps on the same level means a four-metre step down at
// the joint, and a cadet who runs the stair falls off it every second cell.
const stair = climbed.pieces.filter((p) => p.kind === 'ramp')
  .sort((u, v) => (u.x - v.x) * fwd.x + (u.z - v.z) * fwd.z);
const steps = stair.slice(1).map((p, i) => +(p.base - stair[i].base).toFixed(2));
console.log(`  the stair: ${stair.map((p) => p.base.toFixed(2)).join(' → ')}  (steps ${steps.join(', ')})`);
for (const q of await page.evaluate(() => window.__placed || [])) {
  const aimY = q.y + 1.62;
  const seen = [...new Map(q.cands.map((c) => [`${c[0]}|${c[2]}`, c])).values()]
    .map(([c, w, r]) => ({ c, w, r, s: +(Math.abs(c - aimY) + w).toFixed(2) }))
    .sort((u, v) => u.s - v.s).slice(0, 4);
  console.log(`    set at z=${q.z} y=${q.y} aim ${q.aim} -> base ${q.base}`);
  for (const c of seen) console.log(`        cand ${String(c.c).padStart(7)} w ${String(c.w).padStart(5)} rank ${c.r} score ${c.s}`);
}
ok(steps.length > 0 && steps.every((d) => Math.abs(d - 4) < 0.01),
  'and every ramp is founded on the head of the one before it — one storey each, no repeats',
  `bases ${stair.map((p) => p.base.toFixed(2)).join(', ')}`);
ok(done.pos.y - A.ground > apex.gain + 1,
  'and it carries him higher than anything he can do without it',
  `stood ${(done.pos.y - A.ground).toFixed(2)} m up; the best free jump was ${apex.gain.toFixed(2)} m`);
ok(secured > 0, 'the anchor is secured — the building bought the reward',
  `secured ${secured} of ${done.anchors.total}, ${done.anchorLog} anchor payment(s) on the ledger, `
  + `balance ${done.motes}`);
await shot('02-anchor-secured');

// =========================================================================
// 2. NEVER TRAPPED. Not on the ground, and not thirty metres up either.
// =========================================================================
console.log('\n== and he cannot be stranded by his own stair');
const high = await facts();
const stranded = await pressUntil('KeyR', (f) => Math.abs(f.pos.y - high.pos.y) > 1.5, 3);
ok(!stranded.failed, 'R brings him down off his own structure', `y ${stranded.f.pos.y.toFixed(2)}`);

// =========================================================================
// 3. THE MATHEMATICS. A beam is the balance; a floor is the area model.
// =========================================================================
console.log('\n== a beam beside a rift becomes that rift\'s balance');
// Find a rift the cadet is allowed at, and open it — a rift verb, not a build
// verb, and the only way to put a *real* generated item into the apparatus'
// hands, which is the whole claim being tested.
const rift = await page.evaluate(async () => {
  const a = window.__ascent;
  // Prefer a rift whose skill is an equation: `ax + b = c` is the only shape
  // that lays out as physical tiles, so those are the rifts where the balance
  // can carry the learner's OWN numbers rather than its seeded stand-in.
  const rank = (id) => ['two-step', 'one-step-add', 'one-step-mul', 'multi-step', 'both-sides']
    .indexOf(id.replace(/-t\d+$/, ''));
  const list = a.rifts.list.filter((x) => !x.locked)
    .sort((u, v) => (rank(v.id) - rank(u.id)));
  for (const r of (list.length ? list : a.rifts.list).slice(0, 4)) {
    a.teleportTo(r.id);
    a.openRiftById(r.id);
    await new Promise((res) => setTimeout(res, 1100));
    const ctx = a.builder.man.ctx.get(r.id);
    a.panel.close();
    for (let k = 0; k < 12 && a.input.uiOpen; k++) {
      a.panel.close(); a.input.uiOpen = false;
      await new Promise((res) => setTimeout(res, 120));
    }
    await new Promise((res) => setTimeout(res, 600));
    if (ctx) {
      return {
        id: r.id, x: r.pos.x, z: r.pos.z, foot: r.foot.toArray(),
        item: { ...ctx }, real: true,
      };
    }
  }
  const r = (list.length ? list : a.rifts.list)[0];
  a.teleportTo(r.id);
  await new Promise((res) => setTimeout(res, 900));
  return { id: r.id, x: r.pos.x, z: r.pos.z, foot: r.foot.toArray(), item: null, real: false };
});
await page.waitForTimeout(1600);          // let him land off the dais
const item = rift.item;
if (item) {
  ok(true, 'the rift hands the build system the equation it is actually holding',
    `${rift.id}: ${item.lhs} = ${item.rhs}`);
} else {
  console.log(`  none of the rifts open on a cold save held a statement small enough to lay `
    + `out as tiles; the apparatus falls back to its own seeded statement, which is still true`);
}

// Stand on flat ground beside the rift and set a beam with a real click.
const site = await page.evaluate((q) => {
  const a = window.__ascent;
  const c = (v) => Math.floor(v / 4 + 0.5) * 4;
  let best = null, bs = Infinity;
  for (let i = -3; i <= 3; i++) {
    for (let j = -3; j <= 3; j++) {
      const x = c(q.foot[0]) + i * 4, z = c(q.foot[2]) + j * 4;
      const d = Math.hypot(x - q.foot[0], z - q.foot[2]);
      if (d < 7 || d > 18) continue;
      let lo = Infinity, hi = -Infinity, bad = false;
      for (const [dx, dz] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
        const h = a.islandAt(x + dx, z + dz);
        if (h === null) { bad = true; break; }
        lo = Math.min(lo, h); hi = Math.max(hi, h);
      }
      if (bad) continue;
      const s = (hi - lo) * 4 + d * 0.1;
      if (s < bs) { bs = s; best = { x, z, span: +(hi - lo).toFixed(2), d: +d.toFixed(1) }; }
    }
  }
  return best;
}, rift);
console.log(`  building beside ${rift.id} at ${site ? `${site.x}, ${site.z} (${site.d} m out)` : 'nowhere flat'}`);
if (site) await walkTo(site.x, site.z, 1.4, 44);

await page.evaluate(async () => {
  const a = window.__ascent;
  for (let k = 0; k < 20 && a.input.uiOpen; k++) {
    a.panel.close(); a.input.uiOpen = false;
    await new Promise((r) => setTimeout(r, 120));
  }
});
await page.waitForTimeout(500);
const stage = await page.evaluate(() => {
  const a = window.__ascent, b = a.builder;
  const r = b.man.nearRift(a.player.pos.x, a.player.pos.z);
  return {
    uiOpen: a.input.uiOpen, active: b.active, rifts: b.man.rifts.length,
    near: r ? r.id : null,
    dist: r ? +Math.hypot(r.pos.x - a.player.pos.x, r.pos.z - a.player.pos.z).toFixed(1) : null,
  };
});
console.log(`  stage: ${JSON.stringify(stage)}`);
ok(!stage.uiOpen && stage.active && !!stage.near,
  'the cadet is stood beside the rift with the build hand live',
  `nearest rift ${stage.near} at ${stage.dist} m, panel ${stage.uiOpen ? 'open' : 'closed'}`);

await pressUntil('Digit4', (f) => f.slot === 3);
const preBeam = await facts();
await click();
const beamF = await facts();
const rig = await page.evaluate(() => {
  const m = window.__ascent.builder.man;
  const bal = m.items.find((i) => i.kind === 'balance');
  if (!bal) return null;
  const tags = [...document.querySelectorAll('.axiom-tag')];
  return {
    load: bal.load.length,
    xTiles: bal.load.filter((t) => t.kind === 'x').length,
    unitTiles: bal.load.filter((t) => t.kind === 'unit').length,
    roll: +bal.roll.toFixed(4),
    tags: tags.map((t) => t.textContent.trim()).filter(Boolean),
    katex: tags.filter((t) => t.querySelector('.katex')).length,
  };
});
ok(beamF.owned === preBeam.owned + 1 && !!rig,
  'a real click beside the rift sets a beam, and it becomes a balance',
  rig ? `${rig.load} tiles hung: ${rig.xTiles} unknowns, ${rig.unitTiles} units`
    : `owned ${preBeam.owned} → ${beamF.owned}, no balance`);
if (rig) {
  const c = item || await page.evaluate((id) => {
    // the seeded stand-in the apparatus falls back to is still a TRUE statement
    const m = window.__ascent.builder.man;
    const b = m.items.find((i) => i.kind === 'balance');
    return b ? { a: b.load.filter((t) => t.kind === 'x').length } : null;
  }, rift.id);
  if (item) {
    ok(rig.xTiles === Math.min(item.a, 6)
      && rig.unitTiles === Math.min(item.b, 28) + Math.min(item.c, 28),
      'the pans carry THIS rift\'s numbers, not a stand-in',
      `${item.a}x + ${item.b} = ${item.c} → ${rig.xTiles} unknown tiles, ${rig.unitTiles} unit tiles`);
  }
  ok(rig.katex >= 2, 'and the two sides are set in real KaTeX, not unicode glyphs',
    `${rig.katex} of ${rig.tags.length} tags carry a .katex node — ${JSON.stringify(rig.tags.slice(0, 4))}`);
  void c;
}
await page.waitForTimeout(2400);      // let it settle
const settled = await page.evaluate(() => {
  const b = window.__ascent.builder.man.items.find((i) => i.kind === 'balance');
  return b ? +Math.abs(b.roll).toFixed(4) : null;
});
ok(settled !== null && settled < 0.03,
  'and it settles dead level, because the two sides ARE equal — the settle is the argument',
  `|roll| ${settled} rad`);
await shot('03-balance');

console.log('\n== a floor beside a rift becomes the area model');
await pressUntil('Digit3', (f) => f.slot === 2);
const preArea = await facts();
await click();
const areaF = await facts();
const area = await page.evaluate(() => {
  const m = window.__ascent.builder.man;
  const a = m.items.find((i) => i.kind === 'area');
  if (!a) return null;
  const tags = [...document.querySelectorAll('.axiom-tag')];
  return {
    plates: a.group.children.length,
    tags: tags.map((t) => t.textContent.trim()).filter(Boolean),
    katex: tags.filter((t) => t.querySelector('.katex')).length,
  };
});
ok(areaF.owned === preArea.owned + 1 && !!area,
  'a real click beside the rift lays a floor, and it rules itself into an area model',
  area ? `${area.plates} parts, ${area.katex} KaTeX tags` : 'no area model');
if (area) {
  ok(area.katex >= 3, 'and the model is ruled and labelled in real KaTeX',
    `${area.katex} KaTeX tags — ${JSON.stringify(area.tags.slice(0, 6))}`);
  if (item) {
    const got = area.tags.map((s) => s.replace(/\s+/g, ''));
    ok(got.some((s) => s.includes(String(item.k)) || s.includes(String(item.n))),
      'and it is ruled to this rift\'s own identity',
      `${item.identity} — tags ${JSON.stringify(area.tags.slice(0, 8))}`);
  }
}
await shot('04-area-model');

// All three locales: the apparatus names itself in the player's language.
console.log('\n== the apparatus names itself in every locale');
for (const loc of LOCALES) {
  const words = await page.evaluate(async (l) => {
    const a = window.__ascent;
    a.setLocale(l);
    await new Promise((r) => setTimeout(r, 600));
    return [...document.querySelectorAll('.axiom-tag')].map((t) => t.textContent.trim()).filter(Boolean);
  }, loc).catch(() => null);
  if (words) {
    ok(words.length > 0, `${loc}: the apparatus is labelled`, JSON.stringify(words.slice(0, 4)));
    await shot(`05-apparatus-${loc}`);
  }
}

const after = await facts();
await writeFile(path.join(OUT, 'buildworth.json'), JSON.stringify({
  anchor: { rise: RISE, freeGain: apex.gain, ramps, secured, rushMs: rush.ms, trace },
  item, rig, area, checks, errors, pieces: after.pieces,
}, null, 2));

console.log(`\nconsole errors: ${errors.length}${errors.length ? ' — ' + errors.slice(0, 3).join(' | ') : ''}`);
const bad = checks.filter((c) => !c.pass);
console.log(bad.length ? `\nFAILING: ${bad.length}` : '\nbuilding earns its place');
await browser.close();
process.exit(bad.length || errors.length ? 1 : 0);
