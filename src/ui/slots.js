/**
 * SLOTS — no two transient surfaces in the same place. One rule, one owner.
 *
 * Read src/ui/slots.css first: it holds the discipline and the tokens. This
 * file is the two jobs that discipline needs and CSS cannot do.
 *
 * JOB 1 — PUBLISH THE HEIGHTS THAT ARE NOT KNOWABLE IN CSS.
 *
 *   Two surfaces in this game stand on a neighbour whose height is written by a
 *   translator: the notice toast sits under the run band, and the ledger rows
 *   sit over the kit strip. The band is 69 px in English at 1600x900 and taller
 *   in Polish; the strip is one row until a sixth verb is bought and then it is
 *   two, and it grows UPWARD because it is anchored to its own bottom edge.
 *   Every offset in this game that cleared one of those cleared it with a
 *   number that happened to work in English on a laptop. That is how the VAULT
 *   PLATE chip ended up standing on the second line of "−5 Rift surge".
 *
 *   So the neighbour is MEASURED and its height published as `--slot-band` and
 *   `--slot-kit-h`. src/ui/slots.css does the arithmetic; nothing guesses.
 *
 * JOB 2 — ARBITRATE WHAT IS LEFT.
 *
 *   Slotting separates the surfaces that CAN be separated. On a frame short
 *   enough, or in a language long enough, two of them still meet — and the
 *   honest answer there is not a smaller font, it is that one of them waits.
 *
 * THE ORDER, and why it is this order.
 *
 *   1  RUN BAND     the frame the session happens inside.
 *   2  KIT STRIP    what mastery bought, and what it costs to use.
 *   3  GRANT CARD   what mastery just bought. Five seconds, once, ever.
 *   4  LEDGER ROW   every movement of the wallet — and the ONE printing, ever,
 *                   of what a word like "surge" means.
 *   ----------------------- everything below yields -----------------------
 *   5  NOTICE       the answer to a button the player just pressed.
 *   6  PROMPT       a verb they can press again in five seconds, and one the
 *                   world's own plate is still naming on the ring itself.
 *
 *   THE FIRST FOUR NEVER YIELD, and that is deliberate rather than lazy.
 *
 *   · An instrument that vanishes is how a player decides the game is broken.
 *   · Hushing a grant card does not delay a capability, it spends it: the card
 *     runs its own 5.2 s clock and would burn it invisibly. src/kit/kit.js
 *     already has the right answer for that surface — it RETRACTS the card and
 *     puts it back at the head of its queue — and two opinions about one card
 *     is the same thing as none.
 *   · A ledger row prints the meaning of a word ONCE and then marks it taught
 *     (FIRST SIGHT, src/kit/ledger.css), so a hush that spends its clock
 *     destroys a definition rather than delaying one. src/kit/ledger.js counts
 *     a row's life in painted time now, which makes standing one down safe —
 *     and src/ui/landscape.css does exactly that under the grant card, because
 *     390 px of height has one middle and the card owns it. This file still
 *     does not, for the same reason it does not hush the grant card: the module
 *     that owns a surface is entitled to compose its own frame, and an arbiter
 *     that second-guesses that is a second opinion about one card.
 *
 *   So a clash among the first four is a LAYOUT defect with no runtime answer,
 *   and tools/critic/transient.mjs fails the build for one. The hush exists for
 *   the two surfaces that can honestly come back in a moment, and nothing else.
 *
 * NOT GOVERNED: anything modal. A rift, a rite, a chapter turn and a session
 * beat already take the frame outright, by `:has()` rules in the modules that
 * own them, and this file must not be a second opinion about that.
 *
 * WHY IT NEVER LIFTS TO MEASURE. src/ui/quiet.js learned this the hard way and
 * the trap is the same one: a hush that used `display` would take a panel's box
 * away, the collision would disappear, the hush would come off, and the pair
 * would flicker forever at nine times a second. `.slot-yield` takes the ink and
 * leaves the box — so a yielded surface is measured exactly where it would have
 * stood, and the decision to release it is made on the same geometry that made
 * the decision to make it.
 */
import './slots.css';

/** Neighbours whose height decides where the surface above or below them goes. */
const MEASURE = [
  { sel: '.ses-band', prop: '--slot-band', min: 40 },
  { sel: '.kit', prop: '--slot-kit-h', min: 18 },
];

/**
 * Every transient surface, best claim first. `hush: false` means a clash here
 * is a defect for the layout to answer, not something to paper over at runtime.
 */
