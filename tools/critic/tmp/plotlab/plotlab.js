/** Mount the REAL rift panel on a REAL Level 2 plot item, at any locale. */
import 'katex/dist/katex.min.css';
import { RiftPanel } from '../../../../src/ui/rift.js';
import { safeGenerate } from '../../../../src/learn/generators.js';
import { registerPack } from '../../../../src/content/registry.js';
import algebra1L2 from '../../../../src/content/packs/algebra1-l2.js';
registerPack(algebra1L2);
import { setLocale } from '../../../../src/i18n/index.js';

const panel = new RiftPanel(document.getElementById('app'));

window.__plot = {
  open(skill, form, d, seed, locale) {
    setLocale(locale || 'en');
    let item = null;
    for (let i = 0; i < 400 && !item; i++) {
      const c = safeGenerate(skill, d, (seed + i * 7919) >>> 0, { form, locale: locale || 'en' });
      if (c && c.figure && c.figure.kind === 'plot') item = c;
    }
    if (!item) return null;
    panel.show(item, {
      title: '', skillId: item.skill, tier: 0, kind: 'learn', scaffold: 'none',
      example: null, streak: 0, onAnswer() { return { gained: 1, pL: 1, prev: 0.5 }; }, onClose() {},
    });
    return { skill: item.skill, form: item.form, stem: item.stem, answer: item.answer };
  },
  /** Every interactive target on the surface, as the finger meets it. */
  targets() {
    const out = [];
    for (const n of document.querySelectorAll('.rf-plot .knob, .rf-plot .knob-hit, .rf-plot-bar button, .rf-plot-stage')) {
      const r = n.getBoundingClientRect();
      out.push({ what: n.getAttribute('class'), w: +r.width.toFixed(1), h: +r.height.toFixed(1),
                 x: +r.x.toFixed(1), y: +r.y.toFixed(1) });
    }
    return out;
  },
  /** Does a tap land on the grid, or is it swallowed by a child of the svg? */
  tapProbe() {
    const stage = document.querySelector('.rf-plot-stage');
    const svg = stage && stage.querySelector('svg');
    if (!svg) return null;
    const b = svg.getBoundingClientRect();
    let hitSvg = 0, hitOther = 0; const others = {};
    for (let i = 1; i <= 9; i++) for (let j = 1; j <= 9; j++) {
      const el = document.elementFromPoint(b.left + (b.width * i) / 10, b.top + (b.height * j) / 10);
      if (el === svg) hitSvg++;
      else { hitOther++; const k = el ? (el.tagName + '.' + (el.getAttribute('class') || '')) : 'null'; others[k] = (others[k] || 0) + 1; }
    }
    return { of: 81, reachesGrid: hitSvg, swallowed: hitOther, by: others };
  },
  overflow() {
    const bad = [];
    for (const n of document.querySelectorAll('#app *')) {
      const r = n.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.left < -0.5 || r.top < -0.5 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) {
        bad.push({ cls: n.getAttribute('class') || n.tagName, l: +r.left.toFixed(0), t: +r.top.toFixed(0), rr: +r.right.toFixed(0), b: +r.bottom.toFixed(0) });
      }
    }
    return { viewport: [innerWidth, innerHeight], out: bad.slice(0, 8), count: bad.length };
  },
};
