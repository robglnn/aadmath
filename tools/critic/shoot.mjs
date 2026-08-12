/**
 * Visual + behavioural capture harness.
 *
 * Drives the REAL running game in Chromium, captures real pixels, and reports
 * anything the console complained about. Critics read this output; nobody's
 * summary of the game is accepted as evidence of the game.
 *
 *   node tools/critic/shoot.mjs --out shots/round1 --url http://127.0.0.1:5173
 *   node tools/critic/shoot.mjs --out shots/proof --no-clear   # put the bug back
 *
 * The viewport matrix lives in tools/critic/_viewports.mjs. It is desktop,
 * portrait phone AND — since a client photographed a broken frame nobody had
 * ever captured — phone and tablet in LANDSCAPE. The assertions that go with
 * the landscape frames are in tools/critic/landscape.mjs, which is the gate;
 * this script is the album.
 *
 * ── WHY THIS FILE NOW ASSERTS THINGS ────────────────────────────────────────
 *
 * For several rounds, four of the fourteen standard frames — 10-balance,
 * 11-sort, 12-area and 13-seal — were four photographs of the same ORDERS card.
 * The session's opening beat comes up a little way into the run, takes the whole
 * screen, and this script walked straight into it: it went on calling
 * `openRiftById`, the calls even succeeded, and the panel opened underneath a
 * dimmed modal that filled the frame. Four files, four different byte counts,
 * four pictures of one card. The balance beam, the term bays, the area model and
 * the seal moment had no evidence at all, and the album looked complete.
 *
 * A capture harness that photographs the wrong thing is worse than one that
 * crashes, because the output still looks like evidence. So this script no
 * longer only takes pictures:
 *
 *   1. IT CLEARS THE FLOOR. Every shot runs `clearBeats()` first, which takes
 *      the session's charter / resolution / rest beats off the glass through
 *      their own `hide()`. If a beat is still up when the shutter opens, the
 *      run fails.
 *   2. IT NAMES WHAT IT EXPECTS. A frame that claims to be the balance beam
 *      asserts `panel.mode === 'balance'` before it is written. The scheduler
 *      picks the form, so the shot retries until it gets the one it is for.
 *   3. NO TWO FRAMES MAY MATCH. Byte-identical is a hard failure. So is
 *      *looking* the same: every frame is reduced to a 128x128 greyscale
 *      signature and compared with every other frame of its viewport, because
 *      the four dead shots were never byte-identical — they were four
 *      photographs of one card with a slightly different blur behind it, and
 *      four different SHA-256s. The threshold is calibrated against those
 *      frames; the arithmetic is at the bottom of this file.
 *
 * Exit codes: 0 clean · 2 console errors · 3 a frame failed its assertion.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { LANDSCAPE } from './_viewports.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};

const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/latest'));
const W = Number(arg('w', 1600));
const H = Number(arg('h', 900));

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: [
    '--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
    // Headless Chromium's default presentation path stalls a WebGL canvas hard:
    // with them off this game measured 20 fps with a 118 ms p95 while the GPU
    // was finishing every frame in 12 ms, and *lowering* the device scale
    // factor made it worse, which no GPU-bound workload does. Those flags are
    // what makes the harness's frame times mean the same thing an interactive
    // browser's do. The software rasteriser is still allowed as a last resort
    // so a GPU-less box gets pictures rather than a black screen — but the
    // report now names the renderer, so nobody mistakes SwiftShader's frame
    // rate for the game's.
    '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit',
  ],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

const logs = [];
page.on('console', (m) => logs.push({ type: m.type(), text: m.text() }));
page.on('pageerror', (e) => logs.push({ type: 'pageerror', text: e.message + '\n' + (e.stack || '') }));

const shots = [];
const frames = [];        // { name, file, vp, sha, sig }
const failures = [];
const fail = (name, why) => { failures.push({ name, why }); console.log(`  FAIL ${name} — ${why}`); };

/**
 * Load a page and wait for the real game to exist on it.
 *
 * Retried once, because this harness opens six browser contexts and each one is
 * a second WebGL device on the same GPU: the sixth boot is the slow one, and a
 * single 30-second wait turned that into a crash with no album at all. A boot
 * that fails twice is a real failure and is reported as one, against the frame
 * that would have been captured.
 */
