// The pacing proof of Stage 3 (design 5.3, plan M1). Counts and order only: no assertion reads a time.
import { describe, expect, it } from 'vitest';
import { ITEMS, shopPrice, unitSellPrice, type ItemDef } from '../src/data/items';
import { FORGE_RECIPES, recipeById, type RecipeDef } from '../src/data/recipes';
import type { SlayerBand } from '../src/state/adventure';
import { createNewGameState } from '../src/state/gameState';
import { countItem } from '../src/state/inventory';
import {
  forgeTasks,
  furtherKills,
  gatherGpPerHour,
  gatherSeconds,
  kitPrice,
  simulate,
  tierRecipes,
  TIER_NAMES,
  tiersBehind,
  totalEarned,
  type DropEntry,
  type Run,
  type SimOptions,
  type Tier
} from './support/pacingModel';
import { NODES, playStarterChain, smeltFor, STARTER_ACTIONS } from './support/starterChain';

/** Design 5.3 assertion 3 and Q3.10: the shop-only kit takes at least this many kills after the level. */
const MIN_FURTHER_KILLS = 25;
/** Design 5.3 assertion 4 and Q3.10: a shop-only fighter is never more than this many tiers behind. */
const MAX_TIERS_BEHIND = 3;

const A1: SimOptions = {
  start: createNewGameState,
  playChain: true,
  xpMultiplier: 1,
  priceOf: shopPrice,
  useShop: true,
  useDrops: false,
  useSlayer: false,
  useQuests: true
};
const A3: SimOptions = { ...A1, useDrops: true, useSlayer: true };
const A1_10X: SimOptions = { ...A1, xpMultiplier: 10 };

/** The 23 equipment drop chances of `a8cad85`, before D3 (critique H-1). */
const TODAY_DROPS: Record<string, number> = {
  'goblin:iron_plate': 0.16,
  'goblin:iron_legs': 0.16,
  'goblin_archer:shortbow': 0.08,
  'scorpion:steel_plate': 0.22,
  'scorpion:steel_legs': 0.22,
  'dark_wizard:mystic_top': 0.2,
  'dark_wizard:mystic_bottom': 0.2,
  'dark_wizard:mith_scimitar': 0.18,
  'dark_ranger:willow_bow': 0.16,
  'dark_ranger:green_dhide_body': 0.08,
  'hill_giant:addy_plate': 0.22,
  'hill_giant:addy_legs': 0.22,
  'moss_guardian:rune_plate': 0.22,
  'moss_guardian:rune_legs': 0.22,
  'moss_guardian:green_dhide_body': 0.24,
  'moss_guardian:green_dhide_chaps': 0.24,
  'lesser_demon:dragon_chain': 0.2,
  'lesser_demon:dragon_legs': 0.2,
  'lesser_demon:dragon_scimitar': 0.18,
  'elvarg_dragon:bandos_chest': 0.35,
  'elvarg_dragon:bandos_tassets': 0.35,
  'elvarg_dragon:champion_tunic': 0.35,
  'elvarg_dragon:champion_leggings': 0.35
};
/** The five bounties of `a8cad85` that D3 divides by three. The goblin band is not changed. */
const TODAY_BOUNTIES: Record<string, number> = {
  scorpion: 900,
  dark_wizard: 1200,
  hill_giant: 1800,
  moss_guardian: 3200,
  lesser_demon: 5500
};

const todayDrop = (type: string, entry: DropEntry) => {
  const chance = TODAY_DROPS[`${type}:${entry.id}`];
  if (chance === undefined) throw new Error(`No a8cad85 chance for ${type}:${entry.id}.`);
  return chance;
};
const todayBounty = (band: SlayerBand) => TODAY_BOUNTIES[band.monster] ?? band.bountyGp;
const CONTROL: SimOptions = {
  ...A1,
  priceOf: (it: ItemDef) => it.price,
  useDrops: true,
  dropChanceOf: todayDrop,
  bountyOf: todayBounty
};

