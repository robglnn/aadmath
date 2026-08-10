# ASCENT — The Cipher Worlds · state of play

**Repo:** `/Users/harrison/dev/aadmath`
(*not* `/Users/harrison/dev/math/aadmath` — that path is owned by root and not writable by the
`harrison` user. If you want it there: `sudo chown -R harrison:staff /Users/harrison/dev/math &&
mv /Users/harrison/dev/aadmath/* /Users/harrison/dev/math/aadmath/`)

An adaptive Algebra I Level 1 mastery game in Three.js, built to a Fortnite / Breath of the Wild
bar, EN/ES/PL, strict KaTeX, knowledge-graph-driven.

---

## Run it

```bash
npm install
npm run dev                                   # http://127.0.0.1:5173
tools/critic/snapshot.sh shots/<name>         # real pixels off a FROZEN build + telemetry
node tools/validate-items.mjs                 # content gate (12,180 items x 3 locales)
node tools/simulate.mjs                       # Monte-Carlo mastery proof
node tools/progress.mjs piece <id> <status>   # updates the live readout
node tools/gallery.mjs <jpegdir> <report.json> progress/gallery.html
```

**Always use `snapshot.sh`, never the dev server, for anything you intend to judge.** Multiple
agents hot-edit this tree at once; Vite full-reloads mid-capture and Playwright dies with
`Execution context was destroyed`, or you photograph a half-saved file and see a black screen.

`window.__ascent` exposes `state()`, `teleportTo(skillId)`, `openRiftById(skillId)`, `reset()` —
critics drive the real game through it, never a mock.

---

## Measured status (verified by running it, not by agent claims)

| | |
|---|---|
| fps | **113.6 median**, 1% low 59.9, p95 15.4ms (Apple M4, frozen build) |
| draw calls / tris | 200 / 505,584 |
| console errors | **0** |
| items validated | **12,180** across 3 locales, strict KaTeX + independent solver |
| simulated true mastery | **96.3%**; lowest ability quintile **89.3%**; hollow claims 0.9% |
| best critic score | **5/10** — nothing has passed yet |

---

## Architecture

```
src/
  core/      engine.js (renderer, loop, quality)  input.js (kbm + pad + touch, one surface)
  world/     daylight.js  <- SINGLE source of sun vector + time of day. Everything reads it.
             terrain.js world.js sky.js air.js landmarks.js water.js rifts.js ranges.js
  player/    controller.js locomotion.js rig.js animator.js camera.js glider.js
             effects.js screen.js terrain.js (defensive wrapper over world height)
  build/     builder.js — grid-snapped wall/ramp/floor/beam, collision, ghost preview
  learn/     mastery.js (BKT + clean-run gate + spaced review)  generators.js  parser.js
  ui/        hud.js rift.js tex.js style.css rift.css
  i18n/      index.js en.js es.js pl.js plural.js typography.js
  fx/        post stack: bloom, sun shafts, grade, aerial perspective
  meta/      arc.js — five-act narrative spine
  audio/     Web Audio, fully synthesised, no assets
content/graph/algebra1-l1.json   10 skills, CCSS-aligned, prereqs + misconceptions
tools/critic/{snapshot.sh,shoot.mjs}   capture harness
progress/  index.html (live, reads state.json)  artifact.html  gallery.html
```

**Learning model.** Per-skill Bayesian Knowledge Tracing, plus three gates that make 80%+ mastery
the default rather than lucky: prerequisite gating (a rift line never opens before its parents are
mastered), unassisted-evidence (hinted successes raise pL but cannot satisfy the mastery gate), and
spaced re-entry (a mastered skill is re-probed on an expanding schedule; a miss demotes it).

**Invisible explicit teaching.** A wrong answer summons an "echo" — a previous cadet's solve,
revealed a line at a time, jumped to the step that addresses the *specific* misconception the wrong
answer revealed. Support fades as competence grows. No lecture, no tutorial popup, no lesson header.

---

## Published pages

- Progress readout — https://claude.ai/code/artifact/07010890-8260-4c49-8d6d-c9f5bd9c19dd
- Frame gallery (15 real frames) — https://claude.ai/code/artifact/a354d7aa-8e34-4e78-af63-363ae26e6629

Regenerate both: `node tools/progress-artifact.mjs` and `node tools/gallery.mjs`, then republish
the same file paths.

---

## How the build loop works

Each piece gets a **builder** agent and a separate **blind critic** with fresh context. The critic
never sees the builder's summary — it opens the running game, captures its own pixels, plays the
learning flow in all three languages, and compares the frame side by side with Fortnite / BOTW /
the reference worlds. It names the single biggest gap; the builder goes back in. A piece clears
only when the critic would not send the builder back.

