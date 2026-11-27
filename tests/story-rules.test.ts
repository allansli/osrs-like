// Plan Q3: the rules of design 7.3 (stages, rewards, journal, tracker, embers), written before they exist.
// Red until Q4 fills src/state/story.ts (startQuest, advanceStory, finishQuest, journalView, useEmber), adds the tracker's
// two entries to adventureTracker, lets the save reader keep story ids in `claimed`, and adds the two ember guards to inventory.ts.
//
// Contract these tests pin for the names the design leaves open (Q4 follows them):
//   startQuest / finishQuest / useEmber(state, ...) -> { ok: boolean; reason?: string }
//   advanceStory(state) -> an array with one entry per stage that moved (empty when nothing moved)
//   journalView(state) -> { active: E[]; offered: E[]; done: E[] }, each E has `id` and `name`; an active E also has
//     `main` (boolean), `stage` (the stage's journal text) and `counts` ('2 of 4' for a `do` stage on a stat, else null);
//     an offered E carries the giver's display name somewhere in it
//   adventureTracker: the active story quest's `title` is the quest's name and its `detail` holds the stage's journal text
import { describe, expect, it, vi } from 'vitest';
import { ITEMS } from '../src/data/items';
import { STORY_QUESTS } from '../src/data/story';
import { getLevelForXp } from '../src/data/skills';
import { adventureTracker } from '../src/state/adventure';
import { MAX_GP } from '../src/state/economy';
import { BACKPACK_SIZE, createDefaultState, createNewGameState } from '../src/state/gameState';
import { buyItem, countItem, isGatheredGood, sellInventoryMatch } from '../src/state/inventory';
import { bump } from '../src/state/progress';
import { STARTER_ARRIVAL } from '../src/state/quests';
import { readSave, SAVE_KEY, writeSave, type StorageLike } from '../src/state/save';
import { advanceStory, finishQuest, journalView, startQuest, useEmber } from '../src/state/story';
import type { GameState } from '../src/state/types';
import { snapshot } from './support/dialogueFixture';

vi.mock('../src/data/npcs', async (orig) => (await import('./support/dialogueFixture')).withFixture('NPCS', await orig()));
vi.mock('../src/data/dialogue', async (orig) => (await import('./support/dialogueFixture')).withFixture('DIALOGUES', await orig()));
vi.mock('../src/data/story', async (orig) => (await import('./support/dialogueFixture')).withFixture('STORY_QUESTS', await orig()));

// A main-line quest beside the fixture's two side quests (the fixture file is Q1's and stays as it is). Added after the
// modules loaded: the rules read STORY_QUESTS at call time; the save reader's stage table (built at load) does not know it,
// so no test here saves it.
STORY_QUESTS.push({
  id: 'fx_main',
  name: 'Fixture Chapter',
  line: 'main',
  giver: 'fx_keeper',
  region: 'lumbridge',
  needs: { gp: 0 },
  stages: [
    { kind: 'do', done: { stat: ['kill:goblin', 1] }, journal: 'Kill one goblin for the chapter.' },
    { kind: 'talk', at: 'fx_keeper', journal: 'Report the chapter to the keeper.' }
  ],
  reward: { gp: 0, xp: {}, items: [] }
});

// Two embers, test-only rows (the real ones are Q6's): a small one, and one big enough to raise hitpoints and prayer levels.
Object.assign(ITEMS, {
  fx_ember: { id: 'fx_ember', name: 'Fixture Ember', type: 'resource', price: 1, lampXp: 1000 },
  fx_ember_big: { id: 'fx_ember_big', name: 'Big Fixture Ember', type: 'resource', price: 1, lampXp: 40000 }
});

const fresh = (): GameState => createNewGameState();
const CHAIN = ['sq_ledger', 'sq_quarrel', 'sq_gather', 'sq_forge', 'sq_keeping', 'sq_coin'];
const chainClaimed = (): GameState => {
  const s = fresh();
  s.quests.claimed = [STARTER_ARRIVAL, ...CHAIN];
  return s;
};
const setStory = (s: GameState, story: Record<string, number>) => {
  s.progress = { ...(s.progress ?? {}), story };
};
const ids = (list: { id: string }[]) => list.map((e) => e.id);
const flat = (v: unknown) => JSON.stringify(v);
const reasonOf = (r: unknown) => (r as { reason?: string }).reason;

