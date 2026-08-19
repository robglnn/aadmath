import 'katex/dist/katex.min.css';
/* The stacking order, before any surface that uses it. src/ui/layers.css is the
   only place a level is chosen; every module reads its own from a token there. */
import './ui/layers.css';
/* …and the slotting order, which is the same discipline for the other axis:
   layers.css says who is in front, src/ui/slots.css says who is allowed to be
   there at all. Loaded here so every module can read its own slot from a token
   there, and so the phone compositions at the foot of this list still get the
   last word about a frame they compose themselves. */
import './ui/slots.css';
import './ui/style.css';
import * as THREE from 'three';
import { Engine } from './core/engine.js';
import { Input } from './core/input.js';
import { createWorld, heightAt as groundHeight } from './world/world.js';
import { Rifts } from './world/rifts.js';
import { Player } from './player/controller.js';
import { setSolids, lowestGround, deck as playerDeck, outsideWorld } from './player/terrain.js';
// Read-only, for critics: the player's OWN answer to "is this a place a cadet
// may be put down", so an instrument can be compared against the one the verb
// actually used instead of guessing which of the two is wrong. See `site`.
import { siteVerdict as playerSiteVerdict, openness as playerOpenness, EYE as PLAYER_EYE, setLifts } from './player/escape.js';
import { setCamSolids } from './build/camclip.js';
import { ControlsCard } from './player/controls.js';
import { Builder } from './build/builder.js';
import { createFX } from './fx/index.js';
import { HUD } from './ui/hud.js';
import { RiftPanel } from './ui/rift.js';
import { Menu } from './ui/menu.js';
import { MasteryEngine, itemSeconds } from './learn/mastery.js';
import { safeGenerate, SKILLS, FORMS_BY_SKILL } from './learn/generators.js';
import { analogueFor } from './learn/scaffold.js';
import { diagnose } from './learn/diagnose.js';
import { initI18n, t, applyStatic, onLocaleChange, getLocale, setLocale } from './i18n/index.js';
import { createStory } from './meta/index.js';
import { repaired } from './meta/progress.js';
import { createReport } from './report/index.js';
import { createSession } from './session/index.js';
// session chaining (src/session/stint.js): how many items ONE arrival at a tear
// is worth, and therefore where the beat is in which the player decides what to
// do next. See that file's header for what it replaced.
import { createStint } from './session/stint.js';
// world (src/world/errand.js) + narrative (src/meta/relay.js): the place worth
// walking to between two stints, and the one line that names it.
import { createErrand } from './world/errand.js';
import { createRelay } from './meta/relay.js';
import { createAudio } from './audio/index.js';
import { createDrift } from './world/drift.js';
import { createCaches } from './world/caches.js';
import { createSpans } from './world/span.js';
import { createWardens } from './world/warden.js';
import { createBeckon } from './world/beckon.js';
import { createAfford } from './world/afford.js';
import { createVerge, VERGE_R } from './world/verge.js';
import { createKit } from './kit/kit.js';
import { createLedger } from './kit/ledger.js';
// Content is data, not code. The unit that boots is named in
// content/courses.json, resolved by src/content, and defaults to Algebra I
// Level 1 — the same ten-node graph this line used to import directly.
// `?unit=<id>` runs one unit, `?course=<id>` composes every unit in a course.
import { loadContent } from './content/index.js';
// LAST, on purpose. src/ui/landscape.css composes the whole frame for a phone
// held sideways, and it does that by placing furniture that six other modules
// own. Loading it after every one of them is what lets it do so without
// editing anybody else's stylesheet — see the header of that file.
import './ui/landscape.css';
// …and the same for a phone held up. src/ui/portrait.css composes the tall
// narrow frame the same way and for the same reason — one place, loaded last,
// positions and sizes only. The two share no viewport: one is
// `orientation: landscape`, the other `orientation: portrait`.
import './ui/portrait.css';
// Screen quiet (src/ui/quiet.js): how many text panels may stand at once.
// Owns none of them; it only decides who yields. Wiring only.
import { startQuiet } from './ui/quiet.js';
// The slotting arbiter (src/ui/slots.js): publishes the two heights CSS cannot
// know — the run band's and the kit strip's — and hushes the one transient
// surface that is standing on another. Wiring only; owns none of them.
import { startSlots } from './ui/slots.js';

const content = loadContent();
const graph = content.graph;

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

