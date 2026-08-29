/**
 * One-shot: rewrite content/graph/algebra1-l2.json with the full Level 2
 * lattice. The three shipped nodes are carried across untouched; the eleven new
 * ones are written here so the alignment prose can be edited as text rather
 * than as escaped JSON. The JSON it emits is the source of truth afterwards.
 */
import { readFile, writeFile } from 'node:fs/promises';

const ROOT = '/Users/harrison/dev/aadmath';
const old = JSON.parse(await readFile(`${ROOT}/content/graph/algebra1-l2.json`, 'utf8'));
const keep = Object.fromEntries(old.nodes.map((n) => [n.id, n]));

const ccss = (code, text, depth = 'core', caveat, i18n) => ({
  framework: 'CCSS-M', code, text, depth, ...(caveat ? { caveat } : {}), ...(i18n ? { i18n } : {}),
});
const teks = (code, citation, text, depth = 'core', caveat, i18n) => ({
  framework: 'TEKS', code, citation, text, depth, ...(caveat ? { caveat } : {}), ...(i18n ? { i18n } : {}),
});
const cav = (es, pl) => ({ es: { caveat: es }, pl: { caveat: pl } });

// The student expectations quoted below, word for word, with their trailing
// punctuation as the published rule carries it.
const T = {
  REI3: 'Solve linear equations and inequalities in one variable, including equations with coefficients represented by letters.',
  CED1: 'Create equations and inequalities in one variable and use them to solve problems. Include equations arising from linear and quadratic functions, and simple rational and exponential functions.',
  CED2: 'Create equations in two or more variables to represent relationships between quantities; graph equations on coordinate axes with labels and scales.',
  CED3: 'Represent constraints by equations or inequalities, and by systems of equations and/or inequalities, and interpret solutions as viable or nonviable options in a modeling context.',
  CED4: 'Rearrange formulas to highlight a quantity of interest, using the same reasoning as in solving equations.',
  REI5: 'Prove that, given a system of two equations in two variables, replacing one equation by the sum of that equation and a multiple of the other produces a system with the same solutions.',
  REI6: 'Solve systems of linear equations exactly and approximately (e.g., with graphs), focusing on pairs of linear equations in two variables.',
  REI10: 'Understand that the graph of an equation in two variables is the set of all its solutions plotted in the coordinate plane, often forming a curve (which could be a line).',
  REI11: 'Explain why the x-coordinates of the points where the graphs of the equations y = f(x) and y = g(x) intersect are the solutions of the equation f(x) = g(x); find the solutions approximately, e.g., using technology to graph the functions, make tables of values, or find successive approximations.',
  EE6_8: 'Write an inequality of the form x > c or x < c to represent a constraint or condition in a real-world or mathematical problem. Recognize that inequalities of the form x > c or x < c have infinitely many solutions; represent solutions of such inequalities on number line diagrams.',
  EE7_4B: 'Solve word problems leading to inequalities of the form px + q > r or px + q < r, where p, q, and r are specific rational numbers. Graph the solution set of the inequality and interpret it in the context of the problem.',
  RP7_2C: 'Represent proportional relationships by equations.',
  RP6_3: 'Use ratio and rate reasoning to solve real-world and mathematical problems, e.g., by reasoning about tables of equivalent ratios, tape diagrams, double number line diagrams, or equations.',
  EE8_5: 'Graph proportional relationships, interpreting the unit rate as the slope of the graph. Compare two different proportional relationships represented in different ways.',
  EE8_6: 'Use similar triangles to explain why the slope m is the same between any two distinct points on a non-vertical line in the coordinate plane; derive the equation y = mx for a line through the origin and the equation y = mx + b for a line intercepting the vertical axis at b.',
  EE8_8B: 'Solve systems of two linear equations in two variables algebraically, and estimate solutions by graphing the equations. Solve simple cases by inspection.',
  EE8_8C: 'Solve real-world and mathematical problems leading to two linear equations in two variables.',
  F8_4: 'Construct a function to model a linear relationship between two quantities. Determine the rate of change and initial value of the function from a description of a relationship or from two (x, y) values, including reading these from a table or from a graph. Interpret the rate of change and initial value of a linear function in terms of the situation it models, and in terms of its graph or a table of values.',
  IF6: 'Calculate and interpret the average rate of change of a function (presented symbolically or as a table) over a specified interval. Estimate the rate of change from a graph.',
  IF7A: 'Graph linear and quadratic functions and show intercepts, maxima, and minima.',
  LE2: 'Construct linear and exponential functions, including arithmetic and geometric sequences, given a graph, a description of a relationship, or two input-output pairs (include reading these from a table).',
  LE5: 'Interpret the parameters in a linear or exponential function in terms of a context.',
};

