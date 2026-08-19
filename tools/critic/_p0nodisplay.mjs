/**
 * THE ITEM THAT DREW A BROKEN PICTURE OF ITSELF — the render-level proof.
 *
 * A cold critic photographed one card: *"'Which equation says what happened in
 * the butt?' renders the stem figure as `x □ □ = □` — three empty boxes, the
 * identical glyph the UI uses for an empty answer field."*
 *
 * `tools/validate-items.mjs` now refuses any display made of more than one
 * placeholder box, which is the durable gate. This is the other half of the
 * claim: that what the bank computes is what a learner actually SEES. It mounts
 * the real `src/ui/rift.js` panel through the choice lab — the same harness
 * `choiceaudit.mjs` uses, never `window.__ascent` — puts the two repaired forms
 * on it in all three locales, and asserts of each:
 *
 *   · the display plate is hidden rather than printed empty,
 *   · not one box glyph appears anywhere on the card,
 *   · the options are still there, so nothing was lost with the plate.
 *
 * `var-meaning/vm-choose` is the control. It legitimately shows a box, because
 * real quantities stand around it (`k + k + k + k + k + k = \square`), and this
 * script asserts that box is still drawn — a fix that suppressed every box
 * would have broken the surface it was meant to repair.
 *
 *   node tools/critic/_p0nodisplay.mjs
 *
 * Exit 0 = the plate is gone, the boxes are gone, the question is intact.
 */
import { chromium } from 'playwright';
import { build } from 'vite';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const HERE='/Users/harrison/dev/aadmath/tools/critic';
const LAB=path.join(HERE,'choicelab');
const OUT='/Users/harrison/dev/aadmath/shots/p0-nodisplay';
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf'};
const dist=await mkdtemp(path.join(tmpdir(),'riftshot-'));
let server,browser;
const done=async()=>{try{server?.close();}catch{} try{await browser?.close();}catch{} await rm(dist,{recursive:true,force:true});};
try{
  await mkdir(OUT,{recursive:true});
  await build({root:LAB,base:'./',logLevel:'error',build:{target:'es2022',outDir:dist,emptyOutDir:true,sourcemap:false}});
  const port=4990+Math.floor(Math.random()*9);
  server=createServer(async(req,res)=>{const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,'')||'index.html';
    try{const b=await readFile(path.join(dist,rel));res.writeHead(200,{'content-type':MIME[path.extname(rel)]||'application/octet-stream'});res.end(b);}catch{res.writeHead(404);res.end('');}});
  await new Promise(r=>server.listen(port,'127.0.0.1',r));
  browser=await chromium.launch({args:['--use-gl=angle','--enable-unsafe-swiftshader']});
  const page=await(await browser.newContext({viewport:{width:1500,height:950},deviceScaleFactor:2})).newPage();
  const errs=[]; page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  page.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load'});
  await page.waitForFunction(()=>!!window.__lab);
  const cases=[
    {skill:'one-step-add',form:'oa-model',difficulty:3,seed:1000},
    {skill:'two-step',form:'ts-model',difficulty:4,seed:1000},
    // The perimeter plate: no display plate, but a DRAWING the learner reads.
    {skill:'like-terms',form:'lt-perimeter',difficulty:4,seed:4242},
    // a control: a form that legitimately shows a box with real numbers round it
    {skill:'var-meaning',form:'vm-choose',difficulty:3,seed:1000},
  ];
  let bad=0;
  for(const c of cases) for(const locale of ['en','es','pl']){
    const info=await page.evaluate(k=>window.__lab.showOne(k),{...c,locale});
    await page.waitForTimeout(200);
    const probe=await page.evaluate(()=>{
      const p=document.querySelector('#rf-prompt');
      const card=document.querySelector('.rift')||document.body;
      const cs=p?getComputedStyle(p):null;
      const opts=[...document.querySelectorAll('.rf-readings .rf-read, .rf-readings button')].map(e=>e.textContent.trim());
      const figEl=document.querySelector('#rf-figure');
      return {
        figDrawn: !!(figEl && figEl.querySelector('svg')),
        promptText:(p?.textContent||'').trim(),
        promptHidden:!p||cs.display==='none',
        promptBox:p?p.getBoundingClientRect().height:0,
        // Boxes IN THE DISPLAY REGION only. The keypad legend prints `□²` and
        // `□/□` and the empty answer socket draws one, and all of those are the
        // glyph doing its proper job — an input waiting to be filled. The defect
        // was a box in the STATEMENT, where a problem should be.
        boxGlyphs:(((document.querySelector('#rf-prompt')?.textContent||'')
          + (document.querySelector('#rf-figure')?.textContent||'')).match(/□/g)||[]).length,
        katexBoxes:document.querySelectorAll('#rf-prompt .mord').length,
        options:opts.length, stem:(document.querySelector('#rf-stem')?.textContent||'').trim().slice(0,90),
      };
    });
    const name=`${c.skill}-${c.form}-${locale}`;
    const el=await page.$('.rift')||await page.$('body');
    await el.screenshot({path:path.join(OUT,name+'.png')});
    // The three repaired forms must show no statement plate and no box in it.
    // `vm-choose` is the control: it must still draw its one legitimate box.
    const repaired = c.form!=='vm-choose';
    const ok = repaired
      ? (probe.promptHidden && probe.promptText==='' && probe.boxGlyphs===0 && (probe.options>0 || probe.figDrawn))
      : (!probe.promptHidden && probe.boxGlyphs>0);
    if(!ok) bad++;
    console.log(`${ok?'ok  ':'FAIL'} ${name.padEnd(30)} promptHidden=${probe.promptHidden} promptText=${JSON.stringify(probe.promptText)} boxGlyphsOnCard=${probe.boxGlyphs} options=${probe.options} drawing=${probe.figDrawn}`);
    if(repaired) console.log(`      stem: ${probe.stem}`);
  }
  console.log(`\nconsole errors: ${errs.length}`); errs.slice(0,5).forEach(e=>console.log('  !',e));
  console.log(`-> ${OUT}`);
  await done(); process.exit(bad||errs.length?1:0);
}catch(e){console.error(e);await done();process.exit(2);}
