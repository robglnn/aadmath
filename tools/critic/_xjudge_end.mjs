/**
 * INDEPENDENT CRITIC PROBE — the ending, with and without a promotion.
 *
 * Written from scratch by the judging critic; it shares no assertion code with
 * anything in the tree. Two claims, sampled densely across the whole close
 * window rather than at one settled moment:
 *
 *   1. at most one full-screen ceremony layer is visible at any instant;
 *   2. no two painted text runs intersect.
 *
 * No exclusion list. Everything it sees is printed and judged by a human.
 *
 *   tools/critic/frozen.sh tools/critic/_xjudge_end.mjs --out shots/xjudge
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4831');
const OUT = path.resolve(arg('out', 'shots/xjudge'));
const ONLY = arg('only', null);

const SIZES = [[1280, 720], [1600, 900], [414, 896], [390, 844]];
const LOCALES = ['en', 'es', 'pl'];

await mkdir(OUT, { recursive: true });

/** Every surface in this game that can hold the whole frame. */
const CEREMONIES = [
  ['.rift', 'tear'], ['.meta-open', 'cold-open'], ['.meta-rite', 'rite'],
  ['.meta-turn', 'chapter-plate'], ['.meta-dossier', 'dossier'], ['.rp-scrim', 'report'],
  ['.ses-charter', 'orders'], ['.ses-close', 'close'], ['.ses-rest', 'break'],
];
/** Text painted over the same pixels that is not itself a ceremony. */
const OVERLAYS = ['.meta-comms', '.marlow', '.toast', '.kit-toast', '.ses-band',
  '.meta-quest', '.hud-top', '.gd-card', '.gd-prompt', '.gd-mark'];

