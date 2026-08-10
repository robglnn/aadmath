import katex from 'katex';

/**
 * Every piece of mathematics in the game goes through here. Strict mode is on
 * and errors throw: a malformed expression must fail loudly in development
 * rather than render as red source text in a learner's face.
 */
export function tex(src, { display = false } = {}) {
  try {
    return render(src, display);
  } catch (err) {
    console.error('[KaTeX] rejected:', src, err.message);
    if (import.meta.env?.DEV) throw err;
    return `<span class="tex-fallback">${escapeHtml(src)}</span>`;
  }
}

function render(src, display) {
  return katex.renderToString(src, {
    throwOnError: true,
    strict: 'error',
    displayMode: display,
    output: 'htmlAndMathml', // MathML keeps screen readers in the loop
    trust: false,
    macros: {},
  });
}

/**
 * True when strict KaTeX will accept this source. Lets a caller build several
 * candidate renderings — a substituted equation, an identity, a bare value —
 * and pick the best one that is definitely well formed, without ever logging
 * an error for the candidates it discarded.
 */
export function texOk(src) {
  if (typeof src !== 'string' || !src.trim()) return false;
  try {
    render(src, false);
    return true;
  } catch {
    return false;
  }
}

/**
 * Render the first candidate strict KaTeX accepts. Nothing is logged for the
 * rejected ones — they were speculative by design. Returns '' if all fail.
 */
export function texFirst(candidates, opts) {
  for (const c of candidates) {
    if (texOk(c)) return tex(c, opts);
  }
  return '';
}

export function setTex(el, src, opts) {
  el.innerHTML = tex(src, opts);
  return el;
}

/**
 * Prose with inline mathematics. Text delimited by `$…$` or by backticks is
 * rendered as strict KaTeX; everything else is escaped plain text. This is how
 * a situation, a companion line or a worked reason can say "its width $2x + 2$
 * is cast in two strips" without a single raw LaTeX fragment ever reaching the
 * DOM as text — and without the surrounding prose being fed to KaTeX.
 */
export function texProse(s) {
  const src = String(s ?? '');
  let out = '';
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '$' || ch === '`') {
      const end = src.indexOf(ch, i + 1);
      if (end > i + 1) {
        const body = src.slice(i + 1, end);
        out += texOk(body) ? tex(body) : escapeHtml(body);
        i = end + 1;
        continue;
      }
    }
    out += escapeHtml(ch);
    i++;
  }
  return out;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
