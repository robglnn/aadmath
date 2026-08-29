#!/usr/bin/env node
/**
 * THE GLASS GATE — how much ink is on the screen in the first ninety seconds.
 *
 *   node tools/critic/glass.mjs [--url …] [--out shots/glass] [--self-test]
 *   node tools/critic/glass.mjs --locales en --sizes 390x844 --secs 30
 *
 * Exit 0 = through the whole opening, in every language, on a phone held up, a
 * phone on its side and a laptop, the game never put more than **12 readable
 * strings** or **3 text surfaces** in front of a stranger at once.
 *
 * ===========================================================================
 * WHERE THE TWO NUMBERS COME FROM
 *
 * They are not invented here. `design/FIRST-90-SECONDS.md` §7.1 measured the
 * opening we shipped — 76 readable strings at peak, 81 of 95 samples at 60 or
 * more, ten distinct text surfaces standing at one instant — and set the caps a
 * fourteen-year-old with ADHD can actually be handed:
 *
 *      first 90 s      text surfaces <= 3      readable strings <= 12
 *
 * The client said the same thing in his own words on the same build: *"i see
 * like 3 different progress bars, we need to collapse to only whats relevant
 * and free up vertical space."*
 *
 * ===========================================================================
 * WHAT COUNTS, AND WHAT DOES NOT — decided once, here, in the open
 *
 * A READABLE STRING is one visible run of text: a text node with words in it,
 * inside an element that is painted (not `display:none`, not `visibility:
 * hidden`, effective opacity >= 0.06), whose box is on screen and at least
 * 7 px of type. `MENU · ESC · F1` is three strings, because a reader's eye
 * lands on three things. That is exactly how §1.2 counted, so the numbers in
 * this gate and the numbers in that document are the same numbers.
 *
 * A TEXT SURFACE is a box a reader's eye has to *arrive at*: it carries words
 * and it has a ground of its own — a plate, a chip, a card. Bare positioning
 * wrappers are walked through; a painted box is counted once and not descended
 * into, so a four-slot build rack is one surface and not four. This is the same
 * walk `tools/critic/density.mjs` uses, so the two gates cannot disagree about
 * what a surface is.
 *
 * A NAME THE WORLD PUTS ON A THING IS NOT A PANEL THE INTERFACE PUTS IN FRONT
 * OF YOU. `.beckon-tags` and `.afd-layer` hold labels pinned to objects out in
 * the world: they move when the player turns their head, they fade with
 * distance, and src/world/tagspace.js already spaces them so two of them never
 * collide. A name floating on the thing it names is the *opposite* of the
 * defect this gate exists for — §1.3 of the study says the game's largest
 * teaching fault is that its companion points at things that have no unique
 * referent. So world labels are excluded from the SURFACE count and reported
 * as `world`.
 *
 * THEIR STRINGS STILL COUNT. Ink is ink: a lane that answers a surface budget
 * by moving forty words into a floating tag has made the frame worse, and the
 * string cap is what says so.
 *
 * A SURFACE THAT OWNS THE FRAME IS NOT THE HEADS-UP DISPLAY. The rift, the
 * foundry counter, the dossier, the rank rite, the chapter turn, the session's
 * orders and close cards, the break beat, the pause menu and the progress
 * report all take the whole frame and stop the world. A player got to every one
 * of them by asking — walking into a shop, pressing a key, finishing a run —
 * and the caps are about the frame a player CANNOT get away from. This is the
 * same line tools/critic/oneprogress.mjs draws for the same reason: *"a surface
 * they OPENED is allowed to carry the ledger, because opening it is a question
 * and the numbers are the answer."* Samples taken while one of these is on
 * screen are counted and reported as `held` and are not gated.
 *
 * TWO MORE THINGS ARE MEASURED AND REPORTED BUT NOT GATED, and the reasons are
 * not conveniences:
 *
 *   `#boot`      the loading curtain. It is on screen before the game is, it
 *                covers the world rather than competing with it, and it is gone
 *                by the time anybody plays. Gating a splash screen against a
 *                heads-up-display budget measures the wrong thing.
 *   `#touchpad`  the virtual stick and its four action buttons. On a phone that
 *                rack IS the keyboard — it is the hardware, drawn, because the
 *                hardware is missing. A desktop run does not count the legends
 *                printed on a real keyboard's keycaps either, and counting them
 *                on a phone would say a phone must ship with fewer verbs than a
 *                laptop. Both are printed on every run so nobody can hide a
 *                surface by moving it into one of them.
 *
 * ===========================================================================
 * HOW IT IS DRIVEN
 *
 * Cold: storage cleared before first paint, no query string, `window.__ascent`
 * never used to make anything happen.
 *
 * A REAL BROWSER'S POINTER LOCK IS INSTALLED, for the same reason
 * tools/critic/escapekey.mjs installs one: headless Chromium never grants a
 * lock, and src/core/input.js reads a refusal as "this machine cannot turn the
 * view with a mouse" and raises the controls card's nine-verb warning state
 * (`ControlsCard.lookBlocked`). That is the correct card for a school
 * Chromebook inside an LMS iframe, and it is not the card a player on an
 * ordinary browser is handed — so a gate that only ever measured the refused
 * case would be measuring a screen the client has never seen.
 * tools/critic/nolocklayout.mjs owns the refused frame and measures it at eight
 * viewports in three languages.
 *
 * A NAIVE WALKER plays it — one real click
 * on the canvas, then W in bursts with real key events, the odd Space, the odd
 * E, the mouse moved. It does not press 1-4 and it does not press F1, because a
 * stranger in the first ninety seconds does not know those keys exist; a build
 * rack that opens because the gate asked for it would be the gate measuring
 * itself.
 *
 * ===========================================================================
 * THE SELF-TEST
 *
 * `--self-test` plants ONE extra text surface — a plate with four words on it,
 * in the same layer, at the same level, styled like every other plate in the
 * game — and requires the gate to fail. Then it takes it away and requires the
 * same window to pass. A gate that has never been seen to fire is a green light
 * with no bulb in it.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { findings } from '../_findings.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/glass'));
const SELFTEST = process.argv.includes('--self-test');
const SECS = Number(arg('secs', '90'));
const LOCALES = arg('locales', 'en,es,pl').split(',').filter(Boolean);

/** The caps. design/FIRST-90-SECONDS.md §7.1. */
export const CAP_STRINGS = 12;
export const CAP_SURFACES = 3;