const runs = new Map<string, Run>();
const run = (name: string, opts: SimOptions) => {
  if (!runs.has(name)) runs.set(name, simulate(opts));
  return runs.get(name)!;
};
/** Crafting for sale, inputs gathered (and smelted) by the crafter: 0 when an input is neither. */
function craftGpPerHour(recipe: RecipeDef, level: number): number {
  let secs = 0;
  for (const [id, qty] of Object.entries(recipe.input)) {
    const smelt = smeltFor(id);
    const raw = smelt ? Object.keys(recipeById(smelt)!.input)[0] : id;
    const node = Object.keys(NODES).find((k) => NODES[k].item === raw && NODES[k].req <= level);
    if (!node) return 0;
    secs += qty * gatherSeconds(node, level);
  }
  return recipe.output ? ((3600 / secs) * unitSellPrice(ITEMS[recipe.output]) * (recipe.outputQty || 1)) : 0;
}

const between = (from: Tier, to: Tier) => TIER_NAMES.slice(TIER_NAMES.indexOf(from), TIER_NAMES.indexOf(to) + 1);

describe('pacing model (design 5.3)', () => {
  it('the starter chain earns the bronze kit: six quests, one kill, 29 actions, no coin spent on equipment', () => {
    const state = createNewGameState();
    const ledger = playStarterChain(state);
    expect(state.equipment.weapon).toBe('bronze_scimitar');
    expect(state.equipment.body).toBe('bronze_plate');
    expect(state.equipment.legs).toBe('bronze_legs');
    expect(ledger.questsClaimed).toBe(6);
    expect(ledger.killsTotal).toBe(1);
    expect(STARTER_ACTIONS.filter((a) => a.kind === 'buy').map((a) => a.id)).toEqual(['arrow_shaft']);
    expect(ITEMS.arrow_shaft.type).not.toBe('equip');
    expect(ledger.goldSpent).toBe(shopPrice(ITEMS.arrow_shaft));
    const held = { bronze_helm: 1, wooden_shield: 1, hazel_staff: 1, air_rune: 30, mind_rune: 30, leather_boots: 1 };
    for (const [id, qty] of Object.entries(held)) expect(countItem(state, id), id).toBe(qty);
    expect(run('A1', A1).kit.bronze).toEqual(ledger);
    expect(STARTER_ACTIONS).toHaveLength(29);
    expect(ledger.actions).toBe(29);
  });

  for (const [name, opts] of [['A1', A1], ['A3', A3]] as const) {
    it(`every tier is a step, in order (${name}, 1x)`, () => {
      const r = run(name, opts);
      for (const tier of TIER_NAMES) expect(r.gate[tier].killsTotal, tier).toBeLessThanOrEqual(r.kit[tier].killsTotal);
      const kits = between('iron', 'dragon').map((tier) => r.kit[tier].killsTotal);
      kits.slice(1).forEach((kills, i) => expect(kills, between('iron', 'dragon')[i + 1]).toBeGreaterThan(kits[i]));
    });
  }

  it('shop only: the kit takes at least 25 further kills after the level, iron to adamant', () => {
    const r = run('A1', A1);
    for (const tier of between('iron', 'adamant')) expect(furtherKills(r, tier), tier).toBeGreaterThanOrEqual(MIN_FURTHER_KILLS);
  });

  it('with bounties and drops it still comes after the level, iron to mithril', () => {
    const r = run('A3', A3);
    for (const tier of between('iron', 'mithril')) expect(furtherKills(r, tier), tier).toBeGreaterThanOrEqual(1);
  });

  it('a shop-only fighter is never more than three tiers behind', () => {
    const r = run('A1', A1);
    for (const tier of between('iron', 'rune')) expect(tiersBehind(r, tier), tier).toBeLessThanOrEqual(MAX_TIERS_BEHIND);
  });

  it("negative control: today's economy hands over the kit with the level", () => {
    for (const [name, opts] of [['control', CONTROL], ['control, Slayer', { ...CONTROL, useSlayer: true }]] as const) {
      const r = run(name, opts);
      for (const tier of between('iron', 'adamant')) expect(furtherKills(r, tier), `${name} ${tier}`).toBeLessThan(MIN_FURTHER_KILLS);
    }
  });

  it('the booster speeds levels, not gear', () => {
    const r = run('A1 10x', A1_10X);
    for (const tier of between('steel', 'rune')) expect(furtherKills(r, tier), tier).toBeGreaterThanOrEqual(MIN_FURTHER_KILLS);
  });

  it('the forge makes bronze, iron, mithril and rune kits without coin', () => {
    let previous = 0;
    for (const tier of ['bronze', 'iron', 'mithril', 'rune'] as const) {
      const ledger = forgeTasks(tier);
      expect(ledger.goldSpent, tier).toBe(0);
      for (const recipe of tierRecipes(tier)) expect(ledger.crafted[recipe.id], `${tier} ${recipe.id}`).toBeGreaterThanOrEqual(1);
      expect(ledger.actions, tier).toBeGreaterThan(previous);
      previous = ledger.actions;
    }
  });

  it('the model is a pure function', () => {
    expect(simulate(A3)).toEqual(simulate(A3));
    expect(simulate(A1)).toEqual(simulate(A1));
  });

  it('prints the milestone table', () => {
    const fmt = (s: number) => (s < 5400 ? `${(s / 60).toFixed(0)} m` : `${(s / 3600).toFixed(1)} h`);
    const lines: string[] = [];
    for (const [name, opts] of [['A1', A1], ['A3', A3], ['A1 10x', A1_10X]] as const) {
      const r = run(name, opts);
      lines.push(`\n${name}: tier | level kills | kit kills | further | behind | quests | earned at kit coins/gear/slayer/quests | spent | share at level | average at level / kit | kills at level | kills at kit`);
      for (const tier of TIER_NAMES) {
        const g = r.gate[tier];
        const k = r.kit[tier];
        const e = k.goldEarned;
        const share = totalEarned(g) / kitPrice(tier, opts.priceOf);
        lines.push(
          `${tier} | ${g.killsTotal} | ${k.killsTotal} | ${furtherKills(r, tier)} | ${tiersBehind(r, tier)} | ${k.questsClaimed} | ` +
            `${[e.coins, e.gear, e.slayer, e.quests].map((n) => n.toFixed(0)).join('/')} | ${k.goldSpent.toFixed(0)} | ` +
            `${(share * 100).toFixed(0)}% | ${fmt(r.averageSeconds.gate[tier])} / ${fmt(r.averageSeconds.kit[tier])} | ` +
            `${JSON.stringify(g.kills)} | ${JSON.stringify(k.kills)}`
        );
      }
    }
    const fighter = run('A1', A1);
    lines.push('\nForge route and income, per tier (best gathering and crafting GP/h at the tier level, A1 fighter GP/h from level to kit):');
    for (const tier of between('iron', 'rune')) {
      const level = [5, 10, 15, 20, 30, 40][between('iron', 'rune').indexOf(tier)];
      const gathering = Object.keys(NODES).filter((k) => NODES[k].req <= level).map((k) => [k, gatherGpPerHour(k, level)] as const);
      const best = gathering.reduce((a, b) => (b[1] > a[1] ? b : a));
      const crafting = FORGE_RECIPES.filter((r) => (r.kind === 'smith' || r.kind === 'fletch') && r.req <= level)
        .map((r) => [r.id, craftGpPerHour(r, level)] as const)
        .filter((c) => c[1] > 0);
      const bestCraft = crafting.reduce((a, b) => (b[1] > a[1] ? b : a), ['none', 0] as const);
      const span = fighter.averageSeconds.kit[tier] - fighter.averageSeconds.gate[tier];
      const earned = totalEarned(fighter.kit[tier]) - totalEarned(fighter.gate[tier]);
      const forgeLine = tierRecipes(tier).length
        ? (() => {
            const f = forgeTasks(tier);
            return `forge ${f.actions} actions, gathered ${JSON.stringify(f.gathered)}, crafted ${JSON.stringify(f.crafted)}`;
          })()
        : 'no forge recipe';
      lines.push(`${tier}: ${forgeLine}; best gathering ${best[0]} ${best[1].toFixed(0)} GP/h; best crafting ${bestCraft[0]} ${bestCraft[1].toFixed(0)} GP/h; fighter ${span > 0 ? ((earned / span) * 3600).toFixed(0) : '-'} GP/h`);
    }
    console.log(lines.join('\n'));
  });
});
