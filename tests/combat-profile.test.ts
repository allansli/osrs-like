import { describe, expect, it } from 'vitest';
import { MONSTER_TYPES } from '../src/data/world';
import { monsterHitChance, playerAttackProfile, playerHitChance, rollMonsterHit } from '../src/state/combat';
import { createDefaultState } from '../src/state/gameState';
import type { GameState } from '../src/state/types';

// Red until E2 (missing exports only). Every expected value is written out from the expression the
// engine uses today (src/engine/actions.ts performPlayerAttack, "just before the special-attack
// block", and src/state/combat.ts rollMonsterHit); none is read back from the new functions.

type Setup = {
  style?: string;
  weapon?: string | null;
  head?: string;
  body?: string;
  legs?: string;
  prayers?: string[];
  spell?: string;
  strength?: number;
  hp?: number;
};

function make(o: Setup = {}): GameState {
  const s = createDefaultState();
  if (o.style) s.combatStyle = o.style;
  if (o.weapon !== undefined) s.equipment.weapon = o.weapon;
  if (o.head) s.equipment.head = o.head;
  if (o.body) s.equipment.body = o.body;
  if (o.legs) s.equipment.legs = o.legs;
  if (o.prayers) s.activePrayers = new Set(o.prayers);
  if (o.spell) s.activeSpell = o.spell;
  if (o.strength) s.skills.strength.lvl = o.strength;
  if (o.hp !== undefined) s.hp = o.hp;
  return s;
}

function expectProfile(s: GameState, maxHit: number, accuracy: number): void {
  const p = playerAttackProfile(s);
  expect(p.maxHit).toBe(maxHit);
  expect(p.accuracy).toBeCloseTo(accuracy, 9);
}

