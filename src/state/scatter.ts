// Procedural flora scatter generation (plan GR4, design 5.6, 6.7).
import {
  FLORA_RULES,
  GFX_TIERS,
  KIT_PIECES,
  type KitPieceId,
  type PoiFloraRule,
  type RegionFloraRule,
  type QualityTier,
} from '../data/look';
import { NODE_PLACEMENTS } from '../data/placements';
import { WORLD_REGIONS } from '../data/world';
import { BASINS, CAMPS, PATHS, POIS, RIDGES, SAFE_ZONES, type PoiDef } from '../data/worldMap';
import { WOODS_TREES } from '../data/woodsTrees';
import {
  hitsCastleWall,
  inBasinWater,
  isDeepWater,
  isWalkableGround,
  nearestOnPolyline,
  riverCenterX,
} from './collision';
import { shrineWorldPos } from './shrines';
import { getTerrainHeight, regionAt } from './terrain';

export interface ScatterInstance {
  x: number;
  z: number;
  rot: number;
  scale: number;
}

export type ScatterResult = Record<KitPieceId, ScatterInstance[]>;

const ALL_PIECE_IDS: KitPieceId[] = [
  'boulder_s',
  'boulder_m',
  'boulder_l',
  'bush_a',
  'bush_b',
  'fern',
  'reed',
  'log',
  'snag',
  'sapling',
  'mushrooms',
  'backdrop_tree_a',
  'backdrop_tree_b',
  'crag_a',
  'crag_b',
];

const CANOPY_PIECES: KitPieceId[] = [
  'backdrop_tree_a',
  'backdrop_tree_b',
  'crag_a',
  'crag_b',
  'snag',
];

// Pre-collected obstacle points
const STATIONS: [number, number][] = [
  [-10, -4],
  [72, -26],
  [10, -4],
  [86, -16],
  [-7, 5],
  [78, -12],
  [64, 62],
  [2.2, 4.2],
  [5.5, 8.5],
  ...WORLD_REGIONS.map((r): [number, number] => [shrineWorldPos(r).x, shrineWorldPos(r).z]),
];

const GAMEPLAY_POINTS: [number, number][] = [
  ...STATIONS,
  ...NODE_PLACEMENTS.map((n): [number, number] => [n.x, n.z]),
  ...CAMPS.flatMap((c) => c.members.map((m): [number, number] => [m.x, m.z])),
];

const WOODS_TREE_CENTRES: [number, number][] = WOODS_TREES.map(([i, j]) => [-118 + i + 0.5, -118 + j + 0.5]);

function regionRule(id: string): RegionFloraRule {
  const rule = FLORA_RULES[id];
  if (!rule || !('clusterDensity' in rule)) throw new Error(`FLORA_RULES has no region row for "${id}"`);
  return rule;
}

function poiRule(id: string): PoiFloraRule {
  const rule = FLORA_RULES[id];
  if (!rule || !('frame' in rule)) throw new Error(`FLORA_RULES has no point-of-interest row for "${id}"`);
  return rule;
}

// Clusters a region of clusterDensity 1 gets; the other regions scale from it.
const CLUSTERS_AT_DENSITY_1 = 14;
// Where a POI's frame stands: from focus + 2 out to focus + 12 units from its centre.
const FRAME_INNER = 2;
const FRAME_OUTER = 12;
// How far past the river's deep water the water-edge anchors sit, and where along z they run.
const RIVER_BANK_HALF_WIDTH = 4.6;

