import { ammoForWeapon, ITEMS, type ItemDef } from '../data/items';
import { SPELLS } from '../data/magic';
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
