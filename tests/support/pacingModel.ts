// The pacing model of design 4.2, run against the live tables and functions (plan M1).
// Expected values, no dice, no clock: a pure function of its options and the game's tables.
// It holds no hit, drop or gather formula of its own; the one expression it writes is the mean of
// the damage roll `max(1, floor(rand * (M + 1)))` shared by `performPlayerAttack` and `rollMonsterHit`.
import { ITEMS, unitSellPrice, type ItemDef } from '../../src/data/items';
import { FORGE_RECIPES, recipeById, type RecipeDef } from '../../src/data/recipes';
import { getLevelForXp } from '../../src/data/skills';
import { MONSTER_TYPES, type MonsterDef } from '../../src/data/world';
import { CAMPS } from '../../src/data/worldMap';
import { NODE_PLACEMENTS } from '../../src/data/placements';
import { TICK_SEC } from '../../src/engine/context';
import {
  QUEST_DEFS,
  SLAYER_BANDS,
  STARTER_QUESTS,
  combatLevel,
  monsterThreatColor,
  pickSlayerBand,
  type SlayerBand
} from '../../src/state/adventure';
// getEquipmentBonuses acts through playerAttackProfile and monsterHitChance.
import { monsterHitChance, playerAttackProfile, playerHitChance } from '../../src/state/combat';
import { FISH_DEPLETION_CHANCE, gatherChance, HP_REGEN_PER_SEC } from '../../src/state/economy';
import { createNewGameState } from '../../src/state/gameState';
import { countItem, deposit } from '../../src/state/inventory';
import { ATTACK_INTERVAL, DEAD_SECS, DYING_SECS } from '../../src/state/monsterAi';
import type { GameState } from '../../src/state/types';
import {
  NODES,
  copyLedger,
  craft,
  emptyLedger,
  forge,
  gather,
  playStarterChain,
  smeltFor,
  type Ledger
} from './starterChain';

export type { Ledger };

export type Tier = 'bronze' | 'iron' | 'steel' | 'black' | 'mithril' | 'adamant' | 'rune' | 'dragon';

/** The kit table of design 4.2: weapon, plate body and plate legs of each tier. */
export const TIERS: Array<{ tier: Tier; level: number; weapon: string; body: string; legs: string }> = [
  { tier: 'bronze', level: 1, weapon: 'bronze_scimitar', body: 'bronze_plate', legs: 'bronze_legs' },
  { tier: 'iron', level: 5, weapon: 'iron_scimitar', body: 'iron_plate', legs: 'iron_legs' },
  { tier: 'steel', level: 10, weapon: 'steel_longsword', body: 'steel_plate', legs: 'steel_legs' },
  { tier: 'black', level: 15, weapon: 'black_scimitar', body: 'black_plate', legs: 'black_legs' },
  { tier: 'mithril', level: 20, weapon: 'mith_scimitar', body: 'mith_plate', legs: 'mith_legs' },
  { tier: 'adamant', level: 30, weapon: 'addy_scimitar', body: 'addy_plate', legs: 'addy_legs' },
  { tier: 'rune', level: 40, weapon: 'rune_scimitar', body: 'rune_plate', legs: 'rune_legs' },
  { tier: 'dragon', level: 60, weapon: 'dragon_scimitar', body: 'dragon_chain', legs: 'dragon_legs' }
];

export const TIER_NAMES: Tier[] = TIERS.map((t) => t.tier);

const KIT_SLOTS = ['weapon', 'body', 'legs'] as const;
const TIER_INDEX: Record<string, number> = {};
TIERS.forEach((t, i) => {
  for (const slot of KIT_SLOTS) {
    const item = ITEMS[t[slot]];
    if (!item || item.slot !== slot) throw new Error(`Kit table: ${t[slot]} is not a ${slot} item.`);
    TIER_INDEX[t[slot]] = i;
  }
});

// Assumptions of design 4.2 that are not game data.
const STEP_SECS = 1.5; // walk to the next monster
const SWITCH_SECS = 30; // change of monster type
const PURCHASE_SECS = 40;
const SLAYER_WALK_SECS = 10;
const QUEST_SECS = 90;
const GATHER_STEP_SECS = 1; // step to the next node
const WIN_SHARE = 0.6; // "can win": expected damage of one kill at most 60% of max HP
const SITE_LINK = 15; // nodes of a site stand within 15 units of another
const GUARD_SECS = 400 * 3600;
/** The two start-town quests the "after" rows pay at the first kill after the chain (design 4.2). */
const START_TOWN_QUESTS = ['lumbridge', 'cook'];

