# THE FIRST 90 SECONDS
### How the greats teach without a tutorial, what ours actually does, and the spec that closes the gap

**Lane:** design study. No code was written for this document. Every measurement in it comes from a
frozen production build (`vite build --outDir dist-w17b`, served on its own port), driven with real
key events, cleared `localStorage`, and no query string. `window.__ascent` was never used to make
anything happen — only read once, after play, and not for any claim below.

**Read this in one pass or in four.** §1 is the diagnosis. §2 is the reference work. §3 is the
deliverable — the beat sheet. §4–§7 are the laws the beat sheet depends on. §8 is how to prove it.
Appendix A is the second-by-second log of the opening we ship today; the next wave will need it.

---

## 0 · The one sentence

> The game already contains every teaching signal it needs. It fires all of them at once, at a
> stranger, in a frame that holds **76 simultaneously readable strings**, using **one shape for eleven
> different meanings** — and the only thing it never does is *change the world in front of the player
> as a consequence of what the player just did.*

---

# 1 · The diagnosis

## 1.1 What the client actually reported

The client is not confused about the *game*. He found everything. Read his report against the source
tree and it becomes an inventory:

| The client's words | What it is in the build | Why he could not know |
|---|---|---|
| "I collected 800 shards" | Cipher motes. `MOTE_VALUE = 2` in `src/world/drift.js`, whose own comments call them "shards" | The word **shard** has three meanings on the glass: the island (`Shard Nine`, 40 learner-visible strings), the currency (internal name, `{shards}` placeholder at `en.js:32`), and the world's population ("Nine thousand shards have just stopped arguing"). The UI calls the currency *cipher motes*. He never saw that word attached to the thing he was picking up |
| "all 5–7 floating islands with algebra problems nearby" | The hanging caches. `COUNT = 5` in `src/world/caches.js` | He found **all of them** |
| "found the 3 diamond things" | The spans. `COUNT = 3` in `src/world/span.js` | He found **all of them**, and named them by the only property he could see: they are diamonds |
| "found some updrafts" | `src/world/drift.js` thermals + survey-mark grants | Correct |
| "lots of ring portal looking things but nothing happens when I go in them" | Rifts, wardens, errand marks, foundry rings, landmark rings, prop arches, afford chevrons | **Seven files** build a `TorusGeometry`. One of them is the thing that opens |
| "I see black diamonds and golden or orange diamonds too, nothing happening" | Motes, cache hearts, cache halos, warden cores, warden stones, span keys, prop shards, rift keystones, build anchors, foundry marks | **Eleven files** build an `OctahedronGeometry` |
| "tried to fly to the far away island but seems that's outside our boundaries" | `src/world/verge.js`, `RIM() * 1.62` | The sky drew an invitation the world was always going to refuse |
| "idk what to do about the tears" | Rifts. Called *tear* in exactly **two** learner-visible strings (`field.surgeWarn`, `relay.rhythm`) against **151** uses of *rift* | Two words, one object |
| "unsure what to do next? … not super sure how the player learns or proceeds" | `resolveObjective()` in `src/meta/objective.js` returns the answer on every frame | It is printed. It is printed *next to nine other printed things* |

**He was having fun and could not tell what anything meant.** That is not a content problem, a
pedagogy problem, or an art problem. It is a **grammar** problem and a **consequence** problem, and
both of them are solved in §4 and §3-Beat-5.

## 1.2 What the cold run measured

Frozen build, 1600×900, cleared save, real keys. Full log in **Appendix A**.

| Measurement | Value |
|---|---|
| Readable strings on the glass, cold open (t=0–11 s) | **15** |
| Readable strings on the glass, peak | **76** |
| Samples at ≥60 strings | **81 of 95** (85% of the session) |
| First frame at ≥60 strings | **t = 13.9 s** |
| Distinct text surfaces at t=14 s | **10** (rig readout, objective card, run band, locale switch, audio meter, progress/menu, ledger toast, controls card, Marlow, build hotbar) |
| Distance to first rift at spawn | **53 m**, dead ahead |
| Time for a player who **obeys the objective card** to open rift 1 | **15.4 s** |
| Time for a player who **explores** to open rift 1 | **never** (97 s, ended at 196 m and climbing) |
| Objective distance, t=25.3 s | **5 m — "You are standing in it"** |
| Objective distance, t=26.7 s | **21 m — "Behind you"** |
| Objective distance, t=97.1 s | **196 m**, after 72 continuous seconds of the number going *up* |
| Anything the world did about that | **nothing** |
| Console errors | 0 |
| PL / ES strings on glass at the same beat | 119 / 118 — the density is not a translation artefact |

Three frames from that run are the whole argument:

- **`shots/w17-first90/t004-idle.png`** — the arrival frame. Genuinely beautiful. It contains **seven
  ring-shaped objects** and **ten diamond-shaped objects**, and Marlow says *"That ring is a rift."*
  The word **that** has no referent.
- **`shots/w17-first90/t025-trek.png`** — the objective card reads **"6 m · YOU ARE STANDING IN IT"**
  while the cadet is airborne under a deployed glider, sliding past the face of the ring. `engaged()`
  in `src/world/beckon.js` suppresses contact-to-open while gliding. On a floating island, gliding is
  *how you arrive at things*.
- **`shots/w17-first90/t044-trek.png`** — the camera inside terrain, the world a brown blur, and the
  **26 px unlabelled orange triangle** floating in it with no text of any kind.

## 1.3 The three faults, named

1. **NO REFERENT.** The companion points with words (*that ring*, *that column*, *that curtain*) into
   a frame where the noun class has six members. Deixis without a unique referent teaches nothing.
2. **NO GRAMMAR.** Shape does not mean anything. The octahedron is used by eleven systems and the
   torus by seven, so "diamond" and "ring" carry no information. Fortnite's entire readability rests
   on the opposite promise.
3. **NO CONSEQUENCE.** Sealing a rift changes a percentage in a corner. Nothing in the world moves.
   The player's action does not visibly repair the thing the fiction says it repairs, so the maths
   never stops being a toll booth.

Everything in §3 exists to fix those three.

---

# 2 · How the greats actually do it

## 2.1 Breath of the Wild — the Great Plateau

**The structure.** Link wakes in the Shrine of Resurrection with no items and no HUD. A voice says his
name. A pedestal with a slate-shaped depression glows; the door will not open until the slate is on
it. Two chests hold clothes. A second pedestal opens the outer door, sunlight floods in, and he
climbs out onto the Plateau. The Plateau is sealed by cliffs. Four shrines are on it. Completing all
four earns the paraglider from the Old Man at the Temple of Time, and the paraglider is *the only
way down*. ([Wikipedia — Great Plateau][gp]; [Zelda Wiki — Shrine of Resurrection][sor];
[Zelda Dungeon — Great Plateau walkthrough][zd])

