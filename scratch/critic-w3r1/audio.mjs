import { chromium } from 'playwright';
const URL = 'http://127.0.0.1:4791';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push('E:' + m.text()); });
page.on('pageerror', (e) => logs.push('PE:' + e.message));

// instrument the audio graph before the app boots
await page.addInitScript(() => {
  window.__nodes = [];
  const wrap = (Ctor, name) => {
    const P = Ctor.prototype;
    for (const k of ['createOscillator', 'createBufferSource', 'createGain', 'createBiquadFilter', 'createConvolver', 'createDynamicsCompressor', 'createStereoPanner', 'createPanner', 'createWaveShaper', 'createDelay']) {
      if (!P[k]) continue;
      const orig = P[k];
      P[k] = function (...a) { const n = orig.apply(this, a); window.__nodes.push({ k, t: this.currentTime }); return n; };
    }
  };
  wrap(AudioContext);
  if (window.OfflineAudioContext) wrap(OfflineAudioContext);
});
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
await page.waitForTimeout(3000);
await page.mouse.click(640, 360);
await page.waitForTimeout(3000);
await page.evaluate(() => { window.__nodes.length = 0; });

// place three pieces and remove one; count what the graph did
await page.keyboard.press('Digit2');
await page.waitForTimeout(300);
const t0 = await page.evaluate(() => window.__nodes.length);
await page.evaluate(() => window.__ascent.build());
await page.waitForTimeout(600);
const t1 = await page.evaluate(() => window.__nodes.slice());
await page.evaluate(() => window.__ascent.unbuild());
await page.waitForTimeout(600);
const t2 = await page.evaluate(() => window.__nodes.slice());
console.log('nodes after place', t1.length - t0, JSON.stringify(t1.slice(t0).map(n => n.k)));
console.log('nodes after remove', t2.length - t1.length, JSON.stringify(t2.slice(t1.length).map(n => n.k)));

// render a real buffer of the place cue if the audio module exposes one
const graph = await page.evaluate(() => {
  const a = window.__ascent.audio;
  return { keys: Object.keys(a), ctxState: a.ctx?.state, sampleRate: a.ctx?.sampleRate,
    master: a.master?.gain?.value, buses: Object.keys(a).filter(k => a[k] && a[k].gain) };
});
console.log('AUDIO', JSON.stringify(graph));
console.log('LOGS', logs.length, logs.join(' | '));
await browser.close();