export type DropEntry = MonsterDef['drops'][number];

export interface SimOptions {
  start: () => GameState;
  playChain: boolean;
  xpMultiplier: number;
  priceOf: (item: ItemDef) => number;
  dropChanceOf?: (typeKey: string, entry: DropEntry) => number;
  bountyOf?: (band: SlayerBand) => number;
  useShop: boolean;
  useDrops: boolean;
  useSlayer: boolean;
  useQuests: boolean;
}

export interface Run {
  gate: Record<Tier, Ledger>;
  kit: Record<Tier, Ledger>;
  averageSeconds: { gate: Record<Tier, number>; kit: Record<Tier, number> };
}

/** Mean of `max(1, floor(rand * (M + 1)))`: a roll of 0 counts as 1. */
const meanRoll = (max: number) => (1 + (max * (max + 1)) / 2) / (max + 1);

const campCounts = (() => {
  const total: Record<string, number> = {};
  const largestAggressive: Record<string, number> = {};
  for (const camp of CAMPS) {
    const here: Record<string, number> = {};
    for (const m of camp.members) here[m.type] = (here[m.type] || 0) + 1;
    for (const [type, n] of Object.entries(here)) {
      total[type] = (total[type] || 0) + n;
      if (camp.aggressive) largestAggressive[type] = Math.max(largestAggressive[type] || 0, n);
    }
  }
  return { total, largestAggressive };
})();

const FIGHT_TYPES = Object.keys(campCounts.total).filter((type) => MONSTER_TYPES[type]);

function addXp(state: GameState, skill: string, amount: number): void {
  const s = state.skills[skill];
  s.xp += amount;
  s.lvl = getLevelForXp(s.xp);
  if (skill === 'hitpoints') {
    state.maxHp = s.lvl;
    state.hp = s.lvl;
  }
}

function canWear(state: GameState, item: ItemDef): boolean {
  return Object.entries(item.req || {}).every(([skill, level]) => state.skills[skill].lvl >= level);
}

/** Seconds per kill and whether the fighter can win, design 4.2. */
export function fight(state: GameState, typeKey: string): { win: boolean; secs: number } {
  const m = MONSTER_TYPES[typeKey];
  const { maxHit, accuracy } = playerAttackProfile(state);
  const killSecs = (m.hp / (playerHitChance(accuracy, m.def) * meanRoll(maxHit))) * TICK_SEC;
  const pack = campCounts.largestAggressive[typeKey] || 0;
  const attackers = pack > 0 && monsterThreatColor(m.level, combatLevel(state)) !== 'green' ? pack : 1;
  const taken = attackers * (killSecs / ATTACK_INTERVAL) * monsterHitChance(typeKey, state) * meanRoll(m.maxHit);
  const maxHp = state.skills.hitpoints.lvl;
  const win = taken <= WIN_SHARE * maxHp && attackers * m.maxHit < maxHp;
  const cycle = Math.max(killSecs + STEP_SECS, (DYING_SECS + DEAD_SECS + killSecs) / campCounts.total[typeKey]);
  let food = 0;
  for (const d of m.drops) {
    const item = d.id ? ITEMS[d.id] : undefined;
    if (item?.type === 'food') food += d.chance * (item.heal || 0);
  }
  const rest = Math.max(0, taken - HP_REGEN_PER_SEC * cycle - food) / HP_REGEN_PER_SEC;
  return { win, secs: cycle + rest };
}

