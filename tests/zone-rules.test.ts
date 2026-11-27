// Plan Z1: the rules of a zone (design 7.6, 7.3), written before they exist. Red until Z2 adds src/state/dungeon.ts,
// src/data/dungeons.ts, the zone parameters of buildWalkGrid, moveWithCollision and stepMonster, the `respawn` option
// of createMonsterLogic and the terrain floor for x of 400 or more. Names and signatures are the plan's; what the plan
// leaves open is assumed once, in tests/support/dungeonFixture.ts.
import { describe, expect, it, vi } from 'vitest';
import { MONSTER_TYPES } from '../src/data/world';
import { ITEMS } from '../src/data/items';
import type { CampDef } from '../src/data/worldMap';
import { DUNGEONS } from '../src/data/dungeons';
import { combatLevel } from '../src/state/adventure';
import { isWalkable, moveWithCollision } from '../src/state/collision';
import { evalCond } from '../src/state/dialogue';
import { canEnter, openChest, runStep, savedPose, zoneCamps, zoneSafe, zoneWalk, type Dungeon } from '../src/state/dungeon';
import { BACKPACK_SIZE, createNewGameState } from '../src/state/gameState';
import { DEAD_SECS, DYING_SECS, createMonsterLogic, onPlayerHit, stepMonster, type MonsterLogic } from '../src/state/monsterAi';
import { buildWalkGrid, findPath } from '../src/state/pathfind';
import { STAT_KEYS, bump, stat } from '../src/state/progress';
import { addItem, canAddItem, countItem } from '../src/state/inventory';
import { advanceStory, finishQuest, startQuest } from '../src/state/story';
import { getTerrainHeight } from '../src/state/terrain';
import type { GameState } from '../src/state/types';
import { FX_DUNGEON, bossCampId, clearedRun, freshRun, killCamp, open, seeded, useRules } from './support/dungeonFixture';
import { raiseCombat, resetCombat } from './support/satisfy';

useRules({ openChest, runStep });

vi.mock('../src/data/dungeons', async (orig) => (await import('./support/dungeonFixture')).withZoneFixture('DUNGEONS', await orig()));
vi.mock('../src/data/story', async (orig) => (await import('./support/dungeonFixture')).withZoneFixture('STORY_QUESTS', await orig()));

const DEF = FX_DUNGEON;
const [OX, OZ] = DEF.origin;
/** A local point of the fixture as a world point. */
const w = (x: number, z: number): [number, number] => [OX + x, OZ + z];
const walkOf = (open: string[] = []) => zoneWalk(DEF, open);
const grids = new Map<string, ReturnType<typeof buildWalkGrid>>();
/** Built once per set of open gates: a zone grid is 4,096 walk tests. */
const zoneGrid = (open: string[] = []) => {
  const key = open.join(',');
  if (!grids.has(key)) grids.set(key, buildWalkGrid(zoneWalk(DEF, open), OX, OZ, DEF.size));
  return grids.get(key)!;
};
const fresh = (): GameState => createNewGameState();
const always = (v: number) => () => v;