const SURFACES = [
  { id: 'band', sel: '.ses-band.show', hush: false },
  { id: 'kit', sel: '.kit.any', hush: false },
  { id: 'grant', sel: '.kit-toast.show', hush: false },
  { id: 'ledger', sel: '.led-row.in', hush: false },
  { id: 'notice', sel: '#toast.show', hush: true },
  { id: 'prompt', sel: '.gd-prompt.show', hush: true },
];

const HUSH = 'slot-yield';

/** Two boxes that share more than a hairline of glass. */
function meets(a, b, pad = 2) {
  return Math.min(a.right, b.right) - Math.max(a.left, b.left) > pad
    && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > pad;
}

/**
 * On the glass: it has a real box, that box is on this screen, and there is ink
 * in it.
 *
 * A surface this file yielded still answers yes — that is the whole point of
 * `.slot-yield` keeping the box, and it is how the yield gets lifted again. A
 * surface its OWN module has stood down does not: on a 390 px phone the
 * controls card takes the frame and src/ui/portrait.css hides the kit strip and
 * drops its reserve, so the ledger legitimately stands where the strip would
 * have been. Counting an invisible strip's box as a claim reported that as a
 * collision in ten frames that a player would see nothing wrong with.
 */
function boxOf(el) {
  try {
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'collapse') return null;
    /* The whole chain, not just this element. A ledger ROW carries
       `opacity: 1` of its own while the STRIP around it has been stood down —
       src/ui/landscape.css hands the middle of a 390 px screen to the grant
       card and takes it from the strip — and a row judged on its own ink
       reported a collision with a card that had already won the argument. */
    let op = el.classList.contains(HUSH) ? 1 : parseFloat(st.opacity || '1');
    for (let n = el.parentElement; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return null;
      op *= parseFloat(cs.opacity || '1');
    }
    if (op < 0.06) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return null;
    if (r.right <= 0 || r.bottom <= 0 || r.left >= innerWidth || r.top >= innerHeight) return null;
    return r;
  } catch { return null; }
}

/**
 * Start keeping the slots.
 * @param {{root?: Document|Element, every?: number}} opts
 * @returns {{stop: () => void, state: () => object}} a handle, for critics
 */
export function startSlots({ root = document, every = 110 } = {}) {
  const host = document.documentElement;
  let last = 0;
  let live = true;
  let report = { standing: [], yielded: [], clashes: [], sizes: {} };

  function publish() {
    const sizes = {};
    for (const m of MEASURE) {
      const el = root.querySelector(m.sel);
      const r = el ? boxOf(el) : null;
      /* A surface that is not up has no height to publish, and writing 0 would
         drop the stack above it onto whatever is under it the moment the band
         retires between two runs. The last real height stands until there is a
         new one. */
      if (!r || r.height < m.min) continue;
      const h = Math.round(r.height);
      sizes[m.prop] = h;
      host.style.setProperty(m.prop, h + 'px');
    }
    return sizes;
  }

  function pass() {
    const sizes = publish();

    const claimed = [];        // { id, r } — glass already spoken for
    const standing = [];
    const yielded = [];
    const clashes = [];

    for (const s of SURFACES) {
      for (const el of root.querySelectorAll(s.sel)) {
        const r = boxOf(el);
        if (!r) continue;
        const on = claimed.find((c) => meets(c.r, r));
        if (!on) {
          el.classList.remove(HUSH);
          claimed.push({ id: s.id, r });
          standing.push(s.id);
          continue;
        }
        if (s.hush) {
          el.classList.add(HUSH);
          yielded.push({ id: s.id, under: on.id });
        } else {
          /* Nothing to do about it here, and saying so is the point: this is
             the pair tools/critic/transient.mjs exists to fail the build on. */
          el.classList.remove(HUSH);
          claimed.push({ id: s.id, r });
          standing.push(s.id);
          clashes.push({ a: on.id, b: s.id });
        }
      }
    }

    /* Anything still wearing a hush whose owner has since retired it: release
       it, or the next time the owner shows it, it comes up invisible. */
    for (const el of root.querySelectorAll('.' + HUSH)) {
      if (!SURFACES.some((s) => s.hush && el.matches(s.sel))) el.classList.remove(HUSH);
    }

    report = { standing, yielded, clashes, sizes };
  }

  function tick(now) {
    if (!live) return;
    if (now - last >= every) { last = now; pass(); }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  return {
    stop() {
      live = false;
      for (const el of root.querySelectorAll('.' + HUSH)) el.classList.remove(HUSH);
    },
    /** What the last pass decided. tools/critic/transient.mjs reads this. */
    state: () => ({ ...report }),
  };
}

export default startSlots;
