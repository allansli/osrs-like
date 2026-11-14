import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canUseStyle } from '../src/state/combat';
import { adventureTracker, starterView } from '../src/state/adventure';
import { createDefaultState, createNewGameState } from '../src/state/gameState';
import { STARTER_ARRIVAL } from '../src/state/quests';
import { readSave, serializeState, writeSave, type StorageLike } from '../src/state/save';

function stable(json: string): Record<string, unknown> {
  const o = JSON.parse(json);
  delete o.savedAt;
  return o;
}

function memStorage(): StorageLike {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

describe('Stage 3 new game', () => {
  it('a new game holds nothing', () => {
    const s = createNewGameState();
    expect(Object.keys(s.equipment)).toHaveLength(10);
    for (const slot of Object.values(s.equipment)) expect(slot).toBeNull();
    expect(s.inventory).toEqual([]);
    expect(s.bank).toEqual([]);
    expect(s.gp).toBe(0);
  });

  it('a new game runs at 1x', () => {
    expect(createNewGameState().xpMultiplier).toBe(1);
  });

  it('a new game has claimed arrival and nothing else', () => {
    const q = createNewGameState().quests;
    expect(q.claimed).toEqual([STARTER_ARRIVAL]);
    for (const [key, value] of Object.entries(q)) {
      if (typeof value === 'boolean') expect(value, key).toBe(false);
    }
    expect(q.slayer).toBeNull();
  });

  it('the first starter quest is open', () => {
    const s = createNewGameState();
    const view = starterView(s);
    expect(view).toHaveLength(1);
    expect(view[0].id).toBe('sq_ledger');
    expect(view[0].claimed).toBe(false);
    expect(adventureTracker(s).title).toBe('A Name in the Ledger');
  });

  it('everything else is the default', () => {
    const fresh = createNewGameState();
    const base = createDefaultState();
    base.gp = fresh.gp;
    base.xpMultiplier = fresh.xpMultiplier;
    base.equipment = fresh.equipment;
    base.inventory = fresh.inventory;
    base.quests.claimed = fresh.quests.claimed;
    expect(stable(serializeState(fresh, null, null))).toEqual(stable(serializeState(base, null, null)));
  });

  it('it returns a fresh object each call', () => {
    const a = createNewGameState();
    a.gp = 99;
    a.xpMultiplier = 10;
    a.equipment.weapon = 'bronze_scimitar';
    a.inventory.push({ id: 'coins', qty: 1 });
    a.quests.claimed.push('sq_ledger');
    const b = createNewGameState();
    expect(b).not.toBe(a);
    expect(b.gp).toBe(0);
    expect(b.xpMultiplier).toBe(1);
    expect(b.equipment.weapon).toBeNull();
    expect(b.inventory).toEqual([]);
    expect(b.quests.claimed).toEqual([STARTER_ARRIVAL]);
  });

  it('a new game survives writeSave then readSave', () => {
    const storage = memStorage();
    writeSave(storage, createNewGameState(), null, null);
    const loaded = readSave(storage);
    expect(loaded).not.toBeNull();
    const s = loaded!.state;
    for (const slot of Object.values(s.equipment)) expect(slot).toBeNull();
    expect(s.inventory).toEqual([]);
    expect(s.bank).toEqual([]);
    expect(s.gp).toBe(0);
    expect(s.xpMultiplier).toBe(1);
    expect(s.quests.claimed).toEqual(['arrival']);
  });

  it('a bare-handed hero can fight', () => {
    const s = createNewGameState();
    expect(canUseStyle('accurate', null, s).ok).toBe(true);
  });

  it('the default state is still its golden', () => {
    const golden = JSON.parse(readFileSync(new URL('./fixtures/s3/default-state.golden.json', import.meta.url), 'utf8'));
    expect(stable(serializeState(createDefaultState(), null, null))).toEqual(golden);
  });
});
