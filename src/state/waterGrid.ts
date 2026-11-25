import { riverCenterX } from './collision';
import { getTerrainHeight, TERRAIN_SIZE } from './terrain';

/** Water plane level in world units. */
export const WATER_LEVEL = -0.34;

export interface WaterGrid {
  positions: number[];
  depth: number[];
  flow: number[];
  index: number[];
  cells: number;
}

/**
 * Builds the water grid geometry over the terrain square.
 * Keeps cells where any corner has terrain height below WATER_LEVEL, plus their 8 neighbours.
 * Per vertex: depth is WATER_LEVEL - terrain height clamped at 0,
 * and flow is the unit tangent of riverCenterX within 8 units of the river, zero elsewhere.
 */
export function buildWaterGrid(): WaterGrid {
  const half = TERRAIN_SIZE / 2;
  const minCoord = -half;
  const maxCoord = half - 1;

  const directlyWet = new Set<string>();
  for (let x = minCoord; x <= maxCoord; x++) {
    for (let z = minCoord; z <= maxCoord; z++) {
      if (
        getTerrainHeight(x, z) < WATER_LEVEL ||
        getTerrainHeight(x + 1, z) < WATER_LEVEL ||
        getTerrainHeight(x, z + 1) < WATER_LEVEL ||
        getTerrainHeight(x + 1, z + 1) < WATER_LEVEL
      ) {
        directlyWet.add(`${x},${z}`);
      }
    }
  }

  const keptCells = new Set<string>();
  for (const key of directlyWet) {
    const comma = key.indexOf(',');
    const cx = Number(key.slice(0, comma));
    const cz = Number(key.slice(comma + 1));
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (nx >= minCoord && nx <= maxCoord && nz >= minCoord && nz <= maxCoord) {
          keptCells.add(`${nx},${nz}`);
        }
      }
    }
  }

  const sortedCells: [number, number][] = [];
  for (const key of keptCells) {
    const comma = key.indexOf(',');
    sortedCells.push([Number(key.slice(0, comma)), Number(key.slice(comma + 1))]);
  }
  sortedCells.sort((a, b) => (a[1] !== b[1] ? a[1] - b[1] : a[0] - b[0]));

  const vertexMap = new Map<string, number>();
  const positions: number[] = [];
  const depth: number[] = [];
  const flow: number[] = [];
  const index: number[] = [];

  function getOrCreateVertex(x: number, z: number): number {
    const key = `${x},${z}`;
    const existing = vertexMap.get(key);
    if (existing !== undefined) return existing;

    const id = positions.length / 3;
    vertexMap.set(key, id);
    positions.push(x, WATER_LEVEL, z);
    depth.push(Math.max(0, WATER_LEVEL - getTerrainHeight(x, z)));

    const distToRiver = Math.abs(x - riverCenterX(z));
    if (distToRiver <= 8) {
      const dx = (riverCenterX(z + 0.01) - riverCenterX(z - 0.01)) / 0.02;
      const tl = Math.hypot(dx, 1);
      flow.push(dx / tl, 1 / tl);
    } else {
      flow.push(0, 0);
    }
    return id;
  }

  for (const [cx, cz] of sortedCells) {
    const c0 = getOrCreateVertex(cx, cz);
    const c1 = getOrCreateVertex(cx + 1, cz);
    const c2 = getOrCreateVertex(cx, cz + 1);
    const c3 = getOrCreateVertex(cx + 1, cz + 1);
    index.push(c0, c2, c1, c1, c2, c3);
  }

  return {
    positions,
    depth,
    flow,
    index,
    cells: sortedCells.length
  };
}
