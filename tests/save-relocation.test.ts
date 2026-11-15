import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BASINS, RIDGES } from '../src/data/worldMap';
import { isWalkable } from '../src/state/collision';
import { createDefaultState } from '../src/state/gameState';
import { migrateLegacySave, SAVE_KEY, serializeState } from '../src/state/save';

// Design 6.11, G2.7, and section 7: no save field changes; a position that is now in a ridge or basin moves to walkable ground.
const readFixture = (path: string) => JSON.parse(readFileSync(new URL(`./fixtures/${path}`, import.meta.url), 'utf8'));

/** The captured Stage 1 version-4 save with its position replaced. */
function loadAt(x: number, z: number) {
  const raw = readFixture('save-v4.json');
  raw.playerPos = { ...raw.playerPos, x, z };
  return migrateLegacySave(raw, SAVE_KEY);
}

// Review 10: a fallback to the start town (0, 4) is walkable too, so a relocation must also stay near the saved point.
function expectLoadsWalkable(x: number, z: number, label: string, maxMove: number): void {
  const pose = loadAt(x, z).pose;
  expect(pose, label).not.toBeNull();
  expect(isWalkable(pose!.x, pose!.z), `${label}: loaded to (${pose!.x}, ${pose!.z})`).toBe(true);
  expect(Math.hypot(pose!.x - x, pose!.z - z), `${label}: loaded to (${pose!.x}, ${pose!.z})`).toBeLessThanOrEqual(maxMove);
}

// Monster spawn points at 1284a6e outside the start town: rangers, giants, scorpions, moss guardians,
// lesser demons and the dragon. Several of these camps move in Stage 2; a save made standing there must still load.
const OLD_SPAWNS: [string, number, number][] = [
  ['dark_ranger', 74, -10], ['dark_ranger', 80, -4],
  ['hill_giant', 88, -36], ['hill_giant', 96, -28], ['hill_giant', 82, -42], ['hill_giant', 95, -40],
  ['scorpion', 52, 54], ['scorpion', 60, 76], ['scorpion', 76, 58], ['scorpion', 82, 72], ['scorpion', 68, 84],
  ['moss_guardian', -64, -18], ['moss_guardian', -82, -22], ['moss_guardian', -70, -44], ['moss_guardian', -86, -38],
  ['lesser_demon', -56, 56], ['lesser_demon', -64, 78], ['lesser_demon', -82, 58], ['lesser_demon', -58, 84],
  ['elvarg_dragon', -82, 82]
];

// serializeState keys at the end of Stage 1.
const SAVE_KEYS = [
  'version', 'game', 'savedAt', 'gp', 'xpMultiplier', 'combatStyle', 'activeSpell', 'specArmed', 'specEnergy',
  'hp', 'maxHp', 'prayerPts', 'maxPrayerPts', 'activePrayers', 'currentRegion', 'timeOfDay', 'audioEnabled',
  'transferQty', 'skills', 'equipment', 'inventory', 'bank', 'shrines', 'quests', 'playerPos', 'cam'
];

describe('save relocation', () => {
  it('the Stage 1 version-4 fixture loads unchanged', () => {
    const m = migrateLegacySave(readFixture('save-v4.json'), SAVE_KEY);
    const saved = JSON.parse(serializeState(m.state, m.pose, m.cam));
    delete saved.savedAt;
    expect({ saved, migratedFrom: m.migratedFrom, corrupt: m.corrupt }).toEqual(readFixture('save-relocation/v4-loaded.json'));
  });

  it('a position in the ridge core loads to a walkable point', () => {
    expect(RIDGES).toHaveLength(1);
    const ridge = RIDGES[0];
    // A crest point well inside the map and away from the gap is in the core.
    const crest = ridge.points.slice(1).map((b, i): [number, number] => {
      const a = ridge.points[i];
      return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    }).find(([x, z]) => Math.abs(x) < 110 && Math.abs(z) < 110
      && ridge.gaps.every((g) => Math.hypot(x - g.at[0], z - g.at[1]) > g.halfWidth + 2));
    expect(crest, 'a crest point inside the map').toBeDefined();
    const [x, z] = crest!;
    expect(isWalkable(x, z), `ridge crest (${x}, ${z}) is blocked`).toBe(false);
    expectLoadsWalkable(x, z, `${ridge.name} (${x}, ${z})`, ridge.coreHalfWidth + 1);
  });

  it('a position in each basin loads to a walkable point', () => {
    expect(BASINS).toHaveLength(2);
    for (const b of BASINS) {
      expect(isWalkable(b.x, b.z), `${b.name} centre is water`).toBe(false);
      expectLoadsWalkable(b.x, b.z, b.name, b.radius);
    }
  });

  it('the 20 listed old spawn points load to walkable points', () => {
    expect(OLD_SPAWNS).toHaveLength(20);
    for (const [type, x, z] of OLD_SPAWNS) expectLoadsWalkable(x, z, `${type} (${x}, ${z})`, 12);
  });

  it('serializeState writes the same keys as before Stage 2', () => {
    const json = JSON.parse(serializeState(createDefaultState(), { x: 8, y: 0, z: 10, yaw: 0 }, null));
    expect(Object.keys(json).sort()).toEqual([...SAVE_KEYS].sort());
  });
});
