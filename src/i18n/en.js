export default {
  meta: {
    name: 'English',
    code: 'en',
    title: 'ASCENT — The Cipher Worlds',
    sub: 'THE CIPHER WORLDS',
    description: 'ASCENT — The Cipher Worlds. A floating island, a wing, and ten rifts held open by algebra that is not true yet.',
  },

  boot: {
    tip: 'Bonding cadet signature to the Skyren lattice…',
    enter: 'Press any key to begin',
  },

  hud: {
    rank: 'Rank',
    // `«n|…»` inflects the noun for the count in front of it. English needs two
    // forms; see es/pl for languages that need more.
    shards: '«n|one:Cipher shard|other:Cipher shards»',
    mastery: 'Lattice integrity',
    build: 'Build',
    objective: 'Objective',
    language: 'Language',
    /**
     * Where the rig prints the caption "Rank" relative to the rank itself.
     * `after` gives the English noun phrase COPPER RANK; `before` gives the
     * label-then-value reading every other language here wants. This is word
     * order, which belongs to the language, not to the stylesheet.
     */
    capOrder: 'after',
    /** The whole rig, composed as one sentence for a screen reader. */
    readout: 'Lattice integrity {pct} · rank {rank} · {n} {shards}',
  },

  // Audio (src/audio). Additive keys, owned by the audio layer.
  audio: {
    label: 'Sound',
    on: 'Sound on',
    off: 'Sound off',
    mute: 'Turn sound off',
    unmute: 'Turn sound on',
    hint: 'M',
  },

  rank: {
    copper: 'Copper',
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
    sovereign: 'Sovereign',
  },

  build: {
    wall: 'Wall',
    ramp: 'Ramp',
    floor: 'Floor',
    beam: 'Beam',
    placed: 'Axiom set',
    denied: 'No footing there',
    // --- lattice: charge, editing, and what the lattice is for ---
    charge: 'Lattice',
    keySet: 'LMB · set',
    keyClear: 'Q · clear',
    remove: 'Clear',
    removePrompt: 'Q · clear',
    noCharge: 'Lattice charge spent',
    alreadyThere: 'Already set there',
    nothingThere: 'Nothing in the crosshair',
    anchorCall: 'Three anchors hang over the plaza. Nothing on the ground reaches them — so stop standing on the ground.',
    anchorGot: 'Anchor {n} of {total} secured',
    anchorAll: 'All three anchors hold. The lattice has a spine now.',
    // --- the apparatus a piece becomes at a rift ---
    balance: 'Balance',
    balanceLaw: 'Whatever you do to one side, do to the other',
    areaModel: 'Area model',
  },

  // Learning surface. Nothing here reads like a worksheet — the words are
  // in-world, the mathematics is exact.
  learn: {
    riftTitle: 'Rift {n} — {skill}',
    prompt: 'Stabilise the rift',
    submit: 'Set',
    hint: 'Ask Marlow',
    check: 'Check',
    correct: 'Lattice holds.',
    incorrect: 'It slips. Look again.',
    close: 'Close',
    yourAnswer: 'Your answer',
    tapToType: 'Type a value',
    mastered: '{skill} — mastered',
    unlocked: 'New rift line open: {skill}',
    streak: '{n} in a row',
  },

  marlow: {
    greet: "Marlow. Navigational intelligence, lightly damaged, mostly honest. You're the cadet, apparently.",
    firstRift: "That tear in the air is a rift. It's held together by a statement that isn't true yet. Make it true and it closes. Simple. Terrifying. Go on.",
    balance: 'Both sides of that beam carry the same weight. Whatever you do to one, do to the other, or it tips.',
    encourage: "Wrong, but usefully wrong. That's most of science.",
    nearMastery: 'The lattice is nearly whole here. One more and this whole line of sky opens up.',
  },

  skills: {
    'var-meaning': 'Reading a variable',
    'eval-expr': 'Evaluating expressions',
    'order-ops': 'Order of operations',
    'like-terms': 'Combining like terms',
    'distribute': 'The distributive property',
    'one-step-add': 'One-step equations (+ −)',
    'one-step-mul': 'One-step equations (× ÷)',
    'two-step': 'Two-step equations',
    'multi-step': 'Multi-step equations',
    'both-sides': 'Variables on both sides',
  },

  settings: {
    title: 'Settings',
    language: 'Language',
    invertY: 'Invert vertical look',
    sensitivity: 'Look sensitivity',
    reducedMotion: 'Reduced motion',
    close: 'Close',
  },

  controls: {
    move: 'Move',
    look: 'Look',
    jump: 'Jump',
    sprint: 'Sprint',
    dash: 'Dash',
    glide: 'Glide',
    build: 'Build',
    interact: 'Interact',
  },

  // ---------------------------------------------------------------------
  // Rift stabiliser — the learning surface. Additive namespace owned by
  // src/ui/rift.js. Text inside backticks is rendered as strict KaTeX.
  // ---------------------------------------------------------------------
  rift: {
    tag: 'Rift {n}',
    ident: 'Tear {code}',
    pressure: 'Rift pressure',
    streak: '{n} «n|one:clean seal|other:clean seals»',
    disengage: 'Disengage',
    ask: 'Call the echo',
    sealed: 'Lattice sealed',
    shards: 'Shards +{n}',
    trueNow: 'True. It closes.',
    stable: 'Stable',
    critical: 'Critical',
    close: 'Leave the tear',

    // The resolution beat. What the rig stamps on a line it now trusts.
    seal: {
      grip: 'Grip on this line',
      line: 'The line holds',
    },

    kind: {
      check: 'Proving run · {n}/{m}',
      review: 'Re-probe',
      interleave: 'Retrieval',
    },

    help: {
      keypad: 'Charge the value that makes the statement true, then set it.',
      balance: 'Choose a move. The beam applies it to both sides — that is the whole law.',
      sort: 'Send every term to the bay it belongs in.',
      area: 'Cover each part of the field with the area it carries.',
      choice: 'One of these readings is true. The rest are how people get it wrong.',
    },

    keypad: {
      charge: 'Charge',
      set: 'Set',
      back: 'Delete',
      minus: 'Negative',
      over: 'Fraction bar',
      empty: 'Nothing charged',
      narrow: 'Narrow the field',
      narrowed: 'Three readings survive the noise.',
    },

    balance: {
      tray: 'Available moves',
      moves: 'Moves',
      undo: 'Step back',
      both: 'Applied to both sides',
      solved: 'The unknown stands alone.',
      closer: 'Closer. The unknown is coming loose.',
      further: 'Still true — but the unknown is buried deeper now.',
    },

    sort: {
      tray: 'Loose terms',
      vars: '`{v}` terms',
      nums: 'Pure numbers',
      total: 'Bay total',
      empty: 'Empty',
      rejected: 'That bay will not hold it.',
    },

    area: {
      title: 'Cipher field',
      depth: 'Height',
      width: 'Width',
      total: 'Total area',
      none: 'Nothing covered yet',
      slot: 'Set an area',
      tray: 'Area shards',
      rejected: 'That does not cover this part of the field.',
    },

    echo: {
      label: 'Echo',
      cadet: 'Cadet {name} · Arc {n}',
      slip: '{name} stood here once and slipped the same way.',
      trace: '{name} stood here once. This is the trace they left.',
      done: 'That is all {name} left behind.',
      analogue: 'A different tear, the same shape. {name} left the whole solve behind.',
      fades: 'The rest of {name}’s trace has burned away.',
      sealedIt: '{name} sealed it at {answer}. Yours is not the same tear.',
      blank: 'The last line burned away. You finish it.',

      // The trace is not handed over. It is dug out of the tear one layer at a
      // time, and each layer costs another push.
      call: 'Call the echo',
      backToTear: 'Back to the tear',
      backToTrace: 'Back to the trace',
      more: 'Push further',
      spent: 'The trace is spent',
      depth1: 'Whisper',
      depth2: 'First move',
      depth3: 'The shape',
      depth4: 'Whole trace',
      firstMove: 'Only the first move survived the burn. The rest is ash.',
      shape: 'The shape of the whole solve survives. The value at the end does not.',
      cameBack: 'The echo comes back louder.',
      liveOnly: 'The rig has no other tear of this shape on record. This is your own line, read back to you.',
      nudge: {
        keypad: 'Say the statement to yourself before you charge anything. The value you want is the one that makes it true, not the one that sits nearest.',
        balance: 'Something is stuck to the unknown. Undo the outermost thing first, and the beam does the rest.',
        sort: 'Two terms are alike only when the letter part matches exactly. A number is never like a letter.',
        area: 'The factor outside touches every part inside. Every part.',
        choice: 'Test each reading against the statement. Do not pick the one that merely looks familiar.',
      },
    },

    mis: {
      'letter-as-object': 'They read the letter as a thing being counted, not as a number.',
      'add-not-multiply': 'They joined the two quantities by adding, where the situation describes equal groups.',
      'subtract-not-multiply': 'They joined the two quantities by subtracting, in the order the sentence happened to name them.',
      'divide-not-multiply': 'They shared the group out among the groups instead of counting the groups up.',
      'letter-as-position': 'They took the letter’s place in the alphabet for its value.',
      'implicit-mult-missed': 'They set the number beside the letter instead of multiplying by it.',
      'neg-substitution': 'They let the minus sign fall off on the way in.',
      'strict-left-right': 'They worked straight left to right and ignored what binds tighter.',
      'exponent-as-mult': 'They read the power as a multiplication.',
      'neg-base-power': 'They squared the minus sign along with the number.',
      'combine-unlike': 'They folded a plain number into a letter term.',
      'coefficient-sign-lost': 'They collected the term and left its sign behind.',
      'x-and-x-squared': 'They treated a square as the same kind of term.',
      'partial-distribute': 'They multiplied only the first thing inside the bracket.',
      'neg-distribute': 'They carried the minus onto one term and not the other.',
      'same-op-both': 'They repeated the operation instead of undoing it.',
      'one-side-only': 'They touched one side of the balance and not the other.',
      'subtract-coefficient': 'They subtracted the coefficient instead of dividing by it.',
      'div-direction': 'They divided the wrong way round.',
      'wrong-unwrap-order': 'They divided before clearing the constant.',
      'sign-on-constant': 'They added the constant where it needed taking off.',
      'distribute-then-forget': 'They opened the bracket and never collected what fell out.',
      'collect-wrong-side': 'They moved the term across without flipping its sign.',
      'no-solution-confusion': 'They read a false statement as an answer.',
      'arith-slip': 'The method held all the way through. One piece of arithmetic slipped.',
      'sign-slip': 'Every step was right; a minus sign went missing on the way.',
      'partial-rule': 'They stopped one move short and handed in the half-finished value.',
      'off-by-one-row': 'They read the neighbouring row of the log, not the one that burned.',
      'axis-swap': 'They read along the wrong axis: input where the question asked for output.',
      'swapped-roles': 'They built the model with the two quantities in each other’s places.',
      unknown: 'They took a wrong turn at exactly this point.',
    },

    why: {
      letterIsNumber: 'A letter stands for one particular number here.',
      numberAgainstLetter: 'A number written against a letter means multiply.',
      subThenMul: 'Substitute, then multiply.',
      startFrom: 'Start from the expression.',
      replaceWith: 'Replace `{v}` with `{n}`.',
      mulThenAdd: 'Multiply first, then add.',
      mulBindsTighter: 'Multiplication binds tighter than addition.',
      doMulThenAdd: 'Do the multiplication, then the addition.',
      powBeforeMul: 'Exponents come before multiplication.',
      subPowerBack: 'Substitute the power back in.',
      mulThenSub: 'Multiply, then subtract.',
      groupSameVar: 'Group the terms that carry the same variable part.',
      combineBoth: '`{a}` and `{b}` combine; `{c}` and `{d}` combine. A number and a `{v}` term never do.',
      factorOutside: 'The factor outside multiplies everything inside.',
      twoProducts: 'Two separate products — the area of one rectangle cut in two.',
      multiplyEachOut: 'Multiply each one out.',
      beamBalances: 'The beam balances: both sides weigh the same.',
      takeOff: 'Take `{n}` off both sides so the balance holds.',
      addOn: 'Add `{n}` to both sides so the balance holds.',
      whatIsLeft: 'What is left is the value of the unknown.',
      groupsWeigh: '`{a}` groups of `{v}` weigh `{c}`.',
      divideByCoef: 'Divide both sides by the coefficient.',
      oneGroupWeighs: 'One group weighs this much.',
      multipliedThenAdded: 'The unknown was multiplied by `{a}`, then `{b}` was added.',
      multipliedThenTaken: 'The unknown was multiplied by `{a}`, then `{b}` was taken off.',
      unwrapReverse: 'Unwrap in reverse: clear the constant first.',
      thenDivideBy: 'Then divide both sides by `{a}`.',
      expandFirst: 'Expand the bracket first.',
      collectConstants: 'Collect the constants on the left.',
      nowTwoStep: 'Now it is a two-step equation: clear the constant.',
      divideBy: 'Divide both sides by `{a}`.',
      bothSidesBalance: 'The unknown appears on both sides of the balance.',
      removeCrossing: 'Remove `{term}` from both sides — its sign flips as it crosses.',
      undoConstant: 'Undo the constant.',
    },
  },

  // ---------------------------------------------------------------------
  // The story arc. Namespace added only by src/meta — additive keys.
  // Marlow is dry, warm, and lightly wounded; never a mascot, never a
  // cheerleader. She was a cadet here once, and it cost her.
  // ---------------------------------------------------------------------
  story: {
    hud: {
      act: 'Chapter {n}',
      question: 'Open question',
      dossier: 'Cadet dossier',
      hint: 'J',
      close: 'Close',
      skip: 'Skip',
      continue: 'Continue',
      toNext: '{rank} · {n} to go',
      summit: 'Summit of the order',
      // The fast clock: rifts sealed on this shard, which is what turns the
      // chapter. It ticks on every correct answer, so it is the number on the
      // card that is allowed to be large.
      sealed: 'Rifts sealed',
      toChapter: '«n|one:# more|other:# more» to Chapter {ch}',
      sealsAll: 'Every chapter open',
      sealsAt: '«n|one:# rift sealed|other:# rifts sealed»',
      plusSeal: '+1',
    },

    place: {
      approach: 'Making planetfall over',
      lattice: 'The Skyren Lattice',
      shard: 'Shard Nine · cadet landing',
      when: 'First light · fourth day of the tearing',
    },

    marlow: {
      name: 'Marlow',
      role: 'Navigational intelligence · 61% recovered',
    },

    open: {
      l1: 'The Skyren Lattice, Shard Nine. Gravity nominal, air breathable, sky mildly on fire. Welcome home, in the loosest possible sense of all three words.',
      l2: 'I am Marlow. Navigational intelligence, lightly damaged, mostly honest. And you are the cadet. I had pictured someone with more equipment.',
      l3: 'Everything under your boots is a conclusion. Nine thousand shards of world, each one held up by a single enormous argument the founders wrote down and nobody has read since. Where the argument holds, there is ground.',
      l4: 'Where it fails, there is that. A rift: a statement the lattice can no longer justify, held open in the air until somebody makes it true.',
      l5: 'Which brings me to the part I would rather not say out loud. Shard Nine has stood for nine hundred years. So what, exactly, began pulling it apart four days ago?',
    },

    ch1: {
      title: 'The Standing Question',
      quest: 'Shard Nine has held for nine centuries. Find out what changed four days ago.',
    },
    ch2: {
      title: 'The cadets before you',
      quest: 'Hundreds stood exactly where you are. Find out where they stopped.',
      b1: 'Three rifts sealed. The lattice has noticed you — you would be surprised how many cadets it never notices at all.',
      b2: 'While you worked I read the traces the rig digs out of the tears. They are not simulations. Cadets stood exactly where you are standing. Hundreds of them.',
      b3: 'All capable. All stopped. No record says why, and that is the kind of silence somebody is paying for.',
    },
    ch3: {
      title: 'The ninth lemma',
      quest: 'One step of the founding proof was never finished. Climb high enough to finish it.',
      b1: 'Seven sealed statements. That is weight enough to requisition the founding proof, so I requisitioned it for you. Four million steps. Nine hundred years. Watertight the whole way down — except at step nine.',
      b2: 'Step nine is not proved. It is assumed. One word in the margin, written in a hurry, in somebody’s own hand: suppose.',
      b3: 'Nine thousand worlds stand on a step nobody finished. The rifts are not damage, cadet. They are step nine coming back to ask.',
    },
    ch4: {
      title: 'The hand in the margin',
      quest: 'Finish what Marlow started.',
      b1: 'Sixteen rifts closed on Shard Nine. There is something I have been carefully not saying for four days, and sixteen is where I stop being careful.',
      b2: 'The handwriting in the margin is mine. I was the cadet on Shard Nine. The shard was falling, I had eleven minutes, and an assumed step holds a world up exactly as well as a proved one — right up until it does not.',
      b3: 'I have walked nine hundred years of cadets to this page. Every one of them was brilliant. Every one stopped on the same line. I would very much like to be wrong about you.',
    },
    ch5: {
      title: 'Signed',
      quest: 'Write the end of step nine, and a name underneath it.',
      b1: 'Twenty-eight rifts. Somewhere in that count the lattice stopped treating you as weather and started treating you as an author.',
      b2: 'Finish the rest. A sovereign may add a line to the proof, and whatever that line says, exists. Choose your words.',
    },
    coda: {
      title: 'Nine hundred years of quiet',
      quest: 'The proof is closed. Go and see what it made.',
      c1: 'It is writing itself in. Step nine now reads: proved — and underneath, in the space kept for the founder’s name, stands a cadet’s.',
      c2: 'Nine thousand shards have just stopped arguing. Somewhere past the cloud line the sky has gone quiet for the first time in nine centuries.',
      c3: 'I was wrong about you. Please have that entered into the record, along with the fact that I have never enjoyed anything more.',
    },

    cite: {
      copper: 'You can hold a statement true. That is the whole qualification, and few people meet it.',
      bronze: 'Two lines held. The lattice has begun steering its storms around you instead of through you.',
      silver: 'Half the proof in your hand. Silver may open the founding text and read what it cost.',
      gold: 'Gold crosses between shards without an escort. Very little up here is still dangerous to you.',
      sovereign: 'A sovereign may add a line to the proof. Whatever that line says, exists.',
    },

    rite: {
      ascended: 'Ascended',
      arrow: '{from} → {to}',
      standing: 'Standing',
    },

    dossier: {
      title: 'Cadet dossier',
      sub: 'Skyren Lattice · Shard Nine',
      ladder: 'The climb',
      standing: 'What the lattice has seen',
      log: 'Field log',
      lines: 'Ten lines',
      question: 'Open question',
      locked: 'Sealed until {rank}',
      lockedAt: 'Opens at «n|one:# sealed rift|other:# sealed rifts»',
      tally: 'Rifts sealed on this shard',
      lockedCoda: 'Sealed until the proof closes',
      lockedShort: 'Sealed',
      here: 'You are here · {have} of {need}',
      costs: 'Opens at {n}',
      outOf: 'of {n} the shard can award',
      current: 'You are here',
      held: 'Held',
      openState: 'Open',
      shut: 'Not yours yet',
      integrity: 'Lattice integrity',
      close: 'Close the dossier',
      footer: 'Nine thousand shards. One argument. One unfinished step.',
    },

    // The four terms standing is made of, and what each is actually worth.
    stand: {
      seals: 'Statements sealed',
      sealsNote: 'Three for a clean seal, two for an assisted one — and it stops at twenty-six. After that, easy rifts pay nothing towards rank.',
      proving: 'Proving runs survived',
      provingNote: 'Three for every item held inside a proving run: unassisted, unfamiliar, high band.',
      lattice: 'Lattice opened',
      latticeNote: 'Two for every line the lattice has opened beneath you. Won by prerequisites, not by answering.',
      lines: 'Lines held',
      linesNote: 'Nine apiece, and no ceiling. Above silver this is very nearly the only thing left.',
    },

    standard: {
      shard: 'Shard Nine',
      motto: 'What holds here was held by a hand.',
      tally: '«n|one:# rift sealed by this hand|other:# rifts sealed by this hand»',
    },

    voice: {
      firstRift: 'That tear ahead of you is a rift. Walk into it and the rig throws the statement onto your visor. Press E — or whatever your hands prefer.',
      firstSeal: 'It held. That statement is now a permanent feature of reality, and your hands did it.',
      standard: 'The obelisk in the plaza is the Standard. It keeps the only honest record of you there is — five bands, one per rank, and a ring of light sitting at exactly your standing. It just moved. It will keep moving.',
      capped: 'Sealed, but the ledger has stopped paying for those. You have taken everything an easy rift can give. Standing comes out of held lines now, and held lines cost real work.',
      wrong: [
        'Wrong, but usefully wrong. That is most of science.',
        'No. The lattice is a pedant. It wants the true value, not the one next to it.',
        'That would be a lovely answer to a slightly different question.',
        'The tear did not so much as flicker. Look again at what is stuck to the unknown.',
        'Nobody seals one of those first time. Two cadets in nine centuries claimed otherwise. Both were lying.',
        'Steady. That statement is not trying to trick you; it is simply not finished.',
      ],
      right: [
        'Sealed. The sky over your head is fractionally less of a lie.',
        'It holds. Logged unassisted, and unassisted is the only kind the lattice counts.',
        'Clean. Somewhere a step that carries weight has just stopped complaining.',
        'That is how it is done. Quietly, and then the world stops shaking.',
        'Good. The lattice does not say thank you. I will do it on its behalf.',
      ],
      streak: 'Four in a row. The rift is starting to take it personally.',
      // Said under the rite, after the letterbox has cleared.
      rank: [
        'The Standard has your name cut at {rank}. It is stone; it does not flatter and it does not round up.',
        '{rank}. The order has revised its estimate of you upward, which the order hates doing.',
        'Logged: {rank}. Somewhere a very old ledger has an entry in it that was not there this morning.',
        '{rank}, and earned in the only currency the lattice recognises — lines that hold when nobody is helping.',
      ],
      nearMastery: 'The lattice is nearly whole along this line. One more and a quarter of the sky opens.',
      // One clean answer from a line closing. Said once per line, ever.
      close: [
        'One clean answer from holding {skill} for good. Unassisted, or the lattice does not count it — I did not write that rule, I only failed it.',
        '{skill} is one honest solve from being yours permanently. Nine points of standing sit behind that door.',
        'You are a single unassisted answer from closing {skill}. Take your time; the line has waited nine hundred years.',
      ],
      // A line closed. {skill} names it.
      held: [
        '{skill} is held. That line will not open again — not for weather, not for time, not for me.',
        '{skill}, closed. Nine points of standing, and every hedge the rig was keeping about you just went away at once.',
        'The lattice has stopped arguing about {skill}. That is a piece of sky that stays up whatever either of us does next.',
      ],
      lineHeld: [
        'Line held. Nine to go, and all of them are easier than the first.',
        'Another line closed. The rig has stopped hedging about you.',
        'That line will not open again. Not for weather, not for time.',
      ],
      fall: 'There is air under the world too. Considerably less useful.',
      idle: 'Take your time. The rift is not going anywhere. That is precisely the problem.',
      returning: 'Back again. Statistically that is the hardest part, so congratulations to statistics.',
    },
  },
};
