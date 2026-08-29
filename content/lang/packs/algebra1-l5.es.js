/**
 * Álgebra I · Nivel 5 — texto de los ítems, español.
 *
 * El texto de un paquete vive junto a los bundles de ítems, en content/lang, y
 * nunca dentro de src/. Misma regla, misma razón: src/ no lleva idioma. El
 * paquete de src/content/packs importa este archivo y el registro lo une
 * detrás de content/lang/items.*.js.
 *
 * ESTILO. Español técnico simplificado: una palabra significa una sola cosa,
 * una instrucción por frase, voz activa, menos de veinte palabras. Una
 * situación es UNA frase y nunca dice un número que las matemáticas no usan.
 *
 * UNA PALABRA, UN SIGNIFICADO — el vocabulario que añade este nivel:
 *   lectura   un par medido, o un valor medido
 *   lista     números en orden, uno por cada posición
 *   posición  qué lugar de la lista, contando 1, 2, 3
 *   paso      la cantidad que una lista suma en cada posición
 *   factor    el número por el que una lista multiplica (Nivel 3)
 *   cuenta    el número escrito arriba, que dice cuántos factores (Nivel 3)
 *   raíz      la operación que deshace una potencia
 *   tasa      cuánto sube una recta por un paso hacia el lado (Nivel 2)
 *   recta más cercana  la única recta que queda más cerca de todas las lecturas
 *   hueco     una lectura menos el valor que la recta da allí
 *   región    todas las lecturas que cumplen un enunciado con desigualdad
 *   borde     la recta donde termina una región
 *   cruce     la única lectura en la que dos reglas coinciden
 *   parte     una cantidad frente a un total
 */