Critics called it *"one of the all-time great game openings"* (Oli Welsh, Polygon) and *"best tutorial
ever made"* (Ryan Gilliam, Polygon). ([Wikipedia — Great Plateau][gp])

**What it does that we do not:**

- **The mechanic is the lock.** The slate is not explained; the door is simply shut and the slate-
  shaped hole is lit. You cannot proceed without performing the verb, and performing it opens the
  world by exactly one room. Nothing is *told*. Something is *refused*, specifically, and then
  granted, immediately.
- **The gate is the reward.** The paraglider is not a tutorial completion badge. It is the physical
  key to a locked geography — *"the sole mechanism preventing descent from the elevated plateau"*
  ([Wikipedia][gp]). The player wants it before they know what it is, because they can see the entire
  rest of the world from up there and cannot get to it.
- **Instruction is optional and the world is not.** The Old Man's dialogue *"can be ignored without
  much detriment"* ([Wikipedia][gp]). Nothing load-bearing is in text.
- **Teaching by placement, not by prose.** Boulders sit above enemy camps. A region is simply too
  cold to cross without cooked food or the warm doublet. The lesson is a property of a place.
  ([Wikipedia][gp])

**The triangle rule.** At CEDEC 2017, director Hidemaro Fujibayashi, art director Satoru Takizawa and
technical director Takuhiro Dohta described building the landscape out of triangles. A triangle gives
the player a binary choice — *over, or around* — and it **occludes**, so rounding it reveals something.
([Nintendo Life][nl]; [Kotaku][kot]; [80.lv][lv]; the GDC form of the talk is
*Change and Constant: Breaking Conventions with The Legend of Zelda: Breath of the Wild* [GDC Vault][gdc])

The rule has **three scales**, and the scales must stay visibly distinct ([Radiator Blog][rad];
[Source Gaming][sg]):

| Scale | Job |
|---|---|
| **Large** | Landmark. Readable from across the world. It is the thing you steer by |
| **Medium** | Occluder. Hides the next thing until you round it. This is where surprise lives |
| **Small** | Pacing. Decides your next three steps: left or right |

Nintendo also used **rectangles** — *"good for completely hiding something from sight"* ([80.lv][lv]).

**Gravity, not paths.** Heatmaps showed players funnelling onto a few discrete routes. The fix was not
signage: it was **bowls**. Nintendo built *"funnels that direct the player to 'orbit' around certain
landmarks"* ([Radiator Blog][rad]), and put the important places **low**. Zora's Domain sits in a
crater; Rito Village in a sunken lake; Goron City in a crevasse; Gerudo Town on flat desert ringed by
mountains. *"Important locations are never on a peak or summit"* ([Game Developer][gd1]). Descending
is cheap, so gravity does the guiding.

And the sightline rule that follows from it ([Radiator Blog][rad]):

> "Avoid critical paths that aim straight from one point to another. You should not be able to see
> entire landmarks from point A to point B… curve and meander your paths so that the player
> eventually discovers / reveals more of the world."

**The map is earned.** The Sheikah Slate's map is blank until you climb the Great Plateau Tower. The
single most useful navigation instrument in the game is a **reward for traversal**, not a starting
condition. That is the design that makes a minimap unnecessary: by the time you have one, you have
already learned to read the horizon.

## 2.2 Fortnite — state, threat, reward and next action in a busy frame

Celia Hodent was UX director at Epic through Fortnite's development. Her account of what the team
optimised names the heuristics directly: **signs and feedback, clarity, form follows function,
consistency, minimum workload, error prevention and recovery, flexibility and accessibility**
([Hodent][hod]).

Four mechanisms matter for us:

**1 · A rarity grammar with no collisions.** Grey → green → blue → purple → orange/gold, lowest to
highest, and it is *the same colour everywhere the item appears*: the weapon in your hand, the icon
in the slot, the beam on the ground, the outline in the chest ([Dot Esports][de]). A colour is a
promise about value and it never lies. **This is the single thing our build most obviously lacks.**

**2 · One global objective that is legible from inside the fiction.** The storm is a wall you can see,
walking toward you, on a clock. The minimap draws the safe circle and the white line to it
([Fortnite Wiki — The Storm][fw]; [Epic — storm circle][epic]) — but strip the HUD away and the storm
is *still* a blue curtain closing from one side. The UI is a convenience over a world fact, not a
substitute for one.

**3 · Audio is information, and then the information is made visual.** Footsteps, chest chimes,
building and gunfire are all positional cues; competitive guidance treats turning them down as losing
information. The 3D-headphones setting applies HRTF so above/below/behind is audible. Then
Visualize Sound Effects renders the same cues as directional marks on a ring around the crosshair —
gunfire as an orange ripple, chests as a yellow glow, footsteps as a left/right pattern, 360°
([Accessibility Labs][al]; [Gaming Accessibility][ga]).

Read that twice. **Fortnite's accessibility feature is a compass built out of events, not out of
geography.** It shows *what is happening and where*, not *where north is*. That is the model §5 steals.

**4 · Icons are tested until strangers read them.** The trap icon was redesigned because playtesters
read it as *"ammunition, or trees"*; after the redesign *"all the players we invited to test the game
understood the new symbol"* ([Hodent][hod]). Hodent's onboarding rule is the one this whole document
is about: *"onboarding players properly, through elegant tutorials that feel part of the game, will
greatly impact the feeling of immersion."*

## 2.3 What both do in the first 90 seconds, before the player has any vocabulary

| | BOTW | Fortnite | The rule |
|---|---|---|---|
| **0–10 s** | Dark room. A voice. One lit pedestal | Bus over an island. One map, no decisions yet | **One lit thing. Nothing else competes** |
| **10–30 s** | The door refuses. The slate fits the hole | You choose where to jump; the whole island is legible from the air | **The first choice is spatial, not textual** |
| **30–60 s** | Sunlight. Climb out. The vista pans | Freefall, then the glider opens itself. You land | **The world grants the traversal verb; it is not explained** |
| **60–90 s** | The Temple of Time and the tower are in frame. Smoke from the Old Man's fire | A chest chimes through a wall. You open it. A colour tells you how good the gun is | **The next destination is in shot, and it makes a sound** |
| **Text used** | ~0 load-bearing words | ~0 load-bearing words | **Zero** |

Five properties they share, and these are the acceptance criteria for §3:

1. **ONE VERB AT A TIME.** A new verb is never introduced while the previous one is unlearned.
2. **THE REFERENT IS UNMISTAKABLE.** When the game means *that thing*, exactly one thing on screen can
   be *that thing*.
3. **THE WORLD ANSWERS WITHIN A HEARTBEAT.** Every action gets a world-side reply, and every refusal
   is *specific*.
4. **NOTHING IS NAMED BEFORE IT IS USED.** The word arrives after the object, never before.
5. **THE INSTRUMENT IS EARNED.** The thing that reduces confusion — map, paraglider, compass — is a
   reward for the traversal that made you want it.

