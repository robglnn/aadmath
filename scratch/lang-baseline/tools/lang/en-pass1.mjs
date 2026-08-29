/**
 * EN → ASD-STE100 + ELI18 + ADHD. Pass one: the learning surface.
 *
 * Left is the string as it stood, right is the string as it reads now. Nothing
 * here is a translation memo — it is the diff, kept so the next person can see
 * exactly what changed and argue with it.
 *
 * Instructional text is rebuilt to STE: one instruction per sentence, active
 * voice, no bare "it"/"this" pointing back at a clause, plain words, and the
 * point first. Flavour text keeps Marlow's voice and only loses the long
 * sentences and the fancy words.
 */
export default [

  // ── boot / hud ────────────────────────────────────────────────────────────
  // "Lattice integrity" is the first number a player ever sees, and neither
  // word tells a fourteen-year-old what it counts. It counts how much of the
  // world you have put back. Say that.
  ["tip: 'Bonding cadet signature to the Skyren lattice…'",
    "tip: 'Linking your cadet signature to Shard Nine…'"],
  ["mastery: 'Lattice integrity',",
    "mastery: 'World repaired',"],
  ["readout: 'Lattice integrity {pct} · rank {rank} · {n} {shards}',",
    "readout: 'World repaired {pct} · rank {rank} · {n} {shards}',"],
  ["      integrity: 'Lattice integrity',",
    "      integrity: 'World repaired',"],

  // ── the menu: the always-visible answer to "what do I do" ─────────────────
  // This is now the key that defines the word "rift", because it is the
  // earliest surface a player can reach that has room for a sentence. Five
  // short sentences, one instruction each, the action first.
  ["nowBody: 'Walk into one of the glowing rings and press {key}. The rig throws the statement onto your visor — make it true and the rift closes for good.',",
    "nowBody: 'A rift is a ring of torn air. Each rift holds a maths statement that is not true yet. Walk into the ring. Press {key}. Make the statement true, and the rift closes for good.',"],
  ["    now: 'What to do out there',",
    "    now: 'What to do next',"],

  // ── first run ─────────────────────────────────────────────────────────────
  ["body: 'Something has hold of you. Pull yourself back out onto open ground — nothing here ever needs a reload.',",
    "body: 'Something has hold of you. Press Recover to get back onto open ground. Nothing here ever needs a reload.',"],

  // ── build ─────────────────────────────────────────────────────────────────
  ["anchorCall: 'Three anchors hang over the plaza. Nothing on the ground reaches them — so stop standing on the ground.',",
    "anchorCall: 'Three anchors hang over the plaza. Nothing on the ground reaches them. So stop standing on the ground.',"],
  ["handStowed: 'Build hand stowed — pick a piece first, 1 to 4',",
    "handStowed: 'Build hand stowed. Press 1 to 4 to pick a piece',"],

  // ── the learning surface ──────────────────────────────────────────────────
  ["    correct: 'Lattice holds.',",
    "    correct: 'The line holds.',"],
  ["    incorrect: 'It slips. Look again.',",
    "    incorrect: 'Not true yet. Look again.',"],
  ["    trueNow: 'True. It closes.',",
    "    trueNow: 'True. The rift closes.',"],
  ["      check: 'Proving run · {n}/{m}',",
    "      check: 'Proving run · {n} of {m}',"],

  // One instruction per sentence. The old line asked for two things in one
  // breath and put the verb the player needs last.
  ["      keypad: 'Type the value that makes the statement true, then seal the rift.',",
    "      keypad: 'Type the value that makes the statement true. Then press Seal.',"],
  ["      balance: 'Choose a move. The beam applies it to both sides — that is the whole law.',",
    "      balance: 'Choose a move. The beam applies it to both sides. Both sides, every time — that is the whole law.',"],
  ["      area: 'Cover each part of the field with the area it carries.',",
    "      area: 'Cover each part of the field with the area that part carries.',"],

  ["      empty: 'Nothing entered',",
    "      empty: 'Type a value first',"],

  ["      further: 'Still true — but the unknown is buried deeper now.',",
    "      further: 'Still true. But the unknown sits deeper now.',"],

  // ── the echo ──────────────────────────────────────────────────────────────
  // The first line of the echo panel now says what an echo *is*. It used to
  // assume the player had worked that out from a button labelled "Call the
  // echo", which is not a definition, it is a noun.
  ["      trace: '{name} stood here once. This is the trace they left.',",
    "      trace: 'An echo is the work an older cadet left in this rift. {name} stood here once. Read it one step at a time.',"],
  ["      spent: 'The trace is spent',",
    "      spent: 'No trace left',"],
  ["      liveOnly: 'The rig has no other rift of this shape on record. This is your own line, read back to you.',",
    "      liveOnly: 'The rig has no other rift of this shape on record. So the echo shows your own work, read back to you.',"],
  ["        balance: 'Something is stuck to the unknown. Undo the outermost thing first, and the beam does the rest.',",
    "        balance: 'Something clings to the unknown. Undo the outermost thing first. The beam does the rest.',"],

  // ── misconceptions: what the learner actually did ─────────────────────────
  ["    'letter-as-object': 'They read the letter as a thing being counted, not as a number.',",
    "    'letter-as-object': 'They read the letter as a thing to count, not as a number.',"],
  ["    'add-not-multiply': 'They joined the two quantities by adding, where the situation describes equal groups.',",
    "    'add-not-multiply': 'They added the two quantities. The situation makes equal groups, so it multiplies.',"],

  // ── worked lines ──────────────────────────────────────────────────────────
  ["      multipliedThenAdded: 'The unknown was multiplied by `{a}`, then `{b}` was added.',",
    "      multipliedThenAdded: 'The equation multiplies the unknown by `{a}`, then adds `{b}`.',"],
  ["      multipliedThenTaken: 'The unknown was multiplied by `{a}`, then `{b}` was taken off.',",
    "      multipliedThenTaken: 'The equation multiplies the unknown by `{a}`, then takes off `{b}`.',"],

  // ── story: flavour keeps its voice, loses its long sentences ──────────────
  ["b1: 'Seven sealed statements. That is weight enough to requisition the founding proof, so I requisitioned it for you. Four million steps. Nine hundred years. Watertight the whole way down — except at step nine.',",
    "b1: 'Seven sealed statements. That is weight enough to call up the founding proof, so I called it up for you. Four million steps. Nine hundred years. Watertight the whole way down — except at step nine.',"],
  ["quest: 'One step of the founding proof was never finished. Climb high enough to finish it.',",
    "quest: 'Nobody ever finished one step of the founding proof. Climb high enough to finish it.',"],
  ["b2: 'The handwriting in the margin is mine. I was the cadet on Shard Nine. The shard was falling, I had eleven minutes, and an assumed step holds a world up exactly as well as a proved one — right up until it does not.',",
    "b2: 'The handwriting in the margin is mine. I was the cadet on Shard Nine. The shard was falling and I had eleven minutes. An assumed step holds a world up exactly as well as a proved one — right up until it does not.',"],
  ["          'Three misses. If you tell me it is fatigue I will believe you, and I will also note that you have been at this longer than most cadets lasted.',",
    "          'Three misses. Tell me it is fatigue and I will believe you. I will also note that you have lasted longer at this than most cadets did.',"],
  ["          'And it folds. That is the part nobody writes down about people like you — not that you never slip, but that the slip is never allowed to keep anything.',",
    "          'And it folds. That is the part nobody writes down about people like you. Not that you never slip — but that a slip never gets to keep anything.',"],
  ["          'Recovered. Most of the cadets I walked through here never got a fourth attempt out of themselves.',",
    "          'Recovered. Most of the cadets I walked through here never got a fourth try out of themselves.',"],

  // ── the dossier's ledger of what standing is made of ──────────────────────
  ["      provingNote: 'Three for every item held inside a proving run: unassisted, unfamiliar, high band.',",
    "      provingNote: 'Three points for every item you hold inside a proving run: no help, unfamiliar, high difficulty band.',"],

  // ── the orders card ───────────────────────────────────────────────────────
  // `goalHold` now defines the word "line", because the orders card is the
  // first place the game asks a player to do something to one.
  ["goalHold: '{skill}. Seal {tears} rifts on that line and it should hold — properly held, the kind that never opens again.',",
    "goalHold: '{skill}. A line is one idea, plus every rift that tests it. Seal {tears} rifts on this line today and the line holds for good.',"],
  ["goalHoldN: 'Seal {tears} rifts and {n} lines should hold — properly held, the kind that never open again.',",
    "goalHoldN: 'Seal {tears} rifts today, and {n} lines hold for good. A held line never opens again.',"],
  ["goalPush: '{skill}. Seal {tears} rifts on that line. It is a long one, and today we make it short.',",
    "goalPush: '{skill}. Seal {tears} rifts on that line. The line is a long one, and today we make it short.',"],

  ["        ahead: 'The rift is marked on your visor — {n} m, straight ahead.',",
    "        ahead: 'Your visor marks the rift: {n} m, straight ahead.',"],
  ["        left: 'The rift is marked on your visor — {n} m, off to your left.',",
    "        left: 'Your visor marks the rift: {n} m, off to your left.',"],
  ["        right: 'The rift is marked on your visor — {n} m, off to your right.',",
    "        right: 'Your visor marks the rift: {n} m, off to your right.',"],
  ["        behind: 'The rift is marked on your visor — {n} m, behind you.',",
    "        behind: 'Your visor marks the rift: {n} m, behind you.',"],
  ["        here: 'The rift is marked on your visor. You are standing in it.',",
    "        here: 'Your visor marks the rift. You are standing in it.',"],

  ["      eta: 'About «n|one:# minute|other:# minutes» at the pace you have been working. There is no clock on this — I will tell you when we are near the end.',",
    "      eta: 'About «n|one:# minute|other:# minutes» at the pace you have been working. No clock runs here. I will tell you when the end is near.',"],
  ["      etaSeed: 'About «n|one:# minute|other:# minutes», give or take. I have not watched you work yet, so that figure is mine and not yours; it will be yours by tomorrow. There is no clock on this — I will tell you when we are near the end.',",
    "      etaSeed: 'About «n|one:# minute|other:# minutes», give or take. I have not watched you work yet, so that figure is mine and not yours. Tomorrow it will be yours. No clock runs here. I will tell you when the end is near.',"],
  ["      backHeld: 'Last time out you sealed «n|one:# rift|other:# rifts», and {skill} has held ever since. It still does.',",
    "      backHeld: 'Last time out you sealed «n|one:# rift|other:# rifts», and {skill} has held ever since. That line still holds.',"],
  ["      backHeldN: 'Last time out you sealed {tears} rifts, and «n|one:# line has|other:# lines have» held ever since. They still do.',",
    "      backHeldN: 'Last time out you sealed {tears} rifts, and «n|one:# line has|other:# lines have» held ever since. Those lines still hold.',"],

  // ── the session close: the card that has to survive a tired reader ────────
  ["      heldNote: 'Proved unassisted, at the hard band, with every worked example switched off. It is yours.',",
    "      heldNote: 'You proved it with no help, at the top difficulty band, and with no worked examples. The line is yours now.',"],
  ["      groundNoteFar: 'A long line. It moved today, and it moved the right way.',",
    "      groundNoteFar: 'A long line. The line moved today, and it moved the right way.',"],
  ["      openedNone: 'Nothing opened today. That is what the long lines cost, and they are the ones worth having.',",
    "      openedNone: 'Nothing opened today. Long lines cost exactly that, and long lines are the ones worth having.',"],
  ["      nextNote: 'About «n|one:# minute|other:# minutes» of work, and the highest-leverage thing left open. That is where we start.',",
    "      nextNote: 'About «n|one:# minute|other:# minutes» of work, on the highest-leverage line still open. We start there.',"],
  ["      nextDone: 'Nothing is open here any more. Step nine is proved.',",
    "      nextDone: 'Nothing is open here any more. Step nine holds.',"],
  ["      sign: 'None of this is lost. The lattice keeps what you proved, and it will still be standing when you come back.',",
    "      sign: 'You lose none of this. The lattice keeps what you proved, and it will still stand when you come back.',"],
  ["      signWorked: 'Nothing here is graded and nothing here is lost. The line you were on is the line we open with, and it will be exactly where you left it.',",
    "      signWorked: 'Nobody grades this, and you lose nothing. Next time we open on the line you were working. The line will be exactly where you left it.',"],
  ["      signHeld: 'That line does not rot and it does not reset. Everything above it just became reachable.',",
    "      signHeld: 'That line does not rot, and it does not reset. Everything above it is now within reach.',"],
  ["      groundNoteBack: '«n|one:# rift|other:# rifts» from holding by the shortest road — further than at the start, because a missed gate item puts the proving run back to its first step. That is the gate being strict, not you being slow.',",
    "      groundNoteBack: '«n|one:# rift|other:# rifts» from holding by the shortest road. Further out than at the start. One missed gate item sends the proving run back to step one. The gate is strict. You are not slow.',"],
  ["      capped: 'That is the twenty-five minutes this loop is built around. Another stretch today is worth less than the same stretch tomorrow — that is not encouragement, it is how spacing works.',",
    "      capped: 'You have reached the twenty-five minutes this loop runs on. Another stretch today is worth less than the same stretch tomorrow. Not encouragement — that is how spaced practice works.',"],
  ["      groundIdle: 'No question reached an answer this run. Nothing was spent and nothing was lost — the shard is exactly where you left it.',",
    "      groundIdle: 'No question reached an answer this run. You spent nothing and you lost nothing. The shard is exactly where you left it.',"],
  ["      openedWholeNone: 'There is nothing left on this shard to open. That is not the end of the work; it is the end of the map.',",
    "      openedWholeNone: 'Nothing is left on this shard to open. The work does not end here. The map does.',"],
  ["      openedHeldNone: 'A line can be worth holding and open nothing the same day. What a held line reaches is not always the next thing along.',",
    "      openedHeldNone: 'A line can be worth holding and still open nothing that day. A held line does not always reach the next thing along.',"],
  ["      signHeldQuiet: 'That line does not rot and it does not reset. Nothing further up the lattice came within reach today — it is a web, not a staircase — and the line is banked for good.',",
    "      signHeldQuiet: 'That line does not rot, and it does not reset. Nothing further up the lattice came within reach today. The lattice is a web, not a staircase. You have banked the line for good.',"],
  ["      bandDown: 'Questions now open at band {n}, where you actually are. The bar for holding the line has not moved a millimetre.',",
    "      bandDown: 'Questions now open at difficulty band {n} — where you actually are. The bar for holding the line has not moved a millimetre.',"],
  ["      bandUp: 'Questions now open at band {n}. You pushed the bank up today, not the other way round.',",
    "      bandUp: 'Questions now open at difficulty band {n}. You pushed the bank up today, not the other way round.',"],
  ["      stationNoteNone: 'What a charter and two hundred and forty motes raise: a permanent tower of rising air that is also a place. There is no last one.',",
    "      stationNoteNone: 'A charter and two hundred and forty motes raise one. A waystation is a permanent tower of rising air, and also a place. There is no last one.',"],

  // ── the break ─────────────────────────────────────────────────────────────
  ["      say: 'Stand down. Look at something a long way off — the far range will do — and breathe with the ring. Four counts in, hold for two, six out.',",
    "      say: 'Stand down. Look at something far away — the far range will do. Breathe with the ring. Four counts in. Hold for two. Six out.',"],
  ["      endBody: 'Rested. Everything you proved is written down, and the sky is where you left it.',",
    "      endBody: 'Rested. The rig wrote down everything you proved. The sky is where you left it.',"],
  ["      endBodyNext: 'Rested. Everything you proved is written down. Next time we open with {skill}.',",
    "      endBodyNext: 'Rested. The rig wrote down everything you proved. Next time we open with {skill}.',"],
  ["      aria: 'Break. Paced breathing; nothing is being asked of you.',",
    "      aria: 'Break. Breathe with the ring. Nobody wants anything from you.',"],

  // ── the progress report ───────────────────────────────────────────────────
  ["    recordSub: 'What this claim is worth, said plainly. These are the figures a teacher checks, and the last one is the uncomfortable one.',",
    "    recordSub: 'What this claim is worth, said plainly. A teacher checks these figures. The last one is the uncomfortable one.',"],
  ["      sessionNote: 'A session is built to run 15–25 minutes and then stop cleanly.',",
    "      sessionNote: 'A session runs 15–25 minutes, then stops cleanly.',"],
  ["      hollowNote: '{n} of {of} mastery claims were taken back when the line was re-tested cold.',",
    "      hollowNote: 'This engine took back {n} of {of} mastery claims after a cold re-test.',"],
  ["      hollowNone: 'No mastery claimed yet, so there is nothing to check.',",
    "      hollowNone: 'No mastery claimed yet. Nothing to check.',"],
  ["      sightNone: 'No line was proved on first contact. Every claim here was earned after practice.',",
    "      sightNone: 'No line proved out on first contact. Every claim here came after practice.',"],
  ["      sightNote: 'Proved on first contact, with no practice in front of it. The same claim on the least evidence this engine accepts — so it is re-tested cold soonest.',",
    "      sightNote: 'Proved on first contact, with no practice in front of it. Same claim, least evidence this engine accepts. Cold re-tests come soonest for these.',"],
  ["      timeUnknown: 'Not measurable: part of this record was restored without its ledger, so the minutes before that are gone. They are shown as unknown, not as zero.',",
    "      timeUnknown: 'Not measurable. Part of this record came back without its ledger, so the minutes before that are gone. The report shows them as unknown, not as zero.',"],
  ["      accuracyUnknown: 'Not measurable on a restored record: the model remembers the questions, but not which of them were answered without help.',",
    "      accuracyUnknown: 'Not measurable on a restored record. The model remembers the questions, but not which ones you answered without help.',"],
  ["        foreign: 'A ledger from another record was discarded',",
    "        foreign: 'We threw away a ledger from another record',"],
  ["        fresh: 'New ground. Everything it stands on is already held.',",
    "        fresh: 'New ground. You already hold everything under it.',"],
  ["        enrich: 'Everything open is held. This one goes deeper instead.',",
    "        enrich: 'You hold everything that is open. This line goes deeper instead.',"],
  ["      start: 'The first line. Nothing is required before it.',",
    "      start: 'The first line. Nothing comes before it.',"],
  ["      locked: 'Something above this line is not held yet, so it will not open.',",
    "      locked: 'This line needs another line first, and you do not hold that one yet.',"],
  ["      prereqRoot: 'Nothing is required before this line.',",
    "      prereqRoot: 'Nothing comes before this line.',"],
  ["      restsUnknown: 'The items behind this claim were not recorded. {of} questions have been answered on this line.',",
    "      restsUnknown: 'This build did not record the items behind the claim. You have answered {of} questions on this line.',"],
  ["      cleanSight: 'None, and none were asked for: this line was proved on first contact. The cold item is the proving run’s own first item and is counted once, in the row below.',",
    "      cleanSight: 'None, and none were needed: this line proved out on first contact. The cold item is the proving run’s own first item, and the row below counts it once.',"],
  ["      posteriorNote: 'Bayesian knowledge tracing, counting unassisted answers only. Needs {need}.',",
    "      posteriorNote: 'How sure the model is that you know this line. The figure counts unassisted answers only, and it needs {need}.',"],
  ["        fast: 'One clean unassisted solve, but taken at band {band}, the gate band itself. The short road asks for fewer items and harder ones.',",
    "        fast: 'One clean solve with no help, taken at difficulty band {band} — the gate band itself. The short road asks for fewer items, and harder ones.',"],
  ["      fast: 'Opened the proving run on one clean unassisted solve at the gate band — fewer items than the long road, each of them harder.',",
    "      fast: 'One clean solve with no help, at the gate band, opened the proving run. Fewer items than the long road, and each one harder.',"],
  ["      band: 'Difficulty',",
    "      band: 'Difficulty band',"],
  ["    'wrong-unwrap-order': 'Unwraps in the order the expression was built',",
    "    'wrong-unwrap-order': 'Unwraps in the order that built the expression',"],
  ["        core: 'Core: this standard is the thing being taught here, and the mastery gate tests it.',",
    "        core: 'Core: this line teaches the standard, and the mastery gate tests it.',"],
  ["        supporting: 'Supporting: exercised inside items aimed at another standard on this line, not gated on its own.',",
    "        supporting: 'Supporting: items aimed at another standard exercise it too. No gate of its own.',"],
  ["        introduced: 'Introduced: a deliberately partial first encounter that a later level completes. Not a claim to have taught it.',",
    "        introduced: 'Introduced: a first, partial encounter on purpose. A later level completes it. Not a claim to have taught it.',"],
  ["        unknown: 'No coverage depth is recorded for this citation.',",
    "        unknown: 'This citation records no coverage depth.',"],
  ["      depthSum: '{n} of {of} citations on this line are core claims — the standard is what is taught here and the gate tests it. The rest are supporting or a first encounter.',",
    "      depthSum: '{n} of {of} citations on this line are core claims: this line teaches the standard, and the gate tests it. The rest support it, or introduce it.',"],
  ["      depthNoCore: 'None of the {of} citations on this line is a core claim: this line supports them or introduces them, and another line carries them. Holding it is not a claim to have taught them.',",
    "      depthNoCore: 'None of the {of} citations here is a core claim. This line supports them, or introduces them. Another line carries them. Holding this line is not a claim to have taught them.',"],

  // ── the kit and the foundry ───────────────────────────────────────────────
  ["    what: 'Drift motes lean toward you, and a hanging cache can be read from twice as far out.',",
    "    what: 'Drift motes lean toward you. You can read a hanging cache from twice as far out.',"],
  ["    what: 'H — raise a permanent tower of rising air, and travel between any two of them. Costs a charter and two hundred and forty motes.',",
    "    what: 'H — raise a waystation: a permanent tower of rising air. Travel between any two of them. Costs one charter and two hundred and forty motes.',"],
  ["  hailNone: 'Where motes are spent',",
    "  hailNone: 'Where motes buy things',"],
  ["    beacon: { what: 'A column of rising air that is still standing tomorrow, planted wherever you choose. Nothing else you can do to this island lasts.' },",
    "    beacon: { what: 'A column of rising air that still stands tomorrow. Plant it where you like. Nothing else you do to this island lasts.' },"],
  ["    station: { what: 'A tower of rising air that is also a place: stand at one, and step out of any other.' },",
    "    station: { what: 'A tower of rising air, and also a place. Stand at one, and step out of any other.' },"],

  // ── the nouns the world teaches itself ────────────────────────────────────
  // These are typed out one character at a time as a subtitle. A sixty-word
  // one is a wall of text that moves. Each is now front-loaded on the verb,
  // cut to short sentences, and names the thing it is teaching.
  ["      rift: 'That ring is a rift. Somewhere in the founding proof is a line — one rule of algebra — that stopped being true, and this is where it comes out. Stand in it, answer what the rig throws on your visor, and the hole in the world closes behind you. Seal enough rifts on the same line and you hold that line for good.',",
    "      rift: 'That ring is a rift. Walk into it and the rig throws a statement onto your visor. Make the statement true, and the hole in the world closes behind you. Every rift is one rule of algebra that stopped holding.',"],
  ["      surge: 'Stand this close to an open rift and it pushes back. Every fifteen seconds an unsealed rift throws a pressure ring out across the ground, and whatever it catches loses motes and its footing. Jump as it reaches you and it passes under your boots. Seal the rift and it stops for ever.',",
    "      surge: 'That ring of light is a rift surge. An open rift throws one out every fifteen seconds. A surge knocks motes loose and takes your footing. Jump as it reaches you. Seal the rift and the surges stop for good.',"],
  ["      mote: 'Cipher motes — loose lattice, lying where the ground bled. Run through them and they are yours. Vault plates and squall flares are cut from that, so they are worth going out of your way for.',",
    "      mote: 'Those are cipher motes: loose lattice, where the ground bled. Run through them and they are yours. The foundry cuts vault plates and flares from motes, so they are worth a detour.',"],
  ["      charged: 'The gold ones grew against an open rift, which is why they pay three times what a pale one does — and why an open rift throws a surge ring out here every fifteen seconds and takes motes back off you. Seal that rift and the surges stop for good. The vein keeps paying.',",
    "      charged: 'The gold ones grew beside an open rift. They pay three times what a pale one pays. That rift also throws a surge out here every fifteen seconds and takes motes back. Seal it and the surges stop. The vein keeps paying.',"],
  ["      husk: 'The dark ones are spent, and the culprit is you. They re-light in about five minutes. You cannot farm a hillside on this shard, cadet — you can only range further out, which I suspect was rather the point.',",
    "      husk: 'Those husks are empty veins, and you emptied them. Each husk lights up again in about five minutes. You cannot farm one hillside here, cadet. You can only range further out — which I suspect was the point.',"],
  ["      anchor: 'A lattice anchor: structure the founders left unfinished. Nothing in your kit reaches one from flat ground, and that is the entire idea. Place a ramp, place another off the top of it, and touch the thing. Sixty motes apiece, and there are three.',",
    "      anchor: 'That is a lattice anchor. Nothing in your kit reaches one from flat ground, and that is the point. Place a ramp. Place another off the top of it. Then touch the anchor. Sixty motes each, and there are three.',"],
  ["      cache: 'A hanging cache. The beam is holding a true statement with one weight taken out of it — walk into the counterweight that puts the beam level and the monolith opens. A hundred and twenty motes, and the air rises there for good afterwards.',",
    "      cache: 'A hanging cache. The beam holds a true statement with one weight missing. Walk into the weight that levels the beam, and the monolith opens. A hundred and twenty motes, and the air rises there for good.',"],
  ["      updraft: 'Rising air, and a great deal of it. Fly into the column and it hands you sixty metres for nothing, which is how you get to the things that were put deliberately out of reach.',",
    "      updraft: 'That column is an updraft. Fly into it and it lifts you sixty metres for free. Use updrafts to reach what looks out of reach.',"],
  ["      verge: 'That curtain is where Shard Nine stops, and I would rather you heard it from me than from the wing. The lands you can see are eight hundred metres of open sky away and the lattice is the only thing that crosses. Hold every line here and it will carry you out there. Until then it is a very long fall with a view.',",
    "      verge: 'That curtain is the verge, where Shard Nine ends. The next lands lie eight hundred metres of open sky away. Only the lattice crosses that gap. Hold all ten lines and it will carry you out there. Until then, the verge is a long fall with a view.',"],

  // `guide.pay.sound` is the first place the objective can say the word
  // "sounding", so it is now the place that says what one is.
  ["      sound: 'Held already. The bank still goes deeper, and it still pays.',",
    "      sound: 'You hold this line already. A sounding takes you back down it, one harder question at a time, and it still pays.',"],
];
