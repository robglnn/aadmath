#!/usr/bin/env python3
"""Build content/graph/algebra1-l3.json.

Every `text` field below is the standard quoted word for word from the sources
named in the graph's own `verification` block. Nothing here is paraphrased and
nothing is invented; where a claim is partial the entry carries a caveat that
says which part is missing, in three languages.
"""
import json, collections

# --------------------------------------------------------------------------
# The standards, quoted. One place, so a code cannot be quoted two ways.
# --------------------------------------------------------------------------
CCSS = {
  'HSF.IF.A.1': "Understand that a function from one set (called the domain) to another set (called the range) assigns to each element of the domain exactly one element of the range. If f is a function and x is an element of its domain, then f(x) denotes the output of f corresponding to the input x. The graph of f is the graph of the equation y = f(x).",
  'HSF.IF.A.2': "Use function notation, evaluate functions for inputs in their domains, and interpret statements that use function notation in terms of a context.",
  'HSF.IF.B.5': "Relate the domain of a function to its graph and, where applicable, to the quantitative relationship it describes.",
  'HSF.LE.A.1.A': "Prove that linear functions grow by equal differences over equal intervals, and that exponential functions grow by equal factors over equal intervals.",
  'HSF.LE.A.1.B': "Recognize situations in which one quantity changes at a constant rate per unit interval relative to another.",
  'HSF.LE.A.1.C': "Recognize situations in which a quantity grows or decays by a constant percent rate per unit interval relative to another.",
  'HSA.APR.A.1': "Understand that polynomials form a system analogous to the integers, namely, they are closed under the operations of addition, subtraction, and multiplication; add, subtract, and multiply polynomials.",
  'HSA.SSE.A.1.A': "Interpret parts of an expression, such as terms, factors, and coefficients.",
  'HSA.SSE.A.1.B': "Interpret complicated expressions by viewing one or more of their parts as a single entity.",
  'HSA.SSE.A.2': "Use the structure of an expression to identify ways to rewrite it.",
  '8.EE.A.1': "Know and apply the properties of integer exponents to generate equivalent numerical expressions.",
  '6.EE.A.1': "Write and evaluate numerical expressions involving whole-number exponents.",
}
def ccss(code): return 'CCSS.MATH.CONTENT.' + code

TEKS = {
  'A.2(A)':  ("19 TAC §111.39(c)(2)(A)",  "determine the domain and range of a linear function in mathematical problems; determine reasonable domain and range values for real-world situations, both continuous and discrete; and represent domain and range using inequalities;"),
  'A.3(B)':  ("19 TAC §111.39(c)(3)(B)",  "calculate the rate of change of a linear function represented tabularly, graphically, or algebraically in context of mathematical and real-world problems;"),
  'A.9(B)':  ("19 TAC §111.39(c)(9)(B)",  "interpret the meaning of the values of a and b in exponential functions of the form f(x) = ab^x in real-world problems;"),
  'A.10(A)': ("19 TAC §111.39(c)(10)(A)", "add and subtract polynomials of degree one and degree two;"),
  'A.10(B)': ("19 TAC §111.39(c)(10)(B)", "multiply polynomials of degree one and degree two;"),
  'A.10(D)': ("19 TAC §111.39(c)(10)(D)", "rewrite polynomial expressions of degree one and degree two in equivalent forms using the distributive property;"),
  'A.11(B)': ("19 TAC §111.39(c)(11)(B)", "simplify numeric and algebraic expressions using the laws of exponents, including integral and rational exponents."),
  'A.12(B)': ("19 TAC §111.39(c)(12)(B)", "evaluate functions, expressed in function notation, given one or more elements in their domains;"),
  '6.7(A)':  ("19 TAC §111.26(b)(7)(A)",  "generate equivalent numerical expressions using order of operations, including whole number exponents and prime factorization;"),
}

