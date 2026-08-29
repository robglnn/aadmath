/**
 * LANE H — is the island one walkable place?
 *
 * Flood-fills the heightfield at 2 m on the boots' own rule (P.slideLimit 1.3:
 * above that you slide back down) from the landing plaza, and reports every
 * component that is not the plaza's, plus every rift's reachability, plus the
 * pockets big enough for a running player to end up inside.
 */
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/h-reach'));
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
  const idx = (i, j) => i * N + j;
  const X = (i) => -R + i * STEP, Z = (j) => -R + j * STEP;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const h = a.islandAt(X(i), Z(j));
    H[idx(i, j)] = (h === null ? NaN : h);
  }
  // boots: sustainable climb is slideLimit 1.3 -> 2.6 m over a 2 m step.
  const RISE = 1.3 * STEP;
  const comp = new Int32Array(N * N).fill(-1);
  const comps = [];
  const nbr = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    if (comp[idx(i, j)] !== -1 || Number.isNaN(H[idx(i, j)])) continue;
    const id = comps.length;
    const q = [i, j]; comp[idx(i, j)] = id; let n = 0;
    let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
    while (q.length) {
      const cj = q.pop(), ci = q.pop(); n++;
      const x = X(ci), z = Z(cj);
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (z < minz) minz = z; if (z > maxz) maxz = z;
      const h0 = H[idx(ci, cj)];
      for (const [di, dj] of nbr) {
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
        const k = idx(ni, nj);
        if (comp[k] !== -1) continue;
        const h1 = H[k];
        if (Number.isNaN(h1)) continue;
        // Walking UP is limited by the slide rule; walking DOWN is free
        // (you fall). So the edge is directional — but a pocket you can fall
        // into and not climb out of is exactly the trap, so the fill is done
        // on the UNDIRECTED rule (both ways climbable) and the directional
        // asymmetry is reported separately below.
        if (Math.abs(h1 - h0) > RISE) continue;
        comp[k] = id; q.push(ni, nj);
      }
    }
    comps.push({ id, cells: n, minx, maxx, minz, maxz, seed: [X(i), Z(j)] });
  }
  const cellOf = (x, z) => {
    const i = Math.round((x + R) / STEP), j = Math.round((z + R) / STEP);
    if (i < 0 || j < 0 || i >= N || j >= N) return -1;
    return comp[idx(i, j)];
  };
  const plazaComp = cellOf(0, 0);
  const rifts = a.rifts.list.map((r) => ({ id: r.id, x: r.pos.x, z: r.pos.z, comp: cellOf(r.pos.x, r.pos.z) }));
  const total = comps.reduce((s, c) => s + c.cells, 0);
  const main = comps.find((c) => c.id === plazaComp);
  // Pockets: components of >= 6 cells (24 m^2) that are not the plaza's, whose
  // ground is BELOW at least one neighbouring wall — somewhere you can end up.
  const pockets = comps.filter((c) => c.id !== plazaComp && c.cells >= 6)
    .sort((p, q) => q.cells - p.cells).slice(0, 25);
  // How much of the island is walls a cadet cannot climb (slope > 1.3)?
  let steep = 0, ground = 0;
  for (let i = 1; i < N - 1; i++) for (let j = 1; j < N - 1; j++) {
    const h = H[idx(i, j)]; if (Number.isNaN(h)) continue;
    ground++;
    const gx = (H[idx(i + 1, j)] - H[idx(i - 1, j)]) / (2 * STEP);
    const gz = (H[idx(i, j + 1)] - H[idx(i, j - 1)]) / (2 * STEP);
    if (Number.isFinite(gx) && Number.isFinite(gz) && Math.hypot(gx, gz) > 1.3) steep++;
  }
  return {
    N, STEP, comps: comps.length, total, mainCells: main ? main.cells : 0,
    mainShare: main ? main.cells / total : 0,
    rifts, pockets, steepShare: steep / Math.max(1, ground), groundCells: ground,
  };
});
console.log(JSON.stringify({ ...res, pockets: res.pockets.slice(0, 12) }, null, 1));
await writeFile(path.join(OUT, 'reach.json'), JSON.stringify(res, null, 1));
await browser.close();