describe('buildWalkGrid', () => {
  it('with no arguments is today\'s grid, cell for cell: size 236, origin -118 on both axes', () => {
    const g = buildWalkGrid();
    expect(g.size).toBe(236);
    expect(g.origin).toBe(-118);
    expect((g as { originZ?: number }).originZ).toBe(-118);
    expect(g.cells.length).toBe(236 * 236);
    let wrong = 0;
    for (let gz = 0; gz < 236; gz++) {
      for (let gx = 0; gx < 236; gx++) {
        if (g.cells[gz * 236 + gx] !== (isWalkable(-118 + gx + 0.5, -118 + gz + 0.5) ? 1 : 0)) wrong++;
      }
    }
    expect(wrong, 'cells that differ from isWalkable at the cell centre').toBe(0);
  });

  it('with (walk, 1000, -200, 96) has that origin and size, reads the walk test at world cell centres, and findPath routes on it', () => {
    const open = (x: number, z: number) => x >= 1010 && x <= 1070 && z >= -190 && z <= -150 && !(x > 1030 && x < 1040 && z > -175);
    const g = buildWalkGrid(open, 1000, -200, 96);
    expect(g.size).toBe(96);
    expect(g.origin).toBe(1000);
    expect((g as { originZ?: number }).originZ).toBe(-200);
    expect(g.cells.length).toBe(96 * 96);
    let wrong = 0;
    for (let gz = 0; gz < 96; gz++) {
      for (let gx = 0; gx < 96; gx++) {
        if (g.cells[gz * 96 + gx] !== (open(1000 + gx + 0.5, -200 + gz + 0.5) ? 1 : 0)) wrong++;
      }
    }
    expect(wrong).toBe(0);
    // A wall of two cells stands between the ends, with a gap at the top (z -190 to -175 is open): the route goes round it.
    const route = findPath(g, [1012.5, -170.5], [1068.5, -170.5]);
    expect(route, 'a route on the zone grid').not.toBeNull();
    const last = route![route!.length - 1];
    expect(Math.hypot(last[0] - 1068.5, last[1] + 170.5)).toBeLessThan(1);
    for (const [x, z] of route!) expect(open(x, z), `waypoint ${x}, ${z}`).toBe(true);
    // The z axis reads originZ: a goal in the shifted rows is reached, and a start off the grid has no route.
    expect(findPath(g, [1012.5, -170.5], [1012.5, -189.5])).not.toBeNull();
    expect(findPath(g, [1012.5, 5.5], [1068.5, -170.5])).toBeNull();
  });
});

describe('zoneWalk', () => {
  it('is true inside a room, false outside every room, in the overworld and on the zone\'s empty cells', () => {
    for (const [name, rect] of Object.entries(DEF.rooms)) {
      if (name === 'c2') continue;
      const [x0, z0, x1, z1] = rect;
      expect(walkOf()(...w((x0 + x1) / 2, (z0 + z1) / 2)), `middle of ${name}`).toBe(true);
    }
    expect(walkOf()(...w(12, 28))).toBe(true);
    expect(walkOf()(...w(50, 10))).toBe(false);
    expect(walkOf()(...w(0, 0))).toBe(false);
    expect(walkOf()(...w(30, 44.5))).toBe(false);
    expect(walkOf()(0, 0)).toBe(false);
    expect(walkOf()(OX - 1, OZ + 28)).toBe(false);
  });

  it('is false inside a shut gate and true inside an open one; opening it changes no other cell', () => {
    const [gx0, gz0, gx1, gz1] = DEF.gates[0].rect;
    const inside = w((gx0 + gx1) / 2, (gz0 + gz1) / 2);
    expect(walkOf([])(...inside)).toBe(false);
    expect(walkOf(['lair_gate'])(...inside)).toBe(true);
    let changed = 0;
    for (let gz = 0; gz < DEF.size; gz++) {
      for (let gx = 0; gx < DEF.size; gx++) {
        const x = OX + gx + 0.5;
        const z = OZ + gz + 0.5;
        const inGate = gx + 0.5 > gx0 && gx + 0.5 < gx1 && gz + 0.5 > gz0 && gz + 0.5 < gz1;
        if (walkOf([])(x, z) !== walkOf(['lair_gate'])(x, z) && !inGate) changed++;
      }
    }
    expect(changed).toBe(0);
  });

  it('on the zone grid: the hall and the chest are reachable from the entry, and the lair only with the gate open', () => {
    const shut = zoneGrid([]);
    const opened = zoneGrid(['lair_gate']);
    const from = w(12.5, 28.5);
    const lair = w(36.5, 54.5);
    expect(findPath(shut, from, w(36.5, 20.5)), 'the hall from the entry').not.toBeNull();
    expect(findPath(shut, from, lair), 'the lair behind a shut gate').toBeNull();
    expect(findPath(opened, from, lair), 'the lair behind an open gate').not.toBeNull();
    expect(findPath(opened, from, w(DEF.chest[0] + 0.5, DEF.chest[1] + 0.5))).not.toBeNull();
  });
});

