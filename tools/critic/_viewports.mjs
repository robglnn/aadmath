/**
 * The project's standard capture matrix, and the layout audit every capture
 * runs against it.
 *
 * Until now this list lived nowhere: shoot.mjs hardcoded 1600x900 and a single
 * 414x896 phone, every other critic hardcoded its own pair, and the result was
 * that a phone held sideways — the single most common way a teenager actually
 * holds a phone — had never been photographed once. It is a shared module now
 * so that adding a viewport adds it everywhere.
 *
 * Landscape is not portrait squeezed. 844x390 has 43% of the vertical room of
 * 390x844 and twice the horizontal, so a layout tuned by "shrink the font"
 * fails: the fix is that persistent readouts move to the flanks and panels
 * spend width instead of height. These four sizes are the real ones —
 * iPhone SE/13 mini, iPhone 11/XR, iPhone 14 Pro Max, and an iPad in landscape,
 * which is also the shape of a school Chromebook in a split window.
 */

export const LANDSCAPE = [
  { name: '844x390', w: 844, h: 390, label: 'phone landscape (iPhone 13 mini / SE)' },
  { name: '896x414', w: 896, h: 414, label: 'phone landscape (iPhone 11 / XR)' },
  { name: '926x428', w: 926, h: 428, label: 'phone landscape (iPhone 14 Pro Max)' },
  { name: '1024x768', w: 1024, h: 768, label: 'tablet landscape (iPad)' },
];

export const PORTRAIT = [
  { name: '390x844', w: 390, h: 844, label: 'phone portrait' },
  { name: '414x896', w: 414, h: 896, label: 'phone portrait (large)' },
];

export const DESKTOP = [
  { name: '1280x720', w: 1280, h: 720, label: 'chromebook' },
  { name: '1600x900', w: 1600, h: 900, label: 'laptop' },
];

export const ALL = [...DESKTOP, ...PORTRAIT, ...LANDSCAPE];

/* ===========================================================================
   THE NOTCH, MODELLED THE WAY A HANDSET ACTUALLY HAS ONE.

   `--sa-*` are ordinary custom properties holding an `env()` value
   (src/ui/style.css), so a desktop Chromium can be handed a notch and a home
   indicator and made to compose a real handset layout. What matters is that the
   shape handed to it is the shape the device has.

   This lived inline in landscape.mjs, and it was landscape-shaped in both
   senses: `l/r = 44`, `b = 21`, `t = 0`. That is exactly right for a phone on
   its side — the camera housing is on one SHORT edge, so it eats a flank, and
   the home indicator runs along the long edge at the bottom. It is exactly
   wrong for a phone held up, where the housing is on the TOP edge and the
   flanks are clear, and it was nonetheless what every portrait capture in this
   project was ever handed. Portrait safe areas had therefore never once been
   photographed: `--pad-t: max(14px, var(--sa-t))` had only ever resolved to
   14px, and the entire portrait ladder hangs off `--pad-t`.

   The numbers are the real ones. Portrait: 47 top / 34 bottom is what an
   iPhone 11–14 reports (the two portrait sizes in this matrix are an iPhone
   13/12 and an iPhone 11/XR); a Dynamic Island reports 59, which is the worst
   case any current handset hands a page, so it is captured too — a top band
   that survives 47 and not 59 is not a portrait layout, it is a lucky one.
   Landscape: 44 on ONE flank and 21 at the foot, never 44 on both, and both
   rotations are captured because they are different layouts — the side the
   notch lands on is the side that loses 30 px.
   =========================================================================== */

/** A phone on its side: the housing eats one flank, the indicator the foot. */
export const LANDSCAPE_INSETS = [
  { name: '', t: '0px', r: '0px', b: '0px', l: '0px' },
  { name: '-notchL', t: '0px', r: '0px', b: '21px', l: '44px' },
  { name: '-notchR', t: '0px', r: '44px', b: '21px', l: '0px' },
];

