import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Plan UI2, design 7.1 to 7.3 and 8.1 (G5.9 interface part, G5.10). Red until UI3 and UI4.
const ROOT = new URL('../', import.meta.url).pathname;
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const css = read('src/ui/styles.css').replace(/\/\*[\s\S]*?\*\//g, '');
const html = read('index.html');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const f = join(dir, n);
    return statSync(f).isDirectory() ? walk(f) : [f];
  });
const sourceFiles = walk(join(ROOT, 'src')).filter((f) => /\.(ts|css|html|js|json|svg)$/.test(f));

describe('interface tokens and type', () => {
  it('no old token prefix (--osrs-, --botw-, --panel-) in the CSS, index.html or any file under src/', () => {
    const old = /--(osrs|botw|panel)-/;
    expect(old.test(css), 'styles.css').toBe(false);
    expect(old.test(html), 'index.html').toBe(false);
    expect(sourceFiles.filter((f) => old.test(readFileSync(f, 'utf8')))).toEqual([]);
  });

  it('no backdrop-filter in the CSS', () => {
    expect(css).not.toMatch(/backdrop-filter/);
  });

  it('no font-size below 11px (0.6875rem) and no font-weight above 700', () => {
    const small = [...css.matchAll(/font-size\s*:\s*([\d.]+)(px|rem)\b/g)]
      .filter(([, n, u]) => Number(n) < (u === 'px' ? 11 : 11 / 16))
      .map((m) => m[0]);
    expect(small).toEqual([]);
    const heavy = [...css.matchAll(/font-weight\s*:\s*(\d+)/g)].filter(([, w]) => Number(w) > 700).map((m) => m[0]);
    expect(heavy).toEqual([]);
  });

  it('no http:// or https:// in the CSS', () => {
    expect(css).not.toMatch(/https?:\/\//);
  });

  it('every @font-face has font-display: swap and a relative url(', () => {
    const faces = [...css.matchAll(/@font-face\s*\{[^}]*\}/g)].map((m) => m[0]);
    expect(faces.length, 'at least one @font-face per shipped font file').toBeGreaterThanOrEqual(4);
    for (const face of faces) {
      expect(face).toMatch(/font-display\s*:\s*swap/);
      const urls = [...face.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((m) => m[1]);
      expect(urls.length, face).toBeGreaterThan(0);
      for (const u of urls) expect(u, 'relative url').not.toMatch(/^([a-z][a-z0-9+.-]*:|\/)/i);
    }
  });

  it('index.html has no inline style that sets a colour or a font size', () => {
    const styles = [...html.matchAll(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map((m) => m[1] ?? m[2]);
    const bad = styles.filter(
      (s) => /(^|[;\s])(color|background(-color)?|border(-[a-z]+)?-color|font-size|fill|stroke)\s*:/i.test(s) || /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(s),
    );
    expect(bad).toEqual([]);
  });
});

// WCAG relative luminance and contrast, computed from the --ui-* values in styles.css.
const token = (name: string): [number, number, number] => {
  const m = css.match(new RegExp(`--ui-${name}\\s*:\\s*#([0-9a-fA-F]{6})\\b`));
  if (!m) throw new Error(`token --ui-${name} is not declared as a 6-digit hex colour in styles.css`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lum = ([r, g, b]: [number, number, number]) => {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (fg: string, bg: string) => {
  const [a, b] = [lum(token(fg)), lum(token(bg))];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

const PAIRS: [string, string][] = [
  ['bone', 'slate-1'], ['bone', 'slate-2'],
  ['bone-dim', 'slate-1'], ['bone-dim', 'slate-2'],
  ['brass', 'slate-1'],
  ...['ember', 'moss', 'tide', 'amethyst', 'warn'].map((c): [string, string] => [c, 'slate-1']),
  ['ink', 'brass'],
];

describe('interface contrast (finding 30)', () => {
  it.each(PAIRS)('%s on %s is at least 4.5 to 1', (fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});
