/**
 * THE TRANSIENT AUDIT — the half of the layout the matrix could not see.
 *
 * tools/critic/landscape.mjs photographs the game at rest: arrival, the
 * companion talking, a tear, the report, the orders card, the close. It
 * reported 288 frames out of 288 clean. A cold critic then played one session
 * and found three overlaps in it:
 *
 *   1. the interact prompt drawn through the grant card that had just landed;
 *   2. the notice toast printed as grey ghost text in the RUN banner's skirt;
 *   3. a ledger row with its second line cut in half by the kit strip.
 *
 * None of those surfaces is on screen in a resting frame. A prompt needs you to
 * be standing at a ring; an unlock card needs you to have just held a line; a
 * notice needs you to have just been refused something; a ledger row needs the
 * wallet to have just moved. So a matrix of resting frames can be 288 for 288
 * and still have photographed none of the game's collisions.
 *
 * This module is the missing half: the EVENTS that raise those surfaces, driven
 * through the game's own code, and the three questions to ask of the frames
 * they produce that `__landAudit` does not ask. There is a fourth, and it is
 * the one that matters most — DID THE EVENT RAISE ANYTHING AT ALL? The first
 * draft of this harness booted, waited two seconds, photographed seven frames
 * of a cold open with nothing transient on any of them, and reported 7 of 7
 * clean. That is the same answer the resting matrix gave, arrived at the same
 * way, so `intoPlay` below plays the game into a real session with real input
 * before a single frame is judged, every scene names what it exists to raise,
 * and the run fails if a surface was never once on screen.
 *
 *   1. IS IT LEGIBLE? A surface whose owner says it is up, and which settles at
 *      between 2% and 90% opacity, is ghost text. That is defect 2 exactly:
 *      the notice reached full ink eventually, but it spent 300 ms of an
 *      1800 ms life fading in while travelling UP into the banner above it, and
 *      the critic photographed it three times running in that state.
 *   2. IS ANYTHING STANDING ON ANYTHING? Every pair of painted transient
 *      surfaces is intersected as BOXES, not as text. Defect 1 is two opaque
 *      plates in one place; the words never touched, and the plates hid each
 *      other completely.
 *   3. DOES THE FOOT STACK STILL STACK? The ledger rows sit on the kit strip,
 *      and both grow upward off their own bottom edge. The invariant, not the
 *      pixel: the newest ledger row's floor is above the strip's ceiling. That
 *      holds however many verbs have been bought, which a photograph of two
 *      chips does not.
 *
 * Everything here drives the SHIPPING code path. A line is held by answering
 * real items out of the real bank through the real panel; a refusal is the
 * real `kit.flare()` call the F key makes; a levy is the same `wallet.take`
 * src/world/drift.js makes when a surge lands. The only thing composed by hand
 * is which frame we are standing in when the picture is taken.
 */

/** Every transient surface, its owner's own "I am up" class, and its column. */
export const TRANSIENT = [
  { id: 'band', sel: '.ses-band', up: '.ses-band.show', col: 'top' },
  { id: 'notice', sel: '#toast', up: '#toast.show', col: 'top' },
  { id: 'compass', sel: '.afd-head', up: '.afd-head.show', col: 'top' },
  { id: 'grant', sel: '.kit-toast', up: '.kit-toast.show', col: 'stage' },
  { id: 'prompt', sel: '.gd-prompt', up: '.gd-prompt.show', col: 'stage' },
  { id: 'ledger', sel: '.led-row', up: '.led-row.in', col: 'foot-l' },
  { id: 'kit', sel: '.kit', up: '.kit.any', col: 'foot-l' },
  { id: 'chapter', sel: '.meta-turn', up: '.meta-turn.show', col: 'stage' },
  { id: 'rite', sel: '.meta-rite', up: '.meta-rite.show', col: 'stage' },
  { id: 'comms', sel: '.meta-comms', up: '.meta-comms.show', col: 'foot-c' },
  { id: 'plate', sel: '.afd-call .afd-plate', up: '.afd-call .afd-plate', col: 'world' },
  { id: 'hail', sel: '.hail', up: '.hail.show', col: 'world' },
];

