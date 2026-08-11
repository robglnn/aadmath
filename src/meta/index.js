/**
 * The narrative spine.
 *
 * Everything in src/meta hangs off this one object: the cold open, the comms
 * channel, the chapter card, the ascension rite, the dossier and the Standard
 * in the plaza.
 *
 * It reads the game rather than being told about it. The one channel it taps
 * is `mastery.observe` — the single call every answer in the game already goes
 * through — which hands it, for free, whether the answer was right, whether it
 * was assisted, whether it was part of a proving run and whether a line just
 * closed. That is the whole learning signal, and it is what both clocks are
 * counted from. Nothing in src/learn changes to produce it.
 *
 * The two clocks (see `arc.js`, `shard.js`, `standing.js`):
 *
 *   TEARS CLOSED turn the chapter. One correct answer, one tick of the numeral
 *   on the card, a bar closing on the next act, and at four, ten, twenty and
 *   thirty-four the chapter turns, the plate draws itself across the frame and
 *   Marlow says the next three lines. Ten sealed rifts now reach chapter three
 *   instead of finishing the session in chapter one.
 *
 *   STANDING buys rank, and rank still costs mastery: the seal term caps at
 *   nine clean solves and everything above silver is held lines. That is the
 *   clock the rite and the Standard in the plaza answer to.
 *
 * It also takes the two HUD channels that were already speaking in Marlow's
 * voice, and repaints the rank word on the rig so the chip and the story can
 * never disagree.
 *
 * WHO OWNS THE FRAME. Two of the beats here take the whole screen — the rite
 * and the chapter plate — and so do three beats in src/session, which knows
 * nothing about this file and must not have to. Both of these are type over a
 * deliberately semi-transparent dim, because the world has to stay in frame, so
 * two of them at once do not stack: they composite, and the words print through
 * each other. Stacking order cannot fix that; there is no opaque layer to
 * raise. So neither beat here fires on its own clock any more. Both queue, and
 * the queue drains only when the frame is free — `frameGuard()` is the standing
 * answer to "is somebody else holding it", set by whoever else can hold it
 * (`setFrameGuard`, used by src/session). A ceremony that arrives while the
 * frame is held waits for it rather than paints through it.
 *
 * One beat does not wait: a promotion earned on the last answer of a run, which
 * the close card takes off this file with `claimRite()` and composes into
 * itself. Queueing that one would have played the rank rite *after* the résumé
 * that already lists the rank — a ceremony for something the learner had just
 * finished reading about.
 *
 * Wiring cost in main.js: create it, tick it, expose it.
 */
import './meta.css';
import {
  ACTS, CODA, RANKS, RANK_AT, RANK_INK, RANK_GLOW, rankFor, rungProgress,
} from './arc.js';
import { blankLedger, standingOf } from './standing.js';
import { CHAPTER_AT, tearsOf, chapterFor, chapterFrac, tearsToNext } from './shard.js';
import { Comms } from './comms.js';
import { QuestCard } from './quest.js';
import { ColdOpen } from './opening.js';
import { Rite } from './rite.js';
import { Turn } from './turn.js';
import { Dossier } from './dossier.js';
import { createStandard } from './standard.js';
import {
  STAGES, MILESTONES, stageIndex, registerFor, canTutor, bankKey, milestoneCrossed, milestoneKey,
} from './voice.js';
import { createGuide } from './guide.js';
import { t, onLocaleChange } from '../i18n/index.js';

const SAVE_KEY = 'ascent.story';

