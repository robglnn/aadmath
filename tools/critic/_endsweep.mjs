/**
 * SESSION ENDING SWEEP — programmatic proof that the last screens of the core
 * loop are legible.
 *
 * Drives the REAL game to the real close beat and the real break beat, then at
 * each viewport / locale / ending asserts two things about the live DOM:
 *
 *   1. NO TWO PAINTED TEXT NODES INTERSECT. Every leaf element carrying visible
 *      text is measured with getClientRects() (so a wrapped line is measured as
 *      its lines, not as its bounding box), and any pair whose ink boxes overlap
 *      by more than a hairline is a hit. Ancestors are excluded — a <p> inside a
 *      <div> is not an overlap — as are siblings that share a stacking-safe
 *      opaque background, because "overprint" is the defect, not adjacency.
 *   2. NOTHING OVERFLOWS. No text node may leave its scroll container's padding
 *      box, and no surface may exceed the viewport.
 *   3. ONE CEREMONY AT A TIME. At every stage, at most one full-screen ceremony
 *      layer may be visible anywhere in the game, and no two text nodes may
 *      intersect *across* layers either. This is `_frame.mjs`, shared with
 *      `_ceremony.mjs`, and it is here because the defect it was written for —
 *      the rank rite playing under the close card — is invisible to a probe
 *      that only ever looks inside `.ses-close`.
 *
 * Overprint is also checked the way the eye checks it: for every text pair that
 * *would* collide geometrically we walk from the upper node to the shared
 * ancestor and require an opaque painted layer in between. A button with a 17%
 * fill sitting on a transparent sticky strip has no such layer, which is exactly
 * the defect this file was written to catch.
 *
 *   node tools/critic/_endsweep.mjs --url http://127.0.0.1:4831 [--out shots/x]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LAYERS, COMPANIONS, FRAME_PROBE, reportFrame } from './_frame.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4831');
const OUT = arg('out', null);
const ONLY = arg('only', null);
const FAST = process.argv.includes('--fast');
const SIZES = [[390, 844], [414, 896], [1280, 720], [1600, 900]];
const LOCALES = ['en', 'es', 'pl'];

if (OUT) await mkdir(path.resolve(OUT), { recursive: true });

/* --------------------------------------------------------------- the probe --
   Runs inside the page. Returns every overlap and every overflow it can find
   under `sel`, plus a paint trace for each hit so a failure names the layer that
   should have been opaque and was not. */
