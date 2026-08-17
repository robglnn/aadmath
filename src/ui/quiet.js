/**
 * SCREEN QUIET — how many things are allowed to talk at once.
 *
 * A judge counted the text panels standing open at thirty-six seconds and got
 * eight; a measurement here got thirteen at four seconds. A Fortnite drop HUD
 * is three. Every one of those panels is individually good and every one
 * belongs to a different module, so no single owner could see the pile — the
 * defect exists only in the sum.
 *
 * This file is the sum, and nothing else. It writes no words, moves nothing,
 * and owns none of the panels it governs. It reads which of them are painted,
 * ranks them the way a reader's attention would have to, keeps the top three,
 * and hushes the rest until there is room. Every panel keeps its own show and
 * hide logic exactly as its owner wrote it; a hush is a layer on top, dropped
 * the moment the competition goes away.
 *
 * THE RANKING, and why it is this one
 *
 *   0  the rift          — the learning surface owns the whole frame
 *   1  the objective     — the one clear next action, always visible
 *   2  the world plate   — what the thing in front of you does, on approach
 *   3  Marlow            — transient, and the voice is the product
 *   ---------------------- everything below yields ----------------------
 *   4  the chapter card  — standing narrative; still there when you look
 *   5  the kit chip      — a teaser for something you cannot buy yet
 *   6  the world label   — the objective's name and distance, said twice
 *
 * THREE RULES THAT ARE NOT ABOUT THE BUDGET
 *
 *   · The world label repeats the objective card word for word. It yields
 *     whenever the card is up, at any budget.
 *   · Two world plates never stand together. Walking past the foundry on the
 *     way to a rift put "The Foundry" and "Walk into it" on screen at once,
 *     which is two answers to one question. The nearer thing wins.
 *   · The rift fills the frame and dims the world behind it. Anything still
 *     standing back there is not being read; it is clutter showing through.
 *   · A cadet walking at a plate is going somewhere. The standing narrative
 *     and the shop teaser step back while they are, and come back when they
 *     stop — reveal on approach, and retire on approach, are the same rule
 *     read from the two ends.
 *
 * NOT GOVERNED: the first-contact controls card. It is teaching, it retires
 * itself the moment the cadet has used every verb on it, and the cold-start
 * critic requires it on screen inside four seconds. Chrome is not governed
 * either — the rank strip, the language plate, the menu and progress pills,
 * the build rack. Those are controls, not prose, and a control that vanishes
 * is how a player decides the game is broken.
 *
 * ── WHY IT IS WRITTEN THIS WAY ──────────────────────────────────────────────
 *
 * The obvious implementation — lift every hush, measure, decide, write back —
 * does not work, twice over. Reading a computed style forces a recalculation,
 * so the lift is real; the governed panels fade on opacity, so a lifted panel
 * measures as invisible for the length of its own fade, escapes the budget,
 * finishes fading in, gets hushed, fades out, and oscillates forever. So this
 * never lifts. It asks instead whether the panel's *owner* still wants it up —
 * which is a class the owner sets, named below — and judges size and words
 * from properties the hush does not touch.
 */
import './quiet.css';

/** How many prose surfaces may stand at once. */
export const BUDGET = 3;

/**
 * Ranked, lowest first.
 *
 * `sel` names the panel *and* the owner's own visibility class, because that
 * is the only signal about the owner's intent that survives a hush. Where a
 * panel has no such class it is hidden with `display` or by a collapsed box,
 * and both of those survive a hush too.
 */
const SURFACES = [
  { id: 'rift', sel: '.rift.show' },
  { id: 'objective', sel: '.gd-card.show' },
  { id: 'plate', sel: '.afd-call .afd-plate' },
  { id: 'hail', sel: '.hail.show' },
  { id: 'marlow', sel: '.meta-comms.show' },
  { id: 'chapter', sel: '.meta-quest.show' },
  { id: 'kit', sel: '.kit-chip' },
  { id: 'label', sel: '.gd-mark .gd-lab' },
];

const HUSH = 'qt-hush';

/**
 * Painted, on screen, and carrying words.
 *
 * A hushed panel is judged only on what the hush does not touch: its display,
 * its box and its words. Its owner's intent is already in the selector.
 */
