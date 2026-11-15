import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { getLevelForXp, OSRS_XP_TABLE } from '../src/data/skills';
import { CAMPS, isInSafeZone } from '../src/data/worldMap';
import { combatLevel, deathNotice } from '../src/state/adventure';
import { rollMonsterHit } from '../src/state/combat';
import { HP_REGEN_PER_SEC } from '../src/state/economy';
import { createDefaultState } from '../src/state/gameState';
import { createMonsterLogic, stepMonster } from '../src/state/monsterAi';
import { readSave, SAVE_KEY, serializeState, writeSave, type StorageLike } from '../src/state/save';
import {
  altarVowLine,
  applyDeathLoss,
  buyVow,
  canEat,
  COMBAT_REST_SECS,
  DEATH_MIN_COMBAT,
  DEATH_XP_SHARE,
  deathLoss,
  drink,
  eat,
  FIGHTING_SKILLS,
  FOOD_CD_SECS,
  HP_REGEN_RESTING_PER_SEC,
  POTION_CD_SECS,
  regenRate,
  shouldRetaliate,
  VOW_COINS_PER_XP,
  VOW_MIN_PRICE,
  vowPrice,
  vowRefusal
} from '../src/state/sustain';
import type { GameState } from '../src/state/types';

// Stage 4, task S1 (design 6.6 and 9.1 row G4.8; plan task S1; owner's approval note on CALL-4.17 (b)).
//
// Contract choices this file makes where the design leaves a shape open:
// - A cooldown clock is a small object the caller owns; a fresh one is `{ readyAt: 0 }`. Only behaviour at
//   given `now` values (seconds) is asserted, never the clock's fields.
// - `eat` and `drink` return `{ ok, reason, restored? }`, the shape of `applyCommand`.
// - `deathLoss(state)` returns a record keyed by exactly the six `FIGHTING_SKILLS`.
// - `applyDeathLoss(state)` returns `{ kind: 'none' }`, `{ kind: 'vow' }`, `{ kind: 'waived' }` or
//   `{ kind: 'lost', amounts }` (amounts keyed by fighting skill). `waived` is the fourth case of CALL-4.17 (b):
//   a total loss under a quarter of what the vow can guard (the summed `floor(DEATH_XP_SHARE x span)` over the
//   skills below 99, before the 250-coin floor) costs nothing and leaves the vow, held or not.

const T = OSRS_XP_TABLE;
const span = (L: number): number => T[L + 1] - T[L];
const cap = (L: number): number => Math.floor(DEATH_XP_SHARE * span(L));

const TODAY_NOTICE = {
  title: 'Oh dear, you are dead.',
  body: 'You keep your gear and coins. You will wake in Lumbridge Haven.'
};

type Clock = { readyAt: number };
const newClock = (): Clock => ({ readyAt: 0 });

/** Experience at `f` of level L's span, kept inside the level (100% is the level's last point). */
function xpAt(L: number, f: number): number {
  return T[L] + Math.min(span(L) - 1, Math.floor(f * span(L)));
}

function setSkill(s: GameState, key: string, L: number, xp: number): void {
  s.skills[key] = { xp, lvl: L };
  if (key === 'hitpoints') {
    s.maxHp = L;
    s.hp = Math.min(s.hp, L);
  }
}

/** A hero with every fighting skill at `levels[k]` (default `base`), `f` of the way through each level. */
function hero(base: number, f = 0.5, levels: Record<string, number> = {}): GameState {
  const s = createDefaultState();
  for (const k of FIGHTING_SKILLS) {
    const L = levels[k] ?? base;
    setSkill(s, k, L, xpAt(L, f));
  }
  s.hp = s.maxHp;
  return s;
}

/** What the vow can guard: the summed share of spans over the fighting skills below 99. */
function guardable(s: GameState): number {
  let sum = 0;
  for (const k of FIGHTING_SKILLS) if (s.skills[k].lvl < 99) sum += cap(s.skills[k].lvl);
  return sum;
}

