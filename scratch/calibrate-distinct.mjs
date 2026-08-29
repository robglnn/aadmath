/** Score the four known-dead frames with the same signature the harness uses. */
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const dir = process.argv[2];
const names = process.argv.slice(3);
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
await page.goto('about:blank');
const sigs = {};
for (const n of names) {
  const buf = await readFile(path.join(dir, n + '.png'));
  sigs[n] = await page.evaluate(async ({ data, n: N }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + data;
    await img.decode();
    const c = document.createElement('canvas'); c.width = N; c.height = N;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, N, N);
    const d = g.getImageData(0, 0, N, N).data;
    const out = [];
    for (let i = 0; i < N * N; i++) out.push(Math.round(d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114));
    return out;
  }, { data: buf.toString("base64"), n: Number(process.env.SIG||32) });
}
const mean = (a, b) => a.reduce((s, x, i) => s + Math.abs(x - b[i]), 0) / a.length;
for (let i = 0; i < names.length; i++) {
  for (let j = i + 1; j < names.length; j++) {
    console.log(`${names[i]} ~ ${names[j]}  ${mean(sigs[names[i]], sigs[names[j]]).toFixed(3)}`);
  }
}
await browser.close();
