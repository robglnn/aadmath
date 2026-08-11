/** Do the bought verbs do anything in real pixels, and does the rite collide with the card on a phone? */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const URL = 'http://127.0.0.1:4788';
const OUT = 'shots/critfun-verbs';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const errors = [];
const out = {};

// ---------------------------------------------------------------- desktop
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push('desktop: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('desktop: ' + e.message));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(2500);

  // earn the whole ladder by playing the real loop
  await page.evaluate(async () => {
    const A = window.__ascent;
    for (let i = 0; i < 130; i++) {
      try { A.panel.close(); } catch { /* */ }
      const task = A.nextObjective();
      if (!task) break;
      if (!A.openRiftById(task.id)) continue;
      await new Promise((r) => setTimeout(r, 30));
      if (!A.panel.open) continue;
      A.enter(A.panel.item.answer);
      await new Promise((r) => setTimeout(r, 50));
    }
    try { A.panel.close(); } catch { /* */ }
    A.kit.sync();
  });
  await page.waitForTimeout(1500);
  out.kit = await page.evaluate(() => window.__ascent.kit.state());
  out.shards0 = await page.evaluate(() => window.__ascent.state().shards);

  // ---- BEACON: plant one and photograph the column that is now standing
  await page.evaluate(() => {
    const A = window.__ascent;
    A.player.pos.set(0, (A.islandAt(0, 34) ?? 10) + 1.2, 34);
    A.player.vel.set(0, 0, 0); A.player.yaw = 0; A.player.pitch = 0.02;
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/beacon-before.png` });
  out.beacon = await page.evaluate(() => {
    const A = window.__ascent;
    const s0 = A.state().shards; const c0 = A.drift.columns.length;
    const ok = A.kit.beacon();
    return { ok, spent: s0 - A.state().shards, columns: A.drift.columns.length - c0 };
  });
  await page.waitForTimeout(900);
  // step back and look at it
  await page.evaluate(() => {
    const A = window.__ascent;
    A.player.pos.set(0, (A.islandAt(0, 62) ?? 10) + 2, 62);
    A.player.pitch = -0.12;
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/beacon-after.png` });

  // does the column actually lift the cadet?
  out.lift = await page.evaluate(async () => {
    const A = window.__ascent;
    A.player.pos.set(0, (A.islandAt(0, 34) ?? 10) + 1.2, 34);
    A.player.vel.set(0, 0, 0);
    const y0 = A.player.pos.y;
    await new Promise((r) => setTimeout(r, 2600));
    return { y0: +y0.toFixed(1), y1: +A.player.pos.y.toFixed(1) };
  });
  await page.screenshot({ path: `${OUT}/beacon-riding.png` });

  // ---- VAULT PLATE: set one and be thrown by it
  out.vault = await page.evaluate(async () => {
    const A = window.__ascent;
    A.player.pos.set(-6, (A.islandAt(-6, 30) ?? 10) + 1.2, 30);
    A.player.vel.set(0, 0, 0);
    A.kit.vault();
    const placed = A.build();
    await new Promise((r) => setTimeout(r, 500));
    const y0 = A.player.pos.y;
    let peak = y0;
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 50));
      peak = Math.max(peak, A.player.pos.y);
    }
    return { placed: !!placed, y0: +y0.toFixed(1), peak: +peak.toFixed(1), gain: +(peak - y0).toFixed(1) };
  });
  await page.screenshot({ path: `${OUT}/vault.png` });

  // ---- FLARE
  out.flare = await page.evaluate(async () => {
    const A = window.__ascent;
    A.player.pos.set(14, (A.islandAt(14, 30) ?? 10) + 1.2, 30);
    A.player.vel.set(0, 0, 0);
    const s0 = A.state().shards;
    const ok = A.kit.flare();
    await new Promise((r) => setTimeout(r, 1400));
    return { ok, spent: s0 - A.state().shards, y: +A.player.pos.y.toFixed(1) };
  });
  await page.screenshot({ path: `${OUT}/flare.png` });

  // what is left to want, once everything is held
  out.after = await page.evaluate(() => ({
    kit: window.__ascent.kit.state(), shards: window.__ascent.state().shards,
    caches: window.__ascent.caches.state(), session: window.__ascent.state().session,
  }));
  await ctx.close();
}

// ------------------------------------------------------------------ phone
for (const [w, h] of [[390, 844], [414, 896]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${w}: ` + m.text()); });
  page.on('pageerror', (e) => errors.push(`${w}: ` + e.message));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(3000);
  // quiet state: no rite, no toast — just the game as it stands after some play
  await page.evaluate(async () => {
    const A = window.__ascent;
    for (let i = 0; i < 40; i++) {
      try { A.panel.close(); } catch { /* */ }
      const task = A.nextObjective();
      if (!task) break;
      if (!A.openRiftById(task.id)) continue;
      await new Promise((r) => setTimeout(r, 30));
      if (!A.panel.open) continue;
      A.enter(A.panel.item.answer);
      await new Promise((r) => setTimeout(r, 50));
    }
    try { A.panel.close(); } catch { /* */ }
  });
  await page.waitForTimeout(9000); // let every celebration clear
  await page.screenshot({ path: `${OUT}/${w}-quiet.png` });
  const quiet = await page.evaluate(() => {
    const bad = [];
    const vis = (el) => {
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.2;
    };
    const nodes = [...document.querySelectorAll('body *')].filter((el) => {
      if (!vis(el)) return false;
      if (!el.closest('.hud, .kit, .meta-quest, .field-tags, .ses-charter, .comms, .meta-comms')) return false;
      const txt = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      const r = el.getBoundingClientRect();
      return txt && r.width > 4 && r.height > 4;
    });
    for (const el of nodes) {
      const r = el.getBoundingClientRect();
      if (r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1 || r.top < -1) {
        bad.push({ kind: 'offscreen', cls: el.className?.toString().slice(0, 30), t: el.textContent.trim().slice(0, 30), r: [r.x | 0, r.y | 0, r.width | 0, r.height | 0] });
      }
      if (el.scrollWidth > el.clientWidth + 2) bad.push({ kind: 'clipped', cls: el.className?.toString().slice(0, 30), t: el.textContent.trim().slice(0, 30), sw: el.scrollWidth, cw: el.clientWidth });
    }
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        if (a.contains(b) || b.contains(a)) continue;
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (ox > 4 && oy > 4) bad.push({ kind: 'overlap', a: a.className?.toString().slice(0, 24), at: a.textContent.trim().slice(0, 24), b: b.className?.toString().slice(0, 24), bt: b.textContent.trim().slice(0, 24) });
      }
    }
    return bad;
  });
  out[`phone${w}`] = quiet;
  await ctx.close();
}

console.log(JSON.stringify({ errors, out }, null, 1));
await browser.close();
