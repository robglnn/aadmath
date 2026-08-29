import * as THREE from 'three';
import { heightAt } from './world.js';
import { tex } from '../ui/tex.js';
import { t } from '../i18n/index.js';
import { CELL } from '../build/pieces.js';
import { merge } from './geom.js';
import { beginTagFrame, submitTag } from './tagspace.js';
import './field.css';

/**
 * THE MEET — a coordinate plane you stand on, with a balance on the far rim
 * that substitutes the cell under your boots, live, every frame.
 *
 * A hanging cache (src/world/caches.js) is a balance you load with a weight.
 * A span (src/world/span.js) is a plot you cover. Both are the same shape of
 * act: you COMMIT, and then the world tells you. The interval between the two
 * is where the teaching happens, and `design/ARCHIPELAGO-PATTERN.md` Rule 3
 * exists to protect it.
 *
 * This site deletes that interval by making the reading CONTINUOUS.
 *
 *      statement one   u·x + v·y = w      is a RAIL. It is drawn on the deck,
 *                                          standing a metre proud, on exactly
 *                                          the cells where it is true. A line
 *                                          is all the solutions of one
 *                                          equation, and here it is a thing
 *                                          you climb onto and walk along.
 *
 *      statement two   p·x + q·y = r      is a BALANCE at the plot's far rim.
 *                                          The left pan holds p unknown-x
 *                                          tiles and q unknown-y tiles. The
 *                                          right pan holds r unit cubes. At
 *                                          rest the beam is DEAD LEVEL, which
 *                                          is the claim: this is true, for some
 *                                          pair.
 *
 * And this is the mechanism: **the balance substitutes the cell you are
 * standing on.** Every x-tile becomes as many cubes as your first coordinate,
 * every y-tile as many as your second, on the pan, in front of you, while you
 * walk. Somewhere along the rail the beam passes through level, and its sign
 * flips as you cross. THE SUBSTITUTION IS YOUR DISPLACEMENT. You are the value
 * of x.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS NOT A QUIZ WITH A VIEW
 *
 * A quiz shows you a question and takes an answer. Everything about it is over
 * once the answer is taken, so everything that matters has to be printed. Here
 * there is nothing to print. Cover every label this file draws — the two
 * equations are DOM tags and they are the only words on the site — and it is
 * still solvable, because the statement is not a caption on the apparatus; the
 * apparatus IS the statement. The rail is a line you can trip over. The pans
 * hold countable objects. Two tall violet tiles becoming six cubes each, while
 * you walk six cells east, is not a picture OF substitution: it is
 * substitution, happening, at the speed of your legs.
 *
 * There is no keypad. There is no card. There is no place to type a number and
 * no stone with a numeral on it to walk into. The only thing this site reads
 * is where the player's body is, and the only thing it says back is the angle
 * of a beam. A learner who cannot read `2x + y = 13` can still count two big
 * tiles against thirteen small ones, walk until the counts match, and will
 * have done the mathematics with their feet either way.
 *
 * And the case no card, keypad or slider can teach at all: when the two
 * statements are PARALLEL the beam holds the same angle at every reading on
 * the rail. Not "does not go level" — DOES NOT CHANGE, because p·x + q·y is
 * constant along the whole of u·x + v·y = w when the two are parallel.
 * Measured, walking MEET 2 end to end with real keys: sixteen against
 * twenty-two and -18.5 degrees at all nine readings, from the first to the
 * last. You walk forty-five metres of rail, watching an instrument that
 * answers everything else you do, and it tells you the same thing nine times.
 * Then the plot draws the second rail beside the first and both run out over
 * the sea, side by side, for ever. On a card, NO SOLUTION is an option in a
 * list and a learner picks it by elimination. Here it is a walk that ends with
 * nothing, and nobody who has had that walk once forgets what parallel means.
 *
 * ---------------------------------------------------------------------------
 * THE COMMIT, AND WHY IT IS NOT STANDING STILL
 *
 * `design/ARCHIPELAGO.md` §4.2 proposed committing by standing still for 1.2
 * seconds. That is rejected here, and the reason is in BRIEF.md rather than in
 * taste: this game has to be ADHD-aware, `src/player/locomotion.js` already
 * treats standing still as a first-class state, and a companion line landing
 * mid-rail, a look at the skyline, or thirty seconds of thinking would all
 * ANSWER THE QUESTION on the learner's behalf. Commit-by-idling makes
 * hesitation an answer and then charges for it.
 *
 * So the commit is a thing you can only do by moving, on purpose, in a
 * direction you were not already going:
 *
 *      YOU STEP OFF THE RAIL.
 *
 * The rail stands 1.0 m proud of the deck. You get onto it by walking into it
 * — a ledge pull-up, which `src/player/locomotion.js` does by itself with no
 * key — and once you are on it, walking ALONG it commits nothing, ever, at any
 * speed, for any length of time. Standing on it commits nothing. Jumping on
 * the spot commits nothing: the site watches for rail-to-deck, and a jump is
 * rail-to-air-to-rail. The claim is made at the moment you leave the line of
 * statement one, at the cell you left it from — which is also exactly what the
 * mathematics means by claiming that pair.
 *
 * That also disposes of the caches' worst defect. The pattern study reproduced
 * twice that crossing a cache's deck passes within 1.0-1.7 m of the middle
 * counterweight and OPENS THE CACHE with a weight the player never chose,
 * because a candidate there is a disc of radius 1.04-1.65 m against gaps as
 * small as 2.9 m. There are no discs here. A claim region is a LATTICE CELL,
 * cells tile the plane exactly, and no two of them overlap at any radius, so
 * there is no spacing to get wrong.
 *
 * AND THAT WAS NOT ENOUGH, WHICH IS WORTH WRITING DOWN. The first time this
 * site was played with real keys it fired THREE claims in thirty seconds on
 * cells nobody chose — the same defect in a new shape, and reading the source
 * would never have found it. The rail runs corner to corner across the plot,
 * so a cadet crossing the plot walks into it, the boots pull him up the metre
 * by themselves, and one step later he is down on the deck the far side: a
 * claim. So a claim is armed by the WALK and not by the step — the boots have
 * to settle on `ARM` readings of this rail since they were last on it, and the
 * cells already walked light up behind you so the arming is a thing you see.
 * Measured over every pose the generator makes: the most cells any straight
 * walk ACROSS a rail can touch is three, and the shortest rail is nine cells,
 * so ARM is four. `tools/critic/meet.mjs` rule `cross` re-measures both on
 * every run. The pattern study's own finding, again: the defects that matter
 * are found by playing, not by reading.
 *
 * ---------------------------------------------------------------------------
 * BOTH SIGNS, FROM THE FIRST ENCOUNTER
 *
 * A tier-1 cache can only ever say TOO BIG: both its distractors are
 * arithmetically >= x, so the left pan is always the heavy one and half of
 * Rule 4's channel is dead until a learner reaches a deep cache. Here the
 * residual is `p·gx + q·gz - r` along a rail that runs from one side of the
 * crossing to the other, so it is negative at one end and positive at the
 * other and it CHANGES SIGN UNDER THE PLAYER'S BOOTS. `posePlot` refuses any
 * pose where that is not true, and the gate proves it for every seed and band
 * (`tools/critic/meet.mjs`, rule `sign`).
 *
 * ---------------------------------------------------------------------------
 * NO NEGATIVE QUANTITY, ANYWHERE — AND WHAT THAT COST
 *
 * A pan adds. That is all it does. `src/world/caches.js` `lay()` composes only
 * positive counts of 'x' and 'unit' tiles and its `question()` forces a, b, c
 * > 0, and `design/ARCHIPELAGO-PATTERN.md` §7a states the limit plainly: there
 * is no counterweight for minus three. §4.2's worked statement `2x - y = 3`
 * has no body on this apparatus and neither has its band 4, "negatives on one
 * side".
 *
 * So both statements here are written with every coefficient positive and both
 * unknowns on the same side — `p·x + q·y = r` — which is the caches' own
 * `a·x + b = c` with a second unknown, and holds exactly the same tiles. What
 * band 4 asks instead is the thing that was actually next: A STEEP RAIL. When
 * u and v differ the lattice points on the line are spread out, so finding the
 * next one is counting a rise against a run with your feet, which is
 * `slope-rate` and `graph-linear` and is the reason those two skills are on
 * this site's list at all. Band 5 keeps its parallel and coincident cases,
 * which need no negative either.
 *
 * ---------------------------------------------------------------------------
 * WHERE IT IS, AND WHY THERE
 *
 * §3.4's access ladder was computed by scanning radii on each site's own
 * bearing, and a player launches from anywhere. Flood-filling walkable ground
 * out from the cadet's own spawn at 1 m resolution, using the game's own rule
 * — `_blocked` in src/player/locomotion.js, which is `gradientAt(x, z, 0.7) >
 * P.slopeLimit` at walking step size — puts the highest WALK-REACHABLE ground
 * on this island at 94.9 m, at (-94, -70). §4.2's cited launches for MEET 1
 * and MEET 2, at r 148-150 on bearings +55 and +62, are 81.7 m and 76.3 m of
 * ground standing at gradient 0.86 to 2.15 in a component NO WALK REACHES, so
 * both sites as written were hung off a launch pad nobody can stand on —
 * exactly the defect `src/world/span.js` found for itself and wrote down.
 *
 * Re-placed against the flood fill, with the ceiling maximised over EVERY
 * walk-reachable cell rather than over one bearing, and the wing's equilibrium
 * (`dv/dt = -g·sin y - k·v²`, g = 26) solved at each trim from `P`:
 *
 *   MEET 1  (140, 136)  r 195  brg +44.2  deck 56 m
 *           base-wing ceiling 63.0 m, from the coastal shoulder at (74, 137)
 *           — 69.6 m, walk-reachable, 50 m of gulf. 7.0 m in hand ON THE BASE
 *           WING FROM A CLEARED SAVE, which is the rule the ladder exists for
 *           — and this one is MEASURED, not computed: flown in the real game
 *           with real keys, from a cleared save, landing on the deck at 56.0.
 *
 *   MEET 2  (120, 224)  r 254  brg +61.8  deck 64 m
 *           base-wing ceiling 59.7 m — 4.3 m OUT OF REACH on the base wing.
 *           KITE TRIM ceiling 75.3 m: 11.3 m in hand. The access requirement
 *           is a glide ratio, which is what Rule 9 asks for: 1:7.6 does not
 *           reach it and 1:18.2 does. A flare lit on MEET 1's own deck reaches
 *           it too — the deck the mathematics opened is a launch pad, which is
 *           the archipelago's whole argument about what a payment is for.
 *
 * §4.2 gives those two ceilings as 74.0 and 71.5. The eleven metres between
 * its numbers and these are the launches: §3.4 scans radii on each site's own
 * bearing and takes the highest ground it finds, and on these two bearings
 * that ground is standing at a gradient of 0.86 to 2.15 in a component no walk
 * reaches.
 *
 * AND A THIRD CORRECTION TO THAT LADDER, WHICH ONLY FLYING IT FINDS. §3.4
 * corrects Rule 9 once — the launch must be ground you can stand on — and this
 * file corrects it again above, because the launch must be ground you can WALK
 * TO. Both of those still compute `launch height - gulf / ratio` as though the
 * air between were empty, and it is not. The highest walk-reachable ground on
 * this island is at (-94, -70), on the far side from both of these sites, and
 * the straight line from it to either of them goes THROUGH THE ISLAND. Flown
 * in the real game at exactly that "ceiling", it put a cadet on the ground at
 * (23, 108): two hundred metres covered for eighty of drop, because the wing
 * spent the whole flight skimming the hill the number was measured from. So
 * every ceiling here is computed over FREE AIR — the wing's own descent line
 * must clear `heightAt` by three metres for the whole flight, or that launch
 * does not count — and `tools/critic/meet.mjs` rule `reach` recomputes all of
 * it on every run, from `src/world/terrain.js`, `src/player/locomotion.js`,
 * `src/player/controller.js` and `src/kit/kit.js` rather than from anything
 * written down here. It prints the ladder it found, so this comment can be
 * checked against the build rather than believed.
 *
 * Both stand over open sea, clear of every other site: 83.5 m apart, and 61 m
 * from cache 1 at (64, 184), against a 36 m deck and a 26 m rock.
 *
 * ---------------------------------------------------------------------------
 * THE FRAME BUDGET, STATED SO IT CAN BE HELD
 *
 * `design/ARCHIPELAGO.md` specifies 17 new instances with no budget, against a
 * build whose sustained framerate is a known open defect (RESUME.md: 120 fps
 * fresh, 44.9 after eighteen minutes). `src/world/caches.js` set the
 * precedent — one shared instanced buffer of TILE_MAX = 640, and past
 * TILE_RANGE = 170 m a cache's pans are not composed at all. This file holds
 * to the same shape and states its numbers:
 *
 *   · TWO instances. Not five, not seventeen.
 *   · PLOT = 9 cells a side, so 81 `fixed` floor solids of deck each. Over
 *     every pose the generator can produce, the longest rail is 17 plates and
 *     the second rail a seal draws is 17 more, and the road it pays is capped
 *     at 24 — so the hard ceiling is 139 solids per instance and 278 for the
 *     family, set once at boot and never touched per frame. For comparison
 *     the caches stand 125 and the spans 75.
 *   · ONE shared InstancedMesh of TILE_MAX = 160 pan tiles for both sites —
 *     the worst pose wants 68 — and ONE of PLATE_MAX = 224 for every rail and
 *     road plate in the world, against a worst case of 116.
 *   · The pans are composed again only when what they hold CHANGES. Laying 68
 *     tile records twice a site at sixty frames a second is garbage this build
 *     cannot afford.
 *   · Past SITE_RANGE = 200 m a site is a silhouette and a light: no pans are
 *     laid out, no plate matrices are written, no label is submitted.
 *   · Meshes per site: rock, rim, rig, post, mark. Five draws, plus the two
 *     shared instanced buffers for the whole family.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT PAYS
 *
 * 140 motes, and THE CROSSROADS: on the seal both rails are laid outward past
 * the plot as real road — `fixed` floor in the same registry the build lattice
 * uses — so the site the mathematics opened becomes 24 m of new standing
 * ground reaching further out to sea than anything else in the world. Where
 * the two statements meet, two routes join, which is what a system of
 * equations is.
 *
 * And it is planted AFTER the moment it pays for. The pattern study measured
 * the caches planting their updraft under the cadet's own boots and lifting
 * him off the perch before he could look at the level beam — *the resolution
 * beat of the best mechanic in the game cut off by its own payment.* Here the
 * beam holds level, the second rail is drawn across the plot through the cell
 * the player is standing beside, and only 3.4 s later does the road run out;
 * the mark stays lit for 5.2 s so the site still looks like the site.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT DOES NOT DO, SAID PLAINLY
 *
 *   · A cell BETWEEN two readings can read level, and stepping off there is
 *     refused. The rail is laid along the whole continuous line, so it carries
 *     cells that are on the line and are not whole-number readings, and the
 *     balance answers whatever cell the boots are in. Standing on one of those
 *     and seeing a level beam is `nearest-grid-line-taken`, which is a named
 *     misconception on `system-graphically` and not a trick: the readings are
 *     the pads that stand proud of the rest of the rail, and the rim counts
 *     them off. It is the one place this site can feel unfair, and it is
 *     deliberate — a pair of whole numbers is what the question asks for.
 *   · It carries `inequality-two-var` in §4.2's list and it does not carry it
 *     here. That skill needs one side of the rail flooded, which is the WEIR's
 *     tide, and the WEIR does not exist. A site must not claim a skill it does
 *     not have a mechanism for.
 *   · It banks `assisted` evidence and nothing stronger, through a narrow
 *     `observe` callback rather than the mastery model itself — the module's
 *     options carry no `mastery`, no `session`, no `graph` and no objective,
 *     which is Rule 10's own test. A site that shows you which way you were
 *     wrong, for free, as many times as you like, cannot produce unassisted
 *     evidence and must never carry a mastery claim.
 *   · Like a cache, one instance asks one question for ever. `dice()` is
 *     deterministic. `plot()` builds the kind anywhere, at any band, so a
 *     future caller can hang another; two is what this wave ships.
 *   · Bands 1, 3 and 4 are generated, gated and unused. MEET 1 is band 2 and
 *     MEET 2 is band 5, because a pair of plots that says ONE CROSSING and
 *     THESE TWO NEVER MEET is worth more than five that say the same thing
 *     with different numbers — which is the failure mode
 *     `design/ARCHIPELAGO-PATTERN.md` exists to name.
 *   · Reading the beam is enough. Walk the rail slowly and it tells you where
 *     to stop with no algebra at all — the same trade a cache makes, correct
 *     for a tutor and disqualifying for an assessment, which is the whole
 *     reason nothing here carries a mastery claim.
 */

