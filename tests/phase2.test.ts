import { describe, expect, it } from 'vitest';
import { performCraft } from '../src/data/recipes';
import { ITEMS } from '../src/data/items';
import { getLevelForXp } from '../src/data/skills';
import {
  assignSlayerTask,
  attackOptionLabel,
  claimQuest,
  combatLevel,
  dharokMultiplier,
  gatherVerb,
  isBossLoot,
  isRareLoot,
  monsterThreatColor,
  noteGather,
  pickSlayerBand,
  registerKill,
  resolveDragonfire,
  weaponSpecial
} from '../src/state/adventure';
import { cloneState, createDefaultState } from '../src/state/gameState';
import { addItem, countItem } from '../src/state/inventory';
import { migrateLegacySave } from '../src/state/save';
import type { GameState } from '../src/state/types';

function fresh(): GameState {
  const state = createDefaultState();
  state.inventory = [];
  state.gp = 500;
  return state;
}

describe('regional quests', () => {
  it('keeps legacy quest flags and fills the new journal fields', () => {
    const migrated = migrateLegacySave({
      quests: { burnedLog: true, openedBank: true, killedGoblin: false }
    });
    expect(migrated.state.quests.burnedLog).toBe(true);
    expect(migrated.state.quests.openedBank).toBe(true);
    expect(migrated.state.quests.killedGoblin).toBe(false);
    expect(migrated.state.quests.killedElvarg).toBe(false);
    expect(migrated.state.quests.claimed).toEqual([]);
    expect(migrated.state.quests.slayer).toBeNull();
    expect(migrated.state.quests.dragonfireWard).toBe(false);
  });

  it('refuses a claim until every Lumbridge objective is done, then pays the stated reward once', () => {
    const state = fresh();
    expect(claimQuest(state, 'lumbridge').ok).toBe(false);
    state.quests.openedBank = true;
    state.quests.burnedLog = true;
    expect(claimQuest(state, 'lumbridge').ok).toBe(false);

    state.quests.killedGoblin = true;
    const attackXp = state.skills.attack.xp;
    const hpXp = state.skills.hitpoints.xp;
    const claimed = claimQuest(state, 'lumbridge');
    expect(claimed.ok).toBe(true);
    expect(state.gp).toBe(1000);
    expect(state.skills.attack.xp).toBe(attackXp + 250);
    expect(state.skills.attack.lvl).toBe(getLevelForXp(attackXp + 250));
    expect(state.skills.hitpoints.xp).toBe(hpXp + 250);
    expect(state.maxHp).toBe(state.skills.hitpoints.lvl);
    expect(claimQuest(state, 'lumbridge').ok).toBe(false);
    expect(state.gp).toBe(1000);
  });

  it('pays the oasis, woods, and dragon slayer rewards and will not claim into a full backpack', () => {
    const state = fresh();
    state.shrines.desert = true;
    state.quests.killedScorpion = true;
    state.quests.smeltedBar = true;
    const smith = state.skills.smithing.xp;
    const mining = state.skills.mining.xp;
    expect(claimQuest(state, 'desert').ok).toBe(true);
    expect(state.gp).toBe(3500);
    expect(state.skills.smithing.xp).toBe(smith + 600);
    expect(state.skills.mining.xp).toBe(mining + 600);

    state.shrines.woods = true;
    state.quests.choppedAncient = true;
    state.quests.killedMoss = true;
    expect(claimQuest(state, 'woods').ok).toBe(true);
    expect(countItem(state, 'hearty_elixir')).toBe(5);
    expect(state.gp).toBe(9500);

    state.shrines.wilderness = true;
    state.quests.killedElvarg = true;
    expect(claimQuest(state, 'wilderness').ok).toBe(true);
    expect(state.gp).toBe(34500);
    expect(countItem(state, 'dragon_bones')).toBe(10);
    expect(state.quests.dragonfireWard).toBe(true);
    expect(state.quests.title).toBe('Dragon Slayer');

    const packed = fresh();
    packed.shrines.varrock = true;
    packed.quests.killedArcane = true;
    packed.quests.minedMetal = true;
    packed.inventory = Array.from({ length: 27 }, () => ({ id: 'bronze_plate', qty: 1 }));
    const before = packed.gp;
    expect(claimQuest(packed, 'varrock').ok).toBe(false);
    expect(packed.gp).toBe(before);
    expect(packed.quests.claimed).toEqual([]);
    expect(countItem(packed, 'fire_rune')).toBe(0);
  });

  it('records a smelt and a metal or ancient gather', () => {
    const state = fresh();
    addItem(state, 'copper_ore', 1);
    expect(performCraft(state, 'smelt_bronze').ok).toBe(true);
    expect(state.quests.smeltedBar).toBe(true);
    noteGather(state, 'iron_ore');
    noteGather(state, 'yew_logs');
    expect(state.quests.minedMetal).toBe(true);
    expect(state.quests.choppedAncient).toBe(true);
    noteGather(state, 'logs');
    expect(state.quests.choppedAncient).toBe(true);
  });
});

