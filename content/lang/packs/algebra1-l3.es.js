/**
 * Algebra I · Nivel 3 — texto de los ítems, español.
 *
 * Prose for a course pack lives beside the shipped item bundles, under
 * content/lang, and never inside src/. Same rule, same reason: src/ carries no
 * language. The pack in src/content/packs imports this file and the registry
 * merges it in behind content/lang/items.*.js.
 *
 * HOUSE STYLE. Español técnico simplificado: una palabra, un significado; una
 * instrucción por frase; voz activa; menos de veinte palabras. La situación es
 * UNA frase y nunca dice un número que las matemáticas no usen.
 *
 * UNA PALABRA, UN SIGNIFICADO — el vocabulario que añade este nivel:
 *   potencia    una letra o un número con un exponente encima
 *   exponente   el número de arriba, que dice cuántos factores hay
 *   factor      una de las cosas que se multiplican
 *   término     una parte de una suma, ya visto en el Nivel 1
 *   regla       una máquina con nombre que convierte una entrada en una salida
 *   paso        un movimiento de una entrada al número siguiente
 *   El crecimiento se mide con «factor», nunca con «tasa»: una tasa suma.
 */
export default {
  // --------------------------------------------------------------- preguntas
  'l3.ask.onePower': 'Escribe esto como una sola potencia.',
  'l3.ask.whatFactor': "¿Cuál es ese factor?",
  'l3.ask.areaOnePower': "Escribe el área como una sola potencia.",
  'l3.ask.wholeOnePower': "Escribe el total como una sola potencia.",
  'l3.ask.shareOnePower': "Escribe una parte como una sola potencia.",
  'l3.ask.oneExpression': 'Escribe esto como una sola expresión.',
  'l3.ask.exactValue': '¿Cuál es el valor exacto?',
  'l3.ask.valueOfF': '¿Cuánto vale $f({k})$?',
  'l3.ask.whichInputGives': '¿Qué entrada da la salida ${out}$?',
  'l3.ask.largestOutput': '¿Cuál es la salida más grande?',
  'l3.ask.smallestOutput': '¿Cuál es la salida más pequeña?',
  'l3.ask.missingReading': '¿Cuál es la lectura que falta?',
  'l3.ask.plateArea': 'Escribe el área como una sola expresión.',
  'l3.ask.factoredForm': 'Escribe esto como un producto.',
  'l3.ask.combinedTotal': 'Escribe el total junto como una sola expresión.',
  'l3.ask.whatIsLeft': 'Escribe lo que queda como una sola expresión.',
  'l3.ask.stepFactor': 'La salida se multiplica por el mismo número en cada paso. ¿Cuál es?',
  'l3.ask.stepAdd': 'La salida suma el mismo número en cada paso. ¿Cuál es?',
  'l3.ask.gapAt': '¿Cuánto vale en ${v} = {k}$?',
  'l3.ask.startValue': '¿Cuál es la salida al empezar?',
  'l3.ask.nextReading': '¿Cuál es la salida un paso después de $f({k})$?',

  // ---------------------------------------------------------- las entradas
  'l3.ctx.inputsRun': 'Las entradas son los números enteros de {lo} a {hi}.',

  // -------------------------------------------------------- reglas con nombre
  'l3.ctx.assay': 'Un ensayador convierte cada muestra de mineral en una lectura.',
  'l3.ctx.kilnRule': 'Este horno convierte cada ajuste de fuego en una temperatura.',
  'l3.ctx.sorter': "Una cinta convierte cada carga de cajas en una carga de estantes.",
  'l3.ctx.lathe': 'Un torno convierte cada pasada en una profundidad final.',
  'l3.ctx.beacon': "Una baliza convierte cada ajuste del dial en una distancia.",

  // ------------------------------------------------------- solo enteros
  'l3.ctx.crates': "Un montacargas solo admite cajas enteras, de {lo} a {hi}.",
  'l3.ctx.berths': "Una lanzadera solo admite literas enteras, de {lo} a {hi}.",
  'l3.ctx.panels': "Un bastidor solo admite paneles enteros, de {lo} a {hi}.",
  'l3.ctx.rations': "Una taquilla solo admite raciones enteras, de {lo} a {hi}.",

  // ------------------------------------------- una potencia junto a otra
  'l3.ctx.tileRun': "Este patio de losas es un rectángulo, y cada lado es una potencia del mismo largo.",
  'l3.ctx.coilStack': "Este soporte de bobinas es un rectángulo, y cada lado es una potencia del mismo ancho.",
  'l3.ctx.cellArray': "Este bloque de celdas es un rectángulo, y cada lado es una potencia del mismo fondo.",
  'l3.ctx.driveBank': "Este banco de discos es un rectángulo, y cada lado es una potencia de la misma altura.",
  'l3.ctx.oreSeam': "Esta veta es un rectángulo, y cada lado es una potencia del mismo tramo.",

  // ----------------------------------------------- una potencia de otra
  'l3.ctx.stackOfStacks': "Cada bahía guarda una potencia de una carga, y la bodega repite esa bahía una potencia de veces.",
  'l3.ctx.gridOfGrids': "Cada rejilla guarda una potencia de una celda, y el conjunto repite esa rejilla una potencia de veces.",
  'l3.ctx.podOfPods': "Cada cápsula guarda una potencia de una semilla, y el bastidor repite esa cápsula una potencia de veces.",
  'l3.ctx.reelOfReels': "Cada carrete guarda una potencia de una vuelta, y la bobina repite ese carrete una potencia de veces.",

  // ------------------------------------------------- una potencia repartida
  'l3.ctx.equalCrews': "Una bodega guarda una potencia de una carga, y la reparte entre una potencia de cuadrillas.",
  'l3.ctx.equalPallets': "Un compartimento guarda una potencia de un bulto, y lo reparte entre una potencia de palés.",
  'l3.ctx.equalRacks': "Un almacén guarda una potencia de una celda, y la reparte entre una potencia de estantes.",
  'l3.ctx.equalVats': "Una línea guarda una potencia de un litro, y lo reparte entre una potencia de cubas.",

  // ------------------------------------------------------- dos registros
  'l3.ctx.twoManifests': 'Dos manifiestos anotan las mismas clases de artículo.',
  'l3.ctx.twoSurveys': 'Dos sondeos anotan las mismas clases de lectura.',
  'l3.ctx.twoHolds': 'Dos bodegas anotan las mismas clases de caja.',
  'l3.ctx.twoShifts': 'Dos turnos anotan las mismas clases de tarea.',

  // ----------------------------------------------------------- rectángulos
  'l3.ctx.hullPlate': 'Una plancha de casco es un rectángulo, y aún no se sabe ningún lado.',
  'l3.ctx.deckPanel': 'Un panel de cubierta es un rectángulo, y aún no se sabe ningún lado.',
  'l3.ctx.solarSail': 'Una vela solar es un rectángulo, y aún no se sabe ningún lado.',
  'l3.ctx.floorBay': 'Un tramo de suelo es un rectángulo, y aún no se sabe ningún lado.',

  // ------------------------------------------------------ una parte común
  'l3.ctx.sameCrew': "Cada término de abajo mide la misma cuadrilla.",
  'l3.ctx.samePallet': "Cada término de abajo mide el mismo palé.",
  'l3.ctx.sameRack': "Cada término de abajo mide el mismo estante.",
  'l3.ctx.sameVat': "Cada término de abajo mide la misma cuba.",

  // ------------------------------------------------------------ crecimiento
  'l3.ctx.spore': 'Un lecho de esporas crece por el mismo factor en cada guardia.',
  'l3.ctx.relaySignal': 'Una señal de relé gana por el mismo factor en cada guardia.',
  'l3.ctx.rustBloom': 'Una mancha de óxido se extiende por el mismo factor en cada guardia.',
  'l3.ctx.yeastVat': 'Una cuba de levadura sube por el mismo factor en cada guardia.',

  // ------------------------------------------------------------ decaimiento
  'l3.ctx.coolant': 'Un tanque de refrigerante guarda la misma fracción de su carga en cada guardia.',
  'l3.ctx.isotope': 'Un isótopo guarda la misma fracción de su masa en cada guardia.',
  'l3.ctx.powerCell': "Una pila guarda la misma fracción de su reserva en cada guardia.",
  'l3.ctx.signalFade': 'Una señal guarda la misma fracción de su fuerza en cada guardia.',

  // ---------------------------------------------------------- registros fijos
  'l3.ctx.steadyWinch': 'El registro del cabrestante sube la misma cantidad en cada guardia.',
  'l3.ctx.steadyTank': 'El registro del depósito sube la misma cantidad en cada guardia.',
  'l3.ctx.steadyStack': 'El registro de la pila sube la misma cantidad en cada guardia.',
  'l3.ctx.steadyFrost': 'El registro de la escarcha sube la misma cantidad en cada guardia.',

  // ------------------------------------------------------------- disputas
  'l3.ctx.disputeExponent': 'Dos cadetes multiplicaron dos potencias de una letra y no coinciden en el exponente.',
  'l3.ctx.disputeFactorCount': 'Dos cadetes contaron los factores de un producto de potencias y les dio distinto.',
  'l3.ctx.disputeMinus': 'Dos cadetes restaron un paréntesis de otro y no coinciden en los signos.',
  'l3.ctx.disputeSecondBracket': 'Dos cadetes restaron un paréntesis, y uno cambió solo su primer término.',

  // ----------------------------------------------------- porqué · potencias
  'l3.why.countTheFactors': 'Una potencia cuenta factores, así que un producto de potencias cuenta los dos grupos.',
  'l3.why.addTheCounts': 'Suma los dos exponentes, {a} y {b}.',
  'l3.why.numbersThenLetters': 'Junta primero los números, y después junta las potencias.',
  'l3.why.multiplyNumbersAddCounts': 'Multiplica los números. Suma los exponentes.',
  'l3.why.twoAtATime': 'Toma las dos primeras potencias, y después mete la tercera.',
  'l3.why.addTheLastCount': 'Suma el último exponente, {c}, al total que llevas.',
  'l3.why.writeOutTheFactors': 'Escribe los factores enteros, y cuéntalos.',
  'l3.why.copiesOfTheBracket': 'El paréntesis aparece {b} veces, y cada copia lleva {a} factores.',
  'l3.why.countCopiesOfCount': 'Cada copia del paréntesis trae otra vez el mismo exponente.',
  'l3.why.multiplyTheCounts': 'Multiplica los dos exponentes, {a} y {b}.',
  'l3.why.everyFactorIsRaised': 'El exponente de fuera alcanza a cada factor de dentro del paréntesis.',
  'l3.why.raiseNumberMultiplyCounts': 'Eleva el número al exponente. Multiplica los exponentes.',
  'l3.why.innerPairFirst': 'Resuelve primero el par de exponentes de dentro.',
  'l3.why.cancelMatchingFactors': 'Cada factor de abajo cancela uno de arriba.',
  'l3.why.subtractTheCounts': 'Resta el exponente de abajo al de arriba: {a} menos {b}.',
  'l3.why.divideNumbersSubtractCounts': 'Divide los números. Resta los exponentes.',
  'l3.why.bottomFirst': 'Junta primero la parte de abajo en una sola potencia.',
  'l3.why.everyFactorCancels': 'Arriba y abajo llevan los mismos factores, así que solo queda uno.',
  'l3.why.theZeroBelongsToTheLetter': 'El exponente cero es de la letra, no del número.',
  'l3.why.zeroPowerIsOne': 'Una letra con exponente cero vale uno.',
  'l3.why.negativeCountIsUnderTheBar': 'Un exponente de menos {n} pone {n} factores debajo de la barra.',
  'l3.why.unitFractionDivides': "Cada paso divide entre {q}, así que {n} pasos dividen entre {q} esa cantidad de veces.",
  'l3.why.workOutTheBottom': 'Calcula {base} con exponente {n} en la parte de abajo.',

  // ----------------------------------------------------- porqué · funciones
  'l3.why.putTheInputIn': 'Pon {k} en cada sitio donde la letra está en la regla.',
  'l3.why.workItOut': 'Ahora resuelve la aritmética.',
  'l3.why.nameIsNotAFactor': 'El nombre de una regla es una etiqueta, y nunca multiplica.',
  'l3.why.readTheRowAcross': 'Lee la fila hasta la columna de salida.',
  'l3.why.oneStepDownTable': 'Un paso hacia abajo en la tabla mueve la salida la misma cantidad.',
  'l3.why.risingRuleTopInput': 'La tasa es positiva, así que la entrada más grande da la salida más grande.',
  'l3.why.risingRuleLowInput': 'La tasa es positiva, así que la entrada más pequeña da la salida más pequeña.',
  'l3.why.fallingRuleTopOutput': 'La tasa es negativa, así que la entrada más pequeña da la salida más grande.',
  'l3.why.undoToFindInput': 'Deshaz la regla para hallar la entrada que la da.',

  // --------------------------------------------------- porqué · polinomios
  'l3.why.dropTheFirstBracket': 'Un más delante deja el paréntesis tal como está.',
  'l3.why.minusEntersEveryTerm': 'El menos es de todo el paréntesis, así que cambia cada término de dentro.',
  'l3.why.collectEachPower': 'Junta los términos que llevan el mismo exponente.',
  'l3.why.eachTimesEach': 'Cada término del primer paréntesis multiplica a cada término del segundo.',
  'l3.why.collectTheMiddle': 'Los dos términos de en medio llevan el mismo exponente, así que se juntan.',
  'l3.why.squareIsTwoBrackets': 'Un cuadrado es el paréntesis escrito dos veces.',
  'l3.why.monoIntoEveryTerm': 'El término de delante multiplica a cada término de dentro del paréntesis.',
  'l3.why.largestSharedFactor': 'Busca el factor más grande que llevan todos los términos.',
  'l3.why.divideEachTerm': 'Divide cada término por ese factor, y escribe dentro lo que queda.',
  'l3.why.checkByExpanding': 'Vuelve a multiplicar para comprobar que no se quedó nada fuera.',
  'l3.why.lowestPowerComesOut': 'El exponente más bajo de la letra es todo lo que pueden compartir los términos.',

  // ---------------------------------------------------- porqué · crecimiento
  'l3.why.divideNeighbours': 'Divide una lectura por la lectura anterior.',
  'l3.why.thatIsTheFactor': 'Ese es el factor, y todos los pasos usan el mismo.',
  'l3.why.subtractNeighbours': 'Resta una lectura a la lectura siguiente.',
  'l3.why.thatIsTheStep': 'Ese es el paso, y todos los pasos suman la misma cantidad.',
  'l3.why.putTheStepIn': 'Pon {k} en el sitio de la letra en las dos reglas.',
  'l3.why.exponentialOvertakes': 'Un factor gana a un paso en cuanto el exponente crece.',
  'l3.why.startIsTheNumberInFront': 'En cero la potencia vale uno, así que el número de delante es el principio.',
  'l3.why.oneMoreStepMultiplies': 'Un paso más multiplica la salida otra vez por la base.',
  'l3.why.readTheBaseOff': 'El número de arriba es el exponente, y el de abajo es la base.',
};
