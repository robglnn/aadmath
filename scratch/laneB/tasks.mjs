/** Which task keys and which notation keys the real bank actually needs. */
import { safeGenerate, SKILLS, FORMS_BY_SKILL } from '../../src/learn/generators.js';
import { registerPack } from '../../src/content/registry.js';
import l2 from '../../src/content/packs/algebra1-l2.js';
import l3 from '../../src/content/packs/algebra1-l3.js';
import l4 from '../../src/content/packs/algebra1-l4.js';
import l5 from '../../src/content/packs/algebra1-l5.js';
registerPack(l2); registerPack(l3); registerPack(l4); registerPack(l5);
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../../src/ui/rift.js', import.meta.url), 'utf8');
const slice = src.slice(src.indexOf('const PAD_ROOT'), src.indexOf('// ---------------------------------------------------------------------------\n// The sealing statement'));
fs.writeFileSync('/tmp/slice2.mjs', slice
  .replace(/^import .*$/gm, '')
  + "\nexport {toTex,toPad,padGlyphs,demandsOf,hasOpenProduct,astOf,isFactored,isExpanded,isVertex,inForm,sameAnswer};\n");
