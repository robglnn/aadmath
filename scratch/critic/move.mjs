import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve(process.argv[2] || '/tmp/critic-move');
const W = 1600, H = 900;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle','--ignore-gpu-blocklist','--enable-gpu-rasterization','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { if (m.type()==='error') logs.push(m.text()); });
page.on('pageerror', e => logs.push('PAGEERROR '+e.message));

await page.goto('http://127.0.0.1:4788/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(3000);

// dismiss dialogue / hide HUD chrome for clean looks at the rig
async function hideHud() {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('body > *:not(canvas)')) {
      if (el.tagName !== 'SCRIPT') el.style.visibility = 'hidden';
    }
  });
}
async function showHud() {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('body > *:not(canvas)')) el.style.visibility = '';
  });
}

const shot = async (n, clip) => {
  await page.screenshot({ path: path.join(OUT, n + '.png'), clip });
};

// helper: project player position to screen
const playerScreen = () => page.evaluate(() => {
  const a = window.__ascent;
  const v = new a.THREE.Vector3(a.player.pos.x, a.player.pos.y + 0.9, a.player.pos.z);
  v.project(a.camera);
  return { x: (v.x*0.5+0.5)*window.innerWidth, y: (-v.y*0.5+0.5)*window.innerHeight,
           feetY: (() => { const f = new a.THREE.Vector3(a.player.pos.x, a.player.pos.y, a.player.pos.z); f.project(a.camera); return (-f.y*0.5+0.5)*window.innerHeight; })(),
           pos: {x:a.player.pos.x,y:a.player.pos.y,z:a.player.pos.z},
           grounded: a.player.grounded, vel: {x:a.player.vel.x,y:a.player.vel.y,z:a.player.vel.z} };
});

// ---- 1. idle on open ground: full frame + tight crop around feet ----
await page.mouse.move(W/2, H/2);
await page.mouse.click(W/2, H/2); // pointer lock (may place a build piece; clear it)
await page.keyboard.press('KeyQ'); // clear build
await page.waitForTimeout(600);
await page.waitForTimeout(500);
let ps = await playerScreen();
console.log('idle', JSON.stringify(ps));
await shot('a1-idle-full');
await shot('a2-idle-feet', { x: Math.max(0,ps.x-220), y: Math.max(0,ps.feetY-260), width: 440, height: 340 });

// ---- 2. run cycle burst: 8 frames 90ms apart while sprinting on flat ----
await page.keyboard.down('KeyW');
await page.keyboard.down('ShiftLeft');
await page.waitForTimeout(900);
for (let i=0;i<8;i++) {
  const p = await playerScreen();
  await shot(`b${i}-run`, { x: Math.max(0,p.x-230), y: Math.max(0,p.feetY-330), width: 460, height: 420 });
  await page.waitForTimeout(90);
}
await shot('b-run-full');
// ---- 3. hard stop: skid ----
await page.keyboard.up('KeyW');
for (let i=0;i<5;i++) {
  const p = await playerScreen();
  await shot(`c${i}-stop`, { x: Math.max(0,p.x-260), y: Math.max(0,p.feetY-330), width: 520, height: 430 });
  await page.waitForTimeout(80);
}
await page.keyboard.up('ShiftLeft');
await page.waitForTimeout(600);

// ---- 4. jump and land ----
await page.keyboard.down('KeyW');
await page.keyboard.down('ShiftLeft');
await page.waitForTimeout(700);
await page.keyboard.press('Space');
await page.waitForTimeout(120);
for (let i=0;i<10;i++) {
  const p = await playerScreen();
  await shot(`d${i}-air`, { x: Math.max(0,p.x-280), y: Math.max(0,p.feetY-420), width: 560, height: 520 });
  await page.waitForTimeout(85);
}
await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
await page.waitForTimeout(400);
await shot('d-after-full');

// ---- 5. big fall: teleport high, land hard ----
await page.evaluate(() => { const a=window.__ascent; a.player.pos.y += 22; a.player.vel.set(0,0,0); });
await page.waitForTimeout(900);
for (let i=0;i<12;i++) {
  const p = await playerScreen();
  await shot(`e${i}-fall`, { x: Math.max(0,p.x-320), y: Math.max(0,p.feetY-420), width: 640, height: 560 });
  await page.waitForTimeout(70);
}
await page.waitForTimeout(200);
await shot('e-land-full');

console.log('errors', JSON.stringify(logs));
await browser.close();
