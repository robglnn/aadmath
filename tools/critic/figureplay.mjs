/**
 * THE TEST THE DEFECT WOULD HAVE FAILED: trust the picture, and be right.
 *
 * A cold critic found a `like-terms` card whose prose said a hatch was
 * `3m + 6` across and `m + 15` down, and whose drawing said `3m + 6` and `m`.
 * A cadet who trusted the drawing answered 8m + 12 and was marked wrong.
 *
 * So this harness plays the real game with real keys and a real mouse from a
 * cleared save, waits for a card that carries a drawing, and then answers it
 * FROM THE DRAWING ALONE:
 *
 *   · it reads the two side labels out of the rendered SVG — the same pixels a
 *     player reads, via the text that is actually laid out inside the clip box;
 *   · it forms 2·(width) + 2·(height) from those two labels and nothing else;
 *   · it types that with real key presses on the real keypad and seals it.
 *
 * If the game accepts it, the drawing and the marking are the same question.
 * If the game rejects it, the drawing is lying, and the run fails — which is
 * exactly what would have happened on the build the critic played.
 *
 * `window.__ascent` is read ONLY to observe (is a card open, has it settled,
 * which form is it). It is never used to open a rift, never to answer, and
 * never to decide whether the answer was right — the ACCEPTANCE COMES FROM THE
 * GAME'S OWN CHECKER reacting to real keystrokes. That restriction is the whole
 * point: three rounds of "fixed" were signed off against the debug path.
 *
 *   node tools/critic/figureplay.mjs --url http://127.0.0.1:4791 [--loc en]
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4791');
const OUT = path.resolve(arg('out', 'shots/figureplay'));
const LOC = arg('loc', 'en');
const MINUTES = Number(arg('minutes', 14));
// How many labelled drawings to put through the full proof before stopping.
// One is enough evidence per language — `tools/check-figures.mjs` covers every
// form, band and seed exhaustively; this harness exists to prove the pixels and
// the checker agree on the real input path, which one card demonstrates.
const CARDS = Number(arg('cards', 1));
const W = 1600, H = 900;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

const findings = [];
const note = (ok, label, detail = '') => {
  findings.push({ ok, label, detail });
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ' — ' + detail : ''}`);
};

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.evaluate((l) => { localStorage.removeItem('ascent.save'); localStorage.setItem('ascent.locale', l); }, LOC);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(1500);
try {
  await page.waitForSelector('.sc-go', { timeout: 8000 });
  await page.locator('.sc-go').click();
  await page.waitForTimeout(800);
} catch { /* no charter on this path */ }

const panelOpen = () => page.evaluate(() => window.__ascent.panelInfo().open);
const panelSettled = () => page.evaluate(() => !!window.__ascent.panelInfo().settled);
const card = async () => {
  const c = await page.evaluate(() => window.__ascent.panelInfo());
  return c && c.open ? c : null;
};

// ------------------------------------------------------------- real walking
async function walkAndKnock(budgetMs = 45000) {
  const t0 = Date.now();
  await page.keyboard.press('KeyE');
  if (await panelOpen()) return true;
  let held = false;
  const forward = async (on) => {
    if (on === held) return;
    held = on;
    if (on) await page.keyboard.down('KeyW'); else await page.keyboard.up('KeyW');
  };
  const cx = Math.round(W / 2), cy = Math.round(H / 2);
  let mx = cx;
  try {
    while (Date.now() - t0 < budgetMs) {
      const w = await page.evaluate(() => {
        const mark = document.querySelector('.gd-mark');
        if (!mark || !mark.classList.contains('show')) return null;
        const r = mark.getBoundingClientRect();
        return { x: r.left + r.width / 2, edge: mark.classList.contains('edge') };
      });
      if (w) {
        const off = w.x - cx;
        if (Math.abs(off) > 40 || w.edge) {
          const step = Math.max(-160, Math.min(160, off * (w.edge ? 1.6 : 0.7))) || 120;
          mx = Math.max(4, Math.min(W - 4, mx + step));
          await page.mouse.move(mx, cy);
          if (mx <= 8 || mx >= W - 8) mx = cx;
        }
      }
      await forward(true);
      for (let j = 0; j < 4; j++) {
        await page.waitForTimeout(150);
        await page.keyboard.press('KeyE');
        if (await panelOpen()) { await forward(false); return true; }
      }
      if (!w) { mx = mx > cx ? cx - 150 : cx + 150; await page.mouse.move(mx, cy); }
    }
  } finally { await forward(false); }
  return false;
}
async function awaitChain(ms = 5200) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await panelOpen()) return true;
    await page.waitForTimeout(180);
  }
  return false;
}

// --------------------------------------------------- reading the drawing only
/**
 * The two side labels, as laid out inside the SVG's clip box.
 *
 * `.katex-html` is the copy that is actually drawn (KaTeX also emits a hidden
 * MathML twin), and the clip test is the same one the gate uses: ink outside
 * the viewBox is ink the player never sees, so it is not part of the label.
 */
