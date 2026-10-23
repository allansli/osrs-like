import { FORGE_RECIPES as BASE_RECIPES } from './catalog';
import { ITEMS } from './items';
import { getLevelForXp } from './skills';
import { addItem, canAddItem, countItem, removeItem } from '../state/inventory';
import type { GameState } from '../state/types';

export interface RecipeDef {
  id: string;
  name: string;
  skill: string;
  req: number;
  xp: number;
  input: Record<string, number>;
  output?: string;
  outputQty?: number;
  kind?: 'cook' | 'smith' | 'fletch' | 'burn' | 'smelt';
}

export const LOG_IDS = ['logs', 'oak_logs', 'willow_logs', 'maple_logs', 'yew_logs', 'magic_logs'] as const;

const LOG_CRAFT: Array<{ id: string; xp: number; req: number; bow?: string }> = [
  { id: 'logs', xp: 40, req: 1 },
  { id: 'oak_logs', xp: 60, req: 5, bow: 'shortbow' },
  { id: 'willow_logs', xp: 90, req: 15, bow: 'willow_bow' },
  { id: 'maple_logs', xp: 135, req: 25, bow: 'maple_bow' },
  { id: 'yew_logs', xp: 202, req: 35, bow: 'yew_bow' },
  { id: 'magic_logs', xp: 303, req: 50, bow: 'magic_bow' }
];

function logRecipes(): RecipeDef[] {
  const recipes: RecipeDef[] = [];
  for (const log of LOG_CRAFT) {
    const name = ITEMS[log.id]?.name || log.id;
    recipes.push({
      id: `burn_${log.id}`,
      name: `Burn ${name} (Campfire)`,
      skill: 'cooking',
      req: 1,
      xp: log.xp,
      input: { [log.id]: 1 },
      output: 'ashes',
      outputQty: 1,
      kind: 'burn'
    });
    if (log.id === 'logs') {
      recipes.push({
        id: 'fletch_shafts',
        name: 'Fletch Arrow Shafts',
        skill: 'smithing',
        req: 1,
        xp: 15,
        input: { logs: 1 },
        output: 'arrow_shaft',
        outputQty: 15,
        kind: 'fletch'
      });
      recipes.push({
        id: 'craft_wood_shield',
        name: 'Craft Wooden Kiteshield',
        skill: 'smithing',
        req: 1,
        xp: 40,
        input: { logs: 2 },
        output: 'wooden_shield',
        outputQty: 1,
        kind: 'fletch'
      });
    }
    if (log.bow) {
      recipes.push({
        id: `fletch_${log.bow}`,
        name: `Shape ${ITEMS[log.bow]?.name || log.bow}`,
        skill: 'smithing',
        req: log.req,
        xp: log.xp + 20,
        input: { [log.id]: 1 },
        output: log.bow,
        outputQty: 1,
        kind: 'fletch'
      });
    }
  }
  recipes.push({
    id: 'fletch_bronze_arrows',
    name: 'Fletch Bronze Arrows',
    skill: 'smithing',
    req: 1,
    xp: 20,
    input: { arrow_shaft: 15, feather: 15 },
    output: 'bronze_arrow',
    outputQty: 15,
    kind: 'fletch'
  });
  recipes.push(
    { id: 'smelt_bronze', name: 'Smelt Bronze Bar', skill: 'smithing', req: 1, xp: 18, input: { copper_ore: 1 }, output: 'bronze_bar', kind: 'smelt' },
    { id: 'smelt_iron', name: 'Smelt Iron Bar', skill: 'smithing', req: 10, xp: 30, input: { iron_ore: 1 }, output: 'iron_bar', kind: 'smelt' },
    { id: 'smelt_mithril', name: 'Smelt Mithril Bar', skill: 'smithing', req: 25, xp: 55, input: { mithril_ore: 1 }, output: 'mithril_bar', kind: 'smelt' },
    { id: 'smelt_gold', name: 'Smelt Gold Bar', skill: 'smithing', req: 35, xp: 70, input: { gold_ore: 1 }, output: 'gold_bar', kind: 'smelt' },
    { id: 'smelt_runite', name: 'Smelt Runite Bar', skill: 'smithing', req: 50, xp: 95, input: { runite_ore: 1 }, output: 'runite_bar', kind: 'smelt' }
  );
  return recipes;
}

export const FORGE_RECIPES: RecipeDef[] = [
  ...(BASE_RECIPES as unknown as RecipeDef[]).map((r) => ({ ...r, outputQty: r.outputQty || 1, kind: r.kind || (r.skill === 'cooking' ? 'cook' as const : 'smith' as const) })),
  ...logRecipes()
];

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
  if (recipe.output && !canAddItem(state, recipe.output, outQty)) {
    return { ok: false, reason: 'Your backpack is full.' };
  }
  for (const [id, qty] of Object.entries(recipe.input)) removeItem(state, id, qty);
  if (recipe.output) addItem(state, recipe.output, outQty);
  if (recipe.kind === 'burn') state.quests.burnedLog = true;
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
