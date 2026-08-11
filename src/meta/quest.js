/**
 * The chapter card: which act you are in, the question that act is about, and
 * how close the next rank is.
 *
 * This is the one piece of narrative furniture that is always on screen, so it
 * is deliberately quiet — a hairline in the rank's colour, a chapter number, a
 * title and the standing question. It flares once when the chapter turns, and
 * it is the click target for the dossier.
 *
 * Below that are the two clocks, and they are the part that earns the pixels.
 *
 *   THE SEAL LEDGER, in numerals large enough to read at a glance: how many
 *   tears you have closed on this shard, and how many more the next chapter
 *   costs. It ticks on *every* correct answer — the number changes, a +1 rises
 *   off it, the bar moves — so the story is visibly nearer than it was ninety
 *   seconds ago. This is the fast clock and it is the hero of the card.
 *
 *   THE RUNG, one hairline under it: standing toward the next rank, which is
 *   the slow, honest one. Named, so you always know which rite is next and how
 *   far it is, and quiet, so it never competes with the seal count.
 */
import { sigilSVG } from './arc.js';
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
          <b class="qs-n">0</b>
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
    this.sn = this.el.querySelector('.qs-n');
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
    this.act.textContent = t('story.hud.act', { n });
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
    this.sn.textContent = String(s.tears);
    this.slab.textContent = t('story.hud.sealed');
    this.snext.textContent = s.top
      ? t('story.hud.sealsAll')
      : t('story.hud.toChapter', { n: s.toNext, ch: s.chapter + 1 });
    this.sfill.style.width = `${Math.round(s.frac * 100)}%`;
    this.seal.classList.toggle('full', !!s.top);
    if (s.gained) {
      this.splus.textContent = t('story.hud.plusSeal');
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
    this.rnext.textContent = s.nextName
      ? t('story.hud.toNext', { rank: s.nextName, n: Math.max(0, s.need - s.have) })
      : t('story.hud.summit');
    this.rfill.style.width = `${Math.round(s.frac * 100)}%`;
    this.rung.classList.toggle('full', !s.nextName);
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
    this.sn.textContent = String(w.due);
    this.slab.textContent = t('story.watch.due');
    this.snext.textContent = w.due > 0
      ? t('story.watch.stand')
      : t('story.watch.next', { when: whenText(w.nextInMinutes) });
    this.sfill.style.width = `${Math.round(100 * (w.held ? Math.min(1, w.due / w.held) : 0))}%`;
    this.seal.classList.toggle('full', w.due === 0);
    this.rnow.textContent = t('story.watch.nights', { n: w.durable });
    this.rnext.textContent = w.sounding?.best
      ? t('story.watch.sounding', { n: w.sounding.best })
      : t('story.watch.soundingNone');
    this.rfill.style.width = `${Math.round(100 * Math.min(1, (w.sounding?.rung || 0) / 8))}%`;
    this.rung.classList.remove('full');
  }

  show(v = true) { this.el.classList.toggle('show', v); }
}