function snapshot(s: GameState): string {
  return JSON.stringify({ ...s, activePrayers: [...s.activePrayers] });
}

function memStorage(items: Record<string, string> = {}): StorageLike {
  const m = new Map(Object.entries(items));
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

function stable(json: string): Record<string, unknown> {
  const o = JSON.parse(json);
  delete o.savedAt;
  return o;
}

function total(amounts: Record<string, number>): number {
  return Object.values(amounts).reduce((a, n) => a + n, 0);
}

describe('food and potion cooldowns', () => {
  it('the cooldowns are 1.8 s each', () => {
    expect(FOOD_CD_SECS).toBe(1.8);
    expect(POTION_CD_SECS).toBe(1.8);
  });

  it('a second meal inside the cooldown is refused and consumes nothing; at the cooldown it is accepted', () => {
    const s = createDefaultState();
    s.hp = 2;
    const slot = s.inventory.findIndex((it) => it.id === 'cooked_chicken');
    const clock = newClock();
    const t0 = 100;
    expect(canEat(clock, t0)).toBe(true);

    const first = eat(s, slot, clock, t0);
    expect(first.ok).toBe(true);
    expect(first.restored).toBe(5);
    expect(s.hp).toBe(7);
    expect(s.inventory[slot]).toEqual({ id: 'cooked_chicken', qty: 2 });

    const before = snapshot(s);
    expect(canEat(clock, t0 + 1)).toBe(false);
    const refused = eat(s, slot, clock, t0 + 1);
    expect(refused.ok).toBe(false);
    expect(refused.reason.length).toBeGreaterThan(0);
    expect(snapshot(s)).toBe(before);

    // The refused meal did not push the clock back.
    expect(canEat(clock, t0 + FOOD_CD_SECS)).toBe(true);
    const again = eat(s, slot, clock, t0 + FOOD_CD_SECS);
    expect(again.ok).toBe(true);
    expect(s.hp).toBe(10);
    expect(s.inventory[slot]).toEqual({ id: 'cooked_chicken', qty: 1 });
  });

  it('a potion has its own clock: drinking right after a meal is accepted, a second drink inside its cooldown is not', () => {
    const s = createDefaultState();
    s.hp = 2;
    s.skills.prayer = { xp: T[40], lvl: 40 };
    s.maxPrayerPts = 40;
    s.prayerPts = 5;
    const food = newClock();
    const potion = newClock();
    const meal = s.inventory.findIndex((it) => it.id === 'shrimp');
    const vial = s.inventory.findIndex((it) => it.id === 'prayer_potion');
    expect(eat(s, meal, food, 50).ok).toBe(true);

    const drank = drink(s, vial, potion, 50.1);
    expect(drank.ok).toBe(true);
    expect(drank.restored).toBe(18);
    expect(s.prayerPts).toBe(23);
    expect(s.inventory[vial]).toEqual({ id: 'prayer_potion', qty: 1 });

    const before = snapshot(s);
    expect(drink(s, vial, potion, 50.1 + POTION_CD_SECS - 0.01).ok).toBe(false);
    expect(snapshot(s)).toBe(before);
    expect(drink(s, vial, potion, 50.1 + POTION_CD_SECS).ok).toBe(true);
    expect(s.prayerPts).toBe(40);
  });

  it('eat refuses a potion and drink refuses a meal, changing nothing', () => {
    const s = createDefaultState();
    s.hp = 2;
    const meal = s.inventory.findIndex((it) => it.id === 'shrimp');
    const vial = s.inventory.findIndex((it) => it.id === 'prayer_potion');
    const before = snapshot(s);
    expect(eat(s, vial, newClock(), 10).ok).toBe(false);
    expect(drink(s, meal, newClock(), 10).ok).toBe(false);
    expect(eat(s, 999, newClock(), 10).ok).toBe(false);
    expect(snapshot(s)).toBe(before);
  });
});

describe('regeneration', () => {
  it('is Stage 3 constant within 6 s of combat and the resting rate from then on', () => {
    expect(COMBAT_REST_SECS).toBe(6);
    expect(HP_REGEN_PER_SEC).toBe(0.25);
    expect(HP_REGEN_RESTING_PER_SEC).toBe(1.0);
    expect(regenRate(0)).toBe(HP_REGEN_PER_SEC);
    expect(regenRate(3)).toBe(HP_REGEN_PER_SEC);
    expect(regenRate(5.99)).toBe(HP_REGEN_PER_SEC);
    expect(regenRate(COMBAT_REST_SECS)).toBe(HP_REGEN_RESTING_PER_SEC);
    expect(regenRate(6.01)).toBe(HP_REGEN_RESTING_PER_SEC);
    expect(regenRate(1e6)).toBe(HP_REGEN_RESTING_PER_SEC);
  });

  it('is never 0', () => {
    for (let t = 0; t <= 20; t += 0.25) expect(regenRate(t), `t=${t}`).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------- the Stage 2 gate with regeneration
// Rebuilt from CAMPS and stepMonster, importing nothing from the frozen tests/gate-simulation.test.ts but with
// its generator, seeds and runner. Regeneration follows docs/superpowers/research/combat-model/decisions.ts
// section 2 (applied before the monsters step, capped at maxHp; the 40-hitpoint runner has maxHp 40), which
// measured 4.5% / 4.4% / 4.4% on seeds 1 to 1,000 and 3.66% pooled over seeds 1 to 10,000.

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

const RUN_SPEED = 11.5;
const DT = 1 / 60;
const START_X = -8;
const END_X = -80;
const LINES = [55, 52.5, 57.5];

const sentryCamp = (() => {
  const camp = CAMPS.find((c) => c.id === 'pass_sentries');
  if (!camp) throw new Error('sustain: no pass_sentries camp in CAMPS');
  return camp;
})();

function fresh(): GameState {
  return createDefaultState();
}

function prayedForty(): GameState {
  const s = createDefaultState();
  s.skills.hitpoints.lvl = 40;
  s.maxHp = 40;
  s.hp = 40;
  s.activePrayers.add('prot_melee');
  return s;
}

type Regen = 'constant' | 'timer';

/** One crossing. Returns survival and the longest gap between two blows (seconds; 0 with fewer than two). */
function crossing(make: () => GameState, lineZ: number, seed: number, regen: Regen): { survived: boolean; maxGap: number } {
  const rand = seeded(seed);
  const state = make();
  const playerCombat = combatLevel(state);
  const sentries = sentryCamp.members.map((mem) => {
    const m = createMonsterLogic(mem.type, mem.x, mem.z, { campId: sentryCamp.id, wander: mem.wander });
    m.wanderTimer = rand() * 3;
    return m;
  });
  let hp = state.hp;
  let px = START_X;
  let clock = 0;
  let lastBlow = -1;
  let maxGap = 0;
  let sinceCombat = COMBAT_REST_SECS + 1;
  while (px > END_X) {
    px = Math.max(END_X, px - RUN_SPEED * DT);
    const rate = regen === 'constant' ? HP_REGEN_PER_SEC : regenRate(sinceCombat);
    if (hp < state.maxHp) hp = Math.min(state.maxHp, hp + rate * DT);
    sinceCombat += DT;
    clock += DT;
    const world = {
      playerX: px,
      playerZ: lineZ,
      playerDown: hp <= 0,
      dt: DT,
      rand,
      playerCombat,
      playerSafe: isInSafeZone(px, lineZ),
      camps: CAMPS
    };
    for (const m of sentries) {
      for (const ev of stepMonster(m, world)) {
        if (ev.kind !== 'attack') continue;
        if (lastBlow >= 0) maxGap = Math.max(maxGap, clock - lastBlow);
        lastBlow = clock;
        sinceCombat = 0;
        m.breathCount += 1;
        hp -= rollMonsterHit(m.typeKey, m.breathCount, state, rand).dmg;
      }
    }
    if (hp <= 0) return { survived: false, maxGap };
  }
  return { survived: true, maxGap };
}

describe('the Stage 2 gate with hitpoints regenerating by regenRate of a combat timer', () => {
  const freshAlive = new Map<number, number[]>(); // line -> survivors per block of 1,000 seeds (10 blocks)
  const mismatches: string[] = [];
  let worstGap = 0;
  let pooledAlive = 0;
  let pooledRuns = 0;
  const prayedDeaths: string[] = [];

  beforeAll(() => {
    for (const z of LINES) {
      const blocks: number[] = [];
      for (let b = 0; b < 10; b++) {
        let n = 0;
        for (let seed = b * 1000 + 1; seed <= b * 1000 + 1000; seed++) {
          const timed = crossing(fresh, z, seed, 'timer');
          const constant = crossing(fresh, z, seed, 'constant');
          if (timed.survived !== constant.survived) mismatches.push(`fresh z=${z} seed ${seed}`);
          worstGap = Math.max(worstGap, timed.maxGap);
          if (timed.survived) n++;
        }
        blocks.push(n);
        pooledAlive += n;
        pooledRuns += 1000;
      }
      freshAlive.set(z, blocks);
      for (let seed = 1; seed <= 1000; seed++) {
        const timed = crossing(prayedForty, z, seed, 'timer');
        const constant = crossing(prayedForty, z, seed, 'constant');
        if (timed.survived !== constant.survived) mismatches.push(`prayed z=${z} seed ${seed}`);
        worstGap = Math.max(worstGap, timed.maxGap);
        if (!timed.survived) prayedDeaths.push(`z=${z} seed ${seed}`);
      }
    }
  }, 30_000);

  it('every seed gives the same outcome as a run at a constant HP_REGEN_PER_SEC', () => {
    expect(mismatches).toEqual([]);
  });

  it('a fresh runner survives fewer than 5% of seeds 1 to 1,000 on each line', () => {
    for (const z of LINES) {
      const firstBlock = freshAlive.get(z)![0];
      expect(firstBlock / 1000, `line z=${z}`).toBeLessThan(0.05);
    }
  });

  it('a fresh runner survives fewer than 5% of seeds 1 to 10,000 pooled over the three lines', () => {
    expect(pooledRuns).toBe(30_000);
    expect(pooledAlive / pooledRuns).toBeLessThan(0.05);
  });

  it('the runner with 40 hitpoints and Protect from Melee survives every crossing', () => {
    expect(prayedDeaths).toEqual([]);
  });

  it('no gap between two blows in any crossing reaches COMBAT_REST_SECS', () => {
    expect(worstGap).toBeGreaterThan(0);
    expect(worstGap).toBeLessThan(COMBAT_REST_SECS);
  });
});

// ---------------------------------------------------------------- death

describe('deathLoss', () => {
  it('is all zeros at combat level 14 and not at 15', () => {
    const s14 = hero(13, 0.5, { ranged: 1, magic: 1 });
    expect(combatLevel(s14)).toBe(14);
    expect(DEATH_MIN_COMBAT).toBe(15);
    const loss14 = deathLoss(s14);
    expect(Object.keys(loss14).sort()).toEqual([...FIGHTING_SKILLS].sort());
    expect(Object.values(loss14).every((n) => n === 0)).toBe(true);

    const s15 = hero(13, 0.5, { ranged: 1, magic: 1, hitpoints: 14 });
    expect(combatLevel(s15)).toBe(15);
    expect(total(deathLoss(s15))).toBeGreaterThan(0);
  });

  it('the fighting skills are the six combat skills, and the share is 3%', () => {
    expect([...FIGHTING_SKILLS].sort()).toEqual(['attack', 'defence', 'hitpoints', 'magic', 'ranged', 'strength']);
    expect(DEATH_XP_SHARE).toBe(0.03);
  });

  it('for every fighting skill, level 1 to 98 and 0%, 1%, 50%, 100% and 1% plus 0.5: bounded, whole, never a level', () => {
    const failures: string[] = [];
    for (const k of FIGHTING_SKILLS) {
      for (let L = 1; L <= 98; L++) {
        const xps = [xpAt(L, 0), xpAt(L, 0.01), xpAt(L, 0.5), xpAt(L, 1), xpAt(L, 0.01) + 0.5];
        for (const xp of xps) {
          const s = hero(40);
          setSkill(s, k, L, xp);
          expect(combatLevel(s)).toBeGreaterThanOrEqual(DEATH_MIN_COMBAT);
          const loss = deathLoss(s)[k];
          const inside = xp - T[L];
          const ok =
            Number.isFinite(loss) &&
            Number.isInteger(loss) &&
            loss >= 0 &&
            loss <= inside &&
            loss <= cap(L) &&
            loss === Math.min(Math.floor(inside), cap(L)) &&
            getLevelForXp(xp - loss) === L;
          if (!ok) failures.push(`${k} L${L} xp ${xp}: loss ${loss}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('a skill at 99, at its floor and 5,000,000 past it, loses nothing and adds nothing to the vow price', () => {
    for (const k of FIGHTING_SKILLS) {
      for (const xp of [T[99], T[99] + 5_000_000]) {
        const s = hero(60);
        setSkill(s, k, 99, xp);
        expect(deathLoss(s)[k], `${k} xp ${xp}`).toBe(0);
        const others = FIGHTING_SKILLS.filter((o) => o !== k).reduce((a, o) => a + cap(60), 0);
        expect(vowPrice(s), `${k} xp ${xp}`).toBe(Math.max(VOW_MIN_PRICE, VOW_COINS_PER_XP * others));
      }
    }
  });
});

describe('applyDeathLoss', () => {
  it('without a vow takes the loss from the fighting skills only, and returns lost with the amounts taken', () => {
    const s = hero(40);
    s.skills.prayer = { xp: xpAt(40, 0.5), lvl: 40 };
    s.skills.woodcutting = { xp: xpAt(30, 0.5), lvl: 30 };
    s.gp = 12_345;
    const before = structuredClone({ ...s, activePrayers: [...s.activePrayers] });
    const expected = deathLoss(s);
    expect(total(expected)).toBeGreaterThanOrEqual(guardable(s) / 4);

    const out = applyDeathLoss(s);
    expect(out.kind).toBe('lost');
    if (out.kind !== 'lost') return;
    for (const k of FIGHTING_SKILLS) {
      expect(out.amounts[k], k).toBe(before.skills[k].xp - s.skills[k].xp);
      expect(out.amounts[k], k).toBe(expected[k]);
      expect(s.skills[k].lvl, k).toBe(before.skills[k].lvl);
      expect(getLevelForXp(s.skills[k].xp), k).toBe(before.skills[k].lvl);
    }
    for (const k of Object.keys(s.skills)) {
      if ((FIGHTING_SKILLS as readonly string[]).includes(k)) continue;
      expect(s.skills[k], k).toEqual(before.skills[k]);
    }
    expect(s.inventory).toEqual(before.inventory);
    expect(s.bank).toEqual(before.bank);
    expect(s.equipment).toEqual(before.equipment);
    expect(s.gp).toBe(12_345);
    expect(s.maxHp).toBe(before.maxHp);
  });

  it('calling it twice loses twice (the caller guards re-entry)', () => {
    const s = hero(50);
    const start = Object.fromEntries(FIGHTING_SKILLS.map((k) => [k, s.skills[k].xp]));
    const a = applyDeathLoss(s);
    const b = applyDeathLoss(s);
    expect(a.kind).toBe('lost');
    expect(b.kind).toBe('lost');
    if (a.kind !== 'lost' || b.kind !== 'lost') return;
    for (const k of FIGHTING_SKILLS) {
      expect(s.skills[k].xp, k).toBe(start[k] - a.amounts[k] - b.amounts[k]);
      expect(b.amounts[k], k).toBeGreaterThan(0);
    }
  });

  it('with a vow and something to lose: changes no experience, deletes the vow and returns vow', () => {
    const s = hero(50);
    s.quests.lanternVow = true;
    const before = snapshot(s);
    const xp = Object.fromEntries(FIGHTING_SKILLS.map((k) => [k, s.skills[k].xp]));
    const out = applyDeathLoss(s);
    expect(out.kind).toBe('vow');
    for (const k of FIGHTING_SKILLS) expect(s.skills[k].xp, k).toBe(xp[k]);
    expect(Object.hasOwn(s.quests, 'lanternVow')).toBe(false);
    const after = JSON.parse(snapshot(s));
    const was = JSON.parse(before);
    delete was.quests.lanternVow;
    expect(after).toEqual(was);
  });

  it('with nothing to lose returns none and keeps the vow (no experience inside any level)', () => {
    const s = hero(40, 0);
    s.quests.lanternVow = true;
    const before = snapshot(s);
    expect(applyDeathLoss(s)).toEqual({ kind: 'none' });
    expect(s.quests.lanternVow).toBe(true);
    expect(snapshot(s)).toBe(before);
  });

  it('below combat 15 returns none and keeps the vow', () => {
    const s = hero(13, 0.5, { ranged: 1, magic: 1 });
    expect(combatLevel(s)).toBe(14);
    s.quests.lanternVow = true;
    const before = snapshot(s);
    expect(applyDeathLoss(s)).toEqual({ kind: 'none' });
    expect(snapshot(s)).toBe(before);
  });

  it('a loss under a quarter of what the vow can guard costs nothing and leaves the vow (CALL-4.17 b)', () => {
    // Every fighting skill at the first point of level 40, except Attack two points in: the loss is 2.
    const make = (vow: boolean): GameState => {
      const s = hero(40, 0);
      setSkill(s, 'attack', 40, T[40] + 2);
      if (vow) s.quests.lanternVow = true;
      return s;
    };
    const probe = make(false);
    expect(guardable(probe)).toBeGreaterThanOrEqual(VOW_MIN_PRICE);
    expect(total(deathLoss(probe))).toBe(2);
    expect(2).toBeLessThan(guardable(probe) / 4);

    for (const vow of [true, false]) {
      const s = make(vow);
      const before = snapshot(s);
      const out = applyDeathLoss(s);
      expect(out, `vow ${vow}`).toEqual({ kind: 'waived' });
      expect(snapshot(s), `vow ${vow}`).toBe(before);
    }
  });

  it('a loss well over a quarter of what the vow can guard is taken, or spends the vow', () => {
    // Three of six skills halfway through level 40, three at the level's first point: loss is half the guard.
    const make = (vow: boolean): GameState => {
      const s = hero(40, 0);
      for (const k of ['attack', 'strength', 'defence']) setSkill(s, k, 40, xpAt(40, 0.5));
      if (vow) s.quests.lanternVow = true;
      return s;
    };
    const probe = make(false);
    expect(total(deathLoss(probe))).toBe(guardable(probe) / 2);
    expect(applyDeathLoss(make(false)).kind).toBe('lost');
    const held = make(true);
    expect(applyDeathLoss(held).kind).toBe('vow');
    expect(Object.hasOwn(held.quests, 'lanternVow')).toBe(false);
  });
});

describe('the Lantern Vow', () => {
  it('vowPrice is one coin per point the vow can guard, and at least 250', () => {
    expect(VOW_COINS_PER_XP).toBe(1);
    expect(VOW_MIN_PRICE).toBe(250);
    const high = hero(50);
    expect(guardable(high)).toBeGreaterThan(VOW_MIN_PRICE);
    expect(vowPrice(high)).toBe(VOW_COINS_PER_XP * guardable(high));
    // Just past a level-up the price is still the full guard: it is what the vow can guard, not the loss now.
    expect(vowPrice(hero(50, 0))).toBe(vowPrice(high));

    const low = hero(13, 0.5, { ranged: 1, magic: 1, hitpoints: 14 });
    expect(guardable(low)).toBeLessThan(VOW_MIN_PRICE);
    expect(vowPrice(low)).toBe(VOW_MIN_PRICE);
  });

  it('buyVow refuses below combat 15, when a vow is held, and when coins are short, and then changes nothing', () => {
    const young = hero(13, 0.5, { ranged: 1, magic: 1 });
    young.gp = 1_000_000;
    const cases: [string, GameState][] = [['combat 14', young]];

    const holding = hero(50);
    holding.gp = 1_000_000;
    holding.quests.lanternVow = true;
    cases.push(['held', holding]);

    const poor = hero(50);
    poor.gp = vowPrice(poor) - 1;
    cases.push(['short', poor]);

    for (const [label, s] of cases) {
      const before = snapshot(s);
      expect(buyVow(s).ok, label).toBe(false);
      expect(snapshot(s), label).toBe(before);
    }
  });

  it('buyVow, when it accepts, takes exactly the price and holds the vow', () => {
    for (const extra of [0, 7, 1_000_000]) {
      const s = hero(50);
      const price = vowPrice(s);
      s.gp = price + extra;
      expect(buyVow(s).ok, `extra ${extra}`).toBe(true);
      expect(s.gp).toBe(extra);
      expect(Number.isFinite(s.gp) && s.gp >= 0).toBe(true);
      expect(s.quests.lanternVow).toBe(true);
    }
  });

  it('buyVow refuses a hero with every fighting skill at 99, whom the vow guards nothing, and changes nothing (review finding 2)', () => {
    const maxed = createDefaultState();
    for (const k of FIGHTING_SKILLS) setSkill(maxed, k, 99, T[99]);
    maxed.hp = maxed.maxHp;
    maxed.gp = 1_000_000;
    expect(combatLevel(maxed)).toBeGreaterThanOrEqual(DEATH_MIN_COMBAT);
    expect(guardable(maxed)).toBe(0);
    const before = snapshot(maxed);
    const res = buyVow(maxed);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('You risk nothing yet.');
    expect(snapshot(maxed)).toBe(before);
    expect(vowRefusal(maxed)).toBe('You risk nothing yet.');
    const ready = hero(50);
    ready.gp = vowPrice(ready);
    expect(vowRefusal(ready)).toBeNull();
  });

  it('the altar line after a prayer matches what the right-click menu offers (review finding 3)', () => {
    const young = hero(13, 0.5, { ranged: 1, magic: 1 });
    young.gp = 1_000_000;
    expect(altarVowLine(young)).toBe('You risk nothing yet.');

    const holding = hero(50);
    holding.quests.lanternVow = true;
    expect(altarVowLine(holding)).toBeNull();

    const poor = hero(50);
    const price = vowPrice(poor);
    poor.gp = 100;
    expect(vowRefusal(poor)).not.toBeNull();
    expect(altarVowLine(poor)).toBe(`A Lantern Vow costs ${price} coins. You need ${price - 100} more coins.`);

    const ready = hero(50);
    ready.gp = price;
    expect(vowRefusal(ready)).toBeNull();
    expect(altarVowLine(ready)).toBe(`A Lantern Vow costs ${price} coins. Right-click the Altar to take the vow.`);
  });
});

// ---------------------------------------------------------------- the saved flag (design 6.6, "One new saved value")

describe('quests.lanternVow in the save', () => {
  it('a state holding the vow keeps it through writeSave and readSave', () => {
    const s = hero(50);
    s.quests.lanternVow = true;
    const storage = memStorage();
    writeSave(storage, s, null, null);
    expect(readSave(storage)?.state.quests.lanternVow).toBe(true);
  });

  it('the default state serialises with no lanternVow key, equal to the Stage 3 golden', () => {
    const json = serializeState(createDefaultState(), null, null);
    expect(Object.hasOwn(JSON.parse(json).quests, 'lanternVow')).toBe(false);
    const golden = JSON.parse(readFileSync(new URL('./fixtures/s3/default-state.golden.json', import.meta.url), 'utf8'));
    expect(stable(json)).toEqual(golden);
  });

  it('the Stage 1 version-4 fixture loads with no vow', () => {
    const raw = readFileSync(new URL('./fixtures/save-v4.json', import.meta.url), 'utf8');
    const loaded = readSave(memStorage({ [SAVE_KEY]: raw }));
    expect(loaded).not.toBeNull();
    expect(Object.hasOwn(loaded!.state.quests, 'lanternVow')).toBe(false);
  });

  it('false, 1, "true", null and {} each load as not held', () => {
    for (const value of [false, 1, 'true', null, {}]) {
      const data = JSON.parse(serializeState(createDefaultState(), null, null));
      data.quests.lanternVow = value;
      const loaded = readSave(memStorage({ [SAVE_KEY]: JSON.stringify(data) }));
      expect(Object.hasOwn(loaded!.state.quests, 'lanternVow'), JSON.stringify(value)).toBe(false);
    }
  });

  it('a state that took and then spent a vow has no key (deleted, not undefined or false)', () => {
    const s = hero(50);
    s.gp = 1_000_000;
    expect(buyVow(s).ok).toBe(true);
    expect(applyDeathLoss(s).kind).toBe('vow');
    expect(Object.hasOwn(s.quests, 'lanternVow')).toBe(false);
    const json = serializeState(s, null, null);
    expect(json.includes('lanternVow')).toBe(false);
  });
});

// ---------------------------------------------------------------- the notice

describe('deathNotice', () => {
  function checkCommon(n: { title: string; body: string }, label: string): void {
    expect(n.title, label).toBe(TODAY_NOTICE.title);
    expect(n.body, label).toMatch(/Lumbridge/);
    expect(n.body.startsWith('You keep your gear and coins'), label).toBe(true);
    expect(n.body.replace(/no level was lost/g, ''), label).not.toMatch(/level (?:was|is) lost|lost (?:a|one) level/i);
  }

  it('with no argument and with none it is today notice', () => {
    expect(deathNotice()).toEqual(TODAY_NOTICE);
    expect(deathNotice({ kind: 'none' })).toEqual(TODAY_NOTICE);
  });

  it('vow: no experience was lost and the vow is spent', () => {
    const s = hero(50);
    s.quests.lanternVow = true;
    const out = applyDeathLoss(s);
    expect(out.kind).toBe('vow');
    const n = deathNotice(out);
    checkCommon(n, 'vow');
    expect(n.body).toContain('no experience was lost');
    expect(n.body).toMatch(/vow is spent/);
  });

  it('lost: names the exact total and says no level was lost', () => {
    const s = hero(50);
    const out = applyDeathLoss(s);
    expect(out.kind).toBe('lost');
    if (out.kind !== 'lost') return;
    const sum = total(out.amounts);
    expect(sum).toBeGreaterThan(1000);
    const n = deathNotice(out);
    checkCommon(n, 'lost');
    expect(n.body.includes(`${sum} experience`) || n.body.includes(`${sum.toLocaleString('en-US')} experience`)).toBe(true);
    expect(n.body).toContain('no level was lost');
  });

  it('waived: says no experience was lost and spends nothing', () => {
    const s = hero(40, 0);
    setSkill(s, 'attack', 40, T[40] + 2);
    s.quests.lanternVow = true;
    const out = applyDeathLoss(s);
    expect(out.kind).toBe('waived');
    const n = deathNotice(out);
    checkCommon(n, 'waived');
    expect(n.body).toContain('no experience was lost');
    expect(n.body).not.toMatch(/spent/);
    expect(n.body).not.toEqual(TODAY_NOTICE.body);
  });
});

// ---------------------------------------------------------------- retaliation

describe('shouldRetaliate', () => {
  it('is true only for an idle hero, and false whenever a wind-up on the hero is live', () => {
    const keys = ['hasTarget', 'walking', 'keyHeld', 'downed', 'windupLive'] as const;
    for (let mask = 0; mask < 32; mask++) {
      const input = Object.fromEntries(keys.map((k, i) => [k, (mask & (1 << i)) !== 0])) as Record<(typeof keys)[number], boolean>;
      expect(shouldRetaliate(input), JSON.stringify(input)).toBe(mask === 0);
      if (input.windupLive) expect(shouldRetaliate(input)).toBe(false);
    }
  });
});
