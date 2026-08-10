# ASCENT — The Cipher Worlds

An adaptive **Algebra I Level 1** mastery game in the browser (Three.js), built to a
Fortnite / Breath of the Wild bar. EN / ES / PL, strict KaTeX, knowledge-graph-driven.

A rift is a tear in the air held open by a statement that is not true yet. Make it true and
it closes. Instruction is explicit and complete but never arrives as a lecture — it arrives
as world, as a companion with a dry voice, and as faded worked "echoes" of previous cadets,
aimed at the specific misconception a wrong answer just revealed.

| | |
|---|---|
| fps | 113.6 median, 1% low 59.9 (Apple M4) |
| console errors | 0 |
| items validated | 12,180 across 3 locales |
| simulated true mastery | 96.3% — lowest ability quintile 89.3% |

```bash
npm install && npm run dev          # http://127.0.0.1:5173
tools/critic/snapshot.sh shots/x    # real pixels off a frozen build
node tools/validate-items.mjs       # content gate
node tools/simulate.mjs             # Monte-Carlo mastery proof
```

**[RESUME.md](RESUME.md) is the working document** — measured status, architecture, the
build/critic loop, and every open gap named by the blind critics, in priority order.
[BRIEF.md](BRIEF.md) is the standing brief every agent working on this repo reads first.

Built by parallel builder agents, each judged by a separate blind critic with fresh context
that opens the running game, captures its own pixels, plays the learning flow in all three
languages, and compares the frame side by side against the references. A piece clears only
when that critic would not send the builder back. Nothing has cleared yet.