const K = {
  A5B: 'solve linear inequalities in one variable, including those for which the application of the distributive property is necessary and those for which variables are included on both sides; and',
  A5A: 'solve linear equations in one variable, including those for which the application of the distributive property is necessary and those for which variables are included on both sides;',
  A5C: 'solve systems of two linear equations with two variables for mathematical and real-world problems.',
  A2A: 'determine the domain and range of a linear function in mathematical problems; determine reasonable domain and range values for real-world situations, both continuous and discrete; and represent domain and range using inequalities;',
  A2B: 'write linear equations in two variables in various forms, including y = mx + b, Ax + By = C, and y - y1 = m(x - x1), given one point and the slope and given two points;',
  A2C: 'write linear equations in two variables given a table of values, a graph, and a verbal description;',
  A2D: 'write and solve equations involving direct variation;',
  A2I: 'write systems of two linear equations given a table of values, a graph, and a verbal description.',
  A3A: 'determine the slope of a line given a table of values, a graph, two points on the line, and an equation written in various forms, including y = mx + b, Ax + By = C, and y - y1 = m(x - x1);',
  A3B: 'calculate the rate of change of a linear function represented tabularly, graphically, or algebraically in context of mathematical and real-world problems;',
  A3C: 'graph linear functions on the coordinate plane and identify key features, including x-intercept, y-intercept, zeros, and slope, in mathematical and real-world problems;',
  A3F: 'graph systems of two linear equations in two variables on the coordinate plane and determine the solutions if they exist;',
  A3G: 'estimate graphically the solutions to systems of two linear equations with two variables in real-world problems; and',
  A12E: 'solve mathematic and scientific formulas, and other literal equations, for a specified variable.',
  G6_9A: 'write one-variable, one-step equations and inequalities to represent constraints or conditions within problems;',
  G6_10A: 'model and solve one-variable, one-step equations and inequalities that represent problems, including geometric concepts; and',
  G6_10B: 'determine if the given value(s) make(s) one-variable, one-step equations or inequalities true.',
  G6_5A: 'represent mathematical and real-world problems involving ratios and rates using scale factors, tables, graphs, and proportions;',
  G7_10A: 'write one-variable, two-step equations and inequalities to represent constraints or conditions within problems;',
  G7_11A: 'model and solve one-variable, two-step equations and inequalities;',
  G7_4A: 'represent constant rates of change in mathematical and real-world problems given pictorial, tabular, verbal, numeric, graphical, and algebraic representations, including d = rt;',
  G7_4B: 'calculate unit rates from rates in mathematical and real-world problems;',
  G7_4D: 'solve problems involving ratios, rates, and percents, including multi-step problems involving percent increase and percent decrease, and financial literacy problems;',
  G8_4A: 'use similar right triangles to develop an understanding that slope, m, given as the rate comparing the change in y-values to the change in x-values, (y2 - y1)/ (x2 - x1), is the same for any two points (x1, y1) and (x2, y2) on the same line;',
  G8_4C: 'use data from a table or graph to determine the rate of change or slope and y-intercept in mathematical and real-world problems.',
  G8_5B: 'represent linear non-proportional situations with tables, graphs, and equations in the form of y = mx + b, where b ≠ 0;',
  G8_9A: 'identify and verify the values of x and y that simultaneously satisfy two linear equations in the form y = mx + b from the intersections of the graphed equations.',
};

