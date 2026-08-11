import 'katex/dist/katex.min.css';
import './ui/style.css';
import * as THREE from 'three';
import { Engine } from './core/engine.js';
import { Input } from './core/input.js';
import { createWorld, heightAt as groundHeight } from './world/world.js';
import { Rifts } from './world/rifts.js';
import { Player } from './player/controller.js';
import { setSolids } from './player/terrain.js';
import { Builder } from './build/builder.js';
import { createFX } from './fx/index.js';
import { HUD } from './ui/hud.js';
import { RiftPanel } from './ui/rift.js';
import { MasteryEngine, itemSeconds } from './learn/mastery.js';
import { safeGenerate, SKILLS, FORMS_BY_SKILL } from './learn/generators.js';
import { analogueFor } from './learn/scaffold.js';
import { diagnose } from './learn/diagnose.js';
import { initI18n, t, applyStatic, onLocaleChange, getLocale, setLocale } from './i18n/index.js';
import { createStory } from './meta/index.js';
import { createReport } from './report/index.js';
import { createSession } from './session/index.js';
import { createAudio } from './audio/index.js';
import { createDrift } from './world/drift.js';
import { createCaches } from './world/caches.js';
import { createBeckon } from './world/beckon.js';
import { createVerge, VERGE_R } from './world/verge.js';
import { createKit } from './kit/kit.js';
import graph from '../content/graph/algebra1-l1.json';

initI18n();
applyStatic();

const canvas = document.getElementById('stage');
const uiRoot = document.getElementById('ui');
const boot = document.getElementById('boot');
const bootBar = boot.querySelector('.boot-bar i');

const engine = new Engine(canvas);
const input = new Input(canvas);
const hud = new HUD(uiRoot);
const panel = new RiftPanel(uiRoot);

const saved = JSON.parse(localStorage.getItem('ascent.save') || 'null');
const mastery = new MasteryEngine(graph, saved?.mastery);
let shards = saved?.shards || 0;
let streak = 0;

bootBar.style.width = '35%';

const quality = pickQuality();
const world = createWorld(engine.scene, quality, engine.camera);
bootBar.style.width = '70%';

// Post-processing: HDR bloom, sun scattering, colour grade. Installing it on
// the engine hands it the frame's final draw.
const fx = createFX(engine, world, { quality });
engine.postFX = fx;
// the world tells the post stack what its air is actually made of
world.tuneAtmosphere?.(fx);

const player = new Player(engine.scene, engine.camera, input, engine.renderer);
// player: the meadow has to notice him (src/player/grasspush.js)
player.attachGrass(world.grass);
// world: the sun's shadow volume is built around the cadet's feet, not around
// the camera six metres behind them (src/world/world.js)
world.focusOn?.(() => player.pos);
const rifts = new Rifts(engine.scene, graph);
// Build. The lattice registers itself with the player's terrain probe, which is
// what makes a piece you set something you can stand on rather than a decal.
const builder = new Builder(engine.scene, player, {
  input, hud, uiRoot, groundAt: groundHeight,
});
setSolids(builder.solids);
builder.man.setRifts(rifts.list);
rifts.sync(mastery);

// audio (src/audio). Silent until the first real gesture — autoplay policy is
// obeyed by not building an AudioContext at all before then. It reads the game
// rather than being driven by it: region, altitude, airspeed, surface, rift
// proximity and lattice integrity are all observed, and the only things main.js
// hands it are the four learning events that leave no trace in the world.
const audio = createAudio(uiRoot);
audio.attach({
  player, camera: engine.camera, rifts, mastery, panel, builder, hud, uiRoot,
});

hud.onSlot = (i) => { builder.setSlot(i); input.slot = i; hud.setSlot(i); };
// perf/hud: the HUD follows the live input source (kbm / pad / touch) so it can
// print the binding the player is actually holding, keep the thumb zone clear,
// and give a controller a way through a panel. And on a touch device the hotbar
// carries the build verb itself, because there is no mouse button to be it.
hud.bindInput(input, engine);
hud.onPlace = () => input._press('fire');
player.onFall = () => hud.flash(t('build.denied'), 'bad');
builder.onAnchor = (n, total) => {
  // Three of these exist and each is secured once. It is the second-largest
  // single payment in the game, behind a hanging cache, and it is meant to be:
  // reaching one is a construction problem, not a walk. (reward economy)
  shards += 60;
  hud.flash(t('build.anchorGot', { n, total }), 'good');
  if (n >= total) hud.say(t('build.anchorAll'));
  hud.render(hudState());
  save();
};