describe('moveWithCollision', () => {
  it('with a walk test moves at x of 1020 and does not clamp', () => {
    const r = moveWithCollision(1015, -172, 5, 0, () => true);
    expect(r).toEqual({ x: 1020, z: -172 });
    expect(moveWithCollision(1015, -172, 0, 8, () => true)).toEqual({ x: 1015, z: -164 });
    // The walk test still blocks: out of c1 into the wall north of it, it slides along x instead.
    const walk = walkOf();
    const stepped = moveWithCollision(...w(22, 28), 1.5, -5, walk);
    expect(walk(stepped.x, stepped.z)).toBe(true);
    expect(stepped.x).toBeCloseTo(OX + 23.5, 10);
    expect(stepped.z).toBeCloseTo(OZ + 28, 10);
  });

  it('without one behaves as today: the step is clamped to 118 on both axes', () => {
    const from: [number, number] = [-4, -3];
    expect(isWalkable(...from)).toBe(true);
    const r = moveWithCollision(from[0], from[1], 1000, 1000);
    expect(Math.abs(r.x)).toBeLessThanOrEqual(118);
    expect(Math.abs(r.z)).toBeLessThanOrEqual(118);
    const small = moveWithCollision(-4, -3, 0.5, 0.5);
    expect(isWalkable(small.x, small.z)).toBe(true);
  });
});

describe('getTerrainHeight', () => {
  it('is 0 in a zone and at x of 400 or more (the golden for x below 400 is Stage 2\'s own test, unedited)', () => {
    for (const [x, z] of [[1000, 0], [1000, -200], [1020, 200], [1050, 230], [400, 0], [400, -37.5], [900, 77]]) {
      expect(getTerrainHeight(x, z), `height at ${x}, ${z}`).toBe(0);
    }
  });
});

type World = Parameters<typeof stepMonster>[1];
const world = (px: number, pz: number, camps: CampDef[], extra: Partial<World> = {}): World => {
  const base = { playerX: px, playerZ: pz, playerDown: false, dt: 0.05, rand: always(0.5), playerCombat: 3, playerSafe: false, camps, grid: zoneGrid() };
  return { ...base, ...extra } as World;
};
const hallCamp = () => zoneCamps(DEF).find((c) => c.id === `${DEF.id}:hall`)!;

describe('stepMonster on a zone grid (critique C2)', () => {
  it('a monster at x 1020 and beyond chases, returns and wanders, and stays inside the zone\'s rooms', () => {
    const camps = zoneCamps(DEF);
    const walk = walkOf();
    const inZone = (m: MonsterLogic, what: string) => {
      expect(m.x, `${what}: x is not put back at 118`).toBeGreaterThan(900);
      expect(walk(m.x, m.z), `${what}: at ${m.x.toFixed(2)}, ${m.z.toFixed(2)}`).toBe(true);
    };
    const [hx, hz] = w(30, 20);
    const m = createMonsterLogic('goblin', hx, hz, { campId: `${DEF.id}:hall`, wander: 4.5 });

    // Chases: the hero stands inside the camp and the sight radius.
    const hero = w(34, 26);
    const seen = new Set<string>();
    const events: string[] = [];
    for (let i = 0; i < 400; i++) {
      for (const e of stepMonster(m, world(hero[0], hero[1], camps))) events.push(e.kind);
      seen.add(m.state);
      inZone(m, 'chase');
    }
    expect(events).toContain('aggro');
    expect(seen.has('chase') || seen.has('attack'), 'it came for the hero').toBe(true);
    expect(Math.hypot(m.x - hero[0], m.z - hero[1])).toBeLessThan(4);

    // Returns: the hero goes into the entry room's safe zone; the monster walks home on the zone grid.
    const away = w(12, 28);
    let reset = false;
    for (let i = 0; i < 1200 && m.state !== 'idle'; i++) {
      for (const e of stepMonster(m, world(away[0], away[1], camps, { playerSafe: true }))) if (e.kind === 'reset') reset = true;
      seen.add(m.state);
      inZone(m, 'return');
    }
    expect(seen.has('return')).toBe(true);
    expect(reset, 'a reset event').toBe(true);
    expect(m.state).toBe('idle');
    expect(Math.hypot(m.x - hx, m.z - hz)).toBeLessThanOrEqual(1.01);

    // Wanders: beside a wall, so that some wander targets fall outside the room; it never leaves the rooms.
    const [wx, wz] = w(25, 15);
    const w1 = createMonsterLogic('goblin', wx, wz, { campId: `${DEF.id}:hall`, wander: 4.5 });
    const rand = seeded(7);
    let far = 0;
    for (let i = 0; i < 6000; i++) {
      stepMonster(w1, world(away[0], away[1], camps, { playerSafe: true, rand }));
      inZone(w1, 'wander');
      far = Math.max(far, Math.hypot(w1.x - wx, w1.z - wz));
    }
    expect(far, 'it wandered').toBeGreaterThan(1);
    expect(far).toBeLessThanOrEqual(4.5 + 0.5);
  });
});

