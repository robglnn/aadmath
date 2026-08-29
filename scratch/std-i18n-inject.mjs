/**
 * One-shot: write the ES and PL of OUR OWN explanatory prose into the two
 * standards records. The quoted standard text stays English on purpose and is
 * disclosed as a quotation; everything here is prose this project wrote.
 *
 *   node scratch/std-i18n-inject.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../content/standards');

// --- TEKS: the caveat under "What we claim, and what we do not" -------------
const CAVEAT = {
  '6.6(C)': {
    es: 'Lo afirmamos de forma estrecha y a propósito. 6.6(C) nombra solo las formas y = kx e y = x + b. Por eso lo citamos solo en las formas de agrupación, donde una situación como «k puestos, cada uno con 2 molinos, y cada molino devuelve x vatios» se registra exactamente como y = kx. Toda regla más rica, es decir cualquiera de la forma mx + b, se cita en 7.7, que es donde los TEKS la colocan. Equivocar este límite es la manera más común de que una hoja de alineación de un proveedor deje de ser cierta.',
    pl: 'Twierdzimy wąsko i celowo. 6.6(C) wymienia tylko postacie y = kx oraz y = x + b. Dlatego cytujemy je wyłącznie przy formach grupowania, gdzie sytuację taką jak „k stanowisk, każde z 2 młynami, a każdy młyn oddaje x watów” zapisujemy dokładnie jako y = kx. Każdą bogatszą regułę, czyli każdą postaci mx + b, cytujemy przy 7.7, bo tam umieszcza ją TEKS. Pomylenie tej granicy to najczęstszy sposób, w jaki arkusz zgodności dostawcy przestaje być prawdziwy.',
  },
  '6.7(A)': {
    es: 'Las mitades de orden de operaciones y de exponentes enteros son centrales. Son lo que examina el sello de dominio de order-ops. La factorización en números primos no se enseña en el Nivel 1 y no se afirma.',
    pl: 'Połowa dotycząca kolejności działań i połowa dotycząca wykładników całkowitych są rdzeniowe. To one są sprawdzane przez próbę biegłości dla order-ops. Rozkładu na czynniki pierwsze nie uczymy na Poziomie 1 i go nie twierdzimy.',
  },
  '6.7(C)': {
    es: 'Representaciones algebraicas, y el modelo pictórico en la forma de área del rectángulo partido. Los materiales manipulativos concretos quedan fuera de lo que hace un juego de navegador, y no se afirman. La afirmación de equivalencia se cumple al pie de la letra: el verificador de preguntas demuestra que un distractor NO es equivalente al enunciado antes de dejarlo aparecer en pantalla.',
    pl: 'Reprezentacje algebraiczne oraz model obrazkowy w formie pola dzielonego prostokąta. Konkretnych pomocy manipulacyjnych gra w przeglądarce nie daje, więc ich nie twierdzimy. Twierdzenie o równoważności egzekwujemy dosłownie: weryfikator zadań dowodzi, że dystraktor NIE jest równoważny poleceniu, zanim pozwoli mu trafić na ekran.',
  },
  '6.7(D)': {
    es: 'Las propiedades distributiva, conmutativa y asociativa son la materia de la que están hechas la reducción de términos semejantes y la apertura de un paréntesis. Ambos nodos se examinan sobre ellas. Las propiedades inversa e identidad se practican dentro de los nodos de ecuaciones, no aquí.',
    pl: 'Rozdzielność, przemienność i łączność to tworzywo redukcji wyrazów podobnych i opuszczania nawiasu. Oba węzły stawiają na nich swoją próbę. Element odwrotny i neutralny ćwiczymy w węzłach równań, a nie tutaj.',
  },
  '6.9(A)': {
    es: 'Solo ecuaciones. El Nivel 1 no trata desigualdades en ningún punto. La mitad de esta expectativa dedicada a las desigualdades queda para un nivel posterior.',
    pl: 'Tylko równania. Poziom 1 nigdzie nie zajmuje się nierównościami. Połowa tego oczekiwania dotycząca nierówności zostaje na późniejszy poziom.',
  },
  '6.10(A)': {
    es: 'Solo ecuaciones. La línea de conceptos geométricos queda fuera del alcance del Nivel 1. «Modelar» se cumple con la forma de la balanza, que es una balanza real sobre la que el estudiante puede actuar, no un dibujo de una.',
    pl: 'Tylko równania. Nurt pojęć geometrycznych jest poza zakresem Poziomu 1. „Modelowanie” spełnia forma wagi. To działająca waga, na której uczeń może działać, a nie jej obrazek.',
  },
  '7.7': {
    es: 'Este enunciado de conocimientos y destrezas no tiene expectativas del estudiante con letra. La expectativa es la frase misma. Aquí vive toda regla del Nivel 1 de la forma mx + b que aparece como tabla, como trazo o como descripción verbal. Son la mayoría, y por eso 6.6(C) se afirma tan estrechamente más arriba. El Nivel 1 entrega la tabla o el trazo y pide al estudiante leerlo o completarlo. No le pide construirlo, así que la mitad que produce pertenece a un nivel posterior.',
    pl: 'To zestawienie wiedzy i umiejętności nie ma oczekiwań oznaczonych literami. Oczekiwaniem jest samo zdanie. Tu mieszka każda reguła Poziomu 1 postaci mx + b, która pojawia się jako tabela, ślad lub opis słowny. Takich jest większość, i dlatego 6.6(C) twierdzimy powyżej tak wąsko. Poziom 1 podaje tabelę albo ślad i prosi ucznia o odczytanie lub uzupełnienie. Nie prosi o zbudowanie, więc połowa wytwórcza należy do późniejszego poziomu.',
  },
  '7.10(A)': {
    es: 'Solo ecuaciones. La forma de modelado pide la ecuación y se detiene ahí. Al estudiante se le puntúa por la ecuación, no por el resultado que esa ecuación daría.',
    pl: 'Tylko równania. Forma modelowania prosi o równanie i na tym kończy. Ucznia oceniamy za równanie, a nie za wynik, który by z niego wyszedł.',
  },
  '7.11(A)': {
    es: 'Solo ecuaciones. La mitad dedicada a las desigualdades pertenece a un nivel posterior.',
    pl: 'Tylko równania. Połowa dotycząca nierówności należy do późniejszego poziomu.',
  },
  '8.8(A)': {
    es: 'Solo ecuaciones. Los coeficientes y las constantes son enteros y racionales exactos. Los coeficientes irracionales nunca aparecen en el Nivel 1. Eso queda dentro de lo que pide esta expectativa, no fuera.',
    pl: 'Tylko równania. Współczynniki i wyrazy wolne są całkowite lub dokładnie wymierne. Współczynniki niewymierne nie pojawiają się na Poziomie 1. To mieści się w tym, czego żąda to oczekiwanie, a nie wykracza poza nie.',
  },
  '8.8(C)': {
    es: 'Los casos sin solución y con infinitas soluciones se enseñan y se examinan aquí, aunque esta expectativa no los nombre. Los TEKS dejan implícita la clasificación del conjunto solución. El Nivel 1 la hace explícita en vez de saltársela.',
    pl: 'Przypadków bez rozwiązania i z nieskończenie wieloma rozwiązaniami uczymy i sprawdzamy tutaj, choć to oczekiwanie ich nie wymienia. TEKS pozostawia klasyfikację zbioru rozwiązań domyślną. Poziom 1 czyni ją jawną, zamiast ją pominąć.',
  },
  '8.9': {
    es: 'Tocado, no cumplido. La forma de los dos trazos pregunta dónde se cruzan dos rectas, y trata ese cruce como la solución de una ecuación de una variable con incógnita en ambos lados. El Nivel 1 nunca escribe un sistema, nunca resuelve uno por álgebra y nunca pide la y del cruce. Un nivel posterior completa esto.',
    pl: 'Dotknięte, nie spełnione. Forma dwóch śladów pyta, gdzie przecinają się dwie proste, i traktuje to przecięcie jako rozwiązanie równania jednej niewiadomej z niewiadomą po obu stronach. Poziom 1 nigdy nie zapisuje układu, nigdy nie rozwiązuje go algebraicznie i nigdy nie pyta o y punktu przecięcia. Uzupełnia to późniejszy poziom.',
  },
  'A.5(A)': {
    es: 'Este es el estándar ancla del Nivel 1. Los dos casos difíciles que nombra son destrezas con sello propio: «se requiere aplicar la propiedad distributiva» es el nodo de varios pasos, y «hay variables en ambos lados» es el nodo de ambos lados. La ronda de prueba de cada uno son tres preguntas sin ayuda, en la banda 4 o superior, en las formas que el estudiante menos ha practicado.',
    pl: 'To jest standard kotwiczący dla Poziomu 1. Oba trudne przypadki, które wymienia z nazwy, są osobno bramkowanymi umiejętnościami: „konieczne jest zastosowanie rozdzielności” to węzeł wielokrokowy, a „niewiadome są po obu stronach” to węzeł obu stron. Bieg dowodowy dla każdego z nich to trzy zadania bez pomocy, w paśmie 4 lub wyżej, w formach ćwiczonych przez ucznia najrzadziej.',
  },
  'A.10(A)': {
    es: 'Grado uno en todo. El grado dos aparece solo donde hay que mantener un término al cuadrado separado de uno lineal. El Nivel 1 nunca suma dos cuadráticas completas, así que la mitad de grado dos se cumple en parte.',
    pl: 'Wszędzie stopień pierwszy. Stopień drugi pojawia się tylko tam, gdzie wyraz kwadratowy trzeba trzymać osobno od liniowego. Poziom 1 nigdy nie dodaje dwóch pełnych wyrażeń kwadratowych, więc połowa dotycząca stopnia drugiego jest spełniona częściowo.',
  },
  'A.10(B)': {
    es: 'Solo una constante multiplicada por un polinomio de grado uno. Multiplicar dos binomios no se enseña en el Nivel 1 y no se afirma.',
    pl: 'Tylko stała pomnożona przez wielomian stopnia pierwszego. Mnożenia dwóch dwumianów nie uczymy na Poziomie 1 i go nie twierdzimy.',
  },
  'A.10(D)': {
    es: 'En ambos sentidos. Abrir un paréntesis y sacar de nuevo un factor común son la misma expectativa recorrida hacia delante y hacia atrás. La forma de factorización se puntúa como expresión y no como número, así que el estudiante tiene que producir el producto, no reconocerlo.',
    pl: 'W obie strony. Opuszczenie nawiasu i wyciągnięcie wspólnego czynnika to to samo oczekiwanie przebiegnięte w przód i w tył. Forma rozkładu na czynniki jest oceniana jako wyrażenie, a nie jako liczba, więc uczeń musi wytworzyć iloczyn, a nie go rozpoznać.',
  },
  'A.12(B)': {
    es: 'LA NOTACIÓN DE FUNCIONES NO APARECE EN EL NIVEL 1. Lo que se cumple es la mitad de sustitución: una regla se evalúa en un elemento dado de su dominio, incluidos elementos negativos y reglas de dos variables. La envoltura f(x) que nombra esta expectativa es trabajo de un nivel posterior, y por eso exactamente esta entrada figura como INTRODUCIDA. Los TEKS de 2012 para los grados 6 a 8 no contienen ninguna expectativa del estudiante cuyo objeto sea evaluar una expresión algebraica en un valor. Esa destreza vive dentro de las representaciones múltiples de 7.7 y dentro de la notación de funciones de esta expectativa, y en ningún otro sitio. Eso es un hueco del estándar, no un hueco de esta alineación, y por eso eval-expr no lleva ninguna entrada TEKS con profundidad central.',
    pl: 'NOTACJA FUNKCYJNA NIE POJAWIA SIĘ NA POZIOMIE 1. Spełniona jest połowa dotycząca podstawiania: regułę obliczamy dla danego elementu jej dziedziny, w tym dla elementów ujemnych i dla reguł dwóch zmiennych. Otoczka f(x), którą wymienia to oczekiwanie, to zadanie późniejszego poziomu, i właśnie dlatego ten wpis ma głębię WPROWADZONY. TEKS z 2012 roku dla klas 6–8 nie zawiera żadnego oczekiwania ucznia, którego przedmiotem jest obliczenie wartości wyrażenia algebraicznego dla danej liczby. Ta umiejętność mieszka w wielu reprezentacjach z 7.7 oraz w notacji funkcyjnej tego oczekiwania, i nigdzie indziej. To luka w standardzie, a nie luka w tej zgodności, i dlatego eval-expr nie ma żadnego wpisu TEKS o głębi rdzeniowej.',
  },
};

// --- TEKS: how each process standard is met ---------------------------------
const TEKS_HOW = {
  'A.1(A)': {
    es: 'Cada destreza lleva una forma contextual. El sello de dominio no se supera sin aprobar al menos una pregunta de modelado que recorra el camino entre una situación y el álgebra.',
    pl: 'Każda umiejętność ma formę kontekstową. Próby biegłości nie da się przejść bez zaliczenia co najmniej jednego zadania modelującego, które przechodzi między sytuacją a algebrą.',
  },
  'A.1(B)': {
    es: 'El eco resuelto hace visible el plan como una secuencia de movimientos justificados, y se desvanece a medida que aparece la competencia. Al estudiante no se le pide escribir el plan. Por eso las etapas de «justificar» y «evaluar» se modelan y se reconocen, pero no se componen.',
    pl: 'Rozwiązane echo pokazuje plan jako ciąg uzasadnionych ruchów i zanika w miarę, jak rośnie biegłość. Uczeń nie jest proszony o spisanie planu. Dlatego etapy „uzasadniania” i „oceniania” są modelowane i rozpoznawane, a nie tworzone.',
  },
  'A.1(C)': {
    es: 'La balanza y el rectángulo partido son materiales manipulativos que funcionan, no ilustraciones. Pero es la fisura quien elige cuál aparece; el estudiante no lo selecciona. La mitad de selección de este estándar de proceso no se cumple en el Nivel 1 y no se afirma. El mapa CCSS tampoco afirma MP.5, por la misma razón, así que no hay nada que cruzar.',
    pl: 'Waga i dzielony prostokąt to działające pomoce manipulacyjne, a nie ilustracje. Ale to szczelina wybiera, która się pojawi; uczeń jej nie wybiera. Połowa tego standardu procesu dotycząca wyboru nie jest spełniona na Poziomie 1 i nie jest twierdzona. Mapa CCSS również nie twierdzi MP.5, z tego samego powodu, więc nie ma czego zestawiać.',
  },
  'A.1(D)': {
    es: 'Cada nodo declara las representaciones que exige su sello. La ronda de prueba no se cierra hasta cubrir dos de ellas, y al menos una no puede ser simbólica. Toda la notación es KaTeX estricto, con las convenciones de operadores del propio lector.',
    pl: 'Każdy węzeł deklaruje reprezentacje, których wymaga jego próba. Bieg dowodowy nie zamknie się, dopóki nie obejmie dwóch z nich, a co najmniej jedna nie może być symboliczna. Cała notacja to ścisły KaTeX, w konwencjach operatorów właściwych dla czytelnika.',
  },
  'A.1(E)': {
    es: 'Las formas de modelado piden al estudiante crear la representación simbólica de una situación, y se puntúan por la ecuación misma. Las tablas y las gráficas se entregan para leerlas, no para crearlas. Por eso la mitad de «crear» se cumple solo en símbolos.',
    pl: 'Formy modelowania proszą ucznia o utworzenie symbolicznej reprezentacji sytuacji i są oceniane za samo równanie. Tabele i wykresy są podawane do odczytu, a nie do utworzenia. Dlatego połowa „tworzenia” jest spełniona tylko w symbolach.',
  },
  'A.1(F)': {
    es: 'Las formas de tabla hacen visible una regla a lo largo de las filas antes de escribirla en símbolos. La forma de factorización pide al estudiante ver una suma como un producto. La forma de casos especiales pregunta qué clase de enunciado queda una vez que la incógnita ha desaparecido.',
    pl: 'Formy tabelaryczne pokazują regułę w kolejnych wierszach, zanim zapiszemy ją symbolami. Forma rozkładu na czynniki prosi ucznia, by zobaczył sumę jako iloczyn. Forma przypadków szczególnych pyta, jakie zdanie zostaje, gdy niewiadoma zniknie.',
  },
  'A.1(G)': {
    es: 'Las formas de disputa ponen dos cadenas de razonamiento contradictorias una junto a otra y preguntan cuál es válida. Cada cadena errónea es un error conceptual con nombre, no un descuido al azar. El estudiante decide y ve por qué, pero no compone la justificación con sus propias palabras. La mitad escrita y oral de este estándar de proceso es trabajo del docente, no del juego, y no se afirma.',
    pl: 'Formy sporu stawiają obok siebie dwa sprzeczne ciągi rozumowania i pytają, który jest poprawny. Każdy błędny ciąg to nazwane błędne przekonanie, a nie przypadkowa pomyłka. Uczeń decyduje i widzi dlaczego, ale nie tworzy uzasadnienia własnymi słowami. Połowa pisemna i ustna tego standardu procesu to zadanie nauczyciela, nie gry, i nie jest twierdzona.',
  },
};

// --- TEKS: where the alignment stops ----------------------------------------
const GAPS = {
  'eval-expr': {
    es: {
      finding: 'Ninguna expectativa del estudiante de TEKS a profundidad central.',
      why: 'Los TEKS de 2012 no nombran ninguna expectativa del estudiante cuyo objeto sea evaluar una expresión algebraica en un valor dado, en ningún punto de los grados 6 a 8. La destreza se ejercita dentro de 7.7 —una relación lineal mostrada como tabla, como gráfica y como descripción verbal— y solo se nombra en A.12(B), donde va envuelta en la notación de funciones que el Nivel 1 no usa. Por eso el Nivel 1 afirma 7.7 como DE APOYO y A.12(B) como INTRODUCIDA, y no afirma nada como central.',
      resolution: 'Se informa en lugar de taparlo. El lado CCSS de este nodo sí es central (6.EE.A.2.C), así que la destreza no queda sin alinear. Es un punto donde los dos marcos difieren de verdad.',
    },
    pl: {
      finding: 'Brak oczekiwania ucznia TEKS na głębi rdzeniowej.',
      why: 'TEKS z 2012 roku nie wymienia w klasach 6–8 żadnego oczekiwania ucznia, którego przedmiotem jest obliczenie wartości wyrażenia algebraicznego dla danej liczby. Umiejętność ta jest ćwiczona wewnątrz 7.7 — zależność liniowa pokazana jako tabela, wykres i opis słowny — a nazwana tylko w A.12(B), gdzie owija ją notacja funkcyjna, której Poziom 1 nie używa. Dlatego Poziom 1 twierdzi 7.7 jako WSPIERAJĄCY, a A.12(B) jako WPROWADZONY, i nie twierdzi niczego jako rdzeń.',
      resolution: 'Zgłaszamy to, zamiast zamalować. Po stronie CCSS ten węzeł jest rdzeniowy (6.EE.A.2.C), więc umiejętność nie jest niedopasowana. To miejsce, w którym oba systemy naprawdę się różnią.',
    },
  },
  'var-meaning': {
    es: {
      finding: '6.6(C) se afirma solo para las formas y = kx.',
      why: '6.6(C) nombra las formas y = kx e y = x + b, y nada más. Las preguntas del Nivel 1 cuya regla es mx + b se citan en 7.7. Una hoja de proveedor que citara 6.6(C) para cada tabla de este nivel estaría afirmando de más.',
      resolution: 'Separado a propósito. Vea la salvedad de cada entrada.',
    },
    pl: {
      finding: '6.6(C) twierdzimy tylko dla postaci y = kx.',
      why: '6.6(C) wymienia postacie y = kx oraz y = x + b i nic więcej. Zadania Poziomu 1, których regułą jest mx + b, cytujemy przy 7.7. Arkusz dostawcy, który cytowałby 6.6(C) przy każdej tabeli tego poziomu, twierdziłby za dużo.',
      resolution: 'Rozdzielone celowo. Zobacz zastrzeżenie przy każdym wpisie.',
    },
  },
  all: {
    es: {
      finding: 'Dos de los siete estándares de proceso de Álgebra I están marcados como parciales.',
      why: 'A.1(C) pide al estudiante SELECCIONAR herramientas; el Nivel 1 elige por él la balanza o el modelo de área. A.1(G) pide justificación en comunicación escrita u oral; el Nivel 1 pide al estudiante decidir cuál de dos cadenas de razonamiento es válida, y no recoge prosa.',
      resolution: 'Marcado como parcial en processStandards, con la mitad que falta nombrada. No se cuenta como cobertura completa en ningún punto de este documento ni del juego.',
    },
    pl: {
      finding: 'Dwa z siedmiu standardów procesu Algebry I są oznaczone jako częściowe.',
      why: 'A.1(C) prosi ucznia o WYBÓR narzędzi; Poziom 1 wybiera za niego wagę albo model pola. A.1(G) prosi o uzasadnienie w mowie lub w piśmie; Poziom 1 prosi ucznia o decyzję, który z dwóch ciągów rozumowania jest poprawny, i nie zbiera tekstu.',
      resolution: 'Oznaczone jako częściowe w processStandards, z nazwaną brakującą połową. Nigdzie w tym dokumencie ani w grze nie liczy się jako pełne pokrycie.',
    },
  },
  'order-ops': {
    es: {
      finding: 'Ninguna expectativa de contenido de §111.39, de ningún tipo.',
      why: 'Los TEKS de 2012 sitúan el orden de operaciones en 6.7(A) y no lo repiten en Álgebra I. No existe ninguna expectativa del estudiante de Álgebra I contra la que esta destreza pudiera citarse con honradez. A.11(B) trata las leyes de los exponentes, que es otra cosa, y citarla aquí sería afirmar de más.',
      resolution: 'order-ops lleva 6.7(A) como CENTRAL y los estándares de proceso de Álgebra I A.1(A), A.1(D) y A.1(G). No se hace ninguna cita de contenido de §111.39, y esta entrada es la razón por la que la comprobación de compilación lo permite.',
    },
    pl: {
      finding: 'Brak jakiegokolwiek oczekiwania treściowego z §111.39.',
      why: 'TEKS z 2012 roku umieszcza kolejność działań w 6.7(A) i nie powtarza jej w Algebrze I. Nie istnieje żadne oczekiwanie ucznia z Algebry I, przy którym można by uczciwie zacytować tę umiejętność. A.11(B) dotyczy praw wykładników, czyli czegoś innego, a cytowanie go tutaj byłoby twierdzeniem za dużo.',
      resolution: 'order-ops niesie 6.7(A) jako RDZEŃ oraz standardy procesu Algebry I A.1(A), A.1(D) i A.1(G). Nie robimy żadnego cytatu treściowego z §111.39, i właśnie ten wpis sprawia, że bramka kompilacji na to pozwala.',
    },
  },
};

// --- CCSS: how each practice standard is met --------------------------------
const CCSS_HOW = {
  'MP.1': {
    es: 'El control de prerrequisitos hace que el estudiante nunca encuentre un problema para el que no esté equipado. Así, la persistencia se pide donde puede tener éxito.',
    pl: 'Bramkowanie wymagań wstępnych sprawia, że uczeń nigdy nie trafia na zadanie, do którego nie był przygotowany. Wytrwałości żądamy więc tam, gdzie może przynieść skutek.',
  },
  'MP.2': {
    es: 'Las formas contextuales van de la situación a sus símbolos y de vuelta.',
    pl: 'Formy kontekstowe przechodzą między sytuacją a jej symbolami w obie strony.',
  },
  'MP.3': {
    es: 'Las preguntas de análisis de errores presentan las cadenas contradictorias de dos cadetes y preguntan cuál es válida. Cada opción errónea es un error conceptual real y con nombre, no un número al azar.',
    pl: 'Zadania analizy błędu pokazują sprzeczne ciągi rozumowania dwojga kadetów i pytają, który jest poprawny. Każda błędna opcja to prawdziwe, nazwane błędne przekonanie, a nie przypadkowa liczba.',
  },
  'MP.4': {
    es: 'La forma de modelado pide la ecuación que registra una situación, antes de resolver nada.',
    pl: 'Forma modelowania prosi o równanie, które zapisuje sytuację, zanim cokolwiek rozwiążemy.',
  },
  'MP.6': {
    es: 'Las respuestas son racionales exactos. El juego nunca acepta un valor redondeado, y los signos negativos se generan a propósito a partir de la banda de dificultad 3.',
    pl: 'Odpowiedzi są dokładnymi liczbami wymiernymi. Gra nigdy nie przyjmuje wartości zaokrąglonej, a znaki ujemne pojawiają się celowo od pasma trudności 3.',
  },
  'MP.7': {
    es: 'Las preguntas de factorización piden al estudiante ver una suma como un producto. El modelo de área muestra la propiedad distributiva como un rectángulo partido.',
    pl: 'Zadania rozkładu na czynniki proszą ucznia, by zobaczył sumę jako iloczyn. Model pola pokazuje rozdzielność jako dzielony prostokąt.',
  },
  'MP.8': {
    es: 'Las formas de tabla hacen visible una regla a lo largo de las filas antes de escribirla en símbolos.',
    pl: 'Formy tabelaryczne pokazują regułę w kolejnych wierszach, zanim zapiszemy ją symbolami.',
  },
};

// ---------------------------------------------------------------------------
function put(entry, loc, field, value) {
  entry.i18n = entry.i18n || {};
  entry.i18n[loc] = entry.i18n[loc] || {};
  entry.i18n[loc][field] = value;
}

let n = 0;
const teksPath = path.join(DIR, 'teks-algebra1-l1.json');
const teks = JSON.parse(readFileSync(teksPath, 'utf8'));
for (const s of teks.standards) {
  const tr = CAVEAT[s.code];
  if (!s.caveat) continue;
  if (!tr) throw new Error(`no caveat translation for ${s.code}`);
  for (const loc of ['es', 'pl']) { put(s, loc, 'caveat', tr[loc]); n++; }
}
for (const p of teks.processStandards) {
  const tr = TEKS_HOW[p.code];
  if (!p.how) continue;
  if (!tr) throw new Error(`no how translation for ${p.code}`);
  for (const loc of ['es', 'pl']) { put(p, loc, 'how', tr[loc]); n++; }
}
for (const g of teks.gaps) {
  const tr = GAPS[g.node];
  if (!tr) throw new Error(`no gap translation for ${g.node}`);
  for (const loc of ['es', 'pl']) {
    for (const f of ['finding', 'why', 'resolution']) {
      if (!g[f]) continue;
      if (!tr[loc][f]) throw new Error(`no ${loc}.${f} for gap ${g.node}`);
      put(g, loc, f, tr[loc][f]); n++;
    }
  }
}
writeFileSync(teksPath, JSON.stringify(teks, null, 2) + '\n');

const ccssPath = path.join(DIR, 'ccss-algebra1-l1.json');
const ccss = JSON.parse(readFileSync(ccssPath, 'utf8'));
for (const p of ccss.practices) {
  const tr = CCSS_HOW[p.code];
  if (!p.how) continue;
  if (!tr) throw new Error(`no how translation for ${p.code}`);
  for (const loc of ['es', 'pl']) { put(p, loc, 'how', tr[loc]); n++; }
}
writeFileSync(ccssPath, JSON.stringify(ccss, null, 2) + '\n');

console.log(`wrote ${n} translated strings into content/standards/`);
