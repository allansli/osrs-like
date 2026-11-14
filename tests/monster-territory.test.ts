import { describe, expect, it } from 'vitest';
import type { CampDef } from '../src/data/worldMap';
import { isWalkable } from '../src/state/collision';
import { createMonsterLogic, onPlayerHit, stepMonster } from '../src/state/monsterAi';

// Territory, aggression and leashing (design 6.4, 6.5; CALL-7, CALL-8, Q4, Q7). Red until A6.
// Test-local camps and simulated time (every step passes its own dt). Camps sit in open ground
// south of the castle and west of the river; the stall test uses the castle's south wall.

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Logic = ReturnType<typeof createMonsterLogic>;
type World = Parameters<typeof stepMonster>[1];

type Opts = { camps?: CampDef[]; playerCombat?: number; playerSafe?: boolean; playerDown?: boolean };

/** Built as a variable, not a literal at the call site, so the Stage 2 fields type-check either way. */
function world(px: number, pz: number, dt: number, rand: () => number, o: Opts = {}): World {
  const w = {
    playerX: px,
    playerZ: pz,
    playerDown: o.playerDown ?? false,
    dt,
    rand,
    playerCombat: o.playerCombat ?? 1,
    playerSafe: o.playerSafe ?? false,
    camps: o.camps ?? []
  };
  return w;
}

function camp(id: string, x: number, z: number, radius: number, aggressive: boolean, aggroRadius?: number): CampDef {
  return { id, x, z, radius, aggressive, aggroRadius, members: [] };
}

/** States and event kinds as plain strings: 'return', 'aggro' and 'reset' are Stage 2 additions. */
const st = (m: Logic): string => m.state;
const kinds = (events: { kind: string }[]): string[] => events.map((e) => e.kind);

function monster(typeKey: string, c: CampDef): Logic {
  return createMonsterLogic(typeKey, c.x, c.z, { campId: c.id });
}

const fromHome = (m: Logic) => Math.hypot(m.x - m.homeX, m.z - m.homeZ);

const CX = 0;
const CZ = 10;
const DT = 0.02;
const STEP = 5.2 * DT + 1e-9;

/** Steps until `done`, at most `secs`; returns every event kind and the elapsed time. */
function runUntil(
  m: Logic,
  secs: number,
  w: (t: number) => World,
  done: (m: Logic, ev: string[]) => boolean
): { ev: string[]; t: number; hit: boolean } {
  const all: string[] = [];
  let t = 0;
  while (t < secs) {
    const wt = w(t);
    t += wt.dt;
    const ev = kinds(stepMonster(m, wt));
    all.push(...ev);
    if (done(m, ev)) return { ev: all, t, hit: true };
  }
  return { ev: all, t, hit: false };
}

/** Pulls the monster out of its camp toward a player standing at (0, 30) until it leashes. */
function leashed(m: Logic, c: CampDef, rand: () => number): void {
  onPlayerHit(m, 1);
  const r = runUntil(m, 10, () => world(0, 30, DT, rand, { camps: [c] }), (mm) => st(mm) === 'return');
  expect(r.hit, 'monster leashed').toBe(true);
}

