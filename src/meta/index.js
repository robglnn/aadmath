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
import { t, onLocaleChange } from '../i18n/index.js';

const SAVE_KEY = 'ascent.story';

export function createStory({
  root, scene, mastery, hud, input, player, rifts, fx, audio, isBusy = () => false,
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
  let started = 0;
  let override = -1;
  let pendingRite = null;
  let metRift = seen.has('story.voice.firstRift');
  let lastSkill = null;

  recompute(false);
  shownRank = rank;
  paint(rank);
  standard.setRank(rank);
  standard.setProgress(rungProgress(standing, rank));
  standard.setSeals(tears);
  refreshCard(false);
  card.show(true);

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
    comms.sayKey('story.voice.fall', { cooldown: 40 });
  };

  // -------------------------------------------------------------------------
  // Opening
  // -------------------------------------------------------------------------
  function begin() {
    if (returning) {
      setTimeout(() => comms.sayKey('story.voice.returning'), 1400);
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
    return standing - before;
  }

  /** The seal ledger on the card — the number that moves on every answer. */
  function pushSeals(gained) {
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
   * lines. If a promotion is on screen the transmission waits for it — two
   * voices over each other is how a good beat gets thrown away.
   */
  function turnChapter(n) {
    chapter = Math.max(chapter, n);
    const act = ACTS[Math.min(ACTS.length, chapter) - 1];
    refreshCard(true);
    endOpening();
    const busyWithRite = !!pendingRite || rite.el.classList.contains('show');
    setTimeout(() => turn.play(chapter, act.id, act.at), busyWithRite ? 5400 : 260);
    setTimeout(() => {
      comms.clear();
      comms.sayKeys(act.lines);
      act.lines.forEach(mark);
      save();
    }, busyWithRite ? 7000 : 1900);
    fx?.impact?.('good');
    save();
  }

  function pushRung(gained) {
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
    chapter = 6;
    refreshCard(true);
    pushSeals(false);
    turn.play(6, 'coda', tears);
    comms.clear();
    setTimeout(() => { comms.sayKeys(CODA); CODA.forEach(mark); save(); }, 1900);
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
      if (assisted) ledger.assisted++; else ledger.clean++;
      if (meta.kind === 'check') ledger.checks++;
      if (streak > (ledger.best || 0)) ledger.best = streak;
    } else {
      streak = 0;
      ledger.slips++;
    }

    const gained = recompute();

    if (!correct) {
      comms.push(pick('story.voice.wrong'), { tag: 'wrong', cooldown: 7 });
    } else if (!seen.has('story.voice.firstSeal')) {
      mark('story.voice.firstSeal');
      comms.sayKey('story.voice.firstSeal', { force: true });
      // the monument is the thing that will move for the rest of the game, so
      // it is named once, on the beat it first moves
      setTimeout(() => comms.sayKey('story.voice.standard', { force: true }), 200);
      mark('story.voice.standard');
    } else if (res?.justMastered) {
      comms.push(pick('story.voice.held', () => ({ skill: t('skills.' + id) })), { tag: 'held', force: true });
    } else if (streak >= 4 && streak % 4 === 0) {
      comms.sayKey('story.voice.streak', { cooldown: 70 });
    } else if (gained > 0) {
      comms.push(pick('story.voice.right'), { tag: 'right', cooldown: 9 });
    } else {
      // the seal term has capped: say so, once, rather than praising a point
      // that was not awarded
      comms.sayKey('story.voice.capped', { cooldown: 240 });
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
    if (comms.push(pick('story.voice.close', () => ({ skill: skill ? t('skills.' + skill) : '' })), { tag: 'close', cooldown: 60 })) save();
  }

  // -------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------
  function update(dt, time) {
    comms.update(dt);
    standard.update(dt, time);
    started += dt;
    idle += dt;

    if (input.moveMag > 0.2 || input.interact) endOpening();

    if (pendingRite && !isBusy() && !dossier.open) {
      pendingRite.at += dt;
      if (pendingRite.at > 0.45) { const p = pendingRite; pendingRite = null; fireRite(p); }
    }

    poll -= dt;
    if (poll <= 0) {
      poll = 0.4;
      const m = countMastered(), o = countOpen();
      if (m !== lines || o !== opened) recompute();
      if (mastery.integrity() >= 0.999) coda();

      if (!metRift && rifts?.nearest && started > 6) {
        const near = rifts.nearest(player.pos, 26);
        if (near) {
          metRift = true;
          mark('story.voice.firstRift');
          comms.sayKey('story.voice.firstRift', { force: true });
          save();
        }
      }
    }

    if (idle > 52 && !comms.busy && !isBusy() && !dossier.open) {
      idle = -70;
      comms.push(pick('story.voice.idle'), { tag: 'idle', cooldown: 90 });
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
    const id = chapter >= 6 ? 'coda' : ACTS[Math.min(ACTS.length - 1, chapter - 1)].id;
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
        seen: [...seen], told: [...told], ledger, rank,
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
    if (dossier.open) dossier.render(dossierState());
  });

  return {
    begin, update, comms, standard, dossier, card, rite, turn,
    say: (text) => comms.say(text),
    openDossier,
    /** The transcript of this session, newest last. */
    said: () => said.map((s) => ({ ...s })),
    state: () => ({
      rank: RANKS[shownRank], rankIndex: shownRank, chapter, standing,
      toNext: shownRank < 4 ? RANK_AT[shownRank + 1] - standing : 0,
      ledger: { ...ledger }, lines, opened,
      // the fast clock, by the name the card prints
      seals: tears, tears, toChapter: tearsToNext(tears, chapter),
      seen: [...seen],
    }),
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
    reset() { localStorage.removeItem(SAVE_KEY); },
  };
}
