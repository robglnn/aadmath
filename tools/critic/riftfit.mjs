/**
 * CAN THE ITEM BE ANSWERED — on a phone, on a Chromebook, on a laptop.
 *
 * A learning item that cannot be answered is not a layout defect, it is a
 * missing feature. At 414×896 a fixed-height echo scroller took 52 px off
 * `.rf-stage`, which sliced the "0" key in half and pushed SET off the bottom
 * of the glass, so a keypad item had no way to be completed at all. A player
 * on a phone was simply stuck.
 *
 * A screenshot cannot prove the absence of that, because the thing that was
 * wrong was *off* the picture. So this asserts it, in the running game, across
 * every viewport × every modality × the trace dug to full depth:
 *
 *   A. NOTHING IS CUT. For every box the rig itself owns — `.rift`, `.rf-*`,
 *      `.fld-*`, `.bal-*`, `.ans` — `scrollHeight` may not exceed
 *      `clientHeight`, nor `scrollWidth` `clientWidth`. Declared scrollers are
 *      exempt (a scroller is a choice); KaTeX's internal typesetting boxes and
 *      its hidden MathML mirror are not the rig's boxes and are skipped —
 *      what matters is whether the rig's *container* can hold what KaTeX put
 *      in it, and that is measured on the container.
 *
 *   B. THE ANSWER CAN BE GIVEN. The control that ends the turn — SET on the
 *      keypad, a reading on a choice, a move on the beam, a chip on the sort
 *      and area fields — exists, sits wholly inside the viewport, is the
 *      topmost element at its own centre, and a real Playwright click on it
 *      actually registers.
 *
 *   node tools/critic/riftfit.mjs [--url http://127.0.0.1:4711] [--out shots/riftfit] [--loc en]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4711');
const OUT = path.resolve(arg('out', 'shots/riftfit'));
const LOC = arg('loc', 'en');
await mkdir(OUT, { recursive: true });

const VIEWPORTS = [
  { name: '414x896', w: 414, h: 896, touch: true },
  { name: '390x844', w: 390, h: 844, touch: true },
  { name: '1280x720', w: 1280, h: 720, touch: false },
  { name: '1600x900', w: 1600, h: 900, touch: false },
];

const MODES = ['keypad', 'balance', 'sort', 'area', 'choice'];

/** The control that ends the turn, per modality. */
const COMMIT = {
  keypad: '.rf-key.commit',
  choice: '.ans:not([disabled])',
  balance: '.rf-move:not([disabled])',
  sort: '.rf-chip:not([disabled])',
  area: '.rf-chip:not([disabled])',
};

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--disable-gpu-vsync'],
});

// ---------------------------------------------------------------------------
// Which item form puts which surface up. Asked of the real generator bank and
// the real panel rather than guessed, because the modality is chosen by the
// *shape of the item*, not by its skill — `distribute` is an area field only
// when the form it drew has an area figure in it.
// ---------------------------------------------------------------------------
async function discover(page) {
  return page.evaluate(async (modes) => {
    const a = window.__ascent;
    const want = new Set(modes);
    const found = {};
    for (const [skill, forms] of Object.entries(a.formsBySkill)) {
      for (const f of forms) {
        if (!want.size) break;
        for (const d of [3, 5]) {
          if (d < f.dMin || d > f.dMax) continue;
          let mode;
          try {
            a.showItem(skill, { difficulty: d, seed: 4711, form: f.id });
            mode = a.panel.mode;
          } catch { continue; }
          if (want.has(mode)) {
            found[mode] = { skill, form: f.id, difficulty: d };
            want.delete(mode);
          }
          break;
        }
      }
      if (!want.size) break;
    }
    a.panel.close?.();
    return found;
  }, MODES);
}

