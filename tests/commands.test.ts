import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { OSRS_XP_TABLE } from '../src/data/skills';
import { weaponSpecial } from '../src/state/adventure';
import { canUseStyle } from '../src/state/combat';
import { applyCommand, type PlayerCommand } from '../src/state/commands';
import { createDefaultState } from '../src/state/gameState';
import { FOOD_CD_SECS, POTION_CD_SECS } from '../src/state/sustain';
import type { GameState } from '../src/state/types';

// Stage 4, task S1 (design section 7 and 9.1 row G4.10): the five state commands go through one pure
// `applyCommand(state, cmd, clocks, now)`, which returns `{ ok, reason, restored? }`.
// Contract choice: `clocks` is `{ food, potion }`, each a caller-owned clock whose fresh value is `{ readyAt: 0 }`;
// only behaviour at given `now` values (seconds) is asserted.

type Clocks = { food: { readyAt: number }; potion: { readyAt: number } };
const newClocks = (): Clocks => ({ food: { readyAt: 0 }, potion: { readyAt: 0 } });

function snapshot(s: GameState): string {
  return JSON.stringify({ ...s, activePrayers: [...s.activePrayers] });
}

function refusedUnchanged(s: GameState, cmd: PlayerCommand, clocks: Clocks, now: number): { ok: boolean; reason: string } {
  const before = snapshot(s);
  const r = applyCommand(s, cmd, clocks, now);
  expect(r.ok, JSON.stringify(cmd)).toBe(false);
  expect(r.reason.length, JSON.stringify(cmd)).toBeGreaterThan(0);
  expect(snapshot(s), JSON.stringify(cmd)).toBe(before);
  return r;
}

function withPrayer(level: number, points: number): GameState {
  const s = createDefaultState();
  s.skills.prayer = { xp: OSRS_XP_TABLE[level], lvl: level };
  s.maxPrayerPts = level;
  s.prayerPts = points;
  return s;
}

describe('applyCommand: eat', () => {
  it('accepts a meal, restores its heal and consumes one', () => {
    const s = createDefaultState();
    s.hp = 3;
    const slot = s.inventory.findIndex((it) => it.id === 'cooked_chicken');
    const r = applyCommand(s, { kind: 'eat', slot }, newClocks(), 20);
    expect(r.ok).toBe(true);
    expect(r.restored).toBe(5);
    expect(s.hp).toBe(8);
    expect(s.inventory[slot]).toEqual({ id: 'cooked_chicken', qty: 2 });
  });

  it('refuses a meal inside the food cooldown without consuming it, and accepts it at the cooldown', () => {
    const s = createDefaultState();
    s.hp = 2;
    const slot = s.inventory.findIndex((it) => it.id === 'shrimp');
    const clocks = newClocks();
    expect(applyCommand(s, { kind: 'eat', slot }, clocks, 20).ok).toBe(true);
    refusedUnchanged(s, { kind: 'eat', slot }, clocks, 20 + FOOD_CD_SECS - 0.01);
    expect(applyCommand(s, { kind: 'eat', slot }, clocks, 20 + FOOD_CD_SECS).ok).toBe(true);
    expect(s.hp).toBe(10);
  });

  it('refuses a slot that holds no food', () => {
    const s = createDefaultState();
    s.hp = 2;
    const vial = s.inventory.findIndex((it) => it.id === 'prayer_potion');
    refusedUnchanged(s, { kind: 'eat', slot: vial }, newClocks(), 5);
    refusedUnchanged(s, { kind: 'eat', slot: 999 }, newClocks(), 5);
  });
});

describe('applyCommand: drink', () => {
  it('accepts a potion and restores prayer, on its own clock after a meal', () => {
    const s = withPrayer(40, 5);
    s.hp = 2;
    const clocks = newClocks();
    const meal = s.inventory.findIndex((it) => it.id === 'shrimp');
    const vial = s.inventory.findIndex((it) => it.id === 'prayer_potion');
    expect(applyCommand(s, { kind: 'eat', slot: meal }, clocks, 30).ok).toBe(true);
    const r = applyCommand(s, { kind: 'drink', slot: vial }, clocks, 30);
    expect(r.ok).toBe(true);
    expect(r.restored).toBe(18);
    expect(s.prayerPts).toBe(23);
    expect(s.inventory[vial]).toEqual({ id: 'prayer_potion', qty: 1 });
  });

  it('refuses a second potion inside its cooldown, changing nothing', () => {
    const s = withPrayer(40, 5);
    const clocks = newClocks();
    const vial = s.inventory.findIndex((it) => it.id === 'prayer_potion');
    expect(applyCommand(s, { kind: 'drink', slot: vial }, clocks, 30).ok).toBe(true);
    refusedUnchanged(s, { kind: 'drink', slot: vial }, clocks, 30 + POTION_CD_SECS - 0.01);
  });
});

