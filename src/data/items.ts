import { ITEMS as BASE_ITEMS, TIER_COLORS } from './catalog';
import { EXTRA_ITEMS } from './extras';

export { TIER_COLORS };

export type ItemDef = {
  id: string;
  name: string;
  type: string;
  slot?: string;
  iconKind?: string;
  style?: string;
  tier?: string;
  atk?: number;
  str?: number;
  def?: number;
  rng?: number;
  mag?: number;
  req?: Record<string, number>;
  price: number;
  color?: number;
  trim?: number;
  heal?: number;
  restorePrayer?: number;
  xp?: number;
  pairId?: string;
  setName?: string;
  [key: string]: unknown;
};

export const ITEMS: Record<string, ItemDef> = {
  ...(BASE_ITEMS as Record<string, ItemDef>),
  ...(EXTRA_ITEMS as Record<string, ItemDef>)
};

/** Bows and crossbows spend a stack of ammo. The Sheikah bow is self-drawn. */
const AMMO_BY_WEAPON: Record<string, string | null> = {
  shortbow: 'bronze_arrow',
  willow_bow: 'bronze_arrow',
  maple_bow: 'bronze_arrow',
  yew_bow: 'bronze_arrow',
  magic_bow: 'bronze_arrow',
  ancient_bow: null,
  rune_crossbow: 'bronze_bolts',
  armadyl_crossbow: 'bronze_bolts'
};

export function ammoForWeapon(item: ItemDef | null | undefined): string | null {
  if (!item || item.style !== 'ranged') return null;
  if (Object.prototype.hasOwnProperty.call(AMMO_BY_WEAPON, item.id)) return AMMO_BY_WEAPON[item.id];
  if (item.iconKind === 'crossbow') return 'bronze_bolts';
  return 'bronze_arrow';
}

/** Equipment stays one-per-slot in the backpack. Everything else stacks. */
export function isStackableInBackpack(item: ItemDef | null | undefined): boolean {
  if (!item) return false;
  return item.type !== 'equip';
}

/** The bank vault stacks every item, including duplicate armor pieces. */
export function isStackableInBank(item: ItemDef | null | undefined): boolean {
  return !!item;
}

export const SELL_RATIO = 0.65;

export function unitSellPrice(item: ItemDef | null | undefined): number {
  if (!item) return 1;
  return Math.max(1, Math.floor((item.price || 10) * SELL_RATIO));
}

export type CombatClass = 'melee' | 'ranged' | 'magic' | 'all_around' | 'supply';

const ALL_AROUND_IDS = new Set([
  'champion_tunic', 'champion_leggings', 'champion_circlet',
  'zora_armor', 'zora_greaves', 'barrows_gloves', 'infernal_cape', 'elysian_shield',
  'amulet_accuracy', 'amulet_power', 'amulet_glory', 'amulet_fury',
  'hylian_tunic', 'hylian_trousers', 'hylian_hood', 'hylian_cape', 'obsidian_cape',
  'leather_boots'
]);

const RANGED_IDS = new Set([
  'robin_hat', 'ranger_boots', 'pegasian_boots', 'leather_gloves',
  'ava_accumulator', 'necklace_anguish', 'archers_ring'
]);

const MAGIC_IDS = new Set(['eternal_boots', 'god_cape', 'occult_necklace', 'seers_ring']);

const MELEE_IDS = new Set([
  'neitiznot_helm', 'hylian_shield', 'primordial_boots', 'ferocious_gloves',
  'fire_cape', 'amulet_torture', 'warrior_ring', 'berserker_ring', 'ultor_ring',
  'wooden_shield'
]);

const RANGED_PREFIXES = ['green_dhide_', 'blue_dhide_', 'red_dhide_', 'black_dhide_', 'sheikah_', 'armadyl_', 'masori_'];
const MAGIC_PREFIXES = ['wizard_', 'mystic_', 'infinity_', 'ahrim_', 'ancestral_'];
const MELEE_PREFIXES = [
  'bronze_', 'iron_', 'steel_', 'black_', 'white_', 'mith_', 'addy_', 'rune_',
  'gilded_', 'granite_', 'dragon_', 'dharok_', 'torag_', 'bandos_', 'justiciar_',
  'inquisitor_', 'torva_', 'deity_'
];

function hasPrefix(id: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => id.startsWith(prefix));
}

function spansStyles(item: ItemDef): boolean {
  const melee = (item.atk || 0) + (item.str || 0);
  const ranged = item.rng || 0;
  const magic = item.mag || 0;
  return (melee > 0 && (ranged > 0 || magic > 0)) || (ranged > 0 && magic > 0);
}

/** Shop combat class. Weapons follow their style; named hybrid pieces stay all-around. */
export function itemCombatClass(item: ItemDef | null | undefined): CombatClass {
  if (!item) return 'supply';
  if (item.type === 'rune') return 'magic';
  if (item.type === 'ammo') return 'ranged';
  if (item.type === 'food' || item.type === 'potion') return 'all_around';
  if (item.type !== 'equip') return 'supply';

  if (item.style === 'ranged') return 'ranged';
  if (item.style === 'magic') return 'magic';
  if (item.style === 'melee') return 'melee';

  if (ALL_AROUND_IDS.has(item.id)) return 'all_around';
  if (RANGED_IDS.has(item.id) || hasPrefix(item.id, RANGED_PREFIXES)) return 'ranged';
  if (MAGIC_IDS.has(item.id) || hasPrefix(item.id, MAGIC_PREFIXES)) return 'magic';
  if (MELEE_IDS.has(item.id) || hasPrefix(item.id, MELEE_PREFIXES)) return 'melee';
  if (spansStyles(item)) return 'all_around';
  if ((item.rng || 0) > 0) return 'ranged';
  if ((item.mag || 0) > 0) return 'magic';
  return 'melee';
}

export function combatClassLabel(kind: CombatClass): string {
  if (kind === 'all_around') return 'All-Around';
  if (kind === 'melee') return 'Melee';
  if (kind === 'ranged') return 'Ranged';
  if (kind === 'magic') return 'Magic';
  return 'Supply';
}