/**
 * THE HARNESS CLOCK — how far ahead of the real one a critic has pushed us.
 *
 * Zero in a real session, and never touched by anything a player can do:
 * `__ascent.advanceDays` below is the only writer, and a real save never has
 * this key in it. The spacing schedule in src/learn/mastery.js runs on real
 * elapsed time, so a critic who cannot move that clock cannot see anything the
 * schedule does after the first ten minutes.
 *
 * It is restored HERE, before anything reads `mastery.now()`, and it survives a
 * reload — because a returning day does. A session is a Pomodoro with an ending
 * (src/session), so the honest way for a harness to open tomorrow's run is to
 * open the page again, exactly as a learner does. While the offset lived only
 * in module scope that reload put the clock back to today, and the fifth day
 * could not be reached at all.
 */
const CLOCK_KEY = 'ascent.clockoffset';
let clockOffset = 0;
try { clockOffset = Number(localStorage.getItem(CLOCK_KEY)) || 0; } catch { clockOffset = 0; }
if (clockOffset) mastery.setClock(() => Date.now() + clockOffset);
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
// The same registry, for the lens. (src/build/camclip.js — the camera must not
// be able to sit inside a wall the player just raised.)
setCamSolids(builder.solids);
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

// ---------------------------------------------------------------------------
// First contact (src/player/controls.js). The verbs on screen from the fourth
// second, each row retiring as the cadet performs it; and the one affordance
// that guarantees nothing in this game can ever need a page reload.
// ---------------------------------------------------------------------------
const controls = new ControlsCard(uiRoot, {
  input, player, builder,
  onRecover: () => player.recover('asked'),
});
player.onStuck = (on) => controls.setStuck(on);
// The browser will not let the game hold the mouse (an LMS iframe, a managed
// Chromebook). The arrow keys and a click-drag already work; the card says so.
// (src/core/input.js -> src/player/controls.js)
input.onLookFallback = () => controls.lookBlocked();
// The recovery says which recovery it was. "Back on open ground" is right for
// a player who asked; it is not what the game should say when it has just
// picked somebody up off its own edge without being asked. (src/player)
player.onRecover = (why) => hud.flash(
  t(why === 'fell' ? 'firstrun.caught' : why === 'buried' ? 'firstrun.dug' : 'firstrun.recovered'),
  why === 'asked' || why === 'menu' ? 'good' : 'bad',
);

hud.onSlot = (i) => { builder.setSlot(i); };
// THE HOTBAR FOLLOWS THE HAND, ALWAYS. (build)
// It used to be repainted only on the frames where `input.slot` and
// `builder.slot` disagreed — which on the keyboard path they never did, because
// both listeners had already moved by then. So a digit key changed the ghost
// and left the highlight on the previous piece: the hotbar advertised one piece
// while the world built another. The builder is the source of truth now and it
// announces every landing, refusals included.
builder.onSlot = (i) => { input.slot = i; hud.setSlot(i); };
// The rotate, for a device with no keyboard.
hud.onTurn = () => builder.rotate(1);
// perf/hud: the HUD follows the live input source (kbm / pad / touch) so it can
// print the binding the player is actually holding, keep the thumb zone clear,
// and give a controller a way through a panel. And on a touch device the hotbar
// carries the build verb itself, because there is no mouse button to be it.
hud.bindInput(input, engine);
// On a phone this button *is* the build verb, and pressing a button labelled
// BUILD is as deliberate an act as picking a piece off the rack — so it draws
// the lattice hand too. (src/build gating)
hud.onPlace = () => { builder.drawHand(); input._press('fire'); };
// The fall itself is announced by onRecover above, which knows why it fired.
// This hook stays for src/meta, which counts falls into the arc.
player.onFall = () => {};
builder.onAnchor = (n, total) => {
  // Three of these exist and each is secured once. It is the second-largest
  // single payment in the game, behind a hanging cache, and it is meant to be:
  // reaching one is a construction problem, not a walk. (reward economy)
  wallet.earn(60, 'anchor');
  hud.flash(t('build.anchorGot', { n, total }), 'good');
  if (n >= total) hud.say(t('build.anchorAll'));
};

// ---------------------------------------------------------------------------
// The world between rifts, and what mastery buys (src/world/drift.js,
// src/world/caches.js, src/kit).
//
// One shared ledger. Motes are earned in three places — a correct answer, a
// drift vein, a cracked cache — and spent on everything the kit sells. There is
// exactly one place where the number moves, and that place is now a real module
// rather than an object literal: src/kit/ledger.js. It keeps the same four
// methods this object always had, and adds the two rules a cold player's
// "shards silently reset to zero three separate times" demanded: a levy takes
// at most a quarter of the balance so nothing but a purchase can empty the
// wallet, and every movement is printed in the ledger's own strip — which no
// toast can overwrite, because the surge's own knockback toast was deleting
// the line that explained the surge.
const wallet = createLedger({
  root: uiRoot,
  initial: saved?.shards,
  onChange: () => { hud.render(hudState()); save(); },
  // The day's yield turns over on the clock the spacing schedule reads, so a
  // harness that moves the clock moves the seam with it (src/kit/ledger.js).
  clock: () => mastery.now(),
});
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

