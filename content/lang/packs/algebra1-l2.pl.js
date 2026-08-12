/**
 * Algebra I · Poziom 2 — treść zadań, polski.
 *
 * Prose for a course pack lives beside the shipped item bundles, under
 * content/lang, and never inside src/. Same rule, same reason: src/ carries no
 * language. The pack in src/content/packs imports this file and the registry
 * merges it in behind content/lang/items.*.js.
 */
export default {
  'l2.ctx.twoHolds': 'Frachtowiec ma dwie ładownie. Obie ładownie mają tę samą masę.',
  'l2.ask.holdMass': 'Zapis poniżej podaje masę każdej ładowni. Znajdź ${v}$.',
  'l2.ctx.shareOut': 'Załoga dzieli jedną dostawę na równe ładunki.',
  'l2.ask.oneLoad': 'Zapis poniżej podaje wielkość jednego ładunku. Znajdź ${v}$.',
  'l2.ctx.gauge': 'Wskaźnik odczytuje się raz na wachtę. Nikt nie zapisał reguły, którą on trzyma.',
  'l2.ask.missingWatch': 'Brakuje jednego odczytu. Ile wynosił?',
  'l2.ctx.stockpile': 'Skład rośnie o tę samą wielkość na każdej wachcie.',
  'l2.why.openBothBrackets': 'Najpierw otwórz oba nawiasy. Do tej pory każda strona jest jedną wielkością.',
  'l2.why.minusEntersEveryTerm': 'Znak minus należy do całego nawiasu, więc wchodzi w każdy wyraz w środku.',
  'l2.why.multiplyBothByBottom': 'Pomnóż obie strony przez {k}. To zdejmuje kreskę ułamka.',
  'l2.why.stepTellsRate': 'Każdy krok wejścia rusza wyjście o {n}. To jest tempo.',
  'l2.why.applyRateOnce': 'Zastosuj tempo do wiersza nad luką.',
  'l2.why.stepBackToInput': 'Wyjście ruszyło o jedno tempo, więc wejście ruszyło o jeden krok.',
};