describe('createMonsterLogic with respawn: false (critique H3)', () => {
  const kill = (m: MonsterLogic) => {
    expect(onPlayerHit(m, m.maxHp).applied).toBe(true);
    expect(m.state).toBe('dying');
  };
  const run = (m: MonsterLogic, secs: number) => {
    const states = new Set<string>();
    let respawned = 0;
    for (let t = 0; t < secs; t += 0.1) {
      for (const e of stepMonster(m, { playerX: 0, playerZ: 0, playerDown: false, dt: 0.1, rand: always(0.5), playerSafe: true } as World)) {
        if (e.kind === 'respawned') respawned++;
      }
      states.add(m.state);
    }
    return { states, respawned };
  };

  it('after dying it stays dead for 10 simulated minutes', () => {
    const m = createMonsterLogic('goblin', 1030, -180, { campId: `${DEF.id}:hall`, respawn: false } as never);
    kill(m);
    const r = run(m, 600);
    expect(m.state).toBe('dead');
    expect(r.respawned).toBe(0);
    expect([...r.states].sort()).toEqual(['dead', 'dying']);
  });

  it('a monster of the same type without the option, or with respawn: true, respawns as today', () => {
    for (const opts of [{ campId: 'x' }, { campId: 'x', respawn: true }]) {
      const m = createMonsterLogic('goblin', 5, 5, opts as never);
      kill(m);
      const r = run(m, DYING_SECS + DEAD_SECS + 2);
      expect(r.respawned, JSON.stringify(opts)).toBe(1);
      expect(m.state).toBe('idle');
      expect(m.hp).toBe(m.maxHp);
    }
  });
});

describe('canEnter', () => {
  const setStage = (s: GameState, stage: number | 'done' | 'none') => {
    s.progress = { story: stage === 'none' || stage === 'done' ? {} : { fx_door: stage } };
    s.quests.claimed = s.quests.claimed.filter((c) => c !== 'fx_door');
    if (stage === 'done') s.quests.claimed.push('fx_door');
  };

  it('equals evalCond of the row\'s needs, and refuses below the combat level and before the door\'s stage', () => {
    for (const combat of [false, true]) {
      for (const stage of ['none', 0, 1, 2, 'done'] as const) {
        const s = fresh();
        if (combat) raiseCombat(s, 10);
        else resetCombat(s);
        setStage(s, stage);
        const want = combat && (stage === 1 || stage === 2 || stage === 'done');
        expect(evalCond(s, DEF.needs), `combat ${combatLevel(s)}, stage ${stage}`).toBe(want);
        expect(canEnter(s, DEF), `combat ${combatLevel(s)}, stage ${stage}`).toBe(want);
      }
    }
  });
});

