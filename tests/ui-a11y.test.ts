import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Plan UI2, design 7.4 and 8.1 (G5.11, findings 30 to 32). Text scan of index.html and the CSS.
// Red until UI4 (CSS cases) and UI5 (markup cases).
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const html = read('index.html').replace(/<!--[\s\S]*?-->/g, '');
const css = read('src/ui/styles.css').replace(/\/\*[\s\S]*?\*\//g, '');

// One start tag: name, then attributes. Quoted values may contain '>'.
const TAG = /<([a-zA-Z][\w-]*)((?:\s+[^\s=>/"']+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>"']+))?)*)\s*\/?>/g;
type El = { tag: string; attrs: Record<string, string>; start: number; end: number };
const attrsOf = (s: string): Record<string, string> =>
  Object.fromEntries([...s.matchAll(/([^\s=>/"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+)))?/g)].map((m) => [m[1].toLowerCase(), m[2] ?? m[3] ?? m[4] ?? '']));
const els: El[] = [...html.matchAll(TAG)].map((m) => ({ tag: m[1].toLowerCase(), attrs: attrsOf(m[2]), start: m.index!, end: m.index! + m[0].length }));
const label = (e: El) => `<${e.tag}${e.attrs.id ? ` id=${e.attrs.id}` : ''}${e.attrs.class ? ` class="${e.attrs.class}"` : ''}>`;

describe('keyboard and dialogs in index.html', () => {
  it('every element with a click hook (onclick or data-action) is a button, a or input', () => {
    const bad = els.filter((e) => ('onclick' in e.attrs || 'data-action' in e.attrs) && !['button', 'a', 'input'].includes(e.tag));
    expect(bad.map(label)).toEqual([]);
  });

  it('every .modal-window has role="dialog", aria-modal="true" and an aria-labelledby naming an existing id', () => {
    const modals = els.filter((e) => e.attrs.class?.split(/\s+/).includes('modal-window'));
    expect(modals.length).toBeGreaterThan(0);
    const ids = new Set(els.map((e) => e.attrs.id).filter(Boolean));
    for (const m of modals) {
      expect(m.attrs.role, label(m)).toBe('dialog');
      expect(m.attrs['aria-modal'], label(m)).toBe('true');
      expect(ids.has(m.attrs['aria-labelledby']), `${label(m)} aria-labelledby=${m.attrs['aria-labelledby']}`).toBe(true);
    }
  });

  it('every icon-only button has an aria-label', () => {
    const bad = els.filter((e) => {
      if (e.tag !== 'button' || e.attrs['aria-label'] || e.attrs['aria-labelledby']) return false;
      const close = html.indexOf('</button>', e.end);
      const text = html.slice(e.end, close).replace(/<[^>]*>/g, '');
      return !/[\p{L}\p{N}]/u.test(text); // no letter or digit: empty, a glyph, or an image only
    });
    expect(bad.map(label)).toEqual([]);
  });
});

// Body of the first block that starts at `head`, by brace matching.
const block = (head: RegExp): string | undefined => {
  const m = head.exec(css);
  if (!m) return undefined;
  let depth = 0;
  for (let i = m.index + m[0].length - 1; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(m.index + m[0].length, i);
  }
  return undefined;
};

describe('motion and focus in the CSS', () => {
  it('has a prefers-reduced-motion: reduce rule that sets animation: none and transition: none', () => {
    const body = block(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{/);
    expect(body, '@media (prefers-reduced-motion: reduce)').toBeDefined();
    expect(body).toMatch(/animation\s*:\s*none/);
    expect(body).toMatch(/transition\s*:\s*none/);
  });

  it('has a :focus-visible rule with a visible outline', () => {
    const rule = /:focus-visible[^{}]*\{([^}]*)\}/.exec(css);
    expect(rule, ':focus-visible rule').not.toBeNull();
    expect(rule![1]).toMatch(/outline\s*:\s*[^;]*\S/);
    expect(rule![1]).not.toMatch(/outline\s*:\s*(none|0)\b/);
  });
});
