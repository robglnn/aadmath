import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 800, height: 600 } })).newPage();
await p.goto('http://127.0.0.1:4390', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent, null, { timeout: 120000 });
await p.waitForTimeout(2500);
console.log(JSON.stringify(await p.evaluate(() => {
  const a = window.__ascent;
  const cols = (a.drift?.columns || a.drift?.state?.()?.columns || []).map ? (a.drift.columns || []) : [];
  const sites = a.rifts.list.map((r) => ({ id: r.id, x: +(r.foot ? r.foot.x : r.pos.x).toFixed(0), z: +(r.foot ? r.foot.z : r.pos.z).toFixed(0) }));
  return { cols: cols.map((c) => ({ x: +c.x.toFixed(0), z: +c.z.toFixed(0), r: c.r, g: a.islandAt(c.x, c.z) === null ? 'VOID' : 'ground' })), sites };
}), null, 1));
await b.close();
