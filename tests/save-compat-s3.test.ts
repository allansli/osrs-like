import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../src/state/gameState';
import { migrateLegacySave, readSave, SAVE_KEY, serializeState, type StorageLike } from '../src/state/save';

const fx = (name: string) => new URL(`./fixtures/s3/${name}`, import.meta.url);
const readJson = (name: string): any => JSON.parse(readFileSync(fx(name), 'utf8'));
const v4 = JSON.parse(readFileSync(new URL('./fixtures/save-v4.json', import.meta.url), 'utf8'));
const UPDATE = process.env.UPDATE_GOLDEN === '1';

function stable(json: string): Record<string, unknown> {
  const o = JSON.parse(json);
  delete o.savedAt;
  return o;
}

function golden(name: string, got: unknown): void {
  if (UPDATE) {
    writeFileSync(fx(name), JSON.stringify(got, null, 1) + '\n');
    return;
  }
  expect(got).toEqual(readJson(name));
}

function qtyOf(slots: { id: string; qty: number }[], id: string): number {
  return slots.filter((s) => s.id === id).reduce((n, s) => n + s.qty, 0);
}

function memStorage(items: Record<string, string>): StorageLike {
  const m = new Map(Object.entries(items));
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

describe('Stage 3 save compatibility', () => {
  it('the default state serialises to its golden', () => {
    golden('default-state.golden.json', stable(serializeState(createDefaultState(), null, null)));
  });

  it('the Stage 1 version-4 fixture loads to its golden', () => {
    const m = migrateLegacySave(structuredClone(v4), SAVE_KEY);
    golden('save-v4-loaded.golden.json', stable(serializeState(m.state, m.pose, m.cam)));
  });

  it('a geared version-4 save keeps every piece, its gold and its rate', () => {
    const m = migrateLegacySave(readJson('save-v4-geared.json'), SAVE_KEY);
    const s = m.state;
    expect(s.equipment.weapon).toBe('rune_scimitar');
    expect(s.equipment.body).toBe('rune_plate');
    expect(s.equipment.legs).toBe('rune_legs');
    expect(s.equipment.head).toBe('rune_helm');
    expect(qtyOf(s.inventory, 'dragon_chain')).toBe(1);
    expect(qtyOf(s.inventory, 'dragon_legs')).toBe(1);
    expect(qtyOf(s.inventory, 'shark')).toBe(40);
    expect(qtyOf(s.bank, 'dragon_scimitar')).toBe(2);
    expect(qtyOf(s.bank, 'runite_bar')).toBe(300);
    expect(s.gp).toBe(500000);
    expect(s.xpMultiplier).toBe(10);
    for (const k of ['attack', 'strength', 'defence'] as const) expect(s.skills[k].xp).toBe(37224);
    expect(m.pose).toMatchObject({ x: 8, z: 10 });
  });

  it('a version-4 save without xpMultiplier loads at 10', () => {
    const raw = readJson('save-v4-no-multiplier.json');
    expect('xpMultiplier' in raw).toBe(false);
    expect(migrateLegacySave(raw, SAVE_KEY).state.xpMultiplier).toBe(10);
  });

  it("a bare legacy save gets today's default kit", () => {
    const raw = readFileSync(fx('save-legacy-bare.json'), 'utf8');
    const m = readSave(memStorage({ runewilds_save_v3: raw }))!;
    const d = createDefaultState();
    expect(m.state.gp).toBe(77);
    expect(m.state.equipment.weapon).toBe('bronze_scimitar');
    expect(m.state.inventory).toEqual(d.inventory);
  });

  it('serializeState writes version 4 and the same keys as the default golden', () => {
    const out = stable(serializeState(createDefaultState(), null, null));
    expect(out.version).toBe(4);
    expect(Object.keys(out).sort()).toEqual(Object.keys(readJson('default-state.golden.json')).sort());
  });
});
