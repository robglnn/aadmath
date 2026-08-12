/**
 * The language standard, as data.
 *
 * ASD-STE100 (Simplified Technical English) + ELI18 + written for an attention
 * span that does not forgive a wall of text. Split out of check-language.mjs so
 * the rules can be read, argued with, and self-tested on their own.
 *
 * THE ONE DISTINCTION THAT MATTERS
 *
 * This game has a companion, Marlow, and an independent critic called her the
 * best thing in the build. Flattening her into a manual would be a downgrade,
 * not a fix. So every key is classified:
 *
 *   INSTRUCTIONAL — how to play, what to do next, what a word means, what went
 *                   wrong, the objective, the menu, the report. Everything on
 *                   the learning surface. Every rule below applies, hard.
 *   FLAVOUR       — Marlow's asides, world description, the seal beat. Keeps
 *                   its voice, but still obeys short sentences, plain words and
 *                   one idea per line.
 *
 * Wit is allowed. Ambiguity is not.
 */

// ---------------------------------------------------------------------------
// 1. WHICH KEYS ARE FLAVOUR
//
// Everything not matched here is instructional and gets the strict treatment.
// Listed as key prefixes against the dotted path in the bundle.
// ---------------------------------------------------------------------------
export const FLAVOUR = [
  'meta.description',
  'marlow.',
  'story.open.',
  'story.place.',
  'story.marlow.',
  'story.cite.',
  'story.rite.',
  'story.voice.',
  'story.v.',
  'story.day.',
  'story.standard.motto',
  'story.coda.c',
  'story.ch1.b', 'story.ch2.b', 'story.ch3.b', 'story.ch4.b', 'story.ch5.b',
  'session.voice.',
  'session.rest.signOff',
  'rift.echo.slip', 'rift.echo.trace', 'rift.echo.done', 'rift.echo.analogue',
  'rift.echo.fades', 'rift.echo.sealedIt', 'rift.echo.cameBack',
  'rift.seal.',
  'foundry.lede', 'foundry.callout',
];

export function isFlavour(key) {
  return FLAVOUR.some((p) => (p.endsWith('.') ? key.startsWith(p) : key === p || key.startsWith(p)));
}

// ---------------------------------------------------------------------------
// 2. READING ORDER
//
// A term may not be used before the surface that defines it. That needs an
// order, and the order is the one a real player meets, not the order of the
// file. Lower rank is met sooner. Anything unlisted sits at the end, where it
// can rely on everything.
// ---------------------------------------------------------------------------
export const SURFACE_RANK = [
  ['meta.', 0], ['boot.', 0],
  // The chrome is one keypress away from the very first frame, so anything it
  // says has to stand on its own with no story behind it.
  ['firstrun.', 1], ['controls.', 1], ['settings.', 1], ['menu.', 1],
  ['hud.', 1], ['audio.', 1], ['rank.', 1],
  ['story.open.', 2], ['story.place.', 2], ['story.marlow.', 2], ['story.hud.', 2],
  ['session.charter.', 2], ['session.goal.', 2], ['session.band.', 2],
  ['guide.', 3], ['field.', 3], ['afford.', 3], ['build.', 3],
  ['kit.', 4], ['foundry.', 4], ['ledger.', 4], ['learn.', 4],
  ['rift.', 5],
  ['story.', 6],
  ['session.close.', 7], ['session.rest.', 7], ['session.', 7],
  ['report.', 8], ['skills.', 8],
];

export function rankOf(key) {
  let best = 9;
  let bestLen = -1;
  for (const [prefix, r] of SURFACE_RANK) {
    if (key.startsWith(prefix) && prefix.length > bestLen) { best = r; bestLen = prefix.length; }
  }
  return best;
}

// ---------------------------------------------------------------------------
// 3. THE COINED VOCABULARY
//
// Every word this game invented, and the one key that is allowed to be the
// first place a player meets it. `def` must itself contain the word, and it
// must sit at or before the rank of every other key that uses it.
//
// This is the rule that found the real defect: the orders screen said "seal
// three rifts" two minutes before anything on screen said what a rift was.
// ---------------------------------------------------------------------------
const L = 'a-zA-Z\\u00C0-\\u024F';
/** `\b`, but aware that ę and ó are letters. JS's own \b is ASCII-only. */
const w = (body) => new RegExp(`(?<![${L}])(?:${body})(?![${L}])`, 'i');

