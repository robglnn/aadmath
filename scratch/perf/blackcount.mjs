/**
 * Count the hard black, and the staircase, in already-captured PNGs.
 *
 * Reading the pixels back inside the page does not work: the renderer is
 * created with `preserveDrawingBuffer: false`, so drawing its canvas into a 2D
 * context yields a black rectangle and every number is 100%. The screenshot is
 * the only honest source, so measure the screenshot.
 *
 *   crushed    at or below luminance 12/255 — not "dark", but crushed: no
 *              detail survives there at all
 *   staircase  a one-pixel dark notch between two much brighter neighbours in
 *              x or y. That is what an aliased edge looks like to a counter,
 *              and what a genuinely dark object does not do.
 *
 *   node scratch/perf/blackcount.mjs <dir> [<dir2> …]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const b = await chromium.launch();
const p = await b.newPage();

async function measure(file) {
  const data = fs.readFileSync(file).toString('base64');
  return p.evaluate(async (d) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + d;
    await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const px = x.getImageData(0, 0, c.width, c.height).data;
    const w = c.width, h = c.height;
    const L = (i) => 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    let crushed = 0, stair = 0, n = 0;
    for (let y = 1; y < h - 1; y++) for (let q = 1; q < w - 1; q++) {
      const i = (y * w + q) * 4; const l = L(i); n++;
      if (l <= 12) crushed++;
      const a1 = L(i - 4), a2 = L(i + 4), b1 = L(i - w * 4), b2 = L(i + w * 4);
      if ((a1 - l > 26 && a2 - l > 26) || (b1 - l > 26 && b2 - l > 26)) stair++;
    }
    return { crushed: crushed / n, stair: stair / n, w, h };
  }, data);
}

const dirs = process.argv.slice(2);
const table = new Map();
for (const dir of dirs) {
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.png')).sort()) {
    const r = await measure(path.join(dir, f));
    if (!table.has(f)) table.set(f, {});
    table.get(f)[dir] = r;
  }
}
const head = 'frame'.padEnd(34) + dirs.map((d) => (path.basename(d) + '  crushed / staircase').padEnd(34)).join('');
console.log(head);
console.log('-'.repeat(head.length));
const worst = {};
for (const [f, row] of table) {
  let line = f.replace('.png', '').padEnd(34);
  for (const d of dirs) {
    const r = row[d];
    line += (r ? `${(r.crushed * 100).toFixed(1).padStart(6)}%  ${(r.stair * 100).toFixed(2).padStart(6)}%` : '   -').padEnd(34);
  }
  console.log(line);
  for (const d of dirs) {
    const r = row[d]; if (!r) continue;
    if (!worst[d] || r.crushed > worst[d].crushed) worst[d] = { ...r, f };
  }
}
console.log();
for (const d of dirs) {
  const w = worst[d];
  if (w) console.log(`worst frame in ${path.basename(d)}: ${w.f} — ${(w.crushed * 100).toFixed(1)}% crushed, ${(w.stair * 100).toFixed(2)}% staircase`);
}
await b.close();
