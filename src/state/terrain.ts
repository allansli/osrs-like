import { WORLD_REGIONS, type RegionDef } from '../data/world';
import { BASINS, PATHS, POIS, RIDGES } from '../data/worldMap';
import { BASIN_WET_FRACTION, gapDistance, nearestOnPolyline, riverCenterX } from './collision';

/** Terrain mesh segments per side (design 6.2). */
export const TERRAIN_SEGMENTS = 160;

const WATER_PLANE = -0.34;
const PATH_SHOULDER = 3;
const PAD_SHOULDER = 2;

const smooth = (t: number) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/**
 * Design 6.2, in order: base hills, ridges, basins, paths, river, region cores, POI pads.
 * Region cores are exactly 0 within 16 and win over everything else.
 */
export function getTerrainHeight(x: number, z: number): number {
  let h = settledHeight(x, z);
  if (h === null) return 0;
  for (const poi of POIS) {
    if (poi.padRadius <= 0) continue;
    const d = Math.hypot(x - poi.x, z - poi.z);
    if (d >= poi.padRadius + PAD_SHOULDER) continue;
    const w = 1 - smooth((d - poi.padRadius) / PAD_SHOULDER);
    h += ((settledHeight(poi.x, poi.z) ?? 0) - h) * w;
  }
  return h;
}

/** Steps 1-5 with the region cores applied (step 6 without pads); null inside a core. */
function settledHeight(x: number, z: number): number | null {
  for (const reg of WORLD_REGIONS) {
    const d = Math.hypot(x - reg.x, z - reg.z);
    if (d < 16) return null;
    if (d < 28) return composed(x, z) * smooth((d - 16) / 12);
  }
  return composed(x, z);
}

/** Steps 1-5 of design 6.2. */
function composed(x: number, z: number): number {
  // Distance to the nearest path edge, shared by the hill factor (step 1) and the flattening (step 4).
  let pathW = 0;
  let pathEdge = Infinity;
  for (const p of PATHS) {
    const d = nearestOnPolyline(p.points, x, z).d;
    pathEdge = Math.min(pathEdge, d - p.halfWidth);
    pathW = Math.max(pathW, 1 - smooth((d - p.halfWidth) / PATH_SHOULDER));
  }

  // 1. Base hills, amplitude 1 near settled ground rising to 2.2 in the wilds; the crag ramp is kept as is.
  let settled = pathEdge - PATH_SHOULDER;
  for (const reg of WORLD_REGIONS) settled = Math.min(settled, Math.hypot(x - reg.x, z - reg.z) - 28);
  const factor = 1 + 1.2 * smooth(settled / 24);
  let h = Math.max(0.08, hills(x, z) * factor + crag(x, z));

  // 2. Ridges: flat crest over the core, falling to 0 at halfWidth; a gap scales it down to a saddle.
  let ridge = 0;
  for (const r of RIDGES) {
    const n = nearestOnPolyline(r.points, x, z);
    if (n.d >= r.halfWidth) continue;
    const profile = smooth((r.halfWidth - n.d) / (r.halfWidth - r.coreHalfWidth));
    const saddle = smooth(gapDistance(r, n.qx, n.qz) / 3);
    ridge = Math.max(ridge, r.height * profile * saddle);
  }
  h += ridge;

  // 3. Basins: below the water plane exactly inside the wet disc (collision.ts blocks the same disc), a shore out to the radius.
  for (const b of BASINS) {
    const d = Math.hypot(x - b.x, z - b.z);
    if (d >= b.radius) continue;
    const wet = b.radius * BASIN_WET_FRACTION;
    if (d < wet) {
      const k = d / wet;
      h = WATER_PLANE - (b.depth + WATER_PLANE) * (1 - k * k);
    } else {
      h = WATER_PLANE + (h - WATER_PLANE) * smooth((d - wet) / (b.radius - wet));
    }
  }

  // 4. Paths: pulled toward the low-frequency hills, with a shoulder.
  if (pathW > 0) h += (pathBase(x, z) - h) * pathW;

  // 5. River: today's trough, unchanged, after the paths so the road does not fill it under the bridge.
  const riverDist = Math.abs(x - riverCenterX(z));
  if (riverDist < 6.8) h = -1.45 * Math.cos((riverDist / 6.8) * (Math.PI / 2));
  return h;
}

function hills(x: number, z: number): number {
  const h1 = Math.sin(x * 0.032) * Math.cos(z * 0.032) * 1.85;
  const h2 = Math.sin(x * 0.085 + z * 0.065) * 0.55;
  return (h1 + h2) * 0.55 + 0.85;
}

function crag(x: number, z: number): number {
  if (x < -35 && z > 30) {
    return Math.min(6.4, ((-35 - x) + (z - 30)) * 0.06) * (0.6 + 0.4 * Math.sin(x * 0.13) * Math.cos(z * 0.13));
  }
  return 0;
}

/** The base sampled at low frequency: the long-wave hill term only, no crag. */
function pathBase(x: number, z: number): number {
  return Math.max(0.08, Math.sin(x * 0.032) * Math.cos(z * 0.032) * 1.85 * 0.55 + 0.85);
}

/** True within any path's own halfWidth of its centre line. */
export function onPath(x: number, z: number): boolean {
  return PATHS.some((p) => nearestOnPolyline(p.points, x, z).d <= p.halfWidth);
}

/** Gradient magnitude by central difference over 0.5 units. */
export function slopeAt(x: number, z: number): number {
  const e = 0.5;
  const gx = (getTerrainHeight(x + e, z) - getTerrainHeight(x - e, z)) / (2 * e);
  const gz = (getTerrainHeight(x, z + e) - getTerrainHeight(x, z - e)) / (2 * e);
  return Math.hypot(gx, gz);
}

export function regionAt(x: number, z: number): RegionDef | null {
  for (const reg of WORLD_REGIONS) {
    const d = Math.hypot(x - reg.x, z - reg.z);
    if (d < reg.radius) {
      return reg;
    }
  }
  return null;
}
