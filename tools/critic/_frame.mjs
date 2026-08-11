/**
 * WHO OWNS THE FRAME — the shared in-page probe.
 *
 * ASCENT has nine surfaces that can take the whole screen: the tear, the four
 * narrative beats, the two report surfaces and the three session beats. Each of
 * them is a ceremony — a thing that says "stop, look at this" — and the rule
 * they must obey is that **exactly one of them may be on screen at a time**.
 *
 * That rule was being broken silently. The rank rite (`.meta-rite`, z-index 40)
 * and the session's close card (`.ses-close`, z-index 44) are both type over a
 * *semi-transparent* dim, on purpose, so that the world stays in the frame. Put
 * them up together and neither one hides the other: the word GOLD printed
 * straight through the résumé with "from 16 questions worked" sitting on its O
 * and L. A higher z-index does not fix that, because there is no opaque layer
 * anywhere in either card to raise.
 *
 * So the check is made of two assertions, and every capture that drives an
 * ending runs both:
 *
 *   1. ONE CEREMONY. At most one full-screen ceremony layer may be visible.
 *      "Visible" is measured off the live DOM — display, visibility and the
 *      whole opacity chain — not off a class name, because a layer mid-fade is
 *      still a layer the eye can read.
 *   2. NO TWO TEXT NODES INTERSECT. Every leaf element carrying visible text
 *      inside any visible ceremony (plus the lower-third channel, which is not
 *      a ceremony but is text over the same pixels) is measured as *ink* — a
 *      Range over its contents, one rect per painted line — so a wrapped
 *      paragraph is measured as its lines and a centred kicker is measured as
 *      its glyphs rather than as the full width of its block. Any two whose ink
 *      overlaps are a hit, unless there is a genuinely opaque painted layer
 *      between them, which is the only honest way for one piece of text to be
 *      in front of another.
 *
 * Both live here so the ending sweep (`_endsweep.mjs`) and the ceremony matrix
 * (`_ceremony.mjs`) assert exactly the same thing in exactly the same words.
 */

/** Every layer in the game that can hold the whole frame. */
export const LAYERS = [
  ['.rift', 'tear'],
  ['.meta-open', 'cold open'],
  ['.meta-rite', 'rank rite'],
  ['.meta-turn', 'chapter plate'],
  ['.meta-dossier', 'dossier'],
  ['.rp-scrim', 'progress report'],
  ['.ses-charter', 'orders'],
  ['.ses-close', 'close'],
  ['.ses-rest', 'break'],
];

/**
 * Text that is not a ceremony but is painted over the same pixels, so it is
 * measured alongside whatever ceremony is up. Marlow's channel is the one that
 * matters: an act's lines are queued on a timer and can arrive over a card.
 */
export const COMPANIONS = [
  '.meta-comms', '.marlow', '.toast', '.kit-toast', '.ses-band',
  // The two readouts a centred ceremony can actually reach on a phone: the
  // chapter card and the rig. On a 414 px screen the chapter plate's own
  // kicker landed on the chapter card that had just flared for it.
  '.meta-quest', '.hud-top',
  // …and the direction card, the waypoint and the key prompt (src/meta/guide.js),
  // which are the newest readouts in the game and were the ones a close card
  // still had standing in its corner.
  '.gd-card', '.gd-prompt', '.gd-mark',
];

/**
 * KNOWN, NAMED, AND NOT OURS.
 *
 * One pair is printed on every run and does not fail it. It is real — the probe
 * is right about it — and it lives in a surface this sweep's author does not own
 * and must not silently rewrite (BRIEF.md: "Never break someone else's area").
 * It is listed here in words, rather than tolerated by a threshold, so that it
 * stays visible to whoever does own it. It needs a tear on screen, and no tear
 * is ever on screen during a session beat, so it cannot mask anything in the
 * ending sequence this sweep exists to guard.
 *
 *   `.rift` × `.meta-comms` — CALL THE ECHO in the panel's footer lands on
 *   Marlow's channel, 68x9 px at 1600x900 EN, whenever she is mid-line as the
 *   panel opens. She has to keep talking through a tear — that is where she
 *   answers an answer — so the fix is placement, not silence: the channel
 *   belongs outside the panel's footprint while a tear is open, or the panel
 *   has to leave the lower third alone. (src/ui/rift.css + src/meta/comms.js)
 *
 * The two that used to be here — the tear's chrome over the rig, and the tear's
 * mathematics over the chapter card on a phone — are fixed: both readouts now
 * stand down while a tear owns the frame (src/meta/meta.css).
 */
