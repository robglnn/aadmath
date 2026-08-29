export default {
  meta: {
    name: 'Español',
    code: 'es',
    title: 'ASCENT — Los Mundos Cifrados',
    sub: 'LOS MUNDOS CIFRADOS',
    description: 'ASCENT — Los Mundos Cifrados. Una isla flotante, un ala y diez grietas que sostiene un álgebra que todavía no es verdadera.',
  },

  boot: {
    tip: 'Vinculando tu firma de cadete al Fragmento Nueve…',
    enter: 'Pulsa cualquier tecla para empezar',
  },

  hud: {
    rank: 'Rango',
    shards: '«n|one:Mota de cifra|other:Motas de cifra»',
    mastery: 'Mundo reparado',
    build: 'Construir',
    objective: 'Objetivo',
    language: 'Idioma',
    // «COBRE RANGO» son dos sustantivos amontonados; en español la etiqueta va
    // delante del valor que etiqueta.
    capOrder: 'before',
    readout: 'Mundo reparado {pct} · rango {rank} · {n} {shards}',
  },

  // Audio (src/audio). Claves añadidas, propiedad de la capa de sonido.
  audio: {
    label: 'Sonido',
    on: 'Sonido activado',
    off: 'Sonido desactivado',
    mute: 'Desactivar el sonido',
    unmute: 'Activar el sonido',
    hint: 'M',
  },

  rank: {
    copper: 'Cobre',
    bronze: 'Bronce',
    silver: 'Plata',
    gold: 'Oro',
    sovereign: 'Soberano',
  },

  build: {
    wall: 'Muro',
    ramp: 'Rampa',
    floor: 'Suelo',
    beam: 'Viga',
    placed: 'Colocado',
    denied: 'Ahí no hay apoyo',
    charge: 'Carga de obra · se rellena sola',
    // The number beside the gauge is pieces standing, not charge left.
    pieces: '«n|one:# pieza puesta|other:# piezas puestas»',
    keySet: 'CLIC IZQ · colocar',
    keyTurn: 'F · girar',
    keyClear: 'Q · quitar',
    turn: 'Girar',
    // --- que tu propia red nunca te deje encerrado (src/build/builder.js) ---
    sealDoor: 'Este muro cierra la sala y llevará una puerta.',
    doorCut: 'Sala cerrada. Ese muro tiene una puerta.',
    boxedIn: 'Tu red te ha dejado encerrado',
    cutFree: 'Ya tienes salida',
    cutKey: 'Q',       // i18n-allow: a keycap, and the same cap on every layout
    cutKeyPad: 'LB',   // i18n-allow: the console's own name for that shoulder
    remove: 'Quitar',
    removePrompt: 'Q · quitar',
    noCharge: 'Carga de obra agotada. Espera a que se rellene.',
    alreadyThere: 'Ahí ya hay algo construido. Mira arriba para construir más alto.',
    nothingThere: 'No hay nada en la mira',
    latticeFull: 'La red está al límite: quita antes una pieza',
    anchorCall: 'Tres anclas cuelgan sobre la plaza. Nada del suelo llega hasta ellas. Así que deja de quedarte en el suelo.',
    anchorGot: 'Ancla {n} de {total} asegurada',
    anchorAll: 'Las tres anclas aguantan. Ya la red tiene columna.',
    balance: 'Balanza',
    balanceLaw: 'Lo que hagas de un lado, hazlo del otro',
    areaModel: 'Modelo de área',
    // --- el equipo: una pieza que se compra, no que se regala ---
    vault: 'Placa de impulso',
    noShards: 'No tienes motas suficientes para esa pieza',
    fixed: 'Eso no es tuyo para deshacerlo',
    // --- primer contacto: la mano de retícula empieza guardada (src/build) ---
    handOut: 'Mano de construcción lista',
    handStowed: 'Mano de construcción guardada. Pulsa del 1 al 4 para elegir una pieza',
  },

  learn: {
    riftTitle: 'Grieta {n} — {skill}',
    prompt: 'Estabiliza la grieta',
    submit: 'Sellar',
    hint: 'Pregunta a Marlow',
    check: 'Comprobar',
    correct: 'La línea aguanta.',
    incorrect: 'Todavía no es verdad. Míralo otra vez.',
    close: 'Cerrar',
    yourAnswer: 'Tu respuesta',
    tapToType: 'Escribe un valor',
    mastered: '{skill} — dominado',
    unlocked: 'Nueva línea de grietas abierta: {skill}',
    streak: '{n} «n|one:seguida|other:seguidas»',
  },

  marlow: {
    greet: 'Marlow. Inteligencia de navegación, ligeramente averiada, sincera casi siempre. Y tú tienes rango de cadete, por lo visto.',
    firstRift: 'Ese anillo de aire desgarrado es una grieta. La sostiene una afirmación que todavía no es verdadera. Hazla verdadera y se cierra. Sencillo. Aterrador. Adelante.',
    balance: 'Los dos lados de esa viga cargan el mismo peso. Lo que le hagas a uno, hazlo al otro, o se inclina.',
    encourage: 'Mal, pero mal de una forma útil. Así funciona casi toda la ciencia.',
    nearMastery: 'Aquí la red está casi entera. Una más y se abre todo este tramo de cielo.',
  },

  skills: {
    'var-meaning': 'Leer una variable',
    'eval-expr': 'Evaluar expresiones',
    'order-ops': 'Jerarquía de operaciones',
    'like-terms': 'Reducir términos semejantes',
    'distribute': 'La propiedad distributiva',
    'one-step-add': 'Ecuaciones de un paso (+ −)',
    'one-step-mul': 'Ecuaciones de un paso (· :)',
    'two-step': 'Ecuaciones de dos pasos',
    'multi-step': 'Ecuaciones de varios pasos',
    'both-sides': 'Incógnita en los dos lados',
    'bracket-both-sides': 'Paréntesis en los dos lados',
    'fraction-solve': 'Ecuaciones con fracción',
    'rule-from-table': 'Reglas a partir de una tabla',
    'inequality-one-step': 'Desigualdades de un paso',
    'inequality-two-step': 'Desigualdades de dos pasos',
    'inequality-multi-step': 'Desigualdades de varios pasos',
    'compound-inequality': 'Desigualdades compuestas',
    'literal-equations': 'Despejar fórmulas',
    'ratio-proportion': 'Razón y proporción',
    'slope-rate': 'Pendiente y tasa de cambio',
    'graph-linear': 'Trazar reglas lineales',
    'write-linear': 'Escribir reglas lineales',
    'system-substitution': 'Sistemas por sustitución',
    'system-elimination': 'Sistemas por eliminación',
    // Nivel 3 (content/graph/algebra1-l3.json).
    'function-notation': 'Notación de función',
    'domain-range': 'Dominio y rango',
    'exponent-product': 'Multiplicar potencias',
    'exponent-power': 'Potencia de una potencia',
    'exponent-quotient': 'Dividir potencias',
    'zero-negative-exponent': 'Exponente cero y negativo',
    'poly-add-sub': 'Sumar y restar polinomios',
    'poly-multiply': 'Multiplicar binomios',
    'factor-common': 'Sacar el factor común',
    'linear-vs-exponential': 'Crecimiento lineal o exponencial',
    'exponential-rule': 'Reglas exponenciales',
    // Nivel 4 (content/graph/algebra1-l4.json).
    'radical-simplify': 'Simplificar raíces cuadradas',
    'radical-arith': 'Sumar y multiplicar raíces',
    'factor-trinomial-monic': 'Factorizar tres términos',
    'factor-trinomial-lead': 'Factorizar con número delante',
    'difference-of-squares': 'Diferencia de dos cuadrados',
    'poly-divide': 'Dividir polinomios',
    'quadratic-zero-product': 'La regla del producto cero',
    'solve-by-factoring': 'Resolver factorizando',
    'square-root-method': 'Resolver por raíz cuadrada',
    'complete-the-square': 'Completar el cuadrado',
    'quadratic-formula': 'La fórmula cuadrática',
    'parabola-features': 'Leer una parábola',
    'quadratic-from-vertex': 'Escribir una regla cuadrática',
    'quadratic-model': 'Modelos cuadráticos',
    // Nivel 5 (content/graph/algebra1-l5.json).
    'rational-exponent': 'Exponentes fraccionarios',
    'relation-is-function': 'Decidir si una regla es función',
    'sequence-terms': 'Términos de una sucesión',
    'sequence-nth-term': 'Fórmula para cualquier término',
    'point-slope-form': 'Forma punto-pendiente',
    'parallel-perpendicular': 'Rectas paralelas y perpendiculares',
    'inequality-two-var': 'Desigualdades con dos letras',
    'write-system': 'Escribir un sistema',
    'system-graphically': 'Sistemas con la gráfica',
    'scatter-regression': 'La recta de mejor ajuste',
    'residual-and-fit': 'Residuos y ajuste',
    'association-strength': 'Fuerza de la asociación',
    'exponential-model': 'Modelos exponenciales',
  },

  course: {
    algebra1: { title: 'Álgebra I' },
    algebra2: { title: 'Álgebra II' },
    geometry: { title: 'Geometría' },
    trigonometry: { title: 'Trigonometría' },
  },
  unit: {
    'algebra1-l1': { title: 'Nivel 1 — El lenguaje del equilibrio' },
    'algebra1-l2': { title: 'Nivel 2 — Inclinación, ritmo y par' },
    'algebra1-l3': { title: 'Nivel 3 — Nombre, potencia y forma' },
    'algebra1-l4': { title: 'Nivel 4 — Raíz, factor y giro' },
    'algebra1-l5': { title: 'Nivel 5 — Regla, ajuste y patrón' },
  },

  settings: {
    title: 'Ajustes',
    language: 'Idioma',
    invertY: 'Invertir el eje vertical',
    sensitivity: 'Sensibilidad de la vista',
    reducedMotion: 'Movimiento reducido',
    close: 'Cerrar',
  },

  controls: {
    move: 'Moverse',
    look: 'Mirar',
    jump: 'Saltar',
    sprint: 'Esprintar',
    dash: 'Impulso',
    glide: 'Planear',
    build: 'Colocar',
    interact: 'Interactuar',
    recover: 'Recuperar',
  },

  // ---------------------------------------------------------------------
  // Primer contacto: la tarjeta de controles y la salida de un atasco.
  // Espacio de nombres aditivo de src/player (controls.js, controller.js).
  // Cada atajo se parte en teclas por el interpunto.
  // ---------------------------------------------------------------------
  firstrun: {
    title: 'Controles',
    got: 'Entendido',
    recovered: 'De vuelta en terreno despejado',
    caught: 'Fuera del fragmento: el entramado te atrapó y te dejó en el borde',
    dug: 'El suelo te tenía. Te dejamos sobre roca despejada',
    stuck: {
      title: 'Atascado',
      body: 'Algo te tiene atrapado. Pulsa Recuperar para volver a terreno despejado. Aquí nunca hace falta recargar la página.',
      act: 'Recuperar',
    },
    nolock: {
      title: 'Aquí el ratón no puede girar la vista',
      body: 'Gira con las teclas de flecha. O mantén pulsado un botón del ratón y arrastra.',
    },
    bind: {
      kbm: {
        move: 'W · A · S · D',
        look: 'Ratón',
        lookFree: 'Ratón · Flechas',
        lookBlocked: 'Flechas · Arrastrar',
        jump: 'Espacio',
        glide: 'Mantén espacio',
        interact: 'E',
        build: '1–4 · Clic · F',
        sprint: 'Mayús',
        dash: 'C · Ctrl izq.',
        recover: 'R',
      },
      pad: {
        move: 'Stick izq.',
        look: 'Stick der.',
        jump: 'A',
        glide: 'Y',
        interact: 'X',
        build: 'LB · RT · Cruceta gira',
        sprint: 'L3 · LT',
        dash: 'B',
        recover: 'Back',
      },
      touch: {
        move: 'Pulgar izq.',
        look: 'Arrastra a la derecha',
        jump: 'Saltar',
        glide: 'Planear',
        interact: 'Interactuar',
        build: 'Soporte · Colocar',
        sprint: 'Empuja el stick',
        dash: 'Impulso',
        recover: 'Recuperar',
      },
    },
  },

  // ---------------------------------------------------------------------
  // El menú — pausa, ayuda y ajustes. Espacio de nombres aditivo de
  // src/ui/menu.js. Cada atajo se corta en teclas por el interpunto, igual
  // que en la tarjeta de controles.
  // ---------------------------------------------------------------------
  menu: {
    open: 'Menú',
    title: 'En espera',
    sub: 'Ahí fuera nada se mueve hasta que vuelvas.',
    resume: 'Volver a la ronda',
    controls: 'Controles',
    screens: 'Pantallas',
    settings: 'Ajustes',
    sens: 'Velocidad de la vista',
    invert: 'Invertir la vista',
    on: 'Activada',
    off: 'Desactivada',
    out: 'Si te quedas atascado',
    outBody: 'Recuperar te devuelve a suelo firme desde donde sea: fuera del borde del fragmento, dentro de una colina o dentro de algo que hayas construido. Aquí nunca hace falta recargar la página.',
    recover: 'Recuperar',
    restart: 'Empezar de nuevo',
    restartAsk: '¿Empezar de nuevo? Se pierde cada grieta que has sellado y cada mota que has ganado.',
    restartYes: 'Empezar de nuevo',
    restartNo: 'Seguir jugando',
    now: 'Qué hacer ahora',
    nowBody: 'Una grieta es un anillo de aire desgarrado. Cada grieta sostiene un enunciado de matemáticas que todavía no es verdadero. Métete en el anillo. Pulsa {key}. Haz verdadero el enunciado y la grieta se cierra para siempre.',

    /* PALABRAS — cada nombre que este juego inventó, una línea corta cada uno.
       En la primera imagen del juego ya se leen RED, GRIETA, LÍNEA, MOTAS DE
       CIFRA y RANGO COBRE, y ninguna de esas palabras significaba nada todavía.
       Aquí está el significado, a una tecla de cualquier momento del juego.
       CONTRATO: cada línea de `wordIs` contiene su propio término — es la clave
       que comprueba tools/lang/rules.mjs. Una sola línea cada una. */
    words: 'Palabras',
    word: {
      rift: 'Grieta',
      line: 'Línea',
      held: 'Sostenida',
      lattice: 'Red',
      mote: 'Mota de cifra',
      rank: 'Rango',
      band: 'Banda',
      proving: 'Ronda de prueba',
      sounding: 'Sondeo',
      plate: 'Placa de impulso',
    },
    wordIs: {
      rift: 'Una grieta es un anillo de aire desgarrado. Cada grieta sostiene un enunciado que todavía no es verdadero.',
      line: 'Una línea es una idea, y todas las grietas que la prueban. Trabajas una línea cada vez.',
      held: 'Sostenida quiere decir que probaste esta línea sin ayuda, en cada tipo de pregunta que te planteó. El equipo ya no te enseña una línea sostenida. Sí la vuelve a comprobar más adelante. Si esa comprobación falla, la línea se abre otra vez.',
      lattice: 'La red es el razonamiento que sostiene este mundo. Hay suelo donde el razonamiento aún funciona.',
      mote: 'Las motas de cifra son lo que deja una grieta sellada. La fundición toma motas y te da equipo.',
      rank: 'Tu rango es lo que la orden piensa de ti. Cobre es el primer rango. Repara el mundo para subirlo.',
      band: 'Una banda dice cuánto cuesta una pregunta, de la banda 1 a la banda 5. El equipo elige tu banda.',
      proving: 'Una ronda de prueba es la que sella una línea. Sin ayuda mientras corre, y preguntas más difíciles. Si fallas una, esa pregunta sale de la ronda y la ayuda vuelve.',
      sounding: 'Un sondeo recorre hacia abajo una línea que ya sostienes. Cada pregunta es más difícil que la anterior.',
      plate: 'Una placa de impulso es una pieza que puedes construir. Písala y te lanza recto hacia arriba.',
    },
    screen: {
      progress: 'Informe de progreso',
      dossier: 'Expediente del cadete',
      controls: 'Tarjeta de controles',
      menu: 'Este menú',
    },
    bind: {
      kbm: {
        sprint: 'Mayús',
        progress: 'P',
        dossier: 'J',
        controls: '?',
        menu: 'Esc · F1',
      },
      pad: { sprint: 'L3 · LT' },
      touch: { sprint: 'Empuja el stick' },
    },
  },

  // ---------------------------------------------------------------------
  // Estabilizador de grietas — la superficie de aprendizaje.
  // Lo que va entre acentos graves se compone como KaTeX estricto.
  // ---------------------------------------------------------------------
  rift: {
    tag: 'Grieta {n}',
    ident: 'Grieta {code}',
    pressure: 'Aún abierta',
    streak: '{n} «n|one:sellado limpio|other:sellados limpios»',
    disengage: 'Desconectar',
    ask: 'Llamar al eco',
    sealed: 'Red sellada',
    shards: 'Motas +{n}',
    trueNow: 'Verdadero. La grieta se cierra.',
    // learn-ux (additivo): la ronda de prueba no da ayuda, así que un fallo
    // saca la pregunta de la ronda antes de que llegue la ayuda.
    provingOff: 'Esta pregunta ya no cuenta en la ronda de prueba. La ayuda vuelve.',
    stable: 'Estable',
    critical: 'Crítica',
    close: 'Salir de la grieta',

    seal: {
      // Ver en.js: AGARRE era una palabra acuñada sin explicar. La barra mide
      // cuánto se SOSTIENE la línea, y «sostener» ya está definido.
      grip: 'Sostén de esta línea',
      line: 'La línea aguanta',
    },

    kind: {
      check: 'Ronda de prueba · {n} de {m}',
      // learn-ux (additivo): la misma pregunta, ya gastado su primer intento.
      checkOff: 'Fuera de la ronda de prueba',
      probe: 'A primera vista',
      review: 'Volviendo a ella',
      interleave: 'De memoria',
      deep: 'Sondeo · {n}',
    },

    help: {
      keypad: 'Escribe el valor que hace verdadera la afirmación. Luego pulsa Sellar.',
      keypadExpression: 'Escribe la expresión en su forma más corta. Luego pulsa Sellar.',
      // …y el tercer trabajo del mismo teclado. Un elemento numérico no
      // siempre es una ecuación: no hay ninguna afirmación que hacer
      // verdadera. Ver `ask.evaluateWhen` en content/lang/items.es.js.
      keypadValue: 'Sustituye el valor y evalúa. Luego pulsa Sellar.',
      // learn-ux: una línea por TAREA, no por instrumento. El teclado sirve a
      // nueve trabajos distintos y solo describía dos. Ver `_taskKey`.
      factor: 'Escríbelo como paréntesis multiplicados entre sí. Luego pulsa Sellar.',
      expand: 'Multiplícalo del todo. No dejes ningún paréntesis. Luego pulsa Sellar.',
      vertex: 'Escríbelo como un paréntesis al cuadrado, más un número. Luego pulsa Sellar.',
      simplify: 'Saca de la raíz todos los cuadrados enteros. Luego pulsa Sellar.',
      // learn-ux: cinco tareas más, y ninguna la nombra la FORMA que exige el
      // corrector. Ver `_taskKey`.
      power: 'Usa las reglas de las potencias. Escribe la respuesta en un solo término. Luego pulsa Sellar.',
      common: 'Saca lo que comparten todos los términos y deja el resto en un paréntesis. Luego pulsa Sellar.',
      radsum: 'Suma las raíces que coinciden. Luego pulsa Sellar.',
      rationalise: 'Quita la raíz de abajo. Luego pulsa Sellar.',
      divide: 'Divide lo de arriba entre lo de abajo. Luego pulsa Sellar.',
      roots: 'Escribe cada valor que hace verdadera la afirmación. Luego pulsa Sellar.',
      point: 'Escribe el punto: primero a lo ancho, después a lo alto. Luego pulsa Sellar.',
      bound: 'Escribe el intervalo dentro del cual se quedan los valores. Luego pulsa Sellar.',
      rule: 'Escribe la regla que une las dos letras. Luego pulsa Sellar.',
      balance: 'Elige un movimiento. La viga lo aplica a los dos lados. A los dos, siempre: esa es toda la ley.',
      sort: 'Envía cada término a la bodega que le corresponde.',
      area: 'Cubre cada parte del campo con el área que esa parte lleva.',
      choice: 'Una de estas lecturas es verdadera. Las demás son la forma habitual de equivocarse.',
      plot: 'Mueve los dos tiradores hasta que el trazo encaje con las lecturas. Luego pulsa Sellar.',
    },

    keypad: {
      charge: 'Tu respuesta',
      set: 'Sellar',
      back: 'Borrar',
      minus: 'Negativo',
      over: 'Barra de fracción',
      // learn-ux: las teclas de notación. Un teclado sin paréntesis, raíz, signo
      // igual ni coma no podía escribir la mayoría de sus propias respuestas.
      clear: 'Borrar todo',
      take: 'Restar',
      open: 'Abrir paréntesis',
      close: 'Cerrar paréntesis',
      root: 'Raíz cuadrada',
      power: 'Elevado a',
      equals: 'Igual a',
      also: 'Y además',
      plusMinus: 'Más o menos',
      atMost: 'Como máximo',
      atLeast: 'Como mínimo',
      empty: 'Escribe antes un valor',
      narrow: 'Reducir el campo',
      // Cuenta lo que hay en pantalla: si el equipo rechaza un distractor,
      // quedan dos lecturas y decir «tres» sería contar algo invisible.
      narrowed: '«n|one:# lectura sobrevive|other:# lecturas sobreviven» al ruido.',
      // Una lectura errónea cuesta el campo entero, así que tres lecturas
      // nunca se pueden recorrer hasta dar con la respuesta.
      spent: 'Esa lectura no es. El campo se cierra. Escribe un valor y las lecturas vuelven.',
    },

    plot: {
      aria: 'Rejilla de coordenadas. Mueve los dos tiradores para trazar la recta.',
      knob: 'Tirador {n}',
      reads: 'Tu trazo',
      notYet: 'Ese trazo todavía no encaja con las dos lecturas.',
    },

    balance: {
      tray: 'Movimientos disponibles',
      moves: 'Movimientos',
      undo: 'Un paso atrás',
      both: 'Aplicado a los dos lados',
      solved: 'La incógnita se queda sola.',
      closer: 'Más cerca. La incógnita se está soltando.',
      further: 'Sigue siendo verdad. Pero la incógnita queda más enterrada.',
    },

    sort: {
      tray: 'Términos sueltos',
      vars: 'Términos con `{v}`',
      nums: 'Números puros',
      total: 'Total de la bodega',
      empty: 'Vacía',
      rejected: 'Esa bodega no lo admite.',
    },

    area: {
      title: 'Campo de cifra',
      depth: 'Altura',
      width: 'Anchura',
      total: 'Área total',
      none: 'Sin cubrir',
      slot: 'Coloca aquí un área',
      tray: 'Piezas del campo',
      rejected: 'Eso no cubre esta parte del campo.',
    },

    echo: {
      label: 'Eco',
      cadet: 'Cadete {name} · Travesía {n}',
      slip: 'Cadete {name} estuvo aquí y tropezó igual que tú.',
      trace: 'Un eco es el trabajo que otro cadete dejó en esta grieta. {name} estuvo aquí. Léelo paso a paso.',
      done: 'Eso es todo lo que dejó {name}.',
      analogue: 'Otra grieta, la misma forma. {name} dejó aquí la resolución entera.',
      fades: 'El resto del rastro de {name} se ha borrado.',
      sealedIt: '{name} la selló en {answer}. La tuya no es la misma grieta.',
      blank: 'La última línea se quemó. Termínala tú.',

      // El rastro no se entrega: se arranca de la grieta capa a capa, y cada
      // capa cuesta otro empujón.
      call: 'Llamar al eco',
      backToTear: 'Volver a la grieta',
      backToTrace: 'Volver al rastro',
      more: 'Insistir — una capa más honda',
      tier: 'Capa {n} de {of}',
      spent: 'No queda rastro',
      depth1: 'Susurro — la primera pista',
      depth2: 'Primer paso — cómo empezaron',
      depth3: 'La forma — el método entero',
      depth4: 'Rastro entero — todos los pasos',
      firstMove: 'Del incendio solo sobrevivió el primer paso. Lo demás es ceniza.',
      shape: 'Sobrevive la forma de toda la resolución. El valor del final, no.',
      cameBack: 'El eco vuelve con más fuerza.',
      liveOnly: 'El equipo no tiene registrada ninguna otra grieta de esta forma. Así que el eco te devuelve tu propio trazo.',
      nudge: {
        keypad: 'Dite la afirmación en voz baja antes de escribir nada. El valor que buscas es el que la hace verdadera, no el que queda más a mano.',
        keypadExpression: 'Aquí no resuelves nada. Escribe la misma cantidad con menos términos, y la línea más corta debe seguir valiendo para cualquier valor de la letra.',
        // El susurro de la tarea `keypadValue`. Sin él, `t()` caería en la
        // CLAVE y escribiría `rift.echo.nudge.keypadValue` en la tarjeta.
        keypadValue: 'Pon el número en lugar de la letra, en cada sitio donde esté la letra. Luego haz las cuentas en orden.',
        // El susurro sigue la TAREA. Antes seguía el tipo del ítem, así que 179
        // de 341 formas compartían la línea de términos semejantes, incluida una
        // bajo una raíz cuadrada, que no tiene términos.
        factor: 'Aquí trabajan dos números. Multiplicados dan el último número y sumados dan el del medio. Pon cada uno en su propio paréntesis.',
        expand: 'Cada parte del primer paréntesis se encuentra con cada parte del segundo. Multiplica todas esas parejas y después junta las que coinciden.',
        vertex: 'Parte por la mitad el número que va delante de la letra sola. Eleva al cuadrado esa mitad: el paréntesis quiere ese número dentro. Después repara el total.',
        simplify: 'Busca un cuadrado entero escondido dentro de la raíz. Saca su raíz al frente y deja el resto bajo el signo.',
        power: 'La base no cambia; solo se mueve el número pequeño. Al multiplicar se suman los dos números pequeños, al dividir se restan, y una potencia de otra potencia los multiplica. Una potencia cero vale uno.',
        common: 'Busca el número más grande que divide a todos los términos, y las letras que todos llevan. La parte común sale delante; el resto se queda en el paréntesis.',
        radsum: 'Dos raíces solo se suman si el número bajo el signo es el mismo. Simplifica primero cada raíz y luego cuenta cuántas coinciden.',
        rationalise: 'Una raíz debajo de la barra no es el final del trabajo. Multiplica arriba y abajo por esa misma raíz, y después reduce.',
        divide: 'Lo de abajo cabe en lo de arriba un número entero de veces. Pregúntate por cuánto debes multiplicar lo de abajo para llegar a lo de arriba.',
        roots: 'Halla todos los valores que puede tomar la incógnita, no solo el primero. Escribe cada uno como la letra, un signo igual y su valor.',
        point: 'Lee primero a lo ancho, por abajo, y después a lo alto, por el lado. Las dos lecturas son el punto, en ese orden.',
        bound: 'Halla primero el valor del borde. Después pregunta de qué lado la afirmación sigue siendo verdadera.',
        rule: 'Halla cuánto sube la salida por cada paso de la entrada. Después halla dónde empieza.',
        balance: 'Algo va pegado a la incógnita. Deshaz primero lo de fuera. La viga hace el resto.',
        sort: 'Dos términos son semejantes solo si la parte con letra coincide exactamente. Un número nunca es semejante a una letra.',
        area: 'El factor de fuera toca cada parte de dentro. Todas.',
        choice: 'Prueba cada lectura contra la afirmación. No elijas la que simplemente te suena.',
        plot: 'Fija primero la altura donde el trazo cruza el eje vertical. Después fija lo empinado que sube.',
      },
    },

    mis: {
      'letter-as-object': 'Leyó la letra como un objeto que se cuenta, no como un número.',
      'add-not-multiply': 'Sumó las dos cantidades. La situación forma grupos iguales, así que se multiplica.',
      'subtract-not-multiply': 'Unió las dos cantidades restando, en el orden en que la frase las nombró.',
      'divide-not-multiply': 'Repartió el grupo entre los grupos en vez de contarlos todos juntos.',
      'letter-as-position': 'Tomó el lugar de la letra en el alfabeto por su valor.',
      'implicit-mult-missed': 'Puso el número al lado de la letra en vez de multiplicar por ella.',
      'neg-substitution': 'Dejó caer el signo menos al sustituir.',
      'strict-left-right': 'Fue de izquierda a derecha sin mirar qué operación manda antes.',
      'exponent-as-mult': 'Leyó la potencia como una multiplicación.',
      'neg-base-power': 'Elevó al cuadrado también el signo menos.',
      'combine-unlike': 'Metió un número suelto dentro de un término con letra.',
      'coefficient-sign-lost': 'Recogió el término y se dejó el signo por el camino.',
      'x-and-x-squared': 'Trató el cuadrado como si fuera el mismo tipo de término.',
      'partial-distribute': 'Multiplicó solo lo primero que había dentro del paréntesis.',
      'neg-distribute': 'Llevó el menos a un término y al otro no.',
      'same-op-both': 'Repitió la operación en vez de deshacerla.',
      'one-side-only': 'Tocó un lado de la balanza y el otro no.',
      'subtract-coefficient': 'Restó el coeficiente en lugar de dividir entre él.',
      'div-direction': 'Dividió al revés.',
      'wrong-unwrap-order': 'Dividió antes de quitar el término independiente.',
      'sign-on-constant': 'Sumó el término independiente donde había que restarlo.',
      'distribute-then-forget': 'Abrió el paréntesis y no recogió lo que salió.',
      'collect-wrong-side': 'Pasó el término al otro lado sin cambiarle el signo.',
      'no-solution-confusion': 'Leyó una igualdad falsa como si fuera una solución.',
      'arith-slip': 'El método aguantó entero. Falló una sola cuenta.',
      'sign-slip': 'Todos los pasos bien; por el camino se perdió un signo menos.',
      'partial-rule': 'Se quedó a un movimiento del final y entregó el valor a medias.',
      'off-by-one-row': 'Leyó la fila de al lado del registro, no la que se quemó.',
      'axis-swap': 'Leyó por el eje equivocado: la entrada donde se pedía la salida.',
      'swapped-roles': 'Montó el modelo con las dos cantidades cambiadas de sitio.',
      unknown: 'Se equivocó justo en este punto.',
    },

    why: {
      letterIsNumber: 'Aquí la letra representa un número concreto.',
      numberAgainstLetter: 'Un número pegado a una letra significa multiplicar.',
      subThenMul: 'Sustituye y después multiplica.',
      startFrom: 'Parte de la expresión.',
      replaceWith: 'Cambia `{v}` por `{n}`.',
      mulThenAdd: 'Multiplica primero y suma después.',
      mulBindsTighter: 'La multiplicación manda antes que la suma.',
      doMulThenAdd: 'Haz la multiplicación y después la suma.',
      powBeforeMul: 'Las potencias van antes que la multiplicación.',
      subPowerBack: 'Devuelve la potencia ya calculada a su sitio.',
      mulThenSub: 'Multiplica y después resta.',
      groupSameVar: 'Agrupa los términos que llevan la misma parte literal.',
      combineBoth: '`{a}` y `{b}` se juntan; `{c}` y `{d}` se juntan. Un número y un término con `{v}` nunca.',
      factorOutside: 'El factor de fuera multiplica todo lo de dentro.',
      twoProducts: 'Dos productos distintos: el área de un rectángulo partido en dos.',
      multiplyEachOut: 'Multiplica cada uno por separado.',
      beamBalances: 'La viga está en equilibrio: los dos lados pesan lo mismo.',
      takeOff: 'Quita `{n}` de los dos lados para que siga equilibrada.',
      addOn: 'Suma `{n}` a los dos lados para que siga equilibrada.',
      whatIsLeft: 'Lo que queda es el valor de la incógnita.',
      groupsWeigh: '`{a}` grupos de `{v}` pesan `{c}`.',
      divideByCoef: 'Divide los dos lados entre el coeficiente.',
      oneGroupWeighs: 'Un solo grupo pesa esto.',
      multipliedThenAdded: 'La ecuación multiplica la incógnita por `{a}` y luego suma `{b}`.',
      multipliedThenTaken: 'La ecuación multiplica la incógnita por `{a}` y luego resta `{b}`.',
      unwrapReverse: 'Desenvuelve al revés: quita primero el término independiente.',
      thenDivideBy: 'Después divide los dos lados entre `{a}`.',
      expandFirst: 'Abre primero el paréntesis.',
      collectConstants: 'Junta los números sueltos de la izquierda.',
      nowTwoStep: 'Ahora es una ecuación de dos pasos: quita el término independiente.',
      divideBy: 'Divide los dos lados entre `{a}`.',
      bothSidesBalance: 'La incógnita aparece en los dos lados de la balanza.',
      removeCrossing: 'Quita `{term}` de los dos lados: al cruzar, cambia de signo.',
      undoConstant: 'Deshaz el término independiente.',
    },
  },

  // ---------------------------------------------------------------------
  // El arco narrativo. Espacio de claves que solo añade src/meta.
  // Marlow habla seca, cálida y con una herida vieja; nunca como mascota,
  // nunca como animadora. Fue cadete aquí, y le costó caro.
  // ---------------------------------------------------------------------
  story: {
    /* EL CAMINO (src/meta/region.js, src/content/route.js). La red se abre por
       regiones. Nunca un número de nivel: una región es un lugar con nombre. */
    region: {
      kick: 'La red se abre',
      open1: 'La última línea de este anillo aguanta. Mira al horizonte.',
      open2: 'Allá fuera crece suelo nuevo. {region}.',
      open3: 'Aterrizamos allí en tu próxima ronda. Termina aquí primero.',
      arrive: 'Aterrizaje. {region}. {ground}',
      'algebra1-l1': { name: 'El Anillo del Equilibrio', ground: 'Dos lados de una balanza, y coinciden.' },
      'algebra1-l2': { name: 'El Tramo Inclinado', ground: 'Suelo que se inclina. Ritmos, pares y líneas que se cruzan.' },
      'algebra1-l3': { name: 'La Extensión de los Nombres', ground: 'Suelo con nombres. Potencias, y reglas que puedes llamar por su nombre.' },
      'algebra1-l4': { name: 'La Hondura que Gira', ground: 'Suelo que se curva. Raíces, factores y giros.' },
      'algebra1-l5': { name: 'El Campo de los Patrones', ground: 'Suelo con un patrón dentro. Reglas, ajustes y modelos.' },
    },
    hud: {
      act: 'Capítulo {n}',
      question: 'Pregunta abierta',
      dossier: 'Expediente del cadete',
      hint: 'J',
      close: 'Cerrar',
      skip: 'Saltar',
      continue: 'Seguir',
      toNext: '{rank} · «n|one:falta|other:faltan» {n}',
      summit: 'Cima de la orden',
      toNextAny: 'Siguiente rito · {rank}',
      nextNightAny: '{rank} · espera una noche en pie',
      // El reloj rápido: grietas selladas en este fragmento, que es lo que hace
      // pasar de capítulo. Avanza con cada respuesta correcta.
      sealed: 'Grietas selladas en total',
      chapterBar: 'Avance de este capítulo',
      toChapter: '«n|one:# más|other:# más» para el Capítulo {ch}',
      chapterNight: '«n|one:# noche en pie|other:# noches en pie» para el Capítulo {ch}',
      nextNight: '{rank} · «n|one:# noche en pie|other:# noches en pie»',
      sealsAll: 'Todos los capítulos abiertos',
      toChapterAny: 'Siguiente · Capítulo {ch}',
      chapterNightAny: 'El Capítulo {ch} espera una noche en pie',
      sealsAt: '«n|one:# grieta sellada en total|other:# grietas selladas en total»',
      plusSeal: '+1',
    },

    night: {
      held: 'Te doy la bienvenida otra vez. Tienes «n|one:# noche en pie|other:# noches en pie». Una noche en pie es una línea que seguías sabiendo después de irte.',
      due: 'Te doy la bienvenida otra vez. «n|one:# línea ha|other:# líneas han» vencido. La red quiere comprobar lo que conservaste. Luego trabajamos.',
      none: 'Te doy la bienvenida otra vez. Estuviste fuera «n|one:# día|other:# días». No ha vencido nada. Elige una grieta y vamos.',
    },
    /** Una marca apagada (src/meta/night.js). Marlow lo dice una sola vez. */
    order: {
      kept: 'La marca se ha apagado. Sabías {skill} después de «n|one:# noche|other:# noches» fuera, que es lo único que esta red ha pedido demostrar a nadie.',
      keptCharter: 'Marca apagada, y van tres. La orden te ha extendido una cédula. Pulsa H en el terreno que prefieras para levantar un puesto.',
    },

    /* Una afirmación retirada al entrar (src/meta/withdrawn.js). INSTRUCTIVO:
       frases cortas, voz activa, y la última línea dice qué hacer. */
    withdrawn: {
      one: '{skill} vuelve a estar abierta. Sostenías esa línea. Un tipo de pregunta suyo nunca te ha salido bien, así que el equipo retira el sello.',
      many: '«n|one:# línea vuelve|other:# líneas vuelven» a estar abiertas: {skills}. Cada una tiene un tipo de pregunta que nunca te ha salido bien.',
      why: 'Conservas todo lo que hiciste. Responde bien ese tipo de pregunta una vez, sin ayuda. Entonces la línea vuelve a ser tuya.',
    },
    day: {
      d2: {
        a: 'Segundo día. Has vuelto. La mayoría de los cadetes del registro no volvió, y el registro no es amable con eso.',
        b: 'El fragmento lo notó antes que yo. Algo bajo la plaza se asentó un centímetro esta noche. Es del buen asentamiento.',
      },
      d3: {
        a: 'Tercer día. He empezado a anotar tus tiempos. No me lo pediste, y no pienso parar.',
        b: 'Hace dos días no podías sostener una línea toda la noche. Ahora sí. Que conste que entonces no dije nada alentador.',
      },
      d5: {
        a: 'Quinto día, y al amanecer algo ha salido de la red.',
        b: 'Da vueltas al fragmento, bajo y despacio. No veía uno desde hace nueve siglos.',
      },
      d8: {
        a: 'Octavo día. El tráfico de la red vuelve a pasar por el Fragmento Nueve. Antes nos rodeaba.',
        b: 'No digo que el fragmento confíe en ti. Digo que ha dejado de tomar precauciones.',
      },
      d13: {
        a: 'Decimotercer día. Un dron de reconocimiento pasó esta mañana y no nos registró como peligro. Primera vez en nueve siglos.',
        b: 'Alguien al otro extremo de la red se va a dar cuenta. Que se dé.',
      },
      d21: {
        a: 'Vigesimoprimer día. Pase lo que pase, este fragmento sigue en pie porque alguien volvió una y otra vez.',
        b: 'Yo escribí la palabra en el margen. Tú estás terminando la frase. Puedo vivir con ese reparto del trabajo.',
      },
    },

    /* LOS GUARDIANES (src/world/warden.js). La palabra se define la primera vez
       que se usa y nunca antes. Dos frases: qué es, y lo único que hay que
       hacer con ello. */
    warden: {
      first: {
        a: 'Eso es un guardián. La red manda uno cuando un fragmento vuelve a sostenerse.',
        b: 'Lleva un enunciado y suelta las respuestas detrás. Toma la pesa correcta.',
      },
      wake: 'Ha salido otro guardián. Ha asomado por la cresta hace un minuto y ya se mueve.',
      left: 'El guardián se ha deshecho. La carga sigue colgada donde la sujetaste.',
      full: 'El guardián se ha deshecho. El fragmento no sostiene más cajas, así que cobraste en motas.',
    },

    place: {
      approach: 'Descendiendo sobre',
      lattice: 'La Red Skyren',
      shard: 'Fragmento Nueve · desembarco de cadetes',
      when: 'Primera luz · cuarto día del desgarro',
    },

    marlow: {
      name: 'Marlow',
      role: 'Inteligencia de navegación · recuperada en parte',
    },

    open: {
      // «Bienvenido» y «el cadete» obligaban a cada chica de la clase a leer su
      // primera frase del juego en masculino. El saludo pasa a una perífrasis
      // sin concordancia y el rango a un sustantivo, no a un atributo: el chiste
      // sobrevive intacto y el trato deja de asignar sexo a nadie.
      /* Ver la nota en en.js: recortadas a lo que se lee de verdad, y los dos
         sustantivos que sostienen el juego llegan definidos — RED en l1 y
         GRIETA en l4, en la misma frase en que se acuñan. */
      l1: 'Fragmento Nueve, en la Red Skyren. La red es el razonamiento que sostiene este mundo.',
      l2: 'Soy Marlow. Inteligencia de navegación: algo averiada, casi siempre sincera. Tú tienes rango de cadete.',
      l3: 'Todo lo que pisas es una conclusión. Donde el razonamiento aguanta, hay suelo.',
      // «sostenida abierta» calcaba el inglés «held open»: en español una puerta,
      // una herida o una grieta se *mantienen* abiertas, no se sostienen abiertas.
      l4: 'Donde falla, se abre una grieta: una afirmación que la red ya no sabe demostrar.',
      l5: 'El Fragmento Nueve lleva novecientos años en pie. ¿Qué empezó a desgarrarlo hace cuatro días?',
    },

    ch1: {
      title: 'La pregunta pendiente',
      quest: 'El Fragmento Nueve aguanta desde hace nueve siglos. Averigua qué cambió hace cuatro días.',
    },
    ch2: {
      title: 'Los cadetes que vinieron antes',
      quest: 'Cientos estuvieron justo donde estás tú. Averigua dónde se pararon.',
      b1: 'La red te ha visto, y te sorprendería cuántos cadetes no llegan a que los vea nunca.',
      b2: 'He leído los rastros que el equipo saca de las grietas. Hubo cadetes justo donde estás tú. Cientos.',
      b3: 'Todos capaces. Todos se pararon. Ningún registro dice por qué. Alguien paga ese silencio.',
    },
    ch3: {
      title: 'El noveno lema',
      quest: 'Nadie llegó a terminar un paso de la demostración fundacional. Sube lo bastante alto para terminarlo.',
      // Ver en.js: el capítulo se llama «El noveno lema» y la palabra no se
      // definía en ninguna parte.
      b1: 'Ya hay afirmaciones selladas de sobra para pedir la demostración fundacional: cuatro millones de pasos.',
      b1b: 'Un lema es un paso de una demostración. Esta es estanca de arriba abajo, salvo en el paso nueve.',
      b2: 'El paso nueve no está demostrado. Está supuesto. Una palabra al margen, de puño y letra: supongamos.',
      b3: 'Nueve mil mundos se apoyan en un paso que nadie terminó. Las grietas son ese paso, que vuelve a preguntar.',
    },
    ch4: {
      title: 'La mano en el margen',
      quest: 'Termina lo que empezó Marlow.',
      b1: 'Dieciséis grietas cerradas. Hay algo que llevo cuatro días callando. Voy a decirlo.',
      b2: 'La letra del margen es mía. Yo fui la cadete de aquí. El fragmento caía y me quedaban once minutos.',
      b3: 'Novecientos años de cadetes llegaron a esta página. Todos se pararon en la misma línea. Demuestra que me equivoco.',
    },
    ch5: {
      title: 'Firmado',
      quest: 'Escribe el final del paso nueve, y un nombre debajo.',
      b1: 'Veintiocho grietas. En algún punto la red dejó de tratarte como al clima y empezó a leerte.',
      b2: 'Termina el resto. Un soberano añade una línea a la demostración, y lo que diga, existe. Elige bien.',
    },
    coda: {
      title: 'Novecientos años de silencio',
      quest: 'La demostración se ha cerrado. Ve a ver lo que ha hecho.',
      c1: 'Se está escribiendo sola. El paso nueve dice ahora: demostrado; y debajo, en el hueco reservado al nombre del fundador, hay el de un cadete.',
      c2: 'Nueve mil fragmentos acaban de dejar de discutir. En algún punto más allá de las nubes, el cielo se ha quedado callado por primera vez en nueve siglos.',
      c3: 'Me equivoqué contigo. Que conste en acta, junto con el hecho de que nunca he disfrutado tanto de nada.',
    },

    watch: {
      title: 'La guardia',
      quest: 'La demostración se sostiene mientras alguien la lleve. Vuelve y seguirá siendo tuya.',
      due: 'Líneas que tocan',
      stand: 'Monta la guardia',
      next: 'El fragmento aguanta · la próxima {when}',
      nights: '«n|one:# noche en pie|other:# noches en pie»',
      coda: 'La demostración se cierra dentro de «n|one:# noche en pie|other:# noches en pie»',
      sounding: 'Sondeo · {n}',
      nightsAny: 'Noches en pie',
      codaAny: 'La demostración se cierra tras más noches en pie',
      soundingAny: 'Sondeo más hondo',
      soundingNone: 'Sondea el entramado',
      whenMin: 'dentro de «n|one:# minuto|other:# minutos»',
      whenHour: 'dentro de «n|one:# hora|other:# horas»',
      whenDay: 'dentro de «n|one:# día|other:# días»',
      whenSoon: 'en breve',
    },

    /* QUÉ SIGNIFICA UN RANGO — Y NUNCA UNA CUENTA DE NADA.
       El bronce abría con «Dos líneas sostenidas». Es una descripción del rango
       en abstracto, pero el cadete la lee como una afirmación sobre él, y quien
       la leyó junto a un informe que decía «1 DE 10 LÍNEAS SOSTENIDAS» la llamó
       contradicción. Y tenía razón. «Media demostración en la mano» hacía lo
       mismo: el rango se compra con crédito, no con líneas. El progreso se dice
       de una sola forma, y una ceremonia no es uno de esos sitios. */
    cite: {
      copper: 'Sabes sostener una afirmación. Esa es toda la cualificación, y muy poca gente la cumple.',
      bronze: 'La red ha empezado a llevar sus tormentas a tu alrededor y no a través de ti.',
      silver: 'La plata puede abrir el texto fundacional y leer lo que la demostración costó a quienes la escribieron.',
      gold: 'El oro cruza entre fragmentos sin escolta. Aquí arriba ya queda muy poco que te resulte peligroso.',
      sovereign: 'Un soberano puede añadir una línea a la demostración. Lo que esa línea diga, existe.',
    },

    rite: {
      ascended: 'Ascenso',
      arrow: '{from} → {to}',
      standing: 'Rango',
      /* Ver en.js: la ceremonia lleva dentro el objetivo que interrumpió, para
         que no haya ni un fotograma sin nada que hacer. */
      next: 'Ahora: {verb} — {skill}, a {n} m',
      nextAny: 'Ahora: busca una grieta y séllala',
    },

    dossier: {
      title: 'Expediente del cadete',
      sub: 'Red Skyren · Fragmento Nueve',
      ladder: 'La subida',
      standing: 'Lo que la red te ha visto hacer',
      log: 'Diario de campo',
      lines: 'Diez líneas',
      question: 'Pregunta abierta',
      locked: 'Sellado hasta {rank}',
      lockedAt: 'Se abre con «n|one:# grieta sellada|other:# grietas selladas»',
      tally: 'Grietas selladas aquí',
      lockedCoda: 'Sellado hasta que se cierre la demostración',
      lockedShort: 'Sellado',
      here: 'Estás aquí · {have} de {need} de posición',
      hereNights: 'Estás aquí · la posición ya está, «n|one:falta # noche mantenida|other:faltan # noches mantenidas»',
      hereReady: 'Estás aquí · ya ganaste el siguiente rito',
      costs: 'Se abre con {n} de posición',
      costsNights: 'Se abre con {n} de posición y «nights|one:# noche mantenida|other:# noches mantenidas»',
      outOf: 'de los {n} que puede otorgar el fragmento',
      current: 'Estás aquí',
      held: 'Sostenida',
      openState: 'Abierta',
      shut: 'Todavía no es tuya',
      integrity: 'Mundo reparado',
      close: 'Cerrar el expediente',
      footer: 'Nueve mil fragmentos. Un razonamiento. Un paso sin terminar.',
    },

    stand: {
      seals: 'Por grietas selladas',
      sealsNote: 'Tres por un sellado limpio, dos por uno asistido, y se detiene en veintiséis. A partir de ahí, las grietas fáciles no pagan nada de rango.',
      proving: 'Por rondas de prueba',
      provingNote: 'Tres puntos por cada enunciado que sostienes dentro de una ronda de prueba. Sin ayuda, en forma desconocida, banda alta.',
      lattice: 'Por líneas abiertas',
      latticeNote: 'Dos por cada línea que la red ha abierto bajo tus pies. Se gana con los requisitos, no respondiendo.',
      lines: 'Por líneas sostenidas',
      linesNote: 'Nueve cada una, y sin techo. A partir de la plata es casi lo único que queda.',
    },

    standard: {
      shard: 'Fragmento Nueve',
      motto: 'Lo que aquí aguanta lo sostuvo una mano.',
      tally: '«n|one:# grieta sellada por esta mano|other:# grietas selladas por esta mano»',
    },

    voice: {
      firstRift: 'Ese anillo de aire desgarrado es una grieta. Acércate y pulsa E. El equipo hace el resto.',
      firstSeal: 'Ha aguantado. Esa afirmación es ya un rasgo permanente de la realidad, y lo han hecho tus manos.',
      standard: 'El obelisco de la plaza es el Estandarte: cinco franjas, una por rango, y una luz en tu posición.',
      capped: 'Sellada, pero las grietas fáciles ya no pagan. La posición sale de líneas sostenidas, y eso cuesta trabajo.',
      wrong: [
        'Mal, pero mal de una forma útil. Así funciona casi toda la ciencia.',
        'No. La red es una pedante. Quiere el valor verdadero, no el de al lado.',
        'Sería una respuesta preciosa para una pregunta ligeramente distinta.',
        'La grieta ni ha parpadeado. Vuelve a mirar qué lleva pegado la incógnita.',
        'Nadie sella una de esas a la primera. Dos cadetes en nueve siglos dijeron lo contrario. Los dos mentían.',
        'Con calma. Esa afirmación no intenta engañarte; simplemente no está terminada.',
      ],
      right: [
        'Sellada. El cielo que tienes encima es un poco menos mentira.',
        'Aguanta. Registrada sin ayuda, y sin ayuda es la única forma que la red cuenta.',
        'Limpio. En algún sitio, un paso que carga peso acaba de dejar de quejarse.',
        'Así se hace. En silencio, y luego el mundo deja de temblar.',
        'Bien. La red no da las gracias. Las doy yo en su nombre.',
      ],
      streak: 'Cuatro seguidas. La grieta se lo está empezando a tomar como algo personal.',
      // Dicho bajo el rito, cuando el encuadre ya se ha abierto.
      rank: [
        'El Estandarte lleva tu nombre grabado en {rank}. Es piedra: ni adula ni redondea hacia arriba.',
        '{rank}. La orden ha revisado al alza lo que piensa de ti, cosa que a la orden le cuesta mucho.',
        'Registrado: {rank}. En algún archivo muy antiguo hay una entrada que esta mañana no estaba.',
        '{rank}, y ganado en la única moneda que la red reconoce: líneas que aguantan cuando nadie te ayuda.',
      ],
      nearMastery: 'La red está casi entera a lo largo de esta línea. Una más y se abre un cuarto del cielo.',
      close: [
        'Estás a una respuesta limpia de sostener {skill} para siempre. Sin ayuda, o la red no la cuenta; esa regla no la escribí yo, solo la incumplí.',
        '{skill} está a una respuesta honesta de ser tuya de forma permanente. Detrás de esa puerta hay mucha posición.',
        'Te falta una sola respuesta sin ayuda para cerrar {skill}. Tómate tu tiempo: la línea lleva novecientos años esperando.',
      ],
      held: [
        '{skill} queda sostenida. Esa línea no volverá a abrirse: ni por el tiempo atmosférico, ni por los años, ni por mí.',
        '{skill}, cerrada. Todas las reservas que el equipo guardaba sobre ti se han caído de golpe.',
        'La red ha dejado de discutir sobre {skill}. Eso es un trozo de cielo que se queda arriba hagamos lo que hagamos después.',
      ],
      lineHeld: [
        'Línea sostenida. Quedan nueve, y todas son más fáciles que la primera.',
        'Otra línea cerrada. El equipo ha dejado de tener dudas sobre ti.',
        'Esa línea ya no se abrirá. Ni por el tiempo atmosférico ni por el otro.',
      ],
      fall: 'Debajo del mundo también hay aire. Bastante menos útil.',
      idle: 'Tómate tu tiempo. La grieta no se va a ninguna parte. Ese es justamente el problema.',
      returning: 'De vuelta. Estadísticamente esa es la parte más difícil, así que enhorabuena a la estadística.',
    },

    // -----------------------------------------------------------------------
    // Marlow, por registro. Ver `src/meta/voice.js`.
    //
    // El canal tenía un único juego de frases ambientales escritas para un
    // cadete en sus primeros diez minutos, y seguía diciéndolas en el sellado
    // ciento treinta, incluida la que explica qué es una grieta. Ahora hay
    // cuatro registros, elegidos por lo que el cadete ha hecho de verdad:
    //
    //   green    nada sellado. El único registro con permiso para explicar.
    //   working  ya sabe trabajar. Se informa y se pincha; no se orienta.
    //   veteran  pasado el último capítulo. Una colega, con historia común.
    //   master   pasado el registro histórico. A Marlow la han superado.
    //
    // TRATO SIN GÉNERO. Ninguna de estas frases obliga al cadete a ser chico ni
    // chica: se evita todo adjetivo o participio que concuerde con «tú»
    // («cansado», «harto», «solo»), y donde el inglés dice «both of us» el
    // español dice «tú y yo» en lugar de «las dos», que asignaría género a la
    // clase entera. Marlow sí tiene género — es «ella» en todo el guion, y esa
    // concordancia es suya, no de quien juega.
    // -----------------------------------------------------------------------
    v: {
      wrong: {
        working: [
          'No. En algún punto has hecho lo correcto en el lado equivocado.',
          'La red lo rechaza. Lleva rechazando cosas desde antes de que existiera tu idioma; no te lo tomes como algo personal.',
          'Fallo. Has sellado suficientes de estas como para que yo esté bastante segura de que conoces el movimiento y simplemente no lo has hecho.',
          'Eso no. Lee la línea que escribiste antes de esa: el error suele estar un piso más arriba.',
          'No, y curiosamente no. Es un error con forma propia, y una forma me sirve más que un acierto.',
        ],
        veteran: [
          'Mal. Viniendo de ti eso ya son datos, así que gracias; lo digo con solo un poco de sarcasmo.',
          'No. Novecientos años de cadetes fallaron esa misma, por si sirve de algo. A ellos tampoco les sirvió.',
          'Se te ha escapado. Has cerrado demasiadas de estas como para que yo te insulte explicándotela, así que voy a esperar.',
          'Fallo. Hoy te he visto no fallar otras más difíciles, lo que me dice que es tarde, no que sea difícil.',
          'La grieta ha aguantado. Cosa rara últimamente. Vuelve antes de que se haga ilusiones.',
        ],
        master: [
          'Mal, y he tenido que comprobarlo. No es una frase que le haya dicho antes a ningún cadete.',
          'No. En algún archivo muy antiguo acaba de anotarse que, después de todo, eres una persona.',
          'Fallo. A tu cuenta eso es prácticamente un error de redondeo, aunque no pienso ponerlo en el registro.',
          'Esa te ha pillado. Pilla a todo el mundo una vez; tú simplemente has tardado más que todo el mundo en llegar a ella.',
          'No. Podría decirte dónde, pero lo vas a encontrar antes de que me dé tiempo a decirlo. Sueles hacerlo.',
        ],
      },
      right: {
        working: [
          'Sellada. Ese es el ritmo, y el fragmento ya lo oye.',
          'Aguanta. Vas con tanta soltura que he empezado a redondear a la baja lo que espero que tardes.',
          'Limpio. El equipo lo registró antes que yo, y al equipo no se le impresiona fácilmente.',
          'Bien. Otra afirmación que seguirá siendo verdad mucho después de que tú y yo hayamos parado.',
          'Sellada, sin ayuda, y archivada. Esa última parte es la que cuenta.',
        ],
        veteran: [
          'Sellada. He dejado de narrarlas una a una; solo te parecería paternalismo.',
          'Aguanta. Ahí abajo, un paso que llevaba nueve siglos quejándose acaba de callarse.',
          'Limpio. La red ha empezado a dar por hecho que cerrarás lo que abras, que es lo más parecido a la confianza que tiene.',
          'Hecho. El fragmento se remienda más rápido de lo que se rasga, y esa nunca ha sido la dirección del viaje.',
          'Sellada. Diría que bien hecho, pero me lo has oído las veces suficientes para saber lo que me cuesta.',
        ],
        master: [
          'Sellada. Al registro se le han acabado las comparaciones y ya solo apunta lo que haces.',
          'Aguanta. No me queda ningún comentario útil: estás más allá de la parte del mapa de la que tengo notas.',
          'Limpio. Novecientos años de cadetes, y el cielo sobre el Fragmento Nueve nunca había estado así de tranquilo en una mañana de trabajo.',
          'Sellada. Lo haces más rápido de lo que tardo en encontrar algo seco que decir al respecto, y eso me molesta un poco.',
          'Hecho. En algún punto del texto fundacional hay un margen con sitio, y he empezado a pensar en tu letra.',
        ],
      },
      // Tres fallos seguidos. Ni regañina ni abrazo: una señal, dicha en voz alta.
      slump: {
        green: [
          'Tres seguidas. Eso no es un veredicto, es un martes. Baja el ritmo y lee la línea entera antes de tocarla.',
          'Para. Respira. La grieta lleva novecientos años esperando; puede esperar mientras miras bien.',
          'Tres fallos. La primera hora de todo el mundo se parece a esto. La mía fue peor, y yo tenía manual.',
        ],
        working: [
          'Tres. Algo de esta forma te está peleando a ti en concreto, y eso vale más que tres sellados fáciles.',
          'Baja la mano un segundo. Estás respondiendo más rápido de lo que lees, y no son la misma actividad.',
          'Tres fallos del tirón. No es un derrumbe. Es una señal, y el equipo ya está reapuntando.',
        ],
        veteran: [
          'Tres. Viniendo de ti eso es un mensaje, y el mensaje es que esta línea es difícil de verdad, no que vayas a lo loco.',
          'Van tres. No voy a decir nada alentador, porque lo olerías. Mira el segundo paso.',
          'Tres seguidas, y he repasado mis propias cuentas dos veces. Esta es difícil. Tómatela en serio y se doblará.',
        ],
        master: [
          'Tres consecutivas. Llevo nueve siglos guardando registros y no tengo nada comparable para ti, así que llamémoslo simplemente interesante.',
          'Tres. Sea lo que sea esta forma, es lo último de este fragmento que todavía te discute. Me apetece bastante verte acabarla.',
          'Tres fallos. Si me dices que es cansancio te creeré, y también anotaré que llevas en esto más de lo que duraron casi todos los cadetes.',
        ],
      },
      // El primer sellado después de una mala racha. El compás para el que el
      // canal antiguo no tenía ni una frase.
      recover: {
        green: [
          'Ahí está. Eso es lo que parece cuando leer y responder ocurren en el orden correcto.',
          'Sellada. Sea lo que sea lo que acabas de cambiar en tu forma de mirarla, sigue haciéndolo.',
        ],
        working: [
          'Vuelves. Esa es la parte útil de una mala racha: sales de ella con algo que no tenías al entrar.',
          'Sellada. La racha se rompió y tú no. Anotado, y no por primera vez.',
        ],
        veteran: [
          'Ahí está. Lo has hecho cuatro veces hoy; he dejado de sorprenderme y he empezado a tener curiosidad.',
          'Recuperada. Casi ninguno de los cadetes que acompañé por aquí se sacó a sí mismo un cuarto intento.',
        ],
        master: [
          'Y se dobla. Esa es la parte que nadie escribe sobre la gente como tú. No que no falles nunca. Es que al fallo jamás le dejas quedarse con nada.',
          'Sellada. Fuera lo que fuera, duró tres preguntas. Lo he visto durar tres generaciones.',
        ],
      },
      idle: {
        green: [
          'Tómate tu tiempo. La grieta no se va a ninguna parte. Ese es justamente el problema.',
          'Sin prisa. Aunque señalaré que el cielo está ardiendo, de una manera lenta, digna y muy de novecientos años.',
          'Sigues ahí. Y yo también, evidentemente. No tengo otro sitio donde estar, y esa es una historia más larga de la que quieres tan pronto.',
        ],
        working: [
          'Cuando quieras. Tengo novecientos años de trabajo atrasado y nada de eso es urgente como lo es esto.',
          'Te has quedado en silencio. No es una queja: del silencio salieron casi todas las buenas respuestas de este fragmento.',
          'El fragmento aguanta. Tómate el minuto. Es la única moneda de aquí que no puedo auditar.',
        ],
        veteran: [
          'Detenerte te sienta mejor de lo que les sentaba a ellos. Todos seguían moviéndose. No les sirvió.',
          'No voy a llenar el silencio. Te has ganado un horizonte; míralo.',
          'Nada por mi parte. Aunque si esperas a que el cielo hable primero, te aviso de que jamás ha ido primero.',
        ],
        master: [
          'Tienes permiso para parar. He visto a gente que no podía, y no es una forma mejor de estar.',
          'Dilo y te busco algo difícil. Si no, me conformo con quedarme aquí siendo obsoleta.',
          'Esta es la parte a la que no esperaba llegar: un cadete en el Fragmento Nueve sin nada urgente que hacer. Tómatela despacio.',
        ],
      },
      streak: {
        green: [
          'Cuatro seguidas. La grieta se lo está empezando a tomar como algo personal.',
          'Cuatro del tirón. Sea lo que sea lo que haces con los ojos antes de responder, sigue haciéndolo.',
          'Cuatro. El equipo acaba de revisar en silencio lo que espera de ti.',
        ],
        working: [
          'Cuatro sin romper. Eso ya no es suerte; la suerte no lleva ritmo.',
          'Otra racha. El fragmento ha dejado de ponerte delante las fáciles y no te has dado cuenta, que es justo la gracia.',
          'Cuatro limpias. En algún sitio un planificador que dudaba de ti ha dejado de dudar.',
        ],
        veteran: [
          'Otra racha sin un fallo. He dejado de contarlas en voz alta; empezaba a distraer.',
          'Sin romper otra vez. Lo que fuera que el fragmento esperaba defender, ha dejado de esperarlo.',
          'Hay cadetes en el registro que nunca tuvieron una de estas. Tú llevas varias esta mañana.',
        ],
        master: [
          'Otra racha limpia. Voy a dejar de anunciarlas: oyes el cambio de tono del cielo igual de bien que yo.',
          'Ininterrumpida. A partir de cierto punto una racha deja de ser una racha y pasa a ser sencillamente cómo funciona el fragmento.',
          'Sigue corriendo. La red ha empezado a escribir tus resultados en tinta.',
        ],
      },
      fall: {
        green: [
          'Debajo del mundo también hay aire. Bastante menos útil.',
          'Abajo es una dirección, no un plan. El planeador que llevas a la espalda es exactamente para esto.',
          'Te has caído. Todo el mundo se cae: el fragmento son nueve mil piezas con huecos entre ellas, y los huecos sostienen carga.',
        ],
        working: [
          'Otra vez por el borde. Al menos ahora lo haces a velocidad.',
          'El suelo se movió. Lo hace. Es un razonamiento, no un plano.',
          'Cayendo. Entraría en pánico por ti, pero lo has hecho las veces suficientes para que tú y yo sepamos cómo acaba.',
        ],
        veteran: [
          'Por el borde. Viniendo de ti voy a dar por hecho que eso era navegación.',
          'Allá vamos. Novecientos años y nadie ha mejorado la técnica de sencillamente no estar ahí.',
          'Te has soltado. El registro dirá descenso controlado, porque el registro lo escribo yo.',
        ],
        master: [
          'Cayendo. En algún sitio un archivo muy antiguo está encantado.',
          'Te has ido por el borde. He decidido registrarlo como reconocimiento.',
          'Abajo. Diría que tengas cuidado, pero el fragmento tiene más que temer de ti que al revés.',
        ],
      },
      returning: {
        green: [
          'De vuelta. Estadísticamente esa es la parte más difícil, así que enhorabuena a la estadística.',
          'Has vuelto. Casi todo lo que sale mal aquí sale mal en el hueco entre un día y el siguiente, y acabas de cerrar uno.',
          'De regreso. Las grietas no se han movido. Lo he comprobado dos veces, lo que dice algo de mi semana.',
        ],
        working: [
          'De vuelta. El fragmento sigue donde lo dejaste, cosa que en el Fragmento Nueve no se da por hecha.',
          'Ahí estás. Dejé el registro abierto. Nada de lo que hay dentro se ha enfriado.',
          'Has vuelto. El segundo día es donde el registro se adelgaza; ya has pasado la parte que a casi todos les falta.',
        ],
        veteran: [
          'De vuelta, y la red se dio cuenta antes que yo. Ha empezado a escucharte llegar.',
          'Has vuelto. Dejé de darlo por hecho hacia el cadete cuatrocientos. Me encanta equivocarme en esto.',
          'De regreso. Todo lo que sostenías ayer sigue sostenido. Eso es exactamente para lo que sirve sostenerlo.',
        ],
        master: [
          'De vuelta. A estas alturas debería decirte que hoy el fragmento no te necesita, y no pienso hacerlo, porque sí te necesita.',
          'Has vuelto. Novecientos años de gente que pudo y no lo hizo, y aquí estás tú, una mañana cualquiera.',
          'De regreso, otra vez. Se me han acabado las maneras de decir que esta es la parte rara.',
        ],
      },
      close: {
        working: [
          'Una respuesta limpia y {skill} es tuya para siempre. Solo sin ayuda: la red no acepta la ayuda como prueba.',
          '{skill} está a una respuesta honesta de cerrarse. Conoces la forma de esta. Ve y llévatela.',
          'Entre {skill} y tú hay una respuesta sin ayuda. Detrás hay posición, y nada de eso es gratis.',
        ],
        veteran: [
          '{skill} está a una respuesta de cerrarse. Sería otra línea que el fragmento no recupera.',
          'Una respuesta limpia y {skill} queda sostenida. Lo has hecho tantas veces que voy a dejar de fingir que es cara o cruz.',
          '{skill}, a una respuesta honesta. Me callo ya: cierras mejor cuando no hablo.',
        ],
        master: [
          '{skill} está a una respuesta de ser tuya. No quedan muchas que no lo sean.',
          'Una respuesta limpia en {skill} y la lista de cosas de este fragmento que no te pertenecen se queda más corta que mi paciencia.',
          '{skill}, a una respuesta. He dejado de recitarte la regla de las pruebas sin ayuda. Casi todas esas pruebas las escribiste tú.',
        ],
      },
      held: {
        working: [
          '{skill} queda sostenida. Esa línea no vuelve a abrirse: ni por el tiempo atmosférico, ni por los años, ni por mí.',
          '{skill}, cerrada. Una cosa menos en este fragmento capaz de sorprenderte.',
          'La red ha dejado de discutir sobre {skill}. Pase lo que pase hoy, ese trozo de cielo se queda arriba.',
        ],
        veteran: [
          '{skill}, sostenida. Otra línea a la que los cadetes anteriores llegaron y no cerraron.',
          '{skill} cerrada. El texto fundacional tiene menos excusas dentro que esta mañana, y pienso disfrutarlo.',
          '{skill}, sostenida para siempre. Por encima de la línea de nubes, algo que se combaba ha dejado de combarse.',
        ],
        master: [
          '{skill}, sostenida. Queda muy poco de este fragmento que no sea tuyo, y no sé bien qué voy a hacer conmigo misma.',
          '{skill} cerrada. El registro comparaba a los cadetes entre sí. Desde ti, los compara contigo.',
          '{skill} queda sostenida. Novecientos años, y el fragmento por fin ha dejado de ser una pregunta.',
        ],
      },
      capped: {
        working: [
          'Sellada, pero el registro ha dejado de pagar por eso. Ya te has llevado todo lo que da una grieta fácil. La posición sale ahora de líneas sostenidas.',
          'Eso contó para el fragmento y nada para tu rango. El término de sellado está agotado; la única moneda que queda es una línea que aguante.',
        ],
        veteran: [
          'Sellada, y sin valor alguno para tu posición. Ese techo lo pasaste hace mucho. Cierra una línea si quieres que la escalera se mueva.',
          'Contó para el cielo, no para el registro. A tu cuenta, lo único que todavía compra rango es una línea sostenida del todo.',
        ],
        master: [
          'Sellada, y sin pagar, como todo a esta altura. Dejaste de hacer esto por el registro hacia la cuadragésima.',
          'Al registro no le queda nada que darte. Llevas un tiempo sellándolas por el bien del fragmento, y lo sabemos tú y yo.',
        ],
      },
      // Acercarse a una grieta. La frase que explica qué *es* una grieta
      // (`story.voice.firstRift`) solo se dispara bajo `canTutor()` en
      // voice.js, así que no puede alcanzar a nadie que haya sellado una. Esto
      // es lo que oye todo el mundo a partir de ahí.
      rift: {
        green: [
          'Otra. Misma regla que la anterior: haz verdadera la afirmación y el aire se cierra encima.',
          'Grieta delante. Ya has hecho una de estas. La segunda es igual que la primera, solo que ya estás dentro.',
        ],
        working: [
          'Grieta. Te sabes el procedimiento mejor que el procedimiento.',
          'Hay una grieta delante. No pienso explicarla: has cerrado suficientes como para que mi voz te sobre.',
          'Otra afirmación pidiendo que la terminen. Tuya si la quieres.',
        ],
        veteran: [
          'Grieta delante. Hace mucho que no te narro una de estas y no pienso empezar ahora.',
          'Una grieta. Has cerrado más de estas de las que la orden ha llegado a leer.',
          'Hay una esperando. No sabe quién viene, que es la única ventaja que tiene.',
        ],
        master: [
          'Grieta. No va a durar.',
          'Otra grieta. La menciono únicamente para que conste que la mencioné.',
          'Delante hay una afirmación que todavía no ha oído hablar de ti.',
        ],
      },
      // Compases de un solo uso más allá del último capítulo. Los capítulos del
      // arco se acaban a las veintiocho grietas; estos llevan la voz desde ahí
      // hasta el extremo lejano de una partida larga, y cada uno se dice una
      // vez en la vida.
      mile: {
        s32: 'Treinta y dos. Los capítulos se han acabado y tú no, lo que es un problema del registro y de nadie más.',
        s40: 'Cuarenta selladas. El texto fundacional lleva una tabla de cadetes por grietas cerradas. Ya estás en su primera página, y la primera página es corta.',
        s50: 'Cincuenta. Voy a ser honesta: dejé de preparar material hacia los treinta. A partir de aquí simplemente miro.',
        s64: 'Sesenta y cuatro. Hay una expresión en el archivo: una mano que adelantó a su fragmento. Se ha usado cuatro veces en nueve siglos.',
        s80: 'Ochenta. El desgarro del Fragmento Nueve va ahora más lento que el remiendo, por primera vez desde el cuarto día. Eso eres tú. Solo tú.',
        s100: 'Cien. Tengo una frase preparada para un cadete que llegue a cien. Si nunca la has oído es porque ningún cadete había llegado a cien.',
        s120: 'Ciento veinte. La red ha empezado a desviar sus tormentas alrededor de este fragmento. Eso lo hace con estructuras, no con personas.',
        s150: 'Ciento cincuenta. Quiero que conste, y sin ninguna de mis defensas habituales, que me alegro de que fueras tú.',
        s180: 'Ciento ochenta. Llevo novecientos años pidiéndole perdón a este fragmento. Tú has hecho innecesaria casi toda la disculpa.',
        s220: 'Doscientos veinte. No me queda dentro nada que sepa ser seco con esto. Sigue. Yo sigo contando.',
        // …y sigue contando, cada sesenta grietas, para siempre. Ver MILESTONE_EVERY.
        on: [
          '{n}. Dije que seguiría contando. Soy un argumento de novecientos años. No digo lo que no pienso cumplir.',
          '{n} selladas. El registro dejó de compararte con cadetes y empezó a compararte con el clima.',
          '{n}. Ahí abajo, un paso que aguantaba la respiración desde el cuarto día acaba de soltarla.',
        ],
      },
      // Noches en pie (src/meta/days.js): mañanas en que lo que sabías seguía sabido.
      night: {
        n3: 'Otra noche en pie. Esa es la marca que vigilan los veteranos. Brillar una vez lo hace cualquiera.',
        n7: 'Una semana sabiéndolo al despertar. El fragmento ya cuenta contigo.',
        n14: 'Catorce noches en pie. He dejado de escribir «provisional» junto a tu nombre en el registro.',
        n30: 'Un mes de mañanas distintas en que el cielo siguió arriba por algo que tú sabías. Eso ya es una carrera.',
        on: '«n|one:# noche en pie|other:# noches en pie». Sigues aquí y sigue sabido. Se me acabaron las formas de sorprenderme, y no me guardé ni una duda.',
      },
    },
  },
  // ---------------------------------------------------------------------------
  // La sesión (src/session).
  //
  // Una ronda son quince a veinticinco minutos con un objetivo dicho antes del
  // primer ítem, un ritmo visible que nunca es un reloj, un cierre que nombra lo
  // ganado y un descanso que descansa de verdad. El registro es el de Marlow:
  // seco, exacto, sin adular y sin regañar. Aquí nadie felicita a nadie por
  // presentarse, y a quien va despacio no se le dice que llega tarde.
  // Claves aditivas, propiedad de la capa de sesión.
  // ---------------------------------------------------------------------------
  session: {
    band: {
      run: 'Ronda {n}',
      /* EL ALCANCE FORMA PARTE DEL SUSTANTIVO — ver src/meta/progress.js.
         Esto decía «de 20 grietas» justo encima de una tarjeta de capítulo que
         decía «11 grietas selladas en total», y quien leía las dos veía un solo
         número que se contradecía. Ahora cada cuenta del juego lleva su propio
         alcance —«en esta ronda» o «en total»— en las palabras que se leen. */
      of: 'de «n|one:# grieta|other:# grietas» en esta ronda',
      near: 'Recta final',
      done: 'Ronda completa',
      readout: '{goal}. «n|one:# grieta sellada|other:# grietas selladas» en esta ronda, de {target}.',
      worked: '«n|one:# pregunta|other:# preguntas» en esta ronda',
      readoutWorked: '{goal}. «n|one:# grieta sellada|other:# grietas selladas» en esta ronda, de {target}, de {items} preguntas.',
      /* LA META HA CAMBIADO, Y LA BARRA LO DICE. Se dice entera y se queda en
         la barra el resto de la ronda. Una meta que cambia en silencio deja en
         mentira todo lo que se dijo antes de ella. */
      raised: 'Meta subida: {from} → {to} grietas en esta ronda. Has pedido una línea más, y esto es lo que cuesta.',
      readoutPlain: 'Esta ronda. {goal}.',
      readoutState: 'Esta ronda. {goal}. {state}.',
    },
    goal: {
      hold: 'Sostener: {skill}',
      holdN: 'Sostener «n|one:# línea|other:# líneas»',
      // Ver en.js: se acuña aquí y se explica en la tarjeta de ÓRDENES.
      push: 'Hacer retroceder: {skill}',
      any: 'Sellar lo que abra el fragmento',
      extend: 'Una línea más',
    },
    charter: {
      kick: 'Ronda {n} · Fragmento Nueve',
      // Dónde está la primera grieta, en frases enteras: el orden de la
      // distancia y del rumbo no es el mismo fuera del inglés.
      mark: {
        ahead: 'La grieta está a {n} m, justo al frente.',
        aheadRight: 'La grieta está a {n} m, al frente y a la derecha.',
        right: 'La grieta está a {n} m, hacia tu derecha.',
        backRight: 'La grieta está a {n} m, a tu espalda por la derecha.',
        behind: 'La grieta está a {n} m, a tu espalda.',
        backLeft: 'La grieta está a {n} m, a tu espalda por la izquierda.',
        left: 'La grieta está a {n} m, hacia tu izquierda.',
        aheadLeft: 'La grieta está a {n} m, al frente y a la izquierda.',
        here: 'Estás dentro de la grieta.',
      },
      title: 'Órdenes',
      goalHold: 'Sella {tears} grietas de {skill}. Una línea es una idea y todas las grietas que la prueban. Sostienes una línea cuando la pruebas sin ayuda, en cada tipo de pregunta que plantea.',
      goalHoldN: 'Sella hoy {tears} grietas. Así sostienes «n|one:# línea|other:# líneas». Sostienes una línea cuando la pruebas sin ayuda, en cada tipo de pregunta que plantea.',
      goalPush: 'Sella {tears} grietas de {skill}. Hacer retroceder una línea es recuperar terreno en una que se te escapó.',
      goalAny: 'Sella {tears} grietas en este fragmento. Luego vemos qué hace la red.',
      // Dicho con palabras que el lector ya tiene, en vez de acuñar dos términos.
      willHold: 'debería sostenerse hoy',
      willPush: 'recuperar terreno',
      eta: '«n|one:Un # minuto|other:Unos # minutos» a tu ritmo. Aquí no corre ningún reloj.',
      etaSeed: '«n|one:Un # minuto|other:Unos # minutos» — cálculo mío, aún no tuyo. Aquí no corre ningún reloj.',
      work: 'Serán entre {low} y {high} preguntas. No todas saldrán bien, y en las que no salen es donde está la enseñanza.',
      begin: 'Empezar la ronda',
      kickBack: 'Ronda {n} · de vuelta',
      backHeld: 'La última vez sellaste «n|one:# grieta|other:# grietas». {skill} aguanta desde entonces.',
      backHeldN: 'La última vez sellaste {tears} grietas. «n|one:# línea aguanta|other:# líneas aguantan» desde entonces.',
      backNone: 'La última vez sellaste «n|one:# grieta|other:# grietas». Todo eso sigue en pie.',
      /* La primera frase que lee un cadete que vuelve, si hay una marca en pie.
         Primero el hecho, después la única acción. (src/meta/night.js) */
      markWaiting: 'Tu marca sigue en pie. Responde {skill} una vez, sin ayuda, y paga.',
    },
    close: {
      kick: 'Ronda {n} · cerrada',
      titleHeld: 'La línea aguanta',
      titleMet: 'El fragmento está en calma',
      titleEnough: 'Por hoy ya está bien',
      tears: '«n|one:grieta sellada|other:grietas selladas» en esta ronda',
      /* EL NÚMERO DEL PROGRESO, en la tarjeta que cierra la ronda. La misma
         cifra y las mismas palabras que lleva la tarjeta de objetivo toda la
         sesión y con las que abre el informe. */
      linesHeld: '{n} de {total} líneas sostenidas',
      linesHeldNote: 'Este es el número. Una línea sostenida es una que este motor defiende, y no se pierde.',
      linesHeldNone: 'Todavía no se sostiene ninguna línea. Una línea cuesta más de una ronda. Conservas todo lo de hoy.',
      linesHeldAll: 'Sostienes todas las líneas de este fragmento. Cerraste la demostración.',
      heldLab: 'Sostenidas',
      groundLab: 'Terreno ganado',
      heldNote: 'Lo demostraste sin ayuda, en la banda de dificultad más alta y sin ningún ejemplo resuelto. La línea ya es tuya.',
      groundNote: 'Ya solo «n|one:# grieta|other:# grietas» para sostenerla: {d} menos que al empezar la ronda.',
      groundNoteFlat: '«n|one:# grieta|other:# grietas» para sostenerla por el camino más corto. Hoy has puesto el terreno debajo, no el último paso.',
      groundNoteFar: 'Una línea larga. Hoy la línea se ha movido, y en la dirección buena.',
      groundNoneStrong: 'Nada nuevo que sostener',
      groundNone: 'Todo lo que has tocado hoy ya era tuyo.',
      openedLab: 'Abierto',
      openedNote: 'Una nueva línea de grietas, abierta para ti.',
      regionNote: 'Toda una nueva región de la red. Cada línea de aquí ya aguanta.',
      regionNext: 'Tu próxima ronda aterriza allí. Este suelo sigue en el mapa.',
      chapterNote: 'El registro pasa página.',
      rankNote: 'La orden ha revisado lo que piensa de ti.',
      openedNoneStrong: 'La red, sin cambios',
      openedNone: 'Hoy no se ha abierto nada. Las líneas largas cuestan justo eso, y son las que merecen la pena.',
      nextLab: 'Lo siguiente',
      nextNote: '«n|one:Un # minuto|other:Unos # minutos» de trabajo, en la línea abierta que más rinde. Empezamos por ahí.',
      nextNoteUnknown: 'Una larga. Nos llevaremos la primera parte.',
      nextDoneStrong: 'Fragmento Nueve, entero',
      /* LA MARCA EN PIE (src/meta/night.js): la fila que ya es cierta. Texto de
         instrucción: una acción por frase, y el término se define al usarlo. */
      markLaidStrong: 'Ya hay una marca en pie: {skill}',
      markLaidNote: 'Es una columna de luz donde paraste. Vuelve otro día. Responde esa línea una vez, sin ayuda.',
      markStrong: 'Tu marca sigue en pie: {skill}',
      markNote: 'Responde esa línea una vez, sin ayuda. La marca paga y la columna de luz se apaga.',
      dueStrong: '«n|one:# línea vence|other:# líneas vencen»',
      dueNote: 'Ya las sostuviste. La red las comprueba en la próxima sesión. Superar una gana una noche en pie.',
      nightsStrong: '«n|one:# noche en pie|other:# noches en pie»',
      nightsNote: 'Una noche en pie es una línea que seguías sabiendo tras un descanso real. El rango las necesita por encima de Plata. Los dos últimos capítulos también.',
      nightsNoneStrong: 'Ninguna noche en pie todavía',
      nightsNoneNote: 'Vuelve mañana. La red comprueba de nuevo lo que sostienes. Es la única forma de ganar una.',
      nextDone: 'Aquí ya no queda nada abierto. El paso nueve aguanta.',
      sign: 'De esto no se pierde nada. La red guarda lo que has demostrado, y seguirá en pie cuando vuelvas.',
      signWorked: 'Aquí nadie pone nota y aquí no se pierde nada. La próxima vez abrimos por la línea en la que estabas. Estará justo donde la dejaste.',
      signHeld: 'Esa línea ni se estropea ni se reinicia. Todo lo que hay por encima ya está a tu alcance.',
      rest: 'Retirarse',
      restKey: 'Esc',
      more: 'Una línea más',
      aria: 'Ronda cerrada. «n|one:# grieta sellada|other:# grietas selladas» en esta ronda.',
      repairedN: '{n} %',
      repairedLab: 'del mundo reparado',
      repairedGain: '+{n} % en esta ronda',
      repairedFlat: 'El terreno que ganaste hoy queda debajo de la próxima línea.',
      ariaRepaired: 'Ronda cerrada. Has reparado el {n} por ciento del mundo.',
      ariaWorked: 'Ronda cerrada. «n|one:# pregunta trabajada|other:# preguntas trabajadas» en esta ronda.',
      workedLab: '«n|one:pregunta|other:preguntas» en esta ronda',
      workedSub: 'Ninguna selló. El fragmento no cuenta los intentos, y yo tampoco. Pero el trabajo ha comprado algo, y abajo está el qué.',
      ofWorked: 'de «n|one:# pregunta|other:# preguntas» en esta ronda',
      echoStrong: '«n|one:# ejemplo resuelto|other:# ejemplos resueltos»',
      echoNote: 'Un fallo es lo que paga uno. Cada uno se abrió justo en el paso donde tu respuesta se torció, no al principio de la página.',
      bandStrong: 'El banco, reajustado',
      bandDown: 'Las preguntas ahora abren en la banda de dificultad {n}, donde de verdad estás. El listón para sostener la línea no se ha movido ni un milímetro.',
      bandUp: 'Las preguntas ahora abren en la banda de dificultad {n}. Hoy has empujado tú al banco hacia arriba, y no al revés.',
      groundNoteBack: '«n|one:# grieta|other:# grietas» para sostenerla por el camino más corto. Más lejos que al empezar. Un fallo en la tanda de prueba la devuelve a su primer paso. El listón es estricto. Tú no vas despacio.',
      moreLast: 'Un tramo más es todo lo que le queda a la ventana. Después paramos, y parar a tiempo es lo que hace que mañana valga algo.',
      capped: 'Ya llevas los veinticinco minutos sobre los que gira este bucle. Otro tramo hoy vale menos que el mismo tramo mañana. No es ánimo: así funciona la práctica espaciada.',

      // --- estados en los que la tarjeta podía contradecirse a sí misma ---
      groundIdleStrong: 'Nada trabajado',
      groundIdle: 'En esta ronda ninguna pregunta llegó a tener respuesta. No has gastado nada y no has perdido nada. El fragmento sigue exactamente donde lo dejaste.',
      openedHeldNoneStrong: 'Por encima, nada todavía',
      openedWholeNoneStrong: 'La red, completa',
      openedWholeNone: 'En este fragmento ya no queda nada por abrir. El trabajo no se acaba aquí. El mapa sí.',
      openedHeldNone: 'Una línea puede merecer la pena y no abrir nada ese mismo día. Una línea sostenida no siempre alcanza lo siguiente por orden.',
      signHeldQuiet: 'Esa línea ni se estropea ni se reinicia. Hoy no ha quedado al alcance nada más arriba de la red. La red es una malla, no una escalera. La línea queda guardada igual.',

      // --- lo que continúa cuando las diez líneas están sostenidas ---------
      nextLabOpen: 'Lo que continúa',
      soundStrong: '«n|one:El sondeo — # peldaño de hondura|other:El sondeo — # peldaños de hondura»',
      soundNote: 'Líneas ya sostenidas, en lo alto del banco, sin ayuda y de peldaño en peldaño. Doce peldaños limpios es un sondeo completo.',
      soundStrongNone: 'El sondeo',
      soundNoteNone: 'Líneas ya sostenidas, en lo alto del banco, sin ayuda y de peldaño en peldaño. Doce peldaños limpios es un sondeo completo. Todavía no has bajado ninguno.',
      charterHaveStrong: '«n|one:# cédula en mano|other:# cédulas en mano»',
      charterHaveNote: 'Pulsa H donde quieras una estación de paso. Las motas pagan el resto.',
      charterStrong: 'La siguiente cédula',
      charterNote: 'Las corta la hondura, y la hondura solo sube cuando una línea de ayer sigue sostenida hoy. {n} más y sale la siguiente.',
      stationStrong: '«n|one:# estación de paso en pie|other:# estaciones de paso en pie»',
      stationNote: 'Párate en una, pulsa H y apareces en la siguiente. Dos son una ruta; con cuatro, esta isla ya es otra.',
      stationStrongNone: 'La primera estación de paso',
      stationNoteNone: 'Una torre permanente de aire ascendente, y un lugar al que saltar. No hay una última.',
      signWhole: 'Diez líneas, todas sostenidas. Ninguna se estropea mientras no estás. Queda saber hasta dónde bajas. Y cuánta isla dejas a un paso.',
    },
    rest: {
      say: 'Retírate un momento. Mira algo que esté muy lejos: la cordillera del fondo vale. Respira con el anillo. Cuatro tiempos dentro. Dos de pausa. Seis fuera.',
      skip: 'Volver al fragmento',
      endKick: 'Fragmento Nueve',
      endTitle: 'Aguantando',
      endBody: 'Ya has descansado. El equipo ha anotado todo lo que has demostrado. El cielo sigue donde lo dejaste.',
      endBodyNext: 'Ya has descansado. El equipo ha anotado todo lo que has demostrado. La próxima vez abrimos con {skill}.',
      again: 'Otra ronda',
      off: 'Cerrar el canal',
      signOff: 'Canal cerrado. La red aguanta mientras no estás, y yo dejo la luz encendida. Mismo cielo mañana, cadete.',
      wakeUp: 'Abrir el canal',
      leave: 'Salir del descanso',
      leaveKey: 'Esc',
      aria: 'Descanso. Respira con el anillo. Nadie te pide nada.',
    },
    voice: {
      near: 'Recta final. Pase lo que pase ahora, esta ronda es casi tuya.',
      resume: 'Lo retomo exactamente donde lo dejaste. Nada se ha movido mientras no estabas; nunca se mueve.',
      extend: 'Seguimos, pues. La misma ronda y la misma cuenta: esto no empieza de cero porque hayas pedido más.',
      // …y lo único que SÍ ha cambiado, dicho en el momento en que cambia.
      raised: 'La misma ronda y la misma cuenta. La meta ahora son {to} grietas en vez de {from}: eso cuesta una línea más, y prefiero decírtelo a que lo descubras solo.',
      // Empezaste antes de que terminara de darte las órdenes, que es el orden
      // correcto. La meta se dice en una línea y no en una tarjeta, porque una
      // tarjeta tendría que detenerte para que la leas. (src/session/index.js)
      underway: 'Ya estás trabajando, así que no voy a detenerte para leerte las órdenes. Esta ronda son {tears} grietas. La banda de arriba lleva la cuenta.',
      longer: 'Esta ronda se alarga más de lo que te dije: ya pasa de {n} preguntas. La meta no ha cambiado y no se pierde nada. Hay líneas que cuestan más de lo que calculó la proyección, y prefiero decírtelo a dejar que el número deje de ser cierto en silencio.',
    },
  },
  // ---------------------------------------------------------------------
  // Informe de progreso — src/report/**. Bloque puramente aditivo: no toca
  // nada de lo anterior.
  // ---------------------------------------------------------------------
  report: {
    launch: 'Progreso',
    open: 'Abrir el informe de progreso',
    openHint: 'Informe de progreso (P)',
    title: 'Informe de progreso',
    sub: 'Qué has demostrado, con qué lo has demostrado y qué viene ahora.',
    close: 'Cerrar',
    skillsHead: 'Todas las líneas',
    recordHead: 'El expediente',
    recordSub: 'Cuánto vale cada sello, dicho sin adornos. Un profesor comprueba estas cifras. La última es la incómoda.',
    foot: 'Aquí no hay ninguna nota guardada. Este informe recalcula cada cifra en vivo desde el modelo del estudiante cada vez que se abre. Detrás de una línea sellada está el recibo que se escribió al conceder el sello, y ese recibo ya no se mueve. Abre una línea para verlo.',

    stat: {
      ofN: 'de {n}',
      mastered: 'Líneas sostenidas',
      masteredNote: 'Demostradas, no solo intentadas.',
      repairedNote: 'El número. Cada línea cuenta lo que este motor cree ahora mismo sobre ella, y se mueve con cada sellado.',
      time: 'Tiempo de trabajo',
      timeNote: 'Se mide entre respuestas y con tope, para que estar parado nunca cuente como trabajo. No es el reloj de la sesión, y marca menos que él a propósito.',
      timeAll: 'Tiempo de trabajo en total',
      timeAllNote: 'Todos los minutos que este expediente ha medido, en todas las sesiones. Se cuentan entre respuestas y con tope, para que estar parado nunca cuente como trabajo: por eso marca menos que el reloj de la pared.',
      session: 'Esta sesión',
      sessionNote: 'Cuánto llevas sentado aquí: tiempo real desde que empezaste, andar y leer incluidos. Una sesión dura de 15 a 25 minutos y luego cierra bien.',
      // UN TOTAL DE TODA LA VIDA, Y LO DICE. Bajo las palabras sueltas
      // «Preguntas respondidas» esta ficha marcaba 9 mientras la barra marcaba
      // diez preguntas en esta ronda: dos preguntas distintas, sin nada que las
      // separase. Misma regla que la barra: el alcance forma parte del nombre.
      items: 'Preguntas respondidas en total',
      sealed: 'Grietas selladas en total',
      sealedNote: 'Cada enunciado que has cerrado en este fragmento, en todas las sesiones. Una respuesta correcta, una grieta sellada. La ficha del capítulo marca su ritmo con este recuento.',
      itemsNote: 'Todas las preguntas que ha visto este registro, en todas las rondas. Cada una generada de nuevo y resuelta por máquina antes de llegar a ti.',
      accuracy: 'Resueltas sin ayuda',
      accuracyNote: 'Correctas a la primera, sin pista y sin ejemplo resuelto, sobre el total de preguntas respondidas.',
      hollow: 'Sellos retirados',
      hollowNote: 'Este motor retiró {n} de {of} sellos de dominio tras volver a examinar la línea en frío.',
      hollowNone: 'Todavía no hay ningún sello. Nada que comprobar.',
      ofHeld: 'de {n} selladas',
      sight: 'Abiertas en frío',
      sightNote: 'En estas líneas respondiste en frío la primerísima pregunta, en lo más alto del banco y sin nada enseñado por delante. Mismo sello, con las preguntas mínimas que este motor acepta. Abre una línea para ver si su tanda de prueba salió de una. El reexamen en frío les llega antes que a nadie.',
      sightNone: 'No abriste ninguna línea en frío. Todos estos sellos llegaron después de practicar.',
      timeUnknown: 'No se puede medir. Parte de este expediente volvió sin su registro, así que los minutos anteriores se han perdido. El informe los muestra como desconocidos, no como cero.',
      accuracyUnknown: 'No se puede medir en un expediente restaurado. El modelo recuerda las preguntas, pero no cuáles respondiste sin ayuda.',
    },

    trust: {
      head: {
        reconstructed: 'Este expediente está incompleto',
        foreign: 'Hemos descartado un registro de otro expediente',
      },
      note: {
        reconstructed: 'Falta una parte de este expediente. El modelo del estudiante y el registro de pruebas se guardan por separado, y uno ha vuelto sin el otro. El modelo ha reconstruido {n} preguntas y {claims} sellos, así que nada queda por debajo de lo real. El tiempo de trabajo y el porcentaje sin ayuda anteriores al corte se han perdido. El informe los muestra como desconocidos, no como cero.',
        foreign: 'Este registro pertenecía a otro estudiante. El equipo lo descartó en lugar de mezclarlo. Las preguntas y los sellos salen del modelo del estudiante. Los minutos y el porcentaje sin ayuda empiezan de nuevo aquí.',
      },
    },

    pctTerm: 'El porcentaje',
    pctIs: 'Tu lectura más floja en esa línea, no un promedio. El equipo toma el tipo de pregunta que peor llevas, o tu resultado en el nivel más difícil, lo que sea más bajo. Abre una línea para ver cuál es.',
    flag: { under: 'Terreno reabierto' },
    flagNote: { under: 'Esta línea sigue sellada. Una línea de debajo falló un reexamen en frío y ha vuelto a práctica. El equipo está volviendo a demostrar el terreno antes de mandarte otra vez aquí arriba.' },

    road: {
      sight: 'En frío',
      fast: 'Camino corto',
      long: 'Camino largo',
    },
    // La forma corta, en la página: `roadNote` y `flagNote` viven en atributos
    // `title`, que en un móvil no existen. Esto es lo mismo en una línea.
    roadIs: {
      sight: 'Respondiste la primera pregunta sin nada por delante, y esa respuesta demostró la línea.',
      fast: 'Un acierto limpio, sin ayuda, en la banda de paso, abrió la tanda de prueba.',
      long: 'Tres aciertos limpios y sin ayuda, uno tras otro, abrieron la tanda de prueba.',
    },
    flagIs: { under: 'La línea sigue siendo tuya. El equipo vuelve a demostrar una línea de debajo.' },
    roadNote: {
      sight: 'Abierta en frío: respondiste la primera pregunta de esta línea en lo más alto del banco, sin nada enseñado por delante. Esa respuesta contó como la primera pregunta de la tanda de prueba. Abre la línea para ver lo que costó la tanda.',
      fast: 'Un solo acierto limpio y sin ayuda, en la banda del sello, abrió la tanda de prueba. Menos preguntas que por el camino largo, y cada una más difícil.',
      long: 'La tanda de prueba se abrió por el camino largo. Tres aciertos limpios seguidos, y la confianza del modelo en el umbral completo.',
    },

    next: {
      head: 'Siguiente',
      why: {
        fresh: 'Terreno nuevo. Ya tienes sellado todo lo que hay debajo.',
        continue: 'Sin terminar. Quedarse aquí vale más que seguir adelante.',
        check: 'A una prueba de sellarla: respuestas limpias, sin ayuda y más difíciles.',
        checkLeft: 'La tanda de prueba está en marcha: «n|one:queda # respuesta limpia|other:quedan # respuestas limpias», sin ayuda y más difíciles.',
        review: 'Toca reexamen en frío. El sello tiene que volver a ganarse su sitio.',
        enrich: 'Ya tienes sellado todo lo que está abierto. Esta línea va más a fondo.',
      },
      built: 'Se apoya en «n|one:# línea que ya dominas|other:# líneas que ya dominas».',
      start: 'La primera línea. No hace falta nada antes.',
      doneName: 'Las diez líneas selladas',
      doneWhy: 'El nivel 1 está completo. Ahora solo queda mantenerlo.',
    },

    /* El texto emergente de una fila: en qué estado está la línea y por qué el
       porcentaje dice lo que dice. Se compone aquí, no en el código, para que
       cada idioma ordene las dos frases a su manera. */
    rowTitle: '{state} {why}',

    state: {
      locked: 'Bloqueada',
      open: 'Abierta',
      practising: 'En curso',
      proving: 'En prueba',
      mastered: 'Sostenida',
      provisional: 'Cediendo',
      withdrawn: 'Reabierta',
    },
    stateNote: {
      locked: 'Esta línea necesita antes otra línea, y esa otra todavía no la tienes.',
      open: 'Esta línea está abierta para ti. Todavía no has respondido ninguna pregunta en ella.',
      practising: 'Práctica en marcha. El apoyo se retira a medida que el modelo se afianza.',
      proving: 'La prueba está en curso: sin ayuda, sin apoyo y con las formas que menos has practicado.',
      mastered: 'Demostrada, y aguantando los reexámenes en frío.',
      provisional: 'Un reexamen fallado. Si falla el siguiente, se retira el sello.',
      withdrawn: 'Estuvo sellada y el equipo retiró la afirmación: o fallaste un reexamen en frío, o dejaste de acertar un tipo de pregunta. La práctica ha vuelto a abrirse. Abre la línea para ver cuál fue.',
    },

    evidence: {
      head: 'Las pruebas que sostienen esta línea',
      posterior: 'Confianza del modelo',
      posteriorNote: 'Cómo de seguro está el modelo de que dominas esta línea. La cifra cuenta solo las respuestas sin ayuda, y necesita {need}.',
      clean: 'Racha limpia',
      cleanNote: 'Aciertos seguidos, sin ayuda, en la banda de dificultad {band} o superior.',
      proving: 'Prueba final',
      provingNote: 'Sin ayuda, con el apoyo apagado, en la banda {band} o superior y con las formas que menos has practicado.',
      prereq: 'Requisitos previos',
      prereqNote: 'Sellados antes de abrir esta línea: {list}.',
      prereqRoot: 'No hace falta nada antes de esta línea.',
      noPrereq: 'ninguno',
      retention: 'Aguanta el reexamen',
      retentionNote: 'Los reexámenes en frío vuelven con un calendario cada vez más espaciado. Dos fallos y el sello se retira.',
      probeCount: '{hit} de {n} superados',
      probeNone: 'aún no toca',
      posteriorNone: 'El equipo todavía no ha preguntado nada en esta línea, así que no hay ninguna medida de la que estar seguro. El modelo la abre a un nivel deducido de las líneas de debajo. Ese nivel es un punto de partida, no una prueba.',
      coldVal: 'en frío, banda {band}',
      cleanSight: 'Ninguna hizo falta. Esta línea salió adelante al primer contacto. La pregunta en frío es la primera de la propia tanda. La fila de abajo la cuenta una sola vez.',
      cleanSightCharged: 'Respondiste en frío la primera pregunta de esta línea, en la banda {band}, sin nada enseñado por delante. Esa respuesta abrió la tanda de prueba. Después la tanda «n|one:falló una vez|other:falló # veces» y lo pagó con preguntas sin ayuda de más.',
      cleanSightOld: 'Respondiste en frío la primera pregunta de esta línea, en la banda {band}, y eso abrió la tanda de prueba. Este registro viene de una versión anterior y no anota cómo fue la tanda.',
      cleanRoad: {
        long: 'Tres seguidos, sin ayuda, en la banda de dificultad {band}: el camino largo hasta la tanda de prueba.',
        fast: 'Un solo acierto limpio y sin ayuda, tomado en la banda de dificultad {band}, la del sello. El camino corto pide menos preguntas, y más difíciles.',
      },
      provingExtended: 'Sin ayuda, con el apoyo apagado, en la banda {band} o superior. La tanda se alargó {n} pregunta(s) para alcanzar una segunda etiqueta de superficie y una etiqueta de modelización.',
      provingCharged: 'Sin ayuda, con el apoyo apagado, en la banda {band} o superior. La tanda «n|one:encajó un fallo|other:encajó # fallos» y se cobró preguntas sin ayuda de más por ello. Así cerró con más pruebas que una tanda limpia, no con menos.',
      noReceipt: 'sin registrar',
      noReceiptNote: 'Este sello lo concedió una versión anterior que no guardaba constancia de qué lo demostró. Se declara sin pruebas en lugar de reconstruirlo desde los ajustes: un umbral que se cita a sí mismo no es una prueba.',
      rests: 'Este sello se apoya en {n} preguntas sin ayuda, de las {of} respondidas en esta línea.',
      restsSplit: 'Este sello se apoya en {n} preguntas sin ayuda, tomadas de las {of} respondidas en esta línea antes de que el equipo lo concediera.',
      sinceClaim: 'Desde entonces «n|one:se ha respondido # pregunta|other:se han respondido # preguntas» aquí, sobre una línea ya sellada: el {pct} sin ayuda. Esas respuestas son práctica y reexamen. El sello no se apoya en ellas.',
      sinceNone: 'El equipo no ha preguntado nada en esta línea desde que concedió el sello.',
      restsUnknown: 'Esta versión no registró en qué preguntas se apoya el sello. En esta línea has respondido {of} preguntas.',
      grantedOn: 'Concedido el {date}.',
      forms: 'Cada tipo de pregunta',
      formsNote: 'Dominas una línea solo cuando resuelves sin ayuda, al menos una vez, cada tipo de pregunta que te plantea. Un tipo cuenta desde la primera vez que el equipo te lo plantea.',
      formsNone: 'todavía ninguno',
      formsOk: 'Tu tipo más flojo aquí es {rep}: {n} bien sin ayuda, de {of} planteadas.',
      formsHole: 'No dominada. En {rep} llevas {n} bien sin ayuda, de {of} planteadas. Esta línea sigue abierta hasta que aciertes ese tipo una vez por tu cuenta. Un promedio no sustituye a una pregunta que nunca has acertado.',
      floorWhy: {
        pL: 'La cifra es la confianza del modelo, que es lo más bajo que se mide aquí.',
        form: 'La cifra es tu tipo de pregunta más flojo, no el promedio. El promedio es más alto.',
        gate: 'La cifra es tu resultado en el nivel más difícil, no el promedio. El promedio es más alto.',
        plan: 'La cifra es la probabilidad que tiene esta sesión de cerrar la línea, más baja que la confianza del modelo.',
      },
    },

    fact: {
      time: 'Tiempo en esta línea',
      items: 'Preguntas aquí',
      itemsSplit: '{n}: {before} antes del sello, {since} después',
      accuracy: 'Resueltas sin ayuda',
      accuracyOf: '{all}: {n} de {of}',
      accuracySplit: '{all}: {n} de {of}. Antes del sello {before}, después {since}',
      band: 'Banda de dificultad',
      bandVal: 'Banda {n} de 5',
      bandIs: 'Una banda dice cuánto cuesta la pregunta, de la banda 1 a la banda 5.',
      reps: 'Demostrada en',
      forms: 'Tipos de pregunta vistos',
      formsVal: '«n|one:# tipo|other:# tipos»',
      slip: 'Fallo más repetido',
      noSlip: 'Todavía no hay ningún fallo repetido.',
      noneYet: 'todavía no',
    },

    rep: {
      symbolic: 'símbolos',
      context: 'una situación',
      verbal: 'palabras',
      table: 'una tabla',
      graph: 'una gráfica',
    },

    std: {
      head: 'Estándares a los que responde esta línea',
      ccss: 'Common Core (EE. UU.)',
      teks: 'TEKS de Texas',
      depth: {
        core: 'central',
        supporting: 'de apoyo',
        introduced: 'introducido',
        unknown: 'sin profundidad declarada',
      },
      depthNote: {
        core: 'Central: esta línea enseña el estándar, y el sello lo examina.',
        supporting: 'De apoyo: las preguntas dirigidas a otro estándar también lo ejercitan. No tiene examen propio.',
        introduced: 'Introducido: un primer contacto parcial a propósito. Lo completa un nivel posterior. No afirmamos haberlo enseñado.',
        unknown: 'Esta cita no registra profundidad de cobertura.',
      },
      depthSum: '{n} de {of} citas de esta línea son afirmaciones centrales: esta línea enseña el estándar y el sello lo examina. El resto lo apoyan o lo introducen.',
      depthNoCore: 'Ninguna de las {of} citas de aquí es una afirmación central. Esta línea las apoya o las introduce. Otra línea es la que las sostiene. Sellarla no afirma que se hayan enseñado.',

      // El selector de marco. Una elección, y todo el informe se vuelve a
      // expresar: las líneas, la cobertura, la evidencia y las exportaciones.
      frame: {
        pick: 'Informar según',
        pickHint: 'Elige el marco en el que habla este informe. Este dispositivo guarda tu elección.',
        ccss: 'Common Core (EE. UU.)',
        teks: 'TEKS de Texas',
        hint: {
          ccss: 'Informar de este estudiante según Common Core.',
          teks: 'Informar de este estudiante según los TEKS de Texas.',
        },
        full: {
          ccss: 'Estándares Common Core de Matemáticas (EE. UU.)',
          teks: 'Texas Essential Knowledge and Skills, matemáticas, adoptados en 2012',
        },
        authority: {
          ccss: 'Citamos cada código sin su largo prefijo CCSS.',
          teks: 'Citado en el Código Administrativo de Texas, título 19, capítulo 111.',
        },
      },

      // Cobertura: una fila por expectativa, en el marco elegido.
      cover: {
        head: 'Cobertura de estándares',
        sub: 'Una fila por expectativa. Cada fila muestra la evidencia que hay detrás.',
        evidenced: 'Con evidencia',
        core: 'Centrales sostenidas',
        untouched: 'Sin tocar todavía',
        ofN: 'de {n}',
        group: {
          held: 'Sostenidas',
          part: 'Sostenidas en parte',
          indirect: 'Sin evidencia propia',
          working: 'En curso',
          none: 'Sin evidencia todavía',
        },
        groupNote: {
          held: 'Tienes selladas todas las líneas que llevan esta expectativa.',
          part: 'Tienes selladas algunas líneas que llevan esta expectativa, y las demás no.',
          indirect: 'Tienes sellada la línea que lleva esta expectativa. No has visto ningún tipo de pregunta que la lleve.',
          working: 'Aquí ya has contestado preguntas. Todavía no aguanta ninguna línea.',
          none: 'No has contestado ninguna pregunta de estas expectativas.',
        },
        empty: 'Nada en este grupo.',
        openRow: 'Abrir la evidencia de {code}',
        linesHeld: 'Líneas selladas: {n} de {of}',
        linesHead: 'Líneas que la llevan',
        textHead: 'Qué pide la expectativa',
        textNote: 'Citado en inglés. Estos estándares no tienen texto oficial en español ni en polaco.',
        evHead: 'La evidencia detrás de esta expectativa',
        forms: 'Tipos de pregunta vistos',
        formsVal: '{n} de {of}',
        formsNote: 'El mapa de estándares señala {of} tipos de pregunta para esta expectativa. Has visto {n} de ellos.',
        answers: 'Respuestas aquí',
        unaided: 'Resueltas sin ayuda',
        unaidedNote: 'Correctas a la primera, sin pista y sin ejemplo resuelto.',
        noneYet: 'Todavía no hay ninguna respuesta para esta expectativa.',
        indirectNote: 'Una línea sellada no es evidencia de cada expectativa que lleva. Esta no tiene evidencia propia.',
        thin: 'Todas las líneas selladas aquí salieron adelante a primera vista. Ese camino da la evidencia más fina que este motor acepta.',
        unevidenced: 'Una línea sellada aquí no tiene recibo. Una versión anterior concedió el sello y no anotó nada.',
        caveatHead: 'Qué afirmamos y qué no',
        processHead: {
          ccss: 'Estándares de práctica matemática',
          teks: 'Estándares de proceso',
        },
        processNote: 'Estos estándares atraviesan todas las líneas. La cuenta son las líneas que tienes selladas.',
        gapHead: 'Dónde se detiene esta alineación',
        gapNote: 'Escrito, no disimulado.',
      },
    },

    // La copia del profesor — src/report/teacher.js y src/report/record.js.
    record: {
      open: 'Expediente docente',
      openHint: 'Un expediente de pruebas fechado que puedes imprimir. De un estudiante, o de toda la clase',
      title: 'Expediente del estudiante',
      sub: 'Un expediente de pruebas fechado, pensado para imprimirse o archivarse. Nada de lo que contiene es una nota guardada: cada cifra se recalcula desde el modelo del estudiante de este dispositivo en el momento de imprimir o exportar.',
      tab: { one: 'Un estudiante', std: 'Estándares', class: 'Clase · {n}' },
      name: 'Nombre del estudiante',
      namePh: 'Sin registrar',
      group: 'Clase o grupo',
      groupPh: 'Opcional',
      nameNote: 'Se guarda solo en este dispositivo y se escribe en todo lo que imprimas o exportes, para que el expediente pueda asociarse a una persona. No se sube nada y no hay cuentas.',
      print: 'Imprimir / PDF',
      exportJson: 'Exportar expediente (.json)',
      exportCsv: 'Exportar tabla (.csv)',
      exportStd: 'Exportar estándares (.csv)',
      import: 'Añadir expedientes de estudiantes…',
      addMine: 'Añadir el expediente de este dispositivo',
      clear: 'Quitar todos',
      anon: 'Estudiante sin nombre',
      unknownDate: 'fecha no registrada',
      notMeasured: 'sin medir',
      noClaim: 'sin demostrar',
      levelName: 'Álgebra I · Nivel 1 · Los Mundos Cifrados',
      levelLine: '{level}',
      generatedLine: 'Generado el {date}',
      sum: {
        held: 'Líneas selladas',
        items: 'Preguntas respondidas',
        unaided: 'Resueltas sin ayuda',
        time: 'Tiempo de trabajo en total',
        claimItems: 'Preguntas que sostienen los sellos',
        testedOut: 'Selladas en frío',
        withdrawn: 'Sellos retirados',
      },
      linesHead: 'Línea por línea',
      stdTitle: 'Expediente de estándares',
      stdSub: 'Cobertura según {frame}',
      stdSheetHead: 'Expectativa por expectativa',
      stdFoot: 'Esta hoja recalcula la cobertura desde el modelo del estudiante cada vez que se abre. Un tipo de pregunta cuenta solo después de que este estudiante conteste uno. Una línea cuenta como sellada solo tras una tanda de prueba sin ayuda, en la banda del sello.',
      withdrawnHead: 'Sellos que este motor ha retirado',
      withdrawnRow: '{skill} — retirado el {date}',
      byLineHead: 'Dónde está la clase, línea por línea',
      classTitle: 'Expediente de clase',
      classSub: '{n} expedientes de estudiantes · reunidos el {date}',
      classEmpty: 'Todavía no hay expedientes. Cada estudiante exporta el suyo desde esta pantalla; añade aquí los archivos y se quedan en este dispositivo.',
      classFoot: 'Reunido a partir de los expedientes que los propios estudiantes han exportado. No se ha subido nada: esta lista vive solo en este navegador y desaparece al borrar los datos del sitio.',
      custody: {
        head: 'Dónde vive este expediente',
        device: 'Cada cifra de esta hoja vive en un navegador, en un dispositivo. Nadie ha subido nada. No hay cuenta, ni lista de clase, ni servidor detrás de esta hoja.',
        shared: 'En un dispositivo compartido o borrado, el expediente se va con el dispositivo. El archivo exportado y esta hoja impresa son las copias que duran.',
        name: 'Quien tiene el teclado escribe el nombre de arriba. Aquí nadie compara ese nombre con una lista de clase.',
        klass: 'El profesor reúne el expediente de clase a mano, con los archivos que los estudiantes exportan.',
      },
      claimItemsShort: '{n} preguntas sin ayuda en la banda {band}',
      claimMissed: '«n|one:encajó un fallo|other:encajó # fallos»',
      claimReps: 'preguntas etiquetadas con {n} representaciones',
      repsNote: 'Un tipo de pregunta lleva una etiqueta de su superficie: una tabla, un gráfico, un dibujo o una historia. El equipo cuenta esas etiquetas cuando concede un sello. No comprueba si dos tipos etiquetados piden lo mismo. En algunas líneas piden lo mismo.',
      claimRegrant: 'recuperado tras una retirada',
      foot: 'Expediente {id} · {n} observaciones. Aquí no hay ninguna nota guardada. Esta hoja recalcula cada cifra desde el modelo del estudiante y el registro de pruebas de este dispositivo. Una línea solo se sella tras una tanda de prueba sin ayuda, en la banda del sello. Dos reexámenes en frío fallidos retiran el sello otra vez.',
      trust: {
        verified: 'verificado',
        reconstructed: 'reconstruido',
        foreign: 'rehecho',
      },
      trustNote: {
        verified: 'Las dos mitades de este expediente — el modelo del estudiante y el registro de pruebas — coinciden, pregunta por pregunta.',
        reconstructed: 'Restaurado desde una copia parcial. El modelo ha reconstruido las preguntas y los sellos, así que nada queda por debajo de lo real. El tiempo de trabajo y el porcentaje sin ayuda anteriores al corte no se pueden recuperar. El expediente los da como desconocidos, no como cero.',
        foreign: 'El registro de este dispositivo pertenecía a otro expediente. El equipo lo descartó en lugar de mezclarlo. Todo lo de aquí sale solo del modelo del estudiante.',
      },
      col: {
        student: 'Estudiante',
        group: 'Clase',
        generated: 'Generado',
        skill: 'Línea',
        state: 'Estado',
        evidence: 'Qué lo demostró',
        confidence: 'Confianza del modelo',
        items: 'Preguntas',
        unaided: 'Sin ayuda',
        time: 'Tiempo',
        road: 'Camino',
        claimItems: 'Preguntas que lo sostienen',
        itemsAtClaim: 'Preguntas antes del sello',
        itemsSinceClaim: 'Preguntas después del sello',
        band: 'Banda',
        retention: 'Aguanta el reexamen',
        standards: 'Estándares (profundidad)',
        ccss: 'Common Core (profundidad)',
        teks: 'TEKS (profundidad)',
        trust: 'Expediente',
        held: 'Líneas selladas',
        testedOut: 'En frío',
        withdrawn: 'Retirados',
        classHeld: 'Selladas',
        classProving: 'En prueba',
        classWorking: 'En curso',
        classLocked: 'Sin abrir',
        code: 'Código',
        depth: 'Profundidad',
        citation: 'Cita legal',
        expectation: 'Qué pide',
        carriedBy: 'Líneas que la llevan',
        cover: 'Cobertura',
        linesHeld: 'Líneas selladas',
        formsMet: 'Tipos de pregunta vistos',
        answers: 'Respuestas',
        framework: 'Marco',
        processMet: 'Intención de diseño',
      },
    },

    unit: {
      sec: 's',
      min: 'min',
      hr: 'h',
      secFull: '{n} s',
      minFull: '{n} min',
      hrFull: '{h} h {m} min',
    },

    idea: {
      'var-meaning': 'Una letra representa un número al que todavía nadie ha puesto nombre.',
      'eval-expr': 'Pon el número en el lugar de la letra y la expresión se convierte en un solo valor.',
      'order-ops': 'Los paréntesis y las potencias mandan más que multiplicar, y multiplicar manda más que sumar.',
      'like-terms': 'Dos términos solo se juntan si su parte literal es exactamente la misma.',
      'distribute': 'Multiplicar una suma multiplica todos los términos que hay dentro.',
      'one-step-add': 'Una ecuación es una balanza: deshaz la suma en los dos lados a la vez.',
      'one-step-mul': 'El número pegado a la incógnita se quita dividiendo, nunca restando.',
      'two-step': 'Desenvuelve al revés: primero el número suelto y después el coeficiente.',
      'multi-step': 'Simplifica cada lado del todo antes de deshacer nada.',
      'both-sides': 'Reúne la incógnita en un lado y, si desaparece, lee lo que queda.',
      // Nivel 2 (content/graph/algebra1-l2.json).
      'bracket-both-sides': 'Un paréntesis en cada lado sigue siendo una sola balanza: abre los dos y después reúne.',
      'fraction-solve': 'Una división se quita como cualquier operación: multiplica los dos lados por lo de abajo.',
      'rule-from-table': 'Una tabla de pasos iguales esconde una regla. Halla la tasa y lo demás sale solo.',
      'inequality-one-step': 'Una desigualdad es una balanza inclinada. Solo dividir por un negativo cambia el sentido.',
      'inequality-two-step': 'Desenvuelve la inclinación al revés: primero el número suelto, después el coeficiente.',
      'inequality-multi-step': 'Reúne la incógnita en el lado que deja coeficiente positivo y el signo nunca gira.',
      'compound-inequality': 'Dos enunciados a la vez describen una banda. Cada paso afecta a las tres partes.',
      'literal-equations': 'Una fórmula es una ecuación sin números todavía. Despéjala para la letra que quieras.',
      'ratio-proportion': 'Dos razones coinciden cuando una es copia de la otra. Multiplica en cruz.',
      'slope-rate': 'La tasa es la subida dividida por el paso, y es la misma en toda la recta.',
      'graph-linear': 'Regla y trazo son lo mismo dicho dos veces: la tasa es la subida, el inicio es el cruce.',
      'write-linear': 'Dos lecturas bastan para escribir la regla: la tasa por la subida, el inicio por el eje.',
      'system-substitution': 'Cuando un enunciado ya dice cuánto vale una letra, ponlo directamente en el otro.',
      'system-elimination': 'Suma dos enunciados verdaderos y el resultado es verdadero. Alinea una letra y se va.',
      // Nivel 3 (content/graph/algebra1-l3.json).
      'function-notation': 'Una regla puede tener nombre, y f(3) es la salida que da en 3.',
      'domain-range': 'Las entradas que acepta una regla son su dominio; las salidas que da son su rango.',
      'exponent-product': 'Una potencia cuenta factores, así que multiplicar dos potencias suma los exponentes.',
      'exponent-power': 'Elevar una potencia trae otra vez el mismo exponente, así que los exponentes se multiplican.',
      'exponent-quotient': 'Dividir potencias cancela factores iguales, así que el exponente de abajo se resta al de arriba.',
      'zero-negative-exponent': 'Un exponente cero vale uno, y uno negativo pone factores debajo de la barra.',
      'poly-add-sub': 'Solo se juntan los términos con el mismo exponente, y el menos alcanza a todo el paréntesis.',
      'poly-multiply': 'Cada término del primer paréntesis multiplica a cada término del segundo.',
      'factor-common': 'Factorizar es expandir al revés: saca todo lo que comparten los términos.',
      'linear-vs-exponential': 'Una regla recta suma lo mismo; una regla que crece multiplica por el mismo factor.',
      'exponential-rule': 'Un principio multiplicado por un factor una vez por paso, y en cero pasos, el principio.',
      // Nivel 4 (content/graph/algebra1-l4.json).
      'radical-simplify': 'Una raíz cuadrada pregunta qué número, por sí mismo, da el de debajo. El mayor cuadrado que hay dentro sale fuera y el resto se queda.',
      'radical-arith': 'Dos raíces solo se suman cuando el número de debajo es el mismo. Dos raíces siempre se multiplican.',
      'factor-trinomial-monic': 'Factorizar es multiplicar paréntesis al revés. Busca la pareja de números que multiplica al último término y suma al del medio.',
      'factor-trinomial-lead': 'El número delante del cuadrado se reparte entre los dos paréntesis. Ahora la pareja multiplica al primer coeficiente por el último.',
      'difference-of-squares': 'Dos cuadrados con un menos en medio se abren en un paréntesis suma y otro resta. Con un más no se abren nunca.',
      'poly-divide': 'Dividir pregunta por cuánto multiplicar el segundo para dar el primero. Multiplica la respuesta de vuelta y tienen que volver todos los términos.',
      'quadratic-zero-product': 'Si dos cantidades multiplican y dan cero, al menos una vale cero. Un producto de paréntesis vale cero justo donde un paréntesis vale cero.',
      'solve-by-factoring': 'Pasa todo a un lado y deja cero en el otro. Después factorizar convierte un enunciado difícil en dos fáciles.',
      'square-root-method': 'Sacar la raíz a los dos lados deshace el cuadrado. Un cuadrado tiene dos raíces, así que salen dos respuestas.',
      'complete-the-square': 'La mitad del coeficiente del medio, al cuadrado, completa un cuadrado perfecto. Súmala a los dos lados y aparece un paréntesis al cuadrado.',
      'quadratic-formula': 'Completar el cuadrado en general da una fórmula que siempre sirve. La parte de debajo de la raíz dice cuántas respuestas reales hay.',
      'parabola-features': 'Una regla al cuadrado dibuja una curva que baja, gira y sube. El giro, los cortes y el valor mayor o menor salen de los mismos tres números.',
      'quadratic-from-vertex': 'Una regla al cuadrado puede enseñar su punto de giro, o los dos paréntesis que dan sus ceros. Las dos escrituras describen una sola curva.',
      'quadratic-model': 'Un objeto lanzado, un cercado y un precio frente a la recaudación siguen una regla al cuadrado. El giro es el mejor valor y los ceros cierran la historia.',
      // Nivel 5 (content/graph/algebra1-l5.json).
      'rational-exponent': 'Un exponente no tiene por qué ser entero. La parte de abajo dice qué raíz tomar y la de arriba, a qué potencia elevar.',
      'relation-is-function': 'Una regla es función cuando cada entrada tiene una sola salida. Una entrada con dos salidas la rompe. Dos entradas que comparten salida, no.',
      'sequence-terms': 'Una lista de números es una regla cuyas entradas son las posiciones 1, 2, 3 y así. Una regla recursiva da el valor siguiente desde el anterior.',
      'sequence-nth-term': 'Una sola fórmula da cualquier valor directamente desde su posición. La lista que suma pide una fórmula de paso, y la que multiplica, una de potencia.',
      'point-slope-form': 'Una lectura y una tasa fijan la recta. La misma recta tiene tres escrituras, y cada una deja fácil un dato distinto.',
      'parallel-perpendicular': 'Dos rectas que nunca se cruzan tienen la misma tasa. Dos rectas que se cortan en ángulo recto tienen tasas que multiplican a menos uno.',
      'inequality-two-var': 'Una desigualdad con dos letras nombra una región, no una recta. La frontera dice dónde acaba y una lectura de prueba dice de qué lado.',
      'write-system': 'Un solo enunciado no basta cuando hay dos incógnitas. Dos enunciados distintos sobre la misma pareja las fijan a la vez.',
      'system-graphically': 'Dos enunciados en forma de trazo se cruzan donde los dos son ciertos. El cruce es la respuesta y tiene que cumplir los dos.',
      'scatter-regression': 'Las lecturas reales nunca caen justo sobre una recta. La recta más cercana a todas a la vez es la que sirve para predecir.',
      'residual-and-fit': 'La distancia entre una lectura real y el modelo es el residuo. Residuos con un mismo signo seguidos avisan de que la forma no encaja.',
      'association-strength': 'Dos medidas pueden subir juntas, ir al revés o no tener ningún patrón. Una proporción nunca es una causa.',
      'exponential-model': 'Una regla que multiplica por el mismo factor en cada paso crece o mengua un porcentaje fijo. Multiplicar siempre acaba ganando a sumar.',
    },

    slip: {
      // Fallos del Nivel 2.
      'boundary-slip': 'Mete o saca el valor de la frontera por uno',
      'flip-always': 'Gira el signo de la desigualdad tras cada paso',
      'flip-not-needed': 'Divide por un negativo y deja el signo igual',
      'band-reversed': 'Escribe la banda con los extremos al revés',
      'slope-intercept-swap': 'Cambia la tasa por la altura inicial',
      'run-over-rise': 'Divide el paso por la subida',
      'subtract-not-add': 'Resta los dos enunciados en vez de sumarlos',
      'add-not-subtract': 'Suma las dos lecturas en vez de restarlas',
      'add-not-multiply': 'Suma donde la situación multiplica',
      'arith-slip': 'Método correcto, fallo de cálculo',
      'axis-swap': 'Lee la gráfica por el eje equivocado',
      'coefficient-sign-lost': 'Pierde el signo del coeficiente',
      'collect-wrong-side': 'Reúne la incógnita en el lado equivocado',
      'combine-unlike': 'Junta términos que no son semejantes',
      'distribute-then-forget': 'Abre el paréntesis y luego pierde un término',
      'div-direction': 'Divide en el orden contrario',
      'divide-not-multiply': 'Divide donde la situación multiplica',
      'exponent-as-mult': 'Lee una potencia como una multiplicación',
      'implicit-mult-missed': 'Lee 3x con x = 4 como cifras seguidas, no como producto',
      'letter-as-object': 'Trata la letra como una etiqueta y no como un valor',
      'letter-as-position': 'Usa el lugar de la letra en el alfabeto como su valor',
      'neg-base-power': 'Se equivoca con el signo de una base negativa',
      'neg-distribute': 'Pierde un signo menos al abrir el paréntesis',
      'neg-substitution': 'Sustituye un valor negativo pero deja el resultado positivo',
      'no-solution-confusion': 'Confunde «sin solución» con «cualquier valor sirve»',
      'off-by-one-row': 'Lee la fila de al lado en la tabla',
      'one-side-only': 'Cambia un solo lado de la balanza',
      'partial-distribute': 'Multiplica solo el primer término del paréntesis',
      'partial-rule': 'Empieza bien la regla y se detiene antes de acabarla',
      'same-op-both': 'Aplica la misma operación en vez de la inversa',
      'sign-on-constant': 'Pasa el término independiente sin cambiarle el signo',
      'sign-slip': 'Pierde o se inventa un signo menos',
      'strict-left-right': 'Va de izquierda a derecha sin respetar la prioridad',
      'subtract-coefficient': 'Resta el coeficiente en vez de dividir entre él',
      'subtract-not-multiply': 'Resta donde la situación multiplica',
      'swapped-roles': 'Intercambia qué cantidad es cuál',
      'wrong-unwrap-order': 'Deshace en el mismo orden en que se construyó',
      'x-and-x-squared': 'Trata x y x al cuadrado como el mismo tipo de término',
      // Nivel 3 (content/graph/algebra1-l3.json).
      'base-times-exponent': 'Multiplica la base por el exponente de encima',
      'bases-multiplied': 'Multiplica también las bases, además de los exponentes',
      'coefficient-not-raised': 'Eleva la letra y deja el número de delante igual',
      'coefficients-added': 'Suma los números de delante en vez de multiplicarlos',
      'exponents-added': 'Suma los exponentes donde la regla los multiplica',
      'exponents-multiplied': 'Multiplica los exponentes donde la regla los suma',
      'exponents-subtracted-wrong-way': 'Resta los exponentes al revés',
      'factor-drops-term': 'Divide un término por el factor común y deja otro sin dividir',
      'factor-partial': 'Saca solo una parte del factor común',
      'growth-is-linear': 'Suma el factor en cada paso en vez de multiplicar',
      'growth-start-for-factor': 'Da la cantidad inicial cuando se pide el factor',
      'input-output-swap': 'Responde con la entrada en vez de la salida',
      'middle-term-missed': 'Multiplica los extremos y se salta los términos de en medio',
      'minus-first-term-only': 'Deja que el menos alcance solo al primer término del paréntesis',
      'negative-power-is-negative': 'Lee un exponente negativo como una respuesta negativa',
      'negative-power-is-reciprocal-slip': 'Pone la potencia en el lado equivocado de la barra',
      'range-ends-swapped': 'Lee la salida en el extremo equivocado de las entradas',
      'zero-power-is-zero': 'Lee un exponente cero como una respuesta de cero',
    },
  },

  // El equipo (src/kit). Lo que compra una línea sellada, dicho como capacidad
  // y nunca como felicitación. Claves aditivas, propiedad del equipo.
  kit: {
    granted: 'Línea sellada',
    // La frase de la ficha, donde puedan alcanzarla un lector de pantalla y un
    // pulgar: antes solo vivía en un título emergente, que ninguno de los dos tiene.
    chipAria: '{name}: {what}',
    grantedHeld: 'La línea sigue firme',
    locked: 'Sella {n}',
    lockedLong: 'Se abre al sellar {n} líneas',
    next: 'Lo siguiente',
    // La única ficha bloqueada de la tira. «Lo siguiente» a secas no informaba:
    // estaba en la pantalla desde el primer segundo, no se podía pulsar y nada
    // decía qué la desbloquea. Ahora dice su precio en la única moneda que la
    // compra: líneas sostenidas, nunca motas.
    nextAtLines: 'Sostén «n|one:# línea|other:# líneas»',
    // Ver en.js: esto es un precio; la explicación va en la tarjeta de abajo.
    nextAtDepth: 'Conserva tus líneas de un día para otro',
    cost: '{n} motas',
    held: 'En tu poder',
    needShards: 'Faltan motas: hacen falta {n}',
    flareLit: 'Bengala encendida: el aire sube',
    beaconSet: 'Baliza plantada: aquí el aire ya sube para siempre',
    vaulted: 'Impulso',
    charterNext: 'Sella {tears} grietas de {skill}. Una línea es una idea y todas las grietas que la prueban. Aguanta esta línea y {grant} es tuyo.',
    charterOpen: 'Sella {tears} grietas de {skill}. El equipo ya es todo tuyo. Queda la isla.',
    vault: {
      name: 'Placa de impulso',
      short: 'Placa',
      what: 'Una quinta pieza para la red. Písala y te lanza doce metros hacia arriba.',
      gist: 'te lanza doce metros hacia arriba',
    },
    flare: {
      name: 'Bengala de ascendencia',
      short: 'Bengala',
      what: 'F: enciende una columna de aire ascendente bajo tus botas, donde quieras, durante seis segundos.',
      gist: 'seis segundos de aire ascendente donde estés',
    },
    kite: {
      name: 'Ajuste del ala',
      short: 'Ala',
      what: 'El ala planea más plana, más rápida y gira mejor. Los valles que no podías cruzar caben en un solo vuelo.',
      gist: 'el ala planea más plana, más rápida y gira mejor',
    },
    reserve: {
      name: 'Reserva profunda',
      short: 'Reserva',
      what: 'La reserva de la red más que se duplica, y se recarga la mitad de rápido otra vez.',
      gist: 'el doble de reserva, que además se recarga antes',
    },
    legs: {
      name: 'Piernas de tormenta',
      short: 'Piernas',
      what: 'Más velocidad al esprintar, más salto y un impulso que vuelve en la mitad de tiempo.',
      gist: 'más esprint, más salto y un impulso más rápido',
    },
    sight: {
      name: 'Vista resonante',
      short: 'Vista',
      what: 'Las motas de la deriva se inclinan hacia ti. Puedes leer una caja colgante desde el doble de lejos.',
      gist: 'las motas se inclinan hacia ti y lees las cajas desde más lejos',
    },
    beacon: {
      name: 'Baliza permanente',
      short: 'Baliza',
      what: 'G: por noventa motas plantas una columna de aire ascendente que mañana seguirá ahí. Es lo único que le puedes hacer a esta isla que dure.',
      gist: 'una columna de aire ascendente que mañana sigue ahí',
    },
    windstep: {
      name: 'Paso de viento',
      short: 'Paso',
      what: 'El impulso vuelve mientras sigues en el aire. Tres seguidos cruzan un vacío que el ala no cruza.',
      gist: 'el impulso vuelve mientras sigues en el aire',
    },
    span: {
      name: 'Vuelo largo',
      short: 'Vuelo',
      what: 'El ala otra vez: aún más plana y más rápida. Desde la cresta alta ya alcanzas la costa lejana sin tocar el suelo.',
      gist: 'el ala otra vez, aún más plana y más rápida',
    },
    array: {
      name: 'Serie de placas',
      short: 'Serie',
      what: 'La placa te lanza un tercio más alto y cuesta seis motas en vez de dieciocho. Las placas se vuelven una escalera.',
      gist: 'la placa lanza más alto y cuesta un tercio',
    },
    squall: {
      name: 'Bengala de turbonada',
      short: 'Turbonada',
      what: 'La bengala cuesta dieciséis, se alza setenta y cuatro metros y aguanta once segundos.',
      gist: 'una bengala más alta que aguanta once segundos',
    },
    deepwell: {
      name: 'Pozo profundo',
      short: 'Pozo',
      what: 'La reserva de la red llega a trescientos y se recarga el doble de rápido. Puentea un cañón de una sola vez.',
      gist: 'una reserva de trescientos que se recarga el doble de rápido',
    },
    station: {
      name: 'Estación de paso',
      short: 'Estación',
      what: 'H — levanta una estación de paso: una torre permanente de aire ascendente. Viaja entre dos cualesquiera. Cuesta una cédula y las motas de la ficha.',
      gist: 'una torre permanente y un sitio al que puedes viajar',
    },
    charter: {
      name: 'Una cédula de estación',
      what: 'Una noche sostenida es una línea que se sigue sabiendo tras dejar el juego. Consérvalas de una noche para otra y la red te extiende otra cédula.',
      gist: 'un pase para una torre',
    },
    chartersHeld: '«n|one:# cédula|other:# cédulas» · {cost}',
    charterIn: '{n} más de hondura',
    needCharter: 'Sin cédula. {n} de hondura más y sale la siguiente',
    // Una cédula pagada por los guardianes, no por la hondura (src/world/warden.js).
    charterWon: 'Cédula ganada. Tienes «n|one:# cédula|other:# cédulas». Un enclave cuesta {cost} motas y una cédula.',
    stationSet: 'Estación de paso {n} levantada — ya forma parte de la isla',
    stationAlone: 'Todavía no hay adónde viajar. Levanta una segunda',
    travelled: 'De estación a estación',
    soundLanded: 'Sondeo completado · {n} de hondura, limpio',
    soundDeep: 'Sondeo · {n} de hondura',
    soundBroke: 'El sondeo se rompe en {n}',
    // El mostrador (src/kit/foundry.js). Un verbo que aún no tienes licenciado
    // se puede comprar allí, y la tira debe decirlo.
    carrying: '«n|one:# en mano|other:# en mano»',
    buyAt: '{name}: la fundición del desembarco las vende',
    afford: '{n} motas: bastan para {name}',
  },

  // La deriva y las cajas colgantes (src/world). Lo que hace la isla cuando
  // nadie te está preguntando nada.
  // ---------------------------------------------------------------------
  // DIRECCIÓN (src/meta/guide.js). El objetivo, la baliza, el aviso de
  // interacción, los nombres que el mundo se pone solo, y el borde del fragmento.
  // ---------------------------------------------------------------------
  guide: {
    label: 'Objetivo',

    verb: {
      seal: 'Sella la grieta',
      prove: 'Demuestra la línea',
      watch: 'Monta la guardia',
      sound: 'Sondea la red',
      /* Los tres que no son un teclado: el objetivo ya puede mandarte a un
         sitio que se resuelve con los pies. (src/meta/objective.js) */
      crack: 'Abre la caja',
      lay: 'Cubre el tramo',
      climb: 'Llega al hito',
      /* EL CRUCE (src/world/meet.js). Clave añadida. */
      cross: 'Halla el cruce',
    },

    site: {
      cache: 'Caja colgante',
      deepcache: 'Caja profunda',
      span: 'Tramo colgante',
      /* EL CRUCE (src/world/meet.js). Clave añadida. */
      meet: 'El cruce',
    },

    /* Cuando el número baja. Ninguna de las dos frases lleva cifra alguna.
       (src/meta/progress.js `createRepairWatch`) */
    slip: {
      line: 'Mundo reparado ha bajado. Ese fallo te ha costado terreno en esta línea: {skill}. Acierta y el terreno vuelve.',
      held: 'Mundo reparado ha bajado. Esta línea no ha vuelto esta vez: {skill}. Trabájala otra vez y recuperas el mérito.',
    },

    metres: '{n} m',
    /* Ocho puntos, no cuatro. Cada uno es una frase entera: la distancia va en
       su propio elemento, al lado, y ningún idioma tiene que meter un número
       dentro de un rumbo. (src/world/bearing.js) */
    rel: {
      ahead: 'Justo al frente',
      aheadRight: 'Al frente, tirando a la derecha',
      right: 'A tu derecha',
      backRight: 'A tu espalda, por la derecha',
      behind: 'Date la vuelta',
      backLeft: 'A tu espalda, por la izquierda',
      left: 'A tu izquierda',
      aheadLeft: 'Al frente, tirando a la izquierda',
      here: 'Lo tienes bajo los pies',
    },

    pay: {
      lines: 'Una línea es una idea. Sostén esta y «n|one:se abrirá # línea más|other:se abrirán # líneas más».',
      linesAny: 'Una línea es una idea. Sostén esta y se abre más red.',
      /* «Sostenla y Ala afinada será tuya» nombraba un premio que el juego solo
         explica en la tarjeta que llega DESPUÉS de ganarlo. `{gist}` es la
         forma corta de `kit.<id>.what`, que trae src/meta/objective.js: el
         nombre y lo que hace, en la misma frase. */
      /* …y en imperativo con objeto directo, no con «será tuya»: los nombres
         del equipo son masculinos y femeninos, y la concordancia se rompía en
         la mitad de ellos. */
      kit: 'Sostenla y ganas {name}: {gist}.',
      field: 'Este lo resuelves con los pies. El sitio queda abierto para siempre.',
      calm: 'Séllalo y las sacudidas de aquí se acaban para siempre.',
      sound: 'Ya sostienes esta línea. Un sondeo la recorre hacia abajo, cada pregunta más difícil.',
    },

    /* EL NÚMERO DEL PROGRESO, EN SU ÚNICO SITIO Y CON SU ÚNICO NOMBRE.
     *
     * Esta fila llevaba tres frases distintas, y la que se leía durante toda
     * una primera sesión era «una marca por cada grieta de esta línea», escrita
     * encima de diez marcas que ni son grietas ni son una línea: son las diez
     * líneas de toda la red. Quien lo leyó junto a una barra que decía «0 de 16
     * grietas» no podía saber a cuál de los dos números se refería el juego,
     * porque uno de los dos pies era sencillamente falso.
     *
     * Ahora dice una sola cosa, siempre, con las mismas tres palabras que usan
     * la ficha del informe y la tarjeta de cierre. Ver src/meta/progress.js. */
    linesHeld: '{n} de {total} líneas sostenidas',
    /* …y qué son las marcas, mientras la cuenta sigue en cero. Va DEBAJO del
       número y no en su lugar, para que la palabra llegue con su significado y
       el cadete nunca lea una fila de progreso sin progreso en ella. */
    linesHeldNew: 'Sostenida significa que probaste una línea sin ayuda, en cada tipo de pregunta que planteó. El equipo vuelve a comprobar más adelante una línea sostenida.',

    prompt: {
      open: 'Abre la grieta',
      sound: 'Sondea esta línea — preguntas más duras',
    },
    key: {
      kbm: 'E',
      pad: 'X',
      touch: 'Toca',
    },

    // -------------------------------------------------------------------
    // LOS NOMBRES. Cada uno se dice una sola vez, para siempre, la primera vez
    // que el jugador está mirando de verdad una de estas cosas. La etiqueta viva
    // sobre el objeto la pone src/world/beckon.js; aquí va lo que una etiqueta
    // nunca puede llevar: qué es, por qué existe y por qué debería importarle.
    // -------------------------------------------------------------------
    n: {
      rift: 'Ese anillo es una grieta. Métete dentro y te muestra un enunciado. Hazlo verdadero y se cierra.',
      surge: 'Ese anillo de luz es una sacudida de la grieta. La sacudida te tira motas y te quita el equilibrio. Sáltala.',
      mote: 'Motas de cifra: red suelta, donde el suelo sangró. Pasa por encima. La fundición las cambia por equipo.',
      charged: 'Las motas doradas crecen junto a una grieta abierta. Pagan el triple. Sella la grieta y paran.',
      husk: 'Las cáscaras son vetas que vaciaste. Cada una se reenciende en unos cinco minutos. Llega más lejos.',
      anchor: 'Un ancla de red. Nada la alcanza desde el suelo, y esa es la idea. Apila dos rampas y tócala.',
      cache: 'Una caja colgante. La barra sostiene algo verdadero a lo que le falta una pesa. Sal y ponte bajo la pesa que falta.',
      updraft: 'Esa columna es una ascendencia. Vuela dentro y te sube sesenta metros gratis.',
      verge: 'Esa cortina es el borde: ahí se acaba el Fragmento Nueve. Sostén todas las líneas y la red te saca.',
    },
  },

  // LA FUNDICIÓN (src/kit/foundry.js): el mostrador donde las motas de
  // cifra se convierten en algo, con el precio y el efecto a la vista antes de
  // gastar ni una. Claves aditivas, propiedad del equipo.
  foundry: {
    kick: 'Intendencia de cadetes',
    name: 'La Fundición',
    lede: 'Una mota de cifra es lo que deja una grieta al cerrarse. La fundición las acepta y devuelve aire sobre el que sostenerse.',
    unit: '«n|one:mota|other:motas»',
    hailStock: '«n|one:# cosa a tu alcance|other:# cosas a tu alcance»',
    hailNone: 'Aquí las motas compran cosas',
    take: 'Llévatelo',
    short: 'Faltan {n}',
    leave: 'Apartarse',
    sealedLines: 'Domina «n|one:# línea|other:# líneas»',
    sealedDepth: 'Conserva tus líneas de un día para otro',
    inHand: 'Tuyo · {key}',
    carried: '«n|one:# en mano|other:# en mano» · {key}',
    bought: 'En mano. Pulsa {key} donde lo quieras',
    note: 'Las motas pagan lo que hay en el mostrador. Las líneas dominadas abren el resto.',
    callout: 'Cadete: esas motas no son un marcador. En el desembarco hay una fundición que las convierte en ascendencia: el hexágono iluminado de los tres pilares, a tu izquierda.',
    flare: { what: 'Seis segundos de aire ascendente bajo tus propias botas, estés donde estés. Un solo uso.' },
    beacon: { what: 'Una columna de aire ascendente que mañana seguirá en pie. Plántala donde quieras. Nada más de lo que hagas en esta isla dura.' },
    plate: { what: 'Una quinta pieza para la red. Súbete a una y te lanza doce metros en vertical.' },
    station: { what: 'Una torre de aire ascendente, y además un lugar. Párate en una, y sal por cualquier otra.' },
  },

  field: {
    moteTake: '+{n} motas',
    updraft: 'Ascendencia',
    surge: 'Sacudida de la grieta — salta el anillo',
    surgeRead: 'Anillo leído · +{n} motas',
    surgeWarn: 'La grieta se está cargando: sal del suelo',
    balanceLock: 'Cierre de balanza',
    balanceNo: 'La barra lo rechaza',
    balanceReset: 'Las pesas se rehacen',
    cacheOpen: 'Caja abierta: {n} motas, y aquí el aire ya sube para siempre',

    // --- el cruce (src/world/meet.js): el tercer tipo de sitio fuera de la
    // isla. Una caja es una balanza que cargas con una pesa y un tramo es una
    // parcela que cubres. Un cruce es una parcela que RECORRES.
    meetLock: 'Cierre de cruce',
    meetFirst: 'Camina por el riel. Bájate donde la barra no se incline.',
    meetNo: 'Aquí la barra se inclina',
    meetReset: 'El riel se rehace',
    meetOpen: 'Cruce hallado: {n} motas, y desde aquí sale un camino para siempre',
    meetNone: 'No hay cruce en ninguna parte: {n} motas, y los dos rieles siguen para siempre',

    // --- los tramos (src/world/span.js): el segundo tipo de sitio fuera de la
    // isla. Una caja es una balanza y paga aire ascendente. Un tramo es un
    // rectángulo de suelo que hay que cubrir, y paga un camino.
    spanLock: 'Cierre de área',
    spanShort: 'Sin cubrir. «n|one:Queda # casilla abierta|other:Quedan # casillas abiertas».',
    spanOver: 'Demasiadas. «n|one:# losa cae|other:# losas caen» al vacío.',
    spanReset: 'Las pilas se rehacen',
    spanOpen: 'Tramo abierto: {n} motas, y aquí queda un camino para siempre',
    spanRoad: 'El camino ya está. Camina hasta el siguiente tramo.',

    // --- los guardianes (src/world/warden.js): el quinto día ---------------
    // Una placa con el nombre, no una frase: tiene que caber en un móvil en
    // horizontal. La única instrucción la dice `wardenFan`, una vez.
    wardenTag: 'Guardián',
    wardenFan: 'Entra corriendo en la pesa correcta',
    wardenOver: 'Se pasa por {n}',
    wardenUnder: 'Se queda corta por {n}',
    wardenBound: 'Guardián sujetado: {n} motas. Se está deshaciendo.',
    deepOpen: 'Caja profunda abierta: {n} motas, y aquí el aire ya sube para siempre',

    // --- lo que dice el mundo cuando te acercas (src/world/beckon.js) ---
    riftOpen: 'Súbete a la placa · {skill}',
    riftShut: 'Sellada · primero domina {skill}',
    riftHeld: 'Dominada · {skill}',
    riftRefuse: 'Las barras aguantan. Esta grieta se abre cuando domines {skill}.',
    veinLit: 'Veta de cifra · +{n} por cristal',
    veinRich: 'Veta cargada · +{n} por cristal',
    veinSpent: 'Veta agotada · vuelve a encenderse en {time}',
    shardsFor: 'Motas de cifra. El equipo las cambia por placas de impulso, bengalas y ascendencias permanentes.',
    anchorFind: 'Ancla de la red · construye hasta ella',
    anchorHeld: 'Ancla asegurada',
    vergeTag: 'El linde · fin del Fragmento Nueve',
    brink: 'El fragmento acaba aquí. Debajo no hay nada.',
    // --- la prospección (src/world/errand.js) -------------------------------
    surveyClaim: 'Hito reclamado · {name}: +{n} motas, y aquí el aire ya sube para siempre',
    markFind: 'Hito de prospección · {name}',
    markHeld: 'Hito reclamado · {name}',
    vergeHit: 'El linde no cede. El Fragmento Nueve acaba aquí: los fragmentos lejanos son una travesía que nadie ha hecho.',
  },
  survey: {
    reckoning: 'El Cómputo',
    ossuary: 'El Osario',
    watchtower: 'La Atalaya',
    cathedral: 'La Catedral',
    arch: 'El Arco de Vidrio',
    spine: 'El Espinazo',
    said: {
      reckoning: 'Algo sigue llevando la cuenta aquí. Nunca supimos de qué. Ahora el aire sube sobre el hito: eso es un camino, y se queda.',
      ossuary: 'Una nave de colonos, doscientos años caída. Técnicamente sigue en hora.',
      watchtower: 'Desde esta cabeza de piedra vigilaban el abismo. Ahora puedes despegar de ella.',
      cathedral: 'El bosque de abajo es una semilla de esto. Todo el mundo debería ponerse debajo una vez.',
      arch: 'Aquí el lago se va del mundo. El arco ya era viejo cuando empezó.',
      spine: 'El punto más alto del Fragmento Nueve. Todo lo demás te queda debajo.',
    },
  },
  relay: {
    toTear: 'Siguiente línea · {skill}: {n} m',
    toMark: 'Hito de prospección · {name}: {n} m',
    stay: 'Esta línea sigue siendo lo que más te conviene. Vuelve a la placa cuando quieras.',
    rhythm: 'Una grieta da un puñado de preguntas y luego se calma. Aprovecha el hueco: siempre hay algo ahí fuera que merece el paseo.',
    /* La respuesta en una grieta ya calmada. La tecla sigue respondiendo, y
       responde con un lugar. (src/session/stint.js) */
    onwardTear: 'La grieta se ha calmado. Siguiente línea · {skill}: {n} m',
    onwardMark: 'La grieta se ha calmado. Hito de prospección · {name}: {n} m',
    /* La respuesta en una grieta ya calmada (src/session/stint.js gasta la
       visita). Una visita da tres preguntas y luego la grieta se calma hasta
       que el cadete abre otra. La tecla sigue respondiendo, y
       responde con un lugar. */
  },
  // --- la capa de afordancia (src/world/afford.js): qué ofrece una grieta,
  // qué tecla lo hace y hacia dónde queda la siguiente ---------------------
  afford: {
    open: 'Abre la grieta',
    walkIn: 'Entra en ella',
    // A mitad de la visita: una pregunta ya está resuelta y la siguiente
    // espera a que la pidas, en vez de llegar sola. (src/session/stint.js)
    again: 'Siguiente línea — misma grieta',
    sound: 'Sondea la línea — preguntas más duras, misma línea',
    shut: 'Sellada',
    needs: 'Domina antes {skill}',
    tap: 'Toca',
    next: 'Próxima grieta',
    metres: '{n} m',
    /* La última palabra de la regla de rumbo perdido (src/world/afford.js).
       Se dice una vez por sesión, después de que el camino ya haya llamado dos
       veces sin palabras. Nunca hay una cuarta respuesta. */
    lost: 'La grieta te queda a la espalda. Date la vuelta y sigue el camino dorado.',
  },

  // ---------------------------------------------------------------------
  // EL REGISTRO (src/kit/ledger.js): cada movimiento de la moneda, con el
  // motivo y el saldo que deja detrás.
  //
  // Un jugador nuevo contó que la cartera «se reseteaba sola a cero» tres
  // veces. No se reseteaba nada: la sacudida de una grieta cobraba nueve motas
  // fijas, lo que vaciaba cualquier saldo por debajo de nueve, y la única línea
  // que lo explicaba se escribía en el aviso compartido y la borraba medio
  // segundo después el aviso de «ahí no hay apoyo» que provocaba el propio
  // empujón. La tira tiene ahora su elemento y su reloj propios.
  // Claves aditivas, del equipo.
  // ---------------------------------------------------------------------
  ledger: {
    balance: 'saldo {n}',
    spared: 'Quedan muy pocas motas para arrancarte ninguna',
    // El cupo del día está agotado (src/kit/ledger.js). Se dice una vez al día.
    thin: 'Las vetas de aquí se secan hasta mañana. Las grietas selladas pagan entero.',
    // El descenso ya llegó hoy a esa profundidad (src/kit/kit.js). Una vez al día.
    deep: 'El descenso paga la profundidad nueva. Baja más, o vuelve mañana.',
    /* FIRST SIGHT — el motivo dice lo que significa, una vez y nunca más.
       Ver la nota en en.js: el vale acuñaba cinco sustantivos y no explicaba
       ninguno. src/kit/ledger.js imprime esto la primera vez y luego el término
       a secas, igual que «sostenida significa demostrada para siempre». */
    first: {
      seal: 'Grieta sellada: el enunciado ya es verdadero y el agujero del mundo se cierra.',
      assist: 'Sellada con un ejemplo resuelto. Cuenta igual. La siguiente es solo tuya.',
      vein: 'Veta de cifra: red suelta que puedes recoger al pasar.',
      cache: 'Caja colgante: una balanza que se abre poniéndote en la pesa que falta.',
      anchor: 'Ancla de la red: un punto fijo de la demostración, colgado fuera de alcance a propósito.',
      sound: 'Descenso: un recorrido de vuelta por una línea que ya sostienes, cada pregunta más difícil.',
      bind: 'Guardián sujetado: alcanzaste el constructo y tomaste la pesa que hace cierto su enunciado.',
      deepcache: 'Caja profunda: una caja colgante con una incógnita en los dos platillos. La dejó un guardián.',
      span: 'Tramo: un rectángulo de suelo en el cielo. Cúbrelo justo, y te paga un camino.',
      meet: 'Cruce: dos enunciados sobre una misma parcela. Camina por el riel hasta donde la barra deja de inclinarse, y te paga un camino.',
      surge: 'Sacudida de la grieta: el anillo que lanza una grieta abierta. Sáltalo o te cuesta motas.',
      vault: 'Placa de bóveda puesta: písala y te lanza doce metros hacia arriba.',
      plate: 'Placa de bóveda comprada: una quinta pieza para la red.',
      flare: 'Bengala de ascendencia: una columna de aire que sube bajo tus propias botas.',
      beacon: 'Baliza fija: aire que sigue subiendo aquí mañana.',
      station: 'Puesto levantado: un alto que se queda en el mapa.',
      order: 'Marca apagada: dejaste una línea en pie aquí, volviste y seguías sabiéndola.',
    },
    why: {
      seal: 'Grieta sellada',
      assist: 'Sellada con un ejemplo resuelto',
      vein: 'Veta de cifra',
      cache: 'Caja colgante',
      anchor: 'Ancla de la red',
      sound: 'Descenso',
      bind: 'Guardián sujetado',
      deepcache: 'Caja profunda',
      span: 'Tramo cubierto',
      meet: 'Cruce abierto',
      order: 'Marca apagada',
      found: 'Recogidas',
      surge: 'Sacudida de la grieta',
      spent: 'Gastadas',
      vault: 'Placa de impulso colocada',
      plate: 'Placa de impulso comprada',
      flare: 'Bengala de ascendencia',
      beacon: 'Baliza permanente',
      station: 'Estación de paso levantada',
    },
  },
};
