/**
 * TAGSPACE — there is one screen, and everything printed on it has to be read.
 *
 * A critic photographed the game on a 390-pixel phone, at the default spawn,
 * on a clean save, and wrote:
 *
 *   "'STEP ONTO THE PLATE · READING A VARIABLE' is drawn straight through
 *    'THE FOUNDRY / WHERE SHARDS ARE SPENT'. At 390 wide the words THE FOUNDRY
 *    are wholly unreadable. The world-tag layer has no collision avoidance and
 *    a phone has a third of the horizontal room."
 *
 * It had collision avoidance, twice, and that was the defect. `afford.js` kept
 * a list of the boxes *it* had placed; `beckon.js` kept a different list of the
 * boxes *it* had placed; each estimated its own widths from a character count
 * and a magic number; and neither had ever heard of the foundry's hail, the
 * companion's card, the cold open's stamp or a thumb's worth of on-screen
 * controls. Three private opinions about one screen is the same thing as none.
 *
 * So there is now exactly one opinion, and this is it.
 *
 *   ONE FRAME, ONE LEDGER.  Every world label in the game submits a *request*
 *   — an anchor point, the element to measure, a priority — and nothing is
 *   positioned until every layer has spoken. Requests are then served in
 *   priority order: the tear the scheduler is actually asking for is placed
 *   before a vein label, and a vein label before the far side of the island.
 *
 *   THE CHROME CLAIMS FIRST.  Before any of them, the fixed UI already on the
 *   glass is measured off the live DOM — Marlow's card, the location stamp, the
 *   foundry's plate, the rig, the hotbar, the thumbstick — and reserved. A
 *   world label may be suppressed by the companion talking over its patch of
 *   sky, and never the other way round. Measured, not hard-coded, because the
 *   card is five lines in Polish and three in English and neither number
 *   belongs in a JavaScript file.
 *
 *   SLIDE, THEN STACK, THEN SHUT UP.  A request that will not fit at its anchor
 *   is walked away from it along one axis — the label stays attached to its
 *   object by a lengthening stem, which is a thing a reader can follow — and if
 *   there is no clear band at all it is dropped for this frame. A label nobody
 *   can read is worth less than the sky behind it.
 *
 * Cost: one forced layout per frame for the whole game, because every size is
 * read before any position is written. The old code interleaved a read and a
 * write per label and paid for a reflow each time.
 */

/** Air every label keeps around itself, so two of them never merely kiss. */
const PAD = 5;
/** …and off the edge of the glass. */
const EDGE = 4;
/**
 * Seconds between *sweeps* for new furniture. The rectangles themselves are
 * re-read every frame off cached live style objects — a card that is 250 ms
 * into a fade is already on the glass, and a label that waited for the next
 * sweep to notice was photographed sitting on the objective card at 414.
 */
const REFRESH = 0.25;
/** Below this a card is on its way in or out and is not yet worth avoiding. */
const FAINT = 0.03;
/** How far up the tree an opacity is worth looking for. */
const DEPTH = 4;

/**
 * The furniture. Anything in here is *already on the glass* and a world label
 * must go round it. Listed as selectors rather than passed in, because a world
 * module has no business holding a reference to the companion's card — and a
 * selector that matches nothing in some future build costs nothing here.
 */
const CHROME = [
  '.meta-comms',                    // Marlow
  '.meta-stamp',                    // the cold open's location stamp
  '.meta-quest', '.meta-turn .tn-in', '.meta-rite .rite-in',
  '.hail',                          // the foundry counter's own plate
  '.hud-top', '.langs', '.toast', '.marlow', '.buildbar', '.kit',
  '.afd-head',                      // our own compass
  '.gd-card', '.gd-prompt', '.gd-mark',
  '.fc-card', '.fcs',               // the controls card and its pill (src/player)
  '.field-tag',                     // a cache's own maths, pinned to the puzzle
  '.rp-launch',
  '#touchpad .pads', '#touchpad .home',
  /* Six more plates that were on the glass and not on this list, found by
     photographing a phone in landscape for the first time: at 844x390 the
     wallet's ledger strip and WALK INTO IT were printed through each other.
     Every one of these is furniture a world label must walk around, and a
     selector that matches nothing costs nothing here. (mobile-landscape pass —
     additive selectors only; no behaviour in this file is changed.) */
  '.ledger',                        // the wallet's own audit trail (src/kit)
  '.sound',                         // the audio chip (src/audio)
  '.axiom', '.axiom-clear',         // the build charge and its clear (src/build)
  '.mnu-pill',                      // the way out (src/ui/menu.js)
  '.ses-band',                      // the run's own progress (src/session)
];

/** Vertical steps a label is allowed to walk away from its anchor, in px. */
const SLIDE = [0, 16, 34, 56, 82, 112];
/** …and the same for a label that sits *on* its anchor rather than above it. */
const SPAN = [0, -20, 20, -42, 42, -68, 68];

let W = 0, H = 0;
let frameKey = -1;
let lastMeasure = -1e9;
let sealed = false;
let dropped = 0;

const watch = [];         // {el, chain} — the furniture, re-found on a timer
const chrome = [];        // [l, t, r, b] — where it is, this frame
const claimed = [];       // [l, t, r, b] — everything spoken for, this frame
const queue = [];         // requests awaiting a resolve

