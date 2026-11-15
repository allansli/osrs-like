import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RESOURCE_NODES_DEF } from '../src/data/world';

const read = (p: string) => readFileSync(fileURLToPath(new URL(`../src/${p}`, import.meta.url)), 'utf8');

// Today's respawns in milliseconds. D4 raises them; T1 may tune them within (today, 10000].
const TODAY = { fish_shrimp: 2000, fish_trout: 2000, fish_lobster: 2500, fish_shark: 3000 } as const;

describe('fishing cues', () => {
  it('an emptied fishing spot stays empty longer than today, inside the tuning range', () => {
    for (const [key, today] of Object.entries(TODAY)) {
      const respawn = (RESOURCE_NODES_DEF as Record<string, { respawn: number }>)[key].respawn;
      expect(respawn, key).toBeGreaterThan(today);
      expect(respawn, key).toBeLessThanOrEqual(10000);
    }
  });

  it('a catch always empties the spot', () => {
    expect(read('engine/actions.ts')).not.toContain('0.35');
  });

  it('an emptied spot and a returning spot each have a sound', () => {
    const audio = read('engine/audio.ts');
    expect(audio).toContain('spotEmpty:');
    expect(audio).toContain('spotReturn:');
    expect(read('engine/actions.ts')).toContain('SFX.spotEmpty()');
    expect(read('engine/loop.ts')).toContain('SFX.spotReturn()');
  });

  it('an empty spot leaves a mark', () => {
    const spawns = read('engine/spawns.ts');
    const start = spawns.indexOf('depletedMesh = new THREE.Group();');
    expect(start).toBeGreaterThan(-1);
    const end = spawns.indexOf('const hitbox', start);
    expect(end).toBeGreaterThan(start);
    expect(spawns.slice(start, end)).toContain('depletedMesh.add(');
  });

  it('no second chat line per fish', () => {
    expect(read('engine/actions.ts').split('Gathered <b>').length - 1).toBe(1);
  });
});
