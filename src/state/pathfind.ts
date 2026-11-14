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

function segmentWalkable(grid: WalkGrid, a: [number, number], b: [number, number], step = 0.25): boolean {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const steps = Math.max(1, Math.ceil(len / step));
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

/** The open cell centre nearest (x, z) within 4 cells that `accept` allows, or null. */
export function nearestOpenCell(
  grid: WalkGrid,
  x: number,
  z: number,
  accept: (c: [number, number]) => boolean = () => true
): [number, number] | null {
  const cgx = Math.floor(x - grid.origin);
  const cgz = Math.floor(z - grid.origin);
  let best: [number, number] | null = null;
  let bestD = Infinity;
  for (let gz = Math.max(0, cgz - 4); gz <= Math.min(grid.size - 1, cgz + 4); gz++) {
    for (let gx = Math.max(0, cgx - 4); gx <= Math.min(grid.size - 1, cgx + 4); gx++) {
      if (grid.cells[gz * grid.size + gx] === 0) continue;
      const c: [number, number] = [grid.origin + gx + 0.5, grid.origin + gz + 0.5];
      const d = Math.hypot(c[0] - x, c[1] - z);
      if (d < bestD && accept(c)) { bestD = d; best = c; }
    }
  }
  return best;
}

/**
 * Ground walk: findPath, except that a walkable point whose cell centre is blocked (bridge edge,
 * shoreline, wall face) routes to the nearest open cell that reaches it straight, then to the point.
 */
export function findWalkPath(grid: WalkGrid, from: [number, number], to: [number, number]): [number, number][] | null {
  const gx = Math.floor(to[0] - grid.origin);
  const gz = Math.floor(to[1] - grid.origin);
  const inGrid = gx >= 0 && gx < grid.size && gz >= 0 && gz < grid.size;
  if (!inGrid || grid.cells[gz * grid.size + gx] === 1 || !grid.walkable(to[0], to[1])) return findPath(grid, from, to);
  const near = nearestOpenCell(grid, to[0], to[1], (c) => segmentWalkable(grid, c, to));
  if (!near) return null;
  const path = findPath(grid, from, near);
  return path ? [...path, to] : null;
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

/** The planned walk is used up: no waypoint left, or the hero stands on the last one. */
export function walkSpent(waypoints: [number, number][], pos: [number, number]): boolean {
  if (waypoints.length === 0) return true;
  return waypoints.length === 1 && Math.hypot(waypoints[0][0] - pos[0], waypoints[0][1] - pos[1]) <= 0.45;
}

/**
 * Where the hero steers on a walk to an entity (design 6.7); drops the waypoints it has reached.
 * A monster walk aims at the monster on the last segment while the straight line to it is walkable.
 * Otherwise, and always for a resource or station, the goal cell is kept and walked onto: it is
 * within stop distance, so the hero never runs in place against the water or wall in between.
 */
export function entityAim(
  grid: WalkGrid,
  waypoints: [number, number][],
  pos: [number, number],
  target: [number, number],
  monster: boolean
): [number, number] {
  const keepGoal = monster && segmentWalkable(grid, pos, target) ? 0 : 1;
  while (waypoints.length > keepGoal && Math.hypot(waypoints[0][0] - pos[0], waypoints[0][1] - pos[1]) <= 0.45) {
    waypoints.shift();
  }
  return waypoints.length > 1 - keepGoal ? waypoints[0] : target;
}

/** Seconds without progress after which an entity walk takes an escape cell (escapeStall). */
export const STALL_SEC = 0.3;

/** Time the hero has stood still on a walk: grows while the position repeats, else resets. */
export function stallTime(t: number, prev: [number, number] | null, pos: [number, number], dt: number): number {
  return prev !== null && prev[0] === pos[0] && prev[1] === pos[1] ? t + dt : 0;
}

/**
 * Unsticks a walk whose straight leg clips a corner finer than the path smoothing samples: the next
 * waypoint becomes the nearest open cell centre, beyond arrival distance, that the hero reaches in a
 * straight line checked at a fine step.
 */
export function escapeStall(grid: WalkGrid, waypoints: [number, number][], pos: [number, number]): void {
  const cell = nearestOpenCell(grid, pos[0], pos[1], (c) => Math.hypot(c[0] - pos[0], c[1] - pos[1]) > 0.45 && segmentWalkable(grid, pos, c, 0.02));
  if (cell) waypoints.unshift(cell);
}