const nodes = [
  keep['bracket-both-sides'],
  keep['fraction-solve'],
  keep['rule-from-table'],

  // =====================================================================
  {
    id: 'inequality-one-step',
    prereqs: ['one-step-mul'],
    worldSite: 'span',
    bigIdea: 'An inequality is a balance that leans. Free the unknown exactly as you would in an equation. One move is different: divide by a negative and the lean turns round.',
    alignment: [
      ccss('CCSS.MATH.CONTENT.HSA.REI.B.3', T.REI3, 'core'),
      ccss('CCSS.MATH.CONTENT.6.EE.B.8', T.EE6_8, 'supporting',
        'The learner reads and chooses statements of the form x > c. Number-line diagrams are not drawn anywhere in this unit.',
        cav('El estudiante lee y elige enunciados de la forma x > c. En esta unidad no se dibuja ninguna recta numérica.',
          'Uczeń czyta i wybiera zdania postaci x > c. W tej jednostce nie rysujemy osi liczbowej.')),
      teks('6.10(A)', '19 TAC §111.26(b)(10)(A)', K.G6_10A, 'core'),
      teks('A.5(B)', '19 TAC §111.39(c)(5)(B)', K.A5B, 'supporting',
        'A.5(B) names two hard cases: the distributive property, and variables on both sides. This node tests neither. Both arrive at inequality-multi-step.',
        cav('A.5(B) nombra dos casos difíciles: la propiedad distributiva y variables en los dos lados. Este nodo no examina ninguno de los dos. Ambos llegan en inequality-multi-step.',
          'A.5(B) wymienia dwa trudne przypadki: rozdzielność mnożenia i niewiadome po obu stronach. Ten węzeł nie sprawdza żadnego z nich. Oba pojawiają się w inequality-multi-step.')),
    ],
    practices: { 'CCSS-M': ['MP.2', 'MP.6'], TEKS: ['A.1(D)', 'A.1(G)'] },
    alignmentNote: {
      'CCSS-M': 'HSA.REI.B.3 is core in its inequality half: the gate is three unassisted items at band 4 or above, at least one of them in a situation, and every one of them is a one-variable linear inequality. 6.EE.B.8 is supporting — the learner reads and writes x > c but never draws it.',
      TEKS: '6.10(A) is core and is the readiness expectation Level 1 left half-claimed: Level 1 modelled and solved one-step equations, and this node closes the inequality half of the same sentence. A.5(B) is supporting because the Algebra I expectation names the distributive and both-sides cases, and neither is tested here.',
    },
    bkt: { pInit: 0.2, pTransit: 0.27, pSlip: 0.09, pGuess: 0.12 },
    requiredReps: ['symbolic', 'context'],
    misconceptions: [
      { id: 'flip-always', text: 'Turns the inequality sign round after every move, not only after a negative multiply or divide.' },
      { id: 'flip-not-needed', text: 'Divides by a negative number and leaves the inequality sign pointing the way it was.' },
      { id: 'boundary-slip', text: 'Includes the boundary value in a strict inequality, or excludes it from a closed one.' },
      { id: 'same-op-both', text: 'Subtracts the coefficient instead of dividing by it.' },
      { id: 'sign-on-constant', text: 'Moves the loose number across without changing its sign.' },
    ],
  },

  // =====================================================================
  {
    id: 'inequality-two-step',
    prereqs: ['inequality-one-step', 'two-step'],
    worldSite: 'span',
    bigIdea: 'Unwrap a lean in reverse, exactly as you unwrap an equation: the loose number first, then the coefficient. Only the division can turn the sign.',
    alignment: [
      ccss('CCSS.MATH.CONTENT.HSA.REI.B.3', T.REI3, 'core'),
      ccss('CCSS.MATH.CONTENT.7.EE.B.4.B', T.EE7_4B, 'supporting',
        'The word-problem and solving halves are core here. Graphing the solution set is not: this unit never draws a solution set on a number line.',
        cav('Las mitades de problema verbal y de resolución sí son centrales aquí. Representar el conjunto solución no lo es: esta unidad nunca dibuja un conjunto solución en una recta numérica.',
          'Połowa dotycząca zadań z treścią i rozwiązywania jest tu rdzeniowa. Rysowanie zbioru rozwiązań nie jest: ta jednostka nigdy nie rysuje zbioru rozwiązań na osi liczbowej.')),
      teks('7.11(A)', '19 TAC §111.27(b)(11)(A)', K.G7_11A, 'core'),
      teks('A.5(B)', '19 TAC §111.39(c)(5)(B)', K.A5B, 'supporting',
        'The two cases A.5(B) names by name are still absent. They are tested at inequality-multi-step, which claims A.5(B) as core.',
        cav('Los dos casos que A.5(B) nombra siguen ausentes. Se examinan en inequality-multi-step, que reclama A.5(B) como central.',
          'Dwa przypadki wymienione w A.5(B) nadal są nieobecne. Sprawdza je inequality-multi-step, który twierdzi A.5(B) jako rdzeniowe.')),
    ],
    practices: { 'CCSS-M': ['MP.7', 'MP.8'], TEKS: ['A.1(B)', 'A.1(D)'] },
    alignmentNote: {
      'CCSS-M': 'HSA.REI.B.3 is core. 7.EE.B.4.B is supporting and the caveat is exact: the px + q > r form is the whole of this node, and the graphing clause of that expectation is not met anywhere in Level 2.',
      TEKS: '7.11(A) is core — one-variable two-step inequalities, modelled and solved, is a word-for-word description of this node. The limit forms answer the question the expectation is really for: the largest whole load a hoist will lift.',
    },
    bkt: { pInit: 0.17, pTransit: 0.26, pSlip: 0.09, pGuess: 0.11 },
    requiredReps: ['symbolic', 'context'],
    misconceptions: [
      { id: 'flip-always', text: 'Turns the inequality sign round after every move, not only after a negative multiply or divide.' },
      { id: 'flip-not-needed', text: 'Divides by a negative number and leaves the inequality sign pointing the way it was.' },
      { id: 'boundary-slip', text: 'Includes the boundary value in a strict inequality, or excludes it from a closed one.' },
      { id: 'sign-on-constant', text: 'Moves the loose number across without changing its sign.' },
      { id: 'partial-rule', text: 'Undoes the loose number and stops before dividing by the coefficient.' },
    ],
  },

  // =====================================================================
  {
    id: 'inequality-multi-step',
    prereqs: ['inequality-two-step', 'bracket-both-sides'],
    worldSite: 'spire',
    bigIdea: 'A bracket opens the same way and the unknown gathers the same way. Gather it on the side that leaves a positive coefficient, and you never have to turn the sign at all.',
    alignment: [
      ccss('CCSS.MATH.CONTENT.HSA.REI.B.3', T.REI3, 'core'),
      ccss('CCSS.MATH.CONTENT.HSA.CED.A.1', T.CED1, 'supporting',
        'Linear only. Quadratic, rational and exponential equations are named by the expectation and are outside Algebra I Level 2.',
        cav('Solo lineal. Las ecuaciones cuadráticas, racionales y exponenciales que nombra la expectativa quedan fuera del Nivel 2 de Álgebra I.',
          'Tylko liniowe. Równania kwadratowe, wymierne i wykładnicze wymienione w oczekiwaniu są poza Poziomem 2 Algebry I.')),
      teks('A.5(B)', '19 TAC §111.39(c)(5)(B)', K.A5B, 'core'),
      teks('A.1(F)', '19 TAC §111.39(c)(1)(F)', 'analyze mathematical relationships to connect and communicate mathematical ideas;', 'supporting',
        'Claimed for the dispute form only, where the learner has to judge two finished readings rather than produce one.',
        cav('Se reclama solo para la forma de disputa, donde el estudiante juzga dos lecturas ya hechas en lugar de producir una.',
          'Twierdzone tylko dla formy sporu, gdzie uczeń ocenia dwa gotowe odczyty zamiast tworzyć własny.')),
    ],
    practices: { 'CCSS-M': ['MP.3', 'MP.7'], TEKS: ['A.1(F)', 'A.1(G)'] },
    alignmentNote: {
      'CCSS-M': 'HSA.REI.B.3 is core and is proved at full strength here: brackets, unknowns on both sides, and a negative coefficient that turns the relation. Nothing above this node is needed to claim the inequality half of REI.B.3 for linear cases.',
      TEKS: 'A.5(B) is core, and this is the only node in the course where both cases the expectation names by name — the distributive property, and variables on both sides — are met inside one inequality. That is why the claim moves from supporting to core here and nowhere earlier.',
    },
    bkt: { pInit: 0.14, pTransit: 0.25, pSlip: 0.1, pGuess: 0.1 },
    requiredReps: ['symbolic', 'verbal'],
    misconceptions: [
      { id: 'flip-not-needed', text: 'Divides by a negative number and leaves the inequality sign pointing the way it was.' },
      { id: 'flip-always', text: 'Turns the inequality sign round after every move, not only after a negative multiply or divide.' },
      { id: 'partial-distribute', text: 'Multiplies the bracket by the outside number once and leaves the second term alone.' },
      { id: 'collect-wrong-side', text: 'Gathers the unknown on the side that leaves a negative coefficient, then loses the sign.' },
      { id: 'boundary-slip', text: 'Includes the boundary value in a strict inequality, or excludes it from a closed one.' },
    ],
  },

  // =====================================================================
  {
    id: 'compound-inequality',
    prereqs: ['inequality-multi-step'],
    worldSite: 'spire',
    bigIdea: 'Two statements at once describe a band, not a ray. Every move happens to all three parts together, and a negative coefficient turns the whole band inside out.',
    alignment: [
      ccss('CCSS.MATH.CONTENT.HSA.REI.B.3', T.REI3, 'core'),
      ccss('CCSS.MATH.CONTENT.HSA.CED.A.3', T.CED3, 'supporting',
        'Constraints are represented and read back as a band. Systems of inequalities, and judging an option viable or nonviable, are not tested.',
        cav('Las restricciones se representan y se releen como una banda. No se examinan los sistemas de desigualdades ni juzgar si una opción es viable.',
          'Ograniczenia są przedstawiane i odczytywane jako przedział. Nie sprawdzamy układów nierówności ani oceny, czy opcja jest wykonalna.')),
      teks('A.5(B)', '19 TAC §111.39(c)(5)(B)', K.A5B, 'core'),
      teks('A.2(A)', '19 TAC §111.39(c)(2)(A)', K.A2A, 'supporting',
        'Only the last clause is claimed: representing a set of allowed values using inequalities. Domain and range of a function are not treated in Level 2.',
        cav('Solo se reclama la última cláusula: representar con desigualdades un conjunto de valores permitidos. El dominio y el rango de una función no se tratan en el Nivel 2.',
          'Twierdzimy tylko ostatnią część: zapis zbioru dopuszczalnych wartości za pomocą nierówności. Dziedziną i zbiorem wartości funkcji Poziom 2 się nie zajmuje.')),
    ],
    practices: { 'CCSS-M': ['MP.2', 'MP.6'], TEKS: ['A.1(D)', 'A.1(E)'] },
    alignmentNote: {
      'CCSS-M': 'HSA.REI.B.3 is core: a compound statement is two linear inequalities in one variable held at once, and the gate proves both ends. HSA.CED.A.3 is supporting, for the situations where a machine runs only inside a band.',
      TEKS: 'A.5(B) is core again, at its hardest reading. A.2(A) is supporting and narrowly claimed: the expectation ends with "represent domain and range using inequalities", and a band is exactly that representation, but nothing here is called a domain.',
    },
    bkt: { pInit: 0.13, pTransit: 0.24, pSlip: 0.1, pGuess: 0.1 },
    requiredReps: ['symbolic', 'context'],
    misconceptions: [
      { id: 'band-reversed', text: 'Writes the band with the larger number first, so it describes no value at all.' },
      { id: 'boundary-slip', text: 'Includes the boundary value in a strict inequality, or excludes it from a closed one.' },
      { id: 'flip-not-needed', text: 'Divides by a negative number and leaves the inequality sign pointing the way it was.' },
      { id: 'partial-rule', text: 'Undoes the loose number on all three parts and stops before dividing.' },
    ],
  },

  // =====================================================================
  {
    id: 'literal-equations',
    prereqs: ['both-sides', 'fraction-solve'],
    worldSite: 'quarry',
    bigIdea: 'A formula is an equation whose numbers have not arrived yet. Solve it for any letter you like, using the same moves, in the same order.',
    alignment: [
      ccss('CCSS.MATH.CONTENT.HSA.CED.A.4', T.CED4, 'core'),
      ccss('CCSS.MATH.CONTENT.HSA.REI.B.3', T.REI3, 'supporting',
        'This node meets the clause "including equations with coefficients represented by letters". The numeric-solution half of REI.B.3 belongs to Level 1 and to the equation nodes here.',
        cav('Este nodo cumple la cláusula «incluidas ecuaciones con coeficientes representados por letras». La mitad de solución numérica de REI.B.3 pertenece al Nivel 1 y a los nodos de ecuaciones de aquí.',
          'Ten węzeł spełnia część „w tym równania o współczynnikach zapisanych literami". Połowa REI.B.3 dotycząca rozwiązań liczbowych należy do Poziomu 1 i do tutejszych węzłów równań.')),
      teks('A.12(E)', '19 TAC §111.39(c)(12)(E)', K.A12E, 'core'),
      teks('A.5(A)', '19 TAC §111.39(c)(5)(A)', K.A5A, 'supporting',
        'The moves are the moves of A.5(A), but the statement being solved carries letters and not numbers, so the claim is supporting rather than core.',
        cav('Los pasos son los pasos de A.5(A), pero el enunciado que se resuelve lleva letras y no números. Por eso la afirmación es de apoyo y no central.',
          'Ruchy są ruchami z A.5(A), ale rozwiązywane zdanie ma litery, a nie liczby. Dlatego twierdzenie jest wspierające, a nie rdzeniowe.')),
    ],
    practices: { 'CCSS-M': ['MP.2', 'MP.7'], TEKS: ['A.1(D)', 'A.1(F)'] },
    alignmentNote: {
      'CCSS-M': 'HSA.CED.A.4 is core and is what the gate tests directly: a formula is handed over and a named quantity has to be brought out on its own. The checker re-derives the rearrangement by pinning every other letter to numbers and solving the original formula from scratch, so a right-looking rearrangement that is false at some value never reaches a learner.',
      TEKS: 'A.12(E) is core — "solve mathematic and scientific formulas, and other literal equations, for a specified variable" is a sentence-for-sentence description of this node, and the formulas used are scientific ones: distance, force, area, volume and the arithmetic sequence term.',
    },
    bkt: { pInit: 0.15, pTransit: 0.25, pSlip: 0.1, pGuess: 0.11 },
    requiredReps: ['symbolic', 'context'],
    misconceptions: [
      { id: 'div-direction', text: 'Divides the wrong way round and writes the reciprocal of the answer.' },
      { id: 'same-op-both', text: 'Multiplies where the formula asks for a division, or subtracts where it asks for a share.' },
      { id: 'divide-not-multiply', text: 'Divides by the number under the bar instead of multiplying by it.' },
      { id: 'partial-rule', text: 'Undoes one wrapper and stops before the last one comes off.' },
      { id: 'sign-on-constant', text: 'Moves a term across the equals sign without changing its sign.' },
      { id: 'partial-distribute', text: 'Divides one term of a sum and leaves the other term untouched.' },
    ],
  },

  // =====================================================================
  {
    id: 'ratio-proportion',
    prereqs: ['fraction-solve'],
    worldSite: 'shoal',
    bigIdea: 'Two ratios agree when one is a whole-number copy of the other. Multiply across the two bars and the fourth number falls out of an ordinary equation.',
    alignment: [
      ccss('CCSS.MATH.CONTENT.7.RP.A.2.C', T.RP7_2C, 'core'),
      ccss('CCSS.MATH.CONTENT.6.RP.A.3', T.RP6_3, 'supporting',
        'Tables of equivalent ratios and equations are tested. Tape diagrams and double number lines are not drawn anywhere in this unit.',
        cav('Se examinan las tablas de razones equivalentes y las ecuaciones. En esta unidad no se dibujan diagramas de barras ni rectas numéricas dobles.',
          'Sprawdzamy tabele równoważnych stosunków i równania. W tej jednostce nie rysujemy diagramów paskowych ani podwójnych osi liczbowych.')),
      teks('6.5(A)', '19 TAC §111.26(b)(5)(A)', K.G6_5A, 'core'),
      teks('A.2(D)', '19 TAC §111.39(c)(2)(D)', K.A2D, 'supporting',
        'The proportional relationship is written and solved, but it is never named as direct variation and the constant is never written as k.',
        cav('La relación proporcional se escribe y se resuelve, pero nunca se nombra como variación directa ni se escribe la constante como k.',
          'Zależność proporcjonalną zapisujemy i rozwiązujemy, ale nigdy nie nazywamy jej proporcjonalnością prostą ani nie zapisujemy stałej jako k.')),
    ],
    practices: { 'CCSS-M': ['MP.2', 'MP.8'], TEKS: ['A.1(A)', 'A.1(E)'] },
    alignmentNote: {
      'CCSS-M': '7.RP.A.2.C is core: every item either represents a proportional relationship as an equation or solves the one it is handed. 6.RP.A.3 is supporting, met through tables of equivalent ratios and through the scale, mixture and rate situations.',
      TEKS: '6.5(A) is core and is claimed on three of its four named tools — scale factors, tables and proportions. Graphs of a proportional relationship belong to slope-rate and graph-linear, which cite the graphing expectations directly rather than borrowing this one.',
    },
    bkt: { pInit: 0.22, pTransit: 0.27, pSlip: 0.08, pGuess: 0.13 },
    requiredReps: ['symbolic', 'table', 'context'],
    misconceptions: [
      { id: 'add-not-multiply', text: 'Adds the difference between the two ratios instead of multiplying by the scale.' },
      { id: 'div-direction', text: 'Turns one of the two ratios upside down before comparing them.' },
      { id: 'swapped-roles', text: 'Writes the two quantities in a different order on the two sides of the statement.' },
      { id: 'partial-rule', text: 'Finds the scale between the ratios and stops before using it.' },
    ],
  },

  // =====================================================================
  {
    id: 'slope-rate',
    prereqs: ['rule-from-table'],
    worldSite: 'shoal',
    bigIdea: 'Rate is the climb divided by the step across. On one straight rule it is the same number wherever you measure it, so any two readings will do.',
    alignment: [
      ccss('CCSS.MATH.CONTENT.8.EE.B.6', T.EE8_6, 'core'),
      ccss('CCSS.MATH.CONTENT.HSF.IF.B.6', T.IF6, 'supporting',
        'Linear only, so the average rate of change over an interval is the rate of the whole rule. Non-linear functions, where the two differ, are not reached.',
        cav('Solo lineal, así que la tasa media de cambio en un intervalo es la tasa de toda la regla. No se llega a las funciones no lineales, donde las dos difieren.',
          'Tylko liniowe, więc średnie tempo zmian na przedziale jest tempem całej reguły. Nie dochodzimy do funkcji nieliniowych, gdzie te dwie wartości się różnią.')),
      teks('A.3(A)', '19 TAC §111.39(c)(3)(A)', K.A3A, 'core'),
      teks('8.4(A)', '19 TAC §111.28(b)(4)(A)', K.G8_4A, 'supporting',
        'The learner uses the fact that the rate is the same between any two points and meets it on tables, points and traces. The similar-triangles argument for why it is the same is not made.',
        cav('El estudiante usa el hecho de que la tasa es la misma entre dos puntos cualesquiera, y lo encuentra en tablas, puntos y trazos. No se hace el argumento de triángulos semejantes que explica por qué.',
          'Uczeń korzysta z faktu, że tempo jest takie samo między dowolnymi dwoma punktami, i spotyka je w tabelach, punktach i śladach. Nie prowadzimy dowodu z trójkątów podobnych.')),
    ],
    practices: { 'CCSS-M': ['MP.7', 'MP.8'], TEKS: ['A.1(D)', 'A.1(F)'] },
    alignmentNote: {
      'CCSS-M': '8.EE.B.6 is core in its first half: the rate is the same between any two distinct points, and the gate proves it by asking for the same rate off points, off a table and off a drawn trace. Deriving y = mx + b from it is the next node.',
      TEKS: 'A.3(A) is core and is claimed on three of the four sources it names — a table of values, a graph, and two points on the line. The fourth, reading the slope off an equation written in various forms, belongs to graph-linear and write-linear.',
    },
    bkt: { pInit: 0.2, pTransit: 0.26, pSlip: 0.09, pGuess: 0.12 },
    requiredReps: ['table', 'graph', 'context'],
    misconceptions: [
      { id: 'run-over-rise', text: 'Divides the step across by the climb, so the rate comes out upside down.' },
      { id: 'add-not-subtract', text: 'Adds the two readings instead of taking one from the other.' },
      { id: 'slope-intercept-swap', text: 'Reports where the trace starts instead of how fast it climbs.' },
      { id: 'axis-swap', text: 'Reads a value off the wrong axis.' },
      { id: 'partial-rule', text: 'Finds the climb and stops before dividing by the step across.' },
    ],
  },

  // =====================================================================
  {
    id: 'graph-linear',
    prereqs: ['slope-rate'],
    worldSite: 'shoal',
    bigIdea: 'A straight rule and a straight trace are the same thing said twice. The rate is how steeply it climbs, and the start is where it crosses the upright axis.',
    alignment: [
      ccss('CCSS.MATH.CONTENT.HSF.IF.C.7.A', T.IF7A, 'core'),
      ccss('CCSS.MATH.CONTENT.HSA.REI.D.10', T.REI10, 'supporting',
        'Lines only. The learner never plots a curve, so the general statement about equations in two variables is met in its linear case alone.',
        cav('Solo rectas. El estudiante nunca traza una curva, así que el enunciado general sobre ecuaciones en dos variables se cumple solo en su caso lineal.',
          'Tylko proste. Uczeń nigdy nie rysuje krzywej, więc ogólne twierdzenie o równaniach dwóch zmiennych jest spełnione tylko w przypadku liniowym.')),
      teks('A.3(C)', '19 TAC §111.39(c)(3)(C)', K.A3C, 'core'),
      teks('8.5(B)', '19 TAC §111.28(b)(5)(B)', K.G8_5B, 'supporting',
        'Tables and graphs are both used and the rule is read in y = mx + b form. Writing that equation down is write-linear, which claims the expectation as core.',
        cav('Se usan tablas y gráficas, y la regla se lee en la forma y = mx + b. Escribir esa ecuación corresponde a write-linear, que reclama la expectativa como central.',
          'Używamy tabel i wykresów, a regułę czytamy w postaci y = mx + b. Zapisanie tego równania należy do write-linear, który twierdzi to oczekiwanie jako rdzeniowe.')),
    ],
    practices: { 'CCSS-M': ['MP.4', 'MP.5'], TEKS: ['A.1(C)', 'A.1(E)'] },
    alignmentNote: {
      'CCSS-M': 'HSF.IF.C.7.A is core in its linear half and is tested on a working coordinate surface: the learner drags the trace onto the grid and the rig accepts it only when the line it drew is the line the readings describe. Reading a value off a trace, and finding where a trace reaches a level, cover the intercept clause.',
      TEKS: 'A.3(C) is core. Three of its four named key features are tested — the y-intercept, the slope, and the x-intercept, which is asked as "where does the trace reach this level". Zeros are the x-intercept under another name and are not asked separately.',
    },
    bkt: { pInit: 0.18, pTransit: 0.26, pSlip: 0.09, pGuess: 0.11 },
    requiredReps: ['graph', 'table', 'context'],
    misconceptions: [
      { id: 'slope-intercept-swap', text: 'Uses the starting height as the rate, or the rate as the starting height.' },
      { id: 'axis-swap', text: 'Reads a value off the wrong axis.' },
      { id: 'partial-rule', text: 'Draws a trace with the right rate through the wrong starting height.' },
      { id: 'sign-slip', text: 'Draws the trace climbing where it should fall.' },
      { id: 'div-direction', text: 'Divides the wrong way round when stepping back to the axis.' },
    ],
  },

  // =====================================================================
  {
    id: 'write-linear',
    prereqs: ['slope-rate', 'rule-from-table'],
    worldSite: 'shoal',
    bigIdea: 'Two readings are enough to write a rule down. The rate comes from the climb, and the start comes from stepping back to the upright axis.',
    alignment: [
      ccss('CCSS.MATH.CONTENT.8.F.B.4', T.F8_4, 'core'),
      ccss('CCSS.MATH.CONTENT.HSF.LE.A.2', T.LE2, 'supporting',
        'Linear only. Nothing in this unit constructs an exponential function or a geometric sequence.',
        cav('Solo lineal. Nada en esta unidad construye una función exponencial ni una sucesión geométrica.',
          'Tylko liniowe. Nic w tej jednostce nie buduje funkcji wykładniczej ani ciągu geometrycznego.')),
      teks('A.2(C)', '19 TAC §111.39(c)(2)(C)', K.A2C, 'core'),
      teks('A.2(B)', '19 TAC §111.39(c)(2)(B)', K.A2B, 'supporting',
        'The two-points case is core here, but only the y = mx + b form is written. The standard form and the point-slope form are not produced.',
        cav('El caso de dos puntos es central aquí, pero solo se escribe la forma y = mx + b. No se producen la forma general ni la forma punto-pendiente.',
          'Przypadek dwóch punktów jest tu rdzeniowy, ale zapisujemy tylko postać y = mx + b. Postaci ogólnej i kierunkowej z punktem nie tworzymy.')),
    ],
    practices: { 'CCSS-M': ['MP.4', 'MP.7'], TEKS: ['A.1(D)', 'A.1(E)'] },
    alignmentNote: {
      'CCSS-M': '8.F.B.4 is core and is met in full: the rate of change and the initial value are both determined, from a description, from two values, from a table and from a graph, and the situations ask the learner to interpret them. rule-from-table claimed the same expectation for reading a rule; this node claims it for writing one down.',
      TEKS: 'A.2(C) moves from supporting at rule-from-table to core here, because the learner now produces the equation rather than using it. All three sources the expectation names are tested: a table of values, a graph, and a verbal description.',
    },
    bkt: { pInit: 0.16, pTransit: 0.25, pSlip: 0.09, pGuess: 0.11 },
    requiredReps: ['table', 'graph', 'context'],
    misconceptions: [
      { id: 'slope-intercept-swap', text: 'Writes the starting height where the rate belongs, and the rate where the starting height belongs.' },
      { id: 'sign-on-constant', text: 'Writes the starting height with the wrong sign.' },
      { id: 'sign-slip', text: 'Writes the rate with the wrong sign, so the rule falls where it climbs.' },
      { id: 'partial-rule', text: 'Writes the rate and leaves the starting height out altogether.' },
    ],
  },

  // =====================================================================
  {
    id: 'system-substitution',
    prereqs: ['write-linear', 'both-sides'],
    worldSite: 'spire',
    bigIdea: 'Two statements pin a point down. When one of them already says what a letter is, put that straight into the other and only one letter is left.',
    alignment: [
      ccss('CCSS.MATH.CONTENT.HSA.REI.C.6', T.REI6, 'core'),
      ccss('CCSS.MATH.CONTENT.8.EE.C.8.B', T.EE8_8B, 'supporting',
        'Solved algebraically and read off a drawn pair of traces. Estimating a solution by graphing is not asked, because every pair here meets at whole numbers.',
        cav('Se resuelve algebraicamente y se lee sobre un par de trazos dibujados. No se pide estimar la solución gráficamente, porque todos los pares aquí se cortan en números enteros.',
          'Rozwiązujemy algebraicznie i odczytujemy z pary narysowanych śladów. Nie prosimy o szacowanie rozwiązania z wykresu, bo każda para przecina się w liczbach całkowitych.')),
      teks('A.5(C)', '19 TAC §111.39(c)(5)(C)', K.A5C, 'core'),
      teks('8.9(A)', '19 TAC §111.28(b)(9)(A)', K.G8_9A, 'supporting',
        'Verifying a pair against both statements is tested directly. Reading the pair off an intersection on a drawn graph is offered but is not what the gate proves.',
        cav('Verificar un par contra los dos enunciados sí se examina directamente. Leer el par en la intersección de una gráfica se ofrece, pero no es lo que demuestra el sello.',
          'Sprawdzanie pary względem obu zdań jest badane wprost. Odczyt pary z przecięcia na wykresie jest dostępny, ale nie to potwierdza próba biegłości.')),
    ],
    practices: { 'CCSS-M': ['MP.1', 'MP.7'], TEKS: ['A.1(B)', 'A.1(F)'] },
    alignmentNote: {
      'CCSS-M': 'HSA.REI.C.6 is core for the substitution method. The checker reads both statements back off the screen, extracts their coefficients by probing them, and solves the pair by determinant — so no item can be right about a pair the learner is not looking at.',
      TEKS: 'A.5(C) is core. Both halves of the expectation are met: mathematical problems in the symbolic forms, and real-world problems in the manifest and ledger situations, where the two totals are the two statements.',
    },
    bkt: { pInit: 0.14, pTransit: 0.24, pSlip: 0.1, pGuess: 0.1 },
    requiredReps: ['symbolic', 'context', 'verbal'],
    misconceptions: [
      { id: 'axis-swap', text: 'Reports the value of the other letter.' },
      { id: 'partial-rule', text: 'Finds the first letter and stops before putting it back to find the second.' },
      { id: 'sign-slip', text: 'Loses a sign while putting one statement into the other.' },
    ],
  },

  // =====================================================================
  {
    id: 'system-elimination',
    prereqs: ['system-substitution'],
    worldSite: 'spire',
    bigIdea: 'Add two true statements and the result is true as well. Line one letter up so its two terms are opposite, add, and that letter leaves.',
    alignment: [
      ccss('CCSS.MATH.CONTENT.HSA.REI.C.5', T.REI5, 'core'),
      ccss('CCSS.MATH.CONTENT.HSA.REI.C.6', T.REI6, 'core'),
      ccss('CCSS.MATH.CONTENT.8.EE.C.8.C', T.EE8_8C, 'supporting',
        'The situations lead to two linear equations in two variables and are solved. The expectation also expects the learner to write the pair from scratch, which system-substitution and write-linear cover.',
        cav('Las situaciones llevan a dos ecuaciones lineales con dos variables y se resuelven. La expectativa también espera que el estudiante escriba el par desde cero, algo que cubren system-substitution y write-linear.',
          'Sytuacje prowadzą do dwóch równań liniowych z dwiema niewiadomymi i są rozwiązywane. Oczekiwanie zakłada też samodzielne zapisanie pary, co pokrywają system-substitution i write-linear.')),
      teks('A.5(C)', '19 TAC §111.39(c)(5)(C)', K.A5C, 'core'),
      teks('A.3(F)', '19 TAC §111.39(c)(3)(F)', K.A3F, 'supporting',
        'The solution of a pair is determined and is the point where two traces would meet. This node does not ask the learner to draw the two traces first.',
        cav('Se determina la solución del par, que es el punto donde se cortarían los dos trazos. Este nodo no pide dibujar antes los dos trazos.',
          'Wyznaczamy rozwiązanie pary, czyli punkt przecięcia dwóch śladów. Ten węzeł nie każe wcześniej rysować obu śladów.')),
    ],
    practices: { 'CCSS-M': ['MP.3', 'MP.8'], TEKS: ['A.1(F)', 'A.1(G)'] },
    alignmentNote: {
      'CCSS-M': 'HSA.REI.C.5 is core and is the whole idea of this node: replacing one statement by a multiple of itself added to the other leaves the same solution. The scaled form makes the multiple explicit. HSA.REI.C.6 is core for the elimination method.',
      TEKS: 'A.5(C) is core for the second time in the course, because TEKS names the method-free outcome and this node reaches it by a different route from system-substitution. A learner who clears both has met A.5(C) by substitution and by elimination.',
    },
    bkt: { pInit: 0.13, pTransit: 0.24, pSlip: 0.1, pGuess: 0.1 },
    requiredReps: ['symbolic', 'context'],
    misconceptions: [
      { id: 'subtract-not-add', text: 'Takes one statement from the other when the two terms are already opposite.' },
      { id: 'axis-swap', text: 'Reports the value of the other letter.' },
      { id: 'partial-rule', text: 'Scales one statement and forgets to scale the number on the right of it.' },
      { id: 'sign-slip', text: 'Loses a sign while adding the two statements.' },
    ],
  },
];

