import * as THREE from 'three';
import { tex } from '../ui/tex.js';
import { t } from '../i18n/index.js';
import { SPEC } from './pieces.js';

/**
 * What the lattice is *for*, at a rift.
 *
 * The brief's promise: a beam becomes the balance, a floor becomes the area
 * model. So near an open rift the build verb changes meaning without changing
 * controls. Set a beam and it drops onto a fulcrum, hangs two pans and loads
 * them — `a` unknown tiles and `b` unit tiles on the left, `c` unit tiles on the
 * right — and holds dead level, because the two sides *are* equal. Set a floor
 * and it rules itself into an area model: one rectangle of height `k` split
 * into a strip of `x` and a strip of `n`, with the identity written along it.
 *
 * The learner is never told this. They build a beam near a rift and the beam
 * explains itself. That is the "invisible explicit teaching" rule applied to a
 * verb rather than to a paragraph.
 */
const RANGE = 24;
const TILE_MAX = 128;
/**
 * HOW MANY APPARATUS MAY STAND AT ONCE, AND WHY THERE IS A NUMBER AT ALL.
 *
 * A player reported the game auto-degrading to the lowest effect tier and
 * 44.9 fps after eighteen minutes, against a benchmark that reports 91.7 on a
 * fresh scene. Measured over a real fifteen-minute session
 * (`tools/critic/sustain.mjs`), this class was one of the two largest sources
 * of the slope: every beam or floor set near a rift added a `THREE.Group` of
 * meshes to the scene AND a handful of KaTeX-rendered label divs to the
 * overlay, and NOTHING ever took one away except the player deleting the piece
 * by hand. Nobody deletes a beam. So the count only ever went up: nineteen rigs
 * and a hundred and twenty-one live tags inside five minutes of play — a
 * doubling of the frame's draw calls, and a KaTeX subtree per tag for the
 * browser to lay out on every resize for the rest of the session.
 *
 * The apparatus is a *teaching overlay on the rift you are standing at*, not
 * scenery. Three is the most a learner can be looking at, so the oldest is
 * retired when a fourth is raised: its meshes leave the scene, its owned
 * materials are disposed, and its tags leave the DOM. The player's actual
 * BEAM is untouched — the piece stays exactly where they built it, and it is
 * still a beam. Only the explanatory rig hanging off it goes.
 */
const LIVE_MAX = 3;

export class Manipulatives {
  constructor(scene, uiRoot) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'axiom-manipulatives';
    scene.add(this.group);

    this.rifts = [];
    this.ctx = new Map();
    this.items = [];