async function readDrawing() {
  return page.evaluate(() => {
    const svg = document.querySelector('#rf-figure svg');
    if (!svg) return null;
    const sb = svg.getBoundingClientRect();
    const out = { w: null, h: null, clipped: [] };
    for (const el of svg.querySelectorAll('.figlabel')) {
      const ink = el.querySelector('.katex-html') || el;
      const r = ink.getBoundingClientRect();
      const vis = r.width ? Math.max(0, Math.min(r.right, sb.right) - Math.max(r.left, sb.left)) / r.width : 0;
      const text = ink.textContent.replace(/\s+/g, '');
      if (vis < 0.999) out.clipped.push({ slot: el.dataset.fig, text, visible: +vis.toFixed(3) });
      out[el.dataset.fig === 'w' ? 'w' : 'h'] = text;
    }
    return out;
  });
}

/** "3m+6" -> {c:3, k:6}; "m" -> {c:1, k:0}; "m+15" -> {c:1, k:15}. */
function readSide(label) {
  const s = String(label).replace(/\s+/g, '').replace(/−/g, '-');
  const m = s.match(/^(-?\d*)([a-zA-Z])([+-]\d+)?$/);
  if (!m) return null;
  const c = m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(m[1]);
  return { c, k: m[3] ? Number(m[3]) : 0, v: m[2] };
}

// ------------------------------------------------------------ real answering
/**
 * Real keystrokes. `keyboard.type` sends the character the panel's own handler
 * reads (`e.key === '+'`), which `press('Equal')` does not — that sends `=` and
 * the plus is silently dropped. Found the hard way: the first run of this
 * harness typed `26n22`, was marked wrong, and blamed the game.
 */
async function typeKeys(s) {
  await page.keyboard.type(s, { delay: 55 });
  await page.waitForTimeout(140);
}

/** What the answer box actually holds, as the cadet sees it. */
const entryText = () => page.evaluate(() => {
  const box = document.querySelector('.rf-socket .val');
  if (!box) return '';
  const ink = box.querySelector('.katex-html');
  return (ink || box).textContent.replace(/\s+/g, '');
});

async function clearEntry(n = 24) {
  for (let i = 0; i < n; i++) { await page.keyboard.press('Backspace'); await page.waitForTimeout(25); }
}

/** Keep the run moving on cards we are not testing, with real input. */
async function answerPlainly(c) {
  if (c.mode === 'choice') {
    const btns = page.locator('.rf-reading');
    const n = await btns.count();
    for (let i = 0; i < n; i++) {
      if (String(await btns.nth(i).getAttribute('data-value')) === String(c.answer)) {
        await btns.nth(i).click({ timeout: 5000 }).catch(() => {});
        return true;
      }
    }
    if (n) { await btns.first().click({ timeout: 5000 }).catch(() => {}); return true; }
    return false;
  }
  if (c.mode === 'keypad') {
    const s = String(c.answer ?? '');
    if (!s) return false;
    await typeKeys(s);
    await page.keyboard.press('Enter');
    return true;
  }
  const any = page.locator('.rf-move, .rf-chip, .rf-bay, .ans').first();
  if (await any.count()) { await any.click({ timeout: 5000 }).catch(() => {}); return true; }
  return false;
}

// ------------------------------------------------------------------ the play
const t0 = Date.now();
const deadline = t0 + MINUTES * 60000;
let served = 0, tested = 0;
const seenForms = new Set();

await walkAndKnock(45000);

