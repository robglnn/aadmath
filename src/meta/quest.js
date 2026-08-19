/**
 * The chapter card: which act you are in, the question that act is about, and
 * how close the next rank is.
 *
 * This is the one piece of narrative furniture that is always on screen, so it
 * is deliberately quiet — a hairline in the rank's colour, a chapter number, a
 * title and the standing question. It flares once when the chapter turns, and
 * it is the click target for the dossier.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS CARD USED TO PRINT, AND WHY IT DOES NOT
 *
 * Three of the nine figures a cold critic counted on one frame were on this
 * card: "2 RIFTS SEALED IN ALL", "1 MORE TO CHAPTER 2" and "BRONZE · 2 TO GO".
 * All three were true. Together with the run band above them they made a strip
 * of glass carrying five different answers to "how am I doing", and one of them
 * — the rung — did something worse than disagree: it ran 10 → 7 → 2 → 18 → 15
 * and then became "SILVER · 1 NIGHT HELD". That is one label counting standing
 * points, then counting nights, with nothing on screen marking the moment it
 * changed what it counted. A counter that changes its unit mid-run is not a
 * counter; it is noise wearing a number's clothes.
 *
 * So the two clocks are still here and they are still both live — they are
 * genuinely two different things and the design of them is right — but they are
 * now **instruments rather than readouts**. Each is a bar that moves, with the
 * NAME of what is next beside it and no figure at all:
 *
 *   THE SEAL LEDGER  the bar fills toward the next chapter and flares on every
 *                    seal, so the story is visibly nearer than it was ninety
 *                    seconds ago. The line beneath names the chapter that is
 *                    coming, or says the gate is nights rather than seals.
 *   THE RUNG         the bar fills toward the next rite; the line names the
 *                    rank it is toward. Never how far. Never in what.
 *
 * The counts themselves are not gone — a teacher can read rifts sealed and
 * lines held in the report, which is a surface the learner opens on purpose.
 * The ONE number on the live HUD is WORLD REPAIRED, on the rig, and it is the
 * only figure in this game that answers "how am I doing". See
 * `src/meta/progress.js`.
 */
import { sigilSVG } from './arc.js';
import { FIG, tagFigure, untagFigure } from './progress.js';
import { t } from '../i18n/index.js';

/**
 * "in four hours", "tomorrow", "in three days" — the one place in this game
 * where a duration is printed at a learner, and it is printed about the world
 * rather than about them: it is when the lattice next needs looking at, not a
 * countdown on their attention. Rounded hard, because the difference between
 * nineteen and twenty-one hours is not a thing anybody needs.
 */
function whenText(minutes) {
  if (minutes == null) return t('story.watch.whenSoon');
  if (minutes < 90) return t('story.watch.whenMin', { n: Math.max(1, Math.round(minutes)) });
  if (minutes < 20 * 60) return t('story.watch.whenHour', { n: Math.round(minutes / 60) });
  return t('story.watch.whenDay', { n: Math.max(1, Math.round(minutes / 1440)) });
}

export class QuestCard {
  constructor(root, onOpen) {
    this.el = document.createElement('button');
    this.el.className = 'meta-quest';
    this.el.type = 'button';
    this.el.innerHTML = `
      <span class="qh">
        <span class="sig-slot"></span>
        <span class="qact"></span>
        <span class="qkey"></span>
      </span>
      <span class="qtitle"></span>
      <span class="qlabel"></span>
      <span class="qbody"></span>
      <span class="qseal">
        <span class="qs-top">
          <i class="qs-plus"></i>
          <span class="qs-lab"></span>
        </span>
        <span class="qs-track"><b></b></span>
        <span class="qs-next"></span>
      </span>
      <span class="qrung">
        <span class="qr-lab"><i class="qr-now"></i><i class="qr-next"></i></span>
        <span class="qr-track"><b></b></span>
      </span>`;
    this.slot = this.el.querySelector('.sig-slot');
    this.act = this.el.querySelector('.qact');
    this.key = this.el.querySelector('.qkey');
    this.title = this.el.querySelector('.qtitle');
    this.label = this.el.querySelector('.qlabel');
    this.body = this.el.querySelector('.qbody');
    this.seal = this.el.querySelector('.qseal');
    this.stop = this.el.querySelector('.qs-top');
    this.splus = this.el.querySelector('.qs-plus');
    this.slab = this.el.querySelector('.qs-lab');
    this.sfill = this.el.querySelector('.qs-track b');
    this.snext = this.el.querySelector('.qs-next');
    this.rung = this.el.querySelector('.qrung');
    this.rnow = this.el.querySelector('.qr-now');
    this.rnext = this.el.querySelector('.qr-next');
    this.rfill = this.el.querySelector('.qr-track b');
    this.el.addEventListener('click', () => onOpen?.());
    root.appendChild(this.el);
    this._sig = -1;
  }

