/**
 * Stand still and look at each class of interactable: the frame is the report.
 *   tools/critic/frozen.sh tools/critic/_proof.mjs --out shots/proof
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/proof'));
await mkdir(OUT, { recursive: true });

const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
const errs = [];
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent);
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent);
await p.waitForTimeout(2800);
await p.evaluate(() => document.getElementById('boot')?.classList.add('gone'));
const go = p.locator('.sc-go');
if (await go.count()) await go.first().click({ timeout: 3000 }).catch(() => {});
await p.waitForTimeout(500);

const shot = async (n, ms = 900) => { await p.waitForTimeout(ms); await p.screenshot({ path: path.join(OUT, n + '.png') }); };
const tags = () => p.evaluate(() => [...document.querySelectorAll('.bk-tag')]
  .filter((e) => e.style.display !== 'none').map((e) => e.className.replace('bk-tag ', '') + ': ' + e.textContent));

/** Stand at a distance from a point, looking straight at it. */
async function stand(x, y, z, back, yaw, pitch = -0.06) {
  await p.evaluate(([x, y, z, back, yaw, pitch]) => {
    const A = window.__ascent;
    const px = x - Math.sin(yaw) * back, pz = z - Math.cos(yaw) * back;
    const g = A.islandAt(px, pz);
    A.player.pos.set(px, (g === null ? y : g) + 0.4, pz);
    A.player.vel.set(0, 0, 0);
    A.player.yaw = yaw; A.player.pitch = pitch;
  }, [x, y, z, back, yaw, pitch]);
}

// ---- 1. a shut tear, from where you would walk up to it -------------------
const shut = await p.evaluate(() => {
  const r = window.__ascent.rifts.list.find((q) => q.locked);
  return { id: r.id, x: r.foot.x, y: r.foot.y, z: r.foot.z };
});
let yaw = Math.atan2(0 - shut.x, 0 - shut.z) + Math.PI;
await stand(shut.x, shut.y, shut.z, 17, yaw, 0.06);
await shot('01-tear-shut');
console.log('shut tags   ', JSON.stringify(await tags()));

// ---- 2. a live tear -------------------------------------------------------
const live = await p.evaluate(() => {
  const r = window.__ascent.rifts.list.find((q) => !q.locked);
  return { id: r.id, x: r.foot.x, y: r.foot.y, z: r.foot.z };
});
yaw = Math.atan2(0 - live.x, 0 - live.z) + Math.PI;
await stand(live.x, live.y, live.z, 21, yaw, 0.06);
await shot('02-tear-live');
console.log('live tags   ', JSON.stringify(await tags()));

// ---- 3. a lit vein --------------------------------------------------------
const vein = await p.evaluate(() => {
  const A = window.__ascent;
  const v = A.drift.veins.find((q) => q.cool <= 0 && Math.hypot(q.x, q.z) < 120);
  return { x: v.x, z: v.z, y: A.islandAt(v.x, v.z) ?? 20 };
});
await stand(vein.x, vein.y, vein.z, 11, Math.PI * 0.25, -0.02);
await shot('03-vein-lit');
console.log('vein tags   ', JSON.stringify(await tags()));

// ---- 4. …harvested, and the husks it leaves --------------------------------
await p.evaluate(([x, z]) => {
  const A = window.__ascent;
  A.player.pos.set(x, (A.islandAt(x, z) ?? 20) + 0.4, z);
}, [vein.x, vein.z]);
await p.waitForTimeout(1400);
await stand(vein.x, vein.y, vein.z, 11, Math.PI * 0.25, -0.02);
await shot('04-vein-spent', 1400);
console.log('husk tags   ', JSON.stringify(await tags()));

// ---- 5. the verge, flown at ------------------------------------------------
const R = await p.evaluate(() => {
  const A = window.__ascent;
  A.player.pos.set(0, 210, 150); A.player.vel.set(0, 0, 0);
  A.player.yaw = 0; A.player.pitch = -0.05;
  return A.world.ISLAND_R * 1.62;
});
await shot('05-verge-far', 900);
await p.keyboard.press('KeyG');
await p.keyboard.down('KeyW');
const gates = [[R - 120, '06a-verge-120m'], [R - 70, '06b-verge-70m'], [R - 25, '06c-verge-25m']];
for (let i = 0; i < 60; i++) {
  await p.waitForTimeout(220);
  const st = await p.evaluate(() => {
    const A = window.__ascent;
    // keep the wing in the air: the boundary is what is under test, not the glide
    if (A.player.pos.y < 90) A.player.pos.y = 150;
    return { r: Math.hypot(A.player.pos.x, A.player.pos.z), y: A.player.pos.y };
  });
  while (gates.length && st.r > gates[0][0]) { await shot(gates.shift()[1], 60); }
  if (st.r > R - 1.6) break;
}
await p.keyboard.up('KeyW');
await shot('07-verge-contact', 500);
console.log('verge tags  ', JSON.stringify(await tags()));
console.log('verge state ', JSON.stringify(await p.evaluate(() => {
  const A = window.__ascent;
  let m = null;
  A.scene.traverse((o) => { if (o.geometry?.type === 'CylinderGeometry' && o.geometry.parameters?.radiusTop > 200) m = o; });
  return m ? {
    found: true, visible: m.visible, uNear: m.material.uniforms.uNear.value,
    y: m.position.y, camY: A.camera.position.y,
    r: Math.hypot(A.player.pos.x, A.player.pos.z),
    camR: Math.hypot(A.camera.position.x, A.camera.position.z),
    inFrustum: (() => {
      const f = new A.THREE.Frustum();
      f.setFromProjectionMatrix(new A.THREE.Matrix4().multiplyMatrices(A.camera.projectionMatrix, A.camera.matrixWorldInverse));
      return f.intersectsObject(m);
    })(),
    far: A.camera.far,
  } : { found: false };
})));
console.log('verge toast ', JSON.stringify(await p.evaluate(() => document.querySelector('.toast')?.textContent || '')));

console.log(errs.length ? 'ERRORS\n' + errs.slice(0, 6).join('\n') : 'ERRORS: none');
await b.close();