---

# 3 · THE FIRST 90 SECONDS — the spec

Format for each beat: **what is on the glass · what the world does · what the player learns · what it
costs if we skip it.** Timings are from the first rendered frame after boot, ±1 s.

> **The governing rule of this whole section:**
> **Every beat below must survive `#ui { display: none }`.** If a stranger with the HUD hidden cannot
> reach and open the first rift inside 90 seconds, the beat is being carried by a word and it is
> wrong. That is a runnable gate; see §8.1.

---

### BEAT 0 · 0:00 – 0:06 · **THE DROP**

**Glass:** the location stamp only. `story.place.*`, four lines, drawn over its own rule. Nothing else.
`#ui.meta-cine` already suppresses every instrument. **Keep this exactly as it is** — it is the best
six seconds in the build, and the log proves it: 15 strings, against 76 later.

**World:** the camera's forward vector contains the first rift, at 40–60 m, with a clear line of sight.
Today it does, at 53 m. **Make it an invariant, not an accident** (§8.6).

**Learns:** where they are, and that this is a place.

**Skip cost:** the game opens on a HUD instead of a world. That is what every educational game looks
like, and it is the frame the client will compare with a Fortnite screenshot.

---

### BEAT 1 · 0:06 – 0:12 · **THE ONLY LIT THING**

**This is the largest single change in the document.**

**World:** for the first 90 seconds, **the objective rift is the only object on Shard Nine permitted to
emit.** Motes, wardens, anchors, caches, spans, foundry marks, decorative rings and landmark rings all
render with their emissive scaled to zero. They are still there, still solid, still beautiful in
albedo — they are simply not *speaking*.

They come back on a schedule tied to events, never to a clock (§3-Beat-9 and §6.3): the first mote
vein lights when the first rift is sealed; wardens light when the first vein is taken; caches and
spans light when their prerequisite line is held.

**Glass:** unchanged from Beat 0.

**Learns:** *glow means go.* This is Fortnite's rarity promise, stated once, with a sample size of one
so it cannot be misread.

**Skip cost:** exactly the client's report. Seven rings and ten diamonds in the arrival frame and a
companion saying *"that ring."*

> **This beat also repairs Marlow.** With one emitter in the world, `story.voice.firstRift` —
> *"That ring of torn air ahead is a rift"* — becomes true for the first time. No string changes.

---

### BEAT 2 · 0:12 – 0:22 · **THE FIRST VERB IS MOVE, AND THE GROUND TEACHES IT**

**Delete the controls card from the opening.** In the log it arrives at **t = 12.9 s**, adds **28
strings in one frame**, lists **nine verbs** — Move, Look, Jump, Glide, Interact, Build, Sprint, Dash,
Recover — and is still on screen at **t = 97 s** because rows tick off only as verbs are used. It is
the single densest object in the first 90 seconds and it teaches a stranger nothing, because a
stranger cannot hold nine bindings. Move it behind the Menu, where `F1` already puts it.

**World:** the affordance goes where the action is.

- If no movement key is pressed for **6 s**, one keycap ghost — **`W`** and nothing else — lies on the
  ground 2 m in front of the boots, in the world, at 0.5 Hz. It dies permanently on the first press.
  One glyph, one verb, on the floor, at the exact place the verb will move you.
- The moment the first step lands, **the road builds itself one chevron ahead of the boots** and keeps
  building toward the rift. `makeTrace()` in `src/world/afford.js` already draws this road on the real
  walkable route (`routeFrom()`), which is more than most shipped games have. Spec change: it must
  **build forward from the boots on the first step** rather than existing before the player acts, so
  the road reads as *a consequence of moving*.
- Look is taught by the same principle and is not taught in this beat at all. See Beat 7.

**Learns:** W moves me; the lit line is where I am going.

**Skip cost:** nine bindings at once, at second thirteen, to a fourteen-year-old with ADHD.

> **Pointer-lock note, and it is not cosmetic.** In the captured run the game printed *"The mouse
> cannot turn the view here — turn with the arrow keys."* Pointer lock is routinely denied in embedded
> and managed-browser contexts, which is what a school Chromebook is. The arrow-key fallback exists and
> works. But it means **the frame the player sees is the frame the game chose**, and it makes Beat 0's
> "the rift is in the camera's forward" load-bearing rather than merely nice.

---

### BEAT 3 · 0:22 – 0:32 · **THE APPROACH — AUDIO CARRIES THE DISTANCE**

**World:** `src/audio/rifthum.js` already positions the three nearest tears in stereo with a distance
measure. In the first 90 seconds it has one client, so:

- The rift's hum is the **only positional sound** on the shard. Volume and pitch both rise with 1/d.
  A player who turns away hears it move across the stereo field. This is Fortnite's chest chime, and
  it is the reason a Fortnite player can find loot they have never seen.
- At **9 m** the plate under the ring lights: a disc on the ground, and the keycap is drawn **on the
  disc**, in the world, not floating in the air beside a text label. `beckon.js` already opens on
  plate contact at `RIFT_STEP = 5.8`. The plate must be **visibly** that radius.

**Glass:** the objective card, and nothing else. See §7 for the cap.

**Learns:** things that matter make a sound; the closer I get the more it says; the disc is the switch.

**Skip cost:** the only channel that works when a player is looking the wrong way stays unused.

---

### BEAT 4 · 0:32 – 0:40 · **THE FIRST STATEMENT LIVES IN THE RING**

**World:** the first rift of a save does **not** open a full-screen card. The world stays visible at
~60%, the ring holds its shape on screen, and the statement is rendered anchored to the ring — same
`src/ui/rift.js` panel, same strict KaTeX through `src/ui/tex.js`, positioned rather than modal.

From the second rift onward the card behaves exactly as it does today. This is one beat, once per
save, and its whole job is to make the player learn **"the ring is the question"** instead of **"the
game has a quiz screen."**

**Content:** the easiest instance the generator can produce for the first skill. Rift 1 is not
assessment. It is the demonstration that answering is the verb.

**Learns:** the rift is a statement; I make it true.

**Skip cost:** the frame cuts to a worksheet, and everything before it becomes a loading screen for a
worksheet. That is the criticism this project has collected in every round.

---

### BEAT 5 · 0:40 – 0:52 · **THE SEAL — THE WORLD VISIBLY REPAIRS**

**The most important twelve seconds in the game. Nothing in the current build does this.**

**World, on the first correct unassisted answer, in this order:**

1. **0 ms** — the ring fills. `src/world/rifts.js` already does this: a held tear takes a keystone,
   stops turning, drops its beam to a thread. Keep it.
2. **+120 ms** — a low structural sound, felt more than heard.
3. **+250 ms** — **somewhere between 30 and 80 m away, and inside the current view frustum, a broken
   piece of the world re-forms.** A missing span of the lattice snaps into place. A collapsed arch
   closes. A dark section of ground lights. It must be **large, in shot, and permanent.**
