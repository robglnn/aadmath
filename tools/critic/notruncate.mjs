/**
 * NO PLAYER-FACING TEXT IS EVER VISUALLY CLIPPED.
 *
 * WHY THIS EXISTS, TWICE.
 *
 * A player read Marlow's line off the glass and typed out where it stopped:
 *
 *   "No rush. Though I will point out that the sky is on fire, in a slow"
 *   "Walk in and it shows you a statemen"
 *
 * The second one stops in the middle of a word. That is not a sentence being
 * short, it is a box being short, and it happened on a desktop AND on a phone
 * in landscape. A previous pass fixed this exact class by moving a `max-height`
 * off the plate and onto the text column — src/ui/portrait.css still carries
 * the whole argument under the heading THE CAP THAT WAS NOT ONE — and the fix
 * was verified by looking at screenshots of the surfaces somebody remembered.
 *
 * Screenshots of remembered surfaces is how it came back. So this is not a
 * screenshot gate. It walks EVERY text node the player can see, asks the
 * browser itself whether the box it is in is big enough for it, and fails on
 * any answer of no. Nothing here knows the name of a single CSS class, so a
 * surface written next month is covered the day it ships.
 *
 * WHAT THIS ADDS TO `landscape.mjs`, WHICH ALREADY ASSERTS THIS
 *
 * `tools/critic/landscape.mjs` carries the same rule as its first assertion,
 * and it is a good rule. It also only ever runs it on a phone held sideways.
 * The player's report was of a truncation on a DESKTOP as well, which no
 * viewport in that harness covers, and of a line that only the companion
 * channel ever says, which no surface in that harness opens. So this gate is
 * the same measurement taken across the whole ladder of rooms, in all three
 * languages, with three things landscape.mjs does not do:
 *
 *   · it puts the LONGEST string in each locale's bundle through the real
 *     channel, rather than whatever the game happened to be saying;
 *   · it opens the learning rig on several forms of several skills at the top
 *     band with the worked echo out, which is the tallest that card ever gets;
 *   · it covers desktop and portrait, not only landscape.
 *
 * WHAT COUNTS AS CLIPPED
 *
 * An element that (a) contains real text, (b) is visible, and (c) hides its
 * overflow — `overflow: hidden`, `overflow: clip`, `text-overflow: ellipsis`
 * or `-webkit-line-clamp` — while its own content does not fit inside it. The
 * browser's `scrollHeight`/`scrollWidth` against `clientHeight`/`clientWidth`
 * is the measurement, because that is the browser saying, in its own words,
 * "there is more of this than I am showing".
 *
 * `overflow: auto` and `overflow: scroll` are NOT failures. Text that scrolls
 * is a decision the phone layouts make deliberately and defend in their own
 * comments; text that is cut off is not a decision at all.
 *
 * WHERE IT LOOKS
 *
 * Five viewports from a 320 px phone to a wide desktop, three locales, and
 * every surface that carries prose — the companion channel, the objective
 * card, the learning rig with its longest item, the echo, the foundry, the
 * menu, the pause card and the progress report. Marlow is additionally made to
 * say the LONGEST line in each locale's bundle, because the line that breaks a
 * box is never the line a builder happened to be looking at.
 *
 *   node tools/critic/notruncate.mjs --self-test
 *   node tools/critic/notruncate.mjs [--url ...] [--out shots/notruncate]
 *
 * Exit 0 = every word the game says can be read.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import EN from '../../src/i18n/en.js';
import ES from '../../src/i18n/es.js';
import PL from '../../src/i18n/pl.js';

/**
 * The longest sentences each locale can put on the glass.
 *
 * Read out of the shipping bundle rather than out of the game, because the
 * line that breaks a box is never the line the scheduler happens to pick — and
 * a Polish sentence is routinely 40% longer than the English one a builder was
 * looking at when they sized the box. Anything with a placeholder in it is
 * skipped: `{n}` on the glass is not a sentence, it is a bug in the harness.
 */
