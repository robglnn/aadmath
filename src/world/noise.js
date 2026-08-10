// Small deterministic value-noise + fBm. Shared by the CPU heightfield and the
// mesh builder so collision always agrees with what you can see.

function hash2(x, y) {
  // integer maths all the way down — the float version this replaced lost the
  // low bits and returned a badly biased 0..0.5, which flattened the world
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
const smooth = (t) => t * t * (3 - 2 * t);

export function valueNoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = smooth(xf), v = smooth(yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

export function fbm(x, y, octaves = 5, lac = 2.03, gain = 0.5) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq);
    norm += amp;
    amp *= gain; freq *= lac;
  }
  return sum / norm;
}

export function ridge(x, y, octaves = 4) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(valueNoise(x * freq, y * freq) * 2 - 1);
    sum += amp * n * n;
    norm += amp;
    amp *= 0.5; freq *= 2.07;
  }
  return sum / norm;
}

// --- small maths helpers used all over the world builder -------------------

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function sstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0 || 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
}

export const mix = (a, b, t) => a + (b - a) * t;

/** Deterministic pseudo-random stream — the world must look the same every load. */
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** Squared distance from (px,pz) to segment (ax,az)->(bx,bz). */
export function segDist(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az;
  const wx = px - ax, wz = pz - az;
  const L = vx * vx + vz * vz;
  const t = L > 0 ? clamp((wx * vx + wz * vz) / L, 0, 1) : 0;
  const dx = wx - vx * t, dz = wz - vz * t;
  return Math.hypot(dx, dz);
}

/** GLSL snippet: the same style of value noise, for shaders that need detail. */
export const GLSL_NOISE = /* glsl */`
// Cheap hash — no transcendentals. This shader runs on every ground pixel of
// every frame, so trig here costs more than the whole terrain mesh.
float aa_h(vec2 p){
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float aa_n(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(aa_h(i), aa_h(i+vec2(1,0)), f.x),
             mix(aa_h(i+vec2(0,1)), aa_h(i+vec2(1,1)), f.x), f.y);
}
float aa_fbm3(vec2 p){
  float s = aa_n(p) * 0.5;
  s += aa_n(p * 2.07) * 0.25;
  s += aa_n(p * 4.13) * 0.125;
  return s * 1.143;
}
float aa_fbm(vec2 p){
  float s = aa_fbm3(p);
  s += aa_n(p * 8.3) * 0.0714;
  return s;
}
`;
