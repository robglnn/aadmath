/**
 * Algebra I · Poziom 3 — treść zadań, polski.
 *
 * Prose for a course pack lives beside the shipped item bundles, under
 * content/lang, and never inside src/. Same rule, same reason: src/ carries no
 * language. The pack in src/content/packs imports this file and the registry
 * merges it in behind content/lang/items.*.js.
 *
 * HOUSE STYLE. Uproszczony polski techniczny: jedno słowo, jedno znaczenie;
 * jedno polecenie na zdanie; strona czynna; poniżej dwudziestu słów. Sytuacja
 * to JEDNO zdanie i nigdy nie podaje liczby, której matematyka nie używa.
 *
 * JEDNO SŁOWO, JEDNO ZNACZENIE — słownictwo, które dodaje ten poziom:
 *   potęga      litera lub liczba z wykładnikiem nad nią
 *   wykładnik   liczba u góry, która mówi, ile jest czynników
 *   czynnik     jedna z rzeczy, które się mnoży
 *   wyraz       jedna część sumy, znana z Poziomu 1
 *   reguła      nazwana maszyna, która zamienia jedno wejście na jedno wyjście
 *   krok        jeden ruch po wejściach, z liczby na następną
 *   Wzrost mierzymy słowem „czynnik”, nigdy „tempo”: tempo dodaje.
 */
