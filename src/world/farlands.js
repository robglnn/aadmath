import * as THREE from 'three';
import { rng, fbm, ridge, clamp, sstep } from './noise.js';
import { thinAir } from './air.js';

/**
 * THE FAR LANDS.
 *
 * The island is a hundred and seventy metres across. You can walk it in ninety
 * seconds. On its own that is a diorama, and the fastest way to prove it is a
 * diorama is to stand on the plaza and look outward: sky, a wash of haze, and
 * nothing that is a *place*.
 *
 * The Great Plateau does not work because the plateau is big. It works because
 * the second you step out of the shrine there are three other regions on the
 * horizon that are visibly not this one — Death Mountain is red and smoking,
 * the Hebra range is white, Faron is a dark green shelf under its own weather —
 * and every one of them is a promise that the world continues.
 *
 * So this file builds five other worlds, at eight hundred to a thousand metres,
 * each one:
 *
 *   - a **different colour family**, authored *before* the air touches it, so
 *     that fifty per cent aerial perspective still leaves three separable hues
 *     on the horizon rather than one lavender smear;
 *   - a **different silhouette grammar** — stacked buttes, a needle cluster, a
 *     terraced cascade — so you can tell them apart in one glance at 1 pt of
 *     angular size;
 *   - a **keel**, because everything in this sky floats, and a landmass whose
 *     bottom you can see is a landmass you believe is a hundred kilometres of
 *     rock rather than a painted flat;
 *   - a **beacon**, a thin shaft of its own colour standing five hundred metres
 *     into the sky, because a horizon has to promise somewhere to walk to and
 *     not merely be scenery.
 *
 * Everything is baked: face-normal lighting from the sun's bearing, altitude
 * palette, and mist pooling into the keel. They carry the scene's fog, so
 * `air.js` grades them with exactly the air the island is standing in and they
 * can never drift out of agreement with it. The whole far world is five draw
 * calls and about thirty thousand triangles.
 */

/**
 * The colour the air pools at down where the cloud deck is.
 *
 * Kept deliberately dark and cool. Aerial perspective already lifts and cools
 * everything out here; if the bake lifts it too, the two compound and every
 * landmass in the world arrives as the same sheet of white paper.
 */
const MIST = [0.34, 0.40, 0.56];

/** The colour of the sun grazing an upper edge, for `rim` in the bake. */
const RIM = [0.62, 0.46, 0.30];

// ---------------------------------------------------------------------------
// A tiny triangle-soup builder. Every far land is one non-indexed buffer of
// position + colour, so it merges into a single draw without fighting three.js
// over which attributes a primitive happens to carry.
// ---------------------------------------------------------------------------
class Soup {
  constructor() { this.p = []; this.c = []; }

  /** One triangle, coloured by `shade(vertex, faceNormal)`. */
  tri(a, b, c, shade) {
    const e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2];
    const e2x = c[0] - a[0], e2y = c[1] - a[1], e2z = c[2] - a[2];
    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    for (const v of [a, b, c]) {
      this.p.push(v[0], v[1], v[2]);
      const col = shade(v, nx, ny, nz);
      this.c.push(col[0], col[1], col[2]);
    }
  }

  quad(a, b, c, d, shade) { this.tri(a, b, c, shade); this.tri(a, c, d, shade); }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    return g;
  }
}

const lerp3 = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t,
];

