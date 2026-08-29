/**
 * COHERENCE LANE — one fresh player, whole session, real keys, frozen build.
 * Not a gate. A play harness for a seam hunt. Nothing here makes progress
 * through window.__ascent: it walks with W, turns with the arrow keys, opens
 * with E, and answers by clicking the reading or typing the number.
 * advanceDays() is used ONLY to move the wall clock between sittings — it is
 * the one thing in this build that has one — and never to seal anything.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4917');
const OUT = path.resolve(arg('out', '/tmp/cohplay/en'));
const LOCALE = arg('locale', 'en');
const CAP_MIN = Number(arg('minutes', 30));
const PHONE = process.argv.includes('--phone');
const TOUCH = process.argv.includes('--touch');
const DAY2 = Number(arg('day2', 0));      // extra minutes of a second sitting
const THINK = Number(arg('think', 0));    // ms of thinking time per item (a human is 20-45 s)
const EXTEND = process.argv.includes('--extend');
const UNTIL_REGION = process.argv.includes('--until-region');
const W = PHONE ? 390 : 1600, H = PHONE ? 844 : 900;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  hasTouch: PHONE, isMobile: PHONE, deviceScaleFactor: PHONE ? 3 : 1,
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const log = [];
const say = (s) => { log.push(s); console.log(s); };
const shot = (n) => page.screenshot({ path: path.join(OUT, n + '.png') }).catch(() => {});

// ---------------------------------------------------------------- sampling
const SAMPLER = () => {
  const a = window.__ascent;
  const S = {
    t0: performance.now(), last: performance.now(),
    move: 0, metres: 0, still: 0, stillMax: 0, air: 0,
    px: a.player.pos.x, pz: a.player.pos.z, ax: a.player.pos.x, az: a.player.pos.z,
    verbs: {}, beats: [], phases: [], road: [], seen: {},
    work: 0, ui: 0, place: 0, traverse: 0, idle: 0,
  };
  window.__COH = S;
  const beat = (k, extra) => {
    if (S.seen[k]) return;
    S.seen[k] = true;
    S.beats.push({ k, at: +((performance.now() - S.t0) / 1000).toFixed(1), ...(extra || {}) });
  };
  const tick = (now) => {
    const dt = Math.min(0.25, (now - S.last) / 1000); S.last = now;
    try {
      const p = a.player.pos;
      const step = Math.hypot(p.x - S.px, p.z - S.pz);
      S.px = p.x; S.pz = p.z;
      const speed = step / Math.max(dt, 1e-3);
      const card = !!(a.panel && a.panel.open);
      const ui = !card && !!(a.input && a.input.uiOpen);
      if (speed > 0.6) { S.move += dt; S.metres += step; } 
      if (Math.hypot(p.x - S.ax, p.z - S.az) > 2) { S.ax = p.x; S.az = p.z; S.still = 0; }
      else { S.still += dt; if (S.still > S.stillMax) S.stillMax = S.still; }
      if (card) S.work += dt; else if (ui) S.ui += dt; else if (speed > 0.6) S.traverse += dt; else S.idle += dt;
      if (!a.player.grounded) S.air += dt;
      const st = a.player;
      for (const [k, on] of [['sprint', st.sprinting], ['glide', st.gliding], ['dash', st.dashing],
        ['vault', st.vaulting], ['updraft', st.lifted || st.onUpdraft]]) {
        if (on) S.verbs[k] = (S.verbs[k] || 0) + dt;
      }
      if ((a.builder?.pieces?.size | 0) > 0) S.verbs.build = (S.verbs.build || 0) + dt;
      // session beats, first time each is really on screen
      const vis = (sel) => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return r.width > 1 && r.height > 1 && c.visibility !== 'hidden' && Number(c.opacity) > 0.25; };
      if (vis('.ses-charter.show')) beat('orders');
      if (vis('.ses-close.show')) beat('close');
      if (vis('.ses-rest.show')) beat('rest');
      if (vis('.meta-quest')) beat('chapter');
      if (vis('.fdy')) beat('foundry');
      const ph = a.session.state().phase;
      if (!S.phases.length || S.phases[S.phases.length - 1].phase !== ph) {
        S.phases.push({ phase: ph, at: +((performance.now() - S.t0) / 1000).toFixed(1) });
      }
      const rd = a.content().road;
      const key = JSON.stringify([rd.here, rd.opened, rd.landed, rd.waiting]);
      if (!S.road.length || S.road[S.road.length - 1].key !== key) {
        S.road.push({ key, at: +((performance.now() - S.t0) / 1000).toFixed(1) });
      }
    } catch { /* mid-teardown frame is not evidence */ }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