const PROBE = `(cfg) => {
  const cs = (el) => getComputedStyle(el);
  const chainOp = (el) => { let o = 1; for (let n = el; n; n = n.parentElement) o *= +cs(n).opacity; return o; };
  const shown = (el) => {
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const c = cs(n);
      if (c.display === 'none' || c.visibility === 'hidden') return false;
    }
    return chainOp(el) > 0.02;
  };
  // MathML mirror copies and 1px-clipped a11y boxes are not on screen.
  const painted = (el) => {
    if (el.closest('.katex-mathml, math')) return false;
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const c = cs(n);
      if (/hidden|clip/.test(c.overflow) && (n.clientWidth <= 2 || n.clientHeight <= 2)) return false;
      if (c.clip && c.clip !== 'auto' && /^rect\\(1px/.test(c.clip.replace(/\\s+/g, ''))) return false;
    }
    return true;
  };
  const alphaOf = (c) => {
    if (!c || c === 'transparent' || c === 'none') return 0;
    const sl = c.match(/\\/\\s*([0-9.]+%?)\\s*\\)/);
    if (sl) return sl[1].endsWith('%') ? parseFloat(sl[1]) / 100 : parseFloat(sl[1]);
    const m = c.match(/rgba?\\(([^)]+)\\)/);
    if (m) { const p = m[1].split(/[,\\s]+/).filter(Boolean); return p.length < 4 ? 1 : parseFloat(p[3]); }
    if (/^color\\(/.test(c) || /^#|^[a-z]+$/i.test(c)) return 1;
    return 0;
  };
  const opaque = (el) => {
    const c = cs(el);
    if (alphaOf(c.backgroundColor) >= 0.985) return true;
    const img = c.backgroundImage;
    if (img === 'none') return false;
    const stops = img.match(/(rgba?|color)\\([^)]*\\)/g) || [];
    return stops.length > 0 && stops.every((s) => alphaOf(s) >= 0.985);
  };
  // Glyph ink, one rect per painted line, narrowed to the cap-to-descender band
  // so leading between two stacked lines is not counted as overprint.
  const ink = (el) => {
    let rs = [];
    try { const r = document.createRange(); r.selectNodeContents(el); rs = [...r.getClientRects()]; }
    catch { rs = []; }
    if (!rs.length) rs = [...el.getClientRects()];
    const em = parseFloat(cs(el).fontSize) || 12;
    const band = em * 0.9;
    return rs.map((q) => q.height <= band + 0.5 ? q
      : new DOMRect(q.left, (q.top + q.bottom) / 2 - band / 2, q.width, band))
      .filter((q) => q.width > 1 && q.height > 1 && q.bottom > 0 && q.right > 0
        && q.top < innerHeight && q.left < innerWidth);
  };
  const textLeaves = (root) => {
    const out = [];
    for (const el of root.querySelectorAll('*')) {
      const s = (el.textContent || '').trim();
      if (!s) continue;
      let kid = false;
      for (const c of el.children) if ((c.textContent || '').trim()) kid = true;
      if (kid || !shown(el) || !painted(el)) continue;
      const rects = ink(el);
      if (rects.length) out.push({ el, rects, txt: s.slice(0, 40),
        sel: el.tagName.toLowerCase() + '.' + String(el.className || '').split(' ')[0] });
    }
    return out;
  };

  // --- 1. ceremonies holding the frame
  const live = [];
  for (const [sel, name] of cfg.ceremonies) for (const el of document.querySelectorAll(sel)) {
    if (!shown(el)) continue;
    const leaves = textLeaves(el);
    if (!leaves.length) continue;
    let l = 1e9, t = 1e9, r = -1e9, b = -1e9;
    for (const lf of leaves) for (const q of lf.rects) {
      l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom);
    }
    live.push({ name, sel, op: +chainOp(el).toFixed(3), nodes: leaves.length,
      box: [l, t, r, b].map(Math.round) });
  }

  // --- 2. text intersections, across everything painted over the frame
  const roots = [];
  for (const [sel] of cfg.ceremonies) for (const el of document.querySelectorAll(sel)) if (shown(el)) roots.push({ el, sel });
  for (const sel of cfg.overlays) for (const el of document.querySelectorAll(sel)) if (shown(el)) roots.push({ el, sel });
  const leaves = [];
  for (const { el, sel } of roots) for (const lf of textLeaves(el)) leaves.push({ ...lf, root: el, rootSel: sel });

  const TOUCH = 2;
  const hits = [];
  for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
    const A = leaves[i], B = leaves[j];
    if (A.el === B.el || A.el.contains(B.el) || B.el.contains(A.el)) continue;
    let best = null, at = null;
    for (const ra of A.rects) for (const rb of B.rects) {
      const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (ox > TOUCH && oy > TOUCH && (!best || ox * oy > best.ox * best.oy)) {
        best = { ox, oy };
        at = [(Math.max(ra.left, rb.left) + Math.min(ra.right, rb.right)) / 2,
              (Math.max(ra.top, rb.top) + Math.min(ra.bottom, rb.bottom)) / 2];
      }
    }
    if (!best) continue;
    // one of the two may be genuinely hidden behind an opaque painted ancestor
    const cover = document.elementFromPoint(at[0], at[1]);
    const lower = cover && (cover === B.el || B.el.contains(cover) || cover.contains(B.el)) ? A.el : B.el;
    const upper = lower === A.el ? B.el : A.el;
    let anc = upper.parentElement; while (anc && !anc.contains(lower)) anc = anc.parentElement;
    let shield = false;
    for (let n = upper; n && n !== anc; n = n.parentElement) if (opaque(n) && chainOp(n) >= 0.985) { shield = true; break; }
    if (shield) continue;
    const layer = (el) => { for (const [sel, name] of cfg.ceremonies) if (el.closest(sel)) return name; return el.closest(cfg.overlays.join(',')) ? 'overlay' : '?'; };
    hits.push({ ox: Math.round(best.ox), oy: Math.round(best.oy),
      a: A.txt, b: B.txt, aSel: A.sel, bSel: B.sel, aRoot: A.rootSel, bRoot: B.rootSel,
      aLayer: layer(A.el), bLayer: layer(B.el) });
  }

  // --- 3. clipping: painted text whose ink leaves the frame with no scroller
  //        that could ever bring it back, or that a non-scrolling overflow
  //        box cuts. Content inside a live scroller is not clipped, it is below
  //        the fold, which is a different thing.
  const scrollable = (el) => {
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const c = cs(n);
      if (/auto|scroll/.test(c.overflowY + c.overflowX)
        && (n.scrollHeight > n.clientHeight + 2 || n.scrollWidth > n.clientWidth + 2)) return true;
    }
    return false;
  };
  const clipped = [];
  for (const lf of leaves) {
    let hit = null;
    for (const q of lf.rects) {
      if (q.left < -1 || q.top < -1 || q.right > innerWidth + 1 || q.bottom > innerHeight + 1) {
        if (!scrollable(lf.el)) { hit = { where: 'viewport', q }; break; }
      }
      for (let n = lf.el.parentElement; n && n !== document.body; n = n.parentElement) {
        const c = cs(n);
        if (!/hidden|clip/.test(c.overflowY + c.overflowX)) continue;
        if (n.scrollHeight > n.clientHeight + 2 || n.scrollWidth > n.clientWidth + 2) continue;
        const b = n.getBoundingClientRect();
        if (b.width < 2 || b.height < 2) continue;
        if (q.right > b.right + 1 || q.left < b.left - 1 || q.bottom > b.bottom + 1 || q.top < b.top - 1) {
          hit = { where: n.tagName.toLowerCase() + '.' + String(n.className || '').split(' ')[0], q }; break;
        }
      }
      if (hit) break;
    }
    if (hit) clipped.push({ sel: lf.sel, txt: lf.txt, root: lf.rootSel, where: hit.where,
      r: [hit.q.left, hit.q.top, hit.q.right, hit.q.bottom].map(Math.round) });
  }
  return { live, hits, clipped, leaves: leaves.length };
}`;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const errors = [];
const failures = [];
let samples = 0;
let selftestOK = null;
const clipRuns = new Map();

