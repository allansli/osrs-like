// The starter chain of design 5.1 / 7.1 item 9, played with the game's own functions (plan M1).
import { ITEMS } from '../../src/data/items';
import { FORGE_RECIPES, performCraft, recipeById } from '../../src/data/recipes';
import { getLevelForXp } from '../../src/data/skills';
import { RESOURCE_NODES_DEF } from '../../src/data/world';
import { assignSlayerTask, claimQuest, combatLevel, noteGather, registerKill } from '../../src/state/adventure';
import { addItem, buyItem, countItem, removeItem, sellItem } from '../../src/state/inventory';
import { notePlate, notePurchase, noteSale } from '../../src/state/quests';
import type { GameState } from '../../src/state/types';

export type ActionKind = 'task' | 'kill' | 'gather' | 'craft' | 'forge' | 'wear' | 'bank' | 'sell' | 'buy' | 'claim';

export interface ChainAction {
  kind: ActionKind;
  id: string;
}

export interface Ledger {
  actions: number;
  killsTotal: number;
  kills: Record<string, number>;
  questsClaimed: number;
  gathered: Record<string, number>;
  crafted: Record<string, number>;
  /** `gear` is gold from selling: dropped gear in the model, the one log in the chain. */
  goldEarned: { coins: number; gear: number; slayer: number; quests: number };
  goldSpent: number;
}

export interface NodeDef {
  name: string;
  skill: string;
  req: number;
  xp: number;
  item: string;
  respawn: number;
  kind: string;
}

// Z4 amendment (declared): dungeon nodes stay out of Stage 3's overworld model; no node before Z4 has a `where`.
export const NODES = Object.fromEntries(
  Object.entries(RESOURCE_NODES_DEF).filter(([, n]) => (n as { where?: string }).where !== 'dungeon')
) as unknown as Record<string, NodeDef>;

export function emptyLedger(): Ledger {
  return {
    actions: 0,
    killsTotal: 0,
    kills: {},
    questsClaimed: 0,
    gathered: {},
    crafted: {},
    goldEarned: { coins: 0, gear: 0, slayer: 0, quests: 0 },
    goldSpent: 0
  };
}

export function copyLedger(ledger: Ledger): Ledger {
  return structuredClone(ledger);
}

const bump = (counts: Record<string, number>, key: string, by = 1) => {
  counts[key] = (counts[key] || 0) + by;
};

/** The 29 actions of design 5.1, in order. */
export const STARTER_ACTIONS: ChainAction[] = [
  { kind: 'task', id: 'slayer' },
  { kind: 'claim', id: 'sq_ledger' },
  { kind: 'wear', id: 'bronze_scimitar' },
  { kind: 'kill', id: 'goblin' },
  { kind: 'claim', id: 'sq_quarrel' },
  { kind: 'gather', id: 'copper_ore' },
  { kind: 'gather', id: 'logs' },
  { kind: 'gather', id: 'raw_shrimp' },
  { kind: 'claim', id: 'sq_gather' },
  { kind: 'craft', id: 'cook_shrimp' },
  { kind: 'gather', id: 'copper_ore' },
  { kind: 'gather', id: 'copper_ore' },
  { kind: 'gather', id: 'copper_ore' },
  { kind: 'gather', id: 'copper_ore' },
  { kind: 'craft', id: 'smelt_bronze' },
  { kind: 'craft', id: 'smelt_bronze' },
  { kind: 'craft', id: 'smelt_bronze' },
  { kind: 'craft', id: 'smelt_bronze' },
  { kind: 'craft', id: 'smelt_bronze' },
  { kind: 'forge', id: 'smith_bronze_legs' },
  { kind: 'forge', id: 'smith_bronze_plate' },
  { kind: 'wear', id: 'bronze_legs' },
  { kind: 'wear', id: 'bronze_plate' },
  { kind: 'claim', id: 'sq_forge' },
  { kind: 'bank', id: 'bank' },
  { kind: 'claim', id: 'sq_keeping' },
  { kind: 'sell', id: 'logs' },
  { kind: 'buy', id: 'arrow_shaft' },
  { kind: 'claim', id: 'sq_coin' }
];

/** The resource node that yields an item. */
export function nodeForItem(item: string): string {
  const key = Object.keys(NODES).find((k) => NODES[k].item === item);
  if (!key) throw new Error(`No resource node yields ${item}.`);
  return key;
}

