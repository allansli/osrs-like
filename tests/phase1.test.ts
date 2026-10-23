import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { performCraft } from '../src/data/recipes';
import { getLevelForXp } from '../src/data/skills';
import { WORLD_REGIONS, type RegionDef } from '../src/data/world';
import { isWalkable, riverCenterX } from '../src/state/collision';
import { canUseStyle, equippedWeapon, mitigateDamage, prepareAttack } from '../src/state/combat';
import { createDefaultState } from '../src/state/gameState';
import { addItem, countItem, deposit, resolveQty, withdraw } from '../src/state/inventory';
import { migrateLegacySave, readSave, SAVE_KEY } from '../src/state/save';
import { discoverShrines, isShrineDiscovered, shrineWorldPos } from '../src/state/shrines';
import type { GameState } from '../src/state/types';

function fresh(): GameState {
  const state = createDefaultState();
  state.inventory = [];
  state.bank = [];
  state.gp = 5000;
  return state;
}

describe('legacy save migration', () => {
  it('keeps levels, XP, gold, and equipment, and stacks duplicate goods', () => {
    const migrated = migrateLegacySave({
      gp: 4321,
      xpMultiplier: 1,
      combatStyle: 'ranged',
      skills: {
        attack: { xp: 83, lvl: 1 },
        hitpoints: { xp: 1154, lvl: 10 }
      },
      equipment: {
        weapon: 'bronze_scimitar',
        head: 'bronze_helm',
        body: 'bronze_plate',
        legs: 'bronze_legs',
        shield: null
      },
      inventory: [
        { id: 'logs', qty: 1 },
        { id: 'logs', qty: 1 },
        { id: 'bones', qty: 1 },
        { id: 'bones', qty: 2 },
        { id: 'air_rune', qty: 5 },
        { id: 'air_rune', qty: 7 },
        { id: 'bronze_plate', qty: 1 },
        { id: 'bronze_plate', qty: 1 }
      ]
    }, 'runewilds_save_v3');

    expect(migrated.state.gp).toBe(4321);
    expect(migrated.state.xpMultiplier).toBe(1);
    expect(migrated.state.combatStyle).toBe('rapid');
    expect(migrated.state.skills.attack.xp).toBe(83);
    expect(migrated.state.skills.attack.lvl).toBe(getLevelForXp(83));
    expect(migrated.state.skills.hitpoints.lvl).toBe(10);
    expect(migrated.state.equipment.weapon).toBe('bronze_scimitar');
    expect(migrated.state.equipment.shield).toBeNull();
    expect(migrated.state.equipment.cape).toBe('hylian_cape');
    expect(countItem(migrated.state, 'logs')).toBe(2);
    expect(countItem(migrated.state, 'bones')).toBe(3);
    expect(countItem(migrated.state, 'air_rune')).toBe(12);
    expect(migrated.state.inventory.filter((slot) => slot.id === 'logs')).toHaveLength(1);
    expect(migrated.state.inventory.filter((slot) => slot.id === 'bronze_plate')).toHaveLength(2);
    expect(migrated.state.bank).toEqual([]);
    expect(migrated.state.shrines.lumbridge).toBe(true);
    expect(migrated.state.shrines.varrock).toBe(false);
    expect(migrated.state.shrines.desert).toBe(false);
    expect(migrated.state.shrines.woods).toBe(false);
    expect(migrated.state.shrines.wilderness).toBe(false);
    expect(migrated.migratedFrom).toBe('runewilds_save_v3');
  });

  it('reads a v3 payload when the new key is empty', () => {
    const storage = {
      store: new Map<string, string>([['runewilds_save_v3', JSON.stringify({ gp: 77, inventory: [] })]]),
      getItem(key: string) { return this.store.get(key) ?? null; },
      setItem(key: string, value: string) { this.store.set(key, value); },
      removeItem(key: string) { this.store.delete(key); }
    };
    const loaded = readSave(storage);
    expect(loaded?.state.gp).toBe(77);
    expect(SAVE_KEY).toBe('gielinor_hero_save_v1');
  });
});

describe('bank transfers', () => {
  it('moves 1, 5, 10, and All without dropping the rest', () => {
    const state = fresh();
    addItem(state, 'logs', 40);
    expect(resolveQty(10, 40)).toBe(10);
    expect(deposit(state, 'logs', 1).moved).toBe(1);
    expect(countItem(state, 'logs')).toBe(39);
    expect(deposit(state, 'logs', 5).moved).toBe(5);
    expect(deposit(state, 'logs', 10).moved).toBe(10);
    expect(countItem(state, 'logs')).toBe(24);
    expect(deposit(state, 'logs', 'all').moved).toBe(24);
    expect(countItem(state, 'logs')).toBe(0);
    expect(state.bank.find((slot) => slot.id === 'logs')?.qty).toBe(40);

    expect(withdraw(state, 'logs', 10).moved).toBe(10);
    expect(withdraw(state, 'logs', 'all').moved).toBe(30);
    expect(state.bank.find((slot) => slot.id === 'logs')).toBeUndefined();
    expect(countItem(state, 'logs')).toBe(40);
  });

  it('holds every matched armor set in the vault', () => {
    const state = fresh();
    const pairs = Object.values(ITEMS).filter((item) => item.slot === 'body' && item.pairId);
    expect(pairs).toHaveLength(33);
    for (const body of pairs) {
      expect(addItem(state, body.id, 1).ok).toBe(true);
      expect(deposit(state, body.id, 'all').ok).toBe(true);
      expect(addItem(state, String(body.pairId), 1).ok).toBe(true);
      expect(deposit(state, String(body.pairId), 'all').ok).toBe(true);
    }
    expect(state.bank.length).toBe(66);
    expect(state.inventory).toHaveLength(0);
  });

  it('refuses a drop when the backpack cannot take it', () => {
    const state = fresh();
    for (let i = 0; i < 28; i++) expect(addItem(state, 'bronze_plate', 1).ok).toBe(true);
    const before = state.gp;
    expect(addItem(state, 'logs', 1).ok).toBe(false);
    expect(state.gp).toBe(before);
    expect(countItem(state, 'logs')).toBe(0);
  });
});

