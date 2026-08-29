#!/usr/bin/env node
/**
 * THE EVIDENCE, IN PIXELS — the same frame before and after the phone pass.
 *
 * Two rounds of screenshots taken a day apart are two builds, two seeds and
 * somebody's word for what changed. This takes BOTH frames from ONE build, in
 * one browser, on the same item at the same seed: the "after" is the tree as it
 * stands, and the "before" is that same tree with a stylesheet injected that
 * restores — declaration for declaration — what src/ui/rift.css,
 * src/ui/landscape.css and src/ui/portrait.css said before this pass. The panel
 * is re-shown after the injection, so the rift's own fit pass runs again and
 * the frame is composed the way it was, not merely painted over.
 *
 * It is a reconstruction and it says so. What it is not is a different build.
 *
 *   node tools/critic/reachshots.mjs --out shots/lane-e
 *   node tools/critic/reachshots.mjs --out shots/lane-e --url http://127.0.0.1:4173
 */
import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { serveFrozen } from '../check-figures.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const OUT = path.resolve(arg('out', 'shots/lane-e'));
const URL = arg('url', '');
const LOCALES = ['en', 'es', 'pl'];
const VPS = [
  { name: 'portrait-390x844', w: 390, h: 844 },
  { name: 'landscape-844x390', w: 844, h: 390 },
];
/** A coordinate chart and a keypad on the same card. */
const SPEC = { skill: 'eval-expr', d: 2, seed: 4242 };

/* The tree as it was, declaration for declaration. Every line here is what the
   three stylesheets said before the pass; nothing is invented. */
const BEFORE = `
/* src/ui/rift.css — the instrument was a bare number the fit pass could not spend */
.rift { --rf-instr: 366px !important; }
.rf-pad { max-width: 366px !important; }
.rf-fig.grid { width: auto !important; max-width: none !important; }
.rf-fig.grid svg { width: min(calc(420px * var(--rf-u)), 76vw, 46vh) !important; height: auto !important; }
.rf-keys { grid-template-columns: repeat(4, 1fr) !important; }
@media (pointer: coarse) {
  .rf-key { min-height: calc(50px * var(--rf-u)) !important; }
  .rf-key.commit { min-height: calc(54px * var(--rf-u)) !important; }
  .rf-btn { min-height: 0 !important; min-width: 0 !important; display: inline !important; }
  .rf-x { width: calc(34px * var(--rf-u)) !important; height: calc(34px * var(--rf-u)) !important; }
  .rf-reading { min-height: 0 !important; }
  .rf-move { min-height: 0 !important; display: inline !important; }
  .rf-bay { min-height: 0 !important; }
  .rf-cell { min-height: calc(76px * var(--rf-u)) !important; }
}
@media (max-width: 760px), (max-height: 520px) and (orientation: landscape) {
  .rf-pad { max-width: none !important; }
}
/* src/ui/landscape.css — six columns, a stacked chart, and a 38 px thumb */
@media (max-height: 520px) and (orientation: landscape) {
  .rf-inner { flex-direction: column !important; }
  .rf-inner > .rf-figbox, .rf-inner > .rf-work { flex: 0 0 auto !important; }
  .rf-inner .rf-fig.grid { max-width: none !important; }
  .rf-inner .rf-fig.grid svg { width: min(calc(420px * var(--rf-u)), 76vw, 46vh) !important; }
  .rf-pad { flex-direction: row !important; max-width: min(700px, 100%) !important; }
  .rf-socket { flex: 1 1 38% !important; }
  .rf-keys { flex: 1 1 62% !important; grid-template-columns: repeat(6, 1fr) !important; }
  .rf-key { min-height: calc(44px * var(--rf-u)) !important; }
  .rf-key.widest, .rf-key.commit { grid-column: span 6 !important; }
  .rf-key.commit { min-height: calc(46px * var(--rf-u)) !important; }
  #touchpad .pads { width: 118px !important; height: 128px !important; }
  #touchpad .btn { width: 38px !important; height: 38px !important; }
  #touchpad .btn svg { width: 19px !important; height: 19px !important; }
  #touchpad .btn[data-a="jump"] { width: 56px !important; height: 56px !important; }
  #touchpad .btn[data-a="jump"] svg { width: 26px !important; height: 26px !important; }
  #touchpad .btn[data-a="dash"] { right: 64px !important; bottom: 18px !important; }
  #touchpad .btn[data-a="glide"] { right: 2px !important; bottom: 88px !important; }
  #touchpad .btn[data-a="interact"] { right: 68px !important; bottom: 82px !important; }
  #ui .mnu-pill { min-height: 30px !important; min-width: 0 !important; padding: .3rem .44rem !important; }
  .rp-launch { min-height: 30px !important; min-width: 0 !important; right: calc(var(--pad-r) + 164px) !important; }
}
/* src/ui/portrait.css — a 40 px thumb and 34 px pills */
@media (max-width: 560px) and (orientation: portrait) {
  #ui { --pt-ctl: 40px !important; }
  #touchpad .pads { width: 122px !important; height: 134px !important; }
  #touchpad .btn { width: 40px !important; height: 40px !important; }
  #touchpad .btn svg { width: 20px !important; height: 20px !important; }
  #touchpad .btn[data-a="jump"] { width: 62px !important; height: 62px !important; }
  #touchpad .btn[data-a="jump"] svg { width: 28px !important; height: 28px !important; }
  #touchpad .btn[data-a="glide"] { bottom: 92px !important; }
  #touchpad .btn[data-a="interact"] { bottom: 86px !important; }
  #ui .rp-launch, #ui:has(.ses-band.show) .rp-launch { min-height: 34px !important; min-width: 0 !important; }
  .sound { min-height: 0 !important; min-width: 0 !important; }
  #ui .mnu-pill { min-height: 34px !important; min-width: 0 !important; }
}
`;