// player: …AND RECOVER DOES NOT PUT ANYBODY DOWN INSIDE ONE.
//
// The survey plants a permanent updraft at every landmark it claims
// (src/world/errand.js), and a landmark is exactly where a cadet wedges himself
// and presses R. The cold-play gate caught the result at the mark on the west
// bank: Recover chose a site that passed every clause of escape, and four
// tenths of a second later the world had carried him from 39.6 m to 46.7 m with
// his own velocity still negative — because a column writes `pos.y` directly.
// The verdict blamed the recovery for a frame taken thirty feet in the air.
//
// A thermal is not a defect and being launched by one is not a recovery. The
// search steps around a rising column the way it steps around a boulder; the
// margin is the column's own catch radius plus a metre, so the cadet lands
// beside the lift rather than on the lip of it. (src/player/escape.js)
setLifts((x, y, z) => {
  for (const c of drift.columns) {
    if (y <= c.y0 - 3 || y >= c.top) continue;
    if (Math.hypot(x - c.x, z - c.z) < c.r + 2.6) return true;
  }
  return false;
});

// world: THE SURVEY (src/world/errand.js) — a reason to walk to the landmarks
// that were already standing there. Every hero silhouette on this island now
// carries a mark that pays, plants a permanent updraft, and turns green when it
// is yours, so the space between two tears has finds in it instead of hillside.
// Built after the standing columns so the ones a claim plants land on top of a
// world that already has air in it.
const errand = createErrand({
  scene: engine.scene, player, drift, hud, wallet, audio, fx,
  // Lazily: `story` is built at the bottom of this file and this only ever runs
  // long after boot. A find speaks through the companion's queue so that it can
  // never talk over a learning surface.
  comms: { sayKey: (k, o) => story?.comms?.sayKey?.(k, o) },
  isBusy: () => panel.open || session?.blocking?.() || false,
});

const caches = createCaches({
  scene: engine.scene, uiRoot, player, builder, hud, wallet, drift, audio, fx,
  isBusy: () => panel.open,
});

// world: THE SPANS (src/world/span.js) — the second kind of place in the
// archipelago. A cache is a balance and pays a standing updraft. A span is a
// rectangle of ground hung in the sky that you have to cover exactly, and it
// pays a ROAD: real floor, laid one link at a time from the island outwards, so
// the first one has to be flown to and every one after it can be walked to.
// Built after the caches because a road is laid into the same solid registry
// the perches are, and the perches have to be standing first.
const spans = createSpans({
  scene: engine.scene, uiRoot, player, builder, hud, wallet, audio, fx,
  isBusy: () => panel.open,
});

const kit = createKit({
  root: uiRoot, mastery, builder, player, input, hud, audio, drift, caches, spans, fx,
  // src/ui P1 — the grant card's own header has always said it queues behind
  // the rank rite and the session's close card, but `isBusy` only ever asked
  // about the tear, so neither of those two actually held it back. It now asks
  // every surface that can take the middle of the frame. Evaluated lazily:
  // `story` and `session` are built further down this file.
  wallet,
  isBusy: () => panel.open || session?.blocking?.() || story?.rite?.playing
    || story?.turn?.playing || false,
  // reward economy: the kit owns a place in the world now — the foundry, where
  // shards are quoted, explained and spent before one is spent (src/kit/foundry.js).
  // The only thing it needs from here is the scene it stands in.
  scene: engine.scene,
  // …and the standing order, so the kit can raise the mark over it. Lazily,
  // because `story` is built further down this file. (src/meta/night.js)
  night: () => story?.night || null,
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
  // …and the survey marks, so an instrument standing on a landmark names itself
  // from a hundred and fifty metres. (src/world/errand.js)
  errand: () => errand,
  // A tear that has just given its three items back does not pull you in again
  // when you cross your own dais on the way out. The key still works: leaving is
  // a decision and so is staying. (src/session/stint.js)
  canWalkIn: (id) => !stint.settling(id),
  isBusy: () => panel.open || session.blocking?.() || false,
  onOpenRift: (r) => openRift(r),
  // src/world/afford.js says everything there is to say about a tear, and says
  // it with the key printed on it. One caption per object.
  riftTags: false,
});