const readSampler = () => page.evaluate(() => {
  const S = window.__COH, a = window.__ascent;
  const snap = (() => { try { return a.report.snapshot(); } catch { return {}; } })();
  return {
    secs: (performance.now() - S.t0) / 1000,
    move: S.move, metres: S.metres, stillMax: S.stillMax, air: S.air,
    verbs: { ...S.verbs }, beats: S.beats.slice(), phases: S.phases.slice(), road: S.road.slice(),
    work: S.work, ui: S.ui, traverse: S.traverse, idle: S.idle,
    sessionMs: snap.sessionMs || 0, sessionTaskMs: snap.sessionTaskMs || 0, items: snap.items || 0,
    recoveries: a.player.recoveries | 0, caught: a.player.caught | 0,
  };
});

// ------------------------------------------------------------ real playing
const panelOpen = () => page.evaluate(() => !!window.__ascent.panelInfo().open);
const uiOpen = () => page.evaluate(() => !!window.__ascent.input?.uiOpen);
const card = async () => { const c = await page.evaluate(() => window.__ascent.panelInfo()); return c && c.open ? c : null; };
const facts = () => page.evaluate(() => {
  const a = window.__ascent;
  const o = a.objective();
  const sk = a.state().skills || {};
  const held = Object.entries(sk).filter(([, v]) => v.mastered).map(([k]) => k);
  return {
    phase: a.session.state().phase,
    run: (() => { const r = a.session.state().run; if (!r) return null;
      const o = {}; for (const k of Object.keys(r)) { const v = r[k]; if (typeof v !== 'object' || v === null) o[k] = v; }
      return o; })(),
    pace: a.session.state().pace,
    road: a.content().road, units: a.content().units, nodes: a.content().nodes,
    held, objective: o, pos: { x: +a.player.pos.x.toFixed(1), z: +a.player.pos.z.toFixed(1) },
    watch: (() => { try { return a.watch(); } catch { return null; } })(),
  };
});

/**
 * Hand the frame back the way a player does — and only press what a player
 * could press. `.sr-skip` stays in the layout after the break ends with
 * `pointer-events: none` (src/session/session.css), so a harness that clicks by
 * bounding box alone loops on a control the game has correctly switched off.
 * That is a harness defect and it cost this lane one whole 26-minute sitting.
 */
const hittable = async (sel) => page.evaluate((q) => {
  const e = document.querySelector(q);
  if (!e) return false;
  const r = e.getBoundingClientRect();
  const c = getComputedStyle(e);
  if (!(r.width > 1 && r.height > 1)) return false;
  if (c.display === 'none' || c.visibility === 'hidden') return false;
  if (Number(c.opacity) < 0.05 || c.pointerEvents === 'none') return false;
  const mid = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
  return !!mid && (mid === e || e.contains(mid) || mid.contains(e));
}, sel);