function longestOf(bundle, n = 4) {
  const out = [];
  const walk = (o, d) => {
    if (d > 8 || !o) return;
    for (const v of Object.values(o)) {
      if (typeof v === 'string') { if (!/[{}]/.test(v) && !/^</.test(v)) out.push(v); }
      else if (typeof v === 'object') walk(v, d + 1);
    }
  };
  walk(bundle, 0);
  return [...new Set(out)].sort((a, b) => b.length - a.length).slice(0, n);
}
const LONGEST = { en: longestOf(EN), es: longestOf(ES), pl: longestOf(PL) };

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const flag = (k) => process.argv.includes('--' + k);
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/notruncate'));
/* Narrow the sweep while chasing one box. The full sweep is the gate. */
const ONLY_ROOMS = (arg('rooms', '') || '').split(',').filter(Boolean);
const ONLY_LOCALES = (arg('locales', '') || '').split(',').filter(Boolean);
const SKILLS_N = Number(arg('skills', 4));
const FORMS_N = Number(arg('forms', 2));
const TOL = 1.5;              // px of slack, for sub-pixel layout rounding

/**
 * The scanner, as a string so it can be injected into a fixture page for the
 * self-test and into the real game for the run. One implementation, both.
 */
const SCANNER = `(TOL) => {
  const out = [];
  const CLIPS = /^(hidden|clip)$/;
  const SCROLLS = /^(auto|scroll)$/;
  const seen = new Set();
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walk.nextNode())) {
    const s = (n.nodeValue || '').replace(/\\s+/g, ' ').trim();
    if (s.length < 3) continue;
    const el = n.parentElement;
    if (!el || seen.has(el)) continue;
    // Never judge a box nobody is looking at.
    let hidden = false;
    for (let a = el; a; a = a.parentElement) {
      const c = getComputedStyle(a);
      if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05) { hidden = true; break; }
      if (a.hidden) { hidden = true; break; }
    }
    if (hidden) continue;
    seen.add(el);

    // Where this text's glyphs actually are. Ranges give the LINE boxes, which
    // stand a little taller than the ink, so the slack below is scaled to the
    // type rather than fixed: a 3 px allowance is generous at 12 px and mean at
    // 40 px, and the false positives all come from that.
    const rng = document.createRange();
    rng.selectNodeContents(n);
    const rects = [...rng.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
    if (!rects.length) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize) || 16;
    const slack = Math.max(TOL, fs * 0.35);

    // A SCROLLER ABOVE THE TEXT MEANS THE TEXT IS REACHABLE.
    // The standards column on a phone is a nowrap table inside \`overflow-x:
    // auto\` inside a document body with \`overflow-x: hidden\`. The words run
    // 1034 px past the body, and every one of them can be read by pushing the
    // table sideways — which is the layout doing its job, not eating a word. So
    // once an ancestor can scroll an axis, that axis is answered for.
    let vScrolled = false, hScrolled = false;
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
      const c = getComputedStyle(a);
      if (SCROLLS.test(c.overflowY) && a.scrollHeight > a.clientHeight + 1) vScrolled = true;
      if (SCROLLS.test(c.overflowX) && a.scrollWidth > a.clientWidth + 1) hScrolled = true;
      const clampsLines = c.webkitLineClamp && c.webkitLineClamp !== 'none';
      const ellipsis = c.textOverflow === 'ellipsis';
      const vClip = !vScrolled && (CLIPS.test(c.overflowY) || clampsLines);
      const hClip = !hScrolled && (CLIPS.test(c.overflowX) || ellipsis);
      if (!vClip && !hClip) continue;
      // THE SCREEN-READER-ONLY PATTERN IS NOT A TRUNCATION. KaTeX renders every
      // expression twice: once for the eye and once, in MathML, into a
      // one-pixel box with clipped overflow so a screen reader can read the
      // mathematics. Any clipping box shorter than a line of text is that
      // pattern rather than a surface somebody reads.
      if (a.clientHeight <= 4 || a.clientWidth <= 4) continue;

      // THE BOX HAS TO BE CUTTING *THIS* TEXT.
      //
      // Asking only whether the box overflows names the wrong culprit and then
      // the wrong fix: the rift panel's own \`overflow: hidden\` reports 227 px
      // of overflow on a phone, all of it a decorative particle layer hanging
      // off the bottom, while every word on the card is comfortably inside it.
      // So the question is asked about the glyphs: do THEY leave the box.
      const br = a.getBoundingClientRect();
      const top = br.top + (parseFloat(c.borderTopWidth) || 0);
      const bottom = br.bottom - (parseFloat(c.borderBottomWidth) || 0);
      const left = br.left + (parseFloat(c.borderLeftWidth) || 0);
      const right = br.right - (parseFloat(c.borderRightWidth) || 0);
      let overV = 0, overH = 0;
      for (const g of rects) {
        if (vClip) overV = Math.max(overV, g.bottom - bottom, top - g.top);
        if (hClip) overH = Math.max(overH, g.right - right, left - g.left);
      }
      if (overV > slack || overH > slack) {
        const id = (a.id ? '#' + a.id : '') + (a.className && typeof a.className === 'string'
          ? '.' + a.className.trim().split(/\\s+/).join('.') : '') || a.tagName;
        out.push({
          text: s.slice(0, 80),
          box: id,
          axis: overV > slack ? 'vertical' : 'horizontal',
          by: Math.round(Math.max(overV, overH)),
          shows: overV > slack ? a.clientHeight : a.clientWidth,
          needs: overV > slack ? a.scrollHeight : a.scrollWidth,
          why: clampsLines ? 'line-clamp' : ellipsis ? 'text-overflow: ellipsis'
            : 'overflow: ' + (overV > slack ? c.overflowY : c.overflowX),
        });
        break;
      }
    }
  }
  return out;
}`;

