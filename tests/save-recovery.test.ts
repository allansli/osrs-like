import { describe, expect, it } from 'vitest';
import { SKILL_KEYS } from '../src/data/skills';
import { keepCorrupt, legacyPreview, recoveryExit, shouldAutosave } from '../src/state/saveRecovery';
import { LEGACY_SAVE_KEYS, migrateLegacySave, readSave, SAVE_KEY, type StorageLike } from '../src/state/save';

const C1 = 'gielinor_hero_save_v1_corrupt';
const C2 = 'gielinor_hero_save_v1_corrupt_2';
const C3 = 'gielinor_hero_save_v1_corrupt_3';
const LIMIT = 256 * 1024;

type Mem = StorageLike & { m: Map<string, string>; sets: string[] };

/** In-memory store; `fails` decides, per setItem call, whether it throws. */
function mem(init: Record<string, string> = {}, fails: (key: string, nth: number) => boolean = () => false): Mem {
  const m = new Map(Object.entries(init));
  const sets: string[] = [];
  const nth = new Map<string, number>();
  return {
    m,
    sets,
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => {
      const n = (nth.get(k) ?? 0) + 1;
      nth.set(k, n);
      sets.push(k);
      if (fails(k, n)) throw new Error('QuotaExceededError');
      m.set(k, v);
    },
    removeItem: (k) => void m.delete(k)
  };
}
const always = (...keys: string[]) => (k: string) => keys.includes(k);
const MAIN = '{"version":4,"gp":';

describe('keepCorrupt', () => {
  it('does nothing when _corrupt already equals the raw string', () => {
    const s = mem({ [C1]: 'raw', [C2]: 'old2', [SAVE_KEY]: MAIN });
    keepCorrupt(s, 'raw');
    expect(s.sets).toEqual([]);
    expect(s.getItem(C1)).toBe('raw');
    expect(s.getItem(C2)).toBe('old2');
    expect(keepCorrupt(s, 'raw').kept).toBe(true);
  });

  it('writes into an empty _corrupt without touching the others', () => {
    const s = mem({ [SAVE_KEY]: MAIN });
    expect(keepCorrupt(s, 'raw').kept).toBe(true);
    expect(s.getItem(C1)).toBe('raw');
    expect(s.getItem(C2)).toBeNull();
    expect(s.getItem(C3)).toBeNull();
    expect(s.getItem(SAVE_KEY)).toBe(MAIN);
  });

  it('shifts _corrupt_2 to _corrupt_3 and _corrupt to _corrupt_2, then writes the raw string', () => {
    const s = mem({ [C1]: 'a', [C2]: 'b', [C3]: 'c', [SAVE_KEY]: MAIN });
    expect(keepCorrupt(s, 'new').kept).toBe(true);
    expect(s.getItem(C1)).toBe('new');
    expect(s.getItem(C2)).toBe('a');
    expect(s.getItem(C3)).toBe('b');
    expect(s.getItem(SAVE_KEY)).toBe(MAIN);
  });

  it('keeps at most three copies over repeated different strings, newest first', () => {
    const s = mem();
    for (const raw of ['r1', 'r2', 'r3', 'r4']) keepCorrupt(s, raw);
    expect([C1, C2, C3].map((k) => s.getItem(k))).toEqual(['r4', 'r3', 'r2']);
  });

  it('refuses a string over 256 kB: kept false, nothing written', () => {
    const s = mem({ [C1]: 'a', [SAVE_KEY]: MAIN });
    const r = keepCorrupt(s, 'x'.repeat(LIMIT + 1));
    expect(r.kept).toBe(false);
    expect(s.sets).toEqual([]);
    expect(s.getItem(C1)).toBe('a');
    expect(s.getItem(SAVE_KEY)).toBe(MAIN);
  });

  it('accepts a string of exactly 256 kB', () => {
    const s = mem();
    expect(keepCorrupt(s, 'x'.repeat(LIMIT)).kept).toBe(true);
    expect(s.getItem(C1)).toHaveLength(LIMIT);
  });

  it('when the newest write throws once: removes the two older copies, retries, and keeps', () => {
    const s = mem({ [C1]: 'a', [C2]: 'b', [C3]: 'c', [SAVE_KEY]: MAIN }, (k, n) => k === C1 && n === 1);
    const r = keepCorrupt(s, 'new');
    expect(r.kept).toBe(true);
    expect(s.getItem(C1)).toBe('new');
    expect(s.getItem(C2)).toBeNull();
    expect(s.getItem(C3)).toBeNull();
    expect(s.getItem(SAVE_KEY)).toBe(MAIN);
  });

  it('when the newest write throws twice: kept false, does not throw, tries exactly twice, older copies removed, main key untouched', () => {
    const s = mem({ [C1]: 'a', [C2]: 'b', [C3]: 'c', [SAVE_KEY]: MAIN }, always(C1));
    let r: { kept: boolean } | undefined;
    expect(() => (r = keepCorrupt(s, 'new'))).not.toThrow();
    expect(r!.kept).toBe(false);
    expect(s.sets.filter((k) => k === C1)).toHaveLength(2);
    expect(s.getItem(C2)).toBeNull();
    expect(s.getItem(C3)).toBeNull();
    expect(s.getItem(SAVE_KEY)).toBe(MAIN);
  });

  it('a throwing older-copy write does not throw out of keepCorrupt and leaves the main key alone', () => {
    const s = mem({ [C1]: 'a', [C2]: 'b', [SAVE_KEY]: MAIN }, always(C3, C2));
    expect(() => keepCorrupt(s, 'new')).not.toThrow();
    expect(s.getItem(SAVE_KEY)).toBe(MAIN);
  });

  it('never writes the main key or a legacy key', () => {
    const s = mem({ [C1]: 'a', [SAVE_KEY]: MAIN }, always(C1));
    keepCorrupt(s, 'new');
    keepCorrupt(mem(), 'z');
    expect(s.sets.filter((k) => k === SAVE_KEY || (LEGACY_SAVE_KEYS as readonly string[]).includes(k))).toEqual([]);
  });
});