/** One successful gather, as `performResourceGather` does it: the item, the quest note, the node's XP. */
export function gather(state: GameState, ledger: Ledger, item: string): void {
  const node = NODES[nodeForItem(item)];
  if (!addItem(state, item, 1).ok) throw new Error(`No room for ${item}.`);
  noteGather(state, item);
  const skill = state.skills[node.skill];
  skill.xp += node.xp * state.xpMultiplier;
  skill.lvl = getLevelForXp(skill.xp);
  ledger.actions += 1;
  bump(ledger.gathered, item);
}

export function craft(state: GameState, ledger: Ledger, recipeId: string): void {
  const result = performCraft(state, recipeId);
  if (!result.ok) throw new Error(`${recipeId} refused: ${result.reason}`);
  ledger.actions += 1;
  bump(ledger.crafted, recipeId);
}

/** The smelt recipe that makes a bar, if any. */
export function smeltFor(item: string): string | undefined {
  return FORGE_RECIPES.find((r) => r.kind === 'smelt' && r.output === item)?.id;
}

/** Gathers or smelts one unit of an input: an ore is gathered, a bar is gathered as ore and smelted. */
function makeUp(state: GameState, ledger: Ledger, item: string): void {
  const smelt = smeltFor(item);
  if (smelt) {
    const recipe = recipeById(smelt)!;
    for (const [input, qty] of Object.entries(recipe.input)) {
      while (countItem(state, input) < qty) makeUp(state, ledger, input);
    }
    craft(state, ledger, smelt);
    return;
  }
  gather(state, ledger, item);
}

/** A craft that first makes up whatever the live recipe's input asks for and the hero lacks. */
export function forge(state: GameState, ledger: Ledger, recipeId: string): void {
  const recipe = recipeById(recipeId);
  if (!recipe) throw new Error(`Unknown recipe ${recipeId}.`);
  for (const [input, qty] of Object.entries(recipe.input)) {
    while (countItem(state, input) < qty) makeUp(state, ledger, input);
  }
  craft(state, ledger, recipeId);
}

/** Moves an item from the backpack to its slot, as `playerActions.ts` does. */
export function wear(state: GameState, ledger: Ledger, itemId: string): void {
  const item = ITEMS[itemId];
  if (!item?.slot) throw new Error(`${itemId} cannot be worn.`);
  for (const [skill, level] of Object.entries(item.req || {})) {
    if (state.skills[skill].lvl < level) throw new Error(`${itemId} needs ${skill} ${level}.`);
  }
  if (removeItem(state, itemId, 1) !== 1) throw new Error(`${itemId} is not in the backpack.`);
  const previous = state.equipment[item.slot];
  if (previous) addItem(state, previous, 1);
  state.equipment[item.slot] = itemId;
  if (item.slot === 'body' && (itemId.includes('plate') || itemId.includes('chain'))) notePlate(state);
  ledger.actions += 1;
}

function perform(state: GameState, ledger: Ledger, action: ChainAction): void {
  switch (action.kind) {
    case 'task': {
      const result = assignSlayerTask(state, combatLevel(state));
      if (!result.ok) throw new Error(`task refused: ${result.reason}`);
      ledger.actions += 1;
      return;
    }
    case 'kill':
      registerKill(state, action.id);
      ledger.actions += 1;
      ledger.killsTotal += 1;
      bump(ledger.kills, action.id);
      return;
    case 'gather':
      gather(state, ledger, action.id);
      return;
    case 'craft':
      craft(state, ledger, action.id);
      return;
    case 'forge':
      forge(state, ledger, action.id);
      return;
    case 'wear':
      wear(state, ledger, action.id);
      return;
    case 'bank':
      state.quests.openedBank = true;
      ledger.actions += 1;
      return;
    case 'sell': {
      const result = sellItem(state, action.id, 1);
      if (!result.ok) throw new Error(`sell ${action.id} refused: ${result.reason}`);
      noteSale(state);
      ledger.goldEarned.gear += result.gp!;
      ledger.actions += 1;
      return;
    }
    case 'buy': {
      const result = buyItem(state, action.id, 1);
      if (!result.ok) throw new Error(`buy ${action.id} refused: ${result.reason}`);
      notePurchase(state);
      ledger.goldSpent += result.gp!;
      ledger.actions += 1;
      return;
    }
    case 'claim': {
      const result = claimQuest(state, action.id);
      if (!result.ok) throw new Error(`claim ${action.id} refused: ${result.reason}`);
      ledger.goldEarned.quests += result.gp!;
      ledger.questsClaimed += 1;
      ledger.actions += 1;
      return;
    }
  }
}

/** Plays the 29 actions on `state` and returns the counts. Throws on the first refused step. */
export function playStarterChain(state: GameState): Ledger {
  const ledger = emptyLedger();
  for (const action of STARTER_ACTIONS) perform(state, ledger, action);
  return ledger;
}