describe('monster territory: transitions T1 to T9', () => {
  it('T1: the player\'s attack sends idle to chase, also on a miss', () => {
    const c = camp('t1', CX, CZ, 8, false);
    const m = monster('goblin', c);
    const r = onPlayerHit(m, 0);
    expect(r.applied).toBe(true);
    expect(st(m)).toBe('chase');
    expect(m.hp).toBe(m.maxHp);
  });

  it('T2: an aggressive camp acquires an eligible player and emits aggro', () => {
    const c = camp('t2', CX, CZ, 12, true);
    const m = monster('goblin', c);
    const ev = kinds(stepMonster(m, world(CX, CZ + 8, DT, seeded(1), { camps: [c] })));
    expect(ev).toContain('aggro');
    expect(['chase', 'attack']).toContain(st(m));
  });

  it('T3: chase becomes attack within 2.9 for melee and 11.0 for ranged or magic', () => {
    const rand = seeded(2);
    const c = camp('t3', CX, CZ, 20, false);
    for (const [key, range] of [['goblin', 2.9], ['goblin_archer', 11.0], ['dark_wizard', 11.0]] as const) {
      const inside = monster(key, c);
      onPlayerHit(inside, 0);
      for (let i = 0; i < 3; i++) stepMonster(inside, world(CX + range - 0.1, CZ, 0.001, rand, { camps: [c] }));
      expect(st(inside), `${key} just inside ${range}`).toBe('attack');

      const outside = monster(key, c);
      onPlayerHit(outside, 0);
      for (let i = 0; i < 3; i++) stepMonster(outside, world(CX + range + 0.1, CZ, 0.001, rand, { camps: [c] }));
      expect(st(outside), `${key} just outside ${range}`).toBe('chase');
    }
  });

  it('T4: attack returns to chase beyond range', () => {
    const rand = seeded(3);
    const c = camp('t4', CX, CZ, 20, false);
    const m = monster('goblin', c);
    onPlayerHit(m, 0);
    for (let i = 0; i < 3; i++) stepMonster(m, world(CX + 2, CZ, 0.01, rand, { camps: [c] }));
    expect(st(m)).toBe('attack');
    for (let i = 0; i < 3; i++) stepMonster(m, world(CX + 6, CZ, 0.001, rand, { camps: [c] }));
    expect(st(m)).toBe('chase');
  });

  it('T5: chase or attack goes to return when the player is beyond 26, goes down, or turns safe in an aggressive camp', () => {
    const rand = seeded(4);
    const passive = camp('t5p', CX, CZ, 20, false);
    const aggressive = camp('t5a', CX, CZ, 20, true);

    const far = monster('goblin', passive);
    onPlayerHit(far, 0);
    stepMonster(far, world(CX + 27, CZ, DT, rand, { camps: [passive] }));
    expect(st(far), 'player beyond 26').toBe('return');

    const near = monster('goblin', passive);
    onPlayerHit(near, 0);
    stepMonster(near, world(CX + 25, CZ, DT, rand, { camps: [passive] }));
    expect(st(near), 'player at 25 stays a fight').toBe('chase');

    const down = monster('goblin', passive);
    onPlayerHit(down, 0);
    stepMonster(down, world(CX + 2, CZ, DT, rand, { camps: [passive], playerDown: true }));
    expect(st(down), 'player down').toBe('return');

    const safe = monster('goblin', aggressive);
    onPlayerHit(safe, 0);
    stepMonster(safe, world(CX + 5, CZ, DT, rand, { camps: [aggressive], playerSafe: true }));
    expect(st(safe), 'player safe, aggressive camp').toBe('return');

    const safePassive = monster('goblin', passive);
    onPlayerHit(safePassive, 0);
    stepMonster(safePassive, world(CX + 5, CZ, DT, rand, { camps: [passive], playerSafe: true }));
    expect(st(safePassive), 'player safe, passive camp fights on').toBe('chase');
  });

  it('T6: return becomes idle within 1.0 of home, with full HP and breathCount 0, and emits reset', () => {
    const rand = seeded(5);
    const c = camp('t6', CX, CZ, 6, false);
    const m = monster('goblin', c);
    leashed(m, c, rand);
    m.breathCount = 2;
    const r = runUntil(m, 10, () => world(0, 30, DT, rand, { camps: [c] }), (mm) => st(mm) !== 'return');
    expect(r.hit).toBe(true);
    expect(st(m)).toBe('idle');
    expect(r.ev).toContain('reset');
    expect(fromHome(m)).toBeLessThanOrEqual(1.0 + STEP);
    expect(m.hp).toBe(m.maxHp);
    expect(m.breathCount).toBe(0);
  });

  it('T7: a lethal hit sends a living monster to dying and emits died; a monster in return is spared', () => {
    const rand = seeded(6);
    const c = camp('t7', CX, CZ, 6, false);
    const m = monster('goblin', c);
    onPlayerHit(m, 0);
    stepMonster(m, world(CX + 2, CZ, DT, rand, { camps: [c] }));
    const r = onPlayerHit(m, m.maxHp);
    expect(r.applied).toBe(true);
    expect(kinds(r.events)).toContain('died');
    expect(st(m)).toBe('dying');
    expect(m.hp).toBe(0);

    const back = monster('goblin', c);
    leashed(back, c, rand);
    const hp = back.hp;
    const spared = onPlayerHit(back, back.maxHp);
    expect(spared.applied).toBe(false);
    expect(spared.events).toEqual([]);
    expect(st(back)).toBe('return');
    expect(back.hp).toBe(hp);
  });

  it('T8 and T9: dying lasts 0.85 s, dead 7.5 s, then idle at home with full HP', () => {
    const rand = seeded(7);
    const c = camp('t8', CX, CZ, 6, true);
    const m = monster('goblin', c);
    onPlayerHit(m, m.maxHp);
    const dt = 0.05;
    const run = (secs: number) => {
      const out: string[] = [];
      for (let i = 0; i < Math.round(secs / dt); i++) {
        out.push(...kinds(stepMonster(m, world(80, 80, dt, rand, { camps: [c] }))));
      }
      return out;
    };
    run(0.8);
    expect(st(m)).toBe('dying');
    run(0.1);
    expect(st(m)).toBe('dead');
    run(7.3);
    expect(st(m)).toBe('dead');
    expect(run(0.3)).toContain('respawned');
    expect(st(m)).toBe('idle');
    expect(m.hp).toBe(m.maxHp);
    expect(m.x).toBe(CX);
    expect(m.z).toBe(CZ);
  });
});