export const TERMS = [
  // The two that carry the whole loop. A player who does not know what a rift
  // and a line are cannot read the objective, the orders, or the report.
  {
    id: 'rift', def: 'menu.nowBody', min: 14,
    en: /\brifts?\b/i,
    es: w('grietas?'),
    pl: w('wyrw(a|y|ę|ie|om|ami|ach)?'),
  },
  {
    id: 'line', def: 'session.charter.goalHold', min: 14,
    en: /\b(?:the|a|each|every|that|this|one)\s+lines?\b/i,
    es: w('l[ií]neas?'),
    pl: w('lini(a|i|ę|e|om|ami|ach)'),
  },
  // Things in the world that behave, rather than things that simply are. A mote
  // is understood by picking one up; a surge has to be explained before it hits
  // you, and a sounding before the objective asks for one.
  {
    id: 'surge', def: 'guide.n.surge', min: 14,
    en: /\bsurges?\b/i,
    es: w('sacudidas?'),
    pl: w('wy[łl]adowani[aeu]'),
  },
  {
    id: 'updraft', def: 'guide.n.updraft', min: 12,
    en: /\bupdrafts?\b/i,
    es: w('ascendencias?|aire ascendente'),
    pl: /(?:kominy? powietrzn|komin(?:a|em|ie|ami)? powietrzn|wznosz[ąa]ce\w* powietrz)/i,
  },
  {
    id: 'sounding', def: 'guide.pay.sound', min: 12,
    en: /\bsoundings?\b/i,
    es: w('sondeos?'),
    pl: w('sondowani[aeu]'),
  },
  {
    id: 'echo', def: 'rift.echo.trace', min: 12,
    en: /\bechoe?s?\b/i,
    es: w('ecos?'),
    pl: w('ech(o|a|u|em)'),
  },
  {
    id: 'charter', def: 'kit.charter.what', min: 12,
    en: /\bcharters?\b/i,
    es: w('c[ée]dulas?'),
    pl: w('przywilej(u|e|ów|em|owi|ami)?'),
  },
  {
    id: 'waystation', def: 'kit.station.what', min: 12,
    en: /\bwaystations?\b/i,
    es: w('estaci[oó]n(es)?'),
    pl: w('stacj(a|i|ę|e|om|ami|ach)'),
  },
  /* A judge read "0 held · 1 open · 9 locked" on the objective card and asked
     what *held* meant. Nothing answered. It is not a thing you can look at —
     it is a claim the engine makes about you — so it belongs here with the
     rules and the procedures, and the orders card is where it is coined. */
  {
    id: 'held', def: 'session.charter.goalHold', min: 14,
    en: /(?<![a-z])held(?![a-z])/i,
    es: w('sostenidas?'),
    pl: w('utrzyman(a|e|ą|ej|ych)'),
  },
];

/**
 * Deliberately NOT checked: mote, lattice, shard, cache, anchor, husk, vein.
 * Every one of those is a thing the player is looking at when the word arrives —
 * `guide.n.*` fires on first sight of the object itself. A word attached to a
 * thing in front of you is defined by the thing. The rule above is for words
 * that name a *rule* or a *procedure*, which is the only kind of jargon a
 * learner can be quietly lost inside.
 */

// ---------------------------------------------------------------------------
// 4. PLAIN WORDS
//
// "Never use a fancy word where a plain one works." Left side is what the
// bundle said; right side is what it says now. Checked case-insensitively on
// word boundaries, and only where a plain word genuinely carries the meaning.
// ---------------------------------------------------------------------------
export const FANCY = {
  en: {
    utilise: 'use', utilize: 'use', commence: 'start', terminate: 'stop',
    endeavour: 'try', ascertain: 'find out', requisition: 'request',
    demonstrate: 'show', sufficient: 'enough', additional: 'more',
    approximately: 'about', subsequently: 'then', prior: 'before',
    obtain: 'get', purchase: 'buy', assist: 'help', require: 'need',
    numerous: 'many', comprehend: 'understand', facilitate: 'help',
    initiate: 'start', accomplish: 'do', attempt: 'try', permit: 'let',
    indicate: 'show', modify: 'change', construct: 'build', component: 'part',
    deploy: 'use', furthermore: 'also', however: 'but', therefore: 'so',
    regarding: 'about', concerning: 'about', numerically: 'in numbers',
    'in order to': 'to', 'is able to': 'can', 'at this time': 'now',
    'in the event that': 'if', 'due to the fact that': 'because',
    'a number of': 'some', 'with regard to': 'about', 'is comprised of': 'has',
    periphrastic: 'roundabout', cognisant: 'aware', ameliorate: 'improve',
  },
  es: {
    utilizar: 'usar', comenzar: 'empezar', finalizar: 'terminar',
    adquirir: 'conseguir', suficiente: 'bastante', adicional: 'más',
    aproximadamente: 'unos', posteriormente: 'luego', obtener: 'conseguir',
    efectuar: 'hacer', realizar: 'hacer', proceder: 'seguir',
    'con el fin de': 'para', 'en caso de que': 'si', 'a fin de': 'para',
    'debido a que': 'porque', 'no obstante': 'pero', 'asimismo': 'también',
  },
  pl: {
    'dokonać': 'zrobić', 'dokonuje': 'robi', 'realizować': 'robić',
    'wykorzystać': 'użyć', 'wykorzystuje': 'używa', 'rozpocząć': 'zacząć',
    'zakończyć': 'skończyć', 'uzyskać': 'dostać', 'dodatkowy': 'kolejny',
    'w celu': 'żeby', 'w przypadku gdy': 'jeśli', 'z uwagi na to, że': 'bo',
    'aczkolwiek': 'ale', 'jednakże': 'ale', 'niemniej jednak': 'ale',
    'przeprowadzić': 'zrobić', 'stanowi': 'to', 'posiada': 'ma',
  },
};

