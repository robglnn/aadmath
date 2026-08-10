// Independent critic capture: drive the frozen build, tap the master bus,
// record labelled takes to WAV + raw Float32 for offline analysis.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4788');
const OUT = path.resolve(arg('out', '/tmp/critic-audio/out'));
const SCENE = arg('scene', 'world');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(1500);

await page.mouse.click(640, 360);
await page.waitForFunction(() => window.__ascent.audio?.bus?.ready, null, { timeout: 10000 });

const info = await page.evaluate(() => {
  const bus = window.__ascent.audio.bus;
  const c = bus.ctx;
  if (bus.muted) bus.setMuted(false);
  const rec = { chunks: [], rate: c.sampleRate, marks: [], t0: 0, started: false };
  window.__rec = rec;
  const sp = c.createScriptProcessor(2048, 2, 2);
  sp.onaudioprocess = (e) => {
    if (!rec.started) return;
    const l = e.inputBuffer.getChannelData(0);
    const r = e.inputBuffer.getChannelData(1);
    const out = new Float32Array(l.length * 2);
    for (let i = 0; i < l.length; i++) { out[i * 2] = l[i]; out[i * 2 + 1] = r[i]; }
    rec.chunks.push(out);
  };
  bus.out.connect(sp);
  const zero = c.createGain(); zero.gain.value = 0;
  sp.connect(zero); zero.connect(c.destination);
  window.__recStart = () => { rec.started = true; rec.t0 = c.currentTime; };
  window.__mark = (label) => rec.marks.push({ label, t: c.currentTime - rec.t0 });
  window.__grab = () => {
    const n = rec.chunks.reduce((a, b) => a + b.length, 0);
    const all = new Float32Array(n); let o = 0;
    for (const ch of rec.chunks) { all.set(ch, o); o += ch.length; }
    rec.chunks.length = 0;
    return { rate: rec.rate, marks: rec.marks.splice(0), data: Array.from(all) };
  };
  return { rate: c.sampleRate, state: c.state, muted: bus.muted };
});
console.error('ctx', JSON.stringify(info));

const takes = [];
async function record(label, fn, ms) {
  await page.evaluate(() => { window.__rec.chunks.length = 0; window.__rec.marks.length = 0; window.__recStart(); });
  await fn();
  await page.waitForTimeout(ms);
  const g = await page.evaluate(() => window.__grab());
  const data = Float32Array.from(g.data);
  await writeFile(path.join(OUT, `${label}.f32`), Buffer.from(data.buffer));
  takes.push({ label, rate: g.rate, frames: data.length / 2, marks: g.marks });
  console.error(`take ${label}: ${(data.length / 2 / g.rate).toFixed(1)}s`);
}

const tp = (x, y, z) => page.evaluate(([px, py, pz]) => {
  const a = window.__ascent;
  const g = a.player.groundAt ? a.player.groundAt(px, pz) : null;
  a.player.pos.set(px, py === null ? (g ?? 20) + 0.4 : py, pz);
  a.player.vel.set(0, 0, 0);
}, [x, y, z]);

if (SCENE === 'world') {
  await record('01-idle-home', async () => { await tp(0, null, 8); }, 12000);

  await record('02-run-grass', async () => {
    await tp(0, null, 40); await page.waitForTimeout(400);
    await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
  }, 6000);
  await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');

  // surfaces: query the director's own decision for each
  const spots = [[0, 6], [-30, 70], [24, -114], [60, -100], [40, 110], [-110, -10], [90, 40]];
  for (let i = 0; i < spots.length; i++) {
    const [x, z] = spots[i];
    await tp(x, null, z);
    await page.waitForTimeout(600);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(500);
    const sfc = await page.evaluate(() => window.__ascent.audio._surface);
    await record(`03-feet-${i}-${sfc}`, async () => {}, 3200);
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(300);
  }

  await record('04-glide', async () => {
    await page.evaluate(() => {
      const a = window.__ascent;
      a.player.pos.set(0, (a.player.groundAt(0, 60) ?? 20) + 120, 60);
      a.player.vel.set(0, 0, 0);
    });
    await page.waitForTimeout(600);
    await page.keyboard.press('Space'); await page.waitForTimeout(250);
    await page.keyboard.press('Space'); await page.waitForTimeout(250);
    await page.keyboard.press('Space');
    await page.keyboard.down('KeyW');
  }, 7000);
  await page.keyboard.up('KeyW');

  await record('05-freefall', async () => {
    await page.evaluate(() => {
      const a = window.__ascent;
      a.player.pos.set(20, (a.player.groundAt(20, 60) ?? 20) + 150, 60);
      a.player.vel.set(0, 0, 0);
    });
  }, 5000);
}