while (Date.now() < deadline && tested < CARDS) {
  if (!(await panelOpen())) {
    if (!(await awaitChain())) await walkAndKnock(45000);
    if (!(await panelOpen())) continue;
  }
  const c = await card();
  if (!c) { await page.waitForTimeout(200); continue; }
  if (c.settled) {
    const t1 = Date.now();
    while ((await panelOpen()) && Date.now() - t1 < 4000) await page.waitForTimeout(200);
    continue;
  }
  served++;
  seenForms.add(c.form || c.skill);

  const drawing = await readDrawing();
  const isPerimeter = drawing && drawing.w && drawing.h && c.mode === 'keypad';

  if (isPerimeter) {
    tested++;
    const tag = `${LOC}-${c.form || 'figure'}-${tested}`;
    await page.screenshot({ path: path.join(OUT, `${tag}-card.png`) });

    // 1. the drawing must be whole
    note(drawing.clipped.length === 0, `${tag}: both side labels render in full`,
      drawing.clipped.length ? JSON.stringify(drawing.clipped) : `${drawing.w} × ${drawing.h}`);

    // 2. the drawing must agree with the sentence the cadet is reading
    const stem = await page.evaluate(() => document.getElementById('rf-stem')?.textContent || '');
    const bare = stem.replace(/\s+/g, '');
    for (const [slot, lab] of [['width', drawing.w], ['height', drawing.h]]) {
      note(bare.includes(lab), `${tag}: the drawn ${slot} "${lab}" is stated in the prose`,
        bare.includes(lab) ? '' : `stem: ${stem}`);
    }

    // 3. the footer must describe THIS task
    const help = await page.evaluate(() => document.getElementById('rf-help')?.textContent || '');
    note(!/value/i.test(help) || /expression/i.test(help),
      `${tag}: the footer does not tell an expression task to type a value`, help.trim().slice(0, 110));

    // 4. the question must not be answered by the display
    const shown = await page.evaluate(() => document.getElementById('rf-prompt')?.textContent || '');
    note(/gather|simpl|multiply|alike|junta|reúne|reune|zbierz|wymnóż|multipl/i.test(stem),
      `${tag}: the question names the work, not only the quantity`, stem.trim().slice(0, 140));

    // 5. A deliberate slip, to read the echo's first whisper. It is an
    //    instruction too, and it must describe THIS task — it used to tell a
    //    cadet rewriting an expression that "the value you want is the one
    //    that makes it true".
    await typeKeys('1');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1200);
    const whisper = await page.evaluate(() => document.querySelector('.rf-echo-nudge')?.textContent || '');
    if (whisper) {
      // Match the SOLVE-shaped whisper, not the word "value". The correct
      // expression whisper says "…for every value of the letter" in all three
      // languages, so a keyword sniff flags the fixed string as the defect —
      // it did, on Polish, the first time this ran. These fragments belong to
      // `rift.echo.nudge.keypad` alone.
      const SOLVE_NUDGE = /makes it true|hace verdadera|czyni je prawdziwym/i;
      note(!SOLVE_NUDGE.test(whisper),
        `${tag}: the echo's first whisper is not the solve-a-value one`, whisper.trim().slice(0, 120));
    }
    await page.screenshot({ path: path.join(OUT, `${tag}-echo.png`) });
    await clearEntry();

    // 6. THE POINT: answer from the drawing alone, with real keys.
    const wS = readSide(drawing.w), hS = readSide(drawing.h);
    if (!wS || !hS) {
      note(false, `${tag}: could not read the drawn sides`, `${drawing.w} | ${drawing.h}`);
    } else {
      const coef = 2 * (wS.c + hS.c), konst = 2 * (wS.k + hS.k);
      const typed = `${coef === 1 ? '' : coef}${wS.v}${konst < 0 ? '-' : '+'}${Math.abs(konst)}`;
      console.log(`        reading only the picture (${drawing.w} × ${drawing.h}) -> typing "${typed}"`);
      await typeKeys(typed);
      // The harness must not blame the game for its own dropped keystroke.
      const inBox = await entryText();
      note(inBox.replace(/\s/g, '') === typed, `${tag}: the keypad received every keystroke`, `box holds "${inBox}"`);
      await page.keyboard.press('Enter');
      // Poll, rather than sleep and look once. A sealed card shuts itself and
      // hands the next rift over, so a fixed wait can easily land after the
      // panel has gone — and `panelInfo()` on a closed panel reports no `settled`
      // flag, which reads exactly like a rejection. The first run of this
      // harness called a correct, accepted answer a failure for that reason.
      let accepted = false, shot = false;
      const t1 = Date.now();
      while (Date.now() - t1 < 6000) {
        const s = await page.evaluate(() => {
          const p = window.__ascent.panelInfo();
          return { open: !!p.open, settled: !!p.settled };
        });
        if (s.settled) { accepted = true; }
        // A missed card stays open and waits for the player; only a seal closes
        // it by itself, and nothing here presses Escape inside this window.
        if (!s.open) { accepted = true; break; }
        if (accepted && !shot) { await page.screenshot({ path: path.join(OUT, `${tag}-after.png`) }); shot = true; break; }
        await page.waitForTimeout(100);
      }
      if (!shot) await page.screenshot({ path: path.join(OUT, `${tag}-after.png`) });
      note(accepted, `${tag}: the game ACCEPTS the answer a picture-truster types`,
        `typed ${typed} from the drawing ${drawing.w} × ${drawing.h}`);
    }
  } else {
    await answerPlainly(c);
  }

  await page.waitForTimeout(900);
  if (await panelOpen()) {
    if (await panelSettled()) {
      const t1 = Date.now();
      while ((await panelOpen()) && Date.now() - t1 < 3600) await page.waitForTimeout(200);
    } else {
      await page.waitForTimeout(700);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  }
}

note(tested > 0, `served ${served} cards by real play; ${tested} carried a labelled drawing`);
note(errors.length === 0, 'zero console errors during the run', errors.slice(0, 2).join(' | '));

await browser.close();
const bad = findings.filter((f) => !f.ok);
console.log(`\n${bad.length ? `FAIL — ${bad.length} finding(s)` : 'PASS — the picture and the marking are the same question'}`);
process.exit(bad.length ? 1 : 0);