// world: the interact affordance and the next-objective marker. A live tear
// carries its own verb and its own key, continuously, from seventy metres —
// and the line the scheduler actually wants next stands under a gold column
// with a bearing and a distance on the compass. (src/world/afford.js)
const afford = createAfford({
  uiRoot, scene: engine.scene, camera: engine.camera, player, rifts, mastery, kit,
  isBusy: () => panel.open || session.blocking?.() || false,
  onOpenRift: (r) => openRift(r),
  // …and when an arrival still has items in it, the plate says CONTINUE rather
  // than OPEN. The tear stopped re-opening itself between them; this is where
  // the offer is advertised instead. (src/session/stint.js)
  heldStint: (id) => stint.holdingAt(id),
});

bootBar.style.width = '100%';

// ---------------------------------------------------------------------------
// Learning loop
// ---------------------------------------------------------------------------
let activeRift = null;
let chainNext = false;
// This file no longer has anything in flight after a seal. There was a 460 ms
// timer here that re-opened the tear, and it is gone: the next item is offered
// and waits to be asked for, so there is nothing left for a session beat to
// race against or cancel. (src/session/stint.js explains the whole argument.)
//
// THREE items per arrival, then the world comes back with somewhere to go. A
// cold critic answered twelve in a row without once choosing to; this is the
// object that says no — and now says it without ever pressing the key itself.
const stint = createStint({
  onEnd: (id) => relay.returned(id),
});

/**
 * One turn of the learning loop.
 *
 * The rift the player walked into names a skill, but the scheduler decides what
 * actually appears: new practice, an interleaved retrieval item from the
 * lattice beneath, a spaced re-probe, or a step of the proving run that seals
 * the line. It also decides how much worked example to show, which is why the
 * teaching never has to be announced.
 */
function openRift(rift, override) {
  if (panel.open) return;
  const locale = getLocale();
  // `override` is the critic hook only: a harness that has to photograph a
  // named form at a named band drives the SAME path a player does, rather than
  // building an item of its own beside it. Nothing in the game passes it.
  const task = {
    ...(mastery.taskFor(rift.id)
      || { skill: rift.id, kind: 'learn', difficulty: 1, scaffold: 'none', formCandidates: [], reps: null, check: null }),
    ...(override || {}),
  };
  const seed = (Math.random() * 1e9) | 0;
  const pool = override && override.form ? [override.form] : (task.formCandidates || []);
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
  // Every path that opens a tear — the plate, the key, the touch tag, the chain
  // — comes through here, so this is the one place a stint can be started and
  // nothing can start one behind that module's back. (src/session/stint.js)
  stint.arrive(rift.id);
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
    // pedagogy (src/learn): set when this item is on a line the learner has
    // already proved — how many of this sitting's allowance for a held line it
    // has now taken. The surface is entitled to say so; nothing may serve one
    // of these silently.
    reprobe: task.reprobe || null,
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
      // fx/audio: the seal beat is two events, not one — the lens kick above,
      // and the slow light underneath it that the score lands on. (src/fx)
      if (correct) fx.seal({ mastery: res.pL, big: !!res.justMastered });
      audio.answered(correct, res);
      let gained = 0;
      if (correct) {
        streak++;
        // A piece of work finished at this tear. The stint counts these, never
        // attempts — a card stays up until it comes out right, and a learner who
        // needed four tries has not used up three of anything. (src/session/stint.js)
        stint.sealed();
        chainNext = true;
        // The rift pays, but it is not where the money is: an answer is 2, a
        // proving-run item 4, an assisted one 1. A full session of answering
        // buys about one beacon. Everything else has to be gone and got.
        // (reward economy — see src/kit/kit.js for the sinks)
        gained = meta.assisted ? 1 : (task.kind === 'check' ? 4 : 2);
        wallet.earn(gained, meta.assisted ? 'assist' : 'seal');
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
      // A solved rift OFFERS the next card. It does not serve it.
      //
      // This used to arm a 460 ms timer that re-opened the same tear, up to
      // three items per arrival, and a cold critic counted the result: "six
      // items that opened with no travel at all". Two of every three learning
      // cards in the game were the game's decision.
      //
      // The stint is unchanged — same three items, same line, same scheduler
      // interleaving them. What is gone is the timer. The tear stays live and
      // goes on carrying its plate and its key (src/world/afford.js, which now
      // says CONTINUE while a stint is held), and the ordinary interact path
      // twenty lines below opens the next item the moment the cadet asks for
      // it. Walk off instead and `stint.watch()` closes the stint out for
      // real, relay line and all. (src/session/stint.js, src/meta/relay.js)
      const again = chainNext && stint.more();
      chainNext = false;
      if (again) stint.hold(); else stint.end();
    },
  });

}

