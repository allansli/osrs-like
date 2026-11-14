import { isWalkable } from './collision';

export interface WalkGrid {
  size: number;
  origin: number;
  cells: Uint8Array;
  walkable: (x: number, z: number) => boolean;
}

export function buildWalkGrid(walkable: (x: number, z: number) => boolean = isWalkable): WalkGrid {
  const size = 236;
  const origin = -118;
  const cells = new Uint8Array(size * size);
  for (let gz = 0; gz < size; gz++) {
    const cz = origin + gz + 0.5;
    const rowOffset = gz * size;
    for (let gx = 0; gx < size; gx++) {
      const cx = origin + gx + 0.5;
      if (walkable(cx, cz)) {
        cells[rowOffset + gx] = 1;
      }
    }
  }
  return { size, origin, cells, walkable };
}

function segmentWalkable(grid: WalkGrid, a: [number, number], b: [number, number]): boolean {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const steps = Math.max(1, Math.ceil(len / 0.25));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!grid.walkable(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false;
  }
  return true;
}

class MinHeap {
  ids: number[] = [];
  fScores: Float64Array;

  constructor(fScores: Float64Array) {
    this.fScores = fScores;
  }

  push(id: number): void {
    this.ids.push(id);
    this.up(this.ids.length - 1);
  }

  pop(): number | undefined {
    if (this.ids.length === 0) return undefined;
    const top = this.ids[0];
    const bottom = this.ids.pop()!;
    if (this.ids.length > 0) {
      this.ids[0] = bottom;
      this.down(0);
    }
    return top;
  }

  size(): number {
    return this.ids.length;
  }

  private up(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.fScores[this.ids[i]] < this.fScores[this.ids[parent]]) {
        const tmp = this.ids[i];
        this.ids[i] = this.ids[parent];
        this.ids[parent] = tmp;
        i = parent;
      } else {
        break;
      }
    }
  }

  private down(i: number): void {
    const len = this.ids.length;
    while (true) {
      let smallest = i;
      const left = (i << 1) + 1;
      const right = left + 1;
      if (left < len && this.fScores[this.ids[left]] < this.fScores[this.ids[smallest]]) {
        smallest = left;
      }
      if (right < len && this.fScores[this.ids[right]] < this.fScores[this.ids[smallest]]) {
        smallest = right;
      }
      if (smallest !== i) {
        const tmp = this.ids[i];
        this.ids[i] = this.ids[smallest];
        this.ids[smallest] = tmp;
        i = smallest;
      } else {
        break;
      }
    }
  }
}

function octileDist(dx: number, dz: number): number {
  const minD = Math.min(dx, dz);
  const maxD = Math.max(dx, dz);
  return maxD + (Math.SQRT2 - 1) * minD;
}