// ---------------------------------------------------------------------------
// 5. PASSIVE VOICE
//
// STE wants the active voice. A gate that cannot tell "is held" from "is late"
// gets switched off within a week, so each locale names its auxiliaries and its
// participles rather than guessing from a suffix alone.
// ---------------------------------------------------------------------------
const EN_IRREGULAR = ['written', 'taken', 'given', 'held', 'made', 'done', 'said', 'seen',
  'known', 'shown', 'built', 'sent', 'kept', 'left', 'lost', 'won', 'read', 'told',
  'brought', 'bought', 'caught', 'taught', 'thought', 'found', 'drawn', 'thrown',
  'blown', 'grown', 'flown', 'worn', 'torn', 'sworn', 'spent', 'meant', 'dealt',
  'felt', 'burnt', 'learnt', 'beaten', 'eaten', 'driven', 'risen', 'fallen',
  'forgotten', 'hidden', 'proven', 'chosen', 'frozen', 'spoken', 'broken',
  'stolen', 'woven', 'struck', 'stuck', 'swung', 'hung', 'begun', 'cut', 'put',
  'set', 'shut', 'split', 'spread', 'cast', 'hurt'];

export const PASSIVE = {
  en: new RegExp(
    String.raw`\b(?:is|are|was|were|be|been|being|am|gets?|got|becomes?)\s+` +
    String.raw`(?:(?:not|never|already|still|only|then|now|also|simply|merely|quietly|deliberately|permanently|properly)\s+)?` +
    String.raw`(?:\w+ed|` + EN_IRREGULAR.join('|') + String.raw`)\b`,
    'i',
  ),
  es: new RegExp(
    String.raw`\b(?:es|son|era|eran|fue|fueron|ser[áa]n?|est[áa]n?|estaban?|` +
    String.raw`ha\s+sido|han\s+sido|hab[íi]an?\s+sido|siendo|sido)\s+` +
    String.raw`(?:(?:no|ya|solo|s[óo]lo|nunca|siempre)\s+)?` +
    String.raw`\w{3,}[oa]d[oa]s?\b`,
    'i',
  ),
  pl: new RegExp(
    String.raw`\b(?:jest|s[ąa]|by[łl](?:a|o|y|i)?|b[ęe]dzie|b[ęe]d[ąa]|` +
    String.raw`zosta[łl](?:a|o|y|i)?|zostanie|zostan[ąa]|zosta[ćc])\s+` +
    String.raw`(?:(?:nie|ju[żz]|tylko|zawsze|wci[ąa][żz])\s+)?` +
    String.raw`\w{4,}(?:any|ane|ani|ana|ony|one|oni|ona|[ęe]ty|[ęe]ta|[ęe]te|ity|ita|ite|yty|yta|yte)\b`,
    'i',
  ),
};

/** Words whose -ed/-ny form is a plain adjective, not a passive. */
export const PASSIVE_EXEMPT = {
  en: /\b(?:is|are|was|were|be|been|am)\s+(?:not\s+)?(?:tired|interested|pleased|based|used to|supposed to|limited to|able|aware|willing|worth|ready|closed|open|left|right|fixed|red|dead|good|bad|late|hard)\b/i,
  es: /\b(?:es|son|est[áa]n?)\s+(?:no\s+)?(?:cansad[oa]s?|interesad[oa]s?|content[oa]s?)\b/i,
  pl: /\b(?:jest|s[ąa])\s+(?:nie\s+)?(?:gotow[ayei]|zmęczon[ayei]|zadowolon[ayei])\b/i,
};

