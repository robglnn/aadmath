import katex from 'katex';
import { generate, demandOf, verify } from '/Users/harrison/dev/aadmath/src/learn/generators.js';
import { registerPack, formsFor } from '/Users/harrison/dev/aadmath/src/content/registry.js';
import pack from '/Users/harrison/dev/aadmath/src/content/packs/algebra1-l3.js';
registerPack(pack);
const LOC = ['en','es','pl'];
const skills = process.argv[2] ? process.argv[2].split(',') : Object.keys(pack.skills);
let bad = 0;
for (const sk of skills) {
  const forms = formsFor(sk) || [];
  // every form by name, every band, every locale
  for (const f of forms) for (let d=f.dMin; d<=f.dMax; d++) for (const loc of LOC) {
    try {
      const it = generate(sk, d, d*977+13, {locale:loc, form:f.id, strict:true, record:false});
      if (/(^|\s)[a-z0-9]+(\.[a-zA-Z0-9]+){2,}(\s|$)/.test(it.stem)) { console.log(`KEY LEAK ${sk}/${f.id} ${loc}: ${it.stem}`); bad++; }
      for (const st of it.steps) if (/\{[a-z]+\}/i.test(st.why)) { console.log(`PLACEHOLDER ${sk}/${f.id} ${loc}: ${st.why}`); bad++; }
      if (/\{[a-z]+\}/i.test(it.stem)) { console.log(`PLACEHOLDER-STEM ${sk}/${f.id} ${loc}: ${it.stem}`); bad++; }
    } catch(e) { console.log(`FAIL ${sk}/${f.id} d${d} ${loc}: ${e.message}`); bad++; }
  }
  const means=[];
  for (let d=1; d<=5; d++) {
    let s=0,c=0;
    for (let i=0;i<240;i++){
      try {
        const it = generate(sk, d, i*7919+d*131, {locale:'en', strict:true, record:false});
        s+=demandOf(it); c++;
        if (i<8) {
          verify(it);
          for (const src of [it.latex, it.answer, ...it.steps.map(x=>x.latex), ...it.distractors.map(x=>x.v)])
            katex.renderToString(String(src),{throwOnError:true,strict:'error'});
        }
      } catch(e){ console.log(`GEN ${sk} d${d} s${i}: ${e.message}`); bad++; }
    }
    means.push(c? s/c : 0);
  }
  const rise = means.every((m,i)=> i===0 || m>means[i-1]);
  console.log(`${rise?'  ':'!!'}${sk.padEnd(24)}${means.map(m=>m.toFixed(2).padStart(7)).join('')}`);
}
console.log(bad? `\n${bad} problem(s)` : '\nclean');
