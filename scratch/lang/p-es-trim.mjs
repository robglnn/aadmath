// Spanish runs two or three words longer than English for the same sentence,
// which is exactly how a stem that fits in English overflows in Madrid. These
// are the situations and questions that only overflowed in Spanish.
const FEE = {
  dockFee:   ['clamp on',        'amarrar',     'dobicie'],
  hangarFee: ['close the doors', 'cerrar',      'zamknięcie wrót'],
  tugFee:    ['make fast',       'engancharse', 'podanie liny'],
  berthFee:  ['take the lines',  'atracar',     'przyjęcie cum'],
  craneFee:  ['swing out',       'desplegarse', 'wysunięcie wysięgnika'],
  kilnFee:   ['light it',        'encenderlo',  'rozpalenie'],
  lockupFee: ['open the door',   'abrir',       'otwarcie drzwi'],
  pilotFee:  ['come aboard',     'embarcar',    'wejście na pokład'],
  slipFee:   ['haul out',        'varar',       'wyciągnięcie na ląd'],
  stallFee:  ['claim it',        'reclamarlo',  'zajęcie miejsca'],
  rigFee:    ['sign',            'firmarlo',    'podpis'],
  escortFee: ['form up',         'formar',      'sformowanie'],
};
const VENUE = {
  dockFee:   ['The dock', 'El muelle', 'Dok', 'dock', 'muelle', 'z doku'],
  hangarFee: ['The hangar', 'El hangar', 'Hangar', 'hangar', 'hangar', 'z hangaru'],
  tugFee:    ['The tug', 'El remolcador', 'Holownik', 'tow', 'remolque', 'za holowanie'],
  berthFee:  ['The berth', 'El atraque', 'Nabrzeże', 'berth', 'atraque', 'za nabrzeże'],
  craneFee:  ['The crane', 'La grúa', 'Żuraw', 'crane', 'grúa', 'za żuraw'],
  kilnFee:   ['The kiln', 'El horno', 'Piec', 'kiln', 'horno', 'za piec'],
  lockupFee: ['The lockup', 'El trastero', 'Skład', 'lockup', 'trastero', 'ze składu'],
  pilotFee:  ['The pilot', 'El práctico', 'Pilot', 'pilot', 'práctico', 'od pilota'],
  slipFee:   ['The slip', 'La grada', 'Pochylnia', 'slip', 'grada', 'z pochylni'],
  stallFee:  ['The stall', 'El puesto', 'Stragan', 'stall', 'puesto', 'za stragan'],
  rigFee:    ['The rig', 'El equipo', 'Osprzęt', 'rig', 'equipo', 'za osprzęt'],
  escortFee: ['The escort', 'La escolta', 'Eskorta', 'escort', 'escolta', 'za eskortę'],
};
const BILLKEY = {
  dockFee: 'dockBill', hangarFee: 'hangarBill', tugFee: 'tugBill', berthFee: 'berthBill',
  craneFee: 'craneBill', kilnFee: 'kilnBill', lockupFee: 'lockupBill', pilotFee: 'pilotBill',
  slipFee: 'slipBill', stallFee: 'stallBill', rigFee: 'rigBill', escortFee: 'escortBill',
};
const out = {};
for (const [k, [enAct, esAct, plAct]] of Object.entries(FEE)) {
  const [en, es, pl, venEn, venEs, venPl] = VENUE[k];
  out['ctx.' + k] = {
    en: `${en} takes {b} credits to ${enAct}, then {a} a cycle.`,
    es: `${es} cobra {b} créditos por ${esAct} y {a} por ciclo.`,
    pl: `${pl} bierze {b} kr. za ${plAct} i {a} kr. za każdy cykl.`,
  };
  out['ctx.' + BILLKEY[k]] = {
    en: `The ${venEn} bill lost its working: {b} credits to ${enAct}, then {a} a cycle.`,
    es: `La factura del ${venEs} llega sin cuentas: {b} créditos por ${esAct} y {a} por ciclo.`,
    pl: `Rachunek ${venPl} zgubił wyliczenie: {b} kr. za ${plAct} i {a} kr. za każdy cykl.`,
  };
}