const graph = {
  id: 'algebra1-level2',
  course: 'algebra1',
  unit: 'algebra1-l2',
  titleKey: 'unit.algebra1-l2.title',
  title: 'Algebra I — Level 2: Lean, Rate and Pair',
  description: 'Fourteen lines beyond the first shard. Level 1 ends with a balance that stays level; Level 2 is what happens when it leans, when a formula has to give up a different letter, when a rule is drawn as a trace, and when one statement is no longer enough to pin a point down. Inequalities in one variable from one step to a compound band, literal equations, ratio and proportion, rate of change, graphing and writing linear rules, and systems by substitution and by elimination.',
  schema: 'unified-alignment-1',
  requires: ['algebra1-l1'],
  masteryThreshold: old.masteryThreshold,
  mastery: old.mastery,
  commonMisconceptions: [
    { id: 'arith-slip', text: 'Right method, wrong arithmetic — a slip rather than a misconception.' },
    { id: 'sign-slip', text: 'Loses or invents a minus sign somewhere in the chain.' },
    { id: 'partial-rule', text: 'Applies part of the rule and stops before finishing it.' },
    { id: 'off-by-one-row', text: 'Reads the neighbouring row of a table instead of the one asked for.' },
    { id: 'axis-swap', text: 'Reads or reports a value from the wrong axis, or the wrong letter of a pair.' },
    { id: 'boundary-slip', text: 'Includes the boundary value in a strict inequality, or excludes it from a closed one.' },
  ],
  nodes,
};

await writeFile(`${ROOT}/content/graph/algebra1-l2.json`, `${JSON.stringify(graph, null, 2)}\n`);
console.log(`wrote ${nodes.length} nodes`);