/** Temporarily changes a quest row of the table; the table is shared by every test of this file. */
function withNeeds(id: string, needs: unknown, body: () => void) {
  const row = STORY_QUESTS.find((q) => q.id === id)!;
  const old = row.needs;
  row.needs = needs as typeof row.needs;
  try {
    body();
  } finally {
    row.needs = old;
  }
}

describe('startQuest', () => {
  it('starts an offered quest at stage 0', () => {
    const s = fresh();
    expect(startQuest(s, 'fx_job').ok).toBe(true);
    expect(s.progress!.story!.fx_job).toBe(0);
  });

  it('refuses when needs is false, and changes nothing', () => {
    const s = fresh();
    const before = snapshot(s);
    withNeeds('fx_relay', { gp: 1 }, () => {
      const r = startQuest(s, 'fx_relay');
      expect(r.ok).toBe(false);
      expect(reasonOf(r)).toEqual(expect.any(String));
    });
    expect(snapshot(s)).toBe(before);
  });

  it('refuses a quest that is already active, leaving its stage', () => {
    const s = fresh();
    setStory(s, { fx_job: 1 });
    expect(startQuest(s, 'fx_job').ok).toBe(false);
    expect(s.progress!.story!.fx_job).toBe(1);
  });

  it('refuses a quest that is done', () => {
    const s = fresh();
    s.quests.claimed = [...s.quests.claimed, 'fx_job'];
    expect(startQuest(s, 'fx_job').ok).toBe(false);
    expect(s.progress?.story?.fx_job).toBeUndefined();
  });
});

describe('advanceStory', () => {
  it('moves a do stage when its condition is true, and nothing before', () => {
    const s = fresh();
    startQuest(s, 'fx_job');
    expect(advanceStory(s)).toEqual([]);
    expect(s.progress!.story!.fx_job).toBe(0);
    bump(s, 'kill:goblin', 1);
    expect(advanceStory(s)).toEqual([]);
    bump(s, 'kill:goblin', 1);
    const moved = advanceStory(s);
    expect(moved).toHaveLength(1);
    expect(flat(moved)).toContain('fx_job');
    expect(s.progress!.story!.fx_job).toBe(1);
  });

  it('never moves a talk stage', () => {
    const s = fresh();
    setStory(s, { fx_relay: 0 });
    bump(s, 'kill:goblin', 5);
    expect(advanceStory(s)).toEqual([]);
    expect(s.progress!.story!.fx_relay).toBe(0);
    setStory(s, { fx_job: 1 });
    expect(advanceStory(s)).toEqual([]);
    expect(s.progress!.story!.fx_job).toBe(1);
  });

  it('moves several quests in one call', () => {
    const s = fresh();
    startQuest(s, 'fx_job');
    startQuest(s, 'fx_main');
    bump(s, 'kill:goblin', 2);
    const moved = advanceStory(s);
    expect(moved).toHaveLength(2);
    expect(flat(moved)).toContain('fx_job');
    expect(flat(moved)).toContain('fx_main');
    expect(s.progress!.story).toMatchObject({ fx_job: 1, fx_main: 1 });
  });

  it('is idempotent: a second call moves nothing and changes nothing', () => {
    const s = fresh();
    startQuest(s, 'fx_job');
    bump(s, 'kill:goblin', 2);
    expect(advanceStory(s)).toHaveLength(1);
    const after = snapshot(s);
    expect(advanceStory(s)).toEqual([]);
    expect(snapshot(s)).toBe(after);
  });

  it('work done before the quest finishes the stage at once', () => {
    const s = fresh();
    bump(s, 'kill:goblin', 4);
    startQuest(s, 'fx_job');
    expect(advanceStory(s)).toHaveLength(1);
    expect(s.progress!.story!.fx_job).toBe(1);
  });

  it('does nothing for a hero with no active quest', () => {
    const s = fresh();
    const before = snapshot(s);
    expect(advanceStory(s)).toEqual([]);
    expect(snapshot(s)).toBe(before);
  });
});

