import {
  MONSTER_TYPES as BASE_MONSTERS,
  RESOURCE_NODES_DEF as BASE_NODES,
  WORLD_REGIONS
} from './catalog';

export { WORLD_REGIONS };

export type RegionDef = {
  id: string;
  name: string;
  sub: string;
  x: number;
  z: number;
  radius: number;
  color: string;
  desc: string;
};

export type MonsterDef = {
  name: string;
  level: number;
  hp: number;
  maxHit: number;
  atk: number;
  def: number;
  scale: number;
  style: string;
  bodyColor: number;
  accentColor: number;
  kind: string;
  weaponColor?: number;
  drops: Array<{ id?: string; chance: number; gp?: [number, number]; qty?: number }>;
  pattern?: string;
  // Design 6.8: a new type may reuse an existing model, tinted and scaled.
  model?: string;
  tint?: number;
  modelScale?: number;
  kit?: string;
  body?: string;
};

export const MONSTER_TYPES: Record<string, MonsterDef> = {
  ...(BASE_MONSTERS as Record<string, MonsterDef>),
  chicken: {
    ...(BASE_MONSTERS.chicken as MonsterDef),
    drops: [
      ...((BASE_MONSTERS.chicken as MonsterDef).drops),
      { id: 'feather', chance: 0.8, qty: 5 }
    ]
  },
  scorpion: {
    ...(BASE_MONSTERS.scorpion as MonsterDef),
    pattern: 'scorpion',
    drops: [
      ...((BASE_MONSTERS.scorpion as MonsterDef).drops),
      { id: 'sting_gland', chance: 0.1 }
    ]
  },
  dark_wizard: {
    ...(BASE_MONSTERS.dark_wizard as MonsterDef),
    pattern: 'dark_wizard'
  },
  goblin_archer: {
    name: 'Goblin Archer',
    level: 5,
    hp: 12,
    maxHit: 3,
    atk: 8,
    def: 3,
    scale: 0.92,
    style: 'ranged',
    bodyColor: 0x65a30d,
    accentColor: 0x451a03,
    kind: 'archer',
    weaponColor: 0x92400e,
    drops: [
      { id: 'bones', chance: 1 },
      { gp: [8, 24], chance: 0.8 },
      { id: 'bronze_arrow', chance: 0.7 },
      { id: 'shortbow', chance: 0.004 }
    ]
  },
  dark_ranger: {
    name: 'Dark Ranger',
    level: 24,
    hp: 36,
    maxHit: 9,
    atk: 28,
    def: 14,
    scale: 1.05,
    style: 'ranged',
    bodyColor: 0x27272a,
    accentColor: 0x166534,
    kind: 'archer',
    weaponColor: 0x14532d,
    drops: [
      { id: 'bones', chance: 1 },
      { gp: [40, 120], chance: 0.95 },
      { id: 'bronze_arrow', chance: 1 },
      { id: 'willow_bow', chance: 0.008 },
      { id: 'green_dhide_body', chance: 0.004 }
    ],
    pattern: 'dark_ranger'
  },
  hill_giant: {
    ...(BASE_MONSTERS.hill_giant as MonsterDef),
    pattern: 'hill_giant'
  },
  moss_guardian: {
    ...(BASE_MONSTERS.moss_guardian as MonsterDef),
    pattern: 'moss_guardian',
    drops: [
      ...((BASE_MONSTERS.moss_guardian as MonsterDef).drops),
      { id: 'mire_root', chance: 0.15 }
    ]
  },
  lesser_demon: {
    ...(BASE_MONSTERS.lesser_demon as MonsterDef),
    pattern: 'lesser_demon'
  },
  // Design 6.8: the two shipped slots between the hill giant and the moss guardian.
  saltback_stalker: {
    name: 'Saltback Stalker',
    level: 34,
    hp: 58,
    maxHit: 12,
    atk: 32,
    def: 28,
    scale: 1.05,
    style: 'melee',
    bodyColor: 0x57534e,
    accentColor: 0x1c1917,
    kind: 'scorpion',
    drops: [
      { id: 'big_bones', chance: 1 },
      { gp: [140, 340], chance: 0.95 },
      { id: 'lobster', chance: 0.4 },
      { id: 'sting_gland', chance: 0.15 }
    ],
    pattern: 'scorpion',
    model: 'scorpion',
    kit: 'saltback_stalker',
    tint: 0x6b6470,
    modelScale: 1.4
  },
  thornwatch_marksman: {
    name: 'Thornwatch Marksman',
    level: 38,
    hp: 54,
    maxHit: 13,
    atk: 36,
    def: 26,
    scale: 1.05,
    style: 'ranged',
    bodyColor: 0x1f3a24,
    accentColor: 0x4d7c0f,
    kind: 'archer',
    weaponColor: 0x3f6212,
    drops: [
      { id: 'big_bones', chance: 1 },
      { gp: [160, 400], chance: 0.95 },
      { id: 'bronze_arrow', chance: 1 },
      { id: 'swordfish', chance: 0.3 }
    ],
    pattern: 'dark_ranger',
    model: 'dark_ranger',
    kit: 'thornwatch_marksman',
    tint: 0x7fb069,
    modelScale: 1.1
  },
  // Design 6.4: the new boss, built from the existing dragon's model. Its phases arrive with BOSSES (B2).
  ashmantle: {
    name: 'Ashmantle the Slag Wyrm',
    level: 110,
    hp: 1400,
    maxHit: 72,
    atk: 120,
    def: 78,
    scale: 2.35,
    style: 'magic',
    bodyColor: 0x57534e,
    accentColor: 0xf97316,
    kind: 'dragon',
    drops: [
      { gp: [1500, 3000], chance: 1 },
      { id: 'dragon_bones', chance: 1 },
      { id: 'shark', chance: 1 }
    ],
    model: 'elvarg_dragon',
    body: 'ashmantle',
    tint: 0x8a8580,
    modelScale: 1.2
  }
};

export const RESOURCE_NODES_DEF = {
  ...(BASE_NODES as Record<string, Record<string, unknown>>),
  maple_tree: {
    name: 'Maple Tree',
    skill: 'woodcutting',
    req: 30,
    xp: 120,
    item: 'maple_logs',
    respawn: 7500,
    kind: 'tree',
    foliageColor: 0x8d9a4e,
    trunkColor: 0x5d4037,
    scale: 1.5
  },
  coal_rock: {
    name: 'Coal Seam',
    skill: 'mining',
    req: 10,
    xp: 50,
    item: 'coal',
    respawn: 5500,
    kind: 'rock',
    oreColor: 0x1f2937
  }
};