function hudState() {
  /* hud: THE ONE PROGRESS NUMBER, from the one function that defines it.
     This used to hand the rig two figures — `integrity()` and
     `softIntegrity()` — and the panel drew them as two bars. Two answers to one
     question, zero pixels apart. See src/meta/progress.js. */
  return { shards: wallet.count(), repaired: repaired(mastery).frac };
}

function save() {
  // Never write a balance the ledger does not actually hold: a save that
  // records something other than what is on screen is the one way a currency
  // really can reset itself between sessions.
  localStorage.setItem('ascent.save', JSON.stringify({
    mastery: mastery.save(), shards: wallet.count(),
  }));
}

// ---------------------------------------------------------------------------
// Frame
// ---------------------------------------------------------------------------
let nearRift = null;
engine.add((dt, t2) => {
  input.sample(dt);
  if (!panel.open) {
    player.update(dt, t2);
    // the wheel moves `input.slot`; the builder answers and repaints the bar
    if (input.slot !== builder.slot) builder.setSlot(input.slot);
  } else {
    // player: the way out is the one verb that is never not listening. Every
    // other frame in this game is allowed to belong to a panel; this key is
    // not, because a documented key that does nothing is how a session ends.
    player.pumpRecover();
    // …and neither is the fall-catch. A ring opens on contact, the panel takes
    // the frame, and the movement key is still held: the cadet walks off the
    // shard with a question on screen and `update()` — which is where the catch
    // lived — never runs again. Measured at 22 s past the point of no return,
    // 180 m out, `caught` still zero. (player — see `pumpCatch`.)
    player.pumpCatch(dt);
  }
  // The builder owns the whole verb — aim, preview, commit, edit, charge — so
  // that a click and a held button behave the same way in one place.
  builder.setActive(!panel.open);
  builder.update(dt, t2, engine.camera);
  world.update(dt, t2);
  rifts.update(dt, t2);

  nearRift = rifts.nearest(player.pos);
  if (nearRift && input.interact && !panel.open) openRift(nearRift);

  // first contact: ticks its rows off what the cadet has actually done
  controls.update(dt);

  input.endFrame();
});

