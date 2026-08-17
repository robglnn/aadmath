/**
 * The cadet dossier — where progression stops being a percentage.
 *
 * Four readings of the same climb:
 *
 *   THE CLIMB   the five ranks with where you actually stand, and the standing
 *               each one costs.
 *   STANDING    the arithmetic of the climb, itemised. A player who wants to
 *               know why the bar moved gets the four terms, what each is worth
 *               and which of them have run out. Progression a player cannot
 *               audit is progression they do not believe.
 *   FIELD LOG   everything Marlow has told you, with the chapters you have not
 *               earned redacted rather than hidden — you can see there is more,
 *               which is the point.
 *   TEN LINES   the proof itself, with real state out of the mastery model.
 */
import { ACTS, CODA, RANKS, RANK_AT, sigilSVG } from './arc.js';
import { breakdown, STANDING_MAX } from './standing.js';
import { t, pct } from '../i18n/index.js';
import { FIG, tagFigure } from './progress.js';

export class Dossier {
  constructor(root, { onToggle } = {}) {
    this.el = document.createElement('div');
    this.el.className = 'meta-dossier';
    this.el.innerHTML = `<div class="dos-card" role="dialog" aria-modal="true">
      <div class="dos-head">
        <h2></h2><span class="sub"></span>
        <button class="x" type="button"></button>
      </div>
      <div class="dos-grid">
        <div class="dos-sec dos-left">
          <h3 class="h-ladder"></h3>
          <div class="dos-ladder"></div>
          <h3 class="h-stand"></h3>
          <div class="dos-stand"></div>
          <div class="dos-int">
            <div class="lab"><span class="i-lab"></span><span class="i-val"></span></div>
            <div class="track"><i></i></div>
          </div>
          <h3 class="h-lines"></h3>
          <div class="dos-lines"></div>
        </div>
        <div class="dos-sec dos-right">
          <h3 class="h-log"></h3>
          <div class="dos-log"></div>
        </div>
      </div>
      <div class="dos-foot"></div>
    </div>`;
    root.appendChild(this.el);
    this.open = false;
    this.onToggle = onToggle;
    this.el.querySelector('.x').addEventListener('click', () => this.close());
    this.el.addEventListener('click', (e) => { if (e.target === this.el) this.close(); });
  }

  toggle(state) { (this.open ? this.close : this.show).call(this, state); }

  close() {
    if (!this.open) return;
    this.open = false;
    this.el.classList.remove('show');
    this.onToggle?.(false);
  }

  show(s) {
    this.render(s);
    this.open = true;
    this.el.classList.add('show');
    this.onToggle?.(true);
  }

