import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const URL = 'http://127.0.0.1:4789';
const OUT = '/tmp/critic-w/vista';
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle','--ignore-gpu-blocklist','--enable-gpu-rasterization','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { if (m.type()==='error') logs.push(m.text()); });
page.on('pageerror', e => logs.push('PAGEERR '+e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(3000);
await page.evaluate(() => document.getElementById('boot')?.classList.add('gone'));
await page.mouse.click(800, 450);
await page.waitForTimeout(300);
// hide HUD chrome for clean look at the world
await page.addStyleTag({ content: '.hud-topleft,.quest,.journal,#hud .card,.marlow,.dialog,.hotbar,.langs,.audio-btn,.lattice-bar{opacity:0 !important}' });

const place = async (x, y, z, yaw, pitch) => page.evaluate(([x,y,z,yaw,pitch]) => {
  const a = window.__ascent;
  a.player.pos.set(x,y,z); a.player.vel.set(0,0,0);
  a.player.yaw = yaw; a.player.pitch = pitch;
  if (a.player.cam) { a.player.cam.yaw = yaw; a.player.cam.pitch = pitch; }
}, [x,y,z,yaw,pitch]);

async function groundY(x, z) {
  await page.evaluate(([x,z]) => { const a = window.__ascent; a.player.pos.set(x, 240, z); a.player.vel.set(0,0,0); }, [x,z]);
  await page.waitForTimeout(4200);
  return page.evaluate(() => window.__ascent.player.pos.y);
}

// terrace centre
const PEAK = { x: 62, z: -98 };
let ty = await groundY(PEAK.x, PEAK.z);
console.log('terrace ground y', ty);
if (ty === null) ty = 137;

for (let i = 0; i < 8; i++) {
  const yaw = i * Math.PI / 4;
  await place(PEAK.x, ty + 1.2, PEAK.z, yaw, -0.02);
  await page.waitForTimeout(700);
  await place(PEAK.x, ty + 1.2, PEAK.z, yaw, -0.02);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/terrace-yaw${i}.png` });
}

// plaza spawn view, level
const py = await groundY(0, 26);
console.log('plaza ground', py);
for (const [i, yaw] of [Math.PI, Math.PI*1.3, Math.PI*0.7].entries()) {
  await place(0, py + 1.2, 26, yaw, 0.02);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/plaza-${i}.png` });
}

// the peak-2 / ashen surface question: stand on peak2 and near the treeline
const P2 = { x: -92, z: -66 };
const p2y = await groundY(P2.x, P2.z);
console.log('peak2 ground', p2y);
await place(P2.x, p2y + 1.2, P2.z, Math.PI*0.25, -0.15);
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/peak2.png` });
// close look down at the peak2 surface
await place(P2.x, p2y + 3, P2.z + 8, Math.PI, -0.55);
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/peak2-surface.png` });

// plaza surface for comparison
await place(0, py + 3, 10, Math.PI, -0.7);
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/plaza-surface.png` });

console.log('ERRORS', logs.length, logs.slice(0,5));
await browser.close();