// After the player has moved, because the drift's updrafts and the vault plate
// both work on where he *is* — a thermal that pushed before locomotion ran
// would be overwritten by the wing on the same frame.
engine.add((dt, t2) => {
  drift.update(dt, t2);
  // world: the survey marks turn, breathe, and are claimed by walking into one.
  // Before the caches, because a claim plants an updraft and the lift has to be
  // in the world on the same frame the cadet is standing there. (src/world/errand.js)
  errand.update(dt, t2);
  caches.update(dt, t2, engine.camera);
  spans.update(dt, t2, engine.camera);
  kit.update(dt, t2);
  // …and last, because everything above may have moved the cadet: the world
  // answers whatever he is now standing in. (src/world/beckon.js)
  verge.update(dt, t2, player, hud);
  beckon.update(dt, t2, engine.camera);
  // …and the affordance layer last of all, because it is the only thing that
  // has to agree with where the cadet ended the frame: the key it prints is
  // the key that will work on the very next one. (src/world/afford.js)
  afford.update(dt, t2);
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
// narrative + reward economy: A MARK CLEARED (src/meta/night.js).
//
// A standing order settles the instant the cadet answers its line, unassisted,
// on a later day than the one it was laid on. Three things then happen, and
// they are wired here because this is the only file that can reach all three:
// the wallet pays, the companion says so, and every third one hands over a
// CHARTER — the licence for a waystation, which used to be gated on depth
// alone and therefore arrived roughly once a fortnight while the wallet filled
// up with nothing to spend it on. Measured: 10,109 shards, one charter and no
// waystations at day fifteen. Both scarcities have to bite at once or the
// purchase is a wait rather than a decision.
// ---------------------------------------------------------------------------
story.onOrderKept((info) => {
  wallet.earn(info.pays, 'order');
  story.comms?.sayKey?.(info.charter ? 'story.order.keptCharter' : 'story.order.kept', {
    tag: 'order-kept', force: true, params: { skill: t('skills.' + info.skill), n: info.nights },
  });
  if (info.charter) kit.grantCharter(1);
  fx?.impact?.('good');
  audio?.unlocked?.();
});

// ---------------------------------------------------------------------------
// narrative: THE RELAY (src/meta/relay.js). What the world says the moment a
// stint ends and the card really closes — one destination, named, with a
// bearing and a distance on it, and never the place you are standing. It is the
// other half of src/session/stint.js: three items, then somewhere to go.
// ---------------------------------------------------------------------------
const relay = createRelay({
  mastery, rifts, player, hud, errand,
  comms: story.comms,
  isBusy: () => panel.open || session?.blocking?.() || false,
});
engine.add((dt) => {
  stint.update(dt);
  // Is the cadet still standing at the tear that has an item waiting for them?
  // Walking away is how they decline it, and declining has to be as easy as
  // accepting or the offer is a wall with a key on it. `nearRift` is whatever
  // the frame above resolved, which is the same tear the plate is drawn on.
  stint.watch(!panel.open && nearRift ? nearRift.id : null, dt);
  relay.update(dt);
});

// ---------------------------------------------------------------------------
// world: THE WARDENS (src/world/warden.js) — the fifth day.
//
// Everything else on this island waits to be walked into. A warden runs a
// circuit, notices you, runs from you, sheds the answers behind it in a fan and
// throws a ring of pressure when you take the wrong one. Bind one and it falls
// apart into a new hanging cache, on the spot, for ever — so the best idea in
// the game stops being five opened boxes and starts being a thing the island
// grows one more of every day somebody comes back to it.
//
// Built after createStory because the day ledger it wakes on lives there, and
// because the line that introduces the word is Marlow's to say.
// ---------------------------------------------------------------------------
const wardens = createWardens({
  scene: engine.scene, uiRoot, player, hud, wallet, caches, audio, fx, story, kit,
  isBusy: () => panel.open || session?.blocking?.() || story?.rite?.playing
    || story?.turn?.playing || false,
});
engine.add((dt, t2) => wardens.update(dt, t2, engine.camera));

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
  // report: the session planner's per-line confidence, so the percentage on a
  // row cannot be higher than the engine's own odds of closing that line. A
  // thunk because `session` is built below this and the report only reads it
  // when a learner opens the screen. (src/report/index.js `floorOf`)
  // (guarded: `session` is in its temporal dead zone until the line below runs,
  // and a report opened by a harness before boot finishes must not throw.)
  seams: () => { try { return session?.state?.().run?.seams || null; } catch { return null; } },
  // report: RIFTS SEALED IN ALL, off the one ledger that keeps it. The live HUD
  // used to print those words over a bar that measures something else and no
  // number at all; the words and the figure are together here now.
  sealed: () => { try { return story?.state?.().tears ?? null; } catch { return null; } },
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
  // A session beat is taking the frame. There is no queued rift to drop any
  // more, but a held stint must still be closed out: an offer of "press E for
  // the next item" that survives underneath a résumé is an offer attached to a
  // run that has finished.
  onFloor: () => { chainNext = false; stint.end(); },
});
engine.add((dt) => session.update(dt));

// ---------------------------------------------------------------------------
// The menu (src/ui/menu.js). Pause, help and settings on one plate, on Escape
// and on a button that is on screen from the first frame. Built last of the
// surfaces so that `isBusy` can ask every one of them whether it already owns
// the frame — Escape belongs to whatever is open, and only reaches the menu
// when the frame is the world's.
// ---------------------------------------------------------------------------
const menu = new Menu(uiRoot, {
  input,
  // The controls card is deliberately *not* in here: it is a corner card, not a
  // panel, and a player who presses Escape while it is up wants the menu — not
  // to have thrown the card away for the rest of the run.
  isBusy: () => panel.open || report.open || session.blocking(),
  // player/ui: the card advertised Recover and offered no way to press it, and
  // it offered no way to start over either. Both are buttons now, and both go
  // through the same code a key does — the menu owns no recovery logic of its
  // own, so there is exactly one way back onto solid ground in this game.
  onRecover: () => player.recover('menu'),
  onRestart: () => restartRun(),
});
engine.add(() => menu.update());

// last in the frame, so it hears the state the player just moved into
engine.add((dt) => audio.update(dt));

engine.start();
hud.render(hudState());
/* hud: THE RIG READS THE ONE NUMBER FOR ITSELF, from this exact expression —
   the same one the progress report and the run résumé are drawn from. A cold
   critic caught the report at 22% and the rig at 10% seconds later with nothing
   done in between, because the rig had to be *told* and one path had not told
   it. Handed the question instead of the answer, it cannot go stale. See
   `Hud.watch` in src/ui/hud.js. */
hud.watch(hudState);
rifts.sync(mastery);

// ---------------------------------------------------------------------------
// Boot-out + the cold open
// ---------------------------------------------------------------------------
requestAnimationFrame(() => requestAnimationFrame(() => {
  setTimeout(() => {
    boot.classList.add('gone'); story.begin(); session.begin(); controls.begin();
  }, 700);
}));