  render(s) {
    const q = (k) => this.el.querySelector(k);
    q('h2').textContent = t('story.dossier.title');
    q('.sub').textContent = t('story.dossier.sub');
    q('.x').textContent = t('story.dossier.close');
    q('.h-ladder').textContent = t('story.dossier.ladder');
    q('.h-stand').textContent = t('story.dossier.standing');
    q('.h-log').textContent = t('story.dossier.log');
    q('.h-lines').textContent = t('story.dossier.lines');
    /* The same figure, under the same name the rig prints it under, declared so
       tools/critic/oneprogress.mjs proves the two agree every run. */
    q('.i-lab').textContent = t('hud.mastery');
    q('.i-val').textContent = pct(s.integrity);
    tagFigure(q('.i-val'), FIG.REPAIRED, Math.round(s.integrity * 100));
    q('.dos-int .track i').style.width = `${Math.round(s.integrity * 100)}%`;
    q('.dos-foot').textContent = t('story.dossier.footer');

    // --- the ladder -------------------------------------------------------
    const ladder = q('.dos-ladder');
    ladder.innerHTML = '';
    RANKS.forEach((rank, i) => {
      const row = document.createElement('div');
      row.className = `rung${i < s.rank ? ' done' : ''}${i === s.rank ? ' here' : ''}`;
      row.innerHTML = `${sigilSVG(i, i <= s.rank ? '' : 'dim')}
        <span><span class="rn"></span><span class="rc"></span></span>`;
      row.querySelector('.rn').textContent = t('rank.' + rank);
      row.querySelector('.rc').textContent = i === s.rank
        ? t('story.dossier.here', { have: s.standing, need: RANK_AT[Math.min(RANKS.length - 1, i + 1)] })
        : t('story.dossier.costs', { n: RANK_AT[i] });
      ladder.appendChild(row);
    });

    // --- what standing is made of ----------------------------------------
    const stand = q('.dos-stand');
    stand.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'st-head';
    head.innerHTML = '<span class="st-n"></span><span class="st-of"></span>';
    head.querySelector('.st-n').textContent = String(s.standing);
    head.querySelector('.st-of').textContent = t('story.dossier.outOf', { n: STANDING_MAX });
    stand.appendChild(head);
    for (const term of breakdown(s.ledger, s.lines, s.opened)) {
      const row = document.createElement('div');
      const full = term.have >= term.cap;
      row.className = `st-row${full ? ' capped' : ''}`;
      row.innerHTML = `<span class="st-lab"></span><span class="st-bar"><i></i></span><span class="st-v"></span>`;
      row.querySelector('.st-lab').textContent = t('story.stand.' + term.id);
      row.querySelector('.st-bar i').style.width = `${Math.round((term.have / term.cap) * 100)}%`;
      row.querySelector('.st-v').textContent = `${term.have}/${term.cap}`;
      row.title = t('story.stand.' + term.id + 'Note');
      stand.appendChild(row);
    }

    // --- the field log ----------------------------------------------------
    const log = q('.dos-log');
    log.innerHTML = '';
    const entries = ACTS.map((a) => ({
      n: a.n, id: a.id, at: a.at, lines: a.lines,
      title: t(`story.${a.id}.title`), quest: t(`story.${a.id}.quest`),
    }));
    entries.push({
      n: 6, id: 'coda', at: null, lines: CODA,
      title: t('story.coda.title'), quest: t('story.coda.quest'), coda: true,
    });

    // The fast clock, stated once at the head of the log: what the chapters
    // actually cost, in the same unit the card counts in.
    const tally = document.createElement('div');
    tally.className = 'dos-tally';
    tally.innerHTML = '<b></b><span></span>';
    tally.querySelector('b').textContent = String(s.tears ?? 0);
    tally.querySelector('span').textContent = t('story.dossier.tally');
    log.appendChild(tally);

    for (const e of entries) {
      const heard = e.lines.filter((k) => s.seen.has(k));
      // A chapter you have reached is a chapter you own, whether or not you
      // were standing still when Marlow said it. Running past a transmission
      // must not cost you the page it was written on.
      const unlocked = heard.length > 0 || e.n <= s.chapter;
      const card = document.createElement('article');
      card.className = `chap${unlocked ? '' : ' locked'}${e.n === s.chapter ? ' on' : ''}${e.coda ? ' coda' : ''}`;
      card.innerHTML = `<div class="ch-h">
          <span class="ch-n"></span><span class="ch-t"></span><span class="ch-lock"></span>
        </div>`;
      card.querySelector('.ch-n').textContent = String(e.n).padStart(2, '0');
      card.querySelector('.ch-t').textContent = unlocked ? e.title : '—';
      const lock = card.querySelector('.ch-lock');
      if (!unlocked) {
        lock.textContent = e.coda
          ? t('story.dossier.lockedCoda')
          : t('story.dossier.lockedAt', { n: e.at });
        const red = document.createElement('div');
        red.className = 'redact';
        // Redaction bars sized off the real line lengths: you can see the shape
        // of what you have not earned yet.
        for (const k of e.lines) {
          const b = document.createElement('i');
          b.style.width = `${Math.min(96, 14 + (t(k).length % 46) * 1.7)}px`;
          red.appendChild(b);
        }
        card.appendChild(red);
      } else {
        for (const k of (heard.length ? heard : e.lines)) {
          const p = document.createElement('p');
          p.textContent = t(k);
          card.appendChild(p);
        }
      }
      log.appendChild(card);
    }

    // --- the ten lines ----------------------------------------------------
    const lines = q('.dos-lines');
    lines.innerHTML = '';
    for (const sk of s.skills) {
      const row = document.createElement('div');
      row.className = `ln${sk.mastered ? ' held' : sk.unlocked ? ' open' : ''}`;
      row.innerHTML = '<span class="pip"></span><span class="nm"></span>';
      row.querySelector('.nm').textContent = t('skills.' + sk.id);
      row.title = sk.mastered ? t('story.dossier.held')
        : sk.unlocked ? t('story.dossier.openState') : t('story.dossier.shut');
      lines.appendChild(row);
    }
  }
}
