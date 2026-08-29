/**
 * THE LANDSCAPE GATE.
 *
 * Every viewport this project ever photographed was portrait or desktop —
 * 414x896, 390x844, 1280x720, 1600x900. A phone held sideways was never once
 * captured, and it was broken: the companion's card ran off the right edge of
 * the frame mid-sentence, the PROGRESS and MENU pills sat on top of it, the
 * hotbar was behind it, and the rig clipped its own caption.
 *
 * This is the harness that makes that impossible to ship again. It is not a
 * screenshot script with assertions bolted on — the assertions are the point
 * and the pictures are the evidence:
 *
 *   1. NOTHING CLIPS ITS OWN TEXT. Any element that is actually clipping
 *      (computed overflow hidden/clip, or text-overflow:ellipsis engaged) and
 *      whose scroll size exceeds its client size is a failure. `auto`/`scroll`
 *      is allowed only to a surface NAMED in `SCROLL_OK` (_viewports.mjs) —
 *      a progress document, a dossier, a menu: long things with a visible thumb
 *      and a fade at the edge that a reader knows to push. Everything else that
 *      reached for `overflow:auto` as a last resort and then quietly used it is
 *      eating its own words with an extra step. The controls legend lost two of
 *      its eight rows exactly that way and audited clean for it.
 *   2. NOTHING LEAVES THE FRAME. The viewport is the biggest clipping box on
 *      the screen and the one every portrait-only layout forgets. Any visible
 *      text whose rect crosses an edge is a failure.
 *   3. NOTHING OVERLAPS ANYTHING. Every pair of visible text-bearing elements
 *      in the active layer is intersected. Ancestors, descendants and elements
 *      hidden behind an open modal are excluded — the eye does not see those
 *      as collisions either.
 *   4. SAFE AREAS ARE HONOURED. `--sa-*` are ordinary custom properties holding
 *      an `env()` value (src/ui/style.css), so this harness can hand a desktop
 *      Chromium a notch and a home indicator and photograph a real iPhone
 *      layout. `--notch` runs assert nothing lands in the inset — and the notch
 *      is shaped per viewport (`insetsFor`, _viewports.mjs): a flank inset for
 *      a phone on its side, a TOP inset for a phone held up. It was flank-
 *      shaped for everything until now, which meant `--sa-t` was zero in every
 *      capture this project ever took and the whole portrait ladder, which
 *      hangs off `max(14px, var(--sa-t))`, had never been photographed with a
 *      notch on it at all.
 *
 * Touch is EMULATED (`hasTouch`), because the whole defect only exists on a
 * device with thumbs on the glass: src/ui/hud.js sets `[data-touch]` off the
 * same predicate src/player/touch.js mounts the controls with, and without it
 * a landscape capture photographs a desktop layout at phone dimensions and
 * declares victory.
 *
 *   node tools/critic/landscape.mjs --out shots/landscape
 *   node tools/critic/landscape.mjs --out shots/x --locales en --sizes 844x390
 *   node tools/critic/landscape.mjs --out shots/before --baseline
 *
 * `--baseline` photographs the game with the landscape composition switched
 * OFF at runtime: it disables src/ui/landscape.css and takes the landscape
 * clause back off the phone media queries it was added to. That is the state a
 * client reported, reproducible by anyone, so the before and the after are the
 * same harness against the same build rather than two rounds of screenshots
 * and somebody's word for what changed.
 *
 * Exit 0 = every viewport, in every locale, clean.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LANDSCAPE, PORTRAIT, audit, AUDIT_SRC, insetsFor, APPLY_INSET_SRC } from './_viewports.mjs';
import { findings } from '../_findings.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/landscape'));
const LOCALES = arg('locales', 'en,es,pl').split(',').filter(Boolean);
const BASELINE = process.argv.includes('--baseline');

/**
 * Undo the landscape pass, in the page, at runtime.
 *
 * Two things to switch off, and they are switched off by their own fingerprint
 * rather than by a file name, so this keeps working when the bundler inlines
 * or renames anything:
 *   · the stylesheet that declares `--lsc-band` — the landscape composition;
 *   · the landscape clause on any media query that also carries a phone
 *     `max-width`, which is the one-line change that made the phone rules
 *     apply to a phone on its side.
 */