/**
 * THE SECOND KIND OF TRUNCATION: A BOX THAT FITS, AND A SENTENCE TAKEN AWAY.
 *
 * The SCANNER above measures boxes, and the two lines the player typed out are
 * not box defects at all:
 *
 *   "No rush. Though I will point out that the sky is on fire, in a slow"
 *   "Walk in and it shows you a statemen"
 *
 * The companion channel reveals a line one character at a time. Whatever it
 * had revealed at the instant something else wanted the channel — a chapter
 * turn, a run resolving, any urgent beat — was the whole of what the player
 * ever got, and the panel went dark on that character. `scrollWidth` equals
 * `clientWidth` the entire time, because the text node genuinely IS "…a
 * statemen". No box gate can see this, and that is exactly why it survived one.
 *
 * So this recorder watches the channel itself, every animation frame, and asks
 * the only question that matters: did a line ever leave the screen while it was
 * still a strict prefix of itself? It reads the live line off the channel's own
 * state, so it needs no list of sentences and covers a line written next month.
 */
const CUTWATCH = `(() => {
  const R = { cuts: [], frames: 0 };
  window.__cutwatch = R;
  let prev = null;
  const tick = () => {
    const el = document.querySelector('.meta-comms');
    const body = document.querySelector('.meta-comms .body');
    let cur = null;
    try { cur = window.__ascent.story.comms.cur; } catch {}
    const now = {
      showing: !!(el && el.classList.contains('show')),
      shown: body ? body.textContent : '',
      full: cur ? cur.text : null,
    };
    R.frames++;
    if (prev && prev.full && prev.showing && prev.shown.length < prev.full.length) {
      // The line that was mid-reveal a frame ago: is it still on screen, and
      // still the same line? Either answer of "no" means it was taken away
      // with words in it the player never saw.
      const gone = !now.showing || now.full !== prev.full;
      if (gone) {
        R.cuts.push({
          at: Math.round(performance.now()),
          shown: prev.shown, full: prev.full,
          missing: prev.full.length - prev.shown.length,
          became: now.full || (now.showing ? '(same line, blank)' : '(panel hidden)'),
        });
      }
    }
    prev = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})()`;

/**
 * Drive the barge-ins that used to cut a line in half, and report what the
 * recorder saw. Every one of these is a real path through the shipping code:
 * nothing is stubbed and nothing is faked — the only privilege taken is
 * choosing WHEN the interruption lands, which in a real session is chance.
 */
