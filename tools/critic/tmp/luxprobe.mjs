/**
 * Rift-only probe: drives the real panel, hunts for ANY clipped/scrolling box,
 * and shoots the frames the critic shot.
 *
 *   node tools/critic/tmp/luxprobe.mjs --url http://127.0.0.1:PORT --out shots/x
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/probe'));
const LOC = arg('loc', 'en');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});

const SKILLS = (arg('skills', 'var-meaning,one-step-add,two-step,like-terms,distribute')).split(',');
const SIZES = (arg('sizes', '1600x900,1280x720,414x896')).split(',').map((s) => s.split('x').map(Number));
const problems = [];
const logs = [];

const OVERFLOW = () => {
  const out = [];
  const root = document.querySelector('.rift');
  if (!root) return out;
  for (const el of root.querySelectorAll('*')) {
    if (el.closest('.katex') || el.tagName === 'svg' || el.ownerSVGElement) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
    const dy = el.scrollHeight - el.clientHeight;
    const dx = el.scrollWidth - el.clientWidth;
    const clips = cs.overflowY !== 'visible' || cs.overflowX !== 'visible';
    if (clips && (dy > 2 || dx > 2)) {
      out.push({
        sel: (typeof el.className === 'string' && el.className) ? '.' + el.className.trim().split(/\s+/).join('.') : el.tagName,
        dy, dx, ovy: cs.overflowY, h: el.clientHeight, sh: el.scrollHeight,
      });
    }
  }
  const de = document.documentElement;
  if (de.scrollHeight - de.clientHeight > 1) out.push({ sel: 'html', dy: de.scrollHeight - de.clientHeight, dx: 0 });
  return out;
};

for (const [W, H] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') logs.push(`${W}x${H} ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`${W}x${H} PAGEERROR ${e.message}`));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
  await page.waitForTimeout(2200);
  if (LOC !== 'en') {
    await page.evaluate((l) => document.querySelector(`.langs [data-loc="${l}"]`)?.click(), LOC);
    await page.waitForTimeout(400);
    await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
    await page.waitForTimeout(1800);
  }
  await page.evaluate(() => document.getElementById('boot')?.classList.add('gone'));

  for (const skill of SKILLS) {
    await page.evaluate(() => window.__ascent.panel.close());
    await page.evaluate((s) => window.__ascent.openRiftById(s), skill);
    await page.waitForTimeout(1300);
    const mode = await page.evaluate(() => window.__ascent.panel.mode);
    let bad = await page.evaluate(OVERFLOW);
    if (bad.length) problems.push({ where: `${W}x${H} ${skill}(${mode}) fresh`, bad });
    await page.screenshot({ path: path.join(OUT, `${W}-${skill}-a.png`) });

    await page.evaluate(() => window.__ascent.panel.demo('wrong'));
    await page.waitForTimeout(900);
    bad = await page.evaluate(OVERFLOW);
    if (bad.length) problems.push({ where: `${W}x${H} ${skill}(${mode}) echo1`, bad });
    await page.screenshot({ path: path.join(OUT, `${W}-${skill}-b-echo1.png`) });

    for (const d of [2, 3, 4]) {
      await page.evaluate((k) => window.__ascent.panel._digTo(k), d);
      await page.waitForTimeout(650);
      bad = await page.evaluate(OVERFLOW);
      if (bad.length) problems.push({ where: `${W}x${H} ${skill}(${mode}) echo${d}`, bad });
      if (d === 4 || d === 2) await page.screenshot({ path: path.join(OUT, `${W}-${skill}-c-echo${d}.png`) });
    }

    const kx = await page.evaluate(() => ({
      err: document.querySelectorAll('.rift .katex-error').length,
      n: document.querySelectorAll('.rift .katex').length,
    }));
    if (kx.err || !kx.n) problems.push({ where: `${W}x${H} ${skill} katex`, bad: kx });
  }
  await ctx.close();
}

await writeFile(path.join(OUT, 'probe.json'), JSON.stringify({ problems, logs }, null, 2));
console.log(`problems: ${problems.length}   console errors: ${logs.length}`);
for (const l of logs.slice(0, 8)) console.log('  ! ' + l);
for (const p of problems.slice(0, 60)) console.log(p.where, JSON.stringify(p.bad).slice(0, 300));
await browser.close();