const measure = () => {
  const P = window.__panel.el;
  const b = (s) => { const e = P.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return `${r.width.toFixed(1)}x${r.height.toFixed(1)}`; };
  return { chart: b('.rf-fig.grid svg'), keypad: b('.rf-pad'), key7: b('.rf-key[data-g="7"]'), echo: b('#rf-hint'), close: b('.rf-x') };
};

await mkdir(OUT, { recursive: true });
const rows = [];
const server = await serveFrozen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: false });
  await page.goto(server.base, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  for (const vp of VPS) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    for (const locale of LOCALES) {
      for (const when of ['before', 'after']) {
        const m = await page.evaluate(async ({ spec, locale, when, css }) => {
          document.getElementById('lane-e-before')?.remove();
          if (when === 'before') {
            const st = document.createElement('style');
            st.id = 'lane-e-before';
            st.textContent = css;
            document.head.appendChild(st);
          }
          window.__show({ ...spec, locale });
          const f = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          await f(); await new Promise((r) => setTimeout(r, 40)); await f();
          window.__show({ ...spec, locale });      // re-fit under the sheet that is now live
          await f(); await new Promise((r) => setTimeout(r, 40)); await f();
          return null;
        }, { spec: SPEC, locale, when, css: BEFORE });
        const g = await page.evaluate(measure);
        const name = `rift-${vp.name}-${locale}-${when}.png`;
        await page.screenshot({ path: path.join(OUT, name) });
        rows.push({ name, ...g });
      }
    }
  }
} finally {
  await browser.close();
  await server.stop();
}

/* ---- the world frame, if a shipped build is being served ---- */
if (URL) {
  const b2 = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
  for (const vp of VPS) {
    for (const locale of LOCALES) {
      const ctx = await b2.newContext({
        ...devices['iPhone 13'], viewport: { width: vp.w, height: vp.h }, screen: { width: vp.w, height: vp.h },
        hasTouch: true, isMobile: true, deviceScaleFactor: 2,
        locale: locale === 'es' ? 'es-ES' : locale === 'pl' ? 'pl-PL' : 'en-US',
      });
      const page = await ctx.newPage();
      await page.addInitScript((l) => { try { localStorage.clear(); localStorage.setItem('ascent.locale', l); } catch { /* private */ } }, locale);
      await page.goto(URL, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
      await page.waitForTimeout(6000);
      for (const when of ['after', 'before']) {
        if (when === 'before') {
          await page.evaluate((css) => {
            const st = document.createElement('style'); st.id = 'lane-e-before'; st.textContent = css;
            document.head.appendChild(st);
          }, BEFORE);
          await page.waitForTimeout(500);
        }
        const g = await page.evaluate(() => {
          const o = {};
          for (const b of document.querySelectorAll('#touchpad .btn')) {
            const r = b.getBoundingClientRect();
            o[b.dataset.a] = `${Math.round(r.width)}x${Math.round(r.height)}`;
          }
          for (const [k, s] of [['progress', '.rp-launch'], ['menu', '.mnu-pill']]) {
            const e = document.querySelector(s);
            if (e) { const r = e.getBoundingClientRect(); o[k] = `${Math.round(r.width)}x${Math.round(r.height)}`; }
          }
          return o;
        });
        const name = `world-${vp.name}-${locale}-${when}.png`;
        await page.screenshot({ path: path.join(OUT, name) });
        rows.push({ name, ...g });
      }
      await ctx.close();
    }
  }
  await b2.close();
}

for (const r of rows) {
  const { name, ...rest } = r;
  console.log(`  ${name.padEnd(40)} ${Object.entries(rest).map(([k, v]) => `${k}=${v}`).join('  ')}`);
}
console.log(`\n  ${rows.length} frame(s) in ${OUT}`);
