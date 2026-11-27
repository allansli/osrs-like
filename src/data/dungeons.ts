import type { Cond } from '../state/dialogue';

export type DungeonCampMember = {
  type: string;
  x: number;
  z: number;
  wander?: number;
};

export type DungeonCamp = {
  id: string;
  room: string;
  aggro: number;
  arenaRadius?: number;
  members: DungeonCampMember[];
};

export type DungeonGate = {
  id: string;
  rect: [number, number, number, number];
  opensWhen: string[];
};

export type DungeonLootRun = {
  id: string;
  qty: [number, number];
};

export type DungeonLootRare = {
  id: string;
  qty: number;
  chance: number;
};

export type DungeonLoot = {
  run: DungeonLootRun[];
  runGp: [number, number];
  rare: DungeonLootRare[];
};

export type Dungeon = {
  id: string;
  name: string;
  origin: [number, number];
  size: number;
  door: { x: number; z: number };
  entry: [number, number];
  rooms: Record<string, [number, number, number, number]>;
  gates: DungeonGate[];
  camps: DungeonCamp[];
  nodes: { type: string; x: number; z: number }[];
  chest: [number, number];
  loot: DungeonLoot;
  needs: Cond;
  solid?: [number, number, number, number][];
};

export const DUNGEONS: Dungeon[] = [];
