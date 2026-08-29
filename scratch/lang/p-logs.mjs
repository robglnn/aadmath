// The four log decks. Every one of them says the same three things — there is
// a rule at the top, every row obeys it, one row is gone — so they are built
// from one frame with the machine and the loss swapped in. Short by
// construction: no situation here runs past fifteen words.
const LOSS = {
  en: ['burned away', 'is blank', 'has gone', 'was scrubbed out', 'came back empty', 'washed off', 'was lost', 'is missing'],
  es: ['se quemó', 'está en blanco', 'ha desaparecido', 'fue borrada', 'volvió vacía', 'se lavó', 'se perdió', 'falta'],
  pl: ['spłonął', 'jest pusty', 'zniknął', 'został wytarty', 'wrócił pusty', 'wyblakł', 'zaginął', 'przepadł'],
};
const VP = {
  en: ['made every row from the rule at the top', 'derives every row from the rule in its header', 'computes every row from the rule above it'],
  es: ['sacó cada fila de la regla de arriba', 'deriva cada fila de la regla de su cabecera', 'calcula cada fila con la regla de encima'],
  pl: ['wyliczył każdy wiersz z reguły u góry', 'wyprowadza każdy wiersz z reguły w nagłówku', 'liczy każdy wiersz według reguły powyżej'],
};

// key: [EN log name, ES log name, PL log name]
const RULE = {
  logDrone:      ['The survey drone log', 'El registro del dron', 'Dziennik drona'],
  logCore:       ['The core log', 'El registro del núcleo', 'Dziennik rdzenia'],
  logTide:       ['The tide log', 'El registro de mareas', 'Dziennik pływomierza'],
  logKiln:       ['The kiln log', 'El registro del horno', 'Dziennik pieca'],
  logRelay:      ['The relay log', 'El registro del repetidor', 'Dziennik przekaźnika'],
  logOrchard:    ['The orchard log', 'El registro del huerto', 'Dziennik sadu'],
  logSonde:      ['The sonde log', 'El registro de la sonda', 'Dziennik sondy'],
  logCentrifuge: ['The centrifuge log', 'El registro de la centrifugadora', 'Dziennik wirówki'],
  logMill:       ['The mill log', 'El registro del molino', 'Dziennik młyna'],
  logHatchery:   ['The hatchery log', 'El registro del criadero', 'Dziennik wylęgarni'],
  logAssay:      ['The assay log', 'El registro del ensayo', 'Dziennik probierni'],
  logFurnace:    ['The furnace log', 'El registro del horno alto', 'Dziennik wielkiego pieca'],
  logPress:      ['The press log', 'El registro de la prensa', 'Dziennik prasy'],
  logConveyor:   ['The conveyor log', 'El registro de la cinta', 'Dziennik taśmy'],
  logAntenna:    ['The antenna log', 'El registro de la antena', 'Dziennik anteny'],
  logGlacier:    ['The glacier log', 'El registro del glaciar', 'Dziennik lodowca'],
  logStill:      ['The still log', 'El registro del alambique', 'Dziennik destylarki'],
  logLoom:       ['The loom log', 'El registro del telar', 'Dziennik krosna'],
  logForge:      ['The forge log', 'El registro de la fragua', 'Dziennik kuźni'],
  logHive:       ['The hive log', 'El registro de la colmena', 'Dziennik ula'],
  logSpring:     ['The spring log', 'El registro del manantial', 'Dziennik źródła'],
  logDynamo:     ['The dynamo log', 'El registro de la dinamo', 'Dziennik prądnicy'],
  logBellows:    ['The bellows log', 'El registro del fuelle', 'Dziennik miecha'],
  logCrusher:    ['The crusher log', 'El registro de la trituradora', 'Dziennik kruszarki'],
  logSluice:     ['The sluice log', 'El registro de la compuerta', 'Dziennik zastawki'],
  logAviary:     ['The aviary log', 'El registro de la pajarera', 'Dziennik ptaszarni'],
  logCompass:    ['The compass log', 'El registro de la brújula', 'Dziennik kompasu'],
  logGrinder:    ['The grinder log', 'El registro de la rectificadora', 'Dziennik szlifierki'],
  logStack:      ['The stack log', 'El registro de la chimenea', 'Dziennik komina'],
  logWeir:       ['The weir log', 'El registro del vertedero', 'Dziennik jazu'],
  logDrier:      ['The drier log', 'El registro del secadero', 'Dziennik suszarni'],
  logCarding:    ['The carding log', 'El registro de la carda', 'Dziennik zgrzeblarki'],
};

