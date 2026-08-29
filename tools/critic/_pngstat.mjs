/**
 * PNG → pixel statistics, with no dependency.
 *
 * Every "the frame is black" claim in this project has so far been made by eye
 * off a screenshot, and every answer to one has been made by eye off another.
 * That is not a measurement: two people looking at the same capture on two
 * monitors disagree about what "black" is, and a fix that moves RGB 0,0,0 to
 * RGB 3,3,3 looks identical in both and is still a dead region.
 *
 * So this decodes the bytes Playwright wrote and counts them. Playwright writes
 * 8-bit non-interlaced PNG (colour type 2 or 6, filter method 0), which is the
 * only shape this handles — anything else throws rather than guessing.
 *
 * `black` is RGB 0,0,0 to within a rounding step: nothing in those pixels, no
 * gradient to read a shape off. `crushed` is everything under 5% luminance,
 * which is the band where an 8-bit monitor in a lit classroom shows one flat
 * value whatever the numbers say.
 */
import { inflateSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

const PAETH = (a, b, c) => {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : (pb <= pc ? b : c);
};

/** @returns {{w:number,h:number,ch:number,data:Buffer}} 8-bit RGB(A), row-major. */
export function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let off = 8, w = 0, h = 0, depth = 0, ctype = 0, interlace = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const body = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = body.readUInt32BE(0); h = body.readUInt32BE(4);
      depth = body[8]; ctype = body[9]; interlace = body[12];
    } else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8) throw new Error(`bit depth ${depth} unsupported`);
  if (interlace !== 0) throw new Error('interlaced PNG unsupported');
  const ch = ctype === 2 ? 3 : ctype === 6 ? 4 : ctype === 0 ? 1 : 0;
  if (!ch) throw new Error(`colour type ${ctype} unsupported`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  let ri = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[ri++];
    const row = ri; ri += stride;
    const o = y * stride, u = o - stride;
    for (let x = 0; x < stride; x++) {
      const v = raw[row + x];
      const a = x >= ch ? out[o + x - ch] : 0;
      const b = y > 0 ? out[u + x] : 0;
      const c = (x >= ch && y > 0) ? out[u + x - ch] : 0;
      let r;
      switch (filter) {
        case 0: r = v; break;
        case 1: r = v + a; break;
        case 2: r = v + b; break;
        case 3: r = v + ((a + b) >> 1); break;
        case 4: r = v + PAETH(a, b, c); break;
        default: throw new Error(`filter ${filter}`);
      }
      out[o + x] = r & 0xff;
    }
  }
  return { w, h, ch, data: out };
}

/**
 * @param {string} file
 * @param {object} [box] optional crop {x0,y0,x1,y1} in pixels
 */
export function blackStats(file, box = null) {
  const { w, h, ch, data } = decodePNG(readFileSync(file));
  const x0 = box ? Math.max(0, box.x0) : 0, x1 = box ? Math.min(w, box.x1) : w;
  const y0 = box ? Math.max(0, box.y0) : 0, y1 = box ? Math.min(h, box.y1) : h;
  let n = 0, black = 0, crushed = 0, sum = 0;
  const hist = new Uint32Array(32);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * ch;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      n++; sum += lum;
      if (r <= 2 && g <= 2 && b <= 2) black++;
      if (lum <= 12.75) crushed++;                 // 5% of 255
      hist[Math.min(31, lum / 8 | 0)]++;
    }
  }
  return {
    w, h, n,
    black: +(black / n).toFixed(4),
    crushed: +(crushed / n).toFixed(4),
    meanLum: +(sum / n).toFixed(2),
    hist: Array.from(hist),
  };
}

if (process.argv[1] && process.argv[1].endsWith('_pngstat.mjs')) {
  for (const f of process.argv.slice(2)) {
    const s = blackStats(f);
    console.log(`${f}  ${s.w}x${s.h}  black ${(s.black * 100).toFixed(2)}%  `
      + `crushed ${(s.crushed * 100).toFixed(2)}%  meanLum ${s.meanLum}`);
  }
}
