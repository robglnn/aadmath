#!/usr/bin/env node
/**
 * THE ARCHIPELAGO GATE — can a cadet actually GET to the best objects in this
 * game, and can the session send him?
 *
 *   node tools/critic/archipelago.mjs               # the gate
 *   node tools/critic/archipelago.mjs --self-test   # prove it can refuse
 *   node tools/critic/archipelago.mjs --json
 *
 * WHY THIS EXISTS, IN NUMBERS THAT WERE MEASURED AND NOT GUESSED
 *
 * Thirty-six minutes of cold play across two sittings, with the `kite`
 * capability HELD in both: ZERO of five hanging caches and ZERO of three spans
 * opened. THE MEET, built two waves earlier, had never been entered by anybody.
 * The hanging caches are the one thing a real player singled out unprompted —
 * *"I kinda like that it's something off our main island"* — and a blind critic
 * independently called them the best thing in the build.
 *
 * Every gate in this repo was green the whole time, because no gate asked the
 * two questions that decide it:
 *
 *   1. IS THE PLACE REACHABLE AT ALL. `src/world/caches.js` hung its five
 *      perches at `LIFT` metres above THE HIGHEST GROUND ON EACH BEARING,
 *      sampled off `heightAt`. Recomputed against the ground a cadet can WALK
 *      to, on the wings this game actually flies, with the island in the way of
 *      the descent line: THREE OF THE FIVE STOOD ABOVE WHAT THE BEST WING IN
 *      THE GAME CAN REACH FROM ANY LAUNCH — cache 0 by thirty-five metres — and
 *      two of the three spans with them. `src/meta/objective.js` names the
 *      NEAREST site, so from most tears it named one of those, and the leg ran
 *      its clock out over open water. Both of the other two files in this
 *      family had already written the same lesson down about themselves
 *      (`src/world/span.js`: *"the first span was hung off a launch pad no
 *      cadet could reach"*; `src/world/meet.js`: a ceiling computed as
 *      `launch - gulf / ratio` is a lie if the island is in the way).
 *
 *   2. CAN THE SESSION SEND HIM THERE INSIDE THE LEG IT ALLOWS.
 *      `src/meta/objective.js` gives a field leg `LEG_MAX_S` seconds and then
 *      takes the card back. Nothing measured whether the flight fits.
 *
 * THE RULES
 *
 *   reach    every off-island site the world may NAME is reachable with the
 *            access it declares — flood-fill the ground a cadet can walk to
 *            from the spawn under the game's own slope rule, solve each wing
 *            trim from `P` and `src/kit/kit.js`, and require the descent line
 *            to clear `heightAt` by three metres for the whole flight.
 *   leg      A FULL SITTING MAY NOT COMPLETE WITH NOTHING OFF-ISLAND IN REACH.
 *            From every place the world can seat a tear, the cheapest honest
 *            flight to a site the cadet may be shown must fit inside
 *            `LEG_MAX_S`. The time is a LOWER BOUND — a straight sprint over
 *            the walk graph at `P.sprint` and then a glide at trim speed with
 *            no turning — so a bound over the budget is a proof that the real
 *            leg cannot be completed, never an opinion about pace.
 *   flown    AND A LOWER BOUND PASSING IS NOT EVIDENCE THAT A FLIGHT FITS.
 *            `LEG_MAX_S` must also cover the slowest flight anybody has
 *            actually FLOWN to a day-one site on real keys from a cleared
 *            save. *Exists because:* the bound over this tree is 34 s and the
 *            budget is 120 s, so `leg` is green — and the three real flights
 *            this repo has ever flown took 45 s, 120 s and 201 s. Two of the
 *            three are at or over the whole budget, so the card is taken back
 *            with the cadet still in the air, which is the one failure the
 *            objective's own header says it must never produce.
 *   dayone   A CADET WHO HAS BOUGHT NOTHING MUST BE ABLE TO BE SENT SOMEWHERE
 *            OFF THE ISLAND. Four sites declare the wing every cadet has from
 *            boot — caches 0 and 1, span 0 and MEET 1 — and `reach` proves all
 *            four are flyable from a cleared save. So the row of `REACH` a
 *            cadet holding nothing matches has to allow an air site, and one
 *            of those four has to be inside the metres that row allows from
 *            somewhere the world can seat a tear. *Exists because:* that row
 *            reads `air: false`, and so does the row above it, so nothing off
 *            the island may be named until KITE TRIM — three held lines — and
 *            a cleared-save cadet cannot be sent to a place his own wing
 *            reaches. Measured: 22 minutes from a cleared save opened 0 of 5
 *            hanging caches, 0 of 3 spans and 0 of 2 meets.
 *   commit   THE ANSWER MAY NOT BE GIVEN BY ACCIDENT. Every counterweight's
 *            claim region is the outer cell of its own pier; no two piers are
 *            edge-adjacent, no claim cell is part of the deck, and no two claim
 *            cells touch. *Exists because:* reproduced twice by playing it,
 *            crossing a cache's deck passed within 1.0-1.7 m of the middle
 *            counterweight and OPENED THE CACHE with a weight nobody chose.
 *   sign     the tier-1 statement takes BOTH SIGNS. *Exists because:* both old
 *            distractors were arithmetically `>= x`, so a tier-1 cache could
 *            only ever say TOO BIG and half of the pattern language's Rule 4
 *            was dead for every learner who never reached a deep cache.
 *   brush    A SPAN MAY NOT BE OPENED BY BRUSHING PAST. Its three stacks stand
 *            on one rank 7.4 m apart with a horizontal capture disc of
 *            1.55-1.86 m, so a straight walk from the left one to the right one
 *            goes through the middle one — three points on a line always do —
 *            and `src/world/span.js` accepts that, because a brush costs a
 *            guess. It costs a guess only while the middle stack is a
 *            DISTRACTOR: with the true one there, crossing the deck opens the
 *            site, pays 140 motes and lays a hundred metres of permanent road
 *            for an answer nobody chose. *Exists because:* swept over the
 *            generator's own seeds the true stack came out in the middle in 26
 *            of 64, and the three the island hangs missed it by luck.
 *   count    no candidate asks a pan to hold more than `lay()` will draw.
 *            *Exists because:* a pan showing 34 cubes when the arithmetic says
 *            66 is a picture that lies, and Rule 2's whole claim is that a
 *            learner who cannot read the notation can still count them.
 *   named    every wrong candidate is a named misconception, re-derived here
 *            from the statement alone.
 *   onevoice ONE OFF-ISLAND FAMILY TALKS, not one instance per family. Each of
 *            `caches.js`, `span.js` and `meet.js` must bid through
 *            `src/world/fieldtalk.js` inside its own `placeTags` and print
 *            nothing when it loses. *Exists because:* photographed at
 *            `shots/laneC-crack/05-level-beam.png` — a cadet standing on cache
 *            1's pier at the instant it opened, with MEET 2's statement
 *            `2x + 2y = 22` on the glass beside the balance he had just made
 *            level. Three arbiters, each authoritative over one family, is the
 *            same thing as no arbiter.
 *   label    one cache talks, through the one ledger. *Exists because:*
 *            `.field-tag` is CHROME to `src/world/tagspace.js` — arbitrated by
 *            nothing — and `src/world/waygate.js` paid 452 label overlaps
 *            across 126 of 288 layout frames for exactly that.
 *   pay      the reward does not cut off the moment it is paying for: the
 *            updraft is planted after the resolution beat and clear of every
 *            claim cell. *Exists because:* planted under the cadet's own boots,
 *            it lifted him off the perch about two seconds after the win, in
 *            two independent runs, so he never saw the level beam.
 *   asked    THE SESSION HAS TO BE ABLE TO ASK. The counter that buys a field
 *            leg must be able to reach its own bar. *Exists because:* measured
 *            at 5 Hz over 10.5 minutes of real play from a cleared save with
 *            the whole kit held, the stint spent a tear FOUR times and the
 *            counter incremented ZERO times — it is guarded by whether the
 *            SCHEDULER is still naming the spent tear, and it had moved on
 *            every time. Every site in the archipelago can be reachable, named
 *            and inside the leg budget, and nobody is sent to one.
 *   spoken   every kind of place the world REGISTERS as an objective has a verb
 *            and a rank in `src/meta/objective.js` and a name in all three
 *            locales. *Exists because:* THE MEET was registered by nobody and
 *            had never been entered.
 *
 * Nothing above is restated from a document: every number is cut out of the
 * shipped source or recomputed from `src/world/terrain.js`. `--self-test`
 * plants each defect into the real files and requires the matching rule to
 * fire, then requires every rule to stay quiet on the honest tree.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { heightAt, ISLAND_R } from '../../src/world/terrain.js';
import { findings as ledger } from '../_findings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const F = (...p) => path.join(ROOT, ...p);
const SRC = {
  caches: F('src', 'world', 'caches.js'),
  span: F('src', 'world', 'span.js'),
  meet: F('src', 'world', 'meet.js'),
  kit: F('src', 'kit', 'kit.js'),
  objective: F('src', 'meta', 'objective.js'),
  loco: F('src', 'player', 'locomotion.js'),
  ctl: F('src', 'player', 'controller.js'),
  tagspace: F('src', 'world', 'tagspace.js'),
};

/** Metres of air a wing's descent line must keep over the island. */
const CLEAR = 3;
/** Metres a tier must hold before it is a tier and not a coin toss. */
const MARGIN = 3;
/**
 * SECONDS THE SLOWEST REAL FLIGHT TO A DAY-ONE SITE HAS TAKEN, on real keys,
 * from a cleared save, on a frozen build — and it is a MEASUREMENT, not a
 * budget somebody chose.
 *
 * `legSeconds` below is a lower bound and says so: a straight sprint over the
 * walk graph and then a glide at trim speed with no turn in it. Over this tree
 * that bound is 34 s at the worst seat, against a 120 s budget, so the `leg`
 * rule is comfortably green — and a lower bound being inside a budget is not
 * evidence that anything fits. Three flights have actually been flown here, by
 * `tools/critic/_laneC-span.mjs` and `tools/critic/_laneC-crack.mjs`, with
 * every metre a `KeyW` and every turn an arrow:
 *
 *   span 0  (176, -124) deck 65 — 45 s   (2026-08-29 11:16)
 *   cache 1 (64, 184)   deck 56 — 120 s  (2026-08-29 11:09)
 *   span 0  (176, -124) deck 65 — 201 s  (2026-08-29 13:04, this tree)
 *
 * The same site on the same build took 45 s and 201 s, because a wing that
 * arrives low has to be re-run and re-launched and the line is never the one
 * the bound assumes. So the honest floor under `LEG_MAX_S` is the slowest of
 * them, and raising this number is only allowed by flying it again and being
 * slower.
 */
