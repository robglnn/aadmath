/**
 * THE TRANSIENT LAYOUT GATE.
 *
 * tools/critic/landscape.mjs is the layout matrix, and it reported 288 frames
 * out of 288 clean while three real overlaps were on screen in one session of
 * ordinary play. That is not a bug in the matrix. It is that every frame in it
 * is a RESTING frame — arrival, a tear, the report, the close — and every one
 * of the three defects lived on a surface that only exists for a few seconds
 * after something happens:
 *
 *   · the interact prompt, drawn through the grant card that had just landed;
 *   · the notice toast, printed as ghost text in the RUN banner's skirt;
 *   · a ledger row, with its second line cut in half by the kit strip.
 *
 * So this is the same audit, driven over the same viewport/locale/notch matrix,
 * on frames where those surfaces are UP: a line held, a capability granted, a
 * build refused, a surge levied, and all of it at once. It asks `__landAudit`'s
 * four questions — nothing clips, nothing leaves the frame, nothing overlaps,
 * the safe areas are honoured — and three more of its own, which are in
 * tools/critic/_transient.mjs and are the ones the three defects would have
 * failed:
 *
 *   5. NOTHING IS A GHOST. A surface its owner says is up, settling between 2%
 *      and 90% opacity, is unreadable text on the glass.
 *   6. NO TWO PLATES IN ONE PLACE. Painted transient surfaces are intersected
 *      as boxes. The prompt and the grant card never shared a letter; they
 *      shared 52x39 px of plate and hid each other whole.
 *   7. THE FOOT STACK STACKS. The newest ledger row's floor is above the kit
 *      strip's ceiling — the invariant, so it holds for six bought verbs as
 *      well as for the two a photograph happened to catch.
 *
 *   node tools/critic/transient.mjs --out shots/transient
 *   node tools/critic/transient.mjs --out shots/x --locales en --sizes 1600x900
 *   node tools/critic/transient.mjs --out shots/x --insets flat
 *   node tools/critic/transient.mjs --self-test   # prove the arbiter can fire
 *
 * Exit 0 = every event, at every viewport, in every locale, clean.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AUDIT_SRC, insetsFor, APPLY_INSET_SRC, DESKTOP, PORTRAIT, LANDSCAPE } from './_viewports.mjs';
import { TRANS_SRC, SCENES, intoPlay, settle } from './_transient.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/transient'));
const LOCALES = arg('locales', 'en,es,pl').split(',').filter(Boolean);
const INSETS = arg('insets', 'all');

/* Desktop and BOTH phone orientations. The three reported defects were all on
   a laptop, and both phone rotations are here because they are three different
   compositions of the same surfaces — the desktop runs on src/ui/slots.css
   alone, and the two phones on their own sheets on top of it. Anything else in
   `_viewports.mjs` can be asked for with `--sizes`; a whole context costs about
   ninety seconds, because it plays the game into a real session first. */
const DEFAULT_SIZES = [DESKTOP[1], PORTRAIT[0], LANDSCAPE[0]];
const SIZES = arg('sizes', '')
  ? arg('sizes', '').split(',').map((s) => {
    const [w, h] = s.split('x').map(Number);
    return { w, h, name: s, label: s };
  })
  : DEFAULT_SIZES;

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});

const failures = [];
const rows = [];
const errors = [];

/**
 * EVERY ONE OF THESE HAS TO HAVE BEEN ON SCREEN, IN EVERY CONTEXT.
 *
 * The per-scene `wants` say what a given event should raise; this says what the
 * WHOLE run has to have photographed before it is allowed to report a clean
 * matrix. It exists because the failure this gate was built for is not a wrong
 * pixel, it is a blind frame: the first version of this harness photographed
 * seven frames of a cold open with nothing transient on any of them and
 * reported 7/7 clean, which is precisely what tools/critic/landscape.mjs did
 * with 288.
 */
const MUST_RAISE = ['band', 'notice', 'grant', 'prompt', 'ledger', 'kit'];

/** A long line, in each locale, that the companion has to be able to print. */
const LONG = {
  en: 'Nothing in your kit reaches one from flat ground, and that is the entire idea. '
    + 'Place a ramp, place another off the top of it, and touch the thing.',
  es: 'Nada de tu equipo alcanza uno desde el suelo llano, y esa es justamente la idea. '
    + 'Coloca una rampa, coloca otra encima de ella y toca la cosa.',
  pl: 'Nic z twojego wyposażenia nie sięgnie go z płaskiego gruntu i o to właśnie chodzi. '
    + 'Postaw rampę, postaw następną na jej szczycie i dotknij tej rzeczy.',
};

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

