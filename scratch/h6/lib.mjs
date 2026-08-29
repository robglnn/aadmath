import { chromium } from 'playwright';
import fs from 'node:fs';

export async function connect() {
  const ws = fs.readFileSync('/tmp/h6-ws.txt', 'utf8').trim();
  const b = await chromium.connect(ws);
  const ctxs = b.contexts();
  let ctx = ctxs[0];
  if (!ctx) ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  let page = ctx.pages()[0];
  if (!page) page = await ctx.newPage();
  return { b, ctx, page };
}

export function wireLog(page) {
  const errs = [];
  page.on('console', m => {
    if (m.type() === 'error') { errs.push('CONSOLE ' + m.text()); }
  });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  return errs;
}

export async function shot(page, name) {
  const dir = '/Users/harrison/dev/aadmath/shots/h6-play';
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png` });
  return `${dir}/${name}.png`;
}

// Everything a player can see: visible text of the DOM overlay.
export async function seen(page) {
  return await page.evaluate(() => {
    const out = [];
    const walk = (el, depth) => {
      if (depth > 40) return;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      let own = '';
      for (const n of el.childNodes) if (n.nodeType === 3) own += n.nodeValue;
      own = own.replace(/\s+/g, ' ').trim();
      if (own) out.push({ t: own, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), cls: el.className && String(el.className).slice(0, 60), tag: el.tagName });
      for (const c of el.children) walk(c, depth + 1);
    };
    walk(document.body, 0);
    return out;
  });
}

export async function textDump(page) {
  const s = await seen(page);
  return s.map(o => `[${o.y},${o.x}] <${o.tag}.${o.cls}> ${o.t}`).join('\n');
}