const FLOWN = 201;
/** The lattice, out of src/build/pieces.js. */
const CELL = 4;

// ---------------------------------------------------------------------------
// reading the shipped sources
// ---------------------------------------------------------------------------
const read = (k, over) => (over && over[k] !== undefined ? over[k] : readFileSync(SRC[k], 'utf8'));
const num = (re, txt) => Number((txt.match(re) || [])[1]);
const nums = (re, txt) => {
  const m = txt.match(re);
  return m ? m[1].split(',').map((v) => Number(v.trim())) : null;
};

/** Every constant this gate judges against, cut out of the files that ship. */
export function readWorld(over) {
  const caches = read('caches', over);
  const span = read('span', over);
  const meet = read('meet', over);
  const loco = read('loco', over);
  const kit = read('kit', over);
  const ctl = read('ctl', over);
  const obj = read('objective', over);

  const trims = [...kit.matchAll(/P\.glideBase = (-?[\d.]+);\s*\n\s*P\.glideDrag = ([\d.]+);/g)]
    .map((m) => [Number(m[1]), Number(m[2])]);
  const spawnM = ctl.match(/this\.pos\.set\(\s*(-?[\d.]+)\s*,[^,]+,\s*(-?[\d.]+)\s*\)/);

  const deck = nums(/const DECK = \[([^\]]+)\]/, caches);
  const accessM = caches.match(/const ACCESS = \[([^\]]+)\]/);
  const access = accessM ? accessM[1].split(',').map((v) => {
    const s = v.trim();
    if (s === 'null') return null;
    if (/^\d+$/.test(s)) return Number(s);
    return s.replace(/^'|'$/g, '');
  }) : null;
  const piersM = caches.match(/const PIERS = \{([\s\S]*?)\n\};/);
  const piers = piersM ? Function(`return {${piersM[1]}}`)() : null;

  const sRing = nums(/const RING = \[([^\]]+)\]/, span);
  const sArc = nums(/const ARC = \[([^\]]+)\]/, span);
  const sLift = nums(/const LIFT = \[([^\]]+)\]/, span);

  const meetSites = [...meet.matchAll(
    /key: '(\w+)', x: (-?\d+), z: (-?\d+), y: (-?\d+),[^}]*?access: (null|'[a-z]+')/g,
  )].map((m) => ({
    key: m[1], x: Number(m[2]), z: Number(m[3]), y: Number(m[4]),
    access: m[5] === 'null' ? null : m[5].replace(/'/g, ''),
  }));

  return {
    src: { caches, span, meet, kit, obj, tagspace: read('tagspace', over) },
    slopeLimit: num(/slopeLimit:\s*([\d.]+)/, loco),
    sprint: num(/sprint:\s*([\d.]+)/, loco),
    glideMin: num(/glideMin:\s*(\d+)/, loco),
    base: [num(/glideBase:\s*(-?[\d.]+)/, loco), num(/glideDrag:\s*([\d.]+)/, loco)],
    trims,
    spawn: spawnM ? [Math.round(Number(spawnM[1])), Math.round(Number(spawnM[2]))] : [0, 26],
    deck, access, piers,
    cacheRad: (i) => num(/const rad = ISLAND_R \+ (\d+) \+ i \* (\d+);/, caches) !== undefined
      ? ISLAND_R + Number((caches.match(/const rad = ISLAND_R \+ (\d+) \+ i \* (\d+);/) || [])[1])
        + i * Number((caches.match(/const rad = ISLAND_R \+ (\d+) \+ i \* (\d+);/) || [])[2]) : null,
    span: { ring: sRing, arc: sArc, lift: sLift },
    meets: meetSites,
    legMax: num(/const LEG_MAX_S = (\d+);/, obj),
    /* THE REACH TABLE, read FIELD BY FIELD rather than as one fixed line.
       A row used to be matched whole — `{ need: …, rung: …, metres: …, air: … }`
       in that order and no other key — so the day the objective lane adds the
       separate air distance this gate ASKS FOR (see the `dayone` rule), every
       row would stop matching, `W.reach` would come back empty, and the `leg`
       rule would print "no row of REACH may name an air site" about a tree
       that had just been fixed. A gate that goes red on its own fix is a gate
       somebody switches off. */
    reach: [...((obj.match(/const REACH = \[([\s\S]*?)\n\];/) || [null, ''])[1])
      .matchAll(/\{([^}]*)\}/g)]
      .map((m) => {
        const f = (k) => (m[1].match(new RegExp(`\\b${k}:\\s*([^,}\\s]+)`)) || [])[1];
        const need = f('need');
        const airM = f('airMetres');
        return {
          need: !need || need === 'null' ? null : need.replace(/'/g, ''),
          rung: Number(f('rung')),
          metres: Number(f('metres')),
          /* How far this rung may point at a site with nothing under it. A row
             that does not say has always meant "the same as on foot". */
          airMetres: airM === undefined ? Number(f('metres')) : Number(airM),
          air: f('air') === 'true',
        };
      }),
    verbs: Object.keys(Object.fromEntries(
      [...(obj.match(/const FIELD_VERB = \{([\s\S]*?)\};/) || [null, ''])[1]
        .matchAll(/(\w+):\s*'/g)].map((m) => [m[1], 1]),
    )),
    kinds: Object.keys(Object.fromEntries(
      [...(obj.match(/const KIND_RANK = \{([^}]*)\}/) || [null, ''])[1]
        .matchAll(/(\w+):\s*\d/g)].map((m) => [m[1], 1]),
    )),
    rowKinds: [...(read('kit', over).match(/function fieldRows\(\)[\s\S]*?\n  \}/) || [''])[0]
      .matchAll(/kind: (?:deep \? '(\w+)' : '(\w+)'|'(\w+)')/g)]
      .flatMap((m) => [m[1], m[2], m[3]]).filter(Boolean),
  };
}