describe('zoneSafe', () => {
  it('is true within 6 of the entry and false elsewhere, in the zone and in the overworld', () => {
    const [ex, ez] = w(DEF.entry[0], DEF.entry[1]);
    expect(zoneSafe(DEF, ex, ez)).toBe(true);
    expect(zoneSafe(DEF, ex + 5.9, ez)).toBe(true);
    expect(zoneSafe(DEF, ex, ez - 5.9)).toBe(true);
    expect(zoneSafe(DEF, ex + 6.1, ez)).toBe(false);
    expect(zoneSafe(DEF, ex, ez + 6.1)).toBe(false);
    expect(zoneSafe(DEF, ...w(36, 28))).toBe(false);
    expect(zoneSafe(DEF, 0, 0)).toBe(false);
    expect(zoneSafe(DEF, DEF.door.x, DEF.door.z)).toBe(false);
  });
});

describe('zoneCamps', () => {
  const camps = zoneCamps(DEF);

  it('returns CampDef rows in world coordinates, ids prefixed with the dungeon\'s, arenaRadius kept', () => {
    expect(camps.map((c) => c.id)).toEqual(DEF.camps.map((c) => `${DEF.id}:${c.id}`));
    for (const [i, row] of DEF.camps.entries()) {
      const c = camps[i];
      expect(c.members.map((m) => [m.type, m.x, m.z]), row.id).toEqual(row.members.map((m) => [m.type, OX + m.x, OZ + m.z]));
      expect(c.aggroRadius, row.id).toBe(row.aggro);
      expect(c.arenaRadius, row.id).toBe(row.arenaRadius);
      for (const m of c.members) expect(Math.hypot(m.x - c.x, m.z - c.z), `${row.id}: a member inside the camp's circle`).toBeLessThanOrEqual(c.radius);
      expect(c.x).toBeGreaterThan(OX);
      expect(c.z).toBeLessThan(OZ + DEF.size);
    }
    expect(camps.find((c) => c.id === `${DEF.id}:lair`)!.arenaRadius).toBe(8);
  });

  it('every camp is aggressive and keeps its sight', () => {
    for (const c of camps) {
      expect(c.aggressive, c.id).toBe(true);
      expect(c.keepsSight, c.id).toBe(true);
    }
  });

  it('through stepMonster a zone monster acquires a hero 60 combat levels above it at its full radius, and not beyond it', () => {
    const level = MONSTER_TYPES.goblin.level;
    const [mx, mz] = w(36, 28);
    const acquires = (camp: CampDef, dist: number) => {
      const m = createMonsterLogic('goblin', mx, mz, { campId: camp.id, wander: 0 });
      // The hero stands north of the monster, towards the camp's middle, so that it is inside the camp's circle.
      return stepMonster(m, world(mx, mz - dist, [camp], { playerCombat: level + 60 })).some((e) => e.kind === 'aggro');
    };
    const hall = hallCamp();
    expect(acquires(hall, 8.9)).toBe(true);
    expect(acquires(hall, 9.1)).toBe(false);
    // The flag is what holds it: the same camp without it has shrunk to 3 for that hero (G2's rule, no dungeon rule).
    expect(acquires({ ...hall, keepsSight: false }, 8.9)).toBe(false);
    expect(acquires({ ...hall, keepsSight: false }, 2.9)).toBe(true);
  });
});

describe('runStep', () => {
  it('a camp\'s death opens a gate only when every camp it names is dead', () => {
    const run = freshRun();
    expect(killCamp(run, 'hall')).toEqual([]);
    expect(run.deadCamps).toContain('hall');
    expect(killCamp(run, 'den')).toEqual(['lair_gate']);
    expect(run.deadCamps.sort()).toEqual(['den', 'hall']);
    const reversed = freshRun();
    expect(killCamp(reversed, 'den')).toEqual([]);
    expect(killCamp(reversed, 'hall')).toEqual(['lair_gate']);
  });

  it('a camp that no gate names opens nothing, and the same death twice is one death', () => {
    const run = freshRun();
    expect(killCamp(run, 'lair')).toEqual([]);
    expect(killCamp(run, 'hall')).toEqual([]);
    expect(killCamp(run, 'hall')).toEqual([]);
    expect(run.deadCamps.filter((c) => c === 'hall')).toHaveLength(1);
    expect(killCamp(run, 'den')).toEqual(['lair_gate']);
    expect(killCamp(run, 'den')).toEqual([]);
  });

  it('the boss\'s death arms the chest, and no other death does', () => {
    expect(bossCampId).toBe('lair');
    const run = freshRun();
    killCamp(run, 'hall');
    killCamp(run, 'den');
    expect(run.bossDead).toBe(false);
    killCamp(run, bossCampId);
    expect(run.bossDead).toBe(true);
    expect(run.chestOpen).toBe(false);
  });
});