describe('slayer tasks', () => {
  it('assigns a combat-appropriate task and will not replace one in progress', () => {
    const state = fresh();
    expect(pickSlayerBand(3)?.monster).toBe('goblin');
    expect(pickSlayerBand(12)?.monster).toBe('scorpion');
    expect(pickSlayerBand(20)?.monster).toBe('dark_wizard');
    expect(pickSlayerBand(50)?.monster).toBe('moss_guardian');
    expect(pickSlayerBand(80)?.monster).toBe('lesser_demon');

    const assigned = assignSlayerTask(state, combatLevel(state));
    expect(assigned.ok).toBe(true);
    expect(assigned.task?.name).toBe('Goblin Raider');
    expect(assigned.task?.remaining).toBe(6);
    expect(assignSlayerTask(state, 80).ok).toBe(false);
    expect(state.quests.slayer?.monster).toBe('goblin');
  });

  it('counts matching kills, pays the bounty at zero, and ignores a goblin archer on a raider task', () => {
    const state = fresh();
    assignSlayerTask(state, 3);
    const startXp = state.skills.attack.xp;
    registerKill(state, 'goblin_archer');
    expect(state.quests.killedGoblin).toBe(true);
    expect(state.quests.slayer?.remaining).toBe(6);
    expect(state.skills.attack.xp).toBe(startXp);

    for (let i = 0; i < 5; i++) registerKill(state, 'goblin');
    expect(state.quests.slayer?.remaining).toBe(1);
    expect(state.quests.slayerTasksCompleted).toBe(0);

    const done = registerKill(state, 'goblin');
    expect(done.slayerCompleted).toBe(true);
    expect(done.bountyGp).toBe(400);
    expect(done.bountyXp).toBe(80);
    expect(state.gp).toBe(900);
    expect(state.skills.attack.xp).toBe(startXp + 12 * 6 + 80);
    expect(state.quests.slayerTasksCompleted).toBe(1);
    expect(state.quests.slayerStreak).toBe(1);
    expect(state.quests.slayer?.remaining).toBe(0);

    const next = assignSlayerTask(state, 18);
    expect(next.ok).toBe(true);
    expect(next.task?.monster).toBe('dark_wizard');
    registerKill(state, 'dark_ranger');
    expect(state.quests.killedArcane).toBe(true);
    expect(state.quests.slayer?.remaining).toBe(5);
  });

  it('deep-copies an active task when the save snapshot is cloned', () => {
    const state = fresh();
    assignSlayerTask(state, 3);
    const copy = cloneState(state);
    if (copy.quests.slayer) copy.quests.slayer.remaining = 1;
    expect(state.quests.slayer?.remaining).toBe(6);
  });
});

