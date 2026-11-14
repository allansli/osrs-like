import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ITEMS, shopPrice } from '../src/data/items';
import { QUEST_DEFS, STARTER_QUESTS, assignSlayerTask, claimQuest, questView, starterView } from '../src/state/adventure';
import { BACKPACK_SIZE, createDefaultState } from '../src/state/gameState';
import type { GameState } from '../src/state/types';
import { countItem, isGatheredGood } from '../src/state/inventory';
import { defaultQuests, STARTER_ARRIVAL } from '../src/state/quests';
import { SAVE_KEY, migrateLegacySave, readSave, writeSave, type StorageLike } from '../src/state/save';

const readFixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

/** The new-game state, by hand: createNewGameState arrives later in lane N. */
function newGame(): GameState {
  const state = createDefaultState();
  state.gp = 0;
  state.inventory = [];
  for (const slot of Object.keys(state.equipment)) state.equipment[slot] = null;
  state.quests.claimed = [STARTER_ARRIVAL];
  return state;
}

const IDS = ['sq_ledger', 'sq_quarrel', 'sq_gather', 'sq_forge', 'sq_keeping', 'sq_coin'];

/** The one change per step of design 7.1 item 9. */
const STEP_SETUP: Record<string, Array<(s: GameState) => void>> = {
  sq_ledger: [(s) => { assignSlayerTask(s, 3); }],
  sq_quarrel: [(s) => { s.quests.killedGoblin = true; }],
  sq_gather: [
    (s) => { s.skills.mining.xp = 28; },
    (s) => { s.skills.woodcutting.xp = 28; },
    (s) => { s.quests.caughtFish = true; }
  ],
  sq_forge: [
    (s) => { s.quests.cookedMeal = true; },
    (s) => { s.quests.smeltedBar = true; },
    (s) => { s.equipment.body = 'bronze_plate'; }
  ],
  sq_keeping: [(s) => { s.quests.openedBank = true; }],
  sq_coin: [(s) => { s.quests.soldWares = true; }, (s) => { s.quests.boughtWares = true; }]
};

const REWARD: Record<string, { gp: number; items: Record<string, number> }> = {
  sq_ledger: { gp: 0, items: { bronze_scimitar: 1 } },
  sq_quarrel: { gp: 25, items: { shrimp: 3 } },
  sq_gather: { gp: 0, items: { bronze_helm: 1 } },
  sq_forge: { gp: 0, items: { wooden_shield: 1 } },
  sq_keeping: { gp: 0, items: { hazel_staff: 1, air_rune: 30, mind_rune: 30 } },
  sq_coin: { gp: 0, items: { leather_boots: 1 } }
};

function meet(state: GameState, id: string) {
  for (const set of STEP_SETUP[id]) set(state);
}

function memStorage(): StorageLike {
  const store = new Map<string, string>();
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => { store.set(k, v); },
    removeItem: (k) => { store.delete(k); }
  };
}

