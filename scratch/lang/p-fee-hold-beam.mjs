// A fixed charge and a charge per cycle, in three views: the tariff, the
// running strip with a hole in it, and the bill with the working torn off.
// All three are dealt together, so the tariff has to stay short enough that
// tariff + strip + question still fits inside twenty-five words.
const FEE = {
  dockFee:   ['The dock', 'clamp on',        'El muelle', 'amarrar',            'Dok',        'dobicie'],
  hangarFee: ['The hangar', 'close the doors', 'El hangar', 'cerrar las puertas', 'Hangar',     'zamknięcie wrót'],
  tugFee:    ['The tug', 'make fast',        'El remolcador', 'hacer firme',    'Holownik',   'podanie liny'],
  berthFee:  ['The berth', 'take the lines', 'El atraque', 'tomar amarras',     'Nabrzeże',   'przyjęcie cum'],
  craneFee:  ['The crane', 'swing out',      'La grúa', 'sacar la pluma',       'Żuraw',      'wysunięcie wysięgnika'],
  kilnFee:   ['The kiln', 'light it',        'El horno', 'encenderlo',          'Piec',       'rozpalenie'],
  lockupFee: ['The lockup', 'open the door', 'El trastero', 'abrir la puerta',  'Skład',      'otwarcie drzwi'],
  pilotFee:  ['The pilot', 'come aboard',    'El práctico', 'subir a bordo',    'Pilot',      'wejście na pokład'],
  slipFee:   ['The slip', 'haul out',        'La grada', 'varar',               'Pochylnia',  'wyciągnięcie na ląd'],
  stallFee:  ['The stall', 'claim it',       'El puesto', 'reclamarlo',         'Stragan',    'zajęcie miejsca'],
  rigFee:    ['The rig', 'sign for it',      'El equipo', 'firmarlo',           'Osprzęt',    'podpis'],
  escortFee: ['The escort', 'form up',       'La escolta', 'formar',            'Eskorta',    'sformowanie'],
};
// Which log/bill key belongs to which tariff, and the words for the venue.
const VIEW = {
  dockFee:   ['dockLog', 'dockBill', 'dock', 'muelle', 'z doku'],
  hangarFee: ['hangarLog', 'hangarBill', 'hangar', 'hangar', 'z hangaru'],
  tugFee:    ['tugLog', 'tugBill', 'tow', 'remolque', 'za holowanie'],
  berthFee:  ['berthLog', 'berthBill', 'berth', 'atraque', 'za nabrzeże'],
  craneFee:  ['craneLog', 'craneBill', 'crane', 'grúa', 'za żuraw'],
  kilnFee:   ['kilnFeeLog', 'kilnBill', 'kiln', 'horno', 'za piec'],
  lockupFee: ['lockupLog', 'lockupBill', 'lockup', 'trastero', 'ze składu'],
  pilotFee:  ['pilotLog', 'pilotBill', 'pilot', 'práctico', 'od pilota'],
  slipFee:   ['slipLog', 'slipBill', 'slip', 'grada', 'z pochylni'],
  stallFee:  ['stallLog', 'stallBill', 'stall', 'puesto', 'za stragan'],
  rigFee:    ['rigLog', 'rigBill', 'rig', 'equipo', 'za osprzęt'],
  escortFee: ['escortLog', 'escortBill', 'escort', 'escolta', 'za eskortę'],
};
const GONE = {
  en: ['is rubbed out', 'was scrubbed off', 'is missing', 'was torn away'],
  es: ['está borrada', 'la han raspado', 'falta', 'la arrancaron'],
  pl: ['jest wytarta', 'została zdrapana', 'brakuje jej', 'została oderwana'],
};