    // every tile in every manipulative, in one batch
    const tileGeo = new THREE.BoxGeometry(1, 1, 1);
    const tileMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0x1d3350, emissiveIntensity: 1,
      roughness: 0.34, metalness: 0.12,
    });
    this.tiles = new THREE.InstancedMesh(tileGeo, tileMat, TILE_MAX);
    this.tiles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.tiles.castShadow = true;
    this.tiles.frustumCulled = false;
    this.tiles.count = 0;
    this.tiles.userData.noCamBlock = true;
    this.group.add(this.tiles);

    this.rigMat = new THREE.MeshStandardMaterial({
      color: 0xcfe9f7, emissive: 0x2c7fa6, emissiveIntensity: 0.7,
      roughness: 0.38, metalness: 0.4,
    });
    this.fulcrumGeo = new THREE.CylinderGeometry(0.02, 0.62, 1, 4, 1);
    this.panGeo = new THREE.CylinderGeometry(0.78, 0.7, 0.09, 20);
    this.hangGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 6);
    this.plateGeo = new THREE.BoxGeometry(1, 0.06, 1);

    this.tags = document.createElement('div');
    this.tags.className = 'axiom-tags';
    (uiRoot || document.body).appendChild(this.tags);

    this._m = new THREE.Matrix4();
    this._v = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
  }

  setRifts(list) { this.rifts = list || []; }

  /** Hand the apparatus the mathematics the rift is actually holding. */
  setContext(riftId, item) {
    const c = readContext(item);
    if (c) this.ctx.set(riftId, c);
  }

  nearRift(x, z) {
    let best = null, bd = RANGE;
    for (const r of this.rifts) {
      const d = Math.hypot(r.pos.x - x, r.pos.z - z);
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  }

  onPlaced(piece) {
    if (piece.kind !== 'beam' && piece.kind !== 'floor') return;
    const rift = this.nearRift(piece.x, piece.z);
    if (!rift) return;
    const c = this.ctx.get(rift.id) || seededContext(rift.id);
    try {
      const item = piece.kind === 'beam' ? this._balance(piece, c) : this._area(piece, c);
      if (item) {
        this.items.push(item);
        piece.tone = 1;
        // Raising a fourth rig retires the first. See LIVE_MAX.
        while (this.items.length > LIVE_MAX) this._retire(this.items[0]);
        this._rebuildTags();
      }
    } catch { /* apparatus is a bonus; never let it cost you the piece */ }
  }

  onRemoved(piece) {
    const m = this.items.find((x) => x.piece === piece);
    if (m) { this._retire(m); this._rebuildTags(); }
  }

  /**
   * Take one apparatus down and give back everything it was holding.
   *
   * The meshes leave the scene graph, the materials this rig owns are disposed,
   * and the tags are dropped on the next `_rebuildTags`. Geometry is not
   * disposed and must not be: `fulcrumGeo`, `panGeo`, `hangGeo` and `plateGeo`
   * are shared by every rig this class will ever build, and disposing one of
   * them here would take the next apparatus down with it. `owned` is the list
   * of things this rig alone made, which is exactly what may be freed.
   */
  _retire(m) {
    const i = this.items.indexOf(m);
    if (i < 0) return;
    this.group.remove(m.group);
    for (const mat of m.owned || []) mat.dispose();
    if (m.piece) m.piece.tone = 0;
    this.items.splice(i, 1);
  }

  // ------------------------------------------------------------------ rigs
  _balance(piece, c) {
    const drop = SPEC.beam.drop;
    const g = new THREE.Group();
    g.position.set(piece.x, piece.y, piece.z);
    g.rotation.y = piece.yaw;
    this.group.add(g);

    const f = new THREE.Mesh(this.fulcrumGeo, this.rigMat);
    f.scale.set(1, drop - 0.1, 1);
    f.position.y = -(drop - 0.1) / 2 - 0.16;
    f.castShadow = true;
    g.add(f);

    const pans = [];
    for (const side of [-1, 1]) {
      const hang = new THREE.Mesh(this.hangGeo, this.rigMat);
      hang.scale.set(1, 0.85, 1);
      hang.position.set(side * 1.6, -0.42, 0);
      g.add(hang);
      const pan = new THREE.Mesh(this.panGeo, this.rigMat);
      pan.position.set(side * 1.6, -0.86, 0);
      pan.castShadow = true;
      pan.receiveShadow = true;
      g.add(pan);
      pans.push(pan);
    }

    // load: a unknowns + b units against c units
    const load = [];
    layTiles(load, -1.6, -0.78, c.a, 'x');
    layTiles(load, -1.6, -0.78, c.b, 'unit');
    layTiles(load, 1.6, -0.78, c.c, 'unit');

    return {
      kind: 'balance', piece, group: g, owned: [], load, pans,
      roll: 0.16, rollV: 0,
      tags: [
        { local: [0, 1.25, 0], cls: 'lede', key: 'build.balance' },
        { local: [-1.6, 0.62, 0], cls: '', tex: c.lhs },
        { local: [1.6, 0.62, 0], cls: '', tex: c.rhs },
        { local: [0, -2.0, 0], cls: 'small lede', key: 'build.balanceLaw' },
      ],
    };
  }

  _area(piece, c) {
    const owned = [];
    const g = new THREE.Group();
    // A deck's origin IS its walking surface now (pieces.js), so the model is
    // laid a few centimetres over the plate rather than a fifth of a metre.
    g.position.set(piece.x, piece.y + 0.06, piece.z);
    g.rotation.y = piece.yaw;
    this.group.add(g);

    // the deck is 4 x 4: height k across local x, width (x + n) along local z
    const total = c.k2 + c.n;                    // x drawn as k2 units wide
    const wx = 3.6 * (c.k2 / total);
    const wn = 3.6 * (c.n / total);
    const z0 = -1.8;

    const mkPlate = (w, zc, col, emis) => {
      const mat = new THREE.MeshStandardMaterial({
        color: col, emissive: emis, emissiveIntensity: 0.9,
        roughness: 0.4, metalness: 0.1, transparent: true, opacity: 0.78,
      });
      owned.push(mat);
      const m = new THREE.Mesh(this.plateGeo, mat);
      m.scale.set(3.6, 1, w);
      m.position.set(0, 0, zc);
      m.userData.noCamBlock = true;
      g.add(m);
      return m;
    };
    mkPlate(wx - 0.08, z0 + wx / 2, 0x7fd2ff, 0x2f7fb0);
    mkPlate(wn - 0.08, z0 + wx + wn / 2, 0xc9a6ff, 0x5b3fa8);

    const div = new THREE.Mesh(this.plateGeo, this.rigMat);
    div.scale.set(3.7, 1.9, 0.10);
    div.position.set(0, 0.04, z0 + wx);
    g.add(div);

    return {
      kind: 'area', piece, group: g, owned, load: [],
      tags: [
        { local: [0, 1.5, 0], cls: 'lede', key: 'build.areaModel' },
        { local: [0, 0.4, z0 + wx / 2], cls: '', tex: `${c.k}${c.v}` },
        { local: [0, 0.4, z0 + wx + wn / 2], cls: '', tex: `${c.k}\\cdot ${c.n}` },
        { local: [2.5, 0.3, z0 + wx / 2], cls: 'small', tex: c.v },
        { local: [2.5, 0.3, z0 + wx + wn / 2], cls: 'small', tex: String(c.n) },
        { local: [0, 0.35, -2.6], cls: 'small warm', tex: String(c.k) },
        { local: [0, -1.2, 0], cls: 'small', tex: c.identity },
      ],
    };
  }

  // ------------------------------------------------------------------ frame
  update(dt, time, camera) {
    // tiles
    let n = 0;
    for (const m of this.items) {
      if (m.kind === 'balance') {
        // A balance that is balanced settles to level, quickly and visibly:
        // the settle *is* the argument. A beam that keeps swinging says the
        // opposite of what the apparatus is for.
        m.rollV += -m.roll * 34 * dt;
        m.rollV *= Math.exp(-6.5 * dt);
        m.roll += m.rollV * dt;
        m.piece.roll = m.roll;
        m.group.rotation.z = m.roll;
      }
      m.group.updateMatrixWorld(true);
      for (const tl of m.load) {
        if (n >= TILE_MAX) break;
        const s = tl.kind === 'x' ? [0.42, 0.42, 0.42] : [0.22, 0.22, 0.22];
        this._v.set(tl.x, tl.y + (tl.kind === 'x' ? 0.21 : 0.11), tl.z);
        this._v.applyMatrix4(m.group.matrixWorld);
        this._q.setFromRotationMatrix(m.group.matrixWorld);
        this._s.set(s[0], s[1], s[2]);
        this._m.compose(this._v, this._q, this._s);
        this.tiles.setMatrixAt(n, this._m);
        this.tiles.setColorAt(n, tl.kind === 'x' ? XCOL : UCOL);
        n++;
      }
    }
    if (n !== this.tiles.count || n > 0) {
      this.tiles.count = n;
      this.tiles.instanceMatrix.needsUpdate = true;
      if (this.tiles.instanceColor) this.tiles.instanceColor.needsUpdate = true;
      this.tiles.boundingSphere = null;
    }

    if (camera) this._place(camera);
  }

  _rebuildTags() {
    this.tags.innerHTML = '';
    this.nodes = [];
    for (const m of this.items) {
      for (const tag of m.tags) {
        const el = document.createElement('div');
        el.className = `axiom-tag ${tag.cls}`.trim();
        if (tag.tex) el.innerHTML = tex(tag.tex);
        else el.textContent = t(tag.key);
        this.tags.appendChild(el);
        this.nodes.push({ el, m, local: tag.local });
      }
    }
  }

  _place(camera) {
    if (!this.nodes || !this.nodes.length) return;
    const w = window.innerWidth, h = window.innerHeight;
    for (const nd of this.nodes) {
      this._v.set(nd.local[0], nd.local[1], nd.local[2]).applyMatrix4(nd.m.group.matrixWorld);
      const d = this._v.distanceTo(camera.position);
      this._v.project(camera);
      const on = this._v.z < 1 && d < 62 && Math.abs(this._v.x) < 1.25 && Math.abs(this._v.y) < 1.25;
      if (!on) { if (nd.el.style.display !== 'none') nd.el.style.display = 'none'; continue; }
      nd.el.style.display = '';
      nd.el.style.left = `${(this._v.x * 0.5 + 0.5) * w}px`;
      nd.el.style.top = `${(-this._v.y * 0.5 + 0.5) * h}px`;
      nd.el.style.opacity = String(Math.max(0.15, 1 - Math.max(0, d - 34) / 28));
    }
  }

  relocalise() { this._rebuildTags(); }
}

