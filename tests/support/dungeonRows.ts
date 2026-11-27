// Plan Z1: the fixture's rows, with no import from src/state, so that the vi.mock factories of the two data modules can
// load them without a cycle (src/state/dungeon imports the data module being mocked). Helpers are in dungeonFixture.ts.
import type { Cond } from '../../src/state/dialogue';

type Rect = [number, number, number, number];

/** Rooms of local rectangles; the two corridors are rooms too (design 7.6). */
export const FX_DUNGEON = {
  id: 'fx_pit',
  name: 'Fixture Pit',
  origin: [1000, -200] as [number, number],
  size: 64,
  door: { x: 20, z: 20 },
  entry: [12, 28] as [number, number],
  rooms: {
    entry: [4, 20, 20, 36] as Rect,
    c1: [20, 26, 24, 30] as Rect,
    hall: [24, 14, 48, 42] as Rect,
    c2: [32, 42, 40, 46] as Rect,
    lair: [24, 46, 48, 62] as Rect
  },
  gates: [{ id: 'lair_gate', rect: [32, 42, 40, 46] as Rect, opensWhen: ['hall', 'den'] }],
  camps: [
    {
      id: 'hall',
      room: 'hall',
      aggro: 9,
      members: [
        { type: 'goblin', x: 30, z: 20 },
        { type: 'goblin', x: 36, z: 28 },
        { type: 'goblin', x: 42, z: 20 }
      ]
    },
    {
      id: 'den',
      room: 'hall',
      aggro: 9,
      members: [
        { type: 'goblin', x: 28, z: 36 },
        { type: 'goblin', x: 34, z: 38 }
      ]
    },
    { id: 'lair', room: 'lair', aggro: 12, arenaRadius: 8, members: [{ type: 'ashmantle', x: 36, z: 54 }] }
  ],
  nodes: [],
  chest: [36, 58] as [number, number],
  loot: {
    run: [
      { id: 'iron_ore', qty: [3, 5] as [number, number] },
      { id: 'coal', qty: [1, 2] as [number, number] }
    ],
    runGp: [100, 300] as [number, number],
    rare: [
      { id: 'steel_bar', qty: 3, chance: 0.2 },
      { id: 'black_bar', qty: 1, chance: 0.05 }
    ]
  },
  // Combat 10, and the door's quest at the stage where its giver opens the door (stage 1) or done.
  needs: {
    all: [{ combat: 10 }, { any: [{ stage: ['fx_door', 1] }, { stage: ['fx_door', 2] }, { quest: ['fx_door', 'done'] }] }]
  } as Cond
};

/** fx_pit_clear: a `do` stage on the chest's counter, then a `talk` stage. fx_door: three `talk` stages. */
export const FX_ZONE_QUESTS = [
  {
    id: 'fx_pit_clear',
    name: 'Fixture Pit Clear',
    line: 'side',
    giver: 'odalys_venn',
    region: 'lumbridge',
    needs: { gp: 0 },
    stages: [
      { kind: 'do', done: { stat: ['clear:fx_pit', 1] }, journal: 'Open the chest of the fixture pit.' },
      { kind: 'talk', at: 'odalys_venn', journal: 'Tell the keeper.' }
    ],
    reward: { gp: 250, xp: { mining: 50 }, items: [{ id: 'shrimp', qty: 2 }], title: 'Pit Cleaner' }
  },
  {
    id: 'fx_door',
    name: 'Fixture Door',
    line: 'side',
    giver: 'odalys_venn',
    region: 'lumbridge',
    needs: { gp: 0 },
    stages: [
      { kind: 'talk', at: 'odalys_venn', journal: 'Hear about the door.' },
      { kind: 'talk', at: 'odalys_venn', journal: 'She opens the door.' },
      { kind: 'talk', at: 'odalys_venn', journal: 'Tell her it is done.' }
    ],
    reward: { gp: 0, xp: {}, items: [] }
  }
];

const ROWS = { DUNGEONS: [FX_DUNGEON], STORY_QUESTS: FX_ZONE_QUESTS } as const;

export function withZoneFixture<T extends Record<string, unknown>>(key: keyof typeof ROWS, mod: T): T {
  const table = mod[key] as unknown[];
  for (const row of ROWS[key]) if (!table.some((r) => (r as { id: string }).id === row.id)) table.push(row);
  return mod;
}