const out = {};
let i = 0;
for (const [k, [en, act, es, esAct, pl, plAct]] of Object.entries(FEE)) {
  const j = i++;
  const [logKey, billKey, venEn, venEs, venPl] = VIEW[k];
  out['ctx.' + k] = {
    en: `${en} takes {b} credits to ${act}, then {a} a cycle.`,
    es: `${es} cobra {b} créditos por ${esAct} y {a} por ciclo.`,
    pl: `${pl} bierze {b} kr. za ${plAct} i {a} kr. za każdy cykl.`,
  };
  out['ctx.' + logKey] = {
    en: `One figure on the running strip ${GONE.en[j % 4]}.`,
    es: `Una cifra de la tira corrida ${GONE.es[j % 4]}.`,
    pl: `Jedna liczba na bieżącym pasku ${GONE.pl[j % 4]}.`,
  };
  out['ctx.' + billKey] = {
    en: `The ${venEn} bill lost its working: {b} credits to ${act}, then {a} a cycle.`,
    es: `La factura del ${venEs} perdió las cuentas: {b} créditos por ${esAct} y {a} por ciclo.`,
    pl: `Rachunek ${venPl} zgubił wyliczenie: {b} kr. za ${plAct} i {a} kr. za każdy cykl.`,
  };
}

