/**
 * LANE H — the TRAP SET: ground a cadet can end up on and cannot walk off.
 *
 *   W  reachable from the plaza on foot   (up <= LIMIT per 2 m, down free)
 *   F  reachable from W by also FALLING   (down any amount)
 *   O  ground from which the plaza is reachable on foot
 *   trap = F \ O
 */
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/h-trapset'));
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 900, height: 600 } })).newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(1500);
const res = await page.evaluate(() => {
  const a = window.__ascent;
  const STEP = 2, R = 172, N = Math.floor((R * 2) / STEP) + 1;
  const H = new Float32Array(N * N).fill(NaN);
  const id = (i, j) => i * N + j;
  const X = (i) => -R + i * STEP, Z = (j) => -R + j * STEP;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const h = a.islandAt(X(i), Z(j)); H[id(i, j)] = h === null ? NaN : h;
  }
  const LIMIT = 1.3 * STEP;                       // slideLimit: what you can hold
  const nbr = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const fill = (seeds, canStep) => {
    const seen = new Uint8Array(N * N);
    const q = [...seeds];
    for (let k = 0; k < q.length; k += 2) seen[id(q[k], q[k + 1])] = 1;
    let head = 0;
    while (head < q.length) {
      const ci = q[head++], cj = q[head++];
      const h0 = H[id(ci, cj)];
      for (const [di, dj] of nbr) {
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
        const k = id(ni, nj);
        if (seen[k]) continue;
        const h1 = H[k]; if (Number.isNaN(h1)) continue;
        if (!canStep(h0, h1)) continue;
        seen[k] = 1; q.push(ni, nj);
      }
    }
    return seen;
  };
  const home = [Math.round((0 + R) / STEP), Math.round((0 + R) / STEP)];
  const W = fill(home, (h0, h1) => h1 - h0 <= LIMIT);
  const F = fill(home, (h0, h1) => h1 - h0 <= LIMIT || h1 < h0);     // walking + falling
  // O: from which the plaza is reachable -> reverse edges: step u->v allowed in
  // the forward sense when h[v]-h[u] <= LIMIT, so v->u in reverse.
  const O = fill(home, (h0, h1) => h0 - h1 <= LIMIT);
  let ground = 0, nW = 0, nF = 0, nO = 0, nTrap = 0;
  const trapCells = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const k = id(i, j); if (Number.isNaN(H[k])) continue;
    ground++; if (W[k]) nW++; if (F[k]) nF++; if (O[k]) nO++;
    if (F[k] && !O[k]) { nTrap++; trapCells.push([X(i), Z(j), +H[k].toFixed(1)]); }
  }
  // cluster the trap cells
  const seenC = new Set(); const clusters = [];
  const key = (x, z) => x + ',' + z;
  const map = new Map(); for (const c of trapCells) map.set(key(c[0], c[1]), c);
  for (const c of trapCells) {
    if (seenC.has(key(c[0], c[1]))) continue;
    const q = [c]; seenC.add(key(c[0], c[1])); const cells = [];
    while (q.length) {
      const p = q.pop(); cells.push(p);
      for (const [dx, dz] of [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP]]) {
        const kk = key(p[0] + dx, p[1] + dz);
        if (map.has(kk) && !seenC.has(kk)) { seenC.add(kk); q.push(map.get(kk)); }
      }
    }
    const xs = cells.map((v) => v[0]), zs = cells.map((v) => v[1]);
    clusters.push({ n: cells.length, x: [Math.min(...xs), Math.max(...xs)], z: [Math.min(...zs), Math.max(...zs)],
      y: +(cells.reduce((s, v) => s + v[2], 0) / cells.length).toFixed(1) });
  }
  clusters.sort((p, q2) => q2.n - p.n);
  const probe = (x, z) => {
    const i = Math.round((x + R) / STEP), j = Math.round((z + R) / STEP), k = id(i, j);
    return { x, z, h: Number.isNaN(H[k]) ? null : +H[k].toFixed(1), W: !!W[k], F: !!F[k], O: !!O[k] };
  };
  return {
    ground, W: nW, F: nF, O: nO, trap: nTrap,
    trapShare: +(nTrap / ground).toFixed(4),
    offWalkShare: +(1 - nW / ground).toFixed(4),
    clusters: clusters.slice(0, 20),
    spots: [[35.2, -91.1], [36, -88.3], [0, 26], [20, -110]].map(([x, z]) => probe(x, z)),
  };
});
console.log(JSON.stringify(res, null, 1));
await writeFile(path.join(OUT, 'trapset.json'), JSON.stringify(res, null, 1));
await browser.close();