// ---------------------------------------------------------------------------
// The world between rifts, and what mastery buys (src/world/drift.js,
// src/world/caches.js, src/kit).
//
// One shared ledger. Shards used to be a number that only ever went up; they
// are now earned in three places — a correct answer, a drift mote, a cracked
// cache — and spent in two: the vault plate you set, and the flare you light.
// Everything downstream reads the ledger through this object rather than
// touching `shards`, so there is exactly one place where the number moves.
// ---------------------------------------------------------------------------
const wallet = {
  count: () => shards,
  earn(n) { shards += n; hud.render(hudState()); save(); },
  spend(n) {
    if (shards < n) return false;
    shards -= n;
    hud.render(hudState());
    save();
    return true;
  },
  /** A surge knocks shards loose. Returns what it actually cost. */
  take(n) {
    const got = Math.min(shards, n);
    if (!got) return 0;
    shards -= got;
    hud.render(hudState());
    save();
    return got;
  },
};
builder.wallet = wallet;

const drift = createDrift({
  scene: engine.scene, player, rifts, hud, wallet, fx, isBusy: () => panel.open,
  // world: the first crystal a cadet runs through is the only moment the game
  // gets to say what the currency is for.
  onFirstTake: () => beckon.firstShards(),
});
// Five standing updrafts are simply in the world; the rest are earned. The
// first is deliberately within sight of the landing, because a mechanic nobody
// stumbles into is a mechanic nobody has.
drift.addColumn(-40, -14, 58, 8);
drift.addColumn(58, -92, 74, 8);
drift.addColumn(-88, -62, 66, 7.5);
drift.addColumn(30, 100, 58, 7);
drift.addColumn(-104, -6, 62, 7.5);

const caches = createCaches({
  scene: engine.scene, uiRoot, player, builder, hud, wallet, drift, audio, fx,
  isBusy: () => panel.open,
});

const kit = createKit({
  root: uiRoot, mastery, builder, player, input, hud, audio, drift, caches, fx,
  wallet, isBusy: () => panel.open,
  // reward economy: the kit owns a place in the world now — the foundry, where
  // shards are quoted, explained and spent before one is spent (src/kit/foundry.js).
  // The only thing it needs from here is the scene it stands in.
  scene: engine.scene,
});

// ---------------------------------------------------------------------------
// world: nothing you can walk up to is allowed to say nothing.
//
// The verge makes the leash in src/player/locomotion.js a place you can see
// instead of an invisible wall in the middle of a flight; beckon labels every
// interactable in the world, opens a tear when you stand on its plate, and
// makes a shut one visibly and audibly refuse. (src/world/verge.js,
// src/world/beckon.js)
// ---------------------------------------------------------------------------
const verge = createVerge(engine.scene);
const beckon = createBeckon({
  uiRoot, player, rifts, drift, builder, hud, verge,
  isBusy: () => panel.open || session.blocking?.() || false,
  onOpenRift: (r) => openRift(r),
});

bootBar.style.width = '100%';

// ---------------------------------------------------------------------------
// Learning loop
// ---------------------------------------------------------------------------
let activeRift = null;
let chainNext = false;
// The one thing this file has in flight after a seal. It is held rather than
// fired-and-forgotten so that a session beat can cancel it: the close card
// opens on the frame after the panel shuts, and an uncancelled chain painted a
// live keypad underneath it 460 ms later. (src/session)
let chainTimer = 0;

/**
 * One turn of the learning loop.
 *
 * The rift the player walked into names a skill, but the scheduler decides what
 * actually appears: new practice, an interleaved retrieval item from the
 * lattice beneath, a spaced re-probe, or a step of the proving run that seals
 * the line. It also decides how much worked example to show, which is why the
 * teaching never has to be announced.
 */
