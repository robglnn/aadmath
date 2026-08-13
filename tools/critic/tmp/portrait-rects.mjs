/**
 * A rect dump for the portrait composition pass. Scratch: it answers "where is
 * every persistent thing actually drawn on a 414x896 phone", which is the one
 * question a layout that is composed in one place has to be able to answer.
 *
 *   tools/critic/frozen.sh tools/critic/tmp/portrait-rects.mjs --sizes 414x896
 */
import { chromium } from 'playwright';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const LOC = arg('loc', 'en');
const SIZES = arg('sizes', '414x896,390x844').split(',').map((s) => {
  const [w, h] = s.split('x').map(Number); return { w, h, name: s };
});

const SELS = ['.hud-top', '.rig', '.langs', '.sound', '.mnu-pill', '.rp-launch',
  '.ses-band', '.gd-card', '.meta-quest', '.buildbar', '.fc', '.fc-pill',
  '.kit', '.ledger', '.axiom', '.axiom-clear', '.meta-comms', '.marlow',
  '.toast', '.hail', '.gd-prompt', '.afd-head', '.meta-stamp',
  '#touchpad .home', '#touchpad .pads',
  '.meta-comms > div:last-child', '.meta-text', '.meta-text > span.body'];

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
for (const vp of SIZES) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h }, hasTouch: true, isMobile: false,
    locale: LOC === 'pl' ? 'pl-PL' : LOC === 'es' ? 'es-ES' : 'en-US',
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* private */ } });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 45000 });
  await page.evaluate((l) => window.__ascent.setLocale(l), LOC);
  await page.evaluate(() => document.getElementById('boot')?.classList.add('gone'));
  await page.waitForTimeout(2500);
  /* the densest HUD state, driven the way the gate drives it */
  const go = await page.waitForSelector('.ses-charter.show .sc-go', { timeout: 60000 }).catch(() => null);
  if (go) { await go.click(); await page.waitForTimeout(900); }
  await page.evaluate(() => {
    window.__ascent.story.comms.clear();
    window.__ascent.story.comms.say('Nothing in your kit reaches one from flat ground, and that is the '
      + 'entire idea. Place a ramp, place another off the top of it, and touch the thing. Sixty motes '
      + 'apiece, and there are three of them on this island before the road bends north.', { force: true });
  });
  await page.waitForTimeout(2800);

  const out = await page.evaluate((sels) => {
    const vars = ['--pad-t', '--pad-r', '--pad-b', '--pad-l', '--hud-b', '--thumb-b',
      '--thumb-l', '--thumb-r', '--dock-b', '--gd-h'];
    const cs = getComputedStyle(document.documentElement);
    const v = Object.fromEntries(vars.map((k) => [k, cs.getPropertyValue(k).trim()]));
    const rows = [];
    for (const s of sels) {
      for (const el of document.querySelectorAll(s)) {
        const c = getComputedStyle(el);
        if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) < 0.05) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        rows.push({ s, x: Math.round(r.left), y: Math.round(r.top),
          w: Math.round(r.width), h: Math.round(r.height),
          r: Math.round(r.right), b: Math.round(r.bottom), z: c.zIndex });
      }
    }
    return { v, rows, touch: document.documentElement.hasAttribute('data-touch') };
  }, SELS);

  console.log(`\n=== ${vp.name} ${LOC} touch=${out.touch} ===`);
  console.log(JSON.stringify(out.v));
  out.rows.sort((a, b) => a.y - b.y);
  for (const r of out.rows) {
    console.log(`  ${r.s.padEnd(18)} x${String(r.x).padStart(4)} y${String(r.y).padStart(4)}`
      + ` ${String(r.w).padStart(4)}x${String(r.h).padStart(3)}  →r${String(r.r).padStart(4)} b${String(r.b).padStart(4)}  z${r.z}`);
  }
  await ctx.close();
}
await browser.close();
