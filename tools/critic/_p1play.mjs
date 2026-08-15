/**
 * P1 play probe — drives a COLD session with real keys and a real mouse until
 * the grant card, the rank rite and the post-seal objective gap have all been
 * photographed, and samples the z-order of every surface 10x a second.
 *
 * `window.__ascent` is read for FACTS ONLY (where the rift is, what the answer
 * is, whether the panel is open). Every state change in this script is caused
 * by a key press or a mouse click, because the debug path has hidden three
 * rounds of false fixes here.
 *
 *   node tools/critic/_p1play.mjs [--url ...] [--out shots/p1/play]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/p1/play'));
const HEADED = process.argv.includes('--headed');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: !HEADED,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) });

// --------------------------------------------------------------- the sampler
// Named surfaces, their live stacking level, their rect and whether they paint.
const SURFACES = [
  ['.rift', 'rift'], ['.kit-toast', 'grant'], ['.meta-comms', 'marlow'],
  ['.meta-rite', 'rite'], ['.gd-card', 'objective'], ['.gd-prompt', 'prompt'],
  ['.fc.show', 'controls'], ['.fc-pill', 'pill'], ['.meta-quest', 'chapter'],
  ['.ses-band', 'band'], ['.meta-turn', 'turn'], ['.hud-top', 'rig'],
  ['.buildbar', 'hotbar'], ['.kit', 'kitstrip'], ['#menu', 'menu'],
  ['.rp-launch', 'launcher'], ['.toast', 'toast'], ['.meta-open', 'coldopen'],
  ['.ses-close', 'close'], ['.fcs.show', 'stuck'],
  // The session's own beats. Both are full-screen surfaces that DO carry a
  // clear next action (ORDERS carries "BEGIN THE RUN"), and leaving them out of
  // this list made the probe report an empty screen while a button was on it.
  ['.ses-charter', 'orders'], ['.ses-rest', 'rest'],
];

function SAMPLE(SEL) {
  const eff = (el) => {                       // effective opacity through parents
    let o = 1;
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.visibility === 'hidden' || s.display === 'none') return 0;
      o *= parseFloat(s.opacity);
    }
    return o;
  };
  // The painted stacking level: the nearest ancestor-or-self that actually
  // declares one. Two surfaces with no declared level stack in DOM order, which
  // is exactly the failure this is looking for.
  const level = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const z = getComputedStyle(n).zIndex;
      if (z !== 'auto') return { z: +z, from: n === el ? 'self' : String(n.className || n.id) };
    }
    return { z: null, from: 'dom-order' };
  };
  const out = [];
  for (const [sel, name] of SEL) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    const o = eff(el);
    if (o <= 0.02 || r.width < 2 || r.height < 2) continue;
    out.push({ name, sel, ...level(el), o: +o.toFixed(2),
               r: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] });
  }
  return out;
}

const sample = () => page.evaluate(SAMPLE, SURFACES);
const overlaps = (a, b) => !(a.r[0] + a.r[2] <= b.r[0] || b.r[0] + b.r[2] <= a.r[0] ||
                             a.r[1] + a.r[3] <= b.r[1] || b.r[1] + b.r[3] <= a.r[1]);

const timeline = [];
const faults = [];
let watching = false;
const watch = async (tag) => {
  const s = await sample();
  timeline.push({ tag, t: +((Date.now() - T0) / 1000).toFixed(1), s });
  // FAULT A — two surfaces that overlap in space and have no ordering between
  // them (either both undeclared, or the same level).
  for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) {
    const a = s[i], b = s[j];
    if (!overlaps(a, b)) continue;
    if (a.z === null || b.z === null || a.z === b.z) {
      faults.push({ kind: 'ambiguous-stack', tag, a: a.name, az: a.z, b: b.name, bz: b.z });
    }
  }
  return s;
};

const T0 = Date.now();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(3500);

const open = () => page.evaluate(() => !!window.__ascent.panel?.open);

// ------------------------------------------------- walk to a rift, with keys
async function walkToNearestRift(limit = 220) {
  const target = await page.evaluate(() => {
    const a = window.__ascent, p = a.player.pos;
    const r = (a.rifts?.list ?? []).filter((x) => !x.locked && !x.mastered);
    let best = null, bd = 1e9;
    for (const x of r) { const d = Math.hypot(x.pos.x - p.x, x.pos.z - p.z); if (d < bd) { bd = d; best = x; } }
    return best ? { id: best.id, x: best.pos.x, z: best.pos.z } : null;
  });
  if (!target) return false;
  await page.mouse.click(760, 450);
  await page.waitForTimeout(250);
  let held = false, reached = false;
  for (let i = 0; i < limit && !reached; i++) {
    const err = await page.evaluate((t) => {
      const a = window.__ascent, p = a.player.pos;
      const want = Math.atan2(t.x - p.x, t.z - p.z);
      let d = ((want - a.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (d < -Math.PI) d += Math.PI * 2;
      return { d, dist: Math.hypot(t.x - p.x, t.z - p.z) };
    }, target);
    if (Math.abs(err.d) > 0.06) await page.mouse.move(760 - err.d * 240, 450, { steps: 2 });
    if (!held) { await page.keyboard.down('KeyW'); held = true; }
    await page.waitForTimeout(110);
    if (await open()) reached = true;
    else if (err.dist < 5) reached = true;
    if (watching && i % 3 === 0) await watch('walking');
  }
  if (held) await page.keyboard.up('KeyW');
  if (!(await open())) { for (const k of ['KeyE', 'KeyF', 'Enter']) { await page.keyboard.press(k); await page.waitForTimeout(400); if (await open()) break; } }
  return open();
}

// -------------------------------------------- answer the live item, by typing
async function answerOnce(correct = true) {
  const fact = await page.evaluate(() => {
    const p = window.__ascent.panel;
    if (!p?.open || !p.item) return null;
    return { answer: String(p.item.answer), form: p.item.form || null,
             choice: !!document.querySelector('.rf-choice, .rf-opt') };
  });
  if (!fact) return false;
  // A choice item: click the option whose text is the answer, like a person.
  const opts = await page.$$('.rf-opt, .rf-choice button, .rf-choices button');
  if (opts.length) {
    let picked = null;
    for (const o of opts) {
      const txt = (await o.innerText()).replace(/\s+/g, '');
      if (correct === (txt === fact.answer.replace(/\s+/g, ''))) { picked = o; break; }
    }
    (picked || opts[0]) && await (picked || opts[0]).click();
    await page.waitForTimeout(900);
    return true;
  }
  // A typed item: press the digits, then Enter — the keypad is on screen but
  // the keyboard is the path a laptop player uses.
  const want = correct ? fact.answer : String((parseInt(fact.answer, 10) || 0) + 7);
  for (const ch of want) {
    if (ch === '-') await page.keyboard.press('Minus');
    else if (ch === '/') await page.keyboard.press('Slash');
    else if (ch === '.') await page.keyboard.press('Period');
    else await page.keyboard.press(ch);
    await page.waitForTimeout(60);
  }
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1100);
  return true;
}

// =========================================================== drive the session
watching = true;
await watch('cold-arrival');
await shot('00-arrival');

let sealed = 0, sawGrant = false, sawRite = false, sawObjGap = false;
/** How long the frame may carry no next action before it is a defect. */
const BLANK_S = 0.9;
let blankFrom = 0;
let riteAt = 0, ritePeak = false, riteText = null;
for (let round = 0; round < 26; round++) {
  // A session beat is up: press its button with a real click, like a player.
  for (const sel of ['.sc-go', '.ses-charter button', '.ses-rest button']) {
    const b = await page.$(sel);
    if (b && await b.isVisible()) { await b.click().catch(() => {}); await page.waitForTimeout(1200); break; }
  }
  if (!(await open())) {
    const got = await walkToNearestRift();
    if (!got) { await page.keyboard.press('KeyE'); await page.waitForTimeout(500); }
  }
  if (!(await open())) continue;
  if (round === 0) { await watch('rift-open'); await shot('01-rift-open'); }

  const ok = await answerOnce(true);
  if (!ok) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); continue; }
  sealed++;

  // Sample hard through the seal: this is where the grant card, the rite and
  // the objective gap all live.
  for (let k = 0; k < 70; k++) {
    const s = await watch(`seal${sealed}+${(k * 0.15).toFixed(2)}s`);
    const has = (n) => s.some((x) => x.name === n);

    if (has('grant')) {
      if (!sawGrant) { sawGrant = true; await shot(`30-grant-seal${sealed}`); }
      const g = s.find((x) => x.name === 'grant');
      const rf = s.find((x) => x.name === 'rift');
      /* BOTH LEGIBLE AT ONCE is the defect; a crossfade is not.
         The frame the critic filed had the grant card and the rift panel both
         at full opacity, with VAULT PLATE coming up through the keypad. One of
         the two fading past the other while a tear opens or closes is the
         transition working, and flagging it would make this probe cry wolf on
         every seal — which is how a gate stops being read. LEGIBLE is 0.5:
         below that the card is a ghost of itself and carries no readable word. */
      const LEGIBLE = 0.5;
      if (rf && overlaps(g, rf) && g.o > LEGIBLE && rf.o > LEGIBLE) {
        faults.push({ kind: 'grant-legible-over-tear', tag: `seal${sealed}`,
                      gz: g.z, go: g.o, rz: rf.z, ro: rf.o });
        await shot(`31-grant-through-rift-seal${sealed}`);
      }
    }
    if (has('rite')) {
      if (!sawRite) { sawRite = true; riteAt = Date.now(); await shot(`40-rite-seal${sealed}`); }
      /* THE READABLE PEAK. The bars slam at 0.34 s and the citation arrives at
         0.95 s, so the first frame a probe catches is a letterbox with no words
         in it yet — useless for judging whether the ceremony says what to do.
         2.4 s is after every element has landed and well before the retreat. */
      if (riteAt && !ritePeak && Date.now() - riteAt > 2400) {
        ritePeak = true;
        riteText = await page.evaluate(() => {
          const q = (c) => document.querySelector('.meta-rite ' + c)?.textContent?.trim() || '';
          return { kicker: q('.rite-kicker'), name: q('.rite-name span'),
                   cite: q('.rite-cite'), next: q('.rite-next') };
        });
        await shot(`41-rite-peak-seal${sealed}`);
      }
      // The rite's own blank window is measured by FAULT C below, on the same
      // sustained rule as every other surface.
    }
    /* FAULT C — NO NEXT ACTION ON SCREEN, FOR LONG ENOUGH TO NOTICE.
       The critic's two reports were both DURATIONS: the ceremony "blanks the
       entire HUD for ~5 s", the objective card "vanishes for ~2 s". So this
       measures a sustained window and not a sample. Any single frame can be
       mid-crossfade — two surfaces handing the screen to each other are both
       under an opacity threshold for a moment, and calling that a blank screen
       is how a probe ends up crying wolf on every seal. A run has to last
       BLANK_S before it is a thing a player could see. */
    const actionable = ['objective', 'prompt', 'rift', 'orders', 'close', 'rest',
                        'marlow', 'chapter', 'rite', 'stuck', 'menu'];
    if (actionable.some(has)) { blankFrom = 0; } else if (!blankFrom) { blankFrom = Date.now(); }
    if (blankFrom && Date.now() - blankFrom > BLANK_S * 1000) {
      faults.push({ kind: 'no-next-action-sustained',
                    tag: `seal${sealed} +${(k * 0.15).toFixed(2)}s`,
                    heldFor: +((Date.now() - blankFrom) / 1000).toFixed(2),
                    showing: s.map((x) => x.name) });
      if (!sawObjGap) { sawObjGap = true; await shot(`50-no-next-action-seal${sealed}`); }
      blankFrom = 0;
    }

    // Keep the drive moving: a session beat is a button, so press it.
    for (const sel of ['.ses-charter.show .sc-go', '.ses-rest.show button']) {
      const b = await page.$(sel);
      if (b && await b.isVisible()) { await b.click().catch(() => {}); await page.waitForTimeout(900); }
    }
    await page.waitForTimeout(150);
  }
  if (sealed >= 8 && sawGrant) break;
}

await shot('90-end');
await watch('end');

// --------------------------------------------------------------------- report
const byKind = {};
for (const f of faults) (byKind[f.kind] ||= []).push(f);
await writeFile(path.join(OUT, 'p1.json'),
  JSON.stringify({ sealed, sawGrant, sawRite, riteText, faults, timeline, errors }, null, 2));

console.log(`\nsealed ${sealed} rift(s)  grant=${sawGrant} rite=${sawRite}`);
console.log('\n=== FAULTS ===');
for (const [k, v] of Object.entries(byKind)) {
  console.log(`\n  ${k}  x${v.length}`);
  const uniq = new Map();
  for (const f of v) uniq.set(JSON.stringify([f.a, f.b, f.kind, f.showing]), f);
  [...uniq.values()].slice(0, 8).forEach((f) => console.log('    ' + JSON.stringify(f)));
}
if (!faults.length) console.log('  none');
console.log('\n=== THE RITE, AT ITS READABLE PEAK ===');
console.log(riteText ? JSON.stringify(riteText, null, 2) : '  never reached');
console.log('\n=== CONSOLE ERRORS ===', errors.length ? errors.slice(0, 5) : 'none');
await browser.close();
