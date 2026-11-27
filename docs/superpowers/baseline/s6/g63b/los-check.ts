// G-6.3b: reads the traces capture-job.mjs wrote and checks them against the game's own walk grids and rules.
// For every recorder row it computes `segmentWalkable(grid, monster, hero)` (the test of L2's `lineClear`), finds each
// shot (a wind-up that starts, or the attack cooldown jumping up while the monster is in `attack`) and reports whether
// the line was clear on that row or on the row before (the step that fired ran between the two). It also states, from
// the tables, where each watched monster can stand (inside its camp's leash, radius + 4) with a clear line within its
// reach of the hero's spot, and why no dark wizard can reach the castle wall.
// Usage, from the worktree root, behind the memory cap:
//   scripts/capped.sh bash -c 'node_modules/.bin/esbuild docs/superpowers/baseline/s6/g63b/los-check.ts --bundle \
//     --platform=node --format=esm --log-level=warning --outfile=/tmp/los-check.mjs && node /tmp/los-check.mjs <trace dir>'
import { existsSync, readFileSync } from 'node:fs';
import { buildWalkGrid, segmentWalkable, type WalkGrid } from '../../../../../src/state/pathfind';
import { zoneWalk, zoneCamps } from '../../../../../src/state/dungeon';
import { castleBlockers } from '../../../../../src/state/collision';
import { CAVES } from '../../../../../src/data/dungeons';
import { CAMPS } from '../../../../../src/data/worldMap';
import { MONSTER_TYPES } from '../../../../../src/data/world';
import { attackRange } from '../../../../../src/state/monsterAi';
import type { CampDef } from '../../../../../src/data/worldMap';

type Row = [number, number, number, number, string, number, string | null, number, number, number];
const dir = process.argv[2];
if (!dir) throw new Error('usage: node los-check.mjs <trace dir>');

const cave = CAVES[0];
const caveGrid = buildWalkGrid(zoneWalk(cave, []), cave.origin[0], cave.origin[1], cave.size);
const overGrid = buildWalkGrid();
const reach = (type: string) => attackRange({ style: MONSTER_TYPES[type].style } as Parameters<typeof attackRange>[0]);
const r2 = (v: number) => +v.toFixed(2);

// Cells a monster of `camp` can stand on (inside radius + 4 of the camp centre) with a clear line to `hero` within `reach`.
function shotCells(grid: WalkGrid, camp: CampDef, hero: [number, number], range: number): { n: number; nearest: [number, number] | null } {
  let n = 0, best: [number, number] | null = null, bestD = Infinity;
  const lim = camp.radius + 4;
  for (let x = Math.floor(camp.x - lim); x <= camp.x + lim; x++) for (let z = Math.floor(camp.z - lim); z <= camp.z + lim; z++) {
    const p: [number, number] = [x + 0.5, z + 0.5];
    if (Math.hypot(p[0] - camp.x, p[1] - camp.z) > lim || !grid.walkable(p[0], p[1])) continue;
    if (Math.hypot(p[0] - hero[0], p[1] - hero[1]) > range || !segmentWalkable(grid, p, hero)) continue;
    n++;
    const d = Math.hypot(p[0] - camp.x, p[1] - camp.z);
    if (d < bestD) { bestD = d; best = p; }
  }
  return { n, nearest: best };
}

