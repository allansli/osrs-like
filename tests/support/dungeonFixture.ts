// Test-only zone fixture (plan Z1; Z3 and C1 may reuse it): a three-room dungeon with one gate and a one-member boss
// camp, and two small quests. No content of the game.
//
// The live `DUNGEONS` table is empty until Z4, and `progress.ts` reads it at module load (to build the `clear:<id>`
// stat keys), so a test file registers the rows by mocking the two data modules before anything imports them:
//
//   vi.mock('../src/data/dungeons', async (orig) => (await import('./support/dungeonFixture')).withZoneFixture('DUNGEONS', await orig()));
//   vi.mock('../src/data/story', async (orig) => (await import('./support/dungeonFixture')).withZoneFixture('STORY_QUESTS', await orig()));
//
// Names assumed from design 7.6 and plan Z2 (the plan fixes the function names, not every signature). Each assumption
// that is not in the plan is in one of the helpers below, so Z2 can differ on it by editing the helper only:
//   - `DUNGEONS` is an array of rows shaped as the design's `Dungeon` (as the content file's `DUNGEONS`).
//   - Every function of `src/state/dungeon.ts` takes WORLD coordinates (the zone's origin plus the row's local numbers),
//     as `buildWalkGrid(walk, 1000, -200, 96)` does; `zoneWalk(def, openGateIds)` takes the ids of the open gates.
//   - `runStep(run, { campDead: <the row's camp id> })` updates the run in place and returns the ids of the gates that
//     opened with that death; the boss's camp is the one whose member is a `BOSSES` row.
//   - `openChest(state, def, run, rand, now)` returns `{ ok, reason? }`; `now` (ms) is the run's clock, so that `best`
//     is whole seconds from `run.startedAt`. A full backpack is `ok: false` and the run keeps its `roll`.
import { BOSSES } from '../../src/data/attacks';
import type { Cond } from '../../src/state/dialogue';
import type { openChest, runStep } from '../../src/state/dungeon';
import type { GameState } from '../../src/state/types';

// The rows sit above the helpers and this file imports nothing from src/state at run time: the vi.mock factories load it
// while src/state/dungeon is still importing the data module they mock, so a static import of the rules would be a cycle.
// The test file hands the two rule functions over with `useRules` once it has imported them.
type Rules = { openChest: typeof openChest; runStep: typeof runStep };
let rules: Rules;
export function useRules(r: Rules): void {
  rules = r;
}

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


/** A run as the engine makes one on entry (design 7.6, plan Z2's `DungeonRun`). */
export function freshRun(startedAt = 0) {
  return { id: FX_DUNGEON.id, startedAt, deadCamps: [] as string[], bossDead: false, chestOpen: false } as {
    id: string;
    startedAt: number;
    deadCamps: string[];
    bossDead: boolean;
    chestOpen: boolean;
    roll?: { id: string; qty: number }[];
  };
}

type Run = ReturnType<typeof freshRun>;

/** The row's camp whose member is a boss. */
export const bossCampId = FX_DUNGEON.camps.find((c) => c.members.some((m) => BOSSES[m.type]))!.id;

/** A camp's last member dies: the ids of the gates that opened. */
export function killCamp(run: Run, campId: string): string[] {
  return rules.runStep(run, { campDead: campId });
}

/** The hero opens the chest with the injected random source and the run's clock. */
export function open(state: GameState, run: Run, rand: () => number, now = 60_000): { ok: boolean; reason?: string } {
  return rules.openChest(state, FX_DUNGEON, run, rand, now);
}

/** A run that has its camps and its boss dead, ready for the chest. */
export function clearedRun(startedAt = 0): Run {
  const run = freshRun(startedAt);
  for (const c of FX_DUNGEON.camps) killCamp(run, c.id);
  return run;
}

/** A seeded random source in [0, 1) (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