4. **+900 ms** — the road to the next objective lights along its whole length, starting at the sealed
   plate and running away over the ground (§3-Beat-6).

**Glass:** `WORLD REPAIRED` moves 0% → 2%. It is on the glass already. But for this one beat the same
number is also drawn **once, in the world, on the piece that just re-formed**, and then never again.
The corner readout is a receipt; the world is the event.

**Learns — and this is the whole product thesis:** *the mathematics is not the price of admission. It
is the mechanism.* The client's report never says "the maths was boring." It says he could not see how
anything connected. This is the connection, and it is made of geometry, not sentences.

**Skip cost:** the game remains a reward loop with a toll booth bolted on, which BRIEF.md names as the
failure condition in its own words.

> **Design note on honesty.** The re-formed piece must be a real, previously-missing piece of the
> lattice that stays repaired across the session break, and `WORLD REPAIRED` must count the same set
> of pieces `linesHeld()` counts. RESUME.md lists "ten progress numbers that disagree" as an in-flight
> P0. Do not add an eleventh.

---

### BEAT 6 · 0:52 – 1:02 · **THE ROAD IS A REWARD**

**World:** the gold column and the ground trace already exist in `src/world/afford.js`. Two changes:

- **They light at the moment of the seal, not before.** Today the road is signage the player is
  expected to read. If it arrives as a consequence, it is a reward — and the player learns *sealing a
  rift shows me where to go next*, which is the exact sentence the client could not construct.
- **Standing on a sealed plate, at least one and at most two other live things are in frame.** This is
  the BOTW sightline contract — *from every point of interest you can see the next one* — with an
  upper bound, because "at most two" is what stops it becoming the arrival frame again.

**Learns:** finishing a thing reveals the next thing. There is always exactly one road.

**Skip cost:** *"unsure what to do next."*

---

### BEAT 7 · 1:02 – 1:15 · **THE SECOND VERB — THE GROUND RUNS OUT**

**World:** the road's next leg runs to the lip of a drop. This is deliberate placement, not chance.

- Walking off it begins a fall.
- After **0.6 s** of falling, the wing deploys **by itself, once per save, with no prompt.** The
  landing below is safe and is on the road.
- After that single automatic deploy, `Hold Space` is the verb, and the player already knows what the
  wing does **because they have been under it.**

This is the paraglider, exactly: BOTW gives you the traversal verb at the only place in the world
where you must have it, and the geography teaches its value before anyone says the word.

**Also fixes a live defect.** `engaged()` in `src/world/beckon.js` suppresses contact-to-open while
gliding. On a floating island, gliding is how you arrive. In the log at **t = 25.3 s** the card read
**"6 m · YOU ARE STANDING IN IT"** while the cadet slid past the ring's face under a deployed wing and
nothing happened. **A rift must open on contact from the air.** If a moving arrival is a problem, cut
the wing and set the cadet on the plate — an arrival is an arrival.

**Learns:** falling is not failure; the wing is mine; the ring works from the air.

**Skip cost:** the exact frame in `shots/w17-first90/t025-trek.png`, and *"nothing happens when I go in
them."*

---

### BEAT 8 · 1:15 – 1:25 · **THE HORIZON PROMISE**