/** A phone held up: the housing eats the top, the indicator the foot. */
export const PORTRAIT_INSETS = [
  { name: '', t: '0px', r: '0px', b: '0px', l: '0px' },
  { name: '-notch', t: '47px', r: '0px', b: '34px', l: '0px' },
  { name: '-island', t: '59px', r: '0px', b: '34px', l: '0px' },
];

/**
 * Which shape of inset this viewport can actually be handed.
 *
 * Taller than it is wide → a handset held up. Everything else — a phone on its
 * side, a tablet, a Chromebook in a split window — gets the landscape shape.
 * A laptop has no notch at all, but a desktop-composed frame is the one every
 * `--sa-b` regression has hidden in, so it is driven with one anyway.
 */
export function insetsFor(vp) {
  return vp.h > vp.w ? PORTRAIT_INSETS : LANDSCAPE_INSETS;
}

/**
 * Hand the page an inset. All four edges, every time — a run that sets only
 * the three it cares about inherits the fourth from whatever the last one left
 * on the element, which is how a "portrait" capture ends up wearing a landscape
 * notch.
 */
export const APPLY_INSET_SRC = `(i => {
  const s = document.documentElement.style;
  s.setProperty('--sa-t', i.t); s.setProperty('--sa-r', i.r);
  s.setProperty('--sa-b', i.b); s.setProperty('--sa-l', i.l);
})`;

/**
 * The audit, as a function that is injected into the page.
 *
 * It is written as a string rather than passed by reference so it can be handed
 * to `page.addInitScript` and be present on every navigation, including the
 * full reload a locale switch performs.
 */