// ---- PURE:BEGIN ------------------------------------------------------------
// Everything between these two markers is the site's MATHEMATICS and nothing
// else: no three.js, no DOM, no i18n, no import of any kind. It is written this
// way so that `tools/critic/meet.mjs` can cut it out of this exact file and run
// it headless — the gate executes the shipped source rather than a copy of it,
// which is the discipline `tools/critic/handed.mjs` already uses and the only
// way a checker and a renderer cannot drift apart.

/** Cells a side. Coordinates run 0..8 on both axes. 9 x CELL = 36 m of deck. */
const PLOT = 9;
/** A pan stops being countable past about thirty objects. The caches cap at 34. */
const TILE_CAP = 34;

/** A small seeded die, so a plot asks the same pair of statements for ever. */
function dice(seed) {
  let h = 0x9e3779b9 ^ ((seed | 0) * 2654435761);
  return (n) => { h = Math.imul(h ^ (h >>> 15), 2246822507); return ((h >>> 8) % n); };
}

/** Greatest common divisor, so no statement is printed as a multiple of itself. */
function gcd3(a, b, c) {
  const g2 = (m, n) => (n ? g2(n, m % n) : m);
  return g2(g2(Math.abs(a), Math.abs(b)), Math.abs(c));
}

/** Every lattice cell of the plot on which `u·x + v·y = w` is true. */
function railOf(u, v, w, n = PLOT) {
  const out = [];
  for (let gx = 0; gx < n; gx++) {
    for (let gz = 0; gz < n; gz++) if (u * gx + v * gz === w) out.push([gx, gz]);
  }
  // ordered along the line, so "the end of the rail" means something
  out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return out;
}