if (SCENE === 'feetsolo') {
  await page.evaluate(() => {
    const b = window.__ascent.audio.bus;
    for (const k of ['music', 'amb', 'ui']) b[k].gain.value = 0;
  });
  const spots = [[0, 6], [-30, 70], [24, -114], [60, -100], [40, 110], [-110, -10], [90, 40], [-70, 120], [130, -30]];
  for (let i = 0; i < spots.length; i++) {
    const [x, z] = spots[i];
    await tp(x, null, z);
    await page.waitForTimeout(700);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(600);
    const sfc = await page.evaluate(() => window.__ascent.audio._surface);
    await record(`f${i}-walk-${sfc}`, async () => {}, 3600);
    await page.keyboard.down('ShiftLeft');
    await page.waitForTimeout(500);
    const sfc2 = await page.evaluate(() => window.__ascent.audio._surface);
    await record(`f${i}-run-${sfc2}`, async () => {}, 3200);
    await page.keyboard.up('ShiftLeft');
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(300);
  }
  // jump / land / dash / wing, on grass
  await tp(0, null, 40); await page.waitForTimeout(600);
  await record('fx-jumpland', async () => {
    await page.keyboard.press('Space');
  }, 2600);
  await record('fx-dash', async () => {
    await page.keyboard.down('KeyW'); await page.keyboard.press('ShiftLeft');
    await page.evaluate(() => { const l = window.__ascent.player.loco; if (l.dash) l.dash(); });
    await page.keyboard.press('KeyE');
  }, 2200);
  await page.keyboard.up('KeyW');
  await record('fx-build', async () => {
    await page.evaluate(() => { try { window.__ascent.build(); } catch (e) {} });
  }, 2200);
}

if (SCENE === 'score2') {
  const silence = () => page.evaluate(() => {
    const a = window.__ascent.audio, b = a.bus;
    for (const k of ['amb', 'sfx', 'ui']) b[k].gain.value = 0;
    const SKIP = new Set(['A', 'bus', 'ctx', 'master', 'out', 'destination']);
    const kill = (o, d = 0) => {
      if (!o || d > 3 || o === b || o instanceof AudioContext) return;
      if (o.gain && typeof o.gain.value === 'number' && o.gain.setValueAtTime) { o.gain.value = 0; return; }
      if (Array.isArray(o)) { o.forEach((x) => kill(x, d + 1)); return; }
      if (typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (!SKIP.has(k)) kill(v, d + 1); }
    };
    kill(a.amb); kill(a.hum);
    a.amb.update = () => {}; a.hum.update = () => {};
    window.__silenceWorld = true;
  });
  await silence();
  await page.evaluate(() => {
    const a = window.__ascent.audio;
    const su = a.score.update.bind(a.score);
    window.__pin = { place: 'home', mastery: 0, travel: 0.6, alt: 0 };
    a.score.update = (dt) => {
      const p = window.__pin;
      a.score.setPlace(p.place); a.score.setMastery(p.mastery);
      a.score.travel = p.travel; a.score.alt = p.alt; a.score.focus = 0;
      su(dt);
    };
  });
  const takes3 = [
    ['m-home-empty', 'home', 0.02, 0.6, 40000],
    ['m-home-full', 'home', 0.97, 0.6, 40000],
    ['m-alpine-full', 'alpine', 0.97, 0.6, 40000],
    ['m-verdant-half', 'verdant', 0.5, 0.6, 40000],
    ['m-badland-empty', 'badland', 0.05, 0.6, 40000],
    ['m-mire-half', 'mire', 0.5, 0.6, 40000],
    ['m-home-still', 'home', 0.6, 0.0, 60000],
  ];
  for (const [label, place, m, tr, ms] of takes3) {
    await page.evaluate(([p, mm, t]) => { window.__pin.place = p; window.__pin.mastery = mm; window.__pin.travel = t; }, [place, m, tr]);
    await silence();
    await page.waitForTimeout(5000);
    await silence();
    await record(label, async () => {}, ms);
  }
}