async function dismiss() {
  // the pause menu first: Escape opens it whenever nothing else owns the glass,
  // so a harness that presses Escape has to be able to put it away again.
  if (await page.evaluate(() => !!window.__ascent.menu?.open)) {
    for (const sel of ['.mnu.show .mnu-close', '.mnu.show .mnu-resume', '.mnu.show .mnu-back']) {
      if (await hittable(sel)) { await page.locator(sel).first().click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(350); return sel; }
    }
    await page.keyboard.press('Escape'); await page.waitForTimeout(350); return 'menu:escape';
  }
  for (const sel of ['.fdy .fdy-close', '.ses-charter.show .sc-go',
    ...(EXTEND ? ['.ses-close.show .sx-more'] : []), '.ses-close.show .sx-rest',
    '.ses-rest.show .sr-again', '.ses-rest.show .sr-off-frame button',
    '.ses-rest.show .sr-skip', '.rf-x']) {
    if (await hittable(sel)) {
      await page.locator(sel).first().click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(450);
      return sel;
    }
  }
  return null;
}

let held = false;
const forward = async (on) => {
  if (on === held) return; held = on;
  if (TOUCH) return;               // touch pad is driven separately
  if (on) await page.keyboard.down('KeyW'); else await page.keyboard.up('KeyW');
};

async function walkAndKnock(budgetMs = 45000) {
  const t0 = Date.now();
  if (!TOUCH) await page.keyboard.press('KeyE');
  if (await panelOpen()) return true;
  const cx = Math.round(W / 2);
  try {
    while (Date.now() - t0 < budgetMs) {
      const w = await page.evaluate((half) => {
        const a = window.__ascent, Wd = a.world, T = a.THREE;
        const o = a.objective && a.objective();
        if (!o) return null;
        const p = a.player.pos;
        const hd = Wd.headingTo(p.x, p.z, o.x, o.z);
        const fwd = new T.Vector3(); a.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
        const dir = new T.Vector3(Math.sin(hd.yaw), 0, Math.cos(hd.yaw));
        const ang = Math.atan2(fwd.x * dir.z - fwd.z * dir.x, fwd.dot(dir));
        return { x: half + Math.max(-1, Math.min(1, ang / 0.8)) * half * 0.9, edge: Math.abs(ang) > 0.8,
          dist: Math.hypot(o.x - p.x, o.z - p.z) };
      }, cx);
      if (w) {
        const off = w.x - cx;
        if (Math.abs(off) > 40 || w.edge) {
          const k = off > 0 ? 'ArrowRight' : 'ArrowLeft';
          if (TOUCH) { await touchLook(off > 0 ? 1 : -1); }
          else { await page.keyboard.down(k); await page.waitForTimeout(Math.min(320, Math.max(45, (Math.abs(off) / cx) * 340))); await page.keyboard.up(k); }
        }
      }
      if (TOUCH) await touchWalk(700); else { await forward(true); await page.waitForTimeout(140); }
      for (let j = 0; j < 3; j++) {
        if (!TOUCH) await page.keyboard.press('KeyE'); else await touchAct();
        if (await panelOpen()) { await forward(false); return true; }
        await page.waitForTimeout(120);
      }
      if (await dismiss()) { await forward(false); }
      if (!w) {
        if (TOUCH) await touchLook(1);
        else { await page.keyboard.down('ArrowRight'); await page.waitForTimeout(240); await page.keyboard.up('ArrowRight'); }
      }
    }
  } finally { await forward(false); }
  return false;
}