// Two writers into one column, so the header is a sum.
const SUM = {
  logTwoSensors: ['Two sensors', 'Dos sensores', 'Dwa czujniki'],
  logTwoCrews:   ['Two crews', 'Dos cuadrillas', 'Dwie ekipy'],
  logTwoFeeds:   ['Two feeds', 'Dos alimentaciones', 'Dwa podajniki'],
  logTwoWells:   ['Two wells', 'Dos pozos', 'Dwie studnie'],
  logTwoShifts:  ['Both shifts', 'Los dos turnos', 'Obie zmiany'],
  logTwoStills:  ['Two stills', 'Dos alambiques', 'Dwie destylarki'],
  logTwoMasts:   ['Two masts', 'Dos mástiles', 'Dwa maszty'],
  logTwoBelts:   ['Two belts', 'Dos cintas', 'Dwie taśmy'],
};

// One unit measured, then multiplied up for all of them.
const SCALED = {
  logBanks:    ['one bank of the array', 'un banco del panel', 'jedną sekcję baterii'],
  logPerCrate: ['one crate', 'una caja', 'jedną skrzynię'],
  logPerDeck:  ['one deck', 'una cubierta', 'jeden pokład'],
  logPerCoil:  ['one coil', 'una bobina', 'jedną cewkę'],
  logPerBay:   ['one bay of the ring', 'un vano del anillo', 'jedno przęsło pierścienia'],
  logPerRow:   ['one row of the field', 'una hilera del campo', 'jeden rząd pola'],
  logPerSled:  ['one sled of the train', 'un trineo del convoy', 'jedne sanie z pociągu'],
  logPerHive:  ['one hive', 'una colmena', 'jeden ul'],
};

// In and out, and it is the input that burned.
const INV = {
  logAirlock:  ['airlock', 'de la esclusa', 'śluzy'],
  logGain:     ['gain stage', 'de la etapa de ganancia', 'wzmacniacza'],
  logFab:      ['fabricator', 'de la fabricadora', 'wytwórnicy'],
  logRefinery: ['refinery', 'de la refinería', 'rafinerii'],
  logCourier:  ['courier', 'del correo', 'kuriera'],
  logStamp:    ['stamping press', 'de la prensa', 'prasy'],
  logDye:      ['dye bath', 'del tinte', 'farbiarni'],
  logTuner:    ['tuner', 'del sintonizador', 'stroiciela'],
  logMint:     ['mint', 'de la ceca', 'mennicy'],
  logSmelter:  ['smelter', 'de la fundición', 'huty'],
  logHone:     ['honing bench', 'del afinado', 'gładzarki'],
  logBleach:   ['bleach vat', 'de la cuba de lejía', 'bielnika'],
};

const out = {};
let i = 0;
for (const [k, [en, es, pl]] of Object.entries(RULE)) {
  const j = i++;
  out['ctx.' + k] = {
    en: `${en} ${VP.en[j % 3]}. One row ${LOSS.en[j % 8]}.`,
    es: `${es} ${VP.es[j % 3]}. Una fila ${LOSS.es[j % 8]}.`,
    pl: `${pl} ${VP.pl[j % 3]}. Jeden wiersz ${LOSS.pl[j % 8]}.`,
  };
}
i = 0;
for (const [k, [en, es, pl]] of Object.entries(SUM)) {
  const j = i++;
  out['ctx.' + k] = {
    en: `${en} write into one column, so its header is a sum. One row ${LOSS.en[j % 8]}.`,
    es: `${es} escriben en una sola columna, así que su cabecera es una suma. Una fila ${LOSS.es[j % 8]}.`,
    pl: `${pl} piszą do jednej kolumny, więc jej nagłówek jest sumą. Jeden wiersz ${LOSS.pl[j % 8]}.`,
  };
}
i = 0;
for (const [k, [en, es, pl]] of Object.entries(SCALED)) {
  const j = i++;
  out['ctx.' + k] = {
    en: `The header measures ${en}, then multiplies up for all of them. One row ${LOSS.en[j % 8]}.`,
    es: `La cabecera mide ${es} y luego multiplica por todas. Una fila ${LOSS.es[j % 8]}.`,
    pl: `Nagłówek mierzy ${pl}, a potem mnoży przez wszystkie. Jeden wiersz ${LOSS.pl[j % 8]}.`,
  };
}
for (const [k, [en, es, pl]] of Object.entries(INV)) {
  out['ctx.' + k] = {
    en: `The ${en} log pairs what went in with what came out. One line lost its input.`,
    es: `El registro ${es} empareja lo que entró con lo que salió. Una línea perdió su entrada.`,
    pl: `Dziennik ${pl} zestawia to, co weszło, z tym, co wyszło. Jedna linia straciła wejście.`,
  };
}
export default out;