// in and out, and it is the input that burned
const INV = {
  logAirlock:  ['airlock', 'de la esclusa', 'śluzy'],
  logGain:     ['gain stage', 'de la ganancia', 'wzmacniacza'],
  logFab:      ['fabricator', 'de la fabricadora', 'wytwórnicy'],
  logRefinery: ['refinery', 'de la refinería', 'rafinerii'],
  logCourier:  ['courier', 'del correo', 'kuriera'],
  logStamp:    ['stamping press', 'de la prensa', 'prasy'],
  logDye:      ['dye bath', 'del tinte', 'farbiarni'],
  logTuner:    ['tuner', 'del sintonizador', 'stroiciela'],
  logMint:     ['mint', 'de la ceca', 'mennicy'],
  logSmelter:  ['smelter', 'de la fundición', 'huty'],
  logHone:     ['honing bench', 'del afinado', 'gładzarki'],
  logBleach:   ['bleach vat', 'de la lejía', 'bielnika'],
};
for (const [k, [en, es, pl]] of Object.entries(INV)) {
  out['ctx.' + k] = {
    en: `The ${en} log pairs what went in with what came out. One line lost its input.`,
    es: `El registro ${es} empareja entrada y salida. Una línea perdió su entrada.`,
    pl: `Dziennik ${pl} zestawia to, co weszło, z tym, co wyszło. Jedna linia straciła wejście.`,
  };
}

Object.assign(out, {
'ctx.brineTank': {
 en: 'The brine tank reports a level, never a history. {b} tonnes were drawn; it stands at {c}.',
 es: 'El depósito de salmuera no guarda historial. Se sacaron {b} toneladas; está en {c}.',
 pl: 'Zbiornik solanki podaje poziom, nigdy historii. Pobrano {b} «b|one:tonę|few:tony|many:ton»; stoi na {c}.' },
'ctx.icehouse': {
 en: 'The icehouse scale knows today and nothing before. {b} tonnes went to the galley; it reads {c}.',
 es: 'La báscula de la nevera no recuerda nada. A la cocina fueron {b} toneladas; marca {c}.',
 pl: 'Waga lodowni zna dziś i nic wcześniej. Do kuchni poszło {b} «b|one:tona|few:tony|many:ton»; pokazuje {c}.' },
'ctx.nestedBuoys': {
 en: 'A buoy pings ${v}$ seconds a cycle. A string holds {a} buoys. {b} strings are moored.',
 es: 'Una boya emite ${v}$ segundos por ciclo. Una línea lleva {a} boyas. Hay {b} líneas fondeadas.',
 pl: 'Boja nadaje ${v}$ sekund na cykl. Lina niesie {a} «a|one:boję|few:boje|many:boi». Zakotwiczono {b} «b|one:linę|few:liny|many:lin».' },
'ctx.nestedCells': {
 en: 'A fuel cell gives ${v}$ watts. A bank takes {a} cells. {b} banks are live.',
 es: 'Una pila da ${v}$ vatios. Un banco lleva {a} pilas. Hay {b} bancos vivos.',
 pl: 'Ogniwo daje ${v}$ watów. Bateria bierze {a} «a|one:ogniwo|few:ogniwa|many:ogniw». Podłączono {b} «b|one:baterię|few:baterie|many:baterii».' },
'ask.howManySecondsPing': {
 en: 'If ${v} = {val}$, how many seconds of pinging?',
 es: 'Si ${v} = {val}$, ¿cuántos segundos de emisión?',
 pl: 'Jeśli ${v} = {val}$, ile sekund nadawania?' },
'ask.startingBunker': {
 en: 'What did the bunker hold before?',
 es: '¿Cuánto había en la tolva antes?',
 pl: 'Ile było w zasobniku wcześniej?' },
'ask.startingSaltPan': {
 en: 'What was on the pan before?',
 es: '¿Qué había en la salina antes?',
 pl: 'Co było na panwi wcześniej?' },
});
export default out;