/** A phone held up, a phone on its side, and the laptop the study measured. */
const SIZES = arg('sizes', '')
  ? arg('sizes', '').split(',').map((s) => {
    const [w, h] = s.split('x').map(Number);
    return { name: `${w}x${h}`, w, h, touch: h > w || w < 1100 };
  })
  : [
    { name: '390x844', w: 390, h: 844, touch: true, label: 'phone portrait' },
    { name: '844x390', w: 844, h: 390, touch: true, label: 'phone landscape' },
    { name: '1600x900', w: 1600, h: 900, touch: false, label: 'laptop' },
  ];

/**
 * The measurement, injected into the page.
 *
 * Written as a source string so it can go through `page.evaluate` unchanged on
 * every navigation, including the full reload a locale switch performs.
 */
const READ_SRC = `(() => {
  /* Effective visibility, walked to the root: a parent at zero opacity makes a
     fully opaque child invisible, and the cold open fades the instruments
     exactly that way ('.meta-cine'). */
  const vis = (el) => {
    let o = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden') return 0;
      o *= Number(s.opacity);
      if (o < 0.06) return 0;
    }
    return o;
  };
  const onScreen = (r) => r.width >= 2 && r.height >= 2
    && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;

  const readStrings = (root) => {
    const out = [];
    const seenKatex = new Set();
    if (!root || !vis(root)) return out;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const txt = (n.nodeValue || '').replace(/\\s+/g, ' ').trim();
      if (!txt) continue;
      const el = n.parentElement;
      if (!el) continue;
      /* KaTeX ships a screen-reader twin of every formula in a 1x1 clipped box.
         It is not on the glass and no reader's eye lands on it. */
      if (el.closest('.katex-mathml')) continue;
      /* …and it renders the VISIBLE half one glyph per span, so "5x + 7 = 42"
         is eleven text nodes and one thing a reader reads. A rendered
         expression is counted once, at its root. */
      const kx = el.closest('.katex');
      if (kx) { if (seenKatex.has(kx)) continue; seenKatex.add(kx); }
      if (!vis(el)) continue;
      const r = (kx || el).getBoundingClientRect();
      if (!onScreen(r)) continue;
      if ((parseFloat(getComputedStyle(el).fontSize) || 0) < 7) continue;
      out.push({ txt: (kx ? (kx.textContent || '') : txt).replace(/\\s+/g, ' ').trim().slice(0, 64),
        cls: ((kx || el).className || el.id || el.tagName) + '',
        x: Math.round(r.x), y: Math.round(r.y) });
    }
    return out;
  };

  /* The two layers the world draws its own labels into. See the header. */
  const WORLD = '.beckon-tags, .afd-layer, .tag-layer, .field-tags, .gd-layer';

  const readSurfaces = (root) => {
    const boxes = [];
    if (!root || !vis(root)) return boxes;
    const walk = (el) => {
      for (const kid of el.children) {
        if (kid.matches && kid.matches(WORLD)) continue;
        const st = getComputedStyle(kid);
        if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) < 0.06) continue;
        const r = kid.getBoundingClientRect();
        if (r.width < 24 || r.height < 12) { walk(kid); continue; }
        if (!onScreen(r)) continue;
        /* THE TEXT A READER CAN ACTUALLY SEE. textContent walks straight
           through display:none, so a pill whose caption has been folded away
           still reads as a text surface by its own hidden words. That is the
           difference between counting the DOM and counting the glass. */
        const text = readStrings(kid).map((x) => x.txt).join(' ').trim();
        const painted = st.backgroundColor !== 'rgba(0, 0, 0, 0)'
          || st.backgroundImage !== 'none'
          || st.borderTopWidth !== '0px' || st.borderLeftWidth !== '0px'
          || st.backdropFilter !== 'none' || st.boxShadow !== 'none';
        if (painted && text.length > 1) {
          boxes.push({ cls: (kid.className || kid.id || kid.tagName) + '', text: text.slice(0, 64),
            x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) });
          continue;
        }
        walk(kid);
      }
    };
    walk(root);
    return boxes;
  };

  /* Every surface in src/ui/layers.css's "owns the frame" band, by the class
     its own module paints it with. A sample taken while one of these is up is
     a sample of a screen the player opened, not of the HUD. */
  /* MATCHED WITHOUT THEIR OWN "I AM UP" CLASS, and judged on paint instead —
     the same decision tools/critic/oneprogress.mjs makes and for the same
     reason: *"A panel that has just had .show removed is still painted for the
     length of its fade."* A 300 ms fade-out is 300 ms in which the foundry
     counter fills the frame and the class says it is gone.

     NOT the way-out card (.fcs). It does not own the frame and does not stop
     the world -- a wedged cadet is still walking, still looking, and still
     being talked to. It is a HUD surface and it is counted as one. */
  const HELD = '.rift, .fdy, .meta-dossier, .meta-rite, .meta-turn,'
    + ' .ses-charter, .ses-close, .ses-rest, .mnu, .rp-scrim, .rp';
  const heldBy = [...document.querySelectorAll(HELD)]
    .filter((el) => vis(el) && el.getBoundingClientRect().width > 24)
    .map((el) => (el.className || el.id || '').split(/\\s+/)[0])
    .filter(Boolean);

  const ui = document.getElementById('ui');
  const worldBoxes = [];
  for (const layer of document.querySelectorAll('#ui ' + WORLD.split(', ').join(', #ui '))) {
    if (vis(layer)) worldBoxes.push(...readSurfaces(layer));
  }
  return {
    held: heldBy,
    world: worldBoxes.length,
    strings: readStrings(ui),
    surfaces: readSurfaces(ui),
    bootStrings: readStrings(document.getElementById('boot')).length,
    padStrings: readStrings(document.getElementById('touchpad')).length,
  };
})()`;

