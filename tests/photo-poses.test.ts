import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WORLD_REGIONS } from '../src/data/world';
import { PATHS, POIS } from '../src/data/worldMap';

// Plan V1a, design 8.2. Camera limits are the live clamps in input.ts (not sanitizeCam, which caps a saved camera).
const PITCH = [0.12, 1.15];
const DISTANCE = [3.6, 26];
const TIMES = ['night', 'dawn', 'morning', 'noon', 'golden', 'dusk'];

type Pose = {
  id: string; place: string; yaw: number; pitch: number; distance: number; times: string[]; weather?: string;
  yaws?: number[]; fromCorner?: boolean; viewports?: { width: number; height: number; ratio: number }[]; walk?: number;
};
const poses: Pose[] = JSON.parse(readFileSync(new URL('../docs/superpowers/baseline/stage5/poses.json', import.meta.url), 'utf8'));

// R0 correction A11.1: P2's place is the PATHS row millrace_road, so a PATHS id is a known place too.
// V1b resolves it to the path's point (18, 0), the west end of the bridge.
const PLACES = new Set([...POIS.map((p) => p.id), ...WORLD_REGIONS.map((r) => r.id), ...PATHS.map((p) => p.id)]);
const byId = (id: string): Pose => poses.find((p) => p.id === id) as Pose;

describe('photo poses', () => {
  it('holds the twelve poses P1 to P12', () => {
    expect(poses.map((p) => p.id)).toEqual(Array.from({ length: 12 }, (_, i) => `P${i + 1}`));
  });

  it('every pose names a known place', () => {
    for (const p of poses) {
      expect(PLACES.has(p.place), `${p.id}: ${p.place}`).toBe(true);
    }
  });

  it('every pose is inside the live camera limits', () => {
    for (const p of poses) {
      const yaws = p.yaws ?? [p.yaw];
      expect(yaws.length).toBeGreaterThan(0);
      for (const y of yaws) {
        expect(Number.isFinite(y), p.id).toBe(true);
      }
      expect(p.pitch, p.id).toBeGreaterThanOrEqual(PITCH[0]);
      expect(p.pitch, p.id).toBeLessThanOrEqual(PITCH[1]);
      expect(p.distance, p.id).toBeGreaterThanOrEqual(DISTANCE[0]);
      expect(p.distance, p.id).toBeLessThanOrEqual(DISTANCE[1]);
    }
  });

  it('P10 has eight yaws 45 degrees apart at pitch 0.12 and distance 26, plus eight from the walkable corner', () => {
    const p = byId('P10');
    expect(p.pitch).toBe(0.12);
    expect(p.distance).toBe(26);
    expect(p.yaws).toHaveLength(8);
    const ys = p.yaws as number[];
    for (let i = 1; i < 8; i++) {
      expect(ys[i] - ys[i - 1]).toBeCloseTo(Math.PI / 4, 2);
    }
    expect(p.fromCorner).toBe(true);
  });

  it('every time is one of night, dawn, morning, noon, golden, dusk', () => {
    for (const p of poses) {
      expect(p.times.length, p.id).toBeGreaterThan(0);
      for (const t of p.times) {
        expect(TIMES, `${p.id}: ${t}`).toContain(t);
      }
    }
  });

  it('P11 lists its four viewports', () => {
    expect(byId('P11').viewports).toHaveLength(4);
  });
});
