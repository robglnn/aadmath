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
import { MasteryEngine } from './learn/mastery.js';
import { safeGenerate, SKILLS, FORMS_BY_SKILL } from './learn/generators.js';
import { analogueFor } from './learn/scaffold.js';
import { diagnose } from './learn/diagnose.js';
import { initI18n, t, applyStatic, onLocaleChange, getLocale, setLocale } from './i18n/index.js';
import { createStory } from './meta/index.js';
import { createAudio } from './audio/index.js';
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
  shards += 20;
  hud.flash(t('build.anchorGot', { n, total }), 'good');
  if (n >= total) hud.say(t('build.anchorAll'));
  hud.render(hudState());
  save();
};

bootBar.style.width = '100%';

// ---------------------------------------------------------------------------
// Learning loop
// ---------------------------------------------------------------------------
let activeRift = null;
let chainNext = false;

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
        gained = meta.assisted ? 1 : (task.kind === 'check' ? 5 : 3);
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
        setTimeout(() => {
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

// ---------------------------------------------------------------------------
// Narrative (src/meta). It reads the game rather than being driven by it: rank
// is earned off standing, which is counted by wrapping `mastery.observe` inside
// createStory, and Marlow's two HUD channels are taken over there too. The only
// thing main.js owes it is a tick.
// ---------------------------------------------------------------------------
const story = createStory({
  root: uiRoot, scene: engine.scene, mastery, hud, input, player, rifts, fx, audio,
  isBusy: () => panel.open,
});
engine.add((dt, t2) => story.update(dt, t2));
// last in the frame, so it hears the state the player just moved into
engine.add((dt) => audio.update(dt));

engine.start();
hud.render(hudState());
rifts.sync(mastery);

// ---------------------------------------------------------------------------
// Boot-out + the cold open
// ---------------------------------------------------------------------------
requestAnimationFrame(() => requestAnimationFrame(() => {
  setTimeout(() => { boot.classList.add('gone'); story.begin(); }, 700);
}));

onLocaleChange(() => { applyStatic(); hud.render(hudState()); builder.relocalise(); });

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
window.__ascent = {
  engine, mastery, rifts, player, hud, panel, fx, world, builder, input, story, audio,
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
  }),
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
      placed: builder.solids.count,
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

  reset() { localStorage.removeItem('ascent.save'); story.reset(); location.reload(); },
};
