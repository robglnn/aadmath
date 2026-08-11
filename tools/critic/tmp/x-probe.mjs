// exploratory: learn the DOM of the session beats
import { chromium } from 'playwright';
const URL = 'http://127.0.0.1:4611';
const b = await chromium.launch({ args: ['--use-gl=angle','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
const logs = [];
p.on('console', m => { if (m.type()==='error'||m.type()==='warning') logs.push(m.type()+': '+m.text()); });
p.on('pageerror', e => logs.push('pageerror: '+e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.evaluate(() => { localStorage.clear(); });
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
const t0 = Date.now();
const snap = async (label) => {
  const s = await p.evaluate(() => {
    const st = window.__ascent.state();
    return {
      phase: st.session.phase,
      run: st.session.run && { target: st.session.run.target, tears: st.session.run.tears, minutes: st.session.run.minutes, seams: st.session.run.seams, seeded: st.session.run.seeded, focus: Math.round(st.session.run.focus) },
      pace: st.session.pace,
      visible: [...document.querySelectorAll('.ses-charter, .ses-close, .ses-rest, .ses-band')].map(e => e.className + '|show=' + e.classList.contains('show') + '|vis=' + (e.getBoundingClientRect().width>0)),
      bodyText: document.body.innerText.slice(0, 1200),
    };
  });
  console.log('\n=== ' + label + ' t=' + ((Date.now()-t0)/1000).toFixed(1) + 's ===');
  console.log(JSON.stringify(s, null, 1));
};
await p.waitForTimeout(3000); await snap('t3');
await p.waitForTimeout(9000); await snap('t12');
await p.waitForTimeout(14000); await snap('t26');
await p.waitForTimeout(6000); await snap('t32');
// dump the charter DOM
console.log('\n--- charter html ---');
console.log(await p.evaluate(() => document.querySelector('.ses-charter')?.outerHTML?.slice(0,4000) || 'NONE'));
console.log('\n--- band html ---');
console.log(await p.evaluate(() => document.querySelector('.ses-band')?.outerHTML?.slice(0,2000) || 'NONE'));
console.log('\nLOGS:', logs.slice(0,10));
await b.close();