# --------------------------------------------------------------------------
# Caveats. Written once, translated once, cited wherever the same part of the
# same standard is left untested — so two nodes cannot describe one gap two
# different ways.
# --------------------------------------------------------------------------
CAVEATS = {
  'rational-exponents': (
    "The laws are applied to whole-number and negative whole-number counts throughout. The rational-exponent half of this expectation is not taught in this unit and is not claimed.",
    "Las leyes se aplican solo a exponentes enteros, positivos y negativos. La mitad de exponentes racionales de esta expectativa no se enseña en esta unidad y no se afirma.",
    "Prawa stosujemy tylko do wykładników całkowitych, dodatnich i ujemnych. Połowa dotycząca wykładników wymiernych nie jest tu nauczana i nie jest twierdzona.",
  ),
  'algebraic-not-numeric': (
    "This node rewrites expressions whose base is a letter. The expectation names numerical expressions, and that half is carried by the zero-and-negative-count node, whose numeric form works out an exact value.",
    "Este nodo reescribe expresiones cuya base es una letra. La expectativa nombra expresiones numéricas, y esa mitad la lleva el nodo de exponente cero y negativo, cuya forma numérica halla un valor exacto.",
    "Ten węzeł przekształca wyrażenia, których podstawą jest litera. Oczekiwanie mówi o wyrażeniach liczbowych, a tę połowę niesie węzeł wykładnika zerowego i ujemnego, którego forma liczbowa podaje dokładną wartość.",
  ),
  'structure-narrow': (
    "The structure used here is a product, a quotient or a common factor. The full expectation also covers structures this unit never reaches, including the difference of two squares and the quadratic trinomial.",
    "La estructura que se usa aquí es un producto, un cociente o un factor común. La expectativa completa cubre también estructuras a las que esta unidad no llega, como la diferencia de cuadrados y el trinomio cuadrático.",
    "Używana tu struktura to iloczyn, iloraz albo wspólny czynnik. Pełne oczekiwanie obejmuje także struktury, do których ta jednostka nie dochodzi, w tym różnicę kwadratów i trójmian kwadratowy.",
  ),
  'apr-multiply-elsewhere': (
    "Addition and subtraction are what the gate tests here. The multiplication half of this standard, and the closure argument the standard opens with, belong to the multiply-a-binomial node.",
    "Aquí la puerta evalúa la suma y la resta. La mitad de multiplicación de este estándar, y el argumento de cierre con el que empieza, pertenecen al nodo de multiplicar binomios.",
    "Tutaj brama sprawdza dodawanie i odejmowanie. Połowa tego standardu dotycząca mnożenia oraz otwierający go argument o zamkniętości należą do węzła mnożenia dwumianów.",
  ),
  'apr-addsub-elsewhere': (
    "Multiplication is what the gate tests here. The addition and subtraction half of this standard belongs to the join-two-polynomials node, and the closure argument is stated in neither.",
    "Aquí la puerta evalúa la multiplicación. La mitad de suma y resta de este estándar pertenece al nodo de unir dos polinomios, y el argumento de cierre no se enuncia en ninguno.",
    "Tutaj brama sprawdza mnożenie. Połowa tego standardu dotycząca dodawania i odejmowania należy do węzła łączenia dwóch wielomianów, a argumentu o zamkniętości nie formułuje żaden z nich.",
  ),
  'parts-terms-only': (
    "The parts a learner has to read here are terms and coefficients. Reading an expression's factors is the factoring node's job, and interpreting a part of a context is not asked for.",
    "Las partes que hay que leer aquí son términos y coeficientes. Leer los factores de una expresión es tarea del nodo de factorizar, y no se pide interpretar una parte dentro de un contexto.",
    "Częściami, które trzeba tu odczytać, są wyrazy i współczynniki. Odczytanie czynników wyrażenia to zadanie węzła wyłączania, a interpretowania części w kontekście nie wymagamy.",
  ),
  'single-entity-bracket': (
    "A bracket has to be read as one quantity before it is opened or squared. The full expectation also covers non-polynomial structure, which this unit does not reach.",
    "Hay que leer un paréntesis como una sola cantidad antes de abrirlo o elevarlo al cuadrado. La expectativa completa cubre también estructuras no polinómicas, a las que esta unidad no llega.",
    "Nawias trzeba odczytać jako jedną wielkość, zanim się go otworzy lub podniesie do kwadratu. Pełne oczekiwanie obejmuje także struktury niewielomianowe, do których ta jednostka nie dochodzi.",
  ),
  'notation-half-only': (
    "What this node meets is the notation clause: f is a name, x is an element of its domain, and f(x) is the output. The unit never asks a learner to decide whether a relation assigns exactly one output to each input, because the independent checker cannot re-derive that judgement. See the unit's declared gaps.",
    "Lo que cumple este nodo es la cláusula de notación: f es un nombre, x es un elemento de su dominio y f(x) es la salida. La unidad nunca pide decidir si una relación asigna exactamente una salida a cada entrada, porque el verificador independiente no puede rederivar ese juicio. Véanse los huecos declarados de la unidad.",
    "Ten węzeł spełnia część dotyczącą zapisu: f to nazwa, x to element dziedziny, a f(x) to wyjście. Jednostka nigdy nie każe rozstrzygać, czy relacja przypisuje każdemu wejściu dokładnie jedno wyjście, bo niezależny weryfikator nie potrafi tego wyprowadzić. Zobacz zadeklarowane luki jednostki.",
  ),
  'domain-no-graph': (
    "The domain is related to the quantitative relationship it describes: a listed run of whole inputs, and the outputs the rule gives at its ends. It is NOT related to a graph, because this unit draws none.",
    "El dominio se relaciona con la relación cuantitativa que describe: una lista de entradas enteras y las salidas que la regla da en sus extremos. NO se relaciona con una gráfica, porque esta unidad no dibuja ninguna.",
    "Dziedzinę wiążemy z opisywaną zależnością liczbową: wypisanym ciągiem całkowitych wejść i wyjściami, które reguła daje na jego końcach. NIE wiążemy jej z wykresem, bo ta jednostka żadnego nie rysuje.",
  ),
  'domain-discrete-no-inequalities': (
    "Only the first clause is met, and only for a discrete domain: the domain is a listed run of whole numbers and the learner works out the output at an end of it. This unit does NOT represent domain or range using inequalities, and does not treat a continuous domain.",
    "Solo se cumple la primera cláusula, y solo para un dominio discreto: el dominio es una lista de números enteros y el estudiante halla la salida en uno de sus extremos. Esta unidad NO representa el dominio ni el rango con desigualdades, y no trata un dominio continuo.",
    "Spełniona jest tylko pierwsza część i tylko dla dziedziny dyskretnej: dziedzina to wypisany ciąg liczb całkowitych, a uczeń liczy wyjście na jednym z jego końców. Ta jednostka NIE zapisuje dziedziny ani zbioru wartości nierównościami i nie zajmuje się dziedziną ciągłą.",
  ),
  'le-computed-not-proved': (
    "The learner produces both numbers the standard names — the common difference off a difference of two readings, and the common factor off a quotient of two readings — and watches the factor overtake the difference. The learner is not asked to prove the general statement, so the claim is supporting.",
    "El estudiante produce los dos números que nombra el estándar: la diferencia común a partir de la resta de dos lecturas, y el factor común a partir del cociente de dos lecturas, y ve cómo el factor supera a la diferencia. No se le pide demostrar el enunciado general, así que la afirmación es de apoyo.",
    "Uczeń wyznacza obie liczby, które wymienia standard: wspólną różnicę z różnicy dwóch odczytów i wspólny czynnik z ilorazu dwóch odczytów, i widzi, jak czynnik wyprzedza różnicę. Nie prosimy o dowód ogólnego twierdzenia, więc twierdzenie jest wspierające.",
  ),
  'le-no-percent': (
    "Growth and decay by a constant FACTOR are taught and tested, including decay by a unit fraction. A constant PERCENT rate is never stated as a percent anywhere in this unit, so this expectation is only introduced.",
    "El crecimiento y el decaimiento por un FACTOR constante se enseñan y se evalúan, incluido el decaimiento por una fracción unitaria. En esta unidad nunca se enuncia una tasa PORCENTUAL constante, así que esta expectativa solo se introduce.",
    "Wzrost i zanik o stały CZYNNIK są nauczane i sprawdzane, w tym zanik o ułamek jednostkowy. Stałego tempa PROCENTOWEGO ta jednostka nigdzie nie podaje w procentach, więc to oczekiwanie jest tylko wprowadzone.",
  ),
  'le-constant-rate': (
    "The constant-rate half is met by the steady-log table and by the difference form, where the learner produces the amount added at every step. The situations are the unit's own, and the learner recognises the constant rate inside them rather than choosing between candidate situations.",
    "La mitad de tasa constante la cumplen la tabla de registro regular y la forma de resta, donde el estudiante produce la cantidad que se suma en cada paso. Las situaciones son propias de la unidad, y el estudiante reconoce en ellas la tasa constante en vez de elegir entre situaciones candidatas.",
    "Część o stałym tempie spełniają tabela równego dziennika i forma różnicy, gdzie uczeń wyznacza wielkość dodawaną na każdym kroku. Sytuacje są własne dla jednostki, a uczeń rozpoznaje w nich stałe tempo, zamiast wybierać spośród podanych sytuacji.",
  ),
  'rate-linear-only': (
    "The rate is calculated tabularly and algebraically, from a steady log and from a difference of two readings. It is not calculated graphically, because this unit draws no graph; that half is held by the slope-and-rate node of Level 2.",
    "La tasa se calcula en tabla y de forma algebraica, a partir de un registro regular y de la resta de dos lecturas. No se calcula gráficamente, porque esta unidad no dibuja gráficas; esa mitad la tiene el nodo de pendiente y tasa del Nivel 2.",
    "Tempo liczymy tabelarycznie i algebraicznie, z równego dziennika i z różnicy dwóch odczytów. Nie liczymy go graficznie, bo ta jednostka nie rysuje wykresów; tę połowę trzyma węzeł nachylenia i tempa z Poziomu 2.",
  ),
  'ab-values-read-not-explained': (
    "The learner produces the value of a, by reading the rule at zero, and the value of b, by dividing one reading by the one before it. The learner is not asked to write a sentence explaining what either value means in the situation, so the claim is supporting rather than core.",
    "El estudiante produce el valor de a, leyendo la regla en cero, y el valor de b, dividiendo una lectura por la anterior. No se le pide escribir una frase que explique qué significa cada valor en la situación, así que la afirmación es de apoyo y no central.",
    "Uczeń wyznacza wartość a, odczytując regułę w zerze, oraz wartość b, dzieląc jeden odczyt przez poprzedni. Nie prosimy go o zdanie wyjaśniające, co każda z tych wartości znaczy w sytuacji, więc twierdzenie jest wspierające, a nie rdzeniowe.",
  ),
  'interpret-in-context': (
    "Using the notation and evaluating at an element of the domain are core and are what the gate tests. Interpreting a statement in function notation in terms of a context is met only by the situation forms, where the rule is named by a machine and read at one setting.",
    "Usar la notación y evaluar en un elemento del dominio son centrales y es lo que evalúa la puerta. Interpretar un enunciado en notación de función dentro de un contexto solo lo cumplen las formas con situación, donde una máquina nombra la regla y se lee en un ajuste.",
    "Użycie zapisu i obliczenie wartości w elemencie dziedziny są rdzeniowe i to sprawdza brama. Interpretację zapisu funkcyjnego w kontekście spełniają tylko formy z sytuacją, gdzie regułę nazywa maszyna i odczytuje się ją przy jednym ustawieniu.",
  ),
  'whole-number-exponents': (
    "Whole-number counts are written and evaluated. Prime factorization, which this expectation also names, is not taught in this unit and is not claimed.",
    "Se escriben y se evalúan exponentes enteros no negativos. La factorización en primos, que esta expectativa también nombra, no se enseña en esta unidad y no se afirma.",
    "Zapisujemy i obliczamy wykładniki całkowite nieujemne. Rozkładu na czynniki pierwsze, który to oczekiwanie także wymienia, nie nauczamy i nie twierdzimy.",
  ),
}