  set({ n, rank, title, quest, flare = false }) {
    if (rank !== this._sig) { this.slot.innerHTML = sigilSVG(rank); this._sig = rank; }
    // "Chapter 3" — the name of the act, declared as an ordinal so a gate that
    // fails on undeclared digits does not fail on a title.
    this.act.textContent = t('story.hud.act', { n });
    tagFigure(this.act, FIG.CHAPTER_NO, n);
    this.key.textContent = t('story.hud.hint');
    this.el.setAttribute('aria-label', t('story.hud.dossier'));
    this.title.textContent = title;
    this.label.textContent = t('story.hud.question');
    this.body.textContent = quest;
    if (flare) {
      this.el.classList.remove('turn');
      void this.el.offsetWidth;
      this.el.classList.add('turn');
    }
  }

  /**
   * The fast clock. Called on every answer, correct or not — a slip must leave
   * the number standing exactly where it was, which is its own kind of feedback.
   *
   * @param {{tears:number, frac:number, toNext:number, chapter:number,
   *          gained:boolean, top:boolean}} s
   */
  setSeals(s) {
    /* THE LABEL NAMES THE BAR IT IS SITTING ON.
       This row used to lead with the lifetime seal count in display-size
       numerals — the second-largest figure on the screen, two hundred pixels
       under the band's "9 OF 20 RIFTS" reading "11 RIFTS SEALED IN ALL". A pass
       took the numeral away and left the words, and the next cold critic wrote
       up exactly what that leaves behind: *a 'RIFTS SEALED IN ALL' label whose
       bar is empty and whose number is missing all session.*

       Both readings were fair, because the label was never about this bar. The
       bar has always drawn HOW FAR THROUGH THE CURRENT CHAPTER this cadet is
       (`chapterFrac` in src/meta/shard.js) — it fills, turns the chapter, and
       starts again — while the words underneath it already say which chapter is
       next. A lifetime rift total drawn as a bar that empties itself every few
       minutes is not a lifetime total; it is a different fact wearing its name.

       So the row says what it draws. The lifetime count is not deleted — it is
       EVIDENCE, it belongs to the report, and it is printed there under
       `all.sealed` with a number on it, which is the half of "fill or remove"
       that a learner can actually check. */
    this.slab.textContent = t('story.hud.chapterBar');
    untagFigure(this.stop);
    /* WHAT IS COMING, NOT HOW FAR OFF IT IS.
       "1 MORE TO CHAPTER 2" was a countdown in rifts printed beside a countdown
       in standing points printed beside a percentage — and the chapter gate is
       not always rifts at all: the last two acts also cost nights held
       (src/meta/shard.js), which is how one line came to change what it was
       counting halfway up the ladder. So the line names the chapter that is
       next and, when the gate is nights rather than seals, says so — because a
       bar that has stopped moving without saying why reads as a bug. Neither
       sentence carries a figure. */
    const gate = s.gate || { kind: 'tears' };
    this.snext.textContent = s.top
      ? t('story.hud.sealsAll')
      : gate.kind === 'nights'
        ? t('story.hud.chapterNightAny', { ch: s.chapter + 1 })
        : t('story.hud.toChapterAny', { ch: s.chapter + 1 });
    /* The chapter ordinal inside that sentence is a NAME with a digit in it —
       "Chapter 2" — not a count of anything, and it is declared as one so the
       gate can tell the difference without parsing prose in three languages. */
    untagFigure(this.snext);
    if (!s.top) tagFigure(this.snext, FIG.CHAPTER_NEXT_NO, s.chapter + 1);
    this.sfill.style.width = `${Math.round(s.frac * 100)}%`;
    this.seal.classList.toggle('full', !!s.top);
    this.seal.classList.toggle('gated', gate.kind === 'nights');
    if (s.gained) {
      /* No "+1". A delta is a figure too, and with the total gone from this row
         it would be a numeral floating over nothing — the flare is the whole
         signal, and it is the part that was doing the work anyway. */
      this.seal.classList.remove('pop');
      void this.seal.offsetWidth;
      this.seal.classList.add('pop');
    }
  }

