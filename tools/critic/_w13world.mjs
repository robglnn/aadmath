/** What is actually out there, and how far apart is it. Read-only. */
import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4777');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 45000 });
await page.waitForTimeout(4500);

const survey = () => page.evaluate(() => {
  const a = window.__ascent, p = a.player.pos;
  const d = (o) => Math.hypot(o.x - p.x, o.z - p.z);
  const rifts = a.rifts.list.map((r) => ({ id: r.id, skill: r.skill, locked: !!r.locked, d: Math.round(d(r.pos)) }));
  return {
    pos: [p.x | 0, p.y | 0, p.z | 0],
    rifts, unlocked: rifts.filter((r) => !r.locked).length, total: rifts.length,
    nearestUnlocked: Math.min(...rifts.filter((r) => !r.locked).map((r) => r.d), Infinity),
    afford: (() => { try { return JSON.parse(JSON.stringify(a.afford.state ? a.afford.state() : a.afford)); } catch { return null; } })(),
    errand: (() => { try { return a.errand.state ? a.errand.state() : null; } catch { return null; } })(),
    relay: (() => { try { return a.relay.state ? a.relay.state() : null; } catch { return null; } })(),
    stint: (() => { try { return a.stint.state ? a.stint.state() : null; } catch { return null; } })(),
    caches: a.caches.state(), wardens: a.wardens.state(),
    landmarks: (() => {
      const names = [];
      a.scene.traverse((o) => { if (o.name && o.visible && !/^Mesh|^Object3D|^$/.test(o.name)) names.push(o.name); });
      return [...new Set(names)].slice(0, 60);
    })(),
    session: a.state().session,
  };
});

console.log('--- fresh boot ---');
const s0 = await survey();
console.log(JSON.stringify({ pos: s0.pos, total: s0.total, unlocked: s0.unlocked, nearest: s0.nearestUnlocked,
  rifts: s0.rifts, errand: s0.errand, relay: s0.relay, stint: s0.stint }, null, 1));
console.log('afford:', JSON.stringify(s0.afford));
console.log('landmark node names:', JSON.stringify(s0.landmarks));

// Seal the whole first line the honest way through the real scheduler.
for (let i = 0; i < 60; i++) {
  const r = await page.evaluate(async () => {
    const a = window.__ascent;
    const open = a.rifts.list.filter((x) => !x.locked);
    if (!open.length) return { none: true };
    a.openRiftById(open[0].id);
    await new Promise((z) => setTimeout(z, 250));
    const i = a.panelInfo();
    if (!i.open) return { none: true };
    a.enter(i.answer);
    await new Promise((z) => setTimeout(z, 400));
    try { a.panel.close?.(); } catch {}
    return { skill: i.skill, mode: i.mode, form: i.form };
  });
  if (r.none) break;
  if (i % 6 === 0) {
    const s = await survey();
    console.log(`after ${i + 1} items: unlocked=${s.unlocked}/${s.total} nearest=${s.nearestUnlocked}m `
      + `caches opened=${s.caches.opened}/${s.caches.total} wardens=${JSON.stringify(s.wardens)} `
      + `session.items=${s.session.run?.items} tears=${s.session.run?.tears}`);
  }
  await page.waitForTimeout(80);
}
const s1 = await survey();
console.log('--- after the line ---');
console.log(JSON.stringify({ unlocked: s1.unlocked, total: s1.total, nearest: s1.nearestUnlocked,
  rifts: s1.rifts.slice(0, 20), errand: s1.errand, relay: s1.relay, stint: s1.stint, caches: s1.caches, wardens: s1.wardens }, null, 1));
console.log('session:', JSON.stringify(s1.session));
await browser.close();