function openRift(rift) {
  if (panel.open) return;
  const locale = getLocale();
  const task = mastery.taskFor(rift.id)
    || { skill: rift.id, kind: 'learn', difficulty: 1, scaffold: 'none', formCandidates: [], reps: null, check: null };
  const seed = (Math.random() * 1e9) | 0;
  const pool = task.formCandidates || [];
  const form = pool.length ? pool[Math.floor(Math.random() * pool.length)] : undefined;

  let item;
  try {
    item = safeGenerate(task.skill, task.difficulty, seed, {
      locale, form, reps: task.reps || undefined,
      // pedagogy: situations this learner has already worked inside — refused
      // outright by the proving run, and not repeated back to back in practice.
      avoidScenes: task.avoidScenes || undefined,
    });
  } catch (err) {
    hud.flash(t('build.denied'), 'bad');
    return;
  }

  // A faded worked example is a *different* item of the same form: the learner
  // studies a solved analogue, then does the live one. `analogueFor` redraws
  // until the analogue cannot be used as an answer key for the live item.
  let example = null;
  if (task.scaffold === 'full' || task.scaffold === 'partial') {
    // pedagogy: the analogue is a second situation on the same card, so it is
    // held to the same refusals as the live item.
    try { example = analogueFor(item, { locale, difficulty: task.difficulty, seed, avoidScenes: task.avoidScenes }); }
    catch { example = null; }
  }

  // Hand the build system the mathematics this rift is actually holding, so a
  // beam set beside it becomes *this* balance and not a generic one.
  builder.man.setContext(rift.id, item);

  activeRift = rift;
  audio.riftOpened(rift);
  input.uiOpen = true;
  document.exitPointerLock?.();
  // rack focus onto the rift and cool the world down while it is talking
  fx.setDialogue(true, rift.pos);

  panel.show(item, {
    title: t('learn.riftTitle', { n: rift.tier + 1, skill: t('skills.' + task.skill) }),
    skillId: task.skill,
    tier: rift.tier,
    kind: task.kind,
    check: task.check,
    // endgame (src/kit, src/learn): how deep the sounding in progress is, so
    // the surface can say "sounding · 4 down" instead of naming no kind at all.
    sounding: task.sounding || null,
    scaffold: task.scaffold,
    example,
    streak,
    onAnswer(correct, meta) {
      // A worked example on the card is support, whether or not the learner
      // asked for it — so a scaffolded win is assisted evidence by construction
      // and can never satisfy the mastery gate on its own.
      const before = mastery.state.get(task.skill)?.pL ?? 0;
      const res = mastery.observe(task.skill, correct, {
        ...meta,
        assisted: meta.assisted || task.scaffold !== 'none',
        form: item.form,
        rep: item.rep,
        scene: item.scene,
        kind: task.kind,
      });
      fx.impact(correct ? 'good' : 'bad');
      audio.answered(correct, res);
      let gained = 0;
      if (correct) {
        streak++;
        chainNext = true;
        // The rift pays, but it is not where the money is: an answer is 2, a
        // proving-run item 4, an assisted one 1. A full session of answering
        // buys about one beacon. Everything else has to be gone and got.
        // (reward economy — see src/kit/kit.js for the sinks)
        gained = meta.assisted ? 1 : (task.kind === 'check' ? 4 : 2);
        shards += gained;
        hud.flash(t('learn.correct'), 'good');
        if (res.justMastered) {
          hud.say(t('learn.mastered', { skill: t('skills.' + task.skill) }));
          for (const u of res.newlyUnlocked) {
            setTimeout(() => { audio.unlocked(); hud.say(t('learn.unlocked', { skill: t('skills.' + u) })); }, 2600);
          }
        } else if (res.checkEvent === 'opened') {
          hud.say(t('marlow.nearMastery'));
        } else if (res.pL > 0.8) {
          hud.say(t('marlow.nearMastery'));
        }
      } else {
        streak = 0;
        chainNext = false;
        hud.flash(t('learn.incorrect'), 'bad');
        hud.say(t('marlow.encourage'));
      }
      rifts.sync(mastery);
      hud.render(hudState());
      save();
      // What the rig learned from that answer, handed back so the seal beat can
      // show the ground actually gained rather than a decorative bar.
      return { pL: res.pL, prev: before, justMastered: res.justMastered, gained };
    },
    // The tear shuts in the world, not on a card, so the world sharpens back
    // up the moment the seam lights rather than when the panel is torn down.
    onSeal() { fx.setDialogue(false); },
    onClose() {
      activeRift = null;
      audio.riftClosed();
      input.uiOpen = false;
      fx.setDialogue(false);
      const again = chainNext;
      chainNext = false;
      // A solved rift hands you the next thing straight away: the session keeps
      // its rhythm, and the scheduler gets to interleave.
      if (again) {
        clearTimeout(chainTimer);
        chainTimer = setTimeout(() => {
          chainTimer = 0;
          // …unless the run has ended in the meantime and the session owns
          // the frame. A chained rift behind a resolution card is the reason
          // this timer is a variable.
          if (session.blocking()) return;
          if (!panel.open && nearRift && nearRift.id === rift.id) openRift(rift);
        }, 460);
      }
    },
  });

}