describe('playerAttackProfile', () => {
  // Melee (actions.ts 95-115): maxHit = max(2, floor((1.5 + (str + styleStr) * 0.32 + bon.str * 0.22) * prayStr)),
  // then max(2, floor(maxHit * dharok)); accuracy = (atk + styleAtk) * 1.35 + bon.atk + 12.
  // bronze_scimitar: atk 7, str 6. Levels 1/1.
  it('default state, accurate: max hit 3, accuracy 25.75', () => expectProfile(make(), 3, 25.75));
  it('default state, aggressive: max hit 3, accuracy 20.35', () => expectProfile(make({ style: 'aggressive' }), 3, 20.35));
  it('default state, controlled: max hit 3, accuracy 23.05', () => expectProfile(make({ style: 'controlled' }), 3, 23.05));
  it('default state, defensive: max hit 3, accuracy 20.35', () => expectProfile(make({ style: 'defensive' }), 3, 20.35));

  // burst_str x1.15 and piety x1.25 scale the strength term only: floor(3.14 * 1.15) = 3, floor(3.14 * 1.25) = 3.
  it('default state with burst_str', () => expectProfile(make({ prayers: ['burst_str'] }), 3, 25.75));
  it('default state with piety', () => expectProfile(make({ prayers: ['piety'] }), 3, 25.75));

  // Ranged (rapid): maxHit = max(2, floor((2 + rng * 0.35 + bon.rng * 0.22) * prayRng)), accuracy = rng * 1.4 + bon.rng + 12.
  // shortbow: rng 16. floor(2 + 0.35 + 3.52) = 5; 1.4 + 16 + 12 = 29.4.
  it('shortbow on rapid: max hit 5, accuracy 29.4', () => expectProfile(make({ style: 'rapid', weapon: 'shortbow' }), 5, 29.4));
  // sharp_eye x1.20: floor(5.87 * 1.2) = 7.
  it('shortbow on rapid with sharp_eye: max hit 7', () =>
    expectProfile(make({ style: 'rapid', weapon: 'shortbow', prayers: ['sharp_eye'] }), 7, 29.4));

  // Magic: maxHit = max(3, floor((spell.maxHit + mag * 0.22 + bon.mag * 0.18) * prayMag)), accuracy = mag * 1.5 + bon.mag + 16.
  // fire_staff: mag 24. wind_strike 6: floor(6 + 0.22 + 4.32) = 10; 1.5 + 24 + 16 = 41.5.
  it('fire_staff on magic with wind_strike: max hit 10, accuracy 41.5', () =>
    expectProfile(make({ style: 'magic', weapon: 'fire_staff', spell: 'wind_strike' }), 10, 41.5));
  // fire_bolt 13: floor(13 + 0.22 + 4.32) = 17.
  it('fire_staff on magic with fire_bolt: max hit 17', () =>
    expectProfile(make({ style: 'magic', weapon: 'fire_staff', spell: 'fire_bolt' }), 17, 41.5));
  // mystic_might x1.20: floor(10.54 * 1.2) = 12.
  it('fire_staff on magic with wind_strike and mystic_might: max hit 12', () =>
    expectProfile(make({ style: 'magic', weapon: 'fire_staff', spell: 'wind_strike', prayers: ['mystic_might'] }), 12, 41.5));

  // Strength 40, rune_scimitar + rune_plate + rune_legs: matched pair, bonuses x1.10 rounded up:
  // atk ceil(47 * 1.1) = 52, str ceil(46 * 1.1) = 51. maxHit floor(1.5 + 40 * 0.32 + 51 * 0.22) = floor(25.52) = 25;
  // accuracy (1 + 4) * 1.35 + 52 + 12 = 70.75.
  it('Strength 40 in rune: max hit 25, accuracy 70.75', () =>
    expectProfile(make({ strength: 40, weapon: 'rune_scimitar', body: 'rune_plate', legs: 'rune_legs' }), 25, 70.75));
  // piety: floor(25.52 * 1.25) = 31.
  it('Strength 40 in rune with piety: max hit 31', () =>
    expectProfile(
      make({ strength: 40, weapon: 'rune_scimitar', body: 'rune_plate', legs: 'rune_legs', prayers: ['piety'] }), 31, 70.75));

  // Dharok set: weapon atk 76 str 88, body str 8, legs str 6, helm str 5, pair bonus x1.10: atk 84, str 118.
  // maxHit floor(1.5 + 0.32 + 118 * 0.22) = 27; accuracy 5 * 1.35 + 84 + 12 = 102.75.
  // At half health the multiplier is 1 + 0.5 * 0.85 = 1.425: floor(27 * 1.425) = 38.
  const dharok = { weapon: 'dharok_greataxe', head: 'dharok_helm', body: 'dharok_body', legs: 'dharok_legs' };
  it('full Dharok at full health: max hit 27, accuracy 102.75', () => expectProfile(make(dharok), 27, 102.75));
  it('full Dharok at half health: max hit 38', () => expectProfile(make({ ...dharok, hp: 5 }), 38, 102.75));

  // Bare hands: no weapon, bonuses 0: max(2, floor(1.5 + 0.32)) = 2; accuracy 5 * 1.35 + 12 = 18.75.
  it('bare hands: max hit 2, accuracy 18.75', () => expectProfile(make({ weapon: null }), 2, 18.75));
});

describe('playerHitChance', () => {
  // actions.ts 173-174: min(0.94, max(0.22, accuracy / (accuracy + (def * 1.1 + 4) * 0.75))).
  const expected = (accuracy: number, def: number): number =>
    Math.min(0.94, Math.max(0.22, accuracy / (accuracy + (def * 1.1 + 4) * 0.75)));

  for (const [key, mon] of Object.entries(MONSTER_TYPES)) {
    it(`matches the expression against ${key}`, () => {
      expect(playerHitChance(25.75, mon.def)).toBeCloseTo(expected(25.75, mon.def), 12);
    });
  }

  it('goblin (def 2) at accuracy 25.75 is 25.75 / (25.75 + 6.2 * 0.75)', () => {
    expect(playerHitChance(25.75, 2)).toBeCloseTo(25.75 / (25.75 + 4.65), 12);
  });
  it('clamps at 0.94 above and 0.22 below', () => {
    expect(playerHitChance(1e6, 1)).toBe(0.94);
    expect(playerHitChance(0.01, 99)).toBe(0.22);
  });
});