export function simulate(opts: SimOptions): Run {
  const dropChanceOf = opts.dropChanceOf ?? ((_t: string, e: DropEntry) => e.chance);
  const bountyOf = opts.bountyOf ?? ((b: SlayerBand) => b.bountyGp);
  const state = opts.start();
  state.xpMultiplier = opts.xpMultiplier;
  state.combatStyle = 'controlled';

  let secs = 0;
  let ledger = emptyLedger();
  const gate: Partial<Record<Tier, Ledger>> = {};
  const kit: Partial<Record<Tier, Ledger>> = {};
  const gateSecs: Partial<Record<Tier, number>> = {};
  const kitSecs: Partial<Record<Tier, number>> = {};

  const wornTier = () =>
    Math.min(...KIT_SLOTS.map((slot) => {
      const id = state.equipment[slot];
      return id && id in TIER_INDEX ? TIER_INDEX[id] : -1;
    }));
  const record = () => {
    const worn = wornTier();
    TIERS.forEach((t, i) => {
      if (!gate[t.tier] && state.skills.attack.lvl >= t.level && state.skills.defence.lvl >= t.level) {
        gate[t.tier] = copyLedger(ledger);
        gateSecs[t.tier] = secs;
      }
      if (!kit[t.tier] && worn >= i) {
        kit[t.tier] = copyLedger(ledger);
        kitSecs[t.tier] = secs;
      }
    });
  };

  record();
  if (opts.playChain) {
    ledger = playStarterChain(state);
    if (ledger.questsClaimed !== STARTER_QUESTS.length - 1) throw new Error('The chain left a starter quest unclaimed.');
    secs += QUEST_SECS * ledger.questsClaimed;
  }
  const owned = new Set<string>([
    ...state.inventory.map((s) => s.id),
    ...Object.values(state.equipment).filter((id): id is string => !!id)
  ]);

  // Purchase rule (CALL-3.2): weapon, body, legs; the highest tier above the worn one that is wearable
  // and owned or affordable at the shop price.
  const upgrade = () => {
    for (const slot of KIT_SLOTS) {
      const id = state.equipment[slot];
      const current = id && id in TIER_INDEX ? TIER_INDEX[id] : -1;
      let pick: string | null = null;
      for (let i = current + 1; i < TIERS.length; i++) {
        const want = TIERS[i][slot];
        if (!canWear(state, ITEMS[want])) continue;
        if (owned.has(want) || (opts.useShop && state.gp >= opts.priceOf(ITEMS[want]))) pick = want;
      }
      if (!pick) continue;
      if (!owned.has(pick)) {
        const price = opts.priceOf(ITEMS[pick]);
        state.gp -= price;
        ledger.goldSpent += price;
        ledger.actions += 1;
        secs += PURCHASE_SECS;
        owned.add(pick);
      }
      state.equipment[slot] = pick;
    }
  };

  record();
  upgrade();
  record();

  const chainTask = state.quests.slayer;
  let task: { band: SlayerBand; remaining: number } | null = null;
  if (chainTask && chainTask.remaining > 0) {
    const band = SLAYER_BANDS.find((b) => b.monster === chainTask.monster);
    if (!band) throw new Error(`No Slayer band for ${chainTask.monster}.`);
    task = { band, remaining: chainTask.remaining };
  }
  let questsPaid = !opts.useQuests;
  let last = '';
  const expected: Record<string, number> = {};

  while (!kit.dragon) {
    if (secs > GUARD_SECS) throw new Error('Pacing model: no dragon kit within 400 simulated hours.');
    let best: { type: string; rate: number; secs: number } | null = null;
    for (const type of FIGHT_TYPES) {
      const f = fight(state, type);
      if (!f.win) continue;
      const rate = MONSTER_TYPES[type].hp / f.secs;
      if (!best || rate > best.rate) best = { type, rate, secs: f.secs };
    }
    if (!best) throw new Error('Pacing model: no monster the fighter can win against.');
    const type = best.type;
    const m = MONSTER_TYPES[type];
    if (last && type !== last) secs += SWITCH_SECS;
    last = type;
    if (opts.useSlayer && !task) {
      const band = pickSlayerBand(combatLevel(state));
      if (band) {
        task = { band, remaining: band.count };
        ledger.actions += 1;
        secs += SLAYER_WALK_SECS;
      }
    }

    secs += best.secs;
    ledger.actions += 1;
    ledger.killsTotal += 1;
    ledger.kills[type] = (ledger.kills[type] || 0) + 1;
    const dmg = m.hp * state.xpMultiplier;
    addXp(state, 'attack', 1.4 * dmg);
    addXp(state, 'strength', 1.3 * dmg);
    addXp(state, 'defence', 1.3 * dmg);
    addXp(state, 'hitpoints', 1.5 * dmg);

    for (const entry of m.drops) {
      if (entry.gp) {
        const coins = (entry.chance * (entry.gp[0] + entry.gp[1])) / 2;
        state.gp += coins;
        ledger.goldEarned.coins += coins;
        continue;
      }
      const item = entry.id ? ITEMS[entry.id] : undefined;
      if (!opts.useDrops || item?.type !== 'equip') continue;
      const chance = dropChanceOf(type, entry);
      if (item.id in TIER_INDEX && !owned.has(item.id)) {
        expected[item.id] = (expected[item.id] || 0) + chance;
        if (expected[item.id] >= 1) owned.add(item.id);
      } else {
        const gold = chance * unitSellPrice(item);
        state.gp += gold;
        ledger.goldEarned.gear += gold;
      }
    }

    if (task && task.band.monster === type) {
      addXp(state, 'attack', task.band.killXp);
      task.remaining -= 1;
      if (task.remaining <= 0) {
        const bounty = bountyOf(task.band);
        state.gp += bounty;
        ledger.goldEarned.slayer += bounty;
        addXp(state, 'attack', task.band.bountyXp);
        task = null;
      }
    }

    if (!questsPaid) {
      questsPaid = true;
      for (const id of START_TOWN_QUESTS) {
        const def = QUEST_DEFS.find((q) => q.id === id);
        if (!def) throw new Error(`No quest ${id}.`);
        state.gp += def.gp;
        ledger.goldEarned.quests += def.gp;
        for (const [skill, amount] of Object.entries(def.xp)) addXp(state, skill, amount);
        ledger.questsClaimed += 1;
        ledger.actions += 1;
        secs += QUEST_SECS;
      }
    }

    record();
    upgrade();
    record();
  }

  return {
    gate: gate as Record<Tier, Ledger>,
    kit: kit as Record<Tier, Ledger>,
    averageSeconds: { gate: gateSecs as Record<Tier, number>, kit: kitSecs as Record<Tier, number> }
  };
}

