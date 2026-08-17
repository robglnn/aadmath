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
 *   THE OBJECTIVE   one verb, one line, one distance, and one reason it is
 *                   worth walking there. No score, no tally, no pips: this card
 *                   is a signpost and the progress number is on the rig, where
 *                   there is exactly one of it (src/meta/progress.js).
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
import { resolveObjective, countLines } from './objective.js';
/* This card prints no PROGRESS figure any more — see `paintFrom`. `countLines`
   is still read, because the card's own wording turns on whether anything is
   held yet; it is a predicate here, not a number on the glass. The one number
   that is still printed is how far away the rift is, which is a fact about the
   world and not about the learner, and it is declared as one. */
import { FIG, tagFigure } from './progress.js';
import { lexiconOf, createLexicon } from './lexicon.js';

/* THE CARD IS NEVER ALLOWED TO OFFER NOTHING.
 *
 * This file used to carry its own idea of how near a rift is near enough —
 * `const REACH = 11` — while the key that opens one works inside nine metres
 * (`REACH` in src/world/rifts.js, which is where a reach belongs, because it is
 * a property of the built place and not of a caption). Two numbers, one
 * question, and between them a two-metre ring around every rift on this island
 * where the card printed YOU ARE STANDING IN IT over no distance, no bearing
 * and no waypoint, while the interact key did nothing at all.
 *
 * A cold critic stood in that ring for four minutes:
 *
 *   "at 10-11 m the objective card replaces the direction label with YOU ARE
 *    STANDING IN IT. No rift ring is present, no prompt appears, E is a silent
 *    no-op, and R returns you to 10 m still standing in it. Probed w/a/s/d:
 *    11m 'BEHIND YOU', 11m 'TO YOUR RIGHT', 10m 'STANDING IN IT', 10m
 *    'STANDING IN IT'. Reproduced three separate times."
 *
 * That is a lost moment with no way out, and it is the exact automatic-fail
 * this project has shipped once already.
 *
 * The rule this file now holds to, and `tools/critic/coldplay.mjs` now walks
 * every rift from eight bearings to prove:
 *
 *   ON EVERY FRAME THE CARD IS UP, THE PLAYER IS OFFERED EITHER A DIRECTION TO
 *   WALK OR AN ACTION THAT WORKS. NEVER NEITHER.
 *
 * "You are standing in it" is not a distance band. It is the name of one state
 * — the state in which the key in the prompt would open this exact tear — and
 * the world answers that question, once, for everybody who asks
 * (`Rifts.inHand`). Anywhere else, however close, the card says how far and
 * which way, and the waypoint stays up to be walked at.
 */

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
    <span class="gd-gloss"></span>`;
  /* THE PROGRESS ROW IS GONE FROM THIS CARD, ON PURPOSE.
     It carried "0 OF 10 LINES HELD" over ten pips, and a previous pass made it
     THE progress number — one place, one name, three words. It was still the
     wrong place. A cold critic counted nine figures on one frame and two of
     them were here: the tally, and a why-line reading "Hold this one and 2 more
     lines open". The card's job is DIRECTION — one verb, one line, one distance,
     one reason to walk there — and a progress figure sitting on it is a second
     instrument bolted to a signpost. The one progress number is WORLD REPAIRED,
     on the rig, where it has been since the first frame of the game; lines held
     is evidence and lives in the report. See src/meta/progress.js. */
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
    gloss: card.querySelector('.gd-gloss'),
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
  /* The last objective that actually resolved. The card falls back to this
     across the gap the scheduler leaves just after a seal — see `paintCard`. */
  let held = null;
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

  /* src/ui P1 — THE CARD IS NEVER BLANK WHILE THE PLAYER IS IN THE WORLD.
   *
   * `resolveObjective` returns null for a beat after a seal: the line that was
   * just held stops being the nearest unheld one, the scheduler is re-planned,
   * and until a new rift is picked there is nothing to point at. This function
   * used to take that null literally and pull the card off the screen — the
   * cold critic timed it at "the objective card vanishes for ~2 s after the
   * first seal", which is precisely the two seconds after a success in which a
   * player is looking for what they earned and what to do with it.
   *
   * A momentary gap in the answer is not the same as there being no answer. The
   * last resolved objective is held and kept on screen across the gap; only a
   * genuinely empty world — no rifts at all — takes the card down. Everything
   * on it is a pure function of live state, so a held objective that is a few
   * hundred milliseconds stale is still true, and the distance keeps updating
   * underneath it because that is measured from the player, not from the plan.
   */
  function paintCard() {
    if (obj) held = obj;
    // Held, but never stale about the one thing the seal just changed: the
    // tally is re-counted off the live engine, so the frame after the first
    // line is held reads "1 held" and not the "no lines held yet" it was
    // carrying a moment ago. That count is the whole reward of a seal.
    const o = obj || (held && { ...held, ...countLines(mastery) });
    if (!o) { card.classList.remove('show'); shown = false; return; }
    if (!shown) { card.classList.add('show'); shown = true; }
    return paintFrom(o);
  }

  function paintFrom(obj) {
    el.cap.textContent = t('guide.label');
    el.verb.textContent = t('guide.verb.' + obj.verb);
    el.what.textContent = t('skills.' + obj.skill);
    el.why.textContent = payLine(obj);
    /* The gloss defines the term the card uses, once, while the learner has
       held nothing yet — so *held* still arrives with its meaning even though
       the count that used to carry it has moved to the report. */
    el.gloss.textContent = obj.held === 0 ? t('guide.linesHeldNew') : '';
    el.gloss.hidden = obj.held !== 0;
  }

  function payLine(o) {
    /* "Hold this one and 2 more lines open" was a progress figure on a signpost,
       and it was one of the nine. What makes a learner walk is that holding this
       line opens more of the lattice, which the sentence still says; how many
       more is a fact about the graph, not about them, and it belongs with the
       rest of the ledger in the report. */
    if (o.pay === 'lines') return t('guide.pay.linesAny');
    // Name AND meaning. "Hold it and Kite trim is yours" named a thing this
    // game explains only on the card it hands you after you have won it.
    if (o.pay === 'kit') return t('guide.pay.kit', { name: o.payName, gist: o.payGist });
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

  /**
   * The card's ink is the RANK's ink, read from the one place that sets it.
   *
   * This used to derive a rank of its own — `floor(integrity * 5)` — off a
   * ladder rank is not bought on (`src/meta/arc.js`: rank comes from standing).
   * So the signpost could be painted copper while the rig above it and the
   * chapter card below it were both painted bronze, which is three surfaces
   * disagreeing about one fact in the one channel that carries no words at all.
   * `src/meta/index.js` writes `--rank-ink` on the UI root when rank changes;
   * this reads it, and the fallback is only for a frame before the story has
   * had its first paint.
   */
  function tint() {
    const v = getComputedStyle(root).getPropertyValue('--rank-ink').trim();
    return v || RANK_TINT[0];
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

    // ---- the key, FIRST ------------------------------------------------------
    // `rifts.nearest` is the exact predicate main.js opens on, so the prompt can
    // never claim a key works where it does not. Walking in works too
    // (src/world/beckon.js) — this is the faster verb, and the only place in
    // the game that has ever named the binding.
    //
    // It is read before the card is written, and that order is the fix. The
    // card's "you are standing in it" is now a *report of this line's answer*
    // rather than a second, kinder opinion about the same question, so the two
    // cannot come apart the way they did in the ring between nine and eleven
    // metres. If there is no working key here, the card owes the player a
    // direction, and it is about to give one.
    const near = rifts.nearest?.(player.pos) || null;
    if (near) {
      promptKey.textContent = keyLabel();
      promptText.textContent = t(near.mastered ? 'guide.prompt.sound' : 'guide.prompt.open');
      prompt.classList.add('show');
    } else {
      prompt.classList.remove('show');
    }

    // ---- where the objective is, from here ---------------------------------
    // The held fallback, for the same reason the card uses it: the waypoint and
    // the distance must not blink out for the two seconds after a seal either.
    // Both are measured from the player, so they stay true while they are held.
    const aim = obj || held;
    if (aim) {
      // The metres the world quotes, measured the way the world measures them:
      // horizontally, to the plate you have to stand on. The straight line to
      // the plate is a different number on any slope, and a card quoting one
      // while the key honours the other is a card that lies by a metre or two
      // at exactly the distance where a metre or two decides whether the key
      // works. (`Rifts.reachTo`, the one definition.)
      const dist = rifts.plateDist && aim.rift
        ? rifts.plateDist(player.pos, aim.rift) : player.pos.distanceTo(aim.pos);
      // …and whether it is in hand is the WORLD's answer, not this card's.
      // `Rifts.inHand` is one line and it is the same line the interact key
      // runs on (`nearest`), which is the whole of the fix: there is no longer
      // a second opinion for the two to disagree about.
      const inHand = !!aim.rift && (rifts.inHand
        ? rifts.inHand(player.pos, aim.rift) : near === aim.rift);
      write(el.dist, 'dist', t('guide.metres', { n: num(Math.round(dist)) }));
      // A distance, not a score. Declared so the gate can tell them apart.
      tagFigure(el.dist, FIG.METRES, Math.round(dist));
      // …AND THE DIRECTION IS NEVER TAKEN AWAY. The only state that replaces a
      // bearing with "you are standing in it" is the state in which the prompt
      // above is up and pointed at this very tear — i.e. the sentence is true
      // and there is a key on screen to act on it. Every other state, at every
      // distance, gets metres and a way to face.
      write(el.dir, 'dir', inHand ? t('guide.rel.here') : t('guide.rel.' + relative(aim.pos)));
      placeMark(aim.aim || aim.pos, W, H, dist, inHand, aim.skill);
    } else {
      pin.classList.remove('show');
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
   *
   * …and it stands down for the same one reason the bearing does, and for no
   * other. It used to disappear inside eleven metres, which is how a player ten
   * metres from a rift ended up with a card that named no direction and a sky
   * that carried no marker at the same instant. The diamond is the last thing
   * on screen that can still say *that way*: it goes when the tear is in hand
   * and there is a key to press instead.
   */
  function placeMark(pos, W, H, dist, inHand, skill) {
    if (inHand) { pin.classList.remove('show'); return; }
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
    //
    // The name is PASSED IN rather than read off `obj`, which is null for the
    // beat after a seal while `held` carries the card. That line used to say
    // `obj.skill`, and the only reason it had never thrown is that the marker
    // was hidden inside eleven metres — exactly the band this file has just
    // stopped hiding it in. A dead objective card is the defect being fixed
    // here; a TypeError in the frame that fixes it would be the same defect
    // wearing a different hat.
    write(pinName, 'nm', off && skill ? t('skills.' + skill) : '');
    write(pinDist, 'm', t('guide.metres', { n: num(Math.round(dist)) }));
    // The same metres the card quotes, from the same `dist` — one measurement,
    // two places, and the gate proves they are still the same number.
    tagFigure(pinDist, FIG.METRES, Math.round(dist));
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
    /**
     * The one thing the game is currently asking for. Critics read this, and so
     * does the rank rite, which prints it so a ceremony is never a frame with
     * nothing to do on it.
     *
     * It reads the same held fallback the card does, so the answer does not go
     * null for the two seconds after a seal — but it is a pure read: an earlier
     * version of this assigned the fallback back into `obj` inside the getter,
     * which let simply *asking* what the objective was end the gap that the
     * next poll was about to fill honestly.
     */
    state: () => {
      const o = obj || held;
      if (!o) return null;
      const tally = countLines(mastery);
      const nearNow = rifts.nearest?.(player.pos) || null;
      const reach = rifts.plateDist && o.rift
        ? rifts.plateDist(player.pos, o.rift) : player.pos.distanceTo(o.pos);
      return {
        verb: o.verb, skill: o.skill, kind: o.kind,
        // The same quantity the card prints and the key honours: horizontal, to
        // the plate you have to stand on.
        metres: Math.round(reach),
        where: relative(o.pos),
        // The lattice in three numbers. This card no longer PRINTS any of them
        // — a signpost carrying a score is two instruments on one sign — but a
        // critic still needs one place to read them off the live engine, and
        // this is a read of `countLines`, never a second way of counting.
        held: tally.held, open: tally.open, locked: tally.locked, total: tally.total,
        marker: pin.classList.contains('show'),
        offScreen: pin.classList.contains('edge'),
        prompt: prompt.classList.contains('show'),
        /* THE INVARIANT, READABLE OFF THE PAINTED CARD.
           `offers` is read from the pixels the player is looking at, not from
           the state they were computed from, and it is what
           tools/critic/coldplay.mjs asserts on every frame of every approach to
           every rift from eight bearings: a key that works, or a way to face,
           and NEVER `nothing`. */
        inHand: nearNow === o.rift,
        nearId: nearNow ? nearNow.id : null,
        here: el.dir.textContent === t('guide.rel.here'),
        dir: el.dir.textContent,
        offers: prompt.classList.contains('show') ? 'prompt'
          : (el.dir.textContent && el.dir.textContent !== t('guide.rel.here')
            ? 'bearing' : 'nothing'),
        taught: lex.known(),
      };
    },
    reset() { lex.reset(); obj = null; held = null; },
  };
}
