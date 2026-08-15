/**
 * The resolution beat — the reason there is a tomorrow.
 *
 * This is not a results card. A results card is a scoreboard with a star rating
 * and a "next" button, and it tells a learner that what just happened was a
 * performance that has now been graded. What happened was a piece of a proof
 * being finished, and the surface has to say so in the world's own words.
 *
 * Three blocks, in the order a person actually wants them:
 *
 *   HELD    — what is now yours. Named skills, not points. If nothing closed,
 *             this block does not go blank and it does not lie: it says how far
 *             the seam moved and how far it still is, in tears, which is the
 *             unit on the band the learner has been watching for twenty minutes.
 *   OPENED  — what the world did about it. Rift lines that unlocked, a chapter
 *             that turned, a rank that was taken. Consequence, not confetti.
 *   NEXT    — the first move of the next run, named and costed. This is the
 *             hook, and it is the one block that must never be vague: "Two-step
 *             equations, about eleven minutes" is a thing a fifteen-year-old can
 *             decide to come back for. It also names the things that keep going
 *             when they are what is next — the charter, the waystation, the
 *             descent, the nights — on every close and not only the last one.
 *             See `continuing`.
 *
 * THE BIG NUMBER. It used to be the tear count, always — and on a run that
 * sealed nothing that meant a screen-height **0**, under the words ENOUGH FOR
 * TODAY, on the one card a struggling learner most needs to be able to look at.
 * A wrong answer costing nothing on the band also meant it showed nothing, all
 * session, and then the close totalled it up as zero. So the tally leads with
 * whatever actually happened: tears when there were tears, and work done when
 * there were not. Work done is not dressed up as mastery anywhere on this card —
 * it is labelled as what it is, sits next to an honest distance-to-hold, and the
 * gate it is measured against has not moved a millimetre.
 *
 * Nothing here is generated from a template of praise. Where the run fell short
 * of its goal the headline is "enough for today", not "you failed to reach the
 * target" and not "amazing job!" — Marlow does not flatter and does not scold.
 *
 * THE SHELF. This card is the last screen of the loop and on most of the
 * screens it has to run on it is taller than the frame, so the card is a column
 * — a body that scrolls, and an opaque control shelf under it that does not.
 * Whether the body scrolls is a fact
 * about the content and not about the viewport — see `fit()` — because the
 * three blocks plus the sign-off overflow a 1280x720 Chromebook exactly as
 * readily as a 390x844 phone, and deciding it with a width media query left
 * STAND DOWN below the fold on the Chromebook with nothing on screen to say
 * the card scrolled.
 */
import { t, num } from '../i18n/index.js';
import { RANK_INK, RANK_GLOW, sigilSVG } from '../meta/arc.js';

