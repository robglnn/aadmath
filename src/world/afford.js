import * as THREE from 'three';
import { t, num } from '../i18n/index.js';
import { resolveObjective } from '../meta/objective.js';
import { beginTagFrame, submitTag, resolveTags, tagSpaceState } from './tagspace.js';
import { routeFrom, headingTo } from './paths.js';
import { heightAt } from './terrain.js';
/* THE ONE DEFINITION OF LEFT. This file used to spell it out at the call site
   and got the sign wrong — see `paintHeading`. Read src/world/bearing.js. */
import { turn, DEG } from './bearing.js';
import './afford.css';

/**
 * THE AFFORDANCE LAYER — a verb on every live thing, and a road to the next one.
 *
 * A critic played ASCENT cold, with a real keyboard and a real mouse, and
 * scored it four out of ten. Its single largest finding, verbatim:
 *
 *   "a spent ring looks pixel-identical to a live one, and the E prompt fires
 *    once, ever… after the first proving run the player is standing in front of
 *    a glowing portal, pressing everything, and nothing happens… no prompt, no
 *    message, no second rift in sight, while the HUD insisted 4 OF 17 TEARS.
 *    The engine knows — nextObjective() returns the answer — and simply never
 *    shows it."
 *
 * Every clause of that is a different defect and this file answers three of
 * them. (The fourth — telling a live ring from a spent one — is geometry, and
 * lives next door in `rifts.js`: a held tear is now *filled* with a keystone,
 * stops turning, and drops its beam to a thread.)
 *
 *   THE CALL     A keycap and a verb, pinned to the ring itself, from seventy
 *                metres out, continuously, forever. Not a line of dialogue that
 *                fires once; not a chip that appears inside six metres. If you
 *                can see a tear you can see what it wants and which key does
 *                it, and that sentence is true on the first frame of the game
 *                and on the four-hundredth tear of the tenth session.
 *   THE HEADING  A needle and a distance, where a compass goes. `nextObjective()`
 *                has always known which line is worth the most to this learner
 *                right now; this is that answer with a bearing on it, updated
 *                live as you walk. "4 OF 17 TEARS" becomes "that way, 140 m".
 *   THE ROAD     …and the same answer in the world, because a HUD chip is a
 *                thing you have to be told to read. A gold column stands over
 *                the tear the scheduler picked, with chevrons falling down it.
 *                Every rift already casts a cyan beam, so gold — a colour
 *                nothing else in the sky is — reads as *this one, next* from
 *                the far side of the island without a word of UI.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It never opens anything and never mutates a
 * rift: walking onto the plate and pressing the key both belong to
 * `beckon.js` / `main.js`, and this file would be a second, disagreeing source
 * of truth about when a tear opens. The one exception is a thumb: a phone has
 * no E key, so on a touch device the plate *is* the button, and it forwards to
 * exactly the same callback the world's own contact test does.
 */

const CALL_R = 78;        // metres: a tear starts advertising itself from here
const CALL_MAX = 3;       // …and never more than three marks in one frame
// …of which only this many are allowed to be a *sentence*. A second critic
// counted four instructional labels and a talking companion on the arrival
// frame and set it beside Breath of the Wild: "BOTW earns the next ten minutes
// with a horizon; ASCENT earns it with signage, and on a phone the signage
// collides with itself." One tear speaks at a time; the rest are a mark on the
// sky until you walk at them. A phone gets one, full stop.
const SPEAK_R = 34;       // metres: a tear that is not the objective speaks from here
const NARROW = 760;       // px: below this the frame has room for exactly one
const REACH = 9.0;        // matches Rifts.nearest(): inside this the key works
const POLL = 0.4;         // seconds between scheduler queries
const HEAD_MIN = 14;      // metres: below this you are there, drop the compass

/* ---------------------------------------------------------------------------
   THE COMPASS ARC — twelve points, and it gets richer as you explore.
   --------------------------------------------------------------------------- */
/** Half the arc's window, in degrees. Everything beyond it clamps to an end. */
const ARC_FOV = 90;
/** How many graduations the ruler carries over the whole circle. */
const ARC_POINTS = 12;
/** The strip's width in px. Must match `--afd-arc-w` in afford.css. */
const ARC_W = 260;

/* ---------------------------------------------------------------------------
   THE WRONG-WAY RULE — the thing nothing in this game used to do.
   --------------------------------------------------------------------------- */
/** Degrees off the road past which a heading is not a detour, it is away. */
const WW_ANGLE = 90;
/** Metres the distance may fall back before the run is considered broken. */
const WW_SLACK = 1.5;
/** Seconds of continuous wrong-way walking that buy each response. */
const WW_STEPS = [8, 16, 24];
/** …and there is never a fourth. */
const WW_MAX = WW_STEPS.length;
/** How many times one sitting may be baited. An explorer is not lost. */
const WW_LURES = 3;
/** Metres along the correct heading the bait is planted. */
const WW_BAIT_AT = 15;
/**
 * Metres per second under which nobody is walking anywhere.
 *
 * A cadet standing still and facing away from the tear — reading the card,
 * deciding, turning on the spot with the arrow keys — is not walking the wrong
 * way, and a first cut without this line called them out after eight seconds
 * of standing perfectly still. It is deliberately low, not a walking pace:
 * somebody holding W into a rock face travels about half a metre a second, and
 * they are absolutely still trying to go the wrong way.
 */
const WW_MOVE = 0.5;

/** The key cap for the hands currently holding the game. */
function keyCap() {
  const src = document.documentElement.dataset.input || 'kbm';
  // i18n-allow: key caps. "E" is a legend printed on a keyboard, "A" a legend
  // moulded into a gamepad — neither is a word, and neither is translated on
  // the hardware the player is holding. The touch cap is a word and comes from
  // the bundle like every other word does.
  if (src === 'pad') return 'A';
  if (src === 'touch') return t('afford.tap');
  return 'E';
}

