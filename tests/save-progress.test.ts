import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/data/attacks';
import { cloneState, createDefaultState } from '../src/state/gameState';
import { isEmptyProgress, STAT_KEYS } from '../src/state/progress';
import { migrateLegacySave, readSave, SAVE_KEY, serializeState, writeSave, type StorageLike } from '../src/state/save';

const MAX = 2147483647;
const NOW = 1_800_000_000_000;
const fixture = (name: string): string => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const json = (name: string): any => JSON.parse(fixture(name));

function memStorage(): StorageLike {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

const load = (progress: unknown) => migrateLegacySave({ progress }, SAVE_KEY, NOW).state.progress as any;
const own = (o: object, k: string): boolean => Object.hasOwn(o, k);

describe('progress in the save', () => {
  it('the default state serialises with no progress key', () => {
    expect('progress' in JSON.parse(serializeState(createDefaultState(), null, null))).toBe(false);
  });

  it('a state with every field of progress-full.json survives writeSave then readSave', () => {
    const full = json('s6/progress-full.json');
    const s = createDefaultState();
    s.progress = structuredClone(full);
    const storage = memStorage();
    writeSave(storage, s, null, null);
    expect(JSON.parse(storage.getItem(SAVE_KEY)!).progress).toEqual(full);
    expect(readSave(storage, NOW)!.state.progress).toEqual(full);
  });

  it('cloneState copies progress deeply', () => {
    const s = createDefaultState();
    s.progress = structuredClone(json('s6/progress-full.json'));
    const c = cloneState(s);
    expect(c.progress).toEqual(s.progress);
    c.progress!.stats!.bury = 99;
    expect(s.progress!.stats!.bury).toBe(2);
  });

  it('a boss time one hour ahead is clamped to one respawn', () => {
    const p = load({ bossDownUntil: { ashmantle: NOW + 3_600_000 } });
    expect(p.bossDownUntil.ashmantle).toBe(NOW + BOSSES.ashmantle.respawnSecs * 1000);
  });

  it('a boss time in the past is dropped', () => {
    const p = load({ bossDownUntil: { ashmantle: NOW - 1 } });
    expect(p?.bossDownUntil?.ashmantle).toBeUndefined();
  });

  it.each([['a string', 'x'], ['an array', [1, 2]], ['null', null], ['a number', 7]])('a progress block that is %s loads empty', (_n, raw) => {
    const p = load(raw);
    expect(p === undefined || isEmptyProgress(p)).toBe(true);
  });
});

describe('a hostile progress block', () => {
  const raw = json('s6/progress-hostile.json');
  const p = load(raw);

  it('has the shapes the fixture promises', () => {
    expect(raw.diary).toHaveLength(100000);
    expect(own(raw.story, '__proto__') && own(raw.stats, 'constructor')).toBe(true);
  });

  it('keeps only own, known keys in every map', () => {
    for (const k of Object.keys(p.story ?? {})) expect(own(p.story, k)).toBe(true);
    for (const k of Object.keys(p.story ?? {})) expect(k).not.toMatch(/^(__proto__|constructor|hasOwnProperty|no_such_quest)$/);
    for (const k of Object.keys(p.stats ?? {})) expect(STAT_KEYS).toContain(k);
    for (const k of Object.keys(p.dungeons ?? {})) expect(k).not.toMatch(/^(__proto__|constructor|no_such_dungeon)$/);
    for (const k of Object.keys(p.bossDownUntil ?? {})) expect(Object.keys(BOSSES)).toContain(k);
    expect(p.stats?.['kill:no_such_monster']).toBeUndefined();
    expect(({} as any).clears).toBeUndefined();
    expect(Object.getPrototypeOf(p.stats ?? {})).toBe(Object.prototype);
  });

  it('every number is a finite integer in range', () => {
    const nums: number[] = [
      ...Object.values<number>(p.story ?? {}),
      ...Object.values<number>(p.stats ?? {}),
      ...Object.values<any>(p.dungeons ?? {}).flatMap((d) => [d.clears, d.best]),
      ...Object.values<number>(p.bossDownUntil ?? {})
    ];
    for (const n of nums) {
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
    }
    for (const n of [...Object.values<number>(p.story ?? {}), ...Object.values<number>(p.stats ?? {})]) expect(n).toBeLessThanOrEqual(MAX);
  });

  it('floors, clamps and drops stats by the table', () => {
    expect(p.stats.bury).toBe(3);
    expect(p.stats.vows).toBe(MAX);
    expect(p.stats.deaths).toBe(2);
    expect(p.stats['kill:goblin']).toBeUndefined();
    expect(p.stats['gather:iron_ore']).toBeUndefined();
  });

  it('ignores a diary of 100,000 entries, and a diary that is an object', () => {
    expect(p.diary ?? []).toEqual([]);
    expect(load({ ...raw, diary: { a: 1 } }).diary ?? []).toEqual([]);
  });

  it('drops a dungeon whose clears is a string', () => {
    const q = load({ dungeons: { no_such_dungeon: { clears: 'many', best: 1 } } });
    expect(q?.dungeons ?? {}).toEqual({});
  });

  it('keeps a boss time of the year 3000 no later than now plus one respawn, and drops other types', () => {
    const t = p.bossDownUntil?.ashmantle;
    if (t !== undefined) expect(t).toBeLessThanOrEqual(NOW + BOSSES.ashmantle.respawnSecs * 1000);
    expect(p.bossDownUntil?.goblin).toBeUndefined();
  });

  it('loads through readSave with the clock passed in', () => {
    const storage = memStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 4, progress: raw }));
    expect(readSave(storage, NOW)!.state.progress).toEqual(p);
  });
});

describe('older saves', () => {
  it("Stage 1's save-v4.json and Stage 3's geared fixture load with an absent or empty progress", () => {
    for (const f of ['save-v4.json', 's3/save-v4-geared.json']) {
      const s = migrateLegacySave(json(f), SAVE_KEY, NOW).state;
      expect(s.progress === undefined || isEmptyProgress(s.progress)).toBe(true);
    }
  });

  it('a save with the new keys deleted (the old reader) loads to the same state as before the stage', () => {
    const base = json('save-v4.json');
    const before = migrateLegacySave(structuredClone(base), SAVE_KEY, NOW);
    const s = migrateLegacySave(structuredClone(base), SAVE_KEY, NOW).state;
    s.progress = structuredClone(json('s6/progress-full.json'));
    const written = JSON.parse(serializeState(s, before.pose, before.cam));
    expect(written.progress).toBeDefined();
    delete written.progress;
    const again = migrateLegacySave(written, SAVE_KEY, NOW);
    const strip = (m: typeof again) => {
      const o = JSON.parse(serializeState(m.state, m.pose, m.cam));
      delete o.savedAt;
      return o;
    };
    expect(strip(again)).toEqual(strip(before));
  });
});
