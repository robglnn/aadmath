/**
 * Does Marlow know where the cadet is?
 *
 * Drives the REAL running game at three points on the arc — a cadet who has
 * done nothing, one mid-game, and a fully-mastered save at a hundred and thirty
 * seals — in all three locales, and records every sentence he actually says at
 * each. The reported defect was that the third of those was still being told
 * what a rift is, so the pass here is not "does the bank contain good lines"
 * but "what came out of the channel, in front of this specific cadet".
 *
 *   node tools/narrative/marlow.mjs --url http://127.0.0.1:PORT --out shots/marlow
 *
 * FIVE PROBES per cadet per locale, in an order chosen so that the ceremonies
 * do not eat the evidence. The chapter plate and the coda both call
 * `comms.clear()` — correctly; two voices over each other throws a good beat
 * away — so the run settles until no ceremony is in flight before every probe,
 * and the probes that cannot turn a chapter (missing, falling) go first.
 *
 * Exits non-zero on any console error, or if a tutorial sentence reaches a
 * cadet who has sealed anything.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/marlow'));
const W = Number(arg('w', 1600)), H = Number(arg('h', 900));

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
    '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const logs = [];

/**
 * The three cadets. Each is built through the game's own hooks — the seal
 * ledger the scheduler writes to, and the mastery state the engine promotes —
 * so the story reads exactly what a real save of that shape would give it.
 */
const CADETS = [
  { id: 'a-landfall', label: '0 seals · nothing held · just landed', build: () => {} },
  {
    id: 'b-midgame', label: '12 seals · 2 lines held · mid-game',
    build: (a) => {
      for (const id of a.mastery.graph.nodes.map((n) => n.id).slice(0, 2)) {
        const s = a.mastery.state.get(id);
        if (s) { s.mastered = true; s.pL = 0.97; }
      }
      a.story.seal(12);
    },
  },
  {
    id: 'c-sovereign', label: '130 seals · 10 lines held · Sovereign · every chapter open',
    build: (a) => {
      for (const s of a.mastery.state.values()) { s.mastered = true; s.pL = 0.99; }
      a.story.seal(130);
    },
  },
];

/**
 * The first clause of each tutorial line, per locale. Matched as a substring
 * against the real transcript rather than by key, so a regression that
 * reintroduces the sentence under a different key is still caught.
 */
const TUTORIAL_MARKERS = {
  en: ['That tear ahead of you is a rift', 'permanent feature of reality', 'The obelisk in the plaza is the Standard'],
  es: ['Ese desgarro que tienes delante es una grieta', 'rasgo permanente de la realidad', 'El obelisco de la plaza es el Estandarte'],
  pl: ['To rozdarcie przed tobą to wyrwa', 'trwałą cechą rzeczywistości', 'Obelisk na placu to Wzorzec'],
};

const runs = [];

