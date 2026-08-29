const KEYS = ['dockLog','hangarLog','tugLog','berthLog','craneLog','kilnFeeLog','lockupLog','pilotLog','slipLog','stallLog','rigLog','escortLog'];
const G = {
  en: ['is blank', 'is empty', 'shows nothing', 'is gone'],
  es: ['está en blanco', 'está vacío', 'no muestra nada', 'ha desaparecido'],
  pl: ['jest pusty', 'jest niezapisany', 'nic nie pokazuje', 'zniknął'],
};
const out = {};
KEYS.forEach((k, j) => {
  out['ctx.' + k] = {
    en: `One cycle on the strip ${G.en[j % 4]}.`,
    es: `Un ciclo de la tira ${G.es[j % 4]}.`,
    pl: `Jeden cykl na pasku ${G.pl[j % 4]}.`,
  };
});
out['ctx.rigFee'] = {
  en: 'The rig takes {b} credits to sign, then {a} a cycle.',
  es: 'El equipo cobra {b} créditos por firmarlo y {a} por ciclo.',
  pl: 'Osprzęt bierze {b} kr. za podpis i {a} kr. za każdy cykl.',
};
out['ask.startingBrine'] = {
  en: 'How full was the tank before?',
  es: '¿Cuánto tenía el depósito antes?',
  pl: 'Ile było w zbiorniku wcześniej?',
};
export default out;
