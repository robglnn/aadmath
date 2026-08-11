import * as THREE from 'three';
import { t } from '../i18n/index.js';
import './beckon.css';

/**
 * THE WORLD ANSWERS.
 *
 * A real player finished a real session and wrote this:
 *
 *   "lots of ring portal looking things but nothing happens when i go in them,
 *    maybe thats fine, idk what to do about the tears, i see black diamonds and
 *    golden or orange diamonds too, nothing happening maybe just aesthetics."
 *
 * He was right about all of it, and none of it was aesthetics.
 *
 *  · The rings are the ten learning sites. On a fresh save NINE of them are
 *    shut, and `Rifts.nearest()` — the only thing that looked for a rift — skips
 *    a shut one. So walking into nine of the ten rings was, to every line of
 *    code in the game, an event that did not happen. No prompt, no refusal, no
 *    sound: the definition of a silent failure.
 *  · The tenth *did* work, but only if you pressed E inside a four-metre radius
 *    that nothing on screen ever mentioned. He never pressed it.
 *  · The diamonds are the drift: cyan crystals to run through, gold ones worth
 *    three times as much because they grew beside an open tear, and dark husks
 *    where a vein has been harvested and is coming back. Three states, one
 *    silhouette, and not a word anywhere.
 *
 * This module is the answer, and it is one rule: **nothing you can walk up to
 * is allowed to say nothing.** Every interactable in the world gets three
 * responses — one at range (a label you can read before you commit), one on
 * contact (the thing happens, or it visibly refuses), and one for the locked
 * case (what shuts it, and what opens it).
 *
 * It owns no state that matters. Delete it and the game is exactly as playable
 * as it was in the session that produced the quote above, which is the point.
 */

const RIFT_LABEL = 62;      // metres: close enough that the label is about *you*
const RIFT_MAX = 2;         // …and never more than two tears talking at once
const RIFT_HANDOFF = 15;    // inside this, the kit's tear plate has the floor
const RIFT_STEP = 4.6;      // …and opens when you stand on its plate
const RIFT_REARM = 8.5;     // walk this far off before it will open again
const RIFT_KNOCK = 6.4;     // a shut tear notices you from here
const VEIN_LABEL = 21;      // …and the ground only names itself under your feet
const ANCHOR_LABEL = 34;
const MARK_MAX = 3;         // three chips is the most a frame may ever carry
const KNOCK_COOL = 7;       // seconds before a shut tear repeats itself

