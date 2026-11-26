import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/data/attacks';
import { createDefaultState } from '../src/state/gameState';
import { bossBackIn, clearBossDown, noteBossDown } from '../src/state/progress';
import { readSave, writeSave, type StorageLike } from '../src/state/save';

const NOW = 1_800_000_000_000;
const RESPAWN_MS = BOSSES.ashmantle.respawnSecs * 1000;

function memStorage(): StorageLike {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

describe('boss respawn timer', () => {
  it('a kill of a boss with an overworld camp records now plus one respawn', () => {
    const s = createDefaultState();
    noteBossDown(s, 'ashmantle', NOW);
    expect(s.progress?.bossDownUntil?.ashmantle).toBe(NOW + RESPAWN_MS);
  });

  it('a type without a BOSSES row records nothing', () => {
    const s = createDefaultState();
    noteBossDown(s, 'goblin', NOW);
    noteBossDown(s, 'dragon', NOW);
    expect(s.progress?.bossDownUntil?.goblin).toBeUndefined();
    expect(s.progress?.bossDownUntil?.dragon).toBeUndefined();
    expect(bossBackIn(s, 'goblin', NOW)).toBe(0);
  });

  it('bossBackIn returns the seconds left, and 0 when past or absent', () => {
    const s = createDefaultState();
    expect(bossBackIn(s, 'ashmantle', NOW)).toBe(0);
    noteBossDown(s, 'ashmantle', NOW);
    expect(bossBackIn(s, 'ashmantle', NOW)).toBeCloseTo(BOSSES.ashmantle.respawnSecs, 6);
    expect(bossBackIn(s, 'ashmantle', NOW + 30_000)).toBeCloseTo(BOSSES.ashmantle.respawnSecs - 30, 6);
    expect(bossBackIn(s, 'ashmantle', NOW + RESPAWN_MS)).toBe(0);
    expect(bossBackIn(s, 'ashmantle', NOW + RESPAWN_MS + 1)).toBe(0);
  });

  it('clearBossDown removes the timer', () => {
    const s = createDefaultState();
    noteBossDown(s, 'ashmantle', NOW);
    clearBossDown(s, 'ashmantle');
    expect(bossBackIn(s, 'ashmantle', NOW)).toBe(0);
    expect(s.progress?.bossDownUntil?.ashmantle).toBeUndefined();
  });

  it('after a save round trip with now moved forward 30 s, 30 s less remains', () => {
    const s = createDefaultState();
    noteBossDown(s, 'ashmantle', NOW);
    const storage = memStorage();
    writeSave(storage, s, null, null);
    const loaded = readSave(storage, NOW + 30_000)!.state;
    expect(bossBackIn(loaded, 'ashmantle', NOW + 30_000)).toBeCloseTo(BOSSES.ashmantle.respawnSecs - 30, 6);
  });

  it('a saved value an hour ahead is clamped to one respawn', () => {
    const s = createDefaultState();
    s.progress = { bossDownUntil: { ashmantle: NOW + 3_600_000 } };
    const storage = memStorage();
    writeSave(storage, s, null, null);
    const loaded = readSave(storage, NOW)!.state;
    expect(loaded.progress?.bossDownUntil?.ashmantle).toBe(NOW + RESPAWN_MS);
    expect(bossBackIn(loaded, 'ashmantle', NOW)).toBeCloseTo(BOSSES.ashmantle.respawnSecs, 6);
  });
});
