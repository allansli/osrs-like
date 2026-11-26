import { describe, expect, it } from 'vitest';
import { MONSTER_TYPES } from '../src/data/world';
import { CAMPS, type CampDef } from '../src/data/worldMap';
import { SIGHT_GAP, SIGHT_MIN, createMonsterLogic, sightRadius, stepMonster } from '../src/state/monsterAi';
import { packAttackers } from './support/packAttackers';

// Aggressive and passive monsters (design 7.13, owner 2026-11-14; plan G1). Red until G2.
// An aggressive camp attacks a hero at any level; the sight radius shrinks from the camp's base at the
// monster's level to SIGHT_MIN at SIGHT_GAP levels above. A camp with keepsSight never shrinks.

type World = Parameters<typeof stepMonster>[1];

const CX = 0;
const CZ = 10;
const DT = 0.02;
const rand = () => 0.5;

function world(pz: number, playerCombat: number, camps: CampDef[]): World {
  const w = { playerX: CX, playerZ: CZ + pz, playerDown: false, dt: DT, rand, playerCombat, playerSafe: false, camps };
  return w;
}

/** A test camp wide enough that only the sight radius decides. */
function camp(id: string, aggressive: boolean, keepsSight?: boolean): CampDef {
  const c = { id, x: CX, z: CZ, radius: 20, aggressive, keepsSight, members: [] };
  return c;
}

/** A monster at the camp's centre that never wanders. */
const still = (typeKey: string, c: CampDef) => createMonsterLogic(typeKey, c.x, c.z, { campId: c.id, wander: 0 });

const acquires = (typeKey: string, c: CampDef, dist: number, combat: number): boolean =>
  stepMonster(still(typeKey, c), world(dist, combat, [c])).some((e) => e.kind === 'aggro');

describe('sightRadius', () => {
  it('SIGHT_MIN is 3 and SIGHT_GAP is 10', () => {
    expect(SIGHT_MIN).toBe(3);
    expect(SIGHT_GAP).toBe(10);
  });

  it('is base at or below the monster, 3 from ten above, a straight line between, never above base or growing', () => {
    const level = 30;
    for (const base of [5, 9, 12]) {
      let prev = Infinity;
      for (let d = -20; d <= 60; d++) {
        const r = sightRadius(base, level, level + d, false);
        const where = `base ${base}, ${d} levels above`;
        if (d <= 0) expect(r, where).toBe(base);
        else if (d >= 10) expect(r, where).toBe(3);
        else expect(r, where).toBeCloseTo(base - ((base - 3) * d) / 10, 10);
        expect(r, where).toBeLessThanOrEqual(base);
        expect(r, where).toBeGreaterThanOrEqual(3);
        expect(r, where).toBeLessThanOrEqual(prev);
        prev = r;
        expect(sightRadius(base, level, level + d, true), `${where}, keepsSight`).toBe(base);
      }
    }
  });

  it('returns a base under 3 as it is', () => {
    for (const base of [0, 1, 2, 2.5]) {
      for (const d of [-5, 0, 1, 5, 10, 40]) {
        expect(sightRadius(base, 20, 20 + d, false), `base ${base}, ${d} above`).toBe(base);
        expect(sightRadius(base, 20, 20 + d, true), `base ${base}, ${d} above, keepsSight`).toBe(base);
      }
    }
  });
});

