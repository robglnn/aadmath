import * as THREE from 'three';
import { heightAt } from './world.js';
import { PEAK, PEAK2, HENGE } from './terrain.js';
import { WRECK, CATHEDRAL, ARCH } from './landmarks.js';
import { merge, paint, paintY } from './geom.js';
import { createBeacon } from '../fx/beacon.js';
import { t } from '../i18n/index.js';

/**
 * THE SURVEY — what the island is FOR, between two tears.
 *
 * The same cold critic who counted twelve questions in a row also went the
 * other way and roamed, and reported the other half of the same hole:
 *
 *   "The one time I did roam (03:00–08:30) there was nothing out there: brown
 *    hillside, no landmarks, no reason to move."
 *
 * Two of those three clauses were literally false and that is what makes the
 * finding devastating. There ARE landmarks — a colony ship nose-first in the
 * badlands, a ninety-metre crystal cathedral, a glass arch over the spill, a
 * tipped stone ring, a watchtower on the lesser summit. He walked for five and
 * a half minutes and did not report seeing one, because **not one of them was
 * a thing you could do anything about.** Scenery you cannot act on is not a
 * landmark; it is a texture on the horizon, and the eye stops resolving it
 * inside a minute. "No reason to move" was the true clause, and it made the
 * other two true in practice.
 *
 * So every hero silhouette in this world now carries a SURVEY MARK, and the
 * marks are the beat between two stints of mathematics:
 *
 *   THE BEARING   When a stint ends (`src/session/stint.js`), one unclaimed
 *                 mark lights up — the lowest rung of the ladder below, so the
 *                 first errand anybody is ever given is a walk and the wing is
 *                 not asked for until it has been paid for twice. It stands a
 *                 column of pale violet light, a colour nothing else in this
 *                 sky owns. There is now always somewhere to go that is not a
 *                 keypad.
 *   THE CLAIM     Reach it and it is yours: 70 motes — a third of a hanging
 *                 cache, five good minutes of running, in one find — and a
 *                 **permanent updraft planted on the spot**. The hard place
 *                 you reached once is a launch pad for ever, and the ladder is
 *                 built so that each rung is climbed with what the one below it
 *                 paid for. The marks are a ladder, and the rungs are places.
 *   THE ROUTE     Four of the six stand in the air, at the height of the thing
 *                 they belong to: the Ossuary's stern, the Arch's crown, the
 *                 Watchtower's head, the Cathedral's core. You reach those with
 *                 the wing, with a column, or by building up to them — which is
 *                 the first time in this game that the build verb and the
 *                 glider have had a target that was not decoration. Every one
 *                 of those heights is measured against the live heightfield and
 *                 the standing columns; see `SITES`.
 *
 * A claimed mark does not go dark. It keeps its updraft and turns to a steady
 * green keystone, exactly the way a sealed tear does, so an hour in the sky
 * over this island reads as a record of where you have been rather than as a
 * field of identical furniture. **The world visibly changes because you
 * played** — the same sentence `drift.js` is built on, applied to the horizon
 * instead of to the ground.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT DO. It never opens a rift, never
 * touches mastery, and never speaks over a learning surface. It is scenery
 * that answers, which is the only kind worth building.
 */

/** What one claimed mark pays. Between an anchor (60) and a cache (120). */
const PAY = 70;
/** Metres inside which a mark is claimed. Generous: this is a reward, not a test. */
const REACH = 9.5;
/**
 * …and how far above or below it you may be and still claim it.
 *
 * Deliberately generous, and it was widened from 11 after a fifteen-minute run
 * in which a cadet stood directly under the Ossuary's mark fourteen separate
 * times and was refused every one of them. A mark is a five-metre lattice
 * instrument with a light on it, standing on a landmark you can see from the
 * far side of the island. It is a reward for going somewhere, not a landing
 * test, and the last two metres of it must never be the interesting part.
 */
const REACH_Y = 14;
/** Metres from which a mark labels itself. */
const LABEL_R = 190;
/** Height and radius of the updraft a claim plants. */
const LIFT_H = 78;
const LIFT_R = 8;