// --- touch driving: the real pad, real touch events -------------------------
const padBox = async (sel) => page.evaluate((s) => {
  const e = document.querySelector(s); if (!e) return null;
  const r = e.getBoundingClientRect();
  const c = getComputedStyle(e);
  if (!(r.width > 1 && r.height > 1) || c.visibility === 'hidden' || Number(c.opacity) < 0.05) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
}, sel);
let PADSEL = null, LOOKSEL = null;
async function touchWalk(ms) {
  if (!PADSEL) return;
  const b = await padBox(PADSEL); if (!b) return;
  await page.touchscreen.tap(b.x, b.y).catch(() => {});
  // a real drag on the stick: down, move up (forward), hold, up
  await page.evaluate(async ({ x, y, ms: d }) => {
    const el = document.elementFromPoint(x, y); if (!el) return;
    const mk = (type, cx, cy) => { const tt = new Touch({ identifier: 7, target: el, clientX: cx, clientY: cy }); return new TouchEvent(type, { touches: type === 'touchend' ? [] : [tt], targetTouches: type === 'touchend' ? [] : [tt], changedTouches: [tt], bubbles: true, cancelable: true }); };
    el.dispatchEvent(mk('touchstart', x, y));
    el.dispatchEvent(mk('touchmove', x, y - 46));
    await new Promise((r) => setTimeout(r, d));
    el.dispatchEvent(mk('touchend', x, y - 46));
  }, { x: b.x, y: b.y, ms });
}
async function touchLook(dir) {
  const b = LOOKSEL ? await padBox(LOOKSEL) : null;
  const x = b ? b.x : Math.round(W * 0.72), y = b ? b.y : Math.round(H * 0.42);
  await page.evaluate(async ({ x, y, dir }) => {
    const el = document.elementFromPoint(x, y); if (!el) return;
    const mk = (type, cx, cy) => { const tt = new Touch({ identifier: 8, target: el, clientX: cx, clientY: cy }); return new TouchEvent(type, { touches: type === 'touchend' ? [] : [tt], targetTouches: type === 'touchend' ? [] : [tt], changedTouches: [tt], bubbles: true, cancelable: true }); };
    el.dispatchEvent(mk('touchstart', x, y));
    for (let i = 1; i <= 6; i++) { el.dispatchEvent(mk('touchmove', x + dir * i * 9, y)); await new Promise((r) => setTimeout(r, 16)); }
    el.dispatchEvent(mk('touchend', x + dir * 54, y));
  }, { x, y, dir });
}
async function touchAct() {
  for (const s of ['.tp-act', '.tp-e', '[data-touch="act"]', '.tp-btn.act']) {
    const b = await padBox(s); if (b) { await page.touchscreen.tap(b.x, b.y).catch(() => {}); return true; }
  }
  return false;
}

async function answer(c, wrong) {
  if (c.mode === 'choice') {
    const btns = page.locator('.rf-reading');
    const n = await btns.count(); if (!n) return false;
    let want = 0;
    for (let i = 0; i < n; i++) {
      const v = await btns.nth(i).getAttribute('data-value');
      if ((String(v) === String(c.answer)) !== wrong) { want = i; break; }
    }
    const el = btns.nth(want);
    if (PHONE) { const bb = await el.boundingBox().catch(() => null); if (bb) await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2).catch(() => {}); else await el.click({ timeout: 4000 }).catch(() => {}); }
    else await el.click({ timeout: 5000 }).catch(() => {});
    return true;
  }
  if (c.mode === 'keypad') {
    let s = String(c.answer ?? '');
    if (wrong) s = /^-?\d+$/.test(s) ? String(Number(s) + 1) : (s + '1');
    if (!s) return false;
    if (PHONE) {
      // tap the on-screen keys the way a thumb does
      for (const ch of s) {
        const k = page.locator(`.rf-key[data-k="${ch}"], .rf-key:text-is("${ch}")`).first();
        if (await k.count()) { const bb = await k.boundingBox().catch(() => null); if (bb) { await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2).catch(() => {}); await page.waitForTimeout(60); continue; } }
        await page.keyboard.press(ch === '-' ? 'Minus' : ch === '/' ? 'Slash' : ch);
      }
      const go = page.locator('.rf-key.go, .rf-key.enter, .rf-key[data-k="enter"]').first();
      if (await go.count()) { const bb = await go.boundingBox().catch(() => null); if (bb) await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2).catch(() => {}); else await page.keyboard.press('Enter'); }
      else await page.keyboard.press('Enter');
      return true;
    }
    for (const ch of s) {
      if (ch === '-') await page.keyboard.press('Minus');
      else if (ch === '/') await page.keyboard.press('Slash');
      else if (ch === '+') await page.keyboard.press('Equal');
      else if (ch === '^') await page.keyboard.press('Digit6');
      else await page.keyboard.press(ch);
      await page.waitForTimeout(30);
    }
    await page.keyboard.press('Enter');
    return true;
  }
  const any = page.locator('.rf-move, .rf-chip, .rf-bay, .ans, .rf-cell').first();
  if (await any.count()) { await any.click({ timeout: 5000 }).catch(() => {}); return true; }
  return false;
}