describe('openChest', () => {
  const items = (s: GameState) => Object.fromEntries(['iron_ore', 'coal', 'steel_bar', 'black_bar'].map((id) => [id, countItem(s, id)]));
  const fill = (s: GameState) => {
    const loot = new Set(['iron_ore', 'coal', 'steel_bar', 'black_bar']);
    const filler = Object.keys(ITEMS).filter((id) => !loot.has(id)).slice(0, BACKPACK_SIZE);
    for (const id of filler) expect(addItem(s, id, 1).ok).toBe(true);
    for (const id of loot) expect(canAddItem(s, id, 1), `${id} has no room`).toBe(false);
  };

  it('is refused while the boss lives, and pays nothing', () => {
    const s = fresh();
    const run = freshRun();
    killCamp(run, 'hall');
    killCamp(run, 'den');
    const r = open(s, run, always(0));
    expect(r.ok).toBe(false);
    expect(typeof r.reason).toBe('string');
    expect(run.chestOpen).toBe(false);
    expect(s.gp).toBe(0);
    expect(s.inventory).toEqual([]);
    expect(stat(s, 'clear:fx_pit')).toBe(0);
  });

  it('pays the fixed part and coins in range: the ends of both ranges at the ends of the random source', () => {
    const lo = fresh();
    expect(open(lo, clearedRun(), always(0)).ok).toBe(true);
    expect(lo.gp).toBe(100);
    expect(items(lo)).toMatchObject({ iron_ore: 3, coal: 1 });
    const hi = fresh();
    expect(open(hi, clearedRun(), always(0.999)).ok).toBe(true);
    expect(hi.gp).toBe(300);
    expect(items(hi)).toMatchObject({ iron_ore: 5, coal: 2 });
  });

  it('pays a rare entry exactly when the injected value for it is under its chance', () => {
    const paid = (v: number) => {
      const s = fresh();
      expect(open(s, clearedRun(), always(v)).ok, `rand ${v}`).toBe(true);
      const c = items(s);
      return [c.steel_bar, c.black_bar];
    };
    expect(paid(0), 'rand 0 pays every rare entry').toEqual([3, 1]);
    expect(paid(0.999), 'rand 0.999 pays none').toEqual([0, 0]);
    expect(paid(0.0499)).toEqual([3, 1]);
    expect(paid(0.05), 'not under 0.05').toEqual([3, 0]);
    expect(paid(0.1999)).toEqual([3, 0]);
    expect(paid(0.2), 'not under 0.2').toEqual([0, 0]);
  });

  it('over 20,000 seeded opens each rare entry\'s rate is within 15% of its chance, and every other part stays in range', () => {
    const rand = seeded(20261127);
    let steel = 0;
    let black = 0;
    for (let i = 0; i < 20000; i++) {
      const s = fresh();
      expect(open(s, clearedRun(), rand).ok).toBe(true);
      const c = items(s);
      expect(c.iron_ore).toBeGreaterThanOrEqual(3);
      expect(c.iron_ore).toBeLessThanOrEqual(5);
      expect(c.coal).toBeGreaterThanOrEqual(1);
      expect(c.coal).toBeLessThanOrEqual(2);
      expect(s.gp).toBeGreaterThanOrEqual(100);
      expect(s.gp).toBeLessThanOrEqual(300);
      expect([0, 3]).toContain(c.steel_bar);
      expect([0, 1]).toContain(c.black_bar);
      if (c.steel_bar) steel++;
      if (c.black_bar) black++;
    }
    expect(Math.abs(steel / 20000 - 0.2)).toBeLessThanOrEqual(0.2 * 0.15);
    expect(Math.abs(black / 20000 - 0.05)).toBeLessThanOrEqual(0.05 * 0.15);
  });

  it('with a full backpack pays nothing, stays armed, and pays the SAME roll when opened again with room', () => {
    const s = fresh();
    fill(s);
    const before = JSON.stringify(s);
    const run = clearedRun();
    const first = open(s, run, always(0));
    expect(first.ok).toBe(false);
    expect(typeof first.reason).toBe('string');
    expect(JSON.stringify(s), 'nothing paid, no counter moved').toBe(before);
    expect(run.chestOpen).toBe(false);
    expect(run.bossDead).toBe(true);
    expect(run.roll, 'the roll is kept in the run').toBeDefined();
    expect(run.roll!.find((r) => r.id === 'steel_bar')?.qty).toBe(3);
    expect(run.roll!.find((r) => r.id === 'black_bar')?.qty).toBe(1);

    s.inventory = [];
    // A source that would roll nothing: what is paid is the kept roll, so this is not a second roll.
    expect(open(s, run, always(0.999)).ok).toBe(true);
    expect(items(s)).toEqual({ iron_ore: 3, coal: 1, steel_bar: 3, black_bar: 1 });
    expect(s.gp).toBeGreaterThanOrEqual(100);
    expect(s.gp).toBeLessThanOrEqual(300);
    expect(run.chestOpen).toBe(true);
    expect(stat(s, 'clear:fx_pit')).toBe(1);
    // An open chest is not paid again by the same run.
    s.inventory = [];
    const gp = s.gp;
    expect(open(s, run, always(0)).ok).toBe(false);
    expect(s.inventory).toEqual([]);
    expect(s.gp).toBe(gp);
    expect(stat(s, 'clear:fx_pit')).toBe(1);
  });

  it('a kept roll is the run\'s: a new run rolls again', () => {
    const s = fresh();
    fill(s);
    const stale = clearedRun();
    expect(open(s, stale, always(0)).ok).toBe(false);
    s.inventory = [];
    expect(open(s, clearedRun(), always(0.999)).ok).toBe(true);
    expect(items(s)).toMatchObject({ steel_bar: 0, black_bar: 0 });
  });

  it('bumps clear:<id> and clears, and keeps the smaller best in whole seconds', () => {
    const s = fresh();
    const go = (seconds: number) => {
      s.inventory = [];
      expect(open(s, clearedRun(1000), always(0.5), 1000 + seconds * 1000).ok).toBe(true);
    };
    go(90);
    expect(stat(s, 'clear:fx_pit')).toBe(1);
    expect(s.progress!.dungeons!.fx_pit).toEqual({ clears: 1, best: 90 });
    go(120);
    expect(stat(s, 'clear:fx_pit')).toBe(2);
    expect(s.progress!.dungeons!.fx_pit).toEqual({ clears: 2, best: 90 });
    go(61);
    expect(stat(s, 'clear:fx_pit')).toBe(3);
    expect(s.progress!.dungeons!.fx_pit).toEqual({ clears: 3, best: 61 });
  });
});

