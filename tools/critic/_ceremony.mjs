/**
 * THE ENDING, WITH AND WITHOUT A PROMOTION.
 *
 * A run can end two ways and the difference is not cosmetic: if the last clean
 * answer of the session also bought a rank, the game used to try to play two
 * full-screen ceremonies at once — the rank rite fired 0.45 s after the close
 * card opened and sat *under* it, and since both surfaces are deliberately type
 * over a semi-transparent dim (the world stays in the frame), neither hid the
 * other. GOLD printed through the résumé.
 *
 * So this drives the real engine to both endings and asserts, on a timeline
 * rather than at one settled moment, that only one ceremony is ever up and that
 * no two lines of text ever intersect. The timeline matters: the collision used
 * to appear at close + 0.5 s and clear itself at close + 5.7 s, so a probe that
 * looked once, late, saw nothing wrong.
 *
 * Nothing here is posed. The promotion is bought by answering a real item in a
 * real tear with the learner's standing one clean seal short of the next rank —
 * which is exactly the situation the defect needs, and exactly how a player
 * meets it.
 *
 *   tools/critic/frozen.sh tools/critic/_ceremony.mjs --out shots/ceremony
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LAYERS, COMPANIONS, FRAME_PROBE, reportFrame } from './_frame.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4831');
const OUT = arg('out', null);
const ONLY = arg('only', null);
const SIZES = [[1280, 720], [1600, 900], [414, 896], [390, 844]];
const LOCALES = ['en', 'es', 'pl'];
/** When the close card is sampled, in seconds after the run ends. */
const BEATS = [0.9, 1.8, 3.0, 4.6, 6.2];
/** The one that gets photographed: past every entry animation, inside the old
    rite's 5.2 s life, so a regression is in the picture and not only in a log. */
const SHOT_AT = 1.8;

