import { ITEMS } from '../data/items';
import { getLevelForXp, OSRS_XP_TABLE } from '../data/skills';
import { combatLevel } from './adventure';
import { creditGp, HP_REGEN_PER_SEC } from './economy';
import type { GameState } from './types';

export const FOOD_CD_SECS = 1.8;
export const POTION_CD_SECS = 1.8;
export const COMBAT_REST_SECS = 6;
export const HP_REGEN_RESTING_PER_SEC = 1.0;
export const DEATH_XP_SHARE = 0.03;
export const DEATH_MIN_COMBAT = 15;
export const VOW_COINS_PER_XP = 1;
export const VOW_MIN_PRICE = 250;

export const FIGHTING_SKILLS = [
  'attack',
  'strength',
  'defence',
  'hitpoints',
  'ranged',
  'magic'
] as const;

export type FightingSkill = (typeof FIGHTING_SKILLS)[number];

export interface CooldownClock {
  readyAt: number;
}

export interface SustainResult {
  ok: boolean;
  reason: string;
  restored?: number;
}

export type DeathOutcome =
  | { kind: 'none' }
  | { kind: 'vow' }
  | { kind: 'waived' }
  | { kind: 'lost'; amounts: Record<FightingSkill, number> };

export interface RetaliateContext {
  hasTarget: boolean;
  walking: boolean;
  keyHeld: boolean;
  downed: boolean;
  windupLive: boolean;
}

export function canEat(clock: CooldownClock, now: number): boolean {
  return now >= clock.readyAt;
}

export function eat(
  state: GameState,
  slot: number,
  clock: CooldownClock,
  now: number
): SustainResult {
  const stack = state.inventory[slot];
  if (!stack || stack.qty <= 0) {
    return { ok: false, reason: 'Slot is empty.' };
  }
  const item = ITEMS[stack.id];
  if (!item || item.type !== 'food') {
    return { ok: false, reason: 'That is not food.' };
  }
  if (!canEat(clock, now)) {
    return { ok: false, reason: 'You cannot eat yet.' };
  }
  clock.readyAt = now + FOOD_CD_SECS;
  stack.qty -= 1;
  if (stack.qty <= 0) {
    state.inventory.splice(slot, 1);
  }
  const oldHp = state.hp;
  state.hp = Math.min(state.maxHp, state.hp + (item.heal || 1));
  const restored = Math.max(0, Math.round(state.hp - oldHp));
  return { ok: true, reason: '', restored };
}

export function drink(
  state: GameState,
  slot: number,
  clock: CooldownClock,
  now: number
): SustainResult {
  const stack = state.inventory[slot];
  if (!stack || stack.qty <= 0) {
    return { ok: false, reason: 'Slot is empty.' };
  }
  const item = ITEMS[stack.id];
  if (!item || item.type !== 'potion') {
    return { ok: false, reason: 'That is not a potion.' };
  }
  if (now < clock.readyAt) {
    return { ok: false, reason: 'You cannot drink yet.' };
  }
  clock.readyAt = now + POTION_CD_SECS;
  stack.qty -= 1;
  if (stack.qty <= 0) {
    state.inventory.splice(slot, 1);
  }
  const oldPts = state.prayerPts;
  state.prayerPts = Math.min(state.maxPrayerPts, state.prayerPts + (item.restorePrayer || 15));
  const restored = Math.max(0, Math.round(state.prayerPts - oldPts));
  return { ok: true, reason: '', restored };
}

export function regenRate(sinceCombatSecs: number): number {
  return sinceCombatSecs < COMBAT_REST_SECS ? HP_REGEN_PER_SEC : HP_REGEN_RESTING_PER_SEC;
}

export function deathLoss(state: GameState): Record<FightingSkill, number> {
  const loss: Record<FightingSkill, number> = {
    attack: 0,
    strength: 0,
    defence: 0,
    hitpoints: 0,
    ranged: 0,
    magic: 0
  };
  if (combatLevel(state) < DEATH_MIN_COMBAT) {
    return loss;
  }
  for (const k of FIGHTING_SKILLS) {
    const progress = state.skills[k];
    const lvl = progress.lvl;
    if (lvl >= 99) {
      loss[k] = 0;
      continue;
    }
    const span = OSRS_XP_TABLE[lvl + 1] - OSRS_XP_TABLE[lvl];
    const inside = Math.max(0, Math.floor(progress.xp - OSRS_XP_TABLE[lvl]));
    const maxLoss = Math.floor(DEATH_XP_SHARE * span);
    loss[k] = Math.min(inside, maxLoss);
  }
  return loss;
}

export function guardable(state: GameState): number {
  let sum = 0;
  for (const k of FIGHTING_SKILLS) {
    const lvl = state.skills[k].lvl;
    if (lvl < 99) {
      const span = OSRS_XP_TABLE[lvl + 1] - OSRS_XP_TABLE[lvl];
      sum += Math.floor(DEATH_XP_SHARE * span);
    }
  }
  return sum;
}

export function vowPrice(state: GameState): number {
  return Math.max(VOW_MIN_PRICE, VOW_COINS_PER_XP * guardable(state));
}

export function applyDeathLoss(state: GameState): DeathOutcome {
  if (combatLevel(state) < DEATH_MIN_COMBAT) {
    return { kind: 'none' };
  }
  const loss = deathLoss(state);
  const totalLoss = Object.values(loss).reduce((a, n) => a + n, 0);
  if (totalLoss === 0) {
    return { kind: 'none' };
  }
  if (totalLoss < guardable(state) / 4) {
    return { kind: 'waived' };
  }
  if (state.quests.lanternVow === true) {
    delete state.quests.lanternVow;
    return { kind: 'vow' };
  }
  for (const k of FIGHTING_SKILLS) {
    state.skills[k].xp -= loss[k];
    if (getLevelForXp(state.skills[k].xp) !== state.skills[k].lvl) {
      throw new Error(`applyDeathLoss invariant violation: level changed for ${k}`);
    }
  }
  return { kind: 'lost', amounts: loss };
}

/** Why the hero cannot take the vow now, or null when it can. */
export function vowRefusal(state: GameState): string | null {
  if (combatLevel(state) < DEATH_MIN_COMBAT || guardable(state) === 0) {
    return 'You risk nothing yet.';
  }
  if (state.quests.lanternVow === true) {
    return 'You already hold a Lantern Vow.';
  }
  if (state.gp < vowPrice(state)) {
    return 'You do not have enough coins.';
  }
  return null;
}

/** The altar's word on the vow after a prayer; null when the hero already holds one. */
export function altarVowLine(state: GameState): string | null {
  const refusal = vowRefusal(state);
  if (refusal === 'You already hold a Lantern Vow.') return null;
  if (refusal === 'You risk nothing yet.') return refusal;
  const price = vowPrice(state);
  if (refusal !== null) return `A Lantern Vow costs ${price} coins. You need ${price - state.gp} more coins.`;
  return `A Lantern Vow costs ${price} coins. Right-click the Altar to take the vow.`;
}

export function buyVow(state: GameState): { ok: boolean; reason: string } {
  const refusal = vowRefusal(state);
  if (refusal !== null) {
    return { ok: false, reason: refusal };
  }
  creditGp(state, -vowPrice(state));
  state.quests.lanternVow = true;
  return { ok: true, reason: '' };
}

export function shouldRetaliate(ctx: RetaliateContext): boolean {
  return !ctx.hasTarget && !ctx.walking && !ctx.keyHeld && !ctx.downed && !ctx.windupLive;
}
