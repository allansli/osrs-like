// Stage 6 plan L1 (design 7.13, CALL-6.32, owner 2026-11-24): a monster fires a ranged or magic attack only when
// segmentWalkable holds from it to the hero; otherwise it closes in. Red until L2.
// Case 8 is the declared replacement's strictness (design 11.3 item 15): the `monsters` digest of
// tests/fixtures/size-refactor-golden.json moves with this rule, so the four monsters of that scene the rule does not
// touch are held here to digests taken before it.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CAVES } from '../src/data/dungeons';
import type { CampDef } from '../src/data/worldMap';
import { zoneWalk } from '../src/state/dungeon';
import { createMonsterLogic, onPlayerHit, stepMonster, type MonsterEvent, type MonsterLogic, type StepWorld } from '../src/state/monsterAi';
import { buildWalkGrid, segmentWalkable, type WalkGrid } from '../src/state/pathfind';

const DT = 1 / 60;
const RANGED = ['goblin_archer', 'dark_ranger', 'thornwatch_marksman', 'dark_wizard', 'elvarg_dragon', 'cinder_adept', 'ember_hurler', 'ashmantle'];
const HERO: [number, number] = [4, 0];

const inBounds = (x: number, z: number) => x >= -118 && x <= 118 && z >= -118 && z <= 118;
const inWall = (x: number, z: number) => Math.abs(x) < 0.6 && Math.abs(z) <= 8;
const WALLED = buildWalkGrid((x, z) => inBounds(x, z) && !inWall(x, z));
const OPEN = buildWalkGrid(inBounds);

