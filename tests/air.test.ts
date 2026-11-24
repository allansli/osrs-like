import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GFX_TIERS, type QualityTier } from '../src/data/look';
import { fogFactor } from '../src/state/dayCycle';
import { AIR_GLSL } from '../src/engine/atmosphere';
import { facetMaterial } from '../src/engine/materials';

// post.ts is imported inside the cases that need it, so a missing module fails only those (AR2's accept).
const post = () => import('../src/engine/post');

// Plan AR1, design 6.3 (the air), 6.10 (pixel budget, governor). Red until AR2, AR4a and AR4b.

// The frame `fogFactor` reads, the TypeScript twin of the uniforms `uFogDensity`, `uFogHeightFalloff`, `uFogBase`:
// `heightFalloff` is the natural-log rate per unit of height above `base` (ln 2 / 9 halves the fog every 9 units).
const HALVING = Math.LN2 / 9;
const frame = (over: Partial<{ density: number; heightFalloff: number; base: number }> = {}) => ({
  density: 0.01,
  heightFalloff: HALVING,
  base: 0,
  ...over
});

describe('fogFactor (design 6.3)', () => {
  it('is monotonic in distance at every height', () => {
    for (const h of [-3, 0, 2, 9, 40]) {
      let prev = fogFactor(0, h, frame());
      expect(prev).toBeCloseTo(0, 12);
      for (let d = 5; d <= 400; d += 5) {
        const f = fogFactor(d, h, frame());
        expect(f, `d ${d} h ${h}`).toBeGreaterThan(prev);
        expect(f).toBeLessThanOrEqual(1);
        prev = f;
      }
    }
  });

  it('halves every 9 units of height above the base', () => {
    for (const base of [0, 2]) {
      const f = frame({ base });
      for (const d of [20, 80, 200]) {
        const at0 = fogFactor(d, base, f);
        expect(fogFactor(d, base + 9, f) / at0, `d ${d}`).toBeCloseTo(0.5, 9);
        expect(fogFactor(d, base + 18, f) / at0, `d ${d}`).toBeCloseTo(0.25, 9);
      }
    }
  });

  it('is densest at and below the base (the pool under the water plane)', () => {
    const f = frame({ base: 2 });
    expect(fogFactor(60, -5, f)).toBeCloseTo(fogFactor(60, 2, f), 12);
  });

  it('equals plain exponential-squared fog when the height terms are 0', () => {
    for (const d of [0, 10, 55, 130, 300]) {
      const plain = 1 - Math.exp(-((0.01 * d) ** 2));
      for (const h of [-2, 0, 17, 80]) {
        expect(fogFactor(d, h, frame({ heightFalloff: 0, base: 0 })), `d ${d} h ${h}`).toBeCloseTo(plain, 12);
      }
    }
  });
});

type CompiledShader = { uniforms: Record<string, { value: unknown }>; vertexShader: string; fragmentShader: string };

function compile(mat: THREE.Material): CompiledShader {
  const shader: CompiledShader = {
    uniforms: {},
    vertexShader: THREE.ShaderLib.lambert.vertexShader,
    fragmentShader: THREE.ShaderLib.lambert.fragmentShader
  };
  mat.onBeforeCompile(
    shader as unknown as Parameters<THREE.MeshLambertMaterial['onBeforeCompile']>[0],
    null as unknown as THREE.WebGLRenderer
  );
  return shader;
}

describe('the air in the facet shader (design 6.3)', () => {
  it('AIR_GLSL defines applyAir', () => {
    expect(AIR_GLSL).toContain('applyAir');
  });

  it('removes the fog chunk and applies the air on linear radiance before tone mapping', () => {
    const frag = compile(facetMaterial({ color: 0x334155 })).fragmentShader;
    expect(frag).not.toContain('#include <fog_fragment>');
    const call = frag.indexOf('applyAir(');
    expect(call).toBeGreaterThanOrEqual(0);
    const tone = frag.indexOf('#include <tonemapping_fragment>');
    expect(tone).toBeGreaterThanOrEqual(0);
    expect(frag.indexOf('applyAir(outgoingLight')).toBeGreaterThanOrEqual(0);
    expect(frag.indexOf('applyAir(outgoingLight')).toBeLessThan(tone);
    expect(frag.indexOf('applyAir(outgoingLight')).toBeLessThan(frag.indexOf('#include <opaque_fragment>'));
  });

  it('keeps the program cache key distinct: it ends in |air for every variant', () => {
    for (const params of [{ shade: 'cut' }, { shade: 'round' }, { facetBlend: 0.5 }]) {
      const key = facetMaterial({ color: 0x334155, ...params }).customProgramCacheKey();
      expect(key, JSON.stringify(params)).toMatch(/\|air$/);
    }
  });
});