export default {
  // ---------------------------------------------------------------- pytania
  'l3.ask.onePower': 'Zapisz to jako jedną potęgę.',
  'l3.ask.whatFactor': "Jaki to czynnik?",
  'l3.ask.areaOnePower': "Zapisz pole jako jedną potęgę.",
  'l3.ask.wholeOnePower': "Zapisz całość jako jedną potęgę.",
  'l3.ask.shareOnePower': "Zapisz jedną część jako jedną potęgę.",
  'l3.ask.oneExpression': 'Zapisz to jako jedno wyrażenie.',
  'l3.ask.exactValue': 'Jaka jest dokładna wartość?',
  'l3.ask.whichIsRight': 'Który kadet ma rację?',
  'l3.ask.valueOfF': 'Ile wynosi $f({k})$?',
  'l3.ask.whichInputGives': 'Które wejście daje wyjście ${out}$?',
  'l3.ask.largestOutput': 'Jakie jest największe wyjście?',
  'l3.ask.smallestOutput': 'Jakie jest najmniejsze wyjście?',
  'l3.ask.missingReading': 'Jaki jest brakujący odczyt?',
  'l3.ask.plateArea': 'Zapisz pole jako jedno wyrażenie.',
  'l3.ask.factoredForm': 'Zapisz to jako iloczyn.',
  'l3.ask.combinedTotal': 'Zapisz łączną sumę jako jedno wyrażenie.',
  'l3.ask.whatIsLeft': 'Zapisz to, co zostało, jako jedno wyrażenie.',
  'l3.ask.stepFactor': 'Wyjście mnoży się przez tę samą liczbę na każdym kroku. Jaka to liczba?',
  'l3.ask.stepAdd': 'Wyjście dodaje tę samą liczbę na każdym kroku. Jaka to liczba?',
  'l3.ask.gapAt': 'Ile to wynosi przy ${v} = {k}$?',
  'l3.ask.startValue': 'Jakie jest wyjście na starcie?',
  'l3.ask.nextReading': 'Jakie jest wyjście o jeden krok później?',

  // -------------------------------------------------------------- wejścia
  'l3.ctx.inputsRun': 'Wejścia to liczby całkowite od {lo} do {hi}.',

  // ----------------------------------------------------- reguły z nazwą
  'l3.ctx.assay': 'Próbnik zamienia każdą próbkę rudy na jeden odczyt.',
  'l3.ctx.kilnRule': 'Ten piec zamienia każde ustawienie ognia na jedną temperaturę.',
  'l3.ctx.sorter': "Sortownik zamienia każdy ładunek skrzyń na jeden ładunek półek.",
  'l3.ctx.lathe': 'Tokarka zamienia każde przejście na jedną gotową głębokość.',
  'l3.ctx.beacon': "Radiolatarnia zamienia każde ustawienie pokrętła na jedną odległość.",

  // ------------------------------------------------------ tylko całkowite
  'l3.ctx.crates': "Wciągnik bierze tylko całe skrzynie, od {lo} do {hi}.",
  'l3.ctx.berths': "Prom bierze tylko całe koje, od {lo} do {hi}.",
  'l3.ctx.panels': "Rama bierze tylko całe panele, od {lo} do {hi}.",
  'l3.ctx.rations': "Szafka bierze tylko całe racje, od {lo} do {hi}.",

  // -------------------------------------------- potęga obok potęgi
  'l3.ctx.tileRun': "Ten plac płytek to prostokąt, a każdy bok jest potęgą tej samej długości.",
  'l3.ctx.coilStack': "Ten stojak cewek to prostokąt, a każdy bok jest potęgą tej samej szerokości.",
  'l3.ctx.cellArray': "Ten blok komórek to prostokąt, a każdy bok jest potęgą tej samej głębokości.",
  'l3.ctx.driveBank': "Ten bank dysków to prostokąt, a każdy bok jest potęgą tej samej wysokości.",
  'l3.ctx.oreSeam': "Ta żyła rudy to prostokąt, a każdy bok jest potęgą tego samego odcinka.",

  // ------------------------------------------------- potęga z potęgi
  'l3.ctx.stackOfStacks': "Każda wnęka trzyma potęgę jednego ładunku, a ładownia powtarza tę wnękę potęgę razy.",
  'l3.ctx.gridOfGrids': "Każda krata trzyma potęgę jednej komórki, a zestaw powtarza tę kratę potęgę razy.",
  'l3.ctx.podOfPods': "Każda kapsuła trzyma potęgę jednego nasiona, a stelaż powtarza tę kapsułę potęgę razy.",
  'l3.ctx.reelOfReels': "Każdy krążek trzyma potęgę jednego zwoju, a szpula powtarza ten krążek potęgę razy.",

  // ------------------------------------------------- potęga rozdzielona
  'l3.ctx.equalCrews': "Ładownia trzyma potęgę jednego ładunku i dzieli ją między potęgę załóg.",
  'l3.ctx.equalPallets': "Wnęka trzyma potęgę jednej paczki i dzieli ją między potęgę palet.",
  'l3.ctx.equalRacks': "Magazyn trzyma potęgę jednej komórki i dzieli ją między potęgę regałów.",
  'l3.ctx.equalVats': "Linia trzyma potęgę jednego litra i dzieli ją między potęgę kadzi.",

  // ------------------------------------------------------- dwa rejestry
  'l3.ctx.twoManifests': 'Dwa manifesty notują te same rodzaje towaru.',
  'l3.ctx.twoSurveys': 'Dwa pomiary notują te same rodzaje odczytu.',
  'l3.ctx.twoHolds': 'Dwie ładownie notują te same rodzaje skrzyń.',
  'l3.ctx.twoShifts': 'Dwie zmiany notują te same rodzaje zadań.',

  // ------------------------------------------------------------ prostokąty
  'l3.ctx.hullPlate': 'Płyta kadłuba to prostokąt, a żadnego boku jeszcze nie znamy.',
  'l3.ctx.deckPanel': 'Panel pokładu to prostokąt, a żadnego boku jeszcze nie znamy.',
  'l3.ctx.solarSail': 'Żagiel słoneczny to prostokąt, a żadnego boku jeszcze nie znamy.',
  'l3.ctx.floorBay': 'Przęsło podłogi to prostokąt, a żadnego boku jeszcze nie znamy.',

  // --------------------------------------------------------- wspólna część
  'l3.ctx.sameCrew': "Każdy wyraz poniżej mierzy tę samą załogę.",
  'l3.ctx.samePallet': "Każdy wyraz poniżej mierzy tę samą paletę.",
  'l3.ctx.sameRack': "Każdy wyraz poniżej mierzy ten sam regał.",
  'l3.ctx.sameVat': "Każdy wyraz poniżej mierzy tę samą kadź.",

  // ---------------------------------------------------------------- wzrost
  'l3.ctx.spore': 'Grzybnia rośnie o ten sam czynnik na każdej wachcie.',
  'l3.ctx.relaySignal': 'Sygnał przekaźnika zyskuje ten sam czynnik na każdej wachcie.',
  'l3.ctx.rustBloom': 'Plama rdzy rozchodzi się o ten sam czynnik na każdej wachcie.',
  'l3.ctx.yeastVat': 'Kadź drożdży rośnie o ten sam czynnik na każdej wachcie.',

  // ------------------------------------------------------------- zanikanie
  'l3.ctx.coolant': 'Zbiornik chłodziwa zostawia ten sam ułamek swojego ładunku na każdej wachcie.',
  'l3.ctx.isotope': 'Izotop zostawia ten sam ułamek swojej masy na każdej wachcie.',
  'l3.ctx.powerCell': "Ogniwo zostawia ten sam ułamek swojego zapasu na każdej wachcie.",
  'l3.ctx.signalFade': 'Sygnał zostawia ten sam ułamek swojej siły na każdej wachcie.',

  // -------------------------------------------------------- równe dzienniki
  'l3.ctx.steadyWinch': 'Dziennik wciągarki rośnie o tę samą wielkość na każdej wachcie.',
  'l3.ctx.steadyTank': 'Dziennik zbiornika rośnie o tę samą wielkość na każdej wachcie.',
  'l3.ctx.steadyStack': 'Dziennik stosu rośnie o tę samą wielkość na każdej wachcie.',
  'l3.ctx.steadyFrost': 'Dziennik szronu rośnie o tę samą wielkość na każdej wachcie.',

  // ---------------------------------------------------------------- spory
  'l3.ctx.disputeExponent': 'Dwaj kadeci pomnożyli dwie potęgi jednej litery i różnią się co do wykładnika.',
  'l3.ctx.disputeFactorCount': 'Dwaj kadeci policzyli czynniki w iloczynie potęg i wyszło im co innego.',
  'l3.ctx.disputeMinus': 'Dwaj kadeci odjęli jeden nawias od drugiego i różnią się co do znaków.',
  'l3.ctx.disputeSecondBracket': 'Dwaj kadeci odjęli nawias, a jeden z nich zmienił tylko jego pierwszy wyraz.',

  // ------------------------------------------------------ dlaczego · potęgi
  'l3.why.countTheFactors': 'Potęga liczy czynniki, więc iloczyn potęg liczy obie grupy.',
  'l3.why.addTheCounts': 'Dodaj oba wykładniki, {a} i {b}.',
  'l3.why.numbersThenLetters': 'Zbierz najpierw liczby, a potem zbierz potęgi.',
  'l3.why.multiplyNumbersAddCounts': 'Pomnóż liczby. Dodaj wykładniki.',
  'l3.why.twoAtATime': 'Weź dwie pierwsze potęgi, a potem dołóż trzecią.',
  'l3.why.addTheLastCount': 'Dodaj ostatni wykładnik, {c}, do sumy, którą już masz.',
  'l3.why.writeOutTheFactors': 'Wypisz czynniki w całości i policz je.',
  'l3.why.copiesOfTheBracket': 'Nawias występuje {b} razy, a każda kopia niesie {a} czynników.',
  'l3.why.countCopiesOfCount': 'Każda kopia nawiasu przynosi ten sam wykładnik jeszcze raz.',
  'l3.why.multiplyTheCounts': 'Pomnóż oba wykładniki, {a} i {b}.',
  'l3.why.everyFactorIsRaised': 'Wykładnik z zewnątrz sięga każdego czynnika w nawiasie.',
  'l3.why.raiseNumberMultiplyCounts': 'Podnieś liczbę do tego wykładnika. Pomnóż wykładniki.',
  'l3.why.innerPairFirst': 'Policz najpierw wewnętrzną parę wykładników.',
  'l3.why.cancelMatchingFactors': 'Każdy czynnik z dołu skraca jeden czynnik z góry.',
  'l3.why.subtractTheCounts': 'Odejmij dolny wykładnik od górnego: {a} minus {b}.',
  'l3.why.divideNumbersSubtractCounts': 'Podziel liczby. Odejmij wykładniki.',
  'l3.why.bottomFirst': 'Zbierz najpierw dół w jedną potęgę.',
  'l3.why.everyFactorCancels': 'Góra i dół mają te same czynniki, więc zostaje tylko jeden.',
  'l3.why.theZeroBelongsToTheLetter': 'Wykładnik zero należy do litery, a nie do liczby.',
  'l3.why.zeroPowerIsOne': 'Litera z wykładnikiem zero wynosi jeden.',
  'l3.why.negativeCountIsUnderTheBar': 'Wykładnik minus {n} kładzie {n} czynników pod kreską.',
  'l3.why.unitFractionDivides': "Każdy krok dzieli przez {q}, więc {n} kroków dzieli przez {q} tyle właśnie razy.",
  'l3.why.workOutTheBottom': 'Policz {base} z wykładnikiem {n} na dole.',

  // --------------------------------------------------- dlaczego · funkcje
  'l3.why.putTheInputIn': 'Wstaw {k} wszędzie tam, gdzie w regule stoi litera.',
  'l3.why.workItOut': 'Teraz policz arytmetykę.',
  'l3.why.nameIsNotAFactor': 'Nazwa reguły to etykieta i nigdy nie mnoży.',
  'l3.why.readTheRowAcross': 'Przeczytaj wiersz do kolumny wyjścia.',
  'l3.why.oneStepDownTable': 'Jeden krok w dół tabeli rusza wyjście o tę samą wielkość.',
  'l3.why.risingRuleTopInput': 'Tempo jest dodatnie, więc największe wejście daje największe wyjście.',
  'l3.why.risingRuleLowInput': 'Tempo jest dodatnie, więc najmniejsze wejście daje najmniejsze wyjście.',
  'l3.why.fallingRuleTopOutput': 'Tempo jest ujemne, więc najmniejsze wejście daje największe wyjście.',
  'l3.why.undoToFindInput': 'Cofnij regułę, aby znaleźć wejście, które ją daje.',

  // ------------------------------------------------ dlaczego · wielomiany
  'l3.why.dropTheFirstBracket': 'Plus z przodu zostawia nawias dokładnie takim, jaki jest.',
  'l3.why.minusEntersEveryTerm': 'Minus należy do całego nawiasu, więc zmienia każdy wyraz w środku.',
  'l3.why.collectEachPower': 'Zbierz wyrazy, które mają ten sam wykładnik.',
  'l3.why.eachTimesEach': 'Każdy wyraz pierwszego nawiasu mnoży każdy wyraz drugiego.',
  'l3.why.collectTheMiddle': 'Dwa środkowe wyrazy mają ten sam wykładnik, więc się łączą.',
  'l3.why.squareIsTwoBrackets': 'Kwadrat to nawias wypisany dwa razy.',
  'l3.why.monoIntoEveryTerm': 'Wyraz z przodu mnoży każdy wyraz w nawiasie.',
  'l3.why.largestSharedFactor': 'Znajdź największy czynnik, który niesie każdy wyraz.',
  'l3.why.divideEachTerm': 'Podziel każdy wyraz przez ten czynnik i wpisz do środka to, co zostało.',
  'l3.why.checkByExpanding': 'Pomnóż z powrotem, aby sprawdzić, że nic nie zostało pominięte.',
  'l3.why.lowestPowerComesOut': 'Najniższy wykładnik litery to wszystko, co wyrazy mogą dzielić.',

  // -------------------------------------------------- dlaczego · wzrost
  'l3.why.divideNeighbours': 'Podziel jeden odczyt przez odczyt przed nim.',
  'l3.why.thatIsTheFactor': 'To jest ten czynnik, a każdy krok używa tego samego.',
  'l3.why.subtractNeighbours': 'Odejmij jeden odczyt od odczytu po nim.',
  'l3.why.thatIsTheStep': 'To jest ten krok, a każdy krok dodaje tę samą wielkość.',
  'l3.why.putTheStepIn': 'Wstaw {k} w miejsce litery w obu regułach.',
  'l3.why.exponentialOvertakes': 'Czynnik bije krok, gdy tylko wykładnik urośnie.',
  'l3.why.startIsTheNumberInFront': 'Przy zerze potęga wynosi jeden, więc liczba z przodu to start.',
  'l3.why.oneMoreStepMultiplies': 'Jeden krok więcej mnoży wyjście przez podstawę jeszcze raz.',
  'l3.why.readTheBaseOff': 'Liczba u góry to wykładnik, a liczba pod nią to podstawa.',
};