def cav(key):
    en, es, pl = CAVEATS[key]
    return en, {"es": {"caveat": es}, "pl": {"caveat": pl}}

def C(code, depth, caveat=None):
    row = {"framework": "CCSS-M", "code": ccss(code), "text": CCSS[code], "depth": depth}
    if caveat:
        en, i18n = cav(caveat)
        row["caveat"] = en
        row["i18n"] = i18n
    return row

def T(code, depth, caveat=None):
    citation, text = TEKS[code]
    row = {"framework": "TEKS", "code": code, "citation": citation, "text": text, "depth": depth}
    if caveat:
        en, i18n = cav(caveat)
        row["caveat"] = en
        row["i18n"] = i18n
    return row

MIS = {
  'arith-slip': "Right method, wrong arithmetic — a slip rather than a misconception.",
  'sign-slip': "Loses or invents a minus sign somewhere in the chain.",
  'partial-rule': "Applies part of the rule and stops before finishing it.",
  'off-by-one-row': "Reads the neighbouring row of a table instead of the one asked for.",
  'input-output-swap': "Answers with the input when the question asked for the output.",
  'exponents-multiplied': "Multiplies the two counts where multiplying the powers adds them.",
  'exponents-added': "Adds the two counts where raising a power to a power multiplies them.",
  'exponents-subtracted-wrong-way': "Takes the top count from the bottom one, and turns the answer upside down.",
  'coefficients-added': "Adds the numbers in front where the rule multiplies them.",
  'coefficient-not-raised': "Raises the letter to the count and leaves the number in front alone.",
  'base-times-exponent': "Multiplies the base by the count instead of using the count to repeat it.",
  'bases-multiplied': "Multiplies the bases together as well as handling the counts.",
  'zero-power-is-zero': "Reads a count of zero as an answer of zero.",
  'negative-power-is-negative': "Reads a negative count as a negative answer.",
  'negative-power-is-reciprocal-slip': "Leaves a negative count above the bar, or moves a positive one below it.",
  'combine-unlike': "Merges terms whose counts do not match.",
  'minus-first-term-only': "Lets a minus in front of a bracket reach only the first term inside it.",
  'partial-distribute': "Multiplies only the first term in the bracket.",
  'middle-term-missed': "Multiplies the ends of the two brackets and misses the middle terms.",
  'swapped-roles': "Swaps which quantity is which — the sum for the product, or the count for the base.",
  'factor-partial': "Pulls out part of the common factor and leaves the rest inside.",
  'factor-drops-term': "Divides one term by the common factor and leaves another undivided.",
  'growth-is-linear': "Adds the factor at each step instead of multiplying by it.",
  'growth-start-for-factor': "Answers with the starting amount when the question asked for the factor.",
  'range-ends-swapped': "Reads the output at the wrong end of the run of inputs.",
  'wrong-unwrap-order': "Works the rule in the order it was written rather than in the order it binds.",
  'same-op-both': "Applies the same operation instead of the inverse.",
  'sign-on-constant': "Moves a term across the equals sign without changing its sign.",
}
def mis(*ids):
    return [{"id": i, "text": MIS[i]} for i in ids]