for (const cadet of CADETS) {
  for (const loc of ['en', 'es', 'pl']) {
    const page = await ctx.newPage();
    page.on('console', (m) => logs.push({ type: m.type(), text: m.text(), where: `${cadet.id}/${loc}` }));
    page.on('pageerror', (e) => logs.push({ type: 'pageerror', text: e.message, where: `${cadet.id}/${loc}` }));

    // A clean slate every time: the defect was partly *about* stale saves, so a
    // run that inherited one would prove nothing.
    await page.addInitScript((l) => {
      try { localStorage.clear(); localStorage.setItem('ascent.locale', l); } catch { /* private mode */ }
      // src/session opens its ORDERS card over the frame and Marlow's channel
      // correctly waits behind it. Dismissing it once is not enough — the run
      // opens a new one on its own clock — so this presses the button whenever
      // it appears, exactly as a player does, for the whole run.
      setInterval(() => {
        try { window.__ascent?.session?.charter?.begin?.(); } catch { /* not up yet */ }
      }, 350);
    }, loc);
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
    await page.waitForTimeout(2500);

    const probes = [];
    const mark = () => page.evaluate(() => window.__ascent.story.said().length);
    const since = async (n) => (await page.evaluate(() => window.__ascent.story.said())).slice(n);
    const snap = () => page.evaluate(() => {
      const s = window.__ascent.story.state();
      return {
        seals: s.seals, lines: s.lines, rank: s.rank, chapter: s.chapter,
        register: s.register, stage: s.stage, peak: s.peak, canTutor: s.canTutor,
      };
    });
    /**
     * Wait until no full-screen ceremony and no queued speech is in flight, and
     * dismiss the session's ORDERS card the way a player does. src/session holds
     * the frame with that card and Marlow's channel correctly waits behind it;
     * a harness that does not press the button photographs the modal instead of
     * the companion, and reads a transcript with a two-minute hole in it.
     */
    const settle = async (max = 26000) => {
      const t0 = Date.now();
      for (;;) {
        const busy = await page.evaluate(() => {
          const a = window.__ascent;
          a.session?.charter?.begin?.();
          a.session?.resolution?.hide?.();
          a.session?.rest?.hide?.();
          return a.story.comms.busy || !!a.story.turn?.playing || !!a.story.rite?.playing;
        });
        if (!busy || Date.now() - t0 > max) return;
        await page.waitForTimeout(600);
      }
    };
    /**
     * `body` is handed a `shoot()` it calls at the instant the line is on
     * screen. A frame taken after the probe finishes photographs an empty
     * channel — the panel holds a line for about three seconds — which is how
     * you end up with nine screenshots of scenery and no evidence.
     */
    const probe = async (name, body, shotName) => {
      await settle();
      await page.evaluate(() => window.__ascent.story.comms.clear());
      await page.waitForTimeout(250);
      const at = await mark();
      const state = await snap();
      let shot = 0;
      const shoot = async () => {
        const n = shot++ ? `${shotName}-${shot}` : shotName;
        await page.screenshot({ path: path.join(OUT, `${cadet.id}-${loc}-${n}.png`) });
      };
      await body(shoot);
      if (!shot && shotName) await shoot();
      const said = await since(at);
      probes.push({ probe: name, state, said });
      return said;
    };

    // -- the cold open plays for a fresh cadet; let it, then build the state --
    await settle();
    await page.evaluate((fn) => {
      // eslint-disable-next-line no-new-func
      new Function('a', `(${fn})(a)`)(window.__ascent);
    }, cadet.build.toString());
    await page.waitForTimeout(1200);
    await settle();

    // 1. WALKING UP TO A RIFT — where the tutorial line used to reach a Sovereign
    await probe('approach a rift', async (shoot) => {
      await page.evaluate(() => {
        const a = window.__ascent;
        const r = a.rifts.list.find((x) => x.open !== false) || a.rifts.list[0];
        if (r) { a.player.pos.set(r.pos.x, r.pos.y + 1, r.pos.z + 6); a.player.vel.set(0, 0, 0); }
      });
      await page.waitForTimeout(2400);
      await shoot();                     // the line is on screen right now
      await page.waitForTimeout(2800);
    }, '01-rift');

    // 2. THREE MISSES IN A ROW — cannot turn a chapter, so it is safe to run first
    await probe('three misses in a row', async (shoot) => {
      for (let i = 0; i < 3; i++) {
        const opened = await page.evaluate(() => {
          const a = window.__ascent;
          a.panel.close();
          const next = a.nextObjective();
          if (!next) return null;
          const id = next.skill || next.id || next;
          return a.openRiftById(id) ? id : null;
        });
        if (!opened) break;
        await page.waitForTimeout(320);
        await page.evaluate(() => { const a = window.__ascent; if (a.panel.open) a.enter('999999'); });
        await page.waitForTimeout(1100);
      }
      await page.evaluate(() => window.__ascent.panel.close());
      await page.waitForTimeout(1500);
      await shoot();
      await page.waitForTimeout(900);
    }, '02-slump');

    // 3. SEALING — the recovery beat, then the ordinary rhythm of a good run
    await probe('seal four in a row', async (shoot) => {
      for (let i = 0; i < 4; i++) {
        const opened = await page.evaluate(() => {
          const a = window.__ascent;
          a.panel.close();
          const next = a.nextObjective();
          if (!next) return null;
          const id = next.skill || next.id || next;
          return a.openRiftById(id) ? id : null;
        });
        if (!opened) break;
        await page.waitForTimeout(320);
        await page.evaluate(() => { const a = window.__ascent; if (a.panel.open) a.enter(a.panel.item.answer); });
        await page.waitForTimeout(1300);
      }
      await page.evaluate(() => window.__ascent.panel.close());
      await page.waitForTimeout(1400);
      await shoot();
      await page.waitForTimeout(1200);
    }, '03-sealed');

    // 4. OFF THE EDGE. The controller fires `onFall` when the rig drops through
    //    y = -180. Writing the player straight to that depth does not work:
    //    locomotion resolves against the ground before the check runs and snaps
    //    the rig back onto the island, so the probe read as a companion with
    //    nothing to say about falling. The honest trigger is to put the cadet
    //    over actual void — a column where the island has no surface — and let
    //    the real physics do the rest.
    await probe('fall off the world', async (shoot) => {
      await page.evaluate(() => {
        const a = window.__ascent;
        let spot = null;
        for (let r = 220; r < 4000 && !spot; r += 60) {
          for (const [dx, dz] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
            const x = r * dx, z = r * dz;
            const y = a.islandAt(x, z);
            if (typeof y === 'number' && y < -40) { spot = [x, z]; break; }
          }
        }
        const [x, z] = spot || [3000, 3000];
        a.player.pos.set(x, 40, z);
        a.player.vel.set(0, -60, 0);
      });
      await page.waitForTimeout(2600);
      await shoot();
      await page.waitForTimeout(2600);
    }, '04-fall');

    // 5. THE BANKS THEMSELVES, rendered through the real `t()` in this locale —
    //    the material Marlow has available to this cadet, including the banks
    //    (idle) whose trigger is a 52-second silence no harness should sit out.
    const banks = await page.evaluate(() => {
      const a = window.__ascent;
      const keys = a.story.banks();
      const out = {};
      for (const [bank, key] of Object.entries(keys)) {
        const v = a.t(key, { skill: a.t('skills.two-step') });
        out[bank] = { key, lines: Array.isArray(v) ? v : [v] };
      }
      return out;
    });

    const state = await snap();
    const said = probes.flatMap((p) => p.said);
    const markers = TUTORIAL_MARKERS[loc];
    const tutored = said.filter((s) => markers.some((m) => s.text.includes(m)));
    const texts = said.map((s) => s.text);
    const dupes = [...new Set(texts.filter((x, i) => texts.indexOf(x) !== i))];

    runs.push({
      cadet: cadet.id, label: cadet.label, locale: loc,
      state, probes, banks, lines: said.length, tutored, dupes,
    });
    await page.close();
  }
}

