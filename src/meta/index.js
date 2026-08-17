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
  ACTS, CODA, RANKS, RANK_AT, RANK_NIGHTS, RANK_INK, RANK_GLOW, rankFor, rankGate, rungProgress,
} from './arc.js';
import { blankLedger, standingOf } from './standing.js';
import { repaired } from './progress.js';
import {
  CHAPTER_AT, CHAPTER_NIGHTS, CODA_NIGHTS, codaReady, codaIn,
  tearsOf, chapterFor, chapterFrac, tearsToNext, chapterGate,
} from './shard.js';
import {
  blankDays, noteDay, noteNight, seedNights, daysSince, dispatchFor, nightBeat,
} from './days.js';
import { Comms } from './comms.js';
import { QuestCard } from './quest.js';
import { ColdOpen } from './opening.js';
import { Rite } from './rite.js';
import { Turn } from './turn.js';
import { Dossier } from './dossier.js';
import { createStandard } from './standard.js';
import {
  STAGES, MILESTONES, stageIndex, registerFor, canTutor, bankKey,
  milestoneCrossed, milestoneKey, milestoneMark,
  nightMarkReached, nightMarkKey, nightMark,
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

  /* ------------------------------------------------------------------------
     THE THIRD CLOCK (`days.js`). Nights held gate the top of the rank ladder
     and the last two chapters; days returned carry the dispatches. Both read
     the same wall clock the spacing schedule reads — `mastery.now()` — so a
     harness that moves the clock moves the story with it, and a tab left open
     overnight is not two days.
     ------------------------------------------------------------------------ */
  const days = { ...blankDays(), ...(saved.days || {}) };
  const dayMarks = new Set(saved.dayMarks || []);
  const clock = () => (mastery.now ? mastery.now() : Date.now());
  /** The engine's raw count of re-probes passed after a real gap. */
  const durableNow = () => (mastery.durableCount ? mastery.durableCount() : 0);
  seedNights(days, durableNow());
  /**
   * Nights held: separate days on which the lattice re-checked a line this
   * cadet already held and it was still there. One per day, maximum, whatever
   * else happens — see `noteNight`.
   */
  const nightsHeld = () => days.nights || 0;
  let nights = nightsHeld();
  /** The gap, in days, that this session opened with. Zero on a same-day return. */
  const gapDays = daysSince(days, clock());
  let dayGreeted = false;

  let standing = 0;
  let rank = 0;
  let shownRank = 0;
  let tears = tearsOf(ledger);
  let chapter = Math.max(saved.chapter | 0, chapterFor(tears, nightsHeld()), 1);
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
      /* ONE GREETING, NOT TWO.
         A real gap gets the night beat, because that one knows what day it is
         and what survived it — and a cadet who has just been told "you were
         away a day, nothing has fallen due, pick a rift" does not also need
         "welcome back" from the ambient bank. Same-day reloads, which have no
         night to report, keep the ambient line. */
      if (gapDays > 0) sayNightBeat();
      else setTimeout(() => comms.push(pick(vk('returning')), { tag: 'returning', force: true }), 1400);
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
  /**
   * THE DAY OPENS on the first answer, not on the first frame.
   *
   * A cadet who loads the game and walks away has not worked, and crediting
   * them with a day would make the third clock a login streak — which is the
   * one thing it must never be. One answer is the whole test.
   *
   * When a new day opens and a dispatch belongs to it, Marlow says it. Not a
   * chapter: nothing turns, nothing takes the frame, and missing it costs
   * nothing.
   */
  function openDay() {
    const { fresh, day } = noteDay(days, clock());
    if (!fresh) return;
    const d = dispatchFor(day);
    if (d && !dayMarks.has(d.id)) {
      dayMarks.add(d.id);
      setTimeout(() => { comms.sayKeys(d.lines); d.lines.forEach(mark); }, 2200);
    }
    // A day that opened may also have opened a chapter, if the nights are in.
    recompute();
    save();
  }

  /**
   * WHAT HELD WHILE YOU WERE AWAY — said once, on a real return, before
   * anything else. The number first, because that is the part a learner wants,
   * and only ever a true one: nights held come off the mastery engine's own
   * durable count and lines due come off its wall clock.
   */
  function sayNightBeat() {
    if (dayGreeted || !gapDays) return;
    dayGreeted = true;
    let w = null;
    try { w = mastery.watch?.(); } catch { /* the beat is optional */ }
    const beat = nightBeat({ nights: nightsHeld(), gap: gapDays, held: w?.due || 0 });
    if (beat) setTimeout(() => comms.sayKey(beat.key, { params: () => beat.params, force: true }), 1400);
    sayNightMark();
  }

  /**
   * THE OTHER LADDER — nights held, counted out loud.
   *
   * Seals count answers; nights held count mornings on which something already
   * known was still known, and that is the number rank, the last two chapters
   * and the coda are paced against (`days.js`). Marlow now remarks on it, once
   * per rung, for ever (`NIGHT_MARKS`, and then one every fifteen).
   *
   * Said on arrival rather than at the moment the night lands. A night is
   * credited in the middle of a session by a re-probe, and that same night can
   * open a chapter — which clears the channel — so a beat pushed there was
   * racing the ceremony it caused and losing. Arrival is quiet, the number is
   * already true, and `nightMarkReached` asks what has been *earned and not
   * heard*, so a cadet who comes back after a fortnight is not owed three
   * lines nobody will play.
   */
  function sayNightMark() {
    const m = nightMarkReached(nightsHeld());
    if (!m || seen.has(nightMark(m))) return;
    mark(nightMark(m));
    save();
    setTimeout(() => comms.push(pick(nightMarkKey(m), () => ({ n: m })), {
      tag: nightMarkKey(m), force: true,
    }), 5200);
  }

  /**
   * WHAT MARLOW KNOWS — and it is exactly what the rig is showing.
   *
   * P0 rule 3: he reads the same state the HUD does, and computes no count of
   * his own. He does not quote any of this (`statesAFigure` in
   * src/meta/progress.js drops any line that tries), but the register he speaks
   * in is chosen from it — so a cadet whose glass says the world is nearly whole
   * must not be addressed by a companion who thinks they have just arrived.
   * `integrity()` was a second, differently-scaled reading of the same idea:
   * mastered-over-ten, which is the staircase the rig stopped drawing.
   */
  function voiceState() {
    return { tears, lines, chapter, rankIndex: shownRank, integrity: repaired(mastery).frac };
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
    // A night is credited before the ladders are read, so the answer that
    // passes a re-probe is the answer that turns the chapter it bought.
    noteNight(days, clock(), durableNow());
    nights = nightsHeld();
    standing = standingOf(ledger, lines, opened);
    const now = override >= 0 ? override : rankFor(standing, nights);
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
      const ch = chapterFor(tears, nights);
      if (ch > chapter) turnChapter(ch);
    }
    liftPeak();
    // Past the last chapter the arc used to have nothing left to say, and a
    // cadet at seal one hundred and thirty heard the same six ambient lines as
    // one at seal four. These are the beats that carry the far end of a save.
    if (live) {
      /* The written milestones name their own number and the ones above them
         take it as a parameter, so what is written down is the milestone and
         never the key — one key carries all of the open-ended ones, and marking
         that would silence every beat after the first. See `milestoneMark`. */
      const m = milestoneCrossed(beforeTears, tears);
      if (m && !seen.has(milestoneMark(m))) {
        mark(milestoneMark(m));
        /* Through `pick`, not `sayKey`: the open-ended milestone key holds a
           bank of three lines, `t()` hands a bank back as an array, and the
           channel drops anything that is not a string. `sayKey` would have
           swallowed every beat above two hundred and twenty in silence. */
        setTimeout(() => comms.push(pick(milestoneKey(m), () => ({ n: m })), {
          tag: milestoneKey(m), force: true,
        }), 1500);
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
    // The watch prints "nights held", so it prints the third clock's number and
    // not the engine's raw re-probe count — ten held lines re-checked on one
    // morning is one night, not ten. See `days.js`.
    // …and, while the proof is whole but not yet closed, the number the coda
    // itself is waiting for. See `codaReady`.
    if (w) { card.setWatch({ ...w, durable: nights, codaIn: codaIn(nights) }); return; }
    card.setWatch(null);
    card.setSeals({
      tears,
      frac: chapterFrac(tears, chapter),
      toNext: tearsToNext(tears, chapter),
      chapter,
      top: chapter >= CHAPTER_AT.length,
      // WHY THE NEXT CHAPTER IS NOT HERE. One thing, never two, and named — a
      // chapter that has stopped moving without saying why reads as a bug.
      gate: chapterGate(tears, nights, chapter),
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
      // Standing first, nights second: a cadet short of both is told to work,
      // not told to come back tomorrow.
      gate: rankGate(standing, nights, rank),
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
    // The ceremony carries the objective it interrupted, so the five seconds it
    // owns the frame still say what to do next (src/meta/rite.js).
    rite.play(p.to, p.from, guide?.state?.() || null);
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
    /* THE PAY-OFF IS NOT A SUNDAY AFTERNOON'S WORK.
       The coda fired on the tenth line held and nothing else, so two hundred
       and sixty items in one unbroken sitting reached it with zero nights held
       — the whole of the writing, spent on the session least in need of it.
       Five nights, each of them a morning on which something already known was
       still known. Nothing else waits on it: the descent, the charters and the
       waystations are all open while it does, and the watch card prints the
       number (`quest.js`). See `codaReady`. */
    if (!codaReady(true, nights)) return;
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
    openDay();
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
      /* THE ONE NUMBER, not a second reading of the same idea. This handed the
         dossier `mastery.integrity()` — mastered-over-ten — while the rig two
         hundred pixels behind it was drawing `repaired()`. Both are "how much of
         the world is whole", they are on screen together the instant the dossier
         opens, and through most of a first session they disagree by everything:
         0% against 7%. See src/meta/progress.js. */
      integrity: repaired(mastery).frac,
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
        // The third clock. `chapter` is persisted with it because a chapter,
        // once opened, is never taken back — not by a demoted line, not by a
        // device with the wrong date on it.
        days, dayMarks: [...dayMarks], chapter,
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
     * Is the cold open still on screen?
     *
     * Read by src/session, which owes the cadet one set of orders and must not
     * print them through the establishing shot. It used to wait a flat
     * twenty-five seconds instead — and since the cold open ends the instant
     * the player takes a step, a cadet who walked immediately spent twenty-two
     * of those seconds already playing, then got the "before we begin" card
     * somewhere out in the meadow. Asking the beat itself when it is finished
     * is the answer that cannot drift.
     */
    openingLive: () => !cold.done,

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
      // the third clock (src/meta/days.js) — the one a long sitting cannot move
      nights, days: days.count, streak: days.streak, bestStreak: days.best,
      gapDays,
      rankGate: rankGate(standing, nights, rank),
      chapterGate: chapterGate(tears, nights, chapter),
      rankNights: RANK_NIGHTS[Math.min(RANKS.length - 1, rank + 1)] || 0,
      // The pay-off's own gate, so a critic reads the third clock's last rung
      // rather than inferring it: nights still owed, and what it costs.
      codaIn: codaIn(nights), codaNights: CODA_NIGHTS,
      chapterNights: CHAPTER_NIGHTS[Math.min(CHAPTER_AT.length - 1, chapter)] || 0,
      dispatches: [...dayMarks],
      seen: [...seen],
      // Where Marlow thinks the cadet is, and whether he is still permitted to
      // explain anything. A critic reads these rather than inferring them from
      // the transcript.
      register: reg(), stage: stg(),
      peak, canTutor: mayTutor(),
      milestones: MILESTONES.filter((m) => seen.has(milestoneMark(m))),
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
    /**
     * Critic hook: the third clock, driven the way a real night drives it.
     * `window.__ascent.advanceDays()` moves the wall clock; the nights
     * themselves are earned by passing re-probes, so this only exists to let a
     * harness assert the gates rather than to hand out ranks.
     */
    daysState: () => ({ ...days, nights, gapDays }),
    release() { override = -1; recompute(); },
    reset() { guide?.reset(); localStorage.removeItem(SAVE_KEY); },
  };
}
