// One row per framing: the plural noun, the place the extra shifts are stood,
// and the article that agrees with it. Written out rather than derived — a
// rule that guesses Spanish gender produces "cada una de los brigadas".
const CREW = {
  crew:     { en: ['crews', 'logs', 'on watch'],
              es: ['Cada una de las', 'cuadrillas', 'hace', 'de guardia'],
              pl: ['Każda z', 'ekip', 'robi', 'wachty'] },
  watches:  { en: ['watches', 'logs', 'on the rail'],
              es: ['Cada una de las', 'guardias', 'hace', 'en la borda'],
              pl: ['Każda z', 'wacht', 'robi', 'przy relingu'] },
  teams:    { en: ['teams', 'logs', 'in the yard'],
              es: ['Cada uno de los', 'equipos', 'hace', 'en el astillero'],
              pl: ['Każdy z', 'zespołów', 'robi', 'w stoczni'] },
  gangs:    { en: ['gangs', 'logs', 'on the hoist'],
              es: ['Cada una de las', 'brigadas', 'hace', 'en el cabrestante'],
              pl: ['Każda z', 'brygad', 'robi', 'przy wyciągu'] },
  wings:    { en: ['wings', 'flies', 'on standby'],
              es: ['Cada una de las', 'alas', 'vuela', 'de reserva'],
              pl: ['Każde z', 'skrzydeł', 'lata', 'gotowości'] },
  sections: { en: ['sections', 'works', 'in the galley'],
              es: ['Cada una de las', 'secciones', 'hace', 'en la cocina'],
              pl: ['Każda z', 'sekcji', 'robi', 'w kambuzie'] },
};
const EN_SHIFT = '«a|one:# shift|other:# shifts»';
const EN_MORE = '«b|one:# shift|other:# shifts»';
const ES_SHIFT = '«a|one:# turno|other:# turnos»';
const ES_MORE = '«b|one:# turno|other:# turnos»';
const PL_SHIFT = '«a|one:# zmianę|few:# zmiany|many:# zmian»';
const PL_MORE = '«b|one:# zmianę|few:# zmiany|many:# zmian»';

const out = {};
for (const [k, L] of Object.entries(CREW)) {
  const [enPl, enVerb, enWhere] = L.en;
  const [esEach, esPl, esVerb, esWhere] = L.es;
  const [plEach, plGen, plVerb, plWhere] = L.pl;
  out['ctx.' + k] = {
    en: `Each of {k} ${enPl} ${enVerb} ${EN_SHIFT} a rotation, plus ${EN_MORE} ${enWhere}.`,
    es: `${esEach} {k} ${esPl} ${esVerb} ${ES_SHIFT} por rotación, más ${ES_MORE} ${esWhere}.`,
    pl: `${plEach} {k} ${plGen} ${plVerb} ${PL_SHIFT} na obrót, plus ${PL_MORE} ${plWhere}.`,
  };
}
export default out;
