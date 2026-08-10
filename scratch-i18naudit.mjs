import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';

const URL = 'http://127.0.0.1:4931';
const OUT = '/tmp/i18nshots';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle','--ignore-gpu-blocklist','--enable-gpu-rasterization','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'],
});

const VIEWPORTS = [
  { name: '1280x720', width: 1280, height: 720 },
  { name: '1600x900', width: 1600, height: 900 },
  { name: '414x896', width: 414, height: 896, mobile: true },
];

const report = [];

for (const vp of VIEWPORTS) {
  for (const loc of ['en', 'es', 'pl']) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      hasTouch: !!vp.mobile,
      isMobile: !!vp.mobile,
      locale: loc === 'en' ? 'en-US' : loc === 'es' ? 'es-ES' : 'pl-PL',
    });
    await ctx.addInitScript((l) => { try { localStorage.setItem('ascent.locale', l); } catch {} }, loc);
    const page = await ctx.newPage();
    const logs = [];
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type()+': '+m.text()); });
    page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
    await page.waitForTimeout(2500);

    // open a rift
    let riftInfo = null;
    try {
      riftInfo = await page.evaluate(async () => {
        const s = window.__ascent.state();
        const ids = (s.rifts || s.nodes || []).map?.((r) => r.id) || [];
        return { keys: Object.keys(s), ids: ids.slice(0, 8) };
      });
    } catch (e) { riftInfo = { err: String(e) }; }

    const audit = await page.evaluate(() => {
      const out = { rawKeys: [], overflow: [], katexErr: 0, texts: [] };
      const KEYRE = /(^|\s)[a-z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*){1,4}(\s|$)/;
      const walk = (root) => {
        const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = it.nextNode())) {
          const txt = (n.nodeValue || '').trim();
          if (!txt) continue;
          const el = n.parentElement;
          if (!el) continue;
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          out.texts.push(txt);
          if (KEYRE.test(txt) && !/\d\.\d/.test(txt) && !txt.includes(' ')) out.rawKeys.push({ txt, sel: el.className });
        }
      };
      walk(document.body);
      // katex errors
      out.katexErr = document.querySelectorAll('.katex-error, .katex-html .mord.text.katex-error').length;
      const errNodes = [...document.querySelectorAll('*')].filter((e) => e.style && e.style.color === 'rgb(204, 0, 0)');
      out.katexErrStyled = errNodes.length;
      out.katexCount = document.querySelectorAll('.katex').length;
      // overflow scan
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        if (el.tagName === 'CANVAS') continue;
        const oX = el.scrollWidth - el.clientWidth;
        const oY = el.scrollHeight - el.clientHeight;
        if (cs.overflow !== 'visible' && (cs.overflowX === 'auto' || cs.overflowX === 'scroll')) continue;
        if (oX > 2 && el.clientWidth > 0) {
          out.overflow.push({ tag: el.tagName, cls: String(el.className).slice(0, 60), oX, cw: el.clientWidth, txt: (el.textContent || '').trim().slice(0, 50) });
        }
      }
      // page horizontal scroll
      out.bodyScroll = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      return out;
    });

    await page.screenshot({ path: `${OUT}/${vp.name}-${loc}-world.png` });

    // Open a rift
    let riftOpened = false;
    try {
      await page.evaluate(() => { const a = window.__ascent; const s = a.state(); const id = (s.riftIds && s.riftIds[0]) || null; if (a.openRiftById) { a.openRiftById(id || undefined); } });
      await page.waitForTimeout(1800);
      riftOpened = await page.evaluate(() => !!document.querySelector('.rift, .rift-panel, [class*="rift"]'));
    } catch (e) {}
    const riftAudit = await page.evaluate(() => {
      const out = { rawKeys: [], overflow: [], katexErr: 0, sample: [] };
      const KEYRE = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*){1,4}$/;
      const it = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = it.nextNode())) {
        const txt = (n.nodeValue || '').trim();
        if (!txt) continue;
        const el = n.parentElement; if (!el) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
        const r = el.getBoundingClientRect(); if (r.width === 0) continue;
        out.sample.push(txt);
        if (KEYRE.test(txt)) out.rawKeys.push(txt);
      }
      out.katexErr = document.querySelectorAll('.katex-error').length;
      out.katexCount = document.querySelectorAll('.katex').length;
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || el.tagName === 'CANVAS') continue;
        if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') continue;
        const oX = el.scrollWidth - el.clientWidth;
        if (oX > 2 && el.clientWidth > 0) out.overflow.push({ cls: String(el.className).slice(0,50), oX, txt: (el.textContent||'').trim().slice(0,60) });
      }
      out.bodyScroll = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      return out;
    });
    await page.screenshot({ path: `${OUT}/${vp.name}-${loc}-rift.png` });

    report.push({ vp: vp.name, loc, logs, audit: { rawKeys: audit.rawKeys, overflow: audit.overflow, katexErr: audit.katexErr, katexErrStyled: audit.katexErrStyled, katexCount: audit.katexCount, bodyScroll: audit.bodyScroll, textCount: audit.texts.length }, riftOpened, riftAudit: { rawKeys: riftAudit.rawKeys, overflow: riftAudit.overflow, katexErr: riftAudit.katexErr, katexCount: riftAudit.katexCount, bodyScroll: riftAudit.bodyScroll }, worldTexts: audit.texts, riftTexts: riftAudit.sample });
    await ctx.close();
  }
}
await browser.close();
await writeFile('/tmp/i18naudit.json', JSON.stringify(report, null, 1));
for (const r of report) {
  console.log('---', r.vp, r.loc, 'logs:', r.logs.length, 'rawKeys:', r.audit.rawKeys.length + r.riftAudit.rawKeys.length, 'overflow:', r.audit.overflow.length + r.riftAudit.overflow.length, 'katexErr:', r.audit.katexErr + r.riftAudit.katexErr, 'katexN:', r.audit.katexCount, '/', r.riftAudit.katexCount, 'bodyScroll:', r.audit.bodyScroll, r.riftAudit.bodyScroll);
  if (r.logs.length) console.log('   LOGS', r.logs.slice(0,5));
  if (r.audit.rawKeys.length) console.log('   RAW', r.audit.rawKeys.slice(0,6));
  if (r.riftAudit.rawKeys.length) console.log('   RAWRIFT', r.riftAudit.rawKeys.slice(0,6));
  if (r.audit.overflow.length) console.log('   OF', r.audit.overflow.slice(0,4));
  if (r.riftAudit.overflow.length) console.log('   OFRIFT', r.riftAudit.overflow.slice(0,4));
}