/** One extra plate, in the HUD layer, wearing the same clothes as the rest. */
const PLANT_SRC = `(() => {
  const ui = document.getElementById('ui');
  if (!ui || document.getElementById('glass-plant')) return;
  const el = document.createElement('div');
  el.id = 'glass-plant';
  el.className = 'plate';
  el.style.cssText = 'position:absolute;left:12px;bottom:120px;z-index:20;padding:8px 12px;'
    + 'background:rgba(10,20,40,.85);border:1px solid rgba(255,255,255,.2);border-radius:8px;'
    + 'color:#fff;font:12px/1.4 system-ui;pointer-events:none';
  el.innerHTML = '<b>ONE</b> <i>MORE</i> <s>TEXT</s> <u>SURFACE</u>';
  ui.appendChild(el);
})()`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * One cold session, sampled twice a second.
 * @returns {{peakStrings:object, peakSurfaces:object, samples:number, errors:string[]}}
 */
async function run(browser, { size, locale, secs, plant, shotDir, tag }) {
  const ctx = await browser.newContext({
    viewport: { width: size.w, height: size.h },
    deviceScaleFactor: 1,
    hasTouch: !!size.touch,
    isMobile: !!size.touch,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(`try{localStorage.clear();sessionStorage.clear();
    localStorage.setItem('ascent.locale', ${JSON.stringify(locale)});}catch(e){}`);
  // A pointer lock that behaves the way a real browser's does. See the header.
  await page.addInitScript(() => {
    let locked = null;
    Object.defineProperty(document, 'pointerLockElement', {
      get: () => locked, configurable: true,
    });
    Element.prototype.requestPointerLock = function () {
      locked = this;
      setTimeout(() => document.dispatchEvent(new Event('pointerlockchange')), 0);
      return Promise.resolve();
    };
    document.exitPointerLock = function () {
      locked = null;
      setTimeout(() => document.dispatchEvent(new Event('pointerlockchange')), 0);
    };
  });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 45000 }).catch(() => {});
  if (plant) await page.evaluate(PLANT_SRC);

  // One real click, the way the game asks for one, then a naive walk.
  await page.mouse.move(size.w / 2, size.h / 2);
  await page.mouse.click(size.w / 2, size.h / 2);

  let peakStrings = { n: -1 }, peakSurfaces = { n: -1 };
  let samples = 0, held = 0;
  const heldBy = new Set();
  const t0 = Date.now();
  let step = 0;
  let walking = false;
  while ((Date.now() - t0) / 1000 < secs) {
    // The walker: hold W for three seconds, let go for one, and every fourth
    // beat do one of the things a stranger tries — jump, press E, look about.
    const beat = step % 4;
    if (beat === 0 && !walking) { await page.keyboard.down('KeyW'); walking = true; }
    if (beat === 3 && walking) { await page.keyboard.up('KeyW'); walking = false; }
    if (beat === 3) {
      if (step % 8 === 3) await page.keyboard.press('Space');
      else await page.keyboard.press('KeyE');
      await page.mouse.move(size.w / 2 + (step % 2 ? 120 : -120), size.h / 2);
    }
    step += 1;

    for (let i = 0; i < 2; i++) {
      if ((Date.now() - t0) / 1000 >= secs) break;
      await sleep(500);
      const r = await page.evaluate(READ_SRC);
      samples += 1;
      const t = Math.round((Date.now() - t0) / 100) / 10;
      if (r.held.length) {
        held += 1; heldBy.add(r.held.join('+'));
        // A player who wandered into a shop does not stand in it for eighty
        // seconds. Press the key every panel in this game closes on, and carry
        // on walking — otherwise the whole window is spent measuring one card.
        await page.keyboard.press('Escape');
        continue;
      }
      if (r.strings.length > peakStrings.n) peakStrings = { n: r.strings.length, t, ...r };
      if (r.surfaces.length > peakSurfaces.n) peakSurfaces = { n: r.surfaces.length, t, ...r };
    }
  }
  if (walking) await page.keyboard.up('KeyW').catch(() => {});
  if (shotDir) {
    await mkdir(shotDir, { recursive: true });
    await page.screenshot({ path: path.join(shotDir, `${tag}-worst.png`) });
  }
  await ctx.close();
  return { peakStrings, peakSurfaces, samples, held, heldBy: [...heldBy], errors };
}