export class Resolution {
  constructor(root, { onRest, onMore }) {
    this.el = document.createElement('div');
    this.el.className = 'ses-close';
    this.el.innerHTML = `
      <div class="sx-dim"></div>
      <div class="sx-in" role="dialog" aria-modal="true">
        <!-- THE SHELF IS NOT IN THE SCROLLER.

             It used to be: .sx-acts sat last in this flow on position:sticky,
             which pins it to the foot of the scrollport and therefore ON TOP OF
             whatever is last in the flow until the card has been scrolled all
             the way down. That is the standard answer to "there is more below"
             and it is why the layout audit exempts a docked toolbar — but it
             means the card opens with its final paragraph half under an opaque
             strip, and which paragraph that is depends on how long the strings
             happen to be. At 1280x720 the Spanish card overflows its 92vh by
             one pixel; that one pixel turns the shelf on; turning the shelf on
             adds its own foot padding and a 2.8 rem gap, which makes the card
             overflow by twenty-two more; and the strip then covered sixty-two
             pixels of content at rest, of which the last forty were the caption
             that exists to be read BEFORE the eye goes looking for a second
             button. English cleared the line by four pixels and Polish by
             eleven. Nobody had written a layout that worked; three locales had
             got lucky and one had not.

             So the card is a column: a body that scrolls, and a shelf that does
             not, outside it. The shelf can then never be over anything, in any
             locale, at any height, at any scroll position — and the fade above
             it goes back to doing the one job a gradient can honestly do, which
             is to dissolve the EDGE of the scroller rather than a sentence. -->
        <div class="sx-scroll">
        <div class="sx-crest" hidden>
          <div class="sx-sig"></div>
          <div class="sx-crest-kick"></div>
          <div class="sx-crest-name"><span></span></div>
          <div class="sx-crest-arrow"></div>
          <p class="sx-crest-cite"></p>
        </div>
        <div class="sx-kick"></div>
        <h2 class="sx-title"><span></span></h2>
        <div class="sx-rule"></div>
        <div class="sx-tally">
          <span class="sx-t-n"></span>
          <span class="sx-t-lab"></span>
          <span class="sx-t-sub"></span>
        </div>
        <div class="sx-blocks">
          <section class="sx-b sx-held"><h3></h3><ul></ul></section>
          <section class="sx-b sx-open"><h3></h3><ul></ul></section>
          <section class="sx-b sx-next"><h3></h3><ul></ul></section>
        </div>
        <p class="sx-sign"></p>
        </div>
        <!-- …AND THE CAPTION IS PART OF THE SHELF, NOT THE LAST THING ABOVE IT.

             It says why there is no second button, so it has to be read before
             the eye goes looking for one — which makes "last thing in a
             scroller" the one place it must never be. Taking the shelf out of
             the scroller stopped it being covered; it did not stop it being the
             line the scroller happens to end on, half dissolved by the fade
             that marks the edge. In the shelf it is not in the scroller at all:
             crisp at rest, in every locale, at every height, beside the button
             it is about. It costs the body those few pixels, and the body
             scrolls. -->
        <div class="sx-acts">
          <p class="sx-cap"></p>
          <button type="button" class="sx-rest"></button>
          <button type="button" class="sx-more"></button>
        </div>
      </div>`;
    this.scroll = this.el.querySelector('.sx-scroll');
    this.crest = this.el.querySelector('.sx-crest');
    this.crestSig = this.el.querySelector('.sx-sig');
    this.crestKick = this.el.querySelector('.sx-crest-kick');
    this.crestName = this.el.querySelector('.sx-crest-name span');
    this.crestArrow = this.el.querySelector('.sx-crest-arrow');
    this.crestCite = this.el.querySelector('.sx-crest-cite');
    this.kick = this.el.querySelector('.sx-kick');
    this.title = this.el.querySelector('.sx-title span');
    this.tallyN = this.el.querySelector('.sx-t-n');
    this.tallyLab = this.el.querySelector('.sx-t-lab');
    this.tallySub = this.el.querySelector('.sx-t-sub');
    this.sign = this.el.querySelector('.sx-sign');
    this.cap = this.el.querySelector('.sx-cap');
    this.rest = this.el.querySelector('.sx-rest');
    this.more = this.el.querySelector('.sx-more');
    this.inn = this.el.querySelector('.sx-in');
    this.rest.addEventListener('click', () => { this.hide(); onRest?.(); });
    this.more.addEventListener('click', () => { this.hide(); onMore?.(); });
    root.appendChild(this.el);
    this._live = null;
    // A rotation, a Chromebook window being dragged taller, a phone keyboard
    // opening: all of them change whether this card overflows, and the answer
    // has to change with them while the card is on screen.
    addEventListener('resize', () => this.fit());
    visualViewport?.addEventListener?.('resize', () => this.fit());
  }

  /**
   * Does the card overflow the frame it is drawn in?
   *
   * If it does, the controls have to ride the foot of the scroller — otherwise
   * STAND DOWN is simply below the fold with nothing on screen to say the card
   * scrolls, which is what a 1280x720 Chromebook got for a while because this
   * was decided by a `max-width: 720px` media query instead of by the content.
   * Three blocks plus a sign-off is taller than 720 px of viewport whatever the
   * width, and on a 1600x900 desktop it is not, so the question is asked of the
   * real scroller.
   *
   * The measurement is taken with the shelf *off*, because turning it on makes
   * the content taller (it adds its own foot padding and a gap above itself) —
   * asking in the on-state would let a card that only just overflows latch on
   * and never let go, and asking it on every resize would then flicker.
   *
   * The question is asked of `.sx-scroll`, which is the body. `.sx-in` is the
   * card, and since the shelf came out of the scroller the card itself never
   * overflows — asking it would answer "no" on every screen and the shelf would
   * lose its fade exactly where it is needed.
   */
  fit() {
    if (!this.scroll || !this.open) return;
    const on = this.el.classList.contains('scrolls');
    if (on) this.el.classList.remove('scrolls');
    const over = this.scroll.scrollHeight > this.scroll.clientHeight + 2;
    this.el.classList.toggle('scrolls', over);
  }