export function createStory({
  root, scene, mastery, hud, input, player, rifts, fx, audio, isBusy = () => false,
  // DIRECTION (src/meta/guide.js). Everything below this line is optional and
  // strictly read-only: the guide points at the world, it never touches it.
  // Opening a tear and labelling an object both belong to src/world.
  camera = null, drift = null, caches = null, builder = null, kit = null,
  vergeR = 0,
}) {
  const comms = new Comms(root);
  // Everything she says, in order, kept for the harness. A companion is judged
  // on the transcript of a real session, not on the size of its line bank, and
  // this is the cheapest way to make that transcript checkable.
  const said = [];
  comms.onLine = (item) => {
    said.push({ t: Math.round(performance.now()) / 1000, tag: item.tag, text: item.text });
    if (said.length > 200) said.shift();
  };
  const cold = new ColdOpen(root);
  const rite = new Rite(root);
  const turn = new Turn(root);
  const dossier = new Dossier(root, {
    onToggle: (open) => {
      input.uiOpen = open;
      if (open) document.exitPointerLock?.();
    },
  });
  const card = new QuestCard(root, () => openDossier());
  const standard = createStandard(scene);

  const saved = load();
  const seen = new Set(saved.seen || []);
  const returning = seen.has('story.open.l1');
  const ledger = { ...blankLedger(), ...(saved.ledger || {}) };
  const told = new Set(saved.told || []);   // per-skill "you are close" said once

  let standing = 0;
  let rank = 0;
  let shownRank = 0;
  let tears = tearsOf(ledger);
  let chapter = chapterFor(tears);
  let lines = countMastered();
  let opened = countOpen();
  let streak = 0;
  let idle = 0;
  let poll = 0;
  let watchPoll = 0;
  let started = 0;
  let override = -1;
  /* The two beats that take the whole screen never fire on their own clock —
     they queue here, and `update()` drains the queue only when the frame is
     free. See the header: two full-screen ceremonies composite rather than
     stack, so "later" is the only correct answer to "may I play now". */
  let pendingRite = null;
  const pendingTurns = [];
  /** Set by whoever else can hold the whole frame (src/session). */
  let frameGuard = () => false;
  /** Is any full-screen beat, here or elsewhere, holding the frame? */
  const frameHeld = () => rite.playing || turn.playing || dossier.open || frameGuard();
  let metRift = seen.has('story.voice.firstRift');
  let lastSkill = null;
  // How far up the voice ladder this cadet has ever been. Persisted, and only
  // ever raised: a demoted line, a re-derived standing or a critic driving the
  // state downward must never make Marlow start explaining things again.
  let peak = Math.max(0, Math.min(STAGES.length - 1, saved.peak | 0));
  let misses = 0;          // consecutive slips — feeds the slump/recover beats
  let slumped = false;

  recompute(false);
  shownRank = rank;
  paint(rank);
  standard.setRank(rank);
  standard.setProgress(rungProgress(standing, rank));
  standard.setSeals(tears);
  refreshCard(false);
  card.show(true);

  /* ------------------------------------------------------------------------
     DIRECTION. The objective, the waypoint, the interact prompt, the nouns and
     the edge of the shard. It is created here rather than in main.js because
     everything it needs already lives on this file: the `seen` set that makes a
     noun teach itself exactly once, the save that outlives the session, the
     comms channel that gives the teaching a voice, and `frameHeld()` — so a
     waypoint never paints through a rank rite. See `guide.js`.
     ------------------------------------------------------------------------ */
  const guide = camera ? createGuide({
    root, camera, player, rifts, mastery, comms, kit, drift, caches, builder,
    vergeR, seen, mark, save, isBusy, frameHeld,
  }) : null;

  // -------------------------------------------------------------------------
  // The learning signal. One wrap, and the arc can hear the whole game.
  // -------------------------------------------------------------------------
  const rawObserve = mastery.observe.bind(mastery);
  mastery.observe = (id, correct, meta = {}) => {
    const res = rawObserve(id, correct, meta);
    try { onAnswer(id, !!correct, meta, res); } catch { /* never break the loop */ }
    return res;
  };

  // -------------------------------------------------------------------------
  // Marlow takes the two HUD channels that were already speaking in her voice,
  // and every line she is handed keeps the key it came from, so a language
  // change re-says the sentence instead of stranding it.
  // -------------------------------------------------------------------------
  const rawSay = hud.say.bind(hud);
  hud.say = (text) => {
    if (!text) return;
    if (text === t('marlow.encourage')) return;          // answered by onAnswer
    if (text === t('marlow.nearMastery')) { closeToLine(); return; }
    const k = reverseKey(text);
    if (k) comms.sayKey(k.key, { params: k.params, tag: k.key + (k.of || '') });
    else comms.say(text);
  };
  hud._rawSay = rawSay;

  // The rank word on the rig is the story's word. The meter stays the HUD's
  // instrument; only the noun is taken over, so nothing on screen can call you
  // Copper while the chapter card calls you Silver.
  const rawRender = hud.render.bind(hud);
  hud.render = (s) => { rawRender(s); syncChip(); };

  const rawFlash = hud.flash.bind(hud);
  hud.flash = (text, kind) => rawFlash(text, kind);

  const rawFall = player.onFall;
  player.onFall = (...a) => {
    rawFall?.(...a);
    comms.push(pick(vk('fall')), { tag: 'fall', cooldown: 40 });
  };

  // -------------------------------------------------------------------------
  // Opening
  // -------------------------------------------------------------------------
  function begin() {
    if (returning) {
      // What "welcome back" sounds like depends entirely on who is coming back.
      setTimeout(() => comms.push(pick(vk('returning')), { tag: 'returning', force: true }), 1400);
      cold.end();
      return;
    }
    cold.begin();
    mark('story.open.l1');
    setTimeout(() => comms.sayKeys(ACTS[0].lines), 2600);
    for (const k of ACTS[0].lines) mark(k);
    save();
    setTimeout(() => cold.end(), 21000);
  }

  function endOpening() { cold.end(); }

  // -------------------------------------------------------------------------
  // Where the cadet is.
  //
  // Every ambient line Marlow says is looked up through `vk()`, so there is
  // exactly one place in this file that decides which of the four registers is
  // speaking, and exactly one predicate — `mayTutor()` — that permits an
  // explanation. See `voice.js` for the ladder and the ratchet.
  // -------------------------------------------------------------------------
  function voiceState() {
    return { tears, lines, chapter, rankIndex: shownRank, integrity: mastery.integrity() };
  }

  /** Raise the ratchet to whatever the current state has earned. Never lowers. */
  function liftPeak() {
    const i = stageIndex(voiceState());
    if (i > peak) { peak = i; return true; }
    return false;
  }

  /** The register Marlow is speaking in right now. */
  function reg() { return registerFor(voiceState(), peak); }

  /** The finer-grained stage id, after the ratchet. Seven of these, four registers. */
  function stg() {
    return STAGES[Math.min(STAGES.length - 1, Math.max(stageIndex(voiceState()), peak))].id;
  }

  /** One ambient bank, in the register this cadet has earned. */
  function vk(bank) { return bankKey(bank, reg()); }

  /**
   * May Marlow explain a basic? Only to somebody who has provably done none of
   * them — nothing sealed, no line held, no rank, no chapter turned, and
   * nothing in the ratchet. This is the whole guard; there is no second path.
   */
  function mayTutor() { return canTutor(voiceState(), peak); }

  /**
   * The first-seal beat, which names the Standard. Distinct from `mayTutor()`
   * only because by the time it is asked the seal is already counted, so the
   * honest test is "is this the first one", not "have you sealed nothing".
   */
  function mayFirstSeal() {
    return !seen.has('story.voice.firstSeal') && tears <= 1 && lines === 0 && peak <= 1;
  }

  // -------------------------------------------------------------------------
  // The two clocks: tears → chapter, standing → rank
  // -------------------------------------------------------------------------
  function recompute(live = true) {
    lines = countMastered();
    opened = countOpen();
    const before = standing;
    const beforeTears = tears;
    tears = tearsOf(ledger);
    standing = standingOf(ledger, lines, opened);
    const now = override >= 0 ? override : rankFor(standing);
    if (live) {
      standard.setProgress(rungProgress(standing, now), { kick: standing > before });
      standard.setSeals(tears);
      pushSeals(tears > beforeTears);
      pushRung(standing > before);
    }
    if (now !== rank) {
      const from = rank;
      rank = now;
      if (now > from) ascend(now, from);
      else { shownRank = now; paint(now); standard.setRank(now); refreshCard(false); syncChip(); }
    }
    // The story clock is read after the rank one, so a chapter that turns on
    // the same answer as a promotion queues behind the rite rather than under it.
    if (live && chapter < ACTS.length) {
      const ch = chapterFor(tears);
      if (ch > chapter) turnChapter(ch);
    }
    liftPeak();
    // Past the last chapter the arc used to have nothing left to say, and a
    // cadet at seal one hundred and thirty heard the same six ambient lines as
    // one at seal four. These are the beats that carry the far end of a save.
    if (live) {
      const m = milestoneCrossed(beforeTears, tears);
      if (m && !seen.has(milestoneKey(m))) {
        mark(milestoneKey(m));
        setTimeout(() => comms.sayKey(milestoneKey(m), { force: true }), 1500);
        save();
      }
    }
    return standing - before;
  }

  /**
   * THE WATCH — is the proof closed?
   *
   * Once every line in the lattice is held there is nothing left for the seal
   * ledger to count towards and the card used to say so, permanently, in the
   * present tense: "every chapter open, the proof is closed". A game that
   * announces its own ending while the player is still holding the controller
   * has stopped talking to them.
   *
   * So the two rows change hands. What the world wants tonight is the lines
   * whose spaced re-probe has come due — read straight off the mastery engine's
   * wall clock, so it is a real number about real elapsed time and not a
   * decoration — and what it is counting is nights held.
   */
  function watchNow() {
    const w = mastery.watch?.();
    if (!w || w.held < mastery.graph.nodes.length) return null;
    return w;
  }

  /** The seal ledger on the card — the number that moves on every answer. */
  function pushSeals(gained) {
    const w = watchNow();
    if (w) { card.setWatch(w); return; }
    card.setWatch(null);
    card.setSeals({
      tears,
      frac: chapterFrac(tears, chapter),
      toNext: tearsToNext(tears, chapter),
      chapter,
      top: chapter >= CHAPTER_AT.length,
      gained,
    });
  }

  /**
   * A chapter turns. This is the fast clock's payoff and it is deliberately not
   * the rite: a plate, a flare on the card, and Marlow with the next three
   * lines.
   *
   * The card and the ledger move now, because they are readouts and a readout
   * that lags the truth is a bug. The *plate* queues, because it is a ceremony:
   * it waits for the promotion, for the tear the learner is still inside, and
   * for the close card at the end of a run that turned the chapter on its last
   * answer — which is where it used to paint straight through the résumé from
   * z-index 23, four hundred milliseconds after STAND DOWN appeared.
   */
  function turnChapter(n) {
    chapter = Math.max(chapter, n);
    const act = ACTS[Math.min(ACTS.length, chapter) - 1];
    refreshCard(true);
    endOpening();
    pendingTurns.push({ n: chapter, act, at: 0 });
    fx?.impact?.('good');
    save();
  }

  /**
   * Take a plate off the screen mid-draw and put it back at the head of the
   * queue, so it plays whole rather than being talked over. Its lines are
   * re-sent with it; a chapter that arrives without them is a title card.
   */
  function parkTurn() {
    const l = turn.live;
    turn.hide();
    if (!l) return;
    const act = l.id === 'coda'
      ? { id: 'coda', lines: CODA, at: l.tears }
      : ACTS[Math.max(0, Math.min(ACTS.length, l.n) - 1)];
    pendingTurns.unshift({ n: l.n, act, at: 0 });
  }

  /** The plate, and then the transmission that belongs to it. */
  function playTurn(p) {
    turn.play(p.n, p.act.id, p.act.at);
    clearTimeout(p._t);
    p._t = setTimeout(() => {
      comms.clear();
      comms.sayKeys(p.act.lines);
      p.act.lines.forEach(mark);
      save();
    }, 1640);
  }

  function pushRung(gained) {
    // At the top of the ladder with the proof closed, this row is the watch's
    // second line and `setWatch` owns it.
    if (watchNow()) return;
    const next = rank < RANKS.length - 1 ? rank + 1 : null;
    card.setRung({
      rankName: t('rank.' + RANKS[shownRank]),
      nextName: next != null ? t('rank.' + RANKS[next]) : null,
      frac: rungProgress(standing, rank),
      have: standing,
      need: next != null ? RANK_AT[next] : standing,
      gained,
    });
  }

  function ascend(to, from) {
    shownRank = to;
    paint(to);
    syncChip();
    standard.setRank(to, { celebrate: true });
    standard.setProgress(rungProgress(standing, to));
    refreshCard(false);
    pushRung(false);
    endOpening();
    pendingRite = { to, from, at: 0 };
    save();
  }

  /**
   * The rite is now rank and nothing else: the chapters have their own clock and
   * their own plate, so a promotion no longer has to carry the story on its back
   * — which is what let four acts sit behind a number that moved once a session.
   */
  function fireRite(p) {
    // Two centred plates at once is one too many: the promotion takes the frame.
    turn.hide();
    rite.play(p.to, p.from);
    fx?.impact?.('good');
    audio?.unlocked?.();
    setTimeout(() => {
      comms.push(pick('story.voice.rank', () => ({ rank: t('rank.' + RANKS[p.to]) })), {
        tag: 'rank', force: true,
      });
    }, 3300);
  }

  function coda() {
    if (seen.has('story.coda.c1')) return;
    // The seen-marks used to be written inside the timeout, so the 0.4s poll
    // that calls this re-entered it four times before the first mark landed and
    // the pay-off line played twice. Claim the beat on the frame it is decided.
    CODA.forEach(mark);
    chapter = 6;
    refreshCard(true);
    pushSeals(false);
    comms.clear();
    /* Through the same queue as every other plate. The tenth line can perfectly
       well be held on the last answer of a run, and the pay-off of the whole
       game is not something to play underneath a close card. */
    pendingTurns.push({ n: 6, act: { id: 'coda', lines: CODA, at: tears }, at: 0 });
    save();
  }

  // -------------------------------------------------------------------------
  // What Marlow says about an answer
  // -------------------------------------------------------------------------
  function onAnswer(id, correct, meta, res) {
    lastSkill = id;
    idle = 0;
    const assisted = !!meta.assisted;
    if (correct) {
      streak++;
      misses = 0;
      if (assisted) ledger.assisted++; else ledger.clean++;
      if (meta.kind === 'check') ledger.checks++;
      if (streak > (ledger.best || 0)) ledger.best = streak;
    } else {
      streak = 0;
      misses++;
      ledger.slips++;
    }

    const gained = recompute();

    if (!correct) {
      // Three consecutive slips is a different event from one slip, and the old
      // channel had no line for it — it simply said the same wry thing a third
      // time, which is the moment a companion stops sounding like it is present.
      if (misses === 3) {
        slumped = true;
        comms.push(pick(vk('slump')), { tag: 'slump', cooldown: 100, force: true });
      } else {
        comms.push(pick(vk('wrong')), { tag: 'wrong', cooldown: 7 });
      }
    } else if (mayFirstSeal()) {
      mark('story.voice.firstSeal');
      comms.sayKey('story.voice.firstSeal', { force: true });
      // the monument is the thing that will move for the rest of the game, so
      // it is named once, on the beat it first moves
      setTimeout(() => comms.sayKey('story.voice.standard', { force: true }), 200);
      mark('story.voice.standard');
    } else if (slumped) {
      // the seal that ends a bad run: the beat a learner most needs a voice for
      slumped = false;
      comms.push(pick(vk('recover')), { tag: 'recover', force: true });
    } else if (res?.justMastered) {
      comms.push(pick(vk('held'), () => ({ skill: t('skills.' + id) })), { tag: 'held', force: true });
    } else if (streak >= 4 && streak % 4 === 0) {
      comms.push(pick(vk('streak')), { tag: 'streak', cooldown: 70 });
    } else if (gained > 0) {
      comms.push(pick(vk('right')), { tag: 'right', cooldown: 9 });
    } else {
      // the seal term has capped: say so, once, rather than praising a point
      // that was not awarded
      comms.push(pick(vk('capped')), { tag: 'capped', cooldown: 240 });
    }
    save();
  }

  /**
   * "You are one clean answer from holding this line." Said at most once per
   * skill and never twice inside a minute — the previous build fired the same
   * sentence seven times in ninety seconds, which is the single fastest way to
   * turn a companion into a notification.
   */
  function closeToLine() {
    const key = 'close:' + (lastSkill || '?');
    if (told.has(key)) return;
    told.add(key);
    const skill = lastSkill;
    if (comms.push(pick(vk('close'), () => ({ skill: skill ? t('skills.' + skill) : '' })), { tag: 'close', cooldown: 60 })) save();
  }

  // -------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------
  function update(dt, time) {
    comms.update(dt);
    standard.update(dt, time);
    guide?.update(dt);
    started += dt;
    idle += dt;

    if (input.moveMag > 0.2 || input.interact) endOpening();

    /* THE CEREMONY QUEUE. One beat may hold the frame, and it holds it alone.
       A rite goes first — rank is the scarcer event and the plate is happy to
       wait — and neither starts while a tear, the dossier or a session beat has
       the screen. The 0.45 s is the breath between the answer landing and the
       frame being taken; it is not a fix for anything. */
    if (!isBusy() && !frameHeld()) {
      if (pendingRite) {
        pendingRite.at += dt;
        if (pendingRite.at > 0.45) { const p = pendingRite; pendingRite = null; fireRite(p); }
      } else if (pendingTurns.length) {
        const p = pendingTurns[0];
        p.at += dt;
        if (p.at > 0.45) { pendingTurns.shift(); playTurn(p); }
      }
    } else if (isBusy()) {
      /* A TEAR OPENED UNDER A LIVE BEAT. The rift panel is the one surface that
         can take the screen without asking this file — a promotion does not
         take the controls, so a cadet is free to walk into a tear in the middle
         of one — and its scrim is a hole in the air rather than a floor, so a
         plate underneath it composites straight through. The beat stands down
         and goes back on the queue: it plays whole when the tear closes, which
         is a better promotion than half of one printed through a keypad. */
      if (rite.playing) { const p = rite.claim(); if (p) pendingRite = { ...p, at: 0 }; }
      if (turn.playing) parkTurn();
    }

    poll -= dt;
    if (poll <= 0) {
      poll = 0.4;
      const m = countMastered(), o = countOpen();
      if (m !== lines || o !== opened) recompute();
      if (mastery.integrity() >= 0.999) coda();
      // The watch counts down in real time, so it is repainted on its own slow
      // tick rather than only when an answer arrives — a card that says "next
      // watch in four hours" for the whole of those four hours is a clock that
      // has stopped.
      watchPoll -= 0.4;
      if (watchPoll <= 0) { watchPoll = 15; if (watchNow()) refreshCard(false); }

      // Walking up to a rift. This is where "That tear ahead of you is a rift…"
      // used to reach a Sovereign with a hundred and thirty seals: the beat was
      // gated on whether the *save* remembered saying it, so any state the save
      // had not authored re-ran the tutorial at the top of the ladder. It is
      // now gated on evidence, and the fallback is a line per register, said
      // once per register — so the approach still has a voice, and the voice
      // still knows who it is talking to.
      // Once per *stage*, not once per register: the tutorial is the landfall
      // stage's line, so keying this to the register would have spent the green
      // era on it and left `story.v.rift.green` unreachable — a bank written,
      // translated three times, and never said.
      if (rifts?.nearest && started > 6 && !seen.has('rift:' + stg())) {
        const near = rifts.nearest(player.pos, 26);
        if (near) {
          mark('rift:' + stg());
          metRift = true;
          if (mayTutor() && !seen.has('story.voice.firstRift')) {
            mark('story.voice.firstRift');
            comms.sayKey('story.voice.firstRift', { force: true });
          } else {
            comms.push(pick(vk('rift')), { tag: 'rift', force: true });
          }
          save();
        }
      }
    }

    if (idle > 52 && !comms.busy && !isBusy() && !dossier.open) {
      idle = -70;
      comms.push(pick(vk('idle')), { tag: 'idle', cooldown: 90 });
    }
  }

  // -------------------------------------------------------------------------
  // Dossier
  // -------------------------------------------------------------------------
  function dossierState() {
    return {
      integrity: mastery.integrity(),
      rank: shownRank,
      chapter,
      standing,
      tears,
      ledger,
      lines,
      opened,
      seen,
      skills: mastery.graph.nodes.map((n) => ({
        id: n.id,
        mastered: !!mastery.state.get(n.id)?.mastered,
        unlocked: mastery.isUnlocked(n.id),
      })),
    };
  }

  function openDossier() {
    if (isBusy()) return;
    if (dossier.open) dossier.close();
    else dossier.show(dossierState());
  }

  window.addEventListener('keydown', (e) => {
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
    if (e.code === 'KeyJ' && !e.repeat) { openDossier(); }
    else if (e.code === 'Escape' && dossier.open) { e.stopPropagation(); dossier.close(); }
  });

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  function refreshCard(flare) {
    const watching = !!watchNow();
    const id = watching ? 'watch' : chapter >= 6 ? 'coda' : ACTS[Math.min(ACTS.length - 1, chapter - 1)].id;
    card.set({
      n: chapter, rank: shownRank,
      title: t(`story.${id}.title`),
      quest: t(`story.${id}.quest`),
      flare,
    });
    pushSeals(false);
    pushRung(false);
  }

  function paint(i) {
    const r = RANKS[Math.max(0, Math.min(RANKS.length - 1, i))];
    root.style.setProperty('--rank-ink', RANK_INK[r]);
    root.style.setProperty('--rank-glow', RANK_GLOW[r]);
  }

  /** The rig's rank word, kept honest against the story's ladder. */
  function syncChip() {
    const r = RANKS[Math.max(0, Math.min(RANKS.length - 1, shownRank))];
    if (hud.rank) hud.rank.textContent = t('rank.' + r);
    if (hud.rig) hud.rig.dataset.rank = r;
  }

  function countMastered() {
    let n = 0;
    for (const s of mastery.state.values()) if (s.mastered) n++;
    return n;
  }

  function countOpen() {
    let n = 0;
    for (const node of mastery.graph.nodes) if (mastery.isUnlocked(node.id)) n++;
    return n;
  }

  /**
   * One line out of a bank, never the one used last time — returned as a
   * *resolver* pinned to the alternative that was chosen, not as a string. The
   * index is fixed here; the language is not. That is what lets a line queued
   * in English come out of the queue in Polish, as the same sentence, instead
   * of as a different one or as English under a Polish header.
   */
  const cursor = new Map();
  function pick(key, paramsFn) {
    const probe = t(key, paramsFn?.());
    const n = Array.isArray(probe) ? probe.length : 1;
    const prev = cursor.get(key);
    let i = prev == null ? (Math.random() * n) | 0 : (prev + 1) % n;
    if (n > 2 && i === prev) i = (i + 1) % n;
    cursor.set(key, i);
    return () => {
      const v = t(key, paramsFn?.());
      if (Array.isArray(v)) return v[i % v.length] ?? v[0] ?? '';
      return typeof v === 'string' ? v : '';
    };
  }

  /**
   * The handful of lines that reach the channel already rendered come from a
   * short, known list. Finding the key back means they survive a language
   * change like everything else instead of being dropped.
   */
  function reverseKey(text) {
    for (const k of ['build.anchorAll', 'build.anchorCall', 'build.denied']) {
      if (t(k) === text) return { key: k };
    }
    for (const n of mastery.graph.nodes) {
      const p = { skill: t('skills.' + n.id) };
      if (t('learn.mastered', p) === text) return { key: 'learn.mastered', params: () => ({ skill: t('skills.' + n.id) }), of: n.id };
      if (t('learn.unlocked', p) === text) return { key: 'learn.unlocked', params: () => ({ skill: t('skills.' + n.id) }), of: n.id };
    }
    return null;
  }

  function mark(k) { seen.add(k); }

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        seen: [...seen], told: [...told], ledger, rank, peak,
      }));
    } catch { /* private mode — the arc simply does not persist */ }
  }

  function load() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') || {}; }
    catch { return {}; }
  }

  onLocaleChange(() => {
    // A speech already in the queue is re-said, not re-typed: the opening beats
    // sit here for the best part of half a minute and must not outlive the
    // language they were rendered in.
    comms.relocalise();
    cold.retext();
    rite.retext();
    turn.retext();
    standard.relabel();
    syncChip();
    refreshCard(false);
    guide?.relocalise();
    if (dossier.open) dossier.render(dossierState());
  });

  return {
    begin, update, comms, standard, dossier, card, rite, turn,
    /** What the game is currently asking for, in one object. Critics read it. */
    guide: () => guide?.state?.() || null,
    say: (text) => comms.say(text),
    openDossier,

    /* ---------------------------------------------------------- the frame --
       Three of the game's ceremonies live in src/session, which knows nothing
       about this file. These three calls are the whole contract between them,
       and they exist so that "only one ceremony at a time" is a rule the code
       enforces rather than a thing everybody remembers. */

    /**
     * Register the standing answer to "is another ceremony holding the frame?"
     * While it is true, nothing here starts: the rite and the chapter plate
     * queue and drain afterwards. Called once, by whoever else can take the
     * screen.
     */
    setFrameGuard(fn) { frameGuard = typeof fn === 'function' ? fn : () => false; },

    /**
     * Another ceremony is taking the frame *now*. Stand down: the cold open
     * retracts (it is a stamp you are meant to be able to walk out of, and a
     * session beat arriving over it is the same thing as walking), and a plate
     * that is mid-play goes back on the queue to be played whole afterwards
     * rather than being talked over.
     */
    yieldFrame() {
      endOpening();
      if (turn.playing) parkTurn();
    },

    /**
     * Take the promotion, if there is one waiting or on screen, and with it the
     * responsibility for saying so. The close card calls this when a run ends
     * on the answer that bought a rank: the résumé composes the ascension into
     * its own first beat instead of the rite playing underneath it. Returns
     * `{ to, from, rank, was }` or null.
     */
    claimRite() {
      const p = pendingRite ? { to: pendingRite.to, from: pendingRite.from } : rite.claim();
      pendingRite = null;
      if (!p) return null;
      return {
        ...p,
        rank: RANKS[Math.max(0, Math.min(RANKS.length - 1, p.to))],
        was: p.from >= 0 && p.from !== p.to ? RANKS[Math.max(0, Math.min(RANKS.length - 1, p.from))] : null,
      };
    },
    /** The transcript of this session, newest last. */
    said: () => said.map((s) => ({ ...s })),
    state: () => ({
      rank: RANKS[shownRank], rankIndex: shownRank, chapter, standing,
      toNext: shownRank < 4 ? RANK_AT[shownRank + 1] - standing : 0,
      ledger: { ...ledger }, lines, opened,
      // the fast clock, by the name the card prints
      seals: tears, tears, toChapter: tearsToNext(tears, chapter),
      // the endgame clock: what is due tonight, and how many nights have been
      // held. Null until the proof is closed.
      watch: watchNow(),
      seen: [...seen],
      // Where Marlow thinks the cadet is, and whether he is still permitted to
      // explain anything. A critic reads these rather than inferring them from
      // the transcript.
      register: reg(), stage: stg(),
      peak, canTutor: mayTutor(),
      milestones: MILESTONES.filter((m) => seen.has(milestoneKey(m))),
    }),
    /**
     * Critic hook: the key of every ambient bank in the register this state has
     * earned, so a harness can read the *whole* bank rather than whichever line
     * the cursor happened to land on.
     */
    banks: () => Object.fromEntries(
      ['wrong', 'right', 'slump', 'recover', 'idle', 'streak', 'fall', 'returning',
        'close', 'held', 'capped', 'rift'].map((b) => [b, vk(b)]),
    ),
    /** Critic hook: pin a rank and play its rite + chapter without faking mastery. */
    preview(r) {
      const to = typeof r === 'string' ? RANKS.indexOf(r) : r;
      if (to < 0 || to > 4) return false;
      override = to;
      const from = shownRank;
      rank = to;
      ascend(to, from);
      if (pendingRite) { const p = pendingRite; pendingRite = null; fireRite(p); }
      return true;
    },
    /** Play one chapter's turn and its lines immediately. 6 = the coda. */
    beat(n) {
      comms.clear();
      const act = n >= 6 ? { lines: CODA, id: 'coda' } : ACTS[Math.max(0, Math.min(4, n - 1))];
      chapter = n;
      refreshCard(true);
      turn.play(n, act.id, act.at ?? tears);
      comms.sayKeys(act.lines);
      act.lines.forEach(mark);
      return true;
    },
    /** Critic hook: close tears the way sealed rifts do, and let the story move. */
    seal(n = 1) {
      ledger.clean += Math.max(0, n | 0);
      recompute();
      save();
      return { tears, chapter, standing };
    },
    /** Critic hook: credit standing the way clean solves would, and let it land. */
    grant(n = 1) {
      ledger.clean += Math.max(0, n | 0);
      recompute();
      save();
      return standing;
    },
    release() { override = -1; recompute(); },
    reset() { guide?.reset(); localStorage.removeItem(SAVE_KEY); },
  };
}
