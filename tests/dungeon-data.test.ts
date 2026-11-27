import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/data/attacks';
import { DUNGEONS, type Dungeon } from '../src/data/dungeons';
import { ITEMS } from '../src/data/items';
import { NODE_PLACEMENTS } from '../src/data/placements';
import { MONSTER_TYPES, RESOURCE_NODES_DEF } from '../src/data/world';
import { CAMPS } from '../src/data/worldMap';
import { isWalkable } from '../src/state/collision';
import { zoneCamps, zoneWalk } from '../src/state/dungeon';
import { buildWalkGrid } from '../src/state/pathfind';
import { campRate, killPay, killSecs, openGroundBest, saleValue, WALK_SPEED } from './support/income';

// Stage 6 plan Z3 (design 7.6): rules every `DUNGEONS` row must pass. Every test reads the table, so Z4's rows and U0's
// are covered without editing this file; while the table is empty the row tests pass vacuously.

type Rect = [number, number, number, number];
const WORLD = 118; // the overworld's walk grid reaches +-118
const LEASH_MARGIN = 4; // a camp's leash circle is its radius plus 4 (tests/world-data-combat.test.ts)
const ARENA_MARGIN = 6; // nothing hurts a boss from beyond its arena radius plus 6 (Stage 4, design 6.4)
const MIN_GAP = 400; // a zone is at least this far from the overworld and from every other zone
const MAX_RATIO = 0.9; // a run pays at most this share of the best open ground (design 7.6, CALL-6.5)
const EQUIP_CHANCE_CAP = 0.05; // Stage 3's boss cap on a chance for equipment
// The model fighter's skills for each dungeon (design 7.6: 45 for the Warren, 70 for the Underkiln). A new dungeon names its own.
const FIGHTER: Record<string, number> = { saltfang_warren: 45, underkiln: 70 };
// The keys of the `Dungeon` type: there is no field for a reward paid once (design 7.3), only `loot`.
const ROW_KEYS = ['id', 'name', 'origin', 'size', 'door', 'entry', 'rooms', 'gates', 'camps', 'nodes', 'chest', 'loot', 'needs', 'solid'];

const items = ITEMS as unknown as Record<string, { type: string }>;
const types = MONSTER_TYPES as unknown as Record<string, { drops: { id?: string; chance: number }[] }>;
const nodeDefs = RESOURCE_NODES_DEF as unknown as Record<string, { item: string }>;
const has = (table: object, key: string) => Object.prototype.hasOwnProperty.call(table, key);
const allGates = (d: Dungeon) => d.gates.map((g) => g.id);
const members = (d: Dungeon) => d.camps.flatMap((c) => c.members.map((m) => ({ camp: c, ...m })));
const bossOf = (d: Dungeon) => d.camps.find((c) => c.arenaRadius !== undefined)!;
const inRect = (r: Rect, x: number, z: number) => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3];
const isCorridor = (roomId: string) => /^c\d+$/.test(roomId);

function zoneGrid(d: Dungeon, open: string[]) {
  return buildWalkGrid(zoneWalk(d, open), d.origin[0], d.origin[1], d.size);
}
/** The cells a 4-connected walk from the entry reaches. */
function reach(d: Dungeon, open: string[]): { grid: ReturnType<typeof zoneGrid>; seen: Uint8Array } {
  const grid = zoneGrid(d, open);
  const n = grid.size;
  const seen = new Uint8Array(n * n);
  const start = Math.floor(d.entry[1]) * n + Math.floor(d.entry[0]);
  const stack = [start];
  if (grid.cells[start] === 1) seen[start] = 1;
  while (stack.length > 0) {
    const i = stack.pop()!;
    const x = i % n;
    const z = (i - x) / n;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + dx;
      const Z = z + dz;
      if (X < 0 || Z < 0 || X >= n || Z >= n) continue;
      const j = Z * n + X;
      if (grid.cells[j] === 1 && seen[j] === 0) {
        seen[j] = 1;
        stack.push(j);
      }
    }
  }
  return { grid, seen };
}
const cellOf = (d: Dungeon, x: number, z: number) => Math.floor(z) * d.size + Math.floor(x);