async function cutRun(page, locales) {
  const LONG = {
    en: 'That ring is a rift. Walk in and it shows you a statement. Make it true and the hole closes.',
    es: 'Ese anillo es una brecha. Entra y te muestra un enunciado. Hazlo verdadero y el hueco se cierra.',
    pl: 'Ten pierścień to wyrwa. Wejdź w niego, a pokaże ci zdanie. Spraw, by było prawdziwe, a dziura się zamknie.',
  };
  const found = [];
  for (const loc of locales) {
    await page.evaluate((l) => window.__ascent.setLocale(l), loc);
    await page.waitForTimeout(400);
    // Four interruptions, at four different points of the reveal, through the
    // two doors every barge-in in the game goes through.
    for (const [delay, how] of [[220, 'clear'], [520, 'clear'], [300, 'now'], [900, 'now']]) {
      await page.evaluate(() => { window.__cutwatch.cuts.length = 0; });
      await page.evaluate((tx) => {
        const c = window.__ascent.story.comms;
        c.queue.length = 0;
        c.clear();
        c.say(tx, { force: true, now: true });
      }, LONG[loc]);
      await page.waitForTimeout(delay);
      await page.evaluate((h) => {
        const c = window.__ascent.story.comms;
        if (h === 'clear') c.clear();
        else c.say('Interrupting.', { force: true, now: true });   // i18n-allow: critic-only probe string
      }, how);
      await page.waitForTimeout(1200);
      const cuts = await page.evaluate(() => window.__cutwatch.cuts.slice());
      for (const c of cuts) found.push({ loc, how, delay, ...c });
      // Let the channel drain so the next probe starts from silence.
      await page.evaluate(() => { const c = window.__ascent.story.comms; c.queue.length = 0; });
      await page.waitForTimeout(2800);
    }
  }
  return found;
}

// --------------------------------------------------------------- self-test
//
// A gate nobody has ever seen fail is a gate nobody has tested. This builds a
// page with one of each defect and one of each innocent case, and asserts the
// scanner names exactly the guilty ones.
if (flag('self-test')) {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 800, height: 600 } })).newPage();
  await p.setContent(`<!doctype html><meta charset="utf-8"><style>
    body { font: 16px/1.4 sans-serif; margin: 0; }
    div { width: 240px; margin: 8px; }
    .guilty-height { height: 20px; overflow: hidden; }
    .guilty-ellipsis { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .guilty-clamp { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
    .innocent-scroll { height: 20px; overflow-y: auto; }
    .innocent-fits { height: auto; overflow: hidden; }
    .innocent-invisible { height: 20px; overflow: hidden; display: none; }
    .innocent-sronly { position: absolute; width: 1px; height: 1px; overflow: hidden; }
  </style>
  <div class="guilty-height">A sentence far too long for twenty pixels of box to hold, cut off.</div>
  <div class="guilty-ellipsis">A single line far too long for two hundred and forty pixels of box.</div>
  <div class="guilty-clamp">A paragraph clamped to exactly one line of the several that it needs.</div>
  <div class="innocent-scroll">A sentence far too long for twenty pixels, but the player can scroll it.</div>
  <div class="innocent-fits">Short enough.</div>
  <div class="innocent-invisible">A sentence far too long for twenty pixels of box, and nobody can see it.</div>
  <div class="innocent-sronly">A screen-reader-only rendering, one pixel tall, exactly as KaTeX writes it.</div>`);
  const hits = await p.evaluate(`(${SCANNER})(${TOL})`);
  const boxes = hits.map((h) => h.box);
  const want = ['.guilty-height', '.guilty-ellipsis', '.guilty-clamp'];
  const notWant = ['.innocent-scroll', '.innocent-fits', '.innocent-invisible', '.innocent-sronly'];
  let bad = 0;
  for (const w of want) {
    const ok = boxes.includes(w);
    console.log(`${ok ? '  ok  ' : ' FAIL '} catches ${w}`);
    if (!ok) bad++;
  }
  for (const w of notWant) {
    const ok = !boxes.includes(w);
    console.log(`${ok ? '  ok  ' : ' FAIL '} does not accuse ${w}`);
    if (!ok) bad++;
  }
  await b.close();
  console.log(bad ? `\nself-test FAILED (${bad})` : '\nself-test passed');
  process.exit(bad ? 1 : 0);
}

// --------------------------------------------------------------------- run
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

/** The room sizes that matter, smallest first. */
const ROOMS = [
  ['phone-portrait', 390, 844, true],
  ['phone-portrait-small', 320, 640, true],
  ['phone-landscape', 844, 390, true],
  ['phone-landscape-short', 740, 360, true],
  ['laptop-narrow', 1024, 640, false],
  ['desktop', 1600, 900, false],
];

const findings = [];
/** Lines taken off the glass before the player had all of them. See CUTWATCH. */
const cutFindings = [];
/** Set when the cut recorder cannot even see a planted cut. */
let blindGate = false;
const shot = new Set();
let scans = 0;