COMMON = ['arith-slip', 'sign-slip', 'partial-rule', 'off-by-one-row', 'input-output-swap']

NODES = []
def node(**kw): NODES.append(kw)

# ---------------------------------------------------------------- 1
node(
  id="function-notation",
  prereqs=["eval-expr", "write-linear"],
  worldSite="spire",
  bigIdea="A rule can be given a name. Then f(3) is not f times 3 — it is the one output the rule gives when 3 goes in.",
  alignment=[
    C('HSF.IF.A.2', 'core', 'interpret-in-context'),
    C('HSF.IF.A.1', 'supporting', 'notation-half-only'),
    T('A.12(B)', 'core'),
  ],
  practices={"CCSS-M": ["MP.2", "MP.6"], "TEKS": ["A.1(A)", "A.1(D)"]},
  alignmentNote={
    "CCSS-M": "HSF.IF.A.2 is core and is what the gate tests directly: the rule is printed with its name on it, and the learner returns the output at a named element of the domain. The checker reads the rule off the printed statement and evaluates it from scratch in exact rational arithmetic, so the name is typography and nothing is verified through it. HSF.IF.A.1 is claimed only for its notation clause, and the caveat says which clause is left alone.",
    "TEKS": "A.12(B) — \"evaluate functions, expressed in function notation, given one or more elements in their domains\" — is a sentence-for-sentence description of this node. Level 1 cites the same expectation as INTRODUCED and says plainly that the f(x) wrapper is absent there. This is the node that completes it, and the depth rises to core for that reason.",
  },
  bkt={"pInit": 0.18, "pTransit": 0.26, "pSlip": 0.09, "pGuess": 0.11},
  requiredReps=["symbolic", "table", "context"],
  misconceptions=mis('base-times-exponent', 'wrong-unwrap-order', 'input-output-swap', 'same-op-both', 'sign-on-constant', 'coefficient-not-raised', 'off-by-one-row', 'partial-rule', 'sign-slip', 'arith-slip'),
)

# ---------------------------------------------------------------- 2
node(
  id="domain-range",
  prereqs=["function-notation", "graph-linear"],
  worldSite="shoal",
  bigIdea="A rule does not accept every number, and it does not give every number. The inputs it takes are its domain, and the outputs it gives are its range.",
  alignment=[
    C('HSF.IF.B.5', 'supporting', 'domain-no-graph'),
    C('HSF.IF.A.1', 'supporting', 'notation-half-only'),
    T('A.2(A)', 'supporting', 'domain-discrete-no-inequalities'),
  ],
  practices={"CCSS-M": ["MP.2", "MP.4", "MP.6"], "TEKS": ["A.1(A)", "A.1(B)", "A.1(D)"]},
  alignmentNote={
    "CCSS-M": "NOTHING HERE IS CLAIMED AT CORE, and that is deliberate. The independent checker can re-derive an output at an input; it has no way to re-derive a claim about a SET, so this node never asks which set the range is. What it asks is which output the rule gives at an end of a listed run of whole inputs — and before an item ships, its own draw works the rule at every input in that run and refuses to serve unless the named end really is the extreme. The domain is four to seven whole numbers, so that check is exhaustive rather than an argument.",
    "TEKS": "A.2(A) is claimed as SUPPORTING for its first clause only, and the caveat names the two clauses that are not met: this unit never represents domain or range using inequalities, and never treats a continuous domain. Level 2's compound-inequality node is where a band written with inequalities lives; joining that notation to a domain is a later unit's work, and pretending otherwise is exactly the kind of row that makes a vendor alignment sheet stop being true.",
  },
  bkt={"pInit": 0.16, "pTransit": 0.25, "pSlip": 0.1, "pGuess": 0.11},
  requiredReps=["symbolic", "table", "context"],
  misconceptions=mis('range-ends-swapped', 'input-output-swap', 'off-by-one-row', 'base-times-exponent', 'partial-rule', 'sign-slip', 'arith-slip'),
)

# ---------------------------------------------------------------- 3
node(
  id="exponent-product",
  prereqs=["order-ops", "literal-equations"],
  worldSite="quarry",
  bigIdea="A count above a letter says how many factors there are. Multiplying two powers of one letter puts the two lots of factors side by side, so the counts add.",
  alignment=[
    C('8.EE.A.1', 'supporting', 'algebraic-not-numeric'),
    C('HSA.SSE.A.2', 'supporting', 'structure-narrow'),
    C('6.EE.A.1', 'supporting', 'whole-number-exponents'),
    T('A.11(B)', 'core', 'rational-exponents'),
  ],
  practices={"CCSS-M": ["MP.7", "MP.8"], "TEKS": ["A.1(D)", "A.1(F)", "A.1(G)"]},
  alignmentNote={
    "CCSS-M": "8.EE.A.1 is the home of the exponent laws in Common Core, and it says NUMERICAL expressions; this node's bases are letters, so it is claimed as supporting and the numerical half is carried by the zero-and-negative-count node, whose numeric form works out an exact value. HSA.SSE.A.2 is claimed narrowly: the structure a learner uses here is a product of powers, and nothing wider.",
    "TEKS": "A.11(B) is the Algebra I home of this node and is claimed at core — \"simplify numeric and algebraic expressions using the laws of exponents\" is what every item does. The expectation goes on to say \"including integral and rational exponents\", and the rational half is not taught in this unit. The caveat says so rather than letting the code carry a claim the gate does not test.",
  },
  bkt={"pInit": 0.14, "pTransit": 0.27, "pSlip": 0.09, "pGuess": 0.12},
  requiredReps=["symbolic", "context"],
  misconceptions=mis('exponents-multiplied', 'exponents-subtracted-wrong-way', 'bases-multiplied', 'coefficients-added', 'base-times-exponent', 'partial-rule', 'sign-slip', 'arith-slip'),
)