function hudState() {
  return { shards, integrity: mastery.integrity(), soft: mastery.softIntegrity() };
}

function save() {
  localStorage.setItem('ascent.save', JSON.stringify({ mastery: mastery.save(), shards }));
}

// ---------------------------------------------------------------------------
// Frame
// ---------------------------------------------------------------------------
let nearRift = null;
engine.add((dt, t2) => {
  input.sample(dt);
  if (!panel.open) {
    player.update(dt, t2);
    if (input.slot !== builder.slot) { builder.setSlot(input.slot); hud.setSlot(builder.slot); }
  }
  // The builder owns the whole verb — aim, preview, commit, edit, charge — so
  // that a click and a held button behave the same way in one place.
  builder.setActive(!panel.open);
  builder.update(dt, t2, engine.camera);
  world.update(dt, t2);
  rifts.update(dt, t2);

  nearRift = rifts.nearest(player.pos);
  if (nearRift && input.interact && !panel.open) openRift(nearRift);

  input.endFrame();
});

// After the player has moved, because the drift's updrafts and the vault plate
// both work on where he *is* — a thermal that pushed before locomotion ran
// would be overwritten by the wing on the same frame.
engine.add((dt, t2) => {
  drift.update(dt, t2);
  caches.update(dt, t2, engine.camera);
  kit.update(dt, t2);
  // …and last, because everything above may have moved the cadet: the world
  // answers whatever he is now standing in. (src/world/beckon.js)
  verge.update(dt, t2, player, hud);
  beckon.update(dt, t2, engine.camera);
});

// ---------------------------------------------------------------------------
// Narrative (src/meta). It reads the game rather than being driven by it: rank
// is earned off standing, which is counted by wrapping `mastery.observe` inside
// createStory, and Marlow's two HUD channels are taken over there too. The only
// thing main.js owes it is a tick.
// ---------------------------------------------------------------------------
const story = createStory({
  root: uiRoot, scene: engine.scene, mastery, hud, input, player, rifts, fx, audio,
  isBusy: () => panel.open,
  // direction/onboarding (src/meta/guide.js): the live objective, the waypoint
  // that turns "there is a rift somewhere" into "it is that way, 140 m", the
  // key prompt, and the one-line definition each noun gets the first time it is
  // looked at. Strictly read-only — labelling and opening belong to src/world.
  camera: engine.camera, drift, caches, builder, kit, vergeR: VERGE_R,
});
engine.add((dt, t2) => story.update(dt, t2));

// ---------------------------------------------------------------------------
// Progress report (src/report). It wraps `mastery.observe` itself to keep its
// own clock and its own ledger of granted-and-later-withdrawn mastery claims,
// so main.js owes it nothing but a root and a "are we busy" predicate. Built
// after createStory so that it wraps the story's wrapper rather than being
// bypassed by it, and every answer is counted exactly once.
// ---------------------------------------------------------------------------
const report = createReport({
  root: uiRoot, mastery, graph,
  isBusy: () => panel.open,
  onToggle: (on) => { input.uiOpen = on || panel.open; },
});