describe('the starter chain', () => {
  it('the starter table is exactly these seven entries', () => {
    expect(STARTER_QUESTS.map((q) => q.id)).toEqual(['arrival', 'sq_ledger', 'sq_quarrel', 'sq_gather', 'sq_forge', 'sq_keeping', 'sq_coin']);
    expect(STARTER_QUESTS.map((q) => q.name)).toEqual([
      'Arrival', 'A Name in the Ledger', 'First Quarrel', 'Stone, Timber, Tide', 'Fire and Hammer', 'Left in Keeping', 'Fair Coin'
    ]);
    for (const q of STARTER_QUESTS) {
      expect(q.region).toBe('lumbridge');
      expect(q.xp).toEqual({});
      expect(q.gp).toBe(q.id === 'sq_quarrel' ? 25 : 0);
    }
    for (const id of IDS) {
      const def = STARTER_QUESTS.find((q) => q.id === id)!;
      expect(Object.fromEntries(def.items.map((i) => [i.id, i.qty]))).toEqual(REWARD[id].items);
    }
    expect(STARTER_QUESTS[0].items).toEqual([]);
  });

  it('QUEST_DEFS still has its ten ids and questView its ten cards', () => {
    expect(QUEST_DEFS.map((q) => q.id)).toEqual(['lumbridge', 'varrock', 'desert', 'woods', 'wilderness', 'cook', 'plaza', 'oasis', 'maple', 'demon']);
    expect(questView(newGame())).toHaveLength(10);
  });

  it('each step reads what the game already records', () => {
    for (const id of IDS) {
      const def = STARTER_QUESTS.find((q) => q.id === id)!;
      expect(def.steps).toHaveLength(STEP_SETUP[id].length);
      def.steps.forEach((step, i) => {
        const state = newGame();
        expect(step.met(state), `${id} step ${i} on a new game`).toBe(false);
        STEP_SETUP[id][i](state);
        expect(step.met(state), `${id} step ${i} after its change`).toBe(true);
      });
    }
    const forge = STARTER_QUESTS.find((q) => q.id === 'sq_forge')!;
    const flagged = newGame();
    flagged.quests.worePlate = true;
    expect(forge.steps[2].met(flagged)).toBe(true);
    const ledger = STARTER_QUESTS.find((q) => q.id === 'sq_ledger')!;
    const done = newGame();
    done.quests.slayerTasksCompleted = 1;
    expect(ledger.steps[0].met(done)).toBe(true);
  });

  it('the chain opens one quest at a time', () => {
    const state = newGame();
    expect(starterView(state).map((c) => c.id)).toEqual(['sq_ledger']);
    meet(state, 'sq_quarrel');
    const before = JSON.stringify(state);
    expect(claimQuest(state, 'sq_quarrel')).toMatchObject({ ok: false, reason: 'That quest is not open yet.' });
    expect(JSON.stringify(state)).toBe(before);
    IDS.forEach((id, i) => {
      meet(state, id);
      expect(claimQuest(state, id).ok, id).toBe(true);
      const view = starterView(state);
      expect(view.map((c) => c.id)).toEqual(IDS.slice(0, Math.min(i + 2, IDS.length)));
      expect(view.slice(0, i + 1).every((c) => c.claimed)).toBe(true);
    });
    expect(starterView(state).every((c) => c.claimed)).toBe(true);
  });

  it('each quest pays its reward once', () => {
    const state = newGame();
    for (const id of IDS) {
      meet(state, id);
      const skills = JSON.stringify(state.skills);
      const gp = state.gp;
      const held = Object.fromEntries(Object.keys(REWARD[id].items).map((item) => [item, countItem(state, item)]));
      expect(claimQuest(state, id).ok, id).toBe(true);
      expect(state.gp).toBe(gp + REWARD[id].gp);
      for (const [item, qty] of Object.entries(REWARD[id].items)) expect(countItem(state, item)).toBe(held[item] + qty);
      expect(JSON.stringify(state.skills)).toBe(skills);
      const again = claimQuest(state, id);
      expect(again.ok).toBe(false);
      expect(state.gp).toBe(gp + REWARD[id].gp);
    }
  });

  it('arrival can never be claimed', () => {
    for (const state of [newGame(), createDefaultState()]) {
      const before = JSON.stringify(state);
      expect(claimQuest(state, STARTER_ARRIVAL).ok).toBe(false);
      expect(JSON.stringify(state)).toBe(before);
    }
  });

  it('a state that never claimed arrival has no starter quest', () => {
    const states = [
      createDefaultState(),
      migrateLegacySave(readFixture('save-v4.json'), SAVE_KEY).state,
      migrateLegacySave(readFixture('s3/save-v4-geared.json'), SAVE_KEY).state
    ];
    for (const state of states) {
      expect(state.quests.claimed).not.toContain(STARTER_ARRIVAL);
      expect(starterView(state)).toEqual([]);
      for (const id of [STARTER_ARRIVAL, ...IDS]) {
        meet(state, 'sq_quarrel');
        const before = JSON.stringify(state);
        expect(claimQuest(state, id).ok, id).toBe(false);
        expect(JSON.stringify(state)).toBe(before);
      }
    }
  });

  it('the reward that needs room is refused when the backpack is full and nothing is claimed', () => {
    const state = newGame();
    state.quests.claimed = [STARTER_ARRIVAL, 'sq_ledger', 'sq_quarrel', 'sq_gather', 'sq_forge'];
    state.inventory = Array.from({ length: BACKPACK_SIZE }, () => ({ id: 'bronze_helm', qty: 1 }));
    meet(state, 'sq_keeping');
    const before = JSON.stringify(state);
    expect(claimQuest(state, 'sq_keeping')).toMatchObject({ ok: false, reason: 'Your backpack is full.' });
    expect(JSON.stringify(state)).toBe(before);
  });

  it('coin is paid before it is needed', () => {
    const order = STARTER_QUESTS.map((q) => q.id);
    expect(order.indexOf('sq_quarrel')).toBeLessThan(order.indexOf('sq_coin'));
    const cheapest = Math.min(
      ...Object.values(ITEMS).filter((it) => !isGatheredGood(it.id) && shopPrice(it) > 0).map((it) => shopPrice(it))
    );
    expect(STARTER_QUESTS.find((q) => q.id === 'sq_quarrel')!.gp).toBeGreaterThanOrEqual(cheapest);
  });

  it('a half-finished chain survives a save', () => {
    const storage = memStorage();
    const state = newGame();
    state.quests.claimed = [STARTER_ARRIVAL, 'sq_ledger', 'sq_quarrel'];
    writeSave(storage, state, null, null);
    expect(readSave(storage)!.state.quests.claimed).toEqual([STARTER_ARRIVAL, 'sq_ledger', 'sq_quarrel']);

    const stale = memStorage();
    state.quests.claimed = [STARTER_ARRIVAL, 'no_such_quest'];
    writeSave(stale, state, null, null);
    expect(readSave(stale)!.state.quests.claimed).toEqual([STARTER_ARRIVAL]);
  });

  it('no new saved field', () => {
    const golden = readFixture('s3/default-state.golden.json');
    expect(Object.keys(defaultQuests())).toEqual(Object.keys(golden.quests));
  });
});