if (SCENE === 'score') {
  await page.evaluate(() => {
    const a = window.__ascent.audio, b = a.bus;
    for (const k of ['amb', 'sfx', 'ui']) b[k].gain.value = 0;
    const su = a.score.update.bind(a.score);
    window.__pin = { place: 'home', mastery: 0, travel: 0.6, alt: 0 };
    a.score.update = (dt) => {
      const p = window.__pin;
      a.score.setPlace(p.place); a.score.setMastery(p.mastery);
      a.score.travel = p.travel; a.score.alt = p.alt; a.score.focus = 0;
      su(dt);
    };
  });
  const takes2 = [
    ['s-home-empty', 'home', 0.02, 0.5],
    ['s-home-half', 'home', 0.5, 0.5],
    ['s-home-full', 'home', 0.97, 0.5],
    ['s-alpine-full', 'alpine', 0.97, 0.5],
    ['s-verdant-half', 'verdant', 0.5, 0.5],
    ['s-badland-empty', 'badland', 0.05, 0.5],
    ['s-mire-half', 'mire', 0.5, 0.5],
    ['s-home-still', 'home', 0.6, 0.0],
  ];
  for (const [label, place, m, tr] of takes2) {
    await page.evaluate(([p, mm, t]) => { window.__pin.place = p; window.__pin.mastery = mm; window.__pin.travel = t; }, [place, m, tr]);
    await page.waitForTimeout(6000); // let crossfades settle before recording
    await record(label, async () => {}, 16000);
  }
}

if (SCENE === 'rift') {
  await page.evaluate(() => window.__ascent.teleportTo('var-meaning'));
  await page.waitForTimeout(1200);
  // approach: hum shift
  await record('r-far', async () => {
    await page.evaluate(() => {
      const a = window.__ascent;
      const r = a.rifts.list[0];
      a.player.pos.set(r.pos.x + 70, (a.player.groundAt(r.pos.x + 70, r.pos.z) ?? 20) + 0.4, r.pos.z);
    });
  }, 5000);
  await record('r-near', async () => {
    await page.evaluate(() => {
      const a = window.__ascent;
      const r = a.rifts.list[0];
      a.player.pos.set(r.pos.x + 7, (a.player.groundAt(r.pos.x + 7, r.pos.z) ?? 20) + 0.4, r.pos.z);
    });
  }, 5000);
  await record('r-open', async () => {
    await page.evaluate(() => window.__ascent.openRiftById('var-meaning'));
  }, 5000);
  await record('r-wrong', async () => {
    await page.evaluate(() => window.__ascent.audio.answered(false, null));
  }, 5000);
  await record('r-wrong2', async () => {
    await page.evaluate(() => window.__ascent.audio.answered(false, null));
  }, 5000);
  await record('r-right', async () => {
    await page.evaluate(() => window.__ascent.audio.answered(true, { pL: 0.55, justMastered: false }));
  }, 6000);
  await record('r-mastered', async () => {
    await page.evaluate(() => window.__ascent.audio.answered(true, { pL: 0.95, justMastered: true }));
  }, 7000);
  await record('r-close', async () => {
    await page.evaluate(() => { window.__ascent.panel.close(); });
  }, 4000);
}