export default {
  // ------------------------------------------------------------- preguntas
  'l5.ask.exactValue': '¿Cuál es el valor exacto?',
  'l5.ask.simplestForm': 'Escribe esto en su forma más simple.',
  'l5.ask.rootThenPower': 'La parte de abajo dice qué raíz tomar. ¿Cuál es el valor?',
  'l5.ask.whichInputBreaks': 'Una entrada lleva dos salidas distintas. ¿Qué entrada?',
  'l5.ask.valueAtPosition': '¿Cuál es el valor en la posición {k}?',
  'l5.ask.oneFormula': 'Escribe una fórmula que dé el valor en la posición {v}.',
  'l5.ask.sameLineFromReading': 'Escribe la misma recta restando la lectura marcada en los dos lados.',
  'l5.ask.sameLineOutputAlone': 'Escribe la misma recta con la salida sola a la izquierda.',
  'l5.ask.sameLineWholeNumbers': 'Escribe la misma recta con las dos letras a la izquierda y sin fracción.',
  'l5.ask.lineBeside': 'Escribe la regla de la recta junto a esta, por la lectura marcada. Usa $x$ e $y$.',
  'l5.ask.lineAtRightAngle': 'Escribe la regla de la recta en ángulo recto con esta, por la lectura marcada. Usa $x$ e $y$.',
  'l5.ask.writeThatLine': 'Escribe la regla de esa recta.',
  'l5.ask.rateAtRightAngle': '¿Cuál es la tasa de la recta en ángulo recto con esta?',
  'l5.ask.rateOfThatLine': '¿Cuál es la tasa de esa recta?',
  'l5.ask.valueAtZero': '¿Cuál es la salida cuando la entrada vale cero?',
  'l5.ask.whichRegion': 'R es la región. Escribe el enunciado que nombra R.',
  'l5.ask.writeThePair': 'Escribe el par de reglas, una por cada tabla.',
  'l5.ask.whereTheyMeet': '¿Dónde se cruzan las dos reglas?',
  'l5.ask.inputAtCrossing': '¿Cuál es la entrada en el cruce?',
  'l5.ask.outputAtCrossing': '¿Cuál es la salida en el cruce?',
  'l5.ask.fitRate': '¿Cuál es la tasa de la recta más cercana?',
  'l5.ask.fitStart': '¿Dónde empieza la recta más cercana?',
  'l5.ask.predictAt': '¿Qué da la recta más cercana en {k}?',
  'l5.ask.gapAt': 'Un hueco es una lectura menos la recta. ¿Cuál es el hueco en {k}?',
  'l5.ask.gapAtShort': '¿Cuál es el hueco en {k}?',
  'l5.ask.shareOfRow': '¿Qué parte de la fila marcada cae en la columna marcada?',
  'l5.ask.shareOfAll': '¿Qué parte de todas las lecturas cae donde la fila marcada corta la columna marcada?',
  'l5.ask.shareOfColumn': '¿Qué parte de la columna marcada cae en la fila marcada?',
  'l5.ask.startAmount': 'El inicio está en $x = 0$. ¿Cuál es la cantidad allí?',
  'l5.ask.growthFactor': '¿Cuál es el factor?',
  'l5.ask.percentEachStep': '¿Qué porcentaje sube en cada paso?',
  'l5.ask.writeTheRule': 'Escribe la regla de estas lecturas.',
  'l5.ask.whenItPasses': '¿En qué posición la primera regla pasa a la segunda?',

  // -------------------------------------------------- cuentas con fracción
  'l5.ctx.kilnFire': 'Un horno eleva cada carga a una cuenta fraccionaria de su masa.',
  'l5.ctx.tuner': 'Un sintonizador pone cada antena a una cuenta fraccionaria de la baliza.',
  'l5.ctx.mixer': 'Una mezcladora escala cada lote a una cuenta fraccionaria de su carga.',
  'l5.ctx.gauge': 'Un manómetro informa de una cuenta fraccionaria de la presión que aguanta.',
  'l5.ctx.hullSquare': 'Una placa cuadrada de casco tiene esta área, y la tripulación quiere un lado.',
  'l5.ctx.tankSquare': 'Un suelo cuadrado de tanque tiene esta área, y la tripulación quiere un borde.',
  'l5.ctx.bayRoot': 'Una plataforma cuadrada tiene esta área, y la tripulación pinta un borde.',

  // ------------------------------------------------------- una sola salida
  'l5.ctx.dockLog': 'Un registro de muelle une cada número de atraque con la masa que tomó.',
  'l5.ctx.sensorLog': 'Un registro de sensor une cada ajuste del dial con la lectura que dio.',
  'l5.ctx.cropLog': 'Un registro de cultivo une cada número de bandeja con la cosecha que dio.',
  'l5.ctx.relayLog': 'Un registro de relé une cada número de canal con el retardo que dio.',
  'l5.ctx.pilotSheet': 'Una hoja de vuelo une cada código de despegue con el tiempo que fijó.',

  // ---------------------------------------------------------------- listas
  'l5.ctx.driftRow': 'Una boya informa de una distancia en cada guardia.',
  'l5.ctx.stackRow': 'Una tripulación apila el mismo número de cajas en cada guardia.',
  'l5.ctx.iceRow': 'Un casco pierde la misma masa de hielo en cada guardia.',
  'l5.ctx.fuelRow': 'Un quemador pierde la misma masa de combustible en cada guardia.',
  'l5.ctx.stockRow': 'Un almacén pierde el mismo número de paquetes en cada guardia.',
  'l5.ctx.sporeRow': 'Un lecho de esporas multiplica por el mismo factor en cada guardia.',
  'l5.ctx.dimmerRow': 'Una lámpara guarda la misma fracción de su luz en cada guardia.',
  'l5.ctx.tetherRow': 'Un cable suelta la misma longitud en cada guardia.',

  // ---------------------------------------------------------------- rectas
  'l5.ctx.rampRule': 'Una rampa sube a una tasa constante.',
  'l5.ctx.beltRule': 'Una cinta lleva masa a una tasa constante.',
  'l5.ctx.pumpRule': 'Una bomba llena un tanque a una tasa constante.',
  'l5.ctx.craneRule': 'Una grúa iza a una tasa constante.',
  'l5.ctx.girderRun': 'Una viga corre junto a esta recta, y la lectura marcada cae en ella.',
  'l5.ctx.braceRun': 'Un puntal cruza esta recta en ángulo recto por la lectura marcada.',
  'l5.ctx.railRun': 'Un raíl corre junto a esta recta y lleva la lectura marcada.',
  'l5.ctx.strutRun': 'Un tirante corta esta recta en ángulo recto en la lectura marcada.',
  'l5.ctx.towLine': 'Un remolque corre junto a esta recta y lleva la lectura marcada.',

  // -------------------------------------------------------------- regiones
  'l5.ctx.safeLoad': 'Un montacargas trabaja seguro en todas las lecturas de la región.',
  'l5.ctx.coldBay': 'Una cámara fría aguanta todas las lecturas de la región.',
  'l5.ctx.powerBudget': 'Un presupuesto de energía cubre todas las lecturas de la región.',
  'l5.ctx.airMix': 'Una mezcla de aire queda limpia en todas las lecturas de la región.',

  // -------------------------------------------------------------- sistemas
  'l5.ctx.twoHoists': 'Dos montacargas van a su propia tasa, y cada tabla anota uno.',
  'l5.ctx.twoTanks': 'Dos tanques se llenan a su propia tasa, y cada tabla anota uno.',
  'l5.ctx.twoRovers': 'Dos vehículos van a su propia tasa, y cada tabla anota uno.',
  'l5.ctx.twoKilns': 'Dos hornos calientan a su propia tasa, y cada tabla anota uno.',
  'l5.ctx.priceMeet': 'Dos proveedores cobran por su propia regla, y la tripulación busca el mismo precio.',
  'l5.ctx.rangeMeet': 'Dos drones gastan carga por su propia regla, y la tripulación busca la misma carga.',
  'l5.ctx.fillMeet': 'Dos tubos llenan por su propia regla, y la tripulación busca la misma altura.',
  'l5.ctx.climbMeet': 'Dos ascensores suben por su propia regla, y la tripulación busca la misma altura.',

  // ----------------------------------------------------------------- datos
  'l5.ctx.oreAssay': 'Una tripulación anota una lectura de mineral por cada profundidad.',
  'l5.ctx.frostRun': 'Una tripulación anota una lectura de escarcha por cada hora de noche.',
  'l5.ctx.dustRun': 'Una tripulación anota una lectura de polvo por cada metro de altura.',
  'l5.ctx.saltRun': 'Una tripulación anota una lectura de sal por cada kilómetro de costa.',
  'l5.ctx.windRun': 'Una tripulación anota una lectura de viento por cada metro de mástil.',
  'l5.ctx.yieldRun': 'Una tripulación anota una lectura de cosecha por cada gramo de abono.',
  'l5.ctx.wearRun': 'Una tripulación anota una lectura de desgaste por cada mil vueltas.',

  // ------------------------------------------------------- tabla de doble entrada
  'l5.ctx.crewSurvey': 'Una encuesta ordena a cada cadete por turno y por oficio.',
  'l5.ctx.partsAudit': 'Una revisión ordena cada pieza por proveedor y por grado.',
  'l5.ctx.cargoAudit': 'Una revisión ordena cada caja por cubierta y por sello.',
  'l5.ctx.faultAudit': 'Una revisión ordena cada fallo por sistema y por guardia.',

  // --------------------------------------------------- crecer y menguar
  'l5.ctx.blightSpread': 'Una plaga multiplica por el mismo factor en cada guardia.',
  'l5.ctx.fundGrow': 'Un fondo multiplica por el mismo factor en cada guardia.',
  'l5.ctx.coolantFade': 'Un refrigerante guarda la misma fracción de sí mismo en cada guardia.',
  'l5.ctx.isotopeFade': 'Un isótopo guarda la misma fracción de sí mismo en cada guardia.',
  'l5.ctx.raceStep': 'Una reserva suma en cada guardia y la otra multiplica.',
  'l5.ctx.raceGrow': 'Un cultivo suma en cada guardia y el otro multiplica.',

  // -------------------------------------------------------------- disputas
  'l5.ctx.disputeRoot': 'Dos cadetes leen la misma cuenta fraccionaria y no coinciden.',
  'l5.ctx.disputeOrder': 'Dos cadetes tomaron la raíz y la potencia en distinto orden.',
  'l5.ctx.disputeFunction': 'Dos cadetes discuten qué ajuste rompió el registro.',
  'l5.ctx.disputeStep': 'Dos cadetes discuten el paso de la misma lista.',
  'l5.ctx.disputeFormula': 'Dos cadetes escribieron fórmulas distintas para la misma lista.',
  'l5.ctx.disputeRate': 'Dos cadetes discuten cuál es la recta en ángulo recto con esta.',
  'l5.ctx.disputeCrossing': 'Dos cadetes discuten dónde se cruzan las dos reglas.',
  'l5.ctx.disputeFit': 'Dos cadetes discuten cuál es la recta más cercana.',
  'l5.ctx.disputeGap': 'Dos cadetes discuten el hueco en una lectura.',
  'l5.ctx.disputeShare': 'Dos cadetes discuten la parte que cae en una fila.',
  'l5.ctx.disputeWhole': 'Dos cadetes discuten contra qué total va una parte.',

  // ------------------------------------------ por qué · cuentas fraccionarias
  'l5.why.bottomIsTheRoot': 'La parte de abajo de la cuenta dice qué raíz tomar.',
  'l5.why.topIsThePower': 'La parte de arriba dice a qué potencia elevar el resultado.',
  'l5.why.rootFirstThenPower': 'Toma primero la raíz y eleva el número pequeño a la cuenta de arriba.',
  'l5.why.negativeCountFlips': 'Una cuenta menor que cero da la vuelta al valor.',
  'l5.why.squareFactorComesOut': 'Saca el mayor factor cuadrado y toma su raíz.',
  'l5.why.rootOfAProduct': 'La raíz de un producto es el producto de las raíces.',
  'l5.why.workItOut': 'Haz la cuenta.',

  // ------------------------------------------------- por qué · una salida
  'l5.why.oneOutputEachInput': 'Una regla es función cuando cada entrada lleva una sola salida.',
  'l5.why.readDownTheInputs': 'Baja por la columna de entradas y busca la misma entrada dos veces.',
  'l5.why.twoOutputsBreakIt': 'Esa entrada lleva dos salidas distintas, así que la regla se rompe ahí.',
  'l5.why.sharedOutputIsFine': 'Dos entradas pueden compartir una salida, y la regla aguanta.',

  // ------------------------------------------------------ por qué · listas
  'l5.why.takeNeighbours': 'Resta un valor del valor que va después.',
  'l5.why.sameStepAllTheWay': 'Cada pareja da el mismo paso, así que la lista suma.',
  'l5.why.divideNeighbours': 'Divide un valor entre el valor que va antes.',
  'l5.why.sameFactorAllTheWay': 'Cada pareja da el mismo factor, así que la lista multiplica.',
  'l5.why.countTheStepsOn': 'Cuenta los pasos desde la última posición escrita hasta la posición {k}.',
  'l5.why.addTheStepEachTime': 'Suma el paso una vez por cada posición que avanzas.',
  'l5.why.multiplyEachTime': 'Multiplica por el factor una vez por cada posición que avanzas.',
  'l5.why.firstValuePlusSteps': 'Empieza en el primer valor y suma el paso por cada posición posterior.',
  'l5.why.stepTimesPositionPlusStart': 'La fórmula es el paso por la posición, más lo que sobra.',
  'l5.why.factorPowerFromFirst': 'La fórmula es el primer valor por el factor, elevado a los pasos dados.',
  'l5.why.checkAtPositionOne': 'Pon la posición uno en la fórmula y comprueba el primer valor.',
  'l5.why.runTheRuleOn': 'Aplica la regla hacia delante, una posición cada vez.',

  // ------------------------------------------------------ por qué · rectas
  'l5.why.rateOffTheRule': 'Lee la tasa en la regla escrita.',
  'l5.why.pointIntoTheForm': 'Pon la lectura marcada en la forma y cuida los signos.',
  'l5.why.zeroIntoTheForm': 'Pon cero en lugar de la entrada, y cuida los signos.',
  'l5.why.takeAwayTheReading': 'Resta la lectura, así un punto bajo cero se vuelve una suma.',
  'l5.why.multiplyOutTheBracket': 'Quita el paréntesis y junta los números.',
  'l5.why.clearTheBottom': 'Multiplica cada parte por el número de abajo y quita la fracción.',
  'l5.why.gatherLettersLeft': 'Junta las dos letras a la izquierda y el número a la derecha.',
  'l5.why.sameRateForParallel': 'Dos rectas que nunca se cruzan llevan la misma tasa.',
  'l5.why.turnOverAndChangeSign': 'Para un ángulo recto, da la vuelta a la tasa y cambia su signo.',
  'l5.why.uprightHasNoRate': 'Una recta vertical no tiene tasa, así que se escribe solo con su entrada.',
  'l5.why.flatLineRateIsZero': 'Una recta plana tiene tasa cero, así que su regla nombra solo la salida.',
  'l5.why.throughTheOrigin': 'La recta pasa por cero, así que no se suma ningún número.',
  'l5.why.constantIsOutputOverInput': 'Divide la salida entre la entrada para hallar la constante.',

  // ---------------------------------------------------- por qué · regiones
  'l5.why.boundaryFromReadings': 'Ajusta primero la recta a las lecturas del borde.',
  'l5.why.testTheReadingOffTheLine': 'Pon la lectura que queda fuera de la recta. Mira de qué lado cae.',
  'l5.why.readingOffTheLineIsIn': 'La lectura fuera de la recta está en R, así que R cae de su lado.',
  'l5.why.readingOffTheLineIsOut': 'La lectura fuera de la recta no está en R, así que R cae del otro lado.',
  'l5.why.boundaryLeftOutOfR': 'La lectura del borde no está en R, así que la desigualdad es estricta.',
  'l5.why.boundaryKeptInR': 'La lectura del borde está en R, así que la desigualdad admite igual.',

  // ---------------------------------------------------- por qué · sistemas
  'l5.why.ruleFromEachTable': 'Halla una regla de cada tabla por separado.',
  'l5.why.twoRulesTwoUnknowns': 'Dos reglas distintas sobre un par fijan las dos lecturas.',
  'l5.why.setThemEqual': 'Las reglas coinciden en el cruce, así que iguálalas.',
  'l5.why.solveForTheInput': 'Despeja la entrada.',
  'l5.why.putItBackInEither': 'Pon la entrada en cualquiera de las dos reglas y halla la salida.',
  'l5.why.checkInBoth': 'Un cruce cumple las dos reglas, así que compruébalo en las dos.',
  'l5.why.readTheSharedRow': 'Busca la lectura que sale en las dos tablas.',

  // ------------------------------------------------- por qué · recta cercana
  'l5.why.noReadingIsExact': 'Las lecturas reales nunca caen justo en una recta.',
  'l5.why.closestLineIdea': 'La recta más cercana queda cerca de todas las lecturas a la vez.',
  'l5.why.rateFromAllReadings': 'Cada lectura tira de la tasa, no solo la primera y la última.',
  'l5.why.putTheInputIn': 'Pon {k} en la recta más cercana.',
  'l5.why.gapIsReadingMinusLine': 'El hueco es la lectura menos el valor que da la recta.',
  'l5.why.signOfTheGap': 'Un hueco mayor que cero dice que la lectura queda encima de la recta.',
  'l5.why.gapsAllOneSide': 'Los huecos que se quedan de un lado dicen que la recta no sirve.',
  'l5.why.predictIsNotMeasured': 'Un valor predicho sale de la cuenta, y nadie lo midió.',

  // ------------------------------------------------------ por qué · partes
  'l5.why.rowTotalIsTheWhole': 'Dentro de una fila, el total de la fila es el todo.',
  'l5.why.columnTotalIsTheWhole': 'Dentro de una columna, el total de la columna es el todo.',
  'l5.why.grandTotalIsTheWhole': 'En toda la tabla, el total general es el todo.',
  'l5.why.cellOverWhole': 'Escribe la celda sobre ese todo y simplifica.',
  'l5.why.riseTogetherIsPositive': 'Una tasa mayor que cero dice que las dos lecturas suben juntas.',
  'l5.why.fallAgainstIsNegative': 'Una tasa menor que cero dice que una lectura baja mientras la otra sube.',

  // --------------------------------------------------- por qué · crecimiento
  'l5.why.factorBetweenReadings': 'Divide una lectura entre la lectura anterior y halla el factor.',
  'l5.why.backToTheStart': 'Un factor elevado a cero es uno. Así, en cero la regla da la cantidad inicial.',
  'l5.why.percentFromFactor': 'Resta uno al factor y multiplica por cien.',
  'l5.why.startTimesFactorPower': 'La regla es la cantidad inicial por el factor, elevado a la entrada.',
  'l5.why.tryEachStep': 'Prueba cada posición por turno hasta que la primera regla mande.',
  'l5.why.factorBeatsStep': 'Un factor gana a un paso en cuanto la posición crece.',
};
