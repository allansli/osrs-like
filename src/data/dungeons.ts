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

export const DUNGEONS: Dungeon[] = [
  {
    id: 'saltfang_warren',
    name: 'Saltfang Warren',
    origin: [1000, -200],
    size: 96,
    door: { x: 106, z: 74 },
    entry: [12, 32],
    rooms: {
      entry: [4, 24, 20, 40],
      c1: [20, 29, 26, 35],
      nest: [26, 20, 46, 44],
      c2: [46, 29, 52, 35],
      gallery: [52, 20, 72, 44],
      c3: [59, 44, 65, 50],
      lair: [48, 50, 76, 78],
      c4: [33, 44, 39, 54],
      brood: [24, 54, 46, 76]
    },
    gates: [{ id: 'lair_gate', rect: [59, 46, 65, 48], opensWhen: ['nest', 'gallery', 'brood'] }],
    camps: [
      {
        id: 'nest',
        room: 'nest',
        aggro: 9,
        members: [
          [31, 26], [36, 38], [41, 27], [33, 33], [40, 36], [38, 23], [30, 40], [43, 41]
        ].map(([x, z]) => ({ type: 'scree_skitter', x, z }))
      },
      {
        id: 'gallery',
        room: 'gallery',
        aggro: 12,
        members: [
          { type: 'saltback_stalker', x: 58, z: 27 },
          { type: 'saltback_stalker', x: 66, z: 30 },
          { type: 'saltback_stalker', x: 60, z: 38 },
          { type: 'thornwatch_marksman', x: 68, z: 40 },
          { type: 'thornwatch_marksman', x: 67, z: 24 }
        ]
      },
      {
        id: 'brood',
        room: 'brood',
        aggro: 9,
        members: [
          ...[
            [28, 58], [34, 62], [42, 58], [30, 70], [38, 72], [42, 66]
          ].map(([x, z]) => ({ type: 'scree_skitter', x, z })),
          { type: 'saltback_stalker', x: 35, z: 67 },
          { type: 'saltback_stalker', x: 29, z: 64 }
        ]
      },
      {
        id: 'lair',
        room: 'lair',
        aggro: 12,
        arenaRadius: 10,
        members: [{ type: 'saltfang', x: 62, z: 64 }]
      }
    ],
    nodes: [
      { type: 'adamantite_rock', x: 51, z: 74 },
      { type: 'adamantite_rock', x: 73, z: 74 },
      { type: 'adamantite_rock', x: 73, z: 54 }
    ],
    chest: [62, 75],
    loot: {
      run: [{ id: 'adamantite_ore', qty: [3, 5] }, { id: 'tough_hide', qty: [1, 2] }],
      runGp: [100, 300],
      rare: [{ id: 'rune_crossbow', qty: 1, chance: 0.05 }]
    },
    needs: {
      all: [
        { combat: 50 },
        {
          any: [
            { stage: ['ml_salt', 3] },
            { stage: ['ml_salt', 4] },
            { quest: ['ml_salt', 'done'] }
          ]
        }
      ]
    }
  }
];
