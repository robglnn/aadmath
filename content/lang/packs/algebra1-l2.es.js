/**
 * Algebra I · Nivel 2 — texto de los ítems, español.
 *
 * Prose for a course pack lives beside the shipped item bundles, under
 * content/lang, and never inside src/. Same rule, same reason: src/ carries no
 * language. The pack in src/content/packs imports this file and the registry
 * merges it in behind content/lang/items.*.js.
 */
export default {
  'l2.ctx.twoHolds': 'Un carguero tiene dos bodegas. Las dos bodegas llevan la misma masa.',
  'l2.ask.holdMass': 'El registro de abajo dice lo que pesa cada bodega. Halla ${v}$.',
  'l2.ctx.shareOut': 'Una cuadrilla reparte una entrega en cargas iguales.',
  'l2.ask.oneLoad': 'El registro de abajo dice el tamaño de una carga. Halla ${v}$.',
  'l2.ctx.gauge': 'Un medidor se lee una vez por guardia. Nadie anotó la regla que sigue.',
  'l2.ask.missingWatch': 'Falta una lectura. ¿Cuál era?',
  'l2.ctx.stockpile': 'Una reserva crece la misma cantidad en cada guardia.',
  'l2.why.openBothBrackets': 'Abre primero los dos paréntesis. Hasta entonces cada lado es una sola cantidad.',
  'l2.why.minusEntersEveryTerm': 'El signo menos es de todo el paréntesis, así que entra en cada término de dentro.',
  'l2.why.multiplyBothByBottom': 'Multiplica los dos lados por {k}. Eso es lo que quita la barra.',
  'l2.why.stepTellsRate': 'Cada paso de la entrada mueve la salida en {n}. Esa es la tasa.',
  'l2.why.applyRateOnce': 'Aplica la tasa a la fila de encima del hueco.',
  'l2.why.stepBackToInput': 'La salida se movió una tasa, así que la entrada se movió un paso.',
};