/**
 * PROVE THE ARBITER CAN FIRE.
 *
 * The slotting in src/ui/slots.css separates these surfaces well enough that a
 * clean matrix never needs src/ui/slots.js to hush anything — which is the
 * right outcome and a dangerous one, because an unexercised safety net and a
 * broken one report the same thing. So this injures the layout on purpose: it
 * drops the notice onto the interact prompt with an inline style, and asserts
 * that the prompt yields, and then that the yield LIFTS when the injury is
 * taken away. A hush that sticks is worse than no hush at all.
 *
 *   node tools/critic/transient.mjs --self-test
 */
if (process.argv.includes('--self-test')) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* private mode */ } });
  await page.reload({ waitUntil: 'networkidle' });
  await waitForAscent(page, 'self-test');
  await page.evaluate(() => document.getElementById('boot')?.classList.add('gone'));
  await page.waitForTimeout(1400);
  await intoPlay(page);
  await settle(page);

  // Stand at a ring so the prompt is up, then drop a notice on top of it.
  await page.evaluate(() => window.__ascent.teleportTo(window.__ascent.nextObjective?.()?.id || 'one-step-add'));
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => { if (window.__ascent.panel.open) window.__ascent.panel.close(); });
    if (await page.$('.gd-prompt.show')) break;
    await page.waitForTimeout(400);
  }
  const injure = async (on) => page.evaluate((v) => {
    const p = document.querySelector('.gd-prompt');
    const box = p.getBoundingClientRect();
    const el = document.getElementById('toast');
    if (v) { el.style.top = `${Math.round(box.top + 4)}px`; } else { el.style.top = ''; }
    const a = window.__ascent;
    a.hud.flash(a.t('kit.needShards', { n: 240 }), 'bad');
  }, on);

  await injure(true);
  await page.waitForTimeout(500);
  const hushed = await page.evaluate(() => !!document.querySelector('.gd-prompt.slot-yield'));
  await injure(false);
  await page.waitForTimeout(700);
  const lifted = await page.evaluate(() => !!document.querySelector('.gd-prompt.show')
    && !document.querySelector('.gd-prompt.slot-yield'));

  console.log(`  ${hushed ? ' ok ' : 'FAIL'}  the prompt yields when a notice is dropped on it`);
  console.log(`  ${lifted ? ' ok ' : 'FAIL'}  …and the yield lifts the moment the frame is free again`);
  await browser.close();
  process.exit(hushed && lifted ? 0 : 1);
}

