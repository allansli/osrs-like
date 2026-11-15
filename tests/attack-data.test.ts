import { describe, expect, it } from 'vitest';
import * as attacks from '../src/data/attacks';
import { ATTACKS, CADENCE_SECS, PATTERNS } from '../src/data/attacks';
import { MONSTER_TYPES } from '../src/data/world';
import { ITEMS } from '../src/data/items';
import { rollMonsterHit } from '../src/state/combat';
import { createDefaultState } from '../src/state/gameState';
import { minWindupMs } from '../src/state/telegraph';
import type { GameState } from '../src/state/types';

// Attack rows, patterns and the conservation rule (design 6.2, 6.3, 9.1 G4.2 and G4.3; plan T1).
// Red until T2 adds src/data/attacks.ts and src/state/telegraph.ts, and `pattern` on MonsterDef.

type Phase = { pattern: string; cadenceMult: number };
type Boss = { phases: Phase[] };
// BOSSES arrives in B2: read it by name so this file type-checks and passes before and after. B2 may store a phase's
// pattern as a PATTERNS key or as a list of attack ids; both are accepted.
const BOSSES = ((attacks as Record<string, unknown>).BOSSES ?? {}) as Record<string, Boss>;
const phaseIds = (p: { pattern: unknown }): string[] =>
  Array.isArray(p.pattern) ? (p.pattern as string[]) : (PATTERNS[p.pattern as string] ?? []);

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('attack rows', () => {
  const rows = Object.entries(ATTACKS);

  it('the six ordinary rows exist, keyed by their own id, with the names of design 6.9', () => {
    const names = rows.map(([, a]) => a.name);
    for (const n of ['Tail Lash', 'Hexfall', 'Pinning Volley', 'Overhead Slam', 'Rootquake', 'Scorch Lane']) expect(names).toContain(n);
    for (const [key, a] of rows) expect(a.id).toBe(key);
  });

  it('every wind-up is at least minWindupMs + 200 and never under 1,100 ms', () => {
    for (const [, a] of rows) {
      expect(a.windupMs, a.id).toBeGreaterThanOrEqual(minWindupMs(a) + 200);
      expect(a.windupMs, a.id).toBeGreaterThanOrEqual(1100);
    }
  });

  it('the wind-ups of design 6.3', () => {
    const want: Record<string, number> = {
      'Tail Lash': 1600, Hexfall: 1600, 'Pinning Volley': 1600, 'Overhead Slam': 1600, Rootquake: 1700, 'Scorch Lane': 1600
    };
    for (const [name, ms] of Object.entries(want)) expect(rows.find(([, a]) => a.name === name)?.[1].windupMs, name).toBe(ms);
  });

  it('Scorch Lane is 2.4 wide', () => {
    const lane = rows.find(([, a]) => a.name === 'Scorch Lane')?.[1];
    expect(lane?.shape).toMatchObject({ type: 'line', length: 12, halfWidth: 1.2 });
  });

  it('a slot leaves a recovery of at least 150 ms at the cadence', () => {
    for (const [, a] of rows) {
      const slotMs = Math.max(a.slots * CADENCE_SECS * 1000, a.windupMs + 150);
      expect(slotMs - a.windupMs, a.id).toBeGreaterThanOrEqual(150);
    }
  });

  it('a slot leaves a recovery of at least 150 ms in every phase of every boss, at that phase cadence', () => {
    for (const [key, boss] of Object.entries(BOSSES)) {
      expect(boss.phases.length, key).toBeGreaterThan(0);
      for (const phase of boss.phases) {
        for (const id of phaseIds(phase)) {
          if (id === 'basic') continue;
          const a = ATTACKS[id];
          expect(a, `${key}: ${id}`).toBeDefined();
          const slotMs = Math.max(a.slots * CADENCE_SECS * phase.cadenceMult * 1000, a.windupMs + 150);
          expect(slotMs - a.windupMs, `${key} ${id}`).toBeGreaterThanOrEqual(150);
        }
      }
    }
  });
});