// ---------------------------------------------------------------------------
// Silhouette grammar. Three profiles, and the difference between them has to be
// readable as a black shape against the sky — that is the only test that matters
// at a kilometre.
// ---------------------------------------------------------------------------
function profile(form, u, ang, seed, H) {
  const cx = Math.cos(ang), cz = Math.sin(ang);
  const n1 = fbm(cx * 2.4 + seed, cz * 2.4 - seed * 0.7, 4);
  const n2 = fbm(cx * 6.1 - seed, cz * 6.1 + seed, 3);
  const rg = ridge(cx * 3.1 + seed * 1.7, cz * 3.1 - seed * 1.1, 4);

  if (form === 'butte') {
    // Stacked mesas. Every transition here is deliberately *narrower than two
    // rings of the mesh*, because the entire read of a butte is that its sides
    // are vertical and its tops are flat. Spread those steps over a third of
    // the radius — as the first version of this function did — and you get a
    // smooth dome, which is to say a cone, which is to say the thing this file
    // exists to stop.
    const wob = (n1 - 0.5) * 0.10;
    const skirt = H * 0.26 * sstep(1.00, 0.90 + wob, u) * (0.70 + n1 * 0.6);
    const bench = H * 0.30 * sstep(0.86 + wob, 0.80 + wob, u);
    const cliff = H * 0.52 * sstep(0.68 + wob, 0.62 + wob, u);
    const cap = H * 0.28 * sstep(0.44 + wob, 0.38 + wob, u) * (0.6 + n1 * 0.8);
    const stack = H * 0.40 * sstep(0.22, 0.16, u) * (0.5 + rg * 1.0);
    // the tops are flat, but not level — a mesa dips
    const tilt = (cx * 0.6 + cz * 0.4) * H * 0.045 * (1 - u);
    return skirt + bench + cliff + cap + stack + tilt + (n2 - 0.5) * H * 0.035;
  }
  if (form === 'needle') {
    // a cluster of pinnacles standing off one narrow shoulder — this is the
    // one silhouette in the set with more vertical than horizontal in it
    const shoulder = H * 0.22 * sstep(1.00, 0.88, u);
    const shelf = H * 0.26 * sstep(0.80, 0.74, u);
    const spine = H * 1.10 * Math.pow(Math.max(0, 1 - u), 3.0) * (0.34 + rg * 1.30);
    const sisters = H * 0.70 * sstep(0.60, 0.20, u) * Math.pow(rg, 1.8);
    return shoulder + shelf + spine + sisters + (n2 - 0.5) * H * 0.04;
  }
  // 'terrace': a tiered shelf, quantised into ledges you can count from a
  // kilometre out, with the tiers cut by the same noise the rim is cut by
  let h = H * (0.14 + 0.96 * sstep(1.02, 0.04, u)) * (0.70 + n1 * 0.56);
  const step = H / 7.0;
  const q = Math.floor(h / step);
  const f = h / step - q;
  // a hard riser and a flat tread: 15% of the step does all the climbing
  h = (q + sstep(0.40, 0.55, f)) * step;
  return h + (n2 - 0.5) * H * 0.03;
}