export function createBeckon(opts = {}) {
  const {
    uiRoot, player, rifts, drift, builder, hud, verge,
    isBusy = () => false, onOpenRift = () => {},
  } = opts;

  const layer = document.createElement('div');
  layer.className = 'beckon-tags';
  (uiRoot || document.body).appendChild(layer);

  // A small pool, reused every frame. Twelve labels is more than has ever been
  // legible on screen at once; building DOM per frame is how a world label
  // becomes a frame-rate problem.
  const pool = [];
  function slot(i) {
    if (!pool[i]) {
      const el = document.createElement('div');
      el.className = 'bk-tag';
      el.style.display = 'none';
      layer.appendChild(el);
      pool[i] = { el, cls: '', text: '' };
    }
    return pool[i];
  }

  const marks = [];           // {pos, text, cls} rebuilt each frame
  const taken = [];           // screen boxes already spoken for, this frame
  const _sort = [];
  const _v = new THREE.Vector3();
  let armed = true;           // has the cadet left the plate since it last fired
  let knock = 0;              // cooldown on "this one is shut"
  let firstShards = false;

  // Is the kit's near-field tear plate in the page? Polled, not queried per
  // frame, and never assumed: this module must stand up on its own.
  let hailEl = null, hailT = 0;
  function hail() {
    if (hailT <= 0) { hailT = 1.5; hailEl = document.querySelector('.hail.plate'); }
    return !!hailEl;
  }

  /** m:ss, for a vein that is coming back. */
  function clock(s) {
    const m = Math.floor(Math.max(0, s) / 60);
    const ss = Math.floor(Math.max(0, s) % 60);
    return `${m}:${ss < 10 ? '0' : ''}${ss}`;
  }

  /** The thing that has to be held before this tear will open. */
  function blockerOf(r) {
    const id = (r.blockers && r.blockers[0]) || (r.node.prereqs && r.node.prereqs[0]);
    return id ? t('skills.' + id) : t('skills.' + r.id);
  }

  function collect(camera) {
    marks.length = 0;
    const p = player.pos;

    // ---- the tears ------------------------------------------------------
    // Only the ones you are actually near, and only two of them. Ten rings
    // labelled across a valley is a spreadsheet laid over a landscape, and it
    // was unreadable the first time it was photographed: five tags stacked on
    // one another, three of them about rifts behind the camera.
    _sort.length = 0;
    for (const r of rifts.list) {
      const d = Math.hypot(p.x - r.foot.x, p.z - r.foot.z);
      if (d < RIFT_LABEL) _sort.push([d, r]);
    }
    _sort.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < Math.min(RIFT_MAX, _sort.length); i++) {
      // Hand off to the kit's tear hail if it is present: from close in, that
      // plate is under the crosshair naming this exact ring and offering the
      // key. Two labels saying the same thing is the noise this module exists
      // to remove, so the world tag is the *distant* signage and the plate is
      // the near one. If the hail is not in the page, this tag covers both.
      if (_sort[i][0] < RIFT_HANDOFF && hail()) continue;
      const r = _sort[i][1];
      const skill = t('skills.' + r.id);
      const mark = { pos: _tmp(r.foot.x, r.foot.y + 3.4, r.foot.z) };
      if (r.mastered) { mark.cls = 'held'; mark.text = t('field.riftHeld', { skill }); }
      else if (r.locked) { mark.cls = 'shut'; mark.text = t('field.riftShut', { skill: blockerOf(r) }); }
      else { mark.cls = 'open'; mark.text = t('field.riftOpen', { skill }); }
      marks.push(mark);
    }

    // ---- the diamonds ---------------------------------------------------
    // One label, on the nearest vein: twenty-six of these labelled at once is
    // wallpaper, and the question the player asked was about the *one he was
    // standing in*.
    let best = null, bd = VEIN_LABEL;
    for (const v of drift.veins) {
      const d = Math.hypot(p.x - v.x, p.z - v.z);
      if (d < bd) { bd = d; best = v; }
    }
    if (best) {
      const y = (best.motes[0]?.y ?? p.y) + 1.9;
      if (best.cool > 0) {
        marks.push({
          pos: _tmp(best.x, y, best.z), cls: 'dead',
          text: t('field.veinSpent', { time: clock(best.cool) }),
        });
      } else {
        marks.push({
          pos: _tmp(best.x, y, best.z),
          cls: best.rich ? 'rich' : 'vein',
          text: best.rich
            ? t('field.veinRich', { n: drift.values.rich })
            : t('field.veinLit', { n: drift.values.plain }),
        });
      }
    }

    // ---- the three diamonds on the plumb lines --------------------------
    let anc = null, ad = ANCHOR_LABEL;
    for (const a of builder?.anchors?.list || []) {
      const d = Math.hypot(p.x - a.pos.x, p.z - a.pos.z);
      if (d < ad) { ad = d; anc = a; }
    }
    if (anc) {
      marks.push({
        pos: _tmp(anc.pos.x, anc.pos.y + 2.6, anc.pos.z),
        cls: anc.done ? 'held' : 'vein',
        text: anc.done ? t('field.anchorHeld') : t('field.anchorFind'),
      });
    }

    // ---- the edge of the world -----------------------------------------
    const edge = verge?.mark?.(p);
    if (edge) marks.push({ pos: _tmp(edge.x, edge.y, edge.z), cls: 'edge', text: t('field.vergeTag') });
  }

  const _pool = [];
  let _n = 0;
  function _tmp(x, y, z) {
    if (!_pool[_n]) _pool[_n] = new THREE.Vector3();
    return _pool[_n++].set(x, y, z);
  }

  function paint(camera) {
    const w = window.innerWidth, h = window.innerHeight;
    let i = 0;
    taken.length = 0;
    for (const m of marks) {
      if (i >= MARK_MAX) break;
      _v.copy(m.pos);
      const d = _v.distanceTo(camera.position);
      _v.project(camera);
      if (_v.z >= 1 || Math.abs(_v.x) > 1.05 || Math.abs(_v.y) > 1.05) continue;
      const px = (_v.x * 0.5 + 0.5) * w, py = (-_v.y * 0.5 + 0.5) * h;
      // Two labels on the same pixels are one unreadable label. The nearer
      // thing is collected first, so the loser here is always the further one.
      const halfW = 12 + m.text.length * 4.2;
      let clash = false;
      for (const q of taken) {
        if (Math.abs(q[1] - py) < 22 && Math.abs(q[0] - px) < halfW + q[2]) { clash = true; break; }
      }
      if (clash) continue;
      taken.push([px, py, halfW]);
      const s = slot(i++);
      if (s.text !== m.text) { s.el.textContent = m.text; s.text = m.text; }
      const cls = `bk-tag ${m.cls}`;
      if (s.cls !== cls) { s.el.className = cls; s.cls = cls; }
      s.el.style.display = '';
      s.el.style.left = `${px}px`;
      s.el.style.top = `${py}px`;
      // fades with distance so the far side of the island is a skyline rather
      // than a spreadsheet
      s.el.style.opacity = String(Math.max(0.16, 1 - Math.max(0, d - 30) / 120));
    }
    for (; i < pool.length; i++) if (pool[i].el.style.display !== 'none') pool[i].el.style.display = 'none';
  }

  /**
   * Contact. The one behaviour the client's whole report was about: walking
   * into a ring has to do something, and if it will not open it has to say so.
   */
  function contact(dt) {
    if (knock > 0) knock -= dt;
    if (hailT > 0) hailT -= dt;
    const near = rifts.nearestAny(player.pos, RIFT_STEP);
    const off = rifts.nearestAny(player.pos, RIFT_REARM);
    if (!off) armed = true;
    if (isBusy() || !near) return;

    if (near.locked) {
      if (knock <= 0) {
        knock = KNOCK_COOL;
        rifts.refuse(near);
        hud?.flash?.(t('field.riftRefuse', { skill: blockerOf(near) }), 'bad');
      }
      return;
    }
    if (!armed) return;
    armed = false;
    onOpenRift(near);
  }

  return {
    update(dt, time, camera) {
      _n = 0;
      contact(dt);
      // A learning surface or a session beat owns the whole screen when it is
      // up; world labels underneath it are litter.
      if (isBusy()) {
        if (layer.style.display !== 'none') layer.style.display = 'none';
        return;
      }
      if (layer.style.display) layer.style.display = '';
      collect(camera);
      paint(camera);
    },
    /** The first crystal a cadet ever picks up should say what it is for. */
    firstShards() {
      if (firstShards) return;
      firstShards = true;
      hud?.say?.(t('field.shardsFor'), 7000);
    },
    dispose() { layer.remove(); },
  };
}
