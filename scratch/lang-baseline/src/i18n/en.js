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
    shards: '«n|one:Cipher mote|other:Cipher motes»',
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
    placed: 'Placed',
    denied: 'No footing there',
    // --- lattice: charge, editing, and what the lattice is for ---
    charge: 'Build charge',
    keySet: 'LMB · place',
    keyClear: 'Q · clear',
    remove: 'Clear',
    removePrompt: 'Q · clear',
    noCharge: 'Build charge spent',
    alreadyThere: 'Already built there',
    nothingThere: 'Nothing in the crosshair',
    latticeFull: 'Lattice at capacity — clear a piece first',
    anchorCall: 'Three anchors hang over the plaza. Nothing on the ground reaches them — so stop standing on the ground.',
    anchorGot: 'Anchor {n} of {total} secured',
    anchorAll: 'All three anchors hold. The lattice has a spine now.',
    // --- the apparatus a piece becomes at a rift ---
    balance: 'Balance',
    balanceLaw: 'Whatever you do to one side, do to the other',
    areaModel: 'Area model',
    // --- the kit: a piece that is bought rather than given ---
    vault: 'Vault plate',
    noShards: 'Not enough motes for that piece',
    fixed: 'That is not yours to unmake',
    // --- first contact: the hand is stowed until it is drawn (src/build) ---
    handOut: 'Build hand ready',
    handStowed: 'Build hand stowed — pick a piece first, 1 to 4',
  },

  // Learning surface. Nothing here reads like a worksheet — the words are
  // in-world, the mathematics is exact.
  learn: {
    riftTitle: 'Rift {n} — {skill}',
    prompt: 'Stabilise the rift',
    submit: 'Seal',
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
    firstRift: "That ring of torn air is a rift. It's held together by a statement that isn't true yet. Make it true and it closes. Simple. Terrifying. Go on.",
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
    // Level 2 (content/graph/algebra1-l2.json). Additive: a unit that is not
    // loaded costs three strings and changes nothing on screen.
    'bracket-both-sides': 'Brackets on both sides',
    'fraction-solve': 'Equations with a fraction',
    'rule-from-table': 'Rules from a table',
  },

  // The course manifest (content/courses.json) names its courses and units
  // through these keys, so a new course is content and not code.
  course: {
    algebra1: { title: 'Algebra I' },
    algebra2: { title: 'Algebra II' },
    geometry: { title: 'Geometry' },
    trigonometry: { title: 'Trigonometry' },
  },
  unit: {
    'algebra1-l1': { title: 'Level 1 — The Language of Balance' },
    'algebra1-l2': { title: 'Level 2 — Structure and Rate' },
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
    recover: 'Recover',
  },

  // ---------------------------------------------------------------------
  // First contact — the controls card, and the way out of a hole.
  // Additive namespace owned by src/player (controls.js, controller.js).
  // A binding is cut into keycaps on the interpunct, so a translator owns
  // both the words and how many caps there are.
  // ---------------------------------------------------------------------
  firstrun: {
    title: 'Controls',
    got: 'Got it',
    recovered: 'Back on open ground',
    stuck: {
      title: 'Wedged',
      body: 'Something has hold of you. Pull yourself back out onto open ground — nothing here ever needs a reload.',
      act: 'Recover',
    },
    bind: {
      kbm: {
        move: 'W · A · S · D',
        look: 'Mouse',
        jump: 'Space',
        glide: 'Hold space',
        interact: 'E',
        build: '1–4 · Left click',
        dash: 'C · Left ctrl',
        recover: 'R',
      },
      pad: {
        move: 'Left stick',
        look: 'Right stick',
        jump: 'A',
        glide: 'Y',
        interact: 'X',
        build: 'LB · RT',
        dash: 'B',
        recover: 'Back',
      },
      touch: {
        move: 'Left thumb',
        look: 'Drag right',
        jump: 'Jump',
        glide: 'Glide',
        interact: 'Interact',
        build: 'Rack · Place',
        dash: 'Dash',
        recover: 'Recover',
      },
    },
  },

  // ---------------------------------------------------------------------
  // The menu — pause, help and settings. Additive namespace owned by
  // src/ui/menu.js. A binding is cut into keycaps on the interpunct, the same
  // contract the controls card has with this bundle, so a translator owns both
  // the words and how many caps there are.
  // ---------------------------------------------------------------------
  menu: {
    open: 'Menu',
    title: 'Standing by',
    sub: 'Nothing out there moves until you go back to it.',
    resume: 'Back to the run',
    controls: 'Controls',
    screens: 'Screens',
    settings: 'Settings',
    sens: 'Look speed',
    invert: 'Invert look',
    on: 'On',
    off: 'Off',
    now: 'What to do out there',
    nowBody: 'Walk into one of the glowing rings and press {key}. The rig throws the statement onto your visor — make it true and the rift closes for good.',
    screen: {
      progress: 'Progress report',
      dossier: 'Cadet dossier',
      controls: 'Controls card',
      menu: 'This menu',
    },
    bind: {
      kbm: {
        sprint: 'Shift',
        progress: 'P',
        dossier: 'J',
        controls: '?',
        menu: 'Esc · F1',
      },
      pad: { sprint: 'L3 · LT' },
      touch: { sprint: 'Push the stick' },
    },
  },

  // ---------------------------------------------------------------------
  // Rift stabiliser — the learning surface. Additive namespace owned by
  // src/ui/rift.js. Text inside backticks is rendered as strict KaTeX.
  // ---------------------------------------------------------------------
  rift: {
    tag: 'Rift {n}',
    ident: 'Rift {code}',
    pressure: 'Still open',
    streak: '{n} «n|one:clean seal|other:clean seals»',
    disengage: 'Disengage',
    ask: 'Call the echo',
    sealed: 'Lattice sealed',
    shards: 'Motes +{n}',
    trueNow: 'True. It closes.',
    stable: 'Stable',
    critical: 'Critical',
    close: 'Leave the rift',

    // The resolution beat. What the rig stamps on a line it now trusts.
    seal: {
      grip: 'Grip on this line',
      line: 'The line holds',
    },

    kind: {
      check: 'Proving run · {n}/{m}',
      // pedagogy: the first item a new skill asks, before it teaches anything.
      // Answer it cold and the proving run has already begun.
      probe: 'First sight',
      review: 'Coming back to it',
      interleave: 'From memory',
      // endgame: a rung of a sounding — the top of the bank, on a line already
      // held, one miss from the bottom. It proves nothing and pays well.
      deep: 'Sounding · {n}',
    },

    help: {
      keypad: 'Type the value that makes the statement true, then seal the rift.',
      balance: 'Choose a move. The beam applies it to both sides — that is the whole law.',
      sort: 'Send every term to the bay it belongs in.',
      area: 'Cover each part of the field with the area it carries.',
      choice: 'One of these readings is true. The rest are how people get it wrong.',
    },

    keypad: {
      charge: 'Your answer',
      set: 'Seal',
      back: 'Delete',
      minus: 'Negative',
      over: 'Fraction bar',
      empty: 'Nothing entered',
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
      slot: 'Drop an area here',
      tray: 'Field pieces',
      rejected: 'That does not cover this part of the field.',
    },

    echo: {
      label: 'Echo',
      cadet: 'Cadet {name} · Arc {n}',
      slip: '{name} stood here once and slipped the same way.',
      trace: '{name} stood here once. This is the trace they left.',
      done: 'That is all {name} left behind.',
      analogue: 'A different rift, the same shape. {name} left the whole solve behind.',
      fades: 'The rest of {name}’s trace has burned away.',
      sealedIt: '{name} sealed it at {answer}. Yours is not the same rift.',
      blank: 'The last line burned away. You finish it.',

      // The trace is not handed over. It is dug out of the rift one layer at a
      // time, and each layer costs another push.
      call: 'Call the echo',
      backToTear: 'Back to the rift',
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
      liveOnly: 'The rig has no other rift of this shape on record. This is your own line, read back to you.',
      nudge: {
        keypad: 'Say the statement to yourself before you type anything. The value you want is the one that makes it true, not the one that sits nearest.',
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
      sealed: 'Rifts sealed in all',
      toChapter: '«n|one:# more|other:# more» to Chapter {ch}',
      // The last two chapters also cost nights held (src/meta/shard.js). When
      // the tears are in and the nights are not, the card says which one is
      // missing — a full bar that does nothing reads as a bug.
      chapterNight: '«n|one:# night held|other:# nights held» to Chapter {ch}',
      nextNight: '{rank} · «n|one:# night held|other:# nights held»',
      sealsAll: 'Every chapter open',
      sealsAt: '«n|one:# rift sealed in all|other:# rifts sealed in all»',
      plusSeal: '+1',
    },

    /* ---------------------------------------------------------------------
       THE THIRD CLOCK (src/meta/days.js).

       Nights held and days returned. A night held is a line the learner still
       knew after a real break — five hours or more — and it is the only number
       in the game a long sitting cannot move. These are the lines that make it
       legible, and the dispatches that give the arc something to say on the
       fourth morning as well as the first afternoon.

       INSTRUCTIONAL lines (`night`) define the term the first time they use
       it, in short sentences, front-loaded. FLAVOUR lines (`day`) are Marlow.
       --------------------------------------------------------------------- */
    night: {
      held: 'Welcome back. You have «n|one:# night held|other:# nights held». A night held is a line you still knew after you walked away.',
      due: 'Welcome back. «n|one:# line has|other:# lines have» come due. The lattice wants to check what you kept. Then we work.',
      none: 'Welcome back. You were away «n|one:# day|other:# days». Nothing has fallen due. Pick a rift and go.',
    },
    day: {
      d2: {
        a: 'Second day. You came back. Most cadets in the record did not, and the record is not kind about it.',
        b: 'The shard noticed before I did. Something under the plaza settled a centimetre in the night. That is the good kind of settling.',
      },
      d3: {
        a: 'Third day. I have started keeping your times. You did not ask me to, and I am not going to stop.',
        b: 'Two days ago you could not hold a line overnight. Now you can. Let the record show I said nothing encouraging at the time.',
      },
      d5: {
        a: 'Fifth day. I went back through the founding text last night, looking for the margin.',
        b: 'It is still my handwriting. Nine hundred years, and the shame has kept remarkably well.',
      },
      d8: {
        a: 'Eighth day. Traffic through the lattice has begun routing across Shard Nine again. It used to route around us.',
        b: 'I am not saying the shard trusts you. I am saying it has stopped taking precautions.',
      },
      d13: {
        a: 'Thirteenth day. A survey drone came through this morning and did not log us as a hazard. First time in nine centuries.',
        b: 'Somebody at the far end of the lattice is going to notice that. Let them.',
      },
      d21: {
        a: 'Twenty-first day. Whatever else is true, this shard is standing because somebody kept coming back to it.',
        b: 'I wrote the word in the margin. You are finishing the sentence. I can live with that division of labour.',
      },
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
      b2: 'While you worked I read the traces the rig digs out of the rifts. They are not simulations. Cadets stood exactly where you are standing. Hundreds of them.',
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

    // ---------------------------------------------------------------------
    // THE WATCH — the card once the proof is closed. Additive keys owned by
    // src/meta. It replaces the two rows that had run out of things to count
    // with the two that never do: what falls due tonight, and how many nights
    // this cadet has held.
    // ---------------------------------------------------------------------
    watch: {
      title: 'The standing watch',
      quest: 'The proof holds while somebody carries it. Come back and it is still yours.',
      due: 'Lines fallen due',
      stand: 'Stand the watch',
      next: 'The shard holds · next {when}',
      nights: '«n|one:# night held|other:# nights held»',
      sounding: 'Deepest sounding · {n}',
      soundingNone: 'Sound the lattice',
      whenMin: 'in «n|one:# minute|other:# minutes»',
      whenHour: 'in «n|one:# hour|other:# hours»',
      whenDay: 'in «n|one:# day|other:# days»',
      whenSoon: 'shortly',
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
      seals: 'From sealed rifts',
      sealsNote: 'Three for a clean seal, two for an assisted one — and it stops at twenty-six. After that, easy rifts pay nothing towards rank.',
      proving: 'From proving runs',
      provingNote: 'Three for every item held inside a proving run: unassisted, unfamiliar, high band.',
      lattice: 'From lines opened',
      latticeNote: 'Two for every line the lattice has opened beneath you. Won by prerequisites, not by answering.',
      lines: 'From lines held',
      linesNote: 'Nine apiece, and no ceiling. Above silver this is very nearly the only thing left.',
    },

    standard: {
      shard: 'Shard Nine',
      motto: 'What holds here was held by a hand.',
      tally: '«n|one:# rift sealed by this hand|other:# rifts sealed by this hand»',
    },

    voice: {
      firstRift: 'That ring of torn air ahead of you is a rift. Walk up to it and press E — or whatever your hands prefer — and the rig throws the statement onto your visor.',
      firstSeal: 'It held. That statement is now a permanent feature of reality, and your hands did it.',
      standard: 'The obelisk in the plaza is the Standard. It keeps the only honest record of you there is — five bands, one per rank, and a ring of light sitting at exactly your standing. It just moved. It will keep moving.',
      capped: 'Sealed, but the ledger has stopped paying for those. You have taken everything an easy rift can give. Standing comes out of held lines now, and held lines cost real work.',
      wrong: [
        'Wrong, but usefully wrong. That is most of science.',
        'No. The lattice is a pedant. It wants the true value, not the one next to it.',
        'That would be a lovely answer to a slightly different question.',
        'The rift did not so much as flicker. Look again at what is stuck to the unknown.',
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

    // -----------------------------------------------------------------------
    // Marlow, by register. See `src/meta/voice.js`.
    //
    // The channel used to hold one set of ambient lines written for a cadet in
    // their first ten minutes, and it was still playing them at seal one
    // hundred and thirty — including the sentence that explains what a rift is.
    // Four registers now, chosen from what the cadet has actually done:
    //
    //   green    nothing sealed. The only register allowed to explain anything.
    //   working  the cadet can work. Reporting and needling, no orientation.
    //   veteran  past the last chapter beat. A colleague, with shared history.
    //   master   past the record. Marlow is outranked, and knows it.
    //
    // A register is earned and never handed back, so no line below `working`
    // can ever be reached again by somebody who has passed it.
    // -----------------------------------------------------------------------
    v: {
      wrong: {
        working: [
          'No. Somewhere in there you did the right thing to the wrong side.',
          'The lattice declines. It has been declining things since before your language existed; do not take it personally.',
          'Missed. You have sealed enough of these that I am fairly sure you know the move and simply did not make it.',
          'Not that. Read the line you wrote before that one — the error is usually one floor up.',
          'No, and interestingly no. That is a mistake with a shape to it, which is more use to me than a right answer.',
        ],
        veteran: [
          'Wrong. From you that is now data, so thank you — I mean that with only mild sarcasm.',
          'No. Nine hundred years of cadets missed that one too, if it helps. It never helped them either.',
          'That slipped. You have closed too many of these for me to insult you by explaining it, so I will simply wait.',
          'Missed. I have watched you not miss harder ones today, which tells me it is late, not that it is difficult.',
          'The rift held. Rare event, these days. Go again before it gets ideas.',
        ],
        master: [
          'Wrong — and I had to check. That is not a sentence I have said to a cadet before.',
          'No. Somewhere a very old ledger has just noted that you are, after everything, a person.',
          'Missed. At your count that is roughly a rounding error, though I would not put that in the record.',
          'That one got you. It gets everyone once; you simply took longer than everyone to get to it.',
          'No. I could tell you where, but you will find it faster than I can say it. You usually do.',
        ],
      },
      right: {
        working: [
          'Sealed. That is the rhythm — the shard can hear it now.',
          'Holds. You are getting quick enough that I have started rounding down how long I expect you to take.',
          'Clean. The rig logged it before I did, and the rig is not easily impressed.',
          'Good. Another statement that will still be true after both of us have stopped.',
          'Sealed, unassisted, and filed. That last part is the part that counts.',
        ],
        veteran: [
          'Sealed. I have stopped narrating these individually; you would only find it patronising.',
          'Holds. Somewhere under us a step that has been complaining for nine centuries has gone quiet.',
          'Clean. The lattice has begun assuming you will close what you open, which is the nearest thing it has to trust.',
          'Done. The shard is mending faster than it is tearing, and that has never been the direction of travel before.',
          'Sealed. I would say well done, but you have heard it from me often enough to know what it costs me.',
        ],
        master: [
          'Sealed. The record has run out of comparisons and is now simply writing down what you do.',
          'Holds. I have no useful commentary left; you are past the part of the map I have notes on.',
          'Clean. Nine hundred years of cadets, and the sky over Shard Nine has never been this quiet on a working morning.',
          'Sealed. You are doing it faster than I can find something dry to say about it, and I resent that slightly.',
          'Done. Somewhere in the founding text there is a margin with room in it, and I have started thinking about your handwriting.',
        ],
      },
      // Three consecutive misses. Not a scold and not a hug: a signal, named.
      slump: {
        green: [
          'Three in a row. That is not a verdict, it is a Tuesday. Slow down and read the whole line before you touch it.',
          'Stop. Breathe. The rift has waited nine hundred years; it can wait while you look properly.',
          'Three misses. Everybody’s first hour looks like this. Mine looked worse, and I had a manual.',
        ],
        working: [
          'Three. Something in this shape is fighting you specifically, and that is worth more than three easy seals.',
          'Put your hand down for a second. You are answering faster than you are reading, and those are not the same activity.',
          'Three misses on the trot. Not a collapse. A signal — and the rig is already re-aiming.',
        ],
        veteran: [
          'Three. From you that is a message, and the message is that this line is genuinely hard, not that you are careless.',
          'That is three. I am going to say nothing encouraging, because you would smell it. Look at the second step.',
          'Three in a row, and I have checked my own arithmetic twice. This one is difficult. Take it seriously and it will fold.',
        ],
        master: [
          'Three consecutive. I have kept records for nine centuries and I have nothing comparable for you, so let us simply call it interesting.',
          'Three. Whatever this shape is, it is the last thing on this shard that still argues with you. I would rather like to watch you finish it.',
          'Three misses. If you tell me it is fatigue I will believe you, and I will also note that you have been at this longer than most cadets lasted.',
        ],
      },
      // The first seal after a slump. The beat the old channel had no line for.
      recover: {
        green: [
          'There. That is what it looks like when the reading and the answering happen in the right order.',
          'Sealed. Whatever you just changed about the way you were looking at it, keep doing that.',
        ],
        working: [
          'Back. That is the useful part of a bad run — you come out of it holding something you did not have going in.',
          'Sealed. The run broke and you did not. Noted, and not for the first time.',
        ],
        veteran: [
          'There it is. You have done that four times today; I have stopped being surprised and started being interested.',
          'Recovered. Most of the cadets I walked through here never got a fourth attempt out of themselves.',
        ],
        master: [
          'And it folds. That is the part nobody writes down about people like you — not that you never slip, but that the slip is never allowed to keep anything.',
          'Sealed. Whatever that was, it lasted three questions. I have known it last three generations.',
        ],
      },
      idle: {
        green: [
          'Take your time. The rift is not going anywhere. That is precisely the problem.',
          'No rush. Though I will point out that the sky is on fire, in a slow, dignified, nine-hundred-year sort of way.',
          'Still there. So am I, obviously. I do not have anywhere else to be, which is a longer story than you want this early.',
        ],
        working: [
          'Whenever you are ready. I have a nine-hundred-year backlog and nothing in it is urgent in the way this is.',
          'You have gone quiet. Not a complaint — quiet is where most of the good answers on this shard came from.',
          'The shard is holding. Take the minute. It is the only currency here I cannot audit.',
        ],
        veteran: [
          'Standing still suits you better than it suited any of them. They all kept moving. It did not help.',
          'I will not fill the silence. You have earned a horizon; look at it.',
          'Nothing from me. Though if you are waiting for the sky to speak first, I should warn you it has never once gone first.',
        ],
        master: [
          'You are allowed to stop. I have watched people who could not, and it is not a better way to be.',
          'Say the word and I will find you something difficult. Otherwise I am content to stand here being obsolete.',
          'This is the part I did not expect to reach — a cadet on Shard Nine with nothing pressing to do. Take it slowly.',
        ],
      },
      streak: {
        green: [
          'Four in a row. The rift is starting to take it personally.',
          'Four straight. Whatever you are doing with your eyes before you answer, keep doing it.',
          'Four. The rig has just quietly revised what it expects of you.',
        ],
        working: [
          'Four unbroken. That is not luck any more; luck does not have a rhythm.',
          'Another run. The shard has stopped putting the easy ones in front of you, and you have not noticed, which is the point.',
          'Four clean. Somewhere a scheduler that was hedging about you has stopped hedging.',
        ],
        veteran: [
          'Another run without a slip. I have stopped counting out loud; it was becoming a distraction.',
          'Unbroken again. Whatever the shard was hoping to defend, it has stopped hoping.',
          'There are cadets in the record who never had one of these. You have had several this morning.',
        ],
        master: [
          'Another clean run. I am going to stop announcing them; you can hear the sky change pitch as well as I can.',
          'Uninterrupted. At some point a streak stops being a streak and becomes simply how the shard works now.',
          'Still running. The lattice has begun writing your results in ink.',
        ],
      },
      fall: {
        green: [
          'There is air under the world too. Considerably less useful.',
          'Down is a direction, not a plan. The glider on your back is for exactly this.',
          'You fell. Everybody falls — the shard is nine thousand pieces with gaps between them, and the gaps are load-bearing.',
        ],
        working: [
          'Off the edge again. At least you are doing it at speed now.',
          'The ground moved. It does that. It is a proof, not a floor plan.',
          'Falling. I would panic on your behalf, but you have done this often enough that we both know how it ends.',
        ],
        veteran: [
          'Off the edge. From you I am going to assume that was navigation.',
          'Down we go. Nine hundred years, and nobody has improved on the technique of simply not being there.',
          'You dropped. The record will show a controlled descent, because I write the record.',
        ],
        master: [
          'Falling. Somewhere a very old ledger is delighted.',
          'You went over. I have decided to log it as reconnaissance.',
          'Down. I would say be careful, but the shard has more to fear from you than the reverse.',
        ],
      },
      returning: {
        green: [
          'Back again. Statistically that is the hardest part, so congratulations to statistics.',
          'You came back. Most of what goes wrong here goes wrong in the gap between one day and the next, and you have just closed one.',
          'Returned. The rifts did not move. I checked twice, which tells you something about my week.',
        ],
        working: [
          'Back. The shard is where you left it, which on Shard Nine is not a given.',
          'There you are. I kept the ledger open. Nothing in it has cooled.',
          'You returned. The second day is where the record thins out — you are already past the part most of them are missing.',
        ],
        veteran: [
          'Back again, and the lattice noticed before I did. It has started listening for you.',
          'You came back. I stopped assuming that somewhere around cadet four hundred. I am delighted to be wrong about it.',
          'Returned. Everything you held yesterday is still held. That is the entire point of holding it.',
        ],
        master: [
          'Back. At this point I should tell you the shard does not need you today, and I am not going to, because it does.',
          'You came back. Nine hundred years of people who could have and did not, and here you are, on an ordinary morning.',
          'Returned, again. I have run out of ways to say that this is the rare part.',
        ],
      },
      close: {
        working: [
          'One clean answer and {skill} is yours for good. Unassisted only — the lattice does not accept help as evidence.',
          '{skill} is one honest solve from closing. You know the shape of this one. Go and take it.',
          'One unassisted answer stands between you and {skill}. Nine points of standing sit behind it, and none of them are free.',
        ],
        veteran: [
          '{skill} is one answer from closing. That would be another line the shard never gets back.',
          'One clean solve and {skill} is held. You have done this often enough that I am going to stop pretending it is a coin toss.',
          '{skill}, one honest answer out. I will be quiet now; you close better when I am not talking.',
        ],
        master: [
          '{skill} is one answer from being yours. There are not many left that are not.',
          'One clean solve on {skill} and the list of things on this shard you do not own gets shorter than my patience.',
          '{skill}, one answer out. I have stopped reciting the rule about unassisted evidence. You wrote most of the evidence.',
        ],
      },
      held: {
        working: [
          '{skill} is held. That line does not reopen — not for weather, not for time, not for me.',
          '{skill}, closed. Nine points of standing, and one fewer thing on this shard that can surprise you.',
          'The lattice has stopped arguing about {skill}. Whatever else happens today, that piece of sky stays up.',
        ],
        veteran: [
          '{skill}, held. That is another line the cadets before you reached and did not close.',
          '{skill} is closed. The founding text has fewer excuses in it than it did this morning, and I intend to enjoy that.',
          '{skill}, held permanently. Somewhere above the cloud line, something that was sagging has stopped sagging.',
        ],
        master: [
          '{skill}, held. There is very little of this shard left that is not yours, and I am not certain what I shall do with myself.',
          '{skill} closed. The record used to compare cadets with each other. Since you, it compares them with you.',
          '{skill} is held. Nine hundred years, and the shard has finally stopped being a question.',
        ],
      },
      capped: {
        working: [
          'Sealed, but the ledger has stopped paying for those. You have taken everything an easy rift can give. Standing comes out of held lines now.',
          'That counted for the shard and nothing for your rank. The seal term is spent; the only currency left is a line that holds.',
        ],
        veteran: [
          'Sealed, and worth exactly nothing to your standing. You passed that ceiling a long way back. Close a line if you want the ladder to move.',
          'Counted for the sky, not for the ledger. At your count the only thing that still buys rank is a line held outright.',
        ],
        master: [
          'Sealed, and unpaid, as everything at this altitude is. You stopped doing this for the ledger somewhere around your fortieth.',
          'The ledger has nothing left to give you. You have been sealing these for the shard’s sake for some time now, and we both know it.',
        ],
      },
      // Walking up to a rift. `story.voice.firstRift` — the line that explains
      // what a rift *is* — is fired only under `canTutor()` in voice.js, so it
      // cannot reach anybody who has sealed one. This is what everyone else
      // hears instead.
      rift: {
        green: [
          'Another one. Same rule as the last: make the statement true and the air closes over it.',
          'Rift ahead. You have done one of these. The second is the same as the first, only you are already in it.',
        ],
        working: [
          'Rift. You know the drill better than the drill does.',
          'A rift ahead. I am not going to explain it; you have shut enough of them to be bored of my voice.',
          'Another statement asking to be finished. Yours if you want it.',
        ],
        veteran: [
          'Rift ahead. I have not narrated one of these to you in a long time and I do not propose to start.',
          'A rift. You have closed more of these than most of the order has read about.',
          'There is one waiting. It does not know who is coming, which is the only advantage it has.',
        ],
        master: [
          'Rift. It will not last long.',
          'Another rift. I mention it purely so the record shows that I mentioned it.',
          'There is a statement ahead that has not heard about you yet.',
        ],
      },
      // One-shot beats past the last chapter. The arc's chapters stop at
      // twenty-eight seals; these carry the voice from there to the far end of
      // a long save, and each is said once, ever.
      mile: {
        s32: 'Thirty-two. The chapters have run out and you have not, which is a problem for the record and for nobody else.',
        s40: 'Forty sealed. The founding text keeps a table of cadets by rifts closed. You are on the first page of it now, and the first page is short.',
        s50: 'Fifty. I should be honest with you: I stopped preparing material somewhere around thirty. From here I am simply watching.',
        s64: 'Sixty-four. There is a phrase in the archive — a hand that outpaced its shard. It has been used four times in nine centuries.',
        s80: 'Eighty. The tearing on Shard Nine is now slower than the mending, for the first time since the fourth day. That is you. Only you.',
        s100: 'One hundred. I have a line prepared for a cadet at one hundred. The reason you have never heard it is that no cadet has ever reached one hundred.',
        s120: 'One hundred and twenty. The lattice has begun routing its weather around this shard. It does that for structures, not for people.',
        s150: 'One hundred and fifty. I should like to state, for the record and without any of my usual defences, that I am glad it was you.',
        s180: 'One hundred and eighty. Nine hundred years I have been apologising to this shard. You have made most of the apology unnecessary.',
        s220: 'Two hundred and twenty. There is nothing left in me that knows how to be dry about this. Keep going. I will keep counting.',
      },
    },
  },
  // ---------------------------------------------------------------------------
  // The session (src/session).
  //
  // A run is fifteen to twenty-five minutes with a goal stated before the first
  // item, a pace you can see that is never a clock, a close that names what was
  // won, and a break that is an actual rest. Marlow's register throughout: dry,
  // exact, never flattering and never scolding. Nothing here congratulates the
  // learner for showing up, and nothing here tells a slow one they are late.
  // Additive keys, owned by the session layer.
  // ---------------------------------------------------------------------------
  session: {
    band: {
      run: 'Run {n}',
      of: 'of «n|one:# rift|other:# rifts»',
      near: 'Last stretch',
      done: 'Run complete',
      readout: '{goal}. «n|one:# rift|other:# rifts» sealed of {target}.',
      // Work done, which the rift count deliberately does not measure. See the
      // note at the top of band.js: a wrong answer costs nothing here, and it
      // must not therefore show nothing.
      worked: '«n|one:# question worked|other:# questions worked»',
      readoutWorked: '{goal}. «n|one:# rift|other:# rifts» sealed of {target}, from {items} worked.',
    },
    goal: {
      hold: 'Hold: {skill}',
      holdN: 'Hold «n|one:# line|other:# lines»',
      push: 'Drive back: {skill}',
      any: 'Seal whatever the shard opens',
      extend: 'One more line',
    },
    charter: {
      kick: 'Run {n} · Shard Nine',
      /* Where the first rift stands, said as five whole sentences rather than a
         bearing word dropped into a slot: "51 m ahead" and "51 m to your left"
         put the distance in different places once you leave English. */
      mark: {
        ahead: 'The rift is marked on your visor — {n} m, straight ahead.',
        left: 'The rift is marked on your visor — {n} m, off to your left.',
        right: 'The rift is marked on your visor — {n} m, off to your right.',
        behind: 'The rift is marked on your visor — {n} m, behind you.',
        here: 'The rift is marked on your visor. You are standing in it.',
      },
      title: 'Orders',
      goalHold: '{skill}. Seal {tears} rifts on that line and it should hold — properly held, the kind that never opens again.',
      goalHoldN: 'Seal {tears} rifts and {n} lines should hold — properly held, the kind that never open again.',
      goalPush: '{skill}. Seal {tears} rifts on that line. It is a long one, and today we make it short.',
      goalAny: 'Seal {tears} rifts on this shard, and we will see what the lattice does about it.',
      willHold: 'should hold',
      willPush: 'ground gained',
      eta: 'About «n|one:# minute|other:# minutes» at the pace you have been working. There is no clock on this — I will tell you when we are near the end.',
      etaSeed: 'About «n|one:# minute|other:# minutes», give or take. I have not watched you work yet, so that figure is mine and not yours; it will be yours by tomorrow. There is no clock on this — I will tell you when we are near the end.',
      begin: 'Begin the run',
      // The return beat. Said only when the last run left a record.
      kickBack: 'Run {n} · back again',
      backHeld: 'Last time out you sealed «n|one:# rift|other:# rifts», and {skill} has held ever since. It still does.',
      backHeldN: 'Last time out you sealed {tears} rifts, and «n|one:# line has|other:# lines have» held ever since. They still do.',
      backNone: 'Last time out you sealed «n|one:# rift|other:# rifts». All of it is still on the board — nothing rots here.',
    },
    close: {
      kick: 'Run {n} · closed',
      titleHeld: 'The line holds',
      titleMet: 'The shard is quiet',
      titleEnough: 'Enough for today',
      tears: '«n|one:rift sealed|other:rifts sealed»',
      heldLab: 'Held',
      groundLab: 'Ground gained',
      heldNote: 'Proved unassisted, at the hard band, with every worked example switched off. It is yours.',
      groundNote: 'Down to «n|one:# rift|other:# rifts» from holding — {d} closer than when the run opened.',
      groundNoteFlat: '«n|one:# rift|other:# rifts» from holding by the shortest road. Today bought the ground under it rather than the last step onto it.',
      groundNoteFar: 'A long line. It moved today, and it moved the right way.',
      groundNoneStrong: 'Nothing new to hold',
      groundNone: 'Everything you touched today was already yours.',
      openedLab: 'Opened',
      openedNote: 'A new line of rifts, open to you.',
      chapterNote: 'The record turns a page.',
      rankNote: 'The order has revised its estimate of you.',
      openedNoneStrong: 'The lattice, unchanged',
      openedNone: 'Nothing opened today. That is what the long lines cost, and they are the ones worth having.',
      nextLab: 'Next',
      nextNote: 'About «n|one:# minute|other:# minutes» of work, and the highest-leverage thing left open. That is where we start.',
      nextNoteUnknown: 'A long one. We will take the first part of it.',
      nextDoneStrong: 'Shard Nine, whole',
      // THE RETURNING LOOP, on every close (src/session/resolution.js).
      // Instructional, so: front-loaded, short, and the term is defined the
      // first time it is used.
      dueStrong: '«n|one:# line falls due|other:# lines fall due»',
      dueNote: 'You held these before. The lattice checks them next run. Passing one earns a night held.',
      nightsStrong: '«n|one:# night held|other:# nights held»',
      nightsNote: 'A night held is a line you still knew after a real break. Rank needs them above Silver. So do the last two chapters.',
      nightsNoneStrong: 'No nights held yet',
      nightsNoneNote: 'Come back tomorrow. The lattice re-checks what you hold. That is the only way to earn one.',
      nextDone: 'Nothing is open here any more. Step nine is proved.',
      sign: 'None of this is lost. The lattice keeps what you proved, and it will still be standing when you come back.',
      signWorked: 'Nothing here is graded and nothing here is lost. The line you were on is the line we open with, and it will be exactly where you left it.',
      signHeld: 'That line does not rot and it does not reset. Everything above it just became reachable.',
      rest: 'Stand down',
      more: 'One more line',
      aria: 'Run closed. «n|one:# rift|other:# rifts» sealed.',
      // A run that sealed nothing leads with the work instead of with a
      // screen-height zero, and the rows below say what the work bought.
      workedLab: '«n|one:question worked|other:questions worked»',
      workedSub: 'None of them sealed. The shard does not count attempts and neither do I — but it did not happen for nothing, and the rows below say what it bought.',
      ofWorked: 'from «n|one:# question worked|other:# questions worked»',
      echoStrong: '«n|one:# worked solve|other:# worked solves»',
      echoNote: 'A miss is what buys one. Each opened at the exact step your answer went sideways, not at the top of the page.',
      bandStrong: 'The bank re-cut',
      bandDown: 'Questions now open at band {n}, where you actually are. The bar for holding the line has not moved a millimetre.',
      bandUp: 'Questions now open at band {n}. You pushed the bank up today, not the other way round.',
      groundNoteBack: '«n|one:# rift|other:# rifts» from holding by the shortest road — further than at the start, because a missed gate item puts the proving run back to its first step. That is the gate being strict, not you being slow.',
      moreLast: 'One more stretch is all the window has left. After that we stop, and stopping on time is the part that makes tomorrow worth anything.',
      capped: 'That is the twenty-five minutes this loop is built around. Another stretch today is worth less than the same stretch tomorrow — that is not encouragement, it is how spacing works.',

      // --- states where this card could contradict its own neighbour ------
      // Each of these exists because a clause on one block was being printed
      // beside a block that made it false. See src/session/resolution.js.
      groundIdleStrong: 'Nothing worked',
      groundIdle: 'No question reached an answer this run. Nothing was spent and nothing was lost — the shard is exactly where you left it.',
      openedHeldNoneStrong: 'Nothing above it, yet',
      openedWholeNoneStrong: 'The lattice, complete',
      openedWholeNone: 'There is nothing left on this shard to open. That is not the end of the work; it is the end of the map.',
      openedHeldNone: 'A line can be worth holding and open nothing the same day. What a held line reaches is not always the next thing along.',
      signHeldQuiet: 'That line does not rot and it does not reset. Nothing further up the lattice came within reach today — it is a web, not a staircase — and the line is banked for good.',

      // --- what continues once all ten lines are held ----------------------
      // The endgame is fully built — the descent in src/learn, the charter and
      // the waystation in src/kit — and the screen that ends every session
      // named none of it, so the loop written to hold a returning player was
      // invisible from inside the game. These are the three things that keep
      // going, said in the state the learner is actually in.
      nextLabOpen: 'What continues',
      soundStrong: '«n|one:The sounding — # rung down|other:The sounding — # rungs down»',
      soundNote: 'Held lines, top of the bank, unassisted, one rung at a time. Twelve clean rungs is a descent that lands.',
      soundStrongNone: 'The sounding',
      soundNoteNone: 'Held lines, top of the bank, unassisted, one rung at a time. Twelve clean rungs is a descent that lands. You have not taken one down yet.',
      charterHaveStrong: '«n|one:# charter in hand|other:# charters in hand»',
      charterHaveNote: 'Earned by depth, spent on waystations. Nothing else in this game costs one.',
      charterStrong: 'The next charter',
      charterNote: 'Cut by depth, and depth only moves when a line held yesterday still holds today. {n} deeper cuts the next.',
      stationStrong: '«n|one:# waystation standing|other:# waystations standing»',
      stationNote: 'Stand at one, press H, and you are at the next. Two is a route; four is a different island.',
      stationStrongNone: 'The first waystation',
      stationNoteNone: 'What a charter and two hundred and forty motes raise: a permanent tower of rising air that is also a place. There is no last one.',
      signWhole: 'Ten lines, all held, and none of them rots while you are gone. What is left is how deep you can go, and how much of this island you can make one step wide.',
    },
    rest: {
      say: 'Stand down. Look at something a long way off — the far range will do — and breathe with the ring. Four counts in, hold for two, six out.',
      skip: 'Back to the shard',
      endKick: 'Shard Nine',
      endTitle: 'Holding',
      endBody: 'Rested. Everything you proved is written down, and the sky is where you left it.',
      endBodyNext: 'Rested. Everything you proved is written down. Next time we open with {skill}.',
      again: 'Another run',
      off: 'Close the channel',
      signOff: 'Channel closed. The lattice holds while you are gone, and I will keep the light on. Same sky tomorrow, cadet.',
      wakeUp: 'Open the channel',
      aria: 'Break. Paced breathing; nothing is being asked of you.',
    },
    voice: {
      near: 'Last stretch. Whatever happens now, this run is very nearly yours.',
      resume: 'Picking it up exactly where you left it. Nothing slipped while you were gone; nothing ever does.',
      extend: 'Carrying on, then. Same run, same ledger — the count does not start again just because you asked for more.',
    },
  },
  // ---------------------------------------------------------------------
  // Progress report — src/report/**. Purely additive: nothing above this
  // block is touched. A student reads the top of it, a teacher reads the
  // bottom, and the uncomfortable number lives on the front page.
  // ---------------------------------------------------------------------
  report: {
    launch: 'Progress',
    open: 'Open the progress report',
    openHint: 'Progress report (P)',
    title: 'Progress report',
    sub: 'What you have proved, what proved it, and what comes next.',
    close: 'Close',
    skillsHead: 'The ten lines',
    recordHead: 'The record',
    recordSub: 'What this claim is worth, said plainly. These are the figures a teacher checks, and the last one is the uncomfortable one.',
    foot: 'Nothing here is a stored grade. Live figures are recomputed from the learner model every time this opens; the evidence behind a mastered line is the receipt written when the claim was granted, and it does not move afterwards. Open a line to see it.',

    stat: {
      ofN: 'of {n}',
      mastered: 'Lines held',
      masteredNote: 'Proved, not merely attempted.',
      time: 'Time on task',
      timeNote: 'Measured between answers and capped, so idling never counts as work.',
      session: 'This session',
      sessionNote: 'A session is built to run 15–25 minutes and then stop cleanly.',
      items: 'Questions answered',
      itemsNote: 'Each one generated fresh and re-solved by machine before you saw it.',
      accuracy: 'Solved unaided',
      accuracyNote: 'Correct first time, with no hint and no worked example, out of every question answered.',
      hollow: 'Claims withdrawn',
      hollowNote: '{n} of {of} mastery claims were taken back when the line was re-tested cold.',
      hollowNone: 'No mastery claimed yet, so there is nothing to check.',
      ofHeld: 'of {n} held',
      sight: 'Held on first sight',
      sightNote: 'Proved on first contact, with no practice in front of it. The same claim on the least evidence this engine accepts — so it is re-tested cold soonest.',
      sightNone: 'No line was proved on first contact. Every claim here was earned after practice.',
      timeUnknown: 'Not measurable: part of this record was restored without its ledger, so the minutes before that are gone. They are shown as unknown, not as zero.',
      accuracyUnknown: 'Not measurable on a restored record: the model remembers the questions, but not which of them were answered without help.',
    },

    trust: {
      head: {
        reconstructed: 'This record is incomplete',
        foreign: 'A ledger from another record was discarded',
      },
      note: {
        reconstructed: 'The learner model and the evidence ledger are stored separately, and one came back without the other. {n} questions and {claims} mastery claims were rebuilt from the model, so nothing is under-reported — but time on task and unaided accuracy before the break cannot be recovered and are shown as unknown rather than as zero.',
        foreign: 'The evidence ledger on this device was written against a different learner record, so it was discarded rather than merged. Question counts and claims have been rebuilt from the learner model; the minutes and the unaided rate start again from here.',
      },
    },

    road: {
      sight: 'Tested out',
      fast: 'Short road',
      long: 'Long road',
    },
    roadNote: {
      sight: 'Proved on first contact: one cold item at the top of the bank, then the rest of the proving run. Three unassisted items, no practice in front of them.',
      fast: 'Opened the proving run on one clean unassisted solve at the gate band — fewer items than the long road, each of them harder.',
      long: 'Opened the proving run the long way: three clean unassisted solves and a posterior at the full threshold.',
    },

    next: {
      head: 'Next',
      why: {
        fresh: 'New ground. Everything it stands on is already held.',
        continue: 'Unfinished. Staying here is worth more than moving on.',
        check: 'One proving run away — three clean answers, no help, harder than usual.',
        review: 'Due for a cold re-test. The claim has to earn its place again.',
        enrich: 'Everything open is held. This one goes deeper instead.',
      },
      built: 'Standing on «n|one:# line you already hold|other:# lines you already hold».',
      start: 'The first line. Nothing is required before it.',
      doneName: 'All ten lines held',
      doneWhy: 'Level 1 is complete. What is left is keeping it.',
    },

    state: {
      locked: 'Locked',
      open: 'Open',
      practising: 'In progress',
      proving: 'Proving',
      mastered: 'Held',
      provisional: 'Slipping',
      withdrawn: 'Reopened',
    },
    stateNote: {
      locked: 'Something above this line is not held yet, so it will not open.',
      open: 'Unlocked and untouched.',
      practising: 'Practice under way. Support fades as the model firms up.',
      proving: 'The proving run is live: unassisted, support off, forms you have practised least.',
      mastered: 'Proved, and standing up to cold re-tests.',
      provisional: 'One re-test missed. Miss the next and the claim is withdrawn.',
      withdrawn: 'Held once, then lost on re-test. Practice has reopened.',
    },

    evidence: {
      head: 'The evidence behind this line',
      posterior: 'Model confidence',
      posteriorNote: 'Bayesian knowledge tracing, counting unassisted answers only. Needs {need}.',
      clean: 'Clean run',
      cleanNote: 'Correct in a row, with no help, at difficulty band {band} or above.',
      proving: 'Proving run',
      provingNote: 'Unassisted, support switched off, band {band} or above, drawn from the forms you have practised least.',
      prereq: 'Prerequisites',
      prereqNote: 'Held before this line opened: {list}.',
      prereqRoot: 'Nothing is required before this line.',
      noPrereq: 'none needed',
      retention: 'Held on re-test',
      retentionNote: 'Cold re-tests come round on an expanding schedule. Miss two and the claim is withdrawn.',
      probeCount: '{hit} of {n} held',
      probeNone: 'none due yet',
      coldVal: 'cold, band {band}',
      cleanSight: 'None, and none were asked for: this line was proved on first contact. The cold item is the proving run’s own first item and is counted once, in the row below.',
      cleanRoad: {
        long: 'Three in a row, unassisted, at difficulty band {band} — the long road to the proving run.',
        fast: 'One clean unassisted solve, but taken at band {band}, the gate band itself. The short road asks for fewer items and harder ones.',
      },
      provingExtended: 'Unassisted, support off, band {band} or above. The run extended itself by {n} to span a second surface and a modelling item.',
      noReceipt: 'not recorded',
      noReceiptNote: 'This claim was granted by an earlier build that kept no record of what proved it. It is reported as unevidenced rather than reconstructed from the settings — a threshold quoting itself is not evidence.',
      rests: 'This claim rests on {n} unassisted items, out of {of} questions answered on this line.',
      restsUnknown: 'The items behind this claim were not recorded. {of} questions have been answered on this line.',
      grantedOn: 'Granted {date}.',
    },

    fact: {
      time: 'Time on this line',
      items: 'Questions here',
      accuracy: 'Solved unaided',
      band: 'Difficulty',
      bandVal: 'Band {n} of 5',
      reps: 'Proved in',
      forms: 'Question types met',
      formsVal: '«n|one:# type|other:# types»',
      slip: 'Most common slip',
      noSlip: 'No repeated slip yet.',
      noneYet: 'not yet',
    },

    rep: {
      symbolic: 'symbols',
      context: 'a situation',
      verbal: 'words',
      table: 'a table',
      graph: 'a graph',
    },

    std: {
      head: 'Standards this line answers to',
      ccss: 'Common Core',
      teks: 'TEKS (Texas)',
      depth: {
        core: 'core',
        supporting: 'supporting',
        introduced: 'introduced',
        unknown: 'depth not stated',
      },
      depthNote: {
        core: 'Core: this standard is the thing being taught here, and the mastery gate tests it.',
        supporting: 'Supporting: exercised inside items aimed at another standard on this line, not gated on its own.',
        introduced: 'Introduced: a deliberately partial first encounter that a later level completes. Not a claim to have taught it.',
        unknown: 'No coverage depth is recorded for this citation.',
      },
      depthSum: '{n} of {of} citations on this line are core claims — the standard is what is taught here and the gate tests it. The rest are supporting or a first encounter.',
      depthNoCore: 'None of the {of} citations on this line is a core claim: this line supports them or introduces them, and another line carries them. Holding it is not a claim to have taught them.',

      // The framework switch. One choice, and the whole report re-expresses
      // itself — the lines, the coverage, the evidence and the exports.
      frame: {
        pick: 'Report against',
        pickHint: 'Choose the framework this report speaks in. The choice is kept on this device.',
        ccss: 'Common Core',
        teks: 'TEKS · Texas',
        hint: {
          ccss: 'Report this student against Common Core.',
          teks: 'Report this student against the Texas TEKS.',
        },
        full: {
          ccss: 'Common Core State Standards for Mathematics',
          teks: 'Texas Essential Knowledge and Skills, mathematics, adopted 2012',
        },
        authority: {
          ccss: 'Codes are quoted without the CCSS.MATH.CONTENT prefix.',
          teks: 'Cited into 19 Texas Administrative Code, Chapter 111.',
        },
      },

      // Coverage: one row per expectation, in the chosen framework.
      cover: {
        head: 'Standards coverage',
        sub: 'One row per expectation. Each row shows the evidence behind it.',
        evidenced: 'With evidence',
        core: 'Core held',
        untouched: 'Not touched yet',
        ofN: 'of {n}',
        group: {
          held: 'Held',
          part: 'Part held',
          indirect: 'No direct evidence',
          working: 'In progress',
          none: 'No evidence yet',
        },
        groupNote: {
          held: 'Every line that carries the expectation is proved.',
          part: 'Some lines that carry the expectation are proved. Some are not.',
          indirect: 'You hold the line that carries this expectation. You have met no question type that carries it.',
          working: 'Questions have been answered here. No line is proved yet.',
          none: 'You have answered no question for these expectations.',
        },
        empty: 'Nothing in this group.',
        openRow: 'Open the evidence for {code}',
        linesHeld: 'Lines proved: {n} of {of}',
        linesHead: 'Lines that carry it',
        textHead: 'What the expectation asks',
        textNote: 'Quoted in English. These standards have no official Spanish or Polish text.',
        evHead: 'The evidence behind this expectation',
        forms: 'Question types met',
        formsVal: '{n} of {of}',
        formsNote: 'The standards map names {of} question types for this expectation. You have met {n}.',
        answers: 'Answers here',
        unaided: 'Solved with no help',
        unaidedNote: 'Correct first time, with no hint and no worked example.',
        noneYet: 'No questions answered for this expectation yet.',
        indirectNote: 'A proved line is not evidence for every expectation it carries. This one has none of its own.',
        thin: 'Every proved line here was tested out on first sight. That is the least evidence this engine accepts.',
        unevidenced: 'A proved line here carries no receipt. An earlier build granted the claim and recorded nothing.',
        caveatHead: 'What is and is not claimed',
        processHead: {
          ccss: 'Standards for Mathematical Practice',
          teks: 'Process standards',
        },
        processNote: 'These run across every line. The count is the lines that are proved.',
        gapHead: 'Where this alignment stops',
        gapNote: 'Written down rather than papered over.',
      },
    },

    // The teacher's copy — src/report/teacher.js and src/report/record.js.
    // A dated, named, printable document, and the same thing again for a class.
    record: {
      open: 'Teacher record',
      openHint: 'A dated, printable evidence record — for this learner or for a whole class',
      title: 'Learner record',
      sub: 'A dated evidence record, made to be printed or filed. Nothing in it is a stored grade: every figure is recomputed from this device’s learner model at the moment you print or export.',
      tab: { one: 'One learner', std: 'Standards', class: 'Class · {n}' },
      name: 'Student name',
      namePh: 'Not recorded',
      group: 'Class or group',
      groupPh: 'Optional',
      nameNote: 'Kept on this device and written into anything you print or export, so a record can be attached to a person. Nothing is uploaded and there is no account.',
      print: 'Print / PDF',
      exportJson: 'Export record (.json)',
      exportCsv: 'Export table (.csv)',
      exportStd: 'Export standards (.csv)',
      import: 'Add student records…',
      addMine: 'Add this device’s record',
      clear: 'Remove all',
      anon: 'Unnamed learner',
      unknownDate: 'date not recorded',
      notMeasured: 'not measured',
      noClaim: 'not proved',
      levelName: 'Algebra I · Level 1 · The Cipher Worlds',
      levelLine: '{level}',
      generatedLine: 'Generated {date}',
      sum: {
        held: 'Lines held',
        items: 'Questions answered',
        unaided: 'Solved unaided',
        time: 'Time on task',
        claimItems: 'Items behind the claims',
        testedOut: 'Tested out cold',
        withdrawn: 'Claims withdrawn',
      },
      linesHead: 'Line by line',
      stdTitle: 'Standards record',
      stdSub: 'Coverage against {frame}',
      stdSheetHead: 'Expectation by expectation',
      stdFoot: 'Coverage is recomputed from the learner model every time this sheet is drawn. A question type counts only after this student has answered it. A line counts as proved only after an unassisted proving run at the gate band.',
      withdrawnHead: 'Claims this engine took back',
      withdrawnRow: '{skill} — withdrawn {date}',
      byLineHead: 'Where the class stands, line by line',
      classTitle: 'Class record',
      classSub: '{n} student records · assembled {date}',
      classEmpty: 'No student records yet. Each student exports their own record from this screen; add the files here and they stay on this device.',
      classFoot: 'Assembled from records the students exported themselves. Nothing was uploaded, and this list lives only in this browser — clearing site data clears it.',
      claimItemsShort: '{n} unassisted items at band {band}',
      claimReps: 'across {n} representations',
      claimRegrant: 're-earned after a withdrawal',
      foot: 'Record {id} · {n} observations. Every figure above is recomputed from the learner model and the evidence ledger on this device; none of it is a stored grade. A line is held only after an unassisted proving run at the gate band, and the claim is withdrawn again if two later cold re-tests fail.',
      trust: {
        verified: 'verified',
        reconstructed: 'reconstructed',
        foreign: 'rebuilt',
      },
      trustNote: {
        verified: 'Both halves of this record — the learner model and the evidence ledger — agree, question for question.',
        reconstructed: 'Restored from a partial save. Question counts and claims were rebuilt from the learner model, so nothing is under-reported; time on task and unaided accuracy from before the break are not recoverable and are reported as unknown rather than as zero.',
        foreign: 'The evidence ledger found on this device belonged to a different record and was discarded rather than merged. Everything here was rebuilt from the learner model alone.',
      },
      col: {
        student: 'Student',
        group: 'Class',
        generated: 'Generated',
        skill: 'Line',
        state: 'State',
        evidence: 'What proved it',
        confidence: 'Model confidence',
        items: 'Questions',
        unaided: 'Unaided',
        time: 'Time',
        road: 'Road',
        claimItems: 'Items behind the claim',
        band: 'Band',
        retention: 'Held on re-test',
        standards: 'Standards (depth)',
        ccss: 'Common Core (depth)',
        teks: 'TEKS (depth)',
        trust: 'Record',
        held: 'Lines held',
        testedOut: 'Tested out',
        withdrawn: 'Withdrawn',
        classHeld: 'Held',
        classProving: 'Proving',
        classWorking: 'Working',
        classLocked: 'Not open yet',
        code: 'Code',
        depth: 'Depth',
        citation: 'Citation',
        expectation: 'What it asks',
        carriedBy: 'Lines that carry it',
        cover: 'Coverage',
        linesHeld: 'Lines proved',
        formsMet: 'Question types met',
        answers: 'Answers',
        framework: 'Framework',
        processMet: 'Design intent',
      },
    },

    unit: {
      sec: 'sec',
      min: 'min',
      hr: 'hr',
      secFull: '{n} sec',
      minFull: '{n} min',
      hrFull: '{h} hr {m} min',
    },

    idea: {
      'var-meaning': 'A letter stands for a number nobody has named yet.',
      'eval-expr': 'Put the number in place of the letter, and the expression becomes one value.',
      'order-ops': 'Brackets and powers bind tighter than multiplying, which binds tighter than adding.',
      'like-terms': 'Terms only merge when their letter parts match exactly.',
      'distribute': 'Multiplying a sum multiplies every term inside it.',
      'one-step-add': 'An equation is a balance: undo an addition on both sides at once.',
      'one-step-mul': 'A number written against the unknown comes off by dividing, never by subtracting.',
      'two-step': 'Unwrap in reverse: the loose number first, then the coefficient.',
      'multi-step': 'Simplify each side completely before you undo anything.',
      'both-sides': 'Gather the unknown on one side — and if it vanishes, read what is left.',
    },

    slip: {
      'add-not-multiply': 'Adds where the situation multiplies',
      'arith-slip': 'Right method, slipped arithmetic',
      'axis-swap': 'Reads the graph along the wrong axis',
      'coefficient-sign-lost': 'Drops the sign on the coefficient',
      'collect-wrong-side': 'Gathers the unknown on the wrong side',
      'combine-unlike': 'Merges terms that are not alike',
      'distribute-then-forget': 'Expands the bracket, then loses a term',
      'div-direction': 'Divides the wrong way round',
      'divide-not-multiply': 'Divides where the situation multiplies',
      'exponent-as-mult': 'Reads a power as a multiplication',
      'implicit-mult-missed': 'Reads 3x at x = 4 as the digits, not the product',
      'letter-as-object': 'Treats the letter as a label, not a value',
      'letter-as-position': 'Uses the letter’s place in the alphabet as its value',
      'neg-base-power': 'Mishandles the sign on a negative base',
      'neg-distribute': 'Loses a minus sign while expanding',
      'neg-substitution': 'Substitutes a negative but keeps the answer positive',
      'no-solution-confusion': 'Confuses no solution with every value working',
      'off-by-one-row': 'Reads the neighbouring row of the table',
      'one-side-only': 'Changes one side of the balance only',
      'partial-distribute': 'Multiplies only the first term in the bracket',
      'partial-rule': 'Starts the rule correctly and stops early',
      'same-op-both': 'Applies the same operation instead of the inverse',
      'sign-on-constant': 'Moves the constant across without changing its sign',
      'sign-slip': 'Loses or invents a minus sign',
      'strict-left-right': 'Works strictly left to right, ignoring precedence',
      'subtract-coefficient': 'Subtracts the coefficient instead of dividing by it',
      'subtract-not-multiply': 'Subtracts where the situation multiplies',
      'swapped-roles': 'Swaps which quantity is which',
      'wrong-unwrap-order': 'Unwraps in the order the expression was built',
      'x-and-x-squared': 'Treats x and x squared as the same kind of term',
    },
  },

  // The kit (src/kit). What a sealed line buys, said as capability and never as
  // congratulation. Additive keys, owned by the kit.
  kit: {
    granted: 'Line sealed',
    // The chip's own sentence, where a screen reader and a thumb can reach it —
    // it used to live only in a hover title, which neither of them has.
    chipAria: '{name} — {what}',
    grantedHeld: 'Line still holding',
    locked: 'Seal {n}',
    lockedLong: 'Sealing {n} lines opens this',
    next: 'Next',
    // The one locked chip on the strip. "Next" alone told a new player nothing:
    // it is not clickable yet, and nothing on screen said what would make it
    // clickable. These say the price in the only currency that buys it.
    nextAtLines: 'Hold «n|one:# line|other:# lines»',
    nextAtDepth: 'Hold lines across a night',
    cost: '{n} motes',
    held: 'Held',
    needShards: '{n} motes needed',
    flareLit: 'Flare lit — the air is rising',
    beaconSet: 'Beacon planted — the air rises here from now on',
    vaulted: 'Vault',
    // What this run is for, said as the thing you are about to be able to do.
    // Never as a rep count: a quota on the title card is a toll booth, and the
    // whole design says the mathematics is the upgrade path and not the fee.
    charterNext: '{skill}. Hold that line and {grant} is yours. {what}',
    charterOpen: '{skill}. Everything the kit has is already yours; what is left out there is the island, and it is bigger than you have flown.',
    vault: {
      name: 'Vault plate',
      short: 'Plate',
      what: 'A fifth piece for the lattice. Stand on one and it throws you twelve metres straight up.',
    },
    flare: {
      name: 'Updraft flare',
      short: 'Flare',
      what: 'F — light a column of rising air under your own boots, anywhere, for six seconds.',
    },
    kite: {
      name: 'Kite trim',
      short: 'Trim',
      what: 'The wing flies flatter, faster and turns harder. Valleys you could not cross are now one glide.',
    },
    reserve: {
      name: 'Deep reserve',
      short: 'Reserve',
      what: 'The lattice reserve more than doubles, and refills half again as fast.',
    },
    legs: {
      name: 'Storm legs',
      short: 'Legs',
      what: 'A faster sprint, a higher jump, and the dash comes back in half the time.',
    },
    sight: {
      name: 'Resonant sight',
      short: 'Sight',
      what: 'Drift motes lean toward you, and a hanging cache can be read from twice as far out.',
    },
    beacon: {
      name: 'Standing beacon',
      short: 'Beacon',
      what: 'G — ninety motes plants a column of rising air that is still standing tomorrow. The only thing you can do to this island that lasts.',
    },
    windstep: {
      name: 'Windstep',
      short: 'Windstep',
      what: 'The dash comes back while your boots are off the ground. Three of them will cross a gap the wing cannot.',
    },
    span: {
      name: 'Long span',
      short: 'Span',
      what: 'The wing again, flatter and faster still. From the high ridge you can now reach the far coast without touching down.',
    },
    array: {
      name: 'Plate array',
      short: 'Array',
      what: 'The vault plate throws you a third higher and costs six motes instead of eighteen. Plates become a staircase.',
    },
    squall: {
      name: 'Squall flare',
      short: 'Squall',
      what: 'The flare costs sixteen, stands seventy-four metres tall and holds for eleven seconds.',
    },
    deepwell: {
      name: 'Deep well',
      short: 'Well',
      what: 'The lattice reserve reaches three hundred and refills twice as fast. Bridge a canyon in one run.',
    },
    // --- the endgame: the rung that is a rate rather than a rung ---------
    station: {
      name: 'Waystation',
      short: 'Station',
      what: 'H — raise a permanent tower of rising air, and travel between any two of them. Costs a charter and two hundred and forty motes.',
    },
    charter: {
      name: 'A waystation charter',
      what: 'Hold what you already hold, across a night, and the lattice cuts you another charter. There is no last one.',
    },
    chartersHeld: '«n|one:# charter|other:# charters» · {cost}',
    charterIn: '{n} deeper',
    needCharter: 'No charter. {n} more depth cuts the next one',
    stationSet: 'Waystation {n} raised — it is on the island now',
    stationAlone: 'Nowhere to travel yet. Raise a second one',
    travelled: 'Waystation to waystation',
    soundLanded: 'Sounding landed · {n} down, clean',
    soundDeep: 'Sounding · {n} down',
    soundBroke: 'The sounding breaks at {n}',
    // The counter (src/kit/foundry.js). A verb you have not been licensed for
    // can still be bought over it, and the strip has to say so.
    carrying: '«n|one:# in hand|other:# in hand»',
    buyAt: '{name} — the foundry at the landing sells them',
    afford: '{n} motes — enough for {name}',
  },

  // The drift and the hanging caches (src/world). What the island does when
  // nobody is asking you a question.
  // ---------------------------------------------------------------------
  // DIRECTION (src/meta/guide.js). The objective, the waypoint, the interact
  // prompt, the nouns the world teaches itself, and the edge of the shard.
  // Additive namespace owned by src/meta.
  // ---------------------------------------------------------------------
  guide: {
    label: 'Objective',

    // The four things the scheduler can ask for. They are different words on
    // purpose: practice and a proving run are not the same act, and a player
    // who cannot tell them apart cannot tell he is nearly finished.
    verb: {
      seal: 'Seal the rift',
      prove: 'Prove the line',
      watch: 'Stand the watch',
      sound: 'Sound the lattice',
    },

    metres: '{n} m',
    rel: {
      ahead: 'Ahead',
      left: 'To your left',
      right: 'To your right',
      behind: 'Behind you',
      here: 'You are standing in it',
    },

    // Why it is worth walking there. One of these, chosen by what is actually
    // downstream of the line — never a generic reward noise.
    pay: {
      lines: 'Hold it and «n|one:# more line of the lattice opens|other:# more lines of the lattice open».',
      kit: 'Hold it and {name} is yours.',
      calm: 'Seal it and the surges here stop for good.',
      sound: 'Held already. The bank still goes deeper, and it still pays.',
    },

    tally: '{held} held · {open} open · {locked} locked',

    prompt: {
      open: 'Open the rift',
      sound: 'Sound this line',
    },
    key: {
      kbm: 'E',
      pad: 'X',
      touch: 'Tap',
    },


    // -------------------------------------------------------------------
    // THE NOUNS. Each of these is said once, ever, the first time the player
    // is actually looking at one of the things. src/world/beckon.js carries
    // the live label on the object itself — its name, its value, its timer —
    // so these say the half a label can never carry: what the thing is, why it
    // exists, and why he should care. Marlow, not a tooltip.
    // -------------------------------------------------------------------
    n: {
      rift: 'That ring is a rift. Somewhere in the founding proof is a line — one rule of algebra — that stopped being true, and this is where it comes out. Stand in it, answer what the rig throws on your visor, and the hole in the world closes behind you. Seal enough rifts on the same line and you hold that line for good.',
      surge: 'Stand this close to an open rift and it pushes back. Every fifteen seconds an unsealed rift throws a pressure ring out across the ground, and whatever it catches loses motes and its footing. Jump as it reaches you and it passes under your boots. Seal the rift and it stops for ever.',
      mote: 'Cipher motes — loose lattice, lying where the ground bled. Run through them and they are yours. Vault plates and squall flares are cut from that, so they are worth going out of your way for.',
      charged: 'The gold ones grew against an open rift, which is why they pay three times what a pale one does — and why an open rift throws a surge ring out here every fifteen seconds and takes motes back off you. Seal that rift and the surges stop for good. The vein keeps paying.',
      husk: 'The dark ones are spent, and the culprit is you. They re-light in about five minutes. You cannot farm a hillside on this shard, cadet — you can only range further out, which I suspect was rather the point.',
      anchor: 'A lattice anchor: structure the founders left unfinished. Nothing in your kit reaches one from flat ground, and that is the entire idea. Place a ramp, place another off the top of it, and touch the thing. Sixty motes apiece, and there are three.',
      cache: 'A hanging cache. The beam is holding a true statement with one weight taken out of it — walk into the counterweight that puts the beam level and the monolith opens. A hundred and twenty motes, and the air rises there for good afterwards.',
      updraft: 'Rising air, and a great deal of it. Fly into the column and it hands you sixty metres for nothing, which is how you get to the things that were put deliberately out of reach.',
      verge: 'That curtain is where Shard Nine stops, and I would rather you heard it from me than from the wing. The lands you can see are eight hundred metres of open sky away and the lattice is the only thing that crosses. Hold every line here and it will carry you out there. Until then it is a very long fall with a view.',
    },
  },

  // THE FOUNDRY (src/kit/foundry.js) — the counter where cipher motes become
  // something, quoted and explained before a single one is spent. Additive
  // keys, owned by the kit.
  foundry: {
    kick: 'Cadet supply',
    name: 'The Foundry',
    lede: 'A cipher mote is what a rift leaves behind when it closes. The foundry takes them, and hands back air you can stand on.',
    unit: '«n|one:mote|other:motes»',
    hailStock: '«n|one:# thing you can afford|other:# things you can afford»',
    hailNone: 'Where motes are spent',
    take: 'Take it',
    short: '{n} short',
    leave: 'Step back',
    sealedLines: 'Hold «n|one:# line|other:# lines»',
    sealedDepth: 'Hold your lines across a night',
    inHand: 'Yours · {key}',
    carried: '«n|one:# in hand|other:# in hand» · {key}',
    bought: 'In hand. Press {key} where you want it',
    note: 'Motes buy what is on the counter. Held lines open the rest.',
    callout: 'Cadet — those motes are not a score. There is a foundry at the landing that turns them into lift: the lit hexagon with the three pylons, off your left shoulder.',
    flare: { what: 'Six seconds of rising air under your own boots, wherever you happen to be standing. One use.' },
    beacon: { what: 'A column of rising air that is still standing tomorrow, planted wherever you choose. Nothing else you can do to this island lasts.' },
    plate: { what: 'A fifth piece for the lattice. Stand on one and it throws you twelve metres straight up.' },
    station: { what: 'A tower of rising air that is also a place: stand at one, and step out of any other.' },
  },

  field: {
    moteTake: '+{n} motes',
    updraft: 'Updraft',
    surge: 'Rift surge',
    surgeHit: 'Rift surge — {n} motes knocked loose · jump the ring, or seal the rift',
    balanceLock: 'Balance lock',
    balanceNo: 'The beam refuses it',
    balanceReset: 'The weights re-form',
    cacheOpen: 'Cache broken open — {n} motes, and the air here rises for good',

    // --- what the world says when you walk up to it (src/world/beckon.js) ---
    riftOpen: 'Step onto the plate · {skill}',
    riftShut: 'Sealed · hold {skill} first',
    riftHeld: 'Held · {skill}',
    riftRefuse: 'The bars hold. This rift opens once you hold {skill}.',
    veinLit: 'Cipher vein · +{n} a crystal',
    veinRich: 'Charged vein · +{n} a crystal',
    veinSpent: 'Vein harvested · relights in {time}',
    shardsFor: 'Cipher motes. The rig trades them for vault plates, flares and standing updrafts.',
    anchorFind: 'Lattice anchor · build up to it',
    anchorHeld: 'Anchor secured',
    vergeTag: 'The verge · edge of Shard Nine',
    vergeHit: 'The verge holds. Shard Nine ends here — the far shards are a crossing nobody has made.',
  },
  // --- the affordance layer (src/world/afford.js): what a rift says it will
  // do, the key that does it, and the bearing to the next one -------------
  afford: {
    open: 'Open the rift',
    walkIn: 'Walk into it',
    sound: 'Sound the line',
    shut: 'Sealed shut',
    needs: 'Hold {skill} first',
    tap: 'Tap',
    next: 'Next rift',
    metres: '{n} m',
  },

  // ---------------------------------------------------------------------
  // THE LEDGER (src/kit/ledger.js) — every movement of the currency, with the
  // reason it moved and the balance it left behind.
  //
  // A cold player reported the wallet "silently resetting to zero" three times.
  // Nothing reset: a rift surge levied a flat nine motes, which emptied any
  // balance under nine, and the one line explaining it was written to the
  // single shared toast slot and then overwritten by the "no footing" toast
  // that the same surge's knockback fired half a second later. The strip has
  // its own element and its own clock, and these are the words on it.
  // Additive namespace, owned by the kit.
  // ---------------------------------------------------------------------
  ledger: {
    /** What is left afterwards. Printed on every line, so the sum is never a guess. */
    left: '{n} left',
    /** A levy that found too little to be worth taking. See LEVY_SHARE. */
    spared: 'Too few motes to knock loose',
    why: {
      // earned
      seal: 'Rift sealed',
      assist: 'Sealed with a worked example',
      vein: 'Cipher vein',
      cache: 'Hanging cache',
      anchor: 'Lattice anchor',
      found: 'Picked up',
      // lost
      surge: 'Rift surge',
      // spent
      spent: 'Spent',
      vault: 'Vault plate set',
      plate: 'Vault plate bought',
      flare: 'Updraft flare',
      beacon: 'Standing beacon',
      station: 'Waystation raised',
    },
  },
};