const errors = logs.filter((l) => l.type === 'error' || l.type === 'pageerror');
const leaks = runs.filter((r) => r.tutored.length && r.probes[0].state.seals > 0);

await writeFile(path.join(OUT, 'marlow.json'), JSON.stringify({ runs, errors }, null, 2));

console.log('\n=== what Marlow actually said, by cadet and locale ===\n');
for (const r of runs) {
  console.log(`════ ${r.cadet}  ${r.locale.toUpperCase()}  ·  ${r.label}`);
  for (const p of r.probes) {
    const s = p.state;
    console.log(`  · ${p.probe}  [${s.seals} seals · ${s.lines} lines · ${s.rank} · ch${s.chapter}` +
      ` → register "${s.register}", canTutor ${s.canTutor}]`);
    if (!p.said.length) console.log('      (silence)');
    for (const line of p.said) console.log(`      ${line.text}`);
  }
  console.log(`  banks in play: ${Object.entries(r.banks).map(([b, v]) => `${b}=${v.lines.length}`).join(' ')}`);
  if (r.tutored.length) console.log(`  !! TUTORIAL LINE FIRED: ${r.tutored.map((x) => x.text).join(' | ')}`);
  if (r.dupes.length) console.log(`  !! repeated: ${r.dupes.length}`);
  console.log('');
}
console.log(`console errors: ${errors.length}`);
errors.slice(0, 8).forEach((e) => console.log(`  ! [${e.where}] ${e.text.split('\n')[0]}`));
console.log(`tutorial leaks into an experienced cadet: ${leaks.length}`);
for (const l of leaks) console.log(`  ! ${l.cadet}/${l.locale}: ${l.tutored[0].text}`);
console.log(`shots -> ${OUT}`);

await browser.close();
process.exit(errors.length || leaks.length ? 2 : 0);
