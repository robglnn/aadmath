/**
 * CROP AND MAGNIFY A CAPTURED FRAME.
 *
 * A joint is a few centimetres of metal in a 900-pixel frame. Judging one from
 * the whole frame is judging a rumour, so this cuts a window out of real
 * captured pixels and scales it up with nearest-neighbour — no smoothing, so a
 * one-pixel gap stays a gap and does not blur into a shadow.
 *
 *   node tools/critic/crop.mjs <in.png> <out.png> <x> <y> <w> <h> [scale]
 *   x y w h are fractions of the source frame, 0..1.
 */
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [, , IN, OUT, x, y, w, h, s] = process.argv;
if (!OUT) { console.error('usage: crop.mjs in.png out.png x y w h [scale]'); process.exit(2); }
const box = { x: +x, y: +y, w: +w, h: +h, s: +(s || 3) };
const b64 = (await readFile(path.resolve(IN))).toString('base64');

const browser = await chromium.launch();
const page = await browser.newPage();
const png = await page.evaluate(async ([data, q]) => {
  const img = new Image();
  img.src = 'data:image/png;base64,' + data;
  await img.decode();
  const sx = Math.round(q.x * img.width), sy = Math.round(q.y * img.height);
  const sw = Math.round(q.w * img.width), sh = Math.round(q.h * img.height);
  const c = document.createElement('canvas');
  c.width = Math.round(sw * q.s); c.height = Math.round(sh * q.s);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c.toDataURL('image/png').split(',')[1];
}, [b64, box]);
await browser.close();
await writeFile(path.resolve(OUT), Buffer.from(png, 'base64'));
console.log(OUT);