/** Where the five island caches hang, out of the shipped seating rule. */
export function cacheSites(W) {
  const m = W.src.caches.match(/const rad = ISLAND_R \+ (\d+) \+ i \* (\d+);/);
  const a0 = W.src.caches.match(/const ang = -Math\.PI \/ 2 \+ i \* ([\d.]+) \+ ([\d.]+);/);
  if (!m || !a0 || !W.deck) return [];
  return W.deck.map((y, i) => {
    const ang = -Math.PI / 2 + i * Number(a0[1]) + Number(a0[2]);
    const rad = ISLAND_R + Number(m[1]) + i * Number(m[2]);
    return {
      key: `cache ${i}`, kind: 'cache', i,
      x: Math.round((Math.cos(ang) * rad) / CELL) * CELL,
      z: Math.round((Math.sin(ang) * rad) / CELL) * CELL,
      y, half: (2 + 1) * CELL, access: W.access ? W.access[i] : 'kite',
    };
  });
}

/** …and the spans, and the meets. */
export function spanSites(W) {
  const { ring, arc, lift } = W.span;
  if (!ring || !arc || !lift) return [];
  let hi = 6;
  for (let r = ISLAND_R - 40; r < ISLAND_R - 6; r += 4) {
    const h = heightAt(Math.cos(arc[0]) * r, Math.sin(arc[0]) * r);
    if (h !== null && h > hi) hi = h;
  }
  return arc.map((ang, i) => ({
    key: `span ${i}`, kind: 'span', i,
    x: Math.round((Math.cos(ang) * ring[i]) / CELL) * CELL,
    z: Math.round((Math.sin(ang) * ring[i]) / CELL) * CELL,
    y: Math.max(26, Math.round(hi + lift[i])),
    half: 10,
    // The first is flown; every one after it is WALKED on the road the one
    // before it laid, so its access is that road and not a wing.
    access: i === 0 ? null : { road: i - 1 },
  }));
}
export const meetSites = (W) => W.meets.map((m) => ({
  key: `meet ${m.key}`, kind: 'meet', x: m.x, z: m.z, y: m.y, half: 16, access: m.access,
}));

// ---------------------------------------------------------------------------
// the ground, the wings, and the flight
// ---------------------------------------------------------------------------
const SLOPE_E = 0.7;
function grad(x, z) {
  const h = heightAt(x, z);
  if (h === null) return null;
  const e = SLOPE_E;
  const hx = heightAt(x + e, z), hxn = heightAt(x - e, z);
  const hz = heightAt(x, z + e), hzn = heightAt(x, z - e);
  return Math.hypot(((hx ?? h) - (hxn ?? h)) / (2 * e), ((hz ?? h) - (hzn ?? h)) / (2 * e));
}

/**
 * Every square metre of ground a cadet can WALK to from the spawn, and the
 * grid it lives on — the game's own rule out of `src/player/locomotion.js`.
 */
let GROUND = null;
export function walkable(slopeLimit, spawn) {
  if (GROUND && GROUND.slopeLimit === slopeLimit) return GROUND;
  const R = 200, N = 2 * R + 1;
  const H = new Float32Array(N * N);
  const ok = new Uint8Array(N * N);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const h = heightAt(i - R, j - R);
      H[i * N + j] = h === null ? NaN : h;
      ok[i * N + j] = h === null ? 0 : (grad(i - R, j - R) <= slopeLimit ? 1 : 0);
    }
  }
  const seen = new Uint8Array(N * N);
  const s0 = (spawn[0] + R) * N + (spawn[1] + R);
  const q = [s0];
  seen[s0] = 1;
  const D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let head = 0; head < q.length;) {
    const k = q[head++], i = (k / N) | 0, j = k % N;
    for (const [di, dj] of D) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
      const nk = ni * N + nj;
      if (seen[nk] || !ok[nk]) continue;
      seen[nk] = 1; q.push(nk);
    }
  }
  const list = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) if (seen[i * N + j]) list.push([i - R, j - R, H[i * N + j]]);
  }
  GROUND = { list, seen, H, N, R, slopeLimit };
  return GROUND;
}

/** Steady glide ratio, solved from the trim the shipped source sets. */
export const glideRatio = (base, drag) => {
  const g = 26, gam = -base;
  const v = Math.sqrt((g * Math.sin(gam)) / drag);
  return (v * Math.cos(gam)) / (v * Math.sin(gam));
};
/** …and the speed it holds while it does, which is what a leg is timed at. */
export const trimSpeed = (base, drag) => Math.sqrt((26 * Math.sin(-base)) / drag);

/**
 * Every launch that puts a cadet on this deck on this wing, with the island in
 * the way — `[i, j, gulf]` on the walk grid.
 */
function launchesFor(G, site, ratio) {
  const out = [];
  for (const [lx, lz, lh] of G.list) {
    if (lh < site.y) continue;
    const gulf = Math.hypot(site.x - lx, site.z - lz) - site.half;
    if (gulf < 14) continue;
    if (lh - gulf / ratio < site.y + MARGIN) continue;
    const full = Math.hypot(site.x - lx, site.z - lz) || 1;
    const steps = Math.max(4, Math.ceil(gulf / 3));
    let clear = true;
    for (let k = 1; k <= steps; k++) {
      const d = (gulf * k) / steps, f = d / full;
      const g = heightAt(lx + (site.x - lx) * f, lz + (site.z - lz) * f);
      if (g !== null && lh - d / ratio < g + CLEAR) { clear = false; break; }
    }
    if (clear) out.push([lx, lz, gulf]);
  }
  return out;
}

/**
 * SECONDS TO THIS SITE FROM EVERY PLACE A CADET CAN STAND — and it is a LOWER
 * BOUND, on purpose.
 *
 * A sprint in a straight line along the walk graph at `P.sprint`, then a glide
 * at trim speed with no turn in it. A real leg is slower than this at every
 * step, so a bound over the budget is a proof that the leg cannot be completed
 * and never an argument about how fast somebody plays.
 */