// the unknown is one colour, the units another — the whole point of tiles
const XCOL = new THREE.Color(0x9d7bff);
const UCOL = new THREE.Color(0x5ecdf5);

/** Lay `count` tiles on a pan in neat rows, as a hand would. */
function layTiles(out, px, py, count, kind) {
  const size = kind === 'x' ? 0.46 : 0.25;
  const cols = kind === 'x' ? 3 : 4;
  const n = Math.min(count, kind === 'x' ? 6 : 28);
  for (let i = 0; i < n; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    out.push({
      kind,
      x: px + (col - (cols - 1) / 2) * size * 1.1,
      y: py + row * size * 1.05,
      z: kind === 'x' ? -0.26 : 0.24,
    });
  }
}

// ---------------------------------------------------------------------------
// mathematics
// ---------------------------------------------------------------------------
/** Pull `ax + b = c` out of a real generated item, if it is small enough to lay
 *  out as physical tiles. Anything else keeps its seeded stand-in. */
function readContext(item) {
  const src = item?.check?.math || item?.latex;
  if (typeof src !== 'string') return null;
  const m = src.replace(/\s+/g, '').match(/^(-?\d*)([a-zA-Z])([+-])(\d+)=(-?\d+)$/);
  if (!m) return null;
  const a = m[1] === '' || m[1] === '+' ? 1 : m[1] === '-' ? -1 : Number(m[1]);
  const v = m[2];
  const b = (m[3] === '-' ? -1 : 1) * Number(m[4]);
  const c = Number(m[5]);
  if (a < 1 || a > 6 || b < 0 || b > 12 || c < 1 || c > 28) return null;
  return {
    a, b, c, v,
    lhs: `${a === 1 ? '' : a}${v} + ${b}`,
    rhs: String(c),
    k: a, k2: 3, n: b || 3,
    identity: `${a}(${v} + ${b || 3}) = ${a}${v} + ${a * (b || 3)}`,
  };
}

/** A true, small, laid-outable statement derived from the rift's own name. */
function seededContext(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  const r = (n) => ((h = Math.imul(h ^ (h >>> 15), 2246822507)) >>> 8) % n;
  const a = 2 + r(3);
  const x = 2 + r(4);
  const b = 1 + r(6);
  const c = a * x + b;
  const n = 2 + r(5);
  return {
    a, b, c, v: 'x',
    lhs: `${a}x + ${b}`,
    rhs: String(c),
    k: a, k2: 3, n,
    identity: `${a}(x + ${n}) = ${a}x + ${a * n}`,
  };
}
