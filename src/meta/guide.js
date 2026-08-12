/**
 * DIRECTION.
 *
 * The player's report, after a real session he *wanted* to keep playing:
 *
 *   "i collected 800 shards, went to all 5-7 floating islands… found some
 *    updrafts, found the 3 diamond things… unsure what to do next? not sure
 *    what to do about rifts, shards, and other things… not super sure how the
 *    player learns or proceeds etc?"
 *
 * ASCENT knew the answer the whole time and never said it. `mastery.next()`
 * returns the single highest-leverage skill for this learner on every frame —
 * the scheduler has always been the best thing in this game — but that answer
 * only ever reached the *inside* of a rift he had already found by wandering.
 * A player who has not found a rift is a player the scheduler is silent to.
 *
 * So this file is that answer, out loud, before anything has been found:
 *
 *   THE OBJECTIVE   one verb, one line, one distance, one reason it is worth
 *                   walking there, and the whole arc in ten pips underneath.
 *                   Recomputed from live state every 450 ms, never stored —
 *                   which is what makes it survive a session break for free.
 *                   There is no objective record to reload, restore, migrate or
 *                   get wrong: close the tab mid-sentence, come back next week,
 *                   and the first frame says exactly what the last frame said,
 *                   because both are a function of the same save.
 *   THE WAYPOINT    a diamond over the rift the scheduler picked, with its
 *                   distance in metres; off screen, an arrow pinned to the edge
 *                   of the frame that says which way to turn. "There is a rift
 *                   somewhere" becomes "it is that way, 140 m". Wandering to
 *                   all seven islands is now a choice.
 *   THE KEY         the interact prompt. `main.js` has always opened the
 *                   nearest rift on the interact key and nothing on screen has
 *                   ever said so — a verb with no prompt is a verb that does
 *                   not exist. It prints whichever binding the hands currently
 *                   holding the game actually use.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT DO. `src/world/beckon.js` labels every
 * interactable in the world and opens a rift you walk into; `src/world/verge.js`
 * makes the edge of the shard a place you can see. Both are better where they
 * are. This file never draws a label on an object, never opens anything, and
 * never touches the world — it points at it. The one thing it adds beside them
 * is `lexicon.js`: the sentence that says what a noun *is*, once, in Marlow's
 * voice, which a live label cannot carry without becoming an essay.
 */
import * as THREE from 'three';
import './guide.css';
import { t, num } from '../i18n/index.js';
import { resolveObjective } from './objective.js';
import { lexiconOf, createLexicon } from './lexicon.js';

/** Inside this the rift is in hand: the marker stands down and the key shows. */
const REACH = 11;

const RANK_TINT = ['#e0a06a', '#d9b48a', '#cfe0ee', '#ffdd8a', '#c9a6ff'];
const DEG = 180 / Math.PI;