function createRng(seed: number) {
  let s = seed >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function inWater(x: number, z: number): boolean {
  return isDeepWater(x, z) || inBasinWater(x, z) || getTerrainHeight(x, z) < -0.34;
}

function nearWater(x: number, z: number, reach = 3): boolean {
  for (let dx = -reach; dx <= reach; dx += 0.5) {
    for (let dz = -reach; dz <= reach; dz += 0.5) {
      if (Math.hypot(dx, dz) <= reach && inWater(x + dx, z + dz)) return true;
    }
  }
  return false;
}

function inCorridor(x: number, z: number): boolean {
  const ridge = RIDGES[0];
  const n = nearestOnPolyline(ridge.points, x, z);
  return n.d <= ridge.halfWidth && ridge.gaps.some((g) => Math.hypot(n.qx - g.at[0], n.qz - g.at[1]) <= g.halfWidth);
}

function isPositionClear(x: number, z: number, pieceId: KitPieceId): boolean {
  if (Math.max(Math.abs(x), Math.abs(z)) > 130) return false;

  for (let i = 0; i < PATHS.length; i++) {
    const p = PATHS[i];
    if (nearestOnPolyline(p.points, x, z).d < p.halfWidth) return false;
  }

  for (let i = 0; i < POIS.length; i++) {
    const poi = POIS[i];
    if (Math.hypot(x - poi.x, z - poi.z) < poi.padRadius) return false;
  }

  for (let i = 0; i < SAFE_ZONES.length; i++) {
    const sz = SAFE_ZONES[i];
    if (Math.hypot(x - sz.x, z - sz.z) < 6) return false;
  }

  if (inCorridor(x, z)) return false;

  for (let i = 0; i < GAMEPLAY_POINTS.length; i++) {
    const pt = GAMEPLAY_POINTS[i];
    if (Math.hypot(x - pt[0], z - pt[1]) < 2.5) return false;
  }

  for (let i = 0; i < WOODS_TREE_CENTRES.length; i++) {
    const wt = WOODS_TREE_CENTRES[i];
    if (Math.hypot(x - wt[0], z - wt[1]) < 1.0) return false;
  }

  if (hitsCastleWall(x, z)) return false;

  const def = KIT_PIECES[pieceId];
  if (def.layer === 'canopy') {
    if (isWalkableGround(x, z)) return false;
    if (inWater(x, z)) return false;
  } else {
    if (inWater(x, z)) return false;
    if (pieceId === 'reed') {
      if (!nearWater(x, z, 3)) return false;
    }
    if (pieceId === 'fern') {
      if (regionAt(x, z)?.id !== 'woods') return false;
    }
  }

  return true;
}

interface PlacedInstance {
  id: KitPieceId;
  x: number;
  z: number;
  rot: number;
  scale: number;
  radius: number;
  critical?: boolean;
  sortKey: number;
}

class SpatialGrid {
  private cells: Map<number, PlacedInstance[]> = new Map();
  private cellSize = 4.0;

  private key(gx: number, gz: number): number {
    return (gz << 16) | (gx & 0xffff);
  }

  canPlace(x: number, z: number, radius: number): boolean {
    const minGx = Math.max(0, Math.floor((x - radius - 2.5 + 130) / this.cellSize));
    const maxGx = Math.min(64, Math.floor((x + radius + 2.5 + 130) / this.cellSize));
    const minGz = Math.max(0, Math.floor((z - radius - 2.5 + 130) / this.cellSize));
    const maxGz = Math.min(64, Math.floor((z + radius + 2.5 + 130) / this.cellSize));

    for (let gz = minGz; gz <= maxGz; gz++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        const list = this.cells.get(this.key(gx, gz));
        if (!list) continue;
        for (let i = 0; i < list.length; i++) {
          const inst = list[i];
          const reqDist = Math.max(radius, inst.radius);
          const d2 = (x - inst.x) ** 2 + (z - inst.z) ** 2;
          if (d2 < reqDist * reqDist) return false;
        }
      }
    }
    return true;
  }

  add(inst: PlacedInstance): void {
    const gx = Math.min(64, Math.max(0, Math.floor((inst.x + 130) / this.cellSize)));
    const gz = Math.min(64, Math.max(0, Math.floor((inst.z + 130) / this.cellSize)));
    const k = this.key(gx, gz);
    let list = this.cells.get(k);
    if (!list) {
      list = [];
      this.cells.set(k, list);
    }
    list.push(inst);
  }
}