export const AUDIT_SRC = `(() => {
  /* Layers that are allowed to clip: their whole job is to be a window onto
     something bigger than themselves. Everything else that clips is a bug. */
  /* .katex-mathml is KaTeX's screen-reader twin: a 1x1 clipped box holding the
     whole formula, on purpose, in every KaTeX page ever shipped. */
  const CLIP_OK = ['.gd-layer', '#touchpad', '#stage', '.rift-scroll', '.tag-layer',
                   '.afford-layer', '.katex-mathml', '.field-tags', '.rp-file',
                   /* the rift's scrim clips a particle field on purpose: .rf-spill
                      throws 2x2 motes hundreds of pixels outside the frame, so the
                      scrim's own scroll size says nothing about the card in it. The
                      card is measured directly, as .rf-frame and .rf-plate. */
                   '.rift', '.rf-spill', '.rf-motes'];
  /* SURFACES WHOSE JOB IS TO SCROLL, AND WHICH SAY SO.

     The audit permits overflow:auto because "a panel that has decided to
     scroll is a design decision". That is true of a progress document, a
     dossier, a menu and a foundry catalogue — long things, in a frame with a
     visible thumb and a fade at the edge, that a reader knows to push.

     It is not true of the three places the layout passes reached for auto as a
     LAST RESORT — the controls legend's rows, the companion's line, the rift's
     stage. Each of those carries a comment saying it has never needed to
     scroll in any of the three languages, and each of them was measured
     against a frame whose --sa-t was zero. Give a 390 px handset the Dynamic
     Island's 59 px and the controls legend loses INTERACT and RECOVER with no
     thumb, no fade and no clue: eight controls, six printed, and the audit
     called it clean because auto was in the stylesheet.

     So a scroller has to be NAMED here to be allowed to eat its own content.
     Adding one is a decision somebody makes on purpose; forgetting to is now a
     failing frame rather than a silent one.

     .rf-stage is named on exactly those terms and no others. It is the rift's
     balance scene on a 390 px-high frame, and src/ui/landscape.css spends
     fourteen lines saying why it is allowed to scroll there — the fit pass has
     a floor past which the mathematics is unreadable, and below that floor the
     alternative is not a shorter scene, it is the commit key and CALL THE ECHO
     off the bottom of the screen. The head, the statement and the foot are
     guaranteed on the frame; what moves is the artwork between them. That is a
     decision with a guarantee attached, which is the difference between this
     and a legend that lost two of its eight rows. */
  const SCROLL_OK = ['.rp-body', '.rp-doc-body', '.rp-sum', '.rp-table',
                     '.dos-left', '.dos-log', '.dos-grid',
                     '.mnu-card', '.fdy-card', '.sx-scroll', '.rf-stage'];
  /* Marks that legitimately ride the edge of the frame — an off-screen waypoint
     arrow is *supposed* to be half off the screen; that is what makes it an
     arrow rather than a label. This exempts them from the bounds test ONLY:
     a waypoint that lands on the foundry's own plate is still two things in
     one place, and that is the collision the client photographed. */
  const EDGE_OK = ['.gd-mark', '.gd-layer', '#touchpad .stick', '#touchpad .knob'];
  /* KaTeX builds a formula out of dozens of deliberately overlapping boxes and
     a visually-hidden MathML twin. What matters is that the formula's own box
     fits and does not clip; its internals are not a layout defect. */
  const OPAQUE = ['.katex', '.katex-mathml', 'svg'];
  /* Full-screen surfaces: when one of these owns the frame, everything behind
     it is not "overlapping", it is behind a modal. */
  const MODALS = ['.rift', '.rp-scrim', '.rp-doc', '.mnu', '.ses-close', '.ses-rest',
                  '.dos-scrim', '.meta-rite', '.meta-turn', '#boot', '.ses-charter'];

  const matches = (el, list) => list.some((s) => { try { return el.matches(s) || el.closest(s); } catch { return false; } });
  /* CLIP_OK names the CLIPPER, never its subtree — '.rift' on the closest()
     form exempted the whole learning surface inside it, which is how a keypad
     with 492 px of content in a 390 px plate audited clean. */
  const isClipper = (el, list) => list.some((s) => { try { return el.matches(s); } catch { return false; } });

  function visible(el) {
    let n = el, op = 1;
    while (n && n.nodeType === 1) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.contentVisibility === 'hidden') return false;
      op *= parseFloat(cs.opacity || '1');
      if (op < 0.12) return false;
      n = n.parentElement;
    }
    return true;
  }

  /**
   * Everything that is actually clipping this element, intersected: every
   * ancestor whose overflow is not visible, and the frame itself.
   *
   * Without this the audit calls a paragraph six screens down inside a panel
   * that has *decided* to scroll "outside the frame" — 141 of them in one
   * report — and drowns the real defects. What is off the bottom of a scroller
   * is not on screen at all: it is neither clipped text nor an overlap, and the
   * only honest question about it is whether its scroller was allowed to
   * scroll, which is question 1.
   */
  function clipOf(el) {
    let box = { l: 0, t: 0, r: innerWidth, b: innerHeight };
    let framedByViewportOnly = true;
    let n = el.parentElement;
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const r = n.getBoundingClientRect();
        box = { l: Math.max(box.l, r.left), t: Math.max(box.t, r.top),
                r: Math.min(box.r, r.right), b: Math.min(box.b, r.bottom) };
        framedByViewportOnly = false;
      }
      n = n.parentElement;
    }
    return { box, framedByViewportOnly };
  }

  /** Does this element print words of its own (not just its children's)? */
  function ownText(el) {
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.textContent.trim()) return n.textContent.trim();
    }
    return '';
  }

  function sel(el) {
    if (!el) return '?';
    let s = el.tagName.toLowerCase();
    if (el.id) return s + '#' + el.id;
    const c = (el.className && typeof el.className === 'string' ? el.className : '')
      .trim().split(/\\s+/).filter(Boolean).slice(0, 3).join('.');
    if (c) s += '.' + c;
    const p = el.parentElement;
    if (p && p.id) s = p.tagName.toLowerCase() + '#' + p.id + ' > ' + s;
    else if (p && typeof p.className === 'string' && p.className.trim()) {
      s = '.' + p.className.trim().split(/\\s+/)[0] + ' > ' + s;
    }
    return s;
  }

  window.__landAudit = function () {
    const W = innerWidth, H = innerHeight;
    const root = document.body;

    /* Which surface owns the frame right now? The topmost visible thing that
       covers nearly all of it. Everything outside it is behind a modal. */
    let layer = null, layerZ = -1;
    for (const s of MODALS) {
      for (const el of document.querySelectorAll(s)) {
        if (!visible(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < W * 0.85 || r.height < H * 0.85) continue;
        const z = Number(getComputedStyle(el).zIndex) || 0;
        if (z >= layerZ) { layer = el; layerZ = z; }
      }
    }
    const scope = layer || root;

    const all = [...scope.querySelectorAll('*')];
    if (layer) all.unshift(layer);

    const clipped = [], outside = [], texts = [], inSafe = [], panels = [], silent = [];

    const safe = {
      l: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sa-l')) || 0,
      r: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sa-r')) || 0,
      b: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sa-b')) || 0,
      t: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sa-t')) || 0,
    };

    for (const el of all) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const cs = getComputedStyle(el);
      const txt = (el.textContent || '').trim();

      /* ---- 1. is it eating its own words? ---- */
      if (txt && !isClipper(el, CLIP_OK)) {
        const hidX = cs.overflowX === 'hidden' || cs.overflowX === 'clip';
        const hidY = cs.overflowY === 'hidden' || cs.overflowY === 'clip';
        const overW = el.scrollWidth - el.clientWidth;
        const overH = el.scrollHeight - el.clientHeight;
        if (hidX && overW > 1) {
          clipped.push({ sel: sel(el), what: 'x ' + el.scrollWidth + '>' + el.clientWidth
            + (cs.textOverflow === 'ellipsis' ? ' (ellipsis)' : ''), text: txt.slice(0, 70) });
        }
        if (hidY && overH > 1) {
          clipped.push({ sel: sel(el), what: 'y ' + el.scrollHeight + '>' + el.clientHeight, text: txt.slice(0, 70) });
        }

        /* ---- 1b. or scrolling it away without saying so? ---- */
        const scrX = cs.overflowX === 'auto' || cs.overflowX === 'scroll';
        const scrY = cs.overflowY === 'auto' || cs.overflowY === 'scroll';
        if (!isClipper(el, SCROLL_OK) && ((scrX && overW > 1) || (scrY && overH > 1))) {
          silent.push({ sel: sel(el),
            what: (scrY && overH > 1 ? 'y ' + el.scrollHeight + '>' + el.clientHeight
                                     : 'x ' + el.scrollWidth + '>' + el.clientWidth),
            text: txt.slice(0, 70) });
        }
      }

      /* ---- 2b. is it a plate? ----
         A text node is not only hidden by another text node. The defect the
         client actually photographed was the rig printing COPPER RANK
         underneath an opaque objective card — two panels in one place, with the
         words of the lower one simply gone. Anything with a real fill is
         therefore an occluder in its own right. */
      const bg = cs.backgroundColor || '';
      const alpha = bg.startsWith('rgba') ? parseFloat(bg.split(',')[3]) : (bg.startsWith('rgb') ? 1 : 0);
      if ((alpha >= 0.3 || (cs.backdropFilter && cs.backdropFilter !== 'none'))
        && r.width * r.height >= 400 && txt) {
        panels.push({ el, r, sel: sel(el), sticky: cs.position === 'sticky' });
      }

      /* ---- 2. is it inside the frame at all? ---- */
      const own = ownText(el);
      if (own) {
        const { box, framedByViewportOnly } = clipOf(el);
        /* Scrolled out of its own panel: not on this screen, so not a defect
           and not an overlap either. */
        if (r.right <= box.l + 1 || r.left >= box.r - 1
          || r.bottom <= box.t + 1 || r.top >= box.b - 1) continue;

        if (framedByViewportOnly && !matches(el, EDGE_OK)) {
          const over = { left: -r.left, top: -r.top, right: r.right - W, bottom: r.bottom - H };
          for (const [edge, by] of Object.entries(over)) {
            if (by > 1) outside.push({ sel: sel(el), edge, by: Math.round(by), text: own.slice(0, 60) });
          }
          /* ---- 4. and is it clear of the notch and the home indicator? ---- */
          const inset = { left: safe.l - r.left, right: r.right - (W - safe.r),
                          top: safe.t - r.top, bottom: r.bottom - (H - safe.b) };
          for (const [edge, by] of Object.entries(inset)) {
            if (by > 1 && (safe[edge[0]] || 0) > 0) inSafe.push({ sel: sel(el), edge, by: Math.round(by), text: own.slice(0, 40) });
          }
        }
        if (!matches(el, OPAQUE)) {
          /* THE INK, NOT THE BOX.
             A flex item with 'flex:1; min-width:0' shrinks to nothing and lets
             its own sentence hang out of it — which is how "Mirar" ended up
             printed underneath ARRASTRA A LA DERECHA in the Spanish controls
             card with every rectangle in the frame reporting no overlap. If a
             box is smaller than the text inside it and is not clipping, the
             text is on the glass outside the box, so that is what gets
             compared. */
          let ink = r;
          if (cs.overflowX === 'visible' || cs.overflowY === 'visible') {
            const ox = cs.overflowX === 'visible' ? Math.max(0, el.scrollWidth - el.clientWidth) : 0;
            const oy = cs.overflowY === 'visible' ? Math.max(0, el.scrollHeight - el.clientHeight) : 0;
            if (ox > 1 || oy > 1) {
              const rtl = cs.direction === 'rtl';
              ink = new DOMRect(r.left - (rtl ? ox : 0), r.top, r.width + ox, r.height + oy);
            }
          }
          /* Compare what is actually on the glass: the ink as its scrollers
             have cropped it. */
          const vis = new DOMRect(Math.max(ink.left, box.l), Math.max(ink.top, box.t),
            Math.min(ink.right, box.r) - Math.max(ink.left, box.l),
            Math.min(ink.bottom, box.b) - Math.max(ink.top, box.t));
          texts.push({ el, r: vis, sel: sel(el), text: own.slice(0, 40) });
        }
      }
    }

    /* ---- 3. does anything sit on top of anything else? ---- */
    const overlaps = [];
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        const A = texts[i], B = texts[j];
        if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
        const w = Math.min(A.r.right, B.r.right) - Math.max(A.r.left, B.r.left);
        const h = Math.min(A.r.bottom, B.r.bottom) - Math.max(A.r.top, B.r.top);
        if (w > 2 && h > 2) {
          overlaps.push({ a: A.sel, b: B.sel, w: Math.round(w), h: Math.round(h),
            at: [Math.round(Math.max(A.r.left, B.r.left)), Math.round(Math.max(A.r.top, B.r.top))],
            ta: A.text, tb: B.text });
        }
      }
    }

    /* ---- 3b. and is anything printed under a plate? ---- */
    for (const T of texts) {
      for (const P of panels) {
        if (P.el.contains(T.el) || T.el.contains(P.el)) continue;
        /* A docked toolbar over its own scroller is the standard answer to
           "there is more below", not a collision — the session's close card
           uses exactly that, with a mask, and says so. */
        if (P.sticky) continue;
        const w = Math.min(T.r.right, P.r.right) - Math.max(T.r.left, P.r.left);
        const h = Math.min(T.r.bottom, P.r.bottom) - Math.max(T.r.top, P.r.top);
        if (w > 3 && h > 3) {
          overlaps.push({ a: T.sel, b: P.sel + ' (plate)', w: Math.round(w), h: Math.round(h),
            at: [Math.round(Math.max(T.r.left, P.r.left)), Math.round(Math.max(T.r.top, P.r.top))],
            ta: T.text, tb: '' });
        }
      }
    }

    /* The inset is reported, not just used. An instrument that measures the wrong
       thing has cost this project several rounds, so every row carries the
       inset it was actually shot under and a run can assert that the notch it
       asked for is the notch the page was wearing. */
    return { w: W, h: H, layer: layer ? sel(layer) : null, nodes: texts.length,
             plates: panels.length, clipped, outside, overlaps, inSafe, silent, safe };
  };
})()`;

/** Convenience for scripts that would rather call it than paste it. */
export function audit(page) { return page.evaluate(() => window.__landAudit()); }