  /**
   * @param {{rankName:string, nextName:string|null, frac:number,
   *          have:number, need:number, gained:boolean}} s
   */
  setRung(s) {
    this.rnow.textContent = s.rankName;
    /* THE ONE THAT CHANGED ITS UNIT. This line read "BRONZE · 2 TO GO" and, over
       one session, ran 10 → 7 → 2 → 18 → 15 → "SILVER · 1 NIGHT HELD": standing
       points until the standing gate was met, then nights. Two units, one
       label, no mark on the glass where the meaning changed — which is the
       defect P0 names as its fourth rule, and the reason a countdown here
       cannot be repaired by picking better numbers. It names the rank that is
       next, and when the gate is nights rather than work it says which, so a
       full bar that is not moving still explains itself. No figure either way. */
    const gate = s.gate || { kind: 'standing' };
    this.rnext.textContent = !s.nextName
      ? t('story.hud.summit')
      : gate.kind === 'nights'
        ? t('story.hud.nextNightAny', { rank: s.nextName })
        : t('story.hud.toNextAny', { rank: s.nextName });
    this.rfill.style.width = `${Math.round(s.frac * 100)}%`;
    this.rung.classList.toggle('full', !s.nextName);
    this.rung.classList.toggle('gated', gate.kind === 'nights');
    if (s.gained) {
      this.rung.classList.remove('tick');
      void this.rung.offsetWidth;
      this.rung.classList.add('tick');
    }
  }

  /**
   * THE WATCH — what the card becomes once the proof is closed.
   *
   * The chapter card used to end its life reading "EVERY CHAPTER OPEN / The
   * proof is closed" and then say that for ever, which is a card announcing
   * that the game is over while the player is still in it. Once every line is
   * held there is exactly one thing the game still wants from you and one thing
   * it is still counting, so the same two rows say those instead:
   *
   *   the numeral   how many held lines have fallen due — the watch to stand
   *                 tonight. Zero is not nothing: it is the shard holding, and
   *                 the line underneath says when the next one falls.
   *   the rung      nights held. Not a rank, not a total of answers: the number
   *                 of times something you knew was still there after a real
   *                 walk away from the machine. It is the only number in the
   *                 game that a long sitting cannot move.
   *
   * @param {{due:number, held:number, durable:number, nextInMinutes:number|null,
   *          sounding:{best:number,rung:number}}|null} w
   */
  setWatch(w) {
    this.el.classList.toggle('watch', !!w);
    if (!w) return;
    /* The watch is the same two rows past the last line, under the same rule:
       instruments, not readouts. It used to print the count of held lines that
       had fallen due and the count of nights held — two more figures, arriving
       at exactly the moment the learner has the most invested in the numbers
       agreeing. The bar carries how much of the shard is due; the line says
       whether there is a watch to stand tonight and, if not, when the next one
       falls. Nights held is in the report. */
    this.slab.textContent = t('story.watch.due');
    untagFigure(this.stop);
    this.snext.textContent = w.due > 0
      ? t('story.watch.stand')
      : t('story.watch.next', { when: whenText(w.nextInMinutes) });
    /* `whenText` puts a duration in that sentence — "in four hours", "tomorrow".
       That is a clock reading about the world, not a count of the learner's
       progress, and it is declared as one. */
    untagFigure(this.snext);
    if (w.due === 0) tagFigure(this.snext, FIG.ELAPSED, Math.round(w.nextInMinutes ?? 0));
    this.sfill.style.width = `${Math.round(100 * (w.held ? Math.min(1, w.due / w.held) : 0))}%`;
    this.seal.classList.toggle('full', w.due === 0);
    this.rnow.textContent = t('story.watch.nightsAny');
    /* WHAT THE NIGHTS ARE FOR, WHILE THEY ARE STILL FOR SOMETHING.
       The coda — the last thing the writing has to say — now costs five nights
       held (src/meta/shard.js), because it used to arrive on the afternoon the
       tenth line closed. A number that gates something must name what it gates,
       or it is a wall; so until the proof closes this row says so, and after it
       goes back to the descent. */
    this.rnext.textContent = w.codaIn > 0
      ? t('story.watch.codaAny')
      : (w.sounding?.best
        ? t('story.watch.soundingAny')
        : t('story.watch.soundingNone'));
    this.rfill.style.width = `${Math.round(100 * Math.min(1, (w.sounding?.rung || 0) / 8))}%`;
    this.rung.classList.remove('full');
  }

  show(v = true) { this.el.classList.toggle('show', v); }
}