describe('finishQuest', () => {
  const atEnd = () => {
    const s = fresh();
    s.xpMultiplier = 10;
    setStory(s, { fx_job: 1 });
    return s;
  };

  it('pays the coin, the unmultiplied experience, the items and the title, and moves the id to claimed', () => {
    const s = atEnd();
    const xp = s.skills.mining.xp;
    expect(finishQuest(s, 'fx_job').ok).toBe(true);
    expect(s.gp).toBe(100);
    expect(s.skills.mining.xp).toBe(xp + 50); // not 500: the 10x rate does not apply
    expect(s.skills.mining.lvl).toBe(getLevelForXp(s.skills.mining.xp));
    expect(countItem(s, 'shrimp')).toBe(3);
    expect(s.quests.title).toBe('Fixture Hero');
    expect(s.quests.claimed).toContain('fx_job');
    expect(s.progress!.story).not.toHaveProperty('fx_job');
  });

  it('pays coin through creditGp, which stops at the pouch limit', () => {
    const s = atEnd();
    s.gp = MAX_GP - 40;
    expect(finishQuest(s, 'fx_job').ok).toBe(true);
    expect(s.gp).toBe(MAX_GP);
  });

  it('pays once: a second finish is refused and pays nothing', () => {
    const s = atEnd();
    finishQuest(s, 'fx_job');
    const after = snapshot(s);
    const r = finishQuest(s, 'fx_job');
    expect(r.ok).toBe(false);
    expect(reasonOf(r)).toEqual(expect.any(String));
    expect(snapshot(s)).toBe(after);
    expect(s.quests.claimed.filter((id) => id === 'fx_job')).toHaveLength(1);
  });

  it('refuses with a full backpack, leaving the quest active and paying nothing', () => {
    const s = atEnd();
    s.inventory = Array.from({ length: BACKPACK_SIZE }, () => ({ id: 'wooden_shield', qty: 1 }));
    const before = snapshot(s);
    const r = finishQuest(s, 'fx_job');
    expect(r.ok).toBe(false);
    expect(reasonOf(r)).toEqual(expect.any(String));
    expect(snapshot(s)).toBe(before);
    expect(s.progress!.story!.fx_job).toBe(1);
    expect(s.quests.claimed).not.toContain('fx_job');
    expect(s.gp).toBe(0);
  });

  it('refuses a quest that is not active', () => {
    const s = fresh();
    const before = snapshot(s);
    expect(finishQuest(s, 'fx_job').ok).toBe(false);
    expect(snapshot(s)).toBe(before);
  });

  it('refuses a quest that has not reached its last stage', () => {
    const s = fresh();
    setStory(s, { fx_job: 0 });
    const before = snapshot(s);
    expect(finishQuest(s, 'fx_job').ok).toBe(false);
    expect(snapshot(s)).toBe(before);
  });

  it('a claimed quest cannot be started again', () => {
    const s = atEnd();
    finishQuest(s, 'fx_job');
    expect(startQuest(s, 'fx_job').ok).toBe(false);
  });
});

describe('journalView', () => {
  it('lists active, offered and done quests, the main line marked', () => {
    const s = fresh();
    s.quests.claimed = [...s.quests.claimed, 'fx_relay'];
    startQuest(s, 'fx_main');
    const j = journalView(s);
    expect(ids(j.active)).toEqual(['fx_main']);
    expect(j.active[0]).toMatchObject({ name: 'Fixture Chapter', main: true });
    expect(j.active[0].stage).toBe('Kill one goblin for the chapter.');
    expect(ids(j.offered)).toEqual(['fx_job']);
    expect(flat(j.offered[0])).toContain('Fixture Keeper');
    expect(ids(j.done)).toEqual(['fx_relay']);
  });

  it('marks a side quest as not main, and shows its current stage text', () => {
    const s = fresh();
    setStory(s, { fx_job: 1 });
    const e = journalView(s).active.find((q) => q.id === 'fx_job')!;
    expect(e.main).toBe(false);
    expect(e.stage).toBe('Tell the keeper.');
    expect(e.counts).toBeNull();
  });

  it('counts a stat condition ("1 of 2") and follows it as the counter grows', () => {
    const s = fresh();
    startQuest(s, 'fx_job');
    expect(journalView(s).active[0].counts).toBe('0 of 2');
    bump(s, 'kill:goblin', 1);
    expect(journalView(s).active[0].counts).toBe('1 of 2');
  });

  it('does not offer a quest whose needs are false, and offers it once they hold', () => {
    const s = fresh();
    withNeeds('fx_relay', { gp: 1 }, () => {
      expect(ids(journalView(s).offered)).not.toContain('fx_relay');
      s.gp = 1;
      expect(ids(journalView(s).offered)).toContain('fx_relay');
    });
  });

  it('lists nothing as offered that is active or done', () => {
    const s = fresh();
    startQuest(s, 'fx_job');
    s.quests.claimed = [...s.quests.claimed, 'fx_relay'];
    const j = journalView(s);
    expect(ids(j.offered)).not.toContain('fx_job');
    expect(ids(j.offered)).not.toContain('fx_relay');
  });
});

