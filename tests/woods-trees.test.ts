import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NODE_PLACEMENTS } from '../src/data/placements';
import { WORLD_REGIONS } from '../src/data/world';
import { CAMPS, PATHS, POIS, RIDGES, isInSafeZone, type RidgeDef } from '../src/data/worldMap';
import { WOODS_TREES, WOODS_TREE_CLEAR, WOODS_TREE_COUNT } from '../src/data/woodsTrees';
import { isWalkable, isWalkableGround, isWoodsTreeCell, nearestOnPolyline } from '../src/state/collision';
import { buildWalkGrid, entityGoal, findPath, type WalkGrid } from '../src/state/pathfind';
import { sanitizePose } from '../src/state/save';
import { shrineWorldPos } from '../src/state/shrines';
import { regionAt } from '../src/state/terrain';

/*
 * Design 6.11 and the G5.6 row of 8.1: woods trees that block their walk cell (CALL-V9).
 * The clearances below are the design's, written here as literals so the data file cannot loosen them.
 *
 * Frozen tests that read the real walk predicate or buildWalkGrid() where trees stand (plan A9.3).
 * TR2's accept runs each of them untouched (pathfind-budget against its regenerated golden fixture):
 *   tests/reachability.test.ts, tests/relief.test.ts, tests/world-data.test.ts, tests/pathfind.test.ts,
 *   tests/save-relocation.test.ts, tests/world-budget.test.ts, tests/pathfind-budget.test.ts,
 *   tests/monster-routes.test.ts, tests/stage2-review-fixes.test.ts, tests/world-data-combat.test.ts,
 *   tests/placements.test.ts, tests/save-hardening.test.ts, tests/phase1.test.ts,
 *   tests/monster-territory.test.ts.
 */

const ORIGIN = -118;
const SIZE = 236;
const SPACING = 3; // Chebyshev cell distance between trees, and from any cell that is not walkable ground
const PATH_EXTRA = 3; // halfWidth + bare strip verge + half a cell
const TARGET_CLEAR = 4.5; // largest stop distance (3.5) + a cell's half-diagonal
const POI_EXTRA = 3;
const CAMP_EXTRA = 2;
const LANDMARK_CLEAR = 2.5;

// The player's spawn (context.ts) and the Stage 1 save fixture's position.
const START: [number, number] = [-4, -3];
const fixturePos = JSON.parse(readFileSync(new URL('./fixtures/save-v4.json', import.meta.url), 'utf8')).playerPos as { x: number; z: number };

// worldBuild.ts: altars, forges, merchants, bank booth, slayer master; plus the five shrines (as tests/world-data.test.ts).
const STATIONS: [string, number, number][] = [
  ['altar', -10, -4], ['altar', 72, -26],
  ['forge', 10, -4], ['forge', 86, -16],
  ['merchant', -7, 5], ['merchant', 78, -12], ['merchant', 64, 62],
  ['bank', 2.2, 4.2], ['slayer master', 5.5, 8.5],
  ...WORLD_REGIONS.map((r): [string, number, number] => [`${r.id} shrine`, shrineWorldPos(r).x, shrineWorldPos(r).z])
];

// Monster spawn points at 1284a6e (tests/save-relocation.test.ts OLD_SPAWNS).
const OLD_SPAWNS: [string, number, number][] = [
  ['dark_ranger', 74, -10], ['dark_ranger', 80, -4],
  ['hill_giant', 88, -36], ['hill_giant', 96, -28], ['hill_giant', 82, -42], ['hill_giant', 95, -40],
  ['scorpion', 52, 54], ['scorpion', 60, 76], ['scorpion', 76, 58], ['scorpion', 82, 72], ['scorpion', 68, 84],
  ['moss_guardian', -64, -18], ['moss_guardian', -82, -22], ['moss_guardian', -70, -44], ['moss_guardian', -86, -38],
  ['lesser_demon', -56, 56], ['lesser_demon', -64, 78], ['lesser_demon', -82, 58], ['lesser_demon', -58, 84],
  ['elvarg_dragon', -82, 82]
];

