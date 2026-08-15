/**
 * The comms channel — Marlow's voice.
 *
 * Three things this has to get right, and the first version got one:
 *
 *  1. QUEUEING. Two things worth saying inside five seconds and the old
 *     subtitle clobbered itself, so you only ever read the second one. Lines
 *     land in order, type on at a readable rate, hold for as long as their
 *     length deserves, and hand over.
 *
 *  2. NOT REPEATING. A companion who says the same sentence seven times in
 *     ninety seconds is not dry and wounded, she is a broken record. Every line
 *     carries a `tag`; a tag can declare a cooldown, and independently of that
 *     the channel refuses any text it has spoken in its last eight lines. If a
 *     beat has nothing new to say it says nothing — which is a thing a person
 *     with a voice does and a notification system never does.
 *
 *  3. STAYING IN ONE LANGUAGE. Lines are stored as *resolvers*, not as strings.
 *     The opening speech sits in this queue for the best part of half a minute;
 *     switching locale inside that window re-resolves the line on screen and
 *     every line still queued behind it, keeps the typing position
 *     proportional, and drops anything that cannot be re-resolved rather than
 *     leaving an English sentence under a Spanish header.
 *
 * It renders no HTML from its input: text is written with textContent, so a
 * translated string can never inject markup.
 */
import { t } from '../i18n/index.js';

const CPS = 88;                       // characters revealed per second

/* HOW LONG A LINE STAYS UP, AND WHY IT IS NOT 2.9 SECONDS ANY MORE.
 *
 * src/ui P1 — a cold critic read the arrival speech and reported "two lines of
 * typewriter prose, clipped mid-word, fired twice inside the first 100 seconds.
 * No 15-year-old reads that." Nothing was clipping it. It was being taken away.
 *
 * The old hold was `min(2.9, max(1.35, 1.1 + len * 0.011))`, which saturates at
 * 2.9 s for anything over 164 characters — so the LONGER a line was, the less
 * time per word it got. Measured against the bundle: `story.open.l3` is 216
 * characters, took 2.45 s to type and held 2.90 s, giving 5.35 s on screen. A
 * fifteen-year-old reading at 200 wpm needs 11.8 s for it. It was removed with
 * six and a half seconds of reading still to do, every single time, which from
 * the reader's seat is a sentence cut off in the middle of a word.
 *
 * The hold is now the reading time the words actually cost, less the time the
 * typewriter already spent revealing them, plus a beat to finish the last word.
 * READ_CPS is 17 characters per second — about 185 wpm, which is a comfortable
 * teenage silent-reading rate rather than an adult skimming one.
 *
 * The ceiling is the backstop, not the design: the lines themselves were cut to
 * length in src/i18n (nothing Marlow says on arrival is over ~110 characters in
 * any of the three locales), and `tools/critic/marlow-length.mjs` fails the
 * build if one grows back.
 */
const READ_CPS = 17;
const HOLD_MIN = 1.5, HOLD_MAX = 6.2;
const MEMORY = 8;                     // lines of "do not say that again"

/** Seconds a fully-typed line stays on screen. */
function holdFor(len) {
  return Math.min(HOLD_MAX, Math.max(HOLD_MIN, len / READ_CPS - len / CPS + 0.8));
}

export class Comms {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'meta-comms';
    this.el.setAttribute('role', 'status');
    this.el.innerHTML = `
      <div class="meta-face">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle class="iris" cx="12" cy="12" r="9" stroke-dasharray="14 9"/>
          <circle class="iris b" cx="12" cy="12" r="5.6" stroke-dasharray="7 5"/>
          <circle class="pupil" cx="12" cy="12" r="1.7"/>
        </svg>
      </div>
      <div>
        <div class="meta-head">
          <b class="who"></b><span class="role"></span>
          <span class="meta-wave">${'<i></i>'.repeat(9)}</span>
        </div>
        <div class="meta-text"><span class="body"></span><span class="caret"></span></div>
      </div>`;
    this.who = this.el.querySelector('.who');
    this.role = this.el.querySelector('.role');
    this.body = this.el.querySelector('.body');
    this.caret = this.el.querySelector('.caret');
    root.appendChild(this.el);

