import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { isWalkable } from '../src/state/collision';
import { createDefaultState } from '../src/state/gameState';
import { migrateLegacySave, readSave, SAVE_KEY, writeSave, type StorageLike } from '../src/state/save';

const MAX = 2147483647;
const CORRUPT_KEY = 'gielinor_hero_save_v1_corrupt';

function memStorage(initial: Record<string, string> = {}): StorageLike & { store: Map<string, string> } {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    store,
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => { store.set(k, v); },
    removeItem: (k) => { store.delete(k); }
  };
}

const readFixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const hostile = () => migrateLegacySave(readFixture('save-hostile.json'), SAVE_KEY);
const withPos = (x: number, z: number) => migrateLegacySave({ playerPos: { x, y: 0, z, yaw: 0 } }, SAVE_KEY);

describe('save round trip', () => {
  it('writeSave then readSave round-trips gp, skills, bank, slayer task, claimed quests, prayers, spell and special energy', () => {
    const s = createDefaultState();
    s.gp = 12345;
    s.skills.mining = { xp: 5000, lvl: 0 };
    s.bank = [{ id: 'logs', qty: 7 }];
    s.quests.slayer = { monster: 'goblin', name: 'Goblin Raider', remaining: 3, total: 6 };
    s.quests.claimed = ['lumbridge'];
    s.activePrayers = new Set(['prot_melee']);
    s.activeSpell = 'fire_bolt';
    s.specEnergy = 55;
    const storage = memStorage();
    writeSave(storage, s, { x: 8, y: 0, z: 10, yaw: 0.5 }, null);
    const r = readSave(storage)!;
    expect(r.state.gp).toBe(12345);
    expect(r.state.skills.mining.xp).toBe(5000);
    expect(r.state.bank).toEqual([{ id: 'logs', qty: 7 }]);
    expect(r.state.quests.slayer).toEqual({ monster: 'goblin', name: 'Goblin Raider', remaining: 3, total: 6 });
    expect(r.state.quests.claimed).toEqual(['lumbridge']);
    expect(Array.from(r.state.activePrayers)).toEqual(['prot_melee']);
    expect(r.state.activeSpell).toBe('fire_bolt');
    expect(r.state.specEnergy).toBe(55);
  });

  it('the captured version-4 save loads to its recorded values', () => {
    const raw = readFixture('save-v4.json');
    const m = migrateLegacySave(raw, SAVE_KEY);
    expect(m.state.gp).toBe(201000);
    expect(m.state.activeSpell).toBe('fire_bolt');
    expect(m.state.specEnergy).toBeCloseTo(81.6, 3);
    expect(m.state.hp).toBe(50);
    expect(m.state.currentRegion).toBe('lumbridge');
    expect(m.state.equipment.weapon).toBe('fire_staff');
    expect(m.state.inventory.find((i) => i.id === 'air_rune')?.qty).toBe(80);
    expect(m.state.bank.map((i) => i.id)).toEqual(['hylian_hood', 'hylian_tunic', 'hylian_trousers']);
    expect(Array.from(m.state.activePrayers)).toEqual(['prot_melee']);
    expect(m.state.quests.claimed).toEqual(['lumbridge']);
    expect(m.state.quests.slayer).toEqual({ monster: 'moss_guardian', name: 'Moss Guardian', remaining: 4, total: 4 });
    expect(m.pose).toEqual({ x: 8, y: 0, z: 10, yaw: 0.48 });
  });
});