export function createAfford(opts = {}) {
  const {
    uiRoot, scene, camera, player, rifts, mastery, kit = null,
    isBusy = () => false, onOpenRift = () => {},
    /**
     * THE SURVEY (src/world/errand.js). The compass arc grows one tick per
     * claimed survey mark, so exploring buys a better instrument — which is
     * Breath of the Wild's earned map for the price of one strip of pixels.
     * A function, because `errand` is built before this and reset after it.
     */
    errand = () => null,
    /** The wallet the wrong-way bait pays into (src/kit/ledger.js). */
    wallet = null,
    /** One line of Marlow, once per session, at the last escalation. */
    say = () => false,
    /**
     * Is this tear mid-stint, with an item finished and another one waiting to
     * be asked for? (src/session/stint.js)
     *
     * The tear no longer re-opens itself between the items of one arrival, so
     * the plate has to carry the offer instead — and it must say CONTINUE rather
     * than OPEN, because a cadet who has just answered a question at this ring
     * is not being asked to open anything. Same key, honest verb.
     */
    heldStint = () => false,
  } = opts;

  // ------------------------------------------------------------------ layers
  const layer = document.createElement('div');
  layer.className = 'afd-layer';
  (uiRoot || document.body).appendChild(layer);

  /**
   * THE COMPASS ARC.
   *
   * THE COMPLAINT, VERBATIM, TWICE, FROM TWO CRITICS: *"88 m between rifts,
   * four coarse direction buckets and a 26px unlabelled orange triangle is not
   * navigation. There is no compass, no path, no minimap."* The second round
   * marked it the one gap that had NOT been closed.
   *
   * So: a strip at the top of the frame that shows the ninety degrees either
   * side of where you are looking. The graduations scroll as you turn — that,
   * and nothing else, is what makes a strip read as a compass rather than as a
   * decoration — and three things ride on it:
   *
   *   THE GOLD TICK   where the road goes. One, and it is the only gold thing
   *                   on the glass. The metres ride under it, and under nothing
   *                   else, so there is one number and not nine.
   *   THE MARKS       one tick per survey mark you have CLAIMED
   *                   (src/world/errand.js). You start with none and finish
   *                   with six, so the compass is richer for having explored:
   *                   the instrument is the reward, which is how Breath of the
   *                   Wild pays for a tower without a single word of UI.
   *   THE CHEVRON     when the road is outside the window, the tick pins to
   *                   whichever end it left by and the chevron there points
   *                   further round. `.afd-needle` keeps its name and keeps
   *                   writing its rotation every frame, because
   *                   tools/critic/traverse.mjs reads that number and walks it.
   *
   * NO CARDINAL LETTERS. N/S/E/W are English initials and mean nothing in
   * Spanish or Polish. Ticks and position carry all of it.
   */
  const head = document.createElement('div');
  head.className = 'afd-head';
  head.innerHTML = `
    <span class="afd-arc">
      <i class="afd-rule"></i>
      <span class="afd-grads"></span>
      <span class="afd-pips"></span>
      <b class="afd-gold"></b>
      <i class="afd-needle"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 L20 21 L12 16.4 L4 21 Z"/></svg></i>
      <em class="afd-hdist"></em>
    </span>
    <b class="afd-hcap"></b>`;
  (uiRoot || document.body).appendChild(head);
  const needle = head.querySelector('.afd-needle');
  const headCap = head.querySelector('.afd-hcap');
  const headDist = head.querySelector('.afd-hdist');
  const goldTick = head.querySelector('.afd-gold');
  const gradBox = head.querySelector('.afd-grads');
  const pipBox = head.querySelector('.afd-pips');

  // The ruler, laid once. Twelve graduations at thirty degrees, of which about
  // seven are inside the window at any moment; the rest are parked off the end.
  const grads = [];
  for (let i = 0; i < ARC_POINTS; i++) {
    const g = document.createElement('i');
    g.className = 'afd-grad' + (i % 3 === 0 ? ' major' : '');
    gradBox.appendChild(g);
    grads.push({ el: g, yaw: (i / ARC_POINTS) * Math.PI * 2, x: -999, on: null });
  }
  // …and one tick per survey mark, made when the mark is first claimed.
  const pips = new Map();
  const goldCache = { x: -999, on: null, dist: -999 };
  const needleCache = { x: -999, on: null };

  // ---------------------------------------------------------------- the road
  const road = makeRoad();
  road.visible = false;
  scene.add(road.group);

  // --------------------------------------------------------------- the trace
  const trace = makeTrace();
  scene.add(trace.mesh);

  // ---------------------------------------------------------------- the bait
  const lure = makeLure(() => wallet);
  scene.add(lure.mesh);

  // ------------------------------------------------------------- the plates
  // A pool, reused every frame. Building DOM per frame is how a world label
  // becomes a frame-rate problem.
  const pool = [];
  function slot(i) {
    if (!pool[i]) {
      const el = document.createElement('div');
      el.className = 'afd-call';
      el.innerHTML = `
        <span class="afd-plate">
          <u class="afd-key"></u>
          <span class="afd-words"><b class="afd-verb"></b><i class="afd-what"></i></span>
          <em class="afd-far"></em>
        </span>
        <i class="afd-stem"></i><i class="afd-dot"></i>`;
      el.style.display = 'none';
      layer.appendChild(el);
      const plate = el.querySelector('.afd-plate');
      // The dot stays on the ring and the stem grows: that is how a plate that
      // has been pushed out of somebody else's way is still visibly *this*
      // ring's label and not a caption adrift in the valley.
      const stem = el.querySelector('.afd-stem');
      const rec = {
        el, plate, stem, side: 0, lift: -1,
        key: el.querySelector('.afd-key'),
        verb: el.querySelector('.afd-verb'),
        what: el.querySelector('.afd-what'),
        far: el.querySelector('.afd-far'),
        rift: null, cls: '', txt: ['', '', '', ''],
      };
      // A thumb has no keyboard. The plate is the button, and it calls exactly
      // what walking onto the plate calls.
      const tap = (e) => {
        if (!rec.rift || rec.rift.locked) return;
        // Exactly where the key works, and nowhere else. A plate is legible
        // from seventy metres, and a thumb that could open a rift by tapping
        // its label across the valley would be a fast-travel button wearing an
        // affordance's clothes — the traversal *is* the game between rifts.
        if (rifts.nearest(player.pos) !== rec.rift) return;
        e.preventDefault();
        e.stopPropagation();
        plate.classList.add('hit');
        setTimeout(() => plate.classList.remove('hit'), 130);
        onOpenRift(rec.rift);
      };
      plate.addEventListener('click', tap);
      plate.addEventListener('touchstart', tap, { passive: false });
      pool[i] = rec;
    }
    return pool[i];
  }

  // ------------------------------------------------------------------- state
  let obj = null;
  let poll = 0;
  let cap = keyCap();
  let objSpoken = false;      // is the objective's own plate on screen, in words
  const marks = [];
  const _sort = [];
  const v = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const aim = new THREE.Vector3();

  function write(node, rec, i, text) {
    if (rec.txt[i] === text) return;
    rec.txt[i] = text;
    node.textContent = text;
  }

  /** How far the plate has been pushed off its ring. The stem covers the gap. */
  function setStem(rec, px) {
    if (rec.lift === px) return;
    rec.lift = px;
    rec.stem.style.height = `${px}px`;
  }

  /** -1 the plate rides above the ring, +1 it hangs below it. */
  function setSide(rec, side) {
    if (rec.side === side) return;
    rec.side = side;
    rec.el.classList.toggle('under', side > 0);
  }

  /** The thing that has to be held before this tear will open. */
  function blockerOf(r) {
    const id = (r.blockers && r.blockers[0]) || (r.node.prereqs && r.node.prereqs[0]);
    return t('skills.' + (id || r.id));
  }

  // ---------------------------------------------------------------------------
  // Collect: which tears are talking this frame, and what they say
  // ---------------------------------------------------------------------------
  // Is the objective card (src/meta/guide.js) in the page and lit? It carries
  // the same skill, the same bearing and the same metres this compass does, off
  // the same `resolveObjective()` call — so on a 390-pixel phone "53 M" was
  // printed twice, once in a card and once in a pill, with a plate on the ring
  // saying it a third time. The pill is the fallback, not the headline.
  /* THE COMPASS PUBLISHES ITS OWN SLOT (src/ui/slots.css, TOP CENTRE).
     The top-centre column is the run band, then this arc, then the notice
     toast, and every offset in it is taken off a measured height rather than a
     number that cleared the English frame at 1600x900. The band is measured by
     src/ui/slots.js; this one is measured here, because a phone composition
     deletes the arc outright (src/ui/portrait.css, src/ui/landscape.css) and a
     literal would step the toast down 54 px on a screen with no compass on it.
     `offsetHeight` is 0 for a `display: none` element, which is exactly the
     answer wanted, and the gap is folded in so the token is THE WHOLE SLOT and
     the arithmetic in the stylesheet stays a single addition. */
  let slotH = -1;
  function publishSlot() {
    const h = head.offsetHeight;
    if (h === slotH) return;
    slotH = h;
    (uiRoot || document.body).style.setProperty(
      '--slot-compass', h > 0 ? `calc(${h}px + var(--slot-gap))` : '0px');
  }

  let guideEl = null, guideCs = null, guideUp = false;
  function pollGuide() {
    if (!guideEl || !guideEl.isConnected) {
      guideEl = document.querySelector('.gd-card');
      guideCs = guideEl ? getComputedStyle(guideEl) : null;
    }
    guideUp = !!guideCs && guideCs.display !== 'none' && guideCs.visibility !== 'hidden'
      && Number(guideCs.opacity) > 0.35;
  }

  /** Is the cold open still holding the frame? Then it holds all of it. */
  function cine() {
    return !!(uiRoot && uiRoot.classList && uiRoot.classList.contains('meta-cine'));
  }

  function collect() {
    marks.length = 0;
    _sort.length = 0;
    const p = player.pos;
    // Has this cadet ever closed a line? Until he has, the world is allowed to
    // say how a rift is opened; after that, saying it is noise.
    const taught = rifts.list.some((r) => r.mastered);
    for (const r of rifts.list) {
      const d = Math.hypot(p.x - r.foot.x, p.z - r.foot.z);
      if (d < CALL_R) _sort.push([d, r]);
    }
    _sort.sort((a, b) => a[0] - b[0]);

    let shut = 0;
    for (const [d, r] of _sort) {
      if (marks.length >= CALL_MAX) break;
      // One shut door at a time. Nine amber "you cannot come in" plates is a
      // wall of refusals, and the cadet asked none of them anything.
      if (r.locked && shut++) continue;
      const skill = t('skills.' + r.id);
      const near = d < REACH;
      const m = {
        r, d, near,
        cls: r.locked ? 'shut' : (r.mastered ? 'held' : 'live'),
        cap: r.locked ? '' : cap,
        // BEFORE THE FIRST SEAL, THE PLATE TEACHES THE MECHANIC.
        // A cold critic's own summary of what would have saved his session:
        // *"put one line of 'walk into the ring / hold W' on screen in the
        // first ten seconds"*. Walking in **is** the interaction — the key is
        // only the shortcut — and out at fifty metres the key is the one thing
        // that cannot yet be used. So until a line is held, a live tear you
        // have not reached asks to be walked into; step inside reach and it
        // becomes the verb and the key it has always been. After the first
        // seal the mechanic is learned and the plate stops explaining it.
        // …and a tear the cadet is standing at mid-stint says CONTINUE, because
        // the item waiting behind it is the second or third of an arrival they
        // already made. It used to arrive on a timer; it is now asked for, and
        // this plate is where the asking is advertised. (src/session/stint.js)
        verb: r.locked ? t('afford.shut')
          : (r.mastered ? t('afford.sound')
            : (heldStint(r.id) ? t('afford.again')
              : (!near && !taught ? t('afford.walkIn') : t('afford.open')))),
        what: r.locked ? t('afford.needs', { skill: blockerOf(r) }) : skill,
        far: d > REACH + 3 ? t('afford.metres', { n: num(Math.round(d)) }) : '',
        aim: !!(obj && obj.rift === r && !r.locked && !r.mastered),
      };
      if (near && !r.locked) m.cls += ' here';
      if (m.aim) m.cls += ' aim';
      marks.push(m);
    }

    // ---- who is allowed to be a sentence ---------------------------------
    // Exactly one tear leads: the line the scheduler is actually asking for,
    // or — failing that, or if you have walked up to something else — whatever
    // is under your feet. Everything else is a mark on the sky until you are
    // close enough for it to be about you.
    let lead = marks.find((m) => m.aim) || marks[0];
    for (const m of marks) if (m.near && !m.r.locked) lead = m;
    const room = cine() ? 1 : (innerWidth < NARROW || innerHeight < 560 ? 1 : 2);
    let said = 0;
    for (const m of marks) {
      const speaks = m === lead || (m.d < SPEAK_R && !cine());
      m.mute = !speaks || said >= room;
      if (!m.mute) said++;
      if (m === lead) m.pri = 0;
      else m.pri = m.mute ? 6 : 2;
    }
  }

  function paint() {
    const W = layer.clientWidth || innerWidth;
    const H = layer.clientHeight || innerHeight;
    objSpoken = false;
    let i = 0;
    for (const m of marks) {
      // Anchor on the ring, which is where the eye already is: the plate hangs
      // off the top of the aperture on a short needle, so it is unambiguously
      // *this ring's* label and not a caption floating in the valley.
      v.set(m.r.pos.x, m.r.pos.y + 2.9, m.r.pos.z);
      v.project(camera);
      if (v.z >= 1 || Math.abs(v.x) > 1.06 || Math.abs(v.y) > 1.12) continue;
      const px = (v.x * 0.5 + 0.5) * W;
      let py = (-v.y * 0.5 + 0.5) * H;
      // A plate hangs off the *top* of its ring, so standing at the foot of a
      // dais and looking up pushed it off the roof of the frame and through the
      // compass pill. Clamp it into the free glass and drop the needle: better
      // an unattached label you can read than an attached one you cannot.
      const TOP = 84, BOT = H - 72;
      const clamped = py < TOP || py > BOT;
      py = Math.max(TOP, Math.min(BOT, py));

      const s = slot(i++);
      s.rift = m.r;
      const cls = `afd-call ${m.cls}${clamped ? ' loose' : ''}${m.mute ? ' mute' : ''}`;
      // Rewriting className drops `under`, so the cached side goes with it.
      if (s.cls !== cls) { s.el.className = cls; s.cls = cls; s.side = 0; }
      write(s.key, s, 0, m.cap);
      s.key.style.display = m.cap ? '' : 'none';
      write(s.verb, s, 1, m.verb);
      write(s.what, s, 2, m.what);
      write(s.far, s, 3, m.far);
      s.far.style.display = m.far ? '' : 'none';
      s.el.style.display = '';
      // The far side of the island is a skyline, not a spreadsheet.
      s.el.style.opacity = String(Math.max(0.34, 1 - Math.max(0, m.d - 26) / 90));

      // A mark that is not speaking is a diamond over a ring: no box, no words,
      // nothing to collide with. It goes straight down, unbrokered.
      if (m.mute) {
        setStem(s, 14);
        s.el.style.transform = `translate(${Math.round(px)}px, ${Math.round(py)}px)`;
        continue;
      }

      // …and one that is speaking asks the ledger for room, and takes what it
      // is given — including nothing, if the frame has nothing to give.
      const aim = m.aim;
      submitTag({
        measure: s.plate,
        // 29 px is the needle the stylesheet draws by default (26 px of stem
        // plus the 3 the diamond eats), so an uncontested plate lands exactly
        // where it always did and only a contested one grows a longer one.
        x: px, y: py, gap: 29, dir: clamped ? 'mid' : 'up',
        pri: m.pri, dist: m.d,
        place: (cx, top, side, bw, bh) => {
          if (clamped) {
            s.el.style.transform = `translate(${Math.round(cx)}px, ${Math.round(top + bh / 2)}px)`;
          } else {
            setSide(s, side);
            setStem(s, Math.max(0, side < 0
              ? Math.round(py - top - bh - 3)
              : Math.round(top - py - 3)));
            s.el.style.transform = `translate(${Math.round(cx)}px, ${Math.round(py)}px)`;
          }
          if (aim) objSpoken = true;
        },
        hide: () => { s.el.style.display = 'none'; s.rift = null; },
      });
    }
    for (; i < pool.length; i++) {
      if (pool[i].el.style.display !== 'none') { pool[i].el.style.display = 'none'; pool[i].rift = null; }
    }
  }

  // ---------------------------------------------------------------------------
  // The heading, and the road
  // ---------------------------------------------------------------------------
  function paintHeading(dt, time, chrome) {
    if (!obj) {
      head.classList.remove('show');
      road.visible = false;
      road.group.visible = false;
      rifts.setLead(null);
      /* A GAP IN THE ANSWER IS NOT THE SAME AS THERE BEING NO ANSWER.
         `resolveObjective` plays the scheduler forward and is re-asked every
         400 ms; it returns null for a beat after a seal and for the odd poll
         in between. Standing the wrong-way episode DOWN on those beats wiped
         the clock and restarted it from zero — measured, on a real flight, as
         the eight-second response landing at fourteen seconds and the other
         two never landing at all. With no objective there is nothing to be
         walking away FROM, so the clock is neither run up nor run down: it
         holds, and the next poll picks the episode up where it was. The same
         argument, in the same words, is why the objective card holds its last
         answer across that gap (src/meta/guide.js `paintCard`). */
      return;
    }
    const p = player.pos;
    // The same measurement the objective card makes (src/meta/guide.js) — two
    // readouts of one distance that disagree by two metres is two instruments,
    // and a player trusts neither.
    const d = p.distanceTo(obj.pos);

    // THE COMPASS. Bearing is measured against where he is LOOKING, because
    // that is the frame a player steers in — a north-up needle is a map, and a
    // map is a thing you have to learn to read.
    //
    // AND IT POINTS DOWN THE ROAD, NOT AT THE TEAR. This file's own header says
    // why, about the chevrons: *"a straight bearing to the next tear runs
    // through the Spine about a third of the time, and a walk driven on nothing
    // but that bearing ends inside a slot canyon holding W."* The trace on the
    // ground was fixed for that and the compass above it was left pointing at
    // `obj.pos`, so the two halves of one instrument disagreed and the half a
    // player steers by was the wrong one. The arc, the chevrons and the
    // wrong-way rule now all read one number: `headingTo`, off the walk graph
    // (src/world/paths.js), which swings to the way OUT on its own when the
    // world has hold of him.
    //
    // The METRES are still the straight line, deliberately, because the
    // objective card measures the same straight line (src/meta/guide.js) and
    // two readouts of one distance that disagree are two instruments. When that
    // card moves to the walked distance this should move with it, together, on
    // the same commit.
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    const hd = headingTo(p.x, p.z, obj.pos.x, obj.pos.z);
    dir.set(Math.sin(hd.yaw), 0, Math.cos(hd.yaw));
    /* THE SIGN THAT WAS WRONG.
       This line used to read `rotate: ${-ang * DEG}deg`, which mirrors the
       needle about the screen's vertical axis: the compass pointed left for a
       rift on the right, on every frame, in every locale, for as long as the
       compass has existed. `turn()` is positive when the target is to the
       RIGHT, and a CSS rotation is positive clockwise, so the correct line is
       the number itself with no minus in front of it. This is the second of
       two handedness inversions found in one afternoon — the other was the
       objective card's own direction word (src/meta/guide.js). Neither is
       visible in a diff, and that is why the expression now lives in exactly
       one file and tools/critic/handed.mjs fails the build if a second copy
       appears. `tools/critic/traverse.mjs` reads this rotation off the glass
       and walks it, and reads it as `+deg` for the same reason. */
    const ang = turn(fwd.x, fwd.z, dir.x, dir.z);
    needle.style.rotate = `${ang * DEG}deg`;

    /* THE ARC IS UP WHENEVER THERE IS SOMEWHERE TO GO — and that is the change.
       It used to stand down whenever the objective card or the tear's own plate
       was on the glass, which is nearly always, and that is most of why two
       critics in a row wrote "there is no compass". They were reading the
       screen correctly. The reason it stood down was sound and is kept, but it
       applies to the WORDS and not to the instrument: the card prints the same
       metres off the same measurement, so `chrome` now decides who carries THE
       NUMBER rather than whether there is a compass at all. One number on the
       glass, never two, and never none. */
    if (d > HEAD_MIN && !isBusy()) {
      paintArc(ang * DEG, p);
      headCap.textContent = chrome ? t('afford.next') : '';
      headDist.textContent = chrome ? t('afford.metres', { n: num(Math.round(d)) }) : '';
      headCap.style.display = chrome ? '' : 'none';
      headDist.style.display = chrome ? '' : 'none';
      head.classList.add('show');
    } else {
      head.classList.remove('show');
    }

    // The road. It stands down once you are on the dais it points at —
    // a hundred-metre column of light shining out of the floor you are
    // standing on is not navigation, it is a wall.
    const on = d > HEAD_MIN * 0.8;
    road.group.visible = on;
    road.visible = on;
    // the lead tear's own cyan column stands down while the gold one is up
    rifts.setLead(on ? obj.skill : null);
    if (on) {
      road.group.position.set(obj.pos.x, obj.pos.y - 1.6, obj.pos.z);
      road.tick(time);
    }
    // THE WRONG-WAY RULE. Read before the trace is drawn, because the first
    // thing the world does about it is done BY the trace. `dir` is the ROAD,
    // which is where the responses point; `aim` is the straight line to the
    // tear, which is what decides whether this is a walk away at all.
    aim.set(obj.pos.x - p.x, 0, obj.pos.z - p.z);
    const call = wrongWay.update(d, fwd, dir, aim, p);
    // …and the half of it that was missing: THE GROUND BETWEEN HERE AND THERE.
    trace.update(dt, time, on ? obj : null, p, call);
  }

  /**
   * Lay the graduations, the earned ticks and the gold tick along the strip.
   *
   * `deg` is the signed turn to the road: negative is a left turn, positive a
   * right one, and the mapping from that to an x is the whole instrument.
   * Everything past the window pins to the end it left by, so the strip never
   * lies about which way round is shorter.
   */
  function paintArc(deg, p) {
    const half = ARC_W / 2;
    /* The standalone `translate` property, not `transform` — because a pip
       carries `rotate: 45deg` and the chevron carries a live rotation, and the
       individual transform properties compose in the order translate → rotate
       → scale → transform. A `transform: translateX` written after a rotation
       slides the element along its own ROTATED axis, which puts a 45° diamond
       diagonally off the strip. This order is the reason the property exists. */
    const place = (el, a, cache) => {
      const inside = Math.abs(a) <= ARC_FOV;
      const x = Math.round(half + Math.max(-1, Math.min(1, a / ARC_FOV)) * half);
      if (cache.x !== x) { cache.x = x; el.style.translate = `${x}px`; }
      if (cache.on !== inside) { cache.on = inside; el.classList.toggle('out', !inside); }
      return inside;
    };
    // the ruler
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    for (const g of grads) {
      place(g.el, turn(fwd.x, fwd.z, Math.sin(g.yaw), Math.cos(g.yaw)) * DEG, g);
    }
    // the marks this cadet has actually claimed
    const survey = errand()?.marks || [];
    for (const m of survey) {
      let pip = pips.get(m.id);
      if (!m.held) { if (pip) { pip.el.remove(); pips.delete(m.id); } continue; }
      if (!pip) {
        const el = document.createElement('i');
        el.className = 'afd-pip';
        // A tick is not a word, so it carries its name where a word cannot go:
        // a screen reader gets the landmark, everybody else gets the position.
        el.setAttribute('aria-label', t('survey.' + m.id));
        pipBox.appendChild(el);
        pip = { el, x: -999, on: null };
        pips.set(m.id, pip);
      }
      place(pip.el, turn(fwd.x, fwd.z, m.x - p.x, m.z - p.z) * DEG, pip);
    }
    // …and the one that matters. The chevron rides with it, so when the road
    // leaves the window it leaves by the side the road actually is.
    const inside = place(goldTick, deg, goldCache);
    place(needle, deg, needleCache);
    if (goldCache.dist !== goldCache.x) {
      goldCache.dist = goldCache.x;
      headDist.style.transform = `translateX(${goldCache.x}px)`;
    }
    head.classList.toggle('beyond', !inside);
  }

  // ---------------------------------------------------------------------------
  // THE WRONG-WAY RULE
  //
  // MEASURED, on the build before this one: a cold critic held W with the
  // objective 5 m away and walked until it was 196 m away, and THE WORLD DID
  // NOTHING. (The longest stretch over which that distance never fell was 34.8
  // continuous seconds — the earlier claim of 72 was wrong, the number fell
  // four times in between. The rule below needs eight, so it clears the real
  // measurement four times over.) Nothing in the game had ever noticed that a
  // player was walking away from the only thing it had asked them to do.
  //
  // THE TRIGGER. Heading more than ninety degrees off the ROAD — not off the
  // straight line to the tear, because the road curves round the Spine on
  // purpose and a detour is not a mistake — AND the distance to the objective
  // not falling. Both, continuously, for eight seconds.
  //
  // THE RESPONSES, and every one of them is the WORLD, not the HUD:
  //
  //   8 s   THE ROAD CALLS. The chevrons already lying on the walkable route
  //         reverse their pulse and light in sequence from far away to right
  //         under the boots, and brighten. It is a "come here" gesture made out
  //         of a thing that is already on screen, and it costs one number.
  //  16 s   BAIT. A short vein of cipher motes lights fifteen metres along the
  //         correct heading. It is not a sign and it is not a sentence: it is
  //         the currency this game has already taught the player to run at,
  //         planted where running at it turns them round. It really pays.
  //  24 s   ONE LINE OF MARLOW. Once per session. Never twice.
  //  32 s   NOTHING. Ever. A player who is deliberately exploring is not lost,
  //         and a game that nags an explorer has misread the only signal that
  //         matters. This is the half of the rule that keeps it civil, and
  //         tools/critic/wayfind.mjs asserts the silence as hard as it asserts
  //         the three responses.
  //
  // Turning round clears the whole state, so the road stops calling the instant
  // the player answers it — which is what makes it a conversation rather than
  // an alarm.
  // ---------------------------------------------------------------------------
  const wrongWay = (() => {
    let held = 0;          // seconds of continuous wrong-way walking
    let stage = 0;         // how many responses have been given this episode
    let low = Infinity;    // the closest this episode has been to the objective
    let saidOnce = false;  // Marlow speaks once a session, not once an episode
    let lures = 0;
    let callT = 0;         // the road's call, 0..1, fades out when it clears
    const at = [0, 0, 0];  // the second each response fired, for the gate

    /* EIGHT SECONDS MEANS EIGHT SECONDS, ON EVERY MACHINE.
       This clock deliberately does NOT use the `dt` the engine hands every
       other module, because `src/core/engine.js:650` clamps it —
       `const dt = Math.min(raw, 0.05)` — which is exactly right for physics
       (a 400 ms frame must not tunnel a cadet through a hill) and exactly
       wrong for a rule that says "eight continuous seconds of walking away".
       Under a clamp, a machine drawing 11 frames a second advances the game
       clock at 55% of real time and the world takes fourteen real seconds to
       answer. Measured: two runs of tools/critic/wayfind.mjs on the same build
       read 8.4 / 16.5 / 24.5 and 15.5 / 29.4 / 42.2, and the ratio between them
       is the frame rate. The product this is for has to run on a school
       Chromebook, so the one number a player feels is measured against the
       wall.
       The per-update cap is a quarter second: a stall counts as a stall, and a
       tab left in the background for a minute cannot bank a minute. */
    let lastMs = 0;
    let wall = 0;
    function tick() {
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      wall = lastMs ? Math.min(0.25, (now - lastMs) / 1000) : 0;
      lastMs = now;
      return wall;
    }

    function stand() {
      if (held || stage) { held = 0; stage = 0; low = Infinity; }
      lure.retire();
    }

    /** Run the clock down rather than snapping it. See `update`. */
    function fade() {
      callT = Math.max(0, callT - wall * 2);
      if (held <= 0) { stand(); return; }
      held = Math.max(0, held - wall * 2);
      if (held <= 0) stand();
    }

    /**
     * @param {number} d      metres to the objective
     * @param {THREE.Vector3} look the flattened look direction
     * @param {THREE.Vector3} rd the flattened ROAD direction — where to point
     * @param {THREE.Vector3} am the flattened straight line to the objective
     * @returns {number} the road's call, 0 (quiet) to 1 (calling)
     */
    function update(d, look, rd, am, p) {
      tick();
      // Standing at the tear is not walking away from it: that episode is over.
      if (d <= HEAD_MIN) { stand(); callT = Math.max(0, callT - wall * 2); return callT; }
      /* A CARD OWNING THE FRAME IS NOT A CHANGE OF MIND EITHER.
         While a learning surface or a full-frame beat has the input, nobody is
         walking anywhere — so the clock holds, exactly as it does for a cadet
         wedged against a rock. Running it down here made the rule's timing a
         function of how often the session happened to interrupt the walk, and
         two runs of tools/critic/wayfind.mjs measured the same three responses
         five seconds apart because of it. */
      if (isBusy()) return callT;
      /* THE HEADING IS WHERE HE IS LOOKING; THE VELOCITY ONLY SAYS WHETHER HE
         IS GOING ANYWHERE AT ALL.
         A first cut read the direction off the boots whenever they were moving
         faster than a walk, on the reasonable argument that a cadet walking
         forward while glancing over his shoulder is not lost. It made the rule
         worse in a way a probe caught: a cadet pressed against a rock face
         SLIDES, so his velocity runs along the wall while he faces — and is
         trying to go — straight away from the tear, and the rule read the wall
         as a change of mind and stood down. Six seconds of one flight went that
         way. The honest case the velocity was protecting is already protected
         by the line below: somebody genuinely walking toward the tear is
         closing on it, so `away` is false and nothing fires. */
      const vx = player.vel?.x ?? 0, vz = player.vel?.z ?? 0;
      const moving = Math.hypot(vx, vz) >= WW_MOVE;
      /* THE ANGLE IS MEASURED AGAINST THE STRAIGHT LINE, NOT AGAINST THE ROAD,
         AND THAT IS A CORRECTION TO THE DESIGN, WITH THE MEASUREMENT BEHIND IT.
         design/FIRST-90-SECONDS.md §5.3 says "heading more than 90 degrees off
         the road", for a good reason: the road curves round the Spine on
         purpose and a detour is not a mistake. Built that way, the rule was
         un-triggerable. `headingTo` is re-planned off a distance field every
         450 ms and hands over to an ESCAPE heading the moment the cadet is on
         one-way ground, and a probe of a real flight logged the road's own
         bearing going 172 deg, 42 deg, 79 deg, 139 deg, -133 deg on five
         consecutive seconds while the cadet ran in a straight line. Every one
         of those swings read as "he has changed his mind" and reset the clock,
         so the eight seconds were never reached.
         The straight line to the tear cannot swing like that. And the reason
         the design preferred the road is carried by the AND below rather than
         lost: an honest detour round a shoulder does not keep the distance
         rising for eight unbroken seconds, so it is never caught. The ROAD is
         still what every response points along, which is the half of it that
         has to be right. */
      const off = Math.abs(turn(look.x, look.z, am.x, am.z)) * DEG > WW_ANGLE;
      /* AND A CADET WALKING AT THE PLACE THE WORLD ITSELF LIT IS NOT LOST.
         The survey stands a column of violet light over one landmark at a time
         and pays 70 motes and a permanent updraft for reaching it
         (src/world/errand.js) — and every one of those landmarks is a long way
         from whatever rift the scheduler happens to want, so the errand and
         this rule were telling the same cadet two different things. Measured on
         a real walk to the standing stones: the road called at eight seconds,
         baited at sixteen and spoke at twenty-four, the whole way to a place
         the game had asked him to go.
         design/FIRST-90-SECONDS.md §5.3 ends on the sentence this answers — *a
         game that nags an explorer has misread the only signal that matters* —
         so the clock holds while he is walking at the lit mark. It holds
         rather than resets, because turning off that line puts him straight
         back where he was. Sixty degrees is a walk toward it rather than a
         bearing on it: the route round a hill is still the route. */
      const mark = errand()?.bearing?.();
      if (mark && Math.abs(turn(look.x, look.z, mark.pos.x - p.x, mark.pos.z - p.z)) * DEG < 60) return callT;
      // …and the distance has to actually be going up. A slack of a metre and a
      // half means a step down a slope, or a rock walked round, is not progress.
      if (d < low - WW_SLACK) low = d;
      const away = d >= low - WW_SLACK;
      /* AND THE CLOCK DECAYS, IT DOES NOT SNAP.
         A hard reset makes the rule hostage to one bad frame — a route
         re-plan, a rock walked round, a metre of ground that dips. It runs
         down at twice the rate it ran up, so four seconds of genuinely walking
         back clears eight seconds of walking away, and a single frame of noise
         costs a fiftieth of a second. Only when it reaches zero does the
         episode really end and the responses stand down. */
      if (!off || !away) { fade(); return callT; }
      /* WEDGED AGAINST A ROCK IS NOT A CHANGE OF MIND.
         A cadet holding W into a face travels about half a metre a second and
         goes nowhere; a probe of a real flight logged six seconds of it, at
         exactly the objective's own bearing, with the distance pinned at 139 m.
         Running the clock DOWN through that punishes somebody for being stuck,
         and running it UP counts seconds of a walk that did not happen. So it
         holds: neither confirmed nor denied, and the road goes on calling. */
      if (!moving) return callT;

      held += wall;
      while (stage < WW_MAX && held >= WW_STEPS[stage]) {
        at[stage] = Math.round(held);
        respond(stage, p, rd);
        stage++;
      }
      if (stage >= 1) callT = Math.min(1, callT + wall * 2.5);
      return callT;
    }

    function respond(step, p, rd) {
      if (step === 0) return;                       // the road calls: `callT`
      if (step === 1) {
        if (lures >= WW_LURES) return;
        lures++;
        lure.plant(p.x + rd.x * WW_BAIT_AT, p.z + rd.z * WW_BAIT_AT, rd.x, rd.z);
        return;
      }
      if (saidOnce) return;
      saidOnce = true;
      say('afford.lost');
    }

    return {
      update,
      /** What the rule has done, for tools/critic/wayfind.mjs to read back. */
      state: () => ({
        held: Math.round(held * 10) / 10, stage, at: at.slice(0, stage),
        call: Math.round(callT * 100) / 100,
        bait: lure.up(), spoke: saidOnce, lures,
      }),
      reset() { stand(); saidOnce = false; lures = 0; callT = 0; },
    };
  })();

  // ---------------------------------------------------------------------------
  // Frame
  // ---------------------------------------------------------------------------
  function update(dt, time) {
    // The scheduler is cheap but not free, and its answer cannot change between
    // two frames of a walk.
    poll -= dt;
    if (poll <= 0) {
      poll = POLL;
      try { obj = resolveObjective({ mastery, rifts, player, kit }); } catch { obj = null; }
      cap = keyCap();
      pollGuide();
      publishSlot();
    }

    // A learning surface or a full-screen beat owns the frame; world labels
    // underneath it are litter. The road stays lit — it is scenery, and it is
    // behind the card anyway.
    // One ledger, one frame. `beginTagFrame` is idempotent, so whichever world
    // layer runs first opens it; this module runs last and closes it, which is
    // what lets the tear the scheduler wants outrank a vein label written
    // several update calls earlier. (src/world/tagspace.js)
    beginTagFrame(time);

    if (isBusy()) {
      if (layer.style.display !== 'none') layer.style.display = 'none';
      objSpoken = false;
      lure.update(dt, time, player.pos);
      paintHeading(dt, time, false);
      resolveTags();
      return;
    }
    if (layer.style.display) layer.style.display = '';

    lure.update(dt, time, player.pos);
    collect();
    paint();
    // The compass is answered before it is drawn: `resolveTags` is what decides
    // whether the objective's own plate actually made it onto the glass, and a
    // pill in the corner reading "NEXT RIFT · 53 M" above a plate on the ring
    // reading "READING A VARIABLE · 53 M" is one distance printed twice.
    resolveTags();
    paintHeading(dt, time, !objSpoken && !guideUp);
  }

  return {
    update,
    /** A language change invalidates every cached string on every plate. */
    relocalise() {
      cap = keyCap();
      for (const s of pool) s.txt = ['', '', '', ''];
      // The pips carry a landmark's name for a screen reader, and a name is a
      // translated string like every other.
      for (const [id, pip] of pips) pip.el.setAttribute('aria-label', t('survey.' + id));
    },
    /** START OVER clears the sitting's one Marlow line and the bait with it. */
    reset() { wrongWay.reset(); },
    /** What the world is currently saying. Critics read this, not a summary. */
    state: () => ({
      calls: pool.filter((s) => s.el.style.display !== 'none').map((s) => ({
        id: s.rift?.id || null, cls: s.cls, verb: s.verb.textContent,
        key: s.key.style.display === 'none' ? null : s.key.textContent,
        far: s.far.textContent,
      })),
      heading: head.classList.contains('show')
        ? {
          skill: obj?.skill || null, dist: headDist.textContent,
          /* THE COMPASS, READ OFF THE GLASS. Every one of these is a painted
             pixel position or a painted rotation, not the state it was
             computed from — tools/critic/wayfind.mjs compares them against
             `camera.project()` and would not be evidence otherwise. */
          rotate: needle.style.rotate || '',
          gold: goldCache.x, beyond: head.classList.contains('beyond'),
          grads: grads.filter((g) => !g.el.classList.contains('out')).length,
          marks: [...pips.keys()],
          width: ARC_W,
        }
        : null,
      /** The wrong-way rule (see `wrongWay`). */
      wrongWay: wrongWay.state(),
      // what the screen-space ledger did with them (src/world/tagspace.js)
      space: tagSpaceState(),
      road: road.group.visible,
    }),
    dispose() {
      layer.remove(); head.remove(); scene.remove(road.group); road.dispose();
      scene.remove(trace.mesh); trace.dispose();
      scene.remove(lure.mesh); lure.dispose();
    },
  };
}

