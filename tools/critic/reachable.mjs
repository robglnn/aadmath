#!/usr/bin/env node
/**
 * THE REACHABILITY GATE — can a player actually get to the content we shipped?
 *
 *   node tools/critic/reachable.mjs              # build, serve, play, judge
 *   node tools/critic/reachable.mjs --self-test  # prove every leg of it can fail
 *   node tools/critic/reachable.mjs --url http://127.0.0.1:5173   # an existing server
 *   node tools/critic/reachable.mjs --headed --out shots/reachable
 *   node tools/critic/reachable.mjs --what-if "course=algebra1"   # what it will say after
 *
 * WHY THIS FILE EXISTS
 *
 * The manifest ships five units and sixty-two skills. A blind critic played the
 * game the way a student would — open the page, no query string, cleared save —
 * and found FIFTY-TWO OF THE SIXTY-TWO UNREACHABLE. Every gate was green. They
 * were green because every gate that touches content reaches it by NAME:
 * `generate('exponent-power', 3, seed)` works perfectly for a skill no player
 * can ever be handed. `validate-courses` proved 78,594 items across five units
 * and none of them were in the game.
 *
 * `?unit=` and `?course=` are how a tool reaches the other four. Nobody plays
 * with a query string. With no query string `src/content/index.js` resolves the
 * manifest default — Algebra I Level 1 — and the other fifty-two nodes are not
 * in the lattice, have no rift standing in the world, and cannot be scheduled.
 *
 * So this gate is forbidden to name anything. It boots the shipped page with no
 * query string and a cleared save, walks with real key events, opens with a real
 * key, and then asks one question per unit: IS THERE A WAY IN.
 *
 * THE FIVE LEGS, and what each one would have caught
 *
 *   PLAY      A cold player, WASD and the mouse and one interact key, reaches a
 *             rift and opens it. No `teleportTo`, no `openRiftById`. This is the
 *             leg that makes the rest of the report about the game rather than
 *             about the data — and the null-input control below proves the leg
 *             is measuring the keys and not the clock.
 *
 *   LATTICE   Every unit the manifest calls `shipped` puts at least one node
 *             into a graph the shipped boot actually loads — at the cold boot,
 *             or at one of the boots the ROUTE opens along the way (below).
 *
 *   ROUTE     The regions past the first. `src/content/route.js` opens a unit
 *             once every line of every unit it `requires` is held, so a unit
 *             beyond the first is DELIBERATELY not in a cleared save's lattice
 *             and never will be. This leg walks that road: it seeds the save
 *             with the lines the manifest itself says the next unit stands on,
 *             reloads with NO query string, and judges the boot that comes
 *             back — LATTICE, WORLD and CLIMB again, on the region a learner
 *             earns. A shipped unit that is in no boot on that road fails.
 *
 *   WORLD     Every one of those nodes has a rift standing in the world. A node
 *             in the lattice with nothing to walk to is not reachable either.
 *
 *   CLIMB     Every one of those nodes has a prerequisite closure that lies
 *             inside the lattice, so a legal order of seals opens it. A node
 *             whose prerequisite lives in a unit the boot did not load is
 *             permanently locked — the engine will never unlock it, and the
 *             rift stands there dim for ever.
 *
 *   REACHED   How many of those units real play actually got to inside the
 *             budget. Reported, not asserted: a gate that demanded a full
 *             sixty-skill play-through would take an hour and would be
 *             switched off. PLAY asserts every rift that is LIVE at boot can be
 *             walked to and opened; LATTICE, WORLD and CLIMB assert the rest is
 *             openable in principle by the real engine's own rules.
 *
 * WHY THE ROUTE LEG SEEDS A SAVE, AND WHY THAT IS NOT CHEATING.
 *
 * The cold boot's lattice was, for several waves, the whole of what a player
 * could ever reach, so "in the boot lattice" and "reachable" were the same
 * sentence and this gate asserted the first to mean the second. They are not
 * the same sentence any more. Measured, on this build:
 *
 *     cold boot, no query string: 1 unit, 10 nodes, 10 rifts
 *     algebra1/algebra1-l2: declared 14, in-lattice 0  -> FAIL
 *
 * — while `tools/route-proof.mjs` proves, through the real MasteryEngine, that
 * ten held lines open algebra1-l2 into a 24-node lattice, and
 * `tools/critic/route.mjs` plays the real game with real keys from a cleared
 * save and arrives there. The old rule was reporting a design as a defect.
 *
 * So the seed is not progress this gate awarded itself; it is the record the
 * MANIFEST says that unit stands on, written into the same `ascent.save`
 * `src/main.js` writes on every answer, and it is a record two other gates
 * prove real play produces. Nothing is passed in the address bar, nothing is
 * unlocked by hand, and the game's own route rule is what decides whether the
 * region opens — if it does not, this leg fails, which is the point.
 *
 * WHAT THIS GATE MAY NOT DO. It may not make progress through `window.__ascent`.
 * It reads facts back from it — which rift is where, which skill a card is on,
 * which nodes the boot loaded — and it drives the game with keys and the mouse
 * and nothing else. Three rounds of agents "fixed" rift interaction while
 * verifying it through `openRiftById()`, which skips the entire act of walking
 * up to one and pressing a key, and shipped it broken twice. See
 * tools/critic/coldplay.mjs, which exists for the same reason.
 */