  get open() { return this.el.classList.contains('show'); }

  /**
   * @param {{index:number, tears:number, target:number, met:boolean,
   *          held:string[], stalled:object|null, opened:string[],
   *          chapter:number|null, rank:string|null,
   *          next:{id:string, minutes:number|null}|null, lines:number,
   *          endgame:{sounding:number, charters:number|null,
   *                   toCharter:number|null, stations:number|null}|null,
   *          items:number, misses:number, echoes:number,
   *          extensions:number, canMore:boolean}} report
   */
  show(report) {
    this._live = report;
    this.retext();
    /* A card opens at its own beginning. The scroller keeps its offset across a
       hide, so the second close of a sitting — an extension, or a second run —
       used to open exactly where the last one was left, which on a screen short
       enough to scroll meant the headline was already off the top before the
       learner had looked at it. */
    if (this.scroll) this.scroll.scrollTop = 0;
    this.el.classList.remove('show');
    void this.el.offsetWidth;
    this.el.classList.add('show');
    this.fit();
    // …and again once the web fonts have settled, since a fallback face can be
    // a line shorter than the real one and that is the whole margin at 1280x720.
    document.fonts?.ready?.then?.(() => this.fit());
    requestAnimationFrame(() => { this.fit(); this.rest.focus({ preventScroll: true }); });
  }

  /**
   * THE ASCENSION, WHEN THE RUN ENDED ON IT.
   *
   * A promotion earned on the last answer of a session used to be a second
   * full-screen ceremony playing under this one. It is not a second thing that
   * happened — it is the largest single line of what this run achieved — so it
   * is composed into the head of the card: the sigil draws, the rank lands
   * oversized and settles, the old rank is named beside the new one, and the
   * citation carries the weight the rite's lower third used to carry. The
   * résumé then rises underneath it, on a beat, as one movement.
   *
   * It reuses the rite's own words (`story.rite.*`, `story.cite.*`) and the
   * rite's own ink, because it is the same event; nothing new is written into
   * the bundles for a beat that is played this rarely.
   */
  _crest(p) {
    this.crest.hidden = !p;
    this.el.classList.toggle('ascended', !!p);
    if (!p) {
      this.el.style.removeProperty('--sx-crest-size');
      this.el.style.removeProperty('--rank-ink');
      this.el.style.removeProperty('--rank-glow');
      return;
    }
    this.el.style.setProperty('--rank-ink', RANK_INK[p.rank]);
    this.el.style.setProperty('--rank-glow', RANK_GLOW[p.rank]);
    this.crestSig.innerHTML = sigilSVG(p.to);
    this.crestKick.textContent = t('story.rite.ascended');
    this.crestName.textContent = t('rank.' + p.rank);
    this.crestArrow.textContent = p.was
      ? t('story.rite.arrow', { from: t('rank.' + p.was), to: t('rank.' + p.rank) })
      : t('story.rite.standing');
    this.crestCite.textContent = t('story.cite.' + p.rank);
    // A long rank word in ES or PL cannot be allowed to letterspace itself off
    // the edge of a 390 px frame, so the display size is a function of the word
    // — the same rule the rite uses, one step smaller because this one shares
    // the card with a résumé.
    const n = this.crestName.textContent.length;
    this.el.style.setProperty('--sx-crest-size', n > 10 ? '2.2rem' : n > 7 ? '2.6rem' : '3rem');
  }