async function boot(p, label) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await p.goto(URL, { waitUntil: 'networkidle' });
      await p.waitForFunction(() => !!window.__ascent, null, { timeout: 45000 });
      return true;
    } catch (e) {
      if (attempt === 2) { fail(label, `the game never booted here: ${e.message.split('\n')[0]}`); return false; }
      console.log(`  retrying boot for ${label}…`);
    }
  }
  return false;
}

/** Evaluate against the live game, tolerating a dev-server reload mid-run. */
async function ax(fn, arg) {
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
  return arg === undefined ? page.evaluate(fn) : page.evaluate(fn, arg);
}

/**
 * `--no-clear` puts the defect back.
 *
 * A gate is only worth the run it costs if somebody has watched it fail. This
 * switch skips the clearing step, which is the whole of what was wrong: run it
 * and the ORDERS card takes the frame again, the surface assertions fail, and
 * the duplicate rule reports the resulting photographs of one card as the same
 * picture. It is how the rule below was calibrated, and it is how the next
 * person can check it still bites without having to break the harness first.
 */
const NO_CLEAR = process.argv.includes('--no-clear');


/**
 * Take whatever a session beat has put on the glass back off it.
 *
 * The charter (ORDERS), the resolution and the rest beat each own the whole
 * frame when they are up, and each of them is somebody else's module. They are
 * dismissed through their own `hide()` rather than by clicking their buttons:
 * a click runs the beat's *transition*, which is a second thing to photograph
 * halfway through, and `rest`'s begin path has thrown here before — this
 * harness's console log is for the game's defects, not for driving somebody
 * else's beat backwards through a state it did not expect.
 *
 * `.ses-cine` is the class that steps the rest of the HUD back while a beat
 * holds the frame. Hiding the beat and leaving that on would photograph a HUD
 * in a state no player ever sees.
 */
async function clearBeats(p = page) {
  if (NO_CLEAR) return;
  await p.evaluate(() => {
    const s = window.__ascent?.session;
    s?.charter?.hide?.();
    s?.resolution?.hide?.();
    s?.rest?.hide?.();
    for (const el of document.querySelectorAll('.ses-charter,.ses-close,.ses-rest')) {
      el.classList.remove('show');
    }
    document.getElementById('ui')?.classList.remove('ses-cine', 'ses-resting');
    document.getElementById('boot')?.classList.add('gone');
  }).catch(() => { /* mid-navigation; the caller re-waits */ });
}

/** Anything still holding the whole frame when the shutter opens. */
const BLOCKERS = '.ses-charter.show, .ses-close.show, .ses-rest.show, #boot:not(.gone)';
async function blockedBy(p = page) {
  return p.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el ? (el.className || el.id) : null;
  }, BLOCKERS).catch(() => null);
}

/**
 * Capture one frame, and make it prove it is a frame.
 *
 * `expect` is an optional JS expression evaluated in the page. A frame that
 * claims to be the balance beam says so here, so that a shot which quietly
 * photographs something else fails instead of filing itself as evidence.
 */
async function shot(name, ms = 300, { p = page, vp = 'desktop', expect = null, expectWhat = '' } = {}) {
  await clearBeats(p);
  await p.waitForTimeout(ms);
  // Twice, on purpose. A beat can arrive *during* the settle — the charter has
  // a sixteen-second fuse of its own, and sealing a rift can end the run — and
  // the second call is what stops this harness photographing the beat instead
  // of the frame. What survives both calls is a real blocker and fails below.
  await clearBeats(p);
  await p.waitForTimeout(140);
  const blocker = await blockedBy(p);
  if (blocker) fail(name, `a session beat still held the frame: ${blocker}`);
  if (expect) {
    const ok = await p.evaluate(expect).catch(() => false);
    if (!ok) fail(name, `the surface is not what this frame claims: expected ${expectWhat}`);
  }
  const f = path.join(OUT, `${name}.png`);
  const buf = await p.screenshot({ path: f });
  // The words on the glass at the moment of the shutter. A greyscale downsample
  // cannot see text — that is what makes one rift in Spanish and the same rift
  // in Polish look identical to it — so the text is recorded separately and the
  // duplicate rule reads both. See section 8.
  // `document.body`, not `#ui`: the rift panel and its seal stamp are siblings
  // of the HUD, not children of it, and reading only `#ui` left the whole
  // learning surface out of the signature — which is most of what tells two
  // rift frames apart.
  const text = await p.evaluate(() => document.body?.innerText || '').catch(() => '');
  shots.push(f);
  frames.push({ name, file: f, vp, text, sha: createHash('sha256').update(buf).digest('hex'), buf });
  return f;
}

