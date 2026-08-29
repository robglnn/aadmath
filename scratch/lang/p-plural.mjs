// Grammatical number, where a bare numeral meets a noun.
//
// `a` and `b` in the crew deck are drawn from 1, so "1 shifts a rotation" was
// reachable in English and "3 zmian" — genitive where Polish wants the
// nominative plural — was reachable every draw. Alternants, in all three.
const CREW = {
  crew:     ['crews', 'watch',        'cuadrillas', 'de guardia',      'ekip', 'wachty'],
  watches:  ['watches', 'the rail',   'guardias', 'en la borda',       'wacht', 'przy relingu'],
  teams:    ['teams', 'the yard',     'equipos', 'en el astillero',    'zespołów', 'w stoczni'],
  gangs:    ['gangs', 'the hoist',    'brigadas', 'en el cabrestante', 'brygad', 'przy wyciągu'],
  wings:    ['wings', 'standby',      'alas', 'de reserva',            'skrzydeł', 'gotowości'],
  sections: ['sections', 'the galley', 'secciones', 'en la cocina',    'sekcji', 'w kambuzie'],
};
const out = {};
for (const [k, [enPl, enWhere, esPl, esWhere, plGen, plWhere]] of Object.entries(CREW)) {
  const verbEn = k === 'wings' ? 'flies' : 'logs';
  const verbEs = k === 'wings' ? 'vuela' : 'hace';
  const verbPl = k === 'wings' ? 'lata' : 'robi';
  const artEs = ['teams', 'gangs'].includes(k) ? 'los' : 'las';
  const eachEs = ['teams'].includes(k) ? 'Cada uno de' : 'Cada una de';
  const eachPl = k === 'wings' ? 'Każde z' : (['teams'].includes(k) ? 'Każdy z' : 'Każda z');
  out['ctx.' + k] = {
    en: `Each of {k} ${enPl} ${verbEn} «a|one:# shift|other:# shifts» a rotation, plus «b|one:# shift|other:# shifts» on ${enWhere}.`,
    es: `${eachEs} ${artEs} {k} ${esPl} ${verbEs} «a|one:# turno|other:# turnos» por rotación, más «b|one:# turno|other:# turnos» ${esWhere}.`,
    pl: `${eachPl} {k} ${plGen} ${verbPl} «a|one:# zmianę|few:# zmiany|many:# zmian» na obrót, plus «b|one:# zmianę|few:# zmiany|many:# zmian» ${plWhere}.`,
  };
}
// …and two Polish situations where a loss per minute took the genitive.
out['ctx.coolant'] = {
  en: 'A coolant loop comes on shift at {b} degrees and sheds {a} degrees a minute.',
  es: 'Un circuito de refrigerante entra a {b} grados y suelta {a} grados por minuto.',
  pl: 'Obieg chłodziwa wchodzi na zmianę z {b} stopniami i traci «a|one:# stopień|few:# stopnie|many:# stopni» na minutę.',
};
out['ctx.iceShelf'] = {
  en: 'The shelf edge stands {b} metres high and calves {a} metres off each minute.',
  es: 'El borde del manto está a {b} metros y desprende {a} metros cada minuto.',
  pl: 'Krawędź lodowca stoi na {b} metrach i traci «a|one:# metr|few:# metry|many:# metrów» na minutę.',
};
export default out;
