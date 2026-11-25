import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const src = readFileSync(fileURLToPath(new URL('../src/engine/particles.ts', import.meta.url)), 'utf8');

describe('particles', () => {
  it('both particle materials draw both faces, since the shapes face away from the camera', () => {
    const materials = src.split('new THREE.ShaderMaterial(').slice(1);
    expect(materials).toHaveLength(2);
    for (const m of materials) expect(m.slice(0, m.indexOf('\n  });'))).toContain('side: THREE.DoubleSide');
  });
});

describe('falling weather', () => {
  it('moves by offsets accumulated per frame, so a change of speed or wind never jumps the field', () => {
    const fall = src.slice(src.indexOf('const FALL_VERTEX_SHADER'), src.indexOf('const PARTICLE_FRAGMENT_SHADER'));
    expect(fall).toContain('move.y -= uFallOffset * aSpeed.y;');
    expect(fall).not.toMatch(/uPTime \* aSpeed|aSpeed\.y \* uPTime/);
    expect(src).toContain('uFallOffset.value += fallSpeed * dt');
  });

  it('rain leans along its own screen-space velocity', () => {
    expect(src).toContain('vert.x += vert.y * clamp(vv.x / min(vv.y, -0.001), -1.5, 1.5);');
    expect(src).toMatch(/weather\.id === 'rain' \? RAIN_WIND_MULTIPLIER/);
  });
});