export function legSeconds(G, site, ratio, speed, sprint) {
  const { N, R, seen } = G;
  const best = new Float64Array(N * N).fill(Infinity);
  const heap = [];
  for (const [lx, lz, gulf] of launchesFor(G, site, ratio)) {
    const k = (lx + R) * N + (lz + R);
    const t = gulf / speed;
    if (t < best[k]) { best[k] = t; heap.push([t, k]); }
  }
  if (!heap.length) return null;
  heap.sort((a, b) => a[0] - b[0]);
  const step = 1 / sprint, diag = Math.SQRT2 / sprint;
  const D = [[1, 0, step], [-1, 0, step], [0, 1, step], [0, -1, step],
    [1, 1, diag], [1, -1, diag], [-1, 1, diag], [-1, -1, diag]];
  // a simple binary heap over a small frontier
  const push = (t, k) => {
    heap.push([t, k]);
    let c = heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (heap[p][0] <= heap[c][0]) break;
      const tmp = heap[p]; heap[p] = heap[c]; heap[c] = tmp; c = p;
    }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let c = 0;
      for (;;) {
        const l = 2 * c + 1, r = l + 1;
        let m = c;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === c) break;
        const tmp = heap[m]; heap[m] = heap[c]; heap[c] = tmp; c = m;
      }
    }
    return top;
  };
  for (let i = heap.length >> 1; i >= 0; i--) { /* heapify */ }
  heap.sort((a, b) => a[0] - b[0]);
  while (heap.length) {
    const [t, k] = pop();
    if (t > best[k]) continue;
    const i = (k / N) | 0, j = k % N;
    for (const [di, dj, w] of D) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
      const nk = ni * N + nj;
      if (!seen[nk]) continue;
      const nt = t + w;
      if (nt < best[nk]) { best[nk] = nt; push(nt, nk); }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// the mathematics, cut out of the shipped file and executed
// ---------------------------------------------------------------------------
export function cutMaths(caches) {
  const grab = (name) => {
    const at = caches.indexOf(`  function ${name}(`);
    if (at < 0) throw new Error(`caches.js has no ${name}()`);
    const end = caches.indexOf('\n  }\n', at);
    return caches.slice(at, end + 4);
  };
  const cap = num(/const CAP = (\d+);/, caches);
  const body = `${grab('question')}\n${grab('deepQuestion')}\n${grab('dice')}\n${grab('uniq')}\n${grab('shuffle')}\n`
    + 'return { question, deepQuestion };';
  return { cap, ...Function('CAP', body)(cap) };
}

/**
 * The same trick for `src/world/span.js`: its generator and the order it stands
 * the three stacks in, cut out of the shipped file and run. Nothing is
 * restated — an edit to the source is what this sweeps.
 */
export function cutSpanMaths(span) {
  const grab = (name) => {
    const at = span.indexOf(`  function ${name}(`);
    if (at < 0) throw new Error(`span.js has no ${name}()`);
    const end = span.indexOf('\n  }\n', at);
    return span.slice(at, end + 4);
  };
  const body = `${grab('question')}\n${grab('rank')}\n${grab('dice')}\n${grab('shuffle')}\n`
    + 'return { question };';
  return Function(body)();
}

// ---------------------------------------------------------------------------
// the rules
// ---------------------------------------------------------------------------
export function judge(over) {
  const W = readWorld(over);
  const found = [];
  const add = (rule, text) => found.push({ rule, text });
  const notes = [];

  if (!W.slopeLimit || !W.base[0] || W.trims.length < 2 || !W.deck || !W.piers) {
    add('reach', 'could not read the slope limit, the wing trims, the decks or the piers out of the shipped source');
    return { found, notes, W };
  }
  const G = walkable(W.slopeLimit, W.spawn);
  const WING = {
    base: { ratio: glideRatio(W.base[0], W.base[1]), speed: trimSpeed(W.base[0], W.base[1]) },
    kite: { ratio: glideRatio(W.trims[0][0], W.trims[0][1]), speed: trimSpeed(W.trims[0][0], W.trims[0][1]) },
    legs: { ratio: glideRatio(W.trims[1][0], W.trims[1][1]), speed: trimSpeed(W.trims[1][0], W.trims[1][1]) },
  };
  notes.push(`wings  base 1:${WING.base.ratio.toFixed(1)} at ${WING.base.speed.toFixed(1)} m/s`
    + ` · kite 1:${WING.kite.ratio.toFixed(1)} at ${WING.kite.speed.toFixed(1)} m/s`
    + ` · long span 1:${WING.legs.ratio.toFixed(1)} · sprint ${W.sprint} m/s`);

  const sites = [...cacheSites(W), ...spanSites(W), ...meetSites(W)];

  // ---- reach ------------------------------------------------------------
  // A site declares what its way in is denominated in. Every one of them has
  // to be flyable on the wing that access buys — and a site reached off
  // another site's standing column is flyable from that column's top.
  const COLUMN = num(/c\.tier === 2 \? 96 : (\d+),/, W.src.caches) || 78;
  for (const s of sites) {
    const a = s.access;
    if (a && typeof a === 'object' && a.road !== undefined) {
      notes.push(`${s.key} deck ${s.y} — walked, on the road span ${a.road} lays`);
      continue;
    }
    const wing = a === null ? WING.base : WING.kite;
    const name = a === null ? 'the base wing' : 'KITE TRIM';
    if (typeof a === 'number') {
      // the column another cache paid: any wing, from that column's top
      const from = sites.find((o) => o.kind === 'cache' && o.i === a);
      if (!from) { add('reach', `${s.key} says it is reached off cache ${a}, which does not exist`); continue; }
      const top = from.y + COLUMN;
      const gulf = Math.hypot(s.x - from.x, s.z - from.z) - s.half;
      const arrive = top - gulf / WING.base.ratio;
      let clearAll = true;
      const full = Math.hypot(s.x - from.x, s.z - from.z) || 1;
      for (let k = 1; k <= Math.ceil(gulf / 3); k++) {
        const d = (gulf * k) / Math.ceil(gulf / 3), f = d / full;
        const g = heightAt(from.x + (s.x - from.x) * f, from.z + (s.z - from.z) * f);
        if (g !== null && top - d / WING.base.ratio < g + CLEAR) { clearAll = false; break; }
      }
      if (!clearAll || arrive < s.y + MARGIN) {
        add('reach', `${s.key} deck ${s.y} says it is reached off the ${COLUMN} m column ${from.key} pays`
          + ` — that column tops out at ${top} and a base-wing glide arrives at ${arrive.toFixed(1)}`
          + (clearAll ? '' : ', through the island'));
      } else {
        notes.push(`${s.key} deck ${s.y} — off ${from.key}'s column (top ${top}), arrives ${arrive.toFixed(1)}, ${(arrive - s.y).toFixed(1)} m in hand`);
      }
      continue;
    }
    const L = launchesFor(G, s, wing.ratio);
    if (!L.length) {
      let ceil = -1e9;
      for (const [lx, lz, lh] of G.list) {
        const gulf = Math.hypot(s.x - lx, s.z - lz) - s.half;
        if (gulf >= 14) ceil = Math.max(ceil, lh - gulf / wing.ratio);
      }
      add('reach', `${s.key} deck ${s.y} declares ${name} and NO launch a cadet can walk to reaches it`
        + ` — the best ceiling on that wing is ${ceil.toFixed(1)} m, ${(s.y - ceil).toFixed(1)} m short, over free air`);
    } else {
      let bestC = -1e9;
      for (const [lx, lz, gulf] of L) {
        const lh = G.H[(lx + G.R) * G.N + (lz + G.R)];
        bestC = Math.max(bestC, lh - gulf / wing.ratio);
      }
      notes.push(`${s.key} deck ${s.y} — ${name}, ${L.length} launch(es) clear, best arrival ${bestC.toFixed(1)}, ${(bestC - s.y).toFixed(1)} m in hand`);
    }
  }

  // ---- leg --------------------------------------------------------------
  // The rung a cadet's kit buys, out of REACH, and what he may be shown at it.
  const step = W.reach.find((r) => r.air);
  if (!step) {
    add('leg', 'no row of REACH in src/meta/objective.js may name an air site, so no cache, span or meet can ever be an objective');
  } else {
    const shown = sites.filter((s) => {
      if (typeof s.access === 'object' && s.access) return false;      // needs a road that is not there yet
      if (typeof s.access === 'number') return false;                  // needs a column that is not there yet
      if (s.access && s.access !== step.need && !W.reach.slice(0, W.reach.indexOf(step) + 1).some((r) => r.need === s.access)) return false;
      return true;
    });
    if (!shown.length) {
      add('leg', 'nothing off the island may be named at the first rung that allows one');
    } else {
      const fields = shown.map((s) => ({
        s, t: legSeconds(G, s, s.access === null ? WING.base.ratio : WING.kite.ratio,
          s.access === null ? WING.base.speed : WING.kite.speed, W.sprint),
      })).filter((r) => r.t);
      // Where the world can seat a tear: walk-reachable ground inside the ring
      // src/world/rifts.js searches (`Math.hypot(x, z) > ISLAND_R - 20` is
      // refused there) on ground a dais can stand on.
      let worst = -1, worstAt = null, stranded = 0, seats = 0, sum = 0;
      for (const [x, z] of G.list) {
        if (Math.hypot(x, z) > ISLAND_R - 20) continue;
        const k = (x + G.R) * G.N + (z + G.R);
        let best = Infinity;
        for (const f of fields) {
          const d = Math.hypot(f.s.x - x, f.s.z - z);
          if (d > step.airMetres) continue;
          if (f.t[k] < best) best = f.t[k];
        }
        seats++;
        if (!Number.isFinite(best)) { stranded++; continue; }
        sum += best;
        if (best > worst) { worst = best; worstAt = [x, z]; }
      }
      notes.push(`leg  ${seats} places a tear can stand · worst honest flight ${worst < 0 ? '-' : `${worst.toFixed(0)} s`}`
        + ` at (${worstAt || '-'}) · mean ${(sum / Math.max(1, seats - stranded)).toFixed(0)} s · budget ${W.legMax} s`);
      if (stranded) {
        add('leg', `${stranded} of ${seats} places the world can seat a tear have NO off-island site inside the ${step.airMetres} m`
          + ' the objective may point, so a whole sitting can be played out with nothing off the island in reach');
      }
      if (worst > W.legMax) {
        add('leg', `the worst place a tear can stand is ${worst.toFixed(0)} s from the nearest site a cadet may be shown,`
          + ` against a leg budget of ${W.legMax} s — and that time is a LOWER BOUND (a straight sprint and a glide with no turn in it),`
          + ' so the real flight cannot be completed and the card is taken back mid-air');
      }
    }
  }

  // ---- onevoice ---------------------------------------------------------
  /* THE THREE OFF-ISLAND FAMILIES, AND WHICH OF THEM OWNS THE GLASS.
     Each file already refuses to print more than one of ITS OWN kind. Nothing
     stood between the three of them until src/world/fieldtalk.js, and the
     frame that proves it is in this gate's own header. */
  for (const [file, src, id] of [['caches', W.src.caches, 'cache'], ['span', W.src.span, 'span'], ['meet', W.src.meet, 'meet']]) {
    const place = (src.match(/function placeTags\(camera, time\) \{[\s\S]*?\n  \}\n/) || [''])[0];
    if (!place) {
      add('onevoice', `src/world/${file}.js has no placeTags(camera, time) this gate can read, so nothing proves it asks before it prints`);
      continue;
    }
    if (!/from '\.\/fieldtalk\.js'/.test(src) || !/bidField\(\s*time\s*,\s*'\w+'/.test(place)) {
      add('onevoice', `src/world/${file}.js prints .field-tag labels without bidding through src/world/fieldtalk.js — so it and the`
        + ' other two off-island families can all be talking in the same frame, which was photographed with a MEET\'s statement'
        + " beside a hanging cache's balance at the instant the cache opened");
    } else if (!new RegExp(`bidField\\(\\s*time\\s*,\\s*'${id}'`).test(place)) {
      add('onevoice', `src/world/${file}.js bids under a family name that is not "${id}", so two files can hold the same mic`);
    }
  }
  {
    const ids = [['caches', W.src.caches], ['span', W.src.span], ['meet', W.src.meet]]
      .map(([, src]) => (src.match(/bidField\(\s*time\s*,\s*'(\w+)'/) || [])[1]).filter(Boolean);
    if (ids.length === 3 && new Set(ids).size === 3) {
      notes.push(`onevoice  three off-island families bid for one glass (${ids.join(', ')}), through src/world/fieldtalk.js`);
    }
  }

  // ---- brush ------------------------------------------------------------
  /* THE SPAN'S RANK, AND THE ONE PLACE THE TRUE STACK MAY NOT STAND.
     See the block above `rank()` in src/world/span.js. A brush past may cost a
     guess; it may never open the site. */
  try {
    const SQ = cutSpanMaths(W.src.span);
    let mid = 0, swept = 0, first = null;
    for (let seed = 0; seed < 400; seed++) {
      const q = SQ.question(seed);
      if (!q || !q.choices || q.choices.length !== 3) continue;
      swept++;
      if (q.choices[1] && q.choices[1].form === 'true') { mid++; if (first === null) first = seed; }
    }
    if (!swept) {
      add('brush', 'src/world/span.js question() no longer returns three stacks this gate can read');
    } else if (mid) {
      add('brush', `${mid} of ${swept} span seeds stand the TRUE stack in the middle of the rank (first at seed ${first})`
        + ' — the stacks are 7.4 m apart with a horizontal capture disc of up to 1.86 m, so a straight walk from one end of'
        + ' the rank to the other goes through it and OPENS the span with an answer nobody chose, paying 140 motes and laying'
        + ' a permanent road for it');
    } else {
      notes.push(`brush  ${swept} span seeds swept, the true stack is never the middle of the rank`);
    }
  } catch (e) {
    add('brush', `could not run src/world/span.js's own generator: ${e.message}`);
  }

  // ---- flown ------------------------------------------------------------
  /* A LOWER BOUND INSIDE A BUDGET IS NOT EVIDENCE THAT A FLIGHT FITS. See
     `FLOWN` at the top of this file for the three real flights behind it. */
  if (!W.legMax) {
    add('flown', 'src/meta/objective.js no longer states LEG_MAX_S, so nothing bounds how long the card will hold a field leg');
  } else if (W.legMax < FLOWN) {
    add('flown', `LEG_MAX_S is ${W.legMax} s and the slowest flight anybody has actually FLOWN to a day-one site on real keys`
      + ` from a cleared save is ${FLOWN} s (span 0, tools/critic/_laneC-span.mjs, this tree) — the card is taken back with the`
      + ' cadet still in the air. The lower bound this gate computes is not evidence about a real flight: the same site on the'
      + ' same build has been flown in 45 s and in 201 s');
  } else {
    notes.push(`flown  budget ${W.legMax} s against the slowest real flight measured on real keys, ${FLOWN} s`);
  }

  // ---- dayone -----------------------------------------------------------
  /* THE SITES THE WORLD BUILT FOR DAY ONE, AND WHETHER THE CARD MAY NAME THEM.
     Four places declare `access: null` — the wing every cadet has from boot —
     and the `reach` rule above proves every one of them flyable from a cleared
     save with metres in hand. `pickField` in src/meta/objective.js refuses a
     site with `air` set unless the cadet's own row of REACH allows air, and it
     refuses one further off than that row's metres. So this rule asks the only
     question that matters for a first sitting: can the row a cadet holding
     NOTHING matches name one of the four, from somewhere the world seats a
     tear. */
  {
    const dayOne = sites.filter((s) => s.access === null);
    const first = W.reach[0];
    let worstSeat = 0, seats = 0, reached = 0;
    for (const [x, z] of G.list) {
      if (Math.hypot(x, z) > ISLAND_R - 20) continue;
      seats++;
      let near = Infinity;
      for (const s of dayOne) near = Math.min(near, Math.hypot(s.x - x, s.z - z));
      if (Number.isFinite(near)) {
        worstSeat = Math.max(worstSeat, near);
        if (first && near <= first.airMetres) reached++;
      }
    }
    const need = Math.ceil(worstSeat / 10) * 10;
    if (!dayOne.length) {
      add('dayone', 'not one off-island site declares the wing every cadet has from boot, so a cleared-save cadet can never be'
        + ' sent to any of them however REACH is written');
    } else if (!first) {
      add('dayone', 'src/meta/objective.js no longer states a REACH table this gate can read');
    } else if (!first.air) {
      add('dayone', `${dayOne.length} sites declare the wing every cadet has from boot (${dayOne.map((s) => s.key).join(', ')})`
        + ' and the `reach` rule proves every one of them flyable from a cleared save — and the first row of REACH in'
        + ` src/meta/objective.js reads \`air: false\`, as does the row above it, so NOTHING off the island may be named until`
        + ' KITE TRIM, which is three held lines. A cleared-save cadet cannot be sent to a place his own wing reaches.'
        + ` The row needs \`air: true\` and ${need} m of AIR reach — ${need} m is the furthest any of the ${seats} places the`
        + ' world can seat a tear stands from the nearest of those four. It does not need 290 m of WALK: those are two different'
        + ' units of effort, and the 70 m on that row is `DIVERT_MAX`, the promise that nobody is made to hike. 290 m of glide on'
        + " the wing a cadet boots with is twenty seconds of the best thing this game owns. So either `metres` moves and the walk"
        + ' promise moves with it, or the row grows an `airMetres` beside it — this gate reads either');
    } else if (reached < seats) {
      add('dayone', `the first row of REACH allows an air site and reaches ${first.airMetres} m, and ${seats - reached} of`
        + ` ${seats} places the world can seat a tear have no day-one site inside it — it needs ${need} m of air reach`);
    } else {
      notes.push(`dayone  ${dayOne.length} site(s) on the wing every cadet has from boot (${dayOne.map((s) => s.key).join(', ')})`
        + ` · every one of ${seats} tear seats has one inside the first rung's ${first.airMetres} m of air`
        + ` (furthest ${worstSeat.toFixed(0)} m)`);
    }
  }

  // ---- commit -----------------------------------------------------------
  for (const [n, table] of Object.entries(W.piers)) {
    const ends = table.map((p) => p[p.length - 1]);
    if (ends.length !== Number(n)) add('commit', `PIERS[${n}] carries ${ends.length} piers for ${n} weights`);
    for (const p of table) {
      for (let k = 1; k < p.length; k++) {
        const d = Math.abs(p[k][0] - p[k - 1][0]) + Math.abs(p[k][1] - p[k - 1][1]);
        if (d !== 1) add('commit', `PIERS[${n}] has a pier whose cells are not joined (${p[k - 1]} to ${p[k]}) — nothing can walk out to it`);
      }
      const root = p[0];
      const onDeck = (a, b) => Math.abs(a) <= 2 && Math.abs(b) <= 2;
      const touches = [[1, 0], [-1, 0], [0, 1], [0, -1]]
        .some(([dx, dz]) => onDeck(root[0] + dx, root[1] + dz));
      if (!touches) add('commit', `PIERS[${n}] has a pier whose first cell ${root} does not touch the deck — nothing can walk out to it`);
      if (p.length > 1) {
        add('commit', `PIERS[${n}] has a pier ${p.length} cells long: a four-metre catwalk over a fifty-metre drop is a site whose answer costs a cadet the trip`);
      }
    }
    for (let a = 0; a < ends.length; a++) {
      const deckCell = Math.abs(ends[a][0]) <= 2 && Math.abs(ends[a][1]) <= 2;
      if (deckCell) {
        add('commit', `PIERS[${n}] puts a claim cell at ${ends[a]}, which is part of the 5 x 5 deck — crossing the deck would answer`);
      }
      for (let b = a + 1; b < ends.length; b++) {
        const dx = Math.abs(ends[a][0] - ends[b][0]), dz = Math.abs(ends[a][1] - ends[b][1]);
        if (dx <= 1 && dz <= 1) {
          add('commit', `PIERS[${n}] claim cells ${ends[a]} and ${ends[b]} touch — two answers a cadet cannot tell apart`);
        }
      }
    }
    // …and no two PIERS are edge-adjacent anywhere, so there is never a floor
    // that walks from one candidate to another.
    const all = table.flatMap((p, k) => p.map((c) => [c[0], c[1], k]));
    for (const [x, z, k] of all) {
      for (const [ox, oz, ok2] of all) {
        if (k === ok2) continue;
        if (Math.abs(x - ox) + Math.abs(z - oz) === 1) {
          add('commit', `PIERS[${n}]: pier ${k} and pier ${ok2} are joined at (${x},${z}) — a cadet can walk from one answer to another`);
        }
      }
    }
  }
  const touch = W.src.caches.match(/distanceTo\(player\.pos\)\s*<\s*TOUCH/);
  if (touch) add('commit', 'the claim is still a sphere around the stone (`distanceTo(player.pos) < TOUCH`) — walking past answers');

  // ---- sign / count / named ---------------------------------------------
  let maths = null;
  try { maths = cutMaths(W.src.caches); } catch (e) { add('sign', `could not cut the statement generator out of caches.js: ${e.message}`); }
  if (maths) {
    let sweptLow = 0, swept = 0;
    for (let seed = 0; seed < 240; seed++) {
      const q = maths.question(seed);
      swept++;
      const wrong = q.choices.filter((v) => v !== q.x);
      const low = wrong.filter((v) => v < q.x), high = wrong.filter((v) => v > q.x);
      if (low.length) sweptLow++;
      if (seed < 5 || true) {
        if (!low.length) add('sign', `seed ${seed} (${q.latex}, x = ${q.x}) has no weight under the answer — the beam can only ever fall one way`);
        if (!high.length) add('sign', `seed ${seed} (${q.latex}, x = ${q.x}) has no weight over the answer`);
      }
      for (const v of q.choices) {
        const l = q.a * v + q.b, r = q.rc * v + q.rd;
        if (l > maths.cap || r > maths.cap) {
          add('count', `seed ${seed} (${q.latex}) with weight ${v} asks a pan to hold ${Math.max(l, r)} against a cap of ${maths.cap}`);
        }
      }
      // every wrong weight is a named misconception, re-derived from a,b,c
      for (const v of wrong) {
        const named = v === q.rd - q.b || v === q.rd / q.a || v === q.rd / q.a - q.b;
        if (!named) add('named', `seed ${seed} (${q.latex}) carries the weight ${v}, which is not "never divided" (${q.rd - q.b}), "never subtracted" (${q.rd / q.a}) or "undone in the wrong order" (${q.rd / q.a - q.b})`);
      }
      if (q.a * q.x + q.b !== q.rd) add('named', `seed ${seed} (${q.latex}) is not a true statement at x = ${q.x}`);
    }
    notes.push(`statement  ${swept} seeds swept, ${sweptLow} carry a weight on each side of the answer`);
    for (let seed = 0; seed < 60; seed++) {
      const q = maths.deepQuestion(seed);
      for (const v of q.choices) {
        const l = q.a * v + q.b, r = q.rc * v + q.rd;
        if (l > maths.cap || r > maths.cap) {
          add('count', `deep seed ${seed} (${q.latex}) with weight ${v} asks a pan to hold ${Math.max(l, r)} against a cap of ${maths.cap}`);
        }
      }
      const wrong = q.choices.filter((v) => v !== q.x);
      if (!wrong.some((v) => v < q.x)) add('sign', `deep seed ${seed} (${q.latex}) has no weight under the answer`);
    }
  }

  // ---- label ------------------------------------------------------------
  if (!/submitTag\(/.test(W.src.caches) || !/beginTagFrame\(/.test(W.src.caches)) {
    add('label', 'src/world/caches.js writes its own label positions and never asks src/world/tagspace.js for room — nothing arbitrates `.field-tag`, and waygate.js already paid 452 overlaps for that');
  }
  if (!/nd\.c !== near/.test(W.src.caches)) {
    add('label', 'every cache inside the label reach prints its statement and its weights at once — two perches may stand DEEP_CLEAR apart while the labels reach far further');
  }

  // ---- pay --------------------------------------------------------------
  const payM = W.src.caches.match(/const back = toWorld\(c, 0, (-?\d+)\);/);
  const beat = num(/c\.showWon = false;[\s\S]{0,240}?\}, (\d+)\);/, W.src.caches);
  const plantAt = [...W.src.caches.matchAll(/drift\?\.addColumn\?\.\([\s\S]{0,160}?\}, (\d+)\);/g)].map((m) => Number(m[1]))[0];
  if (!payM) {
    add('pay', 'the updraft is not planted at a fixed point of the perch\'s own frame, so which part of the deck it stands over depends on the bearing');
  } else {
    const off = Number(payM[1]);      // signed, in the perch's own frame
    const radius = num(/c\.tier === 2 \? 9\.2 : ([\d.]+), true\)/, W.src.caches) || 8.4;
    // the nearest claim cell to the column's centre, in the perch's own frame
    let near = Infinity, at = null;
    for (const table of Object.values(W.piers)) {
      for (const p of table) {
        const e = p[p.length - 1];
        const d = Math.hypot(e[0] * CELL, e[1] * CELL - off);
        if (d < near) { near = d; at = e; }
      }
    }
    if (near <= radius) {
      add('pay', `the updraft stands at local z ${off} with a radius of ${radius} and the claim cell ${at} is ${near.toFixed(1)} m from its centre`
        + ' — it lifts the cadet off the answer he is looking at, which is the resolution beat cut off by its own payment');
    } else {
      notes.push(`pay  updraft at local z ${off}, radius ${radius}, nearest claim cell ${near.toFixed(1)} m away · beat ${beat} ms, planted at ${plantAt} ms`);
    }
  }
  if (!(plantAt >= beat)) {
    add('pay', `the updraft is planted at ${plantAt} ms and the resolution beat runs to ${beat} ms — the payment cuts off the moment it is paying for`);
  }

  // ---- asked ------------------------------------------------------------
  /* THE COUNTER THAT BUYS A FIELD LEG HAS TO BE ABLE TO REACH ITS OWN BAR.
     Measured on the frozen build, 10.5 minutes of real play from a cleared save
     with the whole kit held, sampling `stint.state()` and `objective()` five
     times a second: THE STINT SPENT A TEAR FOUR TIMES AND THE COUNTER
     INCREMENTED ZERO TIMES. `spends++` is guarded by whether the tear the
     SCHEDULER is naming is the spent one, and on all four spends the scheduler
     had already moved to the next line — var-meaning spent while the card said
     eval-expr, two-step spent while it said multi-step, multi-step spent while
     it said both-sides, both-sides spent while it said var-meaning. So
     `spends % FIELD_EVERY === 0` is a condition that cannot be met, the field
     leg never fires, and no card in a sitting has ever named a cache. The spend
     belongs to whichever tear the stint spent; the counter has to read it from
     there and not from the objective's own pick. */
  const inc = W.src.obj.match(/if \(([^)]*)\)\s*spends\+\+;/);
  if (!inc) {
    add('asked', 'src/meta/objective.js no longer counts filled arrivals anywhere this gate can find, so nothing proves a field leg can ever come due');
  } else {
    const names = [...inc[1].matchAll(/[A-Za-z_$][\w$]*/g)].map((m) => m[0]);
    let leaks = null;
    for (const n of names) {
      const decl = W.src.obj.match(new RegExp(`\\b(?:const|let|var)\\s+${n}\\s*=\\s*([^;]+);`));
      if (decl && /\brift\b/.test(decl[1])) leaks = `${n} = ${decl[1].trim()}`;
    }
    if (leaks) {
      add('asked', `the field leg's arrival counter is guarded by \`${inc[1].trim()}\`, and \`${leaks}\` reads the tear`
        + ' the SCHEDULER is naming rather than the tear the stint spent — measured over 10.5 minutes of real play, four spends'
        + ' and zero increments, because the scheduler had moved to the next line on every one of them. Count the spend where it'
        + ' happens (`stint.state().spent`), not where the card is pointing');
    }
  }

  // ---- spoken -----------------------------------------------------------
  for (const kind of new Set(W.rowKinds)) {
    if (!W.verbs.includes(kind)) {
      add('spoken', `src/kit/kit.js registers a field site of kind "${kind}" and src/meta/objective.js FIELD_VERB has no word for it, so the card asks for the wrong verb`);
    }
    if (!W.kinds.includes(kind)) {
      add('spoken', `src/meta/objective.js KIND_RANK does not rank "${kind}", so it is chosen after everything it should be chosen with`);
    }
  }
  for (const loc of ['en', 'es', 'pl']) {
    const b = readFileSync(F('src', 'i18n', `${loc}.js`), 'utf8');
    const site = (b.match(/\n {4}site: \{([\s\S]*?)\n {4}\},/) || [null, ''])[1];
    for (const kind of new Set(W.rowKinds)) {
      if (!new RegExp(`\\n\\s*${kind}:`).test(site)) {
        add('spoken', `guide.site.${kind} is missing from src/i18n/${loc}.js — the objective card would print a raw key`);
      }
    }
  }
  return { found, notes, W };
}

