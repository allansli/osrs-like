import { describe, expect, it, vi } from 'vitest';
import { isWalkable, moveWithCollision } from '../src/state/collision';
import { WORLD_REGIONS } from '../src/data/world';
import { isInSafeZone } from '../src/data/worldMap';
import { AGGRO_GRACE_MS, createMonsterLogic, isPlayerSafe, stepMonster } from '../src/state/monsterAi';
import {
  buildWalkGrid,
  entityAim,
  entityGoal,
  escapeStall,
  findPath,
  findWalkPath,
  nearestOpenCell,
  shouldRepath,
  STALL_SEC,
  stallTime,
  walkSpent,
  type WalkGrid
} from '../src/state/pathfind';
import { MONSTER_PLACEMENTS, NODE_PLACEMENTS } from '../src/data/placements';
import { STATE } from '../src/state/gameState';
import { prepareAttack } from '../src/state/combat';
import { addItem } from '../src/state/inventory';
import { player, type MonsterEntity } from '../src/engine/context';
import { performPlayerAttack } from '../src/engine/actions';

const chat = vi.hoisted(() => [] as string[]);
vi.mock('../src/ui/hud', async (orig) => ({
  ...(await orig<typeof import('../src/ui/hud')>()),
  addChatMessage: (msg: string) => { chat.push(msg); }
}));

// Confirmed Stage 2 review findings (docs/superpowers/baseline/stage2-review-findings.json).

describe('review 0: a returning monster that cannot reach home', () => {
  it('a three_kettle goblin stuck on the east bank snaps home after a stall, with the arrival effects', () => {
    const m = createMonsterLogic('goblin', 12, 4, { campId: 'three_kettle' });
    // Where the bridge lure leaves it: east of the river, off the bridge deck.
    m.x = 35.21;
    m.z = 2.77;
    m.state = 'return';
    m.hp = m.maxHp - 1;
    m.breathCount = 2;
    const all: string[] = [];
    let t = 0;
    while (m.state === 'return' && t < 15) {
      all.push(...stepMonster(m, { playerX: 60, playerZ: 0, playerDown: false, dt: 0.02, rand: () => 0.5 }).map((e) => e.kind));
      t += 0.02;
    }
    expect(m.state).toBe('idle');
    expect(all).toContain('reset');
    expect(m.x).toBe(m.homeX);
    expect(m.z).toBe(m.homeZ);
    expect(m.hp).toBe(m.maxHp);
    expect(m.breathCount).toBe(0);
  });
});

// The entity walk of updatePlayerIntent (src/engine/loop.ts) at 60 fps and run speed, with the same
// planning as planEntityWalk (src/engine/input.ts). True when the hero gets within stopDist.
function approach(grid: WalkGrid, start: [number, number], target: [number, number], stopDist: number, monster: boolean): boolean | null {
  const plan = (p: [number, number]): [number, number][] | null => {
    const cell = Math.floor(p[1] - grid.origin) * grid.size + Math.floor(p[0] - grid.origin);
    const from = grid.cells[cell] === 1 ? p : nearestOpenCell(grid, p[0], p[1]) ?? p;
    const goal = entityGoal(grid, from, target, stopDist);
    return goal ? findPath(grid, from, goal) : null;
  };
  const pos: [number, number] = [...start];
  let waypoints = plan(pos);
  if (!waypoints) return null;
  const madeAt = target;
  const dt = 1 / 60;
  let prev: [number, number] | null = null;
  let stall = 0;
  for (let frame = 0; frame < 60 * 30; frame++) {
    if (Math.hypot(target[0] - pos[0], target[1] - pos[1]) <= stopDist) return true;
    stall = stallTime(stall, prev, pos, dt);
    prev = [pos[0], pos[1]];
    if (monster && shouldRepath(madeAt, target, walkSpent(waypoints, pos))) waypoints = plan(pos) ?? waypoints;
    if (stall > STALL_SEC) {
      escapeStall(grid, waypoints, pos);
      stall = 0;
    }
    const aim = entityAim(grid, waypoints, pos, target, monster);
    const d = Math.hypot(aim[0] - pos[0], aim[1] - pos[1]);
    if (d <= 0.001) continue;
    const step = Math.min(d, 5 * dt);
    const next = moveWithCollision(pos[0], pos[1], ((aim[0] - pos[0]) / d) * step, ((aim[1] - pos[1]) / d) * step);
    pos[0] = next.x;
    pos[1] = next.z;
  }
  return false;
}

