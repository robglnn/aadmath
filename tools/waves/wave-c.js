export const meta = {
  name: 'ascent-wave-c',
  description: 'Wave C: fix two invariant violations, then loop-until-passed across every piece with blind adversarial critics',
  phases: [
    { title: 'Blockers' },
    { title: 'Wave C' },
    { title: 'Playthrough' },
  ],
}

const ROOT = '/Users/harrison/dev/aadmath'

// ---------------------------------------------------------------------------
// PHASE 1 — two proven violations of stated invariants. Nothing else matters
// until these are closed, and both cross ownership lines.
// ---------------------------------------------------------------------------
phase('Blockers')

const BLOCKERS = [
  {
    id: 'shadow',
    label: 'blocker:player-shadow',
    prompt: `The cadet in ASCENT (${ROOT}) casts NO SHADOW. Three independent critics proved it
in real pixels. This is the highest-priority defect in the entire project.

Evidence you must reproduce and then eliminate:
- "I forced all 46 rig meshes to castShadow=true at runtime and re-shot the identical frame:
  still nothing, so this is a shadow-camera/layer bug, not a flags bug."
- "I scaled the rig 5x on the sunlit plaza and a seven-metre mech still produced zero shadow
  while the built ramp beside it cast a crisp one, and a top-down frame at 4m altitude showed
  no blob, no offset ellipse, nothing."
- At a 22-degree sun every tree, post and monolith throws a shadow 2.5x its height. The one
  object the player looks at 100% of the time throws none, so the character reads as a sticker
  pasted on the ground, and at jump apex there is no altimeter — you cannot tell whether you
  are standing or hovering.
- WARNING: src/world/world.js currently carries a ~25-line comment block claiming this is
  already fixed. It is not. Do not trust that comment; delete or correct it when you are done.

Read ${ROOT}/BRIEF.md first. You may edit any file needed (this crosses world/player/fx).
Find the ACTUAL root cause — shadow camera bounds, layer masks, the render order of the post
stack, a material that writes depth wrong, whatever it truly is. Do not paper over it with a
fake blob unless you have first made the real cast shadow work; a cheap contact blob is
acceptable ONLY as an additional airborne altimeter aid.

PROVE it with pixels, not claims:
1. \`cd ${ROOT} && tools/critic/snapshot.sh shots/blocker-shadow\` then Read the PNGs and look.
2. Write a Playwright script that positions the camera top-down over the player on the lit
   plaza and captures; confirm a shadow is visible and moves with him.
3. Capture at jump apex and confirm the shadow separates from his feet.
Zero console errors and >=55fps median when you finish. Commit.
Report exactly what the root cause was.`,
  },
  {
    id: 'i18n-leak',
    label: 'blocker:hardcoded-english',
    prompt: `ASCENT (${ROOT}) violates its own hard invariant: no hardcoded English anywhere in src/.

Proven by a critic in the running game:
- "Marlow's entire six-beat opening narration — the beats that define what a rift IS ('Where
  it fails, there is that. A rift: a statement the lattice can no longer justify…') — is
  hardcoded English and plays verbatim in English when the game is set to Spanish or Polish,
  while the badge beside it reads 'INTELIGENCJA NAWIGACYJNA · ODZYSKANA W 61%'. Only from the
  seventh beat does the script switch to the chosen language. A Polish or Spanish learner is
  handed the entire premise of the content model in a language they did not pick."
- The "COPPER RANGA" rank string in the same HUD variant is also wrong.

Read ${ROOT}/BRIEF.md first. Your job:
1. Localise those opening beats properly — transcreated into Spanish and Polish so Marlow's
   dry Hitchhiker's-Guide wit actually lands, with correct Polish grammatical case and aspect.
   Not machine-translated English word order.
2. Then sweep ALL of src/ for every other hardcoded user-visible English string and fix them.
   Build a guard: add \`tools/check-i18n.mjs\` that fails loudly on any user-visible string
   literal in src/ that does not come from the i18n layer, and wire it so it can be run in CI.
   Make it smart enough to avoid false positives on class names, keys and shader source.
3. Verify by driving the REAL game in es and pl with Playwright through the entire opening
   narration plus a full rift interaction, screenshotting each beat, and READING the images.

Zero console errors when you finish. \`node tools/validate-items.mjs\` must pass. Commit.
Report how many hardcoded strings you found and where.`,
  },
]

const blockerResults = await parallel(BLOCKERS.map((b) => () =>
  agent(b.prompt, { label: b.label, phase: 'Blockers', effort: 'high' })
))

log(`blockers done: ${blockerResults.filter(Boolean).length}/2`)

