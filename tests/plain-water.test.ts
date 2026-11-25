import { expect, it } from 'vitest';
import * as THREE from 'three';
import { G } from '../src/engine/context';
import { buildWater, setWaterTier } from '../src/engine/water';
import { enterPlainMode } from '../src/engine/post';

it('plain mode keeps the water on the simple ramp on every tier', () => {
  G.scene = new THREE.Scene();
  const water = buildWater();
  const mat = water.material as THREE.ShaderMaterial;
  setWaterTier('high');
  expect(mat.defines.WATER_SIMPLE).toBeUndefined();
  enterPlainMode(G.scene);
  setWaterTier('high');
  expect(mat.defines.WATER_SIMPLE).toBe('');
  setWaterTier('ultra');
  expect(mat.defines.WATER_SIMPLE).toBe('');
});