  retext() {
    const r = this._live;
    if (!r) return;
    this._crest(r.promoted || null);
    const held = r.held.length > 0;
    const items = r.items || 0;
    // A run that sealed nothing leads with the work, because a screen-height
    // zero is not a summary of twenty minutes, it is a verdict on them.
    const leadWork = r.tears === 0 && items > 0;
    this.kick.textContent = t('session.close.kick', { n: r.index });
    this.title.textContent = t(
      held ? 'session.close.titleHeld'
        : (r.met ? 'session.close.titleMet' : 'session.close.titleEnough'),
    );
    this.tallyN.textContent = num(leadWork ? items : r.tears);
    this.tallyLab.textContent = leadWork
      ? t('session.close.workedLab', { n: items })
      : t('session.close.tears', { n: r.tears });
    this.tallySub.textContent = leadWork
      ? t('session.close.workedSub')
      : (items > r.tears ? t('session.close.ofWorked', { n: items }) : '');
    this.el.classList.toggle('lead-work', leadWork);
    this.el.classList.toggle('ground', !held);
    // The shard is finished: the third block is now carrying the card, and the
    // stylesheet gives it the width the other two are not using.
    this.el.classList.toggle('whole', !r.next);

    // The block changes its name rather than lying about its contents: a run
    // that closed nothing has not "held" anything, and labelling the honest row
    // HELD is the one move that would make this whole surface untrustworthy.
    this._block('held', t(held ? 'session.close.heldLab' : 'session.close.groundLab'), held
      ? r.held.map((id) => ({ strong: t('skills.' + id), note: t('session.close.heldNote') }))
      : groundRows(r));

    const opened = [];
    for (const id of r.opened) opened.push({ strong: t('skills.' + id), note: t('session.close.openedNote') });
    if (r.chapter) opened.push({ strong: t('story.hud.act', { n: r.chapter }), note: t('session.close.chapterNote') });
    if (r.rank) opened.push({ strong: r.rank, note: t('session.close.rankNote') });
    /* NOTHING OPENED is a claim, and on a run that ended on a promotion it is
       false. The rank is normally not repeated here — the crest above is where
       it is said, and saying it twice on one card is a card that does not trust
       its own headline — but it is the row this block gets rather than telling
       the learner that the run they were just promoted for opened nothing. */
    if (!opened.length) {
      opened.push(r.promoted
        ? { strong: t('rank.' + r.promoted.rank), note: t('session.close.rankNote') }
        : openedNoneRow(r, held));
    }
    this._block('open', t('session.close.openedLab'), opened);

    // NEXT is the hook, and past the last line the hook is not a skill and not
    // a number of minutes. See `nextRows`.
    this._block(
      'next',
      t(r.next ? 'session.close.nextLab' : 'session.close.nextLabOpen'),
      nextRows(r),
    );

    this.sign.textContent = t(signKey(r, held, leadWork));
    this.rest.textContent = t('session.close.rest');
    this.more.textContent = t('session.close.more');
    // ONE MORE LINE is an offer the window can run out of, and when it has, the
    // card says so instead of quietly serving a fifth eight-minute run.
    const more = r.canMore !== false;
    this.more.hidden = !more;
    this.cap.textContent = more
      ? (r.extensions > 0 ? t('session.close.moreLast') : '')
      : t('session.close.capped');
    this.inn.setAttribute('aria-label', t('session.close.aria', { n: r.tears }));
    // Polish is a good deal longer than English on this card, so the answer to
    // "does it overflow" is re-asked every time the language changes.
    this.fit();
  }

  _block(cls, label, rows) {
    const sec = this.el.querySelector('.sx-' + cls);
    sec.querySelector('h3').textContent = label;
    sec.querySelector('ul').innerHTML = rows.map((row, i) => `
      <li style="--i:${i}"><i aria-hidden="true"></i><b>${esc(row.strong)}</b><span>${esc(row.note)}</span></li>
    `).join('');
  }

  /* `scrolls` deliberately survives the close: dropping it here would snap the
     shelf back to the foot of the content in the middle of the card's own
     fade-out. `show()` re-measures from scratch anyway. */
  hide() { this.el.classList.remove('show'); }
}

/**
 * NOTHING OPENED — which is three different sentences, not one.
 *
 * "Nothing opened today. That is what the long lines cost, and they are the
 * ones worth having" is a sentence about a run that spent itself on one long
 * unclosed line. It was also being printed:
 *
 *   · beside a HELD block with a line in it — the tenth line, or one whose
 *     successors are still waiting on other prerequisites — under a sign-off
 *     that said everything above it had just become reachable;
 *   · on a finished shard, where nothing opened because there is nothing left
 *     to open, one column away from "nothing is open here any more".
 *
 * Same fact, three different reasons, and the reason is the whole content of
 * the row.
 */
function openedNoneRow(r, held) {
  if (!r.next) {
    return {
      strong: t('session.close.openedWholeNoneStrong'),
      note: t('session.close.openedWholeNone'),
    };
  }
  return {
    strong: t('session.close.openedNoneStrong'),
    note: t(held ? 'session.close.openedHeldNone' : 'session.close.openedNone'),
  };
}