// ---------------------------------------------------------------------------
// PHASE 2 — every piece, loop until a blind critic passes it.
// ---------------------------------------------------------------------------
phase('Wave C')

const PIECES = [
  {
    id: 'world', name: 'World & art direction', owns: 'src/world/**',
    gap: `From every position a player can actually stand, the five far lands are occluded by the island's own bare, untextured summit ridge — the skyline only reads from ~180m, a height only reachable by writing to player.pos. Carve real sightlines: drop or notch the north/west ridge, put a genuine lookout terrace at the island's high point, and put the ashen massif's silhouette literally inside the arrival frame. Then give the terrain above the treeline the same surface treatment the plaza gets — peak-2 and peak-ashen are 60% smooth blue-grey plastic ramp.`,
    score: 5,
  },
  {
    id: 'fx', name: 'Post-processing & atmosphere', owns: 'src/fx/**',
    gap: `A separate agent is fixing the missing player shadow in parallel — do not duplicate that work, but do not let it block you either. Your remaining gap: make the atmosphere worth its cost. Volumetrics, the rift beacon, and near-field particulate must read as light in air rather than as screen-space overlays.`,
    score: 4,
  },
  {
    id: 'player', name: 'Movement, camera & game feel', owns: 'src/player/**, src/core/input.js',
    gap: `A separate agent is fixing the missing shadow in parallel; do not duplicate it. Judge and improve everything else about the feel: the rig's silhouette, foot contact, dust, skid, landing weight, camera behaviour, and how a 12-second clip of simply moving around reads next to Fortnite.`,
    score: 3,
  },
  {
    id: 'build', name: 'Axiom building system', owns: 'src/build/**',
    gap: `A placed piece has no material identity and no readable surface. The same RAMP photographed as saturated cyan, warm gold-brown timber, salmon-pink and tan inside one session — the frame material is albedo-thin and takes whatever the sun gives it. Worse, all four kinds are open rail frames you see straight through, so the ramp reads as a ladder and the floor reads as air; nothing says "you can stand on this," which is the one thing the piece has to say. Give the lattice a fixed albedo identity that survives any light, plus a semi-opaque deck/tread on ramp and floor. Verify by photographing one ramp at three times of day and confirming a player would name the same material each time.`,
    score: 5,
  },
  {
    id: 'learn-ux', name: 'Rift learning surface', owns: 'src/ui/rift.js, src/ui/rift.css, src/ui/tex.js',
    gap: `The echo column is the old disease in a new place: .rf-echo-body.deepen is a fixed-height internal scroller (scrollHeight 881 vs clientHeight 523 at 1280x720) that silently auto-scrolls earlier scaffolding above its top edge, and at 414x896 it steals 52px from .rf-stage — slicing the "0" key through its letterform and REMOVING THE SET BUTTON ENTIRELY, so a var-meaning keypad item becomes unanswerable with no scroll to recover it. Kill every fixed-height box in the panel: the echo must grow the stage or reflow beneath it, never clip it, and the whole surface must fit at 414x896 with the echo open on the tallest item form.`,
    score: 5,
  },
  {
    id: 'pedagogy', name: 'Content, item bank & mastery model', owns: 'src/learn/**, content/**, tools/validate-items.mjs, tools/simulate.mjs',
    gap: `Situation variety is far too thin: 19 distinct situation skeletons across the first 45 scheduled items, with the drop-pod sentence served 8 times and the alphabet-cadet joke 3 times. A learner meets the same sentence over and over. Widen the situation bank dramatically and make repetition impossible within a session. Do not regress the mastery numbers — re-run tools/simulate.mjs and keep >=95% true mastery with the lowest quintile >=85%.`,
    score: 5,
  },
  {
    id: 'narrative', name: 'Narrative, voice & progression', owns: 'src/meta/**, additive narrative keys in src/i18n',
    gap: `Progression is inert in real play: sealing 10 rifts correctly in a row through the real scheduler finished with lattice integrity 0%, rank Copper, Chapter 1 — every later chapter, the ascension rites, Marlow's "the handwriting in the margin is mine" reveal and the coda are written but UNREACHABLE. The five-act spine is bolted to mastery.integrity() alone, which does not move on the timescale a player feels. Add a second, faster-moving currency (seals, lines held, tears closed on this shard) that visibly advances the chapter card and the Standard within the first ten minutes. Verify by actually playing 10 rifts through the real scheduler and screenshotting the chapter state.`,
    score: 5,
  },
  {
    id: 'audio', name: 'Audio & music', owns: 'src/audio/**',
    gap: `Never judged — a critic has not yet heard it. An audio layer exists, synthesised from arithmetic. Make it genuinely good: an adaptive score that responds to place and mastery, surface-varied footsteps, altitude/glide wind, rift hum that shifts on approach, a satisfying resolution when a statement seals, restrained non-punishing feedback for a wrong answer. Autoplay-safe, mutable, and it must not cost frame time.`,
    score: null,
  },
  {
    id: 'i18n', name: 'EN / ES / PL localisation', owns: 'src/i18n/**',
    gap: `Never judged. A parallel agent is fixing hardcoded English in the opening narration — coordinate by only adding keys. Your job is the quality bar: every string idiomatic and transcreated in all three languages, Polish grammatical case and aspect correct, locale-correct mathematical typography, nothing overflowing its container in the longest language, at every viewport.`,
    score: null,
  },
  {
    id: 'perf', name: 'Performance, HUD & platform reach', owns: 'src/core/engine.js, src/ui/hud.js, src/ui/style.css',
    gap: `Never judged. Desktop is now 113fps median on an M4. Prove the phone: the game must be genuinely playable and beautiful at 414x896 and 390x844 with native-feeling touch, correct safe areas, and no HUD collisions. Verify gamepad end to end. The HUD must feel like it belongs to the world behind it.`,
    score: null,
  },
]

