// Boss data shared by model.ts (timing rule) and fight.ts / check.ts (the positional fight).
// One table, so the two outputs cannot disagree. Revision of 2026-11-14 (owner decisions):
// the existing dragon is untouched; the phased fight belongs to a separate, new boss.
export type Shape =
  | { type: 'circle'; anchor: 'target' | 'self'; radius: number }
  | { type: 'cone'; length: number; halfAngleDeg: number }
  | { type: 'line'; length: number; halfWidth: number }
  | { type: 'ring'; inner: number; outer: number };
export type Attack = {
  id: string; shape: Shape; windupMs: number; slots: number;
  style: 'melee' | 'ranged' | 'magic' | 'fire' | 'pure' | 'own';
  power?: number; // bosses: sure damage power x (0.75..1.0) when inside the shape
  reach: number; // farthest the target stands from the monster when the shape locks
};
export type Phase = { name: string; untilHpFrac: number; pattern: string[]; cadenceMult: number };
export type BossConfig = {
  typeKey: string; hp: number; markStep: number;
  attacks: Record<string, Attack>; phases: Phase[];
};

/** The new boss's row in MONSTER_TYPES (design 6.4). The scripts register it; the game gets it in plan task M3. */
export const BOSS_KEY = 'ashmantle';
export const BOSS_ROW = {
  name: 'Ashmantle the Slag Wyrm', level: 110, hp: 1400, maxHit: 72, atk: 120, def: 78, scale: 2.35,
  style: 'magic', bodyColor: 0x3f3f46, accentColor: 0xf97316, kind: 'dragon',
  drops: [] as unknown[]
};
export const ARENA = { x: -102, z: 54, radius: 12, margin: 6 };

export const BOSS_ATTACKS: Record<string, Attack> = {
  // Reaches a ranged hero at 11 to 13.5 (the first draft's 12-long cone was left by one step back).
  ember_cone:  { id: 'ember_cone',  shape: { type: 'cone', length: 16, halfAngleDeg: 45 },          windupMs: 1800, slots: 2, style: 'fire',  power: 50, reach: 13.5 },
  tail_sweep:  { id: 'tail_sweep',  shape: { type: 'circle', anchor: 'self', radius: 5.0 },         windupMs: 1700, slots: 2, style: 'melee', power: 46, reach: 5 },
  // Molten rock, not flame: nothing cuts it (the first draft's Cinder Fall was fire, which a prepared hero who
  // never moved shrugged off at 25%).
  slag_rain:   { id: 'slag_rain',   shape: { type: 'circle', anchor: 'target', radius: 2.5 },       windupMs: 1500, slots: 1, style: 'pure',  power: 30, reach: 13.5 },
  // The pair of phase III: the nova burns everything from 8 units out (run in), the burst then covers
  // the disc the nova left safe (run out). No standing distance is safe through both.
  ashen_nova:  { id: 'ashen_nova',  shape: { type: 'ring', inner: 8.0, outer: 20 },                 windupMs: 2000, slots: 2, style: 'pure',  power: 60, reach: 13.5 },
  slagburst:   { id: 'slagburst',   shape: { type: 'circle', anchor: 'self', radius: 8.0 },         windupMs: 2000, slots: 2, style: 'melee', power: 52, reach: 8 }
};
export const BOSS: BossConfig & { respawnSecs: number; markMax: number; markSecs: number; shiftMs: number } = {
  typeKey: BOSS_KEY, hp: BOSS_ROW.hp, markStep: 0.25, markMax: 4, markSecs: 12, shiftMs: 2000, respawnSecs: 120,
  attacks: BOSS_ATTACKS,
  // Phases II and III open with their signature attack, so a hero who kills fast still meets it.
  phases: [
    { name: 'I Grounded', untilHpFrac: 0.66, pattern: ['basic', 'basic', 'ember_cone', 'basic', 'tail_sweep'], cadenceMult: 1 },
    { name: 'II Rain of Slag', untilHpFrac: 0.33, pattern: ['slag_rain', 'slag_rain', 'slag_rain', 'tail_sweep', 'basic', 'ember_cone', 'basic'], cadenceMult: 1 },
    { name: 'III Fury', untilHpFrac: 0, pattern: ['ashen_nova', 'slagburst', 'basic', 'ember_cone', 'basic', 'slag_rain', 'slag_rain'], cadenceMult: 0.8 }
  ]
};

/** The first draft's fight (the existing dragon at 1,200 hitpoints). Kept only as the baseline that shows
 *  what in-combat regeneration and the ranged and magic fighters do to it. Not a proposal any more. */
export const FIRST_DRAFT: BossConfig = {
  typeKey: 'elvarg_dragon', hp: 1200, markStep: 0.25,
  attacks: {
    ember_cone:  { id: 'ember_cone',  shape: { type: 'cone', length: 12, halfAngleDeg: 32 },    windupMs: 1800, slots: 2, style: 'fire',  power: 50, reach: 11 },
    tail_sweep:  { id: 'tail_sweep',  shape: { type: 'circle', anchor: 'self', radius: 5.0 },   windupMs: 1700, slots: 2, style: 'melee', power: 46, reach: 5 },
    cinder_fall: { id: 'cinder_fall', shape: { type: 'circle', anchor: 'target', radius: 2.5 }, windupMs: 1500, slots: 1, style: 'fire',  power: 30, reach: 11 },
    ashen_nova:  { id: 'ashen_nova',  shape: { type: 'ring', inner: 4.0, outer: 14 },           windupMs: 2400, slots: 2, style: 'pure',  power: 60, reach: 13.5 }
  },
  phases: [
    { name: 'I Grounded', untilHpFrac: 0.66, pattern: ['basic', 'basic', 'ember_cone', 'basic', 'tail_sweep'], cadenceMult: 1 },
    { name: 'II Cinders', untilHpFrac: 0.33, pattern: ['basic', 'cinder_fall', 'cinder_fall', 'cinder_fall', 'tail_sweep', 'basic', 'ember_cone'], cadenceMult: 1 },
    { name: 'III Fury', untilHpFrac: 0, pattern: ['basic', 'ember_cone', 'ashen_nova', 'basic', 'tail_sweep', 'cinder_fall', 'cinder_fall'], cadenceMult: 0.8 }
  ]
};