describe('adventureTracker with the story', () => {
  it('with no story progress it returns exactly what it returned before', () => {
    const ledger = { title: 'A Name in the Ledger', detail: 'Speak with the task master and accept a task' };
    expect(adventureTracker(fresh())).toMatchObject(ledger);
    const withEmptyStory = fresh();
    withEmptyStory.progress = { story: {}, stats: {} };
    expect(adventureTracker(withEmptyStory)).toEqual(adventureTracker(fresh()));
    // the default state and a finished chain: the same line with a progress block that holds only counters
    for (const make of [createDefaultState, chainClaimed]) {
      const plain = make();
      const counted = make();
      bump(counted, 'kill:goblin', 3);
      expect(adventureTracker(counted)).toEqual(adventureTracker(plain));
    }
    expect(adventureTracker(chainClaimed()).title).toBe('Lumbridge Foundations');
    expect(adventureTracker(createDefaultState()).title).toBe('Lumbridge Foundations');
  });

  it('an active main-line quest shows its stage after the open starter quest', () => {
    const s = fresh();
    startQuest(s, 'fx_main');
    expect(adventureTracker(s).title).toBe('A Name in the Ledger'); // the chain's open quest stays first
    const done = chainClaimed();
    startQuest(done, 'fx_main');
    const line = adventureTracker(done);
    expect(line.title).toBe('Fixture Chapter');
    expect(line.detail).toContain('Kill one goblin for the chapter.');
  });

  it('the story comes before Stage 3\'s discovered-region quest and before every unclaimed one', () => {
    const s = chainClaimed();
    s.shrines.desert = true;
    expect(adventureTracker(s).title).toBe('Lumbridge Foundations'); // the old rule, with no story
    startQuest(s, 'fx_job');
    expect(adventureTracker(s).title).toBe('Fixture Job');
  });

  it('the main line comes before a side quest, whichever started first', () => {
    const s = chainClaimed();
    startQuest(s, 'fx_job');
    startQuest(s, 'fx_main');
    expect(adventureTracker(s).title).toBe('Fixture Chapter');
  });

  it('with only side quests it shows the oldest, which is the first started, not the first in the table', () => {
    const s = chainClaimed();
    startQuest(s, 'fx_relay');
    startQuest(s, 'fx_job');
    expect(adventureTracker(s).title).toBe('Fixture Relay');
  });

  it('follows the stage: the line changes when the quest moves on', () => {
    const s = chainClaimed();
    startQuest(s, 'fx_main');
    bump(s, 'kill:goblin', 1);
    advanceStory(s);
    const line = adventureTracker(s);
    expect(line.title).toBe('Fixture Chapter');
    expect(line.detail).toContain('Report the chapter to the keeper.');
  });

  it('a finished quest leaves the tracker', () => {
    const s = chainClaimed();
    setStory(s, { fx_job: 1 });
    finishQuest(s, 'fx_job');
    expect(adventureTracker(s).title).toBe('Lumbridge Foundations');
  });
});

describe('a story id in claimed survives the save', () => {
  it('keeps a finished story quest across writeSave and readSave', () => {
    const map = new Map<string, string>();
    const storage: StorageLike = {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => void map.set(k, v),
      removeItem: (k) => void map.delete(k)
    };
    const s = createDefaultState();
    s.quests.claimed = [STARTER_ARRIVAL, 'fx_job'];
    writeSave(storage, s, null, null);
    expect(map.has(SAVE_KEY)).toBe(true);
    const back = readSave(storage)!;
    expect(back.corrupt).toBe(false);
    expect(back.state.quests.claimed).toContain('fx_job');
    expect(back.state.quests.claimed).toContain(STARTER_ARRIVAL);
  });
});