# ---------------------------------------------------------------- 4
node(
  id="exponent-power",
  prereqs=["exponent-product"],
  worldSite="quarry",
  bigIdea="A power raised to a power writes the bracket out that many times, and each copy brings its own count again — so the two counts multiply.",
  alignment=[
    C('8.EE.A.1', 'core'),
    C('HSA.SSE.A.2', 'supporting', 'structure-narrow'),
    T('A.11(B)', 'core', 'rational-exponents'),
  ],
  practices={"CCSS-M": ["MP.7", "MP.8"], "TEKS": ["A.1(D)", "A.1(F)", "A.1(G)"]},
  alignmentNote={
    "CCSS-M": "8.EE.A.1 is claimed at core here and not at the product node, because this node really does generate an equivalent NUMERICAL expression: raising a bracket like 6x^{4} to the third power requires 6^{3} to be worked out as a number before anything else can be written down. The property being applied is the one the standard names, and the checker re-derives the whole identity at fourteen values.",
    "TEKS": "A.11(B) again, at core, and this is the node most likely to be confused with the one before it: the product rule adds counts and this rule multiplies them. They are separated on purpose so that the mastery gate can tell a learner who has one from a learner who has both. The rational-exponent caveat is unchanged.",
  },
  bkt={"pInit": 0.13, "pTransit": 0.26, "pSlip": 0.1, "pGuess": 0.12},
  requiredReps=["symbolic", "context"],
  misconceptions=mis('exponents-added', 'exponents-subtracted-wrong-way', 'coefficient-not-raised', 'base-times-exponent', 'partial-rule', 'arith-slip'),
)

# ---------------------------------------------------------------- 5
node(
  id="exponent-quotient",
  prereqs=["exponent-product", "ratio-proportion"],
  worldSite="quarry",
  bigIdea="Dividing two powers of one letter cancels a factor from the top against a factor from the bottom, so the bottom count comes off the top count.",
  alignment=[
    C('8.EE.A.1', 'supporting', 'algebraic-not-numeric'),
    C('HSA.SSE.A.2', 'supporting', 'structure-narrow'),
    T('A.11(B)', 'core', 'rational-exponents'),
  ],
  practices={"CCSS-M": ["MP.7", "MP.8"], "TEKS": ["A.1(D)", "A.1(F)"]},
  alignmentNote={
    "CCSS-M": "The third of the three laws, and the one that forces the next node to exist: once the count on the bottom is allowed to reach the count on the top, x^{0} has to mean something, and once it is allowed to pass it, x^{-n} does too. 8.EE.A.1 is supporting here for the same reason as at the product node — the bases are letters.",
    "TEKS": "A.11(B) at core. The worked lines cancel matching factors before they subtract counts, so the rule is derived on screen rather than asserted; that is the difference between a learner who can apply the law and a learner who has memorised which way round the counts go.",
  },
  bkt={"pInit": 0.13, "pTransit": 0.26, "pSlip": 0.1, "pGuess": 0.12},
  requiredReps=["symbolic", "context"],
  misconceptions=mis('exponents-added', 'exponents-multiplied', 'exponents-subtracted-wrong-way', 'coefficients-added', 'base-times-exponent', 'partial-rule', 'arith-slip'),
)

# ---------------------------------------------------------------- 6
node(
  id="zero-negative-exponent",
  prereqs=["exponent-quotient"],
  worldSite="quarry",
  bigIdea="A count of zero is not a convention to memorise. Dividing a power by itself gives one by cancelling and a count of zero by subtracting, so a count of zero has to mean one — and a negative count has to mean factors under the bar.",
  alignment=[
    C('8.EE.A.1', 'core'),
    C('HSA.SSE.A.2', 'supporting', 'structure-narrow'),
    T('A.11(B)', 'core', 'rational-exponents'),
  ],
  practices={"CCSS-M": ["MP.3", "MP.7", "MP.8"], "TEKS": ["A.1(D)", "A.1(F)", "A.1(G)"]},
  alignmentNote={
    "CCSS-M": "8.EE.A.1 at core, and the NUMERICAL half of the standard is met literally: one form of this node is a bare numeric power with a negative count, whose answer is an exact fraction that the checker works out by parsing the printed notation. That is the standard's own worked example in the standard's own shape.",
    "TEKS": "A.11(B) at core, for the integral-exponent half named in the expectation — this is the node where a NEGATIVE integral count is taught, which is the part of \"including integral\" that the three nodes before it never reach. Rational counts remain outside the unit and outside the claim.",
  },
  bkt={"pInit": 0.12, "pTransit": 0.25, "pSlip": 0.1, "pGuess": 0.12},
  requiredReps=["symbolic", "context"],
  misconceptions=mis('zero-power-is-zero', 'negative-power-is-negative', 'negative-power-is-reciprocal-slip', 'exponents-added', 'base-times-exponent', 'partial-rule', 'sign-slip', 'arith-slip'),
)

# ---------------------------------------------------------------- 7
node(
  id="poly-add-sub",
  prereqs=["like-terms", "exponent-power"],
  worldSite="span",
  bigIdea="Two polynomials join term by term, and only terms with the same count merge. A minus in front of a bracket belongs to every term inside it, not only the first.",
  alignment=[
    C('HSA.APR.A.1', 'core', 'apr-multiply-elsewhere'),
    C('HSA.SSE.A.1.A', 'supporting', 'parts-terms-only'),
    T('A.10(A)', 'core'),
  ],
  practices={"CCSS-M": ["MP.3", "MP.6", "MP.7"], "TEKS": ["A.1(D)", "A.1(F)", "A.1(G)"]},
  alignmentNote={
    "CCSS-M": "HSA.APR.A.1 is core for the add-and-subtract half; the caveat sends the multiply half to the next node and says plainly that the closure argument the standard opens with is stated in neither. Every worked line is an identity that the checker samples at fourteen values, so the line a learner is shown as a justification is guaranteed true rather than merely plausible.",
    "TEKS": "A.10(A) — \"add and subtract polynomials of degree one and degree two\" — is met exactly, in both degrees. Level 1 cites A.10(A) at core for collecting like terms, where degree two appears only as a squared term held apart from a linear one; here two full degree-two polynomials are added and subtracted, which is the half Level 1's standards map records as only partly met.",
  },
  bkt={"pInit": 0.16, "pTransit": 0.26, "pSlip": 0.1, "pGuess": 0.11},
  requiredReps=["symbolic", "context", "verbal"],
  misconceptions=mis('minus-first-term-only', 'combine-unlike', 'partial-rule', 'sign-slip', 'arith-slip'),
)