import { chromium } from 'playwright';
import { build } from 'vite';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listenFree } from '../_freeport.mjs';
import { findings } from '../_findings.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// ===========================================================================
// THE JUDGEMENT, as a pure function.
//
// Everything the gate concludes about units is decided here, off four plain
// inputs, so the self-test can plant each defect by hand and watch the verdict
// change. Nothing in here touches a browser.
// ===========================================================================
/**
 * @param {{id:string,status:string,units:{id:string,status:string,requires?:string[]}[]}[]} courses
 *        the manifest's course blocks
 * @param {{unit:string, nodes:string[]}[]} unitNodes  which node ids each unit's graph declares
 * @param {{id:string, prereqs:string[]}[]} lattice    the graph the shipped boot loaded
 * @param {string[]} riftIds                           the rifts standing in the world
 * @returns {{ok:boolean, rows:object[], problems:string[]}}
 */
export function judgeUnits(courses, unitNodes, lattice, riftIds) {
  const problems = [];
  const rows = [];
  const inLattice = new Set(lattice.map((n) => n.id));
  const prereqs = new Map(lattice.map((n) => [n.id, n.prereqs || []]));
  const rifts = new Set(riftIds);
  const nodesOf = new Map(unitNodes.map((u) => [u.unit, u.nodes]));

  /**
   * Is every prerequisite, transitively, inside the lattice and free of cycles?
   *
   * `path` is the branch being walked, not everything visited: a lattice where
   * two prerequisites share one ancestor is a diamond, which is perfectly
   * legal, and a single visited-set reports the second arrival at that ancestor
   * as a cycle. The first draft did exactly that and called three of Level 1's
   * ten nodes unreachable — a gate that invents defects gets ignored as fast as
   * one that misses them.
   */
  const memo = new Map();
  const climbable = (id, path = new Set()) => {
    if (path.has(id)) return false;              // a cycle is not a climb
    if (memo.has(id)) return memo.get(id);
    path.add(id);
    let ok = true;
    for (const p of prereqs.get(id) || []) {
      if (!inLattice.has(p) || !climbable(p, path)) { ok = false; break; }
    }
    path.delete(id);
    // Only a result reached without a cycle above it is a fact about the node.
    if (path.size === 0) memo.set(id, ok);
    return ok;
  };

  for (const course of courses) {
    for (const unit of course.units || []) {
      if (unit.status !== 'shipped') continue;
      const ids = nodesOf.get(unit.id) || [];
      const present = ids.filter((id) => inLattice.has(id));
      const withRift = present.filter((id) => rifts.has(id));
      const openable = withRift.filter((id) => climbable(id));
      const row = {
        course: course.id, unit: unit.id,
        declared: ids.length, inLattice: present.length, withRift: withRift.length, openable: openable.length,
        example: openable[0] || withRift[0] || present[0] || null,
      };
      rows.push(row);
      if (!present.length) {
        problems.push(`${course.id}/${unit.id}: the manifest calls this unit shipped and the boot lattice holds none of its ${ids.length} nodes `
          + '— with no query string a player can never be served one of them');
        continue;
      }
      if (!withRift.length) {
        problems.push(`${course.id}/${unit.id}: ${present.length} node(s) are in the lattice and not one of them has a rift in the world `
          + '— there is nothing to walk to');
        continue;
      }
      if (!openable.length) {
        const why = withRift.map((id) => {
          const missing = (prereqs.get(id) || []).filter((p) => !inLattice.has(p));
          return missing.length ? `${id} needs ${missing.join(', ')}` : `${id} sits in a prerequisite cycle`;
        });
        problems.push(`${course.id}/${unit.id}: every rift it has is locked for ever — ${why.slice(0, 3).join('; ')}`);
      }
    }
  }
  return { ok: problems.length === 0, rows, problems };
}

/**
 * ONE VERDICT OUT OF THE BOOTS ALONG THE ROUTE.
 *
 * A unit is reachable if ANY boot on the road put it in the lattice with a
 * rift and a legal climb — that is what `openable > 0` means, and one boot
 * showing it is proof. A unit no boot ever seated keeps the complaint from the
 * DEEPEST boot that looked at it, because that is the one that had the most of
 * the road behind it and therefore the most informative reason.
 *
 * @param {{ok:boolean, rows:object[], problems:string[]}[]} verdicts in road order
 */
export function mergeVerdicts(verdicts) {
  const best = new Map();
  for (const v of verdicts) {
    for (const r of v.rows) {
      const cur = best.get(r.unit);
      const better = !cur || r.openable > cur.openable
        || (r.openable === cur.openable && r.withRift > cur.withRift)
        || (r.openable === cur.openable && r.withRift === cur.withRift && r.inLattice > cur.inLattice);
      if (better) best.set(r.unit, r);
    }
  }
  const rows = [...best.values()];
  const settled = new Set(rows.filter((r) => r.openable > 0).map((r) => r.unit));
  const problems = [];
  const said = new Set();
  for (const v of [...verdicts].reverse()) {
    for (const p of v.problems) {
      const unit = (p.split(':')[0].split('/')[1] || '').trim();
      if (settled.has(unit) || said.has(unit)) continue;
      said.add(unit);
      problems.push(p);
    }
  }
  return { ok: problems.length === 0, rows, problems };
}