export function furtherKills(run: Run, tier: Tier): number {
  return run.kit[tier].killsTotal - run.gate[tier].killsTotal;
}

export function tiersBehind(run: Run, tier: Tier): number {
  const at = TIER_NAMES.indexOf(tier);
  return TIER_NAMES.slice(at + 1).filter((later) => run.gate[later].killsTotal < run.kit[tier].killsTotal).length;
}

/** The largest group of nodes of one type in which each stands within 15 units of another. */
export function siteSize(nodeKey: string): number {
  const nodes = NODE_PLACEMENTS.filter((p) => p.type === nodeKey);
  if (!nodes.length) throw new Error(`No placement of ${nodeKey}.`);
  const seen = new Set<number>();
  let largest = 0;
  for (let i = 0; i < nodes.length; i++) {
    if (seen.has(i)) continue;
    const queue = [i];
    seen.add(i);
    let size = 0;
    while (queue.length) {
      const a = nodes[queue.pop()!];
      size += 1;
      nodes.forEach((b, j) => {
        if (!seen.has(j) && Math.hypot(a.x - b.x, a.z - b.z) <= SITE_LINK) {
          seen.add(j);
          queue.push(j);
        }
      });
    }
    largest = Math.max(largest, size);
  }
  return largest;
}

/** Share of successful catches that empty a fishing spot: the value the engine rolls against. */
export const FISH_DEPLETION = FISH_DEPLETION_CHANCE;

/** Seconds per item at a site, design 4.2. A gather that does not empty the node needs no step. */
export function gatherSeconds(nodeKey: string, level: number): number {
  const node = NODES[nodeKey];
  const chance = gatherChance(level, node.req);
  if (chance <= 0) throw new Error(`${nodeKey} cannot be gathered at level ${level}.`);
  const depletion = node.kind === 'fish' ? FISH_DEPLETION : 1;
  const work = TICK_SEC / chance;
  return Math.max(work + depletion * GATHER_STEP_SECS, (work + (depletion * node.respawn) / 1000) / siteSize(nodeKey));
}

/** The cooked value of a raw fish, or the item's own sale value. */
function gatherValue(item: string): number {
  const cook = FORGE_RECIPES.find((r) => r.kind === 'cook' && r.input[item]);
  if (cook?.output) return unitSellPrice(ITEMS[cook.output]) * (cook.outputQty || 1);
  return unitSellPrice(ITEMS[item]);
}

export function gatherGpPerHour(nodeKey: string, level: number): number {
  return (3600 / gatherSeconds(nodeKey, level)) * gatherValue(NODES[nodeKey].item);
}

