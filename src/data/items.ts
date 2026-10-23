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
