import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Plan FX1, design 8.3 (vfx.ts). Text checks on src/engine/vfx.ts; the fixture is taken from vfx.ts as it stood after Stage 4.
const src = readFileSync(new URL('../src/engine/vfx.ts', import.meta.url), 'utf8');
const fixture = JSON.parse(readFileSync(new URL('./fixtures/vfx-timings.json', import.meta.url), 'utf8')) as {
  spawnVfx: { fn: string; life: string }[];
  launchProjectile: { fn: string; speed: string }[];
  speedAssignments: { fn: string; value: string }[];
  wrapperLifetimes: { fn: string; callee: string; life: string }[];
  lifeDefaults: { fn: string; value: string }[];
  exports: string[];
};

/** Top-level comma split of the text after the opening paren at `open`; returns the args and the index after the close paren. */
function callArgs(text: string, open: number): string[] {
  const args: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = open + 1; i < text.length; i++) {
    const c = text[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) { args.push(cur.trim()); return args; }
      depth--;
    }
    if (c === ',' && depth === 0) { args.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  throw new Error('unbalanced call in vfx.ts');
}

function calls(name: string): { fn: string; args: string[] }[] {
  const out: { fn: string; args: string[] }[] = [];
  const re = new RegExp(`\\b${name}\\(`, 'g');
  for (let m = re.exec(src); m; m = re.exec(src)) {
    const before = src.slice(0, m.index);
    if (/function\s+$/.test(before)) continue;
    const fns = [...before.matchAll(/^(?:export )?function (\w+)/gm)];
    out.push({ fn: fns[fns.length - 1][1], args: callArgs(src, m.index + m[0].length - 1) });
  }
  return out;
}

function extract() {
  return {
    spawnVfx: calls('spawnVfx').map((c) => ({ fn: c.fn, life: c.args[1] })),
    launchProjectile: calls('launchProjectile').map((c) => ({
      fn: c.fn,
      speed: /\bspeed\b(?:\s*:\s*([^,}\n]+))?/.exec(c.args[c.args.length - 1])?.[1]?.trim() ?? (c.args.length > 4 ? 'speed' : 'default'),
    })),
    speedAssignments: [...src.matchAll(/^\s*(?:let\s+)?speed\s*=\s*([\d.]+)/gm)].map((m) => {
      const fns = [...src.slice(0, m.index).matchAll(/^(?:export )?function (\w+)/gm)];
      return { fn: fns[fns.length - 1][1], value: m[1] };
    }),
    // Lifetimes that reach spawnVfx through the wrapper functions: spawnBurst arg 4, spawnExpandingRing and spawnRunicCircle arg 3, spawnSlashArc life option.
    wrapperLifetimes: [
      ...calls('spawnBurst').map((c) => ({ fn: c.fn, callee: 'spawnBurst', life: c.args[3] ?? 'default' })),
      ...calls('spawnExpandingRing').map((c) => ({ fn: c.fn, callee: 'spawnExpandingRing', life: c.args[2] ?? 'default' })),
      ...calls('spawnRunicCircle').map((c) => ({ fn: c.fn, callee: 'spawnRunicCircle', life: c.args[2] ?? 'default' })),
      ...calls('spawnSlashArc').map((c) => ({ fn: c.fn, callee: 'spawnSlashArc', life: /\blife\s*:\s*([^,}\n]+)/.exec(c.args[c.args.length - 1])?.[1]?.trim() ?? 'default' })),
    ],
    lifeDefaults: [...src.matchAll(/^\s*life\s*=\s*([\d.]+)/gm)].map((m) => {
      const fns = [...src.slice(0, m.index).matchAll(/^(?:export )?function (\w+)/gm)];
      return { fn: fns[fns.length - 1][1], value: m[1] };
    }),
    exports: [...src.matchAll(/^export function (\w+)/gm)].map((m) => m[1]),
  };
}

describe('vfx shapes and timings', () => {
  it('has no SphereGeometry in vfx.ts', () => {
    expect(src).not.toMatch(/\bSphereGeometry\b/);
  });

  it('has no ring or cylinder with more than 10 radial segments', () => {
    const over: string[] = [];
    // A missing or non-numeric segment argument falls back to the three.js default of 32, so it fails too.
    for (const c of calls('THREE.RingGeometry')) if (!(Number(c.args[2]) <= 10)) over.push(`${c.fn}: Ring ${c.args[2]}`);
    for (const c of calls('THREE.CylinderGeometry')) if (!(Number(c.args[3]) <= 10)) over.push(`${c.fn}: Cylinder ${c.args[3]}`);
    expect(over).toEqual([]);
  });

  it('imports BLOOM from look.ts', () => {
    expect(src).toMatch(/import\s*\{[^}]*\bBLOOM\b[^}]*\}\s*from\s*'\.\.\/data\/look'/);
  });

  it('keeps every lifetime and duration of the fixture', () => {
    const now = extract();
    expect(fixture.spawnVfx.length).toBeGreaterThan(20);
    expect(now.spawnVfx).toEqual(fixture.spawnVfx);
    expect(now.launchProjectile).toEqual(fixture.launchProjectile);
    expect(now.speedAssignments).toEqual(fixture.speedAssignments);
    expect(now.wrapperLifetimes.length).toBeGreaterThan(30);
    expect(now.wrapperLifetimes).toEqual(fixture.wrapperLifetimes);
    expect(now.lifeDefaults).toEqual(fixture.lifeDefaults);
  });

  it('still exports every function of vfx.ts at FX1', () => {
    expect(fixture.exports.length).toBeGreaterThan(15);
    const now = new Set(extract().exports);
    expect(fixture.exports.filter((n) => !now.has(n))).toEqual([]);
  });
});