const CRITIC_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ourScore', 'referenceWins', 'priorGapClosed', 'biggestGap', 'verdict', 'evidence', 'passed'],
  properties: {
    ourScore: { type: 'number' },
    referenceWins: { type: 'boolean', description: 'true if the real Fortnite/BOTW/reference frame is better than ours' },
    priorGapClosed: { type: 'boolean' },
    biggestGap: { type: 'string' },
    verdict: { type: 'string' },
    evidence: { type: 'array', items: { type: 'string' } },
    passed: { type: 'boolean', description: 'true ONLY if genuinely wowed and would not send the builder back' },
  },
}

const MAX_ROUNDS = 3

const results = await pipeline(
  PIECES,
  async (piece) => {
    const history = []
    let last = null

    for (let round = 1; round <= MAX_ROUNDS; round++) {
      const feedback = history.length
        ? `\n\n## A blind critic rejected this ${history.length} time(s). Most recent:\n` +
          `Score ${history[history.length - 1].ourScore}/10. Prior gap closed: ${history[history.length - 1].priorGapClosed}\n` +
          `VERDICT: ${history[history.length - 1].verdict}\n` +
          `THE SINGLE BIGGEST GAP YOU MUST CLOSE: ${history[history.length - 1].biggestGap}\n` +
          `Evidence:\n- ${history[history.length - 1].evidence.join('\n- ')}\n` +
          `Cosmetic tweaks will fail again. Close that gap.`
        : `\n\n## An independent critic scored this ${piece.score ?? 'unjudged'}${piece.score ? '/10' : ''} and named this gap:\n${piece.gap}`

      await agent(
        `You are the builder for the "${piece.name}" piece of ASCENT: The Cipher Worlds.

Working directory: ${ROOT}
FIRST: read ${ROOT}/BRIEF.md in full — the bar, the invariants, file ownership. Obey it.

You own: ${piece.owns}
Do not edit other areas' files except minimal necessary wiring in src/main.js.
${feedback}

## How to work
- Capture with \`cd ${ROOT} && tools/critic/snapshot.sh shots/${piece.id}-w3r${round}\`. This builds
  a frozen bundle on its own port — several builders hot-edit this tree at once and the dev
  server WILL corrupt your screenshots. Always use snapshot.sh for anything you judge.
- After every change, READ the resulting .png files with the Read tool and LOOK at them.
  Never trust your own prose about what you wrote. Iterate until the pixels impress you.
- When you finish: snapshot.sh reports zero console errors and >=55fps median;
  \`node tools/validate-items.mjs\` passes; if \`tools/check-i18n.mjs\` exists it passes too.
- \`node tools/progress.mjs piece ${piece.id} building "<note>"\` when you start.
- Commit with git.

Return a short factual list of changes. Your summary is NOT shown to the critic.`,
        { label: `build:${piece.id}#${round}`, phase: 'Wave C', effort: 'high' }
      )

      const verdict = await agent(
        `You are a hostile, extremely well-calibrated critic. You have NOT seen what any builder
claims and must never ask. You judge only the running game.

Working directory: ${ROOT}
Target: **${piece.name}** (${piece.id}).

## The gap a previous critic named
${history.length ? history[history.length - 1].biggestGap : piece.gap}
Verify FIRST, in actual pixels, whether that specific gap is closed. Report priorGapClosed honestly.

## What to do
1. \`cd ${ROOT} && tools/critic/snapshot.sh shots/critic-${piece.id}-w3r${round}\` — a frozen build on
   its own port, immune to other builders' edits. READ every .png with the Read tool and look
   at them. Read report.json for fps percentiles, draws and console errors.
   If a capture fails or looks catastrophically broken, re-run it before concluding anything.
2. Drive the game yourself with Playwright. \`window.__ascent\` exposes state(), teleportTo(id),
   openRiftById(id), reset(). Write throwaway scripts under /tmp for what this piece needs:
   the learning flow in Spanish and Polish, a wrong answer's scaffolding, building and standing
   on what you built, 414x896 and 390x844, gamepad, \`node tools/simulate.mjs\` for mastery.
   For audio, inspect the Web Audio graph and capture rendered buffers — do not guess.
3. References: **Fortnite** and **Zelda: Breath of the Wild**, plus *Fourth Wing*, *Valerian and
   the City of a Thousand Planets*, *Red Rising*, *The Hitchhiker's Guide to the Galaxy*.
   Be honest and concrete: first write down what an actual reference frame or moment looks and
   feels like — composition, colour, silhouette, density, motion, readability, wit. Then put
   ours beside it, say which is better, and why.

## Standards
- 8/10 = genuinely competitive with the reference. Most attempts are 3-5. Say so.
- Do not be encouraging. Do not credit effort or engineering. Only the experience counts.
- Automatic fail: any console error; any hardcoded English; any KaTeX fallback; median fps
  below 55 on this M4; any text clipped or overflowing at 1280x720, 1600x900, 414x896 or 390x844.
- \`passed: true\` ONLY if genuinely wowed and you would not send the builder back.
  Passing something merely competent is a failure of your job.

Record it: \`cd ${ROOT} && node tools/progress.mjs piece ${piece.id} judging "<one line>"\`
Return the structured verdict.`,
        { label: `critic:${piece.id}#${round}`, phase: 'Wave C', schema: CRITIC_SCHEMA, effort: 'high' }
      )

      if (!verdict) break
      last = verdict
      history.push(verdict)
      log(`${piece.id} r${round}: ${verdict.ourScore}/10 ${verdict.passed ? 'PASS' : '— ' + String(verdict.biggestGap).slice(0, 80)}`)
      if (verdict.passed) break
    }

    return { piece: piece.id, rounds: history.length, final: last }
  }
)

