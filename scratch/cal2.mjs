import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const N = 128, T = 8;
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
await page.goto('about:blank');
const sig = async (dir, n) => {
  const buf = await readFile(path.join(dir, n + '.png'));
  return page.evaluate(async ({ data, n: S }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + data; await img.decode();
    const c = document.createElement('canvas'); c.width = S; c.height = S;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, S, S);
    const d = g.getImageData(0, 0, S, S).data; const out = [];
    for (let i = 0; i < S * S; i++) out.push(Math.round(d[i*4]*0.299 + d[i*4+1]*0.587 + d[i*4+2]*0.114));
    return out;
  }, { data: buf.toString('base64'), n: N });
};
const frac = (a, b) => a.filter((x, i) => Math.abs(x - b[i]) >= T).length / a.length;
const sets = [
  ['DEAD  shots/cold', 'shots/cold', ['10-balance','11-sort','12-area']],
  ['LIVE  shots/cold3', 'shots/cold3', ['07-rift-es','07-rift-pl','05-rift-en','10-balance','11-sort','12-area','13-seal','01-arrival','02-sprint']],
];
for (const [label, dir, names] of sets) {
  console.log('---', label);
  const S = {}; for (const n of names) S[n] = await sig(dir, n);
  const pairs = [];
  for (let i=0;i<names.length;i++) for (let j=i+1;j<names.length;j++) pairs.push([names[i],names[j],frac(S[names[i]],S[names[j]])]);
  pairs.sort((a,b)=>a[2]-b[2]);
  for (const [a,b,f] of pairs.slice(0,8)) console.log(`  ${a} ~ ${b}  ${(f*100).toFixed(2)}% of cells differ`);
}
await browser.close();