/**
 * A LINE IS NOT A ROW OF STONES.
 *
 * The lattice cells where `u·x + v·y = w` holds are the line's whole-number
 * readings, and on any rail steeper or shallower than 45 degrees they do not
 * touch — so laying floor on those cells alone would give a cadet a row of
 * squares he falls between. The rail is laid along the CONTINUOUS line,
 * walked at a quarter of a cell and deduped onto the build lattice, exactly
 * the way `src/world/span.js` lays a road. That is not a fudge: the graph of
 * an equation in two variables IS all of its solutions, and the studs on it
 * are the whole-number ones.
 *
 * It is in here rather than in the renderer because it decides WHICH CELLS A
 * CADET CAN STAND ON, which is the input to every claim — so the gate has to
 * be able to run it and prove the ribbon is connected.
 */
function lineCells(u, v, w, from = 0, to = PLOT - 1, cap = 1e9) {
  const out = [];
  const seen = new Set();
  const n = PLOT - 1;
  const len = Math.hypot(v, u) || 1;
  const dx = v / len, dz = -u / len;
  const ox = (w * u) / (u * u + v * v), oz = (w * v) / (u * u + v * v);
  const reach = (n + 1) * 3;
  const off = (gx, gz) => Math.abs(u * gx + v * gz - w) / len;
  const push = (gx, gz) => {
    const d = Math.max(
      gx < from ? from - gx : gx - to,
      gz < from ? from - gz : gz - to,
    );
    if (d > 0) return false;
    if (gx < -n || gz < -n || gx > n * 3 || gz > n * 3) return false;
    const key = `${gx},${gz}`;
    if (seen.has(key)) return false;
    seen.add(key);
    out.push([gx, gz]);
    return true;
  };
  let prev = null;
  for (let s2 = -reach; s2 <= reach; s2 += 0.25) {
    const gx = Math.round(ox + dx * s2), gz = Math.round(oz + dz * s2);
    if (prev && (prev[0] !== gx || prev[1] !== gz)) {
      const ax = gx - prev[0], az = gz - prev[1];
      // A DIAGONAL STEP IS A HOLE. Two cells that meet at a corner are two
      // cells a cadet falls between, so the corner nearer the true line is
      // laid as well and the rail is walkable end to end. This is the rule
      // `tools/critic/meet.mjs` calls `ribbon`, and it found this file laying
      // a diagonal chain the first time it was run.
      if (Math.abs(ax) === 1 && Math.abs(az) === 1) {
        const a = [prev[0] + ax, prev[1]], b = [prev[0], prev[1] + az];
        const first = off(a[0], a[1]) <= off(b[0], b[1]) ? a : b;
        push(first[0], first[1]);
      }
    }
    push(gx, gz);
    prev = [gx, gz];
    if (out.length >= cap) break;
  }
  return out;
}

/** What the left pan holds minus what the right pan holds, at this cell. */
function residualAt(pose, gx, gz) {
  return pose.eqB.p * gx + pose.eqB.q * gz - pose.eqB.r;
}

/**
 * ONE PLOT, PURE.
 *
 * Bands, and what moves. There is no negative anywhere in any of them, for the
 * reason in this file's header: a pan holds counted objects.
 *
 *   1  both rail coefficients 1, the balance small; the crossing sits in the
 *      middle of the plot
 *   2  rail coefficients to 2, balance to 3; the crossing is still central
 *   3  rail coefficients to 3, balance to 4; the crossing moves toward an edge
 *   4  A STEEP RAIL — the two rail coefficients differ, so the lattice points
 *      on the line are spread and finding the next one is a rise counted
 *      against a run. This is what replaces §4.2's "negatives on one side",
 *      which this apparatus cannot hold.
 *   5  the PARALLEL case and the COINCIDENT case
 *
 * @returns {object|null} the pose, or null if no honest one exists for a seed
 */
function posePlot(seed, band = 1) {
  const b = Math.max(1, Math.min(5, band | 0));
  const rnd = dice((seed | 0) ^ (b * 0x27d4eb2d));
  const capA = [1, 2, 3, 4, 3][b - 1];
  const capB = [2, 3, 4, 4, 4][b - 1];
  const mid = (PLOT - 1) / 2;

  for (let tries = 0; tries < 400; tries++) {
    const u = b === 1 ? 1 : 1 + rnd(capA);
    const v = b === 1 ? 1 : 1 + rnd(capA);
    if (b === 4 && u === v) continue;
    const w = 2 + rnd((PLOT - 1) * Math.max(u, v));
    // the rail is always in lowest terms: `2x + 2y = 10` is `x + y = 5` wearing
    // a disguise, and a site may not print one statement as two
    if (gcd3(u, v, w) !== 1) continue;
    const rail = railOf(u, v, w);
    // A rail has to be a WALK: four lattice points is the fewest that reads as
    // a line rather than as three stones in a row.
    if (rail.length < 4) continue;

    if (b === 5) {
      // parallel and coincident: the balance is a multiple of the rail, so
      // `p·x + q·y` is CONSTANT along the whole rail and the beam never moves.
      const k = 2 + rnd(2);
      const p = u * k, q = v * k;
      if (p + q > 8 || p * (PLOT - 1) + q * (PLOT - 1) > TILE_CAP * 2) continue;
      const same = rnd(2) === 0;
      // a constant tilt has to be big enough to read as a tilt: 3..8 tiles is
      // 9.5 to 25 degrees at the caches' own 0.055 rad a tile
      const off = same ? 0 : (3 + rnd(6)) * (rnd(2) ? 1 : -1);
      const r = w * k + off;
      if (r < 1 || r > TILE_CAP) continue;
      if (!layable(rail, p, q)) continue;
      return finish({
        seed, band: b, u, v, w, p, q, r, rail,
        kind: same ? 'coincident' : 'parallel',
        solution: null,
      });
    }

    // a unique crossing, and it has to BE a lattice cell of this plot: two
    // lines that cross between the studs would be a site whose answer is not
    // anywhere you can stand.
    const p = 1 + rnd(capB);
    const q = 1 + rnd(capB);
    if (u * q - v * p === 0) continue;          // parallel — not this band
    if (p + q > 8) continue;
    // pick the crossing first and read `r` off it, so the answer is always on
    // the rail and always whole
    const wantEdge = b >= 3;
    const cands = rail.filter(([gx, gz]) => {
      const d = Math.max(Math.abs(gx - mid), Math.abs(gz - mid));
      return wantEdge ? d >= mid - 1 : d <= mid - 1;
    });
    if (!cands.length) continue;
    const pick = cands[rnd(cands.length)];
    const r = p * pick[0] + q * pick[1];
    if (r < 1 || r > TILE_CAP) continue;
    if (gcd3(p, q, r) !== 1) continue;
    if (!layable(rail, p, q)) continue;
    // exactly one lattice cell of the plot may satisfy both
    let n = 0;
    for (let gx = 0; gx < PLOT; gx++) {
      for (let gz = 0; gz < PLOT; gz++) {
        if (u * gx + v * gz === w && p * gx + q * gz === r) n++;
      }
    }
    if (n !== 1) continue;
    // BOTH SIGNS, ON THIS RAIL, ON THE FIRST ENCOUNTER. Without this the beam
    // can only ever fall one way and half of Rule 4 is dead, which is the
    // defect the caches carry at tier 1.
    let lo = 0, hi = 0;
    for (const [gx, gz] of rail) {
      const d = p * gx + q * gz - r;
      if (d < lo) lo = d;
      if (d > hi) hi = d;
    }
    if (lo >= 0 || hi <= 0) continue;
    return finish({ seed, band: b, u, v, w, p, q, r, rail, kind: 'unique', solution: pick });
  }
  return null;
}

/** Can every cell of this rail be laid as countable objects on a pan? */
function layable(rail, p, q) {
  for (const [gx, gz] of rail) if (p * gx + q * gz > TILE_CAP) return false;
  return true;
}