for (const [room, w, h, touch] of ROOMS.filter((r) => !ONLY_ROOMS.length || ONLY_ROOMS.includes(r[0]))) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h }, deviceScaleFactor: 2,
    hasTouch: touch, isMobile: touch,
  });
  const page = await ctx.newPage();
  // Installed before a line of the game has run, and it survives the reload
  // below, so no frame of the companion channel goes unwatched.
  await page.addInitScript(CUTWATCH);
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
  await page.waitForTimeout(4500);

  const scan = async (where) => {
    scans++;
    const hits = await page.evaluate(`(${SCANNER})(${TOL})`);
    if (!hits.length) return;
    for (const x of hits) findings.push({ room, where, ...x });
    // One picture per guilty box per room is evidence; two hundred pictures of
    // the same box is a full disk. The JSON keeps every finding regardless.
    const key = `${room}|${hits[0].box}`;
    if (shot.has(key)) return;
    shot.add(key);
    await page.screenshot({ path: path.join(OUT, `${room}-${where}.png`.replace(/[^\w.-]/g, '_')) })
      .catch(() => {});
  };

  for (const loc of (ONLY_LOCALES.length ? ONLY_LOCALES : ['en', 'es', 'pl'])) {
    await page.evaluate((l) => window.__ascent.setLocale(l), loc);
    await page.waitForTimeout(500);

    // ---- 1. the companion, saying the longest thing she can say -----------
    //
    // Reading the bundle for the longest string and putting it through the
    // real channel is the only version of this test that cannot be fooled by
    // whichever line the scheduler happened to pick. Nothing is faked: the
    // words come out of the shipping bundle and go through `comms.say`, which
    // is the method every narrative beat in the game calls.
    const lines = LONGEST[loc].concat([
      'No rush. Though I will point out that the sky is on fire, in a slow, dignified, nine-hundred-year sort of way.',
      'That ring is a rift. Walk in and it shows you a statement. Make it true and the hole closes.',
      'Cipher motes: loose lattice, where the ground bled. Run through them. The foundry buys kit with them.',
    ]);
    for (let i = 0; i < lines.length; i++) {
      await page.evaluate((tx) => {
        const c = window.__ascent.story.comms;
        c.queue.length = 0;
        c.say(tx, { force: true, now: true });
      }, lines[i]);
      await page.waitForTimeout(2600);
      await scan(`${loc}-marlow-${i}`);
      // …and the other channel the same words can land in.
      await page.evaluate((tx) => window.__ascent.hud.say(tx, 6000), lines[i]);
      await page.waitForTimeout(400);
      await scan(`${loc}-subtitle-${i}`);
    }

    // ---- 2. the learning rig, holding the tallest item each skill has -----
    const skills = await page.evaluate((n) => window.__ascent.skillIds.slice(0, n), SKILLS_N);
    for (const skill of skills) {
      const forms = await page.evaluate((s) => (window.__ascent.formsBySkill[s] || []).map((f) => f.id), skill)
        .catch(() => []);
      for (const form of (forms.length ? forms : [null]).slice(0, FORMS_N)) {
        const opened = await page.evaluate(([s, f]) => {
          try { return window.__ascent.openRiftById(s, f ? { form: f, difficulty: 5, scaffold: 'full' } : { difficulty: 5, scaffold: 'full' }); }
          catch { return false; }
        }, [skill, form]);
        if (!opened) continue;
        await page.waitForTimeout(700);
        await scan(`${loc}-rift-${skill}-${form || 'any'}`);
        // …and with the worked echo open beside it, which is the tallest this
        // card ever gets and the state the rig re-cuts itself for.
        const hint = await page.$('#rf-hint');
        if (hint && await hint.isVisible().catch(() => false)) {
          await hint.click().catch(() => {});
          await page.waitForTimeout(600);
          await scan(`${loc}-echo-${skill}-${form || 'any'}`);
        }
        await page.keyboard.press('Escape');
        await page.waitForTimeout(250);
      }
    }

    // ---- 3. every other surface that carries prose ------------------------
    const surfaces = [
      ['menu', () => window.__ascent.menu.show()],
      ['report', () => window.__ascent.report.show()],
      ['teacher', () => { window.__ascent.report.show(); window.__ascent.report.teacher.show(); }],
      ['foundry', () => window.__ascent.kit.foundry.open()],
      // The bare HUD: the objective card, the run band, the kit strip and the
      // notice slot, with nothing on top of them.
      ['hud', () => {}, false],
    ];
    for (const [name, open, closes = true] of surfaces) {
      await page.evaluate(open).catch(() => {});
      await page.waitForTimeout(600);
      await scan(`${loc}-${name}`);
      // Escape is the pause key. Pressing it on the bare HUD would OPEN the
      // menu rather than close anything, and the next scan would photograph it.
      //
      // And Escape does not reach the teacher record at all: it is its own
      // document over the report, with its own close button. Left open it rode
      // into every later scan and got them all blamed on whatever surface the
      // harness thought it was looking at — which is a harness telling you
      // about its own bug in the voice of the game.
      if (closes) {
        for (let i = 0; i < 4; i++) {
          const gone = await page.evaluate(() => {
            const doc = document.querySelector('.rp-doc-host.show');
            if (doc) { doc.querySelector('.rp-doc-x')?.click(); return false; }
            return !window.__ascent.input.uiOpen && !document.querySelector('.rp-card.show, .mnu.show, .fdy.show');
          });
          if (gone) break;
          await page.keyboard.press('Escape');
          await page.waitForTimeout(320);
        }
      }
    }
    /* ---- 4. the companion channel, interrupted ---------------------------
       Layout-independent, so it is measured once rather than six times — but
       it is measured on the desktop frame, because the desktop is where the
       player read the half sentence. */
    if (room === 'desktop') {
      /* THE INSTRUMENT IS PROVED BEFORE IT IS BELIEVED.
         `_finish()` mid-reveal is exactly what the shipping code used to do,
         and it is the defect in one line. If the recorder cannot see that, it
         cannot see anything, and a silent pass here would mean nothing. */
      await page.evaluate((tx) => {
        const c = window.__ascent.story.comms;
        c.queue.length = 0; c.clear();
        c.say(tx, { force: true, now: true });
        // i18n-allow: a critic-only probe, never rendered in a real session.
      }, 'A deliberately planted cut, written long enough that the typewriter cannot possibly have finished revealing all of it yet.');
      await page.waitForTimeout(400);
      await page.evaluate(() => { window.__cutwatch.cuts.length = 0; });
      await page.evaluate(() => window.__ascent.story.comms._finish());
      await page.waitForTimeout(300);
      const planted = await page.evaluate(() => window.__cutwatch.cuts.length);
      console.log(`${planted ? '  ok  ' : ' FAIL '} self-test: a planted mid-word cut is caught`);
      if (!planted) blindGate = true;
      await page.waitForTimeout(600);

      const cuts = await cutRun(page, ONLY_LOCALES.length ? ONLY_LOCALES : ['en', 'es', 'pl']);
      for (const c of cuts) cutFindings.push(c);
    }
  }
  await ctx.close();
}
await browser.close();

