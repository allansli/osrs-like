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