function placeCluster(
  cx: number,
  cz: number,
  clusterRadius: number,
  targetCount: number,
  pieces: KitPieceId[],
  grid: SpatialGrid,
  rng: () => number,
  allInstances: PlacedInstance[],
  onMemberPlaced?: (inst: PlacedInstance, memberIdx: number) => void
): number {
  const active: PlacedInstance[] = [];
  let placedInCluster = 0;

  for (let attempt = 0; attempt < 30; attempt++) {
    const angle = rng() * Math.PI * 2;
    const r = attempt === 0 ? 0 : rng() * Math.min(2.5, clusterRadius * 0.4);
    const x = cx + r * Math.cos(angle);
    const z = cz + r * Math.sin(angle);
    const pieceId = pieces[Math.floor(rng() * pieces.length)];
    const pieceRadius = KIT_PIECES[pieceId].radius;

    if (isPositionClear(x, z, pieceId) && grid.canPlace(x, z, pieceRadius)) {
      const scale = 0.9 + 0.2 * rng();
      const rot = rng() * Math.PI * 2;
      const inst: PlacedInstance = {
        id: pieceId,
        x,
        z,
        rot,
        scale,
        radius: pieceRadius,
        sortKey: rng() * 0.1,
      };
      grid.add(inst);
      allInstances.push(inst);
      active.push(inst);
      if (onMemberPlaced) onMemberPlaced(inst, placedInCluster);
      placedInCluster++;
      break;
    }
  }

  if (placedInCluster === 0) return 0;

  const kAttempts = 30;
  while (active.length > 0 && placedInCluster < targetCount) {
    const activeIdx = Math.floor(rng() * active.length);
    const current = active[activeIdx];
    let found = false;

    for (let attempt = 0; attempt < kAttempts; attempt++) {
      const pieceId = pieces[Math.floor(rng() * pieces.length)];
      const pieceRadius = KIT_PIECES[pieceId].radius;
      const minDist = Math.max(pieceRadius, current.radius);
      const dist = minDist + rng() * minDist;
      const angle = rng() * Math.PI * 2;
      const candX = current.x + dist * Math.cos(angle);
      const candZ = current.z + dist * Math.sin(angle);

      const distFromCenter = Math.hypot(candX - cx, candZ - cz);
      if (distFromCenter > clusterRadius) continue;

      if (isPositionClear(candX, candZ, pieceId) && grid.canPlace(candX, candZ, pieceRadius)) {
        const t = Math.min(1.0, distFromCenter / clusterRadius);
        const scale = (1.0 - 0.35 * t) * (0.85 + 0.3 * rng());
        const rot = rng() * Math.PI * 2;
        const inst: PlacedInstance = {
          id: pieceId,
          x: candX,
          z: candZ,
          rot,
          scale,
          radius: pieceRadius,
          sortKey: placedInCluster / targetCount + rng() * 0.1,
        };
        grid.add(inst);
        allInstances.push(inst);
        active.push(inst);
        if (onMemberPlaced) onMemberPlaced(inst, placedInCluster);
        placedInCluster++;
        found = true;
        if (placedInCluster >= targetCount) break;
      }
    }

    if (!found) {
      active.splice(activeIdx, 1);
    }
  }

  return placedInCluster;
}

/** Design 5.6: a POI's frame, tall pieces behind it. A canopy piece that finds no unwalkable ground takes the tallest understorey of the POI's own pieces. */
function placeFrame(
  poi: PoiDef,
  rule: PoiFloraRule,
  grid: SpatialGrid,
  rng: () => number,
  allInstances: PlacedInstance[]
): void {
  const tallest = rule.pieces
    .filter((id) => KIT_PIECES[id].layer === 'understorey')
    .reduce((a, b) => (KIT_PIECES[b].maxHeight > KIT_PIECES[a].maxHeight ? b : a));

  const tryPlace = (pieceId: KitPieceId): boolean => {
    const radius = KIT_PIECES[pieceId].radius;
    const inner = rule.focus + FRAME_INNER;
    const outer = rule.focus + FRAME_OUTER;
    const candidates: [number, number][] = [];
    for (let dx = -outer; dx <= outer; dx++) {
      for (let dz = -outer; dz <= outer; dz++) {
        const d = Math.hypot(dx, dz);
        if (d < inner || d > outer) continue;
        const x = poi.x + dx;
        const z = poi.z + dz;
        if (isPositionClear(x, z, pieceId) && grid.canPlace(x, z, radius)) candidates.push([x, z]);
      }
    }
    if (candidates.length === 0) return false;
    const [x, z] = candidates[Math.floor(rng() * candidates.length)];
    const inst: PlacedInstance = { id: pieceId, x, z, rot: rng() * Math.PI * 2, scale: 1.0 + 0.2 * rng(), radius, critical: true, sortKey: 0 };
    grid.add(inst);
    allInstances.push(inst);
    return true;
  };

  for (const id of rule.frame) {
    if (!tryPlace(id) && KIT_PIECES[id].layer === 'canopy') tryPlace(tallest);
  }
}

