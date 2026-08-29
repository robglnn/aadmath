/**
 * LANE D DIAGNOSTIC: hunt the reported "repeating black sawtooth along a
 * terrain silhouette". Stands on the low side of ridges facing into the sun,
 * where a grassy skyline is back-lit, and measures pure-black pixels that touch
 * the sky.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4390');
const OUT = path.resolve(arg('out', 'shots/laneD/sawtooth'));
const TAG = arg('tag', 'now');
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 120000 });
await page.waitForTimeout(2600);
await page.evaluate(() => { document.getElementById('boot')?.classList.add('gone'); document.getElementById('ui')?.style.setProperty('display', 'none'); });

// The sun's bearing, so we can stand with a ridge between the lens and it.
const sunYaw = await page.evaluate(() => {
  const d = window.__ascent.world?.sunDir || null;
  return d ? Math.atan2(d.x, d.z) : Math.atan2(-0.740, -0.500);
});
const poses = [];
for (let i = 0; i < 44; i++) {
  const t = i * 2.399963, rr = Math.sqrt((i + 1) / 45) * 150;
  poses.push({ x: Math.cos(t) * rr, z: Math.sin(t) * rr, yaw: sunYaw + (i % 3 - 1) * 0.5, pitch: 0.06 + (i % 4) * 0.05 });
}
const rows = [];
for (let i = 0; i < poses.length; i++) {
  const p = poses[i];
  const ok = await page.evaluate(([px, pz, yaw, pitch]) => {
    const a = window.__ascent; const h = a.islandAt(px, pz); if (h === null) return false;
    a.player.pos.set(px, h + 0.2, pz); a.player.vel.set(0, 0, 0);
    a.player.yaw = yaw; if (a.player.cam) { a.player.cam.yaw = yaw; a.player.cam.pitch = pitch; }
    a.player.cam?.refound?.(); return true;
  }, [p.x, p.z, p.yaw, p.pitch]);
  if (!ok) continue;
  await page.waitForTimeout(700);
  const buf = await page.screenshot({ type: 'png' });
  const r = await page.evaluate(async (d) => {
    const img = new Image();
    await new Promise((res) => { img.onload = res; img.src = 'data:image/png;base64,' + d; });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, c.width, c.height).data;
    const W = c.width, H = c.height;
    const lum = new Float32Array(W * H);
    for (let k = 0, q = 0; k < px.length; k += 4, q++) lum[q] = (px[k] * 0.2126 + px[k + 1] * 0.7152 + px[k + 2] * 0.0722) / 255;
    let hard = 0, runMax = 0, teeth = 0;
    for (let y = 1; y < H - 1; y++) {
      let run = 0, wasDark = false, flips = 0;
      for (let x = 1; x < W - 1; x++) {
        const q = y * W + x;
        const isDark = lum[q] < 0.012;
        if (isDark !== wasDark) { flips++; wasDark = isDark; }
        if (!isDark) { run = 0; continue; }
        let bright = false;
        for (let dy = -1; dy <= 1 && !bright; dy++) for (let dx = -1; dx <= 1; dx++) if (lum[q + dy * W + dx] > 0.45) { bright = true; break; }
        if (bright) { hard++; run++; if (run > runMax) runMax = run; } else run = 0;
      }
      // a sawtooth row: many dark/bright alternations in one scanline
      if (flips >= 12) teeth++;
    }
    return { hard, runMax, teeth };
  }, buf.toString('base64'));
  rows.push({ i, ...p, ...r });
}
rows.sort((a, b) => (b.hard + b.teeth * 4) - (a.hard + a.teeth * 4));
console.log(`${TAG}: worst 8 of ${rows.length} poses (hard = pure-black pixels touching sky, teeth = scanlines with >=12 dark/bright alternations)`);
for (const r of rows.slice(0, 8)) console.log(`  pose ${r.i} at ${r.x.toFixed(0)},${r.z.toFixed(0)} yaw ${r.yaw.toFixed(2)} pitch ${r.pitch.toFixed(2)}  hard ${r.hard}  runMax ${r.runMax}  teeth ${r.teeth}`);
console.log(`${TAG}: TOTAL hard ${rows.reduce((a, b) => a + b.hard, 0)}  teeth-rows ${rows.reduce((a, b) => a + b.teeth, 0)}`);
// keep the worst frame
const w = rows[0];
await page.evaluate(([px, pz, yaw, pitch]) => {
  const a = window.__ascent; const h = a.islandAt(px, pz);
  a.player.pos.set(px, h + 0.2, pz); a.player.vel.set(0, 0, 0);
  a.player.yaw = yaw; if (a.player.cam) { a.player.cam.yaw = yaw; a.player.cam.pitch = pitch; }
  a.player.cam?.refound?.();
}, [w.x, w.z, w.yaw, w.pitch]);
await page.waitForTimeout(900);
await page.screenshot({ path: path.join(OUT, `${TAG}-worst-pose${w.i}.png`) });
await writeFile(path.join(OUT, `${TAG}.json`), JSON.stringify(rows, null, 1));
await browser.close();