const report = (label, r) => {
  samples++;
  const names = r.live.map((l) => `${l.name}(${l.op})`).join(' + ') || 'none';
  let bad = false;
  if (r.live.length > 1) {
    bad = true;
    failures.push(`${label}: ${r.live.length} ceremonies at once — ${names}`);
    for (const l of r.live) console.log(`      LAYER ${l.name} op=${l.op} ink=${JSON.stringify(l.box)} nodes=${l.nodes}`);
  }
  for (const h of r.hits) {
    bad = true;
    failures.push(`${label}: OVERPRINT ${h.ox}x${h.oy}px [${h.aLayer}] ${h.aSel} "${h.a}" x [${h.bLayer}] ${h.bSel} "${h.b}"`);
  }
  // A word half off the frame for one 120 ms sample is a card sliding out; a
  // word off the frame for three samples running is text that is clipped.
  for (const c of r.clipped) {
    const k = `${label.replace(/ \+[\d.]+s$/, '')} :: ${c.sel} "${c.txt}" (${c.where})`;
    const n = (clipRuns.get(k) || 0) + 1;
    clipRuns.set(k, n);
    if (n === 3) { bad = true; failures.push(`CLIPPED ${k} rect=${JSON.stringify(c.r)}`); }
    else if (n > 3) bad = true;
  }
  return { bad, names };
};