# ---------------------------------------------------------------- 8
node(
  id="poly-multiply",
  prereqs=["poly-add-sub", "distribute", "bracket-both-sides"],
  worldSite="span",
  bigIdea="Multiplying two brackets is the distributive property used twice: every term in the first multiplies every term in the second. The two middle terms are alike, so they join.",
  alignment=[
    C('HSA.APR.A.1', 'core', 'apr-addsub-elsewhere'),
    C('HSA.SSE.A.1.B', 'supporting', 'single-entity-bracket'),
    T('A.10(B)', 'core'),
    T('A.10(D)', 'core'),
  ],
  practices={"CCSS-M": ["MP.4", "MP.7", "MP.8"], "TEKS": ["A.1(A)", "A.1(C)", "A.1(D)", "A.1(F)"]},
  alignmentNote={
    "CCSS-M": "HSA.APR.A.1 is core for the multiply half. The four-product line is always shown before anything is collected, so the two middle terms appear as two quantities that happen to be alike rather than as a step of a mnemonic — the standard asks for an understanding of the system, and a rhyme is not one.",
    "TEKS": "Two core claims, and both are exact. A.10(B) is \"multiply polynomials of degree one and degree two\": a monomial into a binomial, a binomial by a binomial, and a binomial squared. A.10(D) is the same work described as rewriting using the distributive property, which is precisely how the worked lines derive it. Level 1 cites A.10(B) as SUPPORTING because only a constant was multiplied into a polynomial there; this node is what raises it.",
  },
  bkt={"pInit": 0.13, "pTransit": 0.25, "pSlip": 0.1, "pGuess": 0.11},
  requiredReps=["symbolic", "context"],
  misconceptions=mis('middle-term-missed', 'partial-distribute', 'coefficients-added', 'coefficient-not-raised', 'exponents-added', 'swapped-roles', 'partial-rule', 'sign-slip', 'arith-slip'),
)

# ---------------------------------------------------------------- 9
node(
  id="factor-common",
  prereqs=["poly-multiply", "exponent-quotient"],
  worldSite="span",
  bigIdea="Factoring is expanding read right to left. Take out the largest number every term shares and the lowest count of the letter every term carries, and write what is left inside the bracket.",
  alignment=[
    C('HSA.SSE.A.2', 'core'),
    C('HSA.SSE.A.1.A', 'supporting', 'parts-terms-only'),
    T('A.10(D)', 'core'),
  ],
  practices={"CCSS-M": ["MP.7", "MP.8"], "TEKS": ["A.1(D)", "A.1(F)", "A.1(G)"]},
  alignmentNote={
    "CCSS-M": "HSA.SSE.A.2 is core here and nowhere else in the unit: \"use the structure of an expression to identify ways to rewrite it\" is the whole node. The draw asserts that what comes out really is the LARGEST common factor — the greatest common divisor of what is left inside is checked to be one before the item ships — so a learner who pulls out a common factor that is not the greatest is marked wrong for a reason the item can name.",
    "TEKS": "A.10(D) at core, run backwards. Level 1 already cites A.10(D) at core for expanding, and its standards map records that both directions belong to the one expectation; this node is the backwards direction, scored as an expression so the learner has to produce the product rather than recognise it. Trinomial factoring, A.10(E), is NOT claimed anywhere in this unit — see the unit's declared gaps.",
  },
  bkt={"pInit": 0.12, "pTransit": 0.25, "pSlip": 0.11, "pGuess": 0.11},
  requiredReps=["symbolic", "context"],
  misconceptions=mis('factor-partial', 'factor-drops-term', 'partial-distribute', 'sign-slip', 'arith-slip'),
)

# ---------------------------------------------------------------- 10
node(
  id="linear-vs-exponential",
  prereqs=["slope-rate", "function-notation", "exponent-power"],
  worldSite="shoal",
  bigIdea="A straight rule adds the same amount at every step. A growing rule multiplies by the same factor at every step. Given enough steps, the factor always overtakes the amount.",
  alignment=[
    C('HSF.LE.A.1.A', 'supporting', 'le-computed-not-proved'),
    C('HSF.LE.A.1.B', 'supporting', 'le-constant-rate'),
    C('HSF.LE.A.1.C', 'introduced', 'le-no-percent'),
    T('A.3(B)', 'supporting', 'rate-linear-only'),
    T('A.9(B)', 'supporting', 'ab-values-read-not-explained'),
  ],
  practices={"CCSS-M": ["MP.2", "MP.7", "MP.8"], "TEKS": ["A.1(A)", "A.1(D)", "A.1(F)"]},
  alignmentNote={
    "CCSS-M": "HSF.LE.A.1.A names the two numbers that separate the two families, and this node asks the learner to produce both of them off the notation: the common difference as a difference of two readings, and the common factor as a quotient of two readings. The checker evaluates each of those expressions from scratch, which is why they are written as arithmetic rather than posed as a question about the shape of a table — nothing in the verifier can classify a table, and an unverified item does not ship. The learner is not asked to prove the general statement, so the claim stops at supporting. The constant-PERCENT clause of LE.A.1.C is introduced only: this unit says factor everywhere and never says percent.",
    "TEKS": "A.3(B) is supporting for the linear half — the rate of change is calculated tabularly from a steady log and algebraically from a difference of two readings, but never graphically, because this unit draws no graph. A.9(B) is supporting for the b half of \"the values of a and b\": the learner produces the factor, and is not asked to write a sentence about what it means.",
  },
  bkt={"pInit": 0.15, "pTransit": 0.25, "pSlip": 0.1, "pGuess": 0.11},
  requiredReps=["symbolic", "table", "context"],
  misconceptions=mis('growth-is-linear', 'growth-start-for-factor', 'base-times-exponent', 'input-output-swap', 'off-by-one-row', 'partial-rule', 'sign-slip', 'arith-slip'),
)

