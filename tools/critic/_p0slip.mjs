/**
 * THE ECHO'S DEEPEST LAYER, MEASURED.
 *
 * That layer is captioned "A different rift, the same shape", and a cold critic
 * read it over a worked example that was not the same shape: *"the learner's
 * error was a negative sign and every number in the worked example is
 * positive."* Nothing in that example could go wrong the way their answer went
 * wrong, so the one thing the layer promises was the one thing it did not give.
 *
 * `analogueFor` now takes the misconception (see src/learn/scaffold.js) and
 * prefers a candidate the mistake is actually available on. This measures both
 * halves of the claim, over the sign family — the tags the critic's card was
 * about — and reports the rate with and without the slip passed in:
 *
 *   · can the example produce the slip at all (`explains`), and
 *   · for a sign slip, is a negative number actually visible on it.
 *
 * The last line is the one that stops this being a trade: an example that
 * carries the slip is worth nothing if the rule leaves items with no example,
 * because an item with no example falls back on the learner's own trace — the
 * single trace that cannot avoid containing the live answer.
 *
 *   node tools/critic/_p0slip.mjs
 */
import { generate, FORMS_BY_SKILL } from '/Users/harrison/dev/aadmath/src/learn/generators.js';
import { analogueFor } from '/Users/harrison/dev/aadmath/src/learn/scaffold.js';
import { explains } from '/Users/harrison/dev/aadmath/src/learn/diagnose.js';
const SIGN = new Set(['sign-slip','sign-on-constant','same-op-both','sign-on-distribute','negative-coefficient','drop-negative','sign-both-sides']);
const neg = (c)=>[c.latex||'',c.answer,...(c.steps||[]).map(x=>x.latex)].some(x=>/(^|[\s(={+\-*/,])-\s*\d/.test(String(x)));
let base={n:0,carry:0,negOk:0}, withMis={n:0,carry:0,negOk:0}, none=0;
for (const skill of Object.keys(FORMS_BY_SKILL)) {
  for (const f of FORMS_BY_SKILL[skill]) {
    for (let s=0;s<6;s++){
      let it; try{ it=generate(skill,Math.max(f.dMin,3),(s*7919+skill.length*13)>>>0,{form:f.id,locale:'en'});}catch{continue;}
      const tags=[...new Set((it.diagnostics||[]).map(d=>d.misconception))].filter(m=>SIGN.has(m));
      if(!tags.length) continue;
      const mis=tags[0];
      const a0=analogueFor(it,{difficulty:it.difficulty,seed:it.seed});
      const a1=analogueFor(it,{difficulty:it.difficulty,seed:it.seed,misconception:mis});
      if(a0){base.n++; if(explains(a0,mis))base.carry++; if(neg(a0))base.negOk++;}
      if(a1){withMis.n++; if(explains(a1,mis))withMis.carry++; if(neg(a1))withMis.negOk++;} else none++;
    }
  }
}
const pc=(a,b)=>b?((100*a/b).toFixed(1)+'%'):'n/a';
console.log('sign-family slips sampled:', base.n);
console.log('  BEFORE (no slip passed):  example can produce the slip', pc(base.carry,base.n), ' has a negative in it', pc(base.negOk,base.n));
console.log('  AFTER  (slip passed):     example can produce the slip', pc(withMis.carry,withMis.n), ' has a negative in it', pc(withMis.negOk,withMis.n));
console.log('  items left with NO example at all:', none);