for (const group of [{ touch: false, sizes: SIZES.filter(([w]) => w >= 700) },
  { touch: true, sizes: SIZES.filter(([w]) => w < 700) }]) {
  for (const [W, H] of group.sizes) {
    for (const loc of LOCALES) {
      const tag = `${W}x${H}-${loc}`;
      if (ONLY && !tag.includes(ONLY)) continue;
      const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: group.touch, isMobile: group.touch });
      const page = await ctx.newPage();
      page.setDefaultTimeout(45000);
      page.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag}: ${m.text()}`); });
      page.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e.message}`));
      const probe = () => page.evaluate(new Function('cfg', `return (${PROBE})(cfg)`), { ceremonies: CEREMONIES, overlays: OVERLAYS });

      await page.goto(URL, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => !!window.__ascent);

      for (const promo of [false, true]) {
        const kind = promo ? 'promo' : 'plain';
        await page.evaluate((l) => {
          const a = window.__ascent;
          a.session.resolution.hide(); a.session.rest.hide();
          a.session.reset(); a.story.reset();
          localStorage.removeItem('ascent.save');
          localStorage.setItem('ascent.locale', l);
        }, loc);
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForFunction(() => !!window.__ascent);
        await page.waitForTimeout(1500);

        await page.evaluate(() => { window.__ascent.session.plan(); });
        await page.waitForFunction(() => window.__ascent.session.state().phase === 'charter', null, { timeout: 60000 });
        await page.waitForTimeout(1500);
        await page.locator('.sc-go').click();
        await page.waitForTimeout(1200);

        if (promo) {
          const st = await page.evaluate(() => {
            const s = window.__ascent.story;
            for (let i = 0; i < 60 && s.state().toNext > 3; i++) s.grant(1);
            return s.state();
          });
          if (st.toNext > 3) failures.push(`${tag} ${kind}: could not stage a promotion (toNext=${st.toNext})`);
        }
        const before = await page.evaluate(() => window.__ascent.story.state().rank);
        await page.evaluate(() => { window.__ascent.openRiftById('var-meaning'); });
        await page.waitForTimeout(900);
        await page.evaluate((p) => { window.__ascent.panel.demo(p ? 'right' : 'wrong'); }, promo);
        await page.waitForTimeout(1100);
        await page.evaluate(() => { window.__ascent.panel.close(); });
        await page.waitForTimeout(300);
        // The run ends on that answer.
        await page.evaluate(() => { window.__ascent.session.chargeTo(24); window.__ascent.session.skipToClose(); });

        // Dense timeline across the whole life of the old rite (5.2 s) and past it.
        const t0 = Date.now();
        let shot18 = false;
        const seen = new Set();
        while (Date.now() - t0 < 8000) {
          const r = await probe();
          const el = ((Date.now() - t0) / 1000).toFixed(1);
          const { bad, names } = report(`${tag} ${kind} +${el}s`, r);
          seen.add(names);
          if (bad) await page.screenshot({ path: path.join(OUT, `${tag}-${kind}-FAIL-${el}.png`) });
          if (!shot18 && Date.now() - t0 > 1700) { shot18 = true; await page.screenshot({ path: path.join(OUT, `${tag}-${kind}-close.png`) }); }
          await page.waitForTimeout(120);
        }
        const after = await page.evaluate(() => ({
          rank: window.__ascent.story.state().rank,
          crest: (() => { const c = document.querySelector('.ses-close .sx-crest'); return c ? !c.hidden : null; })(),
        }));
        await page.screenshot({ path: path.join(OUT, `${tag}-${kind}-settled.png`) });
        console.log(`  ${tag} ${kind}: rank ${before} -> ${after.rank}, crest=${after.crest}; frames seen: ${[...seen].join(' | ')}`);

        // scrolled to the foot
        await page.evaluate(() => { const s = document.querySelector('.ses-close .sx-in'); if (s) s.scrollTop = s.scrollHeight; });
        await page.waitForTimeout(700);
        report(`${tag} ${kind} foot`, await probe());
        await page.screenshot({ path: path.join(OUT, `${tag}-${kind}-foot.png`) });

        // the break beat, and the sign-off
        await page.locator('.sx-rest').click();
        await page.waitForTimeout(1800);
        report(`${tag} ${kind} rest`, await probe());
        await page.screenshot({ path: path.join(OUT, `${tag}-${kind}-rest.png`) });
        if (await page.locator('.sr-skip').count()) {
          await page.locator('.sr-skip').click(); await page.waitForTimeout(1400);
          report(`${tag} ${kind} rest-end`, await probe());
          await page.screenshot({ path: path.join(OUT, `${tag}-${kind}-restend.png`) });
        }
        if (await page.locator('.sr-off').count()) {
          await page.locator('.sr-off').click(); await page.waitForTimeout(2400);
          report(`${tag} ${kind} signoff`, await probe());
          await page.screenshot({ path: path.join(OUT, `${tag}-${kind}-signoff.png`) });
        }
        await page.evaluate(() => { window.__ascent.session.rest.hide(); });
        await page.waitForTimeout(500);

        // ---- CAN THIS PROBE STILL SEE THE OLD DEFECT? -------------------
        if (!promo && selftestOK === null) {
          await page.evaluate(() => { window.__ascent.session.resolution.show({
            index: 1, tears: 2, target: 3, met: false, held: [], stalled: null, opened: [],
            chapter: null, rank: null, next: null, lines: 1, items: 8, misses: 2, echoes: 1,
            extensions: 0, canMore: true }); });
          await page.waitForTimeout(500);
          await page.evaluate(() => { window.__ascent.story.rite.play(3, 2); });
          await page.waitForTimeout(1600);
          const r = await probe();
          selftestOK = r.live.length > 1 && r.hits.length > 0;
          console.log(`  SELF-TEST (rite forced over close card): ceremonies=${r.live.length} [${r.live.map((l) => l.name).join(' + ')}] intersections=${r.hits.length} -> probe ${selftestOK ? 'CAN' : 'CANNOT'} see the defect`);
          if (r.hits.length) console.log(`      e.g. ${r.hits[0].ox}x${r.hits[0].oy}px ${r.hits[0].aSel} "${r.hits[0].a}" x ${r.hits[0].bSel} "${r.hits[0].b}"`);
          await page.screenshot({ path: path.join(OUT, `SELFTEST-two-ceremonies.png`) });
          await page.evaluate(() => { window.__ascent.story.rite.hide(); window.__ascent.session.resolution.hide(); });
          await page.waitForTimeout(600);
        }
      }
      await ctx.close();
    }
  }
}
await browser.close();

console.log('\n================ INDEPENDENT ENDING JUDGEMENT ================');
console.log(`samples: ${samples}`);
console.log(`self-test (probe can still see two ceremonies): ${selftestOK}`);
console.log(`console errors: ${errors.length}`);
for (const e of errors.slice(0, 20)) console.log('  ERR ' + e);
console.log(`failures: ${failures.length}`);
for (const f of failures.slice(0, 60)) console.log('  ✗ ' + f);
process.exit(failures.length || errors.length || !selftestOK ? 1 : 0);
