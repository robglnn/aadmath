/**
 * Rift fit probe. Opens the real rift on the real build at several viewports,
 * digs the echo to every depth, and reports every box in the panel that is
 * holding more than it shows — plus whether the commit control is on screen.
 *
 *   scratch/frozen.sh node scratch/riftfit.mjs --out shots/fit
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4791');
const OUT = path.resolve(arg('out', 'shots/fit'));
const ONLY = arg('only', '');
await mkdir(OUT, { recursive: true });

const VIEWS = [
  ['desk', 1600, 900], ['lap', 1280, 720], ['tab', 900, 700], ['phone', 414, 896], ['small', 360, 640],
];
const SKILLS = ['var-meaning', 'one-step-add', 'two-step', 'like-terms', 'distribute'];

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const bad = [];
const logs = [];

const PROBE = () => {
  const SEL = [
    '#rf-plate', '.rf-head', '.rf-foot', '.rf-stmtwrap', '.rf-statement', '.rf-stmt-in',
    '.rf-stage', '.rf-inner', '.rf-work', '.rf-pad', '.rf-socket', '.rf-keys', '.rf-key',
    '.rf-readings', '.rf-reading', '.rf-narrow', '.rf-bal', '.rf-yoke', '.rf-moves', '.rf-tray',
    '.rf-bays', '.rf-bay', '.rf-field', '.rf-cell', '.rf-assemble', '.rf-totalrow',
    '.rf-echo', '.rf-echo-body', '.rf-echo-tail', '.rf-strata', '.rf-echo-head', '.rf-frame',
    '.rf-echo-step', '.rf-echo-lead', '.rf-echo-nudge', '.rf-echo-math',
  ].join(',');
  const rift = document.querySelector('.rift');
  const plate = document.querySelector('#rf-plate');
  const out = { clip: [], scrollers: [], off: [], u: getComputedStyle(rift).getPropertyValue('--rf-u').trim() };
  const pr = plate.getBoundingClientRect();
  out.plate = { t: Math.round(pr.top), b: Math.round(pr.bottom), h: Math.round(pr.height) };
  out.win = { w: innerWidth, h: innerHeight };
  out.cls = rift.className;
  for (const el of document.querySelectorAll(SEL)) {
    if (!el.clientHeight || !el.offsetParent) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const bt = parseFloat(cs.borderTopWidth) || 0;
    const pb = parseFloat(cs.paddingBottom) || 0;
    let need = -1;
    for (const c of el.children) {
      const ccs = getComputedStyle(c);
      if (ccs.position === 'absolute' || ccs.position === 'fixed' || ccs.display === 'none') continue;
      const cr = c.getBoundingClientRect();
      if (cr.height <= 0) continue;
      need = Math.max(need, cr.bottom + (parseFloat(ccs.marginBottom) || 0) - r.top - bt + pb);
    }
    need = Math.max(need, el.scrollHeight);
    const tag = el.id ? '#' + el.id : '.' + [...el.classList].join('.');
    if (need - el.clientHeight > 1) out.clip.push({ tag, need: Math.round(need), have: el.clientHeight });
    if (el.scrollHeight - el.clientHeight > 1) out.scrollers.push({ tag, sh: el.scrollHeight, ch: el.clientHeight });
    // anything drawn outside the window at all
    if (r.height > 0 && (r.top < -1 || r.bottom > innerHeight + 1)) {
      out.off.push({ tag, t: Math.round(r.top), b: Math.round(r.bottom) });
    }
  }
  // is the commit control fully on screen?
  const commit = document.querySelector('.rf-key.commit, .rf-reading, .rf-move, .rf-chip, .rf-bay');
  if (commit) {
    const c = commit.getBoundingClientRect();
    out.commit = { tag: commit.className, t: Math.round(c.top), b: Math.round(c.bottom),
      onscreen: c.top >= -1 && c.bottom <= innerHeight + 1 && c.height > 8 };
  } else out.commit = null;
  return out;
};

for (const [vname, w, h] of VIEWS) {
  if (ONLY && !ONLY.split(',').includes(vname)) continue;
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') logs.push(vname + ': ' + m.text()); });
  page.on('pageerror', (e) => logs.push(vname + ': ' + e.message));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.getElementById('boot')?.classList.add('gone'));

  for (const skill of SKILLS) {
    await page.evaluate(() => window.__ascent.panel.close());
    const ok = await page.evaluate((s) => window.__ascent.openRiftById(s), skill);
    if (!ok) { console.log(`  ${vname}/${skill}: no rift`); continue; }
    await page.waitForTimeout(400);
    for (let tier = 0; tier <= 4; tier++) {
      if (tier === 1) {
        // drive it the way a hand does: a wrong entry, which is what puts the
        // targeted lead line at the top of the trace
        await page.evaluate(() => {
          const p = window.__ascent.panel;
          if (p._modality?.set && p._modality?.submit) { p._modality.set('97'); p._modality.submit(); }
          else p.demo('wrong');
        });
        await page.waitForTimeout(1300);
        await page.evaluate(() => window.__ascent.panel._digTo(1));
        await page.waitForTimeout(1300);
      } else if (tier > 1) {
        await page.evaluate((k) => window.__ascent.panel._digTo(k), tier);
        await page.waitForTimeout(1300);
      }
      const r = await page.evaluate(PROBE);
      const tag = `${vname}/${skill}/t${tier}`;
      const issues = [];
      if (r.clip.length) issues.push('CLIP ' + r.clip.map((c) => `${c.tag} ${c.need}>${c.have}`).join(', '));
      if (r.scrollers.length) issues.push('SCROLL ' + r.scrollers.map((c) => `${c.tag} ${c.sh}>${c.ch}`).join(', '));
      if (r.off.length) issues.push('OFFSCREEN ' + r.off.map((c) => `${c.tag} ${c.t}..${c.b}`).join(', '));
      if (r.commit && !r.commit.onscreen) issues.push(`COMMIT-OFF ${r.commit.t}..${r.commit.b} of ${r.win.h}`);
      if (issues.length) { bad.push(tag + '  [u=' + r.u + ' ' + r.cls + ']\n    ' + issues.join('\n    ')); }
      else console.log(`  ok ${tag} u=${r.u}`);
      if (tier === 2 || tier === 4) {
        await page.screenshot({ path: path.join(OUT, `${vname}-${skill}-t${tier}.png`) });
      }
      if (tier === 0) await page.screenshot({ path: path.join(OUT, `${vname}-${skill}-t0.png`) });
    }
  }
  await ctx.close();
}
await browser.close();
console.log('\n===== PROBLEMS =====');
if (!bad.length) console.log('none');
bad.forEach((b) => console.log(b));
console.log('\nconsole errors: ' + logs.length);
logs.slice(0, 10).forEach((l) => console.log('  ! ' + l));
process.exit(bad.length ? 1 : 0);