// --------------------------------------------------------------- the sitting

/** Switch language the way a player does: the globe on the menu handle, then
    the settings card's first row. There is no locale plate on the glass any
    more (src/ui/hud.js) — it moved into the pause menu. */
async function setLocale(page, loc) {
  if (loc === 'en') return 'en (default)';
  const clickLang = async () => page.evaluate((l) => {
    const b = document.querySelector(`.langs button[data-loc="${l}"]`);
    if (!b) return 'no-button';
    const r = b.getBoundingClientRect(); const c = getComputedStyle(b);
    if (!(r.width > 1 && r.height > 1) || c.visibility === 'hidden' || Number(c.opacity) < 0.05) return 'not-visible';
    b.click(); return 'clicked';
  }, loc);
  let r = await clickLang();
  if (r !== 'clicked') {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(900);
    r = await clickLang();
    await page.waitForTimeout(700);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(900);
  const got = await page.evaluate(() => window.__ascent.locale());
  return `${r}; the game is now in ${got}`;
}

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
await page.waitForTimeout(4500);
say(`  locale ${LOCALE}: ${await setLocale(page, LOCALE)}`);
await page.waitForTimeout(1200);
if (TOUCH) {
  PADSEL = await page.evaluate(() => {
    for (const s of ['.tp-stick', '.tp-move', '.touchpad .stick', '#touchpad .stick', '.tp-pad']) if (document.querySelector(s)) return s;
    return null;
  });
  LOOKSEL = await page.evaluate(() => {
    for (const s of ['.tp-look', '.touchpad .look', '.tp-right']) if (document.querySelector(s)) return s;
    return null;
  });
  say(`  touch pad: stick=${PADSEL || 'NONE'} look=${LOOKSEL || 'NONE'}`);
}
await page.evaluate(SAMPLER);
await shot('00-arrival');
say(`  arrival: ${JSON.stringify(await facts()).slice(0, 400)}`);

// hand the frame back the way a player does
await dismiss();
if (!PHONE) { await page.mouse.click(Math.round(W / 2), Math.round(H / 2)); await page.waitForTimeout(400); }

const t0 = Date.now();
const deadline = t0 + CAP_MIN * 60000;
let n = 0, walks = 0, wrongs = 0;
const items = [];
let closedAt = null, restSeen = false, regionSeen = null, lastBeat = -99;
const out0 = {};
const marks = [];
while (Date.now() < deadline) {
  const secs = Math.round((Date.now() - t0) / 1000);
  if (secs - lastBeat >= 30) {
    lastBeat = secs;
    const hb = await page.evaluate(() => {
      const a = window.__ascent;
      const up = [...document.querySelectorAll('.ses-charter, .ses-close, .ses-rest, .fdy, .mnu, .rf')]
        .filter((e) => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return r.width > 1 && r.height > 1 && c.display !== 'none' && c.visibility !== 'hidden' && Number(c.opacity) > 0.2; })
        .map((e) => e.className);
      const o = a.objective();
      const p = a.player.pos;
      return { phase: a.session.state().phase, ui: !!a.input.uiOpen, panel: !!a.panelInfo().open,
        up, obj: o ? { id: o.id, d: +Math.hypot(o.x - p.x, o.z - p.z).toFixed(1), spent: o.spent, verb: o.verb } : null,
        pos: [+p.x.toFixed(1), +p.z.toFixed(1)] };
    });
    say(`  hb ${(secs / 60).toFixed(1)}min items=${n} walks=${walks} ${JSON.stringify(hb)}`);
  }
  if (await dismiss()) { /* a beat was taken */ }
  const f0 = await page.evaluate(() => { const s = window.__ascent.session.state(); return { phase: s.phase, resting: s.resting, ending: s.ending }; });
  if (!closedAt && (f0.phase === 'close' || f0.phase === 'rest' || f0.resting)) {
    closedAt = secs;
    const cc = await page.evaluate(() => {
      const e = document.querySelector('.ses-close.show') || document.querySelector('.ses-rest.show');
      return e ? e.innerText.slice(0, 2600) : null;
    });
    const fr = await facts();
    say(`  ** the session closed itself at ${(secs / 60).toFixed(1)} min (phase ${f0.phase}) run=${JSON.stringify(fr.run)}`);
    out0.closeCard = cc; out0.closeFacts = fr;
    say('  ---- CLOSE CARD ----\n' + (cc || '(nothing on screen)'));
    await shot('20-close');
  }
  if (!restSeen) {
    const rc = await page.evaluate(() => { const e = document.querySelector('.ses-rest.show'); return e ? e.innerText.slice(0, 1800) : null; });
    if (rc) { restSeen = true; out0.restCard = rc; say('  ---- REST/BREAK BEAT ----\n' + rc); await shot('21-rest'); }
  }
  if (!regionSeen) {
    const rr = await page.evaluate(() => {
      const rd = window.__ascent.content().road;
      return (rd.opened && rd.opened.length) || (rd.landed && rd.landed.length > 1) ? rd : null;
    });
    if (rr) { regionSeen = secs; out0.regionAt = secs; out0.regionRoad = rr;
      say(`  ** THE SECOND REGION OPENED at ${(secs / 60).toFixed(1)} min: ${JSON.stringify(rr)}`);
      const bt = await page.evaluate(() => (document.getElementById('ui')?.innerText || '').slice(0, 2200));
      out0.regionText = bt; await shot('25-region'); }
  }
  if (UNTIL_REGION && regionSeen && secs - regionSeen > 90) { say('  (stopping: the region opened and 90s of it has been played)'); break; }
  if (!(await panelOpen())) {
    const t1 = Date.now(); let got = false;
    while (Date.now() - t1 < 2600) { if (await panelOpen()) { got = true; break; } await page.waitForTimeout(180); }
    if (!got) { walks++; await walkAndKnock(45000); }
    if (!(await panelOpen())) continue;
  }
  const c = await card();
  if (!c) { await page.waitForTimeout(200); continue; }
  if (c.settled) { const t1 = Date.now(); while ((await panelOpen()) && Date.now() - t1 < 4000) await page.waitForTimeout(200); continue; }
  n++;
  const wrong = (n % 11 === 4);
  if (wrong) wrongs++;
  await answer(c, wrong);
  items.push({ n, at: secs, skill: c.skill, mode: c.mode, form: c.form, kind: c.kind, mastered: c.masteredWhenServed, wrong });
  if (n === 1) { await page.waitForTimeout(500); await shot('01-first-item'); }
  if (n === 12) await shot('02-mid');
  await page.waitForTimeout(700 + THINK);
  if (await panelOpen()) {
    if (await page.evaluate(() => !!window.__ascent.panelInfo().settled)) {
      const t1 = Date.now(); while (await panelOpen() && Date.now() - t1 < 3600) await page.waitForTimeout(200);
    } else { await page.waitForTimeout(600); if (await hittable('.rf-x')) await page.locator('.rf-x').first().click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(250); }
  }
  if (n % 10 === 0) {
    const f = await facts();
    marks.push({ n, at: secs, held: f.held.length, road: f.road, run: f.run });
    say(`  ..${(secs / 60).toFixed(1)}min  items=${n}  held=${f.held.length}/${f.nodes ? f.nodes.length : '?'}  road=${JSON.stringify(f.road)}`);
  }
}
await forward(false);
for (let k = 0; k < 8; k++) { if (!(await dismiss())) break; }
await shot('10-last-frame');