describe('patterns', () => {
  it('every entry of PATTERNS starts with basic and names existing attacks', () => {
    expect(Object.keys(PATTERNS).length).toBeGreaterThanOrEqual(6);
    for (const [key, list] of Object.entries(PATTERNS)) {
      expect(list[0], key).toBe('basic');
      for (const id of list) expect(id === 'basic' || Object.hasOwn(ATTACKS, id), `${key}: ${id}`).toBe(true);
    }
  });

  it('an ordinary pattern is three basics and one heavy', () => {
    for (const [key, list] of Object.entries(PATTERNS)) {
      if (!['scorpion', 'dark_wizard', 'dark_ranger', 'hill_giant', 'moss_guardian', 'lesser_demon'].includes(key)) continue;
      expect(list.slice(0, 3), key).toEqual(['basic', 'basic', 'basic']);
      expect(list.length, key).toBe(4);
    }
  });

  it("every boss's first phase starts with basic (later phases may open with a heavy)", () => {
    for (const [key, boss] of Object.entries(BOSSES)) expect(phaseIds(boss.phases[0])[0], key).toBe('basic');
  });

  it('every monster pattern exists; the six heavy monsters have one; the start region and the existing dragon have none', () => {
    for (const [key, def] of Object.entries(MONSTER_TYPES)) {
      const pattern = (def as { pattern?: string }).pattern;
      if (pattern !== undefined) expect(Object.hasOwn(PATTERNS, pattern), `${key}: ${pattern}`).toBe(true);
    }
    for (const key of ['scorpion', 'dark_wizard', 'dark_ranger', 'hill_giant', 'moss_guardian', 'lesser_demon']) {
      expect(Object.hasOwn(MONSTER_TYPES, key), key).toBe(true);
      expect((MONSTER_TYPES[key] as { pattern?: string }).pattern, key).toBeTruthy();
    }
    for (const key of ['chicken', 'goblin', 'goblin_archer', 'elvarg_dragon']) {
      expect(Object.hasOwn(MONSTER_TYPES, key), key).toBe(true);
      expect((MONSTER_TYPES[key] as { pattern?: string }).pattern, key).toBeUndefined();
    }
  });
});

function fighter30(): GameState {
  const s = createDefaultState();
  for (const k of ['attack', 'strength', 'defence']) s.skills[k].lvl = 30;
  s.skills.hitpoints.lvl = 30; s.maxHp = 30; s.hp = 30;
  s.skills.prayer.lvl = 1; s.maxPrayerPts = 1; s.prayerPts = 1;
  for (const slot of Object.keys(s.equipment)) s.equipment[slot] = null;
  for (const [slot, id] of Object.entries({ weapon: 'addy_scimitar', body: 'addy_plate', legs: 'addy_legs' })) {
    if (!Object.hasOwn(ITEMS, id)) throw new Error(`attack-data: unknown item ${id}`);
    s.equipment[slot] = id;
  }
  s.combatStyle = 'controlled';
  s.activePrayers = new Set();
  return s;
}

describe('conservation rule', () => {
  // The loop of model.ts section 2: a heavy takes `slots` slots and deals `slots` ordinary rolls, so a player who never
  // reacts takes the same damage per second as today, within 5% over 10,000 simulated seconds.
  const patterned = Object.entries(MONSTER_TYPES).filter(([, d]) => (d as { pattern?: string }).pattern);
  it('there is at least one patterned monster per pattern', () => {
    for (const key of Object.keys(PATTERNS)) {
      expect(patterned.some(([, d]) => (d as { pattern?: string }).pattern === key), key).toBe(true);
    }
  });
  for (const [typeKey, def] of patterned) {
    const patternKey = (def as { pattern?: string }).pattern as string;
    it(`${typeKey} (${patternKey}) deals today's damage per second within 5% when it never moves`, () => {
      const T = 10000;
      const state = fighter30();
      const rand = seeded(7);
      let today = 0;
      for (let t = 0; t < T; t += CADENCE_SECS) today += rollMonsterHit(typeKey, 1, state, rand).dmg;
      let stand = 0, t = 0, i = 0;
      const list = PATTERNS[patternKey];
      while (t < T) {
        const id = list[i++ % list.length];
        const slots = id === 'basic' ? 1 : ATTACKS[id].slots;
        stand += slots * rollMonsterHit(typeKey, 1, state, rand).dmg;
        t += slots * CADENCE_SECS;
      }
      expect(today).toBeGreaterThan(0);
      expect(Math.abs(stand / today - 1), `${typeKey}: ${today / T} vs ${stand / T}`).toBeLessThanOrEqual(0.05);
    });
  }
});