/**
 * THE ROAD — chevrons falling down the gold beacon, and a ring on the stone.
 *
 * The column itself is the rift's own beacon, turned gold by `Rifts.setLead()`
 * — see the note there for why a *second* column was the wrong answer. What is
 * left here is the part a beacon cannot say: **direction**. Three rings fall
 * down the shaft and land on a ring cut into the stone, so the marker reads as
 * a road going somewhere rather than as a bright place. Four hundred triangles,
 * two draw calls, no shadow and no light.
 */
function makeRoad() {
  const group = new THREE.Group();

  // the foot: a ring on the stone, so the column visibly lands somewhere
  const footGeo = new THREE.RingGeometry(3.2, 4.6, 40);
  footGeo.rotateX(-Math.PI / 2);
  const footMat = new THREE.MeshBasicMaterial({
    color: 0xffc46b, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const foot = new THREE.Mesh(footGeo, footMat);
  foot.position.y = 0.06;
  foot.userData.noCamBlock = true;
  foot.renderOrder = 5;
  group.add(foot);

  // three chevrons, falling
  const chevGeo = new THREE.TorusGeometry(2.5, 0.11, 6, 32);
  chevGeo.rotateX(-Math.PI / 2);
  const chevMat = new THREE.MeshBasicMaterial({
    color: 0xffd79a, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const chevs = [];
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(chevGeo, chevMat.clone());
    c.renderOrder = 5;
    group.add(c);
    chevs.push(c);
  }

  return {
    group,
    visible: false,
    tick(time) {
      footMat.opacity = 0.34 + 0.22 * Math.sin(time * 2.0);
      for (let i = 0; i < chevs.length; i++) {
        const k = ((time * 0.26 + i / chevs.length) % 1);
        const y = 3 + (1 - k) * 42;
        chevs[i].position.y = y;
        const s = 0.5 + k * 1.2;
        chevs[i].scale.setScalar(s);
        chevs[i].material.opacity = Math.min(1, k * 2.2) * (1 - k) * 1.5;
      }
    },
    dispose() {
      footGeo.dispose(); footMat.dispose();
      chevGeo.dispose();
      for (const c of chevs) c.material.dispose();
    },
  };
}

/**
 * THE BAIT — what the world puts in front of somebody who is walking away.
 *
 * The wrong-way rule's second response, and the reason it is a mesh and not a
 * message. The client's own account of a session he enjoyed opens with *"I
 * collected 800 shards"* — running at loose lattice is the one thing this game
 * had already taught him to want, before it taught him anything else. So the
 * correction is made out of that: five cipher motes light in a short vein
 * fifteen metres along the correct heading, and they pay like every other mote
 * on the island. A player who chases them has turned round, and nothing told
 * them to.
 *
 * WHY IT IS HERE AND NOT IN `src/world/drift.js`, which owns the real field:
 * a drift vein is a FIXED PLACE by design — *"a vein is a place, not a
 * spawner"*, laid once at twenty-six sites, drawn out of an InstancedMesh
 * whose count is exactly `VEINS * CLUSTER` — so there is no honest way to make
 * one appear where a walk happens to need it without changing what a vein is.
 * The silhouette is the same octahedron the currency owns everywhere else in
 * this world (design/FIRST-90-SECONDS.md §4.2: one meaning, one silhouette),
 * and it is worth the same two motes, so nothing about it is a new noun.
 *
 * It is capped: three per sitting, five motes each. That is thirty motes a
 * session for somebody who walks away from the objective repeatedly, against
 * roughly two hundred for somebody who plays — small enough that nobody will
 * ever farm it, large enough to be worth turning round for.
 */
const LURE_N = 5;
const LURE_GAP = 2.4;
const LURE_VALUE = 2;
const LURE_R = 4.2;          // matches MOTE_R in src/world/drift.js
const LURE_LIFE = 26;        // seconds it stands if nobody comes
function makeLure(getWallet) {
  const geo = new THREE.OctahedronGeometry(0.62, 0);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x8fe4ff, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, LURE_N);
  // Named so a critic can find the real object by walking the real scene graph
  // rather than asking this module whether it thinks it drew something.
  mesh.name = 'wrongway-bait';
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.renderOrder = 5;
  mesh.userData.noCamBlock = true;
  mesh.count = 0;
  mesh.visible = false;

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const sc = new THREE.Vector3(1, 1, 1);
  let motes = [];
  let life = 0;

  return {
    mesh,
    up: () => motes.some((m) => m.live),
    plant(x, z, dx, dz) {
      motes = [];
      const n = Math.hypot(dx, dz) || 1;
      for (let i = 0; i < LURE_N; i++) {
        // A short line lying ALONG the correct heading, not a ring: the shape
        // itself is a direction, so the bait says which way as well as where.
        const k = (i - (LURE_N - 1) / 2) * LURE_GAP;
        const mx = x + (dx / n) * k, mz = z + (dz / n) * k;
        const h = heightAt(mx, mz);
        if (h === null) continue;
        motes.push({ x: mx, z: mz, y: h + 1.3, ph: i * 1.3, live: true, pop: 0 });
      }
      life = LURE_LIFE;
      mesh.visible = motes.length > 0;
    },
    retire() { if (life > 0) life = Math.min(life, 1.2); },
    update(dt, time, p) {
      if (!motes.length) { mesh.visible = false; mesh.count = 0; return; }
      life -= dt;
      if (life <= 0) { motes = []; mesh.count = 0; mesh.visible = false; return; }
      let n = 0;
      for (const m of motes) {
        if (m.live) {
          if (Math.hypot(m.x - p.x, m.z - p.z) < LURE_R && Math.abs(m.y - (p.y + 0.9)) < 3.4) {
            m.live = false;
            m.pop = 1;
            // `found` is a reason the ledger already knows and already names in
            // three languages (src/kit/ledger.js) — no new noun on a receipt.
            getWallet()?.earn?.(LURE_VALUE, 'found');
          }
        } else if (m.pop > 0) {
          m.pop = Math.max(0, m.pop - dt * 1.6);
        }
        if (!m.live && m.pop <= 0) continue;
        const fade = Math.min(1, life / 1.2);
        pos.set(m.x, m.y + Math.sin(time * 1.7 + m.ph) * 0.22 + (m.live ? 0 : (1 - m.pop) * 2.2), m.z);
        q.setFromAxisAngle(up, time * 0.9 + m.ph);
        sc.setScalar((m.live ? 1 : m.pop * 2.6) * fade);
        mesh.setMatrixAt(n++, m4.compose(pos, q, sc));
      }
      mesh.count = n;
      mesh.visible = n > 0;
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}

/**
 * THE TRACE — the road, on the ground, all the way to your boots.
 *
 * THE COMPLAINT THIS ANSWERS, verbatim: *"88 m between rifts, four coarse
 * direction buckets (AHEAD / TO YOUR LEFT / TO YOUR RIGHT / BEHIND YOU) and a
 * 26px unlabelled orange triangle is not navigation. There is no compass, no
 * path, no minimap, and nothing corrects a player walking the wrong way."*
 *
 * The gold column above the tear was already right about WHERE. It could say
 * nothing at all about HOW, and on this island that is most of the problem: a
 * straight bearing to the next tear runs through the Spine about a third of the
 * time, and a walk driven on nothing but that bearing ends inside a slot canyon
 * holding W (see `src/world/paths.js` for the measurements).
 *
 * So a line of lattice chevrons lies on the ACTUAL WALKABLE ROUTE — round the
 * shoulder, up the saddle, along the vale floor — recomputed from wherever the
 * cadet is standing, so walking the wrong way redraws it from his feet instead
 * of leaving him to work it out. It is the same falling-chevron language the
 * column already uses, so the two read as one thing: *the road comes out of the
 * sky at the tear and runs along the ground to you.*
 *
 * It is also, deliberately, a **composition element**. Every frame between two
 * tears used to be foreground grass and a far hill with nothing in the middle
 * of it; a lit line running away over a rise is a leading line, a scale
 * reference and a promise, and it is in shot the whole way.
 *
 * One InstancedMesh, forty-eight chevrons, no shadow, no light, no depth write.
 */
const TRACE_N = 44;
const TRACE_GAP = 6.5;           // metres between chevrons
function makeTrace() {
  // A dart lying flat: tip forward, a notch cut out of its tail, so it reads as
  // a direction rather than as a dot.
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 3.30, -2.35, 0, -1.30, 0, 0, -0.15,
    0, 0, 3.30, 0, 0, -0.15, 2.35, 0, -1.30,
  ], 3));
  g.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 1,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.InstancedMesh(g, mat, TRACE_N);
  // …same reason. tools/critic/wayfind.mjs reads the chevrons' own colours off
  // this mesh to see whether the road is calling, which is a fact about the
  // pixels rather than a flag this file sets about itself.
  mesh.name = 'road-trace';
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 5;
  mesh.userData.noCamBlock = true;
  mesh.count = 0;
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(TRACE_N * 3), 3);
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const sc = new THREE.Vector3(1, 1, 1);
  // The route is resampled at a fixed spacing so the chevrons march evenly
  // however the A* happened to step.
  let pts = [];
  let poll = 0;
  let lastId = null;
  const GOLD = new THREE.Color(0xffc46b);

  function resample(cells, fromX, fromZ) {
    const out = [];
    if (!cells || cells.length < 2) return out;
    // Start at the cadet, not at the head of the path he is standing on.
    let acc = 0;
    let prev = [fromX, 0, fromZ];
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      let seg = Math.hypot(c[0] - prev[0], c[2] - prev[2]);
      while (seg > 0 && acc + seg >= TRACE_GAP) {
        const need = TRACE_GAP - acc;
        const k = need / seg;
        const x = prev[0] + (c[0] - prev[0]) * k;
        const z = prev[2] + (c[2] - prev[2]) * k;
        out.push([x, z]);
        if (out.length >= TRACE_N) return out;
        prev = [x, 0, z];
        seg -= need;
        acc = 0;
      }
      acc += seg;
      prev = c;
    }
    return out;
  }

  return {
    mesh,
    /**
     * @param {number} call 0 quiet, 1 CALLING. The wrong-way rule's first
     *   response, and it is one number: the pulse that normally walks outward
     *   along the road reverses and runs from the far end back to the boots,
     *   and the whole line brightens. A "come here" gesture, made out of a
     *   thing already on screen, for the price of a sign on a phase term.
     */
    update(dt, time, obj, p, call = 0) {
      if (!obj) { mesh.count = 0; mesh.visible = false; return; }
      poll -= dt;
      if (poll <= 0 || lastId !== obj.skill) {
        poll = 0.45;
        lastId = obj.skill;
        const r = routeFrom(p.x, p.z, obj.pos.x, obj.pos.z);
        pts = r ? resample(r.cells, p.x, p.z) : [];
        // No walkable route at all — the tear is on a shard of its own, or the
        // cadet is somewhere the graph does not reach. Fall back to the line,
        // because a marker that vanishes is worse than one that simplifies.
        if (!pts.length) {
          const h = headingTo(p.x, p.z, obj.pos.x, obj.pos.z);
          const n = Math.min(TRACE_N, Math.floor(h.metres / TRACE_GAP));
          for (let i = 1; i <= n; i++) {
            pts.push([p.x + Math.sin(h.yaw) * i * TRACE_GAP, p.z + Math.cos(h.yaw) * i * TRACE_GAP]);
          }
        }
      }
      const n = pts.length;
      // TWO POINTS OR NONE. A single chevron has nothing to point at, and the
      // arithmetic that worked it out read `pts[-1]` — which threw once a frame,
      // 64,746 times in one twenty-minute session, and took the rest of the
      // world's update with it every time. A route this short is a cadet
      // standing on the tear.
      mesh.visible = n > 1;
      mesh.count = n > 1 ? n : 0;
      if (n < 2) return;
      for (let i = 0; i < n; i++) {
        const a = pts[i];
        const b = pts[Math.min(n - 1, i + 1)];
        const yaw = i === n - 1 ? Math.atan2(a[0] - pts[n - 2][0], a[1] - pts[n - 2][1])
          : Math.atan2(b[0] - a[0], b[1] - a[1]);
        const gh = heightAt(a[0], a[1]);
        // Clear of the blades: grass on this island stands about 40 cm, and a
        // marker inside it is a marker nobody can see.
        pos.set(a[0], (gh === null ? 0 : gh) + 0.42, a[1]);
        q.setFromAxisAngle(up, yaw);
        // Nearest chevrons are smaller: the eye should follow the line out, not
        // trip over a metre of light at its own feet.
        const k = Math.min(1.15, 0.62 + i * 0.10);
        sc.set(k, 1, k);
        mesh.setMatrixAt(i, m4.compose(pos, q, sc));
        // A pulse walking outward, and the far end fading into the distance
        // rather than stopping dead — until the road is CALLING, when the same
        // pulse runs the other way, faster, and every chevron burns brighter.
        const wave = call > 0
          ? 0.78 + 0.52 * Math.sin(time * 4.2 + i * 0.5)
          : 0.78 + 0.52 * Math.sin(time * 2.6 - i * 0.5);
        const tail = 1 - Math.pow(i / TRACE_N, 2.2) * 0.80;
        const v = wave * tail * 1.45 * (1 + call * 1.15);
        mesh.instanceColor.setXYZ(i, GOLD.r * v, GOLD.g * v, GOLD.b * v);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    },
    dispose() { g.dispose(); mat.dispose(); },
  };
}
