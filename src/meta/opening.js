/**
 * The cold open.
 *
 * The first frame of Breath of the Wild carries one piece of UI. Ours carried
 * nine — a rig readout, a hotbar, a crosshair, a chapter card and a language
 * switcher all fighting a sunrise. So the opening now takes the screen back:
 * `#ui` gets `meta-cine` for as long as the open lasts and every readout stands
 * down, leaving the sky, the island, and a location stamp that draws its own
 * rule. The instruments fade back in as the chrome retracts.
 *
 * You can walk during it, and the moment you do it ends and never comes back.
 * An opening that has to be sat through is a cutscene; an opening you can walk
 * out of is a place.
 */
import { t } from '../i18n/index.js';

export class ColdOpen {
  constructor(root) {
    this.root = root;
    this.el = document.createElement('div');
    this.el.className = 'meta-open';
    this.el.innerHTML = `
      <div class="meta-bar t"></div>
      <div class="meta-bar b"></div>
      <div class="meta-stamp">
        <div class="s0"></div>
        <div class="s1"></div>
        <div class="rule"></div>
        <div class="s2"></div>
        <div class="s3"></div>
      </div>`;
    this.s0 = this.el.querySelector('.s0');
    this.s1 = this.el.querySelector('.s1');
    this.s2 = this.el.querySelector('.s2');
    this.s3 = this.el.querySelector('.s3');
    root.appendChild(this.el);
    this.done = false;
    this.retext();
  }

  retext() {
    this.s0.textContent = t('story.place.approach');
    this.s1.textContent = t('story.place.lattice');
    this.s2.textContent = t('story.place.shard');
    this.s3.textContent = t('story.place.when');
  }

  begin() {
    this.root.classList.add('meta-cine');
    // world/hotfix: the stamp arrives *after* the instruments have gone, not
    // through them. The chrome fades out in .55s and the stamp used to fade in
    // over the same window — at 390 in Polish "Odłamek Dziewiąty · lądowisko
    // kadetów" is 329 px wide and was photographed crossing the objective card
    // while both were half lit. It leaves the same way; see `end()`.
    clearTimeout(this._in);
    this._in = setTimeout(() => { if (!this.done) this.el.classList.add('on'); }, 600);
  }

  /** Retract. Idempotent — movement, a rift, or the timer can all call it. */
  end() {
    if (this.done) return;
    this.done = true;
    clearTimeout(this._in);
    this.el.classList.remove('on');
    // world/hotfix: the stamp leaves before the instruments come back, rather
    // than the two crossfading through each other. Photographed mid-retraction
    // at 1600x900 the objective card was legible *through* THE SKYREN LATTICE,
    // and on a 414 phone the companion's card came up through the shard line.
    // The stamp's fade-out is .5s (src/meta/meta.css); this is that, plus air.
    setTimeout(() => this.root.classList.remove('meta-cine'), 560);
    setTimeout(() => { this.el.style.display = 'none'; }, 1300);
  }
}
