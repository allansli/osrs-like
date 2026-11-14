import { BASINS, RIDGES, type RidgeDef } from '../data/worldMap';

/** River Lum centerline used by both the renderer and the collision tests. */
export function riverCenterX(z: number): number {
  return 28 + Math.sin(z * 0.05) * 8;
}

export interface Aabb {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Lumbridge castle footprint. The structure is built at world (0, -25)
 * with the gate facing +Z toward the courtyard. The gap between the south
 * wall segments is the only walkable entrance.
 */
export function castleBlockers(): Aabb[] {
  const cx = 0;
  const cz = -25;
  const t = 0.7;
  return [
    { minX: cx - 9.6, maxX: cx + 9.6, minZ: cz - 9 - t, maxZ: cz - 9 + t },
    { minX: cx - 9.1, maxX: cx - 1.7, minZ: cz + 8 - t, maxZ: cz + 8 + t },
    { minX: cx + 1.7, maxX: cx + 9.1, minZ: cz + 8 - t, maxZ: cz + 8 + t },
    { minX: cx - 9 - t, maxX: cx - 9 + t, minZ: cz - 9, maxZ: cz + 8 },
    { minX: cx + 9 - t, maxX: cx + 9 + t, minZ: cz - 9, maxZ: cz + 8 },
    { minX: cx - 3.8, maxX: cx + 3.8, minZ: cz - 6.6, maxZ: cz - 0.4 }
  ];
}

export function isDeepWater(x: number, z: number): boolean {
  const dist = Math.abs(x - riverCenterX(z));
  if (dist >= 4.6) return false;
  const onBridge = Math.abs(z) <= 2.05 && x >= 20.5 && x <= 35.5;
  return !onBridge;
}

export function hitsCastleWall(x: number, z: number): boolean {
  for (const box of castleBlockers()) {
    if (x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ) return true;
  }
  return false;
}

/** Distance from (x, z) to a polyline, and the nearest point on it. */
export function nearestOnPolyline(points: [number, number][], x: number, z: number): { d: number; qx: number; qz: number } {
  let best = { d: Infinity, qx: 0, qz: 0 };
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1];
    const [bx, bz] = points[i];
    const lx = bx - ax;
    const lz = bz - az;
    const len2 = lx * lx + lz * lz;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * lx + (z - az) * lz) / len2));
    const qx = ax + lx * t;
    const qz = az + lz * t;
    const d = Math.hypot(x - qx, z - qz);
    if (d < best.d) best = { d, qx, qz };
  }
  return best;
}

/** Distance from the nearest crest point (qx, qz) to the closest gap centre, minus that gap's halfWidth (<= 0 inside a gap). */
export function gapDistance(ridge: RidgeDef, qx: number, qz: number): number {
  let best = Infinity;
  for (const g of ridge.gaps) best = Math.min(best, Math.hypot(qx - g.at[0], qz - g.at[1]) - g.halfWidth);
  return best;
}

/** The ridge crest as sub-paths sampled once per unit, split wherever the crest is inside a gap (for drawing). */
export function ridgeSpans(ridge: RidgeDef): [number, number][][] {
  const spans: [number, number][][] = [];
  let cur: [number, number][] = [];
  const add = (x: number, z: number) => {
    if (gapDistance(ridge, x, z) <= 0) {
      if (cur.length > 0) spans.push(cur);
      cur = [];
    } else cur.push([x, z]);
  };
  ridge.points.forEach(([bx, bz], i) => {
    if (i === 0) return add(bx, bz);
    const [ax, az] = ridge.points[i - 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az)));
    for (let k = 1; k <= n; k++) add(ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n);
  });
  if (cur.length > 0) spans.push(cur);
  return spans;
}

/** Basin water is a disc of 0.6 x radius; terrain.ts puts the height below the water plane exactly there. */
export const BASIN_WET_FRACTION = 0.6;

export function inBasinWater(x: number, z: number): boolean {
  return BASINS.some((b) => Math.hypot(x - b.x, z - b.z) < b.radius * BASIN_WET_FRACTION);
}

export function inRidgeCore(x: number, z: number): boolean {
  for (const r of RIDGES) {
    const n = nearestOnPolyline(r.points, x, z);
    if (n.d <= r.coreHalfWidth && gapDistance(r, n.qx, n.qz) > 0) return true;
  }
  return false;
}

export function isWalkable(x: number, z: number): boolean {
  if (x < -118 || x > 118 || z < -118 || z > 118) return false;
  if (isDeepWater(x, z)) return false;
  if (hitsCastleWall(x, z)) return false;
  if (inRidgeCore(x, z)) return false;
  if (inBasinWater(x, z)) return false;
  return true;
}

export function moveWithCollision(x: number, z: number, dx: number, dz: number): { x: number; z: number } {
  const clamp = (v: number) => Math.max(-118, Math.min(118, v));
  const nx = clamp(x + dx);
  const nz = clamp(z + dz);
  if (isWalkable(nx, nz)) return { x: nx, z: nz };
  if (isWalkable(nx, z)) return { x: nx, z };
  if (isWalkable(x, nz)) return { x, z: nz };
  return { x, z };
}