// ---------------------------------------------------------------------------
// The session (src/session). The 15–25 minute Pomodoro shape: a goal set before
// the first item and sized by playing this mastery engine forward at the
// learner's own measured pace, a visible pace that is never a clock, a close
// that names what was won, and a break that actually rests. It reads the game
// the same way src/meta does — by wrapping `mastery.observe` — so nothing in
// src/learn, src/ui or src/meta knows it exists. Wiring cost: create, tick,
// begin, expose.
// ---------------------------------------------------------------------------
const session = createSession({
  root: uiRoot, mastery, story, input, fx, audio, panel, hud,
  // reward economy: the orders card names the capability the next held line
  // buys, instead of printing a rep count at a fourteen-year-old.
  kit,
  isBusy: () => panel.open,
  // A session beat is taking the frame: drop the queued chain rift.
  onFloor: () => { clearTimeout(chainTimer); chainTimer = 0; chainNext = false; },
});
engine.add((dt) => session.update(dt));

// last in the frame, so it hears the state the player just moved into
engine.add((dt) => audio.update(dt));

engine.start();
hud.render(hudState());
rifts.sync(mastery);

// ---------------------------------------------------------------------------
// Boot-out + the cold open
// ---------------------------------------------------------------------------
requestAnimationFrame(() => requestAnimationFrame(() => {
  setTimeout(() => { boot.classList.add('gone'); story.begin(); session.begin(); }, 700);
}));

onLocaleChange(() => {
  applyStatic(); hud.render(hudState()); builder.relocalise(); caches.relocalise();
});

// The anchors are the reason to build; said once, late enough that the opening
// beat has finished and early enough that it is still the first session.
setTimeout(() => { if (!panel.open) hud.say(t('build.anchorCall'), 9000); }, 24000);

function pickQuality() {
  const mem = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 8;
  const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  if (mobile || mem <= 4 || cores <= 4) return 0.5;
  return 1;
}

// Expose a small surface for the automated critics: they drive the real game,
// not a mock, and read the same state the player sees.
/**
 * How far ahead of the real clock the harness has pushed us. Zero in a real
 * session and never touched by anything a player can do; `advanceDays` below is
 * the only writer. The spacing schedule in src/learn/mastery.js runs on real
 * elapsed time, so a critic who cannot move that clock cannot see anything the
 * schedule does after the first ten minutes.
 */
let clockOffset = 0;

