import * as THREE from 'three';
import { t, num } from '../i18n/index.js';
import { resolveObjective } from '../meta/objective.js';
import { beginTagFrame, submitTag, resolveTags, tagSpaceState } from './tagspace.js';
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
const DEG = 180 / Math.PI;

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
  } = opts;

  // ------------------------------------------------------------------ layers
  const layer = document.createElement('div');
  layer.className = 'afd-layer';
  (uiRoot || document.body).appendChild(layer);

  const head = document.createElement('div');
  head.className = 'afd-head';
  head.innerHTML = `
    <i class="afd-needle"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 L20 21 L12 16.4 L4 21 Z"/></svg></i>
    <span class="afd-htxt">
      <b class="afd-hcap"></b><em class="afd-hdist"></em>
    </span>`;
  (uiRoot || document.body).appendChild(head);
  const needle = head.querySelector('.afd-needle');
  const headCap = head.querySelector('.afd-hcap');
  const headDist = head.querySelector('.afd-hdist');

  // ---------------------------------------------------------------- the road
  const road = makeRoad();
  road.visible = false;
  scene.add(road.group);

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
        verb: r.locked ? t('afford.shut')
          : (r.mastered ? t('afford.sound')
            : (!near && !taught ? t('afford.walkIn') : t('afford.open'))),
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
      return;
    }
    const p = player.pos;
    // The same measurement the objective card makes (src/meta/guide.js) — two
    // readouts of one distance that disagree by two metres is two instruments,
    // and a player trusts neither.
    const d = p.distanceTo(obj.pos);

    // The compass. Bearing is measured against where he is *looking*, because
    // that is the frame a player steers in — a north-up needle is a map, and a
    // map is a thing you have to learn to read.
    if (chrome && d > HEAD_MIN) {
      camera.getWorldDirection(fwd);
      fwd.y = 0;
      dir.set(obj.pos.x - p.x, 0, obj.pos.z - p.z);
      if (fwd.lengthSq() > 1e-6 && dir.lengthSq() > 1e-6) {
        fwd.normalize(); dir.normalize();
        const ang = Math.atan2(fwd.x * dir.z - fwd.z * dir.x, fwd.dot(dir));
        needle.style.rotate = `${-ang * DEG}deg`;
      }
      headCap.textContent = t('afford.next');
      headDist.textContent = t('afford.metres', { n: num(Math.round(d)) });
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
  }

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
      paintHeading(dt, time, false);
      resolveTags();
      return;
    }
    if (layer.style.display) layer.style.display = '';

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
    },
    /** What the world is currently saying. Critics read this, not a summary. */
    state: () => ({
      calls: pool.filter((s) => s.el.style.display !== 'none').map((s) => ({
        id: s.rift?.id || null, cls: s.cls, verb: s.verb.textContent,
        key: s.key.style.display === 'none' ? null : s.key.textContent,
        far: s.far.textContent,
      })),
      heading: head.classList.contains('show')
        ? { skill: obj?.skill || null, dist: headDist.textContent }
        : null,
      // what the screen-space ledger did with them (src/world/tagspace.js)
      space: tagSpaceState(),
      road: road.group.visible,
    }),
    dispose() {
      layer.remove(); head.remove(); scene.remove(road.group); road.dispose();
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