const fails = [];
const rows = [];
const consoleErrors = [];
let plan = null;

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: 2,
    isMobile: vp.touch,
    hasTouch: vp.touch,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => consoleErrors.push(`${vp.name} pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`${vp.name} ${m.text()}`); });
  await ctx.addInitScript((l) => { try { localStorage.setItem('ascent.locale', l); } catch { /* */ } }, LOC);
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 45000 });
  await page.evaluate(() => document.getElementById('boot')?.classList.add('gone'));
  await page.waitForTimeout(800);

  if (!plan) {
    plan = await discover(page);
    console.log('surfaces under test: ' + JSON.stringify(plan) + '\n');
    const missing = MODES.filter((m) => !plan[m]);
    if (missing.length) console.log('!! no form found for: ' + missing.join(', '));
    await page.waitForTimeout(400);
  }

  for (const mode of MODES) {
    const spec = plan[mode];
    if (!spec) continue;

    await page.evaluate(async (s) => {
      const a = window.__ascent;
      a.panel.close?.();
      await new Promise((r) => setTimeout(r, 280));
      a.showItem(s.skill, { difficulty: s.difficulty, seed: 4711, form: s.form });
    }, spec);
    await page.waitForTimeout(600);
    const got = await page.evaluate(() => window.__ascent.panel.mode);

    // Full depth: answer wrong, then dig every remaining rung of the trace out.
    await page.evaluate(() => window.__ascent.panel.demo('wrong'));
    await page.waitForTimeout(750);
    const tier = await page.evaluate(async () => {
      for (let i = 0; i < 6; i++) {
        const btn = document.querySelector('#rf-hint');
        if (!btn || btn.disabled) break;
        btn.click();
        await new Promise((r) => setTimeout(r, 420));
      }
      return window.__ascent.panel.echoTier;
    });
    await page.waitForTimeout(800);

    const tag = `${vp.name}-${got}`;
    await page.screenshot({ path: path.join(OUT, `${tag}.png`) });

    const probe = await page.evaluate((sel) => {
      const rf = document.querySelector('.rift');
      if (!rf) return { error: 'the panel is not on screen' };

      const name = (el) => (el.id ? '#' + el.id
        : '.' + String(el.className || el.tagName).trim().split(/\s+/).slice(0, 2).join('.'));
      const px = (v) => (parseFloat(v) || 0);

      // A box can only cut something if it CLIPS. `overflow: visible` overflows
      // by design and hides nothing — the balance pan's rim deliberately hangs
      // 8 px past the pan on each side, and reporting that as a defect is how a
      // gate teaches people to ignore it. A declared scroller is a choice too:
      // content past the fold is reachable. So the only boxes that can be
      // guilty are the ones whose overflow is `hidden` or `clip`.
      const CLIPS = new Set(['hidden', 'clip']);
      const clippers = [];
      for (const el of [rf, ...rf.querySelectorAll('*')]) {
        if (!(el instanceof HTMLElement)) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        if (!CLIPS.has(cs.overflowX) && !CLIPS.has(cs.overflowY)) continue;
        const r = el.getBoundingClientRect();
        // the clip box: the padding box, grown by whatever clip margin was
        // granted, and only on the axes that actually clip
        const m = px(cs.overflowClipMargin);
        const bl = px(cs.borderLeftWidth), bt = px(cs.borderTopWidth);
        const box = {
          left: r.left + bl, top: r.top + bt,
          right: r.left + bl + el.clientWidth, bottom: r.top + bt + el.clientHeight,
        };
        clippers.push({
          el,
          x: CLIPS.has(cs.overflowX) ? { lo: box.left - m, hi: box.right + m } : null,
          y: CLIPS.has(cs.overflowY) ? { lo: box.top - m, hi: box.bottom + m } : null,
          over: { y: el.scrollHeight - el.clientHeight, x: el.scrollWidth - el.clientWidth },
        });
      }

      /** Does this node carry something a learner has to read or press? */
      const matters = (el) => {
        if (el.matches('button, input, select, textarea, [role="button"]')) return true;
        if (el.getAttribute('aria-hidden') === 'true') return false;
        // its OWN text, not a descendant's — otherwise every ancestor qualifies
        for (const n of el.childNodes) {
          if (n.nodeType === 3 && n.textContent.trim()) return true;
        }
        return false;
      };

      const cut = [];
      for (const el of rf.querySelectorAll('*')) {
        if (!(el instanceof HTMLElement) || !matters(el)) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (!r.width && !r.height) continue;
        // KaTeX hides its MathML mirror with a 1px clip rect; it is not ink.
        if (el.closest('.katex-mathml, .sr-only, [aria-hidden="true"]')) continue;
        for (const c of clippers) {
          if (c.el === el || !c.el.contains(el)) continue;
          const outY = c.y ? Math.max(c.y.lo - r.top, r.bottom - c.y.hi) : -1;
          const outX = c.x ? Math.max(c.x.lo - r.left, r.right - c.x.hi) : -1;
          if (outY > 1 || outX > 1) {
            cut.push({
              sel: name(el), clipper: name(c.el),
              axis: outY > 1 ? 'y' : 'x', over: Math.round(Math.max(outY, outX)),
              clipperOverflow: c.over,
              text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
            });
            break;
          }
        }
      }

      const commit = document.querySelector(sel);
      let set = { present: false, selector: sel };
      if (commit) {
        const r = commit.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        set = {
          present: true, selector: sel,
          label: (commit.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24),
          rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
          inViewport: r.top >= -0.5 && r.left >= -0.5
            && r.bottom <= innerHeight + 0.5 && r.right <= innerWidth + 0.5
            && r.width > 8 && r.height > 8,
          onTop: !!hit && (hit === commit || commit.contains(hit) || hit.contains(commit)),
          // when it is not on top, say what is — "something covers it" is not a
          // bug report
          covering: hit && !(hit === commit || commit.contains(hit) || hit.contains(commit))
            ? document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2)
              .slice(0, 4).map((e) => name(e) + '[z=' + getComputedStyle(e).zIndex + ']')
            : null,
          disabled: !!commit.disabled,
        };
      }
      const stage = document.querySelector('.rf-stage');
      return { cut, set, stageH: stage ? Math.round(stage.getBoundingClientRect().height) : null,
        classes: rf.className };
    }, COMMIT[got] || COMMIT[mode]);

    // A rectangle is not a hit test: press it the way a thumb would.
    let click = { tried: false };
    if (probe.set?.present) {
      // Stamp the exact node, so "did anything happen" can be asked of the
      // thing that was pressed rather than of the panel in general — the echo
      // is animating and would answer yes to almost anything.
      const state = () => page.evaluate(() => {
        const el = document.querySelector('[data-fitprobe]');
        return {
          entry: window.__ascent.panel.lastEntry,
          open: window.__ascent.panel.open,
          sealing: !!document.querySelector('.rift.sealing, .rift.stable'),
          cls: el ? el.className : null,
          parent: el && el.parentElement ? el.parentElement.className : null,
          placed: document.querySelectorAll('.rf-bay .rf-chip, .fld-cell .rf-chip').length,
          work: document.querySelector('#rf-work')?.innerHTML.length || 0,
        };
      });
      await page.evaluate((sel) => {
        document.querySelectorAll('[data-fitprobe]').forEach((e) => e.removeAttribute('data-fitprobe'));
        document.querySelector(sel)?.setAttribute('data-fitprobe', '1');
      }, probe.set.selector);
      const before = await state();
      const el = await page.$(probe.set.selector);
      try {
        await el.click({ timeout: 3500 });
        await page.waitForTimeout(600);
        // Sort and area are answered with two presses, not one: take a chip,
        // then the bay it belongs in. Pressing only the chip and calling the
        // surface unanswerable would be the harness failing to play the game.
        const second = { sort: '.rf-bay', area: '.fld-cell, .rf-bay' }[got];
        if (second) {
          const b = await page.$(second);
          if (b) { await b.click({ timeout: 3500 }); await page.waitForTimeout(500); }
        }
        const after = await state();
        click = {
          tried: true,
          landed: after.entry !== before.entry || after.cls !== before.cls
            || after.parent !== before.parent || after.placed !== before.placed
            || after.work !== before.work || after.sealing || !after.open,
          before, after,
        };
      } catch (e) { click = { tried: true, landed: false, err: String(e).split('\n')[0] }; }
    }

    const ok = !probe.error && probe.cut.length === 0
      && probe.set.present && probe.set.inViewport && probe.set.onTop && !probe.set.disabled
      && click.landed === true;
    rows.push({ viewport: vp.name, mode: got, wanted: mode, tier, ok, ...probe, click });
    if (!ok) fails.push({ viewport: vp.name, mode: got, tier, probe, click });
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${vp.name.padEnd(9)} ${String(got).padEnd(8)} tier=${tier} ` +
      `cut=${probe.cut?.length ?? '-'} ${probe.set.present ? probe.set.selector : 'COMMIT MISSING'}` +
      `${probe.set.present ? ` at ${probe.set.rect.join(',')} inView=${probe.set.inViewport} onTop=${probe.set.onTop}` : ''}` +
      ` click=${click.landed}`);
    for (const x of (probe.cut || []).slice(0, 8)) {
      console.log(`        cut ${x.sel} ${x.axis} +${x.over}px past ${x.clipper} "${x.text}"`);
    }
  }
  await ctx.close();
}
await browser.close();

await writeFile(path.join(OUT, 'riftfit.json'), JSON.stringify({ plan, rows, fails, consoleErrors }, null, 2));
console.log(`\n${rows.length} cases, ${fails.length} failing. console errors: ${consoleErrors.length}`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 8).join('\n'));
process.exit(fails.length || consoleErrors.length ? 1 : 0);