// ---------------------------------------------------------------------------
// 6. AMBIGUOUS PRONOUN OPENERS
//
// "It", "this" and "that" pointing back at a whole previous clause. Legal in
// English, and the single fastest way to lose a reader who is skimming.
// A demonstrative followed by its own noun ("this rift") is fine and is not
// matched here.
// ---------------------------------------------------------------------------
// A demonstrative followed by its own noun ("this rift", "those lines") is a
// determiner and is perfectly clear. Only the *pronoun* use is ambiguous, and
// the reliable signal for it is a verb sitting immediately after — "This is",
// "That means", "These run". Testing for a following noun instead needs a noun
// list, and the first draft of that list did not have "student" in it.
const EN_VERB_AFTER = String.raw`(?:is|are|was|were|will|would|does|do|did|has|have|had|can|could|may|might|must|means?|makes?|made|goes|go|comes?|came|costs?|counts?|opens?|holds?|happens?|leaves?|puts?|sits?|stands?|reads?|says?|takes?|gives?|buys?|pays?|runs?|works?|shows?|tells?|needs?|gets?|keeps?|turns?|starts?|stops?|ends?|wins?|loses?|reaches?|carries|carry|belongs?)`;

export const PRONOUN_OPENER = {
  en: new RegExp(String.raw`^(?:It|Its|They|Them)\b|^(?:This|That|These|Those)\s+${EN_VERB_AFTER}\b|^(?:This|That|These|Those)\s*[,.—:;]`),
  es: /^(?:Eso|Esto|Ello|Aquello|Lo\s+(?:cual|que))\b/,
  pl: /^(?:Tamto|Ono|Owo)\b|^To\s+(?:jest|s[ąa]|by[łl](?:a|o|y)?|b[ęe]dzie|robi|znaczy|oznacza|daje|kosztuje|otwiera|zamyka|dzia[łl]a|liczy|trwa)\b|^To\s*[,.—:;]/,
};

// ---------------------------------------------------------------------------
// 7. NOUN CLUSTERS
//
// STE caps a noun cluster at three words, and a noun cluster is an English
// disease: English stacks bare nouns ("rift surge pressure ring") where Spanish
// and Polish cannot. Porting the English test to them produces nonsense — the
// first draft of this file flagged "wartość, która czyni zdanie prawdziwym"
// (a perfectly plain relative clause) as a five-noun pile-up.
//
// So the rule is the same *fault* expressed three ways:
//
//   en   four or more bare nouns in a row.
//   es   a chain of four or more `de`-linked nouns — "la integridad de la red
//        del fragmento del cadete", which is the Spanish way to build the same
//        unreadable pile.
//   pl   a chain of four or more stacked genitives, the Polish way to do it.
//
// The lists below are generous on purpose: a missed cluster is cheaper than a
// gate nobody trusts.
// ---------------------------------------------------------------------------
export const CLUSTER_MODE = { en: 'nouns', es: 'de-chain', pl: 'genitive-chain' };

/** A Polish genitive ending, on a word long enough to be a noun and not a verb. */
// A genitive *noun* ending. Adjectival endings are deliberately absent: an
// adjective inside a run means the phrase is a modified noun, not a raw stack of
// genitives, and PL_ADJ below breaks the run when one appears. Without that, the
// gate called "jednego kroku dowodu założycielskiego" — one step of the founding
// proof, four ordinary words — a four-deep pile-up.
export const PL_GENITIVE = /(?:[oó]w|ości|y|i|a|u)$/;
export const PL_ADJ = /(?:ego|ej|ich|ych|imi|ymi|emu|owi|[ąa]cego|[ąa]cej)$/;
export const PL_VERBish = /(?:ć|ść|łem|łam|łeś|łaś|liśmy|łyśmy|jesz|isz|asz|esz|ymy|imy|amy|emy|cie|ają|ują|iją|eją)$/;