// ===========================================================================
// The run
// ===========================================================================
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes(k);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.map': 'application/json', '.ico': 'image/x-icon', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };

const steps = [];
const note = (ok, label, detail = '') => {
  steps.push({ ok, label, detail });
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ' — ' + detail : ''}`);
};

/**
 * Take whatever full-frame card is standing, the way a player takes it.
 *
 * Its own button first — that is the press the card asks for — and Escape only
 * if there is no button to press. Returns when the game has given the input
 * back, or after twelve seconds, which is long enough that a card that will
 * not go away is reported as a stuck walk rather than hidden as a fast one.
 */
async function takeTheFrame(page, budget = 12000) {
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
    await page.waitForTimeout(700);
  }
  return false;
}

/**
 * Walk to a rift and open it with the KEYBOARD alone — no pointer lock needed.
 *
 * The bearing is read out of the world (the rift's position and the camera's
 * own forward vector), which is the same class of fact as reading which rift is
 * where; every metre of ground is covered by a real key. `err` is the bearing
 * to the tear minus the camera's heading, both from `atan2(x, z)`, and in that
 * frame ArrowLEFT is the one that closes a positive error.
 *
 * @returns {{reached:boolean, opened:boolean, key:string|null, dist:number}}
 */
async function walkByKeys(page, riftId, budgetMs = 120000) {
  const t0 = Date.now();
  const down = new Set();
  const hold = async (code, on) => {
    if (on === down.has(code)) return;
    if (on) { down.add(code); await page.keyboard.down(code); }
    else { down.delete(code); await page.keyboard.up(code); }
  };
  const release = async () => { for (const c of [...down]) await hold(c, false); };
  let dist = Infinity;
  try {
    while (Date.now() - t0 < budgetMs) {
      if (await page.evaluate(() => !!window.__ascent.input?.uiOpen).catch(() => false)) {
        await release();
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        continue;
      }
      const b = await page.evaluate((id) => {
        const A = window.__ascent;
        const p = A.player.pos;
        const r = A.rifts.list.find((x) => x.id === id);
        if (!r) return null;
        const f = new A.THREE.Vector3();
        A.camera.getWorldDirection(f);
        let err = Math.atan2(r.pos.x - p.x, r.pos.z - p.z) - Math.atan2(f.x, f.z);
        while (err > Math.PI) err -= Math.PI * 2;
        while (err < -Math.PI) err += Math.PI * 2;
        return { err, dist: Math.hypot(r.pos.x - p.x, r.pos.z - p.z) };
      }, riftId).catch(() => null);
      if (!b) { await page.waitForTimeout(300); continue; }
      dist = b.dist;
      if (Math.abs(b.err) > 0.7) {
        await hold('KeyW', false);
        const code = b.err > 0 ? 'ArrowLeft' : 'ArrowRight';
        await hold(code === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft', false);
        await hold(code, true);
        await page.waitForTimeout(Math.min(360, 110 + Math.abs(b.err) * 150));
        await hold(code, false);
        continue;
      }
      await hold('ShiftLeft', b.dist > 24);
      await hold('KeyW', true);
      if (Math.abs(b.err) > 0.16) {
        const code = b.err > 0 ? 'ArrowLeft' : 'ArrowRight';
        await hold(code === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft', false);
        await hold(code, true);
        await page.waitForTimeout(Math.min(200, 70 + Math.abs(b.err) * 110));
        await hold(code, false);
      } else {
        await hold('ArrowLeft', false);
        await hold('ArrowRight', false);
      }
      for (let j = 0; j < 3; j++) {
        await page.waitForTimeout(170);
        await page.keyboard.press('KeyE');
        if (await page.evaluate(() => !!window.__ascent.panelInfo?.().open).catch(() => false)) {
          await release();
          return { reached: true, opened: true, key: 'KeyE', dist };
        }
      }
    }
  } finally { await release(); }
  return { reached: false, opened: false, key: null, dist };
}

/**
 * Walk to a rift and open it, with keys and the mouse and nothing else.
 *
 * Modelled on tools/critic/coldplay.mjs: hold W rather than tapping it, so the
 * acceleration curve builds and the cadet runs instead of shuffling; steer with
 * real mouse movement; and treat "the ring opened on contact" as arrival,
 * because contact stops the player and a pure distance test reports failure at
 * the exact moment the game did the right thing.
 *
 * @returns {{reached:boolean, opened:boolean, key:string|null, dist:number}}
 */
async function walkToAndOpen(page, target, { budget = 200, keys = ['KeyE', 'KeyF', 'Enter', 'Space'] } = {}) {
  await page.mouse.move(800, 450);
  await page.mouse.click(800, 450);                      // pointer lock, the way a person starts
  await page.waitForTimeout(250);

  let reached = false; let opened = false; let dist = Infinity; let held = false;
  for (let i = 0; i < budget && !reached; i++) {
    const err = await page.evaluate((t) => {
      const a = window.__ascent; const p = a.player.pos;
      const want = Math.atan2(t.x - p.x, t.z - p.z);
      let d = ((want - a.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (d < -Math.PI) d += Math.PI * 2;
      return { d, dist: Math.hypot(t.x - p.x, t.z - p.z) };
    }, target);
    dist = err.dist;
    if (Math.abs(err.d) > 0.06) await page.mouse.move(800 - err.d * 240, 450, { steps: 2 });
    if (!held) { await page.keyboard.down('KeyW'); held = true; }
    await page.waitForTimeout(110);
    opened = await page.evaluate(() => !!window.__ascent.panel?.open);
    if (err.dist < 5 || opened) reached = true;
  }
  if (held) await page.keyboard.up('KeyW');

  let key = opened ? 'contact' : null;
  if (!opened) {
    for (const k of keys) {
      await page.keyboard.press(k);
      await page.waitForTimeout(420);
      opened = await page.evaluate(() => !!window.__ascent.panel?.open);
      if (opened) { key = k; break; }
    }
  }
  if (!opened) {                                         // the instinct everyone has
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(900);
    await page.keyboard.up('KeyW');
    opened = await page.evaluate(() => !!window.__ascent.panel?.open);
    if (opened) key = 'walked into it';
  }
  return { reached, opened, key, dist };
}

/** Everything the judgement needs, read off the running game. */
const READ_BOOT = `(() => {
  const a = window.__ascent;
  const c = a.content();
  return {
    course: c.course, units: c.units, packs: c.packs,
    lattice: (a.mastery?.graph?.nodes || []).map((n) => ({ id: n.id, prereqs: (n.prereqs || []).slice() })),
    rifts: (a.rifts?.list || []).map((r) => ({ id: r.id, locked: !!r.locked, x: r.pos.x, y: r.pos.y, z: r.pos.z })),
    search: location.search,
  };
})()`;

async function run() {
  const OUT = path.resolve(arg('out', 'shots/reachable'));
  await mkdir(OUT, { recursive: true });
  const manifest = JSON.parse(await readFile(path.join(ROOT, 'content/courses.json'), 'utf8'));

  // Which node ids each unit declares, read off the graphs the manifest names.
  const unitNodes = [];
  for (const c of manifest.courses) {
    for (const u of c.units || []) {
      const g = JSON.parse(await readFile(path.join(ROOT, 'content', u.graph), 'utf8'));
      unitNodes.push({ unit: u.id, nodes: g.nodes.map((n) => n.id) });
    }
  }
  const shipped = manifest.courses.flatMap((c) => (c.units || []).filter((u) => u.status === 'shipped').map((u) => `${c.id}/${u.id}`));
  console.log(`manifest ships ${shipped.length} unit(s): ${shipped.join(', ')}`);

  // --- a frozen build on a private port -------------------------------------
  // The same reason tools/critic/snapshot.sh exists: several builders hot-edit
  // this tree at once and a dev server full-reloads out from under the run.
  let url = arg('url', null);
  let out = null; let server = null; let browser = null;
  const done = async () => {
    try { server?.close(); } catch { /* already down */ }
    try { await browser?.close(); } catch { /* already down */ }
    if (out) await rm(out, { recursive: true, force: true });
  };

  try {
    if (!url) {
      out = await mkdtemp(path.join(tmpdir(), 'reachable-'));
      await build({ root: ROOT, base: './', logLevel: 'error', build: { target: 'es2022', outDir: out, emptyOutDir: true, sourcemap: false } });
      server = createServer(async (req, res) => {
        const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
        try {
          const body = await readFile(path.join(out, rel));
          res.writeHead(200, { 'content-type': MIME[path.extname(rel)] || 'application/octet-stream' });
          res.end(body);
        } catch { res.writeHead(404); res.end('nope'); }
      });
      // Port 0: the kernel picks one nothing is on. Several critics run at
      // once in this tree, and a fixed random port in a range means a gate can
      // die with EADDRINUSE and be recorded red for a reason that is not the
      // game. See tools/_freeport.mjs --self-test.
      const port = await listenFree(server);
      url = `http://127.0.0.1:${port}`;
    }

    browser = await chromium.launch({ headless: !has('--headed'), args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    // A fresh install, every time, and NO QUERY STRING. `index.html`, nothing
    // after it. That is the whole point of this gate.
    await page.goto(`${url}/index.html`, { waitUntil: 'load' });
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* private mode */ } });
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__ascent, null, { timeout: 45000 });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(OUT, '00-arrival.png') });

    const boot = await page.evaluate(READ_BOOT);
    note(boot.search === '', 'the page under test carries no query string', boot.search || '(none)');
    note(true, 'the shipped boot loaded', `course ${boot.course}, unit(s) ${boot.units.join('+')}, ${boot.lattice.length} node(s), ${boot.rifts.length} rift(s)`);

    // ---- NULL-INPUT CONTROL -------------------------------------------------
    // A gate that would pass without pressing anything is measuring the clock.
    // Wait as long as a walk takes, press nothing, and assert nothing opened
    // and the cadet has not moved. If this ever passes with a rift open, every
    // "ok" below is worthless and the run stops here.
    const p0 = await page.evaluate(() => ({ x: window.__ascent.player.pos.x, z: window.__ascent.player.pos.z }));
    await page.waitForTimeout(4000);
    const idle = await page.evaluate(() => ({
      open: !!window.__ascent.panel?.open,
      x: window.__ascent.player.pos.x, z: window.__ascent.player.pos.z,
    }));
    const moved = Math.hypot(idle.x - p0.x, idle.z - p0.z);
    note(!idle.open && moved < 1.5, 'the control: four seconds with no input opens nothing and moves nobody',
      `${idle.open ? 'a rift opened by itself; ' : ''}drifted ${moved.toFixed(2)} m`);
    if (idle.open) {
      console.log('\nFAIL — a rift opened with no input at all. Nothing below is evidence.');
      await done();
      return 1;
    }

    // ---- PLAY: every rift that is live at boot, on foot ---------------------
    const live = boot.rifts.filter((r) => !r.locked);
    note(live.length > 0, 'at least one rift is live at boot', live.map((r) => r.id).join(', ') || 'none');
    const reachedNodes = [];
    for (const r of live) {
      const res = await walkToAndOpen(page, r);
      const card = await page.evaluate(() => window.__ascent.panelInfo?.() ?? { open: false });
      note(res.opened, `a cold player walks to "${r.id}" and opens it`,
        res.opened ? `${res.key}, card on ${card.skill || '?'}` : `stopped ${res.dist.toFixed(0)} m away; tried W, E, F, Enter, Space`);
      if (res.opened) reachedNodes.push(card.skill || r.id);
      await page.screenshot({ path: path.join(OUT, `10-${r.id}.png`) });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      // Escape may have opened the pause card instead of closing the rift.
      if (await page.evaluate(() => !!window.__ascent.panel?.open)) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
    }

    // ---- LATTICE / WORLD / CLIMB, at the cold boot --------------------------
    const nodesOfUnit = new Map(unitNodes.map((u) => [u.unit, u.nodes]));
    const verdicts = [judgeUnits(manifest.courses, unitNodes, boot.lattice, boot.rifts.map((r) => r.id))];
    const showRows = (rows, indent = '  ') => {
      for (const r of rows) {
        console.log(`${indent}${(`${r.course}/${r.unit}`).padEnd(24)} ${String(r.declared).padStart(8)} ${String(r.inLattice).padStart(11)} `
          + `${String(r.withRift).padStart(10)} ${String(r.openable).padStart(9)}`);
      }
    };
    console.log('\n  the cold boot — cleared save, no query string');
    console.log('  unit                      declared  in-lattice  with-rift  openable');
    showRows(verdicts[0].rows);

    // ---- ROUTE: the regions past the first ---------------------------------
    /* `src/content/route.js` opens a unit once every line of every unit it
       `requires` is HELD, so a region beyond the first is deliberately absent
       from a cleared save's lattice. Walk that road: hold what the manifest
       says the next region stands on, reload with no query string, and judge
       what comes back. The seed is written into `ascent.save` — the same key
       `src/main.js` writes on every answer — and the game's own rule decides
       whether the region opens. See the header for why this is evidence. */
    const settledUnits = () => new Set(mergeVerdicts(verdicts).rows.filter((r) => r.openable > 0).map((r) => r.unit));
    const heldSeed = (unitIds) => {
      const skills = {};
      for (const id of unitIds) for (const n of nodesOfUnit.get(id) || []) {
        skills[n] = { mastered: true, everMastered: true, pL: 0.99, attempts: 3, correct: 3, cleanRun: 3, placed: true };
      }
      return skills;
    };
    const road = manifest.courses.flatMap((c) => (c.units || [])
      .filter((u) => u.status === 'shipped')
      .map((u) => ({ course: c.id, unit: u })));
    for (let leg = 0; leg < road.length; leg++) {
      const have = settledUnits();
      const nextUp = road.find(({ unit }) => !have.has(unit.id));
      if (!nextUp) break;
      // What the manifest itself says that unit stands on. Nothing invented.
      const stands = (nextUp.unit.requires || []).filter((id) => nodesOfUnit.has(id));
      if (!stands.length) break;                    // a root unit that is not at boot is simply absent
      const skills = heldSeed([...new Set([...have, ...stands])]);
      await page.evaluate((sk) => {
        const raw = JSON.parse(localStorage.getItem('ascent.save') || '{}');
        localStorage.setItem('ascent.save', JSON.stringify({
          ...raw, mastery: { ...(raw.mastery || {}), skills: { ...((raw.mastery || {}).skills || {}), ...sk } },
        }));
      }, skills);
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => !!window.__ascent, null, { timeout: 45000 });
      await page.waitForTimeout(3000);
      const b2 = await page.evaluate(READ_BOOT);
      note(b2.search === '', 'the route boot carries no query string either', b2.search || '(none)');
      console.log(`\n  the route boot ${leg + 1} — ${Object.keys(skills).length} line(s) held, no query string`);
      console.log(`  it loaded unit(s) ${b2.units.join('+')}, ${b2.lattice.length} node(s), ${b2.rifts.length} rift(s)`);
      console.log('  unit                      declared  in-lattice  with-rift  openable');
      const v2 = judgeUnits(manifest.courses, unitNodes, b2.lattice, b2.rifts.map((r) => r.id));
      showRows(v2.rows);
      verdicts.push(v2);
      const gained = [...settledUnits()].filter((id) => !have.has(id));
      if (!gained.length) break;                     // the road did not move; stop asking
      await page.screenshot({ path: path.join(OUT, `20-route-${leg + 1}.png`) });

      /* AND WALK INTO IT. A region in the lattice with a rift standing in it is
         not yet a region a player has been in. Same rule as the cold boot's
         PLAY leg and the same function: real mouse look, W held down, one
         interact key. No `teleportTo`, no `openRiftById`, no query string. */
      const fresh = new Set(gained.flatMap((id) => nodesOfUnit.get(id) || []));
      /* NEAREST FIRST, which is what a player does and what the objective
         marker points at. Taking the list in graph order sent the walk at a
         tear 69 m away and it ran out of budget on the way — a fact about the
         list, not about the road. */
      const here = await page.evaluate(() => ({ x: window.__ascent.player.pos.x, z: window.__ascent.player.pos.z }));
      const live = b2.rifts.filter((r) => !r.locked && fresh.has(r.id))
        .sort((a, c) => Math.hypot(a.x - here.x, a.z - here.z) - Math.hypot(c.x - here.x, c.z - here.z));
      note(live.length > 0, `a region the route opened has a live tear to walk to — ${gained.join(',')}`,
        live.map((r) => `${r.id} ${Math.hypot(r.x - here.x, r.z - here.z).toFixed(0)}m`).join(', ') || 'every one of its tears is locked');
      if (live.length) {
        /* READ THE ORDERS FIRST. A returning learner's boot puts the session's
           own orders card in the frame, and while it stands `src/core/input.js`
           zeroes `move` — so a walk that starts before it is taken presses W
           into a card and reports the road as unwalkable. Measured: the tear
           38 m away, the cadet 43 m away after the whole budget. This is the
           button a player presses; nothing else about the run changes. */
        await takeTheFrame(page);
        /* STEERED WITH THE ARROW KEYS, NOT THE MOUSE.
         *
         * The cold boot's walk turns with real mouse movement, which only moves
         * the camera while the pointer is LOCKED — and the lock is granted by
         * the click `walkToAndOpen` opens with. On the route boot that click
         * arrives while the rank rite is drawing over the canvas, the lock is
         * never granted, the mouse turns nobody, and the cadet runs in whatever
         * direction he happened to be facing: measured, a tear 38 m away and
         * the cadet 114 m and then 191 m away at the end of the budget.
         *
         * ArrowLeft/ArrowRight are bound in `src/core/input.js` for exactly
         * this, are printed on the controls card, and need no lock at all. Same
         * class of input, same assertion — a real key, pressed by this harness,
         * moving the cadet across real ground. */
        /* Five minutes of walking, because this gate runs alongside everything else
           in `npm run check` and a software-GL renderer under that load moves
           the cadet at a few metres a second: measured, the same walk closed
           38 m to 22 m and ran out of a 150 s budget while it was still
           closing. The budget bounds the harness, never the claim — the
           assertion is still that a real key put him inside the ring. */
        const res = await walkByKeys(page, live[0].id, 300000);
        const card = await page.evaluate(() => window.__ascent.panelInfo?.() ?? { open: false });
        note(res.opened && fresh.has(card.skill || ''),
          `a player with no query string walks into "${live[0].id}" and opens it`,
          res.opened ? `${res.key}, card on ${card.skill || '?'}` : `stopped ${res.dist.toFixed(0)} m away`);
        await page.screenshot({ path: path.join(OUT, `21-route-${leg + 1}-item.png`) });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        if (await page.evaluate(() => !!window.__ascent.panel?.open)) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
      }
    }

    const verdict = mergeVerdicts(verdicts);
    console.log('\n  every boot on the road, merged');
    console.log('  unit                      declared  in-lattice  with-rift  openable');
    showRows(verdict.rows);
    const unitOf = new Map();
    for (const u of unitNodes) for (const id of u.nodes) unitOf.set(id, u.unit);
    const reachedUnits = new Set(reachedNodes.map((id) => unitOf.get(id)).filter(Boolean));
    console.log(`\n  reached on foot this run: ${reachedUnits.size ? [...reachedUnits].join(', ') : 'nothing'} `
      + `(${reachedNodes.length} rift(s) opened with keys)`);

    for (const p of verdict.problems) note(false, p);
    if (errors.length) note(false, 'the run logged console errors', errors.slice(0, 3).join(' | '));

    /* WHAT-IF — the same judgement, against a boot the manifest default does
       not currently produce.
       This exists so a lane fixing the default can see, before it lands, what
       this gate will say afterwards, and so a report can show the before and
       the after of the same instrument. It reads a REAL boot of the REAL page —
       only the selection differs — and it CANNOT turn the run green: the exit
       code above is decided by the no-query-string boot and nothing else. */
    const whatIf = arg('what-if', null);
    if (whatIf) {
      const p2 = await ctx.newPage();
      await p2.goto(`${url}/index.html?${whatIf.replace(/^\?/, '')}`, { waitUntil: 'load' });
      await p2.waitForFunction(() => !!window.__ascent, null, { timeout: 45000 });
      await p2.waitForTimeout(2500);
      const b2 = await p2.evaluate(READ_BOOT);
      const v2 = judgeUnits(manifest.courses, unitNodes, b2.lattice, b2.rifts.map((r) => r.id));
      console.log(`\n  WHAT-IF — the same page booted with "?${whatIf}" (not the shipped default; decides nothing)`);
      console.log(`    lattice ${b2.lattice.length} node(s), ${b2.rifts.length} rift(s), unit(s) ${b2.units.join('+')}`);
      for (const r of v2.rows) {
        console.log(`    ${(`${r.course}/${r.unit}`).padEnd(24)} ${String(r.declared).padStart(8)} ${String(r.inLattice).padStart(11)} `
          + `${String(r.withRift).padStart(10)} ${String(r.openable).padStart(9)}`);
      }
      for (const p of v2.problems) console.log(`    would still fail: ${p}`);
      console.log(`    verdict under that boot: ${v2.ok ? 'every shipped unit has a way in' : `${v2.problems.length} problem(s)`}`);
      await p2.close();
    }

    const bad = steps.filter((s) => !s.ok);
    console.log('');
    if (!bad.length) {
      console.log(`every shipped unit has a way in, and every rift live at boot opens on foot (${steps.length} checks).`);
    }
    /* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. Reachability IS the
       shipped route: 52 of 62 skills were once unreachable in normal play while
       every gate was green, so anything this gate finds is in front of a
       learner today, by construction. */
    const F = findings('check:reachable', { scope: 'route' });
    /* `verdict.problems` are already pushed through note(false, …) above, so
       they arrive here as failed steps; declaring them twice would double the
       count the summary prints. */
    F.route(bad.map((s) => `${s.label}${s.detail ? ` — ${s.detail}` : ''}`));
    return F.report();
  } finally {
    await done();
  }
}

