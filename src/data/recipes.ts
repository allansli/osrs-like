import { FORGE_RECIPES, LOG_IDS, type RecipeDef } from './recipeTable';
import { ITEMS } from './items';
import { getLevelForXp } from './skills';
import { noteCook, noteSmelt } from '../state/quests';
import { bump } from '../state/progress';
import { addItem, canAddItem, countItem, removeItem } from '../state/inventory';
import type { GameState } from '../state/types';

export { FORGE_RECIPES, LOG_IDS };
export type { RecipeDef };

export function recipeById(id: string): RecipeDef | undefined {
  return FORGE_RECIPES.find((r) => r.id === id);
}

export function isLogId(id: string): boolean {
  return (LOG_IDS as readonly string[]).includes(id);
}

export interface CraftResult {
  ok: boolean;
  reason?: string;
  skill?: string;
  xp?: number;
  output?: string;
  outputQty?: number;
  gained?: number;
}

export function tryCraft(state: GameState, recipeId: string): CraftResult {
  const recipe = recipeById(recipeId);
  if (!recipe) return { ok: false, reason: 'Unknown recipe.' };
  const skill = state.skills[recipe.skill];
  if (!skill || skill.lvl < recipe.req) {
    return { ok: false, reason: `You need level ${recipe.req} ${recipe.skill} to make ${recipe.name}.` };
  }
  for (const [id, qty] of Object.entries(recipe.input)) {
    if (countItem(state, id) < qty) {
      return { ok: false, reason: `You need ${qty}× ${ITEMS[id]?.name || id}.` };
    }
  }
  const outQty = recipe.outputQty || (recipe.output ? 1 : 0);
  if (recipe.output) {
    const scratch = { ...state, inventory: state.inventory.map((slot) => ({ ...slot })) };
    for (const [id, qty] of Object.entries(recipe.input)) removeItem(scratch, id, qty);
    if (!canAddItem(scratch, recipe.output, outQty)) {
      return { ok: false, reason: 'Your backpack is full.' };
    }
  }
  for (const [id, qty] of Object.entries(recipe.input)) removeItem(state, id, qty);
  if (recipe.output) addItem(state, recipe.output, outQty);
  if (recipe.kind === 'burn') state.quests.burnedLog = true;
  if (recipe.kind === 'smelt') noteSmelt(state);
  if (recipe.kind === 'cook') noteCook(state);
  bump(state, `craft:${recipeId}`);
  return { ok: true, skill: recipe.skill, xp: recipe.xp, output: recipe.output, outputQty: outQty };
}

/** Test helper that also writes XP. The live game uses grantXp so level-up FX still fire. */
export function performCraft(state: GameState, recipeId: string): CraftResult {
  const result = tryCraft(state, recipeId);
  if (!result.ok || !result.skill || !result.xp) return result;
  const skill = state.skills[result.skill];
  const gained = Math.max(1, Math.round(result.xp * (state.xpMultiplier || 1)));
  skill.xp += gained;
  skill.lvl = getLevelForXp(skill.xp);
  return { ...result, gained };
}