for (const vp of SIZES) {
  for (const loc of LOCALES) {
    const insets = INSETS === 'flat' ? [insetsFor(vp)[0]] : insetsFor(vp);
    for (const inset of insets) {
      const notch = !!inset.name;
      const tag = `${vp.name}-${loc}${inset.name}`;
      const ctx = await browser.newContext({
        viewport: { width: vp.w, height: vp.h },
        deviceScaleFactor: 2,
        /* Thumbs only where there are thumbs. src/ui/hud.js sets `[data-touch]`
           off this, and it moves the whole foot of the frame — so a desktop
           capture taken with `hasTouch: true` photographs a thumb layout at
           laptop dimensions and answers a question nobody asked. All three
           reported defects were on a 1600x900 pointer frame. */
        hasTouch: Math.min(vp.w, vp.h) <= 520,
        isMobile: false,
        locale: loc === 'pl' ? 'pl-PL' : loc === 'es' ? 'es-ES' : 'en-US',
      });
      const page = await ctx.newPage();
      page.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag}: ${m.text()}`); });
      page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));

      try {
        await page.addInitScript(AUDIT_SRC);
        await page.addInitScript(TRANS_SRC);
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
        if (notch) await page.evaluate(`(${APPLY_INSET_SRC})(${JSON.stringify(inset)})`);
        await page.evaluate((l) => window.__ascent.setLocale(l), loc);
        await page.evaluate(() => document.getElementById('boot')?.classList.add('gone'));
        await page.waitForTimeout(1400);
        /* Into play, with real input, before a single frame is judged. */
        await intoPlay(page);
        const raised = new Set();

        /* `mode: 'arrival'` — the frame taken 140 ms into a notice's own fade.
           It exists to answer ONE question: does a notice arrive readable, or
           does it spend a sixth of its life as grey text? Everything else on
           that frame is mid-crossfade too — the controls card retiring under a
           grant card, the companion's line leaving — and calling a designed
           crossfade an overlap is how a gate teaches people to ignore it. Who
           is standing on whom is a question about settled frames, and every
           other scene here is one. */
        const check = async (scene, wants = [], mode = 'settled') => {
          const f = path.join(OUT, `${tag}-${scene}.png`);
          /* WAIT FOR THE FRAME THE SCENE ASKED FOR.
             A ceremony can take the frame between the drive and the shutter —
             a rank rite and a chapter plate both fire off the same seals these
             scenes produce — and everything the scene raised stands down under
             one. Nothing is lost by waiting: src/kit/kit.js re-queues the grant
             card, src/kit/ledger.js was not spending a row's life while it was
             hidden, and a photograph of a letterbox is not the frame this gate
             exists to take. */
          if (wants.length) {
            for (let i = 0; i < 44; i++) {
              const t2 = await page.evaluate(() => window.__transAudit());
              const ids = t2.up.map((u) => u.id);
              if (!t2.owner && wants.every((w) => ids.includes(w))) break;
              await page.waitForTimeout(500);
            }
            await page.waitForTimeout(300);
          }
          /* MEASURE FIRST, PHOTOGRAPH SECOND. A screenshot at
             deviceScaleFactor 2 is a 3200x1800 PNG and takes the better part of
             a second — long enough that a 1800 ms notice photographed first is
             a notice already half retired by the time it is measured. The audit
             is the assertion; the picture is the evidence for it. */
          const land = await page.evaluate(() => window.__landAudit());
          const tr = await page.evaluate(() => window.__transAudit());
          /* THE GHOST TEST IS A TEST ABOUT TIME, SO IT TAKES TWO READINGS.
             Every surface here fades in and out, and a single reading during a
             fade calls a working transition a ghost. A second reading 260 ms
             later says which it was: a fade has moved, and a surface that has
             SETTLED between 2% and 90% is grey text somebody has to read. */
          await page.waitForTimeout(260);
          const tr2 = await page.evaluate(() => window.__transAudit());
          const still = new Map(tr2.ghosts.map((g) => [g.id, g.op]));
          tr.ghosts = tr.ghosts.filter((g) => still.has(g.id)
            && Math.abs(still.get(g.id) - g.op) < 0.08);
          await page.screenshot({ path: f });
          const row = { vp: vp.name, loc, notch, inset: inset.name || 'flat', scene,
            clipped: land.clipped, outside: land.outside, overlaps: land.overlaps,
            silent: land.silent, inSafe: land.inSafe,
            up: tr.up.map((s) => s.id), ghosts: tr.ghosts, pairs: tr.pairs,
            stack: tr.stack, clashes: tr.slots?.clashes || [], yielded: tr.slots?.yielded || [],
            owner: tr.owner, shot: f };
          /* DID THE EVENT ACTUALLY RAISE ANYTHING?
             A scene that photographs a HUD with none of its own surfaces on it
             is not a clean frame, it is a blind one — and a matrix of blind
             frames reporting 288 of 288 is how all three of these defects
             shipped. Missing what the scene exists to raise fails the frame,
             unless a ceremony owns it, which hides them on purpose. */
          for (const id of row.up) raised.add(id);
          const missing = tr.owner ? [] : wants.filter((w) => !row.up.includes(w));
          row.missing = missing;
          rows.push(row);
          const bad = mode === 'arrival'
            ? tr.ghosts.length + missing.length
            : land.clipped.length + land.outside.length + land.overlaps.length
              + land.silent.length + (notch ? land.inSafe.length : 0)
              + tr.ghosts.length + tr.pairs.length + tr.stack.length
              + (tr.slots?.clashes?.length || 0) + missing.length;
          if (bad) failures.push(row);
          console.log(`  ${bad ? 'FAIL' : ' ok '}  ${tag.padEnd(22)} ${scene.padEnd(12)} `
            + `clip:${land.clipped.length} out:${land.outside.length} lap:${land.overlaps.length} `
            + `ghost:${tr.ghosts.length} pair:${tr.pairs.length} stack:${tr.stack.length} `
            + `clash:${tr.slots?.clashes?.length || 0}  [${row.up.join(' ')}]`
            + (tr.owner ? `  under:${tr.owner}` : '')
            + (missing.length ? `  MISSING:${missing.join(',')}` : ''));
          for (const g of tr.ghosts) console.log(`         ghost ${g.id} at ${g.op}  "${g.text}"`);
          for (const p of tr.pairs) console.log(`         pair  ${p.a} x ${p.b}  ${p.w}x${p.h}px at ${p.at}  "${p.ta}" / "${p.tb}"`);
          for (const s of tr.stack) console.log(`         stack ledger over the strip by ${s.over}px  "${s.text}"`);
          for (const c of (tr.slots?.clashes || [])) console.log(`         clash ${c.a} x ${c.b} (neither may yield)`);
          for (const o of land.overlaps.slice(0, 4)) console.log(`         lap   ${o.a} x ${o.b}  ${o.w}x${o.h}px`);
          for (const o of land.outside.slice(0, 4)) console.log(`         out   ${o.sel}  ${o.edge} by ${o.by}px  "${o.text}"`);
          for (const c of land.clipped.slice(0, 4)) console.log(`         clip  ${c.sel}  ${c.what}`);
          for (const o of (notch ? land.inSafe : []).slice(0, 3)) console.log(`         safe  ${o.sel}  ${o.edge} by ${o.by}px`);
          return { land, tr };
        };

        for (const s of SCENES) {
          await settle(page);
          await s.run(page, { long: LONG[loc] });
          await check(s.name, s.wants);
          if (s.also) {
            /* THE GHOST TEST, WHICH IS A TEST ABOUT TIME.
               A notice fades in. What the critic photographed was that fade —
               three frames running, all of them grey. So the notice is
               photographed 140 ms after it is asked for, which is inside the
               old 300 ms fade and outside the new 120 ms one, and it has to be
               readable in that frame. */
            await s.also(page);
            await page.waitForTimeout(140);
            await check(s.name + '-mid', s.wants, 'arrival');
            /* Asked for again, then read once it has settled. Re-issuing is
               deliberate: an identical notice while one is up must refresh its
               clock rather than queue a second copy (src/ui/hud.js), and a
               screenshot at deviceScaleFactor 2 takes long enough that a
               single 1800 ms notice would otherwise have retired by now. */
            await s.also(page);
            await page.waitForTimeout(400);
            await check(s.name + '-set', s.wants);
          }
        }
        const never = MUST_RAISE.filter((id) => !raised.has(id));
        if (never.length) {
          console.log(`  FAIL  ${tag.padEnd(22)} ${'(coverage)'.padEnd(12)} never on screen: ${never.join(', ')}`);
          failures.push({ vp: vp.name, loc, notch, scene: 'coverage', never });
          rows.push({ vp: vp.name, loc, notch, inset: inset.name || 'flat', scene: 'coverage', never,
            clipped: [], outside: [], overlaps: [], silent: [], inSafe: [],
            up: [...raised], ghosts: [], pairs: [], stack: [], clashes: [], yielded: [] });
        } else {
          console.log(`   ok   ${tag.padEnd(22)} ${'(coverage)'.padEnd(12)} every transient surface was raised`);
        }
      } catch (e) {
        console.log(`  FAIL  ${tag.padEnd(22)} ${'(drive)'.padEnd(12)} ${e.message.split('\n')[0]}`);
        failures.push({ vp: vp.name, loc, notch, scene: 'drive', error: e.message });
      }

      await ctx.close();
    }
  }
}

await writeFile(path.join(OUT, 'transient.json'),
  JSON.stringify({ url: URL, sizes: SIZES, locales: LOCALES, rows, errors }, null, 2));

console.log(`\nshots -> ${OUT}`);
console.log(`${rows.length - failures.length}/${rows.length} transient frames clean, ${errors.length} console errors`);
if (failures.length) {
  console.log('\nFRAMES WITH A DEFECT:');
  for (const f of failures) console.log(`  - ${f.vp} ${f.loc}${f.notch ? ' ' + f.inset : ''} ${f.scene}`);
}
errors.slice(0, 10).forEach((e) => console.log('  ! ' + e));

await browser.close();
process.exit(failures.length || errors.length ? 1 : 0);
