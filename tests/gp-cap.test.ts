import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assignSlayerTask, claimQuest, registerKill } from '../src/state/adventure';
import { applyGold200k } from '../src/state/cheats';
import { MAX_GP, creditGp } from '../src/state/economy';
import { createDefaultState } from '../src/state/gameState';
import { addItem, countItem, sellItem } from '../src/state/inventory';
import type { GameState } from '../src/state/types';

function fresh(): GameState {
  const state = createDefaultState();
  state.inventory = [];
  state.gp = 0;
  return state;
}

describe('gold cap in play', () => {
  it('creditGp adds, and stops at MAX_GP', () => {
    const state = fresh();
    state.gp = 100;
    expect(creditGp(state, 50)).toBe(50);
    expect(state.gp).toBe(150);

    state.gp = MAX_GP - 10;
    expect(creditGp(state, 500)).toBe(10);
    expect(state.gp).toBe(MAX_GP);
    expect(creditGp(state, 1)).toBe(0);
    expect(state.gp).toBe(MAX_GP);
  });

  it('creditGp never goes below 0', () => {
    const state = fresh();
    state.gp = 30;
    expect(creditGp(state, -1000)).toBe(-30);
    expect(state.gp).toBe(0);
  });

  it('creditGp ignores NaN and Infinity', () => {
    const state = fresh();
    state.gp = 77;
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(creditGp(state, bad)).toBe(0);
      expect(state.gp).toBe(77);
    }
  });

  it('selling at the cap is refused and removes nothing', () => {
    const state = fresh();
    addItem(state, 'rune_plate', 1);
    state.gp = MAX_GP - 10;
    const result = sellItem(state, 'rune_plate', 1);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('Your coin pouch is full.');
    expect(countItem(state, 'rune_plate')).toBe(1);
    expect(state.gp).toBe(MAX_GP - 10);
  });

  it('a bounty and a quest reward at the cap leave gp at MAX_GP', () => {
    const state = fresh();
    state.gp = MAX_GP;
    assignSlayerTask(state, 3);
    let done = false;
    for (let i = 0; i < 6; i++) done = registerKill(state, 'goblin').slayerCompleted;
    expect(done).toBe(true);
    expect(state.gp).toBe(MAX_GP);

    state.shrines.desert = true;
    state.quests.killedScorpion = true;
    state.quests.smeltedBar = true;
    expect(claimQuest(state, 'desert').ok).toBe(true);
    expect(state.gp).toBe(MAX_GP);
  });

  it('the gold cheat at the cap leaves gp at MAX_GP', () => {
    const state = fresh();
    state.gp = MAX_GP - 5;
    applyGold200k(state);
    expect(state.gp).toBe(MAX_GP);
  });

  it('the cap value is written once', () => {
    for (const file of ['../src/state/save.ts', '../src/state/inventory.ts']) {
      expect(readFileSync(new URL(file, import.meta.url), 'utf8')).not.toContain('2147483647');
    }
  });
});