function stuckApproaches(grid: WalkGrid, targets: { x: number; z: number }[], stopDist: number, monster: boolean): string[] {
  const stuck: string[] = [];
  for (const t of targets) {
    for (const r of [stopDist + 3, stopDist + 9]) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const s: [number, number] = [t.x + Math.cos(a) * r, t.z + Math.sin(a) * r];
        if (!isWalkable(s[0], s[1])) continue;
        if (approach(grid, s, [t.x, t.z], stopDist, monster) === false) stuck.push(`(${t.x},${t.z}) from (${s[0].toFixed(1)},${s[1].toFixed(1)})`);
      }
    }
  }
  return stuck;
}

describe('review 1: an entity walk never runs in place against water or a wall', () => {
  const grid = buildWalkGrid();

  it('reaches the north shrimp spot from the north', () => {
    expect(approach(grid, [27, 11], [27, 5], 3.1, false)).toBe(true);
  });

  it('reaches a still goblin across the river at ranged stop distance', () => {
    expect(approach(grid, [34.8, 1.9], [20, 8], 13.5, true)).toBe(true);
  });

  it('reaches every resource node from every side', () => {
    expect(stuckApproaches(grid, NODE_PLACEMENTS, 3.1, false)).toEqual([]);
  });

  it('reaches every still monster from every side, melee and ranged', () => {
    expect(stuckApproaches(grid, MONSTER_PLACEMENTS, 2.9, true)).toEqual([]);
    expect(stuckApproaches(grid, MONSTER_PLACEMENTS, 13.5, true)).toEqual([]);
  });
});

describe('review 2: attacking a returning monster', () => {
  it('spends no runes, says lost interest once and drops the target', () => {
    const m = { def: { name: 'Goblin' }, logic: createMonsterLogic('goblin', 12, 4) } as unknown as MonsterEntity;
    m.logic.state = 'return';
    STATE.combatStyle = 'magic';
    STATE.equipment.weapon = 'fire_staff';
    STATE.activeSpell = 'wind_strike';
    expect(addItem(STATE, 'air_rune', 5).ok && addItem(STATE, 'mind_rune', 5).ok).toBe(true);
    expect(prepareAttack(STATE).consume.length, 'the attack would spend runes').toBe(2);
    const before = JSON.stringify(STATE.inventory);
    player.targetEntity = { type: 'monster', ref: m, madeAt: [12, 4] };
    chat.length = 0;
    performPlayerAttack(m);
    expect(chat).toEqual(['The Goblin has lost interest.']);
    expect(player.targetEntity).toBeNull();
    expect(JSON.stringify(STATE.inventory), 'no rune spent').toBe(before);
  });
});

describe('review 3: a ground click on walkable ground whose cell centre is blocked', () => {
  const grid = buildWalkGrid();
  const from: [number, number] = [0.5, 5.5];

  function routeWalkable(route: [number, number][]): boolean {
    let prev = from;
    for (const p of route) {
      const steps = Math.max(1, Math.ceil(Math.hypot(p[0] - prev[0], p[1] - prev[1]) / 0.25));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        if (!isWalkable(prev[0] + (p[0] - prev[0]) * t, prev[1] + (p[1] - prev[1]) * t)) return false;
      }
      prev = p;
    }
    return true;
  }

  it('routes to the outer strip of the bridge deck and ends on the clicked point', () => {
    const to: [number, number] = [29, 2.03];
    expect(isWalkable(to[0], to[1]), 'the clicked point is on the deck').toBe(true);
    expect(findPath(grid, from, to), 'its cell centre is water').toBeNull();
    const route = findWalkPath(grid, from, to);
    expect(route).not.toBeNull();
    expect(route![route!.length - 1]).toEqual(to);
    expect(routeWalkable(route!)).toBe(true);
  });

  it('still refuses a point that is not walkable', () => {
    expect(isWalkable(29, 3)).toBe(false);
    expect(findWalkPath(grid, from, [29, 3])).toBeNull();
  });

  it('an open cell routes exactly as findPath does', () => {
    expect(findWalkPath(grid, from, [29, 1.9])).toEqual(findPath(grid, from, [29, 1.9]));
  });
});

describe('review 12: the aggression grace after load, teleport and respawn', () => {
  it('lasts 3 seconds', () => {
    expect(AGGRO_GRACE_MS).toBe(3000);
  });

  it('makes the player safe until graceUntil and not after, outside every safe zone', () => {
    // The giants camp, aggressive and outside every safe zone.
    const [x, z] = [77.5, 21];
    expect(isInSafeZone(x, z)).toBe(false);
    const graceUntil = 10_000 + AGGRO_GRACE_MS;
    expect(isPlayerSafe(x, z, graceUntil - 1, graceUntil)).toBe(true);
    expect(isPlayerSafe(x, z, graceUntil + 1, graceUntil)).toBe(false);
  });

  it('a safe zone stays safe after the grace', () => {
    const r = WORLD_REGIONS[0];
    expect(isPlayerSafe(r.x, r.z, 1_000_000, 0)).toBe(true);
  });
});