describe('hostile saves', () => {
  it('hostile save: Infinity position becomes finite and walkable', () => {
    const { pose } = hostile();
    expect(pose).not.toBeNull();
    expect(Number.isFinite(pose!.x)).toBe(true);
    expect(Number.isFinite(pose!.z)).toBe(true);
    expect(isWalkable(pose!.x, pose!.z)).toBe(true);
  });

  it('position inside the castle keep is moved to walkable ground', () => {
    const { pose } = withPos(0, -28);
    expect(pose).not.toBeNull();
    expect(isWalkable(pose!.x, pose!.z)).toBe(true);
    expect(Math.hypot(pose!.x, pose!.z + 28)).toBeLessThanOrEqual(12.5);
  });

  it('position in the river is moved to walkable ground', () => {
    const x = 28 + Math.sin(10 * 0.05) * 8;
    const { pose } = withPos(x, 10);
    expect(pose).not.toBeNull();
    expect(isWalkable(pose!.x, pose!.z)).toBe(true);
    expect(Math.hypot(pose!.x - x, pose!.z - 10)).toBeLessThanOrEqual(12.5);
  });

  it('unknown region becomes lumbridge', () => {
    expect(hostile().state.currentRegion).toBe('lumbridge');
  });

  it('constructor as an item or equipment id is dropped', () => {
    const { state } = hostile();
    expect(state.inventory.some((s) => !Object.hasOwn(ITEMS, s.id))).toBe(false);
    expect(state.bank).toEqual([]);
    expect(state.equipment.weapon).not.toBe('constructor');
    expect(state.equipment.head).not.toBe('__proto__');
    expect(state.equipment.weapon === null || Object.hasOwn(ITEMS, state.equipment.weapon as string)).toBe(true);
  });

  it('slayer task name comes from the catalog, not the save', () => {
    expect(hostile().state.quests.slayer).toEqual({ monster: 'goblin', name: 'Goblin Raider', remaining: 3, total: 6 });
    const bad = migrateLegacySave({ quests: { slayer: { monster: 'nope', name: 'x', remaining: 1, total: 1 } } }, SAVE_KEY);
    expect(bad.state.quests.slayer).toBeNull();
  });

  it('qty 1e999 and gp 1e308 are finite and at most 2147483647 (the 1e999 slot is dropped)', () => {
    const { state } = hostile();
    expect(Number.isFinite(state.gp)).toBe(true);
    expect(state.gp).toBeLessThanOrEqual(MAX);
    expect(state.inventory.find((s) => s.id === 'air_rune')).toBeUndefined();
    const mind = state.inventory.find((s) => s.id === 'mind_rune');
    expect(mind).toBeDefined();
    expect(Number.isFinite(mind!.qty)).toBe(true);
    expect(mind!.qty).toBeLessThanOrEqual(MAX);
    for (const v of [state.hp, state.prayerPts, state.specEnergy]) expect(Number.isFinite(v)).toBe(true);
  });

  it('a slot with no qty still loads with qty 1', () => {
    expect(hostile().state.inventory.find((s) => s.id === 'feather')?.qty).toBe(1);
  });

  it('unknown activeSpell becomes wind_strike', () => {
    expect(hostile().state.activeSpell).toBe('wind_strike');
  });

  it('unknown claimed quest ids are dropped and duplicates removed', () => {
    expect(hostile().state.quests.claimed).toEqual(['lumbridge']);
  });

  it('non-integer or negative timeOfDay becomes 0', () => {
    expect(hostile().state.timeOfDay).toBe(0);
    expect(migrateLegacySave({ timeOfDay: -1 }, SAVE_KEY).state.timeOfDay).toBe(0);
    expect(migrateLegacySave({ timeOfDay: 2 }, SAVE_KEY).state.timeOfDay).toBe(2);
  });
});

describe('corrupt-save guard', () => {
  it('readSave copies a non-parsing main save to gielinor_hero_save_v1_corrupt and reports corrupt', () => {
    const storage = memStorage({ [SAVE_KEY]: '{not json' });
    const r = readSave(storage);
    expect(r?.corrupt).toBe(true);
    expect(storage.store.get(CORRUPT_KEY)).toBe('{not json');
  });

  it('readSave does not overwrite an existing corrupt backup', () => {
    const storage = memStorage({ [SAVE_KEY]: '{second', [CORRUPT_KEY]: '{first' });
    const r = readSave(storage);
    expect(r?.corrupt).toBe(true);
    expect(storage.store.get(CORRUPT_KEY)).toBe('{first');
  });

  it('a corrupt main save next to a valid legacy save reports corrupt and does not load the legacy save', () => {
    const storage = memStorage({ [SAVE_KEY]: '{not json', runewilds_save_v3: JSON.stringify({ gp: 77, inventory: [] }) });
    const r = readSave(storage);
    expect(r?.corrupt).toBe(true);
    expect(r?.state.gp).not.toBe(77);
  });

  it('every valid save reports corrupt false', () => {
    const s = createDefaultState();
    const main = memStorage();
    writeSave(main, s, null, null);
    expect(readSave(main)?.corrupt).toBe(false);
    expect(readSave(memStorage({ runewilds_save_v3: JSON.stringify({ gp: 77, inventory: [] }) }))?.corrupt).toBe(false);
    expect(migrateLegacySave(readFixture('save-v4.json'), SAVE_KEY).corrupt).toBe(false);
  });
});
