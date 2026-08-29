/** Are any waygate labels drawn in the landing frame? Three viewports. */
import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4803');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
for (const [w, h] of [[844, 390], [1024, 768], [1600, 900]]) {
  const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(3500);
  const r = await page.evaluate(() => {
    const a = window.__ascent;
    const tags = [...document.querySelectorAll('.field-tags .field-tag')];
    const shown = tags.filter((e) => getComputedStyle(e).display !== 'none');
    const stamp = document.querySelector('.meta-stamp');
    const sr = stamp ? stamp.getBoundingClientRect() : null;
    let lap = 0;
    for (const e of shown) {
      const b = e.getBoundingClientRect();
      if (sr && b.right > sr.left && b.left < sr.right && b.bottom > sr.top && b.top < sr.bottom) lap++;
    }
    return { total: tags.length, shown: shown.length, lap, camR: +Math.hypot(a.camera.position.x, a.camera.position.z).toFixed(1),
      gates: a.waygates?.list?.length ?? 0 };
  });
  console.log(`${w}x${h}: ${r.gates} gates, ${r.total} tag nodes, ${r.shown} drawn, ${r.lap} over the location stamp (camera ${r.camR} m from the landing)`);
  await page.close();
}
await browser.close();