/**
 * WHICH SKILL A BAND SPEAKS FOR, and the misconception vocabulary that goes
 * with it. Every id below is on that node in `content/graph/`, and
 * `tools/critic/meet.mjs` rule `named` proves it rather than trusting it —
 * which is what makes Rule 5 mechanical instead of aspirational.
 */
const SKILL = ['system-substitution', 'system-substitution',
  'system-elimination', 'system-elimination', 'system-graphically'];
const MISREAD = {
  'system-substitution': { swapped: 'axis-swap', off: 'partial-rule' },
  'system-elimination': { swapped: 'axis-swap', off: 'partial-rule' },
  'system-graphically': {
    swapped: 'crossing-coordinates-swapped',
    off: 'checked-in-one-statement-only',
    end: 'one-trace-followed',
    near: 'nearest-grid-line-taken',
    invented: 'crossing-invented-for-parallel-traces',
  },
};

function finish(o) {
  const skill = SKILL[o.band - 1];
  const coef = (k) => (k === 1 ? '' : String(k));
  return {
    ...o,
    skill,
    eqA: { u: o.u, v: o.v, w: o.w },
    eqB: { p: o.p, q: o.q, r: o.r },
    plot: PLOT,
    latexA: `${coef(o.u)}x + ${coef(o.v)}y = ${o.w}`,
    latexB: `${coef(o.p)}x + ${coef(o.q)}y = ${o.r}`,
  };
}

/**
 * THE VERDICT, RE-DERIVED FROM THE POSE AND THE COMMITMENT ALONE.
 *
 * The commitment is two integers and a list of two-integer cells — the cell
 * the player stepped off the rail at, and every rail cell they stood on to get
 * there. Nothing about what the renderer believed happened is an input here,
 * which is the same discipline `tools/validate-items.mjs` applies to a card:
 * an answer that is correct only by construction is not verified.
 *
 * @param {object} pose from `posePlot`
 * @param {{cell:[number,number], walked?:Array<[number,number]>}} commit
 */
function readVerdict(pose, commit) {
  const cell = commit && commit.cell;
  if (!cell || cell.length !== 2) return { correct: false, residual: null, misconception: null };
  const [gx, gz] = cell;
  const words = MISREAD[pose.skill] || MISREAD['system-graphically'];
  const pick = (k) => words[k] || words.off || null;
  const onRail = pose.rail.some((c) => c[0] === gx && c[1] === gz);
  if (!onRail) {
    // Off the rail there is nothing to claim: statement one is not even true
    // here. Reachable only by dropping onto the deck outside the line.
    return { correct: false, residual: residualAt(pose, gx, gz), misconception: pick('near') };
  }
  const res = residualAt(pose, gx, gz);
  const walked = (commit.walked || []).map((c) => `${c[0]},${c[1]}`);
  const whole = pose.rail.every((c) => walked.includes(`${c[0]},${c[1]}`));
  const ends = [pose.rail[0], pose.rail[pose.rail.length - 1]];
  const atEnd = ends.some((c) => c[0] === gx && c[1] === gz);

  if (pose.kind === 'parallel') {
    // The only true claim here is NO SOLUTION, and the only physical way to
    // make it is to walk the whole line and come off the end of it. Stepping
    // off in the middle is inventing a crossing, which is the named error.
    if (whole && atEnd) return { correct: true, residual: res, misconception: null };
    return { correct: false, residual: res, misconception: pick('invented') };
  }
  if (res === 0) return { correct: true, residual: 0, misconception: null };

  // the swapped pair — the learner read the crossing the wrong way round
  if (pose.solution && gx === pose.solution[1] && gz === pose.solution[0]) {
    return { correct: false, residual: res, misconception: pick('swapped') };
  }
  if (atEnd) return { correct: false, residual: res, misconception: pick('end') };
  // the nearest cell to level that is not level — took the neighbouring stud
  let best = Infinity;
  for (const [ax, az] of pose.rail) {
    const d = Math.abs(residualAt(pose, ax, az));
    if (d > 0 && d < best) best = d;
  }
  if (Math.abs(res) === best) return { correct: false, residual: res, misconception: pick('near') };
  return { correct: false, residual: res, misconception: pick('off') };
}
// ---- PURE:END --------------------------------------------------------------

/** How the beam answers a cell. The caches' own law, unchanged: 3.15° a tile. */
const TILT = 0.055;
const TILT_MAX = 0.46;
/** Every pan tile of both sites at once. Two pans of 34 plus the waiting rig. */
const TILE_MAX = 160;
/** Every rail and road plate in the world, in one buffer. */
const PLATE_MAX = 224;
/** Past this a plot is a silhouette and a light. Nothing is composed. */
const SITE_RANGE = 200;
/** How high the rail stands over the deck. Above P.stepUp, under P.mantleMax. */
const RAIL_Y = 1.0;
/** How thick a plate is drawn. Its TOP is the surface, never its middle. */
const PLATE_T = 0.42;
/** Cells of road each rail runs past the plot, each way, when it is sealed. */
const ROAD_CELLS = 6;
const REWARD = 140;
/** No claim may fire twice inside this. `span.js` pays for the same lesson. */
const SETTLE = 1.2;
/**
 * Readings of the rail the boots must settle on before a step off it is a
 * CLAIM rather than a crossing.
 *
 * MEASURED, not chosen. Over every pose the generator can produce, the most
 * cells of a rail that any straight walk ACROSS it can touch is THREE — a
 * shallow rail crossed corner-to-corner — and the shortest rail in the bank is
 * NINE cells long. So four arms a claim with a margin of one over the worst
 * crossing and leaves five cells of walking in hand on the shortest rail.
 * `tools/critic/meet.mjs` rule `cross` re-measures both on every run and
 * refuses the file if either margin closes. See the note in `trackFeet`.
 */
const ARM = 4;
/**
 * How long the site holds the refused reading before it reads live again.
 *
 * A cache holds 1.5 s. This holds longer because there is more to read: the
 * pans still carry the substitution of the cell you claimed, the beam is at
 * the angle that cell produced, and the hole where the reading used to be is
 * open beside you. Measured in play, 1.5 s ran out before a cadet who stepped
 * off and then turned to look had turned.
 */
const HOLD = 2.4;
/** How long a refused cell stays a hole before the whole rail comes back. */
const REFORM = 6500;
/** The resolution beat: the road waits this long, and the mark this much more. */
const BEAT = 3.4;
const MARK_OUT = 5.2;
/** Solid ids: caches take -1 down, spans -100000 and -200000. This is clear. */
const DECK_BASE = -400000;
const PLATE_BASE = -500000;

/**
 * WHERE THE TWO PLOTS HANG, measured rather than scanned.
 *
 * See this file's header. `y` is the deck's own surface, in metres, and each
 * one is set against a base-wing ceiling computed over every WALK-REACHABLE
 * cell on the island rather than over one bearing.
 */
const SITES = [
  // `x + y = 9` against `2x + y = 13`, crossing dead centre at (4, 5), with a
  // rail of eight readings and a residual that runs -3 .. +4: the beam falls
  // one way at one end of the walk and the other way at the other.
  { key: 'm1', x: 140, z: 136, y: 56, seed: 0x4444, band: 2 },
  // `x + y = 8` against `2x + 2y = 22` — PARALLEL, and the two statements do
  // not look alike, so a cadet has to walk it to find out. Nine readings, and
  // the beam holds -6 (18.9 degrees) at every one of them without moving.
  { key: 'm2', x: 120, z: 224, y: 64, seed: 0xdddd, band: 5 },
];

/* ---------------------------------------------------------------------------
   EVERY SCRATCH BINDING THIS MODULE HAS, AND WHY THEY ARE ALL UP HERE.

   `src/world/span.js` wrote this lesson down after it cost the whole game:
   *"`addPlate` closes over a `Set` and `rebuildRoad` over four scratch
   vectors, all declared further down this factory — so restoring a saved road
   from up there ran `addPlate` before its own `const` had been reached and
   threw 'Cannot access before initialization' from inside module setup. The
   cost of that was not the spans: it was the GAME."*

   This file did exactly the same thing on its first boot. `plot()` runs at
   construction and reaches `cellWorld`, which closed over a `Vector3` declared
   two hundred lines further down the factory: `Cannot access 'T' before
   initialization`, `window.__ascent` never appears, black page. It only shows
   up in a real browser, so no headless gate could see it — `tools/critic/
   shoot.mjs` did, on the next capture.

   So there are no scratch bindings inside the factory at all. They live here,
   above everything, where nothing can reach them too early, and
   `tools/critic/meet.mjs` rule `boot` refuses the file if one moves back down.
   --------------------------------------------------------------------------- */
