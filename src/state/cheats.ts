import { OSRS_XP_TABLE } from '../data/skills';
import type { GameState } from './types';

/** Typed on the keyboard, or into the Settings box with an optional :: prefix. */
export const SKILL_CHEAT_CODES = ['wiseoldman', 'skills10', 'levelup', 'lvl10', 'up10'] as const;
export const GOLD_CHEAT_CODES = ['motherlode', 'gold200k', 'gp200k', '200k'] as const;

export function normalizeCheatText(raw: string): string {
  return String(raw || '').trim().toLowerCase().replace(/^::/, '');
}

/** Longest codes first so a short alias cannot swallow a longer one. */
export function matchCheat(raw: string): 'skills' | 'gold' | null {
  const code = normalizeCheatText(raw);
  if (!code) return null;
  if (SKILL_CHEAT_CODES.some((entry) => code === entry || code.endsWith(entry))) return 'skills';
  if (GOLD_CHEAT_CODES.some((entry) => code === entry || code.endsWith(entry))) return 'gold';
  return null;
}

/**
 * Raise every skill by 10, capped at 99.
 * XP is at least the threshold for the new level (and for the previous index the
 * prompt names). Save reload derives level from XP, so the floor has to be
 * OSRS_XP_TABLE[lvl] or the boost would fall off on the next load.
 */
export function applySkillsPlus10(state: GameState): void {
  for (const key of Object.keys(state.skills)) {
    const skill = state.skills[key];
    if (!skill) continue;
    skill.lvl = Math.min(99, (skill.lvl || 1) + 10);
    const previousIndex = OSRS_XP_TABLE[Math.max(0, skill.lvl - 1)] ?? 0;
    const levelFloor = OSRS_XP_TABLE[skill.lvl] ?? previousIndex;
    skill.xp = Math.max(skill.xp || 0, previousIndex, levelFloor);
  }
  const hitpoints = state.skills.hitpoints ? state.skills.hitpoints.lvl : state.maxHp;
  const prayer = state.skills.prayer ? state.skills.prayer.lvl : state.maxPrayerPts;
  state.maxHp = hitpoints;
  state.hp = state.maxHp;
  state.maxPrayerPts = prayer;
  state.prayerPts = state.maxPrayerPts;
}

export function applyGold200k(state: GameState): void {
  state.gp += 200000;
}
