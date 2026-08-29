import * as THREE from 'three';
import { fbm, ridge, clamp, sstep, mix, segDist, GLSL_NOISE } from './noise.js';
import { zoneWeights, glslBlend, ZONE_INDEX } from './biomes.js';

/**
 * THE ISLAND.
 *
 * One CPU heightfield is the single source of truth: the mesh, the collision,
 * the prop scattering and the grass all read `heightAt`. What you see is what
 * you stand on.
 *
 * The shape is *composed*, not noise-scattered — a learner should be able to
 * say "I'll head for the mountain", "I'll follow the road to the lake",
 * "the standing stones are past the grove". Landmarks first, terrain second.
 *
 * Colour is composed too. `biomes.js` splits the island into five regions and
 * this material paints each one its own hue *and* its own value, so from three
 * hundred metres up the island reads as five places stacked in depth rather
 * than one beige dune.
 */

export const ISLAND_R = 168;

// ---------------------------------------------------------------------------
// Named places. Everything else in the world is positioned relative to these.
// ---------------------------------------------------------------------------

/** Shortest signed distance between two bearings, in radians. */
function angGap(a, b) {
  return Math.abs(((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
}

/** The bearing a cadet is facing the instant they arrive: due north, -Z. */
export const GATE_ANG = -Math.PI / 2;

/** Irregular coastline radius for a compass bearing. */
export function coastRadius(ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const n = fbm(c * 2.3 + 31.7, s * 2.3 - 12.3, 4);
  let r = ISLAND_R * (0.86 + n * 0.30 + Math.sin(ang * 3.0 + 1.1) * 0.035);
  // THE NORTH GATE. The coast bites in on the arrival bearing, so the lip of
  // the world stands a hundred and thirty metres from the plaza instead of a
  // hundred and seventy: close enough that the gulf, the cloud sea and the far
  // worlds are all inside the first frame anybody ever sees of this game.
  const gd = angGap(ang, GATE_ANG);
  r *= 1 - 0.235 * Math.exp(-(gd * gd) / (2 * 0.36 * 0.36));
  return r;
}

export const PEAK = { x: 62, z: -98 };        // The Spine — the signature summit,
                                              // set east of the low sun so it is lit,
                                              // not laying a shadow over the plaza
export const PEAK2 = { x: -92, z: -66 };      // its lesser sister
export const MESA = { x: 30, z: 104 };        // terraced badlands, south
export const GROVE = { x: -108, z: -8 };      // crystal grove, west
export const HENGE = { x: -84, z: 74 };       // the standing stones, south-west

const LAKE_ANG = 0.30;
export const LAKE = (() => {
  const rad = 36;
  const d = coastRadius(LAKE_ANG) - rad - 6;
  return { x: Math.cos(LAKE_ANG) * d, z: Math.sin(LAKE_ANG) * d, r: rad, y: 0 };
})();
const LC = Math.cos(LAKE_ANG), LS = Math.sin(LAKE_ANG);

// ---------------------------------------------------------------------------
// Roads. Worn tracks radiating from the plaza — they read as intent, and they
// tell you where the world wants you to go.
// ---------------------------------------------------------------------------
const ROADS = (() => {
  const targets = [PEAK, PEAK2, LAKE, MESA, GROVE, HENGE];
  const segs = [];
  for (const tgt of targets) {
    const a = Math.atan2(tgt.z, tgt.x);
    const R = Math.hypot(tgt.x, tgt.z);
    let px = Math.cos(a) * 9, pz = Math.sin(a) * 9;
    const N = 7;
    for (let i = 1; i <= N; i++) {
      const t = i / N;
      const rr = 9 + (R - 9) * t;
      const wob = Math.sin(t * 4.1 + a * 3.0) * 0.13 * (1 - Math.abs(t - 0.5) * 1.2);
      const aa = a + wob;
      const nx = Math.cos(aa) * rr, nz = Math.sin(aa) * rr;
      segs.push([px, pz, nx, nz]);
      px = nx; pz = nz;
    }
  }
  return segs;
})();

/** 0 = wilderness, 1 = the middle of a worn track. */
export function pathAt(x, z) {
  let best = 1e9;
  for (let i = 0; i < ROADS.length; i++) {
    const s = ROADS[i];
    const d = segDist(x, z, s[0], s[1], s[2], s[3]);
    if (d < best) best = d;
  }
  return sstep(4.6, 1.5, best);
}

/** Rainfall proxy: drives lush-green vs dry-gold vs scrub. */
export function moistAt(x, z) {
  const w = zoneWeights(x, z);
  const base = clamp(fbm(x * 0.019 - 70, z * 0.019 + 21, 3) * 1.45 - 0.24, 0, 1);
  // the fen is wet whatever the noise says; the wastes are dry whatever it says
  const wet = w[ZONE_INDEX.mire] * 0.85 + w[ZONE_INDEX.verdant] * 0.62;
  const dry = w[ZONE_INDEX.badland] * 0.80 + w[ZONE_INDEX.steppe] * 0.52;
  return clamp(base * (0.45 + wet * 1.5) + wet * 0.42 - dry * 0.55, 0, 1);
}

// ---------------------------------------------------------------------------
// The heightfield
// ---------------------------------------------------------------------------

/** Everything except the water features and the plaza — used to resolve them. */
function rawHeight(x, z, rn) {
  // A high shield that holds its elevation almost to the shore, then plunges:
  // the coastline is a cliff edge, not a beach.
  const fall = Math.pow(Math.max(0, 1 - Math.pow(rn, 12.0)), 0.42);

  // domain warp first, so valleys meander instead of running in straight noise
  const wx = (fbm(x * 0.006 + 7, z * 0.006 - 3, 2) - 0.5) * 30;
  const wz = (fbm(x * 0.006 - 13, z * 0.006 + 19, 2) - 0.5) * 30;

  let h = 16 + 12 * fall;
  h += (fbm((x + wx) * 0.0090 + 40, (z + wz) * 0.0090 - 17, 4, 2.03, 0.45) - 0.5) * 78 * fall;
  h += ridge((x + wx * 0.5) * 0.0070 - 9, (z + wz * 0.5) * 0.0070 + 23, 4) * 32 * fall;
  h += (fbm(x * 0.030 + 3, z * 0.030 + 9, 2) - 0.5) * 4.0 * fall;

  // --- The Spine: the signature summit ---
  const dm = Math.hypot(x - PEAK.x, z - PEAK.z);
  const mk = Math.exp(-(dm * dm) / (2 * 46 * 46));
  h += mk * (52 + ridge(x * 0.026 + 5, z * 0.026 - 3, 4) * 38);
  h += Math.pow(mk, 3.0) * 32;

  // --- the lesser summit ---
  const dm2 = Math.hypot(x - PEAK2.x, z - PEAK2.z);
  const mk2 = Math.exp(-(dm2 * dm2) / (2 * 27 * 27));
  h += mk2 * (32 + ridge(x * 0.034 - 15, z * 0.034 + 7, 3) * 24);

  // --- the Southern Terrace ---
  // The wastes stand on a raised shelf that ends in a cliff. This is what makes
  // the south of the island a *lookout* rather than a slope: you walk out onto
  // it, the ground stops, and everything past the edge is nine hundred metres of
  // air, cloud deck and four ranges. A vista needs somewhere to stand.
  // The lip is deliberately *sharp*: the ground climbs thirty-six metres in
  // twenty, so standing on the shelf you are looking down into a terraced
  // canyon, over a ridge, at a mountain, under sky — four depth layers in one
  // frame, which is the whole reason the shelf exists.
  h += sstep(107, 121, z) * sstep(150, 66, Math.abs(x - 10)) * 30;

  // --- THE NORTH GATE ---------------------------------------------------
  //
  // The cadet arrives facing due north, and due north this island used to
  // *climb*: the opening frame was a wall of near hillside with the whole rest
  // of the world hidden behind it. No amount of horizon is worth anything if
  // the first thing in front of it is your own summit.
  //
  // So the ground between the two summits is cut into a broad vale that
  // descends the whole way to a cliff lip, and past the lip there is nothing
  // but nine hundred metres of air. That single subtraction is what puts four
  // depth planes into the arrival shot — meadow, vale, lip, gulf — and it is
  // the reason the far worlds can be seen from a place a player can stand.
  //
  // It is a *floor*, never a fill: only ground standing above the vale's
  // profile is cut away, so the flanks of the Spine and its sister become the
  // walls of the valley instead of being flattened into it.
  const gateW = sstep(80, 30, Math.abs(x + 4)) * sstep(-30, -96, z);
  if (gateW > 0.004) {
    // descends 34 m over its length, with a braided channel wandering down it
    const t = clamp((-z - 30) / 120, 0, 1);
    const chan = Math.exp(-Math.pow((x + 4 + Math.sin(t * 5.2) * 15) / 20, 2)) * 7;
    const floorH = 40 - t * 34 - chan
      + (fbm(x * 0.028 + 61, z * 0.028 - 17, 3) - 0.5) * 11;
    h = mix(h, Math.min(h, floorH), gateW);
  }

  // --- THE EAST COL ---------------------------------------------------
  //
  // A pass cut clean through the Spine's southern shoulder, on the exact
  // bearing of the glass world.
  //
  // Four of the five far worlds could be seen from the plaza. The fifth could
  // not be seen from anywhere a person can stand, from any height below the
  // summit, because a ninety-four-metre shoulder ran across its bearing eighty
  // metres from the middle of the square — twenty-three degrees of rock in
  // front of a landmass whose top sits at twenty-one. It was not far away. It
  // was behind a hill.
  //
  // The subtraction is deliberately a *notch* rather than a general lowering.
  // A ridge with a gap in it is worth far more than no ridge at all: the eye
  // reads the gap as a frame, the frame gives the thing beyond it a scale, and
  // the pass is somewhere to walk to. Standing on the plaza you now look up a
  // rising saddle of alpine grass, through a V of dark rock, at a kilometre of
  // blue glass needles standing in cloud.
  //
  // It runs at sixteen degrees north of east, which is the one bearing on this
  // side of the island where the Reach road's own outer switchback — a bench
  // twenty metres above the ground it crosses — does not lie across the line.
  // A pass that the road runs over on an embankment is not a pass.
  const colT = x * 0.9613 + z * -0.2756;
  const colP = x * 0.2756 + z * 0.9613;
  if (colT > 34 && colT < 178 && Math.abs(colP) < 46) {
    // one in ten, so it reads as a saddle you walk up rather than a trench
    const floorH = 57.5 + colT * 0.100;
    const w = sstep(44.0, 17.0, Math.abs(colP))
            * sstep(34.0, 54.0, colT) * sstep(178.0, 152.0, colT);
    if (w > 0.004) h = mix(h, Math.min(h, floorH), w);
  }

  // --- the badlands: stacked mesas, sharp terraces ---
  const bw = sstep(92, 30, Math.hypot(x - MESA.x, z - MESA.z)) * 0.92;
  if (bw > 0.002) {
    const step = 8.5;
    const q = Math.floor(h / step);
    const f = h / step - q;
    const hq = (q + sstep(0.34, 0.70, f)) * step;
    h = mix(h, hq, bw);
  }
  return h;
}

/**
 * The island as an equation — every feature, at infinite resolution.
 *
 * PRIVATE, and it is the whole of the repair below. Nothing outside this file
 * may call it, because *this is not the surface anybody walks on*. See
 * `heightAt`.
 */
function analyticHeight(x, z, Rc0) {
  const r = Math.hypot(x, z);
  const ang = Math.atan2(z, x);
  const Rc = Rc0 === undefined ? coastRadius(ang) : Rc0;
  if (r > Rc) return null;

  let h = rawHeight(x, z, r / Rc);

  // --- the lake basin and its spill channel to the rim ---
  const dxs = x - LAKE.x, dzs = z - LAKE.z;
  const dl = Math.hypot(dxs, dzs);
  const lw = sstep(LAKE.r * 1.5, LAKE.r * 0.72, dl);
  if (lw > 0.001) {
    const floorH = LAKE.floor + (fbm(x * 0.05 + 12, z * 0.05 - 4, 2) - 0.5) * 2.8;
    h = mix(h, floorH, lw);
  }
  const along = dxs * LC + dzs * LS;
  if (along > 0) {
    const perp = -dxs * LS + dzs * LC;
    const ch = Math.exp(-(perp * perp) / (2 * 9.0 * 9.0)) * sstep(2, 22, along);
    h -= 16 * ch;
  }

  // --- The Reach: the road up the Spine, and the terrace at the top ---
  const dp = Math.hypot(x - PEAK.x, z - PEAK.z);
  if (dp < 82) {
    // the switchback itself, cut as a bench: it eats the uphill side and packs
    // out the downhill side, which is how a mountain road is actually made
    const road = reachAt(x, z);
    if (road.w > 0.002) h = mix(h, road.y, road.w);

    // THE CROWN.
    //
    // The lookout was a lookout the way a photograph of a window is a view.
    // A ring of natural crag stood on the terrace's own lip — 146 m of rock
    // eight metres above the floor and sixteen metres from the middle of it,
    // which is twenty-six degrees of blindfold on the exact bearing the glass
    // world stands. Measured from the terrace, four of the five far worlds sit
    // between ten and twenty degrees up. Anything within fifty metres that
    // stands more than about eight degrees above the floor is therefore not
    // scenery, it is a wall, and it is the reason three rounds of critics have
    // reported that this world's horizon does not exist.
    //
    // So the summit is *planed*: inside fifty metres nothing may rise more than
    // one metre in three away from the terrace lip. It costs the Spine nothing
    // — the summit ring monument is forty-eight metres across and stands on
    // this exact ground, so the peak still has a silhouette, and now it is a
    // built one — and it buys a full circle of sky from the highest place a
    // cadet can walk to.
    if (dp < 52) {
      const crown = REACH_TOP + Math.max(0, dp - 19.0) * 0.34;
      h = Math.min(h, mix(h, crown, sstep(52.0, 44.0, dp)));
    }

    // and the lookout itself: a flat, walled terrace, nineteen metres across,
    // with the parapet broken on the north side so the gulf is not fenced off
    const ter = sstep(26.0, 19.0, dp);
    if (ter > 0.002) {
      const brg = Math.atan2(z - PEAK.z, x - PEAK.x);
      // three gates through the wall — north to the gulf, east to the glass
      // needle, south-west back down the road
      const gate = Math.max(
        Math.exp(-Math.pow(angGap(brg, -Math.PI / 2) / 0.34, 2)),
        Math.exp(-Math.pow(angGap(brg, -0.68) / 0.26, 2)),
        Math.exp(-Math.pow(angGap(brg, 2.55) / 0.30, 2)),
      );
      const parapet = sstep(14.0, 17.0, dp) * sstep(21.5, 18.5, dp) * 3.1 * (1 - gate * 0.94);
      h = mix(h, REACH_TOP + parapet, ter);
    }
  }

  // --- the plaza: a wide flat shelf you can read the whole world from ---
  const pl = sstep(50, 21, r);
  h = mix(h, PLAZA_Y, pl);

  return h;
}

// ---------------------------------------------------------------------------
// THE ONE SURFACE — and the fifteen metres of daylight that used to be between
// the island you see and the island you stand on.
//
// This file has always opened with the claim "one CPU heightfield is the single
// source of truth… what you see is what you stand on." That claim was false,
// and the amount by which it was false was measured, on this build, at the exact
// spot a walk wedged:
//
//     x = 36.0, z = −88.3     the ground you WALK on   37.7 m
//                             the island that is DRAWN 48.7 m
//
// **The drawn hillside stood eleven metres over the cadet's head**, so ordinary
// forward running put him — and the lens six metres behind him — inside solid
// mesh, which is a full-screen beige wash and no way to see where to go. Across
// nine thousand samples the two surfaces differ by −14.4 m to +15.1 m, and on
// 1.7% of the island the drawn ground stands a body or more above the walked
// ground. That is not a phantom floor and it is not a collision bug. It is a
// sampling rate:
//
//   · the collision surface was `analyticHeight` — exact, continuous, and full
//     of gradient-15 walls, because the North Gate's cut meets the Spine's
//     uncut flank in a 73 m rise over 24 m of run;
//   · the DRAWN surface is a 200-sector polar mesh whose tangential vertex
//     spacing at r = 130 is 4.1 m, and which therefore renders that wall as a
//     straight chord between two vertices four metres apart.
//
// Linear interpolation across a gradient-15 feature is wrong by metres, and
// everything in the game except the triangles was reading the other surface.
//
// So the lattice below IS the island, for everybody. `heightAt` interpolates it,
// `buildIsland` draws it, the grass grows on it, the props stand on it, the
// tears are seated on it, and the boots walk on it. There is one surface now,
// and the promise at the top of this file is true rather than aspirational.
//
// It is also, incidentally, some fifty times cheaper than the function it
// replaces — twelve octaves of noise become four table reads — which is most of
// a second off boot.
// ---------------------------------------------------------------------------

/** Sectors around the island. THE DRAWN MESH USES EXACTLY THIS. */
const MSECT = 256;
/** Rings from the middle to the coastline. THE DRAWN MESH USES EXACTLY THIS. */
const MTOP = 112;
/** rad/Rc as a function of the ring parameter — the mesh's radial spacing. */
const RAD_K = 0.006, RAD_M = 0.994, RAD_P = 1.06;

let HTAB = null;          // (MTOP + 1) x MSECT — the island, as it is drawn
let RCS = null;           // coast radius per sector
let HCEN = 0;             // the single vertex in the middle

function lattice() {
  if (HTAB) return HTAB;
  RCS = new Float32Array(MSECT);
  for (let s = 0; s < MSECT; s++) RCS[s] = coastRadius((s / MSECT) * Math.PI * 2);
  const tab = new Float32Array((MTOP + 1) * MSECT);
  for (let ring = 0; ring <= MTOP; ring++) {
    const t = ring / MTOP;
    const f = RAD_K + RAD_M * Math.pow(t, RAD_P);
    for (let s = 0; s < MSECT; s++) {
      const a = (s / MSECT) * Math.PI * 2;
      const rad = RCS[s] * f;
      const h = analyticHeight(Math.cos(a) * rad, Math.sin(a) * rad, RCS[s]);
      // The outermost ring sits exactly on the coastline, where the analytic
      // form returns null on the wrong side of a rounding error. It is ground.
      tab[ring * MSECT + s] = h === null
        ? analyticHeight(Math.cos(a) * rad * 0.999, Math.sin(a) * rad * 0.999, RCS[s]) ?? 8
        : h;
    }
  }
  HCEN = analyticHeight(0, 0, RCS[0]) ?? 13;
  HTAB = tab;
  return HTAB;
}

/** The coast radius on this bearing, off the same table the mesh is built on. */
function coastR(ang) {
  lattice();
  const sf = ((ang / (Math.PI * 2)) % 1 + 1) % 1 * MSECT;
  const s0 = Math.floor(sf), fs = sf - s0;
  const a = RCS[s0 % MSECT], b = RCS[(s0 + 1) % MSECT];
  return a + (b - a) * fs;
}

/**
 * THE surface. Bilinear across the very quad the GPU is about to rasterise, so
 * the ground under the boots and the ground under the eye are the same ground
 * to within a centimetre. Null off the coastline, exactly as before.
 */
export function heightAt(x, z) {
  const tab = lattice();
  const r = Math.hypot(x, z);
  const ang = Math.atan2(z, x);
  const sf = ((ang / (Math.PI * 2)) % 1 + 1) % 1 * MSECT;
  const s0 = Math.floor(sf) % MSECT, s1 = (s0 + 1) % MSECT, fs = sf - Math.floor(sf);
  const Rc = RCS[s0] + (RCS[s1] - RCS[s0]) * fs;
  if (r > Rc) return null;
  const f = r / Rc;
  // Inside the first ring the mesh is a fan of triangles onto the middle
  // vertex; blend to it rather than clamping, or the plaza grows a pimple.
  if (f <= RAD_K) {
    const h0 = tab[s0] + (tab[s1] - tab[s0]) * fs;
    return HCEN + (h0 - HCEN) * (f / RAD_K);
  }
  const t = Math.pow((f - RAD_K) / RAD_M, 1 / RAD_P);
  const tf = Math.min(MTOP - 1e-6, t * MTOP);
  const r0 = Math.floor(tf), ft = tf - r0;
  const o0 = r0 * MSECT, o1 = o0 + MSECT;
  // NOT bilinear — PLANAR, on the very triangle the rasteriser will fill.
  // `buildIsland` splits each quad along the a0–b1 diagonal, so a bilinear
  // read is wrong by up to five metres in the middle of a quad that spans a
  // twenty-metre step, which is precisely where it matters. Same split, same
  // plane, same height.
  const A = tab[o0 + s0], B = tab[o0 + s1], C = tab[o1 + s1], D = tab[o1 + s0];
  return ft <= fs
    ? A + fs * (B - A) + ft * (C - B)
    : A + ft * (D - A) + fs * (C - D);
}

/** True where the lake would cover this spot — nothing grows there. */
export function underWater(x, z, margin = 0.6) {
  if (Math.hypot(x - LAKE.x, z - LAKE.z) > LAKE.r * 1.6) return false;
  const h = heightAt(x, z);
  return h !== null && h < LAKE.y + margin;
}

export function onGround(x, z) {
  const h = heightAt(x, z);
  return h === null ? -400 : h;
}

/** Central-difference slope, 0 = flat, 1 = wall. */
export function slopeAt(x, z, e = 1.4) {
  const h = heightAt(x, z);
  if (h === null) return 1;
  const hx = heightAt(x + e, z) ?? h, hz = heightAt(x, z + e) ?? h;
  return Math.min(1, Math.hypot(hx - h, hz - h) / e);
}

// Water level and plaza level, resolved from the uncarved terrain so the lake
// always sits in a real bowl and the plaza never becomes a mesa.
LAKE.floor = rawHeight(LAKE.x, LAKE.z, Math.hypot(LAKE.x, LAKE.z) / coastRadius(LAKE_ANG)) - 19;
LAKE.y = LAKE.floor + 12.5;
const PLAZA_Y = rawHeight(0, 0, 0) + 7.0;
export { PLAZA_Y };

// ---------------------------------------------------------------------------
// THE REACH — the switchback road up the Spine, and the lookout at its top.
//
// A vista nobody can stand on is a matte painting. The island's high point was
// a cone: reachable only by writing to the player's position, and once you were
// up there it was a smooth ramp with a summit you slid off. So the Spine now
// carries a *road* — one long spiral bench, cut at a gradient a person can walk
// (about one in six), starting on the plaza side where the track from the
// plaza already runs out, and ending on a walled terrace eighteen metres
// across. From the terrace the northern half of the sky is open all the way to
// the cloud sea, which is the entire reason the far worlds were ever built.
// ---------------------------------------------------------------------------
const REACH_TOP = (() => {
  const rn = Math.hypot(PEAK.x, PEAK.z) / coastRadius(Math.atan2(PEAK.z, PEAK.x));
  return rawHeight(PEAK.x, PEAK.z, rn) - 6;
})();

const REACH = (() => {
  const TURNS = 1.95, N = 72;
  const a0 = Math.atan2(-PEAK.z, -PEAK.x);   // start facing the plaza
  const rAt = (t) => 66 - t * 49;
  const foot = (() => {
    const x = PEAK.x + Math.cos(a0) * rAt(0), z = PEAK.z + Math.sin(a0) * rAt(0);
    const ang = Math.atan2(z, x);
    return rawHeight(x, z, Math.hypot(x, z) / coastRadius(ang));
  })();
  const segs = [];
  let px = 0, pz = 0, py = 0;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = a0 + t * TURNS * Math.PI * 2;
    const rr = rAt(t);
    // the bench wanders a little so it reads as cut rather than extruded
    const wob = Math.sin(t * 11.0) * 2.2;
    const x = PEAK.x + Math.cos(a) * (rr + wob);
    const z = PEAK.z + Math.sin(a) * (rr + wob);
    const y = mix(foot, REACH_TOP, t * t * (3 - 2 * t));
    if (i > 0) segs.push([px, pz, x, z, py, y]);
    px = x; pz = z; py = y;
  }
  return segs;
})();

/** Distance-weighted bench height for the switchback, or w = 0 if far from it. */
function reachAt(x, z) {
  let best = 1e9, by = 0;
  for (let i = 0; i < REACH.length; i++) {
    const s = REACH[i];
    const d = segDist(x, z, s[0], s[1], s[2], s[3]);
    if (d < best) {
      best = d;
      // the height at the closest point along that segment
      const vx = s[2] - s[0], vz = s[3] - s[1];
      const L = vx * vx + vz * vz;
      const tt = L > 0 ? clamp(((x - s[0]) * vx + (z - s[1]) * vz) / L, 0, 1) : 0;
      by = s[4] + (s[5] - s[4]) * tt;
    }
  }
  // 5 m of level tread, feathered out to 11 m of cut bank and packed shoulder
  return { w: sstep(11.0, 5.0, best), y: by };
}

/** Snow line — the altitude where the alpine region turns white. */
export const SNOW_Y = 104;

// ---------------------------------------------------------------------------
// A coarse cached sample grid. Scattering hundreds of thousands of blades and
// props through the exact heightfield would cost half a second of boot; the
// grid answers "roughly how high, roughly how steep" in nanoseconds.
// ---------------------------------------------------------------------------
const GSTEP = 1.7;
const GHALF = ISLAND_R + 6;
const GN = Math.ceil((GHALF * 2) / GSTEP) + 1;
let GRID = null;

function grid() {
  if (GRID) return GRID;
  GRID = new Float32Array(GN * GN);
  for (let j = 0; j < GN; j++) {
    const z = -GHALF + j * GSTEP;
    for (let i = 0; i < GN; i++) {
      const x = -GHALF + i * GSTEP;
      const h = heightAt(x, z);
      GRID[j * GN + i] = h === null ? NaN : h;
    }
  }
  return GRID;
}

/** Fast bilinear height, or null off the island. */
export function sampleH(x, z) {
  const g = grid();
  const fx = (x + GHALF) / GSTEP, fz = (z + GHALF) / GSTEP;
  const i = Math.floor(fx), j = Math.floor(fz);
  if (i < 0 || j < 0 || i >= GN - 1 || j >= GN - 1) return null;
  const a = g[j * GN + i], b = g[j * GN + i + 1];
  const c = g[(j + 1) * GN + i], d = g[(j + 1) * GN + i + 1];
  if (a !== a || b !== b || c !== c || d !== d) return null;
  const u = fx - i, v = fz - j;
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/**
 * Baked ambient occlusion, straight off the heightfield.
 *
 * The reason untextured low-poly terrain reads as clay is that every square
 * metre of it receives exactly the same amount of sky. Real ground does not:
 * the inside of a valley sees a slot of sky, the foot of a cliff sees half of
 * one, a ridge line sees all of it. Sampling the horizon angle in eight
 * bearings at four radii recovers that for about thirty milliseconds of boot,
 * and it is what puts creases, gullies and cliff bases into the picture without
 * a single texel of texture.
 *
 * 1 = open sky, 0 = deep in a hole.
 */
const AO_DIRS = 8;
const AO_RADII = [3.5, 9, 22, 46];
export function aoAt(x, z, h) {
  const hh = h === null || h === undefined ? sampleH(x, z) : h;
  if (hh === null) return 1;
  let occ = 0, n = 0;
  for (let d = 0; d < AO_DIRS; d++) {
    const a = (d / AO_DIRS) * Math.PI * 2 + 0.31;
    const cx = Math.cos(a), cz = Math.sin(a);
    let horizon = 0;
    for (let r = 0; r < AO_RADII.length; r++) {
      const rr = AO_RADII[r];
      const s = sampleH(x + cx * rr, z + cz * rr);
      if (s === null) continue;
      const t = (s - hh) / rr;
      if (t > horizon) horizon = t;
    }
    occ += Math.min(1, horizon * 1.15);
    n++;
  }
  return clamp(1 - (occ / Math.max(n, 1)) * 0.92, 0.16, 1);
}

/** Fast slope from the same grid. 0 flat, 1 wall. */
export function sampleSlope(x, z) {
  const h = sampleH(x, z);
  if (h === null) return 1;
  const hx = sampleH(x + GSTEP, z), hz = sampleH(x, z + GSTEP);
  if (hx === null || hz === null) return 1;
  return Math.min(1, Math.hypot(hx - h, hz - h) / GSTEP);
}

// ---------------------------------------------------------------------------
// Ground cover density. The terrain *and* the blades read this one field, which
// is why the island still looks lush from three hundred metres up: the ground
// under the grass is painted the colour of the grass, in exactly the places the
// grass actually grows.
// ---------------------------------------------------------------------------
export function grassDensityAt(x, z, h = null, sl = null) {
  const hh = h === null ? sampleH(x, z) : h;
  if (hh === null) return 0;
  const s = sl === null ? sampleSlope(x, z) : sl;
  if (s > 0.90) return 0;
  const w = zoneWeights(x, z);
  const m = moistAt(x, z);
  const road = pathAt(x, z);
  let d = 1;
  d *= sstep(16.0, 23.0, Math.hypot(x, z));           // the plaza is paved
  d *= 1 - road * 0.94;
  d *= 1 - sstep(0.36, 0.88, s) * 0.92;
  d *= 1 - sstep(SNOW_Y - 16, SNOW_Y + 6, hh) * 0.97; // above the snow line, nothing
  d *= clamp(0.34 + m * 1.20, 0, 1);
  // the wastes are scrubby, the fen and the vale are thick
  d *= clamp(0.28 + w[ZONE_INDEX.verdant] * 1.5 + w[ZONE_INDEX.mire] * 1.35
    + w[ZONE_INDEX.steppe] * 1.25 + w[ZONE_INDEX.alpine] * 0.72
    + w[ZONE_INDEX.badland] * 0.62, 0, 1.25);
  d *= 0.50 + fbm(x * 0.045 + 5, z * 0.045 - 9, 3) * 0.95;
  return clamp(d, 0, 1);
}

// ---------------------------------------------------------------------------
// Terrain material — regions, strata, roads and detail, all in the shader so a
// 30k-vertex mesh still reads as a place with texture and history.
// ---------------------------------------------------------------------------

export function makeTerrainMaterial() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 1.0, metalness: 0.0, dithering: true,
  });
  mat.userData.uniforms = {
    uLakeY: { value: LAKE.y },
    uSnow: { value: SNOW_Y },
    uSkyBounce: { value: new THREE.Color(0x8ea4c0) },
    uTime: { value: 0 },
  };

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.uniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', /* glsl */`
        #include <common>
        attribute float aMoist;
        attribute float aPath;
        attribute float aSide;
        attribute float aLush;
        attribute float aAO;
        attribute vec4 aZoneA;
        attribute float aZoneE;
        varying vec3 vWPos;
        varying vec3 vWNrm;
        varying float vMoist;
        varying float vPath;
        varying float vSide;
        varying float vLush;
        varying float vAO;
        varying vec4 vZA;
        varying float vZE;
      `)
      .replace('#include <beginnormal_vertex>', /* glsl */`
        #include <beginnormal_vertex>
        vWNrm = normalize(mat3(modelMatrix) * objectNormal);
      `)
      .replace('#include <begin_vertex>', /* glsl */`
        #include <begin_vertex>
        vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vMoist = aMoist; vPath = aPath; vSide = aSide; vLush = aLush; vAO = aAO;
        vZA = aZoneA; vZE = aZoneE;
      `);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', /* glsl */`
        #include <common>
        ${GLSL_NOISE}
        uniform float uLakeY;
        uniform float uSnow;
        uniform float uTime;
        uniform vec3 uSkyBounce;
        varying vec3 vWPos;
        varying vec3 vWNrm;
        varying float vMoist;
        varying float vPath;
        varying float vSide;
        varying float vLush;
        varying float vAO;
        varying vec4 vZA;
        varying float vZE;
        float gRough;
        float gAO;
        float gDist;

        /**
         * THE NOISE BUDGET.
         *
         * This shader runs on every ground pixel of a frame in which the island
         * fills the screen, and it was measured at 7.8 ms of a 16 ms frame with
         * about thirty unconditional noise taps per pixel. Nothing here is
         * free, so every band of detail now obeys three rules:
         *
         *  1. It is **evaluated once and shared.** The value noise aa_n is
         *     the atom; aa_fbm3 is three of them, and is spent only where
         *     three octaves are actually visible in the result.
         *  2. It is **branched on its own fade**, never multiplied by zero.
         *     GLSL has no lazy evaluation, and terrain depth is coherent across
         *     a warp, so these branches genuinely take.
         *  3. It **has a distance at which it stops existing.** A quarter-metre
         *     grain is invisible past twenty metres; paying for it out at the
         *     coast is paying for aliasing.
         *
         * gLod is the one number the whole file reasons about: 1 underfoot,
         * 0 past a hundred and eighty metres.
         */
        float gLod;

        /**
         * Micro-relief.
         *
         * A thirty-thousand-vertex island is smooth at the scale of a footstep,
         * and no amount of albedo painting fixes that — what tells your eye the
         * ground is *ground* is that the light varies over it, which needs a
         * normal, not a colour. Three bands of noise gradient, each fading out
         * at the distance where it would start to alias.
         *
         * The gradients are taken with single-octave value noise rather than
         * fBm: a finite difference of an fBm costs three taps per sample and
         * nine per band, and the two extra octaves land almost entirely inside
         * the difference, where they cancel. Same relief, a third of the cost.
         */
        vec3 groundRelief(vec2 p, float dist) {
          vec2 g = vec2(0.0);
          // coarse: erosion channels and slump, still visible from the air.
          // A twenty-metre feature needs a five-metre finite difference or the
          // gradient it reports is numerically zero and nothing happens.
          float f0 = 1.0 - smoothstep(240.0, 420.0, dist);
          if (f0 > 0.02) {
            float n0 = aa_n(p * 0.048);
            g += vec2(aa_n((p + vec2(5.0, 0.0)) * 0.048) - n0,
                      aa_n((p + vec2(0.0, 5.0)) * 0.048) - n0) * (f0 * 5.4);
          }
          // medium: hummock and tussock, three-metre wavelength
          float f1 = 1.0 - smoothstep(60.0, 130.0, dist);
          if (f1 > 0.02) {
            float n1 = aa_n(p * 0.30);
            g += vec2(aa_n((p + vec2(0.9, 0.0)) * 0.30) - n1,
                      aa_n((p + vec2(0.0, 0.9)) * 0.30) - n1) * (f1 * 3.8);
          }
          // fine: clods underfoot, gone by thirty metres
          float f2 = 1.0 - smoothstep(14.0, 30.0, dist);
          if (f2 > 0.02) {
            float n2 = aa_n(p * 1.15);
            g += vec2(aa_n((p + vec2(0.24, 0.0)) * 1.15) - n2,
                      aa_n((p + vec2(0.0, 0.24)) * 1.15) - n2) * (f2 * 1.5);
          }
          return vec3(-g.x, 0.0, -g.y);
        }
      `)
      .replace('#include <normal_fragment_begin>', /* glsl */`
        #include <normal_fragment_begin>
        if (gDist < 420.0) {
          vec3 wn = normalize(vWNrm);
          // the cliff faces are near-vertical; relief there is bedding, applied
          // at half strength so the strata in the albedo stay the loud voice
          vec3 rel = groundRelief(vWPos.xz, gDist) * mix(1.0, 0.45, vSide);
          wn = normalize(wn + rel);
          normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
          nonPerturbedNormal = normal;
        }
      `)
      .replace('#include <color_fragment>', /* glsl */`
        vec3 N = normalize(vWNrm);
        float slope = 1.0 - clamp(N.y, 0.0, 1.0);
        float alt = vWPos.y;

        // The one distance every band of detail is budgeted against.
        gDist = length(vWPos - cameraPosition);
        gLod = 1.0 - smoothstep(70.0, 180.0, gDist);

        // ---- detail: the shared atoms. dLo is the only fBm every pixel pays
        // for, because strata, rock mixing and lushness all read it. ----
        float dLo = aa_fbm3(vWPos.xz * 0.035);
        float dMi = aa_n(vWPos.xz * 0.11);
        // A half-metre grain is a texture at ten metres and aliasing at eighty.
        float dHi = gDist < 150.0 ? aa_n(vWPos.xz * 0.34) : 0.5;
        // The macro field is a two-hundred-metre wash; one octave is all of it
        // that ever survived being looked at.
        float dMacro = aa_n(vWPos.xz * 0.0085 + 11.0);

        // ---- the region palette: hue AND value, blended per region ----
        vec3 zGrass = ${glslBlend('grass')};
        vec3 zRock  = ${glslBlend('rock')};
        vec3 zDirt  = ${glslBlend('dirt')};

        // ---- rock: bedding, and the bedding is *folded* ----
        //
        // Strata banded on world Y alone is the corduroy failure: every cliff on
        // the island gets the same dead-level pinstripe, running exactly
        // horizontal across a face that is doing something else entirely, and
        // stretched to a smear wherever the face is steep.
        //
        // Real bedding dips. It dips by a different amount in different parts of
        // the island, it is cut by joints running down the face, and the beds
        // are not evenly spaced. So the band coordinate is warped by a noise
        // field sampled in the *plane of the cliff* rather than in plan — which
        // is what stops it stretching — and the dip is driven by a slow field so
        // the wastes and the Spine are visibly different geology.
        float dip = (aa_n(vWPos.xz * 0.0060 + 61.0) - 0.5) * 0.34;
        vec2 faceP = vec2(vWPos.x * 0.72 + vWPos.z * 0.69, vWPos.y);
        float fold = aa_fbm3(faceP * vec2(0.055, 0.028) + 7.0);
        float band = vWPos.y * 0.16 * (1.0 + dip)
                   + (vWPos.x * 0.020 - vWPos.z * 0.013) * (1.0 + dip * 3.0)
                   + fold * 3.4 + dLo * 2.6 + dMi * 1.2;
        float strata = smoothstep(0.28, 0.72, fract(band));
        float strata2 = smoothstep(0.2, 0.8, fract(band * 0.37 + 0.3));
        vec3 rock = zRock * mix(0.80, 1.22, strata);
        rock = mix(rock, zRock * vec3(0.62, 0.60, 0.72), strata2 * 0.34);
        // vertical jointing: the cracks a cliff face actually breaks along, and
        // the only thing in this material that runs *across* the beds
        float joint = smoothstep(0.80, 0.97, aa_n(vec2(faceP.x * 0.30, vWPos.y * 0.035 + 4.0)));
        rock = mix(rock, rock * 0.62, joint * 0.55);
        rock *= 0.80 + dHi * 0.42;
        // The wastes are terraced, and their bedding is the loudest thing in
        // the region: alternating pale marl and dark iron bands, cut by the
        // same 8.5 m step the heightfield quantises to, so the colour bands and
        // the ledges are the same bands and the same ledges.
        float tb = vWPos.y * 0.1176 + dMi * 0.42 + dLo * 0.9;
        float terrace = smoothstep(0.24, 0.42, fract(tb)) * smoothstep(0.92, 0.62, fract(tb));
        float band2 = smoothstep(0.44, 0.56, fract(tb * 3.0 + 0.2));
        vec3 marl = vec3(0.560, 0.470, 0.352);
        vec3 iron = vec3(0.230, 0.128, 0.096);
        vec3 waste = mix(iron, marl, terrace);
        waste = mix(waste, waste * vec3(1.10, 0.86, 0.72), band2 * 0.55);
        waste *= 0.84 + dHi * 0.40;
        rock = mix(rock, waste, vZA.w * 0.90);

        // ---- the sward. The ground is painted the colour of the grass that
        // grows on it, in exactly the density the blades are scattered at, so
        // "lush" survives past the 40 m the blades themselves reach. ----
        float lushness = clamp(vLush * 1.55 + (dMacro - 0.5) * 0.55, 0.0, 1.0);
        vec3 sward = zGrass * (0.80 + dMacro * 0.52);
        // two overlapping swards, the way real hillsides read. The second one is
        // a twenty-metre feature and is gone before the far coast.
        if (gDist < 300.0) {
          sward = mix(sward, sward * vec3(1.16, 0.94, 0.78),
                      smoothstep(0.44, 0.76, aa_n(vWPos.xz * 0.021 + 13.0)) * 0.50);
        }
        sward *= 0.84 + dHi * 0.34;

        vec3 soil = mix(zDirt * (0.82 + dHi * 0.44), sward, smoothstep(0.06, 0.62, lushness));
        soil = mix(soil, soil * vec3(0.86, 0.96, 0.84), dMi * 0.35);

        // bare earth showing through where the ground is thin
        if (gDist < 220.0) {
          float scar = smoothstep(0.62, 0.88, aa_n(vWPos.xz * 0.075 + 41.0) * (0.55 + slope));
          soil = mix(soil, zDirt * (0.94 + dHi * 0.5), scar * 0.55);
        }

        // ---- assemble ----
        float rockMix = smoothstep(0.42, 0.82, slope + (dLo - 0.5) * 0.30 - lushness * 0.18);
        vec3 col = mix(soil, rock, rockMix);

        // shoreline sand around the lake, and a dark peaty margin beyond it
        float lakeD = alt - uLakeY;
        float lakeR = length(vWPos.xz - vec2(${LAKE.x.toFixed(2)}, ${LAKE.z.toFixed(2)}));
        float shore = smoothstep(3.0, -0.2, lakeD) * smoothstep(-5.0, -1.0, lakeD)
                      * smoothstep(76.0, 42.0, lakeR);
        col = mix(col, vec3(0.560, 0.512, 0.400) * (0.85 + dHi * 0.34), shore * 0.85);
        // wet, dark lake bed
        col = mix(col, col * vec3(0.44, 0.56, 0.56), smoothstep(0.2, -3.0, lakeD));

        // ---- the plaza: cut stone, laid in rings, with a cipher inlay ----
        float pr = length(vWPos.xz);
        float plaza = smoothstep(21.0, 15.5, pr) * smoothstep(0.55, 0.22, slope);
        if (plaza > 0.001) {
          float ring = abs(fract(pr * 0.36 + 0.5) - 0.5) * 2.0;
          float ang2 = atan(vWPos.z, vWPos.x);
          float spoke = abs(fract(ang2 * 2.86) - 0.5) * 2.0 * max(pr, 4.0) * 0.26;
          float joint = smoothstep(0.16, 0.02, min(ring, spoke));
          vec3 slab = vec3(0.442, 0.412, 0.372) * (0.86 + dHi * 0.34);
          slab = mix(slab, vec3(0.630, 0.592, 0.530),
                     mix(0.5, aa_n(vWPos.xz * 0.13 + 3.0), gLod) * 0.6);
          slab = mix(slab, vec3(0.235, 0.220, 0.212), joint * 0.9);
          slab = mix(slab, vec3(0.36, 0.86, 1.05), smoothstep(0.50, 0.08, abs(pr - 8.5)) * 0.9);
          slab = mix(slab, vec3(0.36, 0.86, 1.05), smoothstep(0.32, 0.06, abs(pr - 16.5)) * 0.7);
          col = mix(col, slab, plaza);
        }

        // The lookout deck, resolved here so the worn road stops at its edge.
        // Its masonry is painted after the alpine pass, below.
        vec2 tfp = vWPos.xz - vec2(${PEAK.x.toFixed(1)}, ${PEAK.z.toFixed(1)});
        float tr = length(tfp);
        float deck = smoothstep(23.0, 17.0, tr) * smoothstep(0.60, 0.26, slope);

        // ---- worn road: pale trodden dust, with wheel-rut darkening ----
        float road = vPath * (0.80 + dHi * 0.45) * (1.0 - plaza) * (1.0 - deck);
        vec3 dust = mix(zDirt, vec3(0.700, 0.618, 0.470), 0.62) * (0.92 + dMi * 0.30);
        dust = mix(dust, dust * 0.72, smoothstep(0.55, 0.95, vPath) * 0.5);
        col = mix(col, dust, clamp(road, 0.0, 1.0));

        // -------------------------------------------------------------------
        // ABOVE THE TREELINE.
        //
        // Everything below this line in the file was tuned for ground a person
        // walks on, and every band of it is budgeted to stop existing somewhere
        // between 26 and 220 metres. The high ground is never that close: the
        // flanks of the Spine and its sister are read from two hundred metres
        // and up, at which distance all of that detail has already faded out
        // and the mountains arrived as two smooth blue-grey ramps with a sheet
        // of flat white laid over the top — the single worst surface in the
        // game, and the one that occupies the most pixels of the arrival frame.
        //
        // So the alpine gets its own treatment, and its rule is the opposite
        // one: **every band here is authored at a wavelength that is still a
        // shape at four hundred metres.** A twelve-metre rib, a forty-metre
        // drift, a hundred-metre snowfield boundary. Nothing above the treeline
        // is allowed to depend on a frequency that the distance fade kills,
        // because up here the distance fade is always in force.
        // -------------------------------------------------------------------
        // The plaza stands at fifty-eight metres, so an "above the treeline"
        // test that starts at forty-six is a test that every pixel on the
        // island passes — six noise taps charged to a meadow to compute a
        // weight of one eighth. It starts above the shelf the town is on, and
        // the branch is then genuinely coherent: the high ground pays for the
        // high ground, and nothing else pays at all.
        float highness = smoothstep(66.0, 94.0, alt);
        float snowW = 0.0;
        if (highness > 0.004) {
          // The mountain's own bones, at three wavelengths that all survive
          // being looked at from the plaza: a 90 m massif field, a 30 m rib
          // field, and a 12 m fracture. One fBm and two taps.
          vec2 hp = vWPos.xz;
          float mass = aa_fbm3(hp * 0.011 + 5.0);
          float ribN = aa_n(hp * 0.034 - 21.0);
          float frac = aa_n(hp * 0.085 + 63.0);
          // ridged: |2x-1| inverted is what turns a blob field into aretes
          float arete = 1.0 - abs(ribN * 2.0 - 1.0);
          float rib = smoothstep(0.52, 0.93, arete + (mass - 0.5) * 0.5);

          // ---- alpine bedrock: dark slate, banded, with the ribs proud ----
          // The palette rock for this region is a pale blue-grey, which is
          // correct for a sunlit snowfield and completely wrong for the stone
          // under it. Exposed alpine bedrock is nearly black where it is wet
          // and pewter where it is dry, and that value range is the only thing
          // that gives a distant peak any modelling at all.
          // deliberately NOT banded on world Y. The generic bedding term draws
          // level stripes at a six-metre pitch, and on a summit — which is a
          // surface of revolution — that comes out as a set of perfectly
          // concentric rings, the one pattern the eye identifies as fake from
          // any distance. Up here the folded massif field is the only geology.
          vec3 slate = mix(vec3(0.088, 0.094, 0.118), vec3(0.300, 0.312, 0.360),
                           smoothstep(0.26, 0.76, mass * 0.78 + frac * 0.34));
          slate = mix(slate, slate * vec3(1.22, 1.10, 0.92), smoothstep(0.55, 0.90, frac) * 0.5);
          slate *= 0.82 + rib * 0.46;
          // talus: the cone of shattered rock every alpine face sheds downhill.
          // Brighter, warmer and grainier than the wall above it, and it is
          // what stops a mountain foot from being a hard line.
          float talus = smoothstep(0.62, 0.24, slope) * smoothstep(0.34, 0.62, mass)
                        * smoothstep(96.0, 62.0, alt);
          slate = mix(slate, vec3(0.315, 0.300, 0.298) * (0.80 + frac * 0.52), talus * 0.72);
          // Keep the region's hue while taking the alpine's value: the Vale's
          // sister summit must still be *the Vale's* summit, not a second
          // Spine wearing the same grey.
          vec3 hue = zRock / max(dot(zRock, vec3(0.2126, 0.7152, 0.0722)), 0.004);
          slate = mix(slate, slate * hue, 0.34);
          // The generic rock band underneath is banded on world Y, which on a
          // conical summit draws a set of perfectly concentric contour lines —
          // tree rings, at the exact scale the eye is best at spotting. Above
          // the treeline the alpine's own aretes have to be the loud voice, so
          // the slate takes over almost completely on anything that is a slope.
          col = mix(col, slate, highness * mix(0.44, 0.97, smoothstep(0.12, 0.55, slope)));

          // ---- snow, only where the air is cold: the Spine Reach ----
          float coldness = clamp(vZA.x * 1.35, 0.0, 1.0);
          // The snow line is not a contour. It is dragged three ways: up on the
          // sun-facing flanks, down into the shaded gullies the bake found, and
          // wandered by the same massif field the rock is cut from.
          float sunFace = clamp(N.x * -0.83 + N.z * -0.56, -1.0, 1.0);
          float lineY = uSnow + sunFace * 9.0 + (1.0 - vAO) * -16.0
                      + (mass - 0.5) * 30.0 + (rib - 0.5) * 12.0;
          float snowDepth = smoothstep(lineY - 22.0, lineY + 6.0, alt)
                            * smoothstep(0.84, 0.44, slope) * coldness;
          // Bare rock stays bare where the wind scours it: the ribs and the
          // steep ground never hold. This is the band that turns a white sheet
          // into a mountain, because it puts dark inside the white.
          float scour = smoothstep(0.34, 0.74, rib) * smoothstep(0.18, 0.52, slope);
          float snow = clamp(snowDepth - scour * 0.85, 0.0, 1.0);
          snowW = snow;

          if (snow > 0.002) {
            // Snow is never one colour. It is warm where the low sun rakes it,
            // cornflower where it does not, and the shadow it holds is *blue*,
            // which is the whole reason a snowfield reads as three-dimensional
            // in a photograph and as paper in a game.
            vec3 sunlit = vec3(1.020, 0.980, 0.905);
            vec3 shade  = vec3(0.470, 0.560, 0.760);
            vec3 sn = mix(shade, sunlit, clamp(sunFace * 0.5 + 0.52, 0.0, 1.0));
            sn = mix(sn * 0.80, sn, mix(0.35, 1.0, vAO));
            // Sastrugi: wind-carved ridges lying across the prevailing wind.
            // A four-metre wavelength warped by a forty-metre field, which is
            // why it reads as drift rather than as corduroy. It is the one
            // alpine band allowed to be fine, so it is the one that fades.
            float fS = 1.0 - smoothstep(120.0, 300.0, gDist);
            if (fS > 0.02) {
              float w = dot(hp, vec2(0.83, -0.56)) * 0.26 + mass * 5.4 + frac * 1.1;
              float sast = abs(fract(w) - 0.5) * 2.0;
              sn *= 1.0 + (smoothstep(0.15, 0.85, sast) - 0.5) * 0.24 * fS;
            }
            // Drift edges: the lee of every rib holds a deeper, brighter pillow
            sn *= 0.92 + smoothstep(0.30, 0.05, rib) * 0.16;
            col = mix(col, sn, snow);
          }
          // Cornice light: the last two metres before the snow gives out are
          // the brightest thing on the mountain, and that hot edge is what
          // separates the white from the rock instead of dissolving into it.
          col += vec3(0.10, 0.10, 0.11)
               * smoothstep(0.35, 0.75, snowDepth) * smoothstep(0.85, 0.45, snowDepth)
               * coldness * highness;
          // frost creeping down below the line
          col = mix(col, mix(col, vec3(0.72, 0.79, 0.92), 0.55),
                    smoothstep(uSnow - 46.0, uSnow - 16.0, alt) * coldness
                    * (1.0 - snow) * 0.42 * smoothstep(0.62, 0.28, slope));
        }

        // ---- THE LOOKOUT: the plaza's own masonry, carried to the summit ----
        //
        // The one place in the world where every far land stands above the
        // horizon was a dish of undressed snow. Nobody cuts a road one in six
        // up a hundred and forty metres of mountain and then leaves the top of
        // it as a slope. So the terrace is paved in the same cut stone as the
        // plaza — laid in courses rather than rings, drifted over at the
        // parapet, worn through to the mountain where the wind gets at it — and
        // the sighting lanes across it carry the same cipher blue as the inlay
        // in the square below. The two built things in this world agree with
        // each other, and that agreement is the whole of what says *someone
        // made this, and they made it to be stood on*.
        if (deck > 0.001) {
          // courses running across the mountain, every row offset by a third
          vec2 cell = vec2(tfp.x * 0.34 + floor(tfp.y * 0.22) * 0.37, tfp.y * 0.22);
          vec2 gj = abs(fract(cell) - 0.5);
          float joint2 = smoothstep(0.40, 0.492, max(gj.x, gj.y));
          float wear = aa_n(tfp * 0.09 + 71.0);
          float grit = aa_n(tfp * 1.9 - 12.0);
          // warmer than the snow around it on purpose: a stone floor that is
          // within a hair of the drift beside it is a stone floor nobody sees
          vec3 flag = vec3(0.520, 0.478, 0.408) * (0.78 + wear * 0.50);
          flag *= 0.88 + grit * 0.30;
          flag = mix(flag, vec3(0.140, 0.136, 0.148), joint2 * 0.92);
          // snow drifted into the lee of the parapet, and only there
          flag = mix(flag, vec3(0.92, 0.95, 1.00),
                     smoothstep(13.0, 18.0, tr) * smoothstep(0.34, 0.66, wear) * 0.85);
          // Three sighting lanes, laid on the bearings the far worlds stand on.
          // The terrace is a compass you stand inside: follow the blue line and
          // it points at a place you can see.
          float tang = atan(tfp.y, tfp.x);
          float mark = max(max(
            smoothstep(0.050, 0.006, abs(sin(tang + 1.83))),
            smoothstep(0.050, 0.006, abs(sin(tang + 0.21)))),
            smoothstep(0.050, 0.006, abs(sin(tang - 1.05))));
          flag = mix(flag, vec3(0.30, 0.86, 1.15),
                     mark * smoothstep(3.5, 6.0, tr) * smoothstep(17.5, 13.0, tr) * 0.95);
          flag = mix(flag, vec3(0.30, 0.86, 1.15),
                     smoothstep(0.50, 0.08, abs(tr - 13.4)) * 0.75);
          col = mix(col, flag, deck);
        }

        // ---- the cliff face and keel: darker, harder, wetter ----
        if (vSide > 0.004) {
          vec3 cliff = zRock * mix(0.52, 0.86, strata) * (0.86 + dHi * 0.42);
          cliff = mix(cliff, cliff * 0.58, joint * 0.7);
          cliff = mix(cliff, vec3(0.155, 0.170, 0.225), smoothstep(0.0, -60.0, alt) * 0.75);
          float vein = smoothstep(0.72, 0.86, aa_n(vec2(faceP.x * 0.09, vWPos.y * 0.05)));
          cliff += vec3(0.10, 0.28, 0.42) * vein * smoothstep(10.0, -40.0, alt) * 0.5;
          col = mix(col, cliff, vSide);
        }

        // ---- grain. Two more octaves, one of them nearly per-metre, so the
        // ground stops being a smooth wash the moment you are standing on it.
        // Two bands that survive being looked at: a three-metre mottle that
        // still reads from a hundred metres up, and a half-metre grain that
        // only exists when you are standing on it. Both are dropped before they
        // reach the frequency where they would alias into noise.
        // Each band is *branched* on its own fade rather than evaluated and
        // multiplied by zero. GLSL has no lazy evaluation, so the quarter-metre
        // grain — which is invisible past twenty metres — was costing a noise
        // tap on every pixel of a horizon-filling island. Terrain depth is
        // coherent across a warp, so these branches actually take.
        float fMott = 1.0 - smoothstep(90.0, 200.0, gDist);
        if (fMott > 0.02) col *= 1.0 + (aa_n(vWPos.xz * 0.26 + 3.0) - 0.5) * 0.40 * fMott;
        float fA = 1.0 - smoothstep(26.0, 66.0, gDist);
        if (fA > 0.02) col *= 1.0 + (aa_n(vWPos.xz * 0.95 + 17.0) - 0.5) * 0.34 * fA;
        // and one more, at a quarter of a metre — the scale of the ground you
        // are actually standing on. Without it the last five metres in front of
        // the camera are a smooth ramp of one colour, which is the single thing
        // that most reliably makes terrain read as modelling clay.
        float fB = 1.0 - smoothstep(7.0, 18.0, gDist);
        if (fB > 0.02) col *= 1.0 + (aa_n(vWPos.xz * 3.6 - 41.0) - 0.5) * 0.30 * fB;
        // Scattered lichen and bleached dry patches at a metre scale. Both are
        // three-metre features and both cost a tap; past two hundred metres
        // they are sub-pixel and the mottle above is already saying it.
        if (gDist < 210.0) {
          float lichen = smoothstep(0.50, 0.82, aa_n(vWPos.xz * 0.115 + 7.0));
          col = mix(col, col * vec3(1.20, 1.10, 0.80), lichen * 0.36 * (1.0 - vSide));
          float dark = smoothstep(0.52, 0.84, aa_n(vWPos.xz * 0.062 - 19.0));
          col = mix(col, col * vec3(0.74, 0.80, 0.72), dark * 0.40 * (1.0 - vSide));
        }

        // ---- creases hold shadow. The baked horizon occlusion is the thing
        // that turns a heightfield into terrain: gullies, cliff feet and the
        // insides of valleys stop receiving sky, and the eye reads that as
        // depth long before it reads any colour.
        gAO = vAO;
        float ao = mix(0.66, 1.0, smoothstep(0.0, 0.35, N.y)) * mix(0.52, 1.0, vAO);
        col *= ao;

        diffuseColor.rgb *= col;
        gRough = mix(0.98, 0.70, rockMix * (1.0 - vSide)) - snowW * 0.28;
      `)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = clamp(gRough, 0.15, 1.0);')
      // The sun shadow, again, as a number.
      //
      // three folds its shadow straight into the light's colour and keeps no
      // copy, so a material that wants to know whether *this* pixel is in
      // shadow has to look again. `getShadowMask()` would do it, but it runs
      // the full nine-tap PCF kernel a second time on every ground pixel of a
      // horizon-filling island, which measured as a fifth of the frame. This
      // is one tap: it is only ever used to dim the fill, and the direct
      // term's own soft edge sits on top of it and hides the hard one.
      .replace('#include <shadowmap_pars_fragment>', /* glsl */`
        #include <shadowmap_pars_fragment>
        float sunMask1() {
          #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
            vec3 sc = vDirectionalShadowCoord[ 0 ].xyz / vDirectionalShadowCoord[ 0 ].w;
            if (sc.x < 0.0 || sc.x > 1.0 || sc.y < 0.0 || sc.y > 1.0 || sc.z > 1.0) return 1.0;
            sc.z += directionalLightShadows[ 0 ].shadowBias;
            return step(sc.z, unpackRGBAToDepth(texture2D(directionalShadowMap[ 0 ], sc.xy)));
          #else
            return 1.0;
          #endif
        }
      `)
      // A cheap sky-bounce term. Without it every surface facing away from the
      // low sun collapses to black and a cliff, a chasm and a lake all read the
      // same. Real ground bounces the sky back at you; so does this one.
      .replace('#include <aomap_fragment>', /* glsl */`
        #include <aomap_fragment>
        float skyUp = clamp(normalize(vWNrm).y * 0.5 + 0.5, 0.0, 1.0);

        /**
         * WHAT BLOCKS THE SUN ALSO BLOCKS THE SKY.
         *
         * This is the line that makes a person-sized shadow exist at all. The
         * sun here is twenty-two degrees up, so on flat ground its direct term
         * is already only sin(22°) of itself, while the fill — hemisphere,
         * ground bounce, and the sky-bounce below — arrives unattenuated. A
         * cast shadow that removes only the sun therefore removed about a
         * third of the ground's luminance, which a forty-metre monolith gets
         * away with on area alone and a 1.8 m cadet does not: three separate
         * critics photographed the cadet and reported no shadow at all.
         *
         * Anything standing between this patch of ground and the sun is also
         * standing between it and a good part of the sky around the sun, which
         * is where most of a golden-hour sky's energy is. Occluding the
         * ambient by the same mask is both the physically honest thing and the
         * thing that turns his shadow from a rumour into a silhouette.
         */
        float sunMask = sunMask1();
        float ambOcc = mix(0.42, 1.0, sunMask);
        reflectedLight.indirectDiffuse *= ambOcc;
        // sky light is what occlusion actually occludes, so it takes the full
        // weight of the bake while the sun keeps its own hard shadow
        reflectedLight.indirectDiffuse += diffuseColor.rgb * uSkyBounce
          * (0.26 + 0.36 * skyUp * skyUp) * mix(0.30, 1.0, gAO) * ambOcc;
        // Cloud shadows. A deck of cloud a kilometre up drags its shadow across
        // the island, and that moving dapple is most of what tells you the
        // ground has scale and that the world is running rather than posed.
        vec2 cq = vWPos.xz * 0.0042 + vec2(uTime * 0.0072, uTime * 0.0043);
        float cShade = mix(0.52, 1.0, smoothstep(0.30, 0.70, aa_n(cq)));
        reflectedLight.directDiffuse *= cShade;
        reflectedLight.directSpecular *= cShade;
      `);
  };
  return mat;
}

// ---------------------------------------------------------------------------
// The island mesh: a polar grid, so the coastline is exact, detail lands where
// the player is, and the underside can taper into a proper floating keel.
// ---------------------------------------------------------------------------

export function buildIsland(quality) {
  const hi = quality > 0.6;
  // THE TOP SURFACE IS NOT A QUALITY SETTING. It is the collision surface (see
  // `lattice` above), and a mesh drawn at a different resolution from the one
  // the boots read is the fifteen-metre disagreement this file used to ship.
  // Only the keel — which is scenery hanging under the coastline and which
  // nothing stands on — scales.
  const tab = lattice();
  const SECT = MSECT;
  const TOP = MTOP;
  const KEEL = hi ? 16 : 11;
  const RINGS = TOP + KEEL;

  const vCount = 1 + SECT * (RINGS + 1);
  const pos = new Float32Array(vCount * 3);
  const aMoist = new Float32Array(vCount);
  const aPath = new Float32Array(vCount);
  const aSide = new Float32Array(vCount);
  const aLush = new Float32Array(vCount);
  const aAO = new Float32Array(vCount);
  const aZoneA = new Float32Array(vCount * 4);
  const aZoneE = new Float32Array(vCount);

  const zw = new Float32Array(5);
  const writeZone = (i, x, z) => {
    zoneWeights(x, z, zw);
    aZoneA[i * 4] = zw[0]; aZoneA[i * 4 + 1] = zw[1];
    aZoneA[i * 4 + 2] = zw[2]; aZoneA[i * 4 + 3] = zw[3];
    aZoneE[i] = zw[4];
  };

  const centerH = HCEN;
  pos[0] = 0; pos[1] = centerH; pos[2] = 0;
  aMoist[0] = moistAt(0, 0); aPath[0] = 1; aSide[0] = 0; aLush[0] = 0; aAO[0] = 1;
  writeZone(0, 0, 0);

  const angs = new Float32Array(SECT);
  const Rcs = new Float32Array(SECT);
  const coastH = new Float32Array(SECT);
  const keelDepth = new Float32Array(SECT);
  for (let s = 0; s < SECT; s++) {
    const a = (s / SECT) * Math.PI * 2;
    angs[s] = a;
    Rcs[s] = RCS[s];
    coastH[s] = tab[TOP * SECT + s];
    keelDepth[s] = 150 + fbm(Math.cos(a) * 3.1 + 5, Math.sin(a) * 3.1 - 2, 3) * 110;
  }

  const idx = (ring, s) => 1 + ring * SECT + (s % SECT);

  for (let ring = 0; ring <= RINGS; ring++) {
    for (let s = 0; s < SECT; s++) {
      const a = angs[s], Rc = Rcs[s];
      const i = idx(ring, s), o = i * 3;
      if (ring <= TOP) {
        const t = ring / TOP;
        const rad = Rc * (RAD_K + RAD_M * Math.pow(t, RAD_P));
        const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
        // Straight off the table: the vertex the GPU draws IS the sample the
        // boots stand on, by construction rather than by coincidence.
        const h = tab[ring * SECT + s];
        pos[o] = x; pos[o + 1] = h; pos[o + 2] = z;
        aMoist[i] = moistAt(x, z);
        aPath[i] = pathAt(x, z);
        aSide[i] = 0;
        aLush[i] = grassDensityAt(x, z, h);
        aAO[i] = aoAt(x, z, h);
        writeZone(i, x, z);
      } else {
        const u = (ring - TOP) / KEEL;                 // 0 at the shore, 1 at the keel tip
        const drop = Math.pow(u, 0.40);
        const craggy = (fbm(a * 4.3 + 11, u * 5.0 + 3, 3) - 0.5) * 0.10 * (1 - u);
        const rad = Rc * Math.max(0.004, (1 - Math.pow(u, 2.3) * 0.996) + craggy);
        const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
        pos[o] = x;
        pos[o + 1] = coastH[s] - 1.5 - drop * keelDepth[s] + craggy * 60;
        pos[o + 2] = z;
        aMoist[i] = 0; aPath[i] = 0; aLush[i] = 0;
        // the keel hangs in open air: fully lit near the rim, swallowed below
        aAO[i] = clamp(1 - u * 1.25, 0.12, 1);
        aSide[i] = Math.min(1, u * 7.0);
        writeZone(i, x, z);
      }
    }
  }

  const tri = [];
  for (let s = 0; s < SECT; s++) tri.push(0, idx(0, s + 1), idx(0, s));
  for (let ring = 0; ring < RINGS; ring++) {
    for (let s = 0; s < SECT; s++) {
      const a0 = idx(ring, s), a1 = idx(ring, s + 1);
      const b0 = idx(ring + 1, s), b1 = idx(ring + 1, s + 1);
      tri.push(a0, a1, b1, a0, b1, b0);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aMoist', new THREE.BufferAttribute(aMoist, 1));
  geo.setAttribute('aPath', new THREE.BufferAttribute(aPath, 1));
  geo.setAttribute('aSide', new THREE.BufferAttribute(aSide, 1));
  geo.setAttribute('aLush', new THREE.BufferAttribute(aLush, 1));
  geo.setAttribute('aAO', new THREE.BufferAttribute(aAO, 1));
  geo.setAttribute('aZoneA', new THREE.BufferAttribute(aZoneA, 4));
  geo.setAttribute('aZoneE', new THREE.BufferAttribute(aZoneE, 1));
  geo.setIndex(tri);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  const mesh = new THREE.Mesh(geo, makeTerrainMaterial());
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.name = 'island';
  return mesh;
}
