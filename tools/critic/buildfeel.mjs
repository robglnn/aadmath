/**
 * HOW THE BUILD VERB FEELS, photographed.
 *
 * The lattice can be exact and the verb can still be miserable. This captures
 * the three things a player actually experiences before a piece exists: the
 * preview (does it say *where*, and does it say which slot), the magnet (does
 * the second piece find the first one's level without being asked), and the
 * refusal (does a "no" say which no, in the player's own language).
 *
 *   node tools/critic/buildfeel.mjs --out shots/buildfeel [--url …]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/buildfeel'));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const boot = async () => {
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
  await page.waitForTimeout(2600);
  await page.evaluate(() => {
    const a = window.__ascent;
    const b = a.builder;
    b.drawHand();
    b.clearAll();
    b.charge = 1e6; b.maxCharge = 1e6;
    // The language pills live on the pause card, so switching locale leaves the
    // menu owning the frame — and a builder whose UI is open is not armed.
    try { if (a.menu?.open) a.menu.hide(); } catch { /* card already gone */ }
    try { if (a.panel?.open) a.panel.close(); } catch { /* not open */ }
    a.input.uiOpen = false;
    document.getElementById('boot')?.classList.add('gone');
    window.__feel = {
      aim(kind, x, y, z, yaw, pitch = -0.06) {
        // main.js re-syncs the builder's slot from input every frame, so a
        // harness that sets only one of the two is photographing the wall it
        // did not ask for.
        const n = ['wall', 'ramp', 'floor', 'beam', 'vault'].indexOf(kind);
        b.setSlot(n); a.input.slot = n;
        const g = a.islandAt(0, 0);
        a.player.pos.set(x, g + y, z);
        a.player.vel.set(0, 0, 0);
        a.player.yaw = yaw; a.player.pitch = pitch;
        if (b.regen) b.charge = 1e6;
        b.arm();
        return b.target();
      },
      build: () => a.build(),
      why: () => document.querySelector('.axiom-why')?.textContent || '',
      whyOn: () => !!document.querySelector('.axiom-why.show'),
      clear: () => { b.clearAll(); },
      project(x, y, z) {
        const v = new a.THREE.Vector3(x, y, z).project(a.camera);
        return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
      },
    };
  });
};

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch { /* private */ } });
await page.reload({ waitUntil: 'networkidle' });
await boot();

const notes = [];
const shot = async (name, ms = 500) => {
  await page.waitForTimeout(ms);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
};
const zoom = async (name, pt, size = 520, ms = 450) => {
  await page.waitForTimeout(ms);
  const p = await page.evaluate((q) => window.__feel.project(q[0], q[1], q[2]), pt);
  const clip = {
    x: Math.max(0, Math.min(1600 - size, Math.round(p.x - size / 2))),
    y: Math.max(0, Math.min(900 - size, Math.round(p.y - size / 2))),
    width: size, height: size,
  };
  await page.screenshot({ path: path.join(OUT, `${name}.png`), clip });
};

// --- 1. the preview says which slot ----------------------------------------
for (const [i, kind] of ['wall', 'floor', 'ramp', 'beam'].entries()) {
  const t2 = await page.evaluate((k) => window.__feel.aim(k, 0, 0.1, -8, 0, -0.42), kind);
  notes.push({ what: `${kind} preview slot`, span: t2.slotSpan, at: [t2.x, t2.z],
    base: t2.base, valid: t2.valid });
  await shot(`0${i + 1}-preview-${kind}`);
  await zoom(`0${i + 1}z-preview-${kind}`, [t2.x, t2.base + 1.4, t2.z], 620);
}

// --- 2. the magnet: a second wall stacks on the first, exactly -------------
const stack = await page.evaluate(() => {
  const F = window.__feel;
  F.aim('wall', 0, 0.1, -6, 0);
  const a1 = F.build();
  const tg2 = F.aim('wall', 0, 0.1, -6, 0);      // same stance, same face
  const a2 = F.build();
  const ps = window.__ascent.builder.lattice.live.wall.filter((p) => !p.dead);
  return {
    placed: [a1.ok, a2.ok],
    faces: ps.map((p) => [p.x, p.z]),
    bases: ps.map((p) => p.base),
    secondTook: tg2.base,
  };
});
notes.push({ what: 'a second click on a taken face takes the storey above', ...stack,
  exact: stack.bases.length === 2 && Math.abs(stack.bases[1] - stack.bases[0] - 4) < 1e-12 });
await shot('04-magnet-stacked');

// --- 3. refusal: it says WHICH no ------------------------------------------
const REFUSE = () => {
  const F = window.__feel;
  F.aim('wall', 0, 0.1, 6, Math.PI);
  // a wall costs nine, and the reserve must not refill under the test
  window.__ascent.builder.regen = 0;
  window.__ascent.builder.charge = 2;
  return window.__ascent.builder.target();
};
const noCharge = await page.evaluate(REFUSE);
notes.push({ what: 'out of charge', reason: noCharge.reason, valid: noCharge.valid });
await shot('05-refused-no-charge');
const whyOcc = await page.evaluate(() => ({ text: window.__feel.why(), on: window.__feel.whyOn() }));
notes.push({ what: 'refusal chip (en)', ...whyOcc });

// --- 4. the same refusal in Spanish and Polish -----------------------------
for (const loc of ['es', 'pl']) {
  await page.evaluate((l) => { document.querySelector(`.langs [data-loc="${l}"]`)?.click(); }, loc);
  // switching language reloads the page; reading the chip before that lands is
  // how a harness reports the previous locale's string and calls it a bug
  await page.waitForFunction(
    (l) => !!window.__ascent && window.__ascent.locale() === l, loc, { timeout: 20000 });
  await boot();
  await page.evaluate(() => {
    window.__feel.aim('wall', 0, 0.1, 6, Math.PI);
    window.__ascent.builder.regen = 0;
    window.__ascent.builder.charge = 2;
    window.__ascent.builder.target();
  });
  await page.waitForTimeout(500);
  const why = await page.evaluate(() => ({
    text: window.__feel.why(), on: window.__feel.whyOn(),
    locale: window.__ascent.locale(),
    charge: Math.round(window.__ascent.builder.charge),
    reason: window.__ascent.builder._reason,
    say: window.__ascent.t('build.noCharge'),
  }));
  notes.push({ what: `refusal chip (${loc})`, ...why });
  await shot(`06-refused-${loc}`);
}

console.log(JSON.stringify(notes, null, 1));
console.log('console errors:', errors.length, errors.slice(0, 4).join(' | '));
await writeFile(path.join(OUT, 'buildfeel.json'), JSON.stringify({ notes, errors }, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);
