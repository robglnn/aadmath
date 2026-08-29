/**
 * Algebra I · Poziom 5 — teksty zadań, polski.
 *
 * Teksty pakietu leżą obok bundli zadań, w content/lang, i nigdy w src/. Ta
 * sama zasada i ten sam powód: src/ nie niesie języka. Pakiet z
 * src/content/packs importuje ten plik, a rejestr dokłada go za
 * content/lang/items.*.js.
 *
 * STYL. Uproszczony polski techniczny: jedno słowo znaczy jedną rzecz, jedno
 * polecenie na zdanie, strona czynna, poniżej dwudziestu słów. Sytuacja to
 * JEDNO zdanie i nigdy nie podaje liczby, której matematyka nie używa.
 *
 * JEDNO SŁOWO, JEDNO ZNACZENIE — słownik tego poziomu:
 *   odczyt     jedna zmierzona para albo jedna zmierzona wartość
 *   lista      liczby po kolei, jedna na każdą pozycję
 *   pozycja    które miejsce na liście, licząc 1, 2, 3
 *   krok       ile lista dodaje na każdej pozycji
 *   czynnik    liczba, przez którą lista mnoży (Poziom 3)
 *   licznik    liczba pisana u góry, mówi ile czynników (Poziom 3)
 *   pierwiastek  działanie, które cofa potęgę
 *   tempo      o ile prosta rośnie na jeden krok w bok (Poziom 2)
 *   najbliższa prosta  jedyna prosta, która leży najbliżej wszystkich odczytów
 *   luka       jeden odczyt minus wartość, którą prosta daje w tym miejscu
 *   obszar     wszystkie odczyty, dla których zdanie z nierównością zachodzi
 *   brzeg      prosta, na której obszar się kończy
 *   przecięcie jedyny odczyt, na który zgadzają się obie reguły
 *   część      ilość wobec całości
 */
