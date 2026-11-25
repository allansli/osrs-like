import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NODE_PLACEMENTS } from '../src/data/placements';
import { WORLD_REGIONS } from '../src/data/world';
import { CAMPS, PATHS, POIS, RIDGES, isInSafeZone, type RidgeDef } from '../src/data/worldMap';
import { isWalkableGround, nearestOnPolyline } from '../src/state/collision';
import { buildWalkGrid, type WalkGrid } from '../src/state/pathfind';
import { shrineWorldPos } from '../src/state/shrines';
import { regionAt } from '../src/state/terrain';

// Seed constant for deterministic candidate ordering.
const SEED = 20261114;

const ORIGIN = -118;
const SIZE = 236;
const SPACING = 3;
const PATH_EXTRA = 3;
const TARGET_CLEAR = 4.5;
const POI_EXTRA = 3;
const CAMP_EXTRA = 2;
const LANDMARK_CLEAR = 2.5;
const MAX_TREES = 150;

const START: [number, number] = [-4, -3];
const FIXTURE_POS: [number, number] = [8, 10];

const STATIONS: [string, number, number][] = [
  ['altar', -10, -4], ['altar', 72, -26],
  ['forge', 10, -4], ['forge', 86, -16],
  ['merchant', -7, 5], ['merchant', 78, -12], ['merchant', 64, 62],
  ['bank', 2.2, 4.2], ['slayer master', 5.5, 8.5],
  ...WORLD_REGIONS.map((r): [string, number, number] => [`${r.id} shrine`, shrineWorldPos(r).x, shrineWorldPos(r).z])
];

const OLD_SPAWNS: [string, number, number][] = [
  ['dark_ranger', 74, -10], ['dark_ranger', 80, -4],
  ['hill_giant', 88, -36], ['hill_giant', 96, -28], ['hill_giant', 82, -42], ['hill_giant', 95, -40],
  ['scorpion', 52, 54], ['scorpion', 60, 76], ['scorpion', 76, 58], ['scorpion', 82, 72], ['scorpion', 68, 84],
  ['moss_guardian', -64, -18], ['moss_guardian', -82, -22], ['moss_guardian', -70, -44], ['moss_guardian', -86, -38],
  ['lesser_demon', -56, 56], ['lesser_demon', -64, 78], ['lesser_demon', -82, 58], ['lesser_demon', -58, 84],
  ['elvarg_dragon', -82, 82]
];

const LANDMARKS: [string, number, number][] = [
  ['mushrooms', -66, -22], ['mushrooms', -84, -26], ['lantern', -72, -38], ['lantern', -90, -34]
];

const centre = (k: number) => ORIGIN + k + 0.5;
const cellOf = (x: number, z: number): [number, number] => [Math.floor(x - ORIGIN), Math.floor(z - ORIGIN)];
const key = (i: number, j: number) => i * SIZE + j;

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

function inCorridor(ridge: RidgeDef, x: number, z: number): boolean {
  const n = nearestOnPolyline(ridge.points, x, z);
  return n.d <= ridge.halfWidth && ridge.gaps.some((g) => Math.hypot(n.qx - g.at[0], n.qz - g.at[1]) <= g.halfWidth);
}

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function reachable(grid: WalkGrid, from: [number, number]): Uint8Array {
  const seen = new Uint8Array(SIZE * SIZE);
  const [si, sj] = cellOf(from[0], from[1]);
  const open = (i: number, j: number) => grid.cells[j * SIZE + i] === 1;
  const stack = [key(si, sj)];
  seen[key(si, sj)] = 1;
  while (stack.length) {
    const c = stack.pop()!;
    const i = Math.floor(c / SIZE);
    const j = c % SIZE;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= SIZE || nj >= SIZE) continue;
      if (open(ni, nj) && !seen[key(ni, nj)]) {
        seen[key(ni, nj)] = 1;
        stack.push(key(ni, nj));
      }
    }
  }
  return seen;
}

function getSeededPairsCells(grid: WalkGrid): Set<number> {
  const rand = seeded(4242);
  const accepted = new Set<number>();
  function openCell(): [number, number] {
    for (;;) {
      const gx = Math.floor(rand() * grid.size);
      const gz = Math.floor(rand() * grid.size);
      if (grid.cells[gz * grid.size + gx] === 1) {
        accepted.add(gz * grid.size + gx);
        return [grid.origin + gx + 0.5, grid.origin + gz + 0.5];
      }
    }
  }
  for (let i = 0; i < 200; i++) {
    const from = openCell();
    let to = openCell();
    while (Math.hypot(to[0] - from[0], to[1] - from[1]) > 60) to = openCell();
  }
  return accepted;
}