export const NOT_NOUN = {
  en: new Set(`a an the this that these those my your his her its our their
    and or but so yet for nor if then than as at by in into on onto of off out up
    down over under from to with without within across through about after before
    while when where why how what which who whom whose all any both each every few
    more most other some such no not only own same too very just now once here there
    is are was were be been being am do does did doing have has had having can could
    will would shall should may might must let lets go goes going went gone come comes
    coming came get gets got give gives gave take takes took make makes made put puts
    keep keeps kept hold holds held see sees saw look looks read reads press presses
    type types walk walks stand stands stop stops start starts open opens close closes
    seal seals send sends send drop drops pick picks choose chooses find finds ask asks
    say says tell tells know knows think thinks want wants need needs use uses work
    works try tries turn turns move moves add adds divide divides multiply multiplies
    subtract subtracts solve solves check checks prove proves cover covers apply
    applies undo undoes clear clears build builds place places jump jumps fly flies
    again still already never always yet also even ever back away out again
    first second third next last one two three four five six seven eight nine ten
    left right up down straight over under near far here there
    you it he she we they i me him us them
    true false right wrong same different new old good bad
    hard easy fast slow long short high low big small
    yours mine theirs nothing something anything everything nobody somebody
    please thank thanks yes ok okay
    m km cm sec min hr
    above below beside inside outside between beyond behind ahead against during
    since until upon toward towards along around past per via plus minus versus
    whether unless because though although whereas whenever wherever whatever
    somewhere anywhere everywhere nowhere often rarely usually always mostly
    exactly properly simply merely quietly slowly quickly deliberately clearly
    honestly nearly almost hardly barely fully wholly entirely truly really
    instead rather quite enough much many little less least best worse worst
    another others else own several either neither none whole entire single
    match matches matched describes describe described carries carry carried
    counts count counted reaches reach reached costs cost holds hold held
    means mean meant shows show shown tells tell told needs need needed
    gives give given brings bring lands land landed leans lean leaned
    grew grow grown grows pays pay paid paying spent spend spends
    throws throw thrown reads read pressing pressed typing typed walking walked
    standing stands stood sitting sat lying lies lay running ran flying flew
    falling fell rising rose risen closing closed opening opened sealing sealed
    proving proved proven working worked answering answered asking asked
    making made taking took giving gave getting got keeping kept
    coming came going gone doing done being been having had
    looks looking looked seems seem seemed becomes become became
    applies apply applied undoes undone clears clear cleared
    picks pick picked chooses choose chose sends send sent
    tap taps tapped press pressed jump jumps jumped fly flies
    live lives lit unlit spare spared knock knocks knocked
    fewer harder easier higher lower deeper wider longer shorter faster slower
    later earlier sooner further farther bigger smaller older newer
    ready done open shut full empty clean cold warm dark light gold pale
    real true false whole half twice thrice again once
    pale ones one none each both all any some most
    yet still already never ever also even too very just only quite
    per apiece each every whatever otherwise nonetheless meanwhile
    ahead behind forward backward upward downward outward inward
    across through over under between beside near far next last first
    who whom whose which what where when why how than then thus hence
    say says said tell told ask asks asked answer answers answered`.split(/\s+/).filter(Boolean)),
  es: new Set(`el la los las un una unos unas de del al a en con sin por para
    y o pero si que qué cuando donde cómo cuál quien cuyo
    es son era eran fue fueron ser estar está están estaba
    se lo le les me te nos os su sus mi mis tu tus
    no ni ya aún todavía muy más menos tan tanto todo toda todos todas
    este esta estos estas ese esa esos esas aquel aquella
    hay hace haz pulsa toca abre cierra sella escribe elige mira lee suma resta
    multiplica divide resuelve comprueba usa mantén ve entra sal salta vuela
    primero luego después antes ahora aquí allí siempre nunca
    izquierda derecha arriba abajo cerca lejos`.split(/\s+/).filter(Boolean)),
  pl: new Set(`i a ale lub albo oraz że żeby aby bo więc czy jak gdy kiedy gdzie
    w we na do od z ze za po przed pod nad przy o u bez dla przez między
    jest są był była było były będzie będą nie tak już jeszcze tylko bardzo
    to ta ten te ci tego tej tym tych tam tu teraz potem najpierw znowu
    naciśnij wpisz otwórz zamknij zapieczętuj wybierz spójrz przeczytaj dodaj
    odejmij pomnóż podziel rozwiąż sprawdź użyj trzymaj idź wejdź wyjdź skocz leć
    twój twoja twoje mój moja moje swój jego jej ich
    lewo prawo góra dół blisko daleko każdy każda każde wszystko nic coś
    jeden dwa trzy cztery pięć sześć siedem osiem dziewięć dziesięć
    m km s min godz`.split(/\s+/).filter(Boolean)),
};

/** Chunks that read as one idea and are exempt from the cluster count. */
export const CLUSTER_EXEMPT = [
  /common core/i, /simplified technical english/i,
];

export const MAX_SENTENCE_WORDS = 25;
export const AIM_SENTENCE_WORDS = 20;
export const MAX_CLUSTER = 3;
