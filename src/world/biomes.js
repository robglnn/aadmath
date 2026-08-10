import { fbm, clamp } from './noise.js';

/**
 * REGIONS.
 *
 * The island is not one place. Stand on the plaza, turn on the spot, and every
 * quarter of the horizon is a different colour *and* a different value — which
 * is the whole trick behind the Great Plateau reveal. Cool slate and snow to
 * the north, saturated emerald west, bleached gold south-west, burnt ochre
 * south, dark blue-green fen east.
 *
 * One weight function drives all of it: terrain albedo, grass tint, which
 * species of tree grows, which rocks are scattered, and where the five hero
 * silhouettes stand. Nothing can drift out of agreement because nothing has its
 * own copy of the answer.
 */

export const ZONES = [
  { id: 'alpine', x: 24, z: -114, r: 116 },   // The Spine Reach — cold, pale, high
  { id: 'verdant', x: -78, z: -16, r: 102 },  // The Emerald Vale — lush, dark, wooded
  { id: 'steppe', x: -60, z: 92, r: 92 },     // The Gilded Steppe — bright, dry, open
  { id: 'badland', x: 40, z: 106, r: 86 },    // The Ochre Wastes — hot, terraced
  { id: 'mire', x: 104, z: 30, r: 74 },       // The Glass Fen — dark, wet, teal
];

export const ZONE_INDEX = Object.fromEntries(ZONES.map((z, i) => [z.id, i]));

/**
 * Albedo per region. Three slots each — the sward, the bedrock, and the bare
 * earth under both — chosen so no two regions share a hue *or* a value.
 */
export const PAL = {
  alpine: {
    grass: [0.150, 0.288, 0.252], rock: [0.400, 0.436, 0.520], dirt: [0.290, 0.310, 0.348],
    blade: [0.170, 0.330, 0.290], blade2: [0.310, 0.400, 0.330],
  },
  verdant: {
    grass: [0.148, 0.406, 0.146], rock: [0.404, 0.398, 0.336], dirt: [0.316, 0.250, 0.164],
    blade: [0.150, 0.440, 0.150], blade2: [0.300, 0.520, 0.190],
  },
  steppe: {
    grass: [0.600, 0.512, 0.198], rock: [0.560, 0.502, 0.372], dirt: [0.446, 0.362, 0.216],
    blade: [0.700, 0.596, 0.236], blade2: [0.500, 0.520, 0.230],
  },
  badland: {
    grass: [0.398, 0.246, 0.124], rock: [0.470, 0.226, 0.126], dirt: [0.382, 0.186, 0.112],
    blade: [0.600, 0.402, 0.168], blade2: [0.430, 0.300, 0.160],
  },
  mire: {
    grass: [0.176, 0.372, 0.286], rock: [0.300, 0.372, 0.372], dirt: [0.196, 0.226, 0.196],
    blade: [0.180, 0.410, 0.300], blade2: [0.260, 0.460, 0.250],
  },
};

const ORDER = ZONES.map((z) => z.id);

/** Emit `w.x*colA + w.y*colB + …` for a palette slot, for the terrain shader. */
export function glslBlend(slot) {
  const comp = ['vZA.x', 'vZA.y', 'vZA.z', 'vZA.w', 'vZE'];
  return ORDER.map((id, i) => {
    const c = PAL[id][slot];
    return `${comp[i]} * vec3(${c[0].toFixed(4)}, ${c[1].toFixed(4)}, ${c[2].toFixed(4)})`;
  }).join(' + ');
}

const _w = new Float32Array(5);

/**
 * Region weights at a point, summing to one.
 *
 * Inverse-distance weighting over a warped domain: the interiors are pure, the
 * boundaries are soft and wander like real ecotones rather than running along a
 * circle someone drew.
 */
export function zoneWeights(x, z, out = _w) {
  const wx = x + (fbm(x * 0.0072 + 3.1, z * 0.0072 - 7.4, 2) - 0.5) * 76;
  const wz = z + (fbm(x * 0.0072 - 11.3, z * 0.0072 + 5.9, 2) - 0.5) * 76;
  let s = 0;
  for (let i = 0; i < 5; i++) {
    const Z = ZONES[i];
    const dx = wx - Z.x, dz = wz - Z.z;
    const q = Math.sqrt(dx * dx + dz * dz) / Z.r;
    const q2 = q * q;
    const w = 1 / (q2 * q2 + 0.030);
    out[i] = w; s += w;
  }
  const inv = 1 / s;
  for (let i = 0; i < 5; i++) out[i] *= inv;
  return out;
}

/** Weight of one named region — the readable form for scattering rules. */
export function zoneAt(x, z, id) {
  const w = zoneWeights(x, z);
  return w[ZONE_INDEX[id]];
}

/** The region that owns this point, and by how much. */
export function dominantZone(x, z) {
  const w = zoneWeights(x, z);
  let bi = 0;
  for (let i = 1; i < 5; i++) if (w[i] > w[bi]) bi = i;
  return { id: ORDER[bi], w: w[bi], weights: w };
}

/** Blend a palette slot on the CPU, for instance colours and grass tints. */
export function blendSlot(w, slot, out = [0, 0, 0]) {
  out[0] = out[1] = out[2] = 0;
  for (let i = 0; i < 5; i++) {
    const c = PAL[ORDER[i]][slot];
    out[0] += w[i] * c[0]; out[1] += w[i] * c[1]; out[2] += w[i] * c[2];
  }
  return out;
}

export { clamp };