// ===========================================================================
// Self-test.
//
// The judgement is a pure function, so each defect it exists to catch is
// planted here by hand. The PLAY leg is proved by the null-input control inside
// the run itself — a leg that would pass without any input is not measuring
// input — and that control is asserted, not merely printed.
// ===========================================================================
function selfTest() {
  let bad = 0;
  const COURSES = [{
    id: 'algebra1',
    units: [
      { id: 'u1', status: 'shipped' },
      { id: 'u2', status: 'shipped' },
      { id: 'u3', status: 'preview' },
    ],
  }];
  const NODES = [
    { unit: 'u1', nodes: ['a', 'b'] },
    { unit: 'u2', nodes: ['c', 'd'] },
    { unit: 'u3', nodes: ['e'] },
  ];
  const fires = (v, re, why) => {
    const hit = v.problems.some((p) => re.test(p));
    if (v.ok || !hit) { console.error(`SELF-TEST FAIL: not raised on ${why} — ${JSON.stringify(v.problems)}`); bad++; }
    else console.log(`  fires  ${why}`);
  };

  // 1. THE DEFECT THIS GATE EXISTS FOR: a shipped unit that is not in the boot
  //    lattice at all. This is the shape of "52 of 62 skills unreachable".
  fires(judgeUnits(COURSES, NODES,
    [{ id: 'a', prereqs: [] }, { id: 'b', prereqs: ['a'] }], ['a', 'b']),
  /u2: the manifest calls this unit shipped and the boot lattice holds none/, 'a shipped unit with no node in the boot lattice');

  // 2. A node in the lattice with nothing to walk to.
  fires(judgeUnits(COURSES, NODES,
    [{ id: 'a', prereqs: [] }, { id: 'b', prereqs: ['a'] }, { id: 'c', prereqs: ['b'] }], ['a', 'b']),
  /u2: 1 node\(s\) are in the lattice and not one of them has a rift/, 'a node with no rift in the world');

  // 3. A node whose prerequisite is not in the lattice: locked for ever.
  fires(judgeUnits(COURSES, NODES,
    [{ id: 'a', prereqs: [] }, { id: 'b', prereqs: ['a'] }, { id: 'c', prereqs: ['zz'] }], ['a', 'b', 'c']),
  /u2: every rift it has is locked for ever — c needs zz/, 'a prerequisite that lives outside the lattice');

  // 4. A prerequisite cycle is not a climb either.
  fires(judgeUnits(COURSES, NODES,
    [{ id: 'a', prereqs: [] }, { id: 'b', prereqs: ['a'] }, { id: 'c', prereqs: ['d'] }, { id: 'd', prereqs: ['c'] }], ['a', 'b', 'c', 'd']),
  /u2: every rift it has is locked for ever/, 'two nodes that require each other');

  // …and the clean lattice must pass, or the gate is refusing everything.
  const clean = judgeUnits(COURSES, NODES,
    [{ id: 'a', prereqs: [] }, { id: 'b', prereqs: ['a'] }, { id: 'c', prereqs: ['b'] }, { id: 'd', prereqs: ['c'] }],
    ['a', 'b', 'c', 'd']);
  if (!clean.ok) { console.error(`SELF-TEST FAIL: a whole, walkable course was refused — ${JSON.stringify(clean.problems)}`); bad++; }
  else console.log('  quiet  a lattice holding both shipped units, every node with a rift and a legal climb');

  // A unit the manifest calls `preview` is not asserted: it is not shipped.
  const previewOnly = judgeUnits(COURSES, NODES,
    [{ id: 'a', prereqs: [] }, { id: 'b', prereqs: ['a'] }, { id: 'c', prereqs: ['b'] }, { id: 'd', prereqs: ['c'] }],
    ['a', 'b', 'c', 'd']);
  if (previewOnly.problems.some((p) => /u3/.test(p))) { console.error('SELF-TEST FAIL: a preview unit was held to the shipped bar'); bad++; }
  else console.log('  quiet  a preview unit, which the manifest does not claim is playable');

  // ---------------------------------------------------------------------
  // THE ROUTE MERGE. A region past the first is deliberately absent from the
  // cold boot, so the verdict is taken over every boot on the road. These
  // plant the two ways that can go wrong.
  // ---------------------------------------------------------------------
  const coldOnly = judgeUnits(COURSES, NODES,
    [{ id: 'a', prereqs: [] }, { id: 'b', prereqs: ['a'] }], ['a', 'b']);
  const routeBoot = judgeUnits(COURSES, NODES,
    [{ id: 'a', prereqs: [] }, { id: 'b', prereqs: ['a'] }, { id: 'c', prereqs: ['b'] }, { id: 'd', prereqs: ['c'] }],
    ['a', 'b', 'c', 'd']);

  // 5. THE CORRECTION ITSELF: a unit absent at the cold boot and present at
  //    the boot the route opens is reachable, and the merge must say so.
  const opened = mergeVerdicts([coldOnly, routeBoot]);
  if (!opened.ok || opened.rows.find((r) => r.unit === 'u2')?.openable !== 2) {
    console.error(`SELF-TEST FAIL: a region the route opens was still called unreachable — ${JSON.stringify(opened.problems)}`); bad++;
  } else console.log('  quiet  a unit absent at the cold boot and seated at the boot the route opens');

  // 6. …and the defect that must survive the correction: a shipped unit that
  //    NO boot on the road ever seats. This is the original "52 of 62".
  const neverOpens = mergeVerdicts([coldOnly, coldOnly]);
  if (neverOpens.ok || !neverOpens.problems.some((p) => /u2: the manifest calls this unit shipped and the boot lattice holds none/.test(p))) {
    console.error(`SELF-TEST FAIL: a unit no boot ever seats was let through — ${JSON.stringify(neverOpens.problems)}`); bad++;
  } else console.log('  fires  a shipped unit that no boot on the road ever seats');

  // 7. A unit the route seats but leaves permanently locked is still a defect:
  //    reaching the lattice is not the same as being able to climb into it.
  const lockedLater = mergeVerdicts([coldOnly, judgeUnits(COURSES, NODES,
    [{ id: 'a', prereqs: [] }, { id: 'b', prereqs: ['a'] }, { id: 'c', prereqs: ['zz'] }, { id: 'd', prereqs: ['zz'] }],
    ['a', 'b', 'c', 'd'])]);
  if (lockedLater.ok || !lockedLater.problems.some((p) => /u2: every rift it has is locked for ever/.test(p))) {
    console.error(`SELF-TEST FAIL: a region the route opens but nobody can climb into was let through — ${JSON.stringify(lockedLater.problems)}`); bad++;
  } else console.log('  fires  a unit the route seats whose every rift is locked for ever');

  /* A DIAMOND IS NOT A CYCLE — the false positive this function actually had.
     `d` requires both `b` and `c`, and both of those require `a`. The first
     draft carried one visited-set down the whole walk, met `a` twice, called it
     a cycle and reported three of Level 1's ten nodes as permanently locked. */
  const diamond = judgeUnits(
    [{ id: 'algebra1', units: [{ id: 'u1', status: 'shipped' }] }],
    [{ unit: 'u1', nodes: ['a', 'b', 'c', 'd'] }],
    [{ id: 'a', prereqs: [] }, { id: 'b', prereqs: ['a'] }, { id: 'c', prereqs: ['a'] }, { id: 'd', prereqs: ['b', 'c'] }],
    ['a', 'b', 'c', 'd'],
  );
  if (!diamond.ok || diamond.rows[0].openable !== 4) {
    console.error(`SELF-TEST FAIL: a diamond was read as a cycle — ${JSON.stringify(diamond)}`); bad++;
  } else console.log('  quiet  a diamond: two prerequisites that share one ancestor');

  // The rows are the report, so they have to be right too.
  const rows = clean.rows;
  if (rows.length !== 2 || rows.some((r) => r.openable !== 2)) {
    console.error(`SELF-TEST FAIL: the per-unit census is wrong — ${JSON.stringify(rows)}`); bad++;
  } else console.log('  ok     the per-unit census counts declared / in-lattice / with-rift / openable');

  if (bad) { console.error(`\nself-test: ${bad} failure(s)`); process.exit(1); }
  console.log('\nself-test: ok — every way in can be broken, and a whole course still passes');
}

const isMain = !!process.argv[1]
  && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
if (isMain) {
  if (has('--self-test')) selfTest();
  else process.exit(await run());
}
