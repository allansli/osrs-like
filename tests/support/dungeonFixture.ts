// Test-only zone fixture (plan Z1; Z3 and C1 may reuse it): a three-room dungeon with one gate and a one-member boss
// camp, and two small quests. No content of the game.
//
// The live `DUNGEONS` table is empty until Z4, and `progress.ts` reads it at module load (to build the `clear:<id>`
// stat keys), so a test file registers the rows by mocking the two data modules before anything imports them:
//
//   vi.mock('../src/data/dungeons', async (orig) => (await import('./support/dungeonRows')).withZoneFixture('DUNGEONS', await orig()));
//   vi.mock('../src/data/story', async (orig) => (await import('./support/dungeonRows')).withZoneFixture('STORY_QUESTS', await orig()));
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
import { openChest, runStep } from '../../src/state/dungeon';
import type { GameState } from '../../src/state/types';
import { FX_DUNGEON } from './dungeonRows';

export { FX_DUNGEON, FX_ZONE_QUESTS } from './dungeonRows';

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
  return runStep(run, { campDead: campId }) as unknown as string[];
}

/** The hero opens the chest with the injected random source and the run's clock. */
export function open(state: GameState, run: Run, rand: () => number, now = 60_000): { ok: boolean; reason?: string } {
  return openChest(state, FX_DUNGEON, run, rand, now) as unknown as { ok: boolean; reason?: string };
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