function lcg(start: number): () => number {
  let seed = start;
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

const fires = (ev: MonsterEvent[]) => ev.some((e) => e.kind === 'attack' || e.kind === 'windup');

function pulled(type: string, x: number, z: number): MonsterLogic {
  const m = createMonsterLogic(type, x, z, type === 'ashmantle' ? { campId: 'ashmantle' } : undefined);
  onPlayerHit(m, 0);
  return m;
}

function world(grid: WalkGrid | undefined, rand: () => number, extra: Partial<StepWorld> = {}): StepWorld {
  return { playerX: HERO[0], playerZ: HERO[1], playerDown: false, dt: DT, rand, grid, ...extra };
}

/** Steps `m` up to `steps` times; returns the first step that fires (or -1) and every step that fired with the line cut. */
function run(m: MonsterLogic, w: StepWorld, steps: number, hero: [number, number] = HERO): { first: number; blocked: number[] } {
  let first = -1;
  const blocked: number[] = [];
  for (let i = 0; i < steps; i++) {
    const ev = stepMonster(m, w);
    if (!fires(ev)) continue;
    if (first < 0) first = i;
    if (w.grid && !segmentWalkable(w.grid, [m.x, m.z], hero)) blocked.push(i);
  }
  return { first, blocked };
}

describe('line of sight for ranged and magic monsters (design 7.13, CALL-6.32)', () => {
  it('1. no shot through a wall: each type holds its fire while the wall cuts the line, and fires once it is clear', () => {
    for (const type of RANGED) {
      const m = pulled(type, -4, 0);
      expect(segmentWalkable(WALLED, [m.x, m.z], HERO), `${type}: the wall cuts the line at the start`).toBe(false);
      const { first, blocked } = run(m, world(WALLED, lcg(11)), 900);
      expect(blocked, `${type}: steps that fired across the wall`).toEqual([]);
      expect(first, `${type}: fires within 900 steps`).toBeGreaterThanOrEqual(0);
    }
  });

  it('2. open ground as today: each type fires within 120 steps, Ashmantle within 240', () => {
    for (const type of RANGED) {
      const { first } = run(pulled(type, -4, 0), world(OPEN, lcg(12)), 240);
      expect(first, `${type}: first step that fires`).toBeGreaterThanOrEqual(0);
      expect(first, `${type}: first step that fires`).toBeLessThan(type === 'ashmantle' ? 240 : 120);
    }
  });

  it('3. melee does not need the line: a goblin and a lesser demon strike across a thin wall', () => {
    for (const type of ['goblin', 'lesser_demon']) {
      const m = pulled(type, -1.2, 0);
      const w = world(WALLED, lcg(13), { playerX: 1.2, playerZ: 0 });
      expect(segmentWalkable(WALLED, [m.x, m.z], [1.2, 0])).toBe(false);
      let attacked = -1;
      for (let i = 0; i < 120 && attacked < 0; i++) if (stepMonster(m, w).some((e) => e.kind === 'attack')) attacked = i;
      expect(attacked, `${type}: step of the first attack`).toBeGreaterThanOrEqual(0);
    }
  });

  it('4. no grid, no rule: a goblin archer attacks within 120 steps', () => {
    const m = pulled('goblin_archer', -4, 0);
    const w = world(undefined, lcg(14));
    let attacked = -1;
    for (let i = 0; i < 120 && attacked < 0; i++) if (stepMonster(m, w).some((e) => e.kind === 'attack')) attacked = i;
    expect(attacked).toBeGreaterThanOrEqual(0);
  });

  it('5. a wind-up started on a clear line resolves after the hero is behind cover', () => {
    const m = pulled('dark_ranger', -4, 0);
    m.patternIdx = 3;
    m.attackCooldown = 0;
    const ev = stepMonster(m, world(OPEN, lcg(15)));
    expect(ev).toContainEqual(expect.objectContaining({ kind: 'windup', attackId: 'pinning_volley' }));
    const w = world(WALLED, lcg(15));
    let resolved: MonsterEvent | undefined;
    for (let i = 0; i < 300 && !resolved; i++) resolved = stepMonster(m, w).find((e) => e.kind === 'resolve' || e.kind === 'cancel');
    expect(resolved).toEqual({ kind: 'resolve', attackId: 'pinning_volley', hit: true });
  });

  it('6. acquisition across a wall: an aggressive camp member aggroes and does not strike', () => {
    const camp: CampDef = { id: 'los_test', x: -4, z: 0, radius: 12, aggressive: true, keepsSight: true, members: [] };
    const m = createMonsterLogic('dark_wizard', -4, 0, { campId: 'los_test' });
    const ev = stepMonster(m, world(WALLED, lcg(16), { playerCombat: 1, playerSafe: false, camps: [camp] }));
    expect(ev).toContainEqual({ kind: 'aggro' });
    expect(ev.some((e) => e.kind === 'attack')).toBe(false);
    expect(m.state).toBe('chase');
  });

  it("7. the cave's pillar: an Ember Hurler does not shoot through it, and shoots once the line is clear", () => {
    const cave = CAVES.find((c) => c.id === 'slagfall_cave')!;
    const grid = buildWalkGrid(zoneWalk(cave, []), cave.origin[0], cave.origin[1], cave.size);
    expect(cave.solid).toContainEqual([69, 30, 71, 32]);
    const hero: [number, number] = [1066.8, 633.4];
    const m = pulled('ember_hurler', 1074, 628);
    expect(Math.hypot(hero[0] - m.x, hero[1] - m.z)).toBeCloseTo(9, 5);
    expect(segmentWalkable(grid, [m.x, m.z], hero), 'the pillar cuts the line at the start').toBe(false);
    const { first, blocked } = run(m, world(grid, lcg(17), { playerX: hero[0], playerZ: hero[1] }), 900, hero);
    expect(blocked, 'steps that fired through the pillar').toEqual([]);
    expect(first, 'fires within 900 steps').toBeGreaterThanOrEqual(0);
  });
});

// The scene of monsterTrace in tests/size-refactor-golden.test.ts, unchanged, with one digest per monster.
function goldenScene(): { digests: Record<string, string>; ashmantleBlocked: number[] } {
  const rand = lcg(7);
  const grid = buildWalkGrid((x, z) => inBounds(x, z) && !inWall(x, z) && Math.hypot(x - 20, z + 20) > 2);
  const ms = [
    createMonsterLogic('goblin', -6, 1),
    createMonsterLogic('scorpion', -4, -3),
    createMonsterLogic('dark_wizard', 3, 5),
    createMonsterLogic('hill_giant', 25, -25, { wander: 6 }),
    createMonsterLogic('ashmantle', -10, 0, { campId: 'ashmantle' })
  ];
  for (const m of ms.slice(0, 3)) onPlayerHit(m, 0);
  const rows: unknown[][] = ms.map(() => []);
  const ashmantleBlocked: number[] = [];
  const gate: Record<string, number> = {};
  for (let i = 0; i < 1800; i++) {
    const px = i < 900 ? 5 + 3 * Math.sin(i / 90) : 40 + i / 20;
    const pz = i < 900 ? 3 * Math.cos(i / 70) : -10;
    if (i === 300) onPlayerHit(ms[4], 0);
    if (i % 45 === 0) for (const m of ms) onPlayerHit(m, 3);
    const budget = { left: 2 };
    ms.forEach((m, k) => {
      const ev = stepMonster(m, { playerX: px, playerZ: pz, playerDown: false, dt: 1 / 60, rand, grid, pathBudget: budget, windupGate: gate });
      rows[k].push([m.x, m.z, m.state, m.hp, m.path.length, m.patternIdx, m.phase, ev]);
      if (k === 4 && fires(ev) && !segmentWalkable(grid, [m.x, m.z], [px, pz])) ashmantleBlocked.push(i);
    });
  }
  const d = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
  return { digests: { goblin: d(rows[0]), scorpion: d(rows[1]), dark_wizard: d(rows[2]), hill_giant: d(rows[3]) }, ashmantleBlocked };
}

// Taken on 08d31f4 (feat/content-systems, before L2), with the code of that commit.
const BEFORE_L2 = {
  goblin: '5cc483f5e7d276e3d939f131e7135f544bb670185da35f8fbc738e9c46b5de2f',
  scorpion: '49ce3bf9694989126fe286e6f50c5a6aaf1db6e150ca0a5c6d8f306c0728d797',
  dark_wizard: '10044850b7cbbd0d1931dd6695de6e6723b9c894dcc77de30453405396158482',
  hill_giant: '329230d2f9b112b629e8959913bfb9107e35b19fb6c5921da60d6dad73d6da06'
};

describe("the size-refactor golden's scene (design 11.3 item 15)", () => {
  const scene = goldenScene();
  it('8a. the goblin, scorpion, dark wizard and hill giant step exactly as before line of sight', () => {
    expect(scene.digests).toEqual(BEFORE_L2);
  });
  it('8b. Ashmantle fires on no step where its line to the hero is cut', () => {
    expect(scene.ashmantleBlocked).toEqual([]);
  });
});