/**
 * THE BLOCK THAT IS THE REASON THERE IS A TOMORROW.
 *
 * While a line is still open this is one row: the line, and what it costs at
 * this learner's own pace. `src/session/index.js` guarantees that row is only
 * ever a line that is genuinely open, so the minutes can never be zero.
 *
 * When the ten lines are held it is four, and they are the whole of what this
 * card was missing. The endgame is fully built — the descent in `src/learn`,
 * the charter and the waystation in `src/kit` — and the screen that ends every
 * session named none of it, so the loop written to hold a returning player was
 * invisible from inside the game. A learner who finished the shard read
 * "everything you touched today was already yours" and "about 0 minutes of
 * work" and had no way to find out that anything continued at all.
 *
 * Each row states what is true right now, in the state the learner is actually
 * in: how deep the sounding has gone, whether there is a charter in hand or how
 * much further depth has to go to cut one, and whether a waystation is standing.
 * Nothing here is a promise the engine has not already made good on somewhere.
 */
function nextRows(r) {
  if (r.next) {
    // The line comes first — it is the mathematics, and the mathematics is the
    // point — and then at most two of the things that keep going. Three rows is
    // the most this block may ever hold with a line still open: a list nobody
    // finishes reading is a list that named nothing.
    return [
      {
        strong: t('skills.' + r.next.id),
        note: r.next.minutes != null
          ? t('session.close.nextNote', { n: r.next.minutes })
          : t('session.close.nextNoteUnknown'),
      },
      ...continuing(r).slice(0, 2),
    ];
  }
  return [
    { strong: t('session.close.nextDoneStrong'), note: t('session.close.nextDone') },
    ...continuing(r, true).slice(0, 3),
  ];
}

/**
 * THE THINGS THAT KEEP GOING, IN THE ORDER THEY ARE ACTUALLY NEXT.
 *
 * A blind critic: *"the three things that actually keep going — the next
 * charter, the waystation, the sounding — are never named by the screen that
 * ends a session."* They were named, and only on the card a learner sees after
 * the tenth line is held, which is the one sitting that needs the hook least.
 *
 * They are named here whenever they are true, on every close, most concrete
 * first. Every row is a thing to go and do, with the number it costs:
 *
 *   DUE          lines the schedule wants re-checked tonight. The only row that
 *                is about work already owed, so it outranks everything.
 *   CHARTER      one in hand is a waystation waiting to be placed — a key press
 *                and a price, so it is named as one.
 *   SOUNDING     how deep the descent has gone. A spare minute has an answer.
 *   WAYSTATION   what is standing, once anything is.
 *   NIGHTS       the number a long sitting cannot move, and the reason tomorrow
 *                is not more of today. Always last, and dropped only when two
 *                more concrete rows have already taken the space — a learner
 *                with re-probes due and a charter in hand does not need to be
 *                told in the abstract why tomorrow is different.
 *
 * `full` is the whole-lattice card, which has the room to say what the descent
 * and the charter *are* to somebody who has not met them yet. With a line still
 * open the card says nothing about a thing that has not happened.
 */
function continuing(r, full = false) {
  const e = r.endgame || {};
  const rows = [];
  if ((r.due || 0) > 0) {
    rows.push({ strong: t('session.close.dueStrong', { n: r.due }), note: t('session.close.dueNote') });
  }
  if (e.charters > 0) {
    rows.push({
      strong: t('session.close.charterHaveStrong', { n: e.charters }),
      note: t('session.close.charterHaveNote'),
    });
  } else if (full && e.charters != null) {
    rows.push({
      strong: t('session.close.charterStrong'),
      note: t('session.close.charterNote', { n: Math.max(1, e.toCharter || 1) }),
    });
  }
  /* THE DESCENT OR THE WAYSTATION, NEVER BOTH ON ONE CARD.
     Four rows is what this block can hold above the fold on a 1280x720
     Chromebook, and a row nobody scrolls to has not been named. A charter in
     hand makes the waystation the live decision — it is the thing the charter
     is *for*, and it is one keypress away — and every other state makes the
     descent the thing a spare minute is for. */
  const wants = e.charters > 0 && e.stations === 0;
  if (wants) {
    rows.push({ strong: t('session.close.stationStrongNone'), note: t('session.close.stationNoteNone') });
  } else if (e.sounding > 0) {
    rows.push({ strong: t('session.close.soundStrong', { n: e.sounding }), note: t('session.close.soundNote') });
  } else if (e.stations > 0) {
    rows.push({ strong: t('session.close.stationStrong', { n: e.stations }), note: t('session.close.stationNote') });
  } else if (full) {
    rows.push({ strong: t('session.close.soundStrongNone'), note: t('session.close.soundNoteNone') });
  }
  rows.push(nightsRow(r));
  return rows;
}

