export const CADENCE_SECS = 1.65;
export const CAMP_WINDUP_GAP_SECS = 1.65;
export const TELEGRAPH_TIME_SCALE = 1;

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