/**
 * Put one named answer surface on the screen, by the most honest route that
 * works.
 *
 * FIRST, the real one: open the rift and let the scheduler choose. That is what
 * a player does, and a frame captured that way proves the surface is reachable
 * in ordinary play.
 *
 * The scheduler chooses the item FORM, though, and the form is what decides the
 * modality — `like-terms` has a perimeter form whose expression carries brackets,
 * and the term bays refuse brackets, so it mounts a keypad instead. Twenty-four
 * cold opens in a row came back as keypads, which is how `11-sort` ended up
 * being a picture of a keypad captioned "sort".
 *
 * SO SECOND, if the scheduler will not offer it: `showItem`, which puts one
 * named form of the real generator on the real panel. Still the shipping engine
 * and the shipping surface — only the dice are ours. Which route produced each
 * frame is written into report.json, so nobody has to guess.
 */
const routes = {};
async function openSurface(name, skill, mode, { form, difficulty = 3, tries = 12 } = {}) {
  for (let i = 0; i < tries; i++) {
    await ax(() => window.__ascent.panel.close());
    await clearBeats();
    await ax((s) => window.__ascent.openRiftById(s), skill);
    await page.waitForTimeout(90);
    const got = await ax(() => (window.__ascent.panel.open ? window.__ascent.panel.mode : null));
    if (got === mode) { routes[name] = { route: 'scheduler', skill, tries: i + 1 }; return true; }
  }
  if (!form) return false;
  await ax(() => window.__ascent.panel.close());
  await clearBeats();
  const got = await page.evaluate(async (o) => {
    window.__ascent.showItem(o.skill, { form: o.form, difficulty: o.difficulty });
    await new Promise((r) => setTimeout(r, 60));
    return window.__ascent.panel.open ? window.__ascent.panel.mode : null;
  }, { skill, form, difficulty });
  routes[name] = { route: 'showItem', skill, form, difficulty, tries };
  return got === mode;
}

await boot(page, '01-arrival');
await page.waitForTimeout(2500); // let the boot beat play out

// --- 1. the opening frame, the one that has to earn the next ten minutes ---
await shot('01-arrival', 900);

// --- 2. movement: run, jump, glide, look around ---
await page.mouse.move(W / 2, H / 2);
await page.mouse.click(W / 2, H / 2);
await page.keyboard.down('KeyW');
await page.keyboard.down('ShiftLeft');
await page.waitForTimeout(1400);
await shot('02-sprint', 100);
await page.keyboard.press('Space');
await page.waitForTimeout(320);
await page.keyboard.press('Space');
await page.waitForTimeout(220);
await page.keyboard.press('Space'); // glider
await shot('03-glide', 500);
await page.keyboard.up('ShiftLeft');
await page.keyboard.up('KeyW');
await page.waitForTimeout(900);

// --- 3. building ---
// SPRINTING THROUGH THE WORLD OPENS THINGS. The run above crosses the first
// rift often enough that this frame was, for a while, a photograph of the rift
// panel — and because `openRift` refuses to open over an open panel, the *next*
// frame was a photograph of the same rift, so 04 and 05 were one picture filed
// twice. The distinctness rule found that; this line is the fix.
await ax(() => window.__ascent.panel.close());
await ax(() => { window.__ascent.player.pos.set(0, 12, 20); window.__ascent.player.vel.set(0, 0, 0); });
await page.waitForTimeout(400);
for (const slot of ['Digit2', 'Digit2', 'Digit1']) {
  await page.keyboard.press(slot);
  await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(160);
}
await shot('04-build', 400, {
  expect: '!window.__ascent.panel.open',
  expectWhat: 'the build bar and the world, with no rift over them',
});

// --- 4. the learning surface, in all three languages ---
await ax(() => window.__ascent.panel.close());
await ax(() => window.__ascent.openRiftById('var-meaning'));
await shot('05-rift-en', 800, {
  expect: "!!window.__ascent.panel.open && window.__ascent.locale() === 'en'",
  expectWhat: 'an open rift, in English',
});

