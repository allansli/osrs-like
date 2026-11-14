import { describe, expect, it } from 'vitest';
import { isWalkable } from '../src/state/collision';
import { WORLD_REGIONS } from '../src/data/world';
import { isInSafeZone } from '../src/data/worldMap';
import { AGGRO_GRACE_MS, createMonsterLogic, isPlayerSafe, stepMonster } from '../src/state/monsterAi';
import { buildWalkGrid, findPath, findWalkPath } from '../src/state/pathfind';

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