function scene(key: string, grid: WalkGrid, camps: CampDef[], heroSpot: [number, number]): void {
  if (!existsSync(`${dir}/trace-${key}.json`)) { console.log(`\n== ${key}: no trace`); return; }
  const rec = JSON.parse(readFileSync(`${dir}/trace-${key}.json`, 'utf8')) as { types: string[]; camps: string[]; rows: Row[] };
  console.log(`\n== ${key}: ${rec.rows.length} rows, ${Math.max(...rec.rows.map((r) => r[0]))} ms`);
  rec.types.forEach((type, i) => {
    const rows = rec.rows.filter((r) => r[1] === i);
    const clear = (r: Row) => segmentWalkable(grid, [r[2], r[3]], [r[7], r[8]]);
    const dist = (r: Row) => Math.hypot(r[2] - r[7], r[3] - r[8]);
    const range = reach(type);
    const melee = range < 5;
    const shots: string[] = [];
    let blockedShots = 0, blockedInRange = 0, firstShot: number | null = null;
    for (let k = 1; k < rows.length; k++) {
      const r = rows[k], p = rows[k - 1];
      if (!clear(r) && dist(r) <= range && r[4] !== 'idle' && r[4] !== 'return' && r[4] !== 'dead' && r[4] !== 'dying') blockedInRange++;
      const isShot = (r[6] && !p[6]) || (r[4] === 'attack' && r[5] > p[5] + 0.2);
      if (!isShot) continue;
      const ok = clear(r) || clear(p);
      if (!ok && !melee) blockedShots++;
      if (firstShot === null) firstShot = r[0];
      if (shots.length < 6) shots.push(`${r[0]} ms ${r[6] ? 'windup ' + r[6] : 'attack'} at (${r2(r[2])}, ${r2(r[3])}), ${r2(dist(r))} from the hero, line ${ok ? 'clear' : 'BLOCKED'}`);
    }
    const nShots = rows.filter((r, k) => k > 0 && ((r[6] && !rows[k - 1][6]) || (r[4] === 'attack' && r[5] > rows[k - 1][5] + 0.2))).length;
    const states = [...new Set(rows.map((r) => r[4]))].join(', ');
    const camp = camps.find((c) => c.id === rec.camps[i]);
    console.log(`${type} (${rec.camps[i]}, reach ${range}${melee ? ', melee: no line needed' : ''}): states ${states}`);
    console.log(`  shots ${nShots}, the first at ${firstShot ?? 'none'} ms; ranged shots with the line blocked on both rows: ${melee ? 'n/a' : blockedShots}`);
    console.log(`  rows in chase or attack within reach with the line blocked (held fire): ${blockedInRange}`);
    for (const s of shots) console.log('  ' + s);
    const firstClear = rows.find((r) => clear(r) && dist(r) <= range && r[4] !== 'idle');
    if (firstClear) console.log(`  first row in reach with a clear line: ${firstClear[0]} ms at (${r2(firstClear[2])}, ${r2(firstClear[3])})`);
    const end = rows[rows.length - 1];
    console.log(`  last row: ${end[0]} ms, ${end[4]} at (${r2(end[2])}, ${r2(end[3])}); hero at (${r2(end[7])}, ${r2(end[8])}), hp ${end[9]}`);
    if (camp && !melee) {
      const c = shotCells(grid, camp, heroSpot, range);
      console.log(`  cells inside the leash (camp radius ${camp.radius} + 4) with a clear line within ${range} of the hero's spot: ${c.n}${c.nearest ? `, nearest the camp centre (${c.nearest})` : ''}`);
    }
  });
}

const caveCamps = zoneCamps(cave);
scene('a_pillar', caveGrid, caveCamps, [1066.8, 633.4]);
scene('b_corner', caveGrid, caveCamps, [1057, 630.5]);
scene('c_corridor', caveGrid, caveCamps, [1051.5, 631.5]);
scene('d_river', overGrid, CAMPS, [39.6, 19]);

// The castle wall and the dark wizards: how near the wizards' leash disk comes to the castle's blockers.
const wiz = CAMPS.find((c) => c.id === 'wizards')!;
const lim = wiz.radius + 4;
let nearest = Infinity;
for (const b of castleBlockers()) {
  const dx = Math.max(b.minX - wiz.x, 0, wiz.x - b.maxX), dz = Math.max(b.minZ - wiz.z, 0, wiz.z - b.maxZ);
  nearest = Math.min(nearest, Math.hypot(dx, dz) - lim);
}
const wizReach = reach('dark_wizard');
console.log(`\n== castle: the wizards' camp centre (${r2(wiz.x)}, ${r2(wiz.z)}), radius ${wiz.radius}, leash ${lim}; the nearest castle blocker is ${r2(nearest)} beyond the leash disk, against the dark wizard's reach of ${wizReach}`);
console.log(`dark wizard camps in CAMPS: ${CAMPS.filter((c) => c.members.some((m) => m.type === 'dark_wizard')).map((c) => c.id).join(', ')}`);