describe('effectivePixelRatio (design 6.10)', () => {
  const TIERS = Object.keys(GFX_TIERS) as QualityTier[];
  const SIZES: Array<[number, number]> = [[800, 600], [1280, 720], [1920, 1080], [2560, 1440], [3840, 2160], [7680, 4320]];

  it('never exceeds the tier ratio cap or megapixel cap, and is positive', async () => {
    const { effectivePixelRatio } = await post();
    for (const tier of TIERS) {
      for (const [w, h] of SIZES) {
        for (const dpr of [0.75, 1, 1.25, 1.5, 2, 3]) {
          const r = effectivePixelRatio(tier, w, h, dpr);
          const label = `${tier} ${w}x${h} dpr ${dpr}`;
          expect(r, label).toBeGreaterThan(0);
          expect(r, label).toBeLessThanOrEqual(GFX_TIERS[tier].pixelRatioCap + 1e-9);
          expect(r, label).toBeLessThanOrEqual(dpr + 1e-9);
          expect((w * r) * (h * r), label).toBeLessThanOrEqual(GFX_TIERS[tier].megapixelCap * 1e6 * (1 + 1e-6));
        }
      }
    }
  });

  it('does not cut the ratio when neither cap binds', async () => {
    const { effectivePixelRatio } = await post();
    expect(effectivePixelRatio('balanced', 1280, 720, 1)).toBeCloseTo(1, 9);
    expect(effectivePixelRatio('ultra', 1280, 720, 1.5)).toBeCloseTo(1.5, 9);
    expect(effectivePixelRatio('performance', 1280, 720, 2)).toBeCloseTo(1, 9);
  });

  it('a 4K display at ratio 2 does not allocate a 33-megapixel target on any tier', async () => {
    const { effectivePixelRatio } = await post();
    for (const tier of TIERS) {
      const r = effectivePixelRatio(tier, 3840, 2160, 2);
      expect(3840 * r * 2160 * r, tier).toBeLessThanOrEqual(16.6e6 * (1 + 1e-6));
    }
  });
});

describe('nextTier, the governor (design 6.10)', () => {
  const ORDER: QualityTier[] = ['performance', 'balanced', 'high', 'ultra'];
  const run = (ms: number, n = 200) => Array.from({ length: n }, () => ms); // 200 frames of 24+ ms span at least 4 s
  const open = { hidden: false, playerChose: false };

  it('steps down exactly one tier when the median of the window is above 24 ms', async () => {
    const { nextTier } = await post();
    for (let i = 1; i < ORDER.length; i++) expect(nextTier(ORDER[i], run(30), open), ORDER[i]).toBe(ORDER[i - 1]);
  });

  it('stays at performance', async () => {
    const { nextTier } = await post();
    expect(nextTier('performance', run(60), open)).toBe('performance');
  });

  it('never steps up, and leaves a healthy window alone', async () => {
    const { nextTier } = await post();
    for (const t of ORDER) {
      expect(nextTier(t, run(16, 300), open), t).toBe(t);
      expect(nextTier(t, run(5, 800), open), t).toBe(t);
    }
  });

  it('judges by the median: a median of exactly 24 ms or a few spikes do not step down', async () => {
    const { nextTier } = await post();
    expect(nextTier('ultra', run(24), open)).toBe('ultra');
    const spiky = [...run(16, 120), ...run(200, 20)];
    expect(nextTier('ultra', spiky, open)).toBe('ultra');
    const mostlySlow = [...run(30, 90), ...run(10, 40)];
    expect(nextTier('ultra', mostlySlow, open)).toBe('high');
  });

  it('returns the tier unchanged when the window saw the page hidden', async () => {
    const { nextTier } = await post();
    expect(nextTier('ultra', run(60), { hidden: true, playerChose: false })).toBe('ultra');
  });

  it('returns the tier unchanged once the player chose a tier', async () => {
    const { nextTier } = await post();
    for (const t of ORDER) expect(nextTier(t, run(60), { hidden: false, playerChose: true }), t).toBe(t);
  });
});