export const KNOWN = [
  ['.rift', '.meta-comms', "the tear's footer over Marlow's channel — src/ui/rift.css + src/meta"],
  // The waypoint marker is world-space: it is projected from a point out in the
  // shard, so it can land anywhere on the glass, including on top of a HUD
  // readout (measured: 16x3 px on the chapter card's title at 414x896 ES). That
  // is a property of a diegetic marker, and keeping it out of the corners the
  // HUD owns belongs to src/meta/guide.js.
  ['.gd-mark', '.meta-quest', 'world-space waypoint over a HUD card — src/meta/guide.js'],
];

/* -------------------------------------------------------------------------
   The probe. Stringified so both drivers can hand it to page.evaluate without
   importing this module into the browser.
   Argument: { layers: [[sel,name]…], extra: [sel…], scope: sel|null }
   ---------------------------------------------------------------------- */
export const FRAME_PROBE = /* js */`(cfg) => {
  const chainOpacity = (el, stop) => {
    let o = 1;
    for (let n = el; n && n !== stop; n = n.parentElement) o *= +getComputedStyle(n).opacity;
    return o;
  };
  const shown = (el) => {
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const c = getComputedStyle(n);
      if (c.display === 'none' || c.visibility === 'hidden') return false;
    }
    return chainOpacity(el, null) > 0.02;
  };
  /* KaTeX paints every formula twice: once as HTML for the eye and once as
     MathML for a screen reader, and the MathML copy is hidden by clipping its
     host to one pixel — which its children's own client rects know nothing
     about. Left in, every equation in the game reports itself as printing
     through itself. Anything inside a box clipped to nothing is not on screen,
     whatever its rects say. */
  const painted = (el) => {
    if (el.closest('.katex-mathml, math')) return false;
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const c = getComputedStyle(n);
      if (/hidden|clip/.test(c.overflow) && (n.clientWidth <= 2 || n.clientHeight <= 2)) return false;
      if (c.clip && c.clip !== 'auto' && c.clip.replace(/\\s+/g, '').indexOf('rect(1px') === 0) return false;
    }
    return true;
  };
  /* Alpha out of any computed colour form a browser can hand back: rgb()/rgba()
     with commas or spaces, and color(srgb r g b / a) — which is what color-mix()
     resolves to and which a naive rgba() regex reads as alpha 0, i.e. as a false
     failure. Anything unparseable counts as transparent, so the probe can only
     ever be too strict, never too lax. */
  const alphaOf = (c) => {
    if (!c || c === 'transparent' || c === 'none') return 0;
    const slash = c.match(/\\/\\s*([0-9.]+%?)\\s*\\)/);
    if (slash) return slash[1].endsWith('%') ? parseFloat(slash[1]) / 100 : parseFloat(slash[1]);
    const rgba = c.match(/rgba?\\(([^)]+)\\)/);
    if (rgba) { const p = rgba[1].split(/[,\\s]+/).filter(Boolean); return p.length < 4 ? 1 : parseFloat(p[3]); }
    if (/^color\\(/.test(c)) return 1;
    if (/^#|^[a-z]+$/i.test(c)) return 1;
    return 0;
  };
  const opaqueBg = (el) => {
    const cs = getComputedStyle(el);
    const img = cs.backgroundImage;
    return { alpha: alphaOf(cs.backgroundColor), image: img === 'none' ? null : img };
  };
  const paintsOpaque = (el) => {
    const { alpha, image } = opaqueBg(el);
    if (alpha >= 0.985) return true;
    if (!image) return false;
    const stops = image.match(/(rgba?|color)\\([^)]*\\)/g) || [];
    if (!stops.length) return false;
    return stops.every((s) => alphaOf(s) >= 0.985);
  };
  /* INK, NOT LINE BOXES. A block element reports the full width of its line
     box, so a centred kicker 150 px wide inside a 720 px plate "overlaps"
     anything within 285 px of it on either side — which is how this probe
     first accused the chapter plate of printing "CHAPTER 3" through "7 RIFTS
     SEALED" when the two are 75 px apart on screen. A Range over the element's
     contents measures the glyphs, one rect per painted line, which is what the
     eye is actually looking at. */
  const inkRects = (el) => {
    let rects = [];
    try {
      const r = document.createRange();
      r.selectNodeContents(el);
      rects = [...r.getClientRects()];
    } catch { rects = []; }
    if (!rects.length) rects = [...el.getClientRects()];
    /* Leading is not ink either. A line box is the font's line-height tall, so
       a 92 px display word and the 10 px kicker sitting above it "overlap" by
       five pixels of pure air. Each line is narrowed to the band the glyphs
       actually occupy — caps through descenders, about 0.88 em — centred in its
       own line box. Anything still intersecting after that is two pieces of
       type on the same pixels. */
    const em = parseFloat(getComputedStyle(el).fontSize) || 12;
    const band = em * 0.88;
    return rects.map((q) => {
      if (q.height <= band + 0.5) return q;
      const cy = (q.top + q.bottom) / 2;
      return new DOMRect(q.left, cy - band / 2, q.width, band);
    }).filter((q) => q.width > 1 && q.height > 1);
  };

  const inkOf = (root) => {
    // The layer's real footprint: the union of the boxes of the text it paints.
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity, n = 0;
    for (const el of root.querySelectorAll('*')) {
      if (!el.textContent || !el.textContent.trim()) continue;
      let kid = false;
      for (const c of el.children) if (c.textContent && c.textContent.trim()) kid = true;
      if (kid || !shown(el) || !painted(el)) continue;
      for (const q of inkRects(el)) {
        n++; l = Math.min(l, q.left); t = Math.min(t, q.top);
        r = Math.max(r, q.right); b = Math.max(b, q.bottom);
      }
    }
    return n ? { n, box: [Math.round(l), Math.round(t), Math.round(r), Math.round(b)] } : { n: 0, box: null };
  };

  // ---- 1. which ceremonies hold the frame ---------------------------------
  const live = [];
  for (const [sel, name] of cfg.layers) {
    for (const el of document.querySelectorAll(sel)) {
      if (!shown(el)) continue;
      const ink = inkOf(el);
      // A layer with no painted text and no visible dim is not holding
      // anything — the tear's own root, for instance, sits at opacity 0 under
      // .ses-cine and is caught by shown(), but an empty shell must not count.
      if (!ink.n) continue;
      live.push({ name, sel, opacity: +chainOpacity(el, null).toFixed(3), ...ink });
    }
  }

  // ---- 2. no two text nodes intersect -------------------------------------
  const roots = [];
  for (const [sel] of cfg.layers) for (const el of document.querySelectorAll(sel)) if (shown(el)) roots.push({ el, sel });
  for (const sel of (cfg.extra || [])) for (const el of document.querySelectorAll(sel)) if (shown(el)) roots.push({ el, sel });
  const scope = cfg.scope ? [...document.querySelectorAll(cfg.scope)].map((el) => ({ el, sel: cfg.scope })) : null;
  const use = scope ? scope : roots;

  const leaves = [];
  for (const { el: root, sel: rootSel } of use) {
    for (const el of root.querySelectorAll('*')) {
      if (!el.textContent || !el.textContent.trim()) continue;
      let kid = false;
      for (const c of el.children) if (c.textContent && c.textContent.trim()) kid = true;
      if (kid || !shown(el) || !painted(el)) continue;
      const rects = inkRects(el);
      if (!rects.length) continue;
      leaves.push({ el, rects, root, rootSel,
        txt: el.textContent.trim().slice(0, 46), tag: el.tagName.toLowerCase(),
        cls: (el.className && el.className.baseVal !== undefined) ? '' : String(el.className || '') });
    }
  }

  /* Two pieces of type that share fewer than three pixels in one direction are
     adjacent, not overprinted — and the glyph band above is an approximation
     with about that much error in it. Every collision this file was written to
     catch measured four pixels or more; the ones at two are a chip sitting
     against a label. */
  const TOUCH = 2.5;
  const hits = [];
  for (let i = 0; i < leaves.length; i++) {
    for (let j = i + 1; j < leaves.length; j++) {
      const A = leaves[i], B = leaves[j];
      if (A.el === B.el || A.el.contains(B.el) || B.el.contains(A.el)) continue;
      let best = null;
      for (const ra of A.rects) for (const rb of B.rects) {
        const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (ox > TOUCH && oy > TOUCH && (!best || ox * oy > best.ox * best.oy)) best = { ox, oy };
      }
      if (!best) continue;
      let cover = null;
      for (const ra of A.rects) for (const rb of B.rects) {
        const l = Math.max(ra.left, rb.left), r = Math.min(ra.right, rb.right);
        const t = Math.max(ra.top, rb.top), b = Math.min(ra.bottom, rb.bottom);
        if (r - l > TOUCH && b - t > TOUCH) { cover = document.elementFromPoint((l + r) / 2, (t + b) / 2); break; }
      }
      const lower = cover && (cover === B.el || B.el.contains(cover) || cover.contains(B.el)) ? A.el : B.el;
      const upper = lower === A.el ? B.el : A.el;
      let anc = upper.parentElement;
      while (anc && !anc.contains(lower)) anc = anc.parentElement;
      let shielded = false;
      const trace = [];
      for (let n = upper; n && n !== anc; n = n.parentElement) {
        const o = opaqueBg(n);
        trace.push(n.tagName.toLowerCase() + '.' + String(n.className || '').split(' ')[0]
          + ' a=' + o.alpha.toFixed(2) + (o.image ? ' +img' : ''));
        if (paintsOpaque(n) && chainOpacity(n, null) >= 0.985) { shielded = true; break; }
      }
      if (shielded) continue;
      const layerOf = (el) => {
        for (const [sel, name] of cfg.layers) { const h = el.closest(sel); if (h) return name; }
        return '?';
      };
      hits.push({
        a: A.txt, b: B.txt,
        aSel: A.tag + '.' + A.cls.split(' ')[0], bSel: B.tag + '.' + B.cls.split(' ')[0],
        aRoot: A.rootSel, bRoot: B.rootSel,
        aLayer: layerOf(A.el), bLayer: layerOf(B.el),
        cross: A.root !== B.root,
        ox: Math.round(best.ox), oy: Math.round(best.oy), trace: trace.slice(0, 4),
      });
    }
  }
  return { live, hits, leaves: leaves.length };
}`;