export function createGuide(opts) {
  const {
    root, camera, player, rifts, mastery, comms, kit = null,
    drift = null, caches = null, builder = null, vergeR = 0,
    seen, mark, save, isBusy = () => false, frameHeld = () => false,
  } = opts;

  // ---------------------------------------------------------------- the card
  const card = document.createElement('div');
  card.className = 'gd-card';
  card.innerHTML = `
    <span class="gd-head"><i class="gd-pip"></i><u class="gd-cap"></u></span>
    <b class="gd-verb"></b>
    <span class="gd-what"></span>
    <span class="gd-where"><b class="gd-dist"></b><i class="gd-dir"></i></span>
    <span class="gd-why"></span>
    <span class="gd-lines">
      <span class="gd-pips"></span>
      <span class="gd-tally"></span>
    </span>`;
  root.appendChild(card);

  /* The chapter card sits directly beneath this one, and this one's height is
     the length of a translated sentence — so the offset cannot be a constant in
     a stylesheet. One custom property, written whenever the card resizes, and
     meta.css does the rest. */
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => {
      root.style.setProperty('--gd-h', `${Math.round(card.offsetHeight) + 10}px`);
    }).observe(card);
  }

  const el = {
    cap: card.querySelector('.gd-cap'),
    verb: card.querySelector('.gd-verb'),
    what: card.querySelector('.gd-what'),
    dist: card.querySelector('.gd-dist'),
    dir: card.querySelector('.gd-dir'),
    why: card.querySelector('.gd-why'),
    pips: card.querySelector('.gd-pips'),
    tally: card.querySelector('.gd-tally'),
  };

  // ------------------------------------------------------------- the marker
  const layer = document.createElement('div');
  layer.className = 'gd-layer';
  root.appendChild(layer);

  const pin = document.createElement('div');
  pin.className = 'gd-mark';
  pin.innerHTML = `
    <i class="gd-arrow"></i>
    <i class="gd-dia"></i>
    <span class="gd-lab"><b class="gd-nm"></b><i class="gd-m"></i></span>`;
  layer.appendChild(pin);
  const pinName = pin.querySelector('.gd-nm');
  const pinDist = pin.querySelector('.gd-m');
  const pinArrow = pin.querySelector('.gd-arrow');

  // -------------------------------------------------------------- the prompt
  const prompt = document.createElement('div');
  prompt.className = 'gd-prompt';
  prompt.innerHTML = '<kbd></kbd><span></span>';
  root.appendChild(prompt);
  const promptKey = prompt.querySelector('kbd');
  const promptText = prompt.querySelector('span');

  // ------------------------------------------------------------- the lexicon
  const lex = createLexicon({
    entries: lexiconOf({ rifts, drift, caches, builder, vergeR }),
    seen,
    mark: (k) => { mark(k); save?.(); },
    camera,
    player,
    isBusy: () => isBusy() || frameHeld(),
    /* A noun defines itself into a channel with ROOM IN IT, or not at all.
       `comms.push` appends and then truncates the queue at five, so a line
       queued behind the arrival speech is dropped on the floor — and
       `lexicon.js` would have counted it as taught and never offered it again.
       Refusing while the queue is full costs a few seconds; the entry is still
       standing and fires as soon as Marlow has caught up. */
    say: (id) => ((comms?.queue?.length ?? 0) >= 5
      ? false
      : comms?.sayKey?.('guide.n.' + id, { force: true })),
  });

  // ------------------------------------------------------------------- state
  let obj = null;
  let poll = 0;
  let shown = false;
  let ink = '';
  /* The distance and the bearing are the only two things here that change on a
     walk, so they are the only two written per frame — and a `textContent` that
     assigns the same string still dirties the node. One comparison each. */
  const last = { dist: '', dir: '', m: '', nm: '' };
  const v = new THREE.Vector3();
  const view = new THREE.Vector3();
  const fwd = new THREE.Vector3();

  /** Which key actually opens a rift on the hands currently holding the game. */
  function keyLabel() {
    const src = document.documentElement.dataset.input || 'kbm';
    if (src === 'pad') return t('guide.key.pad');
    if (src === 'touch') return t('guide.key.touch');
    return t('guide.key.kbm');
  }

  function paintCard() {
    if (!obj) { card.classList.remove('show'); shown = false; return; }
    if (!shown) { card.classList.add('show'); shown = true; }
    el.cap.textContent = t('guide.label');
    el.verb.textContent = t('guide.verb.' + obj.verb);
    el.what.textContent = t('skills.' + obj.skill);
    el.why.textContent = payLine(obj);

    const total = obj.held + obj.open + obj.locked;
    if (el.pips.childElementCount !== total) el.pips.innerHTML = '<u></u>'.repeat(total);
    const pips = el.pips.children;
    let i = 0;
    for (; i < obj.held; i++) pips[i].className = 'held';
    for (; i < obj.held + obj.open; i++) pips[i].className = 'open';
    for (; i < total; i++) pips[i].className = '';
    // "0 held · 1 open · 9 locked" was the first place a learner ever read the
    // word *held*, and nothing on the card said what it meant. While the count
    // is zero there is no number to lose, so the slot says the word instead.
    // i18n, additive — both keys are in src/i18n.
    // The pips above already show held, open and locked as colour. Until the
    // first line is held, the row below them spends its one line on the word
    // instead of on a zero.
    el.tally.textContent = obj.held === 0
      ? t('guide.tallyNew')
      : t('guide.tally', { held: obj.held, open: obj.open, locked: obj.locked });
  }

  function payLine(o) {
    if (o.pay === 'lines') return t('guide.pay.lines', { n: o.payN });
    if (o.pay === 'kit') return t('guide.pay.kit', { name: o.payName });
    if (o.pay === 'sound') return t('guide.pay.sound');
    return t('guide.pay.calm');
  }

  /** Ahead / left / right / behind, relative to where he is actually looking. */
  function relative(pos) {
    view.copy(pos).sub(camera.position);
    view.y = 0;
    if (view.lengthSq() < 1e-6) return 'ahead';
    view.normalize();
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) return 'ahead';
    fwd.normalize();
    const dot = fwd.dot(view);
    if (dot > 0.72) return 'ahead';
    if (dot < -0.4) return 'behind';
    // the sign of the cross product's y says which side of the look direction
    return (fwd.x * view.z - fwd.z * view.x) > 0 ? 'left' : 'right';
  }

  function write(node, key, text) {
    if (last[key] === text) return;
    last[key] = text;
    node.textContent = text;
  }

  function tint() {
    const r = Math.max(0, Math.min(4, Math.floor((mastery.integrity?.() || 0) * 5)));
    return RANK_TINT[r];
  }

  // ---------------------------------------------------------------------------
  // Frame
  // ---------------------------------------------------------------------------
  function update(dt) {
    const busy = isBusy() || frameHeld();

    // The objective is cheap but not free — it plays the scheduler forward —
    // and it cannot change between two frames of a walk.
    poll -= dt;
    if (poll <= 0) {
      poll = 0.45;
      obj = resolveObjective({ mastery, rifts, player, kit });
      const c = tint();
      if (c !== ink) {
        ink = c;
        for (const n of [card, layer, prompt]) n.style.setProperty('--gd-ink', c);
      }
      paintCard();
    }

    if (busy) {
      pin.classList.remove('show');
      prompt.classList.remove('show');
      lex.update(dt);
      return;
    }

    const W = root.clientWidth || innerWidth;
    const H = root.clientHeight || innerHeight;

    // ---- where the objective is, from here ---------------------------------
    if (obj) {
      const dist = player.pos.distanceTo(obj.pos);
      write(el.dist, 'dist', t('guide.metres', { n: num(Math.round(dist)) }));
      write(el.dir, 'dir', dist < REACH ? t('guide.rel.here') : t('guide.rel.' + relative(obj.pos)));
      placeMark(obj.aim || obj.pos, W, H, dist);
    } else {
      pin.classList.remove('show');
    }

    // ---- the key ------------------------------------------------------------
    // `rifts.nearest` is the exact predicate main.js opens on, so the prompt
    // can never claim a key works where it does not. Walking in works too
    // (src/world/beckon.js) — this is the faster verb, and the only place in
    // the game that has ever named the binding.
    const near = rifts.nearest?.(player.pos) || null;
    if (near) {
      promptKey.textContent = keyLabel();
      promptText.textContent = t(near.mastered ? 'guide.prompt.sound' : 'guide.prompt.open');
      prompt.classList.add('show');
    } else {
      prompt.classList.remove('show');
    }

    lex.update(dt);
  }

  /**
   * Project a world point and park the marker on it — or, when it is off
   * screen, on the edge of the band that is actually free.
   *
   * Not a uniform margin. The top strip belongs to the rig and the run band,
   * the bottom to the hotbar and Marlow, and the left to this card — an arrow
   * clamped to a symmetric inset lands underneath one of them and the player
   * is looking at a marker he cannot see. So the arrow rides a rectangle that
   * is the actual free glass, and the ray is cast from *that* rectangle's
   * centre, not the screen's, or the two disagree at the corners.
   */
  function placeMark(pos, W, H, dist) {
    if (dist < REACH) { pin.classList.remove('show'); return; }
    view.copy(pos).applyMatrix4(camera.matrixWorldInverse);
    const front = view.z < 0;
    v.copy(pos).project(camera);
    let x = (v.x * 0.5 + 0.5) * W;
    let y = (-v.y * 0.5 + 0.5) * H;
    // Behind the camera, `project` folds the point through the origin: the
    // marker then slides the *wrong* way as you turn, which is worse than no
    // marker at all. Mirror it about the centre so it always leaves the frame
    // on the side the thing actually is.
    if (!front) { x = W - x; y = H - y; }

    const L = Math.min(96, W * 0.09);
    const R = W - Math.min(96, W * 0.09);
    const T = Math.min(168, H * 0.2);
    const B = H - Math.min(164, H * 0.2);
    const off = !front || x < L || x > R || y < T || y > B;
    if (off) {
      const cx = (L + R) / 2, cy = (T + B) / 2;
      let dx = x - cx, dy = y - cy;
      if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3) dy = 1;
      const s = Math.min(((R - L) / 2) / Math.max(1e-3, Math.abs(dx)),
        ((B - T) / 2) / Math.max(1e-3, Math.abs(dy)));
      x = cx + dx * s;
      y = cy + dy * s;
      pinArrow.style.rotate = `${Math.atan2(dy, dx) * DEG + 90}deg`;
    }
    pin.classList.toggle('edge', off);
    pin.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    // On screen the marker carries the distance and nothing else: the world
    // already names that rift (src/world/beckon.js) and the objective card is
    // two hundred pixels away saying the same words. Off screen there is no
    // world label to lean on and the card is across the frame, so the name
    // comes back — it is the one state where it is doing work.
    write(pinName, 'nm', off ? t('skills.' + obj.skill) : '');
    write(pinDist, 'm', t('guide.metres', { n: num(Math.round(dist)) }));
    pin.classList.add('show');
  }

  return {
    update,
    relocalise() {
      // The cache above is keyed on the rendered string, so a language change
      // has to forget it — otherwise the distance and the bearing stay in the
      // language they were last painted in until the number happens to move.
      last.dist = last.dir = last.m = last.nm = '';
      paintCard();
    },
    /** The one thing the game is currently asking for. Critics read this. */
    state: () => (obj ? {
      verb: obj.verb, skill: obj.skill, kind: obj.kind,
      metres: Math.round(player.pos.distanceTo(obj.pos)),
      where: relative(obj.pos),
      held: obj.held, open: obj.open, locked: obj.locked,
      marker: pin.classList.contains('show'),
      offScreen: pin.classList.contains('edge'),
      prompt: prompt.classList.contains('show'),
      taught: lex.known(),
    } : null),
    reset() { lex.reset(); obj = null; },
  };
}
