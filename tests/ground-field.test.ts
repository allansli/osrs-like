import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PATHS, POIS } from '../src/data/worldMap';
import { buildGroundField, carpetMaterial, GROUND_FIELD_SIZE } from '../src/engine/flora';
import { facetMaterial } from '../src/engine/materials';
import { terrainMaterial } from '../src/engine/textures';
import { riverCenterX } from '../src/state/collision';

// Design 6.7 and plan task GR6: the ground field's carpet density, sampled as the carpet's vertex shader
// samples it (bilinear over 257 texels across the 260-unit terrain), and the carpet's program cache key.

const field = buildGroundField();
const data = field.image.data as unknown as Uint16Array;
const N = GROUND_FIELD_SIZE;
const STEP = 260 / (N - 1);

function texel(i: number, j: number): number {
  const ci = Math.max(0, Math.min(N - 1, i));
  const cj = Math.max(0, Math.min(N - 1, j));
  return THREE.DataUtils.fromHalfFloat(data[(cj * N + ci) * 4 + 1]);
}

function density(x: number, z: number): number {
  const fx = (x + 130) / STEP;
  const fz = (z + 130) / STEP;
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const tx = fx - i;
  const tz = fz - j;
  const top = texel(i, j) * (1 - tx) + texel(i + 1, j) * tx;
  const bottom = texel(i, j + 1) * (1 - tx) + texel(i + 1, j + 1) * tx;
  return top * (1 - tz) + bottom * tz;
}

// Every path's centre line, one sample per unit along each segment.
const PATH_SAMPLES: [number, number][] = [];
for (const p of PATHS) {
  for (let s = 1; s < p.points.length; s++) {
    const [ax, az] = p.points[s - 1];
    const [bx, bz] = p.points[s];
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az));
    for (let k = 0; k <= steps; k++) PATH_SAMPLES.push([ax + ((bx - ax) * k) / steps, az + ((bz - az) * k) / steps]);
  }
}

// Open meadow, clear of paths, pads, water and the regions' paved cores.
const MEADOW: [string, number, number][] = [
  ['south of the castle', 0, -32],
  ['between the river and Varrock', 52, -40],
  ['north meadow', 20, 30]
];

function stubTerrain(): THREE.MeshLambertMaterial {
  return terrainMaterial({
    load(url: string) {
      const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
      tex.name = url;
      tex.needsUpdate = true;
      return tex;
    }
  });
}

describe('ground field', () => {
  it('is a 257 by 257 half-float RGBA texture with linear filtering', () => {
    expect(field.image.width).toBe(257);
    expect(field.image.height).toBe(257);
    expect(field.type).toBe(THREE.HalfFloatType);
    expect(field.format).toBe(THREE.RGBAFormat);
    expect(field.minFilter).toBe(THREE.LinearFilter);
    expect(field.magFilter).toBe(THREE.LinearFilter);
  });

  it('density is 0 at the centre of every path sample', () => {
    expect(PATH_SAMPLES.length).toBeGreaterThan(300);
    for (const [x, z] of PATH_SAMPLES) expect(density(x, z), `path at ${x}, ${z}`).toBe(0);
  });

  it('density is 0 at every POI centre', () => {
    expect(POIS).toHaveLength(7);
    for (const poi of POIS) expect(density(poi.x, poi.z), poi.id).toBe(0);
  });

  it('density is 0 at the river centre', () => {
    const zs = [-100, -60, -30, 20, 60, 100];
    for (const z of zs) expect(density(riverCenterX(z), z), `river at z ${z}`).toBe(0);
  });

  it('density is positive at three named meadow points', () => {
    expect(MEADOW).toHaveLength(3);
    for (const [name, x, z] of MEADOW) expect(density(x, z), name).toBeGreaterThan(0);
  });

  it("the carpet material's customProgramCacheKey differs from the terrain's and from a round facet's", () => {
    const keys = [
      carpetMaterial(0, field).customProgramCacheKey(),
      stubTerrain().customProgramCacheKey(),
      facetMaterial({ shade: 'round' }).customProgramCacheKey()
    ];
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(3);
  });
});