export default {
  // ---------------------------------------------------------------- pytania
  'l5.ask.exactValue': 'Jaka jest dokładna wartość?',
  'l5.ask.simplestForm': 'Zapisz to w najprostszej postaci.',
  'l5.ask.rootThenPower': 'Dół licznika mówi, jaki pierwiastek wziąć. Jaka to wartość?',
  'l5.ask.whichInputBreaks': 'Jedno wejście niesie dwa różne wyjścia. Które wejście?',
  'l5.ask.valueAtPosition': 'Jaka jest wartość na pozycji {k}?',
  'l5.ask.oneFormula': 'Zapisz jeden wzór, który daje wartość na pozycji {v}.',
  'l5.ask.sameLineFromReading': 'Zapisz tę samą prostą, odejmując zaznaczony odczyt po obu stronach.',
  'l5.ask.sameLineOutputAlone': 'Zapisz tę samą prostą z samym wyjściem po lewej stronie.',
  'l5.ask.sameLineWholeNumbers': 'Zapisz tę samą prostą z obiema literami po lewej i bez ułamka.',
  'l5.ask.lineBeside': 'Zapisz regułę prostej obok tej, przez zaznaczony odczyt. Użyj $x$ i $y$.',
  'l5.ask.lineAtRightAngle': 'Zapisz regułę prostej pod kątem prostym do tej, przez zaznaczony odczyt. Użyj $x$ i $y$.',
  'l5.ask.writeThatLine': 'Zapisz regułę tej prostej.',
  'l5.ask.rateAtRightAngle': 'Jakie jest tempo prostej pod kątem prostym do tej?',
  'l5.ask.rateOfThatLine': 'Jakie jest tempo tej prostej?',
  'l5.ask.valueAtZero': 'Jakie jest wyjście, gdy wejście wynosi zero?',
  'l5.ask.whichRegion': 'R to obszar. Zapisz zdanie, które nazywa R.',
  'l5.ask.writeThePair': 'Zapisz parę reguł, po jednej na każdą tabelę.',
  'l5.ask.whereTheyMeet': 'Gdzie przecinają się obie reguły?',
  'l5.ask.inputAtCrossing': 'Jakie jest wejście w przecięciu?',
  'l5.ask.outputAtCrossing': 'Jakie jest wyjście w przecięciu?',
  'l5.ask.fitRate': 'Jakie jest tempo najbliższej prostej?',
  'l5.ask.fitStart': 'Gdzie zaczyna się najbliższa prosta?',
  'l5.ask.predictAt': 'Co daje najbliższa prosta w {k}?',
  'l5.ask.gapAt': 'Luka to odczyt minus prosta. Jaka jest luka w {k}?',
  'l5.ask.gapAtShort': 'Jaka jest luka w {k}?',
  'l5.ask.shareOfRow': 'Jaka część zaznaczonego wiersza wypada w zaznaczonej kolumnie?',
  'l5.ask.shareOfAll': 'Jaka część wszystkich odczytów wypada tam, gdzie zaznaczony wiersz spotyka zaznaczoną kolumnę?',
  'l5.ask.shareOfColumn': 'Jaka część zaznaczonej kolumny wypada w zaznaczonym wierszu?',
  'l5.ask.startAmount': 'Początek jest przy $x = 0$. Jaka jest tam ilość?',
  'l5.ask.growthFactor': 'Jaki to czynnik?',
  'l5.ask.percentEachStep': 'O ile procent rośnie na każdym kroku?',
  'l5.ask.writeTheRule': 'Zapisz regułę tych odczytów.',
  'l5.ask.whenItPasses': 'Na której pozycji pierwsza reguła mija drugą?',

  // ------------------------------------------------------ liczniki ułamkowe
  'l5.ctx.kilnFire': 'Piec podnosi każdy wsad do ułamkowego licznika jego masy.',
  'l5.ctx.tuner': 'Strojnik ustawia każdą antenę na ułamkowy licznik odczytu radiolatarni.',
  'l5.ctx.mixer': 'Mieszalnik skaluje każdą partię do ułamkowego licznika jej ładunku.',
  'l5.ctx.gauge': 'Czujnik podaje ułamkowy licznik ciśnienia, które trzyma.',
  'l5.ctx.hullSquare': 'Kwadratowa płyta kadłuba ma to pole, a załoga chce jeden bok.',
  'l5.ctx.tankSquare': 'Kwadratowe dno zbiornika ma to pole, a załoga chce jedną krawędź.',
  'l5.ctx.bayRoot': 'Kwadratowe lądowisko ma to pole, a załoga maluje jedną krawędź.',

  // ------------------------------------------------------- tylko jedno wyjście
  'l5.ctx.dockLog': 'Dziennik doku łączy każdy numer stanowiska z masą, którą przyjął.',
  'l5.ctx.sensorLog': 'Dziennik czujnika łączy każde ustawienie pokrętła z odczytem, który dał.',
  'l5.ctx.cropLog': 'Dziennik uprawy łączy każdy numer tacy z plonem, który dała.',
  'l5.ctx.relayLog': 'Dziennik przekaźnika łączy każdy numer kanału z opóźnieniem, które dał.',
  'l5.ctx.pilotSheet': 'Karta lotu łączy każdy kod startu z czasem ciągu, który ustawił.',

  // ----------------------------------------------------------------- listy
  'l5.ctx.driftRow': 'Boja podaje jedną odległość na każdej wachcie.',
  'l5.ctx.stackRow': 'Załoga układa tyle samo skrzyń na każdej wachcie.',
  'l5.ctx.iceRow': 'Kadłub traci tyle samo masy lodu na każdej wachcie.',
  'l5.ctx.fuelRow': 'Palnik traci tyle samo masy paliwa na każdej wachcie.',
  'l5.ctx.stockRow': 'Magazyn traci tyle samo paczek na każdej wachcie.',
  'l5.ctx.sporeRow': 'Grzybnia mnoży się przez ten sam czynnik na każdej wachcie.',
  'l5.ctx.dimmerRow': 'Lampa trzyma tę samą część swojego światła na każdej wachcie.',
  'l5.ctx.tetherRow': 'Lina wypuszcza tę samą długość na każdej wachcie.',

  // ----------------------------------------------------------------- proste
  'l5.ctx.rampRule': 'Rampa wznosi się w stałym tempie.',
  'l5.ctx.beltRule': 'Taśma wiezie masę w stałym tempie.',
  'l5.ctx.pumpRule': 'Pompa napełnia zbiornik w stałym tempie.',
  'l5.ctx.craneRule': 'Żuraw podnosi w stałym tempie.',
  'l5.ctx.girderRun': 'Dźwigar biegnie obok tej prostej, a zaznaczony odczyt leży na nim.',
  'l5.ctx.braceRun': 'Zastrzał przecina tę prostą pod kątem prostym przez zaznaczony odczyt.',
  'l5.ctx.railRun': 'Szyna biegnie obok tej prostej i niesie zaznaczony odczyt.',
  'l5.ctx.strutRun': 'Rozpórka tnie tę prostą pod kątem prostym w zaznaczonym odczycie.',
  'l5.ctx.towLine': 'Lina holownicza biegnie obok tej prostej i trzyma zaznaczony odczyt.',

  // ---------------------------------------------------------------- obszary
  'l5.ctx.safeLoad': 'Wciągnik pracuje bezpiecznie przy każdym odczycie w obszarze.',
  'l5.ctx.coldBay': 'Chłodnia utrzyma każdy odczyt w obszarze.',
  'l5.ctx.powerBudget': 'Budżet mocy pokrywa każdy odczyt w obszarze.',
  'l5.ctx.airMix': 'Mieszanka powietrza zostaje czysta przy każdym odczycie w obszarze.',

  // ----------------------------------------------------------------- układy
  'l5.ctx.twoHoists': 'Dwa wciągniki jadą we własnym tempie, a każda tabela notuje jeden.',
  'l5.ctx.twoTanks': 'Dwa zbiorniki napełniają się we własnym tempie, a każda tabela notuje jeden.',
  'l5.ctx.twoRovers': 'Dwa łaziki jadą we własnym tempie, a każda tabela notuje jeden.',
  'l5.ctx.twoKilns': 'Dwa piece grzeją we własnym tempie, a każda tabela notuje jeden.',
  'l5.ctx.priceMeet': 'Dwaj dostawcy liczą własną regułą, a załoga szuka tej samej ceny.',
  'l5.ctx.rangeMeet': 'Dwa drony tracą moc własną regułą, a załoga szuka tego samego zapasu.',
  'l5.ctx.fillMeet': 'Dwie rury napełniają własną regułą, a załoga szuka tej samej głębokości.',
  'l5.ctx.climbMeet': 'Dwie windy jadą własną regułą, a załoga szuka tej samej wysokości.',

  // ------------------------------------------------------------------ dane
  'l5.ctx.oreAssay': 'Załoga notuje jeden odczyt rudy na każdą głębokość wiercenia.',
  'l5.ctx.frostRun': 'Załoga notuje jeden odczyt szronu na każdą godzinę nocy.',
  'l5.ctx.dustRun': 'Załoga notuje jeden odczyt pyłu na każdy metr wysokości.',
  'l5.ctx.saltRun': 'Załoga notuje jeden odczyt soli na każdy kilometr brzegu.',
  'l5.ctx.windRun': 'Załoga notuje jeden odczyt wiatru na każdy metr masztu.',
  'l5.ctx.yieldRun': 'Załoga notuje jeden odczyt plonu na każdy gram paszy.',
  'l5.ctx.wearRun': 'Załoga notuje jeden odczyt zużycia na każdy tysiąc obrotów.',

  // ---------------------------------------------------- tabela dwudzielcza
  'l5.ctx.crewSurvey': 'Ankieta dzieli każdego kadeta po wachcie i po fachu.',
  'l5.ctx.partsAudit': 'Przegląd dzieli każdą część po dostawcy i po klasie.',
  'l5.ctx.cargoAudit': 'Przegląd dzieli każdą skrzynię po pokładzie i po plombie.',
  'l5.ctx.faultAudit': 'Przegląd dzieli każdą usterkę po układzie i po wachcie.',

  // ------------------------------------------------------- wzrost i spadek
  'l5.ctx.blightSpread': 'Zaraza mnoży się przez ten sam czynnik na każdej wachcie.',
  'l5.ctx.fundGrow': 'Fundusz mnoży się przez ten sam czynnik na każdej wachcie.',
  'l5.ctx.coolantFade': 'Chłodziwo trzyma tę samą część siebie na każdej wachcie.',
  'l5.ctx.isotopeFade': 'Izotop trzyma tę samą część siebie na każdej wachcie.',
  'l5.ctx.raceStep': 'Jeden zapas dodaje na każdej wachcie, a drugi mnoży.',
  'l5.ctx.raceGrow': 'Jedna uprawa dodaje na każdej wachcie, a druga mnoży.',

  // ------------------------------------------------------------------ spory
  'l5.ctx.disputeRoot': 'Dwaj kadeci czytają ten sam ułamkowy licznik i różnią się.',
  'l5.ctx.disputeOrder': 'Dwaj kadeci wzięli pierwiastek i potęgę w innej kolejności.',
  'l5.ctx.disputeFunction': 'Dwaj kadeci spierają się, które ustawienie złamało dziennik.',
  'l5.ctx.disputeStep': 'Dwaj kadeci spierają się o krok tej samej listy.',
  'l5.ctx.disputeFormula': 'Dwaj kadeci zapisali różne wzory dla tej samej listy.',
  'l5.ctx.disputeRate': 'Dwaj kadeci spierają się o prostą pod kątem prostym do tej.',
  'l5.ctx.disputeCrossing': 'Dwaj kadeci spierają się, gdzie przecinają się obie reguły.',
  'l5.ctx.disputeFit': 'Dwaj kadeci spierają się o najbliższą prostą.',
  'l5.ctx.disputeGap': 'Dwaj kadeci spierają się o lukę przy jednym odczycie.',
  'l5.ctx.disputeShare': 'Dwaj kadeci spierają się o część w jednym wierszu.',
  'l5.ctx.disputeWhole': 'Dwaj kadeci spierają się o to, do jakiej sumy liczy się część.',

  // --------------------------------------------- dlaczego · ułamkowy licznik
  'l5.why.bottomIsTheRoot': 'Dół licznika mówi, jaki pierwiastek wziąć.',
  'l5.why.topIsThePower': 'Góra licznika mówi, do jakiej potęgi podnieść wynik.',
  'l5.why.rootFirstThenPower': 'Weź najpierw pierwiastek, a potem podnieś małą liczbę do górnego licznika.',
  'l5.why.negativeCountFlips': 'Licznik poniżej zera odwraca wartość.',
  'l5.why.squareFactorComesOut': 'Wyciągnij największy czynnik kwadratowy i weź jego pierwiastek.',
  'l5.why.rootOfAProduct': 'Pierwiastek iloczynu to iloczyn pierwiastków.',
  'l5.why.workItOut': 'Policz to.',

  // ------------------------------------------------ dlaczego · jedno wyjście
  'l5.why.oneOutputEachInput': 'Reguła to funkcja, gdy każde wejście niesie dokładnie jedno wyjście.',
  'l5.why.readDownTheInputs': 'Zjedź kolumną wejść i poszukaj tego samego wejścia dwa razy.',
  'l5.why.twoOutputsBreakIt': 'To wejście niesie dwa różne wyjścia, więc reguła tam pęka.',
  'l5.why.sharedOutputIsFine': 'Dwa wejścia mogą dzielić jedno wyjście, a reguła dalej trzyma.',

  // ------------------------------------------------------ dlaczego · listy
  'l5.why.takeNeighbours': 'Odejmij jedną wartość od wartości, która idzie po niej.',
  'l5.why.sameStepAllTheWay': 'Każda para daje ten sam krok, więc lista dodaje.',
  'l5.why.divideNeighbours': 'Podziel jedną wartość przez wartość, która idzie przed nią.',
  'l5.why.sameFactorAllTheWay': 'Każda para daje ten sam czynnik, więc lista mnoży.',
  'l5.why.countTheStepsOn': 'Policz kroki od ostatniej zapisanej pozycji do pozycji {k}.',
  'l5.why.addTheStepEachTime': 'Dodaj krok raz na każdą pozycję, o którą idziesz dalej.',
  'l5.why.multiplyEachTime': 'Pomnóż przez czynnik raz na każdą pozycję, o którą idziesz dalej.',
  'l5.why.firstValuePlusSteps': 'Zacznij od pierwszej wartości i dodaj krok na każdą dalszą pozycję.',
  'l5.why.stepTimesPositionPlusStart': 'Wzór to krok razy pozycja, plus to, co zostaje.',
  'l5.why.factorPowerFromFirst': 'Wzór to pierwsza wartość razy czynnik, podniesiony do liczby kroków.',
  'l5.why.checkAtPositionOne': 'Wstaw pozycję jeden do wzoru i sprawdź pierwszą wartość.',
  'l5.why.runTheRuleOn': 'Prowadź regułę do przodu, o jedną pozycję na raz.',

  // ----------------------------------------------------- dlaczego · proste
  'l5.why.rateOffTheRule': 'Odczytaj tempo z zapisanej reguły.',
  'l5.why.pointIntoTheForm': 'Wstaw zaznaczony odczyt do wzoru i pilnuj znaków.',
  'l5.why.zeroIntoTheForm': 'Wstaw zero w miejsce wejścia i uważaj na znaki.',
  'l5.why.takeAwayTheReading': 'Odejmij odczyt, więc punkt poniżej zera zmienia się w plus.',
  'l5.why.multiplyOutTheBracket': 'Wymnóż nawias i zbierz liczby.',
  'l5.why.clearTheBottom': 'Pomnóż każdą część przez dolną liczbę i usuń ułamek.',
  'l5.why.gatherLettersLeft': 'Zbierz obie litery po lewej, a liczbę po prawej.',
  'l5.why.sameRateForParallel': 'Dwie proste, które nigdy się nie spotkają, niosą to samo tempo.',
  'l5.why.turnOverAndChangeSign': 'Przy kącie prostym odwróć tempo i zmień jego znak.',
  'l5.why.uprightHasNoRate': 'Prosta pionowa nie ma tempa, więc zapisujemy ją samym wejściem.',
  'l5.why.flatLineRateIsZero': 'Prosta pozioma ma tempo zero, więc reguła nazywa samo wyjście.',
  'l5.why.throughTheOrigin': 'Prosta przechodzi przez zero, więc nie dodajemy żadnej liczby.',
  'l5.why.constantIsOutputOverInput': 'Podziel wyjście przez wejście, aby dostać stałą.',

  // ---------------------------------------------------- dlaczego · obszary
  'l5.why.boundaryFromReadings': 'Dopasuj najpierw prostą do odczytów brzegu.',
  'l5.why.testTheReadingOffTheLine': 'Wstaw odczyt, który leży poza prostą. Zobacz, po której stronie pada.',
  'l5.why.readingOffTheLineIsIn': 'Odczyt poza prostą należy do R, więc R pada po jego stronie.',
  'l5.why.readingOffTheLineIsOut': 'Odczyt poza prostą nie należy do R, więc R pada po drugiej stronie.',
  'l5.why.boundaryLeftOutOfR': 'Odczyt brzegu nie należy do R, więc nierówność jest ostra.',
  'l5.why.boundaryKeptInR': 'Odczyt brzegu należy do R, więc nierówność dopuszcza równość.',

  // ----------------------------------------------------- dlaczego · układy
  'l5.why.ruleFromEachTable': 'Wylicz jedną regułę z każdej tabeli osobno.',
  'l5.why.twoRulesTwoUnknowns': 'Dwie różne reguły o jednej parze ustalają oba odczyty.',
  'l5.why.setThemEqual': 'Reguły zgadzają się w przecięciu, więc zrównaj je.',
  'l5.why.solveForTheInput': 'Wylicz wejście.',
  'l5.why.putItBackInEither': 'Wstaw wejście do dowolnej z reguł i wylicz wyjście.',
  'l5.why.checkInBoth': 'Przecięcie spełnia obie reguły, więc sprawdź je w obu.',
  'l5.why.readTheSharedRow': 'Znajdź odczyt, który wypada w obu tabelach.',

  // --------------------------------------------- dlaczego · najbliższa prosta
  'l5.why.noReadingIsExact': 'Prawdziwe odczyty nigdy nie padają dokładnie na jedną prostą.',
  'l5.why.closestLineIdea': 'Najbliższa prosta leży blisko wszystkich odczytów naraz.',
  'l5.why.rateFromAllReadings': 'Każdy odczyt ciągnie tempo, nie tylko pierwszy i ostatni.',
  'l5.why.putTheInputIn': 'Wstaw {k} do najbliższej prostej.',
  'l5.why.gapIsReadingMinusLine': 'Luka to odczyt minus wartość, którą daje prosta.',
  'l5.why.signOfTheGap': 'Luka powyżej zera mówi, że odczyt leży nad prostą.',
  'l5.why.gapsAllOneSide': 'Luki, które trzymają jedną stronę, mówią, że prosta ma zły kształt.',
  'l5.why.predictIsNotMeasured': 'Wartość przewidziana wychodzi z rachunku, a nikt jej nie zmierzył.',

  // ----------------------------------------------------- dlaczego · części
  'l5.why.rowTotalIsTheWhole': 'Wewnątrz wiersza całością jest suma wiersza.',
  'l5.why.columnTotalIsTheWhole': 'Wewnątrz kolumny całością jest suma kolumny.',
  'l5.why.grandTotalIsTheWhole': 'W całej tabeli całością jest suma ogólna.',
  'l5.why.cellOverWhole': 'Zapisz pole nad tą całością i skróć.',
  'l5.why.riseTogetherIsPositive': 'Tempo powyżej zera mówi, że oba odczyty rosną razem.',
  'l5.why.fallAgainstIsNegative': 'Tempo poniżej zera mówi, że jeden odczyt spada, gdy drugi rośnie.',

  // ------------------------------------------------------ dlaczego · wzrost
  'l5.why.factorBetweenReadings': 'Podziel jeden odczyt przez poprzedni odczyt i dostaniesz czynnik.',
  'l5.why.backToTheStart': 'Czynnik podniesiony do zera to jeden. Więc przy zerze reguła daje ilość początkową.',
  'l5.why.percentFromFactor': 'Odejmij jeden od czynnika i pomnóż przez sto.',
  'l5.why.startTimesFactorPower': 'Reguła to ilość początkowa razy czynnik, podniesiony do wejścia.',
  'l5.why.tryEachStep': 'Sprawdzaj kolejne pozycje, aż pierwsza reguła obejmie prowadzenie.',
  'l5.why.factorBeatsStep': 'Czynnik bije krok, gdy tylko pozycja rośnie.',
};
