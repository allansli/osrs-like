import { describe, expect, it } from 'vitest';
import { adventureTracker } from '../src/state/adventure';
import { createDefaultState } from '../src/state/gameState';
import type { GameState } from '../src/state/types';
import { STARTER_ARRIVAL } from '../src/state/quests';

function newGame(): GameState {
  const state = createDefaultState();
  state.gp = 0;
  state.inventory = [];
  for (const slot of Object.keys(state.equipment)) state.equipment[slot] = null;
  state.quests.claimed = [STARTER_ARRIVAL];
  return state;
}

const CHAIN = ['sq_ledger', 'sq_quarrel', 'sq_gather', 'sq_forge', 'sq_keeping', 'sq_coin'];

function chainClaimed(): GameState {
  const state = newGame();
  state.quests.claimed = [STARTER_ARRIVAL, ...CHAIN];
  return state;
}

describe('adventureTracker order', () => {
  it('a new game starts on the chain', () => {
    const state = newGame();
    expect(adventureTracker(state)).toMatchObject({
      title: 'A Name in the Ledger',
      detail: 'Speak with the task master and accept a task'
    });
    state.quests.slayerTasksCompleted = 1;
    expect(adventureTracker(state).detail).toBe('Claim the reward in the Adventure Log');
  });

  it('the chain comes before every other quest', () => {
    const state = newGame();
    state.quests.openedBank = true;
    state.quests.burnedLog = true;
    state.quests.killedGoblin = true;
    expect(adventureTracker(state).title).toBe('A Name in the Ledger');
  });

  it("after the chain, the start town's quests come next", () => {
    const state = chainClaimed();
    expect(adventureTracker(state).title).toBe('Lumbridge Foundations');
    state.quests.claimed.push('lumbridge');
    expect(adventureTracker(state).title).toBe("Cook's Errand");
    state.quests.claimed.push('cook');
    expect(adventureTracker(state).title).toBe('Varrock Arcane Trial');
  });

  it('a discovered place comes before an undiscovered one', () => {
    const state = chainClaimed();
    state.quests.claimed.push('lumbridge', 'cook');
    state.shrines.desert = true;
    expect(adventureTracker(state).title).toBe('Sunscorched Oasis');
  });

  it('a state without arrival starts at Lumbridge Foundations', () => {
    expect(adventureTracker(createDefaultState()).title).toBe('Lumbridge Foundations');
  });

  it('everything claimed', () => {
    const state = chainClaimed();
    state.quests.claimed.push('lumbridge', 'varrock', 'desert', 'woods', 'wilderness', 'cook', 'plaza', 'oasis', 'maple', 'demon');
    expect(adventureTracker(state).title).toBe('Adventure log');
  });
});
