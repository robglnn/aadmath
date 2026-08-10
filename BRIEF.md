# ASCENT — The Cipher Worlds · build brief

Read this fully before touching anything. Every agent working on this repo shares it.

## What we are making

A browser (Three.js) adaptive **Algebra I Level 1** mastery game that a teenager would
choose to play instead of Fortnite, and that makes 80%+ true mastery the default outcome
rather than a lucky one.

**The bar is not "good for an educational game." The bar is Fortnite and
Zelda: Breath of the Wild.** Tone target: the optimistic sci-fi wonder of *Fourth Wing*,
*Valerian and the City of a Thousand Planets*, *Red Rising*, and
*The Hitchhiker's Guide to the Galaxy* — awe, scale, momentum, and dry wit.

If a thing in this game would look amateur next to a screenshot of those, it is wrong,
no matter how well it is engineered.

## Non-negotiable invariants

1. **Strict KaTeX.** All mathematics renders through `src/ui/tex.js`, which uses
   `throwOnError: true, strict: 'error'`. No raw LaTeX in the DOM, no MathJax, no
   unicode maths glyphs in place of real notation. `node tools/validate-items.mjs`
   must pass.
2. **EN / ES / PL parity.** Every learner-visible string comes from `src/i18n`.
   No hardcoded English anywhere in `src/`. All three locales must be complete and
   idiomatic — not machine-translated English word order.
3. **Zero console errors.** `node tools/critic/shoot.mjs` exits non-zero if the real
   running game logs an error. It must exit 0 when you finish.
4. **Invisible explicit teaching.** Instruction is explicit and complete, but never
   arrives as a lecture, a tutorial popup, or a "Lesson 3.2" header. It arrives as
   world, companion voice, and faded worked "echoes" targeted at the specific
   misconception a learner just revealed.
5. **Knowledge-graph driven.** Nothing is unlocked out of prerequisite order.
   `content/graph/algebra1-l1.json` is the source of truth, standards-aligned to CCSS.
6. **Web and console feel.** Keyboard+mouse, gamepad, and touch must all work.
   60fps target on a mid laptop; mobile must be playable.
7. **Never break someone else's area.** Own your files (below). If you need a change
   outside them, make the smallest possible edit and say so in your report.

## File ownership

| Area | Owns |
|---|---|
| world | `src/world/**` |
| player | `src/player/**`, `src/core/input.js` |
| build | `src/build/**` |
| learn-ux | `src/ui/rift.js`, `src/ui/rift.css`, `src/ui/tex.js` |
| pedagogy | `src/learn/**`, `content/**`, `tools/validate-items.mjs` |
| i18n | `src/i18n/**` |
| narrative | `src/meta/**`, narrative strings in `src/i18n` (coordinate: additive keys only) |
| fx | `src/fx/**` |
| audio | `src/audio/**` |
| perf | `src/core/engine.js`, quality scaling |
| hud | `src/ui/hud.js`, `src/ui/style.css` |

`src/main.js` is shared. Append your wiring; do not restructure other people's wiring.
Prefer adding `import './yourthing.css'` inside your own module over editing `style.css`.

## Running it

```bash
npm run dev                       # http://127.0.0.1:5173  (usually already running)
tools/critic/snapshot.sh shots/<yourname>            # PREFERRED: real pixels off a frozen build
node tools/critic/shoot.mjs --out shots/<yourname>   # same capture, but against the live dev server
node tools/validate-items.mjs     # content gate
```

**Use `snapshot.sh` for anything you intend to judge.** Several builders hot-edit this
tree at once, so the dev server regularly full-reloads mid-capture and Playwright dies
with `Execution context was destroyed`, or you photograph a half-saved file and see a
black screen. That is the build process, not the game. `snapshot.sh` builds the current
tree, serves it on its own port, captures, and shuts down — immune to concurrent edits.
If a capture ever fails or looks catastrophically broken, re-run it through `snapshot.sh`
before concluding anything.

`window.__ascent` exposes `state()`, `teleportTo(skillId)`, `openRiftById(skillId)`,
`reset()` for driving the real game from Playwright. Extend it if you need more —
critics drive the actual game, never a mock.

## Reporting progress

```bash
node tools/progress.mjs piece <id> building "what you are doing"
node tools/progress.mjs piece <id> passed 9 "critic verdict in one line"
node tools/progress.mjs log "wave 2" "one-line note"
node tools/progress.mjs metric fps 118
```

Statuses: `queued` `building` `judging` `passed` `failed`.

## How you will be judged

A separate agent with no knowledge of what you did will open the running game, take
real screenshots, play the real learning flow in all three languages, and put your
frame side by side with a real Fortnite / Breath of the Wild reference. It will say
which is better. If ours loses, it names **the single biggest gap** and you go back in.
Builder summaries are not evidence. Only the running game is.