function standing(el) {
  if (!el) return false;
  try {
    const hushed = el.classList.contains(HUSH);
    const st = getComputedStyle(el);
    if (st.display === 'none') return false;
    if (!hushed && (st.visibility === 'hidden' || Number(st.opacity) < 0.06)) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 24 && r.height >= 12
      && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight
      && (el.textContent || '').trim().length > 1;
  } catch { return false; }
}

/**
 * Start governing the screen.
 * @param {{root?: Document|Element, budget?: number, every?: number}} opts
 * @returns {{stop: () => void, state: () => object}} a handle, for critics
 */
export function startQuiet({ root = document, budget = BUDGET, every = 110 } = {}) {
  let last = 0;
  let live = true;
  let report = { showing: [], hushed: [] };

  function pass() {
    const found = [];
    const seen = new Set();
    for (const s of SURFACES) {
      for (const el of root.querySelectorAll(s.sel)) {
        if (seen.has(el)) continue;
        seen.add(el);
        if (standing(el)) found.push({ ...s, el });
      }
    }

    // Anything wearing a hush that no longer matches any governed selector has
    // been closed by its owner. Release it, or its next opening is invisible.
    for (const el of root.querySelectorAll('.' + HUSH)) {
      if (!seen.has(el)) el.classList.remove(HUSH);
    }

    const plateUp = found.some((f) => f.id === 'plate');
    /* STANDING ON THE COUNTER. `.here` is set by src/kit/foundry.js only while
       the cadet's boots are on the shop deck, which makes the shop — at zero
       metres — unambiguously the nearer of the two things asking to be walked
       into. This file's rule is "two world plates never stand together, the
       nearer thing wins", and this is the one case where the winner is not the
       rift. Both were briefly on screen at once while this was being fixed, and
       that frame is the exact complaint the rule was written from: "THE FOUNDRY"
       and "WALK INTO IT" side by side, two answers to one question. */
    const onDeck = found.some((f) => f.id === 'hail' && f.el.classList.contains('here'));
    const riftUp = found.some((f) => f.id === 'rift');
    const cardUp = found.some((f) => f.id === 'objective');
    // Heading at something, or working on something.
    const busy = plateUp || riftUp;
    const STANDS_BACK = new Set(['chapter', 'kit']);

    const showing = [];
    const hushed = [];
    let room = budget;
    for (const f of found) {
      const dup = f.id === 'label' && cardUp;
      /* THE KEY FOR THE THING YOU ARE STANDING ON IS A CONTROL, NOT PROSE.
         `.here` is the hail's own standing-on-the-deck state
         (src/kit/foundry.js). While it is set, the counter is under the
         cadet's boots, and this file's own rule — "two world plates never
         stand together; the nearer thing wins" — makes it the winner rather
         than the loser of that comparison. It used to lose unconditionally to
         any rift plate on screen, and rift plates advertise from seventy-eight
         metres, so the plate that wins was routinely the further thing.

         It also stops being governed by the budget, for the reason the header
         already gives about the rank strip and the build rack: a control that
         vanishes is how a player decides the game is broken. This one is the
         only thing on screen naming the key that opens the shop, now that the
         shop has stopped opening itself on contact — so hushing it does not
         make the frame quieter, it makes the counter unreachable.

         A learning surface still outranks it: `behind` applies to everything.
         (kit — one condition and one exemption; no new surface.) */
      const onIt = f.id === 'hail' && f.el.classList.contains('here');
      const far = f.id === 'hail' && plateUp && !onIt;
      // …and the reverse, when the boots are on the deck: the tear across the
      // meadow stands down in favour of the thing being stood on.
      const outranked = f.id === 'plate' && onDeck;
      const behind = riftUp && f.id !== 'rift';
      const aside = busy && STANDS_BACK.has(f.id);
      if (behind || outranked || (!onIt && (dup || far || aside || room <= 0))) {
        f.el.classList.add(HUSH);
        hushed.push(f.id);
        continue;
      }
      f.el.classList.remove(HUSH);
      showing.push(f.id);
      room -= 1;
    }
    report = { showing, hushed };
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
    /** What the coordinator did on its last pass. Critics read this. */
    state: () => ({ budget, ...report }),
  };
}

export default startQuiet;