window.__ascent = {
  engine, mastery, rifts, player, hud, panel, fx, world, builder, input, story, audio,
  // The reward loop: what the world produces between rifts (drift), what is
  // hung out of reach and locked behind a balance (caches), and what a sealed
  // line buys (kit). Critics read the same objects the game runs on.
  drift, caches, kit,
  // pedagogy/reporting: critics open the real report and read the same numbers
  // a teacher would, rather than a summary written for them.
  report, session,
  // world: critics traverse the real scene graph and project real world points
  THREE, scene: engine.scene, camera: engine.camera,
  // content: every skill and every item form the banks can draw, so a critic can
  // put the *tallest* representation on the learning surface instead of whatever
  // the scheduler happened to pick. (learn-ux wiring; read-only.)
  skillIds: SKILLS, formsBySkill: FORMS_BY_SKILL,
  // i18n: critics drive the real bundles, and switch locale the way the HUD does
  t, locale: () => getLocale(), setLocale,
  // perf: real percentiles off the engine's frame log, not an average
  state: () => ({
    ...hudState(), fps: engine.fps, fxTier: fx.tier, perf: engine.stats(),
    skills: mastery.save().skills,
    // the run in progress: goal, pace, phase (src/session)
    session: session.state(),
    // what the world has produced, and what mastery has bought
    drift: { ...drift.stats }, caches: caches.state(), kit: kit.state(),
  }),
  /**
   * Critic hook: it is tomorrow. Moves the wall clock the retention schedule
   * reads — nothing else in the game has one — so a harness can play a second
   * and third sitting, and check that the lines a player held yesterday come
   * back round and that holding them is what buys the endgame.
   */
  advanceDays(days = 1) {
    clockOffset += Math.round(Number(days) * 86400000);
    mastery.setClock(() => Date.now() + clockOffset);
    save();
    return { offsetDays: clockOffset / 86400000, watch: mastery.watch() };
  },
  /** What is due, when the next thing falls due, and how many nights are held. */
  watch: () => mastery.watch(),
  teleportTo(id) {
    const r = rifts.list.find((x) => x.id === id);
    if (!r) return false;
    player.pos.set(r.pos.x, r.pos.y + 1, r.pos.z + 4);
    player.vel.set(0, 0, 0);
    return true;
  },
  openRiftById(id) {
    const r = rifts.list.find((x) => x.id === id);
    if (r) openRift(r);
    return !!r;
  },
  // --- pedagogy hooks: critics drive the real scheduler and the real bank ---
  nextObjective: () => mastery.next(),
  task: (id) => mastery.taskFor(id),
  /**
   * The real item a task asks for, drawn from the real bank, without opening a
   * panel — so tools/critic/testout.mjs can play a whole session's *scheduling*
   * through the shipping engine at speed and report items and minutes per skill.
   */
  itemFor(task) {
    const pool = task.formCandidates || [];
    const form = pool.length ? pool[Math.floor(Math.random() * pool.length)] : undefined;
    try {
      return safeGenerate(task.skill, task.difficulty, (Math.random() * 1e9) | 0, {
        locale: getLocale(), form, reps: task.reps || undefined,
        avoidScenes: task.avoidScenes || undefined,
      });
    } catch { return null; }
  },
  /** The engine's own cost model, so a critic reports the clock it plans with. */
  itemSeconds,
  /**
   * Type a value into the open rift exactly as a hand would, and report what
   * the rig concluded about the learner from it. `misconception: null` means
   * the rig declined to name one — the honest answer when the entry matches
   * nothing the item can explain.
   */
  enter(value) {
    if (!panel.open) return null;
    const it = panel.item;
    if (panel._modality?.set && panel._modality?.submit) {
      panel._modality.set(String(value));
      panel._modality.submit();
    } else {
      // Only the keypad takes a typed value. On the surfaces that do not have
      // one — choice, balance, sort, area — a harness that keeps typing is
      // silently answering nothing, which reads downstream as a player who
      // sealed ten rifts and earned nothing. Drive those the way demo() does.
      panel.demo(String(value) === String(it.answer) ? 'right' : 'wrong');
    }
    const item = panel.item;
    return {
      entry: String(value),
      answer: item.answer,
      misconception: diagnose(item, value),
      recognisable: (item.diagnostics || []).length,
      form: item.form,
      rep: item.rep,
    };
  },
  /** Put one specific item form on the surface, for inspecting representations. */
  showItem(skill, opts = {}) {
    const item = safeGenerate(skill, opts.difficulty || 3, opts.seed || ((Math.random() * 1e9) | 0), {
      locale: getLocale(), form: opts.form,
    });
    const example = opts.scaffold && opts.scaffold !== 'none'
      ? analogueFor(item, { locale: getLocale(), difficulty: opts.difficulty || 3, seed: opts.seed || 1 })
      : null;
    input.uiOpen = true;
    fx.setDialogue(true);
    panel.show(item, {
      title: t('skills.' + skill), skillId: skill, tier: 0, kind: opts.kind || 'learn',
      scaffold: opts.scaffold || 'none', example, streak: 0,
      onAnswer() {}, onClose() { input.uiOpen = false; fx.setDialogue(false); },
    });
    return { form: item.form, rep: item.rep, answer: item.answer };
  },
  /** Where the next piece would land, and whether the ghost is on screen. */
  buildTarget() {
    const tg = builder.target();
    return {
      ...tg,
      ghostVisible: builder.ghostView.visible,
      ghostPos: [tg.x, tg.y, tg.z],
      placed: builder.solids.owned,
      charge: Math.round(builder.charge),
    };
  },
  /** Place one piece exactly as a click would, and say what happened. */
  build() { return builder.place(); },
  /** Remove the piece under the crosshair, exactly as pressing Q would. */
  unbuild() { return builder.remove(builder._aimed); },
  /** Ground truth for the collider: what the boots find at a column, right now. */
  surfaceAt: (x, z) => builder.solids.top(x, z),
  /** The island alone, with nothing built on it — for measuring height gained. */
  islandAt: (x, z) => groundHeight(x, z),
  anchors: () => ({
    secured: builder.anchors?.secured ?? 0,
    total: builder.anchors?.total ?? 0,
    at: (builder.anchors?.list || []).map((a) => a.pos.toArray()),
  }),

  reset() {
    localStorage.removeItem('ascent.save');
    report.tracker.reset(); story.reset(); session.reset();
    caches.reset(); kit.reset();
    location.reload();
  },
};
