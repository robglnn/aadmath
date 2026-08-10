import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Merge parts that may or may not be indexed, and may carry vertex colours. */
export function merge(parts) {
  const flat = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  const g = mergeGeometries(flat, false);
  g.computeVertexNormals();
  return g;
}

/** Flat vertex colour on a whole part, so a merged mesh stays one draw call. */
export function paint(geo, r, g, b) {
  const n = geo.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = r; c[i * 3 + 1] = g; c[i * 3 + 2] = b; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}

/** Vertical gradient paint — cheap weathering, dirty at the foot, bleached up top. */
export function paintY(geo, lo, hi, y0, y1) {
  const p = geo.attributes.position;
  const c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const t = Math.min(1, Math.max(0, (p.getY(i) - y0) / (y1 - y0 || 1)));
    c[i * 3] = lo[0] + (hi[0] - lo[0]) * t;
    c[i * 3 + 1] = lo[1] + (hi[1] - lo[1]) * t;
    c[i * 3 + 2] = lo[2] + (hi[2] - lo[2]) * t;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}

export const UP = new THREE.Vector3(0, 1, 0);