const _v = new THREE.Vector3();
const _c = new THREE.Vector3();
const _w = new THREE.Vector3();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
/** An unknown x-tile, an unknown y-tile, and a unit cube. */
const XCOL = new THREE.Color(0xb489ff);
const YCOL = new THREE.Color(0xffc46b);
const UCOL = new THREE.Color(0x74e2ff);
/** The rail between two readings, a reading, a reading already walked. */
const PCOL = new THREE.Color(0x4fae8a);
const SCOL = new THREE.Color(0xf2fffa);
const WCOL = new THREE.Color(0x7fffd4);
/** Statement two's own rail, drawn on the seal — and a reading the beam refused. */
const RCOL = new THREE.Color(0xffd9a8);
const OCOL = new THREE.Color(0x6b7a86);

export function createMeets(opts = {}) {
  const {
    scene, uiRoot, player, builder, hud, wallet, audio, fx,
    observe = () => {},
    isBusy = () => false,
  } = opts;

  const group = new THREE.Group();
  group.name = 'meets';
  scene.add(group);

  const tags = document.createElement('div');
  tags.className = 'field-tags meet-tags';
  (uiRoot || document.body).appendChild(tags);

  // ------------------------------------------------------------- materials
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x93a3ac, roughness: 0.93, metalness: 0.05, flatShading: true,
  });
  // Cold green is this family's colour, so a shaft in the sky says which kind
  // of place it stands over before anybody commits to the flight.
  const rigMat = new THREE.MeshStandardMaterial({
    color: 0xd8f7e6, emissive: 0x1d8f6a, emissiveIntensity: 0.85,
    roughness: 0.34, metalness: 0.44,
  });
  const studMat = new THREE.MeshStandardMaterial({
    color: 0xbfe8d6, emissive: 0x2a7f63, emissiveIntensity: 0.7,
    roughness: 0.5, metalness: 0.2,
  });
  const railMat = new THREE.MeshStandardMaterial({
    color: 0xdcfff0, emissive: 0x39d99b, emissiveIntensity: 1.05,
    roughness: 0.3, metalness: 0.1,
  });
  const tileGeo = new THREE.BoxGeometry(1, 1, 1);
  const tileMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0x11241f, emissiveIntensity: 0.7,
    roughness: 0.4, metalness: 0.06,
  });
  const tiles = new THREE.InstancedMesh(tileGeo, tileMat, TILE_MAX);
  tiles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  tiles.frustumCulled = false;
  tiles.castShadow = true;
  tiles.count = 0;
  tiles.userData.noCamBlock = true;
  group.add(tiles);

  // One buffer for every plate of every rail and every road in the world.
  const plateGeo = new THREE.BoxGeometry(CELL - 0.25, PLATE_T, CELL - 0.25);
  const plates = new THREE.InstancedMesh(plateGeo, railMat, PLATE_MAX);
  plates.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  plates.frustumCulled = false;
  plates.receiveShadow = true;
  plates.count = 0;
  group.add(plates);

  const list = [];
  const saved = load();
  let saidFirst = !!saved.said;

  for (const s of SITES) plot(s);

  // ------------------------------------------------------------------ build
  /**
   * HANG ONE PLOT, ANYWHERE. The apparatus is a KIND, not two instances —
   * `src/world/caches.js` learned that the hard way and wrote it down: *"write
   * hang() before you write the five instances."* Nothing in here reads SITES.
   */
  function plot(spec) {
    const pose = posePlot(spec.seed, spec.band);
    if (!pose) return null;
    const ang = Math.atan2(spec.z, spec.x);
    const slot = list.length;
    const mid = (PLOT - 1) / 2;
    const half = mid * CELL;

    const c = {
      i: slot, key: spec.key, pose, x: spec.x, y: spec.y, z: spec.z, ang,
      opened: !!(saved.opened && saved.opened[spec.key]),
      group: new THREE.Group(),
      roll: 0, rollV: 0, want: 0, held: 0, settle: 0,
      load: [], laid: null, railPlates: [], roadPlates: [], deck: [],
      spent: new Set(), walked: new Set(), chain: new Set(), stood: null, standT: 0,
      lastRail: null, showWon: false, drawn: false, try: 0,
    };
    // local +z points back at the island, so a cadet arrives at the (0,0)
    // corner and walks out; the balance stands on the far rim, in front of him.
    c.group.position.set(spec.x, spec.y, spec.z);
    c.group.rotation.y = -ang - Math.PI / 2;
    group.add(c.group);
    // Once, here: nothing moves a plot again, and every `localToWorld` and
    // `worldToLocal` below — including the one that reads which cell the boots
    // are in — needs the matrix to exist before the first frame is drawn.
    group.updateMatrixWorld(true);

    // ---- the shard: a 36 m deck on a keel, hanging clear of nothing at all
    const deckGeo = new THREE.BoxGeometry(PLOT * CELL, 1.6, PLOT * CELL);
    deckGeo.translate(0, -0.8, 0);
    const keelGeo = new THREE.CylinderGeometry(half * 0.78, 1.2, 19, 7, 1);
    keelGeo.rotateY(0.4);
    keelGeo.translate(0, -11, 0);
    const rock = new THREE.Mesh(merge([deckGeo, keelGeo]), stoneMat);
    deckGeo.dispose(); keelGeo.dispose();
    rock.castShadow = true;
    rock.receiveShadow = true;
    c.group.add(rock);

    // ---- real floor, on the same lattice a cadet builds on, flagged fixed
    for (let gx = 0; gx < PLOT; gx++) {
      for (let gz = 0; gz < PLOT; gz++) {
        const w = cellWorld(c, gx, gz);
        const piece = {
          kind: 'floor', x: w.x, y: spec.y, z: w.z, yaw: 0,
          base: spec.y, onGround: false, dead: false, fixed: true, grow: 1,
          fade: 0, sel: 0, want: 0, tone: 0,
          id: DECK_BASE - (slot * 256 + gx * 16 + gz),
        };
        builder.solids.add(piece);
        c.deck.push(piece);
      }
    }

    // ---- THE PLOT IS RULED, or it is a slab.
    //
    // A coordinate plane a cadet cannot count is not a coordinate plane, and
    // `graph-linear` is a skill about counting a rise against a run. So every
    // cell boundary carries a ridge — 8 cm proud, well under `P.stepUp`, so it
    // rules the ground without ever tripping a stride — and the rim carries
    // one stud a cell with a taller post every fifth and a pillar on the
    // origin corner. That is how a coordinate is read here, and it is
    // deliberately NOT eighteen numerals printed into the DOM: `.field-tag` is
    // chrome to `src/world/tagspace.js`, and eighteen of them would be litter.
    const rimParts = [];
    for (let k = 0; k <= PLOT; k++) {
      const at = (k - 0.5 - mid) * CELL;
      const bright = k % 5 === 0;
      const t2 = bright ? 0.22 : 0.11;
      const h2 = bright ? 0.14 : 0.07;
      const gx2 = new THREE.BoxGeometry(t2, h2, PLOT * CELL);
      gx2.translate(at, h2 / 2, 0);
      rimParts.push(gx2);
      const gz2 = new THREE.BoxGeometry(PLOT * CELL, h2, t2);
      gz2.translate(0, h2 / 2, at);
      rimParts.push(gz2);
    }
    for (let k = 0; k < PLOT; k++) {
      const tall = k % 5 === 0;
      const h = tall ? 2.6 : 1.1;
      for (const axis of [0, 1]) {
        const g = new THREE.BoxGeometry(0.34, h, 0.34);
        const at = axis === 0 ? cellWorldLocal(k, -1) : cellWorldLocal(-1, k);
        g.translate(at.x, h / 2, at.z);
        rimParts.push(g);
      }
    }
    const originGeo = new THREE.CylinderGeometry(0.5, 0.7, 3.4, 6);
    const o0 = cellWorldLocal(-1, -1);
    originGeo.translate(o0.x, 1.7, o0.z);
    rimParts.push(originGeo);
    const rim = new THREE.Mesh(merge(rimParts), studMat);
    for (const g of rimParts) g.dispose();
    rim.castShadow = true;
    c.group.add(rim);

    // ---- the balance, on the far rim, big enough to read from across the plot
    const beam = new THREE.Group();
    beam.position.set(0, 7.4, -half - 9);
    c.group.add(beam);
    c.beam = beam;
    const rigParts = [new THREE.BoxGeometry(13.0, 0.42, 0.6)];
    for (const side of [-1, 1]) {
      const hang = new THREE.CylinderGeometry(0.07, 0.07, 2.1, 6);
      hang.translate(side * 5.2, -1.15, 0);
      rigParts.push(hang);
      const pan = new THREE.CylinderGeometry(2.3, 2.05, 0.18, 22);
      pan.translate(side * 5.2, -2.3, 0);
      rigParts.push(pan);
    }
    const rig = new THREE.Mesh(merge(rigParts), rigMat);
    for (const g of rigParts) g.dispose();
    rig.castShadow = true;
    beam.add(rig);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.9, 7.3, 5), rigMat);
    post.position.set(0, 3.65, -half - 9);
    c.group.add(post);

    // ---- the mark you can see from the far coast, standing ABOVE the plot
    c.markMat = new THREE.MeshBasicMaterial({
      color: 0x8effc8, transparent: true, opacity: 0.28, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    const shaftGeo = new THREE.CylinderGeometry(1.0, 2.2, 130, 8, 1, true);
    shaftGeo.translate(0, 78, 0);
    c.mark = new THREE.Mesh(shaftGeo, c.markMat);
    c.mark.userData.noCamBlock = true;
    c.mark.renderOrder = 2;
    c.group.add(c.mark);

    layRail(c);
    layout(c, null);

    // Two statements, two anchors, and each one stands over the thing it is
    // about: the balance's over the balance, the rail's over the middle of the
    // rail. `.field-tag.big` rather than a green rule of its own, because this
    // lane owns one file and `src/world/field.css` belongs to the rest of
    // src/world; a `.field-tag.meet` there is the obvious follow-up.
    const midRail = c.railCells[Math.floor(c.railCells.length / 2)];
    const ml = cellWorldLocal(midRail[0], midRail[1]);
    c.tags = [
      // Far enough apart on the glass that they are not each other's chrome.
      // `.field-tag` is in `src/world/tagspace.js`'s CHROME list, so this
      // site's own three labels reserve space against one another; anchored a
      // metre and a half apart at thirty metres they contest the same band and
      // the ledger drops one rather than print them through each other, which
      // is the right call and the wrong frame. Three and a half metres apart
      // and all three are served.
      { local: [0, 9.4, -half - 8.2], cls: 'lede', key: 'field.meetLock', pri: 24 },
      { local: [0, 4.0, -half - 8.2], cls: 'big', tex: pose.latexB, pri: 25 },
      { local: [ml.x, 5.0, ml.z], cls: 'big', tex: pose.latexA, pri: 26 },
    ];

    if (c.opened) sealNow(c, true);
    list.push(c);
    return c;
  }

  /** Cell (gx, gz) in the plot's own frame. (0,0) is the near-left corner. */
  function cellWorldLocal(gx, gz) {
    const mid = (PLOT - 1) / 2;
    return { x: (gx - mid) * CELL, z: (mid - gz) * CELL };
  }
  /**
   * …and the same cell in world metres.
   *
   * Through three.js's own `localToWorld`, deliberately, and never through a
   * hand-written `sin`/`cos` basis. `tools/critic/handed.mjs` keeps a census
   * of every chirality-bearing construction in `src/` and allows the planar
   * cross product in `src/world/bearing.js` and nowhere else, for a reason
   * this project paid for twice: *"(fz, 0, -fx) is the LEFT vector and it was
   * used as screen-right"*, shipped, and reported by the client. A rotation
   * written out by hand is an inversion waiting to happen and it looks like
   * nothing in a diff. The matrix that puts the pixels on the glass is the one
   * that answers here too. The census refused the hand-written version of this
   * function on its first run.
   */
  function cellWorld(c, gx, gz) {
    const l = cellWorldLocal(gx, gz);
    _w.set(l.x, 0, l.z);
    c.group.localToWorld(_w);
    return { x: _w.x, z: _w.z };
  }

  // ------------------------------------------------------------------ rails
  function layRail(c) {
    const { u, v, w } = c.pose.eqA;
    c.railCells = lineCells(u, v, w);
    const stud = new Set(c.pose.rail.map((p2) => `${p2[0]},${p2[1]}`));
    for (const [gx, gz] of c.railCells) {
      const rec = addPlate(c, c.railPlates, gx, gz, RAIL_Y, 'rail');
      // The whole-number readings on the line, standing proud of the rest of
      // it: a cadet who steps off between two of them has claimed a pair that
      // is not a lattice reading, which is a NAMED error and not a trick.
      rec.stud = stud.has(`${gx},${gz}`);
    }
  }

  function addPlate(c, into, gx, gz, dy, kind) {
    const wpos = cellWorld(c, gx, gz);
    const piece = {
      kind: 'floor', x: wpos.x, y: c.y + dy, z: wpos.z, yaw: 0,
      base: c.y + dy, onGround: false, dead: false, fixed: true, grow: 1,
      fade: 0, sel: 0, want: 0, tone: 0,
      id: PLATE_BASE - (c.i * 4096 + into.length * 4 + (kind === 'rail' ? 0 : 1)),
    };
    builder.solids.add(piece);
    const rec = { piece, gx, gz, dy, kind, live: true };
    into.push(rec);
    return rec;
  }

  /** A cell the beam refused drops out of the rail: a hole you can see. */
  function dropCell(c, gx, gz) {
    for (const rec of c.railPlates) {
      if (rec.gx !== gx || rec.gz !== gz || !rec.live) continue;
      builder.solids.remove(rec.piece);
      rec.live = false;
    }
  }
  function reformRail(c) {
    for (const rec of c.railPlates) {
      if (rec.live) continue;
      builder.solids.add(rec.piece);
      rec.live = true;
    }
    c.spent.clear();
  }

  // --------------------------------------------------------------- the pans
  /**
   * Lay the pans. With nobody on the plot the left pan carries `p` x-tiles and
   * `q` y-tiles and the right carries `r` units, and the beam is DEAD LEVEL —
   * which is an assertion, not a question: this is true, for some pair. Stand
   * on a cell and every x-tile becomes that many units and every y-tile as
   * many as the other coordinate, in front of you, on the pan.
   */
  function layout(c, cell) {
    // A pan only has to be laid again when what it is holding CHANGES. Laying
    // it every frame is 68 tile records twice a site at sixty frames a second,
    // which is garbage collection this build cannot afford: RESUME.md has
    // sustained framerate down as an open defect (120 fresh, 44.9 at minute
    // eighteen) and a new site may not be the thing that feeds it.
    const key = cell ? `${cell[0]},${cell[1]}` : '-';
    if (c.laid === key) return;
    c.laid = key;
    const { p, q, r } = c.pose.eqB;
    c.load.length = 0;
    if (!cell) {
      lay(c.load, -5.2, -2.21, p, 'x');
      lay(c.load, -5.2, -2.21, q, 'y', Math.ceil(p / 3));
      lay(c.load, 5.2, -2.21, r, 'unit');
      c.left = null;
      c.right = null;
      return;
    }
    const [gx, gz] = cell;
    lay(c.load, -5.2, -2.21, p * gx + q * gz, 'unit');
    lay(c.load, 5.2, -2.21, r, 'unit');
    c.left = p * gx + q * gz;
    c.right = r;
  }

  function lay(out, px, py, count, kind, skipRows = 0) {
    const size = kind === 'unit' ? 0.5 : 0.98;
    const cols = kind === 'unit' ? 6 : 3;
    const n = Math.min(count, kind === 'unit' ? TILE_CAP : 8);
    for (let k = 0; k < n; k++) {
      const col = k % cols, row = Math.floor(k / cols) + skipRows;
      out.push({
        kind,
        x: px + (col - (cols - 1) / 2) * size * 1.12,
        y: py + row * size * 1.06 + size * 0.5,
        z: kind === 'unit' ? 0.42 : -0.42,
      });
    }
  }

  // ------------------------------------------------------------- the claim
  /**
   * THE ONLY INPUT THIS SITE HAS.
   *
   * `grep -nE "addEventListener|keydown|keyup|KeyE|keyCode|input\." meet.js`
   * finds only this sentence, and that is Rule 1's own test — sharpened, as
   * `design/ARCHIPELAGO.md` §2 sharpens it: the site owns no input surface, it
   * reads the state of the world, it never reads a key. What is read is
   * `player.pos`, `builder.solids` and this site's own geometry, and a
   * height band: which cell of the plot the boots are in, and whether they are
   * on the deck or a metre up on the rail. The claim is the rail-to-deck
   * transition, after `ARM` readings of the rail, and nothing else. Delete
   * every handler in this module and it is still completable, because there
   * are none.
   */
  function trackFeet(c, dt) {
    if (c.opened) return;
    const local = _v.copy(player.pos);
    c.group.worldToLocal(local);
    const mid = (PLOT - 1) / 2;
    const gx = Math.round(local.x / CELL) + mid;
    const gz = mid - Math.round(local.z / CELL);
    const dy = local.y;
    // ON the plot, not OVER it. Without the height band a cadet gliding across
    // at two hundred metres would be substituted into the pans and the beam
    // would swing at somebody who is not there.
    const inside = gx >= 0 && gz >= 0 && gx < PLOT && gz < PLOT
      && dy > -1.2 && dy < RAIL_Y + 3.4;
    if (!inside) { c.stood = null; c.lastRail = null; c.standT = 0; c.chain.clear(); return; }

    const onRail = dy > RAIL_Y - 0.35 && dy < RAIL_Y + 1.4
      && c.railCells.some(([ax, az]) => ax === gx && az === gz)
      && !c.spent.has(`${gx},${gz}`);
    const onDeck = dy > -0.5 && dy < RAIL_Y - 0.45;

    // the cell the pans are substituting, anywhere on the plot
    c.stood = [gx, gz];

    if (onRail) {
      if (!c.lastRail || c.lastRail[0] !== gx || c.lastRail[1] !== gz) {
        c.lastRail = [gx, gz];
        c.standT = 0;
      } else c.standT += dt;
      // a cell only becomes claimable once the boots have actually settled on
      // it, so a ledge pull-up in progress can never be a claim
      if (c.standT > 0.28) {
        c.walked.add(`${gx},${gz}`);
        c.chain.add(`${gx},${gz}`);
      }
      return;
    }
    if (onDeck && c.lastRail && c.standT > 0.28 && c.settle <= 0) {
      const claim = c.lastRail;
      const chain = c.chain.size;
      c.lastRail = null;
      c.standT = 0;
      c.chain.clear();
      // ---- WALK THE RAIL BEFORE YOU CLAIM A CELL ON IT --------------------
      //
      // THE FIRST REAL PLAYTHROUGH OF THIS SITE FOUND ITS OWN VERSION OF THE
      // CACHES' WORST DEFECT, and it is written down here because reading the
      // source would never have found it. The rail runs corner to corner
      // across the plot, so a cadet CROSSING the plot to get anywhere walks
      // into it, the boots pull him up the metre by themselves, and one step
      // later he is down on the deck the other side — which was a claim, on a
      // cell he never chose. Three fired inside the first thirty seconds.
      //
      // So a claim is armed by the walk, not by the step: the boots have to
      // have settled on ARM cells of this rail since the last time they were
      // on it. Crossing it touches one, or two where the line turns a corner.
      // Walking it touches all of them, and the cells you have walked light up
      // behind you, so the arming is a thing you can see rather than a rule
      // you are told. The instruction line says the same thing in eight words:
      // WALK THE RAIL. STEP OFF IT WHERE THE BEAM IS LEVEL.
      if (chain < ARM) return;
      claimCell(c, claim);
    }
    if (!onRail && !onDeck) return;      // airborne: hold the memory, claim nothing
  }

  function claimCell(c, cell) {
    if (c.opened || c.settle > 0) return;
    c.settle = SETTLE;
    const walked = [...c.walked].map((s) => s.split(',').map(Number));
    const out = readVerdict(c.pose, { cell, walked });
    // The reading is FROZEN on the claimed cell for a beat before anything
    // else happens, so the substituted pans and the angle they produced are on
    // screen and the verdict has not arrived yet. (Rule 3.)
    c.held = HOLD;
    layout(c, cell);
    c.want = out.correct && c.pose.kind !== 'parallel'
      ? 0
      : Math.max(-TILT_MAX, Math.min(TILT_MAX, (out.residual || 0) * TILT));
    if (out.correct) {
      c.rollV += (c.want - c.roll) * 3;
      observe(c.pose.skill, true, {
        assisted: true, misconception: null, form: 'site:meet', kind: 'world',
      });
      setTimeout(() => { if (!c.opened) seal(c); }, 900);
      return;
    }
    c.rollV += (c.want - c.roll) * 4;
    c.spent.add(`${cell[0]},${cell[1]}`);
    dropCell(c, cell[0], cell[1]);
    fx?.impact?.('bad');
    hud?.flash?.(t('field.meetNo'), 'bad');
    observe(c.pose.skill, false, {
      assisted: true, misconception: out.misconception, form: 'site:meet', kind: 'world',
    });
    // ---- A MISS NARROWS; IT NEVER TAXES, AND IT NEVER LOCKS ---------------
    //
    // It costs one cell of rail and nothing else: no motes, no progress, no
    // route. `grep -n "wallet.earn" src/world/meet.js` finds one line, and it
    // is the payment. The hole stays open long enough to be a record of where
    // you guessed — visible from the far end of the rail — and then THE
    // WHOLE RAIL COMES BACK, unconditionally, whether one cell is gone or all
    // of them. Unconditionally, because the alternative was a condition:
    // re-forming only once every reading was spent could never fire on a
    // solvable plot (the crossing cannot be spent — claiming it is correct),
    // so holes would have accumulated until the rail was too short to arm a
    // claim on. Nobody is ever locked out, and no state a learner can reach
    // has walking away as its only exit.
    //
    // A ticket, because `src/world/span.js` paid for this: one attempt's timer
    // fired after the next attempt had laid its slabs and wiped them, and *"a
    // cadet saw his answer erased"*.
    const ticket = (c.try = (c.try || 0) + 1);
    setTimeout(() => {
      if (c.opened || c.try !== ticket) return;
      reformRail(c);
      hud?.flash?.(t('field.meetReset'), '');
    }, REFORM);
  }

  // ------------------------------------------------------------------ seal
  function seal(c) {
    c.showWon = true;
    sealNow(c, false);
    save();
    const paid = wallet?.earn?.(REWARD, 'meet') ?? REWARD;
    audio?.unlocked?.();
    fx?.impact?.('good');
    hud?.flash?.(t(c.pose.kind === 'parallel' ? 'field.meetNone' : 'field.meetOpen',
      { n: paid }), 'good');
    // THE RESOLUTION BEAT. The second rail is already drawn; the road waits
    // 3.4 s and the mark 5.2 s, so the payment cannot cut off the moment it is
    // paying for the way a cache's updraft did.
    setTimeout(() => layRoad(c), BEAT * 1000);
    setTimeout(() => {
      c.showWon = false;
      c.mark.visible = false;
      rebuildTags();
    }, MARK_OUT * 1000);
  }

  /** Draw statement two as a rail of its own, and stand the plot down. */
  function sealNow(c, silent) {
    c.opened = true;
    if (!c.drawn) {
      c.drawn = true;
      const { p, q, r } = c.pose.eqB;
      c.secondCells = lineCells(p, q, r);
      for (const [gx, gz] of c.secondCells) {
        addPlate(c, c.railPlates, gx, gz, RAIL_Y, 'second');
      }
      reformRail(c);
    }
    if (silent) {
      c.roll = 0; c.want = 0; c.mark.visible = false;
      layRoad(c);
    }
  }

  /**
   * THE CROSSROADS. Both rails run outward past the plot as real road — the
   * span's own reward, and the one legible permanent mark this world can
   * carry. Where the two statements meet, two routes join.
   */
  function layRoad(c) {
    if (c.roadPlates.length) return;
    const n = PLOT - 1;
    for (const eq of [c.pose.eqA, c.pose.eqB]) {
      const u = eq.u !== undefined ? eq.u : eq.p;
      const v = eq.v !== undefined ? eq.v : eq.q;
      const w = eq.w !== undefined ? eq.w : eq.r;
      // the same line, walked past the plot's own edge in both directions
      const wide = lineCells(u, v, w, -ROAD_CELLS, n + ROAD_CELLS);
      let before = 0, after = 0;
      for (const [gx, gz] of wide) {
        const out = gx < 0 || gz < 0 || gx > n || gz > n;
        if (!out) continue;
        const side = gz > n || gx < 0 ? 'far' : 'near';
        if (side === 'far') { if (after >= ROAD_CELLS) continue; after++; }
        else { if (before >= ROAD_CELLS) continue; before++; }
        addPlate(c, c.roadPlates, gx, gz, 0, 'road');
      }
    }
  }

  // -------------------------------------------------------------------- tags
  let sight = false;
  function rebuildTags() {
    tags.innerHTML = '';
    const nodes = [];
    for (const c of list) {
      if (c.opened && !c.showWon) continue;
      for (const tag of c.tags) {
        const el = document.createElement('div');
        el.className = `field-tag ${tag.cls}`;
        if (tag.tex) el.innerHTML = tex(tag.tex);
        else el.textContent = t(tag.key);
        tags.appendChild(el);
        nodes.push({ el, c, local: tag.local, pri: tag.pri });
      }
    }
    tagNodes = nodes;
  }
  let tagNodes = [];
  rebuildTags();

  /**
   * ONE PLOT TALKS. `.field-tag` is CHROME to `src/world/tagspace.js` — nothing
   * arbitrates it — and `src/world/waygate.js` paid 452 label overlaps across
   * 126 of 288 layout frames for exactly that. `src/world/caches.js` still
   * prints every unopened cache inside 74 m (140 with RESONANT SIGHT) against a
   * 46 m clearance. So: the labels of the NEAREST plot only, submitted through
   * the one ledger, and refused rather than overprinted when the frame has no
   * room.
   */
  function placeTags(camera, time) {
    if (!tagNodes.length) return;
    beginTagFrame(time);
    const W = window.innerWidth, H = window.innerHeight;
    let near = null, nd = Infinity;
    for (const c of list) {
      if (c.opened && !c.showWon) continue;
      _c.setFromMatrixPosition(c.group.matrixWorld);
      const d = _c.distanceTo(camera.position);
      if (d < nd) { nd = d; near = c; }
    }
    const reach = sight ? 190 : 110;
    for (const node of tagNodes) {
      if (node.c !== near || nd > reach) { hideTag(node); continue; }
      _v.set(node.local[0], node.local[1], node.local[2])
        .applyMatrix4(node.c.group.matrixWorld);
      const d = _v.distanceTo(camera.position);
      _v.project(camera);
      if (!(_v.z < 1 && Math.abs(_v.x) < 1.15 && Math.abs(_v.y) < 1.15)) {
        hideTag(node);
        continue;
      }
      node.el.style.display = '';
      node.el.style.opacity = String(Math.max(0.2, 1 - Math.max(0, d - reach * 0.5) / (reach * 0.6)));
      submitTag({
        measure: node.el,
        x: (_v.x * 0.5 + 0.5) * W, y: (-_v.y * 0.5 + 0.5) * H,
        gap: 6, dir: 'mid', pri: node.pri, dist: d,
        place: (cx, top) => {
          node.el.style.left = `${Math.round(cx)}px`;
          node.el.style.top = `${Math.round(top)}px`;
          node.el.style.transform = 'translate(-50%, 0)';
        },
        hide: () => hideTag(node),
      });
    }
  }
  function hideTag(node) {
    if (node.el.style.display !== 'none') node.el.style.display = 'none';
  }

  // ------------------------------------------------------------------- frame
  function update(dt, time, camera) {
    const busy = isBusy();
    let nTile = 0, nPlate = 0;
    for (const c of list) {
      c.settle = Math.max(0, c.settle - dt);
      c.held = Math.max(0, c.held - dt);

      const far = camera
        ? camera.position.distanceTo(c.group.position) > SITE_RANGE
        : false;

      // ---- what the beam is holding -------------------------------------
      if (!busy && !c.opened) {
        if (c.held <= 0) trackFeet(c, dt);
        // …and asked AGAIN, because `trackFeet` may have just made a claim on
        // this very frame. It froze the reading on the cell that was claimed;
        // reading the live cell here would overwrite it with the reading of
        // the deck square the cadet stepped ONTO, and the beam would answer a
        // cell nobody claimed. Measured in play: a refusal at (1, 8) showed
        // -15.7 degrees, which is (0, 8)'s reading and not (1, 8)'s.
        if (c.held <= 0) {
          if (c.stood) {
            layout(c, c.stood);
            const res = residualAt(c.pose, c.stood[0], c.stood[1]);
            c.want = Math.max(-TILT_MAX, Math.min(TILT_MAX, res * TILT));
          } else {
            layout(c, null);
            c.want = 0;
          }
        }
      } else if (c.opened && !c.showWon) {
        layout(c, null);
        c.want = 0;
      }
      c.rollV += (c.want - c.roll) * 30 * dt;
      c.rollV *= Math.exp(-6 * dt);
      c.roll += c.rollV * dt;
      c.beam.rotation.z = c.roll;

      if (!c.opened) c.markMat.opacity = 0.20 + 0.09 * Math.sin(time * 1.1 + c.i);

      if (far) continue;
      c.group.updateMatrixWorld(true);
      c.beam.updateMatrixWorld(true);

      // ---- the rail and the road ----------------------------------------
      for (const rec of c.railPlates) {
        if (nPlate >= PLATE_MAX) break;
        if (!rec.live && rec.kind !== 'second') {
          // a refused cell is still drawn, dark and dropped: a hole you can see
          const wpos = cellWorld(c, rec.gx, rec.gz);
          _p.set(wpos.x, c.y + rec.dy - 0.55, wpos.z);
          _q.identity();
          _s.set(1, 0.35, 1);
          _m.compose(_p, _q, _s);
          plates.setMatrixAt(nPlate, _m);
          plates.setColorAt(nPlate, OCOL);
          nPlate++;
          continue;
        }
        const wpos = cellWorld(c, rec.gx, rec.gz);
        // Every plate's TOP is the surface the boots actually stand on, and a
        // whole-number reading stands a hand's width proud of the rest of the
        // line — under P.stepUp, so it never blocks a stride, and enough to
        // count from the air. The plate box is PLATE_T tall before scaling.
        const sy = rec.stud ? 1.9 : 0.55;
        const proud = rec.stud ? 0.16 : 0;
        const lift = rec.kind === 'second' ? 0.16 : 0;
        _p.set(wpos.x, c.y + rec.dy + lift - (PLATE_T / 2) * sy + proud, wpos.z);
        _q.identity();
        _s.set(1, sy, 1);
        _m.compose(_p, _q, _s);
        plates.setMatrixAt(nPlate, _m);
        const lit = c.chain.has(`${rec.gx},${rec.gz}`);
        plates.setColorAt(nPlate, rec.kind === 'second' ? RCOL
          : (lit ? WCOL : (rec.stud ? SCOL : PCOL)));
        nPlate++;
      }
      for (const rec of c.roadPlates) {
        if (nPlate >= PLATE_MAX) break;
        const wpos = cellWorld(c, rec.gx, rec.gz);
        _p.set(wpos.x, c.y + rec.dy - PLATE_T / 2, wpos.z);
        _q.identity();
        _s.set(1, 1, 1);
        _m.compose(_p, _q, _s);
        plates.setMatrixAt(nPlate, _m);
        plates.setColorAt(nPlate, PCOL);
        nPlate++;
      }

      // ---- the pans ------------------------------------------------------
      for (const tl of c.load) {
        if (nTile >= TILE_MAX) break;
        const sz = tl.kind === 'unit' ? 0.48 : 0.94;
        _p.set(tl.x, tl.y, tl.z).applyMatrix4(c.beam.matrixWorld);
        _q.setFromRotationMatrix(c.beam.matrixWorld);
        _s.set(sz, tl.kind === 'y' ? sz * 0.52 : sz, sz);
        _m.compose(_p, _q, _s);
        tiles.setMatrixAt(nTile, _m);
        tiles.setColorAt(nTile, tl.kind === 'x' ? XCOL : (tl.kind === 'y' ? YCOL : UCOL));
        nTile++;
      }

      // ---- said once, ever, on the first plot a cadet ever stands on -----
      if (!saidFirst && !busy && c.stood && !c.opened) {
        saidFirst = true;
        save();
        hud?.flash?.(t('field.meetFirst'), '');
      }
    }
    tiles.count = nTile;
    plates.count = nPlate;
    tiles.instanceMatrix.needsUpdate = true;
    plates.instanceMatrix.needsUpdate = true;
    if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
    if (plates.instanceColor) plates.instanceColor.needsUpdate = true;
    if (camera) placeTags(camera, time);
  }

  // -------------------------------------------------------------------- save
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem('ascent.meet') || '{}') || {};
      return { opened: raw.opened || {}, said: !!raw.said };
    } catch { return { opened: {}, said: false }; }
  }
  function save() {
    const o = {};
    for (const c of list) if (c.opened) o[c.key] = 1;
    try { localStorage.setItem('ascent.meet', JSON.stringify({ opened: o, said: saidFirst })); }
    catch { /* private mode */ }
  }

  return {
    update,
    relocalise: rebuildTags,
    /** RESONANT SIGHT: read a plot's statements from further out. */
    setSight(on) { sight = !!on; },
    list,
    /** The kind, not the instances — hang another anywhere. */
    plot,
    state: () => ({
      total: list.length,
      opened: list.filter((c) => c.opened).length,
      solids: list.reduce((n, c) => n + c.deck.length + c.railPlates.length + c.roadPlates.length, 0),
      at: list.map((c) => ({
        key: c.key, x: c.x, y: c.y, z: c.z, opened: c.opened,
        // Where a cell IS, so a critic can walk to one without being told what
        // to walk to. Read-only facts: the plot's own frame, in world metres.
        origin: cellWorld(c, 0, 0),
        ex: (() => { const a = cellWorld(c, 0, 0), b = cellWorld(c, 1, 0); return { x: b.x - a.x, z: b.z - a.z }; })(),
        ez: (() => { const a = cellWorld(c, 0, 0), b = cellWorld(c, 0, 1); return { x: b.x - a.x, z: b.z - a.z }; })(),
        railY: RAIL_Y, plot: PLOT, ribbon: c.railCells,
        band: c.pose.band, kind: c.pose.kind, skill: c.pose.skill,
        eqA: c.pose.eqA, eqB: c.pose.eqB,
        rail: c.pose.rail, solution: c.pose.solution,
        spent: [...c.spent], walked: [...c.walked], chain: c.chain.size, arm: ARM,
        stood: c.stood, left: c.left, right: c.right,
        roll: Number(c.roll.toFixed(4)),
        road: c.roadPlates.length,
      })),
    }),
    reset() {
      try { localStorage.removeItem('ascent.meet'); } catch { /* private mode */ }
    },
  };
}