// wrong answer -> the echo should appear, targeted at the misconception
await page.evaluate(() => {
  const panel = window.__ascent.panel;
  const btns = [...document.querySelectorAll('.ans')];
  const bad = btns.find((b) => !b.textContent.trim().startsWith(panel.item.answer));
  if (bad) bad.click();
  else panel.demo?.('wrong');   // the surface is not multiple choice — drive it like a hand
});
await shot('06-echo-scaffold', 900);

for (const loc of ['es', 'pl']) {
  // Clicked, not called: the HUD's own buttons are the path a learner takes,
  // and a harness that reaches past them stops testing them.
  await page.evaluate((l) => { document.querySelector(`.langs [data-loc="${l}"]`)?.click(); }, loc);
  await page.waitForTimeout(300);
  await ax(() => true);
  await page.waitForTimeout(400);
  await ax(() => window.__ascent.panel.close());
  await ax(() => window.__ascent.openRiftById('one-step-add'));
  // The frame is captioned "the rift in Polish", so it says so before it is
  // written: an open rift, and the game actually in that locale.
  await shot(`07-rift-${loc}`, 700, {
    expect: `!!window.__ascent.panel.open && window.__ascent.locale() === '${loc}'`,
    expectWhat: `an open rift, in ${loc}`,
  });
  await ax(() => window.__ascent.panel.close());
}
await page.evaluate(() => document.querySelector('.langs [data-loc="en"]')?.click());
await page.waitForTimeout(300);

// --- 5. a wide establishing shot of the whole lattice ---
await page.evaluate(() => {
  const a = window.__ascent;
  a.player.pos.set(0, 60, 120);
  a.player.pitch = -0.35; a.player.yaw = Math.PI;
});
await shot('08-vista', 1000, {
  expect: '!window.__ascent.panel.open',
  expectWhat: 'the world, with no panel over it',
});

// --- 5b. the other learning modalities: balance beam, term bays, area model ---
//
// THESE FOUR WERE THE DEAD ONES. All four were the ORDERS card, because the
// session's opening beat had come up by this point in the run and nothing here
// took it off. `openSurface` closes the panel, clears the beat, opens the rift
// and checks which modality actually came back — the scheduler chooses the item
// form, so asking once and photographing the answer is not the same as
// photographing the balance beam.
for (const [name, skill, mode, form] of [
  ['10-balance', 'two-step', 'balance', 'ts-symbolic'],
  ['11-sort', 'like-terms', 'sort', 'lt-collect'],
  ['12-area', 'distribute', 'area', 'ds-area'],
]) {
  const got = await openSurface(name, skill, mode, { form });
  if (!got) fail(name, `could not reach the ${mode} surface on ${skill}, by the scheduler or by ${form}`);
  await shot(name, 700, {
    expect: `window.__ascent.panel.open && window.__ascent.panel.mode === '${mode}'`,
    expectWhat: `the ${mode} surface`,
  });
}
// The resolution beat, mid-seal: the area model still on screen, solved. This
// has to run against a live, unsettled panel — `demo` refuses otherwise, and a
// refusal used to be silent.
const sealed = await ax(() => {
  const p = window.__ascent.panel;
  return !!(p.open && p.demo('right'));
});
if (!sealed) fail('13-seal', 'the panel would not take a solve — nothing to photograph');
// The banner the world puts up when a line closes, in whatever language is
// running. Naming the words rather than the element means this stays true if
// the ribbon is restyled, and stays honest if it is translated.
//
// Case-folded, because `innerText` returns text as it is PAINTED and the stamp
// is set in small caps: the bundle says "Lattice sealed", the glass says
// "LATTICE SEALED", and the first version of this assertion failed a frame that
// showed exactly what it claimed.
await shot('13-seal', 700, {
  expect: "document.body.innerText.toLowerCase().includes(window.__ascent.t('rift.sealed').toLowerCase())",
  expectWhat: 'the seal banner on screen',
});
await ax(() => window.__ascent.panel.close());