function report(label, r) {
  const s = r.peakStrings, b = r.peakSurfaces;
  const okS = s.n <= CAP_STRINGS, okB = b.n <= CAP_SURFACES;
  console.log(`${okS && okB ? 'ok  ' : 'FAIL'} ${label.padEnd(20)} strings ${String(s.n).padStart(3)}/${CAP_STRINGS} @t${s.t}s   surfaces ${b.n}/${CAP_SURFACES} @t${b.t}s`
    + `   [world ${b.world}, boot ${s.bootStrings}, pad ${s.padStrings}, held ${r.held}/${r.samples}`
    + `${r.heldBy.length ? ': ' + r.heldBy.join(' ') : ''}]`);
  if (!okB) for (const x of b.surfaces) console.log(`        SURFACE  ${x.cls.split(/\s+/)[0].padEnd(16)} ${x.text}`);
  if (!okS) for (const x of s.strings) console.log(`        STRING   ${x.cls.split(/\s+/)[0].padEnd(16)} ${x.txt}`);
  return okS && okB;
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--disable-gpu-vsync'],
});

let bad = 0;
const rows = [];

if (SELFTEST) {
  /* PLANTED AND UNPLANTED IN THE SAME FRAME.
   *
   * Two separate runs would compare two different moments of a live game —
   * Marlow talks on her own clock, motes arrive when the cadet walks over one —
   * so a difference of one surface would prove nothing. This boots once, walks
   * a little, and then reads the SAME frame twice: once with an extra plate on
   * it and once without, with nothing in between but the plant. The gate must
   * see exactly the surface and exactly the four words that were added.
   */
  console.log('— self-test: one planted plate must move both counts —');
  const size = SIZES[SIZES.length - 1];
  const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h } });
  const page = await ctx.newPage();
  await page.addInitScript('try{localStorage.clear();sessionStorage.clear();}catch(e){}');
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 45000 });
  await page.mouse.click(size.w / 2, size.h / 2);
  await page.keyboard.down('KeyW');
  await sleep(2500);
  await page.keyboard.up('KeyW');
  await sleep(1200);

  const before = await page.evaluate(READ_SRC);
  await page.evaluate(PLANT_SRC);
  const after = await page.evaluate(READ_SRC);
  await page.evaluate(() => document.getElementById('glass-plant')?.remove());
  const back = await page.evaluate(READ_SRC);

  const dS = after.surfaces.length - before.surfaces.length;
  const dW = after.strings.length - before.strings.length;
  const restored = back.surfaces.length === before.surfaces.length
    && back.strings.length === before.strings.length;
  console.log(`  plain   ${before.surfaces.length} surfaces / ${before.strings.length} strings`);
  console.log(`  planted ${after.surfaces.length} surfaces / ${after.strings.length} strings`);
  console.log(`  removed ${back.surfaces.length} surfaces / ${back.strings.length} strings`);
  await ctx.close();
  if (dS !== 1 || dW !== 4 || !restored) {
    console.error(`SELF-TEST FAILED — the gate saw ${dS} extra surface(s) and ${dW} extra `
      + `string(s) where one plate of four words was planted`
      + (restored ? '' : ', and did not read the same frame again once it was taken away'));
    await browser.close();
    process.exit(1);
  }
  console.log('  self-test ok — it sees the plate, it sees the four words, and it stops '
    + 'seeing both the moment they go.\n');
}

