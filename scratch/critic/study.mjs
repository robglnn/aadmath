import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const OUT = path.resolve(process.argv[2] || '/tmp/critic-study');
await mkdir(OUT, { recursive: true });
const W=1600,H=900;
const browser = await chromium.launch({ args:['--use-gl=angle','--ignore-gpu-blocklist','--enable-gpu-rasterization','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
const ctx = await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:2});
const page = await ctx.newPage();
const errs=[]; page.on('console',m=>{if(m.type()==='error')errs.push(m.text());}); page.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
await page.goto('http://127.0.0.1:4788/',{waitUntil:'networkidle'});
await page.waitForFunction(()=>!!window.__ascent);
await page.waitForTimeout(2200);

const hideChrome = () => page.addStyleTag({content:'.meta-comms,.meta-open{opacity:0 !important; pointer-events:none}'});
await hideChrome();

// end the cold open with a nudge, then lock the pointer and drop any build ghost
await page.keyboard.down('KeyW'); await page.waitForTimeout(400); await page.keyboard.up('KeyW');
await page.mouse.move(W/2,H/2); await page.mouse.click(W/2,H/2);
await page.waitForTimeout(300); await page.keyboard.press('KeyQ');
await page.waitForTimeout(800);

const S = async (n, clip) => { await page.screenshot({path:path.join(OUT,n+'.png'), ...(clip?{clip}:{})}); };
const P = () => page.evaluate(()=>{ const a=window.__ascent;
  const pr = (x,y,z)=>{const v=new a.THREE.Vector3(x,y,z);v.project(a.camera);return [(v.x*.5+.5)*innerWidth,(-v.y*.5+.5)*innerHeight];};
  const [hx,hy]=pr(a.player.pos.x,a.player.pos.y+1.7,a.player.pos.z);
  const [fx,fy]=pr(a.player.pos.x,a.player.pos.y,a.player.pos.z);
  return {hx,hy,fx,fy, pos:a.player.pos.toArray().map(v=>+v.toFixed(2)), vel:a.player.vel.toArray().map(v=>+v.toFixed(2)),
    grounded:a.player.grounded ?? a.player.loco?.grounded, fov:+a.camera.fov.toFixed(2), boom:+(a.player.cam?.boom??0).toFixed(2),
    trauma:+(a.player.cam?.trauma??0).toFixed(3), speed:+Math.hypot(a.player.vel.x,a.player.vel.z).toFixed(2)};
});

const log = [];
async function frames(tag, n, gap, pad=[300,420,600,560]) {
  for (let i=0;i<n;i++){
    const p = await P(); log.push({tag,i,...p});
    const x = Math.max(0, Math.min(W-1, p.fx - pad[0]));
    const y = Math.max(0, Math.min(H-1, p.fy - pad[1]));
    await S(`${tag}-${String(i).padStart(2,'0')}`, {x, y, width: Math.min(pad[2], W-x), height: Math.min(pad[3], H-y)});
    await page.waitForTimeout(gap);
  }
}

// --- IDLE: shadow + silhouette on grass ---
await S('00-idle-full');
await frames('01idle', 2, 200);

// --- WALK (no shift) ---
await page.keyboard.down('KeyW');
await page.waitForTimeout(1200);
await S('02-walk-full');
await frames('02walk', 6, 100);

// --- SPRINT ---
await page.keyboard.down('ShiftLeft');
await page.waitForTimeout(1200);
await S('03-sprint-full');
await frames('03sprint', 8, 80);

// --- HARD STOP / SKID ---
await page.keyboard.up('KeyW');
await frames('04skid', 6, 80, [340,460,680,620]);
await page.keyboard.up('ShiftLeft');
await page.waitForTimeout(800);

// --- SPRINT + JUMP + LAND ---
await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
await page.waitForTimeout(900);
await page.keyboard.press('Space');
await frames('05jump', 12, 70, [340,520,680,700]);
await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
await page.waitForTimeout(700);

// --- BIG FALL ---
await page.evaluate(()=>{const a=window.__ascent; a.player.pos.y+=26; a.player.vel.set(0,0,0);});
await page.waitForTimeout(1200);
await frames('06fall', 14, 60, [400,560,800,760]);
await page.waitForTimeout(400);
await S('06-landed-full');

// --- CAMERA: hard 180 turn while sprinting ---
await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
await page.waitForTimeout(900);
for (let i=0;i<10;i++){ await page.mouse.move(W/2 + 60, H/2, {steps:2}); await page.waitForTimeout(45); }
await frames('07turn', 6, 70, [400,480,800,700]);
await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
await page.waitForTimeout(600);

// --- GLIDE ---
await page.evaluate(()=>{const a=window.__ascent; a.player.pos.y+=30;});
await page.waitForTimeout(600);
await page.keyboard.press('Space');
await page.waitForTimeout(400);
await S('08-glide-full');
await frames('08glide', 6, 120, [400,420,800,700]);
await page.waitForTimeout(2000);
await S('08-glide-late');

console.log(JSON.stringify(log));
console.log('ERRORS', errs);
await browser.close();