/** Pretty one-liner + detail for a probe result. Returns true if it passed. */
export function reportFrame(label, r, log = console.log) {
  if (!r || r.error) { log(`FAIL ${label}: ${r?.error || 'no result'}`); return false; }
  const names = r.live.map((l) => `${l.name}(${l.opacity})`).join(' + ') || 'none';
  const many = r.live.length > 1;
  // A hit is "known" only if BOTH of its ends are named in one KNOWN entry.
  const isKnown = (h) => {
    const tokens = [h.aSel, h.bSel, h.aRoot, h.bRoot].filter(Boolean).map((s) => String(s).toLowerCase());
    return KNOWN.some(([a, b]) => [a, b]
      .map((s) => s.replace(/^\./, '').toLowerCase())
      .every((w) => tokens.some((tk) => tk.includes(w))));
  };
  const known = r.hits.filter(isKnown);
  const hits = r.hits.filter((h) => !isKnown(h));
  for (const h of known) {
    log(`     KNOWN ${label}: ${h.ox}x${h.oy}px ${h.aSel} "${h.a}" × ${h.bSel} "${h.b}" — reported, not owned here`);
  }
  const bad = many || hits.length;
  if (!bad) { log(`ok   ${label}  ceremony=${names}  ${r.leaves} text nodes, no intersections`); return true; }
  log(`FAIL ${label}  ceremonies=${r.live.length} [${names}]  intersections=${hits.length}`);
  if (many) for (const l of r.live) log(`      LAYER ${l.name} ${l.sel} opacity=${l.opacity} ink=${JSON.stringify(l.box)} (${l.n} nodes)`);
  for (const h of hits.slice(0, 6)) {
    log(`      OVERPRINT ${h.ox}x${h.oy}px  [${h.aLayer}] ${h.aSel} "${h.a}"  ×  [${h.bLayer}] ${h.bSel} "${h.b}"`);
    log(`        paint trace: ${h.trace.join(' | ')}`);
  }
  return false;
}
