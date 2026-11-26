import { describe, expect, it } from 'vitest';
import { RESOURCE_NODES_DEF, MONSTER_TYPES } from '../src/data/world';
import { FORGE_RECIPES } from '../src/data/recipes';
import { addItem } from '../src/state/inventory';
import { createDefaultState } from '../src/state/gameState';
import { noteGather, registerKill } from '../src/state/adventure';
import { noteBury } from '../src/state/quests';
import { tryCraft } from '../src/data/recipes';
import { bump, STAT_KEYS, stat } from '../src/state/progress';

const MAX = 2147483647;

describe('STAT_KEYS', () => {
  it('holds kill, gather and craft keys from the tables, bury, vows, deaths, and nothing else', () => {
    const want = [
      ...Object.keys(MONSTER_TYPES).map((k) => `kill:${k}`),
      ...Array.from(new Set(Object.values(RESOURCE_NODES_DEF).map((n) => (n as { item: string }).item))).map((i) => `gather:${i}`),
      ...FORGE_RECIPES.map((r) => `craft:${r.id}`),
      'bury',
      'vows',
      'deaths'
    ];
    // the talk: and clear: families are added by Q2 and Z2 and pinned by their tests
    const got = STAT_KEYS.filter((k: string) => !k.startsWith('talk:') && !k.startsWith('clear:'));
    expect([...got].sort()).toEqual([...new Set(want)].sort());
    expect(new Set(STAT_KEYS).size).toBe(STAT_KEYS.length);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(STAT_KEYS)).toBe(true);
  });
});

describe('bump and stat', () => {
  it('adds one to a listed key and creates progress when absent', () => {
    const s = createDefaultState();
    expect(s.progress).toBeUndefined();
    expect(stat(s, 'bury')).toBe(0);
    bump(s, 'bury');
    expect(s.progress?.stats?.bury).toBe(1);
    bump(s, 'bury');
    expect(stat(s, 'bury')).toBe(2);
    bump(s, 'deaths', 3);
    expect(stat(s, 'deaths')).toBe(3);
  });

  it('throws on an unlisted key and leaves the state alone', () => {
    const s = createDefaultState();
    for (const key of ['kill:no_such_monster', 'gather:nothing', '__proto__', 'constructor', 'toString', '']) {
      expect(() => bump(s, key)).toThrow();
    }
    expect(s.progress?.stats ?? {}).toEqual({});
  });

  it('saturates at 2,147,483,647', () => {
    const s = createDefaultState();
    bump(s, 'vows', MAX - 1);
    bump(s, 'vows', 5);
    expect(stat(s, 'vows')).toBe(MAX);
    bump(s, 'vows');
    expect(stat(s, 'vows')).toBe(MAX);
  });
});

describe('the call sites bump once and leave their flags alone', () => {
  it('registerKill', () => {
    const s = createDefaultState();
    const quests0 = structuredClone(s.quests);
    registerKill(s, 'goblin');
    expect(stat(s, 'kill:goblin')).toBe(1);
    expect(s.quests).toEqual({ ...quests0, killedGoblin: true });
    registerKill(s, 'goblin');
    expect(stat(s, 'kill:goblin')).toBe(2);
  });

  it('noteGather', () => {
    const s = createDefaultState();
    const quests0 = structuredClone(s.quests);
    noteGather(s, 'iron_ore');
    expect(stat(s, 'gather:iron_ore')).toBe(1);
    expect(s.quests).toEqual({ ...quests0, minedMetal: true });
    noteGather(s, 'iron_ore');
    expect(stat(s, 'gather:iron_ore')).toBe(2);
  });

  it('noteBury', () => {
    const s = createDefaultState();
    const quests0 = structuredClone(s.quests);
    noteBury(s);
    expect(stat(s, 'bury')).toBe(1);
    expect(s.quests).toEqual({ ...quests0, buriedBones: true });
  });

  it('tryCraft bumps only after a success', () => {
    const s = createDefaultState();
    const quests0 = structuredClone(s.quests);
    s.inventory = [];
    expect(tryCraft(s, 'burn_logs').ok).toBe(false);
    expect(stat(s, 'craft:burn_logs')).toBe(0);
    addItem(s, 'logs', 2);
    expect(tryCraft(s, 'burn_logs').ok).toBe(true);
    expect(stat(s, 'craft:burn_logs')).toBe(1);
    expect(s.quests).toEqual({ ...quests0, burnedLog: true });
    expect(tryCraft(s, 'burn_logs').ok).toBe(true);
    expect(stat(s, 'craft:burn_logs')).toBe(2);
  });
});