const KEY = 'ascent.survey';

/**
 * THE SIX, AS A LADDER.
 *
 * Each one is the highest interesting point of a silhouette that was already in
 * the world — this file adds a reason, not a building. Two numbers decide how
 * it plays:
 *
 *   `lift`  metres above the ground under it. Every one of these was measured
 *           against the live heightfield, the standing updraft columns and the
 *           wing's own sink rate, not guessed. A first cut put the Watchtower's
 *           mark forty-two metres up and the Cathedral's fifty-eight, which is
 *           above every piece of ground and every column within ninety metres
 *           of either — so a cadet flew at them three times, ran out of height
 *           three times, and the errand was an insult rather than a route.
 *   `rung`  how much kit the route wants. `offer()` always lights the LOWEST
 *           unclaimed rung, so the first errand anybody is ever given is a
 *           walk, the second is a climb, and the wing is only asked for once
 *           the cadet has been paid twice for going somewhere.
 *
 * Distance breaks ties inside a rung, so the ladder never sends anybody across
 * the island when there is an equal step next door.
 */
const SITES = [
  // ---- rung 0: a walk. The errand has to teach itself before it asks for
  // anything, so the first mark anybody is ever shown stands on the ground.
  // The tipped stone ring in the south-west steppe.
  { id: 'reckoning', x: HENGE.x, z: HENGE.z, lift: 3, rung: 0 },

  // ---- rung 1: a climb, or a short drop under the wing.
  // The Spine's summit — the highest ground on the shard, and a column stands
  // seven metres from the mark for anybody who would rather fly it.
  { id: 'spine', x: PEAK.x, z: PEAK.z, lift: 8, rung: 1 },
  // The Ossuary's flank, at the height of the hull where it comes out of the
  // dirt. (Ground 59 m.) It sat at 18 m up and could not be claimed from the
  // ground it stands on, which made the second rung of the ladder a wall.
  { id: 'ossuary', x: WRECK.x + 22, z: WRECK.z + 4, lift: 10, rung: 1 },

  // ---- rung 2: the wing, or a column. Height you have to arrive with.
  // The crown of the Glass Arch, where the lake leaves the world. Eighteen
  // metres under the ridge behind it: this is the glide the wing was built for.
  { id: 'arch', x: ARCH.x, z: ARCH.z, lift: 30, rung: 2 },
  // The Watchtower's head, cantilevered over the drop. A standing updraft
  // reaches 154 m twelve metres away; the head is at 112.
  { id: 'watchtower', x: PEAK2.x + 14, z: PEAK2.z + 10, lift: 34, rung: 2 },

  // ---- rung 3: the last one, and the only one that wants a column you may
  // have had to plant. The Cathedral's core, hanging inside the blades.
  { id: 'cathedral', x: CATHEDRAL.x, z: CATHEDRAL.z, lift: 46, rung: 3 },
];