const S = await readSampler();
const F = await facts();
const ENDTEXT = await page.evaluate(() => (document.getElementById('ui')?.innerText || '').slice(0, 4000));

const out = {
  ...out0,
  locale: LOCALE, phone: PHONE, touch: TOUCH, capMinutes: CAP_MIN, think: THINK,
  wallSecs: (Date.now() - t0) / 1000, items: n, wrongs, walks, closedAt,
  sampler: S, facts: F, itemsLog: items, marks, errors,
};

// ---- a second sitting, tomorrow -------------------------------------------
if (DAY2 > 0) {
  say('\n  --- it is tomorrow ---');
  const adv = await page.evaluate(() => window.__ascent.advanceDays(1));
  say(`  advanceDays -> ${JSON.stringify(adv).slice(0, 300)}`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
  await page.waitForTimeout(4500);
  await page.evaluate(SAMPLER);
  await shot('30-day2-arrival');
  const f2a = await facts();
  say(`  day2 arrival: phase=${f2a.phase} held=${f2a.held.length} watch=${JSON.stringify(f2a.watch).slice(0, 200)}`);
  say(`  day2 road: ${JSON.stringify(f2a.road)}`);
  await dismiss();
  if (!PHONE) { await page.mouse.click(Math.round(W / 2), Math.round(H / 2)); await page.waitForTimeout(400); }
  const t2 = Date.now(); const dl2 = t2 + DAY2 * 60000;
  let n2 = 0; const items2 = [];
  while (Date.now() < dl2) {
    await dismiss();
    if (!(await panelOpen())) { if (!(await walkAndKnock(40000))) continue; }
    const c = await card(); if (!c) { await page.waitForTimeout(200); continue; }
    if (c.settled) { await page.waitForTimeout(1200); continue; }
    n2++; await answer(c, false);
    items2.push({ n: n2, skill: c.skill, kind: c.kind, reprobe: c.reprobe, mastered: c.masteredWhenServed });
    await page.waitForTimeout(900);
    if (await panelOpen() && !(await page.evaluate(() => !!window.__ascent.panelInfo().settled))) { if (await hittable('.rf-x')) await page.locator('.rf-x').first().click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(250); }
  }
  await shot('31-day2-play');
  out.day2 = { items: n2, itemsLog: items2, sampler: await readSampler(), facts: await facts() };
  say(`  day2: ${n2} items, held=${out.day2.facts.held.length}, road=${JSON.stringify(out.day2.facts.road)}`);
}

out.uiTextTail = ENDTEXT;
await writeFile(path.join(OUT, 'report.json'), JSON.stringify(out, null, 1));
say(`\n  items=${n} wrongs=${wrongs} walks=${walks} wall=${(out.wallSecs / 60).toFixed(1)}min closedAt=${closedAt === null ? 'NEVER' : (closedAt / 60).toFixed(1) + 'min'}`);
say(`  moved ${S.move.toFixed(0)}s, ${S.metres.toFixed(0)} m, longest still ${S.stillMax.toFixed(0)}s, verbs ${JSON.stringify(S.verbs)}`);
say(`  work ${S.work.toFixed(0)}s  traverse ${S.traverse.toFixed(0)}s  ui ${S.ui.toFixed(0)}s  idle ${S.idle.toFixed(0)}s`);
say(`  beats: ${JSON.stringify(S.beats)}`);
say(`  phases: ${JSON.stringify(S.phases)}`);
say(`  road: ${JSON.stringify(S.road)}`);
say(`  game's own clock: task ${(S.sessionTaskMs / 60000).toFixed(1)} min of session ${(S.sessionMs / 60000).toFixed(1)} min, ${S.items} items`);
say(`  held ${F.held.length}: ${F.held.join(' ')}`);
say(`  ERRORS: ${errors.length ? errors.slice(0, 8).join(' | ') : 'none'}`);
await browser.close();