// --- telemetry ---------------------------------------------------------
// Measured HERE, before the mobile page exists. A second WebGL context running
// the same game in the same browser competes for the same GPU, and measuring
// through it was reporting roughly half the real frame rate — a number about
// the harness, not about the game.
const state = await ax(() => window.__ascent.state());
const perf = await page.evaluate(async () => {
  const a = window.__ascent;
  a.player.pos.set(0, (a.player.groundAt(0, 26) ?? 12) + 0.4, 26);
  a.player.vel.set(0, 0, 0); a.player.yaw = Math.PI; a.player.pitch = -0.14;
  await new Promise((r) => setTimeout(r, 900));
  const dts = []; let last = performance.now();
  await new Promise((res) => {
    let n = 0;
    const step = () => {
      const t = performance.now(); dts.push(t - last); last = t;
      if (++n < 140) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
  const s = dts.slice(30).sort((x, y) => x - y);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(s.length * p))];
  const r = a.engine.renderer.info.render;
  return {
    fps: 1000 / q(0.5), fpsLow: 1000 / q(0.99), frameMs: q(0.5), p95Ms: q(0.95),
    draws: r.calls, tris: r.triangles,
    pixelRatio: a.engine.renderer.getPixelRatio(), renderScale: a.fx.renderScale,
    renderer: (() => {
      const gl = a.engine.renderer.getContext();
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      return dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    })(),
  };
});

// --- 6. mobile portrait ---
const mob = await ctx.newPage();
await mob.setViewportSize({ width: 414, height: 896 });
const mobUp = await boot(mob, '09-mobile');
await mob.waitForTimeout(3000);
if (!mobUp) fail('14-mobile-rift', 'skipped — the phone page never booted');
if (mobUp) await shot('09-mobile', 200, {
  p: mob,
  vp: 'mobile',
  expect: '!window.__ascent.panel.open',
  expectWhat: 'the world on a phone, with no panel over it',
});

// the learning surface on a phone — it has to be playable with a thumb
let mobMode = null;
for (let i = 0; mobUp && i < 12; i++) {
  await mob.evaluate(() => window.__ascent.panel.close());
  await clearBeats(mob);
  await mob.evaluate(() => window.__ascent.openRiftById('two-step'));
  await mob.waitForTimeout(120);
  mobMode = await mob.evaluate(() => (window.__ascent.panel.open ? window.__ascent.panel.mode : null));
  if (mobMode === 'balance') break;
}
if (mobUp && mobMode !== 'balance') {
  // Same fallback as the desktop surfaces, for the same reason: the scheduler
  // offered the modelling form, which is a set of readings and not a beam.
  mobMode = await mob.evaluate(async () => {
    window.__ascent.panel.close();
    window.__ascent.showItem('two-step', { form: 'ts-symbolic', difficulty: 3 });
    await new Promise((r) => setTimeout(r, 60));
    return window.__ascent.panel.open ? window.__ascent.panel.mode : null;
  });
  routes['14-mobile-rift'] = { route: 'showItem', skill: 'two-step', form: 'ts-symbolic', difficulty: 3 };
}
if (mobUp && mobMode !== 'balance') fail('14-mobile-rift', `wanted the balance surface, the phone is showing ${mobMode}`);
if (mobUp) await shot('14-mobile-rift', 1100, {
  p: mob,
  vp: 'mobile',
  expect: "window.__ascent.panel.open && window.__ascent.panel.mode === 'balance'",
  expectWhat: 'the balance surface on a phone',
});
if (mobUp) await mob.evaluate(() => window.__ascent.panel.close());
await mob.close();

// --- 7. THE PHONE ON ITS SIDE ------------------------------------------------
// Every viewport above is portrait or desktop, and that was the whole matrix
// for the life of this project: 414x896, 390x844, 1280x720, 1600x900. A phone
// held sideways was never once photographed, and it was broken — the
// companion's card was printed through by the first-contact panel and cut off
// mid-sentence, with PROGRESS and MENU on top of what was left.
//
// These four sizes are now part of the standard capture. They are captured
// with `hasTouch`, because the defect only exists on a device with thumbs on
// the glass: src/ui/hud.js sets `[data-touch]` from the same predicate
// src/player/touch.js mounts the controls with, and a landscape capture
// without it photographs a desktop layout at phone dimensions.
//
// The pictures are the record; the ASSERTIONS live in the companion script,
// `node tools/critic/landscape.mjs`, which drives all four sizes in EN/ES/PL
// through five scenes and fails on any clipped text, any element off the
// frame, any two things in one place, and anything inside a notch.
for (const vp of LANDSCAPE) {
  const land = await browser.newContext({
    viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2, hasTouch: true,
  });
  const lp = await land.newPage();
  lp.on('console', (m) => logs.push({ type: m.type(), text: `[${vp.name}] ${m.text()}` }));
  lp.on('pageerror', (e) => logs.push({ type: 'pageerror', text: `[${vp.name}] ${e.message}` }));
  const up = await boot(lp, `20-landscape-${vp.name}`);
  if (!up) { fail(`21-landscape-rift-${vp.name}`, 'skipped — this viewport never booted'); await land.close(); continue; }
  await lp.waitForTimeout(3200);
  await shot(`20-landscape-${vp.name}`, 200, {
    p: lp,
    vp: vp.name,
    expect: '!window.__ascent.panel.open',
    expectWhat: 'the world on a phone held sideways',
  });

  // …and the learning surface at the same size, which is the panel that had
  // 432 px of content in a 390 px frame.
  await lp.evaluate(() => window.__ascent.openRiftById('one-step-add'));
  await shot(`21-landscape-rift-${vp.name}`, 1100, {
    p: lp,
    vp: vp.name,
    expect: 'window.__ascent.panel.open',
    expectWhat: 'an open rift on a phone held sideways',
  });
  await lp.evaluate(() => window.__ascent.panel.close());
  await land.close();
}

// ---------------------------------------------------------------------------
// 8. NO TWO FRAMES MAY BE THE SAME PICTURE
// ---------------------------------------------------------------------------
/**
 * The dead-shot assertion.
 *
 * Byte-identity is the mandated check and it is the cheap one: two files with
 * the same SHA-256 are the same file, and a run that produces one has captured
 * nothing twice. That alone would not have caught what actually shipped, so it
 * is only half the rule. The four dead frames had four different byte counts.
 * They were four photographs of the same ORDERS card over a slightly different
 * blurred world, and a hash saw four distinct files.
 *
 * So each frame is also reduced to a 128x128 greyscale signature — decoded from
 * the real PNG by the same browser that drew it, no image library involved —
 * and every pair inside one viewport is compared. Frames from different
 * viewports are not compared: a phone and a laptop photographing the same scene
 * *should* reduce to nearly the same signature, and that is not a defect.
 *
 * PIXELS ARE NOT ENOUGH ON THEIR OWN, and the first version of this rule proved
 * it by failing an honest frame. `07-rift-es` and `07-rift-pl` are one rift
 * photographed in two languages: same panel, same layout, same everything
 * except the words — and words are exactly what a greyscale downsample throws
 * away. Measured across runs that honest pair scored 2.35 and 3.25, while the
 * four dead ORDERS frames scored 1.45, 1.99 and 2.29. There is no threshold
 * between those two sets, so a threshold was the wrong instrument.
 *
 * SO THE RULE READS BOTH SIGNALS, and a pair is only a duplicate when both
 * agree:
 *
 *   the picture is the same    mean per-cell difference < DISTINCT
 *   AND the words are the same Jaccard overlap of the visible text > TEXT_SAME
 *
 * Both numbers are measured, not guessed. `--no-clear` reproduces the original
 * defect on demand, and these are what the two populations actually score:
 *
 *   the dead pairs, photographs of one ORDERS card     pixels 1.3 – 2.7
 *                                                       words 83%
 *   the honest pair, one rift in two languages          pixels 1.8 – 3.3
 *                                                       words 13%
 *
 * Read that twice: the PIXEL ranges overlap. 1.3 is a dead pair and 1.8 is an
 * honest one, so no pixel threshold can separate them, and the first version of
 * this rule duly failed an honest frame. The WORD ranges do not overlap and are
 * nowhere near it. So DISTINCT is set generously at 4.0 — wide enough to
 * suspect anything that looks alike — and TEXT_SAME at 0.5 is what actually
 * decides, sitting in the empty middle between 13% and 83%.
 *
 * Byte-identity is judged on its own and always fails, text or no text.
 */
const SIG = 128;
const DISTINCT = 4.0;    // mean grey levels out of 255, at 128x128
const TEXT_SAME = 0.5;   // Jaccard overlap of the words on screen

const sigPage = await ctx.newPage();
await sigPage.goto('about:blank');
async function signature(buf) {
  return sigPage.evaluate(async ({ data, n }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + data;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = n; c.height = n;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, n, n);
    const d = g.getImageData(0, 0, n, n).data;
    const out = [];
    for (let i = 0; i < n * n; i++) {
      out.push(Math.round(d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114));
    }
    return out;
  }, { data: buf.toString('base64'), n: SIG });
}
for (const f of frames) { f.sig = await signature(f.buf); delete f.buf; }
await sigPage.close();