export function createErrand(opts = {}) {
  const {
    scene, player, drift, hud, wallet, audio, fx, comms,
    isBusy = () => false,
  } = opts;

  const group = new THREE.Group();
  group.name = 'survey';
  scene.add(group);

  // ------------------------------------------------------------- the marks
  //
  // One merged mesh each: a slender lattice mast with a faceted head, so that
  // the silhouette reads as *instrument* at two hundred metres and not as
  // another rock. Everything rigid shares one material and one draw call; the
  // head and the ring turn, and are the only moving parts.
  const stoneMat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.42, metalness: 0.24, flatShading: true,
  });
  const liveMat = new THREE.MeshStandardMaterial({
    color: 0xd8c6ff, emissive: 0x8f6cff, emissiveIntensity: 2.6,
    roughness: 0.22, metalness: 0.1, flatShading: true,
  });
  const heldMat = new THREE.MeshStandardMaterial({
    color: 0x9fe0c0, emissive: 0x3fae7c, emissiveIntensity: 0.9,
    roughness: 0.42, metalness: 0.2, flatShading: true,
  });
  const ringGeo = new THREE.TorusGeometry(2.5, 0.12, 8, 40);
  const headGeo = new THREE.OctahedronGeometry(1.35, 0);

  const marks = [];
  const claimed = load();

  for (const s of SITES) {
    const g0 = heightAt(s.x, s.z);
    if (g0 === null) continue;
    const y = g0 + s.lift;

    const holder = new THREE.Group();
    holder.position.set(s.x, y, s.z);

    // the mast: three fins around a spine, tapering, so it has a profile from
    // every bearing rather than being a pole that disappears edge-on
    const parts = [];
    const spine = new THREE.CylinderGeometry(0.18, 0.34, 7.2, 6);
    spine.translate(0, -3.0, 0);
    paintY(spine, [0.22, 0.24, 0.30], [0.62, 0.58, 0.74], -6.6, 0.6);
    parts.push(spine);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      const fin = new THREE.BoxGeometry(0.16, 4.4, 1.5);
      fin.rotateY(-a);
      fin.translate(Math.cos(a) * 0.7, -2.4, Math.sin(a) * 0.7);
      paintY(fin, [0.26, 0.27, 0.34], [0.70, 0.66, 0.82], -4.6, -0.2);
      parts.push(fin);
    }
    const collar = new THREE.CylinderGeometry(1.05, 1.25, 0.5, 6);
    collar.translate(0, -0.5, 0);
    paint(collar, 0.60, 0.56, 0.72);
    parts.push(collar);
    const mast = new THREE.Mesh(merge(parts), stoneMat);
    for (const p of parts) p.dispose();
    mast.castShadow = true;
    mast.userData.noCamBlock = true;
    holder.add(mast);

    const head = new THREE.Mesh(headGeo, liveMat);
    head.userData.noCamBlock = true;
    holder.add(head);
    const ring = new THREE.Mesh(ringGeo, liveMat);
    ring.rotation.x = Math.PI / 2;
    ring.userData.noCamBlock = true;
    holder.add(ring);

    const light = new THREE.PointLight(0xa88cff, 10, 34, 2);
    holder.add(light);

    // The column. Only the *current* bearing wears one — six shafts of light
    // standing over one island is a map legend, not a horizon.
    const beacon = createBeacon(marks.length + 41);
    beacon.position.set(s.x, g0 + 1.2, s.z);
    beacon.renderOrder = 4;
    beacon.visible = false;
    beacon.material.uniforms.uCol.value.setHex(0xb08cff);
    beacon.material.uniforms.uPow.value = 1.15;
    group.add(beacon);

    group.add(holder);
    const m = {
      ...s, y, ground: g0, holder, head, ring, light, beacon,
      pos: new THREE.Vector3(s.x, y, s.z),
      held: claimed.includes(s.id), lead: false, phase: marks.length * 1.7, popT: 0,
    };
    dress(m);
    marks.push(m);
    // A mark claimed in an earlier sitting keeps the air it opened: the ladder
    // has to survive the break, or yesterday's climb was rented.
    if (m.held) drift?.addColumn?.(s.x, s.z, LIFT_H, LIFT_R, true);
  }

  /** A mark wears its state: live is violet and turning, claimed is green and still. */
  function dress(m) {
    m.head.material = m.held ? heldMat : liveMat;
    m.ring.material = m.held ? heldMat : liveMat;
    m.light.color.setHex(m.held ? 0x7fe8b4 : 0xa88cff);
    m.light.intensity = m.held ? 4 : 10;
    if (m.held) m.beacon.visible = false;
  }

  // ------------------------------------------------------------ the bearing
  let lead = null;

  /**
   * Light the next place worth walking to.
   *
   * LOWEST RUNG FIRST, then nearest. Nearest-alone was the first cut and it was
   * wrong twice over: it handed a cadet who had never left the plaza a mark
   * thirty-four metres above a summit — because that summit happened to be the
   * closest thing — and an errand you cannot physically complete teaches the
   * player that the marker lies. The rung is the ladder; the distance only
   * decides which of two equal steps is the civil one to ask for.
   */
  function offer() {
    const open = marks.filter((m) => !m.held);
    if (!open.length) { setLead(null); return null; }
    const rung = Math.min(...open.map((m) => m.rung));
    let best = null, bd = Infinity;
    for (const m of open) {
      if (m.rung !== rung) continue;
      const d = Math.hypot(player.pos.x - m.x, player.pos.z - m.z);
      if (d < bd) { bd = d; best = m; }
    }
    setLead(best);
    return best;
  }

  function setLead(m) {
    if (lead === m) return;
    if (lead) { lead.lead = false; lead.beacon.visible = false; }
    lead = m || null;
    if (lead) { lead.lead = true; lead.beacon.visible = true; }
  }

  /** The claim. */
  function claim(m) {
    m.held = true;
    m.popT = 1;
    dress(m);
    if (lead === m) setLead(null);
    save();
    const paid = wallet?.earn?.(PAY, 'survey') ?? PAY;
    // The permanent updraft. This is the half of the reward that is not a
    // number: the route exists from now on, for everybody, for ever.
    drift?.addColumn?.(m.x, m.z, LIFT_H, LIFT_R, true);
    fx?.impact?.('good');
    audio?.unlocked?.();
    hud?.flash?.(t('field.surveyClaim', { name: t('survey.' + m.id), n: paid }), 'good');
    // One line, in the companion's voice, naming what the place was — said
    // through the queue so it can never talk over a learning surface.
    comms?.sayKey?.('survey.said.' + m.id, { tag: 'survey-' + m.id });
    // …and the next one, immediately, so the horizon is never empty.
    offer();
  }

  // ----------------------------------------------------------------- frame
  function update(dt, time) {
    const busy = isBusy();
    for (const m of marks) {
      const spin = m.held ? 0.10 : 0.55;
      m.head.rotation.y = time * spin + m.phase;
      m.head.rotation.z = Math.sin(time * 0.5 + m.phase) * 0.3;
      m.ring.rotation.z = -time * spin * 0.7 + m.phase;
      const breathe = 0.5 + 0.5 * Math.sin(time * (m.held ? 0.9 : 2.0) + m.phase);
      m.holder.position.y = m.y + breathe * (m.held ? 0.08 : 0.34);
      m.light.intensity = (m.held ? 4 : 10) * (0.9 + breathe * 0.2);
      if (m.popT > 0) {
        m.popT = Math.max(0, m.popT - dt * 1.4);
        const k = 1 + m.popT * m.popT * 3.2;
        m.head.scale.setScalar(k);
        m.ring.scale.setScalar(k);
      }
      if (m.beacon.visible) m.beacon.material.uniforms.uTime.value = time;
      if (busy || m.held) continue;
      const flat = Math.hypot(player.pos.x - m.x, player.pos.z - m.z);
      if (flat < REACH && Math.abs(player.pos.y - m.y) < REACH_Y) claim(m);
    }
  }

  // ----------------------------------------------------------- persistence
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(marks.filter((m) => m.held).map((m) => m.id)));
    } catch { /* private mode */ }
  }
  function load() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(v) ? v : [];
    } catch { return []; }
  }

  return {
    update,
    offer,
    /**
     * The place the world is currently pointing at, in the shape
     * `src/meta/guide.js` reads an objective in — so the arrow on the edge of
     * the frame and the distance on the card are the ones that already exist
     * rather than a second, disagreeing marker.
     */
    bearing: () => (lead
      ? { id: lead.id, pos: lead.pos, name: t('survey.' + lead.id), labelR: LABEL_R }
      : null),
    /** Every mark, for the world's own labels and for a critic. */
    marks,
    state: () => ({
      total: marks.length,
      held: marks.filter((m) => m.held).length,
      lead: lead ? lead.id : null,
      pay: PAY,
    }),
    reset() {
      try { localStorage.removeItem(KEY); } catch { /* private mode */ }
      for (const m of marks) { m.held = false; m.popT = 0; dress(m); }
      setLead(null);
    },
  };
}
