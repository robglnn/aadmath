import 'katex/dist/katex.min.css';
import { RiftPanel } from '../../../src/ui/rift.js';
import { safeGenerate } from '../../../src/learn/generators.js';
import { registerPack } from '../../../src/content/registry.js';
import l2 from '../../../src/content/packs/algebra1-l2.js';
import l3 from '../../../src/content/packs/algebra1-l3.js';
import l4 from '../../../src/content/packs/algebra1-l4.js';
import l5 from '../../../src/content/packs/algebra1-l5.js';
registerPack(l2); registerPack(l3); registerPack(l4); registerPack(l5);
import { setLocale } from '../../../src/i18n/index.js';
const panel = new RiftPanel(document.getElementById('app'));
window.__shot = {
  show({ skill, form, d = 3, seed = 5000, locale = 'en', type = '' }) {
    setLocale(locale);
    const item = safeGenerate(skill, d, seed, { locale, form, record: false });
    panel.show(item, { title: '', skillId: item.skill, tier: 0, kind: 'learn', scaffold: 'none', example: null, streak: 0,
      onAnswer() { return { gained: 1, pL: 1, prev: 0.5 }; }, onClose() {} });
    for (const ch of type) {
      const b = panel.el.querySelector(`.rf-keys .rf-key[data-g="${ch.replace(/["\\]/g, '\\$&')}"]`);
      b?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
    return { answer: item.answer, latex: item.latex, mode: panel.mode,
      help: panel.el.querySelector('#rf-help')?.textContent?.trim(),
      keys: [...panel.el.querySelectorAll('.rf-keys .rf-key[data-g]')].map((b) => b.dataset.g) };
  },
  miss(n = 1) {
    for (let i = 0; i < n; i++) {
      for (const ch of '987') { panel.el.querySelector(`.rf-keys .rf-key[data-g="${ch}"]`)?.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
      panel.el.querySelector('.rf-key.commit')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
    return { socket: panel.el.querySelector('.rf-socket .val')?.textContent?.trim(),
      nudge: panel.el.querySelector('.rf-echo-nudge')?.textContent?.trim() };
  },
};
window.__shot.fill = function ({ skill, form, d = 3, seed = 5000, locale = 'en' }) {
  const info = window.__shot.show({ skill, form, d, seed, locale });
  // type the key on the real caps
  const pad = String(info.answer)
    .replace(/\\left|\\right|\\!|\\,|\\;|\\ /g, '')
    .replace(/\\pm/g, '\u00b1').replace(/\\cdot|\\times/g, '*');
  let t = pad;
  for (let i = 0; i < 16; i++) {
    const b = t;
    t = t.replace(/\^\s*\{([^{}]*)\}/g, '^$1')
      .replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (m, a, c) => `${/^(?:\d+|[a-zA-Z](?:\^\d+)?)$/.test(a) ? a : '(' + a + ')'}/${/^(?:\d+|[a-zA-Z](?:\^\d+)?)$/.test(c) ? c : '(' + c + ')'}`)
      .replace(/\\sqrt\s*\{([^{}]*)\}/g, (m, a) => '\u221a' + (/^(?:\d+|[a-zA-Z](?:\^\d+)?)$/.test(a) ? a : '(' + a + ')'));
    if (t === b) break;
  }
  t = t.replace(/\s+/g, '');
  for (const ch of t) {
    const b = document.querySelector(`.rf-keys .rf-key[data-g="${ch.replace(/["\\]/g, '\\$&')}"]`);
    b?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }
  const val = document.querySelector('.rf-socket .val');
  return { answer: info.answer, typed: t, len: t.length,
    scroll: val.scrollWidth, client: val.clientWidth, clipped: val.scrollWidth > val.clientWidth + 1,
    cls: val.className };
};
document.title = 'shotlab ready';