**World:** on landing, the forward view contains **exactly one hero silhouette**, at 150–250 m, and
it is the only *other* lit thing in the world (Beat 1's ramp has not yet released the rest).

`src/world/landmarks.js` already builds six of these — the Spine, the Cathedral, the Ossuary, the
Glass Arch, the Reckoning, the Watchtower — explicitly *"placed so that turning on the spot at the
plaza puts a different one on each quarter of the horizon."* `src/world/errand.js` already puts a
survey mark on each, and `field.surveyClaim` already grants **"+{n} motes, and the air here rises for
good"** — a *permanent updraft*.

**That is our Sheikah tower and nobody has ever noticed.** Claiming a survey mark permanently changes
how the world can be traversed. Say so with the world: from the moment the mark is claimed, a visible
column of rising air stands over that landmark, from anywhere on the shard, for ever.

**Glass:** one Marlow line, and it is the only line in the 90 seconds that is about *wanting* rather
than *doing*. `survey.said.*` already carries them and they are good.

**Learns:** the big shapes on the horizon are destinations; going to one changes the map permanently.

**Skip cost:** six hero silhouettes the client never mentioned once.

---

### BEAT 9 · 1:25 – 1:30 · **THE FIRST MOTE, AND THE SYSTEMS RE-LIGHT**

**World:** the first mote vein lights **on the road the player is already walking**, 10–15 m ahead. They
run through it because it is in the way. `field.veinLit` fires once. The ledger's `ledger.first.*`
system — term and meaning in one breath the first time, bare term ever after — is already exactly
right; it just needs to be the *first* thing that has ever paid the player.

From here the emissive ramp from Beat 1 releases on events, never on a clock:

| Unlocks | When |
|---|---|
| Mote veins | first rift sealed |
| Wardens | first vein taken |
| Lattice anchors | build hand first drawn |
| Hanging caches | prerequisite line held |
| Spans | prerequisite line held |
| Foundry | 20 motes carried |

**Learns:** the world pays for movement, and it hands me one new system at a time.

**Skip cost:** the state we ship — everything lit, everything silent, nothing meaning anything.

---

## 3.1 The 90 seconds as one table

| t | Verb taught | Taught by | Words required |
|---|---|---|---|
| 0:00 | — | the vista, and 15 strings | 4 (a place name) |
| 0:06 | *glow means go* | one emitter in the world | 0 |
| 0:12 | **move** | a keycap on the ground; the road builds from the boots | 0 |
| 0:22 | **approach** | a hum that rises with 1/d | 0 |
| 0:30 | **open** | a lit disc you stand on | 0 |
| 0:32 | **answer** | a statement inside the ring | the item |
| 0:40 | **seal → repair** | a piece of the world re-forming, in shot | 0 |
| 0:52 | **follow** | the road lighting as a consequence | 0 |
| 1:02 | **glide** | the wing opening itself, once | 0 |
| 1:15 | **want** | one silhouette, alone on the horizon | 1 sentence |
| 1:25 | **collect** | a vein in the way | 1 sentence, once, ever |

**Ten verbs. Six sentences. No tutorial.**

---

# 4 · THE GRAMMAR OF THINGS

*This section answers "black diamonds and golden or orange diamonds", "lots of ring portal looking
things", and "the 3 diamond things" — all at once, and permanently.*

## 4.1 The law

> **One meaning, one silhouette. A silhouette may never be reused.**
> **Colour carries state, not identity. Motion carries invitation.**

Fortnite can put grey/green/blue/purple/gold on a weapon, an icon and a floor beam and have it mean
the same thing in all three places ([Dot Esports][de]) because the mapping is total and has no
collisions. Ours has eleven collisions on one shape.

## 4.2 The proposed assignment

| Meaning | Silhouette | Today |
|---|---|---|
| **A rift** — a statement that is not true yet | **A free-standing vertical ring, and nothing else in the world is one** | `TorusGeometry` shared with 6 other systems |
| **Currency** — cipher motes | **The octahedron, and nothing else in the world is one** | shared with 10 other systems |
| **A warden** — the thing that wants something | a body with an axis; asymmetric; it *moves* | octahedron + torus |
| **A cache** — a balance | the beam silhouette itself: a horizontal bar with two pans | octahedron heart + halo |
| **A span** — an area model | a rectangle split; the shape *is* the mathematics | octahedron keys |
| **A lattice anchor** — build target | a socket: a concave form that visibly wants a piece | octahedron |
| **A survey mark** — a landmark objective | a mark cut into the landmark, at the landmark's scale | octahedron + torus |
| **Foundry / shop** | a doorway; a thing with an inside | octahedron + torus |

The identity is the **silhouette**, so it survives being 200 m away, low quality settings, a phone
screen, colour-blindness and a dark scene. That is the same reason Fortnite pairs colour with a
distinct icon and a distinct sound.

## 4.3 Colour = state, and only state

Four states, applied identically to every object class:

| State | Treatment |
|---|---|
| **Live and it is the one you should do** | gold. Nothing else in the sky is gold. `afford.js` already reserves this — enforce it |
| **Live** | the object's own hue, at full emissive |
| **Locked** | the object's own hue, emissive 0, and a visible physical *bar* across it |
| **Held / spent** | filled, still, matte, no emission — `rifts.js` already does exactly this |

## 4.4 Motion = invitation

Anything the player may act on **turns, pulses or drifts**. Anything that is scenery is **still**. This
is one bit of information and it is free, and it is the fastest read in the whole grammar: a stranger
scanning a frame can sort forty objects into "mine" and "not mine" without a single word.

## 4.5 One word per thing, forever

- **rift**, never *tear*. Two learner-visible strings currently say *tear*: `field.surgeWarn` and
  `relay.rhythm`. Fix both. (`{tears}` as a placeholder name is invisible and may stay.)
- **cipher mote**, never *shard*. **Shard** means the island. `src/world/drift.js` calls motes
  "shards" throughout its own comments, which is how the word leaks; the client's *"I collected 800
  shards"* is that leak arriving in a human being.
- **line**, never *skill* or *node*, on any learner-visible surface. `guide.pay.linesAny` already
  glosses it in four words. Good.
- Every one of these is checkable by `tools/check-language.mjs`, which already enforces
  term-before-definition. Add the grammar-law nouns to its term list.

---

# 5 · THE WAYFINDING MODEL

*The standard: a game with no minimap that does not need one.*

## 5.1 Five instruments, in strict order of precedence

Each instrument is allowed to speak only about what the one above it cannot.

| # | Instrument | Range | Answers | Built? |
|---|---|---|---|---|
| 1 | **THE SKY** — one gold column over the scheduler's pick | whole shard | *which one* | yes, `afford.js` |
| 2 | **THE ROAD** — chevrons on the real walkable route, recomputed from the boots | 0–200 m | *how, around the terrain* | yes, `makeTrace()` + `routeFrom()` |
| 3 | **THE HORIZON** — six hero silhouettes, one per sector, each carrying a survey mark | whole shard | *where am I, and what is worth wanting* | yes, `landmarks.js` + `errand.js` |
| 4 | **THE EDGE** — the verge curtain | 250 m+ | *where the world stops* | partly, `verge.js` |
| 5 | **THE CARD** — distance and bearing | — | *the number, when you want the number* | yes, `objective.js` |

**Four of the five already exist.** The problem is not absence. It is that they all speak at once,
none of them is a consequence of anything, and the fifth — the weakest — is the loudest.

## 5.2 Replace the four buckets with a twelve-point arc

AHEAD / TO YOUR LEFT / TO YOUR RIGHT / BEHIND YOU has a worst-case error of 45°, which at 88 m is 62 m
of lateral miss. Replace it with the Fortnite compass strip, generalised:

- A **thin arc, 260 px wide, at the top of the frame**, 12 ticks.
- **One gold tick** for the objective.
- **One tick per claimed survey mark**, in that mark's colour. These accumulate as the player claims
  them, so **the compass gets richer as a reward for exploring** — which is BOTW's earned map, in a
  form that costs one strip of pixels.
- **Distance in metres under the gold tick only.** One number, not nine.
- **Under 15 m the arc disappears entirely** and the plate is the instrument. `HEAD_MIN = 14` in
  `afford.js` already has this idea.
- No cardinal letters. `N`/`S`/`E`/`W` are English initials and do not survive ES/PL. Ticks and colour
  do.

## 5.3 The wrong-way rule — the thing nothing currently does

In the captured run the distance went **5 m → 196 m over 72 continuous seconds** with the player
holding W, and the world did nothing. Fix:

> **Trigger.** Heading more than 90° off the road **and** distance to the objective monotonically
> increasing, for **8 continuous seconds**.
>
> **Response, in this order, and it is the world that responds — not the HUD:**
> 1. The road **ripples back toward the boots** — chevrons lighting in sequence from far to near, a
>    "come here" gesture. Costs nothing; it is one animation parameter on an existing InstancedMesh.
> 2. If it continues 8 s more: one mote vein lights **15 m along the correct heading.** Bait, not text.
> 3. If it continues 8 s more: **one** Marlow line. Once per session. Never twice.
> 4. Never a fourth response. A player who is deliberately exploring is not lost, and a game that
>    nags an explorer has misread the only signal that matters.

## 5.4 The three terrain rules, from BOTW

1. **Objectives sit in bowls, never on peaks.** *"Important locations are never on a peak or summit"*
   ([Game Developer][gd1]). The last 40 m of every approach should be **downhill**, so the rift is
   revealed by cresting a rise. Gravity does the guiding and the reveal is free.
2. **Three scales of occluder, kept visibly distinct** ([Radiator Blog][rad]; [Source Gaming][sg]):
   **large** = the hero silhouette you steer by; **medium** = the shoulder that hides the next rift
   until you round it; **small** = the rock that decides your next three steps. Our island currently
   runs large and small with very little in between, which is why the middle distance of every frame
   between rifts is empty — the *"worksheet with a wallpaper"* finding, restated as geometry.
3. **No straight critical paths.** *"You should not be able to see entire landmarks from point A to
   point B"* ([Radiator Blog][rad]). `routeFrom()` already curves around terrain. Let it curve *more*
   than the shortest safe route, deliberately, so the walk reveals.

## 5.5 The far island

`verge.js` exists because the client aimed at a landmass and slid along an invisible sphere. Two rules:

- **Never draw a destination the world will refuse.** Either the far shard is reachable, or its
  silhouette must read as *unreachable* — across a visible gulf, with a visibly **incomplete crossing**.
- **Make the crossing the progress bar.** `field.vergeHit` already promises *"the far shards are a
  crossing nobody has made"*, and `beckon` already says *"Hold every line and the lattice carries you
  out."* Build that sentence: a bridge out over the gulf that **gains one visible segment per held
  line.** Now `WORLD REPAIRED 0%` is a thing you can *see from anywhere*, the long-term goal is
  physical, and the invisible wall becomes an unfinished road — which is an invitation instead of a
  refusal.

---

# 6 · EN / ES / PL

The grammar in §4 and the wayfinding in §5 are shape, colour, motion and sound. **They are
language-free by construction**, which is the point: three locales cannot drift apart on a silhouette.

Rules for the words that remain:

1. **Zero hardcoded English.** Every string in this spec is an `src/i18n` key. Additive keys only;
   coordinate with narrative per BRIEF.md.
2. **A bearing is a whole sentence, never a word in a slot.** `charter.mark.*` already gets this right
   — *"The rift is {n} m away, straight ahead."* — with a note explaining why: *"51 m ahead" and "51 m
   to your left" put the distance in different places once you leave English.* Extend the same
   treatment to `guide.rel.*`, which currently ships four bare fragments (`Ahead`, `To your left`,
   `To your right`, `Behind you`) that must be composed by the reader.
3. **Keycaps are legends, not words.** `keyCap()` in `afford.js` is already correct: `E` is moulded
   into hardware; the touch cap is a word and comes from the bundle. The PL controls card currently
   shows one untranslated row — **`Sprint`** — which may be deliberate (it is a Polish loanword);
   confirm with the i18n owner rather than assuming.
4. **Polish is the layout worst case.** Measure every new string at PL length at 390 px before it
   ships. `tools/critic/landscape.mjs` measures ink, not boxes — use it.
5. **Term before definition, in all three.** `tools/check-language.mjs` enforces this. Add: *rift*,
   *line*, *held*, *cipher mote*, *lattice*, *verge*, *survey mark*, *warden*.
6. **ASD-STE100 for every learner-visible sentence:** one instruction per sentence, ≤20 words for a
   procedure and ≤25 for description, and no dropping the verb, subject or article to hit the count
   ([ASD][asd]; [Shufrans][shu]). Most of `en.js` already reads this way. The exceptions are the long
   glosses on the objective card, which §7 removes anyway.

**Parity check, measured:** at the same beat the glass carried 118 strings in ES and 119 in PL against
118 in EN. The density problem in §7 is uniform across locales; it is a design fault, not a
translation fault.

---

# 7 · ADHD

The client told us directly. BRIEF.md carries it as a constraint. These are hard numbers, not
sentiments.

## 7.1 The caps

| | First 90 s | Ever |
|---|---|---|
| Text surfaces on the glass at once | **≤ 3** | **≤ 5** |
| Readable strings on the glass at once | **≤ 12** | **≤ 30** |
| Objects animating >0.5 Hz outside the player's control | **≤ 1** | **≤ 3** |

Measured today: **10 surfaces, 76 strings**, from t = 13.9 s onward, for 85% of the session.

## 7.2 The rules

1. **One decision at a time.** The build hotbar (four slots, eight strings) must not exist on screen
   until the player has been given a reason to build. Neither must the locale switcher, the audio
   meter, or the rank readout.
2. **No typewriter for anything over six words.** Marlow currently types 12–18-word sentences over
   ~2 s — the log catches them mid-word: *"That r"*, *"Where it fails, you get a rift: a s"*, *"A
   lattice anc"*. A typewriter holds a reader's attention hostage for the machine's benefit and
   cannot be skimmed, re-read or skipped. **The sentence lands whole, and it stays for 6 s or until
   the next one.**
3. **Instructions live on the object, not on a timer.** Anything that disappears on a clock must not
   be the only place an instruction exists. This is why Beat 2 puts the keycap on the ground.
4. **Every interruption is resumable.** If a card is dismissed, the fact it carried is still
   discoverable by walking up to the thing.
5. **Never move a thing the eye is using.** The objective card must not reflow, resize or reorder
   while the player is reading it. Today it carries a distance that changes every frame *and* two
   paragraphs of gloss — the gloss should be in the Progress panel, not under a live number.
6. **Silence is a feature.** There must be at least one 10-second window inside the first 90 seconds
   with **no new text at all.** Beat 3 is it. Protect it.

## 7.3 What to cut from the opening, specifically

| Cut | Why | Where it goes |
|---|---|---|
| Controls card | 28 strings, 9 verbs, at t=12.9 s | Menu / `F1`, where it already is |
| Build hotbar | 8 strings, no reason to build yet | appears when the build hand is first drawn |
| Locale switcher (EN/ES/PL) | 3 strings, decided before boot by `<html lang>` | Menu |
| Audio meter | animated, no information | Menu |
| Rank + motes readout | both are zero | appears at the first mote |
| Run band | a count of a thing not yet done once | appears at the first seal |
| The two-paragraph gloss on the objective card | 44 words under a number that changes every frame | Progress panel |

That is **7 surfaces removed**, taking the opening from 76 strings to roughly 10.

---

# 8 · How to prove it — gates the next wave can build

Written to the house standard: each one **plants the exact defect it exists to catch**, proves the rule
fires, and proves it stays quiet on the nearest honest content.

| Gate | Asserts | Self-test |
|---|---|---|
| **8.1 `first90.mjs`** | Cold, no query string, cleared save, real key events, **`#ui { display:none }`**. A naive walker reaches and opens rift 1 within 90 s | Kill the rift's emissive and prove the walk fails; restore and prove it passes |
| **8.2 `glass.mjs`** | Samples readable-string count and surface count every 250 ms for the first 90 s. Fails over **12 / 3** | Plant one extra surface and prove it fires; prove Beat 0 (15 strings today → ~6) stays quiet |
| **8.3 `referent.mjs`** | For every beckon/voice line containing a deictic (*that* / *esa* / *ta*), count frustum objects of that noun class. **>1 fails** | Plant a second ring in the arrival frame; prove it fires. The arrival frame **fails this today at 7** |
| **8.4 `grammar.mjs`** | Walks the scene graph. One silhouette per meaning; no geometry class serves two systems | Assign an octahedron to a second system and prove it fires. **Fails today at 11 for the octahedron and 7 for the torus** |
| **8.5 `wrongway.mjs`** | Drives 90° off the road for 24 s; asserts three distinct world responses at 8/16/24 s and **none at 32 s** | Prove it fires on the current build, which produces zero responses over 72 s |
| **8.6 `horizon.mjs`** | Raycast sweep from 200 sampled standable points; **≥1 hero silhouette in a 60° frustum from every one**, and the first rift is within 12° of the spawn heading at 40–60 m | Move a landmark below the skyline and prove it fires |
| **8.7 `consequence.mjs`** | On the first seal, a mesh that was absent before the seal is present after it, inside the frustum, 30–80 m out, and still present after a reload | Suppress the re-form and prove it fires |
| **8.8 `oneword.mjs`** | No learner-visible string in any locale uses two words for one object. Seed list: rift/tear, mote/shard, line/skill | **Fires today**: 2 strings say *tear*; `{shards}` at `en.js:32` |

Gates 8.3, 8.4 and 8.8 fail on the current build **as written**, which makes them useful on day one.

---

# 9 · What this costs, honestly

Almost none of this is new machinery. Ranked by build cost:

**Nearly free — reordering and suppression:**
Beat 1 (emissive ramp), Beat 2 (cut the controls card), §7.3 (cut six surfaces), Beat 6 (light the
road on seal rather than on spawn), §5.3 step 1 (one animation parameter on an existing mesh),
§4.5 (two strings), §5.2 (one strip, replacing four fragments).

**Moderate:**
Beat 3 (plate radius + hum as sole emitter), Beat 4 (anchor the first card to the ring), Beat 7 (auto-
deploy once; **and delete `gliding` from `engaged()`**), Beat 8 (permanent visible updraft over a
claimed mark), §5.4.1 (move rift sites into bowls).

**Real work, and worth all of it:**
Beat 5 — the world visibly repairing. §5.5 — the crossing that gains a segment per held line.

Those last two are the same idea at two time scales: **the player's mathematics changes the world, and
they can see it from where they are standing.** Everything else in this document is clearing the
screen so that they can.

---

# APPENDIX A · Second-by-second log of the opening we ship today

**Method.** Frozen production build (`vite build --outDir dist-w17b`), served on its own port,
Chromium 1600×900, `localStorage` and `sessionStorage` cleared before first paint, no query string,
real key events only. Every visible text node under `#ui` was read each sample with its computed font
size, bounding box and opacity. `window.__ascent` was not used to drive anything. Zero console errors
across both runs.

**Artefacts:**
`/Users/harrison/dev/aadmath/shots/w17-first90/log.json` (95 samples, full DOM text + geometry)
`/Users/harrison/dev/aadmath/shots/w17-first90/*.png` (22 frames)
`/Users/harrison/dev/aadmath/shots/w17-first90b/log.json` (disciplined run)
`/Users/harrison/dev/aadmath/shots/w17-horizon/` (360° sweep, ES and PL arrival frames)

## A.1 Run 1 — the explorer (holds W, looks around, presses keys)

`n` = readable strings on the glass.

| t | n | What happened |
|---|---|---|
| 0.8 | 28 | Boot overlay `ASCENT / THE CIPHER WORLDS / Linking your cadet signature…` **over** a live HUD: rank, motes, `WORLD REPAIRED 0%`, EN/ES/PL, build hotbar, and an `E · WALK INTO IT · READING A VARIABLE · 53 m` chip |
| 2.1 | 36 | Objective card appears — `Seal the rift / Reading a variable / 53 m / Ahead` + 44 words of gloss. Marlow begins typing |
| 2.9 | **15** | Cold open takes the screen. `#ui.meta-cine`. Stamp: `MAKING PLANETFALL OVER / THE SKYREN LATTICE / Shard Nine · cadet landing / First light · fourth day of the tearing`. **The best frame in the run** |
| 3.7 | 15 | Marlow completes: *"That ring is a rift. Walk in and it shows you a statement. Make it true and the hole closes."* The frame contains **7 rings** |
| 4.8–10.8 | 15 | Two more Marlow lines. Nothing else changes |
| 11.6 | 16 | Click on canvas → `Build hand stowed. Press 1 to 4 to pick a piece` |
| **12.9** | **44** | **Controls card: +28 strings in one frame.** 9 verbs. `The mouse cannot turn the view here` |
| **13.9** | **64** | First W. Cold open retracts, **every instrument returns at once** |
| 15.3–19.4 | 63 | Walking. 41 → 16 m. A second, locked rift appears: `Sealed shut · Hold Reading a variable first · 33 m` |
| 20.2 | 63 | Mouse-look does nothing (pointer lock denied) |
| 24.0 | 63 | Three Space presses. **The glider deploys.** 9 m |
| **25.3** | **66** | **`5 m · YOU ARE STANDING IN IT` · `E · Open the rift`** — while airborne under the wing, sliding past the ring's face. `engaged()` suppresses contact. **Nothing opens** |
| 26.7 | 65 | `21 m · Behind you` |
| 27.7 | **70** | Chapter card arrives unprompted: `Chapter 1 · The Standing Question` (+8 strings) |
| 33.9–41.2 | 71–74 | Ledger strip: `+2`, `Cipher vein — loose lattice you can run through and keep`, `balance 4`, `+4 motes`. **74 strings — peak** |
| 42.3 | 74 | `The shard ends here` → `Wedged — Something has hold of you. Press Recover` → `Off the shard — the lattice caught you and set you down on the rim` |
| **44** | 70 | **Camera inside terrain.** World is a brown blur. The 26 px unlabelled orange triangle is at (612,166) with no text at all |
| 48.5 | 69 | `That ring of torn air ahead is a rift. Walk up to it and press E.` — **contradicts the t=3.7 line**, which said *walk in*, for the same object |
| 54.8 | 70 | `That ring of light is a rift surge…` — a **third** ring meaning |
| 55.8 | 69 | E pressed. Nothing. Distance 37 → 38 m |
| 60.6–73.9 | 69–73 | Updraft, motes, `Survey mark · The Reckoning`, `Down is a direction, not a plan` |
| 79.9 | 69 | `A lattice anchor. Nothing reaches one from flat ground, on purpose. Stack two ramps, then touch it.` — a **build tutorial in one sentence**, at second eighty, to a player who has not built |
| 85.8–97.1 | 69–71 | Off the shard **four more times**. Objective ends at **196 m**, having risen monotonically for 72 s. The controls card is still open |

**Peak: 76 strings. 81 of 95 samples at ≥60. Rift 1: never opened.**

## A.2 Run 2 — the disciplined player (obeys the objective card)

| t | Event |
|---|---|
| 3.9 | Boot complete |
| 5.1 | Clicked `GOT IT`, controls card dismissed |
| 5.5 → 13.9 | Walked straight at the objective. 53 → 10 m, no course correction needed |
| 14.3 | `You are standing in it` at **8 m** |
| **15.4** | **E → rift open.** `RIFT 7Λ-691 · FIRST SIGHT · A thermal wrap keeps t degrees in the line. 14 wraps are fitted this shift. If t = 23, how many degrees is that?` |

**The happy path is 15 seconds long and it works.** The problem is that it is not the loudest thing on
the screen, and nothing about the world makes a stranger choose it.

## A.3 Run 3 — the horizon

- **360° sweep at spawn** (`shots/w17-horizon/sweep-*.png`, 8 frames): the world is genuinely good.
  A stone arch, crystal blades, floating islands, a hero mountain, layered ridges. A `◀ NEXT RIFT 53 m`
  chip with a directional caret sits at top-centre during the cold open — **this is better wayfinding
  than what replaces it once the cold open ends**, and it should be studied, not discarded.
- **ES / PL arrival frames** (`arrival-es.png`, `arrival-pl.png`, `walk-es.png`, `walk-pl.png`):
  complete, idiomatic, layout holds. 118 / 119 strings against EN's 118. One row of the controls card
  reads `Sprint` in PL; confirm intent with the i18n owner.

## A.4 Source-tree measurements quoted in this document

```
OctahedronGeometry   23 sites across 11 files   src/{kit/foundry,meta/standard,world/rifts,
                                                world/landmarks,world/drift,world/caches,
                                                world/warden,world/errand,world/props,
                                                world/span,build/anchors}.js
TorusGeometry        17 sites across  9 files   (as above, plus world/afford.js)
caches COUNT = 5     src/world/caches.js:87     → the client's "5-7 floating islands"
span   COUNT = 3     src/world/span.js:72       → the client's "the 3 diamond things"
"rift" in en.js      151 learner-visible uses
"tear" in en.js        2 learner-visible uses   field.surgeWarn, relay.rhythm
"shard" in en.js      40 place-name uses + {shards} currency placeholder at en.js:32
RIFT_STEP  = 5.8 m   src/world/beckon.js:47     plate contact radius
REACH      = 9.0 m   src/world/afford.js         key range
CALL_R     = 78 m    src/world/afford.js         a tear starts advertising
SPRINTING  = 9.4 m/s src/world/beckon.js         above this, contact is suppressed
engaged()            src/world/beckon.js         building | gliding | sprinting → no contact
```

---

# APPENDIX B · Sources

**Breath of the Wild**
- [Great Plateau — Wikipedia][gp] — structure, four shrines, paraglider gate, Old Man's dialogue being
  ignorable, critical reception quotes
- [Shrine of Resurrection — Zelda Wiki][sor] — the opening sequence beat by beat
- [Great Plateau walkthrough — Zelda Dungeon][zd] — the concrete first-hour ordering
- [Zelda: Breath Of The Wild's Ingenious Design Is All About Triangles — Nintendo Life][nl] — CEDEC
  2017, Fujibayashi + Yonezu, the triangle rule
- [Breath of the Wild's Biggest Design Secret: Lots Of Triangles — Kotaku][kot]
- [The Design Secrets of Breath of the Wild — 80.lv][lv] — three triangle scales; the rectangle rule
- [Open world level design: spatial composition and flow in Breath of the Wild — Radiator Blog][rad] —
  gravity/funnels, the sightline rule, scale hierarchy
- [Breath of the Wild Open World Analysis: Gravity to go Forward — Game Developer][gd1] — landmarks in
  bowls, never on peaks
- [5 design lessons learned from Breath of the Wild — Game Developer][gd2]
- [Holism: Breath of the Wild's Golden Triangles — Source Gaming][sg] — the three scales; the vista on
  exiting the shrine
- [Change and Constant: Breaking Conventions with The Legend of Zelda: Breath of the Wild — GDC Vault][gdc]

**Fortnite**
- [Understanding the Success of Fortnite: A UX & Psychology Perspective — Celia Hodent][hod] — the
  heuristics; the trap-icon iteration; the onboarding principle. Hodent was UX director at Epic
- [What are the weapon colors in Fortnite? — Dot Esports][de] — the rarity grammar
- [Feature Highlight: Fortnite's Sound Visualizer — Accessibility Labs][al] — gunfire as orange
  ripple, chests as yellow glow, footsteps as left/right, 360° ring
- [How Fortnite's Visualize Sound Effects Shows the Direction of Selected Sounds — Gaming Accessibility][ga]
- [The Storm — Fortnite Wiki][fw] and [storm circle — Epic Developer Community][epic] — the always-
  legible global objective

**Language standard**
- [Simplified Technical English — ASD][asd] — the ASD-STE100 standard itself
- [ASD-STE100 FAQ — Shufrans TechDocs][shu] — sentence-length limits; one instruction per sentence;
  the warning against dropping sentence parts to hit the count

**In-repo**
- `BRIEF.md` — invariant 4, "invisible explicit teaching"; the Fortnite/BOTW bar; the ADHD constraint
- `RESUME.md` — the gate discipline; the "world between rifts" finding; the in-flight P0 list
- `src/world/afford.js`, `src/world/beckon.js`, `src/meta/objective.js`, `src/world/landmarks.js`,
  `src/world/errand.js`, `src/world/verge.js`, `src/world/rifts.js`, `src/audio/rifthum.js` — every
  one of these file headers already contains a critic's verbatim complaint and the design that
  answered it. **This document is mostly an argument that they should be allowed to speak one at a
  time.**

[gp]: https://en.wikipedia.org/wiki/Great_Plateau
[sor]: https://zelda.fandom.com/wiki/Shrine_of_Resurrection
[zd]: https://www.zeldadungeon.net/breath-of-the-wild-walkthrough/great-plateau/
[nl]: https://www.nintendolife.com/news/2017/10/zelda_breath_of_the_wilds_ingenious_design_is_all_about_triangles_apparently
[kot]: https://kotaku.com/breath-of-the-wilds-biggest-design-secret-lots-of-tria-1819113140
[lv]: https://80.lv/articles/the-design-secrets-of-breath-of-the-wild
[rad]: https://www.blog.radiator.debacle.us/2017/10/open-world-level-design-spatial.html
[gd1]: https://www.gamedeveloper.com/design/breath-of-the-wild-open-world-analysis-gravity-to-go-forward
[gd2]: https://www.gamedeveloper.com/design/5-design-lessons-learned-from-i-the-legend-of-zelda-breath-of-the-wild-i-
[sg]: https://sourcegaming.info/2017/11/25/holism-breath-of-the-wilds-golden-triangles/
[gdc]: https://www.gdcvault.com/play/1024562/Change-and-Constant
[hod]: https://celiahodent.com/understanding-the-success-of-fortnite-ux/
[de]: https://dotesports.com/fortnite/news/what-are-the-weapon-colors-in-fortnite
[al]: https://accessibility-labs.com/feature-highlight-fortnites-sound-visualizer/
[ga]: https://gamingaccessibility.org/how-fortnites-visualize-sound-effects-shows-the-direction-of-selected-sounds/
[fw]: https://fortnite.fandom.com/wiki/The_Storm
[epic]: https://dev.epicgames.com/documentation/fortnite/storm-circle
[asd]: https://www.asd-europe.org/standards-specifications/simplified-technical-english/
[shu]: https://www.shufrans-techdocs.com/asd-ste100-simplified-technical-english-faq/