const PROBE = /* js */`(sel) => {
  const root = document.querySelector(sel);
  if (!root) return { error: 'no ' + sel };
  const vis = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const c = getComputedStyle(n);
      if (+c.opacity < 0.06) return false;
      if (c.display === 'none' || c.visibility === 'hidden') return false;
    }
    return true;
  };
  // Effective opacity of an element chain up to (not including) stop.
  const chainOpacity = (el, stop) => {
    let o = 1;
    for (let n = el; n && n !== stop; n = n.parentElement) o *= +getComputedStyle(n).opacity;
    return o;
  };
  /* Alpha out of any computed colour form a browser can hand back:
     rgb()/rgba() with commas or spaces, and color(srgb r g b / a) — which is
     what color-mix() resolves to and which a naive rgba() regex reads as
     alpha 0, i.e. as a false failure. Anything unparseable counts as
     transparent, so the probe can only ever be too strict, never too lax. */
  const alphaOf = (c) => {
    if (!c || c === 'transparent' || c === 'none') return 0;
    const slash = c.match(/\\/\\s*([0-9.]+%?)\\s*\\)/);
    if (slash) return slash[1].endsWith('%') ? parseFloat(slash[1]) / 100 : parseFloat(slash[1]);
    const rgba = c.match(/rgba?\\(([^)]+)\\)/);
    if (rgba) {
      const p = rgba[1].split(/[,\\s]+/).filter(Boolean);
      return p.length < 4 ? 1 : parseFloat(p[3]);
    }
    if (/^color\\(/.test(c)) return 1;   // color(srgb …) with no slash = opaque
    if (/^#|^[a-z]+$/i.test(c)) return 1;
    return 0;
  };
  const opaqueBg = (el) => {
    const cs = getComputedStyle(el);
    const img = cs.backgroundImage;
    return { alpha: alphaOf(cs.backgroundColor), image: img === 'none' ? null : img };
  };
  // Does the element paint an opaque field over its whole box?
  const paintsOpaque = (el) => {
    const { alpha, image } = opaqueBg(el);
    if (alpha >= 0.985) return true;
    if (!image) return false;
    // A gradient counts only if every colour stop it declares is opaque.
    const stops = image.match(/(rgba?|color)\\([^)]*\\)/g) || [];
    if (!stops.length) return false;
    return stops.every((s) => alphaOf(s) >= 0.985);
  };

  // ---- leaf text nodes, measured as ink lines -----------------------------
  const leaves = [];
  for (const el of root.querySelectorAll('*')) {
    if (!el.textContent || !el.textContent.trim()) continue;
    // leaf = no element child that itself carries text
    let hasTextChild = false;
    for (const c of el.children) if (c.textContent && c.textContent.trim()) hasTextChild = true;
    if (hasTextChild) continue;
    if (!vis(el)) continue;
    const rects = [...el.getClientRects()].filter((r) => r.width > 1 && r.height > 1);
    if (!rects.length) continue;
    leaves.push({ el, rects, txt: el.textContent.trim().slice(0, 46),
      tag: el.tagName.toLowerCase(), cls: el.className && el.className.baseVal !== undefined ? '' : String(el.className || '') });
  }

  const isAncestor = (a, b) => a !== b && a.contains(b);
  const hits = [];
  for (let i = 0; i < leaves.length; i++) {
    for (let j = i + 1; j < leaves.length; j++) {
      const A = leaves[i], B = leaves[j];
      if (isAncestor(A.el, B.el) || isAncestor(B.el, A.el)) continue;
      let best = null;
      for (const ra of A.rects) for (const rb of B.rects) {
        const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (ox > 1.5 && oy > 1.5 && (!best || ox * oy > best.ox * best.oy)) best = { ox, oy };
      }
      if (!best) continue;
      // Which one is on top? Compare paint order via elementFromPoint at the
      // centre of the intersection.
      let cover = null;
      for (const ra of A.rects) for (const rb of B.rects) {
        const l = Math.max(ra.left, rb.left), r = Math.min(ra.right, rb.right);
        const t = Math.max(ra.top, rb.top), b = Math.min(ra.bottom, rb.bottom);
        if (r - l > 1.5 && b - t > 1.5) { cover = document.elementFromPoint((l + r) / 2, (t + b) / 2); break; }
      }
      // Walk from the covering node up to the common ancestor looking for an
      // opaque painted layer. If there is one, the lower text is genuinely
      // hidden behind a solid field and the eye sees no overprint.
      let shielded = false;
      const lower = cover && (cover === B.el || B.el.contains(cover) || cover.contains(B.el)) ? A.el : B.el;
      const upper = lower === A.el ? B.el : A.el;
      let anc = upper.parentElement;
      while (anc && !anc.contains(lower)) anc = anc.parentElement;
      const trace = [];
      for (let n = upper; n && n !== anc; n = n.parentElement) {
        const o = opaqueBg(n);
        trace.push(n.tagName.toLowerCase() + '.' + String(n.className || '').split(' ')[0]
          + ' a=' + o.alpha.toFixed(2) + (o.image ? ' +img' : ''));
        if (paintsOpaque(n) && chainOpacity(n, null) >= 0.985) { shielded = true; break; }
      }
      if (shielded) continue;
      hits.push({
        a: A.txt, b: B.txt, aSel: A.tag + '.' + A.cls.split(' ')[0], bSel: B.tag + '.' + B.cls.split(' ')[0],
        ox: Math.round(best.ox), oy: Math.round(best.oy), trace,
        aOp: +getComputedStyle(A.el).opacity, bOp: +getComputedStyle(B.el).opacity,
      });
    }
  }

  // ---- overflow ------------------------------------------------------------
  const over = [];
  const vw = innerWidth, vh = innerHeight;
  const scrollers = [root, ...root.querySelectorAll('*')].filter((el) => {
    const cs = getComputedStyle(el);
    return /auto|scroll|hidden/.test(cs.overflowY + cs.overflowX);
  });
  for (const L of leaves) {
    const r = L.el.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1 || r.bottom > vh + 1 || r.top < -1) {
      // Inside a scroller that is genuinely scrolled? Only flag if it can never
      // be reached — i.e. it is outside horizontally, or outside a clipped box.
      const host = scrollers.find((s) => s !== L.el && s.contains(L.el));
      const canScroll = host && host.scrollHeight > host.clientHeight + 2
        && /auto|scroll/.test(getComputedStyle(host).overflowY);
      const horizontal = r.right > vw + 1 || r.left < -1;
      if (horizontal || !canScroll) {
        over.push({ txt: L.txt, sel: L.tag + '.' + L.cls.split(' ')[0],
          box: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
          vp: [vw, vh], canScroll: !!canScroll });
      }
    }
    // clipped by an overflow:hidden ancestor
    for (const s of scrollers) {
      if (s === L.el || !s.contains(L.el)) continue;
      const cs = getComputedStyle(s);
      if (cs.overflowX !== 'hidden' && cs.overflowY !== 'hidden') continue;
      const sr = s.getBoundingClientRect();
      const r2 = L.el.getBoundingClientRect();
      if (r2.right > sr.right + 1.5 || r2.left < sr.left - 1.5
        || (cs.overflowY === 'hidden' && (r2.bottom > sr.bottom + 1.5 || r2.top < sr.top - 1.5))) {
        over.push({ txt: L.txt, sel: L.tag + '.' + L.cls.split(' ')[0], clippedBy: String(s.className || s.tagName),
          box: [Math.round(r2.left), Math.round(r2.top), Math.round(r2.right), Math.round(r2.bottom)],
          host: [Math.round(sr.left), Math.round(sr.top), Math.round(sr.right), Math.round(sr.bottom)] });
      }
    }
  }
  // ---- controls below the fold ---------------------------------------------
  /* A scrolling card whose buttons are entirely off the bottom, with nothing on
     screen to say it scrolls, is not "fine because you can scroll" — it is a
     dead end. Every enabled control must have real estate inside the frame the
     card is drawn in, at rest, before anyone touches it. */
  const sunk = [];
  for (const btn of root.querySelectorAll('button')) {
    if (btn.hidden || btn.disabled || !vis(btn)) continue;
    const r = btn.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const host = scrollers.find((s) => s !== btn && s.contains(btn)
      && /auto|scroll/.test(getComputedStyle(s).overflowY));
    const frame = host ? host.getBoundingClientRect() : { top: 0, bottom: vh };
    const shown = Math.min(r.bottom, Math.min(frame.bottom, vh)) - Math.max(r.top, Math.max(frame.top, 0));
    if (shown < r.height * 0.6) {
      sunk.push({ txt: btn.textContent.trim().slice(0, 32), shown: Math.round(shown), h: Math.round(r.height) });
    }
  }

  // page must never scroll sideways
  const bodyWide = document.documentElement.scrollWidth > vw + 1;
  return { hits, over, sunk, bodyWide, leaves: leaves.length };
}`;

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});