export function buildScatter(seed: number, tier: QualityTier): ScatterResult {
  const rng = createRng(seed);
  const grid = new SpatialGrid();
  const allInstances: PlacedInstance[] = [];

  // 1. Border ring canopy clusters (16 sectors, 118 < max(|x|, |z|) <= 130)
  for (let s = 0; s < 16; s++) {
    let sectorHadInstance = false;
    for (let clusterIdx = 0; clusterIdx < 2; clusterIdx++) {
      for (let attempt = 0; attempt < 20; attempt++) {
        const u = 0.2 + 0.6 * rng();
        const angle = ((s + u) * 2 * Math.PI) / 16;
        const denom = Math.max(Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle)));
        const targetCoord = 120 + 5.5 * rng();
        const t = targetCoord / denom;
        const cx = t * Math.cos(angle);
        const cz = t * Math.sin(angle);

        if (Math.max(Math.abs(cx), Math.abs(cz)) > 118.5 && Math.max(Math.abs(cx), Math.abs(cz)) <= 128.5) {
          const placed = placeCluster(
            cx,
            cz,
            7.0,
            4 + Math.floor(rng() * 4),
            CANOPY_PIECES,
            grid,
            rng,
            allInstances,
            (inst) => {
              if (!sectorHadInstance) {
                const m = Math.max(Math.abs(inst.x), Math.abs(inst.z));
                if (m > 118 && m <= 130) {
                  const instAngle = (Math.atan2(inst.z, inst.x) + 2 * Math.PI) % (2 * Math.PI);
                  const instSector = Math.min(15, Math.floor((instAngle / (2 * Math.PI)) * 16));
                  if (instSector === s) {
                    inst.critical = true;
                    sectorHadInstance = true;
                  }
                }
              }
            }
          );
          if (placed > 0) break;
        }
      }
    }
  }

  // 2. POI clusters (7 POIs)
  for (let i = 0; i < POIS.length; i++) {
    const poi = POIS[i];
    const rule = poiRule(poi.id);
    const pieces = rule.pieces;
    let poiInstances = 0;

    placeFrame(poi, rule, grid, rng, allInstances);

    for (let c = 0; c < 2; c++) {
      for (let attempt = 0; attempt < 15; attempt++) {
        const angle = rng() * Math.PI * 2;
        const dist = poi.padRadius + 2.0 + 4.5 * rng();
        const cx = poi.x + dist * Math.cos(angle);
        const cz = poi.z + dist * Math.sin(angle);

        const placed = placeCluster(
          cx,
          cz,
          5.0,
          3 + Math.floor(rng() * 4),
          pieces,
          grid,
          rng,
          allInstances,
          (inst) => {
            if (poiInstances < 2) {
              inst.critical = true;
              poiInstances++;
            }
          }
        );
        if (placed > 0) break;
      }
    }
  }

  // 3. River reeds and water edge clusters
  // Three anchors on each basin's rim.
  const waterAnchorPoints: [number, number][] = BASINS.flatMap((b) =>
    [0, 1, 2].map((k): [number, number] => [
      b.x + b.radius * Math.cos((k * 2 * Math.PI) / 3),
      b.z + b.radius * Math.sin((k * 2 * Math.PI) / 3),
    ])
  );
  for (let z = -105; z <= 105; z += 15) {
    const rx = riverCenterX(z);
    waterAnchorPoints.push([rx - RIVER_BANK_HALF_WIDTH, z], [rx + RIVER_BANK_HALF_WIDTH, z]);
  }
  for (const [wx, wz] of waterAnchorPoints) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const angle = rng() * Math.PI * 2;
      const dist = 1.0 + 3.0 * rng();
      const cx = wx + dist * Math.cos(angle);
      const cz = wz + dist * Math.sin(angle);
      if (nearWater(cx, cz, 2.5) && !inWater(cx, cz)) {
        placeCluster(cx, cz, 4.5, 3 + Math.floor(rng() * 4), ['reed', 'bush_a', 'boulder_s'], grid, rng, allInstances);
        break;
      }
    }
  }

  // 4. Woods fern and mushroom clusters
  for (let i = 0; i < 18; i++) {
    for (let attempt = 0; attempt < 15; attempt++) {
      const cx = -95 + 65 * rng();
      const cz = -95 + 90 * rng();
      if (regionAt(cx, cz)?.id === 'woods') {
        placeCluster(
          cx,
          cz,
          6.0,
          4 + Math.floor(rng() * 5),
          ['fern', 'mushrooms', 'sapling', 'log', 'bush_a', 'bush_b', 'boulder_s'],
          grid,
          rng,
          allInstances
        );
        break;
      }
    }
  }

  // 5. Harrowback Ridge core canopy clusters (unwalkable ridge core)
  const spine = RIDGES[0].points.slice(-2);
  for (let i = 0; i < 8; i++) {
    for (let attempt = 0; attempt < 15; attempt++) {
      const t = rng();
      const cx = spine[0][0] + (spine[1][0] - spine[0][0]) * t + RIDGES[0].coreHalfWidth * (rng() - 0.5);
      const cz = spine[0][1] + (spine[1][1] - spine[0][1]) * t;
      if (!isWalkableGround(cx, cz) && !inWater(cx, cz) && !inCorridor(cx, cz)) {
        placeCluster(cx, cz, 6.0, 3 + Math.floor(rng() * 4), ['crag_a', 'crag_b', 'snag'], grid, rng, allInstances);
        break;
      }
    }
  }

  // 6. Regional understorey clusters across the 5 regions
  for (const reg of WORLD_REGIONS) {
    const rule = regionRule(reg.id);
    const pieces = rule.pieces;
    const count = Math.round(CLUSTERS_AT_DENSITY_1 * rule.clusterDensity);
    let regInstances = 0;

    for (let c = 0; c < count; c++) {
      for (let attempt = 0; attempt < 15; attempt++) {
        const cx = reg.x + reg.radius * (2 * rng() - 1);
        const cz = reg.z + reg.radius * (2 * rng() - 1);
        if (regionAt(cx, cz)?.id === reg.id) {
          placeCluster(
            cx,
            cz,
            6.5,
            3 + Math.floor(rng() * 5),
            pieces,
            grid,
            rng,
            allInstances,
            (inst) => {
              if (regInstances < 3 && regionAt(inst.x, inst.z)?.id === reg.id) {
                inst.critical = true;
                regInstances++;
              }
            }
          );
          break;
        }
      }
    }
  }

  // Ensure every piece has at least one critical instance
  for (const pieceId of ALL_PIECE_IDS) {
    const hasCrit = allInstances.some((inst) => inst.id === pieceId && inst.critical);
    if (!hasCrit) {
      const first = allInstances.find((inst) => inst.id === pieceId);
      if (first) first.critical = true;
    }
  }

  // Thinning according to tier density
  const fullTotal = allInstances.length;
  const density = GFX_TIERS[tier].scatterDensity;
  const targetCount = Math.round(density * fullTotal);

  let keptInstances: PlacedInstance[];
  if (density >= 1) {
    keptInstances = allInstances;
  } else {
    // Sort so critical instances are kept first, then lowest sortKey
    const sorted = [...allInstances].sort((a, b) => {
      const aCrit = a.critical ? 1 : 0;
      const bCrit = b.critical ? 1 : 0;
      if (aCrit !== bCrit) return bCrit - aCrit;
      return a.sortKey - b.sortKey;
    });
    keptInstances = sorted.slice(0, targetCount);
  }

  const result: ScatterResult = {
    boulder_s: [],
    boulder_m: [],
    boulder_l: [],
    bush_a: [],
    bush_b: [],
    fern: [],
    reed: [],
    log: [],
    snag: [],
    sapling: [],
    mushrooms: [],
    backdrop_tree_a: [],
    backdrop_tree_b: [],
    crag_a: [],
    crag_b: [],
  };

  for (let i = 0; i < keptInstances.length; i++) {
    const inst = keptInstances[i];
    result[inst.id].push({
      x: inst.x,
      z: inst.z,
      rot: inst.rot,
      scale: inst.scale,
    });
  }

  return result;
}