// ---------------------------------------------------------------------------
// PHASE 3 — one fresh agent plays the whole thing and smooths the seams.
// ---------------------------------------------------------------------------
phase('Playthrough')

const smoothing = await agent(
  `You are the integration pass for ASCENT: The Cipher Worlds at ${ROOT}.

Ten builders just worked in parallel on world, fx, player, build, learn-ux, pedagogy,
narrative, audio, i18n and perf/HUD. Each improved its own area. Nobody owned the seams.
Read ${ROOT}/BRIEF.md first.

Your job is NOT new features. It is to make one coherent thing.

PLAY THE WHOLE GAME END TO END, for real, with Playwright — not a screenshot sweep:
arrive and watch the whole opening; move, sprint, jump, glide, mantle; build a ramp and climb
it; walk to a rift and open it; answer one wrong and watch the scaffolding; answer until it
seals; keep going through several rifts until something in the progression actually changes;
switch to Spanish mid-session and then to Polish and confirm nothing breaks or reverts to
English; do the whole thing again at 414x896 with touch.

Then fix the seams you find:
- two areas using different visual languages, fonts, easing, or colour vocabularies
- a HUD that fights the world behind it
- audio that does not match what is on screen
- narrative beats that fire at the wrong moment or not at all
- anything that is individually fine but collectively incoherent
- any dead code, stale comments that lie (there was one claiming the shadow was fixed when it
  was not), leftover agent scratch files, or debug UI left switched on

Finish with: \`tools/critic/snapshot.sh shots/final\` reporting zero console errors and
>=55fps median, \`node tools/validate-items.mjs\` green, \`node tools/check-i18n.mjs\` green
if it exists, and \`node tools/simulate.mjs\` still showing >=95% true mastery.
Commit. Update \`node tools/progress.mjs\`.

Return: what you fixed, the final measured numbers, and an honest list of what is still weak.`,
  { label: 'playthrough:smoothing', phase: 'Playthrough', effort: 'high' }
)

return {
  blockers: blockerResults.filter(Boolean).length,
  pieces: results.filter(Boolean).map((r) => ({
    piece: r.piece,
    rounds: r.rounds,
    score: r.final?.ourScore ?? null,
    passed: r.final?.passed ?? false,
    priorGapClosed: r.final?.priorGapClosed ?? null,
    biggestGap: r.final?.biggestGap ?? '',
  })),
  smoothing,
}