describe('monsterHitChance', () => {
  // combat.ts rollMonsterHit: monAtk = atk * 1.25 + 8; playerDef = (defLvl * 1.2 + bon.def) * prayDef + 10;
  // chance = min(0.82, max(0.12, monAtk / (monAtk + playerDef))). defLvl gains 3 on the defensive style.
  // Default state: Defence 1, bronze_scimitar (def 0), so playerDef = 11.2.
  it('default state against a goblin (atk 3): 11.75 / (11.75 + 11.2)', () => {
    expect(monsterHitChance('goblin', createDefaultState())).toBeCloseTo(11.75 / 22.95, 12);
  });
  it('default state against a hill giant (atk 26): 40.5 / (40.5 + 11.2)', () => {
    expect(MONSTER_TYPES.hill_giant.atk).toBe(26);
    expect(monsterHitChance('hill_giant', createDefaultState())).toBeCloseTo(40.5 / 51.7, 12);
  });
  it('default state against a lesser demon (atk 64): 88 / 99.2 = 0.887 is clamped to 0.82', () => {
    expect(MONSTER_TYPES.lesser_demon.atk).toBe(64);
    expect(monsterHitChance('lesser_demon', createDefaultState())).toBe(0.82);
  });
  it('thick_skin x1.15: playerDef = 1.2 * 1.15 + 10 = 11.38', () => {
    const s = make({ prayers: ['thick_skin'] });
    expect(monsterHitChance('goblin', s)).toBeCloseTo(11.75 / (11.75 + 11.38), 12);
  });
  it('piety x1.25: playerDef = 1.2 * 1.25 + 10 = 11.5', () => {
    const s = make({ prayers: ['piety'] });
    expect(monsterHitChance('goblin', s)).toBeCloseTo(11.75 / (11.75 + 11.5), 12);
  });
  it('defensive style adds 3 levels: playerDef = 4 * 1.2 + 10 = 14.8', () => {
    const s = make({ style: 'defensive' });
    expect(monsterHitChance('goblin', s)).toBeCloseTo(11.75 / (11.75 + 14.8), 12);
  });
  it('clamps at 0.82 and 0.12', () => {
    // Ceiling: lesser_demon (atk 64) against Defence 1 is 0.887 unclamped.
    expect(monsterHitChance('lesser_demon', createDefaultState())).toBe(0.82);
    // Floor: chicken (atk 1) against Defence 99 is about 0.067 unclamped.
    const tank = createDefaultState();
    tank.skills.defence.lvl = 99;
    expect(monsterHitChance('chicken', tank)).toBe(0.12);
  });
});

describe('rollMonsterHit random draws', () => {
  function scripted(values: number[]): { rand: () => number; draws: () => number } {
    let i = 0;
    return {
      rand: () => {
        if (i >= values.length) throw new Error('rand drawn more often than scripted');
        return values[i++];
      },
      draws: () => i
    };
  }

  it('a hit takes two draws: the hit roll, then floor(draw * (maxHit + 1)) for damage', () => {
    // lesser_demon maxHit from the table; damage draw 0.999 gives the maximum, 0 gives the minimum of 1.
    const max = MONSTER_TYPES.lesser_demon.maxHit;
    const top = scripted([0, 0.999]);
    expect(rollMonsterHit('lesser_demon', 1, createDefaultState(), top.rand).dmg).toBe(Math.floor(0.999 * (max + 1)));
    expect(top.draws()).toBe(2);
    const low = scripted([0, 0]);
    expect(rollMonsterHit('lesser_demon', 1, createDefaultState(), low.rand).dmg).toBe(1);
    expect(low.draws()).toBe(2);
  });

  it('a miss takes one draw', () => {
    const miss = scripted([0.9999]);
    const r = rollMonsterHit('goblin', 1, createDefaultState(), miss.rand);
    expect(r.dmg).toBe(0);
    expect(miss.draws()).toBe(1);
  });

  it('the hit roll compares with the hit chance (draw just under hits, just over misses)', () => {
    const p = 11.75 / 22.95;
    expect(rollMonsterHit('goblin', 1, createDefaultState(), scripted([p - 1e-9, 0.5]).rand).dmg).toBeGreaterThan(0);
    expect(rollMonsterHit('goblin', 1, createDefaultState(), scripted([p + 1e-9]).rand).dmg).toBe(0);
  });

  it('the third breath of Elvarg draws the hit roll and one fire roll', () => {
    const fire = scripted([0, 0.5]);
    const r = rollMonsterHit('elvarg_dragon', 3, createDefaultState(), fire.rand);
    expect(r.dragonfire).toBe(true);
    expect(fire.draws()).toBe(2);
  });
});