// ---------------------------------------------------------------------------
// --self-test: plant the exact defect each rule exists for
// ---------------------------------------------------------------------------
const PLANTS = [
  ['reach', 'the caches back on the datum that measured spires nobody can stand on',
    (o) => { o.caches = o.caches.replace(/const DECK = \[[^\]]+\]/, 'const DECK = [120, 56, 78, 85, 92]'); }],
  ['commit', 'the weights back on one rank across the middle of the deck',
    (o) => { o.caches = o.caches.replace(/const PIERS = \{[\s\S]*?\n\};/, 'const PIERS = {\n  3: [[[-1, 0]], [[0, 0]], [[1, 0]]],\n  4: [[[-2, 0]], [[-1, 0]], [[1, 0]], [[2, 0]]],\n};'); }],
  ['sign', 'both distractors back over the answer — the TOO BIG defect',
    (o) => { o.caches = o.caches.replace('const high = [c - b, c / a].find((v) => v > x && a * v + b <= CAP);',
      'const high = [c - b, c / a].find((v) => v > x && a * v + b <= CAP);\n      const low2 = c / a; if (low2) { const set2 = uniq([x, high, low2]); if (set2.length === 3) return { a, b, rc: 0, rd: c, x, choices: shuffle(set2, rnd), latex: `${a}x + ${b} = ${c}` }; }'); }],
  ['count', 'a pan asked to hold more than lay() will draw',
    (o) => { o.caches = o.caches.replace('if (low < 1 || a * low + b > CAP) continue;', 'if (low < 1) continue;')
      .replace('const high = [c - b, c / a].find((v) => v > x && a * v + b <= CAP);', 'const high = [c - b, c / a].find((v) => v > x);'); }],
  ['label', 'the labels back on their own positions, arbitrated by nothing',
    (o) => { o.caches = o.caches.replace(/submitTag\(\{/, 'noSubmit({').replace(/beginTagFrame\(time\);/, ''); }],
  ['pay', 'the updraft back under the cadet\'s own boots',
    (o) => { o.caches = o.caches.replace('const back = toWorld(c, 0, -16);', 'const back = toWorld(c, 0, 12);'); }],
  ['spoken', 'a kind of place the objective has no word for',
    (o) => { o.objective = o.objective.replace(/const FIELD_VERB = \{[\s\S]*?\};/, "const FIELD_VERB = {\n  cache: 'crack',\n};"); }],
  ['asked', 'the arrival counter back on the tear the scheduler is naming',
    (o) => { o.objective = o.objective.replace(/if \([^)]*\)\s*spends\+\+;/, 'if (nowSpent && !wasSpent) spends++;'); }],
  ['leg', 'the leg budget cut to something no flight fits in',
    (o) => { o.objective = o.objective.replace(/const LEG_MAX_S = \d+;/, 'const LEG_MAX_S = 4;'); }],
  ['flown', 'the leg budget cut under the slowest flight anybody has flown',
    (o) => { o.objective = o.objective.replace(/const LEG_MAX_S = \d+;/, 'const LEG_MAX_S = 30;'); }],
  ['onevoice', 'the meet printing its statement without asking anybody',
    (o) => { o.meet = o.meet.replace(/if \(!bidField\(time, 'meet', nd\)\) \{[\s\S]*?\n    \}\n/, ''); }],
  ['brush', "the span's true stack allowed back into the middle of the rank",
    (o) => { o.span = o.span.replace(/const at = out\.findIndex[\s\S]*?\n    \}\n/, ''); }],
  ['dayone', 'every day-one site taken off the wing a cadet boots with',
    (o) => {
      o.caches = o.caches.replace(/const ACCESS = \[[^\]]+\]/, "const ACCESS = ['kite', 'kite', 'kite', 0, 1]");
      o.span = o.span.replace(/access: i === 0 \? null :/, 'access: i === -1 ? null :');
      o.meet = o.meet.replace("access: null }", "access: 'kite' }");
    }],
];