describe('the Dungeon type has no field for a once-only reward (design 7.3)', () => {
  const ROW_KEYS = ['id', 'name', 'origin', 'size', 'door', 'entry', 'rooms', 'gates', 'camps', 'nodes', 'chest', 'loot', 'needs', 'solid'];

  it('every row of DUNGEONS has only the design\'s keys and a loot of run, runGp and rare', () => {
    expect(DUNGEONS.map((d) => d.id)).toContain('fx_pit');
    for (const d of DUNGEONS) {
      expect(Object.keys(d).filter((k) => !ROW_KEYS.includes(k)), d.id).toEqual([]);
      expect(Object.keys(d.loot).sort(), d.id).toEqual(['rare', 'run', 'runGp']);
    }
  });

  it('a row that adds one does not type-check', () => {
    // @ts-expect-error a chest row has nowhere to put a first-clear reward
    const row: Dungeon = { ...(DEF as Dungeon), firstClear: { gp: 1 } };
    expect(row.id).toBe('fx_pit');
  });

  it('every dungeon has its clear:<id> stat key, and a key outside the list is an error', () => {
    for (const d of DUNGEONS) expect(STAT_KEYS, d.id).toContain(`clear:${d.id}`);
    expect(() => bump(fresh(), 'clear:not_a_dungeon')).toThrow();
  });
});

