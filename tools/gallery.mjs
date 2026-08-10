/**
 * Builds a self-contained screenshot gallery from a capture directory.
 * Frames are embedded as data URIs so the page works anywhere, offline.
 *
 *   node tools/gallery.mjs <jpeg-dir> <report.json> <out.html>
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const [dir, reportPath, out] = process.argv.slice(2);

const CAPTIONS = {
  '01-arrival': ['Planetfall', 'The frame that has to earn the next ten minutes. Title card, companion hail, and the COPPER standard already lit on the tower.'],
  '02-sprint': ['Sprint', 'FOV opens and the boom stretches with speed. The trilithon gate frames the rift beam.'],
  '03-glide': ['The wing', 'Second jump opens the glider. Pitch trades height for speed.'],
  '04-build': ['Axiom building', 'Grid-snapped lattice with a ghost preview. Ramps and floors are real collision — you can stand on what you build.'],
  '05-rift-en': ['A rift, English', 'The learning surface. Every glyph is strict KaTeX; a rift is held open by a statement that is not true yet.'],
  '06-echo-scaffold': ['The echo', 'A wrong answer summons a previous cadet’s solve, one line at a time, aimed at the misconception just displayed — never a lecture.'],
  '07-rift-es': ['A rift, Español', 'The same item in Spanish. Not a translated shell — locale-correct mathematical typography throughout.'],
  '07-rift-pl': ['A rift, Polski', 'Polish, with grammatical number and case handled rather than string-concatenated.'],
  '08-vista': ['The horizon', 'Five far regions with real aerial perspective — distance desaturates and lifts toward the sky.'],
  '09-mobile': ['Phone, portrait', 'Touch sticks, safe-area handling, and the same world at a reduced quality tier.'],
  '10-balance': ['The balance', 'Equations are not multiple choice. The beam applies every move to both sides, so the invariant is enforced by the world.'],
  '11-sort': ['Term bays', 'Like terms are physical things that must be sent somewhere. A number will not fit in the x-bay, so 3x + 2 = 5x never forms.'],
  '12-area': ['The area field', 'The distributive property as the rectangle it actually is.'],
  '13-seal': ['The seal', 'The statement rebuilt around the cadet’s value, shown to be true, and the tear closes.'],
  '14-mobile-rift': ['Learning on a phone', 'The full stabiliser rig at 414×896.'],
};

const files = (await readdir(dir)).filter((f) => f.endsWith('.jpg')).sort();
const report = JSON.parse(await readFile(reportPath, 'utf8'));

const shots = [];
for (const f of files) {
  const key = path.basename(f, '.jpg');
  const b64 = (await readFile(path.join(dir, f))).toString('base64');
  const [title, note] = CAPTIONS[key] || [key, ''];
  shots.push({ key, title, note, src: `data:image/jpeg;base64,${b64}` });
}

const perf = report.perf || {};
const tel = [
  ['fps median', perf.fpsMedian ?? perf.fps ?? '—'],
  ['1% low', perf.fps1Low ?? '—'],
  ['draw calls', perf.draws ?? '—'],
  ['triangles', (perf.tris ?? 0).toLocaleString('en-US')],
  ['console errors', (report.errors || []).length],
].filter(([, v]) => v !== '—' || true);

const html = `<title>ASCENT — frame gallery</title>
<style>
:root{
  color-scheme: dark light;
  --ground:#0b1020; --raised:#121a2e; --sunk:#080d1a;
  --line:rgba(158,180,220,.14); --line-strong:rgba(158,180,220,.26);
  --ink:#e6ecfa; --ink-2:#a3b2cd; --ink-3:#6a7a97;
  --ember:#ff9a4d; --signal:#5fe6ff;
}
:root[data-theme="light"]{
  --ground:#f6f2ea; --raised:#fffdf9; --sunk:#efe9de;
  --line:rgba(40,52,80,.13); --line-strong:rgba(40,52,80,.26);
  --ink:#1a2135; --ink-2:#4a5670; --ink-3:#7c8699;
  --ember:#c2521a; --signal:#0f7f9c;
}
@media (prefers-color-scheme: light){
  :root:not([data-theme="dark"]){
    --ground:#f6f2ea; --raised:#fffdf9; --sunk:#efe9de;
    --line:rgba(40,52,80,.13); --line-strong:rgba(40,52,80,.26);
    --ink:#1a2135; --ink-2:#4a5670; --ink-3:#7c8699;
    --ember:#c2521a; --signal:#0f7f9c;
  }
}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);
  font:16px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  -webkit-font-smoothing:antialiased;padding:clamp(1.5rem,4vw,3.5rem) clamp(1rem,4vw,2rem) 5rem}
.sheet{max-width:74rem;margin:0 auto;display:flex;flex-direction:column;gap:clamp(2rem,4vw,3rem)}
.eyebrow{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.68rem;
  letter-spacing:.32em;text-transform:uppercase;color:var(--ink-3);margin:0}
h1{margin:.6rem 0 0;font-size:clamp(2rem,7vw,3.4rem);line-height:.98;font-weight:800;
  letter-spacing:.16em;text-transform:uppercase;text-wrap:balance}
h1 .thin{display:block;font-size:.3em;letter-spacing:.5em;font-weight:500;color:var(--ink-3);margin-top:.9em}
.lede{margin:1rem 0 0;max-width:60ch;color:var(--ink-2)}
.telemetry{display:grid;grid-template-columns:repeat(auto-fit,minmax(8rem,1fr));
  border:1px solid var(--line);border-radius:4px;overflow:hidden;background:var(--sunk)}
.tel{padding:.85rem 1rem;border-right:1px solid var(--line);display:flex;flex-direction:column;gap:.3rem}
.tel:last-child{border-right:0}
.tel-k{font-family:ui-monospace,Menlo,monospace;font-size:.6rem;letter-spacing:.2em;
  text-transform:uppercase;color:var(--ink-3)}
.tel-v{font-family:ui-monospace,Menlo,monospace;font-size:1.25rem;
  font-variant-numeric:tabular-nums;color:var(--ink)}
.frames{display:flex;flex-direction:column;gap:clamp(2rem,5vw,3.5rem)}
figure{margin:0;display:flex;flex-direction:column;gap:.85rem}
.shot{border:1px solid var(--line);border-radius:5px;overflow:hidden;background:var(--sunk);line-height:0}
.shot img{width:100%;height:auto;display:block}
figcaption{display:grid;grid-template-columns:auto 1fr;gap:.9rem;align-items:baseline}
.num{font-family:ui-monospace,Menlo,monospace;font-size:.66rem;letter-spacing:.16em;
  color:var(--ember);padding-top:.3rem;font-variant-numeric:tabular-nums}
figcaption h2{margin:0;font-size:1.05rem;font-weight:650;letter-spacing:.01em}
figcaption p{margin:.2rem 0 0;color:var(--ink-3);font-size:.9rem;max-width:68ch}
footer{color:var(--ink-3);font-size:.8rem;border-top:1px solid var(--line);padding-top:1.2rem}
@media (max-width:560px){figcaption{grid-template-columns:1fr;gap:.2rem}.num{padding-top:0}}
</style>

<div class="sheet">
  <header>
    <p class="eyebrow">frame gallery · captured from the running game</p>
    <h1>Ascent<span class="thin">The Cipher Worlds</span></h1>
    <p class="lede">Every frame below is a real screenshot of the built game driven by Playwright —
    not a mockup, not a render. Same capture the blind critics judge.</p>
  </header>

  <div class="telemetry">
    ${tel.map(([k, v]) => `<div class="tel"><span class="tel-k">${k}</span><span class="tel-v">${v}</span></div>`).join('')}
  </div>

  <div class="frames">
    ${shots.map((s, i) => `
    <figure>
      <div class="shot"><img src="${s.src}" alt="${s.title}" loading="lazy"></div>
      <figcaption>
        <span class="num">${String(i + 1).padStart(2, '0')}</span>
        <div><h2>${s.title}</h2><p>${s.note}</p></div>
      </figcaption>
    </figure>`).join('')}
  </div>

  <footer>Captured off a frozen production build on an Apple M4. The game is a Three.js
  browser build at <code>/Users/harrison/dev/aadmath</code>; raw PNGs live in
  <code>shots/</code>.</footer>
</div>
`;

await writeFile(out, html);
console.log(`wrote ${out} — ${shots.length} frames, ${(html.length / 1e6).toFixed(1)}MB`);