describe('monster territory: rules', () => {
  it('a passive camp never starts a fight', () => {
    const rand = seeded(10);
    const c = camp('passive', CX, CZ, 8, false);
    const m = monster('goblin', c);
    for (let i = 0; i < 600; i++) {
      // Player right next to it, eligible in every other way.
      const ev = stepMonster(m, world(m.x + 1, m.z + 1, 0.1, rand, { camps: [c], playerCombat: 1 }));
      expect(ev).toEqual([]);
      expect(st(m)).toBe('idle');
    }
    expect(m.hp).toBe(m.maxHp);
  });

  it('a passive monster in a safe zone attacked from inside it fights back and can be killed', () => {
    const rand = seeded(11);
    const c = camp('passive_safe', CX, CZ, 8, false);
    const m = monster('goblin', c);
    onPlayerHit(m, 0);
    const r = runUntil(
      m,
      2,
      () => world(CX + 2, CZ, DT, rand, { camps: [c], playerSafe: true }),
      (_mm, ev) => ev.includes('attack')
    );
    expect(r.hit, 'it fights back').toBe(true);
    expect(st(m)).toBe('attack');
    const kill = onPlayerHit(m, m.maxHp);
    expect(kill.applied).toBe(true);
    expect(kinds(kill.events)).toContain('died');
    expect(st(m)).toBe('dying');
  });

  it('an aggressive camp ignores a player whose combat level is above the monster\'s', () => {
    const rand = seeded(12);
    const c = camp('aggro_level', CX, CZ, 12, true);
    const above = monster('goblin', c);
    for (let i = 0; i < 50; i++) {
      expect(kinds(stepMonster(above, world(CX + 2, CZ, DT, rand, { camps: [c], playerCombat: above.level + 1 })))).toEqual([]);
    }
    expect(st(above)).toBe('idle');

    // Equal level is a yellow threat: it comes.
    const equal = monster('goblin', c);
    const ev = kinds(stepMonster(equal, world(CX + 2, CZ, DT, rand, { camps: [c], playerCombat: equal.level })));
    expect(ev).toContain('aggro');
    expect(st(equal)).not.toBe('idle');
  });

  it('acquires at aggroRadius and not beyond', () => {
    const rand = seeded(13);
    // Defaults: 9 for melee, 12 for ranged and magic; an explicit aggroRadius overrides them.
    const cases: [string, CampDef, number][] = [
      ['goblin', camp('ar_melee', CX, CZ, 20, true), 9],
      ['goblin_archer', camp('ar_ranged', CX, CZ, 20, true), 12],
      ['dark_wizard', camp('ar_magic', CX, CZ, 20, true), 12],
      ['goblin', camp('ar_explicit', CX, CZ, 20, true, 5), 5]
    ];
    for (const [key, c, radius] of cases) {
      const at = monster(key, c);
      const ev = kinds(stepMonster(at, world(CX, CZ + radius - 0.05, DT, rand, { camps: [c] })));
      expect(ev, `${key} in ${c.id} at ${radius}`).toContain('aggro');
      expect(st(at)).not.toBe('idle');

      const beyond = monster(key, c);
      for (let i = 0; i < 20; i++) {
        stepMonster(beyond, world(CX, CZ + radius + 0.05, DT, rand, { camps: [c] }));
      }
      expect(st(beyond), `${key} in ${c.id} beyond ${radius}`).toBe('idle');
    }
  });

  it('acquires only when the player is inside the camp radius', () => {
    const rand = seeded(14);
    const c = camp('small', CX, CZ, 6, true);
    const out = monster('goblin', c);
    for (let i = 0; i < 20; i++) stepMonster(out, world(CX, CZ + 7, DT, rand, { camps: [c] }));
    expect(st(out), 'within aggroRadius 9 but outside camp radius 6').toBe('idle');

    const inside = monster('goblin', c);
    expect(kinds(stepMonster(inside, world(CX, CZ + 5.9, DT, rand, { camps: [c] })))).toContain('aggro');
  });

  it('leashes at radius + 4, walks home and is at full HP on arrival', () => {
    // CALL-8: leashing applies to passive camps too.
    const rand = seeded(15);
    const c = camp('leash', CX, CZ, 6, false);
    expect(isWalkable(0, 30)).toBe(true);
    const m = monster('goblin', c);
    onPlayerHit(m, 1);
    const hp = m.hp;
    expect(hp).toBeLessThan(m.maxHp);
    const fromCentre = () => Math.hypot(m.x - c.x, m.z - c.z);

    let t = 0;
    while (st(m) !== 'return') {
      expect(fromCentre(), 'no leash inside radius + 4').toBeLessThanOrEqual(10 + STEP);
      stepMonster(m, world(0, 30, DT, rand, { camps: [c] }));
      t += DT;
      expect(t, 'leash reached').toBeLessThan(10);
      if (st(m) !== 'return') expect(fromCentre()).toBeLessThanOrEqual(10 + STEP);
    }
    expect(fromCentre()).toBeGreaterThanOrEqual(10 - STEP);
    expect(m.hp).toBe(hp);

    let reset = false;
    for (let i = 0; i < 500 && !reset; i++) {
      const before = fromHome(m);
      const px = m.x;
      const pz = m.z;
      const ev = kinds(stepMonster(m, world(0, 30, DT, rand, { camps: [c] })));
      reset = ev.includes('reset');
      expect(Math.hypot(m.x - px, m.z - pz), 'return speed 5.2').toBeLessThanOrEqual(STEP);
      if (!reset) {
        expect(st(m)).toBe('return');
        expect(fromHome(m)).toBeLessThan(before);
        expect(m.hp, 'no healing on the way').toBe(hp);
      }
    }
    expect(reset).toBe(true);
    expect(st(m)).toBe('idle');
    expect(fromHome(m)).toBeLessThanOrEqual(1.0 + STEP);
    expect(m.hp).toBe(m.maxHp);
  });

  it('gives up after 1.5 s of moving less than 0.2 against a wall', () => {
    // The castle's south wall spans z -17.7..-16.3 at x 1.7..9.1; the player stands inside the castle.
    const rand = seeded(16);
    const c = camp('wall', 5, -10, 30, false);
    expect(isWalkable(5, -10)).toBe(true);
    expect(isWalkable(5, -17)).toBe(false);
    const m = monster('goblin', c);
    onPlayerHit(m, 0);
    const w = () => world(5, -28, DT, rand, { camps: [c] });

    let t = 0;
    let stuckAt = -1;
    while (st(m) === 'chase') {
      const px = m.x;
      const pz = m.z;
      stepMonster(m, w());
      t += DT;
      expect(t, 'gave up in time').toBeLessThan(10);
      if (stuckAt < 0 && st(m) === 'chase' && Math.hypot(m.x - px, m.z - pz) < 1e-9) stuckAt = t;
    }
    expect(st(m)).toBe('return');
    expect(stuckAt, 'it reached the wall').toBeGreaterThan(0);
    expect(t - stuckAt, 'not before about 1.5 s against the wall').toBeGreaterThanOrEqual(1.4);
    expect(t - stuckAt, 'within two 1.5 s windows').toBeLessThanOrEqual(3.1);

    const home = runUntil(m, 10, w, (mm) => st(mm) !== 'return');
    expect(home.ev).toContain('reset');
    expect(st(m)).toBe('idle');
  });

  it('does not acquire during the 3-second grace or inside a safe zone', () => {
    const rand = seeded(17);
    const c = camp('grace', CX, CZ, 12, true);
    const m = monster('goblin', c);
    // The engine folds the 3-second grace (after load, respawn or teleport) into playerSafe.
    const grace = runUntil(
      m,
      3,
      (t) => world(m.x + 2, m.z, DT, rand, { camps: [c], playerSafe: t < 3 }),
      (_mm, ev) => ev.includes('aggro')
    );
    expect(grace.hit, 'no aggro during the grace').toBe(false);
    expect(st(m)).toBe('idle');

    for (let i = 0; i < 200; i++) {
      expect(kinds(stepMonster(m, world(m.x + 2, m.z, DT, rand, { camps: [c], playerSafe: true })))).toEqual([]);
    }
    expect(st(m), 'no aggro inside a safe zone').toBe('idle');

    expect(kinds(stepMonster(m, world(m.x + 2, m.z, DT, rand, { camps: [c], playerSafe: false })))).toContain('aggro');
  });

  it('attack cadence is 1.65 s', () => {
    const rand = seeded(18);
    const c = camp('cadence', CX, CZ, 12, true);
    const m = monster('goblin', c);
    const dt = 0.05;
    const times: number[] = [];
    for (let i = 1; i <= 140; i++) {
      for (const e of kinds(stepMonster(m, world(CX + 2, CZ, dt, rand, { camps: [c] })))) {
        if (e === 'attack') times.push(i * dt);
      }
    }
    expect(times.length).toBeGreaterThanOrEqual(4);
    expect(times[0]).toBeLessThanOrEqual(3 * dt + 1e-9);
    for (let i = 1; i < times.length; i++) {
      expect(Math.abs(times[i] - times[i - 1] - 1.65)).toBeLessThanOrEqual(dt + 1e-9);
    }
  });

  it('a monster in return cannot be damaged or re-acquired until home', () => {
    const rand = seeded(19);
    const c = camp('immune', CX, CZ, 6, true);
    const m = monster('goblin', c);
    leashed(m, c, rand);
    const hp = m.hp;

    // The player follows it back into the camp, eligible for aggression, and keeps hitting it.
    let reset = false;
    let atHome: string[] = [];
    for (let i = 0; i < 500 && !reset; i++) {
      const hit = onPlayerHit(m, 1);
      expect(hit.applied).toBe(false);
      expect(hit.events).toEqual([]);
      expect(m.hp).toBe(hp);
      const ev = kinds(stepMonster(m, world(m.x + 1, m.z + 1, DT, rand, { camps: [c] })));
      reset = ev.includes('reset');
      if (reset) {
        atHome = ev;
      } else {
        expect(ev).not.toContain('aggro');
        expect(st(m)).toBe('return');
      }
    }
    expect(reset).toBe(true);
    expect(fromHome(m)).toBeLessThanOrEqual(1.0 + STEP);

    // Home again: it can be acquired (on the arrival step or the one after).
    const next = kinds(stepMonster(m, world(m.x + 1, m.z + 1, DT, rand, { camps: [c] })));
    expect([...atHome, ...next]).toContain('aggro');
  });

  it('return emits reset at home with breathCount 0', () => {
    const rand = seeded(20);
    const c = camp('breath', CX, CZ, 6, true);
    const m = monster('goblin', c);
    leashed(m, c, rand);
    m.breathCount = 3;
    const r = runUntil(m, 10, () => world(0, 30, DT, rand, { camps: [c] }), (_mm, ev) => ev.includes('reset'));
    expect(r.hit).toBe(true);
    expect(st(m)).toBe('idle');
    expect(fromHome(m)).toBeLessThanOrEqual(1.0 + STEP);
    expect(m.breathCount).toBe(0);
    expect(m.hp).toBe(m.maxHp);
  });
});