for (const size of SIZES) {
  for (const locale of LOCALES) {
    const tag = `${size.name}-${locale}`;
    const r = await run(browser, { size, locale, secs: SECS, shotDir: OUT, tag });
    if (r.errors.length) { console.log(`     console errors (${r.errors.length}): ${r.errors[0]}`); }
    if (!report(`${size.name} ${locale}`, r)) bad += 1;
    rows.push({ size: size.name, locale, strings: r.peakStrings.n, surfaces: r.peakSurfaces.n,
      boot: r.peakStrings.bootStrings, pad: r.peakStrings.padStrings, samples: r.samples,
      held: r.held, heldBy: r.heldBy,
      worstSurfaces: r.peakSurfaces.surfaces?.map((x) => x.cls.split(/\s+/)[0]),
      worstStrings: r.peakStrings.strings?.map((x) => x.txt) });
  }
}

await browser.close();
await writeFile(path.join(OUT, 'glass.json'), JSON.stringify({ cap: { strings: CAP_STRINGS, surfaces: CAP_SURFACES }, rows }, null, 2));
console.log(bad
  ? `\n${bad} of ${rows.length} openings are over the cap (${CAP_STRINGS} strings / ${CAP_SURFACES} surfaces).`
  : `\n${rows.length} openings, every one at or under ${CAP_STRINGS} strings and ${CAP_SURFACES} surfaces.`);
/* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. This gate is recorded
   per wave and its recorded RED fails `npm run check`, so what it holds has to
   be legible to the runner and not only to a reader. The opening ninety seconds is the first
   thing every learner meets, on the phone and the Chromebook this is sold for. */
findings('check:density', { scope: 'route' })
  .route(rows.filter((r) => r.strings > CAP_STRINGS || r.surfaces > CAP_SURFACES)
    .map((r) => `${r.size} ${r.locale}: ${r.strings} readable string(s) and ${r.surfaces} text surface(s) `
      + `in the first 90 s, against a cap of ${CAP_STRINGS} / ${CAP_SURFACES}`))
  .done();