const meanDiff = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
};

/** How much of the writing on the glass these two frames share. */
const wordsOf = (s) => new Set(String(s).toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean));
function textOverlap(a, b) {
  const A = wordsOf(a); const B = wordsOf(b);
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter += 1;
  return inter / (A.size + B.size - inter);
}

const dupes = [];
for (let i = 0; i < frames.length; i++) {
  for (let j = i + 1; j < frames.length; j++) {
    const a = frames[i]; const b = frames[j];
    if (a.sha === b.sha) {
      dupes.push({ a: a.name, b: b.name, diff: 0, words: 1, why: 'byte-identical' });
      continue;
    }
    if (a.vp !== b.vp) continue;
    const diff = meanDiff(a.sig, b.sig);
    if (diff >= DISTINCT) continue;
    const words = textOverlap(a.text, b.text);
    if (words <= TEXT_SAME) continue;      // same layout, different words: two real frames
    dupes.push({ a: a.name, b: b.name, diff: +diff.toFixed(3), words: +words.toFixed(3), why: 'the same picture, saying the same thing' });
  }
}
for (const d of dupes) {
  fail(d.a, `${d.why} as ${d.b} (pixels ${d.diff}, words ${Math.round(d.words * 100)}% shared)`);
}

/** How alone each frame is: the nearest other frame of its own viewport. */
const nearest = frames.map((f) => {
  let best = Infinity; let who = null; let words = null;
  for (const g of frames) {
    if (g === f || g.vp !== f.vp) continue;
    const d = meanDiff(f.sig, g.sig);
    if (d < best) { best = d; who = g.name; words = +textOverlap(f.text, g.text).toFixed(3); }
  }
  return {
    name: f.name, vp: f.vp, nearest: who, words,
    diff: Number.isFinite(best) ? +best.toFixed(2) : null,
  };
});