- **Wave A** — 5 pieces, 30 agents, **0 passes**. world 3, fx 3, player 4, learn-ux 5.
- **Coherence pass** — found `#ui > *{pointer-events:auto}` (an ID selector) beating the
  `pointer-events:none` on the *closed* full-screen rift dialog, so **every click since the first
  commit landed on an invisible modal** — that is why building placed nothing and pointer lock
  never engaged. Also unified three modules each writing a different (dead) fog colour, and fixed
  aerial perspective that made distance *darker* than foreground.
- **Wave B** — 10 pieces. Lost 17 of 34 agents to a session limit; `i18n`, `audio`, `perf` were
  never judged. Scores 3–5.
- **Wave C** — launched, **stopped early at 2% usage remaining**. Nothing from it is verified.

---

## RESUME HERE — open work, in priority order

### 1. BLOCKER: the cadet casts no shadow
Three independent critics proved it. One forced all 46 rig meshes to `castShadow=true` at runtime
and re-shot — still nothing, so it is a shadow-camera/layer bug, not a flags bug. Another scaled
the rig 5× and a seven-metre mech still cast nothing while the ramp beside it cast a crisp shadow.
At a 22° sun every tree and monolith throws a shadow 2.5× its height; the one object the player
looks at 100% of the time throws none, and at jump apex there is no altimeter.
**`src/world/world.js` carries a ~25-line comment claiming this is fixed. The comment is false —
delete or correct it.** Prove any fix with a top-down capture and a jump-apex capture.

### 2. BLOCKER: hardcoded English breaks the EN/ES/PL invariant
Marlow's entire six-beat opening narration — the beats that define what a rift *is* — plays in
English when the game is set to Spanish or Polish, next to a badge reading
`INTELIGENCJA NAWIGACYJNA · ODZYSKANA W 61%`. Only from beat seven does it switch. The
`COPPER RANGA` rank string is wrong in the same HUD variant. Transcreate beats 1–6 into ES/PL
(correct Polish case and aspect), then sweep all of `src/`, and add `tools/check-i18n.mjs` as a
permanent guard against regression.

### 3. Per-piece gaps named by the last critic to see each one

- **world (5/10)** — from every position a player can *stand*, the five far lands are occluded by
  the island's own bare summit ridge; the skyline only reads from ~180m, reachable only by writing
  to `player.pos`. Carve sightlines, add a lookout terrace, put the ashen massif inside the arrival
  frame. Terrain above the treeline is 60% smooth blue-grey plastic ramp.
- **fx (4/10)** — volumetrics and the rift beacon still read as screen-space overlays, not light in air.
- **player (3/10)** — beyond the shadow: rig silhouette, foot contact, dust, skid, landing weight.
- **build (5/10)** — a placed piece has no material identity: the same ramp photographed as cyan,
  gold-brown, salmon and tan in one session. All four kinds are open rail frames you see through,
  so the ramp reads as a ladder and the floor as air. Nothing says "you can stand on this."
- **learn-ux (5/10)** — `.rf-echo-body.deepen` is a fixed-height internal scroller (scrollHeight 881
  vs clientHeight 523 at 1280×720) that silently scrolls scaffolding out of view; at 414×896 it
  steals 52px from `.rf-stage`, slicing the "0" key and **removing the SET button entirely**, so a
  keypad item becomes unanswerable. Kill every fixed-height box in the panel.
- **pedagogy (5/10)** — only 19 distinct situation skeletons across the first 45 scheduled items;
  the drop-pod sentence is served 8 times. Widen the situation bank; forbid repeats within a session.
  Do not regress `tools/simulate.mjs` (keep ≥95% true mastery, lowest quintile ≥85%).
- **narrative (5/10)** — progression is inert: sealing 10 rifts correctly through the real scheduler
  ends at integrity 0%, rank Copper, Chapter 1. Later chapters, the ascension rites, Marlow's
  reveal and the coda are written but unreachable. Add a second faster currency (seals / tears
  closed) that moves the chapter card within ten minutes.
- **i18n, audio, perf/HUD** — never judged by a critic. Unknown quality.

### 4. Known-unfixed, flagged by the coherence pass
- ~43% of frame time is procedural shader noise; the island fragment shader alone was 7.8ms of 16ms
  with ~30 unconditional noise taps per ground pixel. Needs a noise/LOD budget in the terrain shader.
- The seal/reward beat (gold shield, check mark, radiating rays) is free-to-play mobile visual
  language and fights the diegetic rift-stabiliser language of the panel it sits on.
- Shadow edges are soft/blobby at 5.7cm texels; a proper cascade would be better (three.js has no
  built-in CSM).

### To resume
Relaunch the Wave C workflow — the script is saved and the two blockers are its first phase:
`Workflow({scriptPath: "…/workflows/scripts/ascent-wave-c-wf_11425f6a-2e0.js"})`
(the file also lives in this repo at `tools/waves/wave-c.js`).
