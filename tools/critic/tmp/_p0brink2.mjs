import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>=0?process.argv[i+1]:d;};
const OUT = path.resolve(arg('out','shots/p0brink2')); await mkdir(OUT,{recursive:true});
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle','--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({viewport:{width:1400,height:800}})).newPage();
page.on('console', m => { if (m.type()==='error') console.log('ERR', m.text()); });
await page.goto(arg('url','http://127.0.0.1:5173'), { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(9000);

// Park the lens outside the game's own camera rig and look at the north coast
// from the air: this is a LOOK check on one mesh, not a play test.
const info = await page.evaluate(() => {
  const a = window.__ascent;
  let brink = null;
  a.scene.traverse(o => { if (o.isMesh && o.material?.uniforms?.uNear && o.geometry.attributes.position.count > 3000) brink = o; });
  if (!brink) return 'no brink mesh';
  brink.material.uniforms.uNear.value = 1;
  window.__brink = brink;
  // hold it on: the module drives `visible` from the cadet's distance to the
  // coast every frame, and the cadet is standing in the plaza.
  Object.defineProperty(brink, 'visible', { get: () => true, set: () => {} });
  const u = brink.material.uniforms.uNear;
  Object.defineProperty(u, 'value', { get: () => 1, set: () => {} });
  // where is the coast on the north bearing?
  let r = 0; for (let d = 0; d < 300; d += 0.5) { if (a.islandAt(0, -d) === null) { r = d; break; } }
  const gy = a.islandAt(0, -(r - 6)) ?? 10;
  const cam = a.camera;
  a.player.cam.update = () => {};             // freeze the rig for the shot
  cam.position.set(0, gy + 9, -(r - 34));
  cam.lookAt(0, gy + 1, -(r + 4));
  cam.updateMatrixWorld(true);
  return { coastR: r, groundY: +gy.toFixed(1), verts: brink.geometry.attributes.position.count };
});
console.log(JSON.stringify(info));
await page.waitForTimeout(1600);
await page.screenshot({ path: path.join(OUT, 'a-as-shipped.png') });

// Same frame, flat opaque magenta: does the geometry land where it should?
await page.evaluate(() => {
  const b = window.__brink;
  b.material.fragmentShader = 'void main(){ gl_FragColor = vec4(1.0, 0.0, 0.8, 1.0); }';
  b.material.transparent = false; b.material.depthWrite = true;
  b.material.needsUpdate = true;
});
await page.waitForTimeout(900);
await page.screenshot({ path: path.join(OUT, 'b-flat-magenta.png') });
await browser.close();
