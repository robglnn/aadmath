/**
 * Exhaustive fit sweep for the rift surface.
 *
 * Every skill x every item form x every locale x several viewports, with the
 * echo shut and then dug to every depth. Reports any box in the panel holding
 * more than it shows, anything drawn off the window, and whether the control
 * that ends the turn is on screen and hittable.
 *
 *   scratch/frozen.sh node scratch/riftsweep.mjs --out shots/sweep
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4791');
const OUT = path.resolve(arg('out', 'shots/sweep'));
const LOCS = arg('loc', 'en,es,pl').split(',');
const ONLY = arg('only', '');
const SHOTS = arg('shots', '') === '1';
await mkdir(OUT, { recursive: true });

const VIEWS = [
  ['phone', 414, 896], ['lap', 1280, 720], ['desk', 1600, 900], ['tab', 900, 700], ['small', 360, 640],
];
const TIERS = arg('tiers', '0,1,2,4').split(',').map(Number);

const PROBE = () => {
  const SEL = [
    '#rf-plate', '.rf-head', '.rf-foot', '.rf-stmtwrap', '.rf-statement', '.rf-stmt-in',
    '.rf-stage', '.rf-inner', '.rf-work', '.rf-pad', '.rf-socket', '.rf-keys', '.rf-key',
    '.rf-readings', '.rf-reading', '.rf-narrow', '.rf-bal', '.rf-yoke', '.rf-moves', '.rf-tray',
    '.rf-bays', '.rf-bay', '.rf-field', '.rf-cell', '.rf-assemble', '.rf-totalrow',
    '.rf-echo', '.rf-echo-body', '.rf-echo-tail', '.rf-strata', '.rf-echo-head', '.rf-frame',
    '.rf-echo-step', '.rf-echo-lead', '.rf-echo-nudge', '.rf-figbox',
  ].join(',');
  const rift = document.querySelector('.rift');
  const plate = document.querySelector('#rf-plate');
  if (!plate) return { fatal: 'no plate' };
  const out = { clip: [], off: [], u: +getComputedStyle(rift).getPropertyValue('--rf-u'), cls: rift.className };
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
    if (need - el.clientHeight > 1.5) out.clip.push(`${tag} ${Math.round(need)}>${el.clientHeight}`);
    if (r.top < -1 || r.bottom > innerHeight + 1) out.off.push(`${tag} ${Math.round(r.top)}..${Math.round(r.bottom)}`);
  }
  // and the same question across: a readout whose right-hand end is off its rail
  out.cut = [];
  for (const el of document.querySelectorAll('.rf-echo-math, #rf-prompt, .rf-socket .val, .bal-pan .plate, .pan-read, .rf-assemble, .rf-reading, .rf-key, .rf-move, .rf-chip')) {
    if (!el.clientWidth || !el.offsetParent) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const pr = parseFloat(cs.paddingRight) || 0;
    let w = 0;
    for (const c of el.children) {
      const ccs = getComputedStyle(c);
      if (ccs.display === 'none' || ccs.position === 'absolute') continue;
      const cr = c.getBoundingClientRect();
      if (cr.width <= 0) continue;
      w = Math.max(w, cr.right - r.left + pr);
    }
    w = Math.max(w, el.scrollWidth);
    if (w - el.clientWidth > 2) out.cut.push(`${el.className.split(' ')[0]} ${Math.round(w)}>${el.clientWidth}`);
  }
  // The control that ends the turn, whatever the modality is. It must be on
  // screen, at a size a thumb can hit, and not covered by anything.
  const end = document.querySelector('.rf-key.commit, .rf-readings .rf-reading, .rf-move, .rf-chip, .rf-cell');
  if (end) {
    const c = end.getBoundingClientRect();
    const cx = c.left + c.width / 2, cy = c.top + c.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    out.end = {
      tag: end.className.split(' ')[0], h: Math.round(c.height),
      on: c.top >= -1 && c.bottom <= innerHeight + 1 && c.height >= 22,
      hittable: !!hit && (end === hit || end.contains(hit)),
    };
  } else out.end = { tag: 'none', on: false, hittable: false, h: 0 };
  return out;
};

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const bad = [];
const errs = [];
let checks = 0;

const JOBS = [];
for (const [vname, w, h] of VIEWS) {
  if (ONLY && !ONLY.split(',').includes(vname)) continue;
  for (const loc of LOCS) JOBS.push([vname, w, h, loc]);
}

async function run([vname, w, h, loc]) {
  {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript((l) => { try { localStorage.setItem('ascent.locale', l); } catch {} }, loc);
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errs.push(`${vname}/${loc}: ${m.text()}`); });
    page.on('pageerror', (e) => errs.push(`${vname}/${loc}: ${e.message}`));
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__ascent, null, { timeout: 90000 });
    await page.waitForTimeout(2400);
    await page.evaluate(() => document.getElementById('boot')?.classList.add('gone'));

    const plan = await page.evaluate(() => {
      const f = window.__ascent.formsBySkill;
      const out = [];
      for (const [skill, forms] of Object.entries(f)) for (const fm of forms) out.push([skill, fm.id, fm.dMax]);
      return out;
    });

    for (const [skill, form, dMax] of plan) {
      let shown = false;
      for (let attempt = 0; attempt < 3 && !shown; attempt++) {
        shown = await page.evaluate(([s, fm, d, a]) => {
          try {
            window.__ascent.panel.close();
            window.__ascent.showItem(s, { form: fm, difficulty: d, seed: 1000 + a * 7919 });
            return true;
          } catch { return false; }
        }, [skill, form, dMax, attempt]);
      }
      if (!shown) { bad.push(`${vname}/${loc}/${skill}/${form}: could not be shown`); continue; }
      await page.waitForTimeout(550);
      let cur = 0;
      for (const tier of TIERS) {
        if (tier === 1 && cur === 0) {
          await page.evaluate(() => {
            const p = window.__ascent.panel;
            if (p._modality?.set && p._modality?.submit) { p._modality.set('97'); p._modality.submit(); }
            else p.demo('wrong');
          });
          await page.waitForTimeout(950);
        } else if (tier > cur) {
          await page.evaluate((k) => window.__ascent.panel._digTo(k), tier);
          await page.waitForTimeout(950);
        }
        cur = tier;
        const r = await page.evaluate(PROBE);
        checks++;
        const tag = `${vname}/${loc}/${skill}/${form}/t${tier}`;
        const iss = [];
        if (r.fatal) iss.push(r.fatal);
        if (r.clip?.length) iss.push('CLIP ' + r.clip.join(', '));
        if (r.off?.length) iss.push('OFF ' + r.off.join(', '));
        if (r.cut?.length) iss.push('CUT-ACROSS ' + r.cut.join(', '));
        if (r.end && !r.end.on) iss.push(`END-OFF ${r.end.tag} h=${r.end.h}`);
        else if (r.end && !r.end.hittable) iss.push(`END-COVERED ${r.end.tag}`);
        if (iss.length) {
          bad.push(`${tag} [u=${(r.u || 0).toFixed(2)} ${r.cls}]\n    ${iss.join('\n    ')}`);
          if (SHOTS) await page.screenshot({ path: path.join(OUT, `${tag.replace(/\//g, '-')}.png`) });
        }
      }
    }
    await ctx.close();
  }
}

const LANES = Number(arg('lanes', 4));
let next = 0;
await Promise.all(Array.from({ length: LANES }, async () => {
  while (next < JOBS.length) {
    const job = JOBS[next++];
    process.stderr.write(`-> ${job[0]}/${job[3]}\n`);
    await run(job);
    process.stderr.write(`<- ${job[0]}/${job[3]}\n`);
  }
}));
await browser.close();
console.log(`checked ${checks} states`);
console.log('===== PROBLEMS (' + bad.length + ') =====');
bad.forEach((b) => console.log(b));
console.log('console errors: ' + errs.length);
[...new Set(errs)].slice(0, 10).forEach((l) => console.log('  ! ' + l));
process.exit(bad.length ? 1 : 0);
