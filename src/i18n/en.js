export default {
  meta: {
    name: 'English',
    code: 'en',
    title: 'ASCENT — The Cipher Worlds',
    sub: 'THE CIPHER WORLDS',
    description: 'ASCENT — The Cipher Worlds. A floating island, a wing, and ten rifts held open by algebra that is not true yet.',
  },

  boot: {
    tip: 'Linking your cadet signature to Shard Nine…',
    enter: 'Press any key to begin',
  },

  hud: {
    rank: 'Rank',
    // `«n|…»` inflects the noun for the count in front of it. English needs two
    // forms; see es/pl for languages that need more.
    shards: '«n|one:Cipher mote|other:Cipher motes»',
    mastery: 'World repaired',
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
    readout: 'World repaired {pct} · rank {rank} · {n} {shards}',
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
    charge: 'Build charge · refills itself',
    // The number beside the gauge is pieces standing, not charge left.
    pieces: '«n|one:# piece up|other:# pieces up»',
    keySet: 'LMB · place',
    keyTurn: 'F · turn',
    keyClear: 'Q · clear',
    turn: 'Turn',
    // --- never be trapped by your own lattice (src/build/builder.js) ---
    // The room is never refused. It is closed, and the wall that closes it
    // arrives with a door in it. (src/build/builder.js, src/build/pieces.js)
    sealDoor: 'This wall closes the room. It gets a door.',
    doorCut: 'Room closed. That wall has a door in it.',
    boxedIn: 'Your lattice has you shut in',
    cutFree: 'A way out is open',
    cutKey: 'Q',       // i18n-allow: a keycap, and the same cap on every layout
    cutKeyPad: 'LB',   // i18n-allow: the console's own name for that shoulder
    remove: 'Clear',
    removePrompt: 'Q · clear',
    noCharge: 'Build charge spent. Wait for it to refill.',
    // A second click at a wall that is already there is now the commonest
    // refusal in the game (src/build/builder.js: the aim no longer promotes an
    // occupied slot a storey up). So it names the next move rather than just
    // saying no.
    alreadyThere: 'Already built there. Look up to build higher.',
    nothingThere: 'Nothing in the crosshair',
    latticeFull: 'Lattice at capacity — clear a piece first',
    anchorCall: 'Three anchors hang over the plaza. Nothing on the ground reaches them. So stop standing on the ground.',
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
    handStowed: 'Build hand stowed. Press 1 to 4 to pick a piece',
  },

  // Learning surface. Nothing here reads like a worksheet — the words are
  // in-world, the mathematics is exact.
  learn: {
    riftTitle: 'Rift {n} — {skill}',
    prompt: 'Stabilise the rift',
    submit: 'Seal',
    hint: 'Ask Marlow',
    check: 'Check',
    correct: 'The line holds.',
    incorrect: 'Not true yet. Look again.',
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
    'inequality-one-step': 'One-step inequalities',
    'inequality-two-step': 'Two-step inequalities',
    'inequality-multi-step': 'Multi-step inequalities',
    'compound-inequality': 'Compound inequalities',
    'literal-equations': 'Rearranging formulas',
    'ratio-proportion': 'Ratio and proportion',
    'slope-rate': 'Slope and rate of change',
    'graph-linear': 'Graphing linear rules',
    'write-linear': 'Writing linear rules',
    'system-substitution': 'Systems by substitution',
    'system-elimination': 'Systems by elimination',
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
    // What the world says when it picks you up off its own edge. It says what
    // happened and where you are, because a player who has just been moved
    // without asking needs both.
    caught: 'Off the shard — the lattice caught you and set you down on the rim',
    dug: 'The ground had you. Set down on open rock',
    stuck: {
      title: 'Wedged',
      body: 'Something has hold of you. Press Recover to get back onto open ground. Nothing here ever needs a reload.',
      act: 'Recover',
    },
    // The browser refused to let the game hold the mouse — an LMS iframe, a
    // managed Chromebook. Said once, and it names the key to press rather than
    // the thing that went wrong. (src/core/input.js, src/player/controls.js)
    nolock: {
      title: 'The mouse cannot turn the view here',
      body: 'Turn with the arrow keys. Or hold a mouse button and drag.',
    },
    bind: {
      kbm: {
        move: 'W · A · S · D',
        look: 'Mouse',
        // Two more ways to say "look", for the two states the mouse can be in.
        // `lookFree` is before the game has been granted the pointer; the mouse
        // may yet work, and the arrows already do. `lookBlocked` is after a
        // refusal, when naming the mouse at all would be a lie.
        lookFree: 'Mouse · Arrows',
        lookBlocked: 'Arrows · Drag',
        jump: 'Space',
        glide: 'Hold space',
        interact: 'E',
        build: '1–4 · Click · F',
        dash: 'C · Left ctrl',
        recover: 'R',
      },
      pad: {
        move: 'Left stick',
        look: 'Right stick',
        jump: 'A',
        glide: 'Y',
        interact: 'X',
        build: 'LB · RT · D-pad turns',
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
    // The way out. Named plainly, because the player reading it is stuck.
    out: 'If you are stuck',
    outBody: 'Recover puts you back on solid ground from anywhere — off the edge of the shard, inside a hill, or inside something you built. Nothing here ever needs the page reloaded.',
    recover: 'Recover',
    restart: 'Start over',
    restartAsk: 'Start over? Every rift you have sealed and every mote you have earned goes.',
    restartYes: 'Start over',
    restartNo: 'Keep playing',
    now: 'What to do next',
    nowBody: 'A rift is a ring of torn air. Each rift holds a maths statement that is not true yet. Walk into the ring. Press {key}. Make the statement true, and the rift closes for good.',
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
    trueNow: 'True. The rift closes.',
    stable: 'Stable',
    critical: 'Critical',
    close: 'Leave the rift',

    // The resolution beat. What the rig stamps on a line it now trusts.
    seal: {
      // src/ui P1 — this read GRIP, a word the seal beat coined and never
      // explained, in a flex row beside a fixed 104px bar with no room for a
      // definition. The meter measures how firmly the line is HELD, and held is
      // already defined on the objective card. The cure for an unglossed term
      // is not always a gloss; here it was not needing the word.
      grip: 'Hold on this line',
      line: 'The line holds',
    },

    kind: {
      check: 'Proving run · {n} of {m}',
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
      keypad: 'Type the value that makes the statement true. Then press Seal.',
      // Same keypad, different task. A rewrite hands back an expression, not a
      // value, and being told to "type the value" when no value is wanted sends
      // a cadet looking for a number that is not there.
      keypadExpression: 'Type the expression in its shortest form. Then press Seal.',
      balance: 'Choose a move. The beam applies it to both sides. Both sides, every time — that is the whole law.',
      sort: 'Send every term to the bay it belongs in.',
      area: 'Cover each part of the field with the area that part carries.',
      choice: 'One of these readings is true. The rest are how people get it wrong.',
      plot: 'Move the two knobs until the trace fits the readings. Then press Seal.',
    },

    keypad: {
      charge: 'Your answer',
      set: 'Seal',
      back: 'Delete',
      minus: 'Negative',
      over: 'Fraction bar',
      empty: 'Type a value first',
      narrow: 'Narrow the field',
      narrowed: 'Three readings survive the noise.',
    },

    plot: {
      aria: 'Coordinate grid. Move the two knobs to draw the trace.',
      knob: 'Knob {n}',
      reads: 'Your trace',
      notYet: 'That trace does not fit both readings yet.',
    },

    balance: {
      tray: 'Available moves',
      moves: 'Moves',
      undo: 'Step back',
      both: 'Applied to both sides',
      solved: 'The unknown stands alone.',
      closer: 'Closer. The unknown is coming loose.',
      further: 'Still true. But the unknown sits deeper now.',
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
      trace: 'An echo is the work an older cadet left in this rift. {name} stood here once. Read it one step at a time.',
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
      more: 'Push further — one layer deeper',
      // Where in the trace you are standing. The rail says what is here.
      tier: 'Layer {n} of {of}',
      spent: 'No trace left',
      // The rail cuts the trace in layers. Each layer names what is in it, so
      // a numbered chip is never a number on its own.
      depth1: 'Whisper — the first hint',
      depth2: 'First move — how they started',
      depth3: 'The shape — the whole method',
      depth4: 'Whole trace — every step',
      firstMove: 'Only the first move survived the burn. The rest is ash.',
      shape: 'The shape of the whole solve survives. The value at the end does not.',
      cameBack: 'The echo comes back louder.',
      liveOnly: 'The rig has no other rift of this shape on record. So the echo shows your own work, read back to you.',
      nudge: {
        keypad: 'Say the statement to yourself before you type anything. The value you want is the one that makes it true, not the one that sits nearest.',
        keypadExpression: 'Nothing here is being solved. Write the same amount in fewer terms, and the shorter line must still hold for every value of the letter.',
        balance: 'Something clings to the unknown. Undo the outermost thing first. The beam does the rest.',
        sort: 'Two terms are alike only when the letter part matches exactly. A number is never like a letter.',
        area: 'The factor outside touches every part inside. Every part.',
        choice: 'Test each reading against the statement. Do not pick the one that merely looks familiar.',
        plot: 'Set the height where the trace crosses the upright axis first. Then set how steeply it climbs.',
      },
    },

    mis: {
      'letter-as-object': 'They read the letter as a thing to count, not as a number.',
      'add-not-multiply': 'They added the two quantities. The situation makes equal groups, so it multiplies.',
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
      multipliedThenAdded: 'The equation multiplies the unknown by `{a}`, then adds `{b}`.',
      multipliedThenTaken: 'The equation multiplies the unknown by `{a}`, then takes off `{b}`.',
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
        a: 'Fifth day, and something came up out of the lattice at first light.',
        b: 'It is going round the shard, low and slow. I have not seen one in nine centuries.',
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

    /* THE WARDENS (src/world/warden.js). The word is defined the first time it
       is used and never before. Two sentences: what it is, then the one thing
       to do about it. */
    warden: {
      first: {
        a: 'That is a warden. The lattice sends one out when a shard starts to hold again.',
        b: 'It carries a statement and drops the answers behind it. Take the correct weight.',
      },
      wake: 'Another warden is out. It came up over the ridge a minute ago and it is already moving.',
      left: 'The warden came apart. What it was carrying is still hanging where you caught it.',
      full: 'The warden came apart. The shard will hold no more caches, so you were paid in motes.',
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
      /* src/ui P1 — CUT TO A LENGTH A FIFTEEN-YEAR-OLD ACTUALLY READS.
         l3 was 216 characters. The channel typed it in 2.45 s and held it 2.90 s,
         so it was on screen 5.35 s for a line that needs 11.8 s at 200 wpm — it
         was removed with six and a half seconds of reading still to do, every
         time, which is why a cold critic filed it as "two lines of typewriter
         prose, clipped mid-word". Nothing was clipping. It was being taken away.
         Nothing here is over ~105 characters in any locale now, and the hold in
         src/meta/comms.js is the reading time the words actually cost.

         And the two nouns the whole game stands on now arrive DEFINED, in the
         same breath they are coined: LATTICE in l1 and RIFT in l4. The word
         "rift" is on the objective card from the fourth second, and its only
         definition used to reach the player somewhere past the seventieth. */
      l1: 'Shard Nine, in the Skyren Lattice. The lattice is the argument that holds this world up.',
      l2: 'I am Marlow. Navigational intelligence — lightly damaged, mostly honest. You are the cadet.',
      l3: 'Everything under your boots is a conclusion. Where the argument holds, there is ground.',
      l4: 'Where it fails, you get a rift: a statement the lattice can no longer prove.',
      l5: 'Shard Nine has stood nine hundred years. So what began pulling it apart four days ago?',
    },

    ch1: {
      title: 'The Standing Question',
      quest: 'Shard Nine has held for nine centuries. Find out what changed four days ago.',
    },
    ch2: {
      title: 'The cadets before you',
      quest: 'Hundreds stood exactly where you are. Find out where they stopped.',
      b1: 'Three rifts sealed. The lattice has noticed you — you would be surprised how many cadets it never notices at all.',
      b2: 'I read the traces the rig digs out of the rifts. Cadets stood exactly where you are standing. Hundreds.',
      b3: 'All capable. All stopped. No record says why, and that is the kind of silence somebody is paying for.',
    },
    ch3: {
      title: 'The ninth lemma',
      quest: 'Nobody ever finished one step of the founding proof. Climb high enough to finish it.',
      // src/ui P1 — the chapter is called "The ninth lemma" and the word was
      // never defined. A lemma is one step of a proof; b1 now says so, and is
      // cut to a length that is read rather than skipped.
      b1: 'Seven sealed statements. Enough to call up the founding proof: four million steps, nine hundred years.',
      b1b: 'A lemma is one step of a proof. This one is watertight the whole way down — except at step nine.',
      b2: 'Step nine is not proved. It is assumed. One word in the margin, in somebody’s own hand: suppose.',
      b3: 'Nine thousand worlds stand on a step nobody finished. The rifts are step nine coming back to ask.',
    },
    ch4: {
      title: 'The hand in the margin',
      quest: 'Finish what Marlow started.',
      b1: 'Sixteen rifts closed. There is something I have not been saying for four days. I am going to say it.',
      b2: 'The handwriting in the margin is mine. I was the cadet here. The shard was falling and I had eleven minutes.',
      b3: 'Nine hundred years of cadets reached this page. Every one stopped on the same line. Prove me wrong.',
    },
    ch5: {
      title: 'Signed',
      quest: 'Write the end of step nine, and a name underneath it.',
      b1: 'Twenty-eight rifts. Somewhere in there the lattice stopped treating you as weather, and started reading you.',
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
      // The proof closes at five nights held (src/meta/shard.js). The row
      // that would name the descent names this instead, until it is done.
      coda: 'The proof closes in «n|one:# night held|other:# nights held»',
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
      /* src/ui P1 — the five seconds this ceremony owns the frame used to carry
         no action at all: "the rank-up ceremony blanks the entire HUD for ~5 s
         with no prompt". This is the objective it interrupted, printed inside
         it, so there is never a frame with nothing to do on it. */
      next: 'Next: {verb} — {skill}, {n} m away',
      nextAny: 'Next: find a rift and seal it',
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
      integrity: 'World repaired',
      close: 'Close the dossier',
      footer: 'Nine thousand shards. One argument. One unfinished step.',
    },

    // The four terms standing is made of, and what each is actually worth.
    stand: {
      seals: 'From sealed rifts',
      sealsNote: 'Three for a clean seal, two for an assisted one — and it stops at twenty-six. After that, easy rifts pay nothing towards rank.',
      proving: 'From proving runs',
      provingNote: 'Three points for every item you hold inside a proving run: no help, unfamiliar, high difficulty band.',
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
      firstRift: 'That ring of torn air ahead is a rift. Walk up to it and press E. The rig does the rest.',
      firstSeal: 'It held. That statement is now a permanent feature of reality, and your hands did it.',
      standard: 'The obelisk in the plaza is the Standard: five bands, one per rank, and a light at your standing.',
      capped: 'Sealed, but easy rifts have stopped paying. Standing comes out of held lines now, and those cost work.',
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
          'Three misses. Tell me it is fatigue and I will believe you. I will also note that you have lasted longer at this than most cadets did.',
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
          'Recovered. Most of the cadets I walked through here never got a fourth try out of themselves.',
        ],
        master: [
          'And it folds. That is the part nobody writes down about people like you. Not that you never slip — but that a slip never gets to keep anything.',
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
        /**
         * …and then he keeps counting, every sixty tears, for ever. The number
         * is a parameter, so this bank never has a last line in it.
         * See MILESTONE_EVERY in src/meta/voice.js.
         */
        on: [
          '{n}. I said I would keep counting. I am a nine-hundred-year-old argument. I do not say things I will not do.',
          '{n} sealed. The record has stopped comparing you to cadets and started comparing you to weather.',
          '{n}. Somewhere under us a step that has held its breath since the fourth day has just let it out.',
        ],
      },
      /**
       * NIGHTS HELD (src/meta/days.js) — mornings on which something you knew
       * was still known. Rank, the last chapters and the coda are all paced
       * against this number, and Marlow now counts it out loud.
       */
      night: {
        n3: 'Three nights held. That is the number the old hands watch for. Anybody can be brilliant once.',
        n7: 'Seven nights held. A week of knowing it on waking. The shard has started to plan around you.',
        n14: 'Fourteen nights held. I have stopped writing "provisional" beside your name in the record.',
        n30: 'Thirty nights held. Thirty separate mornings the sky stayed up because of something you knew. I would call that a career.',
        on: '«n|one:# night held|other:# nights held». Still here, and still known. I have run out of ways to be surprised, and kept none of my doubts.',
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
      // src/ui P1 — "drive back" is coined here and glossed on the ORDERS
      // card (session.charter.goalPush). It cannot be glossed HERE: this string
      // is printed into `.sb-goal`, which ellipsises, and a definition with its
      // tail cut off teaches nobody anything.
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
        ahead: 'The rift is {n} m away, straight ahead.',
        left: 'The rift is {n} m away, off to your left.',
        right: 'The rift is {n} m away, off to your right.',
        behind: 'The rift is {n} m away, behind you.',
        here: 'You are standing in the rift.',
      },
      title: 'Orders',
      // THE ACTION FIRST. Every one of these opens on the verb, and the
      // words the card coins — a *line*, a *held* line — are glossed in the
      // same breath, because this card is the first surface that uses them.
      goalHold: 'Seal {tears} rifts on {skill}. A line is one idea and every rift that tests it. A held line never opens again.',
      goalHoldN: 'Seal {tears} rifts today. You then hold «n|one:# line|other:# lines» for good. A held line never opens again.',
      goalPush: 'Seal {tears} rifts on {skill}. To drive a line back is to win back ground on one that slipped.',
      goalAny: 'Seal {tears} rifts on this shard. Then we see what the lattice does about it.',
      willHold: 'should hold',
      willPush: 'ground gained',
      // Two short lines, and the second one is a promise rather than filler.
      // The old pair ran to four sentences of apology and named no action.
      eta: 'About «n|one:# minute|other:# minutes» at your pace. No clock runs here.',
      etaSeed: 'About «n|one:# minute|other:# minutes» — my guess, not yet yours. No clock runs here.',
      begin: 'Begin the run',
      // The return beat. Said only when the last run left a record.
      kickBack: 'Run {n} · back again',
      backHeld: 'Last time you sealed «n|one:# rift|other:# rifts». {skill} has held ever since.',
      backHeldN: 'Last time you sealed {tears} rifts. «n|one:# line has|other:# lines have» held ever since.',
      backNone: 'Last time you sealed «n|one:# rift|other:# rifts». All of it still stands.',
    },
    close: {
      kick: 'Run {n} · closed',
      titleHeld: 'The line holds',
      titleMet: 'The shard is quiet',
      titleEnough: 'Enough for today',
      tears: '«n|one:rift sealed|other:rifts sealed»',
      heldLab: 'Held',
      groundLab: 'Ground gained',
      heldNote: 'You proved it with no help, at the top difficulty band, and with no worked examples. The line is yours now.',
      groundNote: 'Down to «n|one:# rift|other:# rifts» from holding — {d} closer than when the run opened.',
      groundNoteFlat: '«n|one:# rift|other:# rifts» from holding by the shortest road. Today bought the ground under it rather than the last step onto it.',
      groundNoteFar: 'A long line. The line moved today, and it moved the right way.',
      groundNoneStrong: 'Nothing new to hold',
      groundNone: 'Everything you touched today was already yours.',
      openedLab: 'Opened',
      openedNote: 'A new line of rifts, open to you.',
      chapterNote: 'The record turns a page.',
      rankNote: 'The order has revised its estimate of you.',
      openedNoneStrong: 'The lattice, unchanged',
      openedNone: 'Nothing opened today. Long lines cost exactly that, and long lines are the ones worth having.',
      nextLab: 'Next',
      nextNote: 'About «n|one:# minute|other:# minutes» of work, on the highest-leverage line still open. We start there.',
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
      nightsNoneNote: 'Come back tomorrow. The lattice re-checks what you hold. Nothing else earns a night.',
      nextDone: 'Nothing is open here any more. Step nine holds.',
      sign: 'You lose none of this. The lattice keeps what you proved, and it will still stand when you come back.',
      signWorked: 'Nobody grades this, and you lose nothing. Next time we open on the line you were working. The line will be exactly where you left it.',
      signHeld: 'That line does not rot, and it does not reset. Everything above it is now within reach.',
      rest: 'Stand down',
      more: 'One more line',
      aria: 'Run closed. «n|one:# rift|other:# rifts» sealed.',
      // A run that sealed nothing leads with the work instead of with a
      // screen-height zero, and the rows below say what the work bought.
      workedLab: '«n|one:question worked|other:questions worked»',
      workedSub: 'None of them sealed. The shard does not count attempts, and neither do I. But the work bought something, and the rows below say what.',
      ofWorked: 'from «n|one:# question worked|other:# questions worked»',
      echoStrong: '«n|one:# worked solve|other:# worked solves»',
      echoNote: 'A miss is what buys one. Each opened at the exact step your answer went sideways, not at the top of the page.',
      bandStrong: 'The bank re-cut',
      bandDown: 'Questions now open at difficulty band {n} — where you actually are. The bar for holding the line has not moved a millimetre.',
      bandUp: 'Questions now open at difficulty band {n}. You pushed the bank up today, not the other way round.',
      groundNoteBack: '«n|one:# rift|other:# rifts» from holding by the shortest road. Further out than at the start. One missed gate item sends the proving run back to step one. The gate is strict. You are not slow.',
      moreLast: 'One more stretch is all the window has left. After that we stop, and stopping on time is the part that makes tomorrow worth anything.',
      capped: 'You have reached the twenty-five minutes this loop runs on. Another stretch today is worth less than the same stretch tomorrow. Not encouragement — that is how spaced practice works.',

      // --- states where this card could contradict its own neighbour ------
      // Each of these exists because a clause on one block was being printed
      // beside a block that made it false. See src/session/resolution.js.
      groundIdleStrong: 'Nothing worked',
      groundIdle: 'No question reached an answer this run. You spent nothing and you lost nothing. The shard is exactly where you left it.',
      openedHeldNoneStrong: 'Nothing above it, yet',
      openedWholeNoneStrong: 'The lattice, complete',
      openedWholeNone: 'Nothing is left on this shard to open. The work does not end here. The map does.',
      openedHeldNone: 'A line can be worth holding and still open nothing that day. A held line does not always reach the next thing along.',
      signHeldQuiet: 'That line does not rot, and it does not reset. Nothing further up the lattice came within reach today. The lattice is a web, not a staircase. You have banked the line for good.',

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
      // A charter in hand is a thing to go and do, so this row says the key
      // rather than the definition. It is the one place the card can name an
      // action the learner can take in the next ten seconds.
      charterHaveNote: 'Press H where you want a waystation. Motes pay the rest.',
      charterStrong: 'The next charter',
      charterNote: 'Cut by depth, and depth only moves when a line held yesterday still holds today. {n} deeper cuts the next.',
      stationStrong: '«n|one:# waystation standing|other:# waystations standing»',
      stationNote: 'Stand at one, press H, and you are at the next. Two is a route; four is a different island.',
      stationStrongNone: 'The first waystation',
      // The charter row above already says what to press and what it costs, so
      // this row says what the thing IS. Two short sentences: the card holds
      // four rows above the fold and this one used to eat three lines.
      stationNoteNone: 'A permanent tower of rising air, and a place you can step to. There is no last one.',
      signWhole: 'Ten lines, all held. None of them rots while you are gone. What is left is how deep you can go. And how much of this island you can make one step wide.',
    },
    rest: {
      say: 'Stand down. Look at something far away — the far range will do. Breathe with the ring. Four counts in. Hold for two. Six out.',
      skip: 'Back to the shard',
      endKick: 'Shard Nine',
      endTitle: 'Holding',
      endBody: 'Rested. The rig wrote down everything you proved. The sky is where you left it.',
      endBodyNext: 'Rested. The rig wrote down everything you proved. Next time we open with {skill}.',
      again: 'Another run',
      off: 'Close the channel',
      signOff: 'Channel closed. The lattice holds while you are gone, and I will keep the light on. Same sky tomorrow, cadet.',
      wakeUp: 'Open the channel',
      aria: 'Break. Breathe with the ring. Nobody wants anything from you.',
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
    recordSub: 'What this claim is worth, said plainly. A teacher checks these figures. The last one is the uncomfortable one.',
    foot: 'Nothing here is a stored grade. This report recomputes every live figure from the learner model each time it opens. Behind a held line sits the receipt written when the claim was granted, and that receipt never moves. Open a line to see it.',

    stat: {
      ofN: 'of {n}',
      mastered: 'Lines held',
      masteredNote: 'Proved, not merely attempted.',
      time: 'Time on task',
      // Two clocks, and they are meant to differ. This is the smaller one.
      timeNote: 'Measured between answers and capped, so idling never counts as work. It is not the session clock, and it is meant to read lower than it.',
      session: 'This session',
      sessionNote: 'How long you have been sitting here: real time, from when you started, including walking and reading. A session runs 15–25 minutes, then stops cleanly.',
      items: 'Questions answered',
      itemsNote: 'Each one generated fresh and re-solved by machine before you saw it.',
      accuracy: 'Solved unaided',
      accuracyNote: 'Correct first time, with no hint and no worked example, out of every question answered.',
      hollow: 'Claims withdrawn',
      hollowNote: 'This engine took back {n} of {of} mastery claims after a cold re-test.',
      hollowNone: 'No mastery claimed yet. Nothing to check.',
      ofHeld: 'of {n} held',
      sight: 'Opened cold',
      // What this tile counts is the ROAD, not the run. The first question on
      // the line was answered cold and that opened the proving run; whether the
      // run then went straight through is on the line's own card. Counting the
      // road and describing the run was one of the contradictions.
      sightNote: 'On these lines the very first question was answered cold, at the top of the bank, with nothing taught in front of it. Same claim, fewest questions this engine accepts. Open a line to see whether its proving run went straight through. Cold re-tests come soonest for these.',
      sightNone: 'No line was opened cold. Every claim here came after practice.',
      timeUnknown: 'Not measurable. Part of this record came back without its ledger, so the minutes before that are gone. The report shows them as unknown, not as zero.',
      accuracyUnknown: 'Not measurable on a restored record. The model remembers the questions, but not which ones you answered without help.',
    },

    trust: {
      head: {
        reconstructed: 'This record is incomplete',
        foreign: 'We threw away a ledger from another record',
      },
      note: {
        reconstructed: 'Part of this record is missing. The learner model and the evidence ledger live in separate stores, and one came back without the other. The model rebuilt {n} questions and {claims} mastery claims, so nothing is under-reported. Time on task and unaided accuracy from before the break are gone. The report shows them as unknown, not as zero.',
        foreign: 'This ledger belonged to a different learner. The rig threw it away rather than merge it. Question counts and claims come from the learner model instead. The minutes and the unaided rate start again from here.',
      },
    },

    // A flag, not a state. See `underReopened` in src/report/index.js: the
    // claim on this line stands, and a line it was built on has gone back to
    // being practised after a missed cold re-test.
    flag: { under: 'Ground reopened' },
    flagNote: { under: 'You still hold this line. A line underneath it missed a cold re-test and has gone back to practice, so the rig is re-proving the ground before it sends you back up here.' },

    road: {
      sight: 'Tested out',
      fast: 'Short road',
      long: 'Long road',
    },
    roadNote: {
      // It used to end "Three unassisted items, no practice in front of them",
      // which is the gate's setting quoting itself and was untrue of every run
      // that absorbed a miss. The count lives on the card, where it is read off
      // the receipt.
      sight: 'Opened cold: the first question on this line was answered at the top of the bank, with nothing taught in front of it, and it counted as the proving run’s first question. Open the line for what the run then cost.',
      fast: 'One clean solve with no help, at the gate band, opened the proving run. Fewer items than the long road, and each one harder.',
      long: 'Opened the proving run the long way: three clean unassisted solves and a posterior at the full threshold.',
    },

    next: {
      head: 'Next',
      why: {
        fresh: 'New ground. You already hold everything under it.',
        continue: 'Unfinished. Staying here is worth more than moving on.',
        check: 'One proving run away — clean answers, no help, harder than usual.',
        // Read off the live run, not off the gate's default. A run that absorbed
        // a miss or extended itself needs more than three, and this card said
        // three while the evidence rows below it said five.
        checkLeft: 'The proving run is live: «n|one:# clean answer to go|other:# clean answers to go», no help, harder than usual.',
        review: 'Due for a cold re-test. The claim has to earn its place again.',
        enrich: 'You hold everything that is open. This line goes deeper instead.',
      },
      built: 'Standing on «n|one:# line you already hold|other:# lines you already hold».',
      start: 'The first line. Nothing comes before it.',
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
      locked: 'This line needs another line first, and you do not hold that one yet.',
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
      posteriorNote: 'How sure the model is that you know this line. The figure counts unassisted answers only, and it needs {need}.',
      clean: 'Clean run',
      cleanNote: 'Correct in a row, with no help, at difficulty band {band} or above.',
      proving: 'Proving run',
      provingNote: 'Unassisted, support switched off, band {band} or above, drawn from the forms you have practised least.',
      prereq: 'Prerequisites',
      prereqNote: 'Held before this line opened: {list}.',
      prereqRoot: 'Nothing comes before this line.',
      noPrereq: 'none needed',
      retention: 'Held on re-test',
      retentionNote: 'Cold re-tests come round on an expanding schedule. Miss two and the claim is withdrawn.',
      probeCount: '{hit} of {n} held',
      probeNone: 'none due yet',
      // A line nobody has asked a question about. The model still holds an
      // opening belief, read off the lines underneath — a plan for where to
      // start, not a reading of this learner. It is not printed as a
      // percentage, because a percentage is what a measurement looks like.
      posteriorNone: 'Nothing has been asked on this line yet, so there is nothing measured to be sure about. The model opens it at a level read off the lines underneath. That is a starting point, not evidence.',
      coldVal: 'cold, band {band}',
      cleanSight: 'None needed. This line proved out on first contact. The cold item is the proving run’s own first item, and the row below counts it once.',
      // The same road, and a different story. Passing the cold item opens the
      // run; it does not finish it. A run that then stumbled and paid for it is
      // still a claim — on more unassisted evidence, not less — but it did not
      // prove out on first contact, and the card said it did.
      cleanSightCharged: 'The first question on this line was answered cold, at band {band}, with nothing taught in front of it — that is what opened the proving run. The run then «n|one:missed once|other:missed # times» and paid for it in extra unassisted questions.',
      cleanSightOld: 'The first question on this line was answered cold, at band {band}, and that opened the proving run. This receipt is from an earlier build and does not record how the run itself went.',
      cleanRoad: {
        long: 'Three in a row, unassisted, at difficulty band {band} — the long road to the proving run.',
        fast: 'One clean solve with no help, taken at difficulty band {band} — the gate band itself. The short road asks for fewer items, and harder ones.',
      },
      provingExtended: 'Unassisted, support off, band {band} or above. The run extended itself by {n} to span a second surface and a modelling item.',
      provingCharged: 'Unassisted, support off, band {band} or above. The run «n|one:absorbed one miss|other:absorbed # misses» and charged itself extra unassisted questions for it, so it closed on more evidence than a clean run, not less.',
      noReceipt: 'not recorded',
      noReceiptNote: 'This claim was granted by an earlier build that kept no record of what proved it. It is reported as unevidenced rather than reconstructed from the settings — a threshold quoting itself is not evidence.',
      rests: 'This claim rests on {n} unassisted items, out of {of} questions answered on this line.',
      // The denominator a claim is allowed to be measured against: what was
      // asked before it was granted. Anything asked afterwards is on the next
      // line, because a claim cannot rest on a question it never saw.
      restsSplit: 'This claim rests on {n} unassisted questions, taken across the {of} questions asked on this line before it was granted.',
      sinceClaim: '«n|one:# question has|other:# questions have» been answered here since, on a line already held: {pct} of them unaided. That is practice and re-testing. It is not what the claim was granted on.',
      sinceNone: 'No question has been asked on this line since the claim was granted.',
      restsUnknown: 'This build did not record the items behind the claim. You have answered {of} questions on this line.',
      grantedOn: 'Granted {date}.',
    },

    fact: {
      time: 'Time on this line',
      items: 'Questions here',
      // The split that makes the figure readable. A lifetime total under a
      // claim can be read two opposite ways — thin claim, or practice on a held
      // line — and printing it without the split let a reader pick either.
      itemsSplit: '{n} — {before} before the claim, {since} since',
      accuracy: 'Solved unaided',
      accuracyOf: '{all} — {n} of {of}',
      accuracySplit: '{all} — {n} of {of}. Before the claim {before}, since {since}',
      band: 'Difficulty band',
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
        core: 'Core: this line teaches the standard, and the mastery gate tests it.',
        supporting: 'Supporting: items aimed at another standard exercise it too. No gate of its own.',
        introduced: 'Introduced: a first, partial encounter on purpose. A later level completes it. Not a claim to have taught it.',
        unknown: 'This citation records no coverage depth.',
      },
      depthSum: '{n} of {of} citations on this line are core claims: this line teaches the standard, and the gate tests it. The rest support it, or introduce it.',
      depthNoCore: 'None of the {of} citations here is a core claim. This line supports them, or introduces them. Another line carries them. Holding this line is not a claim to have taught them.',

      // The framework switch. One choice, and the whole report re-expresses
      // itself — the lines, the coverage, the evidence and the exports.
      frame: {
        pick: 'Report against',
        pickHint: 'Choose the framework this report speaks in. This device keeps your choice.',
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
          ccss: 'We quote each code without its long CCSS prefix.',
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
          held: 'You hold every line that carries this expectation.',
          part: 'You hold some of the lines that carry this expectation, and not the rest.',
          indirect: 'You hold the line that carries this expectation. You have met no question type that carries it.',
          working: 'You have answered questions here. No line holds yet.',
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
        thin: 'Every held line here tested out on first sight. That road gives the least evidence this engine accepts.',
        unevidenced: 'A proved line here carries no receipt. An earlier build granted the claim and recorded nothing.',
        caveatHead: 'What we claim, and what we do not',
        processHead: {
          ccss: 'Standards for Mathematical Practice',
          teks: 'Process standards',
        },
        processNote: 'These standards run across every line. The count is the number of lines you hold.',
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
      stdFoot: 'This sheet recomputes coverage from the learner model every time it opens. A question type counts only after this student answers one. A line counts as held only after a proving run with no help, at the gate band.',
      withdrawnHead: 'Claims this engine took back',
      withdrawnRow: '{skill} — withdrawn {date}',
      byLineHead: 'Where the class stands, line by line',
      classTitle: 'Class record',
      classSub: '{n} student records · assembled {date}',
      classEmpty: 'No student records yet. Each student exports their own record from this screen; add the files here and they stay on this device.',
      classFoot: 'Assembled from records the students exported themselves. Nothing was uploaded, and this list lives only in this browser — clearing site data clears it.',
      claimItemsShort: '{n} unassisted items at band {band}',
      claimMissed: '«n|one:absorbed one miss|other:absorbed # misses»',
      claimReps: 'across {n} representations',
      claimRegrant: 're-earned after a withdrawal',
      foot: 'Record {id} · {n} observations. None of this is a stored grade. This sheet recomputes every figure from the learner model and the evidence ledger on this device. A line is held only after a proving run with no help, at the gate band. Two failed cold re-tests withdraw the claim again.',
      trust: {
        verified: 'verified',
        reconstructed: 'reconstructed',
        foreign: 'rebuilt',
      },
      trustNote: {
        verified: 'Both halves of this record — the learner model and the evidence ledger — agree, question for question.',
        reconstructed: 'Restored from a partial save. The model rebuilt the question counts and the claims, so nothing is under-reported. Time on task and unaided accuracy from before the break are not recoverable. The record reports them as unknown, not as zero.',
        foreign: 'The ledger on this device belonged to a different record. The rig threw it away rather than merge it. Everything here comes from the learner model alone.',
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
        // The two denominators that make the column beside it readable in a
        // gradebook, where there is no tooltip to say which side of the claim
        // a question fell on.
        itemsAtClaim: 'Questions before the claim',
        itemsSinceClaim: 'Questions since the claim',
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
      // Level 2 (content/graph/algebra1-l2.json).
      'bracket-both-sides': 'A bracket on each side is still one balance: open both, then gather.',
      'fraction-solve': 'A division comes off like any other operation: multiply both sides by what is underneath.',
      'rule-from-table': 'A table with even steps hides one rule. Find the rate and the rest follows.',
      'inequality-one-step': 'An inequality is a balance that leans. Only a negative divide turns the lean round.',
      'inequality-two-step': 'Unwrap a lean in reverse: the loose number first, then the coefficient.',
      'inequality-multi-step': 'Gather the unknown on the side that leaves a positive coefficient, and the sign never turns.',
      'compound-inequality': 'Two statements at once describe a band. Every move happens to all three parts.',
      'literal-equations': 'A formula is an equation whose numbers have not arrived. Solve it for any letter.',
      'ratio-proportion': 'Two ratios agree when one is a copy of the other. Multiply across the bars.',
      'slope-rate': 'Rate is the climb divided by the step across, and it is the same everywhere on one rule.',
      'graph-linear': 'A rule and a trace are one thing said twice: the rate is the climb, the start is the crossing.',
      'write-linear': 'Two readings are enough to write a rule: the rate from the climb, the start from the axis.',
      'system-substitution': 'When one statement says what a letter is, put it straight into the other.',
      'system-elimination': 'Add two true statements and the result is true. Line one letter up so it leaves.',
    },

    slip: {
      // Level 2 slips.
      'boundary-slip': 'Gets the boundary value in or out by one',
      'flip-always': 'Turns the inequality sign after every move',
      'flip-not-needed': 'Divides by a negative and leaves the sign alone',
      'band-reversed': 'Writes the band with its ends the wrong way round',
      'slope-intercept-swap': 'Swaps the rate with the starting height',
      'run-over-rise': 'Divides the step across by the climb',
      'subtract-not-add': 'Subtracts the two statements instead of adding',
      'add-not-subtract': 'Adds the two readings instead of subtracting',
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
      'wrong-unwrap-order': 'Unwraps in the order that built the expression',
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
    // src/ui P1 — this is a PRICE, printed into `.kit-chip em` in a strip that
    // does not wrap on a phone. "A night held" is glossed on the charter card
    // below, which is prose and has the room for it.
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
    charterNext: 'Seal {tears} rifts on {skill}. A line is one idea and every rift that tests it. Hold this line and {grant} is yours.',
    charterOpen: 'Seal {tears} rifts on {skill}. The kit is already all yours. What is left is the island.',
    vault: {
      name: 'Vault plate',
      short: 'Plate',
      what: 'A fifth piece for the lattice. Stand on one and it throws you twelve metres straight up.',
      gist: 'it throws you twelve metres straight up',
    },
    flare: {
      name: 'Updraft flare',
      short: 'Flare',
      what: 'F — light a column of rising air under your own boots, anywhere, for six seconds.',
      gist: 'six seconds of rising air, wherever you stand',
    },
    kite: {
      name: 'Kite trim',
      short: 'Trim',
      what: 'The wing flies flatter, faster and turns harder. Valleys you could not cross are now one glide.',
      gist: 'the wing flies flatter, faster, and turns harder',
    },
    reserve: {
      name: 'Deep reserve',
      short: 'Reserve',
      what: 'The lattice reserve more than doubles, and refills half again as fast.',
      gist: 'twice the lattice reserve, and it refills faster',
    },
    legs: {
      name: 'Storm legs',
      short: 'Legs',
      what: 'A faster sprint, a higher jump, and the dash comes back in half the time.',
      gist: 'a faster sprint, a higher jump, a quicker dash',
    },
    sight: {
      name: 'Resonant sight',
      short: 'Sight',
      what: 'Drift motes lean toward you. You can read a hanging cache from twice as far out.',
      gist: 'motes lean toward you, and you read caches further out',
    },
    beacon: {
      name: 'Standing beacon',
      short: 'Beacon',
      what: 'G — ninety motes plants a column of rising air that is still standing tomorrow. The only thing you can do to this island that lasts.',
      gist: 'a column of rising air that is still there tomorrow',
    },
    windstep: {
      name: 'Windstep',
      short: 'Windstep',
      what: 'The dash comes back while your boots are off the ground. Three of them will cross a gap the wing cannot.',
      gist: 'the dash comes back while your boots are off the ground',
    },
    span: {
      name: 'Long span',
      short: 'Span',
      what: 'The wing again, flatter and faster still. From the high ridge you can now reach the far coast without touching down.',
      gist: 'the wing again, flatter and faster still',
    },
    array: {
      name: 'Plate array',
      short: 'Array',
      what: 'The vault plate throws you a third higher and costs six motes instead of eighteen. Plates become a staircase.',
      gist: 'the plate throws higher and costs a third as much',
    },
    squall: {
      name: 'Squall flare',
      short: 'Squall',
      what: 'The flare costs sixteen, stands seventy-four metres tall and holds for eleven seconds.',
      gist: 'a taller flare that holds for eleven seconds',
    },
    deepwell: {
      name: 'Deep well',
      short: 'Well',
      what: 'The lattice reserve reaches three hundred and refills twice as fast. Bridge a canyon in one run.',
      gist: 'a reserve of three hundred, refilling twice as fast',
    },
    // --- the endgame: the rung that is a rate rather than a rung ---------
    station: {
      name: 'Waystation',
      short: 'Station',
      what: 'H — raise a waystation: a permanent tower of rising air. Travel between any two of them. Costs one charter and two hundred and forty motes.',
      gist: 'a permanent tower, and a place you can step to',
    },
    charter: {
      name: 'A waystation charter',
      what: 'A night held is a line you still knew after you walked away. Hold what you hold across one and the lattice cuts you another charter.',
      gist: 'a pass for one tower',
    },
    chartersHeld: '«n|one:# charter|other:# charters» · {cost}',
    charterIn: '{n} deeper',
    needCharter: 'No charter. {n} more depth cuts the next one',
    // A charter the wardens paid for, not the depth ladder (src/world/warden.js).
    charterWon: 'Charter earned. You hold «n|one:# charter|other:# charters». A waystation costs {cost} motes and one charter.',
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
      /* "Hold it and Kite trim is yours" named a reward that the game only
         explains on the card you get AFTER you win it — so the sentence that
         is supposed to make you want the thing is the one sentence that cannot
         say what the thing is. `{gist}` is the short form of `kit.<id>.what`,
         carried here by src/meta/objective.js. Name and meaning, one breath. */
      kit: 'Hold it and {name} is yours — {gist}.',
      calm: 'Seal it and the surges here stop for good.',
      sound: 'You hold this line. A sounding walks back down it, one harder question at a time.',
    },

    /* THE ROW UNDER THE PIPS, AND THE WORD *HELD*.
     *
     * This row used to open a fresh save with "HELD MEANS PROVED FOR GOOD",
     * which is a definition of a word that appears nowhere else on the card
     * and that the player has not read once. A cold critic read it as a rule
     * about nothing, and they were right: a definition that arrives before its
     * term is not teaching, it is a riddle.
     *
     * Three states now, and the word arrives exactly when it first means
     * something (src/meta/guide.js picks):
     *   held 0  — nothing is held, so nothing is called held. The row says
     *             what the marks above it are.
     *   held 1  — the first line has just been held, and the word and its
     *             meaning arrive in one breath. It spends its whole line on
     *             that and drops the other two counts: the pips directly above
     *             already draw held, open and locked as colour, and a row that
     *             wraps "PROVED FOR / GOOD" has taught nobody anything.
     *   held 2+ — the three counts. The word is known.
     */
    tally: '{held} held · {open} open · {locked} locked',
    tallyNew: 'One mark for each rift on this line',
    tallyFirst: '{held} held — proved for good',

    prompt: {
      open: 'Open the rift',
      sound: 'Sound this line — harder questions',
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
      rift: 'That ring is a rift. Walk in and it shows you a statement. Make it true and the hole closes.',
      surge: 'That ring of light is a rift surge. It knocks motes loose and takes your footing. Jump it.',
      mote: 'Cipher motes: loose lattice, where the ground bled. Run through them. The foundry buys kit with them.',
      charged: 'Gold motes grew beside an open rift. Each pays three times a pale one. Seal it and the surges stop.',
      husk: 'Husks are veins you emptied. Each lights up again in about five minutes. Range further out.',
      anchor: 'A lattice anchor. Nothing reaches one from flat ground, on purpose. Stack two ramps, then touch it.',
      cache: 'A hanging cache. The beam holds a true statement with one weight missing. Stand on the missing weight.',
      updraft: 'That column is an updraft. Fly into it and it lifts you sixty metres, free.',
      verge: 'That curtain is the verge, where Shard Nine stops. Hold all ten lines and the lattice carries you out.',
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
    hailNone: 'Where motes buy things',
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
    beacon: { what: 'A column of rising air that still stands tomorrow. Plant it where you like. Nothing else you do to this island lasts.' },
    plate: { what: 'A fifth piece for the lattice. Stand on one and it throws you twelve metres straight up.' },
    station: { what: 'A tower of rising air, and also a place. Stand at one, and step out of any other.' },
  },

  field: {
    moteTake: '+{n} motes',
    updraft: 'Updraft',
    surge: 'Rift surge — jump the ring',
    // A surge costs footing and nothing else. It used to take nine motes, and
    // a critic who roamed for five minutes paid fifteen of them for it.
    surgeRead: 'Surge read · +{n} motes',
    surgeWarn: 'The tear is gathering — get off the ground',
    balanceLock: 'Balance lock',
    balanceNo: 'The beam refuses it',
    balanceReset: 'The weights re-form',
    cacheOpen: 'Cache broken open — {n} motes, and the air here rises for good',

    // --- the wardens (src/world/warden.js): the fifth day -------------------
    // A name plate, not a sentence: it has to fit a phone held sideways. The
    // one instruction is said once, on the first fan, by `wardenFan`.
    wardenTag: 'Warden',
    wardenFan: 'Run into the correct weight',
    wardenOver: 'Too big by {n}',
    wardenUnder: 'Too small by {n}',
    wardenBound: 'Warden bound — {n} motes. It is coming apart.',
    deepOpen: 'Deep cache open — {n} motes, and the air here rises for good',

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
    brink: 'The shard ends here. There is nothing under it.',
    // --- the survey (src/world/errand.js): the marks on the landmarks -------
    surveyClaim: 'Survey mark claimed · {name} — +{n} motes, and the air here rises for good',
    markFind: 'Survey mark · {name}',
    markHeld: 'Surveyed · {name}',
    vergeHit: 'The verge holds. Shard Nine ends here — the far shards are a crossing nobody has made.',
  },
  // --- the survey marks (src/world/errand.js). Proper names: each one is a
  // silhouette that was already standing in this world, and the mark is the
  // reason to walk to it. `said` is Marlow, once, when it is claimed. ---------
  survey: {
    reckoning: 'The Reckoning',
    ossuary: 'The Ossuary',
    watchtower: 'The Watchtower',
    cathedral: 'The Cathedral',
    arch: 'The Glass Arch',
    spine: 'The Spine',
    said: {
      reckoning: 'Something here still keeps count. We never learned of what. The air over it rises now — that is a road, and it stays.',
      ossuary: 'A colony ship, two hundred years down. It is still, technically, on schedule.',
      watchtower: 'They watched the gulf from this head of stone. Now you can leave from it.',
      cathedral: 'The grove below is a seedling of this. Everybody should stand under it once.',
      arch: 'The lake leaves the world here. The arch was already old when it started.',
      spine: 'The highest ground on Shard Nine. Everything else is under you now.',
    },
  },
  // --- the relay (src/meta/relay.js): what the world says the moment a stint
  // of three items ends and the card really closes. One destination. ----------
  relay: {
    toTear: 'Next line · {skill} — {n} m',
    toMark: 'Survey mark · {name} — {n} m',
    stay: 'This line is still the best use of your time. Step back onto the plate when you are ready.',
    rhythm: 'A tear gives three questions, then it settles. Use the gap — there is always something out there worth the walk.',
  },
  // --- the affordance layer (src/world/afford.js): what a rift says it will
  // do, the key that does it, and the bearing to the next one -------------
  afford: {
    open: 'Open the rift',
    walkIn: 'Walk into it',
    sound: 'Sound the line — harder questions, same line',
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
    /**
     * THE BALANCE AFTER THE MOVEMENT. Printed on every line, so the sum is
     * never a guess.
     *
     * This key was `left`, and the strip read `+4 · Rift sealed · 39 left`. A
     * cold player watched it go 2 left, 6 left, 10 left, 13 left, 39 left and
     * wrote: *"a number called 'left' that only goes up is not a number."* They
     * were right. The figure was always the wallet balance — correct, useful,
     * and wearing the name of a countdown. In English "left" means what remains
     * of something being used up, so a wallet that grows contradicts its own
     * label on every line it prints. The number did not change. The noun did.
     */
    balance: 'balance {n}',
    /** A levy that found too little to be worth taking. See LEVY_SHARE. */
    spared: 'Too few motes to knock loose',
    /**
     * The day's assay is spent (src/kit/ledger.js). Said once a day, and only
     * to somebody who has worked the ground past a full sitting's worth. Point
     * first, then the one thing to do about it.
     */
    thin: 'The seams here run dry until tomorrow. Sealed rifts still pay in full.',
    /**
     * The descent has already been this deep today (src/kit/kit.js). Said once
     * a day. It names the one action that pays in full again.
     */
    deep: 'The descent pays for new depth. Go deeper, or come back tomorrow.',
    /**
     * FIRST SIGHT — a reason that says what it means, once, ever.
     *
     * src/ui P1. The cold critic's list of words this game uses and never
     * defines ended with the sharpest one: "+5 DESCENT is printed as a reward
     * reason and defined nowhere." CIPHER VEIN, LATTICE ANCHOR, HANGING CACHE
     * and RIFT SURGE were in exactly the same position — five nouns coined by a
     * receipt, at 0.54rem, to somebody ninety seconds into their first session.
     *
     * The critic also named the fix, because the game already did it once and
     * did it well: "held means proved for good" on the objective card. Term and
     * meaning in one breath the first time; the bare term every time after.
     * src/kit/ledger.js prints one of these the first time each reason appears
     * and never again, and remembers it across the session break.
     */
    first: {
      seal: 'Rift sealed — the statement is true now, and the hole in the world closes.',
      assist: 'Sealed with a worked example. It counts. The next one is yours alone.',
      vein: 'Cipher vein — loose lattice you can run through and keep.',
      cache: 'Hanging cache — a balance you open by standing on the missing weight.',
      anchor: 'Lattice anchor — a fixed point of the proof, hung out of reach on purpose.',
      sound: 'Descent — a run back down a line you already hold, one harder question at a time.',
      bind: 'Warden bound — you ran down the construct and took the weight that made its statement true.',
      deepcache: 'Deep cache — a hanging cache with an unknown on both pans. A warden left it there.',
      surge: 'Rift surge — the ring an open rift throws out. Jump it, or it costs you motes.',
      vault: 'Vault plate set — stand on it and it throws you twelve metres straight up.',
      plate: 'Vault plate bought — a fifth piece for the lattice.',
      flare: 'Updraft flare — a column of rising air under your own boots.',
      beacon: 'Standing beacon — rising air that is still here tomorrow.',
      station: 'Waystation raised — a stop that stays on the map.',
    },
    why: {
      // earned
      seal: 'Rift sealed',
      assist: 'Sealed with a worked example',
      vein: 'Cipher vein',
      cache: 'Hanging cache',
      anchor: 'Lattice anchor',
      sound: 'Descent',
      bind: 'Warden bound',
      deepcache: 'Deep cache',
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