describe('applyCommand: prayer', () => {
  it('turns a prayer on and off, and notes that a prayer was offered', () => {
    const s = withPrayer(1, 1);
    expect(s.quests.offeredPrayer).toBe(false);
    expect(applyCommand(s, { kind: 'prayer', id: 'thick_skin' }, newClocks(), 0).ok).toBe(true);
    expect(s.activePrayers.has('thick_skin')).toBe(true);
    expect(s.quests.offeredPrayer).toBe(true);
    expect(applyCommand(s, { kind: 'prayer', id: 'thick_skin' }, newClocks(), 0).ok).toBe(true);
    expect(s.activePrayers.has('thick_skin')).toBe(false);
  });

  it('one overhead prayer replaces another', () => {
    const s = withPrayer(30, 30);
    expect(applyCommand(s, { kind: 'prayer', id: 'prot_magic' }, newClocks(), 0).ok).toBe(true);
    expect(applyCommand(s, { kind: 'prayer', id: 'prot_melee' }, newClocks(), 0).ok).toBe(true);
    expect([...s.activePrayers]).toEqual(['prot_melee']);
  });

  it('refuses a prayer below its level with today message', () => {
    const s = withPrayer(29, 29);
    const r = refusedUnchanged(s, { kind: 'prayer', id: 'prot_melee' }, newClocks(), 0);
    expect(r.reason).toBe('You need <b>Prayer Level 30</b> to activate Protect from Melee.');
  });

  it('refuses a prayer with no points with today message', () => {
    const s = withPrayer(40, 0);
    const r = refusedUnchanged(s, { kind: 'prayer', id: 'thick_skin' }, newClocks(), 0);
    expect(r.reason).toBe('You have no Prayer points left! Recharge at any Sacred Altar.');
  });

  it('refuses an unknown prayer', () => {
    refusedUnchanged(withPrayer(99, 99), { kind: 'prayer', id: 'no_such_prayer' }, newClocks(), 0);
  });
});

describe('applyCommand: style', () => {
  it('accepts a style the weapon allows', () => {
    const s = createDefaultState();
    expect(s.equipment.weapon).toBe('bronze_scimitar');
    expect(applyCommand(s, { kind: 'style', style: 'aggressive' }, newClocks(), 0).ok).toBe(true);
    expect(s.combatStyle).toBe('aggressive');
  });

  it('refuses a style the weapon does not allow, with the reason canUseStyle gives', () => {
    const s = createDefaultState();
    const expected = canUseStyle('magic', ITEMS.bronze_scimitar, s).reason;
    expect(expected.length).toBeGreaterThan(0);
    const r = refusedUnchanged(s, { kind: 'style', style: 'magic' }, newClocks(), 0);
    expect(r.reason).toBe(expected);
  });
});

describe('applyCommand: special', () => {
  it('arms and disarms the special attack when there is energy', () => {
    const s = createDefaultState();
    s.specEnergy = 100;
    expect(applyCommand(s, { kind: 'special' }, newClocks(), 0).ok).toBe(true);
    expect(s.specArmed).toBe(true);
    expect(applyCommand(s, { kind: 'special' }, newClocks(), 0).ok).toBe(true);
    expect(s.specArmed).toBe(false);
  });

  it('refuses without enough energy, with today message', () => {
    const s = createDefaultState();
    const spec = weaponSpecial(s.equipment.weapon);
    s.specEnergy = spec.cost - 1;
    s.specArmed = false;
    const r = refusedUnchanged(s, { kind: 'special' }, newClocks(), 0);
    expect(r.reason).toBe(`You need at least ${spec.cost}% Special Attack energy for <b>${spec.name}</b>!`);
  });
});

describe('purity of the new state modules', () => {
  it('every src/state file Stage 4 added exists and mentions no STATE, Math.random, Date.now, performance, document or window', () => {
    for (const name of ['sustain.ts', 'commands.ts', 'monsterPattern.ts', 'soundPlan.ts', 'telegraph.ts']) {
      const url = new URL(`../src/state/${name}`, import.meta.url);
      expect(existsSync(url), name).toBe(true);
      const text = readFileSync(url, 'utf8');
      expect(text, name).not.toMatch(/\bSTATE\b|Math\.random|Date\.now|\bperformance\b|\bdocument\b|\bwindow\b/);
      expect(text, name).not.toMatch(/from\s+['"][^'"]*\/(?:engine|ui)\//);
    }
  });
});