// ---------------------------------------------------------------------------
function landmass(soup, opt) {
  const {
    cx, cy, cz, R, H, form, seed, pal, sunB, capAt = 0.62,
    gain = 1.0, amb = 0.14, key = 1.16, mist = 0.52, rim = 0.0,
  } = opt;
  // Enough rings that a six-per-cent-wide riser in the profile lands on its own
  // pair of them and comes out as a vertical face rather than a ramp.
  const SECT = 56, TOP = 26, KEEL = 7;
  const rand = rng(Math.round(seed * 977) + 3);

  /** The bake: everything this landmass will ever know about light. */
  const shade = (v, nx, ny, nz) => {
    const alt = (v[1] - cy) / H;
    // Horizontal facing plus a sky term, and the terminator is *hard*.
    //
    // Aerial perspective at nine hundred metres blends forty per cent of the
    // sky into everything out here. A soft, evenly-lit landmass loses its whole
    // form to that and arrives as one flat tinted card. What survives forty per
    // cent haze is contrast: a face that is nearly black next to a face that is
    // nearly white still reads as a mountain after the air has had its cut.
    const nd = nx * sunB.x + nz * sunB.y;
    const lam = clamp(nd * 0.62 + Math.max(ny, 0) * 0.36 + 0.20, 0, 1);
    // `gain` is how hard this world's terminator is driven. One is the set's
    // ordinary key-to-fill; the ashen mass runs at three and a half, because a
    // silhouette is not a dark object — it is a *high-contrast* one, and the
    // only way to be nearly black on the shadow side and still have a rim of
    // form on the sun side is to widen the range rather than lower it.
    const lit = amb + key * gain * Math.pow(lam, 1.55);
    // altitude palette: bedrock at the foot, body, then a cap of whatever this
    // world is famous for — snow, forest, dust, glass
    let base = lerp3(pal.low, pal.mid, sstep(0.02, 0.48, alt));
    const capable = clamp((ny - 0.24) * 2.6, 0, 1);
    base = lerp3(base, pal.cap, sstep(capAt, capAt + 0.30, alt) * capable);
    // near-vertical faces are always bare rock, whatever grows on the shelves
    base = lerp3(base, pal.cliff, clamp(1.0 - Math.abs(ny) * 2.3, 0, 1) * 0.78);
    // Mist pools into the keel. Every landmass in the world is palest where it
    // enters the cloud, and that single gradient is what stops a far island
    // reading as a sticker pasted on the sky.
    const below = clamp(1 - (v[1] - cy + H * 0.06) / (H * 0.40), 0, 1);
    const pool = Math.pow(below, 1.8) * mist;
    // The crown light. On a backlit mountain the sun does not stop at the
    // terminator: it grazes every upper edge and lights the dust standing off
    // it, and that thin hot line along the top of an otherwise black mass is
    // the single cue that says the light is *behind* the mountain rather than
    // that the mountain is painted on. Only the high, near-vertical faces get
    // it, so it draws the crags and leaves the body of the silhouette alone.
    let r0 = 0, r1 = 0, r2 = 0;
    if (rim > 0) {
      const k = rim * Math.pow(clamp(1 - Math.abs(ny) * 1.6, 0, 1), 2.0)
        * sstep(0.80, 1.02, alt) * Math.pow(clamp(nd * 1.15 - 0.06, 0, 1), 1.6);
      r0 = RIM[0] * k; r1 = RIM[1] * k; r2 = RIM[2] * k;
    }
    return [
      base[0] * lit * (1 - pool) + MIST[0] * pool + r0,
      base[1] * lit * (1 - pool) + MIST[1] * pool + r1,
      base[2] * lit * (1 - pool) + MIST[2] * pool + r2,
    ];
  };

  // ---- the top surface -------------------------------------------------
  const rimR = new Float32Array(SECT);
  const angs = new Float32Array(SECT);
  for (let s = 0; s < SECT; s++) {
    const a = (s / SECT) * Math.PI * 2;
    angs[s] = a;
    // an irregular coastline, not a circle
    rimR[s] = R * (0.74 + fbm(Math.cos(a) * 1.9 + seed, Math.sin(a) * 1.9 - seed, 4) * 0.62);
  }

  const P = [];
  for (let ring = 0; ring <= TOP; ring++) {
    const u = ring / TOP;
    const row = [];
    for (let s = 0; s < SECT; s++) {
      const rad = rimR[s] * Math.pow(u, 1.08);
      row.push([
        cx + Math.cos(angs[s]) * rad,
        cy + profile(form, u, angs[s], seed, H),
        cz + Math.sin(angs[s]) * rad,
      ]);
    }
    P.push(row);
  }
  // the keel: the rock this thing tore out of, tapering into the cloud
  const keelDeep = H * (0.85 + fbm(seed, seed * 2, 2) * 0.55);
  for (let k = 1; k <= KEEL; k++) {
    const t = k / KEEL;
    const row = [];
    for (let s = 0; s < SECT; s++) {
      const craggy = (fbm(angs[s] * 3.7 + seed, t * 4.0 - seed, 3) - 0.5) * 0.16 * (1 - t);
      const rad = rimR[s] * Math.max(0.02, 1 - Math.pow(t, 2.1) * 0.98 + craggy);
      row.push([
        cx + Math.cos(angs[s]) * rad,
        cy - 2 - Math.pow(t, 0.44) * keelDeep + craggy * keelDeep * 0.5,
        cz + Math.sin(angs[s]) * rad,
      ]);
    }
    P.push(row);
  }

  const apex = [cx, cy + profile(form, 0, 0, seed, H), cz];
  for (let s = 0; s < SECT; s++) {
    soup.tri(apex, P[0][(s + 1) % SECT], P[0][s], shade);
  }
  for (let r = 0; r < P.length - 1; r++) {
    for (let s = 0; s < SECT; s++) {
      const s1 = (s + 1) % SECT;
      soup.quad(P[r][s], P[r][s1], P[r + 1][s1], P[r + 1][s], shade);
    }
  }

  // ---- hero features on top -------------------------------------------
  const lipAt = (a) => {
    let bi = 0, bd = 9e9;
    for (let s = 0; s < SECT; s++) {
      const d = Math.abs(((angs[s] - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (d < bd) { bd = d; bi = s; }
    }
    return P[TOP - 1][bi];
  };

  if (form === 'needle') {
    // glass: a stand of tapered prisms, brightest at the tip
    for (let i = 0; i < 11; i++) {
      const a = rand() * Math.PI * 2;
      const rr = Math.pow(rand(), 0.7) * R * 0.5;
      const bx = cx + Math.cos(a) * rr, bz = cz + Math.sin(a) * rr;
      const by = cy + profile(form, rr / R, a, seed, H) - H * 0.05;
      const hh = H * (0.30 + rand() * 0.72);
      const w = hh * (0.055 + rand() * 0.055);
      spike(soup, bx, by, bz, w, hh, 5, rand,
        (t) => lerp3(pal.cliff, pal.glow, Math.pow(t, 0.7)));
    }
  }
  if (form === 'terrace') {
    // water. Three falls off the same lip, the middle one enormous, pouring
    // into a mist fan that never reaches a bottom.
    const a0 = Math.atan2(-cz, -cx);           // the lip that faces the island
    for (let i = 0; i < 3; i++) {
      const a = a0 + (i - 1) * 0.30;
      const lip = lipAt(a);
      const w = (i === 1 ? 0.085 : 0.045) * R;
      cascade(soup, lip, cx, cz, w, keelDeep * 0.9 + H * 0.4, pal.water);
    }
  }
  if (form === 'butte') {
    /**
     * THE CALDERA.
     *
     * Aerial perspective at a kilometre blends a third of the sky into anything
     * out here, and it does that by *lifting* — so a dark landmass arrives
     * paler than it was authored and a bright one arrives about as bright as it
     * was. That asymmetry is a tool: anything authored brighter than the sky
     * survives the haze intact, which is why every far world in this file gets
     * one small, very hot feature. It is the thing that turns a mauve mass into
     * a place with something happening on it.
     *
     * Here it is a crater: a ring of glowing rock at the summit and three
     * fissures running down the flank, the colour of the world's own beacon.
     */
    const rim = [];
    const cRad = R * 0.20;
    const cy0 = cy + profile(form, 0.10, 0, seed, H);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      rim.push([
        cx + Math.cos(a) * cRad * (0.8 + fbm(a * 2 + seed, seed, 2) * 0.5),
        cy0 - H * 0.02 + fbm(a * 3 - seed, seed * 2, 2) * H * 0.05,
        cz + Math.sin(a) * cRad * (0.8 + fbm(a * 2 - seed, seed, 2) * 0.5),
      ]);
    }
    const hot = pal.glow;
    const cool = lerp3(pal.glow, pal.cliff, 0.72);
    for (let i = 0; i < rim.length; i++) {
      const j = (i + 1) % rim.length;
      const inner = [cx, cy0 - H * 0.10, cz];
      soup.tri(rim[i], rim[j], inner, (v) => (v === inner ? hot : cool));
    }
    // fissures: thin glowing seams running down the sunward flank
    for (let f = 0; f < 3; f++) {
      const a = Math.atan2(-cz, -cx) + (f - 1) * 0.55;
      const dirx = Math.cos(a), dirz = Math.sin(a);
      let px = cx + dirx * cRad, pz = cz + dirz * cRad;
      let py = cy0 - H * 0.02;
      for (let k = 0; k < 7; k++) {
        const t = (k + 1) / 7;
        const rr = cRad + t * (R * 0.72 - cRad);
        const nx = cx + dirx * rr + Math.sin(k * 2.1 + f) * R * 0.05;
        const nz = cz + dirz * rr + Math.cos(k * 1.7 + f) * R * 0.05;
        const ny = cy + profile(form, rr / R, a, seed, H) + H * 0.004;
        const w = R * 0.020 * (1 - t * 0.7);
        const c = lerp3(hot, cool, t * t);
        soup.quad(
          [px - dirz * w, py, pz + dirx * w], [px + dirz * w, py, pz - dirx * w],
          [nx + dirz * w, ny, nz - dirx * w], [nx - dirz * w, ny, nz + dirx * w],
          () => c,
        );
        px = nx; pz = nz; py = ny;
      }
    }
    // a great finger of rock beside the crater, so the skyline has something a
    // person made a decision about
    const a = Math.atan2(-cz, -cx) + 0.5;
    const lip = lipAt(a);
    spike(soup, lip[0], lip[1], lip[2], H * 0.055, H * 0.52, 6, rand,
      (t) => lerp3(pal.cliff, pal.cap, t * 0.6));
  }

  // ---- satellites: torn rock still orbiting the wound ------------------
  const sats = 9;
  for (let i = 0; i < sats; i++) {
    const a = rand() * Math.PI * 2;
    const rr = R * (1.05 + rand() * 0.85);
    const sx = cx + Math.cos(a) * rr;
    const sz = cz + Math.sin(a) * rr;
    const sy = cy + (rand() - 0.35) * H * 0.7;
    const s = R * (0.035 + rand() * 0.075);
    chunk(soup, sx, sy, sz, s, rand, shade);
  }
}

/** A tapered prism — a needle, a finger, a shard. */
function spike(soup, x, y, z, w, h, sides, rand, ramp) {
  const yaw = rand() * 6.283;
  const tipx = x + (rand() - 0.5) * w * 2.0;
  const tipz = z + (rand() - 0.5) * w * 2.0;
  const ring = [];
  for (let i = 0; i < sides; i++) {
    const a = yaw + (i / sides) * Math.PI * 2;
    ring.push([x + Math.cos(a) * w, y, z + Math.sin(a) * w]);
  }
  const mid = [];
  for (let i = 0; i < sides; i++) {
    const a = yaw + (i / sides) * Math.PI * 2;
    mid.push([
      x + (tipx - x) * 0.55 + Math.cos(a) * w * 0.55,
      y + h * 0.55,
      z + (tipz - z) * 0.55 + Math.sin(a) * w * 0.55,
    ]);
  }
  const tip = [tipx, y + h, tipz];
  const low = ramp(0), midC = ramp(0.55), hiC = ramp(1);
  const shadeAt = (c) => () => c;
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    soup.quad(ring[i], ring[j], mid[j], mid[i], shadeAt(lerp3(low, midC, 0.5)));
    soup.tri(mid[i], mid[j], tip, shadeAt(lerp3(midC, hiC, 0.6)));
  }
}

/** A waterfall: a ribbon off a lip, widening into mist that has no bottom. */
function cascade(soup, lip, cx, cz, w, drop, water) {
  const dx = lip[0] - cx, dz = lip[2] - cz;
  const l = Math.hypot(dx, dz) || 1;
  const ox = dx / l, oz = dz / l;
  const tx = -oz, tz = ox;
  const steps = 5;
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps, t1 = (i + 1) / steps;
    const w0 = w * (1 + t0 * 2.6), w1 = w * (1 + t1 * 2.6);
    const y0 = lip[1] - drop * Math.pow(t0, 1.2);
    const y1 = lip[1] - drop * Math.pow(t1, 1.2);
    const bx0 = lip[0] + ox * (2 + t0 * 10), bz0 = lip[2] + oz * (2 + t0 * 10);
    const bx1 = lip[0] + ox * (2 + t1 * 10), bz1 = lip[2] + oz * (2 + t1 * 10);
    const c0 = lerp3(water, MIST, t0 * 0.9);
    const c1 = lerp3(water, MIST, t1 * 0.9);
    const shade = (v) => (v[1] > (y0 + y1) * 0.5 ? c0 : c1);
    soup.quad(
      [bx0 - tx * w0, y0, bz0 - tz * w0],
      [bx0 + tx * w0, y0, bz0 + tz * w0],
      [bx1 + tx * w1, y1, bz1 + tz * w1],
      [bx1 - tx * w1, y1, bz1 - tz * w1],
      shade,
    );
  }
}

