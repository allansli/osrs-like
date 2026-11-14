import { describe, expect, it } from 'vitest';
import { getLevelForXp, OSRS_XP_TABLE } from '../src/data/skills';
import { claimQuest, registerKill } from '../src/state/adventure';
import { createDefaultState } from '../src/state/gameState';
import { buyItem, buyRunePack, isGatheredGood, sellInventoryMatch, sellItem } from '../src/state/inventory';
import { levelUnlockLines } from '../src/state/unlocks';

/** The same pure functions the shop window's Buy, batch and rune-pack buttons call (src/ui/stations.ts). */
describe('review 3: every shop buy sets boughtWares', () => {
  it('a gear buy through buyItem sets the flag', () => {
    const state = createDefaultState();
    state.gp = 1_000_000;
    state.inventory = [];
    expect(state.quests.boughtWares).toBe(false);
    expect(buyItem(state, 'iron_scimitar', 1).ok).toBe(true);
    expect(state.quests.boughtWares).toBe(true);
  });

  it('a rune pack through buyRunePack sets the flag', () => {
    const state = createDefaultState();
    state.gp = 1_000_000;
    state.inventory = [];
    expect(buyRunePack(state, 1).ok).toBe(true);
    expect(state.quests.boughtWares).toBe(true);
  });

  it('a refused buy leaves the flag unset', () => {
    const state = createDefaultState();
    state.gp = 0;
    expect(buyItem(state, 'iron_scimitar', 1).ok).toBe(false);
    expect(buyRunePack(state, 1).ok).toBe(false);
    expect(buyItem(state, 'copper_ore', 1).ok).toBe(false);
    expect(state.quests.boughtWares).toBe(false);
  });
});

/** The shop sell panel calls sellItem; Sell all loot and Sell gear call sellInventoryMatch. */
describe('review 4: every sell sets soldWares', () => {
  it('a sale through sellItem sets the flag', () => {
    const state = createDefaultState();
    state.inventory = [{ id: 'copper_ore', qty: 3 }];
    expect(state.quests.soldWares).toBe(false);
    expect(sellItem(state, 'copper_ore', 'all').ok).toBe(true);
    expect(state.quests.soldWares).toBe(true);
  });

  it('a bulk sale through sellInventoryMatch sets the flag', () => {
    const state = createDefaultState();
    state.inventory = [{ id: 'copper_ore', qty: 3 }];
    expect(sellInventoryMatch(state, isGatheredGood).ok).toBe(true);
    expect(state.quests.soldWares).toBe(true);
  });

  it('a refused sale leaves the flag unset', () => {
    const state = createDefaultState();
    state.inventory = [];
    expect(sellItem(state, 'copper_ore', 'all').ok).toBe(false);
    expect(sellInventoryMatch(state, isGatheredGood).ok).toBe(false);
    expect(state.quests.soldWares).toBe(false);
  });
});

/** grantXp, claimQuestReward and handleMonsterDeath all print these lines through one helper. */
describe('review 0: quest and Slayer levels print the unlock line', () => {
  it('lists one line per crossed level with something to unlock', () => {
    const lines = levelUnlockLines('attack', 'Attack', 3, 5);
    expect(lines).toHaveLength(1);
    expect(lines[0].startsWith('Level 5 Attack unlocks: ')).toBe(true);
    expect(lines[0]).toContain('<b>Iron Scimitar</b>');
    expect(lines[0]).toContain('forge:');
    expect(levelUnlockLines('attack', 'Attack', 5, 5)).toEqual([]);
  });

  it('claiming Lumbridge Foundations from Attack 3 announces Attack 5', () => {
    const state = createDefaultState();
    state.inventory = [];
    state.skills.attack.xp = OSRS_XP_TABLE[3];
    state.skills.attack.lvl = 3;
    state.quests.openedBank = true;
    state.quests.burnedLog = true;
    state.quests.killedGoblin = true;
    const before = state.skills.attack.lvl;
    expect(claimQuest(state, 'lumbridge').ok).toBe(true);
    expect(state.skills.attack.lvl).toBeGreaterThanOrEqual(5);
    const lines = levelUnlockLines('attack', 'Attack', before, state.skills.attack.lvl);
    expect(lines.some((l) => l.startsWith('Level 5 Attack unlocks: ') && l.includes('Iron Scimitar'))).toBe(true);
  });

  it('a Slayer bounty that crosses a level announces it', () => {
    const state = createDefaultState();
    state.skills.attack.xp = OSRS_XP_TABLE[5] - 1;
    state.skills.attack.lvl = getLevelForXp(state.skills.attack.xp);
    state.quests.slayer = { monster: 'goblin', name: 'Goblins', remaining: 1, total: 6 };
    const before = state.skills.attack.lvl;
    expect(registerKill(state, 'goblin').slayerCompleted).toBe(true);
    expect(levelUnlockLines('attack', 'Attack', before, state.skills.attack.lvl).some((l) => l.includes('Iron Scimitar'))).toBe(true);
  });
});
