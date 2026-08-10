import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://127.0.0.1:4711';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--disable-gpu-vsync'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(3000);
const out = await page.evaluate(() => {
  const a = window.__ascent;
  const scene = a.engine.scene;
  let sun = null;
  scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow) sun = o; });
  const rigRoot = a.player.rig.root;
  const meshes = [];
  rigRoot.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const cast = meshes.filter((m) => m.castShadow);
  // is the rig inside the shadow frustum?
  const THREE = a.engine.scene.constructor;
  const cam = sun.shadow.camera;
  const info = {
    lightPos: sun.position.toArray().map((v) => +v.toFixed(2)),
    targetPos: sun.target.position.toArray().map((v) => +v.toFixed(2)),
    shadowCam: { left: cam.left, right: cam.right, top: cam.top, bottom: cam.bottom, near: cam.near, far: cam.far },
    projElems: cam.projectionMatrix.elements.map((v) => +v.toFixed(5)),
    mapSize: sun.shadow.mapSize.toArray(),
    mapExists: !!(sun.shadow.map && sun.shadow.map.texture),
    bias: sun.shadow.bias, normalBias: sun.shadow.normalBias,
    playerPos: a.player.pos.toArray().map((v) => +v.toFixed(2)),
    camPos: a.engine.camera.position.toArray().map((v) => +v.toFixed(2)),
    meshCount: meshes.length,
    castCount: cast.length,
    rootVisible: rigRoot.visible,
    parentVisible: rigRoot.parent && rigRoot.parent.visible,
    layers: [...new Set(meshes.map((m) => m.layers.mask))],
    camLayers: a.engine.camera.layers.mask,
    matVisible: [...new Set(meshes.map((m) => !!m.material.visible))],
    matSide: [...new Set(meshes.map((m) => m.material.side))],
    matTransparent: [...new Set(meshes.map((m) => !!m.material.transparent))],
    frustumCulled: [...new Set(meshes.map((m) => m.frustumCulled))],
    // project the cadet's head into shadow-cam clip space
  };
  // shadow clip coords of the player's head
  const v = new (a.player.pos.constructor)(a.player.pos.x, a.player.pos.y + 1.6, a.player.pos.z);
  const p = v.clone().project(cam);
  info.headInShadowNDC = p.toArray().map((n) => +n.toFixed(3));
  // ground receivers under the player
  const rec = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.receiveShadow) return;
    rec.push(o.name || o.type + ':' + (o.geometry?.type || ''));
  });
  info.receivers = rec.slice(0, 40);
  info.receiverCount = rec.length;
  const nonrec = [];
  scene.traverse((o) => { if (o.isMesh && !o.receiveShadow) nonrec.push((o.name || '') + '/' + (o.geometry?.type || '') + '/' + (o.material?.type || '')); });
  info.nonReceivers = nonrec.slice(0, 30);
  info.nonReceiverCount = nonrec.length;
  return info;
});
console.log(JSON.stringify(out, null, 2));
await browser.close();