function main(): void {
  const rand = seeded(SEED);
  const groundGrid = buildWalkGrid(isWalkableGround);
  const groundSeen = reachable(groundGrid, START);
  const goldenPairsCells = getSeededPairsCells(groundGrid);

  // Targets for 4.5 clearance: stations and resource nodes
  const targetPoints: [number, number][] = [
    ...STATIONS.map(([, x, z]): [number, number] => [x, z]),
    ...NODE_PLACEMENTS.map((p): [number, number] => [p.x, p.z])
  ];

  // Path polyline sampled cells
  const pathSampledCells = new Set<number>();
  for (const p of PATHS) {
    for (const [px, pz] of samplePolyline(p.points, 1)) {
      const [ci, cj] = cellOf(px, pz);
      pathSampledCells.add(key(ci, cj));
    }
  }

  // Blocked cells for start, fixture, and old monster spawns
  const blockedPoints: [number, number][] = [
    START,
    FIXTURE_POS,
    ...OLD_SPAWNS.map(([, x, z]): [number, number] => [x, z])
  ];
  const blockedCells = new Set<number>();
  for (const [bx, bz] of blockedPoints) {
    const [ci, cj] = cellOf(bx, bz);
    blockedCells.add(key(ci, cj));
  }

  // Candidates: every cell centre of the woods region
  const candidates: [number, number][] = [];
  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < SIZE; j++) {
      const x = centre(i);
      const z = centre(j);
      if (regionAt(x, z)?.id === 'woods') {
        candidates.push([i, j]);
      }
    }
  }

  // Fisher-Yates shuffle with seeded PRNG
  for (let k = candidates.length - 1; k > 0; k--) {
    const idx = Math.floor(rand() * (k + 1));
    const tmp = candidates[k];
    candidates[k] = candidates[idx];
    candidates[idx] = tmp;
  }

  const placed: [number, number][] = [];

  candidateLoop:
  for (const [i, j] of candidates) {
    if (placed.length >= MAX_TREES) break;

    const x = centre(i);
    const z = centre(j);

    // Must be reachable walkable ground
    if (!isWalkableGround(x, z)) continue;
    if (groundSeen[key(i, j)] !== 1) continue;

    // Do not place on cells drawn by pathfind-budget's seededPairs
    // so the 200 pairs remain identical and routes outside woods are byte-identical
    if (goldenPairsCells.has(j * SIZE + i)) continue;

    // Away from existing obstacles: cell distance >= 3 from every unwalkable ground cell
    for (let di = -(SPACING - 1); di <= SPACING - 1; di++) {
      for (let dj = -(SPACING - 1); dj <= SPACING - 1; dj++) {
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= SIZE || nj >= SIZE) continue candidateLoop;
        if (!isWalkableGround(centre(ni), centre(nj))) continue candidateLoop;
      }
    }

    // Spacing from already placed trees: cell distance >= 3
    for (const [pi, pj] of placed) {
      if (Math.max(Math.abs(i - pi), Math.abs(j - pj)) < SPACING) {
        continue candidateLoop;
      }
    }

    // Paths clearance
    for (const p of PATHS) {
      if (nearestOnPolyline(p.points, x, z).d < p.halfWidth + PATH_EXTRA) {
        continue candidateLoop;
      }
    }
    if (pathSampledCells.has(key(i, j))) continue;

    // Targets clearance (nodes, fishing spots, stations, shrines) >= 4.5
    for (const [tx, tz] of targetPoints) {
      if (Math.hypot(x - tx, z - tz) < TARGET_CLEAR) {
        continue candidateLoop;
      }
    }

    // POIs clearance >= padRadius + 3
    for (const p of POIS) {
      if (Math.hypot(x - p.x, z - p.z) < p.padRadius + POI_EXTRA) {
        continue candidateLoop;
      }
    }

    // Camps clearance > radius + 2
    for (const c of CAMPS) {
      if (Math.hypot(x - c.x, z - c.z) <= c.radius + CAMP_EXTRA) {
        continue candidateLoop;
      }
    }

    // Safe zones and Cinderstep Pass corridor
    if (isInSafeZone(x, z)) continue;
    if (inCorridor(RIDGES[0], x, z)) continue;

    // Woods landmarks clearance >= 2.5
    for (const [, lx, lz] of LANDMARKS) {
      if (Math.hypot(x - lx, z - lz) < LANDMARK_CLEAR) {
        continue candidateLoop;
      }
    }

    // Not on start point, save fixture, or old monster spawns
    if (blockedCells.has(key(i, j))) continue;

    placed.push([i, j]);
  }

  // Sort by i ascending, then j ascending
  placed.sort((a, b) => (a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]));

  console.log(`Placed ${placed.length} trees.`);

  const outPath = resolve(process.cwd(), 'src/data/woodsTrees.ts');
  const rows = placed.map(([i, j]) => `  [${i}, ${j}],`).join('\n');
  const content = `export const WOODS_TREE_CLEAR = {
  spacingCells: 3,
  groundCells: 3,
  pathExtra: 3,
  target: 4.5,
  poiExtra: 3,
  campExtra: 2,
  landmarkClear: 2.5
};

export const WOODS_TREE_COUNT = {
  min: 100,
  max: 220
};

export type WoodsTreeCell = readonly [number, number];

export const WOODS_TREES: readonly WoodsTreeCell[] = [
${rows}
];
`;

  writeFileSync(outPath, content, 'utf8');
  console.log(`Wrote ${placed.length} tree cells to ${outPath}`);
}

main();
