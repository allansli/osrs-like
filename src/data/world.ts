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
  drops: Array<{ id?: string; chance: number; gp?: [number, number] }>;
};

export const MONSTER_TYPES: Record<string, MonsterDef> = {
  ...(BASE_MONSTERS as Record<string, MonsterDef>),
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
      { id: 'shortbow', chance: 0.08 }
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
      { id: 'willow_bow', chance: 0.16 },
      { id: 'green_dhide_body', chance: 0.08 }
    ]
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
  }
};
