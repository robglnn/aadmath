/**
 * How many text surfaces are competing for one pair of eyes.
 *
 * A judge counted eight simultaneous text panels at 36 seconds and noted that
 * a Fortnite drop HUD is three. This counts them the way he did: every element
 * in the HUD layer that is on screen, has its own visible box, carries words,
 * and is not merely a child of something already counted.
 *
 * It then splits them, because the two halves are not the same problem.
 *
 *   PROSE    a panel a player has to *read*: the objective, the plate on the
 *            thing in front of them, Marlow, the chapter card, the rift. This
 *            is the number the judge's comparison is about, and the number
 *            src/ui/quiet.js governs. The gate is three.
 *   CONTROL  a readout or a rack a player *glances* at: the rank strip, the
 *            build hotbar, the menu and progress pills, the language plate. A
 *            Fortnite drop HUD has five or six of these and nobody minds,
 *            because none of them is a sentence. Reported, never gated —
 *            hiding a control is how a player decides the game is broken.
 *
 * The first-contact controls card is prose and is counted as prose, but it is
 * excluded from the gate: it is teaching, it retires itself once every verb on
 * it has been used, and the cold-start critic requires it inside four seconds.
 *
 *   node tools/critic/density.mjs --url http://127.0.0.1:5173 [--at 36]
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/density'));
const AT = Number(arg('at', '36'));
await mkdir(OUT, { recursive: true });

/** Panels a player reads, as opposed to readouts a player glances at. */
const PROSE = ['gd-card', 'afd-plate', 'hail', 'meta-comms', 'meta-quest', 'kit-chip',
  'gd-lab', 'rift', 'fc-card', 'lex-card', 'toast', 'ses-charter', 'ses-close', 'ses-rest'];
/** Teaching that retires itself, and that the cold-start gate requires. */
const EXEMPT = ['fc-card'];

const PROBE = () => {
  const out = [];
  const root = document.getElementById('ui') || document.body;
  const boxes = [];
  const walk = (el) => {
    for (const kid of el.children) {
      const st = getComputedStyle(kid);
      if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) < 0.06) continue;
      const r = kid.getBoundingClientRect();
      if (r.width < 30 || r.height < 14) { walk(kid); continue; }
      if (r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) continue;
      const text = (kid.textContent || '').replace(/\s+/g, ' ').trim();
      // A surface is a box a reader's eye lands on: it has words, and it has a
      // ground of its own — a panel, a plate, a chip. A bare positioning
      // wrapper is not a surface, so walk through it and count what is inside.
      const painted = st.backgroundColor !== 'rgba(0, 0, 0, 0)'
        || st.backgroundImage !== 'none'
        || st.borderTopWidth !== '0px' || st.borderLeftWidth !== '0px'
        || st.backdropFilter !== 'none' || st.boxShadow !== 'none';
      if (painted && text.length > 1) {
        boxes.push({ cls: (kid.className || kid.id || kid.tagName) + '', text: text.slice(0, 70),
          x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) });
        continue;
      }
      walk(kid);
    }
  };
  walk(root);
  return boxes;
};

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--disable-gpu-vsync'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.5 });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push(e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });

// Play, rather than pose: walk toward the objective the way a learner would.
await page.waitForTimeout(2500);
await page.evaluate(() => document.getElementById('boot')?.classList.add('gone'));
await page.mouse.move(800, 450);
await page.mouse.click(800, 450);

let worst = { n: -1 };
for (let t = 4; t <= AT; t += 4) {
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(3000);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(900);
  const boxes = await page.evaluate(PROBE);
  const kind = (b) => (PROSE.some((c) => b.cls.split(/\s+/).includes(c)) ? 'prose' : 'control');
  const gated = boxes.filter((b) => kind(b) === 'prose' && !EXEMPT.some((c) => b.cls.split(/\s+/).includes(c)));
  const prose = boxes.filter((b) => kind(b) === 'prose');
  console.log(`t≈${t}s — ${gated.length} prose panels competing (${prose.length} prose incl. teaching, ${boxes.length - prose.length} controls)`);
  for (const b of boxes) console.log(`    ${kind(b) === 'prose' ? '●' : '·'} ${b.cls}  [${b.w}×${b.h} @${b.x},${b.y}]  ${b.text}`);
  if (gated.length > worst.n) { worst = { n: gated.length, t, boxes: gated }; }
  await page.screenshot({ path: path.join(OUT, `t${String(t).padStart(2, '0')}.png`) });
}
console.log(`\nWORST: ${worst.n} prose panels competing, at t≈${worst.t}s (gate: 3)`);
for (const b of worst.boxes || []) console.log(`    ● ${b.cls}  ${b.text}`);
console.log(errs.length ? `console errors: ${errs.length}` : 'no console errors');
await browser.close();
process.exit(worst.n > 3 ? 1 : 0);