if (SCENE === 'stings') {
  await page.evaluate(() => {
    const a = window.__ascent.audio, b = a.bus;
    const SKIP = new Set(['A', 'bus', 'ctx', 'master', 'out', 'destination']);
    const kill = (o, d = 0) => {
      if (!o || d > 3 || o === b || o instanceof AudioContext) return;
      if (o.gain && typeof o.gain.value === 'number' && o.gain.setValueAtTime) { o.gain.value = 0; return; }
      if (Array.isArray(o)) { o.forEach((x) => kill(x, d + 1)); return; }
      if (typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (!SKIP.has(k)) kill(v, d + 1); }
    };
    kill(a.amb); kill(a.hum);
    a.amb.update = () => {}; a.hum.update = () => {};
    a.score.enabled = false;
    b.music.gain.value = 0;
  });
  await page.waitForTimeout(6000);
  const evs = [
    ['t-seal-low', 's.seal({place:"home",mastery:0.2,big:false})', 7000],
    ['t-seal-high', 's.seal({place:"home",mastery:0.9,big:false})', 7000],
    ['t-seal-big', 's.seal({place:"home",mastery:0.95,big:true})', 8000],
    ['t-slip1', 's.slip(1)', 4000],
    ['t-slip2', 's.slip(2)', 4000],
    ['t-slip3', 's.slip(3)', 4000],
    ['t-inrange', 's.inRange()', 3000],
    ['t-riftopen', 's.riftOpen()', 4000],
    ['t-riftclose', 's.riftClose()', 4000],
    ['t-place', 's.place(0)', 3000],
    ['t-anchor', 's.anchor()', 4000],
    ['t-unlocked', 's.unlocked()', 5000],
    ['t-comms', 's.commsBlip()', 3000],
    ['t-commit', 's.commit()', 2500],
    ['t-tick', 's.tick()', 2000],
  ];
  for (const [label, code, ms] of evs) {
    await record(label, async () => {
      await page.evaluate((c) => {
        const s = window.__ascent.audio.sting;
        // eslint-disable-next-line no-eval
        eval(c);
      }, code);
    }, ms);
    await page.waitForTimeout(700);
  }
  // feet solo, one material, single steps
  await record('t-feet-single', async () => {
    await page.evaluate(() => {
      const a = window.__ascent.audio;
      a.feet.step('grass', 0.8, -0.3, 0);
      setTimeout(() => a.feet.step('stone', 0.8, 0.3, 0), 700);
      setTimeout(() => a.feet.step('snow', 0.8, -0.3, 0), 1400);
      setTimeout(() => a.feet.step('water', 0.8, 0.3, 0), 2100);
      setTimeout(() => a.feet.step('scree', 0.8, -0.3, 0), 2800);
      setTimeout(() => a.feet.step('lattice', 0.8, 0.3, 0), 3500);
      setTimeout(() => a.feet.step('dust', 0.8, -0.3, 0), 4200);
    });
  }, 6000);
}

if (SCENE === 'hum') {
  await page.evaluate(() => {
    const a = window.__ascent.audio, b = a.bus;
    const SKIP = new Set(['A', 'bus', 'ctx', 'master', 'out', 'destination']);
    const kill = (o, d = 0) => {
      if (!o || d > 3 || o === b || o instanceof AudioContext) return;
      if (o.gain && typeof o.gain.value === 'number' && o.gain.setValueAtTime) { o.gain.value = 0; return; }
      if (Array.isArray(o)) { o.forEach((x) => kill(x, d + 1)); return; }
      if (typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (!SKIP.has(k)) kill(v, d + 1); }
    };
    kill(a.amb); a.amb.update = () => {};
    a.score.enabled = false;
    b.music.gain.value = 0; b.sfx.gain.value = 0; b.ui.gain.value = 0;
    window.__ascent.teleportTo('var-meaning');
  });
  await page.waitForTimeout(3000);
  for (const d of [90, 60, 40, 25, 14, 7, 3]) {
    await page.evaluate((dd) => {
      const a = window.__ascent;
      const r = a.rifts.list.reduce((best, x) => x, a.rifts.list[0]);
      const t = a.rifts.list[0];
      a.player.pos.set(t.pos.x + dd, (a.player.groundAt(t.pos.x + dd, t.pos.z) ?? 20) + 1.2, t.pos.z);
      a.player.vel.set(0, 0, 0);
    }, d);
    await page.waitForTimeout(3500);
    await record(`h-${String(d).padStart(2, '0')}m`, async () => {}, 4000);
  }
  await record('h-resolve', async () => {
    await page.evaluate(() => window.__ascent.audio.hum.resolve(0));
  }, 5000);
  await record('h-tighten', async () => {
    await page.evaluate(() => window.__ascent.audio.hum.tighten(0));
  }, 5000);
}

if (SCENE === 'real') {
  // an actual played rift: type an answer through the real UI
  await page.evaluate(() => window.__ascent.teleportTo('var-meaning'));
  await page.waitForTimeout(1000);
  await record('real-flow', async () => {
    await page.evaluate(() => window.__ascent.openRiftById('var-meaning'));
    await page.waitForTimeout(2500);
    // wrong answer through real input
    const inp = await page.$('.panel input, .rift input, input[type=text], input');
    if (inp) { await inp.click(); await page.keyboard.type('999'); await page.keyboard.press('Enter'); }
    await page.waitForTimeout(4000);
  }, 6000);
}

await writeFile(path.join(OUT, 'takes.json'), JSON.stringify({ takes, errors, info }, null, 2));
console.error('errors:', errors.length, JSON.stringify(errors.slice(0, 5)));
await browser.close();