describe('acquisition through stepMonster', () => {
  it('the farthest distance at which a standing hero is acquired is sightRadius', () => {
    for (const key of ['goblin', 'goblin_archer', 'dark_wizard']) {
      const def = MONSTER_TYPES[key];
      const base = def.style === 'magic' || def.style === 'ranged' ? 12 : 9;
      const c = camp(`sight_${key}`, true);
      for (const d of [-1, 0, 1, 2, 5, 9, 10, 30]) {
        const combat = def.level + d;
        const r = sightRadius(base, def.level, combat, false);
        let farthest = -1;
        let acquired = 0;
        let steps = 0;
        for (let k = 0; k * 0.05 <= base + 1; k++) {
          steps++;
          if (acquires(key, c, k * 0.05, combat)) {
            farthest = k * 0.05;
            acquired++;
          }
        }
        const where = `${key} (level ${def.level}) vs combat ${combat}`;
        expect(Math.abs(farthest - r), `${where}: farthest ${farthest}, radius ${r}`).toBeLessThanOrEqual(0.051);
        // No gap: every distance up to the farthest acquires, none beyond it does.
        expect(acquired, where).toBe(Math.round(farthest / 0.05) + 1);
        expect(steps, where).toBeGreaterThan(acquired);
      }
    }
  });

  it('a passive camp acquires nobody in 600 steps at combat 1 and at combat 99', () => {
    for (const combat of [1, 99]) {
      for (const key of ['goblin', 'goblin_archer', 'dark_wizard']) {
        const c = camp(`passive_${key}`, false);
        const m = still(key, c);
        for (let i = 0; i < 600; i++) {
          expect(stepMonster(m, world(2, combat, [c])), `${key} at combat ${combat}, step ${i}`).toEqual([]);
        }
        expect(m.state).toBe('idle');
      }
    }
  });

  it('a camp with keepsSight acquires a combat-126 hero at 9', () => {
    const c = camp('keeps', true, true);
    expect(acquires('goblin', c, 9, 126)).toBe(true);
    expect(acquires('goblin', c, 9.05, 126)).toBe(false);
    // The same camp without the flag sees that hero only at arm's length.
    expect(acquires('goblin', camp('shrinks', true), 9, 126)).toBe(false);
  });
});

describe('camp data', () => {
  it('exactly pass_sentries and every arena camp keep their sight', () => {
    const keeps = CAMPS.filter((c) => c.keepsSight).map((c) => c.id);
    const expected = CAMPS.filter((c) => c.id === 'pass_sentries' || c.arenaRadius !== undefined).map((c) => c.id);
    expect(keeps).toEqual(expected);
    expect(keeps).toContain('pass_sentries');
    expect(keeps).toContain('ashmantle');
    for (const c of CAMPS) if (c.keepsSight !== undefined) expect(c.keepsSight, c.id).toBe(true);
  });

  it('the passive camps are the hen yard and Three Kettle Camp', () => {
    expect(CAMPS.filter((c) => !c.aggressive).map((c) => c.id).sort()).toEqual(['hen_yard', 'three_kettle']);
  });
});

describe('packAttackers', () => {
  const melee = MONSTER_TYPES.goblin;
  const magic = MONSTER_TYPES.dark_wizard;

  it('is the whole pack at or below the monster, 1 from ten levels above', () => {
    for (const m of [melee, magic]) {
      for (const pack of [2, 3, 4, 7]) {
        for (const d of [-20, -5, -1, 0]) expect(packAttackers(pack, m, m.level + d), `${pack} at ${d}`).toBe(pack);
        for (const d of [10, 11, 30, 60]) expect(packAttackers(pack, m, m.level + d), `${pack} at ${d}`).toBe(1);
      }
    }
  });

  it('a pack of four at 0 to 10 above: 4, 4, 4, 4, 3, 3, 3, 2, 2, 2, 1', () => {
    for (const m of [melee, magic]) {
      const got = Array.from({ length: 11 }, (_, d) => packAttackers(4, m, m.level + d));
      expect(got, m.name).toEqual([4, 4, 4, 4, 3, 3, 3, 2, 2, 2, 1]);
    }
  });

  it('a pack of one, or none, is one attacker', () => {
    for (const m of [melee, magic]) {
      for (const d of [-5, 0, 5, 10]) {
        expect(packAttackers(1, m, m.level + d)).toBe(1);
        expect(packAttackers(0, m, m.level + d)).toBe(1);
      }
    }
  });
});