/** An irregular torn boulder, for the debris field. */
function chunk(soup, x, y, z, s, rand, shade) {
  const v = [];
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    v.push([x + Math.cos(a) * s * (0.7 + rand() * 0.6), y, z + Math.sin(a) * s * (0.7 + rand() * 0.6)]);
  }
  const top = [x + (rand() - 0.5) * s, y + s * (0.5 + rand() * 0.5), z + (rand() - 0.5) * s];
  const bot = [x + (rand() - 0.5) * s, y - s * (0.8 + rand() * 1.4), z + (rand() - 0.5) * s];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    soup.tri(v[i], v[j], top, shade);
    soup.tri(v[j], v[i], bot, shade);
  }
}

// ---------------------------------------------------------------------------
// The five. Bearings are chosen against the sun: the ember world stands into
// the light where the air is gold, the glass and the green stand with the light
// behind them where the air is cornflower, so aerial perspective *widens* the
// hue separation instead of collapsing it.
// ---------------------------------------------------------------------------
export const FARLANDS = [
  {
    id: 'ember',
    // south, straight off the Southern Terrace lookout, and on the shaded side
    // of the sky — so cool air keeps its rust unmistakably warm against
    // everything around it
    cx: -210, cz: 930, cy: -40, R: 300, H: 430, form: 'butte', seed: 3.1,
    beacon: 0xff7a30, capAt: 0.72,
    pal: {
      low: [0.145, 0.028, 0.016], mid: [0.380, 0.078, 0.024],
      cap: [0.700, 0.230, 0.042], cliff: [0.200, 0.038, 0.020],
      glow: [1.00, 0.60, 0.26], water: [0.86, 0.62, 0.46],
    },
  },
  {
    id: 'glass',
    // Sixteen degrees north of east, standing in the East Col.
    //
    // It used to stand at forty degrees, which put it squarely behind the
    // Spine's southern shoulder: ninety-four metres of rock eighty metres from
    // the plaza, twenty-three degrees of it, in front of a world whose summit
    // reaches twenty-one. It was not distant. It was behind a hill, from every
    // square metre of ground a cadet can walk on, and three rounds of critics
    // in a row reported the horizon as occluded because of it.
    //
    // The island's own skyline is now surveyed rather than assumed (see the
    // East Col in terrain.js): every far world stands in a bearing the island
    // leaves open, and this one stands in the gap that was cut for it.
    cx: 1134, cz: -325, cy: -18, R: 230, H: 520, form: 'needle', seed: 11.7,
    beacon: 0x8fa8ff, capAt: 0.50,
    pal: {
      low: [0.050, 0.048, 0.200], mid: [0.115, 0.105, 0.470],
      cap: [0.420, 0.490, 0.960], cliff: [0.060, 0.056, 0.260],
      glow: [0.860, 0.900, 1.140], water: [0.80, 0.88, 1.05],
    },
  },
  {
    id: 'verdant',
    cx: 1010, cz: 450, cy: -34, R: 290, H: 380, form: 'terrace', seed: 27.3,
    beacon: 0x46ffb0, capAt: 0.30,
    pal: {
      low: [0.014, 0.062, 0.040], mid: [0.016, 0.215, 0.086],
      cap: [0.040, 0.375, 0.068], cliff: [0.030, 0.090, 0.056],
      glow: [0.45, 0.95, 0.62], water: [0.880, 0.960, 1.020],
    },
  },
  {
    id: 'steps',
    // south, straight off the Southern Terrace lookout
    cx: -1080, cz: 140, cy: -40, R: 300, H: 420, form: 'terrace', seed: 41.9,
    beacon: 0xffc860, capAt: 0.44,
    pal: {
      low: [0.136, 0.100, 0.052], mid: [0.350, 0.268, 0.098],
      cap: [0.630, 0.545, 0.280], cliff: [0.205, 0.155, 0.086],
      glow: [1.00, 0.88, 0.56], water: [0.910, 0.950, 1.010],
    },
  },
  {
    id: 'ashen',
    // DEAD AHEAD OF THE ARRIVAL FRAME.
    //
    // The cadet lands facing due north and does not touch the mouse for four
    // seconds. Whatever is at this bearing is the entire first impression of
    // the game, so this one is not a horizon detail — it is the subject of the
    // opening shot, and it is composed like one.
    //
    //   - Eight degrees west of the arrival bearing, so it sits just off dead
    //     centre and the gate valley leads the eye into it rather than at it.
    //   - Eight hundred metres out instead of a kilometre, and wider than it is
    //     far is tall: from the plaza it subtends forty degrees of horizontal,
    //     which is a third of the frame — a *place*, not a peak.
    //   - Backlit. The sun is behind its right shoulder, so every face turned
    //     toward the island is in its own shadow and the whole mass reads as
    //     one dark shape with a hot rim, which is the only composition in which
    //     a silhouette is a silhouette.
    //   - Authored two stops darker than anything else in the set, and standing
    //     in half the air (see thinAir), so that darkness survives the haze.
    cx: -132, cz: -892, cy: -52, R: 330, H: 478, form: 'butte', seed: 55.5,
    beacon: 0xb070ff, capAt: 0.64,
    gain: 3.6, amb: 0.055, key: 1.0, mist: 0.66, rim: 0.62,
    pal: {
      low: [0.016, 0.013, 0.028], mid: [0.038, 0.031, 0.066],
      cap: [0.086, 0.072, 0.132], cliff: [0.022, 0.018, 0.038],
      glow: [0.86, 0.62, 1.20], water: [0.80, 0.80, 0.96],
    },
  },
];