/**
 * …AND THE OTHER DIRECTION, which is the half that matters for a rule that is
 * red on the honest tree: plant the FIX and require the rule to go quiet. A
 * rule that fires on everything is not a rule.
 */
const FIXES = [
  ['asked', 'the arrival counter read off the stint\'s own spend',
    (o) => {
      o.objective = o.objective
        .replace(/const nowSpent = [^;]+;/, 'const spentAny = !!(stint && stint.state && stint.state().spent);')
        .replace(/if \([^)]*\)\s*spends\+\+;/, 'if (spentAny && !wasSpent) spends++;');
    }],
  ['spoken', 'a verb and a rank for every kind the world registers',
    (o) => {
      o.objective = o.objective
        .replace(/const FIELD_VERB = \{/, "const FIELD_VERB = {\n  meet: 'cross',")
        .replace(/const KIND_RANK = \{ /, 'const KIND_RANK = { meet: 1, ');
    }],
  ['dayone', 'the first rung of REACH opened to the wing a cadet boots with, at the air reach the furthest tear seat needs,'
    + ' and the walk it already allowed left where it was',
    (o) => {
      /* The FIRST ROW of REACH, whatever else is on it. Written this way
         because the objective lane is editing that table in the same hour this
         gate is being read: a plant that names the whole row silently stops
         planting the moment somebody adds a column, and a self-test that plants
         nothing passes. */
      o.objective = o.objective.replace(/const REACH = \[\n(\s*)\{([^}]*)\}/, (all, pad, row) => {
        const fixed = `${row.replace(/air:\s*false/, 'air: true')}, airMetres: 290 `;
        return `const REACH = [\n${pad}{${fixed}}`;
      });
    }],
  ['flown', 'the leg budget raised past the slowest flight anybody has flown',
    (o) => { o.objective = o.objective.replace(/const LEG_MAX_S = \d+;/, 'const LEG_MAX_S = 210;'); }],
];

function selfTest() {
  let bad = 0;
  const ok = (m) => console.log(`  ok   ${m}`);
  const flag = (m) => { console.error(` FAIL ${m}`); bad++; };
  console.log('the archipelago gate — can a cadet get to the best objects in this game\n');

  const clean = judge();
  const cleanRules = new Set(clean.found.map((f) => f.rule));
  console.log('the honest tree');
  for (const n of clean.notes) console.log(`       ${n}`);
  if (clean.found.length) {
    for (const f of clean.found) console.log(`       ${f.rule}: ${f.text}`);
  }

  console.log('\nand the same rules over a planted one');
  for (const [rule, why, plant] of PLANTS) {
    const over = {};
    for (const k of Object.keys(SRC)) over[k] = readFileSync(SRC[k], 'utf8');
    plant(over);
    let got;
    try { got = judge(over).found; } catch (e) { got = [{ rule: 'threw', text: e.message }]; }
    if (!got.some((f) => f.rule === rule)) {
      flag(`${rule}: planted ${why} and the gate did not refuse it`);
    } else if (cleanRules.has(rule)) {
      ok(`${rule}: fires on ${why} (and is ALSO firing on the honest tree — see above)`);
    } else {
      ok(`${rule}: fires on ${why}, and is quiet on the honest file`);
    }
  }
  console.log('\n…and the same rules over a tree with the fix in it');
  for (const [rule, why, fix] of FIXES) {
    const over = {};
    for (const k of Object.keys(SRC)) over[k] = readFileSync(SRC[k], 'utf8');
    fix(over);
    let got;
    try { got = judge(over).found; } catch (e) { got = [{ rule: 'threw', text: e.message }]; }
    const still = got.filter((f) => f.rule === rule);
    if (still.length) flag(`${rule}: planted ${why} and the gate went on refusing it — ${still[0].text}`);
    else ok(`${rule}: goes quiet on ${why}, so the rule is about the defect and not about the file`);
  }
  console.log(bad ? `\n${bad} rule(s) could not be made to refuse anything` : '\nevery rule refused its own defect, and every rule that is red today goes quiet on its own fix');
  return bad ? 1 : 0;
}

// ---------------------------------------------------------------------------
async function main() {
  if (process.argv.includes('--self-test')) process.exit(selfTest());
  const F2 = ledger('check:archipelago', { scope: 'route' });
  const { found, notes } = judge();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ found, notes }, null, 1));
  } else {
    console.log('THE ARCHIPELAGO — every place off the island, and whether anybody can get to it\n');
    for (const n of notes) console.log(`  ${n}`);
    console.log('');
  }
  for (const f of found) F2.route(`${f.rule}: ${f.text}`);
  F2.done();
}

if (process.argv[1] && process.argv[1].endsWith('archipelago.mjs')) await main();