/**
 * Find the furniture. Expensive, so it runs on a timer — but what it caches is
 * the *elements* and their live computed-style objects, not their rectangles.
 * A card only enters or leaves the page occasionally; it changes size, position
 * and opacity constantly, and that is read fresh every frame below.
 */
function sweep() {
  watch.length = 0;
  for (const sel of CHROME) {
    let found;
    try { found = document.querySelectorAll(sel); } catch { continue; }
    for (const el of found) {
      const chain = [];
      for (let n = el, i = 0; n && n.nodeType === 1 && i < DEPTH; n = n.parentElement, i++) {
        chain.push(getComputedStyle(n));      // live: read it again next frame
      }
      watch.push({ el, chain });
    }
  }
}

/** …and this is per frame: who is actually on the glass, and exactly where. */
function measureChrome() {
  chrome.length = 0;
  for (const w of watch) {
    let o = 1, gone = false;
    for (const cs of w.chain) {
      if (cs.display === 'none' || cs.visibility === 'hidden') { gone = true; break; }
      o *= Number(cs.opacity);
      if (o < FAINT) { gone = true; break; }
    }
    if (gone) continue;
    const r = w.el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (r.right < 0 || r.bottom < 0 || r.left > W || r.top > H) continue;
    chrome.push([r.left, r.top, r.right, r.bottom]);
  }
}

/**
 * Open the ledger for this frame. Idempotent — whichever world layer runs first
 * calls it, the rest are no-ops, and none of them has to know which is which.
 */
export function beginTagFrame(time) {
  if (time === frameKey) return;
  // Insurance: a layer submitted and nothing ever resolved (a module was busy
  // and returned early). Serve them late rather than leaving them stranded.
  if (queue.length) flush();
  frameKey = time;
  W = window.innerWidth;
  H = window.innerHeight;
  claimed.length = 0;
  sealed = false;
  dropped = 0;
  if (time - lastMeasure >= REFRESH || time < lastMeasure) {
    lastMeasure = time;
    sweep();
  }
  measureChrome();
  for (const r of chrome) claimed.push(r);
}

/**
 * Ask for room.
 *
 * @param {object} req
 * @param {HTMLElement} req.measure  the box that carries the text
 * @param {number} req.x  anchor, screen px — the thing being labelled
 * @param {number} req.y  …ditto
 * @param {number} req.gap  px between the anchor and the near edge of the label
 * @param {'up'|'mid'} req.dir  does the label hang off the anchor, or sit on it
 * @param {number} req.pri  lower is served first. Relevance, not registration.
 * @param {number} req.dist  metres, the tie-break inside one priority
 * @param {(cx:number, top:number, side:number)=>void} req.place  granted
 * @param {()=>void} req.hide  refused — there is no readable band this frame
 */
export function submitTag(req) {
  queue.push(req);
  // A layer that runs *after* the resolve still gets served, against whatever
  // is already spoken for. Order of update calls is not this module's problem.
  if (sealed) flush();
}

/** Close the ledger and serve it. Called by the last world layer in the frame. */
export function resolveTags() {
  sealed = true;
  flush();
}

function overlaps(l, t, r, b) {
  for (const q of claimed) {
    if (l < q[2] + PAD && r > q[0] - PAD && t < q[3] + PAD && b > q[1] - PAD) return true;
  }
  return false;
}

function flush() {
  if (!queue.length) return;
  // Every size is read here, in one pass, before a single position is written:
  // one forced layout for the whole frame instead of one per label.
  for (const it of queue) {
    const m = it.measure;
    it._w = m.offsetWidth;
    it._h = m.offsetHeight;
  }
  queue.sort((a, b) => (a.pri - b.pri) || (a.dist - b.dist));
  for (const it of queue) serve(it);
  queue.length = 0;
}

function serve(it) {
  const w = it._w, h = it._h;
  if (!w || !h) { it.hide(); return; }
  // Horizontal is clamped, never searched: a label that slides sideways stops
  // being *this* object's label. Vertical is where the room is anyway.
  const cx = Math.max(EDGE + w / 2, Math.min(W - EDGE - w / 2, it.x));
  const l = cx - w / 2, r = cx + w / 2;

  if (it.dir === 'mid') {
    for (const d of SPAN) {
      const t = it.y - h / 2 + d;
      if (t < EDGE || t + h > H - EDGE) continue;
      if (overlaps(l, t, r, t + h)) continue;
      claimed.push([l, t, r, t + h]);
      it.place(cx, t, 0, w, h);
      return;
    }
  } else {
    const gap = it.gap || 0;
    for (const k of SLIDE) {                       // above the anchor, rising
      const t = it.y - gap - h - k;
      if (t < EDGE) break;
      if (overlaps(l, t, r, t + h)) continue;
      claimed.push([l, t, r, t + h]);
      it.place(cx, t, -1, w, h);
      return;
    }
    for (const k of SLIDE) {                       // …then below it, falling
      const t = it.y + gap + k;
      if (t + h > H - EDGE) break;
      if (overlaps(l, t, r, t + h)) continue;
      claimed.push([l, t, r, t + h]);
      it.place(cx, t, 1, w, h);
      return;
    }
  }
  dropped++;
  it.hide();
}

/** What the ledger did this frame. Critics read this; nobody's summary. */
export function tagSpaceState() {
  return {
    view: [W, H],
    chrome: chrome.length,
    claimed: claimed.map((r) => r.map(Math.round)),
    dropped,
  };
}
