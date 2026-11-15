export const CADENCE_SECS = 1.65;
export const CAMP_WINDUP_GAP_SECS = 1.65;
export const TELEGRAPH_TIME_SCALE = 1;
/** Boss rules of design 6.4: seconds the target may stay beyond the arena margin, that margin, and the pause before the first pattern entry. */
export const BOSS_OUTSIDE_SECS = 5;
export const BOSS_ARENA_MARGIN = 6;
export const BOSS_FIRST_ENTRY_SECS = 1.0;
/** Reaction time of design 6.3: human, device and acceleration ms, the hero's run speed (units/s) and body radius (units). */
export const REACTION_WINDOW = {
  humanMs: 700,
  deviceMs: 160,
  accelerationMs: 90,
  heroRunSpeed: 11.5,
  heroBodyRadius: 0.3,
} as const;

export type Shape =
  | { type: 'circle'; anchor: 'target' | 'self'; radius: number }
  | { type: 'cone'; length: number; halfAngleDeg: number }
  | { type: 'line'; length: number; halfWidth: number }
  | { type: 'ring'; inner: number; outer: number };

export type AttackDef = {
  id: string;
  name: string;
  shape: Shape;
  windupMs: number;
  slots: number;
  style: 'own' | 'melee' | 'ranged' | 'magic' | 'fire' | 'pure';
  power?: number;
  reach: number;
};

export const ATTACKS: Record<string, AttackDef> = {
  tail_lash: {
    id: 'tail_lash',
    name: 'Tail Lash',
    shape: { type: 'cone', length: 4.5, halfAngleDeg: 40 },
    windupMs: 1600,
    slots: 2,
    style: 'own',
    reach: 2.9
  },
  hexfall: {
    id: 'hexfall',
    name: 'Hexfall',
    shape: { type: 'circle', anchor: 'target', radius: 2.5 },
    windupMs: 1600,
    slots: 2,
    style: 'own',
    reach: 11
  },
  pinning_volley: {
    id: 'pinning_volley',
    name: 'Pinning Volley',
    shape: { type: 'circle', anchor: 'target', radius: 2.5 },
    windupMs: 1600,
    slots: 2,
    style: 'own',
    reach: 11
  },
  overhead_slam: {
    id: 'overhead_slam',
    name: 'Overhead Slam',
    shape: { type: 'circle', anchor: 'target', radius: 3.0 },
    windupMs: 1600,
    slots: 2,
    style: 'own',
    reach: 2.9
  },
  rootquake: {
    id: 'rootquake',
    name: 'Rootquake',
    shape: { type: 'circle', anchor: 'self', radius: 4.5 },
    windupMs: 1700,
    slots: 2,
    style: 'own',
    reach: 2.9
  },
  scorch_lane: {
    id: 'scorch_lane',
    name: 'Scorch Lane',
    shape: { type: 'line', length: 12, halfWidth: 1.2 },
    windupMs: 1600,
    slots: 2,
    style: 'own',
    reach: 2.9
  },
  ember_cone: {
    id: 'ember_cone',
    name: 'Ember Cone',
    shape: { type: 'cone', length: 16, halfAngleDeg: 45 },
    windupMs: 1800,
    slots: 2,
    style: 'fire',
    power: 50,
    reach: 13.5
  },
  tail_sweep: {
    id: 'tail_sweep',
    name: 'Tail Sweep',
    shape: { type: 'circle', anchor: 'self', radius: 5 },
    windupMs: 1700,
    slots: 2,
    style: 'melee',
    power: 46,
    reach: 5
  },
  slag_rain: {
    id: 'slag_rain',
    name: 'Slag Rain',
    shape: { type: 'circle', anchor: 'target', radius: 2.5 },
    windupMs: 1500,
    slots: 1,
    style: 'pure',
    power: 30,
    reach: 13.5
  },
  ashen_nova: {
    id: 'ashen_nova',
    name: 'Ashen Nova',
    shape: { type: 'ring', inner: 8, outer: 20 },
    windupMs: 2000,
    slots: 2,
    style: 'pure',
    power: 60,
    reach: 13.5
  },
  slagburst: {
    id: 'slagburst',
    name: 'Slagburst',
    shape: { type: 'circle', anchor: 'self', radius: 8 },
    windupMs: 2000,
    slots: 2,
    style: 'melee',
    power: 52,
    reach: 8
  }
};

export type PhaseDef = {
  name: string;
  untilHpFrac: number;
  pattern: string[];
  cadenceMult: number;
  shiftMs: number;
};

export type BossDef = {
  respawnSecs: number;
  arenaRadius: number;
  title?: string;
  openingShiftMs: number;
  mark: { step: number; max: number; secs: number };
  phases: PhaseDef[];
};

export const BOSSES: Record<string, BossDef> = {
  ashmantle: {
    respawnSecs: 120,
    arenaRadius: 12,
    title: 'Ashbreaker',
    openingShiftMs: 2000,
    mark: { step: 0.25, max: 4, secs: 12 },
    phases: [
      {
        name: 'Grounded',
        untilHpFrac: 0.66,
        pattern: ['basic', 'basic', 'ember_cone', 'basic', 'tail_sweep'],
        cadenceMult: 1,
        shiftMs: 2000
      },
      {
        name: 'Rain of Slag',
        untilHpFrac: 0.33,
        pattern: ['slag_rain', 'slag_rain', 'slag_rain', 'tail_sweep', 'basic', 'ember_cone', 'basic'],
        cadenceMult: 1,
        shiftMs: 2000
      },
      {
        name: 'Fury',
        untilHpFrac: 0,
        pattern: ['ashen_nova', 'slagburst', 'basic', 'ember_cone', 'basic', 'slag_rain', 'slag_rain'],
        cadenceMult: 0.8,
        shiftMs: 2000
      }
    ]
  }
};

export const PATTERNS: Record<string, string[]> = {
  scorpion: ['basic', 'basic', 'basic', 'tail_lash'],
  dark_wizard: ['basic', 'basic', 'basic', 'hexfall'],
  dark_ranger: ['basic', 'basic', 'basic', 'pinning_volley'],
  hill_giant: ['basic', 'basic', 'basic', 'overhead_slam'],
  moss_guardian: ['basic', 'basic', 'basic', 'rootquake'],
  lesser_demon: ['basic', 'basic', 'basic', 'scorch_lane']
};
