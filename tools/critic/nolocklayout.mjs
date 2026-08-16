/**
 * THE REFUSAL NOTICE, LAID OUT, ON EVERY FRAME THIS PROJECT SHIPS TO.
 *
 * `landscape.mjs` is the layout gate and it never clicks the world, so it can
 * never see this element: the notice only exists once the browser has refused
 * a pointer lock, and a lock is only ever asked for on a world click. That is
 * a real hole — the notice adds two lines of prose to a card that is already
 * 57% of the height of a phone held sideways, and a card that grows off the
 * bottom of a 390 px frame is exactly the defect landscape.mjs was written to
 * make impossible.
 *
 * So this asks landscape.mjs's three questions of the frames that matter, in
 * all three locales, with the lock refused the way an LMS iframe refuses it:
 *
 *   1. the card is INSIDE the viewport, on every edge;
 *   2. the card CLIPS NOTHING of its own — its scroll size fits its box;
 *   3. the card OVERLAPS no other panel that is standing at the same time.
 *
 *   node tools/critic/nolocklayout.mjs [--url …] [--out shots/nolock-layout]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DESKTOP, PORTRAIT, LANDSCAPE } from './_viewports.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/nolock-layout'));
await mkdir(OUT, { recursive: true });

const SIZES = [...DESKTOP, ...PORTRAIT, ...LANDSCAPE];
const LOCALES = ['en', 'es', 'pl'];

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const rows = [];
const errors = [];

for (const size of SIZES) {
  for (const loc of LOCALES) {
    const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h } });
    // The LMS iframe, exactly: pointerlockerror, and the element stays null.
    await ctx.addInitScript(() => {
      Element.prototype.requestPointerLock = function () {
        setTimeout(() => document.dispatchEvent(new Event('pointerlockerror')), 0);
        return Promise.reject(new DOMException('denied', 'SecurityError'));
      };
      Object.defineProperty(document, 'pointerLockElement', { get: () => null, configurable: true });
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${size.name} ${loc}: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${size.name} ${loc}: ${m.text()}`); });

    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.evaluate((l) => {
      try { localStorage.clear(); localStorage.setItem('ascent.locale', l); } catch {}
    }, loc);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
    await page.evaluate((l) => window.__ascent.setLocale?.(l), loc);
    await page.waitForTimeout(4200);
    // The click that asks for the lock and is refused.
    await page.mouse.click(Math.round(size.w / 2), Math.round(size.h / 2));
    await page.waitForTimeout(1800);

    // MEASURED TWICE, AGAINST ITSELF.
    //
    // The controls card already collides with the narrative comms panel at
    // 1280x720 — the Chromebook frame — and it does so with this notice and
    // without it, by 68x67 px unwarned and 68x62 px warned. That defect is not
    // this one's and fixing it is not this file's business, but a gate that
    // simply counted overlaps would fail on it forever and be turned off.
    //
    // So the card is measured with the notice and then again with the notice
    // hidden, in the same frame, in the same paint. The question asked is the
    // only one this change can answer for: *did adding these two lines of
    // prose make the layout worse?* A new collision, a wider collision, an
    // edge newly crossed, or text that no longer fits — those are failures.
    // A collision that is exactly as bad without the notice is somebody
    // else's, and it is recorded rather than blamed on this.
    const r = await page.evaluate(() => {
      const fc = document.querySelector('#ui .fc');
      const note = document.querySelector('#ui .fc-note');
      const vis = (el) => {
        if (!el) return false;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false;
        const b = el.getBoundingClientRect();
        return b.width > 1 && b.height > 1;
      };
      if (!vis(fc) || !note || note.hidden) {
        return { shown: false, noted: !!note && !note.hidden };
      }

      const measure = () => {
        const b = fc.getBoundingClientRect();
        const out = [];
        if (b.left < -0.5) out.push('left');
        if (b.top < -0.5) out.push('top');
        if (b.right > innerWidth + 0.5) out.push('right');
        if (b.bottom > innerHeight + 0.5) out.push('bottom');
        // Self-clipping: content that does not fit inside a box that hides it.
        const clipped = [];
        for (const el of [fc, ...fc.querySelectorAll('*')]) {
          const cs = getComputedStyle(el);
          const hides = /hidden|clip/.test(cs.overflow) || /hidden|clip/.test(cs.overflowY)
            || cs.textOverflow === 'ellipsis';
          if (!hides) continue;
          if (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) {
            clipped.push(`${el.className || el.tagName} ${el.scrollWidth}x${el.scrollHeight}`
              + ` in ${el.clientWidth}x${el.clientHeight}`);
          }
        }
        const others = [...document.querySelectorAll(
          '#ui .marlow, #ui .meta-quest, #ui .gd-card, #ui .gd-prompt, #ui .hail, #ui .toast,'
          + ' #ui .kit, #ui .kit-toast, #ui .hud-top, #ui .buildbar, #ui .langs, #ui .fcs,'
          + ' #ui .axiom, #ui .meta-comms, #ui .rf-panel')].filter(vis)
          .filter((el) => !fc.contains(el) && !el.contains(fc));
        const lap = {};
        for (const el of others) {
          const o = el.getBoundingClientRect();
          const w = Math.min(b.right, o.right) - Math.max(b.left, o.left);
          const h = Math.min(b.bottom, o.bottom) - Math.max(b.top, o.top);
          if (w > 1 && h > 1) lap[el.className.split(' ')[0]] = Math.round(w * h);
        }
        return { b, out, clipped, lap };
      };

      const warned = measure();
      note.hidden = true;
      void fc.offsetHeight;                 // force the reflow before re-reading
      const plain = measure();
      note.hidden = false;
      void fc.offsetHeight;

      // What the two lines of prose ADDED, and nothing else.
      const added = [];
      for (const k of Object.keys(warned.lap)) {
        if (!(k in plain.lap)) added.push(`${k} is a NEW collision (${warned.lap[k]}px²)`);
        else if (warned.lap[k] > plain.lap[k] + 40) {
          added.push(`${k} grew ${plain.lap[k]}→${warned.lap[k]}px²`);
        }
      }
      for (const e of warned.out) if (!plain.out.includes(e)) added.push(`crosses the ${e} edge`);
      for (const c of warned.clipped) if (!plain.clipped.includes(c)) added.push(`clips: ${c}`);

      return {
        shown: true, noted: true,
        rect: {
          x: Math.round(warned.b.left), y: Math.round(warned.b.top),
          w: Math.round(warned.b.width), h: Math.round(warned.b.height),
        },
        grew: Math.round(warned.b.height - plain.b.height),
        frac: +(warned.b.height / innerHeight).toFixed(2),
        out: warned.out, clipped: warned.clipped,
        lap: Object.entries(warned.lap).map(([k, v]) => `${k} ${v}px²`),
        prior: Object.entries(plain.lap).map(([k, v]) => `${k} ${v}px²`),
        added,
        text: note.innerText.replace(/\s+/g, ' ').trim(),
      };
    });

    await page.screenshot({ path: path.join(OUT, `${size.name}-${loc}.png`) });
    const ok = r.shown && r.noted && !r.added.length;
    rows.push({ size: size.name, loc, ok, ...r });
    console.log(`${ok ? '  ok  ' : ' FAIL '} ${size.name.padEnd(9)} ${loc}  `
      + (r.shown
        ? `${r.rect.w}x${r.rect.h} (${Math.round(r.frac * 100)}% of frame, +${r.grew}px for the notice)`
          + (r.added.length ? `  ADDED: ${r.added.join('; ')}` : '')
          + (r.lap.length ? `  [pre-existing: ${r.prior.join(', ') || 'none'}]` : '')
        : `the notice never appeared (noted=${r.noted})`));
    await ctx.close();
  }
}

const failed = rows.filter((x) => !x.ok);
await writeFile(path.join(OUT, 'nolocklayout.json'), JSON.stringify({ rows, errors }, null, 2));
console.log(`\n${rows.length - failed.length}/${rows.length} frames clean · ${errors.length} console errors  ->  ${OUT}`);
await browser.close();
process.exit(failed.length || errors.length ? 1 : 0);
