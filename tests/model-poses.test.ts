import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WORLD_REGIONS } from '../src/data/world';
import { PATHS, POIS } from '../src/data/worldMap';
import { player } from '../src/engine/context';
import { createLookHooks } from '../src/engine/photo';

type Row = { id: string; place?: string; x?: number; z?: number; yaw: number; pitch: number; distance: number; times: string[] };
const rows: Row[] = JSON.parse(readFileSync(new URL('../docs/superpowers/baseline/models/poses.json', import.meta.url), 'utf8'));
const PLACES = new Set([...POIS.map((p) => p.id), ...WORLD_REGIONS.map((r) => r.id), ...PATHS.map((p) => p.id)]);

describe('model poses', () => {
  it('a row with x,z and no place moves the player there', () => {
    createLookHooks().pose({ x: 48, z: 44, yaw: 0, pitch: 0.3, distance: 8 });
    expect(player.pos.x).toBe(48);
    expect(player.pos.z).toBe(44);
  });

  it('an unknown place still throws', () => {
    expect(() => createLookHooks().pose({ place: 'nowhere_at_all', yaw: 0, pitch: 0.3, distance: 8 })).toThrow(/Unknown place/);
  });

  it('every row of models/poses.json names a known place or carries x and z', () => {
    expect(rows).toHaveLength(7);
    for (const r of rows) {
      const ok = r.place !== undefined ? PLACES.has(r.place) : Number.isFinite(r.x) && Number.isFinite(r.z);
      expect(ok, r.id).toBe(true);
    }
  });
});