# ---------------------------------------------------------------- 11
node(
  id="exponential-rule",
  prereqs=["linear-vs-exponential", "zero-negative-exponent"],
  worldSite="shoal",
  bigIdea="An exponential rule is a starting amount multiplied by a factor once for every step. At zero steps the factor has not been used, so the output is the starting amount.",
  alignment=[
    C('HSF.IF.A.2', 'core', 'interpret-in-context'),
    C('HSF.LE.A.1.C', 'introduced', 'le-no-percent'),
    T('A.12(B)', 'core'),
    T('A.9(B)', 'supporting', 'ab-values-read-not-explained'),
    T('A.11(B)', 'supporting', 'rational-exponents'),
  ],
  practices={"CCSS-M": ["MP.2", "MP.4", "MP.6"], "TEKS": ["A.1(A)", "A.1(B)", "A.1(D)"]},
  alignmentNote={
    "CCSS-M": "HSF.IF.A.2 at core, with an exponential rule in the f(x) wrapper rather than a linear one: the notation is used and the rule is evaluated at an element of its domain, including at zero and at a shrinking base. The checker reads a · b^{x} off the printed statement and works it out exactly, so a rule that grows past the range of exact arithmetic is refused at the draw rather than rounded at the check.",
    "TEKS": "A.12(B) at core — the same expectation this unit's first node meets for linear rules, met here for exponential ones, which is what makes the pair a genuine test of the notation rather than of one family of rule. A.11(B) is supporting rather than core: the laws of exponents are USED here — b to the count of zero is one, and a unit-fraction base is a count of divisions — but they are taught and gated four nodes earlier. A.9(C), writing an exponential function from a situation, is NOT claimed; see the unit's declared gaps.",
  },
  bkt={"pInit": 0.14, "pTransit": 0.25, "pSlip": 0.1, "pGuess": 0.11},
  requiredReps=["symbolic", "context"],
  misconceptions=mis('growth-is-linear', 'growth-start-for-factor', 'zero-power-is-zero', 'negative-power-is-negative', 'negative-power-is-reciprocal-slip', 'coefficient-not-raised', 'swapped-roles', 'partial-rule', 'arith-slip'),
)

