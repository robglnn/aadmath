/** What does the ledger cost per frame? Measured against the real DOM. */
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
for (const [w, h] of [[414, 896], [1600, 900]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 500, hasTouch: w < 500 });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:4761', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await p.waitForTimeout(4000);
  const out = await p.evaluate(() => {
    // Replay exactly what the ledger does each frame: read every watched card's
    // style chain and rect, then a size read per plate.
    const SELS = ['.meta-comms', '.meta-stamp', '.meta-quest', '.meta-turn .tn-in', '.meta-rite .rite-in',
      '.hail', '.hud-top', '.langs', '.toast', '.marlow', '.buildbar', '.kit', '.afd-head',
      '.gd-card', '.gd-prompt', '.gd-mark', '.fc-card', '.fcs', '.field-tag', '.rp-launch',
      '#touchpad .pads', '#touchpad .home'];
    const els = [];
    for (const s of SELS) for (const e of document.querySelectorAll(s)) els.push({ e, cs: [getComputedStyle(e)] });
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) {
      for (const o of els) { void o.cs[0].opacity; void o.e.getBoundingClientRect(); }
      for (const el of document.querySelectorAll('.afd-plate')) { void el.offsetWidth; void el.offsetHeight; }
    }
    return { ms: (performance.now() - t0) / 200, watched: els.length };
  });
  console.log(`${w}x${h}: ledger ${out.ms.toFixed(3)} ms/frame over ${out.watched} watched cards`);
  await ctx.close();
}
await b.close(); process.exit(0);
