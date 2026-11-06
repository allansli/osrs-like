import { describe, expect, it } from 'vitest';
import { performCraft } from '../src/data/recipes';
import { QUEST_DEFS, adventureTracker, claimQuest, questView, registerKill, slayerCard } from '../src/state/adventure';
import { createDefaultState } from '../src/state/gameState';
import { addItem } from '../src/state/inventory';
import { noteBury, noteCook, noteGather, notePurchase, noteSale } from '../src/state/quests';
import { migrateLegacySave } from '../src/state/save';

function fresh() {
  const state = createDefaultState();
  state.inventory = [];
  state.gp = 500;
  return state;
}

describe('five new adventure log quests', () => {
  it('adds Cook, Plaza, Oasis, Maple, and Demon Gate without dropping the original five', () => {
    const ids = QUEST_DEFS.map((quest) => quest.id);
    expect(ids).toEqual(['lumbridge', 'varrock', 'desert', 'woods', 'wilderness', 'cook', 'plaza', 'oasis', 'maple', 'demon']);
    expect(questView(fresh())).toHaveLength(10);
  });

  it('keeps new flags false when an older save is migrated', () => {
    const migrated = migrateLegacySave({ quests: { burnedLog: true } });
    expect(migrated.state.quests.cookedMeal).toBe(false);
    expect(migrated.state.quests.killedDemon).toBe(false);
    expect(migrated.state.quests.burnedLog).toBe(true);
  });

  it('tracks the earliest open step, then a claim prompt, then the next quest', () => {
    const state = fresh();
    expect(adventureTracker(state)).toMatchObject({
      title: 'Lumbridge Foundations',
      detail: 'Open the Lumbridge Bank'
    });
    state.quests.openedBank = true;
    state.quests.burnedLog = true;
    state.quests.killedGoblin = true;
    expect(adventureTracker(state).detail).toBe('Claim the reward in the Adventure Log');
    expect(claimQuest(state, 'lumbridge').ok).toBe(true);
    expect(adventureTracker(state).title).toBe('Varrock Arcane Trial');
  });

  it('pays the five new rewards once their steps are met', () => {
    const state = fresh();
    state.quests.cookedMeal = true;
    state.quests.buriedBones = true;
    state.quests.boughtWares = true;
    const cooking = state.skills.cooking.xp;
    expect(claimQuest(state, 'cook').ok).toBe(true);
    expect(state.gp).toBe(1300);
    expect(state.skills.cooking.xp).toBe(cooking + 400);

    state.quests.offeredPrayer = true;
    state.quests.worePlate = true;
    state.quests.killedArcane = true;
    expect(claimQuest(state, 'plaza').ok).toBe(true);
    expect(state.skills.prayer.xp).toBe(500);

    state.quests.caughtFish = true;
    state.quests.soldWares = true;
    state.shrines.desert = true;
    expect(claimQuest(state, 'oasis').ok).toBe(true);
    expect(state.skills.fishing.xp).toBe(400);

    state.quests.choppedMaple = true;
    state.shrines.woods = true;
    expect(claimQuest(state, 'maple').ok).toBe(true);
    expect(state.inventory.some((slot) => slot.id === 'maple_bow')).toBe(true);

    state.quests.minedRunite = true;
    state.quests.killedDemon = true;
    state.shrines.wilderness = true;
    const strength = state.skills.strength.xp;
    expect(claimQuest(state, 'demon').ok).toBe(true);
    expect(state.skills.strength.xp).toBe(strength + 800);
    expect(claimQuest(state, 'demon').ok).toBe(false);
  });

  it('records cook, bury, trade, fish, maple, runite, and a demon kill', () => {
    const state = fresh();
    addItem(state, 'raw_shrimp', 1);
    expect(performCraft(state, 'cook_shrimp').ok).toBe(true);
    expect(state.quests.cookedMeal).toBe(true);
    noteBury(state);
    notePurchase(state);
    noteSale(state);
    noteGather(state, 'raw_trout');
    noteGather(state, 'maple_logs');
    noteGather(state, 'runite_ore');
    registerKill(state, 'lesser_demon');
    expect(state.quests.buriedBones).toBe(true);
    expect(state.quests.boughtWares).toBe(true);
    expect(state.quests.soldWares).toBe(true);
    expect(state.quests.caughtFish).toBe(true);
    expect(state.quests.choppedMaple).toBe(true);
    expect(state.quests.minedRunite).toBe(true);
    expect(state.quests.killedDemon).toBe(true);
    expect(noteCook).toBeTypeOf('function');
  });

  it('shows an empty slayer card until a task is assigned', () => {
    const state = fresh();
    expect(slayerCard(state)).toMatchObject({ empty: true, name: 'No task', ratio: 0 });
    state.quests.slayer = { monster: 'goblin', name: 'Goblin Raider', remaining: 4, total: 6 };
    expect(slayerCard(state)).toMatchObject({ empty: false, name: 'Goblin Raider', ratio: 2 / 6 });
  });
});
