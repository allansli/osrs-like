// Plan Q5: where people stand. Reads the live tables, so it is vacuous while NPCS is empty (Q5) and covers every later slice.
import { describe, expect, it } from 'vitest';
import { DIALOGUES } from '../src/data/dialogue';
import { NPCS } from '../src/data/npcs';
import { WORLD_REGIONS, type RegionDef } from '../src/data/world';
import { CAMPS } from '../src/data/worldMap';
import { buildWalkGrid, isOpenCell } from '../src/state/pathfind';
import { shrineWorldPos } from '../src/state/shrines';

const LEASH_MARGIN = 4; // a camp's leash circle is its radius plus 4 (tests/world-data-combat.test.ts)
// Design 7.2: the leash rule holds for aggressive camps. The town's people stand among its passive camps (Bran Tolley
// at (4, 12) is inside three_kettle's circle). The arena rule holds for every camp.
const ARENA_MARGIN = 6;
const STATION_GAP = 2.5;
const PERSON_GAP = 2.5;

// worldBuild.ts: altars, forges, merchants, bank booth, slayer master; plus the five shrines (as tests/scatter.test.ts).
const STATIONS: [string, number, number][] = [
  ['altar', -10, -4], ['altar', 72, -26],
  ['forge', 10, -4], ['forge', 86, -16],
  ['merchant', -7, 5], ['merchant', 78, -12], ['merchant', 64, 62],
  ['bank', 2.2, 4.2], ['slayer master', 5.5, 8.5],
  ...(WORLD_REGIONS as RegionDef[]).map((r): [string, number, number] => [`${r.id} shrine`, shrineWorldPos(r).x, shrineWorldPos(r).z])
];

const grid = buildWalkGrid();

describe('where people stand', () => {
  it('every person has a dialogue', () => {
    const talkers = new Set(DIALOGUES.map((d) => d.npc));
    expect(NPCS.filter((n) => !talkers.has(n.id)).map((n) => n.id)).toEqual([]);
  });

  it('stands on an open cell of the walk grid', () => {
    expect(NPCS.filter((n) => !isOpenCell(grid, n.x, n.z)).map((n) => `${n.id} (${n.x}, ${n.z})`)).toEqual([]);
  });

  it('stands outside every aggressive camp leash circle and every boss arena plus 6', () => {
    const bad: string[] = [];
    for (const n of NPCS) {
      for (const c of CAMPS) {
        const d = Math.hypot(n.x - c.x, n.z - c.z);
        if (c.aggressive && d <= c.radius + LEASH_MARGIN) bad.push(`${n.id} is ${d.toFixed(1)} from ${c.id}, leash ${c.radius + LEASH_MARGIN}`);
        if (c.arenaRadius !== undefined && d <= c.arenaRadius + ARENA_MARGIN) bad.push(`${n.id} is ${d.toFixed(1)} from the arena of ${c.id}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('stands at least 2.5 from every station and every other person', () => {
    const bad: string[] = [];
    for (const n of NPCS) {
      for (const [name, x, z] of STATIONS) {
        if (Math.hypot(n.x - x, n.z - z) < STATION_GAP) bad.push(`${n.id} is too close to the ${name}`);
      }
    }
    for (let i = 0; i < NPCS.length; i++) {
      for (let j = i + 1; j < NPCS.length; j++) {
        if (Math.hypot(NPCS[i].x - NPCS[j].x, NPCS[i].z - NPCS[j].z) < PERSON_GAP) bad.push(`${NPCS[i].id} and ${NPCS[j].id} stand too close`);
      }
    }
    expect(bad).toEqual([]);
  });
});