const UNDO_LANDSCAPE = `(() => {
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    /* Backwards: deleting shifts every index after it. Two things go:
         · any block carrying the pass's own fingerprint (--lsc-on), which is
           the landscape composition itself — found by its content rather than
           by a file name, because a production bundle has concatenated every
           stylesheet in the game into one and there is no landscape sheet to
           disable;
         · the landscape clause on any media query that also carries a phone
           max-width, which is the one-line change that made the existing phone
           rules apply to a phone on its side. */
    for (let i = rules.length - 1; i >= 0; i--) {
      const r = rules[i];
      if (r.cssText && r.cssText.includes('--lsc-on')) { sheet.deleteRule(i); continue; }
      if (r.media && r.conditionText
          && /max-width/.test(r.conditionText)
          && /orientation:\s*landscape/.test(r.conditionText)) {
        for (const m of [...r.media]) if (/orientation:\s*landscape/.test(m)) r.media.deleteMedium(m);
      }
    }
  }
})()`;
/**
 * A PHONE HELD UP IS STILL A PHONE, AND THIS GATE HAD STOPPED PHOTOGRAPHING ONE.
 *
 * This file was written because "every viewport this project ever photographed
 * was portrait or desktop" (see the header) — and the pass that fixed that
 * REPLACED the portrait ladder instead of joining it. Measured on this tree:
 * `check:layout` swept 4 sizes, every one of them wider than it is tall, and
 * reported 288/288 clean while nothing anywhere photographed 390x844 with a
 * Dynamic Island on it. `check:locklayout` and `check:transient` do carry
 * `PORTRAIT`, and both are out of the build — one of them excused as "covered
 * by check:layout".
 *
 * So the default sweep is BOTH ladders. Both halves were measured separately
 * before this line landed: 288/288 landscape and 144/144 portrait, EN/ES/PL,
 * plain, notch and island. `--sizes` still overrides for a single-shape run.
 */
const SIZES = arg('sizes', '')
  ? arg('sizes', '').split(',').map((s) => {
    const [w, h] = s.split('x').map(Number);
    return { w, h, name: s, label: s };
  })
  : [...PORTRAIT, ...LANDSCAPE];

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});

const failures = [];
const rows = [];
const shots = [];
const errors = [];

/**
 * Wait for the game to exist, and mean it.
 *
 * A WebGL context on a contended GPU occasionally takes longer than 30 s to
 * come up, and a gate that throws on that has told you nothing about the
 * layout — it has told you about the machine. One reload, then it is real.
 */
async function waitForAscent(page, why) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.waitForFunction(() => !!window.__ascent, null, { timeout: 45000 });
      return true;
    } catch {
      if (attempt === 2) throw new Error(`the game never booted (${why})`);
      await page.reload({ waitUntil: 'networkidle' });
    }
  }
  return false;
}

/** A long line, in each locale, that the companion has to be able to print. */
const LONG = {
  en: 'Nothing in your kit reaches one from flat ground, and that is the entire idea. '
    + 'Place a ramp, place another off the top of it, and touch the thing. Sixty motes apiece, '
    + 'and there are three of them on this island before the road bends north.',
  es: 'Nada de tu equipo alcanza uno desde el suelo llano, y esa es justamente la idea. '
    + 'Coloca una rampa, coloca otra encima de ella y toca la cosa. Sesenta motas cada una, '
    + 'y hay tres en esta isla antes de que el camino gire al norte.',
  pl: 'Nic z twojego wyposażenia nie sięgnie go z płaskiego gruntu i o to właśnie chodzi. '
    + 'Postaw rampę, postaw następną na jej szczycie i dotknij tej rzeczy. Sześćdziesiąt pyłków '
    + 'za każdą, a są trzy na tej wyspie, zanim droga skręci na północ.',
};

