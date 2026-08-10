import { chromium } from 'playwright';
const URL = 'http://127.0.0.1:4789';
const browser = await chromium.launch({ args: ['--use-gl=angle','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4000);

async function gy(x,z){
  await page.evaluate(([x,z]) => { const a=window.__ascent; a.player.pos.set(x,240,z); a.player.vel.set(0,0,0); }, [x,z]);
  await page.waitForTimeout(4200);
  return page.evaluate(() => window.__ascent.player.pos.y);
}

const FAR = [
  ['ember', -210, 930, -40, 430],
  ['glass', 1134, -325, -18, 520],
  ['verdant', 1010, 450, -34, 380],
  ['steps', -1080, 140, -40, 420],
  ['ashen', -132, -892, -52, 478],
];

async function survey(label, x, z) {
  const y = await gy(x, z);
  const res = await page.evaluate(([eyeX, eyeY, eyeZ, FAR]) => {
    const T = window.__ascent.THREE;
    const scene = window.__ascent.scene;
    // collect terrain + island meshes only (exclude farlands group & sky)
    const eye = new T.Vector3(eyeX, eyeY + 1.6, eyeZ);
    const out = [];
    const rc = new T.Raycaster();
    rc.far = 700; // only island-scale occluders
    const targets = [];
    scene.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      const nm = (o.name || '') + '|' + (o.parent?.name || '');
      if (/far|sky|cloud|range|inversion/i.test(nm)) return;
      // skip anything whose bounding sphere is beyond 700m
      targets.push(o);
    });
    for (const [id, cx, cy0, cz, H] of []) {}
    for (const f of FAR) {
      const [id, cx, cz, cy, H] = f;
      // aim at 60% of the world's height — well above its base
      const tgt = new T.Vector3(cx, cy + H * 0.6, cz);
      const dir = tgt.clone().sub(eye).normalize();
      rc.set(eye, dir);
      const hits = rc.intersectObjects(targets, true).filter(h => h.distance > 2 && h.distance < 700);
      const elev = Math.asin(dir.y) * 180 / Math.PI;
      out.push({ id, elev: +elev.toFixed(1), blocked: hits.length > 0, by: hits[0] ? (hits[0].object.name || hits[0].object.type) + '@' + Math.round(hits[0].distance) : null });
    }
    return out;
  }, [x, y, z, FAR]);
  console.log(label, 'eyeY', Math.round(y), JSON.stringify(res));
}

await survey('PLAZA(0,26)', 0, 26);
await survey('PLAZA-N(0,-20)', 0, -20);
await survey('TERRACE(62,-98)', 62, -98);
await survey('SOUTH-TERRACE(30,104)', 30, 104);
await browser.close();