/** Sale value of the output quantity over the sale value of the direct inputs. */
export function saleRatio(recipe: RecipeDef): number {
  const out = recipe.output ? unitSellPrice(ITEMS[recipe.output]) * (recipe.outputQty || 1) : 0;
  const inputs = Object.entries(recipe.input).reduce((sum, [id, qty]) => sum + unitSellPrice(ITEMS[id]) * qty, 0);
  return out / inputs;
}

/** The smith recipes that make a tier's weapon, body or legs. */
export function tierRecipes(tier: Tier): RecipeDef[] {
  const t = TIERS.find((x) => x.tier === tier)!;
  const pieces = KIT_SLOTS.map((slot) => t[slot]);
  return FORGE_RECIPES.filter((r) => r.kind === 'smith' && !!r.output && pieces.includes(r.output));
}

/** Every skill level a recipe needs, its inputs' smelting and gathering included. */
function requirements(recipe: RecipeDef, need: Record<string, number> = {}): Record<string, number> {
  need[recipe.skill] = Math.max(need[recipe.skill] || 0, recipe.req);
  for (const input of Object.keys(recipe.input)) {
    const smelt = smeltFor(input);
    if (smelt) {
      requirements(recipeById(smelt)!, need);
      continue;
    }
    const node = NODES[Object.keys(NODES).find((k) => NODES[k].item === input) ?? ''];
    if (!node) throw new Error(`${recipe.id}: ${input} is neither gathered nor smelted.`);
    need[node.skill] = Math.max(need[node.skill] || 0, node.req);
  }
  return need;
}

/**
 * The forge route of design 4.5 / 7.1 item 5 from a new game: mine the best ore the hero can mine and
 * smelt, smelt and forge everything, until the tier's recipes and its ore are unlocked; then mine,
 * smelt and forge the kit. No step uses the shop, so `goldSpent` stays 0.
 */
export function forgeTasks(tier: Tier): Ledger {
  const recipes = tierRecipes(tier);
  if (!recipes.length) throw new Error(`${tier} has no forge recipe.`);
  const need: Record<string, number> = {};
  for (const r of recipes) requirements(r, need);
  const state = createNewGameState();
  const ledger = emptyLedger();
  const lvl = (skill: string) => state.skills[skill].lvl;
  const unlocked = () => Object.entries(need).every(([skill, level]) => lvl(skill) >= level);
  const smiths = FORGE_RECIPES.filter((r) => r.kind === 'smith').sort((a, b) => b.req - a.req);
  const smelts = FORGE_RECIPES.filter((r) => r.kind === 'smelt');
  const canMake = (r: RecipeDef) => lvl(r.skill) >= r.req && Object.entries(r.input).every(([id, qty]) => countItem(state, id) >= qty);

  while (!unlocked()) {
    if (ledger.actions > 200_000) throw new Error(`forgeTasks(${tier}) did not unlock.`);
    const rocks = Object.keys(NODES).filter((k) => {
      const node = NODES[k];
      return node.skill === 'mining' && node.req <= lvl('mining') && smelts.some((s) => !!s.input[node.item] && s.req <= lvl(s.skill));
    });
    if (!rocks.length) throw new Error(`forgeTasks(${tier}): no rock to mine.`);
    const rock = rocks.reduce((a, b) => (NODES[b].req > NODES[a].req ? b : a));
    gather(state, ledger, NODES[rock].item);
    for (const s of smelts) while (canMake(s)) craft(state, ledger, s.id);
    for (let made = true; made; ) {
      made = false;
      for (const r of smiths) {
        if (!canMake(r)) continue;
        craft(state, ledger, r.id);
        // Forged pieces go to the bank so the backpack never fills; the trip is not counted.
        if (!deposit(state, r.output!, 'all').ok) throw new Error(`forgeTasks(${tier}): bank refused ${r.output}.`);
        made = true;
      }
    }
  }
  for (const r of recipes) forge(state, ledger, r.id);
  return ledger;
}

/** The kit's price at `priceOf`, for the printed share. */
export function kitPrice(tier: Tier, priceOf: (item: ItemDef) => number): number {
  const t = TIERS.find((x) => x.tier === tier)!;
  return KIT_SLOTS.reduce((sum, slot) => sum + priceOf(ITEMS[t[slot]]), 0);
}

export const totalEarned = (l: Ledger) => l.goldEarned.coins + l.goldEarned.gear + l.goldEarned.slayer + l.goldEarned.quests;
