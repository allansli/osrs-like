import { FORGE_RECIPES as BASE_RECIPES } from './catalog';
import { ITEMS } from './items';

// Split from recipes.ts so state/progress.ts can read the recipe ids without the cycle progress -> recipes -> progress.
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

const LOG_CRAFT: Array<{ id: string; xp: number; req: number; bow?: string; bowLogs?: number }> = [
  { id: 'logs', xp: 40, req: 1 },
  { id: 'oak_logs', xp: 60, req: 5, bow: 'shortbow' },
  { id: 'willow_logs', xp: 90, req: 15, bow: 'willow_bow', bowLogs: 3 },
  { id: 'maple_logs', xp: 135, req: 25, bow: 'maple_bow', bowLogs: 4 },
  { id: 'yew_logs', xp: 202, req: 35, bow: 'yew_bow', bowLogs: 5 },
  { id: 'magic_logs', xp: 303, req: 50, bow: 'magic_bow', bowLogs: 6 }
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
        input: { [log.id]: log.bowLogs ?? 1 },
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
    { id: 'smelt_iron', name: 'Smelt Iron Bar', skill: 'smithing', req: 5, xp: 30, input: { iron_ore: 1 }, output: 'iron_bar', kind: 'smelt' },
    { id: 'smelt_mithril', name: 'Smelt Mithril Bar', skill: 'smithing', req: 20, xp: 55, input: { mithril_ore: 1 }, output: 'mithril_bar', kind: 'smelt' },
    { id: 'smelt_gold', name: 'Smelt Gold Bar', skill: 'smithing', req: 35, xp: 70, input: { gold_ore: 1 }, output: 'gold_bar', kind: 'smelt' },
    { id: 'smelt_runite', name: 'Smelt Runite Bar', skill: 'smithing', req: 40, xp: 95, input: { runite_ore: 1 }, output: 'runite_bar', kind: 'smelt' },
    // Stage 6, slice 1 (D2, design 7.4): steel, blacksteel, brewing
    { id: 'smelt_steel', name: 'Smelt Steel Bar', skill: 'smithing', req: 10, xp: 40, input: { iron_ore: 1, coal: 1 }, output: 'steel_bar', kind: 'smelt' },
    { id: 'smelt_black', name: 'Smelt Blacksteel Bar', skill: 'smithing', req: 15, xp: 48, input: { steel_bar: 1, coal: 1 }, output: 'black_bar', kind: 'smelt' },
    { id: 'smith_steel_sword', name: 'Forge Steel Longsword', skill: 'smithing', req: 10, xp: 100, input: { steel_bar: 2 }, output: 'steel_longsword', kind: 'smith' },
    { id: 'smith_steel_legs', name: 'Forge Steel Platelegs', skill: 'smithing', req: 12, xp: 115, input: { steel_bar: 2 }, output: 'steel_legs', kind: 'smith' },
    { id: 'smith_steel_plate', name: 'Forge Steel Platebody', skill: 'smithing', req: 14, xp: 140, input: { steel_bar: 3 }, output: 'steel_plate', kind: 'smith' },
    { id: 'smith_black_scim', name: 'Forge Black Scimitar', skill: 'smithing', req: 15, xp: 125, input: { black_bar: 2 }, output: 'black_scimitar', kind: 'smith' },
    { id: 'smith_black_legs', name: 'Forge Black Platelegs', skill: 'smithing', req: 17, xp: 145, input: { black_bar: 2 }, output: 'black_legs', kind: 'smith' },
    { id: 'smith_black_plate', name: 'Forge Black Platebody', skill: 'smithing', req: 19, xp: 175, input: { black_bar: 3 }, output: 'black_plate', kind: 'smith' },
    { id: 'brew_prayer', name: 'Brew Prayer Restore Vial', skill: 'cooking', req: 30, xp: 110, input: { sting_gland: 1, ashes: 2 }, output: 'prayer_potion', kind: 'cook' },
    { id: 'brew_restore', name: 'Brew Super Restore Elixir', skill: 'cooking', req: 55, xp: 220, input: { mire_root: 1, ashes: 2 }, output: 'super_restore', kind: 'cook' },
    { id: 'brew_stew', name: 'Simmer Hearty Stew', skill: 'cooking', req: 60, xp: 260, input: { shark: 1, mire_root: 1 }, output: 'hearty_elixir', kind: 'cook' }
  );
  return recipes;
}

export const FORGE_RECIPES: RecipeDef[] = [
  ...(BASE_RECIPES as unknown as RecipeDef[]).map((r) => ({ ...r, outputQty: r.outputQty || 1, kind: r.kind || (r.skill === 'cooking' ? 'cook' as const : 'smith' as const) })),
  ...logRecipes()
];

