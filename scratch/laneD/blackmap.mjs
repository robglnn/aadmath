/** LANE D DIAGNOSTIC: how much of a frame is pure black, and in what shapes. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const files = process.argv.slice(2);
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
await page.goto('data:text/html,<canvas id=c></canvas>');
for (const f of files) {
  const b64 = readFileSync(f).toString('base64');
  const r = await page.evaluate(async (d) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + d; });
    const c = document.getElementById('c');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, c.width, c.height).data;
    const W = c.width, H = c.height;
    const dark = new Uint8Array(W * H);
    let nDark = 0, nVeryDark = 0;
    const lum = new Float32Array(W * H);
    for (let i = 0, p = 0; i < px.length; i += 4, p++) {
      const l = (px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722) / 255;
      lum[p] = l;
      if (l < 0.012) { dark[p] = 1; nDark++; }
      if (l < 0.004) nVeryDark++;
    }
    // biggest connected dark blob
    const seen = new Uint8Array(W * H);
    let best = 0, bestBox = null;
    const stack = [];
    for (let p0 = 0; p0 < W * H; p0++) {
      if (!dark[p0] || seen[p0]) continue;
      let n = 0; stack.length = 0; stack.push(p0); seen[p0] = 1;
      let x0 = W, x1 = 0, y0 = H, y1 = 0;
      while (stack.length) {
        const p = stack.pop(); n++;
        const x = p % W, y = (p - x) / W;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (x > 0 && dark[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack.push(p - 1); }
        if (x < W - 1 && dark[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack.push(p + 1); }
        if (y > 0 && dark[p - W] && !seen[p - W]) { seen[p - W] = 1; stack.push(p - W); }
        if (y < H - 1 && dark[p + W] && !seen[p + W]) { seen[p + W] = 1; stack.push(p + W); }
      }
      if (n > best) { best = n; bestBox = [x0, y0, x1, y1]; }
    }
    // Dark pixels that touch a bright one: the "hard edge" a critic named, and
    // the shape a repeating sawtooth along a silhouette makes.
    let hardEdge = 0, runMax = 0;
    for (let y = 1; y < H - 1; y++) {
      let run = 0;
      for (let x = 1; x < W - 1; x++) {
        const p = y * W + x;
        if (!dark[p]) { run = 0; continue; }
        let bright = false;
        for (let dy = -1; dy <= 1 && !bright; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (lum[p + dy * W + dx] > 0.45) { bright = true; break; }
        }
        if (bright) { hardEdge++; run++; if (run > runMax) runMax = run; } else run = 0;
      }
    }
    // histogram of the bottom of the range
    const bins = new Array(10).fill(0);
    for (let p = 0; p < W * H; p++) bins[Math.min(9, Math.floor(lum[p] * 200))]++;
    return { hardEdge, runMax, W, H, darkPct: +(100 * nDark / (W * H)).toFixed(2), veryDarkPct: +(100 * nVeryDark / (W * H)).toFixed(2),
      biggestBlobPct: +(100 * best / (W * H)).toFixed(2), bestBox, lowBins: bins };
  }, b64);
  console.log(f.split('/').slice(-2).join('/'), JSON.stringify(r));
}
await browser.close();
