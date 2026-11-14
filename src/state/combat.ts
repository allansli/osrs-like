import { ammoForWeapon, ITEMS, type ItemDef } from '../data/items';
import { SPELLS } from '../data/magic';
import { MONSTER_TYPES } from '../data/world';
import { resolveDragonfire } from './adventure';
import { countItem } from './inventory';
import type { GameState } from './types';

export const MELEE_STYLES = ['accurate', 'aggressive', 'defensive', 'controlled'] as const;
export const RANGED_STYLES = ['rapid', 'ranged'] as const;

export type StyleCheck = { ok: boolean; reason: string };

export function equippedWeapon(state: GameState): ItemDef | null {
  const id = state.equipment.weapon;
  return id && ITEMS[id] ? ITEMS[id] : null;
}

export function weaponClass(item: ItemDef | null): 'melee' | 'ranged' | 'magic' | 'unarmed' {
  if (!item) return 'unarmed';
  if (item.style === 'ranged') return 'ranged';
  if (item.style === 'magic') return 'magic';
  return 'melee';
}

export function hasRunes(state: GameState, cost: Record<string, number> | undefined): boolean {
  if (!cost) return true;
  for (const [id, qty] of Object.entries(cost)) {
    if (countItem(state, id) < qty) return false;
  }
  return true;
}

export function runeList(cost: Record<string, number> | undefined): string {
  if (!cost || Object.keys(cost).length === 0) return 'no runes';
  return Object.entries(cost)
    .map(([id, qty]) => `${qty} ${ITEMS[id]?.name || id}`)
    .join(', ');
}

export function canUseStyle(style: string, weapon: ItemDef | null, state: GameState): StyleCheck {
  const klass = weaponClass(weapon);
  if ((MELEE_STYLES as readonly string[]).includes(style)) {
    if (klass === 'melee' || klass === 'unarmed') return { ok: true, reason: '' };
    return { ok: false, reason: 'Melee styles need a melee weapon, or empty hands.' };
  }
  if ((RANGED_STYLES as readonly string[]).includes(style)) {
    if (klass !== 'ranged') {
      return { ok: false, reason: 'Rapid ranged attacks need a bow or crossbow equipped.' };
    }
    const ammo = ammoForWeapon(weapon);
    if (ammo && countItem(state, ammo) < 1) {
      return { ok: false, reason: `You need ${ITEMS[ammo]?.name || 'ammo'} in your backpack to fire.` };
    }
    return { ok: true, reason: '' };
  }
  if (style === 'magic') {
    if (klass !== 'magic') {
      return { ok: false, reason: 'Autocast magic needs a staff or wand. A sword cannot sling spells.' };
    }
    const spell = SPELLS.find((s) => s.id === state.activeSpell && s.type === 'combat');
    if (!spell) return { ok: false, reason: 'Select a combat spell to autocast.' };
    if (!hasRunes(state, spell.runes)) {
      return { ok: false, reason: `You need ${runeList(spell.runes)} to cast ${spell.name}.` };
    }
    return { ok: true, reason: '' };
  }
  return { ok: false, reason: 'That combat style is not available.' };
}

export function allowedStyles(weapon: ItemDef | null): string[] {
  const klass = weaponClass(weapon);
  if (klass === 'ranged') return ['rapid'];
  if (klass === 'magic') return ['magic'];
  return [...MELEE_STYLES];
}

export function normalizeStyle(style: string | undefined): string {
  if (style === 'ranged') return 'rapid';
  if (style === 'rapid' || style === 'magic' || (MELEE_STYLES as readonly string[]).includes(style || '')) return style as string;
  return 'accurate';
}

export interface AttackPrep {
  ok: boolean;
  reason: string;
  consume: Array<{ id: string; qty: number }>;
}

/** Validates the equipped weapon and returns ammo or runes that a swing must spend. */
export function prepareAttack(state: GameState): AttackPrep {
  const weapon = equippedWeapon(state);
  const check = canUseStyle(state.combatStyle, weapon, state);
  if (!check.ok) return { ok: false, reason: check.reason, consume: [] };
  if ((RANGED_STYLES as readonly string[]).includes(state.combatStyle)) {
    const ammo = ammoForWeapon(weapon);
    return { ok: true, reason: '', consume: ammo ? [{ id: ammo, qty: 1 }] : [] };
  }
  if (state.combatStyle === 'magic') {
    const spell = SPELLS.find((s) => s.id === state.activeSpell && s.type === 'combat');
    const consume = Object.entries(spell?.runes || {}).map(([id, qty]) => ({ id, qty }));
    return { ok: true, reason: '', consume };
  }
  return { ok: true, reason: '', consume: [] };
}

/**
 * Overhead prayers keep 20% of the matching attack style.
 * Protect from Ranged only applies to ranged monsters — not melee or magic.
 */
export function mitigateDamage(raw: number, monsterStyle: string, prayers: Set<string>): number {
  let dmg = Math.max(0, Math.floor(raw));
  if (dmg <= 0) return 0;
  if (monsterStyle === 'melee' && prayers.has('prot_melee')) dmg = Math.floor(dmg * 0.2);
  if (monsterStyle === 'magic' && prayers.has('prot_magic')) dmg = Math.floor(dmg * 0.2);
  if ((monsterStyle === 'ranged' || monsterStyle === 'rapid') && prayers.has('prot_ranged')) {
    dmg = Math.floor(dmg * 0.2);
  }
  return dmg;
}