export function findPath(
  grid: WalkGrid,
  from: [number, number],
  to: [number, number],
  stats?: { expanded: number }
): [number, number][] | null {
  const size = grid.size;
  const origin = grid.origin;

  const startGx = Math.floor(from[0] - origin);
  const startGz = Math.floor(from[1] - origin);
  const targetGx = Math.floor(to[0] - origin);
  const targetGz = Math.floor(to[1] - origin);

  if (startGx < 0 || startGx >= size || startGz < 0 || startGz >= size) return null;
  if (targetGx < 0 || targetGx >= size || targetGz < 0 || targetGz >= size) return null;

  const totalCells = size * size;
  const startId = startGz * size + startGx;
  const targetId = targetGz * size + targetGx;

  if (grid.cells[startId] === 0 || grid.cells[targetId] === 0) return null;

  if (startId === targetId) {
    return [[origin + targetGx + 0.5, origin + targetGz + 0.5]];
  }

  const gScore = new Float64Array(totalCells);
  gScore.fill(Infinity);
  const fScore = new Float64Array(totalCells);
  fScore.fill(Infinity);
  const closed = new Uint8Array(totalCells);
  const parent = new Int32Array(totalCells);
  parent.fill(-1);

  gScore[startId] = 0;
  fScore[startId] = octileDist(Math.abs(targetGx - startGx), Math.abs(targetGz - startGz));

  const open = new MinHeap(fScore);
  open.push(startId);

  let found = false;

  const D1 = 1;
  const D2 = Math.SQRT2;

  while (open.size() > 0) {
    const currentId = open.pop()!;
    if (closed[currentId]) continue;
    closed[currentId] = 1;

    if (stats) stats.expanded++;

    if (currentId === targetId) {
      found = true;
      break;
    }

    const curGx = currentId % size;
    const curGz = (currentId / size) | 0;
    const curG = gScore[currentId];

    for (let dz = -1; dz <= 1; dz++) {
      const nz = curGz + dz;
      if (nz < 0 || nz >= size) continue;
      const nRowOffset = nz * size;

      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dz === 0) continue;
        const nx = curGx + dx;
        if (nx < 0 || nx >= size) continue;

        const neighborId = nRowOffset + nx;
        if (closed[neighborId] || grid.cells[neighborId] === 0) continue;

        // No corner cutting
        if (dx !== 0 && dz !== 0) {
          if (grid.cells[curGz * size + nx] === 0 || grid.cells[nz * size + curGx] === 0) {
            continue;
          }
        }

        const stepCost = dx !== 0 && dz !== 0 ? D2 : D1;
        const tentativeG = curG + stepCost;

        if (tentativeG < gScore[neighborId]) {
          parent[neighborId] = currentId;
          gScore[neighborId] = tentativeG;
          const h = octileDist(Math.abs(targetGx - nx), Math.abs(targetGz - nz));
          fScore[neighborId] = tentativeG + h;
          open.push(neighborId);
        }
      }
    }
  }

  if (!found) return null;

  // Reconstruct path
  const rawWaypoints: [number, number][] = [];
  let curr = targetId;
  while (curr !== -1) {
    const gx = curr % size;
    const gz = (curr / size) | 0;
    rawWaypoints.push([origin + gx + 0.5, origin + gz + 0.5]);
    curr = parent[curr];
  }
  rawWaypoints.reverse();

  // Smoothing
  const waypoints: [number, number][] = [from, ...rawWaypoints];
  let i = 1;
  while (i < waypoints.length - 1) {
    if (segmentWalkable(grid, waypoints[i - 1], waypoints[i + 1])) {
      waypoints.splice(i, 1);
    } else {
      i++;
    }
  }

  return waypoints.slice(1);
}

export function entityGoal(
  grid: WalkGrid,
  from: [number, number],
  target: [number, number],
  stopDist: number
): [number, number] | null {
  const origin = grid.origin;
  const size = grid.size;
  const minGx = Math.max(0, Math.floor(target[0] - stopDist - origin));
  const maxGx = Math.min(size - 1, Math.floor(target[0] + stopDist - origin));
  const minGz = Math.max(0, Math.floor(target[1] - stopDist - origin));
  const maxGz = Math.min(size - 1, Math.floor(target[1] + stopDist - origin));

  let bestCell: [number, number] | null = null;
  let bestDistFrom = Infinity;
  let bestDistTarget = Infinity;

  for (let gz = minGz; gz <= maxGz; gz++) {
    const cz = origin + gz + 0.5;
    const rowOffset = gz * size;
    for (let gx = minGx; gx <= maxGx; gx++) {
      if (grid.cells[rowOffset + gx] === 0) continue;
      const cx = origin + gx + 0.5;
      const dTarget = Math.hypot(cx - target[0], cz - target[1]);
      if (dTarget <= stopDist) {
        const dFrom = Math.hypot(cx - from[0], cz - from[1]);
        if (dFrom < bestDistFrom - 1e-9) {
          bestDistFrom = dFrom;
          bestDistTarget = dTarget;
          bestCell = [cx, cz];
        } else if (Math.abs(dFrom - bestDistFrom) <= 1e-9 && dTarget < bestDistTarget) {
          bestDistTarget = dTarget;
          bestCell = [cx, cz];
        }
      }
    }
  }
  return bestCell;
}

export function shouldRepath(
  goal: [number, number],
  target: [number, number],
  reachedLast: boolean
): boolean {
  if (reachedLast) return true;
  return Math.hypot(target[0] - goal[0], target[1] - goal[1]) > 2;
}
