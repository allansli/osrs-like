import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type Rule = { source: string; headers: { key: string; value: string }[] };

const config = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'vercel.json'), 'utf8'),
) as { headers?: Rule[] };
const rules: Rule[] = config.headers ?? [];

const valueOf = (rule: Rule, key: string) =>
  rule.headers.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value;

describe('vercel.json headers', () => {
  it('sends nosniff, strict-origin-when-cross-origin and the frame-ancestors policy on every path', () => {
    const all = rules.find((r) => r.source === '/(.*)');
    expect(all, 'a rule for source "/(.*)"').toBeDefined();
    expect(valueOf(all!, 'X-Content-Type-Options')).toBe('nosniff');
    expect(valueOf(all!, 'Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(valueOf(all!, 'Content-Security-Policy')).toBe("frame-ancestors 'self'");
  });

  it('assets under /assets are immutable for one year', () => {
    const assets = rules.find((r) => r.source === '/assets/(.*)');
    expect(assets, 'a rule for source "/assets/(.*)"').toBeDefined();
    expect(valueOf(assets!, 'Cache-Control')).toBe('public, max-age=31536000, immutable');
  });

  it('no immutable caching outside /assets', () => {
    const outside = rules.filter(
      (r) => !r.source.startsWith('/assets/') && /immutable/i.test(valueOf(r, 'Cache-Control') ?? ''),
    );
    expect(outside).toEqual([]);
  });
});