export function createFarlands(scene, sunDir, quality = 1) {
  const sunB = new THREE.Vector2(sunDir.x, sunDir.z).normalize();
  const group = new THREE.Group();
  group.name = 'farlands';

  // Half the air. These are the mid ground of the horizon ladder — nearer than
  // the ranges behind them and much further than the island in front — and the
  // full haze put a luminance floor under them that no palette could get below,
  // which is what turned five distinct worlds into five identical grey cards.
  // At half strength the ashen mass can finally be darker than the sky it
  // stands in, and the ranges at 1.5 and 2.6 km still read a clear step paler
  // than these do, so the depth ladder is *stronger*, not weaker.
  const mat = thinAir(new THREE.MeshBasicMaterial({
    vertexColors: true, fog: true, side: THREE.DoubleSide, dithering: true,
  }), 0.48);

  for (const F of FARLANDS) {
    const soup = new Soup();
    landmass(soup, { ...F, sunB });
    const mesh = new THREE.Mesh(soup.geometry(), mat);
    mesh.name = `farland-${F.id}`;
    mesh.renderOrder = 26;
    group.add(mesh);
  }

  // ---- the plumes -------------------------------------------------------
  /**
   * A column of ash leaning downwind off every crater.
   *
   * Weather is the cheapest way to say a place has its own conditions. The
   * Great Plateau reveal works partly because Death Mountain is visibly *doing
   * something* — you can see its plume from the far side of the map, and that
   * is what makes it a destination rather than a backdrop. Six crossed quads,
   * a soft alpha ramp and a warm foot near the vent; two draw calls for the
   * whole set.
   */
  {
    const pos = [], uvs = [], tint = [];
    const col = new THREE.Color();
    for (const F of FARLANDS) {
      if (F.form !== 'butte') continue;
      col.setRGB(F.pal.glow[0], F.pal.glow[1], F.pal.glow[2]);
      const y0 = F.cy + F.H * 0.86;
      const N = 7;
      let px = F.cx, pz = F.cz, py = y0;
      for (let k = 0; k < N; k++) {
        const t0 = k / N, t1 = (k + 1) / N;
        // it leans harder the higher it gets, the way a real column shears
        const drift = (t) => F.R * 2.4 * Math.pow(t, 1.7);
        const nx = F.cx + 0.86 * drift(t1), nz = F.cz + 0.51 * drift(t1);
        const ny = y0 + F.H * 1.45 * Math.pow(t1, 0.78);
        const w0 = F.R * (0.10 + t0 * 0.62), w1 = F.R * (0.10 + t1 * 0.62);
        for (const k2 of [0, 1]) {
          const ax = k2 ? 1 : 0, az = k2 ? 0 : 1;
          const quad = [
            [px - ax * w0, py, pz - az * w0, t0], [px + ax * w0, py, pz + az * w0, t0],
            [nx + ax * w1, ny, nz + az * w1, t1], [nx - ax * w1, ny, nz - az * w1, t1],
          ];
          for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) {
            for (const i of [a, b, c]) {
              pos.push(quad[i][0], quad[i][1], quad[i][2]);
              uvs.push(0, quad[i][3]);
              tint.push(col.r, col.g, col.b);
            }
          }
        }
        px = nx; pz = nz; py = ny;
      }
    }
    if (pos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      g.setAttribute('aTint', new THREE.Float32BufferAttribute(tint, 3));
      const pmat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 } },
        vertexShader: /* glsl */`
          attribute vec3 aTint;
          varying vec3 vTint; varying float vT;
          void main(){
            vTint = aTint; vT = uv.y;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */`
          precision mediump float;
          varying vec3 vTint; varying float vT;
          uniform float uTime;
          void main(){
            float a = (1.0 - smoothstep(0.10, 1.0, vT)) * 0.42;
            a *= 0.86 + 0.14 * sin(uTime * 0.5 + vT * 6.0);
            // hot at the vent, cold ash above it
            vec3 c = mix(mix(vec3(0.30,0.30,0.36), vTint, 0.75),
                         vec3(0.68,0.70,0.80), smoothstep(0.0, 0.55, vT));
            gl_FragColor = vec4(c, a);
          }`,
      });
      const m = new THREE.Mesh(g, pmat);
      m.renderOrder = 28;
      m.frustumCulled = false;
      group.add(m);
      group.userData.plume = pmat;
    }
  }

  // ---- the beacons ------------------------------------------------------
  // A shaft of a world's own colour standing out of it. This is the difference
  // between scenery and a destination: you can point at one and say "there".
  const beacons = new THREE.Group();
  const bmat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`
      attribute vec3 aTint;
      varying vec3 vTint; varying float vT; varying float vPh;
      void main(){
        vTint = aTint; vT = uv.y; vPh = aTint.r * 9.0 + aTint.b * 5.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      precision mediump float;
      varying vec3 vTint; varying float vT; varying float vPh;
      uniform float uTime;
      void main(){
        float a = pow(1.0 - vT, 2.2) * 0.62;
        a *= smoothstep(0.0, 0.05, vT);
        a *= 0.78 + 0.22 * sin(uTime * 0.9 + vPh - vT * 5.0);
        gl_FragColor = vec4(vTint * 1.4, a);
      }`,
  });
  {
    const pos = [], uvs = [], tint = [];
    const col = new THREE.Color();
    for (const F of FARLANDS) {
      col.set(F.beacon);
      const top = F.cy + F.H * 1.0 + 620;
      const base = F.cy + F.H * 0.55;
      const w = F.R * 0.17;
      // two crossed billboards — cheap, and always presents area from any bearing
      for (const k of [0, 1]) {
        const ax = k ? 1 : 0.0, az = k ? 0.0 : 1;
        const x0 = F.cx - ax * w, z0 = F.cz - az * w;
        const x1 = F.cx + ax * w, z1 = F.cz + az * w;
        const quad = [
          [x0, base, z0, 0], [x1, base, z1, 0],
          [x1 * 0.999, top, z1 * 0.999, 1], [x0 * 0.999, top, z0 * 0.999, 1],
        ];
        for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) {
          for (const i of [a, b, c]) {
            pos.push(quad[i][0], quad[i][1], quad[i][2]);
            uvs.push(0, quad[i][3]);
            tint.push(col.r, col.g, col.b);
          }
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setAttribute('aTint', new THREE.Float32BufferAttribute(tint, 3));
    const m = new THREE.Mesh(g, bmat);
    m.frustumCulled = false;
    m.renderOrder = 33;
    beacons.add(m);
  }
  group.add(beacons);

  scene.add(group);
  return {
    group,
    update(t) {
      bmat.uniforms.uTime.value = t;
      if (group.userData.plume) group.userData.plume.uniforms.uTime.value = t;
    },
  };
}