GRAPH = {
  "id": "algebra1-level3",
  "course": "algebra1",
  "unit": "algebra1-l3",
  "titleKey": "unit.algebra1-l3.title",
  "title": "Algebra I — Level 3: Name, Power and Form",
  "description": "Eleven lines past the linear half. Level 1 taught a balance that stays level and Level 2 taught it to lean; Level 3 is where the straight line stops being the only shape. A rule gets a name and can be read at any input it accepts. A count above a letter gets three laws of its own, and those laws force a count of zero and a negative count to mean something. An expression gets more than one term to carry at once, so polynomials join, multiply and come apart again. And a rule that multiplies at every step is set beside a rule that adds at every step, until the factor overtakes the step.",
  "schema": "unified-alignment-1",
  "verification": {
    "checkedOn": "2026-08-18",
    "sources": [
      "Common Core State Standards for Mathematics, High School Functions and High School Algebra conceptual categories, and grade 8: https://www.thecorestandards.org/Math/",
      "Common Core content-standard text cross-checked against Illustrative Mathematics' content-standard index (https://tasks.illustrativemathematics.org/content-standards) and the Achievement Standards Network (https://asn.desire2learn.com/), because the original corestandards.org content paths no longer resolve.",
      "19 Tex. Admin. Code §111.39 (Algebra I, Adopted 2012, One Credit), via Cornell LII: https://www.law.cornell.edu/regulations/texas/19-Tex-Admin-Code-SS-111-39",
      "19 Tex. Admin. Code §111.26 (Grade 6, Adopted 2012), via Cornell LII: https://www.law.cornell.edu/regulations/texas/19-Tex-Admin-Code-SS-111-26"
    ],
    "note": "Every `text` field in this graph is the standard quoted word for word from the sources above, including the trailing punctuation the TEKS codes carry. Where a CCSS expectation ends in a worked example, the quotation stops before the example and the claim is unaffected; that applies to 8.EE.A.1 and to HSF.IF.B.5.",
    "caveats": [
      "This alignment is to the 2012-adopted mathematics TEKS, which is the version STAAR Algebra I is built on. Nothing here is claimed against a revised chapter.",
      "TYPOGRAPHY. The published TEKS print `ab^x` with a raised x, and this file is plain text. A superscript is written with a caret, so A.9(B) reads `f(x) = ab^x` here. Nothing else in any quoted text is re-typeset: subscripts in codes quoted by Level 1 and Level 2 are left flattened exactly as the source renders them.",
      "`core` means the mastery gate for that node proves the expectation: three unassisted items at band 4 or above, at least one outside notation, in a form the learner has not practised. Every claim below `core` carries a caveat naming the part that is not tested.",
      "Process standards are cited under `practices`, never under `alignment`. A process standard is not content coverage and is not counted as a code the unit teaches."
    ],
    "declaredGaps": [
      {
        "code": "A.12(A)",
        "citation": "19 TAC §111.39(c)(12)(A)",
        "claim": "NOT CLAIMED",
        "why": "\"Decide whether relations represented verbally, tabularly, graphically, and symbolically define a function\" is a yes/no judgement about a set of pairs. Nothing in the independent checker reads a set of pairs, so no item of that shape could be re-derived, and this unit ships no item it cannot re-derive. The idea is taught — every node states that a rule gives exactly one output for each input — but teaching is not evidence and the code is left uncited.",
        "i18n": {
          "es": { "why": "«Decidir si relaciones representadas verbalmente, en tablas, gráficamente y simbólicamente definen una función» es un juicio de sí o no sobre un conjunto de pares. El verificador independiente no lee conjuntos de pares, así que ningún ítem de esa forma podría rederivarse, y esta unidad no publica ningún ítem que no pueda rederivar. La idea sí se enseña —cada nodo dice que una regla da exactamente una salida por cada entrada— pero enseñar no es evidencia y el código se deja sin citar." },
          "pl": { "why": "„Rozstrzygnąć, czy relacje przedstawione słownie, tabelarycznie, graficznie i symbolicznie definiują funkcję\" to sąd tak lub nie o zbiorze par. Niezależny weryfikator nie czyta zbiorów par, więc żadnego zadania tego kształtu nie dałoby się wyprowadzić, a ta jednostka nie publikuje zadań, których nie potrafi wyprowadzić. Sama idea jest nauczana — każdy węzeł mówi, że reguła daje dokładnie jedno wyjście na każde wejście — ale nauczanie to nie dowód i kod zostaje niecytowany." }
        }
      },
      {
        "code": "A.10(E)",
        "citation": "19 TAC §111.39(c)(10)(E)",
        "claim": "NOT CLAIMED",
        "why": "Factoring a trinomial is not taught in this unit. The factoring node takes out a common factor and stops there, which is A.10(D) run backwards and not A.10(E).",
        "i18n": {
          "es": { "why": "Factorizar un trinomio no se enseña en esta unidad. El nodo de factorizar saca un factor común y se detiene ahí, lo cual es A.10(D) al revés y no A.10(E)." },
          "pl": { "why": "Rozkładu trójmianu na czynniki nie nauczamy w tej jednostce. Węzeł wyłączania wyjmuje wspólny czynnik i na tym kończy, co jest A.10(D) czytanym wstecz, a nie A.10(E)." }
        }
      },
      {
        "code": "A.10(F)",
        "citation": "19 TAC §111.39(c)(10)(F)",
        "claim": "NOT CLAIMED",
        "why": "Deciding whether a binomial is a difference of two squares, and rewriting it, is not taught. The multiply node produces such products incidentally; recognising one in reverse is a different expectation and is not tested.",
        "i18n": {
          "es": { "why": "Decidir si un binomio es una diferencia de cuadrados, y reescribirlo, no se enseña. El nodo de multiplicar produce esos productos de paso; reconocer uno al revés es otra expectativa y no se evalúa." },
          "pl": { "why": "Rozstrzygania, czy dwumian jest różnicą kwadratów, i przepisywania go, nie nauczamy. Węzeł mnożenia wytwarza takie iloczyny mimochodem; rozpoznanie takiego wstecz to inne oczekiwanie i nie jest sprawdzane." }
        }
      },
      {
        "code": "A.9(A)",
        "citation": "19 TAC §111.39(c)(9)(A)",
        "claim": "NOT CLAIMED",
        "why": "The domain and range of an exponential rule, represented using inequalities, is never asked for. This unit evaluates exponential rules; it does not describe their domain or range, and it writes no inequalities at all.",
        "i18n": {
          "es": { "why": "Nunca se pide el dominio y el rango de una regla exponencial representados con desigualdades. Esta unidad evalúa reglas exponenciales; no describe su dominio ni su rango, y no escribe ninguna desigualdad." },
          "pl": { "why": "Nigdy nie pytamy o dziedzinę i zbiór wartości reguły wykładniczej zapisane nierównościami. Ta jednostka oblicza wartości reguł wykładniczych; nie opisuje ich dziedziny ani zbioru wartości i nie zapisuje żadnych nierówności." }
        }
      },
      {
        "code": "A.9(C)",
        "citation": "19 TAC §111.39(c)(9)(C)",
        "claim": "NOT CLAIMED",
        "why": "Writing an exponential function from a described situation is not asked for. Every exponential rule in this unit is printed and read; none is constructed by the learner.",
        "i18n": {
          "es": { "why": "No se pide escribir una función exponencial a partir de una situación descrita. Todas las reglas exponenciales de esta unidad vienen impresas y se leen; el estudiante no construye ninguna." },
          "pl": { "why": "Nie prosimy o zapisanie funkcji wykładniczej na podstawie opisanej sytuacji. Każda reguła wykładnicza w tej jednostce jest wydrukowana i tylko odczytywana; uczeń żadnej nie buduje." }
        }
      },
      {
        "code": "CCSS.MATH.CONTENT.HSF.LE.A.2",
        "claim": "NOT CLAIMED",
        "why": "Constructing linear and exponential functions from a graph, a description or two input-output pairs. Level 2's write-linear node claims the linear half; the exponential half is not taught here, because this unit reads exponential rules rather than building them.",
        "i18n": {
          "es": { "why": "Construir funciones lineales y exponenciales a partir de una gráfica, una descripción o dos pares de entrada y salida. El nodo de escribir reglas del Nivel 2 cumple la mitad lineal; la mitad exponencial no se enseña aquí, porque esta unidad lee reglas exponenciales en vez de construirlas." },
          "pl": { "why": "Budowanie funkcji liniowych i wykładniczych z wykresu, opisu albo dwóch par wejście-wyjście. Węzeł zapisywania reguł z Poziomu 2 spełnia połowę liniową; połowy wykładniczej tu nie nauczamy, bo ta jednostka czyta reguły wykładnicze, zamiast je budować." }
        }
      },
      {
        "code": "CCSS.MATH.CONTENT.HSF.IF.C.7.E",
        "claim": "NOT CLAIMED",
        "why": "Graphing exponential functions and showing intercepts and end behaviour. This unit draws no graph of any kind.",
        "i18n": {
          "es": { "why": "Graficar funciones exponenciales y mostrar los cortes con los ejes y el comportamiento en los extremos. Esta unidad no dibuja ninguna gráfica." },
          "pl": { "why": "Rysowanie wykresów funkcji wykładniczych oraz pokazywanie punktów przecięcia z osiami i zachowania na końcach. Ta jednostka nie rysuje żadnych wykresów." }
        }
      }
    ]
  },
  "requires": ["algebra1-l1", "algebra1-l2"],
  "masteryThreshold": 0.95,
  "mastery": {
    "pL": 0.95,
    "cleanRun": 3,
    "minDifficulty": 3,
    "checkItems": 3,
    "checkMinDifficulty": 4,
    "checkRequiresUnseenForm": True,
    "checkRequiresNonSymbolic": True,
    "reviewIntervals": [6, 16, 40, 90],
    "note": "The gate is the Level 1 gate, unchanged, because the gate belongs to the engine and not to the course. A unit may retune these numbers; it may not invent a different kind of proof."
  },
  "commonMisconceptions": [{"id": i, "text": MIS[i]} for i in COMMON],
  "nodes": NODES,
}

with open('content/graph/algebra1-l3.json', 'w') as f:
    json.dump(GRAPH, f, indent=2, ensure_ascii=False)
    f.write('\n')

ids = [n['id'] for n in NODES]
assert len(set(ids)) == len(ids), 'duplicate node id'
print(f"wrote {len(NODES)} nodes")
codes = collections.Counter()
for n in NODES:
    for a in n['alignment']:
        codes[(a['framework'], a['code'], a['depth'])] += 1
for (fw, code, depth), k in sorted(codes.items()):
    print(f"  {fw:7} {code:38} {depth:11} x{k}")
