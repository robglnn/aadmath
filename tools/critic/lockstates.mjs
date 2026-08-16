/**
 * The three states the pointer lock can be in, driven with real input.
 *
 *  A. GRANTED — a normal desktop. The mouse must still look; the arrow keys
 *     must ALSO look (a binding that only exists after a failure is a binding
 *     nobody learns); and A/D must still strafe rather than turn.
 *  B. ESCAPE — the player pressed Escape, and Chrome refuses to re-lock for
 *     about a second. That is the browser protecting the way out, NOT a school
 *     policy, and the game must not tell the player their mouse is blocked.
 *  C. REFUSED — the LMS iframe case, covered by coldplay's own section.
 *
 * B is the one worth a script of its own: it is the failure a hasty fix makes,
 * and it would put a false "your mouse cannot turn the view" in front of every
 * player who ever pauses the game.
 */
import { chromium } from 'playwright';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });

// NEITHER HEADED NOR HEADLESS CHROMIUM UNDER PLAYWRIGHT EVER GRANTS A REAL
// POINTER LOCK — which is precisely why this defect survived so long, and why
// no harness in this repo had ever exercised the granted path at all.
//
// So the *browser's* half of the contract is scripted here, to the letter of
// the specification and to Chrome's actual behaviour: a grant sets
// `pointerLockElement` and fires `pointerlockchange`; a refusal fires
// `pointerlockerror` and leaves the element null; Escape releases the lock and
// Chrome then refuses to re-lock for ~1.25 s. Everything on the game's side of
// that contract — every line under test — is the real shipped code, driven by
// real keys and a real mouse.
await ctx.addInitScript(() => {
  let el = null, unlockedAt = 0;
  Object.defineProperty(document, 'pointerLockElement', { get: () => el, configurable: true });
  window.__lock = { allow: true, cooldown: 1250, refusals: 0, grants: 0 };
  Element.prototype.requestPointerLock = function () {
    const now = performance.now();
    if (!window.__lock.allow || (unlockedAt && now - unlockedAt < window.__lock.cooldown)) {
      window.__lock.refusals++;
      setTimeout(() => document.dispatchEvent(new Event('pointerlockerror')), 0);
      return Promise.reject(new DOMException('denied', 'SecurityError'));
    }
    el = this; window.__lock.grants++;
    setTimeout(() => document.dispatchEvent(new Event('pointerlockchange')), 0);
    return Promise.resolve();
  };
  document.exitPointerLock = function () {
    if (!el) return;
    el = null; unlockedAt = performance.now();
    setTimeout(() => document.dispatchEvent(new Event('pointerlockchange')), 0);
  };
  // Escape releases the lock, the way the browser does it — above the page.
  addEventListener('keydown', (e) => { if (e.code === 'Escape') document.exitPointerLock(); }, true);
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const out = [];
const note = (ok, label, detail = '') => {
  out.push({ ok, label, detail });
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ' — ' + detail : ''}`);
};

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4500);

const st = () => page.evaluate(() => ({
  locked: window.__ascent.input.locked,
  mode: window.__ascent.input.lookMode,
  denied: window.__ascent.input.lockDenied,
  yaw: window.__ascent.player.yaw,
  ui: !!window.__ascent.input.uiOpen,
  noted: (() => { const n = document.querySelector('#ui .fc-note'); return !!n && !n.hidden; })(),
  look: (() => {
    const li = [...document.querySelectorAll('#ui .fc-rows li')].find((x) => x.dataset.v === 'look');
    return li?.querySelector('.fc-keys')?.innerText.replace(/\s+/g, ' ').trim() || '';
  })(),
}));

const handBack = async () => {
  for (let i = 0; i < 6; i++) {
    if (!(await page.evaluate(() => !!window.__ascent.input.uiOpen))) return;
    let hit = false;
    for (const sel of ['.sc-go', '.ses-charter button', '.ses-rest button']) {
      const b = await page.$(sel);
      if (b && await b.isVisible()) { await b.click().catch(() => {}); hit = true; break; }
    }
    if (!hit) await page.keyboard.press('Escape');
    await page.waitForTimeout(700);
  }
};

// ---------------------------------------------------------------- A. GRANTED
await handBack();
await page.mouse.click(640, 360);
await page.waitForTimeout(1500);
let s = await st();
note(s.locked === true && s.mode === 'pointer',
  'A · a headed desktop GRANTS the lock and the game knows it',
  `locked=${s.locked} mode=${s.mode}`);
note(s.look.toLowerCase().includes('mouse') && !s.noted,
  'A · the card says MOUSE while the mouse works, and shows no warning',
  `look="${s.look}" notice=${s.noted}`);

// mouse still looks under a lock
let y = (await st()).yaw;
await page.mouse.move(900, 360, { steps: 20 });
await page.waitForTimeout(300);
note(Math.abs((await st()).yaw - y) > 0.05, 'A · the MOUSE still looks under a granted lock',
  `${Math.abs((await st()).yaw - y).toFixed(2)} rad`);

// arrows look TOO, under a lock
y = (await st()).yaw;
await page.keyboard.down('ArrowLeft');
await page.waitForTimeout(1200);
await page.keyboard.up('ArrowLeft');
await page.waitForTimeout(300);
note(Math.abs((await st()).yaw - y) > 0.4, 'A · the ARROW KEYS look under a granted lock too',
  `${Math.abs((await st()).yaw - y).toFixed(2)} rad`);

// A/D still strafe, and do NOT turn
y = (await st()).yaw;
const p0 = await page.evaluate(() => ({ ...window.__ascent.player.pos }));
await page.keyboard.down('KeyD');
await page.waitForTimeout(1200);
await page.keyboard.up('KeyD');
await page.waitForTimeout(300);
const p1 = await page.evaluate(() => ({ ...window.__ascent.player.pos }));
const moved = Math.hypot(p1.x - p0.x, p1.z - p0.z);
const turned = Math.abs((await st()).yaw - y);
note(moved > 1 && turned < 0.05, 'A · D still STRAFES and does not turn',
  `moved ${moved.toFixed(1)}m, yaw moved ${turned.toFixed(3)} rad`);

// ----------------------------------------------------------------- B. ESCAPE
// The player presses Escape. The lock goes. They click straight back in — the
// window in which Chrome refuses, and in which a naive fix cries wolf.
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await handBack();
await page.mouse.click(640, 360);           // immediately: this one will be refused
await page.waitForTimeout(600);
s = await st();
note(s.denied === false && !s.noted,
  'B · Escape then an instant re-click is NOT reported as a blocked mouse',
  `denied=${s.denied} notice=${s.noted} mode=${s.mode}`);

// …and a moment later the mouse comes back, without a reload.
await page.waitForTimeout(2200);
await handBack();
await page.mouse.click(640, 360);
await page.waitForTimeout(1500);
s = await st();
note(s.locked === true, 'B · the lock is regained on the next click after the cooldown',
  `locked=${s.locked} mode=${s.mode} notice=${s.noted}`);

note(errors.length === 0, 'no console errors', errors.slice(0, 3).join(' | '));

const failed = out.filter((x) => !x.ok);
console.log(`\n${out.length - failed.length}/${out.length} passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
