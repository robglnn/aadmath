import * as THREE from 'three';
import { t } from '../i18n/index.js';
import { beginTagFrame, submitTag } from './tagspace.js';
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
// The dais crown is 5.4 m across at the top and 6.6 m at the skirt, and a cadet
// who has climbed the steps and is standing on the stone under a ring has, by
// every reading a human gives the scene, walked into it. 4.6 m meant the outer
// third of the platform silently did nothing, which is how "walk into it" —
// Marlow's own instruction — became a sentence the game did not honour.
const RIFT_STEP = 5.8;      // …and opens when you stand on its plate
const RIFT_REARM = 8.5;     // walk this far off before it will open again
const RIFT_KNOCK = 6.4;     // a shut tear notices you from here
const VEIN_LABEL = 21;      // …and the ground only names itself under your feet
// A critic counted the arrival frame: LATTICE ANCHOR, STEP ONTO THE PLATE, THE
// FOUNDRY and VAULT PLATE NEXT, all at once, with Marlow talking under them —
// "BOTW earns the next ten minutes with a horizon; ASCENT earns it with
// signage." The anchor is thirty metres from the spawn and was labelled from
// thirty-four, so it was signage about something you had not gone to look at
// yet. It reveals on approach now, like the ground and the drift already did.
const ANCHOR_LABEL = 19;
// A survey mark is a destination, not furniture: its whole job is to be the
// reason you change direction, so it names itself from far enough out to be
// that. (src/world/errand.js)
const SURVEY_LABEL = 150;
const MARK_MAX = 2;         // two chips is the most a frame may ever carry
const MARK_MAX_NARROW = 1;  // …and a phone has a third of the room, so: one
const KNOCK_COOL = 7;       // seconds before a shut tear repeats itself

