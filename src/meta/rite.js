/**
 * The ascension rite.
 *
 * This is the arc's payoff and it has to hit like one. The previous version was
 * a hairline hexagon and letterspaced type over a world dimmed flat for six
 * seconds — a title card, next to which a Fortnite tier-up is a physical event:
 * hard letterbox, particulate off the bottom of the frame, the word arriving at
 * the wrong size and settling, a light under the character, all of it inside
 * two seconds.
 *
 * So: the bars slam. A wave leaves the middle of the screen. The rank's name
 * lands oversized and overshoots down to true. Sparks rise through it, in the
 * rank's own colour. And the dim is *bottom-lit* rather than uniform, so the
 * cadet stands in the light of their own promotion instead of behind it.
 *
 * Peak is at 0.75 s. Everything is readable by 1.4 s. It clears at 5.2 s, and it
 * never takes the controls — you can walk through your own promotion.
 *
 * Cost: one composited layer, forty-eight two-property spans, no per-frame JS.
 * `prefers-reduced-motion` drops the sparks and the overshoot and keeps the
 * information.
 */
import { RANKS, RANK_INK, RANK_GLOW, sigilSVG } from './arc.js';
import { t, num } from '../i18n/index.js';

const SPARKS = 48;

export class Rite {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'meta-rite';
    this.el.setAttribute('aria-hidden', 'true');
    this.el.innerHTML = `
      <div class="rite-dim"></div>
      <div class="rite-sparks">${spark(SPARKS)}</div>
      <div class="rite-wave"></div>
      <div class="rite-bar t"></div>
      <div class="rite-bar b"></div>
      <div class="rite-in">
        <div class="sig-slot"></div>
        <div class="rite-kicker"></div>
        <div class="rite-name"><span></span></div>
        <div class="rite-arrow"></div>
        <div class="rite-rule"></div>
        <div class="rite-cite"></div>
        <div class="rite-next"></div>
      </div>`;
    this.slot = this.el.querySelector('.sig-slot');
    this.kicker = this.el.querySelector('.rite-kicker');
    this.name = this.el.querySelector('.rite-name span');
    this.arrow = this.el.querySelector('.rite-arrow');
    this.cite = this.el.querySelector('.rite-cite');
    /* src/ui P1 — WHAT TO DO WHEN THE LETTERBOX CLEARS.
       The rite stands every readout down for five seconds (see meta.css) and
       used to put nothing in their place: a cold critic measured "the rank-up
       ceremony blanks the entire HUD for ~5 s with no prompt", and the sampler
       agreed — at 2.25 s into a promotion the only surfaces painting were the
       ceremony itself and three things you cannot act on. A ceremony is allowed
       to take the frame. It is not allowed to leave the player with nothing to
       do, so it now carries the objective it interrupted, in its own type. */
    this.next = this.el.querySelector('.rite-next');
    root.appendChild(this.el);
    this._live = null;
  }

  /** Is the rite holding the frame right now? */
  get playing() { return this.el.classList.contains('show'); }

  /**
   * Take the promotion off this surface and hand it to another one.
   *
   * A rank is a thing that happened, and the rite is only one way of saying so.
   * When a run ends on the answer that bought the rank, the close card composes
   * the promotion into itself — it is the record of what the run achieved, and
   * a promotion is the largest thing on that list. Two full-screen ceremonies
   * at once is the one thing that cannot happen, and the résumé is the better
   * of the two places to put it, so the rite gives it up rather than fights for
   * the frame. Returns null when there is nothing to give.
   */
  claim() {
    const live = this._live;
    if (!live) return null;
    this.hide();
    return { to: live.to, from: live.from };
  }

  /**
   * @param {number} to rank index gained
   * @param {number} from previous index, or -1 for a standing declaration
   * @param {{verb:string, skill:string, metres:number}|null} [next] what the
   *   scheduler wants next, so the ceremony can hand the player straight back
   *   to it. Resolved by the caller off the live objective; `null` is fine and
   *   falls back to the standing instruction.
   */
  play(to, from, next = null) {
    const rank = RANKS[Math.max(0, Math.min(RANKS.length - 1, to))];
    this._live = { to, from, next };
    // The rite paints itself from the rank it is *awarding*, not from whatever
    // --rank-ink happens to be mid-transition. Sovereign has to read violet.
    this.el.style.setProperty('--rank-ink', RANK_INK[rank]);
    this.el.style.setProperty('--rank-glow', RANK_GLOW[rank]);
    this.el.dataset.rank = rank;
    this.slot.innerHTML = sigilSVG(to);
    this.retext();
    this._fire();
  }

  /** Re-render the words without replaying the animation (locale switch). */
  retext() {
    const L = this._live;
    if (!L) return;
    const rank = RANKS[Math.max(0, Math.min(RANKS.length - 1, L.to))];
    this.kicker.textContent = t('story.rite.ascended');
    this.name.textContent = t('rank.' + rank);
    this.arrow.textContent = L.from >= 0 && L.from !== L.to
      ? t('story.rite.arrow', { from: t('rank.' + RANKS[L.from]), to: t('rank.' + rank) })
      : t('story.rite.standing');
    this.cite.textContent = t('story.cite.' + rank);
    // One clear next action, for the five seconds the instruments are down.
    const n = L.next;
    this.next.textContent = n
      ? t('story.rite.next', {
        verb: t('guide.verb.' + n.verb), skill: t('skills.' + n.skill), n: num(n.metres),
      })
      : t('story.rite.nextAny');
    // Long rank words in ES/PL cannot be allowed to letterspace themselves off
    // the edge of the frame, so the display size is a function of the word.
    // (`n` is taken by the next-action object above; this is a local rename only
    // — the whole module failed to parse otherwise. — report)
    const len = this.name.textContent.length;
    this.el.style.setProperty('--rite-size', len > 10 ? '4.6vw' : len > 7 ? '5.8vw' : '7.2vw');
  }

  _fire() {
    this.el.classList.remove('show');
    void this.el.offsetWidth;              // restart every animation on the layer
    this.el.classList.add('show');
    clearTimeout(this._t);
    clearTimeout(this._t2);
    this._t = setTimeout(() => this.el.classList.add('out'), 4600);
    this._t2 = setTimeout(() => {
      this.el.classList.remove('show', 'out');
      this._live = null;
    }, 5200);
  }

  hide() {
    clearTimeout(this._t); clearTimeout(this._t2);
    this.el.classList.remove('show', 'out');
    this._live = null;
  }
}

/** Deterministic-enough spark field: seeded by index, so it never re-lays out. */
function spark(n) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const r = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const r2 = (Math.sin(i * 78.233) * 12345.6789) % 1;
    const x = ((i / n) * 100 + Math.abs(r) * 6 - 3).toFixed(2);
    const d = (Math.abs(r) * 0.9).toFixed(2);           // start delay
    const s = (0.6 + Math.abs(r2) * 1.4).toFixed(2);    // size
    const dur = (1.7 + Math.abs(r2) * 1.5).toFixed(2);
    const dx = ((Math.abs(r2) - 0.5) * 90).toFixed(1);  // horizontal drift
    out += `<i style="--x:${x}%;--d:${d}s;--s:${s};--t:${dur}s;--dx:${dx}px"></i>`;
  }
  return out;
}