/**
 * The audit, as a string, so it survives the full reload a locale switch does.
 * Installs `window.__transAudit()` beside `window.__landAudit()`.
 */
export const TRANS_SRC = `(() => {
  const TRANSIENT = ${JSON.stringify(TRANSIENT)};

  /* A surface is PAINTED if it has ink on the glass. A yielded one
     (src/ui/slots.js) is not painted, and that is a resolved collision rather
     than a defect — the point of the yield is that only one of the two is
     being read. */
  function paint(el) {
    let n = el, op = 1;
    while (n && n.nodeType === 1) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
      op *= parseFloat(cs.opacity || '1');
      n = n.parentElement;
    }
    return op;
  }

  const box = (el) => {
    const r = el.getBoundingClientRect();
    return (r.width < 6 || r.height < 6) ? null : r;
  };

  window.__transAudit = function () {
    const up = [];
    for (const s of TRANSIENT) {
      for (const el of document.querySelectorAll(s.up)) {
        const r = box(el);
        if (!r) continue;
        const op = paint(el);
        up.push({ id: s.id, col: s.col, op: Math.round(op * 1000) / 1000,
          x: Math.round(r.left), y: Math.round(r.top),
          w: Math.round(r.width), h: Math.round(r.height),
          r, text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 46) });
      }
    }

    /* ---- 1. ghosts: up, on the glass, and unreadable ----
       The world's own plates are excluded: they are pinned to a thing out
       there and fade with distance and with the dodge (src/world/tagspace.js),
       so a partial opacity on one is the design rather than a defect. Every
       surface in the HUD's own columns has a state — up or down — and half of
       one is grey text on glass. */
    const ghosts = up.filter((s) => s.col !== 'world' && s.op > 0.02 && s.op < 0.9)
      .map((s) => ({ id: s.id, op: s.op, text: s.text }));

    /* WHO OWNS THE FRAME? A rank rite and a chapter plate are full-bleed —
       their box IS the frame, so intersecting it with anything says only that
       something else is on screen. src/meta/meta.css already decides who may
       stand during one (the ledger may, on purpose: it is the only printing a
       definition ever gets, and a letterbox must not eat it). So a ceremony
       frame is recorded and its pairs are not counted; the words INSIDE it are
       still audited, by __landAudit, which scopes itself to the modal layer. */
    const OWNERS = ['chapter', 'rite'];
    const owner = up.find((s) => OWNERS.includes(s.id) && s.op > 0.02)?.id || null;

    /* ---- 2. two plates in one place ---- */
    const painted = owner ? [] : up.filter((s) => s.op >= 0.9);
    const pairs = [];
    for (let i = 0; i < painted.length; i++) {
      for (let j = i + 1; j < painted.length; j++) {
        const A = painted[i], B = painted[j];
        /* The world's own plate is pinned to a ring out there and dodges the
           chrome frame by frame (src/world/tagspace.js); judging it against a
           card that is 200 ms into a fade is judging the dodge, not the
           layout. It is audited by __landAudit's text test like everything
           else. */
        if (A.col === 'world' || B.col === 'world') continue;
        const w = Math.min(A.r.right, B.r.right) - Math.max(A.r.left, B.r.left);
        const h = Math.min(A.r.bottom, B.r.bottom) - Math.max(A.r.top, B.r.top);
        if (w > 2 && h > 2) {
          pairs.push({ a: A.id, b: B.id, w: Math.round(w), h: Math.round(h),
            at: [Math.round(Math.max(A.r.left, B.r.left)), Math.round(Math.max(A.r.top, B.r.top))],
            ta: A.text, tb: B.text });
        }
      }
    }

    /* ---- 3. the foot-left stack, as an invariant rather than a number ---- */
    const stack = [];
    if (owner) return { up: up.map(({ r, ...s }) => s), owner, ghosts: [], pairs, stack, slots: (() => { try { return window.__ascent?.slots?.() ?? null; } catch { return null; } })() };
    const strip = document.querySelector('.kit.any');
    const rows = [...document.querySelectorAll('.led-row.in')];
    if (strip && rows.length) {
      const sr = strip.getBoundingClientRect();
      if (sr.width > 6 && paint(strip) >= 0.9) {
        for (const row of rows) {
          if (paint(row) < 0.9) continue;
          const rr = row.getBoundingClientRect();
          const over = rr.bottom - sr.top;
          /* Only a row in the strip's own column: a phone composition can move
             the ledger to the other flank, and two things side by side are not
             a stack. */
          const shares = Math.min(rr.right, sr.right) - Math.max(rr.left, sr.left) > 2;
          if (shares && over > 2) {
            stack.push({ over: Math.round(over), text: (row.textContent || '').trim().slice(0, 40) });
          }
        }
      }
    }

    /* ---- 4. what the arbiter did, read back as evidence ---- */
    let slots = null;
    try { slots = window.__ascent?.slots?.() ?? null; } catch { slots = null; }

    return { up: up.map(({ r, ...s }) => s), owner, ghosts, pairs, stack, slots };
  };
})()`;