export function createBeckon(opts = {}) {
  const {
    uiRoot, player, rifts, drift, builder, hud, verge,
    /**
     * The survey marks (src/world/errand.js), so a lattice instrument standing
     * on a landmark names itself from a distance instead of being one more
     * unexplained shape. Passed as a thunk because the survey is built after
     * this module in `src/main.js`, and this module must stand up without it.
     */
    errand = () => null,
    /**
     * May a WALK-IN open this tear right now? The interact key is never asked
     * — a cadet who presses it has decided — but a tear that has just given
     * three items back should not drag him in again the moment he crosses his
     * own dais on the way out. (src/session/stint.js)
     */
    canWalkIn = () => true,
    isBusy = () => false, onOpenRift = () => {},
    // The affordance layer (src/world/afford.js) took over every word this
    // module used to say about a tear, and says it with the key on it. Two
    // captions on one object is a HUD; when it is present, the tears here go
    // quiet and this module keeps the ground, the drift and the verge.
    riftTags = true,
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
    for (const r of riftTags ? rifts.list : []) {
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

    // ---- the survey marks ------------------------------------------------
    // One label, on the nearest unclaimed mark, from far enough out that it is
    // a reason to change direction rather than a caption on something you have
    // already reached. A claimed one says so too — a mark that goes silent the
    // moment it is yours teaches the player that finds are consumables.
    const survey = errand();
    if (survey?.marks) {
      let sm = null, sd = SURVEY_LABEL;
      for (const m of survey.marks) {
        const d = Math.hypot(p.x - m.x, p.z - m.z);
        if (d < sd) { sd = d; sm = m; }
      }
      if (sm) {
        marks.push({
          pos: _tmp(sm.x, sm.y + 2.4, sm.z),
          cls: sm.held ? 'held' : 'mark',
          text: sm.held
            ? t('field.markHeld', { name: t('survey.' + sm.id) })
            : t('field.markFind', { name: t('survey.' + sm.id) }),
        });
      }
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
    const cap = (w < 760 || h < 560) ? MARK_MAX_NARROW : MARK_MAX;
    let i = 0;
    for (const m of marks) {
      if (i >= cap) break;
      _v.copy(m.pos);
      const d = _v.distanceTo(camera.position);
      _v.project(camera);
      if (_v.z >= 1 || Math.abs(_v.x) > 1.05 || Math.abs(_v.y) > 1.05) continue;
      const px = (_v.x * 0.5 + 0.5) * w, py = (-_v.y * 0.5 + 0.5) * h;
      const s = slot(i++);
      if (s.text !== m.text) { s.el.textContent = m.text; s.text = m.text; }
      const cls = `bk-tag ${m.cls}`;
      if (s.cls !== cls) { s.el.className = cls; s.cls = cls; }
      s.el.style.display = '';
      // fades with distance so the far side of the island is a skyline rather
      // than a spreadsheet
      s.el.style.opacity = String(Math.max(0.16, 1 - Math.max(0, d - 30) / 120));
      // Two labels on the same pixels are one unreadable label, and this module
      // used to decide that on its own — with a width guessed from a character
      // count, against a list of only its own boxes. One ledger now holds the
      // whole screen, the companion's card and the foundry's plate included,
      // and the ground yields to the tear the scheduler is asking for.
      // (src/world/tagspace.js)
      submitTag({
        measure: s.el,
        x: px, y: py, dir: 'mid',
        pri: 10 + i, dist: d,
        place: (cx, top, side, bw, bh) => {
          s.el.style.left = `${Math.round(cx)}px`;
          s.el.style.top = `${Math.round(top + bh / 2)}px`;
        },
        hide: () => { s.el.style.display = 'none'; },
      });
    }
    for (; i < pool.length; i++) if (pool[i].el.style.display !== 'none') pool[i].el.style.display = 'none';
  }

  /**
   * Is the cadet doing something a full-screen card would wreck?
   *
   * Three things count, and each of them is a thing the player is *steering*:
   *
   *   BUILDING  the hand is out and a lattice is going up. A modal here does
   *             not just interrupt, it throws away a piece of work — the worst
   *             kind of interruption there is.
   *   GLIDING   the wing is open. Nobody has ever wanted to be taken out of
   *             the air, and a card that lands mid-flight also lands the cadet.
   *   SPRINTING flat out across the plateau, which on this island means going
   *             somewhere specific. A tear crossed at speed is scenery.
   *
   * Deliberately NOT here: walking, jogging, standing, looking around. Those
   * are how a player arrives somewhere, and arriving somewhere is the whole
   * gesture contact-to-open exists to honour.
   */
  const SPRINTING = 9.4;    // m/s — above a run, below the 11.8 top end
  function engaged() {
    if (builder?.busyBuilding) return true;
    if (player?.gliding) return true;
    if ((player?.speed ?? 0) > SPRINTING) return true;
    return false;
  }

  /**
   * Contact. The one behaviour the client's whole report was about: walking
   * into a ring has to do something, and if it will not open it has to say so.
   */
  function contact(dt) {
    if (knock > 0) knock -= dt;
    if (hailT > 0) hailT -= dt;
    // AN OPEN DOOR OUTRANKS A SHUT ONE. This used to be a plain
    // `nearestAny()`, i.e. whichever dais the boots happened to be closest to
    // — so a live tear standing beside a locked one answered a walk-in with the
    // *locked* one's refusal for every approach bearing that put the shut dais
    // a metre nearer. On the shipping graph those two were the first objective
    // in the game and the line locked behind it, and a cold critic walked into
    // the first rift five times and got a red "Rift surge" toast for it.
    // Separating the daises (src/world/rifts.js) fixes the layout; this fixes
    // the rule, because "you were standing marginally nearer the thing you
    // cannot have" is never the answer a player is asking for.
    const near = rifts.nearestLive(player.pos, RIFT_STEP)
      || rifts.nearestAny(player.pos, RIFT_STEP);
    const off = rifts.nearestAny(player.pos, RIFT_REARM);
    if (!off) armed = true;
    if (isBusy() || !near) return;
    // Busy hands get neither the card nor the toast. A red "Rift surge" thrown
    // across a half-built lattice is the same interruption in a smaller font.
    if (engaged()) return;

    if (near.locked) {
      if (knock <= 0) {
        knock = KNOCK_COOL;
        rifts.refuse(near);
        hud?.flash?.(t('field.riftRefuse', { skill: blockerOf(near) }), 'bad');
      }
      return;
    }
    // A held tear is calm: it opens on the key, never on a boot. Otherwise the
    // rift you have just finished stands between you and the one the game is
    // asking for, and crossing your own work drags you back into it.
    if (near.mastered) return;
    // …and so is a tear that has just given its three items back. Walking off
    // a dais must not be the same gesture as walking back onto it: that is the
    // exact loop a critic spent ten minutes inside. The key still works.
    if (!canWalkIn(near.id)) return;
    // ARE THEY EVEN TALKING TO YOU? — the other half of contact, added after a
    // cold critic reported "a rift that opened on contact while I was placing
    // walls".
    //
    // Contact-to-open earns its keep and stays: it is how a stranger opens
    // their first tear with no key knowledge at all, and `tools/critic/
    // coldplay.mjs` walks a cold player into one to prove it. But "walked into
    // it" and "was moving through the space it happens to occupy" are not the
    // same event, and only the first is a request.
    //
    // So a tear now waits, rather than grabs, whenever the cadet is plainly in
    // the middle of something else. It costs nothing: the plate is still lit,
    // the key is still printed on it, and the moment they stop — put the hand
    // down, level out, come off the sprint — one more step opens it. Nothing
    // is hidden and nothing is refused; the tear simply stops finishing other
    // people's sentences. (The test itself is at the top of this function, so
    // the shut-tear knock below is held to the same rule.)
    if (!armed) return;
    armed = false;
    onOpenRift(near);
  }

  return {
    update(dt, time, camera) {
      _n = 0;
      contact(dt);
      beginTagFrame(time);
      // A learning surface or a session beat owns the whole screen when it is
      // up; world labels underneath it are litter. So does the cold open, which
      // is the one frame in the game that is *supposed* to be a sky, a place
      // name and a voice — the ground can introduce itself once the cadet has
      // taken a step. (src/meta/opening.js sets `meta-cine` on #ui.)
      if (isBusy() || (uiRoot && uiRoot.classList.contains('meta-cine'))) {
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