// ------------------------------------------------------------------ verdict
const byBox = new Map();
for (const f of findings) {
  const k = `${f.box} (${f.why})`;
  if (!byBox.has(k)) byBox.set(k, []);
  byBox.get(k).push(f);
}
console.log(`${scans} surfaces scanned across ${ROOMS.length} rooms x 3 locales`);
await writeFile(path.join(OUT, 'notruncate.json'),
  JSON.stringify({ scans, findings, cuts: cutFindings }, null, 2));

if (blindGate) {
  console.log('\nFAIL — the mid-word recorder did not see a planted cut. It is measuring nothing.\n');
  process.exit(1);
}
if (cutFindings.length) {
  console.log(`\nFAIL — ${cutFindings.length} line(s) taken off the glass mid-word:\n`);
  for (const c of cutFindings.slice(0, 8)) {
    console.log(`  [${c.loc}] interrupted by ${c.how} at ${c.delay} ms — ${c.missing} characters never shown`);
    console.log(`    read: "${c.shown}"`);
    console.log(`    was:  "${c.full}"`);
  }
  process.exit(1);
}
if (!findings.length) {
  console.log('\nno player-facing text is clipped anywhere, and no line is taken away mid-word.\n');
  process.exit(0);
}
console.log(`\nFAIL — ${findings.length} clipped text node(s) in ${byBox.size} box(es):\n`);
for (const [k, list] of [...byBox.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const worst = list.reduce((a, b) => (b.by > a.by ? b : a));
  const rooms = [...new Set(list.map((x) => x.room))];
  console.log(`  ${k}`);
  console.log(`    cut ${worst.axis}ly by ${worst.by}px — the box shows ${worst.shows}px of ${worst.needs}px`);
  console.log(`    in ${rooms.join(', ')}`);
  console.log(`    e.g. "${worst.text}"`);
}
process.exit(1);