onLocaleChange(() => {
  applyStatic(); hud.render(hudState()); builder.relocalise(); caches.relocalise();
  spans.relocalise();
  wardens.relocalise();
  afford.relocalise();
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


window.__ascent = {
  engine, mastery, rifts, player, hud, panel, fx, world, builder, input, story, audio,
  // first contact + getting unstuck (src/player): critics drive the real card
  // and the real recovery, never a mock.
  controls,
  // pause/help/settings (src/ui/menu.js): critics press the real Escape and
  // read the real card, never a mock.
  menu,
  // The reward loop: what the world produces between rifts (drift), what is
  // hung out of reach and locked behind a balance (caches), and what a sealed
  // line buys (kit). Critics read the same objects the game runs on.
  drift, caches, spans, kit,
  // The rhythm, and what fills the gap it opens: three items per arrival
  // (stint), a named place to walk to between two of them (errand), and the one
  // line that says which. Read-only for a critic — every one of these is driven
  // by playing, never by calling it.
  stint, errand, relay,
  // The one place the mote count moves (src/kit/ledger.js). Read, so a critic
  // can prove what the world paid and what it took.
  wallet,
  // world: the fifth day. The one thing on this island with intent — it runs a
  // circuit, it runs from you, and binding it hangs a new cache where it fell.
  // Critics read and walk the real constructs (src/world/warden.js).
  wardens,
  // world: what the world is actually saying about the tear in front of you and
  // about the next one — the plates, the key on them, the compass and the road.
  afford,
  // pedagogy/reporting: critics open the real report and read the same numbers
  // a teacher would, rather than a summary written for them.
  report, session,
  // world: critics traverse the real scene graph and project real world points
  THREE, scene: engine.scene, camera: engine.camera,
  // content: every skill and every item form the banks can draw, so a critic can
  // put the *tallest* representation on the learning surface instead of whatever
  // the scheduler happened to pick. (learn-ux wiring; read-only.)
  skillIds: SKILLS, formsBySkill: FORMS_BY_SKILL,
  // content: which course and unit this session is running, and which generator
  // packs are loaded. Critics assert the default is still Algebra I Level 1.
  content: () => ({
    course: content.courseId, units: content.unitIds, packs: content.packs,
    nodes: graph.nodes.map((n) => n.id),
  }),
  // i18n: critics drive the real bundles, and switch locale the way the HUD does
  t, locale: () => getLocale(), setLocale,
  // perf: real percentiles off the engine's frame log, not an average
  state: () => ({
    ...hudState(), fps: engine.fps, fxTier: fx.tier, perf: engine.stats(),
    skills: mastery.save().skills,
    // the run in progress: goal, pace, phase (src/session)
    session: session.state(),
    // what the world has produced, and what mastery has bought
    drift: { ...drift.stats }, caches: caches.state(), spans: spans.state(),
    kit: kit.state(),
    wardens: wardens.state(),
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
    try { localStorage.setItem(CLOCK_KEY, String(clockOffset)); } catch { /* private mode */ }
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
  openRiftById(id, override) {
    const r = rifts.list.find((x) => x.id === id);
    if (r) openRift(r, override);
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
   * pedagogy — READ ONLY. What is on the card right now, and nothing else.
   *
   * Nothing here can answer an item, open a tear, or move the learner model:
   * every field is a getter. It exists so a harness can play the game with real
   * key and mouse input — walk with WASD, open with E, click the reading or
   * type the number — and still be able to say afterwards which skill each item
   * was on and whether that skill was **already mastered when it was served**.
   *
   * That last figure is the whole reason this hook exists. A scheduler defect
   * that re-serves a proved skill is invisible to every harness that answers
   * through `enter()` or `panel.demo()`, because those bypass the input surface
   * and, with it, the chain condition in `openRift` that a standing player
   * actually triggers. See tools/critic/realsession.mjs.
   */
  panelInfo() {
    if (!panel.open || !panel.item) return { open: false };
    const id = panel.opts?.skillId || panel.item.skill;
    const s = mastery.state.get(id) || null;
    return {
      open: true,
      settled: !!panel._settled,
      mode: panel.mode,
      kind: panel.opts?.kind || null,
      skill: id,
      form: panel.item.form,
      rep: panel.item.rep,
      answer: panel.item.answer,
      masteredWhenServed: !!(s && s.mastered),
      attempts: s ? s.attempts : null,
      // What the engine called this item if it was served on a held line.
      reprobe: panel.opts?.reprobe || null,
    };
  },
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
  /**
   * Every movement of the currency, newest first, with the reason and the
   * balance it left behind — so a critic can prove the wallet never moves
   * without saying why rather than watching a counter and guessing.
   */
  ledger: () => wallet.history(),
  /**
   * Fire exactly the levy a rift surge fires — the same `wallet.take` call
   * src/world/drift.js makes, with nothing stubbed. A surge needs a held line,
   * a fifteen-metre door and boots within nine metres of the ring's own
   * ground, which makes the wipe a critic reported hard to reproduce on
   * demand; this reaches the arithmetic that did the wiping rather than
   * stepping around it.
   */
  levy: (n) => wallet.take(n, 'surge'),
  /**
   * Pay the wallet exactly the way the island pays it — the same `wallet.earn`
   * call src/world/drift.js and src/world/caches.js make, with the same reason
   * on it. tools/critic/pacing.mjs credits sixty days of ground income through
   * this, so the earn curve it measures is the shipping curve and not a copy of
   * it. It grants nothing the world does not grant on its own.
   */
  earn: (n, why = 'vein') => wallet.earn(n, why),
  /** Ground truth for the collider: what the boots find at a column, right now. */
  surfaceAt: (x, z) => builder.solids.top(x, z),
  /** The island alone, with nothing built on it — for measuring height gained. */
  islandAt: (x, z) => groundHeight(x, z),
  /**
   * THE POINT OF NO RETURN, as the player module currently believes it.
   *
   * Read-only, and it exists because the one thing a harness could not see was
   * the number the fall-catch is actually testing against. The cold-play gate
   * reported "still out of the world 6.1 s after leaving it, y = −3" for
   * months, and −3 is not a coincidence: it is a stale cached zero inside
   * `lowestGround()`. A fact a critic cannot read is a fact that gets guessed
   * at, and this one was guessed at three times. (src/player/terrain.js)
   */
  deck: () => ({ lowestGround: lowestGround(), deck: playerDeck() }),
  /** …and the predicate itself, at any point. Read-only; changes nothing. */
  outside: (x, y, z) => outsideWorld(x, y, z),
  /**
   * THE RECOVERY'S OWN VERDICT ON A PLACE, at any column. Read-only.
   *
   * The cold-play gate measures escape with its own raycaster over its own list
   * of meshes, which is exactly right — a gate that asked the player module
   * whether the player module was happy would prove nothing. But when the two
   * disagree there was no way to see WHICH of them was wrong, and "the gate says
   * 29% open, the search accepts nothing under 36%" is a sentence somebody then
   * has to resolve by guessing. This is the same numbers off the same code the
   * verb used. (src/player/escape.js)
   */
  site: (x, z) => playerSiteVerdict(x, z),
  openAt: (x, y, z) => playerOpenness(x, y, z),
  EYE: PLAYER_EYE,
  anchors: () => ({
    secured: builder.anchors?.secured ?? 0,
    total: builder.anchors?.total ?? 0,
    at: (builder.anchors?.list || []).map((a) => a.pos.toArray()),
  }),

  /** Screen quiet (src/ui/quiet.js): what yielded on the last pass. */
  quiet: () => quiet.state(),

  /**
   * Slotting (src/ui/slots.js): which transient surfaces are standing, which
   * one is waiting for another, and any pair that met and could not be asked
   * to. `clashes` is the list tools/critic/transient.mjs fails the build on —
   * it is read back as evidence, never used to drive anything.
   */
  slots: () => slots.state(),

  reset: restartRun,
};

/**
 * Start over: throw the save away and boot clean.
 *
 * This used to live only inside `window.__ascent`, which made it a critic hook
 * rather than a feature — there was no way for a *player* to reach it. It is a
 * named function now because the pause menu's own button calls it (src/ui/menu.js),
 * and a control the player can press must not be routed through the debug
 * surface.
 */
function restartRun() {
  localStorage.removeItem('ascent.save');
  localStorage.removeItem(CLOCK_KEY);
  report.tracker.reset(); story.reset(); session.reset();
  caches.reset(); spans.reset(); wardens.reset(); kit.reset(); wallet.reset();
  // The survey is progress too: a cleared save has to hand back an island with
  // its landmarks unclaimed, or a "start over" starts over into somebody else's
  // finished map. (src/world/errand.js, src/session/stint.js, src/meta/relay.js)
  errand.reset(); stint.reset(); relay.reset();
  location.reload();
}

// The screen's own budget. Started last, so every panel it governs exists.
const quiet = startQuiet();
// …and the screen's own geometry. quiet.js decides how MANY surfaces may talk;
// slots.js decides WHERE the transient ones stand and who waits when two of
// them still meet. Started alongside it, and for the same reason: every surface
// it measures has to exist first. (src/ui/slots.js — wiring only.)
const slots = startSlots();
