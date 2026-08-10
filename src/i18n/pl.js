export default {
  meta: {
    name: 'Polski',
    code: 'pl',
    title: 'ASCENT — Światy Szyfru',
    sub: 'ŚWIATY SZYFRU',
    description: 'ASCENT — Światy Szyfru. Latająca wyspa, skrzydło i dziesięć wyrw trzymanych otworem przez algebrę, która nie jest jeszcze prawdziwa.',
  },

  boot: {
    tip: 'Wiązanie sygnatury kadeta z siecią Skyren…',
    enter: 'Naciśnij dowolny klawisz, aby zacząć',
  },

  hud: {
    rank: 'Ranga',
    // Rzeczownik po liczebniku się odmienia: 1 odłamek, 3 odłamki, 12 odłamków.
    shards: '«n|one:Odłamek szyfru|few:Odłamki szyfru|many:Odłamków szyfru»',
    mastery: 'Spójność sieci',
    build: 'Buduj',
    objective: 'Cel',
    language: 'Język',
    // „MIEDŹ RANGA” to dwa rzeczowniki obok siebie, a nie podpis. Po polsku
    // podpis stoi przed wartością, którą opisuje.
    capOrder: 'before',
    readout: 'Spójność sieci {pct} · ranga {rank} · {n} {shards}',
  },

  // Dźwięk (src/audio). Klucze dodane przez warstwę dźwiękową.
  audio: {
    label: 'Dźwięk',
    on: 'Dźwięk włączony',
    off: 'Dźwięk wyłączony',
    mute: 'Wyłącz dźwięk',
    unmute: 'Włącz dźwięk',
    hint: 'M',
  },

  rank: {
    copper: 'Miedź',
    bronze: 'Brąz',
    silver: 'Srebro',
    gold: 'Złoto',
    sovereign: 'Suweren',
  },

  build: {
    wall: 'Ściana',
    ramp: 'Rampa',
    floor: 'Podłoga',
    beam: 'Belka',
    placed: 'Aksjomat ustawiony',
    denied: 'Tam nie ma oparcia',
    charge: 'Sieć',
    keySet: 'LPM · postaw',
    keyClear: 'Q · usuń',
    remove: 'Usuń',
    removePrompt: 'Q · usuń',
    noCharge: 'Ładunek sieci wyczerpany',
    alreadyThere: 'Tam już coś stoi',
    nothingThere: 'Nic na celowniku',
    anchorCall: 'Nad placem wiszą trzy kotwice. Z ziemi nie sięgniesz żadnej — więc przestań stać na ziemi.',
    anchorGot: 'Kotwica {n} z {total} zabezpieczona',
    anchorAll: 'Wszystkie trzy kotwice trzymają. Sieć ma już kręgosłup.',
    balance: 'Waga',
    balanceLaw: 'Co zrobisz jednej stronie, zrób i drugiej',
    areaModel: 'Model pola',
  },

  learn: {
    riftTitle: 'Wyrwa {n} — {skill}',
    prompt: 'Ustabilizuj wyrwę',
    submit: 'Ustaw',
    hint: 'Zapytaj Marlow',
    check: 'Sprawdź',
    correct: 'Sieć trzyma.',
    incorrect: 'Wymyka się. Spójrz jeszcze raz.',
    close: 'Zamknij',
    yourAnswer: 'Twoja odpowiedź',
    tapToType: 'Wpisz wartość',
    mastered: '{skill} — opanowane',
    unlocked: 'Otwarta nowa linia wyrw: {skill}',
    streak: '{n} pod rząd',
  },

  marlow: {
    greet: 'Marlow. Inteligencja nawigacyjna, lekko uszkodzona, przeważnie szczera. A ty najwyraźniej jesteś kadetem.',
    firstRift: 'To rozdarcie w powietrzu to wyrwa. Trzyma ją zdanie, które jeszcze nie jest prawdziwe. Uczyń je prawdziwym, a się zamknie. Proste. Przerażające. Śmiało.',
    balance: 'Obie strony tej belki dźwigają ten sam ciężar. Co zrobisz jednej, zrób i drugiej, bo się przechyli.',
    encourage: 'Źle, ale pożytecznie źle. Na tym polega większość nauki.',
    nearMastery: 'Sieć jest tu prawie cała. Jeszcze jedna i otworzy się cały ten pas nieba.',
  },

  skills: {
    'var-meaning': 'Czytanie zmiennej',
    'eval-expr': 'Obliczanie wyrażeń',
    'order-ops': 'Kolejność działań',
    'like-terms': 'Redukcja wyrazów podobnych',
    'distribute': 'Rozdzielność mnożenia',
    'one-step-add': 'Równania: jeden krok (+ −)',
    'one-step-mul': 'Równania: jeden krok (· :)',
    'two-step': 'Równania: dwa kroki',
    'multi-step': 'Równania: wiele kroków',
    'both-sides': 'Niewiadoma po obu stronach',
  },

  settings: {
    title: 'Ustawienia',
    language: 'Język',
    invertY: 'Odwróć oś pionową',
    sensitivity: 'Czułość kamery',
    reducedMotion: 'Ograniczony ruch',
    close: 'Zamknij',
  },

  controls: {
    move: 'Ruch',
    look: 'Rozglądanie',
    jump: 'Skok',
    sprint: 'Sprint',
    dash: 'Zryw',
    glide: 'Szybowanie',
    build: 'Postaw',
    interact: 'Interakcja',
  },

  // ---------------------------------------------------------------------
  // Stabilizator wyrw — powierzchnia nauki.
  // Tekst w odwróconych apostrofach składa się jako ścisły KaTeX.
  // ---------------------------------------------------------------------
  rift: {
    tag: 'Wyrwa {n}',
    ident: 'Wyrwa {code}',
    pressure: 'Napięcie wyrwy',
    streak: '{n} «n|one:czyste zamknięcie|few:czyste zamknięcia|many:czystych zamknięć»',
    disengage: 'Odłącz',
    ask: 'Wezwij echo',
    sealed: 'Sieć zamknięta',
    shards: 'Odłamki +{n}',
    trueNow: 'Prawda. Zamyka się.',
    stable: 'Stabilna',
    critical: 'Krytyczna',
    close: 'Opuść wyrwę',

    seal: {
      grip: 'Chwyt na linii',
      line: 'Linia się trzyma',
    },

    kind: {
      check: 'Próba dowodowa · {n}/{m}',
      review: 'Powtórka',
      interleave: 'Przypomnienie',
    },

    help: {
      keypad: 'Naładuj wartość, która czyni zdanie prawdziwym, i zatwierdź ją.',
      balance: 'Wybierz ruch. Belka wykona go po obu stronach — na tym polega całe prawo.',
      sort: 'Odeślij każdy wyraz do właściwej ładowni.',
      area: 'Pokryj każdą część pola powierzchnią, którą ona niesie.',
      choice: 'Jeden z tych odczytów jest prawdziwy. Reszta to typowe pomyłki.',
    },

    keypad: {
      charge: 'Ładunek',
      set: 'Zatwierdź',
      back: 'Usuń',
      minus: 'Minus',
      over: 'Kreska ułamkowa',
      empty: 'Brak ładunku',
      narrow: 'Zawęź pole',
      narrowed: 'Z szumu zostają trzy odczyty.',
    },

    balance: {
      tray: 'Dostępne ruchy',
      moves: 'Ruchy',
      undo: 'Krok wstecz',
      both: 'Zastosowane po obu stronach',
      solved: 'Niewiadoma stoi sama.',
      closer: 'Bliżej. Niewiadoma się uwalnia.',
      further: 'Nadal prawda — ale niewiadoma jest teraz zakopana głębiej.',
    },

    sort: {
      tray: 'Luźne wyrazy',
      vars: 'Wyrazy z `{v}`',
      nums: 'Czyste liczby',
      total: 'Suma ładowni',
      empty: 'Pusto',
      rejected: 'Ta ładownia tego nie przyjmie.',
    },

    area: {
      title: 'Pole szyfru',
      depth: 'Wysokość',
      width: 'Szerokość',
      total: 'Pole całkowite',
      none: 'Nic nie pokryte',
      slot: 'Ustaw pole',
      tray: 'Odłamki pola',
      rejected: 'To nie pokrywa tej części pola.',
    },

    echo: {
      label: 'Echo',
      cadet: 'Kadet {name} · Wyprawa {n}',
      slip: 'Kadet {name} stał tu kiedyś i potknął się dokładnie tak samo.',
      trace: 'Kadet {name} stał tu kiedyś. To ślad, który po sobie zostawił.',
      done: 'To wszystko, co kadet {name} po sobie zostawił.',
      analogue: 'Inna wyrwa, ten sam kształt. Kadet {name} zostawił tu całe rozwiązanie.',
      fades: 'Reszta śladu, który zostawił kadet {name}, wypaliła się.',
      sealedIt: 'Kadet {name} domknął ją wartością {answer}. Twoja wyrwa jest inna.',
      blank: 'Ostatnia linia spłonęła. Dokończ ją.',

      // Śladu nikt nie podaje na tacy. Wydziera się go z wyrwy warstwa po
      // warstwie, a każda warstwa kosztuje kolejne pchnięcie.
      call: 'Wezwij echo',
      backToTear: 'Wróć do wyrwy',
      backToTrace: 'Wróć do śladu',
      more: 'Drąż dalej',
      spent: 'Ślad się wyczerpał',
      depth1: 'Szept',
      depth2: 'Pierwszy ruch',
      depth3: 'Kształt',
      depth4: 'Cały ślad',
      firstMove: 'Z pożaru ocalał tylko pierwszy ruch. Reszta to popiół.',
      shape: 'Ocalał kształt całego rozwiązania. Wartość na końcu — nie.',
      cameBack: 'Echo wraca głośniej.',
      liveOnly: 'Osprzęt nie ma w zapisie innej wyrwy o tym kształcie. To twój własny ślad, odczytany z powrotem.',
      nudge: {
        keypad: 'Powiedz sobie to zdanie, zanim cokolwiek naładujesz. Szukasz wartości, która czyni je prawdziwym, a nie tej, która leży najbliżej.',
        balance: 'Coś przykleiło się do niewiadomej. Zdejmij najpierw to z wierzchu, a belka zrobi resztę.',
        sort: 'Dwa wyrazy są podobne tylko wtedy, gdy część z literą zgadza się co do joty. Liczba nigdy nie jest podobna do litery.',
        area: 'Czynnik z zewnątrz dotyka każdej części w środku. Każdej.',
        choice: 'Sprawdź każdy odczyt względem zdania. Nie wybieraj tego, który po prostu wygląda znajomo.',
      },
    },

    mis: {
      'letter-as-object': 'Odczytał literę jak przedmiot do policzenia, a nie jak liczbę.',
      'add-not-multiply': 'Połączył obie wielkości dodawaniem, choć sytuacja mówi o równych grupach.',
      'subtract-not-multiply': 'Połączył obie wielkości odejmowaniem, w kolejności, w jakiej padły w zdaniu.',
      'divide-not-multiply': 'Rozdzielił grupę między grupy, zamiast policzyć, ile ich jest razem.',
      'letter-as-position': 'Uznał miejsce litery w alfabecie za jej wartość.',
      'implicit-mult-missed': 'Dopisał liczbę obok litery, zamiast przez nią pomnożyć.',
      'neg-substitution': 'Zgubił minus przy podstawianiu.',
      'strict-left-right': 'Liczył po kolei od lewej, nie patrząc, co ma pierwszeństwo.',
      'exponent-as-mult': 'Odczytał potęgę jako mnożenie.',
      'neg-base-power': 'Podniósł do kwadratu także minus, nie tylko liczbę.',
      'combine-unlike': 'Wciągnął zwykłą liczbę do wyrazu z literą.',
      'coefficient-sign-lost': 'Zebrał wyraz, ale zostawił jego znak.',
      'x-and-x-squared': 'Potraktował kwadrat jak wyraz tego samego rodzaju.',
      'partial-distribute': 'Pomnożył tylko pierwszy składnik w nawiasie.',
      'neg-distribute': 'Przeniósł minus na jeden składnik, a na drugi nie.',
      'same-op-both': 'Powtórzył działanie, zamiast je odwrócić.',
      'one-side-only': 'Ruszył jedną stronę równowagi, a drugiej nie.',
      'subtract-coefficient': 'Odjął współczynnik, zamiast przez niego podzielić.',
      'div-direction': 'Podzielił w odwrotną stronę.',
      'wrong-unwrap-order': 'Podzielił, zanim usunął wyraz wolny.',
      'sign-on-constant': 'Dodał wyraz wolny tam, gdzie trzeba go było odjąć.',
      'distribute-then-forget': 'Otworzył nawias i nie zebrał tego, co z niego wypadło.',
      'collect-wrong-side': 'Przeniósł wyraz na drugą stronę bez zmiany znaku.',
      'no-solution-confusion': 'Odczytał fałszywą równość jako rozwiązanie.',
      'arith-slip': 'Metoda trzymała do samego końca. Zawiódł jeden rachunek.',
      'sign-slip': 'Każdy krok dobry; po drodze zgubił się minus.',
      'partial-rule': 'Zatrzymał się o jeden ruch za wcześnie i oddał wartość w połowie gotową.',
      'off-by-one-row': 'Odczytał sąsiedni wiersz dziennika, a nie ten wypalony.',
      'axis-swap': 'Czytał wzdłuż złej osi: wejście tam, gdzie pytano o wyjście.',
      'swapped-roles': 'Zbudował model, zamieniając obie wielkości miejscami.',
      unknown: 'Pomylił się dokładnie w tym miejscu.',
    },

    why: {
      letterIsNumber: 'Litera oznacza tu jedną konkretną liczbę.',
      numberAgainstLetter: 'Liczba napisana przy literze oznacza mnożenie.',
      subThenMul: 'Podstaw, a potem pomnóż.',
      startFrom: 'Zacznij od wyrażenia.',
      replaceWith: 'Wstaw `{n}` w miejsce `{v}`.',
      mulThenAdd: 'Najpierw mnożenie, potem dodawanie.',
      mulBindsTighter: 'Mnożenie ma pierwszeństwo przed dodawaniem.',
      doMulThenAdd: 'Wykonaj mnożenie, a potem dodawanie.',
      powBeforeMul: 'Potęgi liczymy przed mnożeniem.',
      subPowerBack: 'Wstaw obliczoną potęgę z powrotem.',
      mulThenSub: 'Pomnóż, a potem odejmij.',
      groupSameVar: 'Zbierz wyrazy o tej samej części literowej.',
      combineBoth: '`{a}` i `{b}` łączą się; `{c}` i `{d}` łączą się. Liczba i wyraz z `{v}` nigdy.',
      factorOutside: 'Czynnik przed nawiasem mnoży wszystko, co jest w środku.',
      twoProducts: 'Dwa osobne iloczyny — pole prostokąta przeciętego na dwie części.',
      multiplyEachOut: 'Wymnóż każdy z osobna.',
      beamBalances: 'Belka jest w równowadze: obie strony ważą tyle samo.',
      takeOff: 'Zdejmij `{n}` z obu stron, żeby równowaga została.',
      addOn: 'Dodaj `{n}` do obu stron, żeby równowaga została.',
      whatIsLeft: 'To, co zostaje, jest wartością niewiadomej.',
      groupsWeigh: '`{a}` grup po `{v}` waży `{c}`.',
      divideByCoef: 'Podziel obie strony przez współczynnik.',
      oneGroupWeighs: 'Jedna grupa waży właśnie tyle.',
      multipliedThenAdded: 'Niewiadomą pomnożono przez `{a}`, a potem dodano `{b}`.',
      multipliedThenTaken: 'Niewiadomą pomnożono przez `{a}`, a potem odjęto `{b}`.',
      unwrapReverse: 'Odwijaj w odwrotnej kolejności: najpierw usuń wyraz wolny.',
      thenDivideBy: 'Potem podziel obie strony przez `{a}`.',
      expandFirst: 'Najpierw otwórz nawias.',
      collectConstants: 'Zbierz liczby po lewej stronie.',
      nowTwoStep: 'Teraz to równanie na dwa kroki: usuń wyraz wolny.',
      divideBy: 'Podziel obie strony przez `{a}`.',
      bothSidesBalance: 'Niewiadoma stoi po obu stronach równowagi.',
      removeCrossing: 'Usuń `{term}` z obu stron — przy przejściu zmienia znak.',
      undoConstant: 'Usuń wyraz wolny.',
    },
  },

  // ---------------------------------------------------------------------
  // Łuk fabularny. Przestrzeń kluczy dodawana wyłącznie przez src/meta.
  // Marlow mówi sucho, ciepło i z lekką raną; nigdy jak maskotka, nigdy
  // jak cheerleaderka. Marlow jest „inteligencją”, stąd żeńska zgoda.
  // ---------------------------------------------------------------------
  story: {
    hud: {
      act: 'Rozdział {n}',
      question: 'Pytanie otwarte',
      dossier: 'Akta kadeta',
      hint: 'J',
      close: 'Zamknij',
      skip: 'Pomiń',
      continue: 'Dalej',
      toNext: '{rank} · brakuje {n}',
      summit: 'Szczyt zakonu',
      // Szybszy zegar: wyrwy zamknięte na tym odłamku — to one przewracają
      // rozdział. Rusza przy każdej poprawnej odpowiedzi.
      sealed: 'Zamknięte wyrwy',
      toChapter: '«n|one:jeszcze #|few:jeszcze #|many:jeszcze #» do rozdziału {ch}',
      sealsAll: 'Wszystkie rozdziały otwarte',
      sealsAt: '«n|one:# zamknięta wyrwa|few:# zamknięte wyrwy|many:# zamkniętych wyrw»',
      plusSeal: '+1',
    },

    place: {
      // The stamp prints this line above `lattice`, so it must not govern the
      // next line: Polish "nad" would demand the instrumental "Siecią Skyren",
      // and a name is stamped in the nominative. A self-contained label instead.
      approach: 'Podejście do lądowania',
      lattice: 'Sieć Skyren',
      shard: 'Odłamek Dziewiąty · lądowisko kadetów',
      when: 'Pierwsze światło · czwarty dzień rozdarcia',
    },

    marlow: {
      name: 'Marlow',
      role: 'Inteligencja nawigacyjna · odzyskana w 61%',
    },

    open: {
      l1: 'Sieć Skyren, Odłamek Dziewiąty. Grawitacja w normie, powietrze zdatne do oddychania, niebo lekko w płomieniach. Witaj w domu — w najluźniejszym możliwym sensie tych trzech słów.',
      l2: 'Jestem Marlow. Inteligencja nawigacyjna, lekko uszkodzona, przeważnie szczera. A ty jesteś tym kadetem. Wyobrażałam sobie kogoś z większym ekwipunkiem.',
      l3: 'Wszystko pod twoimi butami jest wnioskiem. Dziewięć tysięcy odłamków świata, każdy wsparty na jednym ogromnym wywodzie, który założyciele spisali i którego od tamtej pory nikt nie przeczytał. Gdzie wywód się trzyma, tam jest grunt.',
      l4: 'A gdzie zawodzi — jest tamto. Wyrwa: zdanie, którego sieć nie potrafi już uzasadnić, trzymane otworem w powietrzu, dopóki ktoś nie uczyni go prawdziwym.',
      l5: 'Co prowadzi mnie do tego, czego wolałabym nie mówić na głos. Odłamek Dziewiąty stoi od dziewięciuset lat. Więc co dokładnie zaczęło go rozrywać cztery dni temu?',
    },

    ch1: {
      title: 'Pytanie bez odpowiedzi',
      quest: 'Odłamek Dziewiąty trzyma się od dziewięciu wieków. Dowiedz się, co zmieniło się cztery dni temu.',
    },
    ch2: {
      title: 'Kadeci przed tobą',
      quest: 'Setki stały dokładnie tam, gdzie ty. Dowiedz się, gdzie się zatrzymali.',
      b1: 'Trzy zamknięte wyrwy. Sieć cię zauważyła — a zdziwiłoby cię, ilu kadetów nie zauważa nigdy.',
      b2: 'W czasie twojej pracy przeczytałam ślady, które osprzęt wygrzebuje z rozdarć. To nie są symulacje. Kadeci stali dokładnie tam, gdzie ty stoisz. Setki.',
      b3: 'Wszyscy zdolni. Wszyscy się zatrzymali. Żaden zapis nie mówi dlaczego, a to jest ten rodzaj ciszy, za który ktoś płaci.',
    },
    ch3: {
      title: 'Lemat dziewiąty',
      quest: 'Jeden krok dowodu założycielskiego nigdy nie został dokończony. Wejdź dość wysoko, by go dokończyć.',
      b1: 'Siedem zamkniętych zdań. Taki ciężar wystarczy, by zażądać dowodu założycielskiego, więc zażądałam go za ciebie. Cztery miliony kroków. Dziewięćset lat. Szczelny na całej długości — poza krokiem dziewiątym.',
      b2: 'Krok dziewiąty nie jest dowiedziony. Jest założony. Jedno słowo na marginesie, napisane w pośpiechu, czyjąś własną ręką: załóżmy.',
      b3: 'Dziewięć tysięcy światów stoi na kroku, którego nikt nie dokończył. Wyrwy to nie uszkodzenia, kadecie. To krok dziewiąty wraca i pyta.',
    },
    ch4: {
      title: 'Ręka na marginesie',
      quest: 'Dokończ to, co zaczęła Marlow.',
      b1: 'Szesnaście wyrw zamkniętych na Odłamku Dziewiątym. Jest coś, o czym od czterech dni starannie milczę, a przy szesnastu przestaję.',
      b2: 'Pismo na marginesie jest moje. To ja byłam kadetem na Odłamku Dziewiątym. Odłamek spadał, miałam jedenaście minut, a krok założony trzyma świat dokładnie tak samo dobrze jak dowiedziony — dokładnie do chwili, w której przestaje.',
      b3: 'Przeprowadziłam do tej strony dziewięćset lat kadetów. Każdy z nich był świetny. Każdy zatrzymał się na tej samej linijce. Bardzo bym chciała pomylić się co do ciebie.',
    },
    ch5: {
      title: 'Podpisane',
      quest: 'Dopisz zakończenie kroku dziewiątego, a pod nim nazwisko.',
      b1: 'Dwadzieścia osiem wyrw. Gdzieś w tym rachunku sieć przestała traktować cię jak pogodę, a zaczęła jak autora.',
      b2: 'Dokończ resztę. Suweren może dopisać wiersz do dowodu, a cokolwiek ten wiersz mówi — istnieje. Dobieraj słowa.',
    },
    coda: {
      title: 'Dziewięćset lat ciszy',
      quest: 'Dowód jest zamknięty. Idź i zobacz, co powstało.',
      c1: 'Wpisuje się samo. Krok dziewiąty brzmi teraz: dowiedziony, a pod nim, w miejscu na nazwisko założyciela, stoi nazwisko kadeta.',
      c2: 'Dziewięć tysięcy odłamków właśnie przestało się spierać. Gdzieś za linią chmur niebo ucichło pierwszy raz od dziewięciu wieków.',
      c3: 'Pomyliłam się co do ciebie. Proszę to odnotować, razem z tym, że nigdy niczego nie lubiłam bardziej.',
    },

    cite: {
      copper: 'Potrafisz utrzymać zdanie w mocy. Na tym polegają całe wymagane kwalifikacje, a mało kto im sprosta.',
      bronze: 'Dwie linie utrzymane. Sieć zaczyna prowadzić burze wokół ciebie, a nie przez ciebie.',
      silver: 'Połowa dowodu w twojej dłoni. Srebro może otworzyć tekst założycielski i przeczytać, ile kosztował.',
      gold: 'Złoto przechodzi między odłamkami bez eskorty. Niewiele tu na górze jest dla ciebie jeszcze groźne.',
      sovereign: 'Suweren może dopisać wiersz do dowodu. Cokolwiek ten wiersz mówi — istnieje.',
    },

    rite: {
      ascended: 'Awans',
      arrow: '{from} → {to}',
      standing: 'Ranga',
    },

    dossier: {
      title: 'Akta kadeta',
      sub: 'Sieć Skyren · Odłamek Dziewiąty',
      ladder: 'Wspinaczka',
      standing: 'Co sieć zdążyła zobaczyć',
      log: 'Dziennik terenowy',
      lines: 'Dziesięć linii',
      question: 'Pytanie otwarte',
      locked: 'Zapieczętowane do rangi: {rank}',
      lockedAt: 'Otwiera się przy «n|one:# zamkniętej wyrwie|few:# zamkniętych wyrwach|many:# zamkniętych wyrwach»',
      tally: 'Wyrwy zamknięte tutaj',
      lockedCoda: 'Zapieczętowane do zamknięcia dowodu',
      lockedShort: 'Zapieczętowane',
      here: 'Tutaj jesteś · {have} z {need}',
      costs: 'Otwiera się przy {n}',
      outOf: 'z {n}, które odłamek może przyznać',
      current: 'Tutaj jesteś',
      held: 'Utrzymana',
      openState: 'Otwarta',
      shut: 'Jeszcze nie twoja',
      integrity: 'Spójność sieci',
      close: 'Zamknij akta',
      footer: 'Dziewięć tysięcy odłamków. Jeden wywód. Jeden niedokończony krok.',
    },

    stand: {
      seals: 'Zamknięte zdania',
      sealsNote: 'Trzy za czyste zamknięcie, dwa za zamknięcie ze wsparciem — i zatrzymuje się na dwudziestu sześciu. Potem łatwe wyrwy nie płacą już nic w stronę rangi.',
      proving: 'Próby dowodowe',
      provingNote: 'Trzy za każde zadanie utrzymane w próbie dowodowej: bez wsparcia, w nieznanej postaci, z wysokiego poziomu.',
      lattice: 'Otwarta sieć',
      latticeNote: 'Dwa za każdą linię, którą sieć otworzyła pod tobą. Zdobywa się to wymaganiami, nie odpowiedziami.',
      lines: 'Utrzymane linie',
      linesNote: 'Po dziewięć i bez sufitu. Powyżej srebra to praktycznie jedyne, co zostaje.',
    },

    standard: {
      shard: 'Odłamek Dziewiąty',
      motto: 'To, co się tu trzyma, utrzymała czyjaś ręka.',
      tally: '«n|one:# wyrwa zamknięta tą ręką|few:# wyrwy zamknięte tą ręką|many:# wyrw zamkniętych tą ręką»',
    },

    voice: {
      firstRift: 'To rozdarcie przed tobą to wyrwa. Wejdź w nie, a osprzęt wyświetli zdanie na szybie. Naciśnij E — albo cokolwiek wolą twoje ręce.',
      firstSeal: 'Utrzymało się. To zdanie jest teraz trwałą cechą rzeczywistości, a zrobiły to twoje ręce.',
      standard: 'Obelisk na placu to Wzorzec. Prowadzi jedyny szczery zapis o tobie: pięć pasów, po jednym na rangę, i pierścień światła dokładnie na wysokości twojej pozycji. Właśnie drgnął. I będzie się przesuwał dalej.',
      capped: 'Zamknięte, ale rejestr przestał za takie płacić. Wszystko, co łatwa wyrwa może dać, już zostało wzięte. Od teraz pozycja bierze się z utrzymanych linii, a utrzymanie linii kosztuje prawdziwą pracę.',
      wrong: [
        'Źle, ale pożytecznie źle. Na tym polega większość nauki.',
        'Nie. Sieć jest pedantką. Chce wartości prawdziwej, nie tej obok.',
        'To byłaby prześliczna odpowiedź na trochę inne pytanie.',
        'Rozdarcie nawet nie drgnęło. Popatrz jeszcze raz, co przykleiło się do niewiadomej.',
        'Nikt nie zamyka takiej za pierwszym razem. Dwóch kadetów przez dziewięć wieków twierdziło inaczej. Obaj kłamali.',
        'Spokojnie. To zdanie nie próbuje cię oszukać; ono po prostu nie jest dokończone.',
      ],
      right: [
        'Zamknięte. Niebo nad twoją głową jest odrobinę mniej kłamstwem.',
        'Trzyma. W zapisie: bez wsparcia — a tylko takie sieć liczy.',
        'Czysto. Gdzieś krok, który dźwiga ciężar, właśnie przestał narzekać.',
        'Tak się to robi. Po cichu, a potem świat przestaje drżeć.',
        'Dobrze. Sieć nie dziękuje. Zrobię to w jej imieniu.',
      ],
      streak: 'Cztery pod rząd. Wyrwa zaczyna to brać do siebie.',
      // Mówione pod rytuałem, gdy kadr już się otworzył.
      rank: [
        'Wzorzec ma twoje nazwisko wykute przy randze {rank}. To kamień: nie schlebia i nie zaokrągla w górę.',
        '{rank}. Zakon podniósł swoją ocenę ciebie, czego zakon bardzo nie lubi robić.',
        'Odnotowane: {rank}. W pewnym bardzo starym rejestrze jest wpis, którego rano tam nie było.',
        '{rank}, i zdobyte w jedynej walucie, jaką sieć uznaje: w liniach, które trzymają, gdy nikt nie pomaga.',
      ],
      nearMastery: 'Sieć jest wzdłuż tej linii prawie cała. Jeszcze jedna i otworzy się ćwiartka nieba.',
      close: [
        'Jedna czysta odpowiedź dzieli cię od utrzymania linii „{skill}” na stałe. Bez wsparcia, inaczej sieć jej nie zaliczy — nie ja pisałam tę regułę, ja ją tylko złamałam.',
        'Linia „{skill}” jest o jedną uczciwą odpowiedź od bycia twoją na zawsze. Za tymi drzwiami leży dziewięć punktów pozycji.',
        'Brakuje jednej odpowiedzi bez wsparcia, żeby zamknąć linię „{skill}”. Nie spiesz się: ta linia czekała dziewięćset lat.',
      ],
      held: [
        'Linia „{skill}” utrzymana. Już się nie otworzy: ani od pogody, ani od czasu, ani ode mnie.',
        'Linia „{skill}” zamknięta. Dziewięć punktów pozycji, a wszystkie zastrzeżenia, które osprzęt trzymał wobec ciebie, odpadły naraz.',
        'Sieć przestała się spierać o linię „{skill}”. To kawałek nieba, który zostaje na górze niezależnie od tego, co zrobimy dalej.',
      ],
      lineHeld: [
        'Linia utrzymana. Zostaje dziewięć i wszystkie są łatwiejsze od pierwszej.',
        'Kolejna linia zamknięta. Osprzęt przestał się co do ciebie asekurować.',
        'Ta linia już się nie otworzy. Ani od pogody, ani od czasu.',
      ],
      fall: 'Pod światem też jest powietrze. Znacznie mniej użyteczne.',
      idle: 'Nie spiesz się. Wyrwa nigdzie się nie wybiera. I to jest właśnie problem.',
      returning: 'Znowu tu jesteś. Statystycznie to najtrudniejsza część, więc gratulacje dla statystyki.',
    },
  },
};