const errors = [];
let fails = 0; let checks = 0;

/** The endings a real session can land on, as the real engine reaches them. */
const ENDINGS = [
  { id: 'close-held', mode: 'right' },
  { id: 'close-ground', mode: 'wrong' },
];

/* Two contexts, not twelve. Touch emulation is fixed at context level, so the
   phones and the laptops need one each — but *within* a context the viewport is
   resized and the locale is switched through the game's own `setLocale`, which
   is the same call the language pill makes and which fires the same
   `onLocaleChange` that re-texts the close card. Booting the whole 3D world
   twelve times over software GL took ten minutes a combination and told us
   nothing twelve times over. */
const GROUPS = [
  { touch: true, sizes: SIZES.filter(([w]) => w < 700) },
  { touch: false, sizes: SIZES.filter(([w]) => w >= 700) },
];
for (const group of GROUPS) {
  if (!group.sizes.length) continue;
  let ctx = null; let page = null;
  for (const [W, H] of group.sizes) {
  for (const loc of LOCALES) {
    if (ONLY && !`${W}x${H}-${loc}`.includes(ONLY)) continue;
    if (!ctx) {
      ctx = await browser.newContext({
        viewport: { width: W, height: H }, deviceScaleFactor: 2,
        hasTouch: group.touch, isMobile: group.touch,
      });
      page = await ctx.newPage();
      page.setDefaultTimeout(45000);
      page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    }
    await page.setViewportSize({ width: W, height: H });
    /* `page.evaluate` has NO default timeout in Playwright, so one hook that
       never settles hangs the whole sweep with no output — which is exactly
       what happened at 414x896 on the first full run. Every drive step below
       goes through this. */
    const ev = async (fn, ms = 30000, a = undefined) => {
      let timer;
      const out = await Promise.race([
        page.evaluate(fn, a),
        new Promise((r) => { timer = setTimeout(() => r('__timeout__'), ms); }),
      ]);
      clearTimeout(timer);
      if (out === '__timeout__') errors.push(`${W}x${H} ${loc}: drive step timed out: ${String(fn).slice(0, 70)}`);
      return out;
    };
    const probeIn = (sel) => page.evaluate(new Function('sel', `return (${PROBE})(sel)`), sel);
    /** Who owns the frame, and does anything print through anything else. */
    const frameCheck = async (label) => {
      checks++;
      const r = await page.evaluate(
        new Function('cfg', `return (${FRAME_PROBE})(cfg)`),
        { layers: LAYERS, extra: COMPANIONS, scope: null },
      );
      if (!reportFrame(`${W}x${H} ${loc} ${label} [frame]`, r)) fails++;
    };

    const fresh = page.url() === 'about:blank';
    if (fresh) {
      await page.goto(URL, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => !!window.__ascent);
      await page.evaluate((l) => {
        window.__ascent.session.reset();
        localStorage.removeItem('ascent.save');
        localStorage.setItem('ascent.locale', l);
      }, loc);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForFunction(() => !!window.__ascent);
    } else {
      // Same world, next language and next frame size — switched exactly the
      // way the language pill and a device rotation switch them.
      await ev((l) => {
        window.__ascent.setLocale(l);
        const s = window.__ascent.session;
        s.resolution.hide(); s.rest.hide(); s.charter.hide?.();
        s.reset();
      }, 20000, loc);
      await page.waitForTimeout(900);
    }
    // A cold save waits 25 s before the orders arrive, which is right for a
    // player and is twelve times that across a full sweep. `--fast` asks the
    // real planner for the real orders straight away instead; every surface
    // below is still the shipping component drawn off the shipping engine.
    /* On a fresh boot the honest path waits out the game's own idle timer so
       the orders arrive the way a player meets them; `--fast` asks the real
       planner for them straight away. Every later combination in the same
       context has just been reset, so it always asks. */
    if (FAST || !fresh) {
      await page.waitForTimeout(1200);
      await ev(() => { window.__ascent.session.plan(); });
    }
    await page.waitForFunction(() => window.__ascent.session.state().phase === 'charter', null, { timeout: 90000 });

    // The opening beat, before anything is clicked.
    await page.waitForTimeout(2600);
    report(`${W}x${H} ${loc} charter`, await probeIn('.ses-charter'));
    await frameCheck('charter');
    if (OUT) await page.screenshot({ path: path.join(path.resolve(OUT), `${W}x${H}-${loc}-charter.png`) });

    await page.locator('.sc-go').click();
    await page.waitForTimeout(1400);
    report(`${W}x${H} ${loc} band`, await probeIn('.ses-band'));

    // Real work: a miss (buys an echo, moves the work read, seals nothing) and
    // then a real close driven by a real clock.
    await ev(() => { window.__ascent.openRiftById('var-meaning'); });
    await page.waitForTimeout(900);
    await ev(() => { window.__ascent.panel.demo('wrong'); });
    await page.waitForTimeout(1100);
    await ev(() => { window.__ascent.panel.close(); });
    await page.waitForTimeout(400);
    await ev(() => { window.__ascent.session.chargeTo(24); });
    await ev(() => { window.__ascent.session.skipToClose(); });
    await page.waitForTimeout(5200); // long past every entry animation

    const stages = [];
    stages.push(['close', '.ses-close']);
    const r1 = await probeIn('.ses-close');
    report(`${W}x${H} ${loc} close`, r1);
    await frameCheck('close');
    if (OUT) await page.screenshot({ path: path.join(path.resolve(OUT), `${W}x${H}-${loc}-close.png`) });

    // Scroll the close card to its foot — on a phone the sticky strip only
    // overprints once there is content under it.
    await page.evaluate(() => { const s = document.querySelector('.ses-close .sx-in'); if (s) s.scrollTop = s.scrollHeight; });
    await page.waitForTimeout(600);
    const r1b = await probeIn('.ses-close');
    report(`${W}x${H} ${loc} close@foot`, r1b);

    /* NOTHING IS PERMANENTLY UNDER THE SHELF. An opaque sticky strip fixes an
       overprint by hiding the text — which is only honest if the learner can
       scroll the text back out. At maximum scroll, no line of the card may
       still be inside the strip or inside the fade above it. */
    const buried = await page.evaluate(() => {
      // Only meaningful while the shelf is actually a shelf. With the card
      // short enough not to scroll, `.sx-acts` is an ordinary transparent flex
      // row whose box overlaps the caption's negative bottom margin by 3 px of
      // pure margin arithmetic, and nothing is buried by anything.
      const card = document.querySelector('.ses-close');
      if (!card || !card.classList.contains('scrolls')) return [];
      const strip = card.querySelector('.sx-acts');
      if (!strip) return [];
      const s = strip.getBoundingClientRect();
      const fade = parseFloat(getComputedStyle(strip, '::before').height) || 0;
      const top = s.top - fade * 0.55;   // below the fade's half-strength point
      const out = [];
      for (const el of document.querySelectorAll('.ses-close .sx-in *')) {
        if (strip.contains(el) || !el.textContent.trim()) continue;
        let kid = false;
        for (const c of el.children) if (c.textContent.trim()) kid = true;
        if (kid) continue;
        for (const r of el.getClientRects()) {
          if (r.bottom > top + 1 && r.top < s.bottom - 1 && r.width > 1) {
            out.push({ txt: el.textContent.trim().slice(0, 40), gap: Math.round(r.bottom - top) });
            break;
          }
        }
      }
      return out;
    });
    checks++;
    if (buried.length) {
      fails++;
      console.log(`FAIL ${W}x${H} ${loc} close@foot buried under the control strip: ${JSON.stringify(buried)}`);
    } else console.log(`ok   ${W}x${H} ${loc} close@foot nothing left under the shelf`);
    if (OUT) await page.screenshot({ path: path.join(path.resolve(OUT), `${W}x${H}-${loc}-close-foot.png`) });

    // mid-scroll too: the strip passes over every paragraph on the way down
    const steps = await page.evaluate(() => {
      const s = document.querySelector('.ses-close .sx-in');
      return s ? Math.max(0, s.scrollHeight - s.clientHeight) : 0;
    });
    if (steps > 12) {
      for (const frac of [0.25, 0.5, 0.75]) {
        await page.evaluate((f) => {
          const s = document.querySelector('.ses-close .sx-in');
          if (s) s.scrollTop = (s.scrollHeight - s.clientHeight) * f;
        }, frac);
        await page.waitForTimeout(250);
        const rr = await probeIn('.ses-close');
        report(`${W}x${H} ${loc} close@${frac}`, rr);
      }
    }

    /* ---- the close that still has ONE MORE LINE on offer --------------------
       A different card: two controls instead of one, which on a 390 px phone
       wraps the shelf to two rows and makes it a good deal taller. Driven the
       real way — a fresh run off the real planner, wound to twelve minutes so
       the engine's own `canExtend()` is true — not by flipping a field. */
    await ev(() => {
      const s = window.__ascent.session;
      s.resolution.hide();
      s.plan();
      s.charter.hide?.();
      s.chargeTo(12);
      s.close();
    });
    await page.waitForTimeout(4200);
    const twoUp = await page.evaluate(() => document.querySelectorAll('.ses-close .sx-acts button:not([hidden])').length);
    report(`${W}x${H} ${loc} close+more (${twoUp} controls)`,
      await probeIn('.ses-close'));
    await frameCheck('close+more');
    if (OUT) await page.screenshot({ path: path.join(path.resolve(OUT), `${W}x${H}-${loc}-close-more.png`) });
    await page.evaluate(() => {
      const s = document.querySelector('.ses-close .sx-in'); if (s) s.scrollTop = s.scrollHeight;
    });
    await page.waitForTimeout(500);
    report(`${W}x${H} ${loc} close+more@foot`,
      await probeIn('.ses-close'));
    if (OUT) await page.screenshot({ path: path.join(path.resolve(OUT), `${W}x${H}-${loc}-close-more-foot.png`) });

    // ---- the break beat -----------------------------------------------------
    await page.locator('.sx-rest').click();
    await page.waitForTimeout(1400);
    const r2 = await probeIn('.ses-rest');
    report(`${W}x${H} ${loc} rest`, r2);
    await frameCheck('rest');
    if (OUT) await page.screenshot({ path: path.join(path.resolve(OUT), `${W}x${H}-${loc}-rest.png`) });

    // …its end card…
    await page.locator('.sr-skip').click();
    await page.waitForTimeout(1200);
    const r3 = await probeIn('.ses-rest');
    report(`${W}x${H} ${loc} rest-end`, r3);
    if (OUT) await page.screenshot({ path: path.join(path.resolve(OUT), `${W}x${H}-${loc}-rest-end.png`) });

    // …and the real last line.
    await page.locator('.sr-off').click();
    await page.waitForTimeout(2200);
    const r4 = await probeIn('.ses-rest');
    report(`${W}x${H} ${loc} sign-off`, r4);
    await frameCheck('sign-off');
    if (OUT) await page.screenshot({ path: path.join(path.resolve(OUT), `${W}x${H}-${loc}-signoff.png`) });

  }
  }
  await page?.close();
  await ctx?.close();
}