describe('weapon-locked combat styles', () => {
  it('locks melee, rapid, and magic to the equipped weapon', () => {
    const state = fresh();
    state.equipment.weapon = 'bronze_scimitar';
    expect(canUseStyle('accurate', equippedWeapon(state), state).ok).toBe(true);
    expect(canUseStyle('controlled', equippedWeapon(state), state).ok).toBe(true);
    expect(canUseStyle('rapid', equippedWeapon(state), state).ok).toBe(false);
    expect(canUseStyle('magic', equippedWeapon(state), state).ok).toBe(false);

    state.equipment.weapon = null;
    expect(canUseStyle('aggressive', equippedWeapon(state), state).ok).toBe(true);
    expect(canUseStyle('rapid', equippedWeapon(state), state).ok).toBe(false);

    state.equipment.weapon = 'shortbow';
    addItem(state, 'bronze_arrow', 3);
    expect(canUseStyle('rapid', equippedWeapon(state), state).ok).toBe(true);
    expect(canUseStyle('accurate', equippedWeapon(state), state).ok).toBe(false);
    state.inventory = state.inventory.filter((slot) => slot.id !== 'bronze_arrow');
    expect(canUseStyle('rapid', equippedWeapon(state), state).ok).toBe(false);

    state.equipment.weapon = 'fire_staff';
    state.activeSpell = 'wind_strike';
    state.combatStyle = 'magic';
    addItem(state, 'air_rune', 2);
    addItem(state, 'mind_rune', 2);
    expect(canUseStyle('magic', equippedWeapon(state), state).ok).toBe(true);
    expect(prepareAttack(state).consume).toEqual([
      { id: 'air_rune', qty: 1 },
      { id: 'mind_rune', qty: 1 }
    ]);
    expect(canUseStyle('accurate', equippedWeapon(state), state).ok).toBe(false);
  });
});

describe('protect from ranged', () => {
  it('reduces ranged hits the same way the other overheads reduce their styles', () => {
    const prayers = new Set(['prot_ranged']);
    expect(mitigateDamage(10, 'ranged', prayers)).toBe(2);
    expect(mitigateDamage(10, 'rapid', prayers)).toBe(2);
    expect(mitigateDamage(10, 'ranged', new Set(['prot_melee']))).toBe(10);
    expect(mitigateDamage(10, 'melee', new Set(['prot_melee']))).toBe(2);
    expect(mitigateDamage(10, 'magic', new Set(['prot_magic']))).toBe(2);
  });
});

describe('shrine discovery', () => {
  it('starts with Lumbridge and reveals a shrine only when the player walks up to it', () => {
    const state = fresh();
    expect(isShrineDiscovered(state.shrines, 'lumbridge')).toBe(true);
    expect(isShrineDiscovered(state.shrines, 'varrock')).toBe(false);
    const far = discoverShrines(0, 0, state.shrines);
    expect(far.unlocked).toEqual([]);
    const varrock = (WORLD_REGIONS as RegionDef[]).find((region) => region.id === 'varrock');
    expect(varrock).toBeTruthy();
    const shrine = shrineWorldPos(varrock!);
    const near = discoverShrines(shrine.x, shrine.z, state.shrines);
    expect(near.unlocked).toContain('varrock');
    expect(near.shrines.varrock).toBe(true);
    expect(near.shrines.desert).toBe(false);
  });
});

describe('movement collision', () => {
  it('blocks the river and castle walls and leaves the bridge and gate open', () => {
    expect(isWalkable(4, 12)).toBe(true);
    expect(isWalkable(28, 0)).toBe(true);
    expect(isWalkable(riverCenterX(40), 40)).toBe(false);
    expect(isWalkable(0, -34)).toBe(false);
    expect(isWalkable(0, -28)).toBe(false);
    expect(isWalkable(0, -17)).toBe(true);
    expect(isWalkable(0, -23)).toBe(true);
  });
});

describe('log sink', () => {
  it('burns logs for cooking and shapes oak into a shortbow', () => {
    const state = fresh();
    addItem(state, 'logs', 1);
    const burned = performCraft(state, 'burn_logs');
    expect(burned.ok).toBe(true);
    expect(countItem(state, 'logs')).toBe(0);
    expect(countItem(state, 'ashes')).toBe(1);
    expect(state.quests.burnedLog).toBe(true);
    expect(state.skills.cooking.xp).toBeGreaterThan(0);

    state.skills.smithing = { xp: 500, lvl: 20 };
    addItem(state, 'oak_logs', 1);
    const bow = performCraft(state, 'fletch_shortbow');
    expect(bow.ok).toBe(true);
    expect(countItem(state, 'oak_logs')).toBe(0);
    expect(countItem(state, 'shortbow')).toBe(1);
    expect(ITEMS.maple_logs.name).toBe('Maple Logs');
  });
});