// Woods landmark props, literals in buildBiomeLandmarks (worldBuild.ts) and in no data table.
const LANDMARKS: [string, number, number][] = [
  ['mushrooms', -66, -22], ['mushrooms', -84, -26], ['lantern', -72, -38], ['lantern', -90, -34]
];

// Stop distances recorded at R0 (plan A9.4): melee monster 2.9 (the tighter of melee and ranged),
// resource node and fishing spot 3.1, station, shrine and other interactive 3.5.
const STOP_MONSTER = 2.9;
const STOP_NODE = 3.1;
const STOP_STATION = 3.5;

const centre = (k: number) => ORIGIN + k + 0.5;
const cellOf = (x: number, z: number): [number, number] => [Math.floor(x - ORIGIN), Math.floor(z - ORIGIN)];
const key = (i: number, j: number) => i * SIZE + j;
const treeSet = () => new Set(WOODS_TREES.map(([i, j]) => key(i, j)));

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

/** Cinderstep Pass corridor, as tests/world-data.test.ts: across the ridge where the nearest crest point is in a gap. */
function inCorridor(ridge: RidgeDef, x: number, z: number): boolean {
  const n = nearestOnPolyline(ridge.points, x, z);
  return n.d <= ridge.halfWidth && ridge.gaps.some((g) => Math.hypot(n.qx - g.at[0], n.qz - g.at[1]) <= g.halfWidth);
}