function report(label, r) {
  checks++;
  if (r.error) { console.log(`FAIL ${label}: ${r.error}`); fails++; return; }
  const sunk = r.sunk || [];
  const bad = r.hits.length || r.over.length || sunk.length || r.bodyWide;
  if (!bad) { console.log(`ok   ${label}  (${r.leaves} text nodes)`); return; }
  fails++;
  console.log(`FAIL ${label}  overlaps=${r.hits.length} overflow=${r.over.length} belowFold=${sunk.length} bodyWide=${r.bodyWide}`);
  for (const s of sunk) console.log(`      BELOW THE FOLD "${s.txt}" — ${s.shown}px of ${s.h}px on screen`);
  for (const h of r.hits.slice(0, 6)) {
    console.log(`      OVERPRINT ${h.ox}x${h.oy}px  ${h.aSel} "${h.a}"  ×  ${h.bSel} "${h.b}"  op=${h.aOp}/${h.bOp}`);
    console.log(`        paint trace: ${h.trace.join(' | ')}`);
  }
  for (const o of r.over.slice(0, 6)) console.log(`      OVERFLOW ${o.sel} "${o.txt}" ${JSON.stringify(o)}`);
}

await browser.close();
console.log(`\n${checks - fails}/${checks} checks passed · console errors: ${errors.length}`);
for (const e of errors.slice(0, 10)) console.log('  ! ' + e);
if (OUT) await writeFile(path.join(path.resolve(OUT), 'sweep.json'), JSON.stringify({ checks, fails, errors }, null, 2));
process.exit(fails || errors.length ? 1 : 0);