describe('useEmber', () => {
  const withEmber = (id = 'fx_ember', qty = 2): GameState => {
    const s = fresh();
    s.xpMultiplier = 10;
    s.inventory = [{ id, qty }];
    return s;
  };

  it('removes one ember and adds its experience unmultiplied, updating the level', () => {
    const s = withEmber();
    const xp = s.skills.mining.xp;
    expect(useEmber(s, 'fx_ember', 'mining').ok).toBe(true);
    expect(countItem(s, 'fx_ember')).toBe(1);
    expect(s.skills.mining.xp).toBe(xp + 1000); // not 10,000
    expect(s.skills.mining.lvl).toBe(getLevelForXp(s.skills.mining.xp));
    expect(s.skills.mining.lvl).toBeGreaterThan(1);
  });

  it('is the same at 1x: the multiplier plays no part', () => {
    const s = withEmber();
    s.xpMultiplier = 1;
    const xp = s.skills.mining.xp;
    useEmber(s, 'fx_ember', 'mining');
    expect(s.skills.mining.xp).toBe(xp + 1000);
  });

  it('raises hitpoints and prayer points as a level-up does', () => {
    const s = withEmber('fx_ember_big', 2);
    const level = s.skills.hitpoints.lvl;
    const hp = s.hp;
    expect(useEmber(s, 'fx_ember_big', 'hitpoints').ok).toBe(true);
    expect(s.skills.hitpoints.lvl).toBeGreaterThan(level);
    expect(s.maxHp).toBe(s.skills.hitpoints.lvl);
    expect(s.hp).toBeGreaterThan(hp);
    expect(s.hp).toBeLessThanOrEqual(s.maxHp);
    expect(useEmber(s, 'fx_ember_big', 'prayer').ok).toBe(true);
    expect(s.skills.prayer.lvl).toBeGreaterThan(1);
    expect(s.maxPrayerPts).toBe(s.skills.prayer.lvl);
  });

  it('refuses an unknown skill and keeps the ember', () => {
    const s = withEmber();
    const before = snapshot(s);
    for (const skill of ['juggling', '', '__proto__', 'constructor']) {
      const r = useEmber(s, 'fx_ember', skill);
      expect(r.ok).toBe(false);
      expect(reasonOf(r)).toEqual(expect.any(String));
    }
    expect(snapshot(s)).toBe(before);
  });

  it('refuses an item that is not an ember, and one the hero does not carry', () => {
    const s = withEmber();
    s.inventory.push({ id: 'shrimp', qty: 1 });
    const before = snapshot(s);
    expect(useEmber(s, 'shrimp', 'mining').ok).toBe(false);
    expect(useEmber(s, 'no_such_item', 'mining').ok).toBe(false);
    expect(useEmber(s, 'fx_ember_big', 'mining').ok).toBe(false); // an ember, but not in the backpack
    expect(snapshot(s)).toBe(before);
  });

  it('uses the last ember and leaves no empty slot', () => {
    const s = withEmber('fx_ember', 1);
    expect(useEmber(s, 'fx_ember', 'mining').ok).toBe(true);
    expect(countItem(s, 'fx_ember')).toBe(0);
    expect(s.inventory.every((slot) => slot.qty > 0)).toBe(true);
  });
});

describe('embers and the store (critique H6)', () => {
  it('buyItem refuses an item with lampXp and charges nothing', () => {
    const s = fresh();
    s.gp = 1_000_000;
    const before = snapshot(s);
    const r = buyItem(s, 'fx_ember_big', 1);
    expect(r.ok).toBe(false);
    expect(snapshot(s)).toBe(before);
  });

  it('isGatheredGood is false for an ember, true for an ore', () => {
    expect(isGatheredGood('fx_ember')).toBe(false);
    expect(isGatheredGood('copper_ore')).toBe(true);
  });

  it('sellInventoryMatch with isGatheredGood leaves embers in the backpack and sells the ore', () => {
    const s = fresh();
    s.inventory = [
      { id: 'fx_ember_big', qty: 2 },
      { id: 'copper_ore', qty: 3 },
      { id: 'fx_ember', qty: 1 }
    ];
    const r = sellInventoryMatch(s, isGatheredGood);
    expect(r.ok).toBe(true);
    expect(countItem(s, 'copper_ore')).toBe(0);
    expect(countItem(s, 'fx_ember_big')).toBe(2);
    expect(countItem(s, 'fx_ember')).toBe(1);
    expect(s.gp).toBe(r.gp);
  });

  it('with only embers in the backpack the bulk sell finds nothing to sell', () => {
    const s = fresh();
    s.inventory = [{ id: 'fx_ember_big', qty: 1 }];
    const r = sellInventoryMatch(s, isGatheredGood);
    expect(r.ok).toBe(false);
    expect(countItem(s, 'fx_ember_big')).toBe(1);
    expect(s.gp).toBe(0);
  });
});
