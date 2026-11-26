// Boss data shared by fight.ts and check.ts (the positional fight). R0 (2026-11-26): Stage 4 is merged, so the copy of
// Ashmantle's row and attacks is gone (and the first draft's dragon fight with it); ASHMANTLE is read from the game's own
// tables. The types stay: content.ts writes this stage's three bosses in this shape, and fight.ts turns one into a BossDef.
import { ATTACKS, BOSSES, type AttackDef, type Shape } from '../../../../src/data/attacks';
import { MONSTER_TYPES } from '../../../../src/data/world';

export type { Shape };
/** A boss attack: the game's AttackDef without its display name. */
export type Attack = Omit<AttackDef, 'name'>;
export type Phase = { name: string; untilHpFrac: number; pattern: string[]; cadenceMult: number; shiftMs?: number };
export type BossConfig = {
  typeKey: string; hp: number; markStep: number;
  attacks: Record<string, Attack>; phases: Phase[];
  /** The opening roar. Stage 4's Ashmantle has one; this stage's rows write none, so none is modelled for them. */
  openingShiftMs?: number;
};

export const BOSS_KEY = 'ashmantle';
const ash = BOSSES[BOSS_KEY];
const ashIds = [...new Set(ash.phases.flatMap((p) => p.pattern))].filter((id) => id !== 'basic');
/** Stage 4's boss, exactly as shipped. */
export const ASHMANTLE: BossConfig = {
  typeKey: BOSS_KEY, hp: MONSTER_TYPES[BOSS_KEY].hp, markStep: ash.mark.step, openingShiftMs: ash.openingShiftMs,
  attacks: Object.fromEntries(ashIds.map((id) => [id, ATTACKS[id]])),
  phases: ash.phases.map((p) => ({ ...p }))
};