describe('the income arithmetic (tests/support/income.ts)', () => {
  it('the best open ground for a fighter at 70 is the lesser demon, at the 178.5 GP a second design 7.6 quotes', () => {
    const best = openGroundBest(70);
    expect(best.type).toBe('lesser_demon');
    expect(best.rate).toBeGreaterThan(178);
    expect(best.rate).toBeLessThan(179);
  });

  it('the best open ground for a fighter at 45 is the moss guardian', () => {
    expect(openGroundBest(45).type).toBe('moss_guardian');
  });

  it('a camp of two pays two kills over the longer of the two cycles, and a stronger fighter kills faster', () => {
    expect(campRate(['goblin', 'goblin'], 10)).toBeGreaterThan(0);
    expect(killSecs('hill_giant', 70)).toBeLessThan(killSecs('hill_giant', 30));
    expect(killPay('goblin')).toBeCloseTo(0.9 * 24 + 0.35 * saleValue('shrimp') + 0.008 * (saleValue('iron_plate') + saleValue('iron_legs')), 6);
  });
});

describe('every dungeon row (design 7.6)', () => {
  it('the row has no field for a reward paid once: only the type\'s keys, and loot holds run, runGp and rare', () => {
    for (const d of DUNGEONS) {
      expect(Object.keys(d).filter((k) => !ROW_KEYS.includes(k)), d.id).toEqual([]);
      expect(Object.keys(d.loot).sort(), `${d.id} loot`).toEqual(['rare', 'run', 'runGp']);
    }
  });

  it('rooms and corridors lie inside the zone with a 2-cell margin and are at least 6 wide', () => {
    for (const d of DUNGEONS) {
      for (const [id, r] of Object.entries(d.rooms)) {
        expect(r[0] >= 2 && r[1] >= 2 && r[2] <= d.size - 2 && r[3] <= d.size - 2, `${d.id} ${id} inside the zone`).toBe(true);
        expect(Math.min(r[2] - r[0], r[3] - r[1]), `${d.id} ${id} width`).toBeGreaterThanOrEqual(6);
      }
    }
  });

  it('every member stands inside its camp\'s room and is a known monster type', () => {
    for (const d of DUNGEONS) {
      for (const m of members(d)) {
        expect(has(d.rooms, m.camp.room), `${d.id} ${m.camp.id} names a room`).toBe(true);
        expect(inRect(d.rooms[m.camp.room], m.x, m.z), `${d.id} ${m.camp.id} ${m.type} at (${m.x}, ${m.z}) inside ${m.camp.room}`).toBe(true);
        expect(has(MONSTER_TYPES, m.type), `${d.id} ${m.type} is a monster type`).toBe(true);
      }
    }
  });

  it('with every gate open every open cell is reachable from the entry; with them shut neither the boss nor the chest is', () => {
    for (const d of DUNGEONS) {
      const open = reach(d, allGates(d));
      const cells = open.grid.cells.reduce((s, v) => s + v, 0);
      expect(open.seen.reduce((s, v) => s + v, 0), `${d.id} open cells reached`).toBe(cells);
      expect(cells, `${d.id} has open cells`).toBeGreaterThan(0);
      const boss = bossOf(d).members[0];
      const [ox, oz] = d.origin;
      expect(open.seen[cellOf(d, boss.x, boss.z)], `${d.id} boss reachable with gates open`).toBe(1);
      expect(open.seen[cellOf(d, d.chest[0], d.chest[1])], `${d.id} chest reachable with gates open`).toBe(1);
      expect(d.gates.length, `${d.id} has a gate before the boss`).toBeGreaterThan(0);
      const shut = reach(d, []);
      expect(shut.seen[cellOf(d, boss.x, boss.z)], `${d.id} boss reachable with gates shut`).toBe(0);
      expect(shut.seen[cellOf(d, d.chest[0], d.chest[1])], `${d.id} chest reachable with gates shut`).toBe(0);
      expect(zoneWalk(d, allGates(d))(ox + boss.x, oz + boss.z), `${d.id} boss cell is open`).toBe(true);
    }
  });

  it('the boss\'s arena fits inside its room', () => {
    for (const d of DUNGEONS) {
      const camp = bossOf(d);
      expect(camp.members, `${d.id} boss camp`).toHaveLength(1);
      const boss = camp.members[0];
      expect(has(BOSSES, boss.type), `${d.id} ${boss.type} has a BOSSES row`).toBe(true);
      const r = d.rooms[camp.room];
      const fit = Math.min(boss.x - r[0], r[2] - boss.x, boss.z - r[1], r[3] - boss.z);
      expect(fit, `${d.id} arena ${camp.arenaRadius} in room`).toBeGreaterThanOrEqual(camp.arenaRadius!);
    }
  });

  it('the zone is at least 400 from the overworld\'s bound and its origin at least 400 from every other zone\'s', () => {
    for (const d of DUNGEONS) {
      const [ox, oz] = d.origin;
      const gapX = Math.max(ox - WORLD, -WORLD - (ox + d.size), 0);
      const gapZ = Math.max(oz - WORLD, -WORLD - (oz + d.size), 0);
      expect(Math.hypot(gapX, gapZ), `${d.id} from the overworld`).toBeGreaterThanOrEqual(MIN_GAP);
      for (const e of DUNGEONS) {
        if (e !== d) expect(Math.hypot(ox - e.origin[0], oz - e.origin[1]), `${d.id} from ${e.id}`).toBeGreaterThanOrEqual(MIN_GAP);
      }
    }
  });

  it('the door is on an open overworld cell, outside every camp\'s leash and every arena plus 6, and at least 3 from every node', () => {
    for (const d of DUNGEONS) {
      const { x, z } = d.door;
      expect(isWalkable(Math.floor(x) + 0.5, Math.floor(z) + 0.5), `${d.id} door on an open cell`).toBe(true);
      for (const c of CAMPS) {
        expect(Math.hypot(c.x - x, c.z - z), `${d.id} door and the leash of ${c.id}`).toBeGreaterThan(c.radius + LEASH_MARGIN);
        if (c.arenaRadius !== undefined) expect(Math.hypot(c.x - x, c.z - z), `${d.id} door and the arena of ${c.id}`).toBeGreaterThan(c.arenaRadius + ARENA_MARGIN);
      }
      for (const n of NODE_PLACEMENTS) expect(Math.hypot(n.x - x, n.z - z), `${d.id} door and the node at (${n.x}, ${n.z})`).toBeGreaterThanOrEqual(3);
    }
  });

  it('every node in a zone is of a known type, on an open cell, and gives an item', () => {
    for (const d of DUNGEONS) {
      const walk = zoneWalk(d, allGates(d));
      for (const n of d.nodes) {
        expect(has(nodeDefs, n.type), `${d.id} node type ${n.type}`).toBe(true);
        expect(has(items, nodeDefs[n.type].item), `${d.id} ${n.type} gives an item`).toBe(true);
        expect(walk(d.origin[0] + n.x, d.origin[1] + n.z), `${d.id} ${n.type} at (${n.x}, ${n.z}) on an open cell`).toBe(true);
      }
    }
  });

  it('every id of the chest\'s loot exists, every chance is in (0, 1], and equipment is at most 0.05', () => {
    for (const d of DUNGEONS) {
      for (const r of d.loot.run) {
        expect(has(items, r.id), `${d.id} run ${r.id}`).toBe(true);
        expect(r.qty[0] >= 1 && r.qty[0] <= r.qty[1], `${d.id} run ${r.id} quantity`).toBe(true);
      }
      expect(d.loot.runGp[0] >= 0 && d.loot.runGp[0] <= d.loot.runGp[1], `${d.id} coins`).toBe(true);
      for (const r of d.loot.rare) {
        expect(has(items, r.id), `${d.id} rare ${r.id}`).toBe(true);
        expect(r.chance > 0 && r.chance <= 1, `${d.id} rare ${r.id} chance ${r.chance}`).toBe(true);
        expect(r.qty, `${d.id} rare ${r.id} quantity`).toBeGreaterThanOrEqual(1);
        if (items[r.id].type === 'equip') expect(r.chance, `${d.id} ${r.id} is equipment`).toBeLessThanOrEqual(EQUIP_CHANCE_CAP);
      }
    }
  });

  it('no monster of a zone or of a Stage 6 boss row drops equipment (it comes only from a chest)', () => {
    const zoneTypes = new Set(DUNGEONS.flatMap((d) => members(d).map((m) => m.type)));
    // Ashmantle is Stage 4's and keeps its table (Stage 3's boss cap holds it, tests/economy-invariants.test.ts).
    for (const k of Object.keys(BOSSES)) if (k !== 'ashmantle') zoneTypes.add(k);
    for (const t of zoneTypes) {
      expect(has(types, t), `${t} is a monster type`).toBe(true);
      const equip = types[t].drops.filter((dr) => dr.id && items[dr.id].type === 'equip').map((dr) => dr.id);
      expect(equip, `${t} drops`).toEqual([]);
    }
  });

  it('every zone camp is aggressive and keeps its sight', () => {
    for (const d of DUNGEONS) {
      const camps = zoneCamps(d);
      expect(camps, d.id).toHaveLength(d.camps.length);
      for (const c of camps) {
        expect(c.aggressive, `${c.id} aggressive`).toBe(true);
        expect(c.keepsSight, `${c.id} keepsSight`).toBe(true);
      }
    }
  });

  it('a run pays at most 0.9 of the best open ground\'s GP a second, for the model fighter (a ratio, never a time)', () => {
    for (const d of DUNGEONS) {
      expect(has(FIGHTER, d.id), `${d.id} names its model fighter's skills in FIGHTER`).toBe(true);
      const level = FIGHTER[d.id];
      let fight = 0;
      let pay = 0;
      for (const m of members(d)) {
        fight += killSecs(m.type, level);
        pay += killPay(m.type);
      }
      // The walk through the centres of the rooms in table order, corridors left out, times 1.5 for doglegs and pulls.
      const centres = Object.entries(d.rooms).filter(([id]) => !isCorridor(id)).map(([, r]) => [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2]);
      let walk = 0;
      for (let i = 1; i < centres.length; i++) walk += Math.hypot(centres[i][0] - centres[i - 1][0], centres[i][1] - centres[i - 1][1]);
      const walkSecs = (walk * 1.5) / WALK_SPEED;
      // The chest at sale value: the fixed part at its mean, each rare entry at its chance.
      const chest =
        (d.loot.runGp[0] + d.loot.runGp[1]) / 2 +
        d.loot.run.reduce((s, r) => s + (saleValue(r.id) * (r.qty[0] + r.qty[1])) / 2, 0) +
        d.loot.rare.reduce((s, r) => s + r.chance * saleValue(r.id, r.qty), 0);
      const rate = (pay + chest) / (fight + walkSecs);
      const open = openGroundBest(level);
      const ratio = rate / open.rate;
      console.log(`${d.id}: ${rate.toFixed(1)} GP/s against ${open.type} ${open.rate.toFixed(1)} GP/s, ratio ${ratio.toFixed(2)}`);
      expect(ratio, `${d.id} against ${open.type}`).toBeLessThanOrEqual(MAX_RATIO);
    }
  });
});