    this.queue = [];
    this.cur = null;
    this.shown = 0;
    this.hold = 0;
    this.gap = 0;
    this.spoken = [];       // recent texts, newest last — the anti-parrot memory
    this.cools = new Map(); // tag -> seconds remaining
    this.refreshNames();
  }

  refreshNames() {
    this.who.textContent = t('story.marlow.name');
    this.role.textContent = t('story.marlow.role');
  }

  // -------------------------------------------------------------------------
  // Saying things
  // -------------------------------------------------------------------------

  /**
   * Queue one line.
   * @param {() => string} resolve renders the line in the *current* locale
   * @param {{now?:boolean, tag?:string, cooldown?:number, force?:boolean}} o
   * @returns {boolean} whether the channel accepted it
   */
  push(resolve, o = {}) {
    const text = render(resolve);
    if (!text) return false;
    if (!o.force) {
      if (o.tag && (this.cools.get(o.tag) || 0) > 0) return false;
      if (this.spoken.includes(text)) return false;
      if (this.cur?.text === text) return false;
      if (this.queue.some((q) => q.text === text)) return false;
    }
    if (o.tag && o.cooldown) this.cools.set(o.tag, o.cooldown);
    const item = { text, resolve, tag: o.tag || null, volatile: !!o.volatile };
    if (o.now) {
      this.queue.unshift(item);
      this.gap = 0;
      if (this.cur) this._finish();
    } else {
      this.queue.push(item);
    }
    if (this.queue.length > 5) this.queue.length = 5;
    return true;
  }

  /**
   * Queue one i18n key. This is the form every narrative beat uses; `params`
   * may itself be a function so a line can name whatever the player just did.
   */
  sayKey(key, o = {}) {
    const p = o.params;
    return this.push(() => t(key, typeof p === 'function' ? p() : p), { tag: key, ...o });
  }

  /**
   * Queue a literal string with no key behind it. Used only for the handful of
   * lines that reach the channel already rendered; they are marked volatile and
   * are dropped rather than left stranded when the language changes.
   */
  say(text, o = {}) {
    if (!text) return false;
    return this.push(() => text, { volatile: true, ...o });
  }

  /** Queue a run of i18n keys as one speech. Beats are never deduped away. */
  sayKeys(keys, params) {
    for (const k of keys) this.push(() => t(k, params), { tag: k, force: true });
  }

  clear() {
    this.queue.length = 0;
    this._finish();
  }

  get busy() { return !!this.cur || this.queue.length > 0; }

  /** Has this tag's cooldown expired? */
  ready(tag) { return (this.cools.get(tag) || 0) <= 0; }

  /** Start a cooldown without saying anything. */
  cool(tag, secs) { this.cools.set(tag, secs); }

  // -------------------------------------------------------------------------
  // Locale
  // -------------------------------------------------------------------------

  /**
   * The language changed under a speech already in flight. Everything that
   * knows how to render itself renders again; the line being typed keeps the
   * *proportion* of itself it had revealed, so the caret does not jump
   * backwards and a mid-sentence switch reads as the channel retuning.
   */
  relocalise() {
    this.refreshNames();
    this.queue = this.queue.filter((q) => !q.volatile);
    for (const q of this.queue) { const s = render(q.resolve); if (s) q.text = s; }
    this.spoken.length = 0;
    // Nothing is being said: the panel is already hidden, but the words of the
    // last line are still sitting in it. Left there, they are an English
    // sentence under a Spanish header the moment anyone looks — including a
    // screenshot taken a beat late. A channel that is not talking says nothing.
    if (!this.cur) { this.body.textContent = ''; return; }
    const now = this.cur.volatile ? '' : render(this.cur.resolve);
    if (!now) { this._finish(); return; }
    const frac = this.cur.text.length ? Math.min(1, this.shown / this.cur.text.length) : 1;
    this.cur.text = now;
    this.shown = Math.max(1, Math.round(frac * now.length));
    this.body.textContent = now.slice(0, Math.floor(this.shown));
    this.hold = Math.max(this.hold, 1.1);
  }

  // -------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------
  _finish() {
    this.cur = null;
    this.el.classList.remove('show', 'talk');
    this.caret.style.display = 'none';
  }

  _start(item) {
    this.cur = item;
    this.shown = 0;
    this.hold = holdFor(item.text.length);
    this.body.textContent = '';
    this.caret.style.display = '';
    this.el.classList.add('show', 'talk');
    this.spoken.push(item.text);
    if (this.spoken.length > MEMORY) this.spoken.shift();
    this.onLine?.(item);
  }

  update(dt) {
    if (this.cools.size) {
      for (const [k, v] of this.cools) {
        const n = v - dt;
        if (n <= 0) this.cools.delete(k); else this.cools.set(k, n);
      }
    }
    if (!this.cur) {
      if (this.gap > 0) { this.gap -= dt; return; }
      const next = this.queue.shift();
      if (next) this._start(next);
      return;
    }
    const full = this.cur.text;
    if (this.shown < full.length) {
      this.shown = Math.min(full.length, this.shown + CPS * dt);
      this.body.textContent = full.slice(0, Math.floor(this.shown));
      if (this.shown >= full.length) {
        this.el.classList.remove('talk');
        this.caret.style.display = 'none';
      }
      return;
    }
    this.hold -= dt;
    if (this.hold <= 0) {
      this._finish();
      this.gap = this.queue.length ? 0.42 : 0.1;
    }
  }
}

function render(fn) {
  try { const s = fn(); return typeof s === 'string' ? s : ''; } catch { return ''; }
}
