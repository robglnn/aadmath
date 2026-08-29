const KEYS = ['dockLog','hangarLog','tugLog','berthLog','craneLog','kilnFeeLog','lockupLog','pilotLog','slipLog','stallLog','rigLog','escortLog'];
const G = {
  en: ['is blank', 'is empty', 'shows nothing', 'is gone'],
  es: ['está en blanco', 'está vacío', 'no muestra nada', 'ha desaparecido'],
  pl: ['jest pusty', 'jest niezapisany', 'nic nie pokazuje', 'zniknął'],
};
const out = {};
KEYS.forEach((k, j) => {
  out['ctx.' + k] = {
    en: `One cycle on the running strip ${G.en[j % 4]}.`,
    es: `Un ciclo de la tira corrida ${G.es[j % 4]}.`,
    pl: `Jeden cykl na bieżącym pasku ${G.pl[j % 4]}.`,
  };
});
export default out;