/**
 * GET INTO PLAY, THE WAY A PLAYER DOES.
 *
 * This is not ceremony: it is the difference between a gate and a false pass.
 * For the first thirty-five seconds of a cold save this game is not in play —
 * `#ui.meta-cine` letterboxes the cold open and hides every readout, and then
 * the orders card takes the frame and `session.blocking()` is true, which
 * retracts the grant card, refuses `kit.flare()` and keeps the run band off
 * screen. A harness that boots, waits two seconds and starts photographing
 * gets seven frames with nothing transient on them at all — and reports them
 * all clean, which is exactly the hole this file exists to close.
 *
 * So: a real click and a real key end the cold open (`Opening.end()` listens
 * for movement), the real GO button on the orders card starts the run, and
 * nothing is photographed until the band is up.
 */
export async function intoPlay(page) {
  await page.mouse.move(page.viewportSize().width / 2, page.viewportSize().height / 2);
  await page.mouse.click(page.viewportSize().width / 2, page.viewportSize().height / 2);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(700);
  await page.keyboard.up('KeyW');
  await page.waitForFunction(
    () => !document.getElementById('ui')?.classList.contains('meta-cine'),
    null, { timeout: 30000 },
  );
  const go = await page.waitForSelector('.ses-charter.show .sc-go', { timeout: 90000 });
  await go.click();
  await page.waitForSelector('.ses-band.show', { timeout: 30000 });
  await page.waitForTimeout(900);
}

/**
 * Wait until no ceremony owns the frame.
 *
 * A rank rite and a chapter plate fire on the game's own clock, off the same
 * seals the scenes below produce. A scene photographed underneath one is not
 * testing what it thinks it is: `kit.flare()` refuses outright while a beat is
 * blocking, and the grant card retracts itself. So every scene starts on a
 * free frame, and the ceremonies are judged where they are raised rather than
 * where they happen to land.
 */
export async function settle(page, ms = 24000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const busy = await page.evaluate(() => {
      const a = window.__ascent;
      if (a?.panel?.open) a.panel.close();
      return !!document.querySelector('.meta-turn.show, .meta-rite.show, .rift.show, .ses-close.show, .ses-rest.show');
    });
    if (!busy) return true;
    await page.waitForTimeout(500);
  }
  return false;
}

/**
 * The events, each raising a real transient surface through real game code.
 *
 * `wants` is the list of surfaces the scene EXISTS to raise. A frame that does
 * not have them is not a clean frame, it is a frame of nothing, and the runner
 * fails it — because a gate that can quietly photograph an empty HUD and pass
 * is the gate this project already had.
 */