// ---- a gauge that reads the present and never recorded the past -----------
Object.assign(out, {
'ctx.cargo': {
 en: 'The hold gauge has no memory. {b} tonnes went out, and it reads {c}.',
 es: 'El indicador de la bodega no tiene memoria. Salieron {b} toneladas y marca {c}.',
 pl: 'Wskaźnik ładowni nie ma pamięci. Zdjęto {b} «b|one:tonę|few:tony|many:ton», a pokazuje {c}.' },
'ctx.silo': {
 en: 'The grain silo has no memory. {b} tonnes were drawn off, and it reads {c}.',
 es: 'El silo de grano no tiene memoria. Se sacaron {b} toneladas y marca {c}.',
 pl: 'Silos zbożowy nie ma pamięci. Wybrano {b} «b|one:tonę|few:tony|many:ton», a pokazuje {c}.' },
'ctx.reservoir': {
 en: 'The reservoir gauge is a level, not a history. {b} tonnes went out; it reads {c}.',
 es: 'El indicador del depósito es un nivel, no un historial. Salieron {b} toneladas; marca {c}.',
 pl: 'Wskaźnik zbiornika to poziom, nie historia. Ubytek: {b} «b|one:tona|few:tony|many:ton»; pokazuje {c}.' },
'ctx.bunker': {
 en: 'The ore bunker reports now, never before. {b} tonnes went up the hoist; it reads {c}.',
 es: 'La tolva de mineral informa del ahora, nunca del antes. Subieron {b} toneladas; marca {c}.',
 pl: 'Zasobnik rudy podaje teraz, nigdy wcześniej. Wyciągiem poszło {b} «b|one:tona|few:tony|many:ton»; pokazuje {c}.' },
'ctx.cistern': {
 en: 'The cistern gauge is a level, not a ledger. {b} tonnes were drawn; it reads {c}.',
 es: 'El indicador del aljibe es un nivel, no un libro. Se sacaron {b} toneladas; marca {c}.',
 pl: 'Wskaźnik cysterny to poziom, nie księga. Pobrano {b} «b|one:tonę|few:tony|many:ton»; pokazuje {c}.' },
'ctx.saltPan': {
 en: 'The salt pan is weighed, never remembered. {b} tonnes were carted off; the scale reads {c}.',
 es: 'La salina se pesa, no se recuerda. Se llevaron {b} toneladas; la báscula marca {c}.',
 pl: 'Panwię solną się waży, a nie pamięta. Wywieziono {b} «b|one:tonę|few:tony|many:ton»; waga pokazuje {c}.' },
'ctx.icehouse': {
 en: 'The icehouse scale knows today and nothing before it. {b} tonnes went to the galley; it reads {c}.',
 es: 'La báscula de la nevera sabe del hoy y de nada anterior. A la cocina fueron {b} toneladas; marca {c}.',
 pl: 'Waga lodowni zna dziś i nic wcześniej. Do kuchni poszło {b} «b|one:tona|few:tony|many:ton»; pokazuje {c}.' },
'ctx.tailings': {
 en: 'The tailings scale reports the pile as it stands. {b} tonnes were hauled out; it reads {c}.',
 es: 'La báscula informa de la escombrera tal como está. Se sacaron {b} toneladas; marca {c}.',
 pl: 'Waga podaje hałdę taką, jaka jest. Wywieziono {b} «b|one:tonę|few:tony|many:ton»; pokazuje {c}.' },
'ctx.stockpile': {
 en: 'The stockpile pad has no memory at all. {b} tonnes were loaded out; the pad reads {c}.',
 es: 'La plataforma del acopio no tiene memoria alguna. Se cargaron {b} toneladas; la plataforma marca {c}.',
 pl: 'Płyta składowiska nie ma żadnej pamięci. Załadowano {b} «b|one:tonę|few:tony|many:ton»; płyta pokazuje {c}.' },
'ctx.feedBin': {
 en: 'The feed bin gives a weight, not a history. {b} tonnes went up; it reads {c}.',
 es: 'El silo de pienso da un peso, no un historial. Subieron {b} toneladas; marca {c}.',
 pl: 'Zasobnik paszy podaje masę, nie historię. W górę poszło {b} «b|one:tona|few:tony|many:ton»; pokazuje {c}.' },
'ctx.coalHeap': {
 en: 'The weighbridge remembers nothing. {b} tonnes went to the furnace, and it reads {c}.',
 es: 'La báscula puente no recuerda nada. Al horno fueron {b} toneladas y marca {c}.',
 pl: 'Waga pomostowa nic nie pamięta. Do pieca poszło {b} «b|one:tona|few:tony|many:ton», a pokazuje {c}.' },
'ctx.brineTank': {
 en: 'The brine tank reports a level, never a history. {b} tonnes were drawn; it stands at {c}.',
 es: 'El depósito de salmuera da un nivel, nunca un historial. Se sacaron {b} toneladas; está en {c}.',
 pl: 'Zbiornik solanki podaje poziom, nigdy historii. Pobrano {b} «b|one:tonę|few:tony|many:ton»; stoi na {c}.' },
'ctx.slagPile': {
 en: 'The slag scale has no memory. {b} tonnes were carted off; it reads {c}.',
 es: 'La báscula de la escoria no tiene memoria. Se llevaron {b} toneladas; marca {c}.',
 pl: 'Waga żużlu nie ma pamięci. Wywieziono {b} «b|one:tonę|few:tony|many:ton»; pokazuje {c}.' },
'ctx.waterButt': {
 en: 'The water butt has a float and no memory. {b} tonnes went out; it sits at {c}.',
 es: 'La cuba tiene flotador y ninguna memoria. Salieron {b} toneladas; se queda en {c}.',
 pl: 'Kadź ma pływak i żadnej pamięci. Ubyło z niej {b} «b|one:tona|few:tony|many:ton»; stoi na {c}.' },

// ---- one sealed thing on a level beam ------------------------------------
'ctx.beamOne': {
 en: 'The cargo beam hangs level: one sealed crate and {b} counterweights against {c} counterweights.',
 es: 'La viga de carga cuelga nivelada: una caja sellada y {b} contrapesos contra {c} contrapesos.',
 pl: 'Belka ładunkowa wisi w poziomie: zaplombowana skrzynia i odważniki o masie {b} przeciw odważnikom o masie {c}.' },
'ctx.assayOne': {
 en: 'The assay scale sits level: one unopened canister and {b} counterweights against {c} counterweights.',
 es: 'La balanza de ensayo está nivelada: un bidón sin abrir y {b} contrapesos contra {c} contrapesos.',
 pl: 'Waga probiercza stoi w poziomie: zaplombowany bęben i odważniki o masie {b} przeciw odważnikom o masie {c}.' },
'ctx.beamSack': {
 en: 'The grain beam hangs level: one sealed sack and {b} counterweights against {c} counterweights.',
 es: 'La viga del grano cuelga nivelada: un saco sellado y {b} contrapesos contra {c} contrapesos.',
 pl: 'Belka zbożowa wisi w poziomie: zaplombowany worek i odważniki o masie {b} przeciw odważnikom o masie {c}.' },
'ctx.beamCask': {
 en: 'The cellar beam sits level: one unopened cask and {b} counterweights against {c} counterweights.',
 es: 'La viga de la bodega está nivelada: una barrica sin abrir y {b} contrapesos contra {c} contrapesos.',
 pl: 'Belka piwniczna stoi w poziomie: nieotwarta beczka i odważniki o masie {b} przeciw odważnikom o masie {c}.' },
'ctx.beamSeed': {
 en: 'The seed beam is level: one unopened pod and {b} counterweights against {c} counterweights.',
 es: 'La viga de siembra está nivelada: una vaina sin abrir y {b} contrapesos contra {c} contrapesos.',
 pl: 'Belka nasienna jest w poziomie: nieotwarty strąk i odważniki o masie {b} przeciw odważnikom o masie {c}.' },
'ctx.beamCore': {
 en: 'The core beam hangs level: one capped core and {b} counterweights against {c} counterweights.',
 es: 'La viga de testigos cuelga nivelada: un testigo tapado y {b} contrapesos contra {c} contrapesos.',
 pl: 'Belka rdzeniowa wisi w poziomie: zakorkowany rdzeń i odważniki o masie {b} przeciw odważnikom o masie {c}.' },
'ctx.beamBale': {
 en: 'The bale beam rests level: one bound bale and {b} counterweights against {c} counterweights.',
 es: 'La viga de pacas descansa nivelada: una paca atada y {b} contrapesos contra {c} contrapesos.',
 pl: 'Belka belowa spoczywa w poziomie: związana bela i odważniki o masie {b} przeciw odważnikom o masie {c}.' },
'ctx.beamJar': {
 en: 'The bench beam is level: one sealed jar and {b} counterweights against {c} counterweights.',
 es: 'La viga del banco está nivelada: un tarro sellado y {b} contrapesos contra {c} contrapesos.',
 pl: 'Belka warsztatowa jest w poziomie: zaplombowany słój i odważniki o masie {b} przeciw odważnikom o masie {c}.' },
'ctx.beamBillet': {
 en: 'The forge beam sits level: one unstamped billet and {b} counterweights against {c} counterweights.',
 es: 'La viga de la fragua está nivelada: un tocho sin marcar y {b} contrapesos contra {c} contrapesos.',
 pl: 'Belka kuźnicza stoi w poziomie: nieostemplowany kęs i odważniki o masie {b} przeciw odważnikom o masie {c}.' },
'ctx.beamCrucible': {
 en: 'The assay beam hangs level: one lidded crucible and {b} counterweights against {c} counterweights.',
 es: 'La viga de ensayo cuelga nivelada: un crisol con tapa y {b} contrapesos contra {c} contrapesos.',
 pl: 'Belka probiercza wisi w poziomie: przykryty tygiel i odważniki o masie {b} przeciw odważnikom o masie {c}.' },
'ctx.beamKeg': {
 en: 'The stores beam hangs level: one sealed keg and {b} counterweights against {c} counterweights.',
 es: 'La viga del almacén cuelga nivelada: un barrilete sellado y {b} contrapesos contra {c} contrapesos.',
 pl: 'Belka magazynowa wisi w poziomie: zaplombowany antał i odważniki o masie {b} przeciw odważnikom o masie {c}.' },
'ctx.beamTin': {
 en: 'The galley beam sits level: one unopened tin and {b} counterweights against {c} counterweights.',
 es: 'La viga de la cocina está nivelada: una lata sin abrir y {b} contrapesos contra {c} contrapesos.',
 pl: 'Belka kambuzowa stoi w poziomie: nieotwarta puszka i odważniki o masie {b} przeciw odważnikom o masie {c}.' },

// ---- k sealed things on a level beam -------------------------------------
'ctx.beamMany': {
 en: 'The cargo beam hangs level: {k} sealed crates against {c} counterweights.',
 es: 'La viga de carga cuelga nivelada: {k} cajas selladas contra {c} contrapesos.',
 pl: 'Belka ładunkowa wisi w poziomie: {k} «k|one:zaplombowana skrzynia|few:zaplombowane skrzynie|many:zaplombowanych skrzyń» przeciw odważnikom o masie {c}.' },
'ctx.assayMany': {
 en: 'The assay scale sits level: {k} canisters against {c} counterweights.',
 es: 'La balanza de ensayo está nivelada: {k} bidones contra {c} contrapesos.',
 pl: 'Waga probiercza stoi w poziomie: {k} «k|one:bęben|few:bębny|many:bębnów» przeciw odważnikom o masie {c}.' },
'ctx.beamManySacks': {
 en: 'The grain beam hangs level: {k} sealed sacks against {c} counterweights.',
 es: 'La viga del grano cuelga nivelada: {k} sacos sellados contra {c} contrapesos.',
 pl: 'Belka zbożowa wisi w poziomie: {k} «k|one:zaplombowany worek|few:zaplombowane worki|many:zaplombowanych worków» przeciw odważnikom o masie {c}.' },
'ctx.beamManyCasks': {
 en: 'The cellar beam sits level: {k} unopened casks against {c} counterweights.',
 es: 'La viga de la bodega está nivelada: {k} barricas sin abrir contra {c} contrapesos.',
 pl: 'Belka piwniczna stoi w poziomie: {k} «k|one:nieotwarta beczka|few:nieotwarte beczki|many:nieotwartych beczek» przeciw odważnikom o masie {c}.' },
'ctx.beamManyCores': {
 en: 'The core beam is level: {k} capped cores against {c} counterweights.',
 es: 'La viga de testigos está nivelada: {k} testigos tapados contra {c} contrapesos.',
 pl: 'Belka rdzeniowa jest w poziomie: {k} «k|one:zakorkowany rdzeń|few:zakorkowane rdzenie|many:zakorkowanych rdzeni» przeciw odważnikom o masie {c}.' },
'ctx.beamManyBales': {
 en: 'The bale beam rests level: {k} bound bales against {c} counterweights.',
 es: 'La viga de pacas descansa nivelada: {k} pacas atadas contra {c} contrapesos.',
 pl: 'Belka belowa spoczywa w poziomie: {k} «k|one:związana bela|few:związane bele|many:związanych bel» przeciw odważnikom o masie {c}.' },
'ctx.beamManyBillets': {
 en: 'The forge beam sits level: {k} unstamped billets against {c} counterweights.',
 es: 'La viga de la fragua está nivelada: {k} tochos sin marcar contra {c} contrapesos.',
 pl: 'Belka kuźnicza stoi w poziomie: {k} «k|one:nieostemplowany kęs|few:nieostemplowane kęsy|many:nieostemplowanych kęsów» przeciw odważnikom o masie {c}.' },
'ctx.beamManyJars': {
 en: 'The bench beam hangs level: {k} sealed jars against {c} counterweights.',
 es: 'La viga del banco cuelga nivelada: {k} tarros sellados contra {c} contrapesos.',
 pl: 'Belka warsztatowa wisi w poziomie: {k} «k|one:zaplombowany słój|few:zaplombowane słoje|many:zaplombowanych słojów» przeciw odważnikom o masie {c}.' },
});
export default out;