const errors = logs.filter((l) => l.type === 'error' || l.type === 'pageerror');
const report = {
  url: URL,
  shots,
  frames: frames.map((f) => ({ name: f.name, vp: f.vp, sha256: f.sha, route: routes[f.name] || null })),
  distinct: { pixelFloor: DISTINCT, textCeiling: TEXT_SAME, dupes, nearest },
  failures,
  state,
  perf,
  errors,
  warnings: logs.filter((l) => l.type === 'warning'),
};
await writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));

console.log(`\nshots -> ${OUT}`);
console.log(`fps ${perf.fps.toFixed(1)} median (${perf.frameMs.toFixed(2)}ms), 1% low ${perf.fpsLow.toFixed(1)}, p95 ${perf.p95Ms.toFixed(1)}ms`);
console.log(`draws ${perf.draws}  tris ${perf.tris.toLocaleString()}  pixelRatio ${perf.pixelRatio.toFixed(2)}  renderScale ${perf.renderScale.toFixed(2)}`);
console.log(`gpu ${perf.renderer}`);
console.log(`frames: ${frames.length} captured, ${frames.length - new Set(frames.map((f) => f.sha)).size} byte-identical, ${dupes.length} indistinguishable pair(s)`);
const tightest = [...nearest].filter((n) => n.diff != null).sort((a, b) => a.diff - b.diff)[0];
if (tightest) {
  console.log(`closest pair: ${tightest.name} ~ ${tightest.nearest} `
    + `(pixels ${tightest.diff} vs floor ${DISTINCT}, words ${Math.round(tightest.words * 100)}% vs ceiling ${TEXT_SAME * 100}%)`);
}
console.log(`console errors: ${errors.length}`);
errors.slice(0, 12).forEach((e) => console.log('  ! ' + e.text.split('\n')[0]));
if (failures.length) {
  console.log(`\nCAPTURE FAILED — ${failures.length} frame(s) are not what they claim:`);
  for (const f of failures) console.log(`  ${f.name}: ${f.why}`);
}

await browser.close();
process.exit(failures.length ? 3 : errors.length ? 2 : 0);