for (const vp of SIZES) {
  for (const loc of LOCALES) {
    /* THE NOTCH, IN THE SHAPE THIS VIEWPORT CAN ACTUALLY HAVE ONE.
       A phone on its side wears its housing on a flank; a phone held up wears
       it on the top edge. `insetsFor` picks per viewport — see the long note in
       _viewports.mjs for why that distinction was worth a round of its own. */
    for (const inset of insetsFor(vp)) {
      const notch = !!inset.name;
      /* The inset used to be skipped outside English — "a geometry test, not a
         language one". It is both. An inset does not move a box, it takes room
         away from the column above it, and how much room that column wanted is
         decided by how long the words in it are: at 390x844 with a Dynamic
         Island the controls legend needs 124 px in English and 155 in Spanish
         and Polish, against a budget of 88. Skipping the other two locales
         photographed the cheapest third of the problem. */
      const tag = `${vp.name}-${loc}${inset.name}`;
      const ctx = await browser.newContext({
        viewport: { width: vp.w, height: vp.h },
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: false,       // keep the layout viewport honest; hasTouch is what [data-touch] reads
        locale: loc === 'pl' ? 'pl-PL' : loc === 'es' ? 'es-ES' : 'en-US',
      });
      const page = await ctx.newPage();
      page.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag}: ${m.text()}`); });
      page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));

      try {
      await page.addInitScript(AUDIT_SRC);
      /* The inset goes on as an INIT script, not once after boot: a locale
         switch full-reloads the page, and an inline style set on
         `document.documentElement` before that reload is gone afterwards — a
         "notched" capture that quietly photographs an unnotched frame is
         exactly the class of blind spot this run exists to close. */
      if (notch) {
        await page.addInitScript(`(() => {
          const apply = () => (${APPLY_INSET_SRC})(${JSON.stringify(inset)});
          if (document.documentElement) apply();
          document.addEventListener('DOMContentLoaded', apply);
        })()`);
      }
      await page.goto(URL, { waitUntil: 'networkidle' });
      await page.evaluate(() => { try { localStorage.clear(); } catch { /* private mode */ } });
      await page.reload({ waitUntil: 'networkidle' });
      await waitForAscent(page, tag);

      // Exactly what this handset, in this rotation, hands the page — all four
      // edges, so nothing inherits an edge from the shape it is not wearing.
      if (notch) await page.evaluate(`(${APPLY_INSET_SRC})(${JSON.stringify(inset)})`);
      if (BASELINE) await page.evaluate(UNDO_LANDSCAPE);
      await page.evaluate((l) => window.__ascent.setLocale(l), loc);
      await page.evaluate(() => document.getElementById('boot')?.classList.add('gone'));
      await page.waitForTimeout(2200);

      const check = async (scene, ms = 500) => {
        await page.waitForTimeout(ms);
        if (BASELINE) await page.evaluate(UNDO_LANDSCAPE);   // a locale switch reloads the page
        const f = path.join(OUT, `${tag}-${scene}.png`);
        await page.screenshot({ path: f });
        shots.push(f);
        const r = await page.evaluate(() => window.__landAudit());
        const row = { vp: vp.name, loc, notch, inset: inset.name || 'flat', scene, ...r, shot: f };
        rows.push(row);
        /* The frame has to be wearing the notch it was asked to wear. */
        const want = { t: parseFloat(inset.t), r: parseFloat(inset.r),
                       b: parseFloat(inset.b), l: parseFloat(inset.l) };
        const wrong = Object.keys(want).filter((k) => Math.abs(want[k] - (r.safe[k] || 0)) > 0.5);
        if (wrong.length) {
          throw new Error(`the page is not wearing the inset it was handed: `
            + `${wrong.map((k) => `${k} ${r.safe[k]}!=${want[k]}`).join(', ')}`);
        }
        const bad = r.clipped.length + r.outside.length + r.overlaps.length
          + r.silent.length + (notch ? r.inSafe.length : 0);
        if (bad) failures.push(row);
        const mark = bad ? 'FAIL' : ' ok ';
        console.log(`  ${mark}  ${tag.padEnd(22)} ${scene.padEnd(16)} `
          + `clip:${r.clipped.length} out:${r.outside.length} lap:${r.overlaps.length} scr:${r.silent.length}`
          + (notch ? ` safe:${r.inSafe.length}` : ''));
        for (const c of r.silent.slice(0, 4)) console.log(`         scroll ${c.sel}  ${c.what}  "${c.text.slice(0, 40)}"`);
        for (const c of r.clipped.slice(0, 4)) console.log(`         clip  ${c.sel}  ${c.what}`);
        for (const o of r.outside.slice(0, 4)) console.log(`         out   ${o.sel}  ${o.edge} by ${o.by}px  "${o.text}"`);
        for (const o of r.overlaps.slice(0, 5)) console.log(`         lap   ${o.a} x ${o.b}  ${o.w}x${o.h}px`);
        for (const o of (notch ? r.inSafe : []).slice(0, 4)) console.log(`         safe  ${o.sel}  ${o.edge} by ${o.by}px`);
        return r;
      };

      // ---- 1. arrival: the frame that has to earn the next ten minutes ----
      await check('01-arrival', 900);

      // ---- 2. the companion, with the longest line she has ----------------
      await page.evaluate((text) => {
        window.__ascent.story.comms.clear();
        window.__ascent.story.comms.say(text, { force: true });
      }, LONG[loc]);
      await page.waitForTimeout(2600);   // let it type all the way on
      await check('02-marlow-long', 300);

      // ---- 3. the learning surface ---------------------------------------
      await page.evaluate(() => window.__ascent.openRiftById('one-step-add'));
      await check('03-rift', 900);
      await page.evaluate(() => window.__ascent.panel.close());
      await page.waitForTimeout(400);

      // ---- 4. the progress report ----------------------------------------
      await page.evaluate(() => window.__ascent.report.show());
      await check('04-report', 900);
      await page.evaluate(() => window.__ascent.report.close());
      await page.waitForTimeout(400);

      // ---- 5. the orders card, then the session close ---------------------
      // Driven the way session-drive.mjs drives it: wait for the real charter
      // beat, press the real button, then run the real clock out. Posing the
      // close card by hand would photograph a card the game never composes.
      const charter = await page.waitForSelector('.ses-charter.show .sc-go', { timeout: 60000 }).catch(() => null);
      if (charter) {
        await check('05-orders', 700);
        await charter.click();
        await page.waitForTimeout(800);
      }
      // ---- 6. the densest HUD state there is -------------------------------
      // Rig, session band, objective, chapter, hotbar, first-contact card and a
      // long companion line, all on screen at once. This is the frame the
      // client photographed, and the one every element in this game is quietly
      // assuming somebody else is not using.
      await page.evaluate((text) => {
        window.__ascent.story.comms.clear();
        window.__ascent.story.comms.say(text, { force: true });
      }, LONG[loc]);
      await page.waitForTimeout(2600);
      await check('06-hud-full', 300);

      // …and the same frame once the cadet has put the controls card away.
      await page.evaluate(() => document.querySelector('.fc-x')?.click());
      await page.waitForTimeout(600);
      await check('07-hud-clear', 300);

      // ---- 7. the session close -------------------------------------------
      await page.evaluate(() => {
        const s = window.__ascent.session;
        s.chargeTo?.(26);
        s.skipToClose?.();
      });
      await page.waitForFunction(() => document.querySelector('.ses-close')?.classList.contains('show'),
        null, { timeout: 15000 }).catch(() => null);
      await check('08-close', 1600);
      } catch (e) {
        /* A viewport that could not be driven is a FAILURE of this run, not a
           reason to abandon the other 150 frames — the whole point of the gate
           is the matrix, and a harness that stops at the first flake reports on
           the machine rather than on the game. */
        console.log(`  FAIL  ${tag.padEnd(22)} ${'(drive)'.padEnd(16)} ${e.message.split('\n')[0]}`);
        failures.push({ vp: vp.name, loc, notch, scene: 'drive', error: e.message });
      }

      await ctx.close();
    }
  }
}

await writeFile(path.join(OUT, 'landscape.json'),
  JSON.stringify({ url: URL, sizes: SIZES, locales: LOCALES, rows, errors }, null, 2));

console.log(`\nshots -> ${OUT}${BASELINE ? '  (BASELINE: the landscape pass is switched off)' : ''}`);
console.log(`${rows.length - failures.length}/${rows.length} frames clean, ${errors.length} console errors`);
if (failures.length) {
  console.log('\nFRAMES WITH A LAYOUT DEFECT:');
  for (const f of failures) console.log(`  - ${f.vp} ${f.loc}${f.notch ? ' notch' : ''} ${f.scene}`);
}
errors.slice(0, 10).forEach((e) => console.log('  ! ' + e));

await browser.close();
/* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. This gate is recorded
   per wave and its recorded RED fails `npm run check`, so what it holds has to
   be legible to the runner and not only to a reader. Layout is measured on the shipped
   frame in three locales; a line printed over a line is on the route. */
findings('check:layout', { scope: 'route' })
  .route(failures.map((f) => (typeof f === 'string' ? f
    : f.error ? `${f.vp} ${f.loc} notch=${f.notch} ${f.scene}: ${f.error}`
      : `${f.vp} ${f.loc} notch=${f.notch} ${f.scene}: clipped ${f.clipped?.length ?? 0}, ink outside ${f.outside?.length ?? 0}, `
        + `overlaps ${f.overlaps?.length ?? 0}, silent scrollers ${f.silent?.length ?? 0}, in the safe area ${f.inSafe?.length ?? 0}`)))
  .route(errors.length ? [`${errors.length} console error(s) during the sweep: ${errors.slice(0, 3).join(' | ')}`] : [])
  .done();

// keep the import used even when tree-shaken by a reader's eye
void audit;
