export default {
  meta: {
    name: 'Polski',
    code: 'pl',
    title: 'ASCENT — Światy Szyfru',
    sub: 'ŚWIATY SZYFRU',
    description: 'ASCENT — Światy Szyfru. Latająca wyspa, skrzydło i dziesięć wyrw trzymanych otworem przez algebrę, która nie jest jeszcze prawdziwa.',
  },

  boot: {
    tip: 'Wiązanie twojej sygnatury kadeta z Odłamkiem Dziewiątym…',
    enter: 'Naciśnij dowolny klawisz, aby zacząć',
  },

  hud: {
    rank: 'Ranga',
    // Rzeczownik po liczebniku się odmienia: 1 drobina, 3 drobiny, 12 drobin.
    shards: '«n|one:Drobina szyfru|few:Drobiny szyfru|many:Drobin szyfru»',
    mastery: 'Świat naprawiony',
    build: 'Buduj',
    objective: 'Cel',
    language: 'Język',
    // „MIEDŹ RANGA” to dwa rzeczowniki obok siebie, a nie podpis. Po polsku
    // podpis stoi przed wartością, którą opisuje.
    capOrder: 'before',
    readout: 'Świat naprawiony {pct} · ranga {rank} · {n} {shards}',
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
    placed: 'Postawione',
    denied: 'Tam nie ma oparcia',
    charge: 'Zapas budowy · odnawia się sam',
    // The number beside the gauge is pieces standing, not charge left.
    pieces: '«n|one:# element|few:# elementy|many:# elementów»',
    keySet: 'LPM · postaw',
    keyTurn: 'F · obróć',
    keyClear: 'Q · usuń',
    turn: 'Obróć',
    // --- własna krata nigdy nie może cię zamknąć (src/build/builder.js) ---
    wouldSeal: 'Tak byś się zamurował',
    sealAsk: 'Tak się zamurujesz — kliknij jeszcze raz, jeśli mimo to chcesz',
    sealAgain: 'Kliknij jeszcze raz, żeby się zamurować',
    boxedIn: 'Własna krata cię zamurowała',
    cutFree: 'Wyjście otwarte',
    cutKey: 'Q',       // i18n-allow: a keycap, and the same cap on every layout
    cutKeyPad: 'LB',   // i18n-allow: the console's own name for that shoulder
    remove: 'Usuń',
    removePrompt: 'Q · usuń',
    noCharge: 'Zapas budowy wyczerpany. Poczekaj, aż się odnowi.',
    alreadyThere: 'Tam już coś zbudowano',
    nothingThere: 'Nic na celowniku',
    latticeFull: 'Krata pełna — najpierw usuń jakiś element',
    anchorCall: 'Nad placem wiszą trzy kotwice. Z ziemi nie sięgniesz żadnej. Więc przestań stać na ziemi.',
    anchorGot: 'Kotwica {n} z {total} zabezpieczona',
    anchorAll: 'Wszystkie trzy kotwice trzymają. Sieć ma już kręgosłup.',
    balance: 'Waga',
    balanceLaw: 'Co zrobisz jednej stronie, zrób i drugiej',
    areaModel: 'Model pola',
    // --- wyposażenie: element, który się kupuje, a nie dostaje ---
    vault: 'Płyta wyrzutni',
    noShards: 'Za mało drobin na ten element',
    fixed: 'To nie twoja robota, więc tego nie rozbierzesz',
    // --- pierwszy kontakt: ręka do kraty jest schowana, dopóki jej nie dobędziesz (src/build) ---
    handOut: 'Ręka budowlana gotowa',
    handStowed: 'Ręka budowlana schowana. Naciśnij 1–4, żeby wybrać element',
  },

  learn: {
    riftTitle: 'Wyrwa {n} — {skill}',
    prompt: 'Ustabilizuj wyrwę',
    submit: 'Zapieczętuj',
    hint: 'Zapytaj Marlow',
    check: 'Sprawdź',
    correct: 'Linia trzyma.',
    incorrect: 'Jeszcze nie jest prawdą. Spójrz jeszcze raz.',
    close: 'Zamknij',
    yourAnswer: 'Twoja odpowiedź',
    tapToType: 'Wpisz wartość',
    mastered: '{skill} — opanowane',
    unlocked: 'Otwarta nowa linia wyrw: {skill}',
    streak: '{n} pod rząd',
  },

  marlow: {
    greet: 'Marlow. Inteligencja nawigacyjna, lekko uszkodzona, przeważnie szczera. A ty najwyraźniej masz stopień kadeta.',
    firstRift: 'Ten pierścień rozdartego powietrza to wyrwa. Trzyma ją zdanie, które jeszcze nie jest prawdziwe. Uczyń je prawdziwym, a się zamknie. Proste. Przerażające. Śmiało.',
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
    'bracket-both-sides': 'Nawiasy po obu stronach',
    'fraction-solve': 'Równania z ułamkiem',
    'rule-from-table': 'Reguła z tabeli',
  },

  course: {
    algebra1: { title: 'Algebra I' },
    algebra2: { title: 'Algebra II' },
    geometry: { title: 'Geometria' },
    trigonometry: { title: 'Trygonometria' },
  },
  unit: {
    'algebra1-l1': { title: 'Poziom 1 — Język równowagi' },
    'algebra1-l2': { title: 'Poziom 2 — Struktura i tempo' },
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
    recover: 'Wydostań się',
  },

  // ---------------------------------------------------------------------
  // Pierwszy kontakt — karta sterowania i wyjście z zaklinowania.
  // Dodatkowa przestrzeń nazw należąca do src/player (controls.js,
  // controller.js). Skrót dzieli się na klawisze po kropce środkowej.
  // ---------------------------------------------------------------------
  firstrun: {
    title: 'Sterowanie',
    got: 'Jasne',
    recovered: 'Znowu na otwartym gruncie',
    stuck: {
      title: 'Zaklinowany',
      body: 'Coś cię trzyma. Naciśnij „Wydostań się”, żeby wrócić na otwarty grunt. Tutaj nigdy nie trzeba przeładowywać strony.',
      act: 'Wydostań się',
    },
    bind: {
      kbm: {
        move: 'W · A · S · D',
        look: 'Mysz',
        jump: 'Spacja',
        glide: 'Przytrzymaj spację',
        interact: 'E',
        build: '1–4 · LPM · F',
        dash: 'C · Lewy ctrl',
        recover: 'R',
      },
      pad: {
        move: 'Lewy drążek',
        look: 'Prawy drążek',
        jump: 'A',
        glide: 'Y',
        interact: 'X',
        build: 'LB · RT · Krzyżak obraca',
        dash: 'B',
        recover: 'Back',
      },
      touch: {
        move: 'Lewy kciuk',
        look: 'Przeciągnij w prawo',
        jump: 'Skok',
        glide: 'Szybowanie',
        interact: 'Interakcja',
        build: 'Stojak · Postaw',
        dash: 'Zryw',
        recover: 'Wydostań się',
      },
    },
  },

  // ---------------------------------------------------------------------
  // Menu — pauza, pomoc i ustawienia. Dodatkowa przestrzeń nazw należąca do
  // src/ui/menu.js. Skrót tnie się na klawisze po interpunkcie, tak samo jak
  // w karcie sterowania.
  // ---------------------------------------------------------------------
  menu: {
    open: 'Menu',
    title: 'W gotowości',
    sub: 'Tam na zewnątrz nic się nie ruszy, dopóki nie wrócisz.',
    resume: 'Wróć do przebiegu',
    controls: 'Sterowanie',
    screens: 'Ekrany',
    settings: 'Ustawienia',
    sens: 'Czułość rozglądania',
    invert: 'Odwróć oś pionową',
    on: 'Wł.',
    off: 'Wył.',
    now: 'Co robić teraz',
    nowBody: 'Wyrwa to pierścień rozdartego powietrza. Każda wyrwa trzyma zdanie matematyczne, które nie jest jeszcze prawdziwe. Wejdź w pierścień. Naciśnij {key}. Spraw, żeby zdanie stało się prawdziwe, a wyrwa zamknie się na dobre.',
    screen: {
      progress: 'Raport postępów',
      dossier: 'Akta kadeta',
      controls: 'Karta sterowania',
      menu: 'To menu',
    },
    bind: {
      kbm: {
        sprint: 'Shift',
        progress: 'P',
        dossier: 'J',
        controls: '?',
        menu: 'Esc · F1',
      },
      pad: { sprint: 'L3 · LT' },
      touch: { sprint: 'Wychyl drążek' },
    },
  },

  // ---------------------------------------------------------------------
  // Stabilizator wyrw — powierzchnia nauki.
  // Tekst w odwróconych apostrofach składa się jako ścisły KaTeX.
  // ---------------------------------------------------------------------
  rift: {
    tag: 'Wyrwa {n}',
    ident: 'Wyrwa {code}',
    pressure: 'Wciąż otwarta',
    streak: '{n} «n|one:czyste zamknięcie|few:czyste zamknięcia|many:czystych zamknięć»',
    disengage: 'Odłącz',
    ask: 'Wezwij echo',
    sealed: 'Sieć zamknięta',
    shards: 'Drobiny +{n}',
    trueNow: 'Prawda. Wyrwa się zamyka.',
    stable: 'Stabilna',
    critical: 'Krytyczna',
    close: 'Opuść wyrwę',

    seal: {
      grip: 'Chwyt na linii',
      line: 'Linia się trzyma',
    },

    kind: {
      check: 'Próba dowodowa · {n} z {m}',
      probe: 'Z marszu',
      review: 'Powrót do niej',
      interleave: 'Z pamięci',
      deep: 'Sondowanie · {n}',
    },

    help: {
      keypad: 'Wpisz wartość, która czyni zdanie prawdziwym. Potem naciśnij „Zapieczętuj”.',
      balance: 'Wybierz ruch. Belka wykona go po obu stronach. Po obu, za każdym razem — na tym polega całe prawo.',
      sort: 'Odeślij każdy wyraz do właściwej ładowni.',
      area: 'Pokryj każdą część pola powierzchnią, którą ta część niesie.',
      choice: 'Jeden z tych odczytów jest prawdziwy. Reszta to typowe pomyłki.',
    },

    keypad: {
      charge: 'Twoja odpowiedź',
      set: 'Zapieczętuj',
      back: 'Usuń',
      minus: 'Minus',
      over: 'Kreska ułamkowa',
      empty: 'Najpierw wpisz wartość',
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
      further: 'Nadal prawda. Ale niewiadoma siedzi teraz głębiej.',
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
      slot: 'Połóż tu pole',
      tray: 'Elementy pola',
      rejected: 'To nie pokrywa tej części pola.',
    },

    echo: {
      label: 'Echo',
      cadet: 'Kadet {name} · Wyprawa {n}',
      slip: 'Kadet {name} stał tu kiedyś i potknął się dokładnie tak samo.',
      trace: 'Echo to praca, którą inny kadet zostawił w tej wyrwie. Podpis: {name}. Czytaj krok po kroku.',
      done: 'To wszystko, co zostało po kadecie {name}.',
      analogue: 'Inna wyrwa, ten sam kształt. Po kadecie {name} zostało tu całe rozwiązanie.',
      fades: 'Reszta śladu po kadecie {name} wypaliła się.',
      sealedIt: 'Kadet {name} domknął ją wartością {answer}. Twoja wyrwa jest inna.',
      blank: 'Ostatnia linia spłonęła. Dokończ ją.',

      // Śladu nikt nie podaje na tacy. Wydziera się go z wyrwy warstwa po
      // warstwie, a każda warstwa kosztuje kolejne pchnięcie.
      call: 'Wezwij echo',
      backToTear: 'Wróć do wyrwy',
      backToTrace: 'Wróć do śladu',
      more: 'Drąż dalej — o warstwę głębiej',
      tier: 'Warstwa {n} z {of}',
      spent: 'Nie ma już śladu',
      depth1: 'Szept — pierwsza wskazówka',
      depth2: 'Pierwszy ruch — jak zaczęli',
      depth3: 'Kształt — cała metoda',
      depth4: 'Cały ślad — każdy krok',
      firstMove: 'Z pożaru ocalał tylko pierwszy ruch. Reszta to popiół.',
      shape: 'Ocalał kształt całego rozwiązania. Wartość na końcu — nie.',
      cameBack: 'Echo wraca głośniej.',
      liveOnly: 'Osprzęt nie ma w zapisie innej wyrwy o tym kształcie. Więc echo pokazuje twoją własną pracę, odczytaną z powrotem.',
      nudge: {
        keypad: 'Powiedz sobie to zdanie, zanim cokolwiek wpiszesz. Szukasz wartości, która czyni je prawdziwym, a nie tej, która leży najbliżej.',
        balance: 'Coś przykleiło się do niewiadomej. Zdejmij najpierw to z wierzchu. Belka zrobi resztę.',
        sort: 'Dwa wyrazy są podobne tylko wtedy, gdy część z literą zgadza się co do joty. Liczba nigdy nie jest podobna do litery.',
        area: 'Czynnik z zewnątrz dotyka każdej części w środku. Każdej.',
        choice: 'Sprawdź każdy odczyt względem zdania. Nie wybieraj tego, który po prostu wygląda znajomo.',
      },
    },

    mis: {
      'letter-as-object': 'Odczytał literę jak przedmiot do policzenia, a nie jak liczbę.',
      'add-not-multiply': 'Dodał obie wielkości. Sytuacja tworzy równe grupy, więc trzeba mnożyć.',
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
      multipliedThenAdded: 'Równanie mnoży niewiadomą przez `{a}`, a potem dodaje `{b}`.',
      multipliedThenTaken: 'Równanie mnoży niewiadomą przez `{a}`, a potem odejmuje `{b}`.',
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
      sealed: 'Zamknięte wyrwy łącznie',
      toChapter: '«n|one:jeszcze #|few:jeszcze #|many:jeszcze #» do rozdziału {ch}',
      chapterNight: '«n|one:# utrzymana noc|few:# utrzymane noce|many:# utrzymanych nocy» do rozdziału {ch}',
      nextNight: '{rank} · «n|one:# utrzymana noc|few:# utrzymane noce|many:# utrzymanych nocy»',
      sealsAll: 'Wszystkie rozdziały otwarte',
      sealsAt: '«n|one:# zamknięta wyrwa łącznie|few:# zamknięte wyrwy łącznie|many:# zamkniętych wyrw łącznie»',
      plusSeal: '+1',
    },

    night: {
      held: 'Witaj z powrotem. Masz «n|one:# utrzymaną noc|few:# utrzymane noce|many:# utrzymanych nocy». Utrzymana noc to linia, która trzyma nadal po odejściu od maszyny.',
      due: 'Witaj z powrotem. «n|one:# linia czeka|few:# linie czekają|many:# linii czeka» na sprawdzenie. Sieć chce zobaczyć, co zostało. Potem do pracy.',
      none: 'Witaj z powrotem. Nie było cię «n|one:# dzień|few:# dni|many:# dni». Nic nie czeka. Wybierz szczelinę i ruszaj.',
    },
    day: {
      d2: {
        a: 'Drugi dzień. Jesteś z powrotem. Większość kadetów w rejestrze nie wróciła, a rejestr nie jest dla nich łaskawy.',
        b: 'Odłamek zauważył to przede mną. Coś pod placem osiadło w nocy o centymetr. To dobry rodzaj osiadania.',
      },
      d3: {
        a: 'Trzeci dzień. Zaczęłam zapisywać twoje czasy. Nikt mnie o to nie prosił i nie zamierzam przestać.',
        b: 'Dwa dni temu żadna linia nie przetrwała u ciebie nocy. Teraz przetrwa. Niech rejestr odnotuje, że wtedy nie powiedziałam nic miłego.',
      },
      d5: {
        a: 'Piąty dzień. Wczoraj w nocy znów przejrzałem tekst założycielski, szukając marginesu.',
        b: 'To wciąż moje pismo. Dziewięćset lat, a wstyd zachował się zadziwiająco dobrze.',
      },
      d8: {
        a: 'Ósmy dzień. Ruch w sieci znów prowadzi przez Odłamek Dziewiąty. Kiedyś nas omijał.',
        b: 'Nie mówię, że odłamek ci ufa. Mówię, że przestał się zabezpieczać.',
      },
      d13: {
        a: 'Trzynasty dzień. Dron zwiadowczy przeszedł rano i nie zapisał nas jako zagrożenia. Pierwszy raz od dziewięciu wieków.',
        b: 'Ktoś na drugim końcu sieci to zauważy. Niech zauważy.',
      },
      d21: {
        a: 'Dwudziesty pierwszy dzień. Cokolwiek innego jest prawdą, ten odłamek stoi, bo ktoś do niego wracał.',
        b: 'To ja napisałem słowo na marginesie. Ty kończysz zdanie. Mogę żyć z takim podziałem pracy.',
      },
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
      l2: 'Jestem Marlow. Inteligencja nawigacyjna, lekko uszkodzona, przeważnie szczera. A ty najwyraźniej masz stopień kadeta. Wyobrażałam sobie kogoś z większym ekwipunkiem.',
      l3: 'Wszystko pod twoimi butami jest wnioskiem. Dziewięć tysięcy odłamków świata, każdy wsparty na jednym ogromnym wywodzie, który założyciele spisali i którego od tamtej pory nikt nie przeczytał. Gdzie wywód się trzyma, tam jest grunt.',
      // Zdanie zawiasowe całego otwarcia. l3 kończy się na „tam jest grunt”, więc
      // l4 musi otwierać się tym samym „tam jest…” — echo jest tu całą retoryką:
      // ten sam szkielet zdania, a na jego końcu, zamiast gruntu, dziura.
      l4: 'A gdzie zawodzi — tam jest tamto. Wyrwa: zdanie, którego sieć nie potrafi już uzasadnić, trzymane otworem w powietrzu, dopóki ktoś nie uczyni go prawdziwym.',
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
      b2: 'W czasie twojej pracy przeczytałam ślady, które osprzęt wygrzebuje z wyrw. To nie są symulacje. Kadeci stali dokładnie tam, gdzie ty stoisz. Setki.',
      b3: 'Wszyscy zdolni. Wszyscy się zatrzymali. Żaden zapis nie mówi dlaczego, a to jest ten rodzaj ciszy, za który ktoś płaci.',
    },
    ch3: {
      title: 'Lemat dziewiąty',
      quest: 'Nikt nigdy nie dokończył jednego kroku dowodu założycielskiego. Wejdź dość wysoko, by go dokończyć.',
      b1: 'Siedem zamkniętych zdań. Taki ciężar wystarczy, by zażądać dowodu założycielskiego, więc zażądałam go za ciebie. Cztery miliony kroków. Dziewięćset lat. Szczelny na całej długości — poza krokiem dziewiątym.',
      b2: 'Krok dziewiąty nie jest dowiedziony. Jest założony. Jedno słowo na marginesie, napisane w pośpiechu, czyjąś własną ręką: załóżmy.',
      b3: 'Dziewięć tysięcy światów stoi na kroku, którego nikt nie dokończył. Wyrwy to nie uszkodzenia. To krok dziewiąty wraca i pyta.',
    },
    ch4: {
      title: 'Ręka na marginesie',
      quest: 'Dokończ to, co zaczęła Marlow.',
      b1: 'Szesnaście wyrw zamkniętych na Odłamku Dziewiątym. Jest coś, o czym od czterech dni starannie milczę, a przy szesnastu przestaję.',
      b2: 'Pismo na marginesie jest moje. To ja byłam kadetką na Odłamku Dziewiątym. Odłamek spadał, miałam jedenaście minut, a krok założony trzyma świat dokładnie tak samo dobrze jak dowiedziony — dokładnie do chwili, w której przestaje.',
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
      quest: 'Dowód się zamknął. Idź i zobacz, co powstało.',
      c1: 'Wpisuje się samo. Krok dziewiąty brzmi teraz: dowiedziony, a pod nim, w miejscu na nazwisko założyciela, stoi nazwisko kadeta.',
      c2: 'Dziewięć tysięcy odłamków właśnie przestało się spierać. Gdzieś za linią chmur niebo ucichło pierwszy raz od dziewięciu wieków.',
      c3: 'Pomyliłam się co do ciebie. Proszę to odnotować, razem z tym, że nigdy niczego nie lubiłam bardziej.',
    },

    watch: {
      title: 'Warta',
      quest: 'Dowód trzyma się, dopóki ktoś go niesie. Wróć, a nadal będzie twój.',
      due: 'Linie do sprawdzenia',
      stand: 'Obejmij wartę',
      next: 'Odłamek trzyma · następna {when}',
      nights: '«n|one:# utrzymana noc|few:# utrzymane noce|many:# utrzymanych nocy»',
      sounding: 'Sondowanie · {n}',
      soundingNone: 'Sonduj sieć',
      whenMin: 'za «n|one:# minutę|few:# minuty|many:# minut»',
      whenHour: 'za «n|one:# godzinę|few:# godziny|many:# godzin»',
      whenDay: 'za «n|one:# dzień|few:# dni|many:# dni»',
      whenSoon: 'niebawem',
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
      integrity: 'Świat naprawiony',
      close: 'Zamknij akta',
      footer: 'Dziewięć tysięcy odłamków. Jeden wywód. Jeden niedokończony krok.',
    },

    stand: {
      seals: 'Za zamknięte wyrwy',
      sealsNote: 'Trzy za czyste zamknięcie, dwa za zamknięcie ze wsparciem — i zatrzymuje się na dwudziestu sześciu. Potem łatwe wyrwy nie płacą już nic w stronę rangi.',
      proving: 'Za próby dowodowe',
      provingNote: 'Trzy punkty za każde zadanie utrzymane w próbie dowodowej. Bez wsparcia, w nieznanej postaci, z wysokiego poziomu.',
      lattice: 'Za otwarte linie',
      latticeNote: 'Dwa za każdą linię, którą sieć otworzyła pod tobą. Zdobywa się to wymaganiami, nie odpowiedziami.',
      lines: 'Za utrzymane linie',
      linesNote: 'Po dziewięć i bez sufitu. Powyżej srebra to praktycznie jedyne, co zostaje.',
    },

    standard: {
      shard: 'Odłamek Dziewiąty',
      motto: 'To, co się tu trzyma, utrzymała czyjaś ręka.',
      tally: '«n|one:# wyrwa zamknięta tą ręką|few:# wyrwy zamknięte tą ręką|many:# wyrw zamkniętych tą ręką»',
    },

    voice: {
      firstRift: 'Ten pierścień rozdartego powietrza przed tobą to wyrwa. Podejdź i naciśnij E — albo cokolwiek wolą twoje ręce — a osprzęt wyświetli zdanie na szybie.',
      firstSeal: 'Utrzymało się. To zdanie jest teraz trwałą cechą rzeczywistości, a zrobiły to twoje ręce.',
      standard: 'Obelisk na placu to Wzorzec. Prowadzi jedyny szczery zapis o tobie: pięć pasów, po jednym na rangę, i pierścień światła dokładnie na wysokości twojej pozycji. Właśnie drgnął. I będzie się przesuwał dalej.',
      capped: 'Zamknięte, ale rejestr przestał za takie płacić. Wszystko, co łatwa wyrwa może dać, już zostało wzięte. Od teraz pozycja bierze się z utrzymanych linii, a utrzymanie linii kosztuje prawdziwą pracę.',
      wrong: [
        'Źle, ale pożytecznie źle. Na tym polega większość nauki.',
        'Nie. Sieć jest pedantką. Chce wartości prawdziwej, nie tej obok.',
        'To byłaby prześliczna odpowiedź na trochę inne pytanie.',
        'Wyrwa nawet nie drgnęła. Popatrz jeszcze raz, co przykleiło się do niewiadomej.',
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

    // -----------------------------------------------------------------------
    // Marlow, według rejestru. Zob. `src/meta/voice.js`.
    //
    // Kanał miał jeden zestaw kwestii tła, napisany dla kadeta w pierwszych
    // dziesięciu minutach, i grał go jeszcze przy sto trzydziestym zamknięciu —
    // razem ze zdaniem tłumaczącym, czym jest wyrwa. Teraz są cztery rejestry,
    // wybierane z tego, co kadet naprawdę zrobił:
    //
    //   green    nic nie zamknięte. Jedyny rejestr, któremu wolno tłumaczyć.
    //   working  już umie pracować. Meldunek i zaczepka, zero objaśniania.
    //   veteran  za ostatnim rozdziałem. Koleżeństwo i wspólna historia.
    //   master   za rekordem. Marlow została przerośnięta i o tym wie.
    //
    // ZWROT BEZ PŁCI — to jest tu warunek, nie ozdobnik.
    //
    // Poprzedni audyt wykazał, że polskie kwestie mówiły do każdej dziewczyny
    // w klasie w rodzaju męskim. W polszczyźnie płeć adresata wychodzi na jaw
    // dokładnie w trzech miejscach: w czasie przeszłym («zamknąłeś»), w trybie
    // przypuszczającym («wyczułbyś») i w orzeczniku przymiotnikowym («jesteś
    // gotowy»). Żadna kwestia poniżej nie używa ani jednego z nich.
    //
    // Zamiast tego: czas teraźniejszy i przyszły złożony, które w drugiej
    // osobie są bezrodzajowe («zamykasz», «znajdziesz», «będziesz miał» — nie,
    // to ostatnie też nie: używamy «masz»); tryb rozkazujący («przeczytaj»,
    // «zwolnij»); formy bezosobowe na -no/-to («zanotowano», «użyto»);
    // rzeczowniki odsłowne («zatrzymanie», «zejście») i imiesłowy odnoszące się
    // do rzeczy, nie do osoby («zamknięte», «utrzymana» — o linii). Zamiast
    // «oboje wiemy» (co przesądzałoby płeć kadeta) — «wiemy, ty i ja».
    //
    // Marlow ma rodzaj: jest «ona» w całym scenariuszu i mówi o sobie
    // «przestałam», «powiedziałabym». To jej zgoda, nie zgoda grającego, i
    // dlatego wolno jej zostać.
    //
    // ASPEKT. Zamknięcie wyrwy jest jednorazowe i dokonane: «zamknąć»,
    // «zamknięte», «utrzymana». Praca, która trwa, jest niedokonana:
    // «zamykasz», «czytasz», «odpowiadasz». Pomylenie tych dwóch to najszybszy
    // sposób, żeby polski tekst brzmiał jak tłumaczenie z angielskiego.
    // -----------------------------------------------------------------------
    v: {
      wrong: {
        working: [
          'Nie. Gdzieś tam robisz właściwą rzecz, tylko po niewłaściwej stronie.',
          'Sieć odmawia. Odmawia różnym rzeczom od czasów sprzed twojego języka; nie bierz tego do siebie.',
          'Pudło. Masz na koncie tyle zamkniętych wyrw, że jestem raczej pewna, że znasz ten ruch i po prostu go nie wykonujesz.',
          'Nie to. Przeczytaj linijkę, która stoi wyżej — błąd zwykle mieszka piętro nad tym, na co patrzysz.',
          'Nie, i to ciekawe nie. To błąd, który ma kształt, a kształt przydaje mi się bardziej niż trafienie.',
        ],
        veteran: [
          'Źle. U ciebie to już dane, więc dziękuję — mówię to tylko z lekką ironią.',
          'Nie. Dziewięćset lat kadetów myliło się na tym samym, jeśli to pociecha. Im też nie było.',
          'Wymknęło się. Zamykasz takie zbyt długo, żebym obrażała cię tłumaczeniem, więc po prostu poczekam.',
          'Pudło. Widziałam dziś, jak nie mylisz się przy trudniejszych, co mówi mi, że jest późno, a nie że jest trudno.',
          'Wyrwa się utrzymała. Rzadki dziś przypadek. Wróć, zanim nabierze o sobie przekonania.',
        ],
        master: [
          'Źle — i musiałam to sprawdzić. Tego zdania nie powiedziałam jeszcze żadnemu kadetowi.',
          'Nie. W pewnym bardzo starym rejestrze właśnie zanotowano, że mimo wszystko jesteś człowiekiem.',
          'Pudło. Przy twoim rachunku to mniej więcej błąd zaokrąglenia, choć nie zamierzam tego wpisywać do akt.',
          'Ta cię dopadła. Dopada każdego raz; ty po prostu docierasz do niej później niż wszyscy.',
          'Nie. Mogłabym powiedzieć gdzie, ale znajdziesz to szybciej, niż zdążę wypowiedzieć. Zwykle znajdujesz.',
        ],
      },
      right: {
        working: [
          'Zamknięte. To jest ten rytm — odłamek już go słyszy.',
          'Trzyma. Idzie ci na tyle sprawnie, że zaczęłam zaokrąglać w dół czas, jakiego się po tobie spodziewam.',
          'Czysto. Osprzęt odnotował to przede mną, a osprzętowi niełatwo zaimponować.',
          'Dobrze. Kolejne zdanie, które będzie prawdziwe długo po tym, jak ty i ja przestaniemy.',
          'Zamknięte, bez wsparcia, w aktach. Ta ostatnia część jest tą, która się liczy.',
        ],
        veteran: [
          'Zamknięte. Przestałam opowiadać o każdym z osobna; brzmiałoby to protekcjonalnie.',
          'Trzyma. Gdzieś pod nami krok, który narzekał przez dziewięć wieków, właśnie ucichł.',
          'Czysto. Sieć zaczęła zakładać, że zamkniesz to, co otworzysz — a to najbliższa rzecz, jaką ma do zaufania.',
          'Gotowe. Odłamek zrasta się szybciej, niż się rozrywa, a to nigdy nie był kierunek podróży.',
          'Zamknięte. Powiedziałabym: dobra robota — ale słyszysz to ode mnie na tyle często, żeby wiedzieć, ile mnie kosztuje.',
        ],
        master: [
          'Zamknięte. Rejestrowi skończyły się porównania i po prostu zapisuje, co robisz.',
          'Trzyma. Nie mam już użytecznego komentarza: jesteś dalej niż ta część mapy, do której mam notatki.',
          'Czysto. Dziewięćset lat kadetów, a niebo nad Odłamkiem Dziewiątym nigdy nie było tak ciche w roboczy poranek.',
          'Zamknięte. Robisz to szybciej, niż znajduję do tego coś oschłego, i trochę mnie to złości.',
          'Gotowe. Gdzieś w tekście założycielskim jest margines z wolnym miejscem, a ja zaczęłam myśleć o twoim charakterze pisma.',
        ],
      },
      // Trzy pudła pod rząd. Ani bura, ani przytulanie: sygnał, nazwany na głos.
      slump: {
        green: [
          'Trzy pod rząd. To nie wyrok, to wtorek. Zwolnij i przeczytaj całą linijkę, zanim jej dotkniesz.',
          'Stop. Oddech. Wyrwa czekała dziewięćset lat; poczeka, aż się porządnie przyjrzysz.',
          'Trzy pudła. Pierwsza godzina każdego tak wygląda. Moja wyglądała gorzej, a miałam instrukcję.',
        ],
        working: [
          'Trzy. Coś w tym kształcie walczy akurat z tobą, a to jest warte więcej niż trzy łatwe zamknięcia.',
          'Opuść na chwilę rękę. Odpowiadasz szybciej, niż czytasz, a to nie jest ta sama czynność.',
          'Trzy pudła z rzędu. To nie zawalenie. To sygnał — i osprzęt już przestawia celownik.',
        ],
        veteran: [
          'Trzy. U ciebie to komunikat, a komunikat brzmi tak: ta linia jest naprawdę trudna, a nie że działasz na oślep.',
          'Są trzy. Nic pokrzepiającego ode mnie nie usłyszysz — i tak wyczuwasz takie rzeczy. Popatrz na drugi krok.',
          'Trzy pod rząd, a swoje rachunki sprawdziłam dwa razy. Ta jest trudna. Potraktuj ją poważnie, a się złoży.',
        ],
        master: [
          'Trzy z rzędu. Prowadzę zapisy od dziewięciu wieków i nie mam dla ciebie nic porównywalnego, więc nazwijmy to po prostu ciekawym.',
          'Trzy. Czymkolwiek jest ten kształt, to ostatnia rzecz na tym odłamku, która jeszcze się z tobą spiera. Chętnie popatrzę, jak ją kończysz.',
          'Trzy pudła. Jeśli mówisz, że to zmęczenie, uwierzę — i odnotuję też, że siedzisz w tym dłużej, niż wytrzymała większość kadetów.',
        ],
      },
      // Pierwsze zamknięcie po złej serii. Takt, na który stary kanał nie miał
      // ani jednej kwestii.
      recover: {
        green: [
          'Jest. Tak to wygląda, kiedy czytanie i odpowiadanie dzieją się we właściwej kolejności.',
          'Zamknięte. Cokolwiek właśnie zmieniasz w sposobie patrzenia, rób tak dalej.',
        ],
        working: [
          'Wracasz. To jest ta użyteczna część złej serii: wychodzisz z niej z czymś, czego wcześniej nie było.',
          'Zamknięte. Seria się złamała, a ty nie. Odnotowane, i nie pierwszy raz.',
        ],
        veteran: [
          'Jest. Robisz to dziś czwarty raz; przestałam się dziwić, a zaczęłam się interesować.',
          'Odzyskane. Większość kadetów, których tędy prowadziłam, nie wykrzesała z siebie czwartej próby.',
        ],
        master: [
          'I się składa. To jest ta część, której nikt nie zapisuje o ludziach takich jak ty. Nie to, że nigdy się nie mylisz — tylko to, że pomyłka nigdy nic ci nie zabiera.',
          'Zamknięte. Cokolwiek to było, trwało trzy pytania. Znam przypadki, w których trwało trzy pokolenia.',
        ],
      },
      idle: {
        green: [
          'Nie spiesz się. Wyrwa nigdzie się nie wybiera. I to jest właśnie problem.',
          'Bez pośpiechu. Choć zwrócę uwagę, że niebo się pali — powoli, dostojnie i bardzo dziewięćsetletnio.',
          'Nadal tam jesteś. Ja też, rzecz jasna. Nie mam dokąd pójść, a to dłuższa historia, niż chcesz teraz usłyszeć.',
        ],
        working: [
          'Kiedy zechcesz. Mam dziewięćset lat zaległości i nic z tego nie jest pilne tak, jak to.',
          'Milkniesz. To nie zarzut — z ciszy wzięła się większość dobrych odpowiedzi na tym odłamku.',
          'Odłamek się trzyma. Weź tę minutę. To jedyna waluta tutaj, której nie umiem skontrolować.',
        ],
        veteran: [
          'Zatrzymanie służy ci bardziej, niż służyło im wszystkim. Oni bez przerwy szli dalej. Nie pomogło.',
          'Nie zapełnię ciszy. Masz zasłużony horyzont; popatrz na niego.',
          'Nic ode mnie. Chociaż jeśli czekasz, aż niebo odezwie się pierwsze, uprzedzam: nigdy nie odezwało się pierwsze.',
        ],
        master: [
          'Wolno ci przestać. Widziałam ludzi, którzy nie potrafili, i to nie jest lepszy sposób istnienia.',
          'Powiedz słowo, a znajdę ci coś trudnego. A jeśli nie, z przyjemnością postoję tu, będąc przestarzała.',
          'To ta część, do której nie liczyłam, że dojdziemy: kadet na Odłamku Dziewiątym bez niczego pilnego do zrobienia. Powoli, bez pośpiechu.',
        ],
      },
      streak: {
        green: [
          'Cztery pod rząd. Wyrwa zaczyna to brać do siebie.',
          'Cztery z rzędu. Cokolwiek robisz oczami przed odpowiedzią, rób tak dalej.',
          'Cztery. Osprzęt właśnie po cichu podniósł to, czego się po tobie spodziewa.',
        ],
        working: [
          'Cztery bez przerwy. To już nie szczęście; szczęście nie ma rytmu.',
          'Kolejna seria. Odłamek przestał podsuwać ci łatwe, a ty tego nie zauważasz — i o to właśnie chodzi.',
          'Cztery czyste. Gdzieś planer, który się co do ciebie asekurował, przestał się asekurować.',
        ],
        veteran: [
          'Kolejna seria bez potknięcia. Przestałam liczyć na głos; zaczynało rozpraszać.',
          'Znowu nieprzerwana. Cokolwiek odłamek liczył, że obroni, przestał na to liczyć.',
          'Są w rejestrze kadeci, którzy nie mieli ani jednej takiej. Ty masz dziś kilka.',
        ],
        master: [
          'Kolejna czysta seria. Przestanę je ogłaszać: słyszysz zmianę tonu nieba tak samo dobrze jak ja.',
          'Nieprzerwana. W pewnym momencie seria przestaje być serią i staje się po prostu tym, jak ten odłamek działa.',
          'Wciąż idzie. Sieć zaczęła zapisywać twoje wyniki atramentem.',
        ],
      },
      fall: {
        green: [
          'Pod światem też jest powietrze. Znacznie mniej użyteczne.',
          'W dół to kierunek, nie plan. Lotnia na twoich plecach jest dokładnie do tego.',
          'Spadasz. Każdy spada: odłamek to dziewięć tysięcy kawałków z przerwami między nimi, a przerwy przenoszą obciążenie.',
        ],
        working: [
          'Znowu przez krawędź. Przynajmniej robisz to teraz z prędkością.',
          'Grunt się przesunął. Tak bywa. To jest dowód, a nie rzut poziomy.',
          'Lecisz. Spanikowałabym w twoim imieniu, ale robisz to na tyle często, że wiemy, jak się to kończy — ty i ja.',
        ],
        veteran: [
          'Przez krawędź. U ciebie założę, że to była nawigacja.',
          'Lecimy w dół. Dziewięćset lat i nikt nie ulepszył techniki polegającej na tym, żeby po prostu tam nie być.',
          'Spadasz. W zapisie będzie kontrolowane zejście, bo zapis prowadzę ja.',
        ],
        master: [
          'Lot w dół. Gdzieś bardzo stary rejestr jest zachwycony.',
          'Zejście poza krawędź. Postanowiłam zapisać to jako rozpoznanie.',
          'W dół. Powiedziałabym: uważaj — ale to odłamek ma więcej powodów, żeby bać się ciebie, niż odwrotnie.',
        ],
      },
      returning: {
        green: [
          'Znowu tu jesteś. Statystycznie to najtrudniejsza część, więc gratulacje dla statystyki.',
          'Wracasz. Prawie wszystko, co idzie tu źle, idzie źle w przerwie między jednym dniem a następnym, a ty właśnie tę przerwę zamykasz.',
          'Z powrotem. Wyrwy się nie przesunęły. Sprawdziłam dwa razy, co mówi coś o moim tygodniu.',
        ],
        working: [
          'Wracasz. Odłamek jest tam, gdzie został zostawiony, co na Odłamku Dziewiątym nie jest oczywiste.',
          'No jesteś. Zostawiłam rejestr otwarty. Nic w nim nie ostygło.',
          'Wracasz. Drugi dzień to miejsce, w którym rejestr się przerzedza; jesteś już za tą częścią, której brakuje prawie wszystkim.',
        ],
        veteran: [
          'Znowu tu jesteś, a sieć zauważyła to przede mną. Zaczęła nasłuchiwać twojego przyjścia.',
          'Wracasz. Przestałam na to liczyć gdzieś przy czterechsetnym kadecie. Cieszę się, że się myliłam.',
          'Z powrotem. Wszystko, co trzymasz od wczoraj, dalej się trzyma. Po to właśnie się to trzyma.',
        ],
        master: [
          'Wracasz. Na tym etapie powinnam powiedzieć, że odłamek dziś cię nie potrzebuje, i nie powiem, bo potrzebuje.',
          'Znowu tu jesteś. Dziewięćset lat ludzi, którzy mogli i tego nie zrobili, a tu stoisz ty, w zwyczajny poranek.',
          'Z powrotem, kolejny raz. Skończyły mi się sposoby, żeby powiedzieć, że to jest ta rzadka część.',
        ],
      },
      close: {
        working: [
          'Jedna czysta odpowiedź i linia „{skill}” jest twoja na zawsze. Tylko bez wsparcia — sieć nie uznaje pomocy za dowód.',
          'Linia „{skill}” jest o jedną uczciwą odpowiedź od zamknięcia. Znasz kształt tej jednej. Idź i ją weź.',
          'Między tobą a linią „{skill}” stoi jedna odpowiedź bez wsparcia. Za nią leży dziewięć punktów pozycji i żaden nie jest darmowy.',
        ],
        veteran: [
          'Linia „{skill}” jest o jedną odpowiedź od zamknięcia. To byłaby kolejna linia, której odłamek już nie odzyska.',
          'Jedna czysta odpowiedź i linia „{skill}” jest utrzymana. Robisz to na tyle często, że przestanę udawać, że to rzut monetą.',
          'Linia „{skill}”, jedna uczciwa odpowiedź. Zamilknę: zamykasz lepiej, kiedy nie mówię.',
        ],
        master: [
          'Linia „{skill}” jest o jedną odpowiedź od bycia twoją. Niewiele już zostało takich, które twoje nie są.',
          'Jedna czysta odpowiedź na linii „{skill}” i lista rzeczy na tym odłamku, które do ciebie nie należą, robi się krótsza od mojej cierpliwości.',
          'Linia „{skill}”, jedna odpowiedź. Przestałam recytować regułę o dowodach bez wsparcia. Większość tych dowodów wychodzi spod twojej ręki.',
        ],
      },
      held: {
        working: [
          'Linia „{skill}” utrzymana. Ta linia już się nie otworzy: ani od pogody, ani od czasu, ani ode mnie.',
          'Linia „{skill}” zamknięta. Dziewięć punktów pozycji i o jedną rzecz mniej na tym odłamku, która może cię zaskoczyć.',
          'Sieć przestała się spierać o linię „{skill}”. Cokolwiek się dziś jeszcze wydarzy, ten kawałek nieba zostaje na górze.',
        ],
        veteran: [
          'Linia „{skill}” utrzymana. To kolejna linia, do której kadeci przed tobą doszli i której nie zamknęli.',
          'Linia „{skill}” zamknięta. Tekst założycielski ma w sobie mniej wymówek niż rano i zamierzam się tym nacieszyć.',
          'Linia „{skill}” utrzymana na stałe. Gdzieś nad linią chmur coś, co się uginało, przestało się uginać.',
        ],
        master: [
          'Linia „{skill}” utrzymana. Zostało bardzo niewiele z tego odłamka, co nie jest twoje, i nie bardzo wiem, co ze sobą zrobię.',
          'Linia „{skill}” zamknięta. Rejestr porównywał kadetów ze sobą nawzajem. Od ciebie porównuje ich z tobą.',
          'Linia „{skill}” utrzymana. Dziewięćset lat, a odłamek wreszcie przestał być pytaniem.',
        ],
      },
      capped: {
        working: [
          'Zamknięte, ale rejestr przestał za takie płacić. Wszystko, co daje łatwa wyrwa, już masz. Pozycja bierze się teraz z utrzymanych linii.',
          'To policzyło się odłamkowi, a randze nic. Człon za zamknięcia jest wyczerpany; jedyną walutą została linia, która się trzyma.',
        ],
        veteran: [
          'Zamknięte i warte dla twojej pozycji dokładnie nic. Ten sufit masz dawno za sobą. Zamknij linię, jeśli chcesz, żeby drabina ruszyła.',
          'Policzone dla nieba, nie dla rejestru. Przy twoim rachunku rangę kupuje już tylko linia utrzymana w całości.',
        ],
        master: [
          'Zamknięte i nieopłacone, jak wszystko na tej wysokości. Przestajesz robić to dla rejestru gdzieś od czterdziestego.',
          'Rejestr nie ma ci już czego dać. Od dłuższego czasu zamykasz je dla dobra odłamka i wiemy o tym, ty i ja.',
        ],
      },
      // Podejście do wyrwy. Zdanie tłumaczące, czym wyrwa *jest*
      // (`story.voice.firstRift`), odpala się wyłącznie pod `canTutor()`
      // w voice.js, więc nie może trafić do nikogo, kto zamknął choć jedną.
      // To jest to, co słyszą wszyscy pozostali.
      rift: {
        green: [
          'Kolejna. Ta sama zasada co poprzednio: uczyń zdanie prawdziwym, a powietrze zamknie się nad nim.',
          'Wyrwa przed tobą. Jedną taką masz już za sobą. Druga jest taka sama jak pierwsza, tylko że już w niej stoisz.',
        ],
        working: [
          'Wyrwa. Znasz procedurę lepiej niż procedura.',
          'Przed tobą wyrwa. Nie zamierzam jej tłumaczyć: zamykasz je na tyle długo, że masz już dość mojego głosu.',
          'Kolejne zdanie, które prosi o dokończenie. Twoje, jeśli chcesz.',
        ],
        veteran: [
          'Wyrwa przed tobą. Dawno ci takiej nie objaśniałam i nie zamierzam zaczynać.',
          'Wyrwa. Masz za sobą więcej takich, niż zakon zdążył o nich przeczytać.',
          'Jedna czeka. Nie wie, kto nadchodzi, i to jej jedyna przewaga.',
        ],
        master: [
          'Wyrwa. Długo nie potrwa.',
          'Kolejna wyrwa. Wspominam o niej wyłącznie po to, żeby w zapisie stało, że wspomniałam.',
          'Przed tobą stoi zdanie, które jeszcze o tobie nie słyszało.',
        ],
      },
      // Jednorazowe takty za ostatnim rozdziałem. Rozdziały łuku kończą się na
      // dwudziestu ośmiu wyrwach; te niosą głos stamtąd aż na daleki koniec
      // długiego zapisu, a każdy odzywa się raz w życiu.
      mile: {
        s32: 'Trzydzieści dwie. Rozdziały się skończyły, a ty nie, co jest problemem rejestru i niczyim więcej.',
        s40: 'Czterdzieści zamkniętych. Tekst założycielski prowadzi tabelę kadetów według zamkniętych wyrw. Jesteś już na jej pierwszej stronie, a pierwsza strona jest krótka.',
        s50: 'Pięćdziesiąt. Będę szczera: przestałam przygotowywać materiał gdzieś przy trzydziestu. Od tego miejsca po prostu patrzę.',
        s64: 'Sześćdziesiąt cztery. W archiwum jest takie sformułowanie: ręka, która wyprzedziła swój odłamek. Użyto go cztery razy w ciągu dziewięciu wieków.',
        s80: 'Osiemdziesiąt. Rozrywanie Odłamka Dziewiątego jest teraz wolniejsze niż zrastanie, pierwszy raz od czwartego dnia. To ty. Tylko ty.',
        s100: 'Sto. Mam przygotowane zdanie dla kadeta, który dojdzie do stu. Nigdy go nie słyszysz dlatego, że żaden kadet do stu nie doszedł.',
        s120: 'Sto dwadzieścia. Sieć zaczęła prowadzić swoje burze naokoło tego odłamka. Robi tak dla konstrukcji, nie dla ludzi.',
        s150: 'Sto pięćdziesiąt. Chcę, żeby to zostało w aktach, bez żadnej z moich zwykłych osłon: cieszę się, że to jesteś ty.',
        s180: 'Sto osiemdziesiąt. Od dziewięciuset lat przepraszam ten odłamek. Przez ciebie większość tych przeprosin przestała być potrzebna.',
        s220: 'Dwieście dwadzieścia. Nie zostało we mnie nic, co umiałoby być przy tym oschłe. Idź dalej. Ja liczę dalej.',
      },
    },
  },
  // ---------------------------------------------------------------------------
  // Sesja (src/session).
  //
  // Przebieg to piętnaście do dwudziestu pięciu minut: cel podany przed
  // pierwszym zadaniem, widoczne tempo, które nigdy nie jest zegarem, domknięcie
  // nazywające to, co zostało zdobyte, i przerwa, która naprawdę jest odpoczynkiem.
  // Rejestr Marlow: sucho, dokładnie, bez schlebiania i bez besztania. Nikt tu
  // nikogo nie chwali za samo przyjście i nikomu wolniejszemu nie mówi się, że
  // się spóźnia. Klucze dodane, należą do warstwy sesji.
  // ---------------------------------------------------------------------------
  session: {
    band: {
      run: 'Przebieg {n}',
      of: 'z «n|one:# wyrwy|few:# wyrw|many:# wyrw»',
      near: 'Ostatnia prosta',
      done: 'Przebieg ukończony',
      readout: '{goal}. Zamknięte «n|one:# wyrwa|few:# wyrwy|many:# wyrw» z {target}.',
      worked: '«n|one:# przerobione pytanie|few:# przerobione pytania|many:# przerobionych pytań»',
      readoutWorked: '{goal}. Zamknięte «n|one:# wyrwa|few:# wyrwy|many:# wyrw» z {target}, z {items} przerobionych.',
    },
    goal: {
      hold: 'Utrzymać: {skill}',
      holdN: 'Utrzymać «n|one:# linię|few:# linie|many:# linii»',
      push: 'Odepchnąć: {skill}',
      any: 'Zamykać to, co odłamek otworzy',
      extend: 'Jeszcze jedna linia',
    },
    charter: {
      kick: 'Przebieg {n} · Odłamek Dziewiąty',
      // Gdzie stoi pierwsza wyrwa — całymi zdaniami, bo szyk dystansu i
      // kierunku poza angielskim wygląda inaczej.
      mark: {
        ahead: 'Wyrwa jest {n} m stąd, prosto przed tobą.',
        left: 'Wyrwa jest {n} m stąd, w lewo od ciebie.',
        right: 'Wyrwa jest {n} m stąd, w prawo od ciebie.',
        behind: 'Wyrwa jest {n} m stąd, za tobą.',
        here: 'Stoisz w samej wyrwie.',
      },
      title: 'Rozkazy',
      goalHold: 'Zamknij {tears} wyrw na linii „{skill}”. Linia to jedna idea i wszystkie wyrwy, które ją sprawdzają. Utrzymana linia już się nie otwiera.',
      goalHoldN: 'Zamknij dziś {tears} wyrw. Utrzymasz wtedy «n|one:# linię|few:# linie|many:# linii» na dobre. Utrzymana linia już się nie otwiera.',
      goalPush: 'Zamknij {tears} wyrw na linii „{skill}”. Ta linia jest długa. Dziś zrobimy ją krótszą.',
      goalAny: 'Zamknij {tears} wyrw na tym odłamku. Potem zobaczymy, co zrobi sieć.',
      willHold: 'powinna się utrzymać',
      willPush: 'zdobyty teren',
      eta: '«n|one:Jakaś # minuta|few:Jakieś # minuty|many:Jakieś # minut» w twoim tempie. Żaden zegar tu nie chodzi.',
      etaSeed: '«n|one:Jakaś # minuta|few:Jakieś # minuty|many:Jakieś # minut» — mój szacunek, jeszcze nie twój. Żaden zegar tu nie chodzi.',
      begin: 'Zaczynamy przebieg',
      kickBack: 'Przebieg {n} · powrót',
      backHeld: 'Ostatnim razem zamknąłeś «n|one:# wyrwę|few:# wyrwy|many:# wyrw». Linia „{skill}” trzyma od tamtej pory.',
      backHeldN: 'Ostatnim razem zamknąłeś {tears} wyrw. «n|one:# linia trzyma|few:# linie trzymają|many:# linii trzyma» od tamtej pory.',
      backNone: 'Ostatnim razem zamknąłeś «n|one:# wyrwę|few:# wyrwy|many:# wyrw». Wszystko to nadal stoi.',
    },
    close: {
      kick: 'Przebieg {n} · domknięty',
      titleHeld: 'Linia trzyma',
      titleMet: 'Odłamek ucichł',
      titleEnough: 'Na dziś wystarczy',
      tears: '«n|one:zamknięta wyrwa|few:zamknięte wyrwy|many:zamkniętych wyrw»',
      heldLab: 'Utrzymane',
      groundLab: 'Zdobyty teren',
      heldNote: 'Dowiedzione bez wsparcia, na najwyższym paśmie trudności i bez żadnego przykładu. Linia jest już twoja.',
      groundNote: 'Już tylko «n|one:# wyrwa|few:# wyrwy|many:# wyrw» do utrzymania — o {d} mniej niż na starcie przebiegu.',
      groundNoteFlat: '«n|one:# wyrwa|few:# wyrwy|many:# wyrw» do utrzymania najkrótszą drogą. Dziś przybyło pod nią gruntu, a nie ostatniego kroku.',
      groundNoteFar: 'Długa linia. Dziś ta linia drgnęła, i to we właściwą stronę.',
      groundNoneStrong: 'Nic nowego do utrzymania',
      groundNone: 'Wszystko, co dziś przeszło ci przez ręce, było już twoje.',
      openedLab: 'Otwarte',
      openedNote: 'Nowa linia wyrw, otwarta dla ciebie.',
      chapterNote: 'Zapis przewraca stronę.',
      rankNote: 'Zakon zmienił swoją ocenę ciebie.',
      openedNoneStrong: 'Sieć bez zmian',
      openedNone: 'Dziś nic się nie otworzyło. Tyle kosztują długie linie, a długie linie są tego warte.',
      nextLab: 'Dalej',
      nextNote: '«n|one:Jakaś # minuta|few:Jakieś # minuty|many:Jakieś # minut» pracy na najbardziej opłacalnej otwartej linii. Od niej zaczniemy.',
      nextNoteUnknown: 'Długa sprawa. Weźmiemy z niej pierwszy kawałek.',
      nextDoneStrong: 'Odłamek Dziewiąty w całości',
      dueStrong: '«n|one:# linia czeka|few:# linie czekają|many:# linii czeka» na sprawdzenie',
      dueNote: 'Te linie już trzymasz. Sieć sprawdzi je w następnej sesji. Zdana próba daje utrzymaną noc.',
      nightsStrong: '«n|one:# utrzymana noc|few:# utrzymane noce|many:# utrzymanych nocy»',
      nightsNote: 'Utrzymana noc to linia, która trzyma nadal po prawdziwej przerwie. Ranga powyżej Srebra ich wymaga. Dwa ostatnie rozdziały też.',
      nightsNoneStrong: 'Na razie zero utrzymanych nocy',
      nightsNoneNote: 'Wróć jutro. Sieć sprawdzi ponownie to, co utrzymujesz. To jedyny sposób, żeby zdobyć noc.',
      nextDone: 'Nic tu już nie jest otwarte. Krok dziewiąty trzyma.',
      sign: 'Nic z tego nie przepada. Sieć trzyma twoje dowody i będzie stać, kiedy wrócisz.',
      signWorked: 'Nikt tego nie ocenia i nic tu nie przepada. Następnym razem otwieramy tę linię, na której skończyliśmy. Linia będzie dokładnie w tym samym miejscu.',
      signHeld: 'Ta linia nie gnije i nie resetuje się. Wszystko, co jest nad nią, masz już w zasięgu.',
      rest: 'Odmelduj się',
      more: 'Jeszcze jedna linia',
      aria: 'Przebieg domknięty. Zamknięte «n|one:# wyrwa|few:# wyrwy|many:# wyrw».',
      workedLab: '«n|one:przerobione pytanie|few:przerobione pytania|many:przerobionych pytań»',
      workedSub: 'Żadne nie zamknęło wyrwy. Odłamek nie liczy prób i ja też nie. Ale ta praca coś kupiła, a poniżej stoi co.',
      ofWorked: 'z «n|one:# przerobionego pytania|few:# przerobionych pytań|many:# przerobionych pytań»',
      echoStrong: '«n|one:# rozwiązany przykład|few:# rozwiązane przykłady|many:# rozwiązanych przykładów»',
      echoNote: 'Płaci się za nie pomyłką. Każdy otwierał się dokładnie na tym kroku, na którym twoja odpowiedź skręciła, a nie na początku strony.',
      bandStrong: 'Bank przestrojony',
      bandDown: 'Pytania otwierają się teraz na paśmie trudności {n}, tam gdzie naprawdę jesteś. Poprzeczka do utrzymania linii nie drgnęła ani o milimetr.',
      bandUp: 'Pytania otwierają się teraz na paśmie trudności {n}. Bank poszedł dziś w górę za tobą, a nie odwrotnie.',
      groundNoteBack: '«n|one:# wyrwa|few:# wyrwy|many:# wyrw» do utrzymania najkrótszą drogą. Dalej niż na starcie. Jedna pomyłka na progu cofa próbę dowodową do pierwszego kroku. Poprzeczka jest surowa. Nie ty.',
      moreLast: 'Jeszcze jeden odcinek i okno się kończy. Potem kończymy, a skończyć w porę to właśnie to, dzięki czemu jutro jest coś warte.',
      capped: 'Masz za sobą te dwadzieścia pięć minut, wokół których kręci się cała pętla. Kolejny odcinek dziś jest wart mniej niż ten sam odcinek jutro. To nie pocieszenie — tak działa rozłożenie nauki w czasie.',

      // --- stany, w których karta mogła przeczyć samej sobie ---------------
      groundIdleStrong: 'Nic nie przerobione',
      groundIdle: 'W tym przebiegu żadne pytanie nie doczekało się odpowiedzi. Nic nie ubyło i nic nie przepadło. Odłamek stoi dokładnie tam, gdzie stał.',
      openedHeldNoneStrong: 'Nad nią na razie nic',
      openedWholeNoneStrong: 'Sieć domknięta',
      openedWholeNone: 'Na tym odłamku nie ma już czego otwierać. Praca się tu nie kończy. Kończy się mapa.',
      openedHeldNone: 'Linia może być warta utrzymania i tego samego dnia nie otworzyć niczego. Utrzymana linia nie zawsze sięga tego, co leży tuż obok.',
      signHeldQuiet: 'Ta linia nie gnije i nie resetuje się. Dziś nic wyżej w sieci nie znalazło się w zasięgu. Sieć to splot, nie schody. Linię i tak masz zaksięgowaną na stałe.',

      // --- co trwa dalej, kiedy wszystkie dziesięć linii jest utrzymanych --
      nextLabOpen: 'Co trwa dalej',
      soundStrong: '«n|one:Sondowanie — # szczebel w dół|few:Sondowanie — # szczeble w dół|many:Sondowanie — # szczebli w dół»',
      soundNote: 'Utrzymane linie, szczyt banku, bez wsparcia, szczebel po szczeblu. Dwanaście czystych szczebli to pełne sondowanie.',
      soundStrongNone: 'Sondowanie',
      soundNoteNone: 'Utrzymane linie, szczyt banku, bez wsparcia, szczebel po szczeblu. Dwanaście czystych szczebli to pełne sondowanie. Żadnego jeszcze nie było.',
      charterHaveStrong: '«n|one:# przywilej w ręku|few:# przywileje w ręku|many:# przywilejów w ręku»',
      charterHaveNote: 'Daje je głębia, a wydaje się je na stacje przelotowe. Nic innego w tej grze nie kosztuje przywileju.',
      charterStrong: 'Następny przywilej',
      charterNote: 'Wypisuje je głębia, a głębia rusza tylko wtedy, gdy wczorajsza linia trzyma także dziś. Jeszcze {n} głębi i będzie następny.',
      stationStrong: '«n|one:# stacja przelotowa stoi|few:# stacje przelotowe stoją|many:# stacji przelotowych stoi»',
      stationNote: 'Stań przy jednej, naciśnij H i jesteś przy następnej. Dwie to trasa; przy czterech to już inna wyspa.',
      stationStrongNone: 'Pierwsza stacja przelotowa',
      stationNoteNone: 'Stawiają ją przywilej i dwieście czterdzieści drobin. Stacja przelotowa to stała wieża wznoszącego powietrza, a zarazem miejsce. Ostatniej nie ma.',
      signWhole: 'Dziesięć linii, wszystkie utrzymane. Żadna nie gnije pod twoją nieobecność. Zostaje to, jak głęboko schodzisz. I jak dużą część wyspy zwiniesz do jednego kroku.',
    },
    rest: {
      say: 'Odmelduj się na chwilę. Popatrz na coś bardzo daleko — pasmo na horyzoncie wystarczy. Oddychaj razem z pierścieniem. Cztery miary wdechu. Dwie zatrzymania. Sześć wydechu.',
      skip: 'Wracam na odłamek',
      endKick: 'Odłamek Dziewiąty',
      endTitle: 'Trzyma',
      endBody: 'Przerwa zaliczona. Osprzęt zapisał każdy twój dowód. Niebo jest dokładnie tam, gdzie było.',
      endBodyNext: 'Przerwa zaliczona. Osprzęt zapisał każdy twój dowód. Następnym razem otwieramy linią „{skill}”.',
      again: 'Kolejny przebieg',
      off: 'Zamknij kanał',
      signOff: 'Kanał zamknięty. Sieć trzyma pod twoją nieobecność, a ja zostawiam zapalone światło. Do jutra. To samo niebo.',
      wakeUp: 'Otwórz kanał',
      aria: 'Przerwa. Oddychaj razem z pierścieniem. Nikt nic od ciebie nie chce.',
    },
    voice: {
      near: 'Ostatnia prosta. Cokolwiek się teraz stanie, ten przebieg jest już prawie twój.',
      resume: 'Podejmuję dokładnie w tym miejscu, w którym przerwaliśmy. Nic się nie osunęło pod twoją nieobecność; nigdy się nie osuwa.',
      extend: 'To lecimy dalej. Ten sam przebieg, ten sam rachunek — licznik nie startuje od nowa dlatego, że chcesz więcej.',
    },
  },
  // ---------------------------------------------------------------------
  // Raport postępów — src/report/**. Blok czysto addytywny: nie rusza
  // niczego powyżej.
  // ---------------------------------------------------------------------
  report: {
    launch: 'Postępy',
    open: 'Otwórz raport postępów',
    openHint: 'Raport postępów (P)',
    title: 'Raport postępów',
    sub: 'Co masz udowodnione, co to udowodniło i co dalej.',
    close: 'Zamknij',
    skillsHead: 'Dziesięć linii',
    recordHead: 'Zapis',
    recordSub: 'Ile warte jest każde potwierdzenie, powiedziane wprost. Te liczby sprawdza nauczyciel. Ostatnia jest tą niewygodną.',
    foot: 'Nie ma tu żadnej zapisanej oceny. Ten raport przelicza każdą liczbę z modelu ucznia przy każdym otwarciu. Pod trzymaną linią leży zapis sporządzony w chwili przyznania potwierdzenia, i ten zapis już się nie zmienia. Rozwiń linię, żeby go zobaczyć.',

    stat: {
      ofN: 'z {n}',
      mastered: 'Utrzymane linie',
      masteredNote: 'Udowodnione, a nie tylko próbowane.',
      time: 'Czas pracy',
      timeNote: 'Mierzony między odpowiedziami i ograniczony z góry, żeby bezczynność nigdy nie liczyła się jako praca.',
      session: 'Ta sesja',
      sessionNote: 'Sesja trwa 15–25 minut i kończy się czysto.',
      items: 'Odpowiedzi',
      itemsNote: 'Każde zadanie wygenerowane od nowa i rozwiązane maszynowo, zanim je zobaczysz.',
      accuracy: 'Rozwiązane bez pomocy',
      accuracyNote: 'Poprawnie za pierwszym razem, bez wskazówki i bez rozwiązanego przykładu, w stosunku do wszystkich zadań.',
      hollow: 'Cofnięte potwierdzenia',
      hollowNote: 'Silnik cofnął {n} z {of} potwierdzeń opanowania po sprawdzeniu linii na zimno.',
      hollowNone: 'Nic jeszcze nie potwierdzono. Nie ma czego sprawdzać.',
      ofHeld: 'z {n} zamkniętych',
      sight: 'Utrzymane z marszu',
      sightNote: 'Udowodnione przy pierwszym kontakcie, bez żadnych ćwiczeń przed. To samo potwierdzenie, ale na najcieńszym dowodzie, jaki ten silnik przyjmuje. Sprawdzenie na zimno wraca tu najszybciej.',
      sightNone: 'Żadna linia nie przeszła przy pierwszym kontakcie. Każde potwierdzenie tutaj przyszło po ćwiczeniach.',
      timeUnknown: 'Nie da się zmierzyć: część tego zapisu odtworzono bez rejestru, więc wcześniejsze minuty przepadły. Pokazane jako nieznane, a nie jako zero.',
      accuracyUnknown: 'Nie da się zmierzyć w odtworzonym zapisie: model pamięta zadania, ale nie to, które z nich rozwiązano bez pomocy.',
    },

    trust: {
      head: {
        reconstructed: 'Ten zapis jest niepełny',
        foreign: 'Odrzucono rejestr z innego zapisu',
      },
      note: {
        reconstructed: 'Brakuje części tego zapisu. Model ucznia i rejestr dowodów leżą osobno, a jeden wrócił bez drugiego. Model odtworzył {n} zadań i {claims} potwierdzeń, więc nic nie jest zaniżone. Czasu pracy ani odsetka rozwiązań bez pomocy sprzed przerwy nie da się odzyskać. Raport pokazuje je jako nieznane, a nie jako zero.',
        foreign: 'Ten rejestr należał do innego ucznia. Osprzęt go odrzucił, zamiast scalać. Liczba zadań i potwierdzeń pochodzi z modelu ucznia. Minuty i odsetek rozwiązań bez pomocy liczą się od nowa.',
      },
    },

    road: {
      sight: 'Z marszu',
      fast: 'Krótsza droga',
      long: 'Dłuższa droga',
    },
    roadNote: {
      sight: 'Udowodnione przy pierwszym kontakcie: jedno zadanie na zimno z najwyższego poziomu banku, a potem reszta próby. Trzy zadania bez pomocy i nic przed nimi.',
      fast: 'Jedno czyste rozwiązanie bez pomocy, na progowym paśmie, otworzyło próbę dowodową. Mniej zadań niż dłuższą drogą, i każde trudniejsze.',
      long: 'Próba otwarta dłuższą drogą: trzy czyste rozwiązania bez pomocy pod rząd i pewność modelu na pełnym progu.',
    },

    next: {
      head: 'Dalej',
      why: {
        fresh: 'Nowy teren. Wszystko pod nim już trzymasz.',
        continue: 'Niedokończone. Zostać tutaj opłaca się bardziej niż iść dalej.',
        check: 'Jedna próba od zamknięcia: trzy czyste odpowiedzi, bez pomocy, trudniejsze niż zwykle.',
        review: 'Czas na sprawdzenie na zimno. Potwierdzenie musi znów zapracować na swoje miejsce.',
        enrich: 'Wszystko, co otwarte, już trzymasz. Ta linia idzie głębiej.',
      },
      built: 'Opiera się na «n|one:# już zamkniętej linii|few:# już zamkniętych liniach|many:# już zamkniętych liniach».',
      start: 'Pierwsza linia. Nic przed nią nie stoi.',
      doneName: 'Wszystkie dziesięć linii zamkniętych',
      doneWhy: 'Poziom 1 ukończony. Zostaje utrzymać to, co zdobyte.',
    },

    state: {
      locked: 'Zablokowana',
      open: 'Otwarta',
      practising: 'W toku',
      proving: 'Próba',
      mastered: 'Utrzymana',
      provisional: 'Osuwa się',
      withdrawn: 'Otwarta ponownie',
    },
    stateNote: {
      locked: 'Ta linia potrzebuje najpierw innej linii, a tamtej jeszcze nie trzymasz.',
      open: 'Odblokowana i nietknięta.',
      practising: 'Ćwiczenia w toku. Wsparcie znika w miarę, jak model się utwierdza.',
      proving: 'Próba trwa: bez pomocy, bez wsparcia, w formach ćwiczonych najrzadziej.',
      mastered: 'Udowodniona i wytrzymuje sprawdzenia na zimno.',
      provisional: 'Jedno sprawdzenie nietrafione. Kolejne nietrafione cofa potwierdzenie.',
      withdrawn: 'Raz zamknięta, potem przepadła przy sprawdzeniu. Ćwiczenia znów otwarte.',
    },

    evidence: {
      head: 'Dowody, na których stoi ta linia',
      posterior: 'Pewność modelu',
      posteriorNote: 'Jak bardzo model jest pewien, że znasz tę linię. Liczy tylko odpowiedzi bez pomocy i potrzebuje {need}.',
      clean: 'Czysta seria',
      cleanNote: 'Poprawnie pod rząd, bez pomocy, na poziomie trudności {band} lub wyżej.',
      proving: 'Próba końcowa',
      provingNote: 'Bez pomocy, ze wsparciem wyłączonym, na poziomie {band} lub wyżej, z form ćwiczonych najrzadziej.',
      prereq: 'Wymagania wstępne',
      prereqNote: 'Zamknięte, zanim ta linia się otworzyła: {list}.',
      prereqRoot: 'Nic przed tą linią nie stoi.',
      noPrereq: 'brak',
      retention: 'Wytrzymuje sprawdzenie',
      retentionNote: 'Sprawdzenia na zimno wracają w coraz rzadszych odstępach. Dwa nietrafione i potwierdzenie zostaje cofnięte.',
      probeCount: '{hit} z {n} utrzymanych',
      probeNone: 'jeszcze nie czas',
      coldVal: 'na zimno, poziom {band}',
      cleanSight: 'Żadnej nie trzeba było. Ta linia przeszła przy pierwszym kontakcie. Zadanie na zimno jest pierwszym zadaniem samej próby, a wiersz poniżej liczy je raz.',
      cleanRoad: {
        long: 'Trzy pod rząd, bez pomocy, na poziomie trudności {band} — dłuższa droga do próby.',
        fast: 'Jedno czyste rozwiązanie bez pomocy, wzięte na paśmie trudności {band} — czyli na samym progu. Krótsza droga to mniej zadań, ale trudniejszych.',
      },
      provingExtended: 'Bez pomocy, ze wsparciem wyłączonym, na poziomie {band} lub wyżej. Próba wydłużyła się o {n}, żeby objąć drugą postać zadania i zadanie z sytuacją.',
      noReceipt: 'brak zapisu',
      noReceiptNote: 'To potwierdzenie przyznała wcześniejsza wersja, która nie zapisywała, co je uzasadniło. Zgłaszamy je jako nieudokumentowane, zamiast odtwarzać z ustawień: próg cytujący sam siebie nie jest dowodem.',
      rests: 'To potwierdzenie opiera się na {n} zadaniach bez pomocy, z {of} rozwiązanych na tej linii.',
      restsUnknown: 'Ta wersja nie zapisała, na których zadaniach opiera się potwierdzenie. Na tej linii rozwiązano {of} zadań.',
      grantedOn: 'Przyznane {date}.',
    },

    fact: {
      time: 'Czas na tej linii',
      items: 'Zadania tutaj',
      accuracy: 'Rozwiązane bez pomocy',
      band: 'Pasmo trudności',
      bandVal: 'Poziom {n} z 5',
      reps: 'Udowodniona w',
      forms: 'Poznane typy zadań',
      formsVal: '«n|one:# typ|few:# typy|many:# typów»',
      slip: 'Najczęstszy błąd',
      noSlip: 'Nie ma jeszcze powtarzającego się błędu.',
      noneYet: 'jeszcze nie',
    },

    rep: {
      symbolic: 'symbolach',
      context: 'sytuacji',
      verbal: 'słowach',
      table: 'tabeli',
      graph: 'wykresie',
    },

    std: {
      head: 'Standardy, którym odpowiada ta linia',
      ccss: 'Common Core (USA)',
      teks: 'TEKS (Teksas)',
      depth: {
        core: 'rdzeń',
        supporting: 'wspierający',
        introduced: 'wprowadzony',
        unknown: 'głębia niepodana',
      },
      depthNote: {
        core: 'Rdzeń: ta linia uczy tego standardu, a próba go sprawdza.',
        supporting: 'Wspierający: ćwiczą go zadania wymierzone w inny standard. Nie ma własnego progu.',
        introduced: 'Wprowadzony: świadomie częściowy pierwszy kontakt. Domyka go późniejszy poziom. Nie twierdzimy, że go nauczono.',
        unknown: 'To odwołanie nie ma zapisanej głębi pokrycia.',
      },
      depthSum: 'Odwołań rdzeniowych na tej linii jest {n} z {of} — standard jest tym, czego się tu uczy, i próba go sprawdza. Reszta jest wspierająca albo to pierwszy kontakt.',
      depthNoCore: 'Żadne z {of} odwołań na tej linii nie jest twierdzeniem rdzeniowym. Ta linia je wspiera albo wprowadza. Niesie je inna linia. Jej zamknięcie nie znaczy, że ich nauczono.',

      // Przełącznik ram. Jeden wybór, a cały raport wyraża się na nowo:
      // linie, pokrycie, dowody i eksporty.
      frame: {
        pick: 'Raportuj według',
        pickHint: 'Wybierz ramy, którymi mówi ten raport. To urządzenie zapamięta twój wybór.',
        ccss: 'Common Core (USA)',
        teks: 'TEKS (Teksas)',
        hint: {
          ccss: 'Raportuj tego ucznia według Common Core.',
          teks: 'Raportuj tego ucznia według teksaskich TEKS.',
        },
        full: {
          ccss: 'Standardy Common Core z matematyki (USA)',
          teks: 'Texas Essential Knowledge and Skills, matematyka, przyjęte w 2012',
        },
        authority: {
          ccss: 'Każdy kod podajemy bez długiego przedrostka CCSS.',
          teks: 'Cytowane za Kodeksem Administracyjnym Teksasu, tytuł 19, rozdział 111.',
        },
      },

      // Pokrycie: jeden wiersz na oczekiwanie, w wybranych ramach.
      cover: {
        head: 'Pokrycie standardów',
        sub: 'Jeden wiersz na oczekiwanie. Każdy wiersz pokazuje dowody, które za nim stoją.',
        evidenced: 'Z dowodami',
        core: 'Rdzeniowe utrzymane',
        untouched: 'Jeszcze nietknięte',
        ofN: 'z {n}',
        group: {
          held: 'Utrzymane',
          part: 'Częściowo utrzymane',
          indirect: 'Brak własnych dowodów',
          working: 'W toku',
          none: 'Brak dowodów',
        },
        groupNote: {
          held: 'Trzymasz każdą linię, która niesie to oczekiwanie.',
          part: 'Część linii niosących to oczekiwanie już trzymasz, reszty jeszcze nie.',
          indirect: 'Trzymasz linię, która niesie to oczekiwanie. Żaden typ zadania, który je niesie, jeszcze się nie pojawił.',
          working: 'Padły tu już odpowiedzi. Żadna linia jeszcze nie trzyma.',
          none: 'Na żadne pytanie z tych oczekiwań nie padła jeszcze odpowiedź.',
        },
        empty: 'Nic w tej grupie.',
        openRow: 'Otwórz dowody dla {code}',
        linesHeld: 'Linie potwierdzone: {n} z {of}',
        linesHead: 'Linie, które je niosą',
        textHead: 'Czego wymaga oczekiwanie',
        textNote: 'Cytat po angielsku. Te standardy nie mają urzędowego tekstu po polsku ani po hiszpańsku.',
        evHead: 'Dowody za tym oczekiwaniem',
        forms: 'Poznane typy zadań',
        formsVal: '{n} z {of}',
        formsNote: 'Mapa standardów wskazuje {of} typów zadań dla tego oczekiwania. Ten uczeń poznał {n} z nich.',
        answers: 'Odpowiedzi tutaj',
        unaided: 'Rozwiązane bez pomocy',
        unaidedNote: 'Poprawne za pierwszym razem, bez wskazówki i bez rozwiązanego przykładu.',
        noneYet: 'Na to oczekiwanie nie padła jeszcze żadna odpowiedź.',
        indirectNote: 'Potwierdzona linia nie jest dowodem na każde oczekiwanie, które niesie. To nie ma własnych dowodów.',
        thin: 'Każda trzymana linia tutaj przeszła od pierwszego wejrzenia. Ta droga daje najcieńszy dowód, jaki ten silnik przyjmuje.',
        unevidenced: 'Potwierdzona linia tutaj nie ma pokwitowania. Wcześniejsza wersja przyznała ją i nic nie zapisała.',
        caveatHead: 'Co twierdzimy, a czego nie',
        processHead: {
          ccss: 'Standardy praktyki matematycznej',
          teks: 'Standardy procesu',
        },
        processNote: 'Te standardy przecinają wszystkie linie. Liczba to linie, które trzymasz.',
        gapHead: 'Gdzie to dopasowanie się kończy',
        gapNote: 'Zapisane, a nie zamalowane.',
      },
    },

    // Kopia dla nauczyciela — src/report/teacher.js i src/report/record.js.
    record: {
      open: 'Zapis dla nauczyciela',
      openHint: 'Datowany zapis dowodów do wydruku — dla jednego ucznia albo dla całej klasy',
      title: 'Zapis ucznia',
      sub: 'Datowany zapis dowodów, zrobiony po to, żeby go wydrukować albo zarchiwizować. Nie ma w nim żadnej zapisanej oceny: każda liczba jest przeliczana z modelu ucznia na tym urządzeniu w chwili druku lub eksportu.',
      tab: { one: 'Jeden uczeń', std: 'Standardy', class: 'Klasa · {n}' },
      name: 'Imię i nazwisko',
      namePh: 'Niezapisane',
      group: 'Klasa lub grupa',
      groupPh: 'Opcjonalnie',
      nameNote: 'Przechowywane tylko na tym urządzeniu i wpisywane we wszystko, co wydrukujesz lub wyeksportujesz, żeby zapis dało się przypisać do osoby. Nic nie jest wysyłane i nie ma żadnego konta.',
      print: 'Drukuj / PDF',
      exportJson: 'Eksportuj zapis (.json)',
      exportCsv: 'Eksportuj tabelę (.csv)',
      exportStd: 'Eksportuj standardy (.csv)',
      import: 'Dodaj zapisy uczniów…',
      addMine: 'Dodaj zapis z tego urządzenia',
      clear: 'Usuń wszystkie',
      anon: 'Uczeń bez nazwiska',
      unknownDate: 'data niezapisana',
      notMeasured: 'niezmierzone',
      noClaim: 'nieudowodnione',
      levelName: 'Algebra I · Poziom 1 · Światy Szyfru',
      levelLine: '{level}',
      generatedLine: 'Sporządzono {date}',
      sum: {
        held: 'Zamknięte linie',
        items: 'Rozwiązane zadania',
        unaided: 'Rozwiązane bez pomocy',
        time: 'Czas pracy',
        claimItems: 'Zadania pod potwierdzeniami',
        testedOut: 'Zamknięte z marszu',
        withdrawn: 'Cofnięte potwierdzenia',
      },
      linesHead: 'Linia po linii',
      stdTitle: 'Zapis standardów',
      stdSub: 'Pokrycie według {frame}',
      stdSheetHead: 'Oczekiwanie po oczekiwaniu',
      stdFoot: 'Ta karta przelicza pokrycie z modelu ucznia przy każdym otwarciu. Typ zadania liczy się dopiero wtedy, gdy uczeń na niego odpowie. Linia liczy się jako trzymana dopiero po próbie bez pomocy, na progowym paśmie trudności.',
      withdrawnHead: 'Potwierdzenia cofnięte przez ten silnik',
      withdrawnRow: '{skill} — cofnięte {date}',
      byLineHead: 'Gdzie stoi klasa, linia po linii',
      classTitle: 'Zapis klasy',
      classSub: 'Zapisów uczniów: {n} · zebrane {date}',
      classEmpty: 'Nie ma jeszcze żadnych zapisów. Każdy uczeń eksportuje swój z tego ekranu; dodaj tu te pliki, a zostaną na tym urządzeniu.',
      classFoot: 'Zebrane z zapisów, które uczniowie wyeksportowali sami. Nic nie zostało wysłane — ta lista żyje wyłącznie w tej przeglądarce i znika razem z danymi witryny.',
      claimItemsShort: 'zadania bez pomocy: {n}, poziom {band}',
      claimReps: 'w {n} postaciach',
      claimRegrant: 'odzyskane po cofnięciu',
      foot: 'Zapis {id} · obserwacji: {n}. Nie ma tu żadnej zapisanej oceny. Ta karta przelicza każdą liczbę z modelu ucznia i rejestru dowodów na tym urządzeniu. Linia zostaje zamknięta dopiero po próbie bez pomocy, na progowym paśmie. Dwa nieudane sprawdzenia na zimno cofają potwierdzenie.',
      trust: {
        verified: 'zweryfikowany',
        reconstructed: 'odtworzony',
        foreign: 'zbudowany od nowa',
      },
      trustNote: {
        verified: 'Obie połowy tego zapisu — model ucznia i rejestr dowodów — zgadzają się co do jednego zadania.',
        reconstructed: 'Odtworzone z niepełnej kopii. Model odtworzył liczbę zadań i potwierdzenia, więc nic nie jest zaniżone. Czasu pracy i odsetka rozwiązań bez pomocy sprzed przerwy nie da się odzyskać. Zapis podaje je jako nieznane, a nie jako zero.',
        foreign: 'Rejestr na tym urządzeniu należał do innego zapisu. Osprzęt go odrzucił, zamiast scalać. Wszystko tutaj pochodzi wyłącznie z modelu ucznia.',
      },
      col: {
        student: 'Uczeń',
        group: 'Klasa',
        generated: 'Sporządzono',
        skill: 'Linia',
        state: 'Stan',
        evidence: 'Co to udowodniło',
        confidence: 'Pewność modelu',
        items: 'Zadania',
        unaided: 'Bez pomocy',
        time: 'Czas',
        road: 'Droga',
        claimItems: 'Zadania pod potwierdzeniem',
        band: 'Poziom',
        retention: 'Wytrzymuje sprawdzenie',
        standards: 'Standardy (głębia)',
        ccss: 'Common Core (głębia)',
        teks: 'TEKS (głębia)',
        trust: 'Zapis',
        held: 'Zamknięte linie',
        testedOut: 'Z marszu',
        withdrawn: 'Cofnięte',
        classHeld: 'Zamknięte',
        classProving: 'W próbie',
        classWorking: 'W toku',
        classLocked: 'Zablokowane',
        code: 'Kod',
        depth: 'Głębia',
        citation: 'Odwołanie prawne',
        expectation: 'Czego wymaga',
        carriedBy: 'Linie, które je niosą',
        cover: 'Pokrycie',
        linesHeld: 'Linie potwierdzone',
        formsMet: 'Poznane typy zadań',
        answers: 'Odpowiedzi',
        framework: 'Ramy',
        processMet: 'Zamysł projektowy',
      },
    },

    unit: {
      sec: 's',
      min: 'min',
      hr: 'godz.',
      secFull: '{n} s',
      minFull: '{n} min',
      hrFull: '{h} godz. {m} min',
    },

    idea: {
      'var-meaning': 'Litera zastępuje liczbę, której nikt jeszcze nie nazwał.',
      'eval-expr': 'Wstaw liczbę w miejsce litery, a wyrażenie staje się jedną wartością.',
      'order-ops': 'Nawiasy i potęgi wiążą mocniej niż mnożenie, a mnożenie mocniej niż dodawanie.',
      'like-terms': 'Wyrazy łączą się tylko wtedy, gdy ich część literowa jest dokładnie taka sama.',
      'distribute': 'Mnożenie sumy mnoży każdy wyraz w środku.',
      'one-step-add': 'Równanie to waga: cofnij dodawanie po obu stronach naraz.',
      'one-step-mul': 'Liczbę stojącą przy niewiadomej zdejmuje się dzieleniem, nigdy odejmowaniem.',
      'two-step': 'Rozpakuj w odwrotnej kolejności: najpierw luźna liczba, potem współczynnik.',
      'multi-step': 'Uprość każdą stronę do końca, zanim zaczniesz cokolwiek cofać.',
      'both-sides': 'Zbierz niewiadomą po jednej stronie — a jeśli zniknie, przeczytaj, co zostało.',
    },

    slip: {
      'add-not-multiply': 'Dodaje tam, gdzie sytuacja mnoży',
      'arith-slip': 'Dobra metoda, potknięcie w rachunkach',
      'axis-swap': 'Czyta wykres wzdłuż niewłaściwej osi',
      'coefficient-sign-lost': 'Gubi znak przy współczynniku',
      'collect-wrong-side': 'Zbiera niewiadomą po niewłaściwej stronie',
      'combine-unlike': 'Łączy wyrazy, które nie są podobne',
      'distribute-then-forget': 'Otwiera nawias i gubi jeden wyraz',
      'div-direction': 'Dzieli w odwrotną stronę',
      'divide-not-multiply': 'Dzieli tam, gdzie sytuacja mnoży',
      'exponent-as-mult': 'Czyta potęgę jako mnożenie',
      'implicit-mult-missed': 'Czyta 3x przy x = 4 jako cyfry obok siebie, nie jako iloczyn',
      'letter-as-object': 'Traktuje literę jak etykietę, a nie jak wartość',
      'letter-as-position': 'Bierze miejsce litery w alfabecie za jej wartość',
      'neg-base-power': 'Myli się przy znaku ujemnej podstawy',
      'neg-distribute': 'Gubi minus przy otwieraniu nawiasu',
      'neg-substitution': 'Podstawia wartość ujemną, ale zostawia wynik dodatni',
      'no-solution-confusion': 'Myli brak rozwiązań z tym, że pasuje każda wartość',
      'off-by-one-row': 'Czyta sąsiedni wiersz tabeli',
      'one-side-only': 'Zmienia tylko jedną stronę wagi',
      'partial-distribute': 'Mnoży tylko pierwszy wyraz w nawiasie',
      'partial-rule': 'Zaczyna regułę dobrze i przerywa ją w połowie',
      'same-op-both': 'Stosuje tę samą operację zamiast odwrotnej',
      'sign-on-constant': 'Przenosi wyraz wolny bez zmiany znaku',
      'sign-slip': 'Gubi albo dorabia minus',
      'strict-left-right': 'Liczy od lewej do prawej, bez kolejności działań',
      'subtract-coefficient': 'Odejmuje współczynnik zamiast przez niego podzielić',
      'subtract-not-multiply': 'Odejmuje tam, gdzie sytuacja mnoży',
      'swapped-roles': 'Zamienia miejscami, która wielkość jest która',
      'wrong-unwrap-order': 'Rozpakowuje w tej kolejności, w jakiej wyrażenie powstało',
      'x-and-x-squared': 'Traktuje x i x kwadrat jako ten sam rodzaj wyrazu',
    },
  },

  // Wyposażenie (src/kit). To, co kupuje zamknięta linia — powiedziane jako
  // zdolność, nigdy jako gratulacje. Klucze dodawane, należą do wyposażenia.
  kit: {
    granted: 'Linia zamknięta',
    // Zdanie kafelka tam, gdzie sięgnie po nie czytnik ekranu i kciuk — wcześniej
    // żyło wyłącznie w dymku, którego żadne z nich nie widzi.
    chipAria: '{name} — {what}',
    grantedHeld: 'Linia nadal trzyma',
    locked: 'Zamknij {n}',
    lockedLong: 'Otworzy się po zamknięciu {n} linii',
    next: 'Następne',
    // Jedyny zablokowany kafelek paska. Samo „Następne” nic nie mówiło: wisiało
    // na ekranie od pierwszej sekundy, nie dawało się kliknąć i nic nie mówiło,
    // co je odblokuje. Teraz podaje cenę w jedynej walucie, która je kupuje —
    // w utrzymanych liniach, nigdy w drobinach.
    nextAtLines: 'Utrzymaj «n|one:# linię|few:# linie|many:# linii»',
    nextAtDepth: 'Utrzymaj linie przez noc',
    cost: 'Drobiny: {n}',
    held: 'Masz',
    needShards: 'Brakuje drobin — potrzeba {n}',
    flareLit: 'Raca odpalona — powietrze się wznosi',
    beaconSet: 'Znacznik postawiony — powietrze wznosi się tu już na stałe',
    vaulted: 'Wyrzut',
    charterNext: 'Zamknij {tears} wyrw na linii „{skill}”. Linia to jedna idea i wszystkie wyrwy, które ją sprawdzają. Utrzymaj tę linię, a dostaniesz: {grant}.',
    // „przeleciałeś” mówiło do każdej dziewczyny w klasie w rodzaju męskim.
    // Ta sama myśl bez czasu przeszłego drugiej osoby: bezrodzajowa i krótsza.
    charterOpen: 'Zamknij {tears} wyrw na linii „{skill}”. Całe wyposażenie już masz. Została sama wyspa.',
    vault: {
      name: 'Płyta wyrzutni',
      short: 'Płyta',
      what: 'Piąty element siatki. Stań na niej, a wyrzuci cię dwanaście metrów w górę.',
    },
    flare: {
      name: 'Raca kominowa',
      short: 'Raca',
      what: 'F — odpala pod butami słup wznoszącego się powietrza, gdziekolwiek jesteś, na sześć sekund.',
    },
    kite: {
      name: 'Wyważenie skrzydła',
      short: 'Skrzydło',
      what: 'Skrzydło leci płaściej, szybciej i ostrzej skręca. Doliny nie do przebycia mieszczą się teraz w jednym locie.',
    },
    reserve: {
      name: 'Głęboka rezerwa',
      short: 'Rezerwa',
      what: 'Zapas siatki więcej niż się podwaja i uzupełnia się o połowę szybciej.',
    },
    legs: {
      name: 'Sztormowe nogi',
      short: 'Nogi',
      what: 'Szybszy sprint, wyższy skok, a zryw wraca dwa razy prędzej.',
    },
    sight: {
      name: 'Wzrok rezonansowy',
      short: 'Wzrok',
      what: 'Drobiny dryfu lgną do ciebie. Wiszącą skrytkę odczytasz z dwa razy większej odległości.',
    },
    beacon: {
      name: 'Znacznik stały',
      short: 'Znacznik',
      what: 'G — za dziewięćdziesiąt drobin stawiasz słup wznoszącego się powietrza, który jutro nadal tu będzie. Jedyna rzecz, jaką możesz zrobić tej wyspie na trwałe.',
    },
    windstep: {
      name: 'Krok wiatru',
      short: 'Krok',
      what: 'Zryw wraca, zanim buty dotkną ziemi. Trzy takie przenoszą przez przepaść, której skrzydło nie pokona.',
    },
    span: {
      name: 'Długi lot',
      short: 'Lot',
      what: 'Skrzydło jeszcze raz: płaściej i szybciej. Z wysokiej grani dolatujesz do dalekiego brzegu bez lądowania.',
    },
    array: {
      name: 'Szereg płyt',
      short: 'Szereg',
      what: 'Płyta wyrzuca cię o jedną trzecią wyżej i kosztuje sześć drobin zamiast osiemnastu. Płyty stają się schodami.',
    },
    squall: {
      name: 'Raca szkwałowa',
      short: 'Szkwał',
      what: 'Raca kosztuje szesnaście, sięga siedemdziesięciu czterech metrów i trzyma jedenaście sekund.',
    },
    deepwell: {
      name: 'Głęboka studnia',
      short: 'Studnia',
      what: 'Zapas siatki sięga trzystu i uzupełnia się dwa razy szybciej. Most nad wąwozem za jednym podejściem.',
    },
    station: {
      name: 'Stacja przelotowa',
      short: 'Stacja',
      what: 'H — postaw stację przelotową: stałą wieżę wznoszącego powietrza. Przemieszczaj się między dowolnymi dwiema. Kosztuje jeden przywilej i dwieście czterdzieści drobin.',
    },
    charter: {
      name: 'Przywilej na stację',
      what: 'Zatrzymaj to, co już masz, przez noc, a sieć wypisze kolejny przywilej. Ostatniego nie ma.',
    },
    chartersHeld: '«n|one:# przywilej|few:# przywileje|many:# przywilejów» · {cost}',
    charterIn: 'jeszcze {n} głębi',
    needCharter: 'Brak przywileju. Jeszcze {n} głębi i będzie następny',
    stationSet: 'Stacja przelotowa {n} postawiona — jest już częścią wyspy',
    stationAlone: 'Nie ma jeszcze dokąd lecieć. Postaw drugą',
    travelled: 'Ze stacji na stację',
    soundLanded: 'Sondowanie zakończone · {n} w dół, czysto',
    soundDeep: 'Sondowanie · {n} w dół',
    soundBroke: 'Sondowanie urywa się na {n}',
    // Lada (src/kit/foundry.js). Czasownik jeszcze nielicencjonowany można
    // kupić na miejscu, a pasek musi to pokazać.
    carrying: '«n|one:# w ręku|few:# w ręku|many:# w ręku|other:# w ręku»',
    buyAt: '{name} — huta przy lądowisku je sprzedaje',
    afford: '{n} drobin — starczy na: {name}',
  },

  // Dryf i wiszące skrytki (src/world). To, co wyspa robi, kiedy nikt cię
  // o nic nie pyta.
  // ---------------------------------------------------------------------
  // KIERUNEK (src/meta/guide.js). Cel, znacznik, podpowiedź interakcji,
  // nazwy, które świat nadaje sobie sam, oraz krawędź odłamka.
  // ---------------------------------------------------------------------
  guide: {
    label: 'Cel',

    verb: {
      seal: 'Zamknij wyrwę',
      prove: 'Udowodnij linię',
      watch: 'Stań na warcie',
      sound: 'Zbadaj sieć',
    },

    metres: '{n} m',
    rel: {
      ahead: 'Przed tobą',
      left: 'Po lewej',
      right: 'Po prawej',
      behind: 'Za tobą',
      here: 'Stoisz w środku',
    },

    pay: {
      lines: 'Utrzymaj ją, a «n|one:otworzy się jeszcze # linia sieci|few:otworzą się jeszcze # linie sieci|many:otworzy się jeszcze # linii sieci».',
      kit: 'Utrzymaj ją, a {name} będzie twoja.',
      calm: 'Zamknij je, a wstrząsy w tym miejscu ustaną na dobre.',
      sound: 'Tę linię już utrzymujesz. Sondowanie prowadzi cię nią z powrotem w dół, po jednym trudniejszym zadaniu, i wciąż płaci.',
    },

    tally: '{held} utrzymane · {open} otwarte · {locked} zamknięte',
    tallyNew: 'Utrzymana znaczy udowodniona na dobre',

    prompt: {
      open: 'Otwórz wyrwę',
      sound: 'Zbadaj tę linię — trudniejsze pytania',
    },
    key: {
      kbm: 'E',
      pad: 'X',
      touch: 'Dotknij',
    },

    // -------------------------------------------------------------------
    // NAZWY. Każda pada raz, na zawsze — przy pierwszym spojrzeniu na daną
    // rzecz. Żywą etykietę na obiekcie rysuje src/world/beckon.js; tutaj jest
    // to, czego etykieta unieść nie może: czym to jest, po co istnieje i
    // dlaczego ma go to obchodzić. Marlow, nie dymek podpowiedzi.
    // -------------------------------------------------------------------
    n: {
      rift: 'Ten pierścień to wyrwa. Wejdź w środek, a osprzęt wyrzuci ci zdanie na wizjer. Spraw, żeby zdanie było prawdziwe, a dziura w świecie zamknie się za tobą. Każda wyrwa to jedna reguła algebry, która przestała trzymać.',
      surge: 'Ten świetlisty pierścień to wyładowanie wyrwy. Otwarta wyrwa wyrzuca je co piętnaście sekund. Wyładowanie wytrąca drobiny i grunt spod nóg. Podskocz w chwili, gdy do ciebie dobiega. Zamknij wyrwę, a wyładowania ustaną na dobre.',
      mote: 'To drobiny szyfru: luźna sieć, tam gdzie ziemia krwawiła. Przebiegnij przez nie i są twoje. Huta zmienia drobiny w płyty i race, więc warto po nie nadłożyć drogi.',
      charged: 'Te złote drobiny wyrosły przy otwartej wyrwie. Każda płaci trzy razy tyle co blada. Ta wyrwa co piętnaście sekund wyrzuca tu wyładowanie i odbiera ci drobiny. Zamknij ją, a wyładowania ustaną.',
      husk: 'Te ciemne łupiny to puste żyły, a wypaliło je twoje przejście. Każda łupina rozświetli się po jakichś pięciu minutach. Na tym odłamku nie da się doić jednego zbocza, kadecie. Można tylko sięgać dalej — co, jak podejrzewam, było celem.',
      anchor: 'To kotwica sieci. Nic z twojego wyposażenia nie sięga jej z płaskiego gruntu, i o to właśnie chodzi. Postaw rampę. Na jej szczycie postaw drugą. Potem dotknij kotwicy. Po sześćdziesiąt drobin za sztukę, a są trzy.',
      cache: 'Wisząca skrytka. Belka trzyma prawdziwe zdanie, w którym brakuje jednego odważnika. Wejdź w przeciwwagę, która wypoziomuje belkę, a monolit się otworzy. Sto dwadzieścia drobin, a powietrze wznosi się tam już na stałe.',
      updraft: 'Ta kolumna to komin powietrzny. Wleć w niego, a wyniesie cię sześćdziesiąt metrów za darmo. Kominami dosięgniesz tego, co wygląda na poza zasięgiem.',
      verge: 'Ta kurtyna to skraj. Odłamek Dziewiąty kończy się właśnie tam. Najbliższe lądy dzieli od ciebie osiemset metrów otwartego nieba. Przeprawia przez nie wyłącznie sieć. Utrzymaj wszystkie dziesięć linii, a cię tam przeniesie. Do tego czasu: bardzo długi lot w dół z ładnym widokiem.',
    },
  },

  // HUTA (src/kit/foundry.js) — lada, przy której drobiny szyfru zamieniają się
  // w coś konkretnego, z ceną i działaniem podanymi, zanim wyda się choć jeden.
  // Klucze dodane, należą do osprzętu.
  foundry: {
    kick: 'Zaopatrzenie kadetów',
    name: 'Huta',
    lede: 'Drobina szyfru to ślad, jaki zostawia po sobie zamknięta wyrwa. Huta je przyjmuje i oddaje powietrze, na którym można stanąć.',
    unit: '«n|one:drobina|few:drobiny|many:drobin|other:drobiny»',
    hailStock: '«n|one:# rzecz w zasięgu|few:# rzeczy w zasięgu|many:# rzeczy w zasięgu|other:# rzeczy w zasięgu»',
    hailNone: 'Tu drobiny kupują rzeczy',
    take: 'Bierz',
    short: 'Brakuje {n}',
    leave: 'Odsuń się',
    sealedLines: 'Utrzymaj «n|one:# linię|few:# linie|many:# linii|other:# linii»',
    sealedDepth: 'Utrzymaj swoje linie przez noc',
    inHand: 'Twoje · {key}',
    carried: '«n|one:# w ręku|few:# w ręku|many:# w ręku|other:# w ręku» · {key}',
    bought: 'W ręku. Naciśnij {key} tam, gdzie ma stanąć',
    note: 'Drobiny płacą za to, co leży na ladzie. Utrzymane linie otwierają resztę.',
    callout: 'Kadecie — te drobiny to nie punkty. Przy lądowisku stoi huta, która zamienia je we wznoszące powietrze: rozświetlony sześciokąt o trzech pylonach, po twojej lewej.',
    flare: { what: 'Sześć sekund wznoszącego powietrza pod własnymi butami, gdziekolwiek stoisz. Jedno użycie.' },
    beacon: { what: 'Komin wznoszącego powietrza, który jutro nadal tu będzie. Postaw go, gdzie zechcesz. Nic innego, co zrobisz na tej wyspie, nie zostaje.' },
    plate: { what: 'Piąty element sieci. Stań na nim, a wyrzuci cię dwanaście metrów w górę.' },
    station: { what: 'Wieża wznoszącego powietrza, a zarazem miejsce. Stań przy jednej, wyjdź przy dowolnej innej.' },
  },

  field: {
    moteTake: 'Drobiny: +{n}',
    updraft: 'Komin powietrzny',
    surge: 'Wyładowanie wyrwy — przeskocz pierścień',
    surgeHit: 'Wyładowanie wyrwy — tracisz drobiny: {n} · przeskocz pierścień albo zamknij wyrwę',
    balanceLock: 'Zamek wagowy',
    balanceNo: 'Belka tego nie przyjmuje',
    balanceReset: 'Odważniki układają się na nowo',
    cacheOpen: 'Skrytka otwarta — drobiny: {n}, a powietrze wznosi się tu już na stałe',

    // --- co świat mówi, gdy do niego podchodzisz (src/world/beckon.js) ---
    riftOpen: 'Wejdź na płytę · {skill}',
    riftShut: 'Zapieczętowana · najpierw opanuj: {skill}',
    riftHeld: 'Utrzymana · {skill}',
    riftRefuse: 'Rygle trzymają. Ta wyrwa otworzy się, gdy opanujesz: {skill}.',
    veinLit: 'Żyła szyfru · +{n} za kryształ',
    veinRich: 'Naładowana żyła · +{n} za kryształ',
    veinSpent: 'Żyła wybrana · rozświetli się za {time}',
    shardsFor: 'Drobiny szyfru. Osprzęt wymienia je na płyty wyrzutni, race i stałe kominy powietrzne.',
    anchorFind: 'Kotwica sieci · dobuduj się do niej',
    anchorHeld: 'Kotwica zabezpieczona',
    vergeTag: 'Skraj · koniec Odłamka Dziewiątego',
    vergeHit: 'Skraj nie ustępuje. Tutaj kończy się Odłamek Dziewiąty — dalsze odłamki to przeprawa, której nikt nie odbył.',
  },
  // --- warstwa afordancji (src/world/afford.js): co oferuje wyrwa, który
  // klawisz to robi i w którą stronę jest następna -------------------------
  afford: {
    open: 'Otwórz wyrwę',
    walkIn: 'Wejdź w nią',
    sound: 'Zbadaj linię — trudniejsze pytania, ta sama linia',
    shut: 'Zapieczętowana',
    needs: 'Najpierw opanuj: {skill}',
    tap: 'Dotknij',
    next: 'Następna wyrwa',
    metres: '{n} m',
  },

  // ---------------------------------------------------------------------
  // REJESTR (src/kit/ledger.js) — każdy ruch waluty, z powodem i saldem,
  // które po nim zostaje.
  //
  // Nowy gracz opisał, że portfel „sam się zerował do zera” trzy razy. Nic się
  // nie zerowało: wyładowanie wyrwy zabierało sztywno dziewięć drobin, co
  // opróżniało każde saldo poniżej dziewięciu, a jedyny komunikat, który to
  // tłumaczył, trafiał do wspólnego paska powiadomień i pół sekundy później
  // kasował go komunikat „tam nie ma oparcia”, wywołany przez ten sam odrzut.
  // Pasek ma teraz własny element i własny zegar.
  // Klucze dodatkowe, należą do wyposażenia.
  // ---------------------------------------------------------------------
  ledger: {
    left: 'zostaje {n}',
    spared: 'Za mało drobin, żeby cokolwiek wytrącić',
    why: {
      seal: 'Wyrwa zamknięta',
      assist: 'Zamknięta z rozwiązanym przykładem',
      vein: 'Żyła szyfru',
      cache: 'Wisząca skrytka',
      anchor: 'Kotwica sieci',
      found: 'Zebrane',
      surge: 'Wyładowanie wyrwy',
      spent: 'Wydane',
      vault: 'Płyta wyrzutni postawiona',
      plate: 'Płyta wyrzutni kupiona',
      flare: 'Raca kominowa',
      beacon: 'Znacznik stały',
      station: 'Stacja przelotowa wzniesiona',
    },
  },
};
