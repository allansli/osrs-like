import { describe, expect, it } from 'vitest';
import { BASINS, PATHS } from '../src/data/worldMap';
import { WORLD_REGIONS } from '../src/data/world';
import { hitsCastleWall, isDeepWater, isWalkable, riverCenterX } from '../src/state/collision';
import { shrineWorldPos } from '../src/state/shrines';
import { getTerrainHeight, onPath, slopeAt } from '../src/state/terrain';

// Design 6.11, G2.1 and G2.2. Counts come from design 6.3: four paths, two basins.
const WATER_PLANE = -0.34;
const onBridge = (x: number, z: number) => Math.abs(z) <= 2.05 && x >= 20.5 && x <= 35.5;
const inCragCorner = (x: number, z: number) => x < -35 && z > 30;

/** Points along a polyline, every vertex plus a point at most `step` apart. */
function samplePolyline(points: [number, number][], step = 1): [number, number][] {
  const out: [number, number][] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1];
    const [bx, bz] = points[i];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  return out;
}

describe('relief', () => {
  it('walkable height range outside the crag corner is at least 12', () => {
    let min = Infinity;
    let max = -Infinity;
    for (let x = -118; x <= 118; x += 2) {
      for (let z = -118; z <= 118; z += 2) {
        // The river trough is excluded: its floor under the bridge deck is walkable and would count -1.45 for free.
        if (inCragCorner(x, z) || !isWalkable(x, z) || Math.abs(x - riverCenterX(z)) < 6.8) continue;
        const h = getTerrainHeight(x, z);
        min = Math.min(min, h);
        max = Math.max(max, h);
      }
    }
    expect(max - min).toBeGreaterThanOrEqual(12);
  });

  it('every region core is exactly 0 within 16', () => {
    for (const r of WORLD_REGIONS) {
      for (let a = 0; a < 32; a++) {
        const ang = (a / 32) * Math.PI * 2;
        for (const d of [0, 4, 8, 12, 15.9]) {
          const x = r.x + Math.cos(ang) * d;
          const z = r.z + Math.sin(ang) * d;
          expect(getTerrainHeight(x, z), `${r.id} (${x}, ${z})`).toBe(0);
        }
      }
    }
  });

  it('every basin centre is below -0.34', () => {
    expect(BASINS).toHaveLength(2);
    for (const b of BASINS) {
      expect(getTerrainHeight(b.x, b.z), b.name).toBeLessThan(WATER_PLANE);
    }
  });

  it('every basin point below the water plane is unwalkable and every unwalkable basin point is under water', () => {
    expect(BASINS).toHaveLength(2);
    // Points within 0.03 of the water plane are the shoreline; walkability there may go either way.
    const SHORE = 0.03;
    for (const b of BASINS) {
      let wet = 0;
      for (let x = b.x - b.radius; x <= b.x + b.radius; x += 0.5) {
        for (let z = b.z - b.radius; z <= b.z + b.radius; z += 0.5) {
          if (Math.hypot(x - b.x, z - b.z) > b.radius) continue;
          if (isDeepWater(x, z) || hitsCastleWall(x, z)) continue;
          const h = getTerrainHeight(x, z);
          if (Math.abs(h - WATER_PLANE) < SHORE) continue;
          const at = `${b.name} (${x}, ${z}) h=${h}`;
          if (h < WATER_PLANE) {
            wet++;
            expect(isWalkable(x, z), at).toBe(false);
          } else {
            expect(isWalkable(x, z), at).toBe(true);
          }
        }
      }
      expect(wet, b.name).toBeGreaterThan(0);
    }
  });

  it('every path sampled each unit is walkable end to end', () => {
    expect(PATHS).toHaveLength(4);
    for (const p of PATHS) {
      for (const [x, z] of samplePolyline(p.points)) {
        expect(isWalkable(x, z), `${p.name} (${x}, ${z})`).toBe(true);
        expect(onPath(x, z), `${p.name} (${x}, ${z}) onPath`).toBe(true);
      }
    }
  });

  it('path slope is at most 0.25 outside the bridge rectangle', () => {
    expect(PATHS).toHaveLength(4);
    for (const p of PATHS) {
      for (const [x, z] of samplePolyline(p.points)) {
        if (onBridge(x, z)) continue;
        expect(slopeAt(x, z), `${p.name} (${x}, ${z})`).toBeLessThanOrEqual(0.25);
      }
    }
  });

  it('paths cross the river only on the bridge rectangle', () => {
    expect(PATHS).toHaveLength(4);
    let bridgeSamples = 0;
    for (const p of PATHS) {
      for (const [x, z] of samplePolyline(p.points)) {
        if (onBridge(x, z)) bridgeSamples++;
        if (Math.abs(x - riverCenterX(z)) < 6.8) {
          expect(onBridge(x, z), `${p.name} in the river trough at (${x}, ${z})`).toBe(true);
        }
      }
    }
    // Millrace Road crosses the river, so some path must run over the bridge.
    expect(bridgeSamples).toBeGreaterThan(0);
  });

  it("each path ends within 8 of its region's shrine", () => {
    expect(PATHS).toHaveLength(4);
    const reached = new Set<string>();
    for (const p of PATHS) {
      const [x, z] = p.points[p.points.length - 1];
      // A path's region is the one whose shrine is nearest its last point (W6 labels signposts the same way).
      let best = { id: '', d: Infinity };
      for (const r of WORLD_REGIONS) {
        const s = shrineWorldPos(r);
        const d = Math.hypot(x - s.x, z - s.z);
        if (d < best.d) best = { id: r.id, d };
      }
      expect(best.d, `${p.name} ends ${best.d} from the ${best.id} shrine`).toBeLessThanOrEqual(8);
      reached.add(best.id);
    }
    // Four paths lead out of the start town to the four other shrines.
    expect(reached.has('lumbridge')).toBe(false);
    expect(reached.size).toBe(4);
  });
});