describe('recoveryExit', () => {
  it('releases the hold for a new game and for the older save only when the copy was kept', () => {
    expect(recoveryExit('new', { kept: true })).toBe(true);
    expect(recoveryExit('older', { kept: true })).toBe(true);
    expect(recoveryExit('new', { kept: false })).toBe(false);
    expect(recoveryExit('older', { kept: false })).toBe(false);
  });

  it('the copy-text exit never releases', () => {
    expect(recoveryExit('copy', { kept: true })).toBe(false);
    expect(recoveryExit('copy', { kept: false })).toBe(false);
  });
});

describe('legacyPreview', () => {
  const legacy = (gp: number, xp: Record<string, number>) => JSON.stringify({ gp, skills: Object.fromEntries(Object.entries(xp).map(([k, v]) => [k, { xp: v }])) });
  const total = (raw: string) => {
    const st = migrateLegacySave(JSON.parse(raw), null).state;
    return SKILL_KEYS.reduce((n, k) => n + st.skills[k].lvl, 0);
  };

  it('returns null with no legacy key, and with only unparseable ones', () => {
    expect(legacyPreview(mem())).toBeNull();
    expect(legacyPreview(mem({ [LEGACY_SAVE_KEYS[0]]: '{nope', [LEGACY_SAVE_KEYS[1]]: 'null{' }))).toBeNull();
  });

  it('returns key, gp and total level of the first legacy key that parses', () => {
    const v3 = legacy(1234, { attack: 100000 });
    const v2 = legacy(7, {});
    const s = mem({ [LEGACY_SAVE_KEYS[0]]: v3, [LEGACY_SAVE_KEYS[1]]: v2 });
    const p = legacyPreview(s);
    expect(p).toEqual({ key: LEGACY_SAVE_KEYS[0], gp: 1234, totalLevel: total(v3) });
    expect(total(v3)).toBeGreaterThan(total(v2));
  });

  it('skips an unparseable first key and reads the second', () => {
    const v2 = legacy(55, { mining: 5000 });
    const p = legacyPreview(mem({ [LEGACY_SAVE_KEYS[0]]: '{broken', [LEGACY_SAVE_KEYS[1]]: v2 }));
    expect(p).toEqual({ key: LEGACY_SAVE_KEYS[1], gp: 55, totalLevel: total(v2) });
  });

  it('ignores the main key and the backups', () => {
    expect(legacyPreview(mem({ [SAVE_KEY]: legacy(1, {}), [C1]: legacy(2, {}) }))).toBeNull();
  });

  it('writes and removes nothing', () => {
    const s = mem({ [LEGACY_SAVE_KEYS[0]]: legacy(9, {}), [SAVE_KEY]: MAIN });
    const before = new Map(s.m);
    legacyPreview(s);
    expect(s.sets).toEqual([]);
    expect(s.m).toEqual(before);
  });
});

describe('shouldAutosave', () => {
  it('is false while held and true otherwise', () => {
    expect(shouldAutosave(true)).toBe(false);
    expect(shouldAutosave(false)).toBe(true);
  });
});

describe('readSave beside a corrupt main save', () => {
  it('copies the corrupt main save to an empty _corrupt and reports corrupt', () => {
    const s = mem({ [SAVE_KEY]: MAIN });
    const r = readSave(s, 0)!;
    expect(r.corrupt).toBe(true);
    expect(s.getItem(C1)).toBe(MAIN);
    expect(s.getItem(SAVE_KEY)).toBe(MAIN);
  });

  it('does not overwrite an existing _corrupt', () => {
    const s = mem({ [SAVE_KEY]: MAIN, [C1]: 'earlier' });
    readSave(s, 0);
    expect(s.getItem(C1)).toBe('earlier');
  });

  it('does not read the legacy keys beside a corrupt main save', () => {
    const s = mem({ [SAVE_KEY]: MAIN, [LEGACY_SAVE_KEYS[0]]: JSON.stringify({ gp: 999 }) });
    const r = readSave(s, 0)!;
    expect(r.corrupt).toBe(true);
    expect(r.state.gp).not.toBe(999);
    expect(r.migratedFrom).toBeNull();
  });

  it('does not throw when the _corrupt copy cannot be written, and leaves the main key', () => {
    const s = mem({ [SAVE_KEY]: MAIN }, always(C1));
    let r: ReturnType<typeof readSave>;
    expect(() => (r = readSave(s, 0))).not.toThrow();
    expect(r!.corrupt).toBe(true);
    expect(s.getItem(SAVE_KEY)).toBe(MAIN);
  });
});