if (OUT) await mkdir(path.resolve(OUT), { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const errors = [];
let checks = 0; let fails = 0;
const missed = [];

const GROUPS = [
  { touch: false, sizes: SIZES.filter(([w]) => w >= 700) },
  { touch: true, sizes: SIZES.filter(([w]) => w < 700) },
];

for (const group of GROUPS) {
  if (!group.sizes.length) continue;
  let ctx = null; let page = null;
  for (const [W, H] of group.sizes) {
    for (const loc of LOCALES) {
      const tag = `${W}x${H}-${loc}`;
      if (ONLY && !tag.includes(ONLY)) continue;
      if (!ctx) {
        ctx = await browser.newContext({
          viewport: { width: W, height: H }, deviceScaleFactor: 2,
          hasTouch: group.touch, isMobile: group.touch,
        });
        page = await ctx.newPage();
        page.setDefaultTimeout(45000);
        page.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag} console: ${m.text()}`); });
        page.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e.message}\n${(e.stack || '').split('\n').slice(0, 4).join('\n')}`));
      }
      await page.setViewportSize({ width: W, height: H });

      const ev = async (fn, ms = 30000, a = undefined) => {
        let timer;
        const out = await Promise.race([
          page.evaluate(fn, a),
          new Promise((r) => { timer = setTimeout(() => r('__timeout__'), ms); }),
        ]);
        clearTimeout(timer);
        if (out === '__timeout__') errors.push(`${tag}: drive step timed out: ${String(fn).slice(0, 70)}`);
        return out;
      };
      const frame = () => page.evaluate(
        new Function('cfg', `return (${FRAME_PROBE})(cfg)`),
        { layers: LAYERS, extra: COMPANIONS, scope: null },
      );
      const check = async (label, shot) => {
        checks++;
        const r = await frame();
        if (!reportFrame(`${tag} ${label}`, r)) { fails++; missed.push(`${tag} ${label}`); }
        if (OUT && shot) await page.screenshot({ path: path.join(path.resolve(OUT), `${tag}-${shot}.png`) });
        return r;
      };

      if (page.url() === 'about:blank') {
        await page.goto(URL, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => !!window.__ascent);
      }
      // A clean slate every time: no carried rank, no carried run, the locale
      // set the way the language pill sets it.
      await page.evaluate((l) => {
        window.__ascent.session.reset();
        window.__ascent.story.reset();
        localStorage.removeItem('ascent.save');
        localStorage.setItem('ascent.locale', l);
      }, loc);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForFunction(() => !!window.__ascent);
      await page.waitForTimeout(1500);

      for (const promo of [false, true]) {
        const kind = promo ? 'promo' : 'plain';
        // --- a real run, from the orders card ------------------------------
        await ev(() => {
          const s = window.__ascent.session;
          s.resolution.hide(); s.rest.hide(); s.charter.hide?.();
          s.reset(); s.plan();
        });
        await page.waitForFunction(() => window.__ascent.session.state().phase === 'charter', null, { timeout: 60000 });
        await page.waitForTimeout(1600);
        await page.locator('.sc-go').click();
        await page.waitForTimeout(1200);

        /* Stand the learner one clean seal short of the next rank, using the
           same ledger a clean seal writes to. The promotion itself is then
           bought by the answer, not by the harness. */
        let standing = null;
        if (promo) {
          standing = await ev(() => {
            const st = window.__ascent.story;
            for (let i = 0; i < 40 && st.state().toNext > 3; i++) st.grant(1);
            return st.state();
          });
          if (standing.toNext > 3) errors.push(`${tag}: could not stage a promotion (toNext=${standing.toNext})`);
        }

        // Real work in a real tear: one item, answered.
        await ev(() => { window.__ascent.openRiftById('var-meaning'); });
        await page.waitForTimeout(900);
        await ev((p) => { window.__ascent.panel.demo(p ? 'right' : 'wrong'); }, 30000, promo);
        await page.waitForTimeout(1200);
        const rankNow = await page.evaluate(() => window.__ascent.story.state().rank);
        await ev(() => { window.__ascent.panel.close(); });
        await page.waitForTimeout(350);

        // The run ends on that answer — the clock is wound, not the beat posed.
        await ev(() => { window.__ascent.session.chargeTo(24); window.__ascent.session.skipToClose(); });

        let waited = 0;
        for (const at of BEATS) {
          await page.waitForTimeout(Math.max(0, (at - waited) * 1000));
          waited = at;
          await check(`${kind} close +${at.toFixed(1)}s`, Math.abs(at - SHOT_AT) < 1e-6 ? `${kind}-close` : null);
        }
        if (OUT) await page.screenshot({ path: path.join(path.resolve(OUT), `${tag}-${kind}-close-settled.png`) });
        const said = await page.evaluate(() => ({
          rank: window.__ascent.story.state().rank,
          promoted: document.querySelector('.ses-close .sx-crest') ? !document.querySelector('.ses-close .sx-crest').hidden : null,
        }));
        console.log(`     · ${tag} ${kind}: rank at answer=${rankNow} → ${said.rank}, crest=${said.promoted}`);

        // The card scrolled to its foot — the shelf passes over every line.
        await page.evaluate(() => { const s = document.querySelector('.ses-close .sx-in'); if (s) s.scrollTop = s.scrollHeight; });
        await page.waitForTimeout(700);
        await check(`${kind} close@foot`, `${kind}-close-foot`);

        /* ---- CAN THIS PROBE STILL SEE THE DEFECT? -----------------------
           An assertion that passes because it stopped looking is worse than no
           assertion. So the rite is played straight onto the surface, past
           every piece of arbitration, exactly as it used to arrive on its own
           timer — and this check fails unless the probe reports two ceremonies
           AND text printing through text. The picture it takes is what the
           close beat looked like before this was fixed. */
        if (!promo) {
          await ev(() => { window.__ascent.story.rite.play(3, 2); });
          await page.waitForTimeout(1700);
          const r = await frame();
          checks++;
          const caught = r.live.length > 1 && r.hits.length > 0;
          if (caught) {
            console.log(`ok   ${tag} self-test: two ceremonies still read as a failure `
              + `(${r.live.map((l) => l.name).join(' + ')}, ${r.hits.length} intersections)`);
          } else {
            fails++; missed.push(`${tag} self-test`);
            console.log(`FAIL ${tag} self-test: the probe no longer catches a rite played over the close card`);
          }
          if (OUT) await page.screenshot({ path: path.join(path.resolve(OUT), `${tag}-selftest-two-ceremonies.png`) });
          await ev(() => { window.__ascent.story.rite.hide(); });
          await page.waitForTimeout(800);
          await check(`${kind} close after self-test`, null);
        }

        // …the break…
        await page.locator('.sx-rest').click();
        await page.waitForTimeout(1600);
        await check(`${kind} rest`, `${kind}-rest`);
        // …and the real last line.
        await page.locator('.sr-skip').click();
        await page.waitForTimeout(1400);
        await check(`${kind} rest-end`, `${kind}-rest-end`);
        await page.locator('.sr-off').click();
        await page.waitForTimeout(2400);
        await check(`${kind} sign-off`, `${kind}-signoff`);
        await ev(() => { window.__ascent.session.rest.hide(); });
        await page.waitForTimeout(600);
      }

      /* ---- SEQUENCED, NOT DELETED ---------------------------------------
         The other half of the rule. Making two ceremonies impossible is easy
         if you are willing to throw one away, and that would be a worse bug
         than the one being fixed: the promotion the learner earned would
         simply never be mentioned. So, in the world, with no session beat on
         screen, one answer that buys BOTH a rank and a chapter must produce
         the rite alone, and then the chapter plate alone, in that order, with
         neither ever sharing the frame. */
      /* A real reload, because `story.reset()` only clears the save: the rank
         and the seal ledger this page has already been driven through live in
         memory, and a cadet who is already Bronze cannot be promoted to it. */
      await ev(() => {
        const a = window.__ascent;
        a.session.resolution.hide(); a.session.rest.hide();
        a.session.reset(); a.story.reset();
        localStorage.removeItem('ascent.save');
      });
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForFunction(() => !!window.__ascent);
      await page.waitForTimeout(1500);
      await ev(() => { window.__ascent.session.plan(); });
      await page.waitForFunction(() => window.__ascent.session.state().phase === 'charter', null, { timeout: 60000 });
      await page.waitForTimeout(1400);
      await page.locator('.sc-go').click();
      await page.waitForTimeout(1000);
      await ev(() => {
        const st = window.__ascent.story;
        for (let i = 0; i < 40 && st.state().toNext > 3; i++) st.grant(1);
      });
      await ev(() => { window.__ascent.openRiftById('var-meaning'); });
      await page.waitForTimeout(900);
      await ev(() => { window.__ascent.panel.demo('right'); });
      await page.waitForTimeout(1000);
      await ev(() => { window.__ascent.panel.close(); });
      await page.waitForTimeout(800);   // past the tear's own .3 s fade

      /* Sampled densely rather than at four chosen moments: the whole claim is
         that the frame is never shared, and a claim about "never" is only worth
         what its sampling rate is. The chapter is turned deliberately *while
         the rite is on screen*, which is the collision that used to put a plate
         under a promotion. */
      const order = [];
      let bumped = false; let shotRite = false; let shotPlate = false;
      for (let i = 0; i < 20; i++) {
        const r = await frame();
        checks++;
        if (!reportFrame(`${tag} world t${i}`, r)) { fails++; missed.push(`${tag} world t${i}`); }
        const names = r.live.map((l) => l.name);
        if (names.length) order.push(...names);
        if (names.includes('rank rite')) {
          if (OUT && !shotRite) { shotRite = true; await page.screenshot({ path: path.join(path.resolve(OUT), `${tag}-world-rite.png`) }); }
          if (!bumped) { bumped = true; await ev(() => { window.__ascent.story.seal(4); }); }
        }
        if (OUT && !shotPlate && names.includes('chapter plate')) {
          shotPlate = true;
          await page.screenshot({ path: path.join(path.resolve(OUT), `${tag}-world-plate.png`) });
        }
        await page.waitForTimeout(600);
      }
      const dedup = order.filter((n, i) => n !== order[i - 1]);
      checks++;
      if (dedup.includes('rank rite') && dedup.includes('chapter plate')
        && dedup.indexOf('rank rite') < dedup.indexOf('chapter plate')) {
        console.log(`ok   ${tag} world: sequenced, not deleted — ${dedup.join(' → ')}`);
      } else {
        fails++; missed.push(`${tag} world sequence`);
        console.log(`FAIL ${tag} world: expected the rite then the plate, saw ${dedup.join(' → ') || 'nothing'}`);
      }

      /* ---- A TEAR OPENED DURING A PROMOTION -----------------------------
         The rite deliberately does not take the controls, so a cadet can walk
         into a tear in the middle of one — and the tear is the only surface in
         the game that can take the screen without asking src/meta first. The
         rite must give the frame up, and must not lose the promotion. */
      await ev(() => { window.__ascent.story.rite.play(3, 2); });
      await page.waitForTimeout(800);
      await ev(() => { window.__ascent.openRiftById('var-meaning'); });
      await page.waitForTimeout(1500);
      const t1 = await check('tear over a live rite', 'tear-over-rite');
      checks++;
      if (t1.live.length === 1 && t1.live[0].name === 'tear') {
        console.log(`ok   ${tag} tear over a live rite: the tear has the frame alone`);
      } else {
        fails++; missed.push(`${tag} tear over rite`);
        console.log(`FAIL ${tag} tear over a live rite: ${t1.live.map((l) => l.name).join(' + ') || 'nothing'}`);
      }
      await ev(() => { window.__ascent.panel.close(); });
      await page.waitForTimeout(2200);
      const t2 = await check('rite after the tear', 'rite-replayed');
      checks++;
      if (t2.live.some((l) => l.name === 'rank rite')) {
        console.log(`ok   ${tag} the promotion came back whole after the tear`);
      } else {
        fails++; missed.push(`${tag} rite not replayed`);
        console.log(`FAIL ${tag} the promotion did not come back: ${t2.live.map((l) => l.name).join(' + ') || 'nothing'}`);
      }
      await ev(() => { window.__ascent.story.rite.hide(); });
    }
  }
  await page?.close();
  await ctx?.close();
}

await browser.close();
console.log(`\n${checks - fails}/${checks} frame checks passed · console errors: ${errors.length}`);
for (const m of missed) console.log('  ✗ ' + m);
for (const e of errors.slice(0, 12)) console.log('  ! ' + e);
if (OUT) await writeFile(path.join(path.resolve(OUT), 'ceremony.json'), JSON.stringify({ checks, fails, missed, errors }, null, 2));
process.exit(fails || errors.length ? 1 : 0);