export function canCastTeleport(state: GameState, spellId: string): { ok: boolean; reason: string; regionId?: string; xp?: number; runes?: Record<string, number> } {
  const spell = SPELLS.find((s) => s.id === spellId);
  if (!spell || spell.type !== 'teleport') return { ok: false, reason: 'That is not a teleport spell.' };
  if ((state.skills.magic?.lvl || 1) < spell.req) {
    return { ok: false, reason: `You need Magic level ${spell.req} to cast ${spell.name}.` };
  }
  if (!hasRunes(state, spell.runes)) {
    return { ok: false, reason: `You need ${runeList(spell.runes)} to cast ${spell.name}.` };
  }
  return { ok: true, reason: '', regionId: spell.regionId, xp: spell.xp, runes: spell.runes };
}

export interface EquipmentBonuses {
  atk: number;
  str: number;
  def: number;
  rng: number;
  mag: number;
  matchedSet: string | null;
  isFullKit: boolean;
  dominantCount: number;
  dominantSetName: string | null;
}

export function getEquipmentBonuses(state: GameState): EquipmentBonuses {
  let atk = 0, str = 0, def = 0, rng = 0, mag = 0;
  const setCounts: Record<string, number> = {};
  for (const slot of Object.keys(state.equipment)) {
    const itemId = state.equipment[slot];
    if (itemId && ITEMS[itemId]) {
      const it = ITEMS[itemId];
      atk += (it.atk || 0);
      str += (it.str || 0);
      def += (it.def || 0);
      rng += (it.rng || 0);
      mag += (it.mag || 0);
      if (it.setName) {
        setCounts[it.setName] = (setCounts[it.setName] || 0) + 1;
      }
    }
  }

  const bodyIt = state.equipment.body ? ITEMS[state.equipment.body] : null;
  const legsIt = state.equipment.legs ? ITEMS[state.equipment.legs] : null;

  let dominantSetName: string | null = null;
  let dominantCount = 0;
  for (const [sName, count] of Object.entries(setCounts)) {
    if (count > dominantCount) {
      dominantSetName = sName;
      dominantCount = count;
    }
  }

  let matchedSet: string | null = null;
  let isFullKit = false;

  if (dominantSetName && dominantCount >= 4) {
    // 4+ matching kit pieces = Full Kit Set Bonus (+20% combat bonuses)
    matchedSet = `${dominantSetName} (${dominantCount} pcs)`;
    isFullKit = true;
    atk = Math.ceil(atk * 1.20);
    str = Math.ceil(str * 1.20);
    def = Math.ceil(def * 1.20);
    rng = Math.ceil(rng * 1.20);
    mag = Math.ceil(mag * 1.20);
  } else if (dominantSetName && dominantCount >= 3) {
    // 3 matching kit pieces = Tri-piece bonus (+15% combat bonuses)
    matchedSet = `${dominantSetName} (${dominantCount} pcs)`;
    atk = Math.ceil(atk * 1.15);
    str = Math.ceil(str * 1.15);
    def = Math.ceil(def * 1.15);
    rng = Math.ceil(rng * 1.15);
    mag = Math.ceil(mag * 1.15);
  } else if (bodyIt && legsIt && bodyIt.pairId === legsIt.id) {
    // Matched Top & Bottom pair = Pair bonus (+10% combat bonuses)
    matchedSet = bodyIt.setName || `${bodyIt.name} & ${legsIt.name}`;
    atk = Math.ceil(atk * 1.10);
    str = Math.ceil(str * 1.10);
    def = Math.ceil(def * 1.10);
    rng = Math.ceil(rng * 1.10);
    mag = Math.ceil(mag * 1.10);
  }

  return { atk, str, def, rng, mag, matchedSet, isFullKit, dominantCount, dominantSetName };
}

export function rollMonsterHit(
  typeKey: string,
  breathCount: number,
  state: GameState,
  rand: () => number
): { dmg: number; dragonfire: boolean; absorbed: boolean } {
  const def = MONSTER_TYPES[typeKey];
  const bon = getEquipmentBonuses(state);
  const defLvl = state.skills.defence.lvl + (state.combatStyle === 'defensive' ? 3 : 0);
  const prayDefMult = state.activePrayers.has('piety') ? 1.25 : (state.activePrayers.has('thick_skin') ? 1.15 : 1.0);
  const playerDefScore = (defLvl * 1.2 + bon.def) * prayDefMult + 10;
  const monAtkScore = def.atk * 1.25 + 8;

  const hitChance = Math.min(0.82, Math.max(0.12, monAtkScore / (monAtkScore + playerDefScore)));
  const dragonfire = typeKey === 'elvarg_dragon' && breathCount % 3 === 0;

  let dmg = 0;
  let absorbed = false;
  if (rand() < hitChance) {
    if (dragonfire) {
      const raw = Math.max(1, Math.floor(rand() * 43));
      const resolved = resolveDragonfire(raw, state);
      dmg = resolved.damage;
      absorbed = resolved.absorbed && raw > 0;
    } else {
      dmg = Math.max(1, Math.floor(rand() * (def.maxHit + 1)));
      dmg = mitigateDamage(dmg, def.style, state.activePrayers);
    }
  }

  return { dmg, dragonfire, absorbed };
}