describe('dragonfire, Dharok, and weapon specials', () => {
  it('cuts dragonfire to a quarter for a ward and does not stack the overhead', () => {
    const state = fresh();
    expect(resolveDragonfire(42, state)).toEqual({ damage: 42, absorbed: false });
    state.equipment.shield = 'hylian_shield';
    expect(resolveDragonfire(42, state)).toEqual({ damage: 10, absorbed: true });
    state.equipment.shield = 'wooden_shield';
    state.activePrayers.add('prot_magic');
    expect(resolveDragonfire(42, state)).toEqual({ damage: 10, absorbed: true });
    state.equipment.shield = 'dragon_defender';
    expect(resolveDragonfire(42, state).damage).toBe(10);
    state.equipment.shield = 'elysian_shield';
    expect(resolveDragonfire(42, state).damage).toBe(10);
  });

  it('scales melee with missing hitpoints only while the full Dharok set is worn', () => {
    const state = fresh();
    state.maxHp = 10;
    state.hp = 0;
    expect(dharokMultiplier(state)).toBe(1);
    state.equipment.head = 'dharok_helm';
    state.equipment.body = 'dharok_body';
    state.equipment.legs = 'dharok_legs';
    state.equipment.weapon = 'dharok_greataxe';
    state.hp = 10;
    expect(dharokMultiplier(state)).toBe(1);
    state.hp = 5;
    expect(dharokMultiplier(state)).toBeCloseTo(1.425);
    state.hp = 0;
    expect(dharokMultiplier(state)).toBeCloseTo(1.85);
    state.equipment.head = null;
    expect(dharokMultiplier(state)).toBe(1);
  });

  it('names each weapon special, its cost, and its multiplier', () => {
    expect(weaponSpecial('dragon_scimitar')).toMatchObject({ name: 'Sever', cost: 25, multiplier: 1.65 });
    expect(weaponSpecial('abyssal_whip')).toMatchObject({ name: 'Energy Drain Lash', cost: 25, multiplier: 1.6, healRatio: 0.15 });
    expect(weaponSpecial('bandos_godsword')).toMatchObject({ name: 'Warstrike', cost: 50, multiplier: 1.85 });
    expect(weaponSpecial('master_sword').name).toBe('Skyward Crescent Beam');
    expect(weaponSpecial('deity_sword').multiplier).toBe(1.8);
    expect(weaponSpecial('ancient_bow')).toMatchObject({ name: 'Ancient Piercing Shot', cost: 25, multiplier: 1.7, kind: 'ranged' });
    expect(weaponSpecial('armadyl_crossbow').name).toBe('Armadyl Eye');
    expect(weaponSpecial('bronze_scimitar')).toMatchObject({ name: 'Hylian Spin-Slash', cost: 25, multiplier: 1.55 });
  });
});

describe('context menu and rare loot helpers', () => {
  it('colors monster levels and names gather verbs and rare tiers', () => {
    expect(monsterThreatColor(2, 10)).toBe('green');
    expect(monsterThreatColor(10, 10)).toBe('yellow');
    expect(monsterThreatColor(13, 10)).toBe('yellow');
    expect(monsterThreatColor(14, 10)).toBe('red');
    expect(attackOptionLabel('Goblin Raider', 2)).toBe('Attack Goblin Raider (level-2)');
    expect(gatherVerb('tree', 'yew_logs')).toBe('Chop down');
    expect(gatherVerb('rock', 'iron_ore')).toBe('Mine');
    expect(gatherVerb('fish', 'raw_shrimp')).toBe('Net');
    expect(gatherVerb('fish', 'raw_trout')).toBe('Lure');
    expect(gatherVerb('fish', 'raw_shark')).toBe('Cage');
    expect(isRareLoot(ITEMS.rune_scimitar)).toBe(true);
    expect(isRareLoot(ITEMS.iron_scimitar)).toBe(false);
    expect(isRareLoot(ITEMS.bandos_godsword)).toBe(true);
    expect(isBossLoot('elvarg_dragon')).toBe(true);
    expect(isBossLoot('goblin')).toBe(false);
  });
});