/** Four-neighbour flood fill over the grid's open cells from `from` (as tests/reachability.test.ts). */
function reachable(grid: WalkGrid, from: [number, number]): Uint8Array {
  const seen = new Uint8Array(SIZE * SIZE);
  const [si, sj] = cellOf(from[0], from[1]);
  const open = (i: number, j: number) => grid.cells[j * SIZE + i] === 1;
  expect(open(si, sj), 'start cell is open').toBe(true);
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

/** Every tree's cell centre, after asserting the table's row count. */
function treeCentres(): [number, number][] {
  expect(WOODS_TREES.length).toBeGreaterThanOrEqual(100);
  expect(WOODS_TREES.length).toBeLessThanOrEqual(220);
  return WOODS_TREES.map(([i, j]) => [centre(i), centre(j)]);
}

/** Targets the player must still reach, each with its stop distance. */
function targets(): [string, number, number, number][] {
  const members = CAMPS.flatMap((c) => c.members.map((m): [string, number, number, number] => [`${c.id} ${m.type}`, m.x, m.z, STOP_MONSTER]));
  const out: [string, number, number, number][] = [
    ...STATIONS.map(([n, x, z]): [string, number, number, number] => [n, x, z, STOP_STATION]),
    ...POIS.map((p): [string, number, number, number] => [`POI ${p.id}`, p.x, p.z, STOP_STATION]),
    ...members,
    ...NODE_PLACEMENTS.map((p): [string, number, number, number] => [`${p.type} (${p.x}, ${p.z})`, p.x, p.z, STOP_NODE])
  ];
  expect(STATIONS).toHaveLength(9 + WORLD_REGIONS.length);
  expect(POIS).toHaveLength(7);
  expect(members).toHaveLength(46);
  expect(NODE_PLACEMENTS).toHaveLength(49);
  return out;
}

describe('woods trees: the table', () => {
  it('the constants are the design 6.11 values', () => {
    expect(WOODS_TREE_CLEAR).toEqual({
      spacingCells: SPACING, groundCells: SPACING, pathExtra: PATH_EXTRA, target: TARGET_CLEAR,
      poiExtra: POI_EXTRA, campExtra: CAMP_EXTRA, landmarkClear: LANDMARK_CLEAR
    });
    expect(WOODS_TREE_COUNT).toEqual({ min: 100, max: 220 });
  });

  it('the table is sorted integer cells with no duplicates and 100 to 220 rows', () => {
    expect(WOODS_TREES.length).toBeGreaterThanOrEqual(100);
    expect(WOODS_TREES.length).toBeLessThanOrEqual(220);
    for (const row of WOODS_TREES) {
      expect(row).toHaveLength(2);
      for (const v of row) {
        expect(Number.isInteger(v), `${row}`).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(SIZE);
      }
    }
    for (let k = 1; k < WOODS_TREES.length; k++) {
      const [ai, aj] = WOODS_TREES[k - 1];
      const [bi, bj] = WOODS_TREES[k];
      expect(ai < bi || (ai === bi && aj < bj), `row ${k}: [${ai}, ${aj}] before [${bi}, ${bj}]`).toBe(true);
    }
  });

  it('woodsTrees.ts contains only literals', () => {
    const src = readFileSync(new URL('../src/data/woodsTrees.ts', import.meta.url), 'utf8');
    const decl = src.indexOf('export const WOODS_TREES');
    expect(decl, 'WOODS_TREES is declared').toBeGreaterThanOrEqual(0);
    const open = src.indexOf('= [', decl);
    expect(open, 'WOODS_TREES opens an array literal').toBeGreaterThan(decl);
    expect(src.slice(open).includes('('), 'a call or grouping after the array opens').toBe(false);
  });
});

describe('woods trees: placement', () => {
  it('every tree is in woods on walkable ground', () => {
    for (const [x, z] of treeCentres()) {
      expect(regionAt(x, z)?.id, `(${x}, ${z})`).toBe('woods');
      expect(isWalkableGround(x, z), `(${x}, ${z})`).toBe(true);
    }
  });

  it('every two trees are at cell distance max(|di|, |dj|) >= 3', () => {
    treeCentres();
    for (let a = 0; a < WOODS_TREES.length; a++) {
      for (let b = a + 1; b < WOODS_TREES.length; b++) {
        const [ai, aj] = WOODS_TREES[a];
        const [bi, bj] = WOODS_TREES[b];
        expect(Math.max(Math.abs(ai - bi), Math.abs(aj - bj)), `[${ai}, ${aj}] vs [${bi}, ${bj}]`).toBeGreaterThanOrEqual(SPACING);
      }
    }
  });

  it('every tree is at cell distance >= 3 from every cell whose centre has isWalkableGround false', () => {
    treeCentres();
    for (const [ti, tj] of WOODS_TREES) {
      for (let i = ti - (SPACING - 1); i <= ti + (SPACING - 1); i++) {
        for (let j = tj - (SPACING - 1); j <= tj + (SPACING - 1); j++) {
          expect(isWalkableGround(centre(i), centre(j)), `tree [${ti}, ${tj}] near cell [${i}, ${j}]`).toBe(true);
        }
      }
    }
  });

  it('no tree is within halfWidth + 3 of any path centre line', () => {
    expect(PATHS).toHaveLength(4);
    for (const [x, z] of treeCentres()) {
      for (const p of PATHS) {
        expect(nearestOnPolyline(p.points, x, z).d, `${p.id} vs (${x}, ${z})`).toBeGreaterThanOrEqual(p.halfWidth + PATH_EXTRA);
      }
    }
  });

  it('no tree is within 4.5 of a node, fishing spot, station or shrine', () => {
    expect(STATIONS).toHaveLength(9 + WORLD_REGIONS.length);
    expect(WORLD_REGIONS).toHaveLength(5);
    expect(NODE_PLACEMENTS).toHaveLength(49);
    const points: [string, number, number][] = [
      ...STATIONS,
      ...NODE_PLACEMENTS.map((p): [string, number, number] => [p.type, p.x, p.z])
    ];
    for (const [x, z] of treeCentres()) {
      for (const [n, px, pz] of points) {
        expect(Math.hypot(x - px, z - pz), `${n} (${px}, ${pz}) vs (${x}, ${z})`).toBeGreaterThanOrEqual(TARGET_CLEAR);
      }
    }
  });

  it('no tree is within padRadius + 3 of a POI', () => {
    expect(POIS).toHaveLength(7);
    for (const [x, z] of treeCentres()) {
      for (const p of POIS) {
        expect(Math.hypot(x - p.x, z - p.z), `${p.id} vs (${x}, ${z})`).toBeGreaterThanOrEqual(p.padRadius + POI_EXTRA);
      }
    }
  });

  it('no tree is inside any camp radius + 2', () => {
    expect(CAMPS).toHaveLength(17);
    for (const [x, z] of treeCentres()) {
      for (const c of CAMPS) {
        expect(Math.hypot(x - c.x, z - c.z), `${c.id} vs (${x}, ${z})`).toBeGreaterThan(c.radius + CAMP_EXTRA);
      }
    }
  });

  it('no tree is inside a safe zone or the Cinderstep Pass corridor', () => {
    expect(RIDGES).toHaveLength(1);
    expect(RIDGES[0].gaps).toHaveLength(1);
    for (const [x, z] of treeCentres()) {
      expect(isInSafeZone(x, z), `safe zone at (${x}, ${z})`).toBe(false);
      expect(inCorridor(RIDGES[0], x, z), `pass corridor at (${x}, ${z})`).toBe(false);
    }
  });

  it('no tree is within 2.5 of a woods landmark prop', () => {
    expect(LANDMARKS).toHaveLength(4);
    for (const [x, z] of treeCentres()) {
      for (const [n, px, pz] of LANDMARKS) {
        expect(Math.hypot(x - px, z - pz), `${n} (${px}, ${pz}) vs (${x}, ${z})`).toBeGreaterThanOrEqual(LANDMARK_CLEAR);
      }
    }
  });

  it('no tree is on the cell of the start point, the save fixture\'s position or any of the 20 old spawn points', () => {
    expect(OLD_SPAWNS).toHaveLength(20);
    const trees = treeSet();
    const points: [string, number, number][] = [
      ['start', START[0], START[1]],
      ['save fixture', fixturePos.x, fixturePos.z],
      ...OLD_SPAWNS
    ];
    for (const [n, x, z] of points) {
      const [i, j] = cellOf(x, z);
      expect(trees.has(key(i, j)), `${n} (${x}, ${z})`).toBe(false);
    }
  });

  it('no tree cell contains a path point sampled each unit', () => {
    expect(PATHS).toHaveLength(4);
    const trees = treeSet();
    for (const p of PATHS) {
      for (const [x, z] of samplePolyline(p.points)) {
        const [i, j] = cellOf(x, z);
        expect(trees.has(key(i, j)), `${p.id} at (${x}, ${z})`).toBe(false);
      }
    }
  });
});

describe('woods trees: walkability', () => {
  it('isWalkable is false at the centre and four inset corners (±0.45) of every tree cell', () => {
    for (const [x, z] of treeCentres()) {
      for (const [dx, dz] of [[0, 0], [-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) {
        expect(isWalkable(x + dx, z + dz), `(${x + dx}, ${z + dz})`).toBe(false);
        expect(isWoodsTreeCell(x + dx, z + dz), `(${x + dx}, ${z + dz})`).toBe(true);
      }
    }
  });

  it('isWalkable equals isWalkableGround at every point of a 0.25 grid over the woods outside tree cells', () => {
    const trees = treeSet();
    const woods = WORLD_REGIONS.find((r) => r.id === 'woods')!;
    expect(woods.radius).toBe(45);
    let checked = 0;
    for (let x = woods.x - woods.radius; x <= woods.x + woods.radius; x += 0.25) {
      for (let z = woods.z - woods.radius; z <= woods.z + woods.radius; z += 0.25) {
        if (Math.hypot(x - woods.x, z - woods.z) >= woods.radius) continue;
        const [i, j] = cellOf(x, z);
        if (trees.has(key(i, j))) continue;
        checked++;
        if (isWalkable(x, z) !== isWalkableGround(x, z)) expect.fail(`isWalkable differs from isWalkableGround at (${x}, ${z})`);
        if (isWoodsTreeCell(x, z)) expect.fail(`isWoodsTreeCell is true off the table at (${x}, ${z})`);
      }
    }
    expect(checked).toBeGreaterThan(90_000);
  });
});

describe('woods trees: reach', () => {
  it('the cells reachable from the start with trees equal the cells reachable with isWalkableGround, minus the tree cells', () => {
    const trees = treeSet();
    expect(trees.size).toBe(treeCentres().length);
    const withTrees = reachable(buildWalkGrid(), START);
    const ground = reachable(buildWalkGrid(isWalkableGround), START);
    for (const [i, j] of WOODS_TREES) expect(ground[key(i, j)], `tree [${i}, ${j}] was reachable ground`).toBe(1);
    let diff = 0;
    for (let i = 0; i < SIZE; i++) {
      for (let j = 0; j < SIZE; j++) {
        const expected = ground[key(i, j)] === 1 && !trees.has(key(i, j));
        if ((withTrees[key(i, j)] === 1) !== expected) diff++;
      }
    }
    expect(diff, 'cells whose reachability differs from ground minus trees').toBe(0);
  });

  it('every shrine, station, POI centre, camp member home, resource node and fishing spot has a reachable walkable cell within its stop distance', () => {
    const grid = buildWalkGrid();
    const seen = reachable(grid, START);
    for (const [n, x, z, stop] of targets()) {
      let found = false;
      const [ci, cj] = cellOf(x, z);
      const r = Math.ceil(stop) + 1;
      for (let i = ci - r; i <= ci + r && !found; i++) {
        for (let j = cj - r; j <= cj + r && !found; j++) {
          if (i < 0 || j < 0 || i >= SIZE || j >= SIZE) continue;
          if (Math.hypot(centre(i) - x, centre(j) - z) > stop) continue;
          found = seen[key(i, j)] === 1 && isWalkable(centre(i), centre(j));
        }
      }
      expect(found, `${n} (${x}, ${z}) within ${stop}`).toBe(true);
    }
  });

  it('findPath(buildWalkGrid(), start, entityGoal(...)) returns a route for each of them', () => {
    const grid = buildWalkGrid();
    for (const [n, x, z, stop] of targets()) {
      const goal = entityGoal(grid, START, [x, z], stop);
      expect(goal, `${n}: a goal cell within ${stop}`).not.toBeNull();
      const route = findPath(grid, START, goal!);
      expect(route, `${n}: a route from the start to (${goal![0]}, ${goal![1]})`).not.toBeNull();
      expect(route!.length).toBeGreaterThan(0);
    }
  });
});

describe('woods trees: saves', () => {
  it('sanitizePose moves a pose at every tree cell centre to a walkable point within 1.1', () => {
    for (const [x, z] of treeCentres()) {
      const p = sanitizePose({ x, y: 0, z, yaw: 0.5 });
      expect(isWalkable(p.x, p.z), `(${x}, ${z}) moved to (${p.x}, ${p.z})`).toBe(true);
      expect(Math.hypot(p.x - x, p.z - z), `(${x}, ${z}) moved to (${p.x}, ${p.z})`).toBeLessThanOrEqual(1.1);
    }
  });
});

describe('woods trees: walk-grid budget', () => {
  it('buildWalkGrid() has 55,696 cells and blocks exactly WOODS_TREES.length more than buildWalkGrid(isWalkableGround)', () => {
    const trees = treeSet();
    expect(trees.size).toBe(treeCentres().length);
    const full = buildWalkGrid();
    const ground = buildWalkGrid(isWalkableGround);
    expect(full.cells.length).toBe(55_696);
    expect(ground.cells.length).toBe(55_696);
    const blocked = (g: WalkGrid) => g.cells.reduce((s, c) => s + (c === 0 ? 1 : 0), 0);
    expect(blocked(full) - blocked(ground)).toBe(WOODS_TREES.length);
    for (const [i, j] of WOODS_TREES) {
      expect(full.cells[j * SIZE + i], `tree [${i}, ${j}] on the full grid`).toBe(0);
      expect(ground.cells[j * SIZE + i], `tree [${i}, ${j}] on the ground grid`).toBe(1);
    }
  });

  it('buildWalkGrid() takes at most 1.5 times the ground-only build (median of 5 in the same run)', () => {
    treeCentres();
    buildWalkGrid();
    buildWalkGrid(isWalkableGround);
    const full: number[] = [];
    const ground: number[] = [];
    for (let k = 0; k < 5; k++) {
      let t = performance.now();
      buildWalkGrid(isWalkableGround);
      ground.push(performance.now() - t);
      t = performance.now();
      buildWalkGrid();
      full.push(performance.now() - t);
    }
    const median = (a: number[]) => [...a].sort((p, q) => p - q)[2];
    expect(median(full), `full ${full.map((v) => v.toFixed(1))} vs ground ${ground.map((v) => v.toFixed(1))}`).toBeLessThanOrEqual(1.5 * median(ground));
  });
});