describe('a quest\'s reward is paid once, whatever the chest does (design 7.3)', () => {
  const clearOnce = (s: GameState, rand = always(0.999)) => {
    s.inventory = [];
    const before = s.gp;
    expect(open(s, clearedRun(), rand).ok).toBe(true);
    return s.gp - before;
  };

  it('three clears pay three chest rolls, advanceStory moves the quest once, finishQuest pays once and is refused a second time', () => {
    const s = fresh();
    expect(startQuest(s, 'fx_pit_clear').ok).toBe(true);
    const moved: unknown[] = [];
    for (let i = 0; i < 3; i++) {
      expect(clearOnce(s), `chest ${i + 1} pays its own roll`).toBeGreaterThanOrEqual(100);
      moved.push(...advanceStory(s));
    }
    expect(stat(s, 'clear:fx_pit')).toBe(3);
    expect(moved).toEqual([{ questId: 'fx_pit_clear', stage: 1 }]);
    expect(s.progress!.story!.fx_pit_clear).toBe(1);

    s.inventory = [];
    const gp = s.gp;
    expect(finishQuest(s, 'fx_pit_clear').ok).toBe(true);
    expect(s.gp - gp, 'the quest\'s own coin, once').toBe(250);
    expect(countItem(s, 'shrimp')).toBe(2);
    expect(s.quests.title).toBe('Pit Cleaner');
    expect(s.quests.claimed.filter((c) => c === 'fx_pit_clear')).toHaveLength(1);

    const after = finishQuest(s, 'fx_pit_clear');
    expect(after.ok).toBe(false);
    expect(s.gp - gp).toBe(250);
    expect(countItem(s, 'shrimp')).toBe(2);

    // Fifty more clears would pay fifty rolls and no quest reward: two are enough to show it.
    for (let i = 0; i < 2; i++) {
      const paid = clearOnce(s);
      expect(paid).toBeGreaterThanOrEqual(100);
      expect(paid).toBeLessThanOrEqual(300);
      expect(advanceStory(s)).toEqual([]);
      expect(finishQuest(s, 'fx_pit_clear').ok).toBe(false);
      expect(startQuest(s, 'fx_pit_clear').ok).toBe(false);
    }
    expect(s.quests.claimed.filter((c) => c === 'fx_pit_clear')).toHaveLength(1);
  });

  it('with the counter already at 1 before the quest starts the stage is done at once, and the reward is still paid once', () => {
    const s = fresh();
    clearOnce(s);
    expect(stat(s, 'clear:fx_pit')).toBe(1);
    expect(startQuest(s, 'fx_pit_clear').ok).toBe(true);
    expect(advanceStory(s)).toEqual([{ questId: 'fx_pit_clear', stage: 1 }]);
    s.inventory = [];
    const gp = s.gp;
    expect(finishQuest(s, 'fx_pit_clear').ok).toBe(true);
    expect(s.gp - gp).toBe(250);
    expect(finishQuest(s, 'fx_pit_clear').ok).toBe(false);
    expect(s.gp - gp).toBe(250);
    expect(s.quests.claimed.filter((c) => c === 'fx_pit_clear')).toHaveLength(1);
  });
});

describe('savedPose', () => {
  const pose = { x: OX + 12, y: 0, z: OZ + 28, yaw: 1.5 };

  it('returns the door when a zone is given, so a reload stands outside it', () => {
    const p = savedPose(pose, DEF);
    expect(p!.x).toBe(DEF.door.x);
    expect(p!.z).toBe(DEF.door.z);
    expect(Number.isFinite(p!.y)).toBe(true);
    expect(Number.isFinite(p!.yaw)).toBe(true);
  });

  it('returns the pose as it is with no zone', () => {
    expect(savedPose(pose, null)).toEqual(pose);
  });
});