/**
 * THE ROW THAT SAYS WHY TOMORROW IS DIFFERENT FROM MORE OF TODAY.
 *
 * A learner three lines into the shard used to close a session with no reason
 * on screen to come back rather than to keep going. Nights held is that reason,
 * and it is honest: it is the mastery engine's own count of lines re-probed
 * after a real break and still known (src/meta/days.js). It is what rank costs
 * above Silver and what the last two chapters wait for, and it is the one
 * number in the game that a long sitting cannot move.
 *
 * What has actually fallen due is a more concrete thing to come back to, so
 * `continuing` prints that above this one and this row stays what it is: the
 * definition, and the count.
 */
function nightsRow(r) {
  if ((r.nights || 0) > 0) {
    return {
      strong: t('session.close.nightsStrong', { n: r.nights }),
      note: t('session.close.nightsNote'),
    };
  }
  return {
    strong: t('session.close.nightsNoneStrong'),
    note: t('session.close.nightsNoneNote'),
  };
}

/**
 * The last line on the card, and the one most likely to argue with the rows
 * above it.
 *
 *   · "Everything above it just became reachable" is a claim about the lattice,
 *     and on a run whose held line opened nothing — the tenth line, or one
 *     whose successors are still waiting on other prerequisites — it is false,
 *     and it was being printed directly under OPENED · nothing.
 *   · A learner with nothing left open is not coming back for "the line you
 *     were on is the line we open with". They are coming back for the descent
 *     and for what a night of holding cuts, so that is what the sign-off says.
 */
function signKey(r, held, leadWork) {
  if (!r.next) return 'session.close.signWhole';
  if (held) return r.opened.length ? 'session.close.signHeld' : 'session.close.signHeldQuiet';
  return leadWork ? 'session.close.signWorked' : 'session.close.sign';
}

/**
 * The honest rows for a run that did not close a seam. They are what decides
 * whether this whole surface is trustworthy, so between them they say exactly
 * what the engine believes and no more:
 *
 *   1. where the seam stands, in tears — and since estimate.js now answers that
 *      off the shortest road rather than off a sample of coin flips, the
 *      reading taken at the close is comparable with the one taken before the
 *      first item, which is the only thing that makes a delta mean anything;
 *   2. the teaching the run actually delivered, which a miss buys and a seal
 *      does not, and which was previously counted nowhere;
 *   3. the band the bank is now serving, when the run moved it — the engine
 *      adapting to the learner is a real event and the learner is entitled to
 *      see it happen rather than to notice the questions got easier.
 */
function groundRows(r) {
  const rows = [distanceRow(r)];
  const g = r.stalled;
  if (r.echoes > 0) {
    rows.push({
      strong: t('session.close.echoStrong', { n: r.echoes }),
      note: t('session.close.echoNote'),
    });
  }
  if (g && g.band != null && g.bandWas != null && g.band !== g.bandWas) {
    rows.push({
      strong: t('session.close.bandStrong'),
      note: t(g.band < g.bandWas ? 'session.close.bandDown' : 'session.close.bandUp', { n: g.band }),
    });
  }
  return rows;
}

function distanceRow(r) {
  const g = r.stalled;
  if (!g) {
    // "Everything you touched today was already yours" is a sentence about a
    // run that touched something. A rift left open on a desk for twenty-five
    // minutes closes the session having touched nothing, and that run does not
    // get told it did.
    return (r.items || 0) === 0
      ? { strong: t('session.close.groundIdleStrong'), note: t('session.close.groundIdle') }
      : { strong: t('session.close.groundNoneStrong'), note: t('session.close.groundNone') };
  }
  if (g.tears == null) return { strong: t('skills.' + g.id), note: t('session.close.groundNoteFar') };
  // "Closer than when you started" is a claim, so it is only made when the
  // engine's own projection was actually taken before the first item and has
  // actually come down. A run that ground its wheels says so, and a run that
  // went backwards — a missed gate item does genuinely reset a proving run —
  // says that too, and says why, because the alternative is a number that looks
  // like it was made up.
  const was = g.was;
  let note;
  if (was != null && was > g.tears) note = t('session.close.groundNote', { n: g.tears, d: was - g.tears });
  else if (was != null && was < g.tears) note = t('session.close.groundNoteBack', { n: g.tears });
  else note = t('session.close.groundNoteFlat', { n: g.tears });
  return { strong: t('skills.' + g.id), note };
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
