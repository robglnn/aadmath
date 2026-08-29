/**
 * One-shot: translate the Level 2 graph's alignment caveats.
 *
 * Found by the new CONTENT rule in tools/check-i18n.mjs, not by a person — the
 * same class of gap as the seventeen in the Level 1 TEKS map, in a second file.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = '/Users/harrison/dev/aadmath/content/graph/algebra1-l2.json';

const TR = {
  'CCSS.MATH.CONTENT.HSA.SSE.A.1.B': {
    es: 'El estudiante tiene que leer a(x + b) como una sola cantidad antes de abrirlo. La expectativa completa cubre también estructuras no lineales, a las que esta unidad no llega.',
    pl: 'Uczeń musi odczytać a(x + b) jako jedną wielkość, zanim ją otworzy. Pełne oczekiwanie obejmuje także strukturę nieliniową, do której ta jednostka nie dochodzi.',
  },
  'CCSS.MATH.CONTENT.7.EE.B.4.A': {
    es: 'Cubierto en el planteamiento (x + q)/p, que es la misma ecuación escrita con la división a la vista en lugar de un paréntesis.',
    pl: 'Objęte przez ujęcie (x + q)/p, czyli to samo równanie zapisane z widocznym dzieleniem zamiast nawiasu.',
  },
  'A.5(A)': {
    es: 'El caso de coeficiente racional está dentro de A.5(A), pero no es ninguno de los dos casos que la expectativa nombra. Por eso la afirmación es de apoyo.',
    pl: 'Przypadek współczynnika wymiernego mieści się w A.5(A), ale nie jest żadnym z dwóch przypadków wymienionych w tym oczekiwaniu. Dlatego twierdzenie jest wspierające.',
  },
  'CCSS.MATH.CONTENT.HSF.LE.A.2': {
    es: 'Solo lineal. Nada en esta unidad construye una función exponencial.',
    pl: 'Tylko liniowe. Nic w tej jednostce nie buduje funkcji wykładniczej.',
  },
  'A.2(C)': {
    es: 'El estudiante lee la regla y la usa. Escribir la ecuación en la forma y = mx + b es Nivel 3.',
    pl: 'Uczeń odczytuje regułę i jej używa. Zapisanie równania w postaci y = mx + b to Poziom 3.',
  },
};

const doc = JSON.parse(readFileSync(FILE, 'utf8'));
let n = 0;
for (const node of doc.nodes || []) {
  for (const a of node.alignment || []) {
    if (!a.caveat) continue;
    const tr = TR[a.code];
    if (!tr) throw new Error(`no translation for ${a.code}`);
    a.i18n = a.i18n || {};
    for (const loc of ['es', 'pl']) {
      a.i18n[loc] = { ...(a.i18n[loc] || {}), caveat: tr[loc] };
      n++;
    }
  }
}
writeFileSync(FILE, JSON.stringify(doc, null, 2) + '\n');
console.log(`wrote ${n} translated caveat strings into ${FILE}`);