export const SCENES = [
  {
    name: 's1-play',
    wants: ['band', 'kit'],
    /** In play, at rest. The frame everything else is added to. */
    async run(page) { await page.waitForTimeout(600); },
  },
  {
    name: 's2-seal',
    /* A held line can raise a rank rite or a chapter plate as well, in any
       order, on the game's own clock — and the grant card stands down under
       either. It is not lost: src/kit/kit.js puts it back at the head of its
       queue, so `check()` waits the ceremony out and then waits for the card,
       which is what the player does too. */
    /* The card and the band. NOT the prompt as well: on a phone the two are
       not allowed to share the frame at all — src/ui/portrait.css and
       src/ui/landscape.css stand the prompt down under the card, which is the
       right answer for 390 px of glass — so demanding a frame with both would
       be demanding the defect back. The prompt is raised by every other scene
       here and is in MUST_RAISE. */
    wants: ['grant', 'band'],
    /** Hold a line, standing at the ring you held it on. The grant card lands
     *  in the middle of the frame while the interact prompt is still up under
     *  it — the exact frame the cold critic photographed at ~(800,530).
     *  Answered through the real panel, out of the real bank, so
     *  `mastery.observe` runs and `kit.sync()` grants what it really grants. */
    async run(page) {
      /* Twice, if the first one is not enough. A grant does not land on every
         held line — the ladder hands one over at its own depths — and the
         first line of a cold save can also spend its whole card underneath the
         rank rite it earned at the same instant. Sealing a second line is what
         a player does next anyway. */
      for (let pass = 0; pass < 2; pass++) {
        await page.evaluate(async () => {
          const a = window.__ascent;
          const id = a.nextObjective?.()?.id || 'one-step-add';
          for (let i = 0; i < 16; i++) {
            if (!a.openRiftById(id)) break;
            const info = a.panelInfo();
            if (!info.open) break;
            a.enter(info.answer);
            await new Promise((r) => setTimeout(r, 240));
            a.panel.close();
            await new Promise((r) => setTimeout(r, 140));
            if (a.state().skills[id]?.mastered) break;
          }
          /* Stand at the ring you just sealed, which is where a player is when
             the card lands, and where the prompt for the next sounding is. */
          a.teleportTo(id);
        });
        /* Three things can hold the frame at the moment a line is held: the tear
           src/main.js chains 460 ms later, a rank rite, and a chapter plate. The
           grant card is not lost to any of them — src/kit/kit.js retracts it and
           puts it back at the head of its own queue — so the honest wait is for
           the frame to be free and THEN for the card, which is also what a
           player experiences. */
        let got = false;
        for (let i = 0; i < 150; i++) {
          const st = await page.evaluate(() => {
            const a = window.__ascent;
            if (a.panel.open) a.panel.close();
            return {
              owner: !!document.querySelector('.meta-turn.show, .meta-rite.show, .ses-close.show, .rift.show'),
              grant: !!document.querySelector('.kit-toast.show'),
            };
          });
          if (!st.owner && st.grant) { got = true; break; }
          await page.waitForTimeout(200);
        }
        if (got) break;
      }
      await page.waitForTimeout(200);
    },
  },
  {
    name: 's3-refusal',
    wants: ['notice', 'band'],
    /** A build refusal, on the real path. `kit.flare()` is what the F key
     *  calls and `kit.beacon()` what G calls; both quote a price, spend a
     *  carried charge if there is one, and refuse with a notice when the
     *  wallet cannot reach it. So the verb is pressed until the wallet is
     *  actually short, which is what a player does — and the notice that comes
     *  back is the real string, printed by the real code, in the notice slot
     *  with the run band above it. Defect 2's frame. */
    async run(page) {
      for (let i = 0; i < 40; i++) {
        const up = await page.evaluate(() => {
          /* A beat that owns the frame refuses these outright (`busy()` in
             src/kit/kit.js), so pressing through one presses nothing. */
          if (document.querySelector('.meta-turn.show, .meta-rite.show, .rift.show, .ses-close.show')) return false;
          const a = window.__ascent;
          /* Beacon first: it is the last rung of the ladder, so it is the one
             verb a cadet this early certainly has not bought, and the refusal
             is guaranteed to be a refusal rather than a purchase. */
          a.kit.beacon();
          a.kit.flare();
          return !!document.querySelector('#toast.show');
        });
        if (up) break;
        await page.waitForTimeout(300);
      }
      await page.waitForTimeout(400);
    },
    /** …and the same slot carrying the longest notice this game can print,
     *  photographed twice: once inside the fade and once settled. */
    async also(page) {
      /* Wait for the notice slot to be free, THEN ask for one. The slot is a
         queue now (src/ui/hud.js) rather than a single element that the next
         message deletes, so a harness that flashes over a live notice is
         photographing the one already up. */
      await page.waitForFunction(() => !document.querySelector('#toast.show'),
        null, { timeout: 8000 }).catch(() => null);
      for (let i = 0; i < 20; i++) {
        const shown = await page.evaluate(() => {
          const a = window.__ascent;
          a.hud.flash(a.t('kit.needShards', { n: 240 }), 'bad');
          return !!document.querySelector('#toast.show');
        });
        if (shown) break;
        await page.waitForTimeout(300);
      }
      await page.waitForSelector('#toast.show', { timeout: 6000 }).catch(() => null);
    },
  },
  {
    name: 's4-surge',
    wants: ['ledger', 'kit'],
    /** A rift surge takes motes. `levy()` is the same `wallet.take(n, 'surge')`
     *  src/world/drift.js makes when the ring catches you, so the ledger prints
     *  its real row — and the first time, the row that says what a surge IS.
     *  That row is two lines long, and it stands on the kit strip. */
    async run(page) {
      await page.evaluate(() => window.__ascent.levy(5));
      await page.waitForTimeout(900);
    },
  },
  {
    name: 's5-grant',
    wants: ['grant'],
    /** THE CARD ON ITS OWN, ON A FREE FRAME.
     *
     *  s2 holds the first line, and on a cold save that one seal also fires a
     *  rank rite and a chapter plate — three ceremonies competing for the same
     *  five seconds, with the grant card the one that stands down (src/kit
     *  retracts and re-queues it). In Spanish the card lost that race in every
     *  window the earlier scenes gave it and the run reported that it had
     *  photographed no grant card at all, which is the coverage assertion
     *  doing exactly its job.
     *
     *  So the card gets a scene of its own, late, when the opening ceremonies
     *  are spent: one more line held, and then a wait for the card on a frame
     *  nothing else owns. This is the frame the cold critic photographed. */
    async run(page) {
      for (let pass = 0; pass < 3; pass++) {
        if (await page.$('.kit-toast.show')) break;
        await page.evaluate(async () => {
          const a = window.__ascent;
          const id = a.nextObjective?.()?.id;
          if (!id) return;
          for (let i = 0; i < 16; i++) {
            if (!a.openRiftById(id)) break;
            const info = a.panelInfo();
            if (!info.open) break;
            a.enter(info.answer);
            await new Promise((r) => setTimeout(r, 220));
            a.panel.close();
            await new Promise((r) => setTimeout(r, 120));
            if (a.state().skills[id]?.mastered) break;
          }
          a.teleportTo(id);
        });
        for (let i = 0; i < 200; i++) {
          const st = await page.evaluate(() => {
            const a = window.__ascent;
            if (a.panel.open) a.panel.close();
            return {
              owner: !!document.querySelector('.meta-turn.show, .meta-rite.show, .ses-close.show, .rift.show'),
              grant: !!document.querySelector('.kit-toast.show'),
            };
          });
          if (!st.owner && st.grant) return;
          await page.waitForTimeout(200);
        }
      }
    },
  },
  {
    name: 's6-storm',
    wants: ['ledger', 'kit', 'band', 'comms'],
    /** All of it inside two seconds, which is the frame nothing is designed
     *  against: a levy, a refusal, the companion's longest line, the band, the
     *  strip and the prompt. */
    async run(page, { long }) {
      await page.evaluate((text) => {
        const a = window.__ascent;
        a.story.comms.clear();
        a.story.comms.say(text, { force: true });
        a.levy(5);
        a.kit.flare();
      }, long);
      await page.waitForTimeout(1400);
    },
  },
];
