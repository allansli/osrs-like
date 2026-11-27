// Plan Q7t, design 7.2 and G6.12: `talk`, `choose` and `useEmber` are commands with pure appliers on one player's state.
// Contract choice (Q8 implements it), all through `applyCommand(state, cmd, clocks, now)`:
//   { kind: 'talk', npcId }                             -> CommandResult plus `view`: exactly openDialogue's return; ok is `view !== null`
//   { kind: 'choose', npcId, nodeId, index }            -> CommandResult carrying chooseOption's `ok`, `view` and `events` (and its `reason` on a refusal)
//   { kind: 'useEmber', itemId, skillKey }              -> CommandResult carrying useEmber's `ok` (and its `reason` on a refusal)
// "Changes nothing else": the state after the applier equals the state after calling the rule directly on a clone.
// Red until Q8 adds the kinds; an unknown kind must be refused with a reason and no change.
import { describe, expect, it } from 'vitest';
import { applyCommand, type PlayerCommand } from '../src/state/commands';
import { chooseOption, openDialogue } from '../src/state/dialogue';
import { cloneState, createNewGameState } from '../src/state/gameState';
import { addItem } from '../src/state/inventory';
import { useEmber } from '../src/state/story';
import type { GameState } from '../src/state/types';

const clocks = () => ({ food: { readyAt: 0 }, potion: { readyAt: 0 } });
const snap = (s: GameState) => JSON.stringify({ ...s, activePrayers: [...s.activePrayers] });
const run = (s: GameState, cmd: unknown) => applyCommand(s, cmd as PlayerCommand, clocks(), 0) as unknown as Record<string, unknown>;
const fresh = () => cloneState(createNewGameState());
const NPC = 'bran_tolley';

describe('talk', () => {
  it('returns openDialogue\'s view and changes what it changes', () => {
    const a = fresh();
    const b = cloneState(a);
    const view = openDialogue(a, NPC);
    expect(view).not.toBeNull();
    const r = run(b, { kind: 'talk', npcId: NPC });
    expect(r.ok).toBe(true);
    expect(r.view).toEqual(view);
    expect(snap(b)).toBe(snap(a));
  });

  it('refuses an unknown person with a reason, as openDialogue returns null, and changes nothing', () => {
    const s = fresh();
    const before = snap(s);
    expect(openDialogue(cloneState(s), 'nobody_here')).toBeNull();
    const r = run(s, { kind: 'talk', npcId: 'nobody_here' });
    expect(r.ok).toBe(false);
    expect(String(r.reason).length).toBeGreaterThan(0);
    expect(snap(s)).toBe(before);
  });
});

describe('choose', () => {
  it('returns chooseOption\'s result for every option of the first view and changes what it changes', () => {
    const base = fresh();
    const view = openDialogue(cloneState(base), NPC)!;
    expect(view.options.length).toBeGreaterThan(0);
    for (const o of view.options) {
      const a = cloneState(base);
      const b = cloneState(base);
      const direct = chooseOption(a, NPC, view.nodeId, o.index);
      const r = run(b, { kind: 'choose', npcId: NPC, nodeId: view.nodeId, index: o.index });
      expect(r.ok, `option ${o.index}`).toBe(direct.ok);
      expect(r.view, `option ${o.index}`).toEqual((direct as { view?: unknown }).view);
      expect(r.events, `option ${o.index}`).toEqual(direct.events);
      expect(snap(b), `option ${o.index}`).toBe(snap(a));
    }
  });

  it('refuses an out-of-range index with chooseOption\'s reason and changes nothing', () => {
    const s = fresh();
    const view = openDialogue(s, NPC)!;
    const before = snap(s);
    const direct = chooseOption(cloneState(s), NPC, view.nodeId, 99);
    expect(direct.ok).toBe(false);
    const r = run(s, { kind: 'choose', npcId: NPC, nodeId: view.nodeId, index: 99 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe((direct as { reason: string }).reason);
    expect(snap(s)).toBe(before);
  });
});

describe('useEmber', () => {
  it('returns useEmber\'s result and changes what it changes', () => {
    const a = fresh();
    addItem(a, 'ember_faint', 1);
    const b = cloneState(a);
    const direct = useEmber(a, 'ember_faint', 'mining');
    expect(direct.ok).toBe(true);
    const r = run(b, { kind: 'useEmber', itemId: 'ember_faint', skillKey: 'mining' });
    expect(r.ok).toBe(true);
    expect(snap(b)).toBe(snap(a));
  });

  it('refuses without the item, with useEmber\'s reason, and changes nothing', () => {
    const s = fresh();
    const before = snap(s);
    const direct = useEmber(cloneState(s), 'ember_faint', 'mining');
    expect(direct.ok).toBe(false);
    const r = run(s, { kind: 'useEmber', itemId: 'ember_faint', skillKey: 'mining' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe((direct as { reason: string }).reason);
    expect(snap(s)).toBe(before);
  });
});

describe('unknown kinds', () => {
  it('an unknown command kind is refused with a reason and changes nothing', () => {
    const s = fresh();
    const before = snap(s);
    const r = run(s, { kind: 'teleport_to_moon' });
    expect(r?.ok).toBe(false);
    expect(String(r?.reason ?? '').length).toBeGreaterThan(0);
    expect(snap(s)).toBe(before);
  });
});
