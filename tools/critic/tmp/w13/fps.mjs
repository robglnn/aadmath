import { chromium } from 'playwright';
const configs = [
  ['default', []],
  ['angle-default', ['--use-gl=angle', '--use-angle=default']],
  ['metal', ['--use-angle=metal']],
  ['egl', ['--use-gl=egl']],
  ['swift', ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader']],
];
for (const [name, args] of configs) {
  try {
    const b = await chromium.launch({ headless: true, args });
    const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
    await p.goto('http://127.0.0.1:4788/', { waitUntil: 'load' });
    await p.waitForTimeout(16000);
    const fps = await p.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else r(Math.round(n / ((performance.now() - t0) / 1000))); }; requestAnimationFrame(f); }));
    const rend = await p.evaluate(() => { const c = document.createElement('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl'); if (!gl) return 'nogl'; const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); });
    console.log(name, 'fps=', fps, 'renderer=', rend);
    await b.close();
  } catch (e) { console.log(name, 'FAIL', e.message.split('\n')[0]); }
}
