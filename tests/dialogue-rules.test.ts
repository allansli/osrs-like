// Plan Q1: the rules of design 7.2, written before they exist. Red until Q2 adds src/state/dialogue.ts and the three data modules.
import { describe, expect, it, vi } from 'vitest';
import { NPCS } from '../src/data/npcs';
import { STAT_KEYS, bump, stat } from '../src/state/progress';
import { assignSlayerTask, claimQuest, combatLevel } from '../src/state/adventure';
import { BACKPACK_SIZE, cloneState, createDefaultState, createNewGameState } from '../src/state/gameState';
import { canAddItem, countItem } from '../src/state/inventory';
import { chooseOption, evalCond, openDialogue } from '../src/state/dialogue';
import type { GameState } from '../src/state/types';
import { eventTypes, npcIds, snapshot, viewOf } from './support/dialogueFixture';

vi.mock('../src/data/npcs', async (orig) => (await import('./support/dialogueFixture')).withFixture('NPCS', await orig()));
vi.mock('../src/data/dialogue', async (orig) => (await import('./support/dialogueFixture')).withFixture('DIALOGUES', await orig()));
vi.mock('../src/data/story', async (orig) => (await import('./support/dialogueFixture')).withFixture('STORY_QUESTS', await orig()));

const ev = (state: GameState, cond: unknown) => evalCond(state, cond as Parameters<typeof evalCond>[1]);
const KEEPER = 'fx_keeper';

/** A new game: empty backpack, no coin, the chain open at its first quest. */
const fresh = () => createNewGameState();

/** Stage 3's first starter quest, met (a slayer task taken). */
function meetLedger(state: GameState) {
  expect(assignSlayerTask(state, 3).ok).toBe(true);
}

describe('evalCond: the fourteen kinds, true and false', () => {
  it('quest: none, active, done', () => {
    const s = fresh();
    expect(ev(s, { quest: ['fx_job', 'none'] })).toBe(true);
    expect(ev(s, { quest: ['fx_job', 'active'] })).toBe(false);
    expect(ev(s, { quest: ['fx_job', 'done'] })).toBe(false);
    s.progress = { story: { fx_job: 0 } };
    expect(ev(s, { quest: ['fx_job', 'none'] })).toBe(false);
    expect(ev(s, { quest: ['fx_job', 'active'] })).toBe(true);
    s.progress = { story: {} };
    s.quests.claimed = [...s.quests.claimed, 'fx_job'];
    expect(ev(s, { quest: ['fx_job', 'done'] })).toBe(true);
    expect(ev(s, { quest: ['fx_job', 'none'] })).toBe(false);
  });

  it('stage: active and exactly at that stage', () => {
    const s = fresh();
    expect(ev(s, { stage: ['fx_job', 0] })).toBe(false);
    s.progress = { story: { fx_job: 1 } };
    expect(ev(s, { stage: ['fx_job', 1] })).toBe(true);
    expect(ev(s, { stage: ['fx_job', 0] })).toBe(false);
  });

  it('claimed: any id in quests.claimed, old tables included', () => {
    const s = fresh();
    expect(ev(s, { claimed: 'cook' })).toBe(false);
    s.quests.claimed = [...s.quests.claimed, 'cook'];
    expect(ev(s, { claimed: 'cook' })).toBe(true);
    expect(ev(s, { claimed: 'arrival' })).toBe(true);
  });

  it('starter: open, then ready, against Stage 3 chain', () => {
    const s = fresh();
    expect(ev(s, { starter: ['sq_ledger', 'open'] })).toBe(true);
    expect(ev(s, { starter: ['sq_ledger', 'ready'] })).toBe(false);
    expect(ev(s, { starter: ['sq_quarrel', 'open'] })).toBe(false);
    meetLedger(s);
    expect(ev(s, { starter: ['sq_ledger', 'open'] })).toBe(true);
    expect(ev(s, { starter: ['sq_ledger', 'ready'] })).toBe(true);
    expect(claimQuest(s, 'sq_ledger').ok).toBe(true);
    expect(ev(s, { starter: ['sq_ledger', 'open'] })).toBe(false);
    expect(ev(s, { starter: ['sq_ledger', 'ready'] })).toBe(false);
    expect(ev(s, { starter: ['sq_quarrel', 'open'] })).toBe(true);
  });

  it('starter: a save that never claimed the arrival has no chain', () => {
    const s = createDefaultState();
    expect(s.quests.claimed).not.toContain('arrival');
    expect(ev(s, { starter: ['sq_ledger', 'open'] })).toBe(false);
    expect(ev(s, { starter: ['sq_ledger', 'ready'] })).toBe(false);
  });

  it('skill: level at least', () => {
    const s = fresh();
    s.skills.mining.lvl = 5;
    expect(ev(s, { skill: ['mining', 5] })).toBe(true);
    expect(ev(s, { skill: ['mining', 6] })).toBe(false);
  });

  it('combat: combat level at least', () => {
    const s = fresh();
    const level = combatLevel(s);
    expect(ev(s, { combat: level })).toBe(true);
    expect(ev(s, { combat: level + 1 })).toBe(false);
  });

  it('gp: coin at least', () => {
    const s = fresh();
    s.gp = 100;
    expect(ev(s, { gp: 100 })).toBe(true);
    expect(ev(s, { gp: 101 })).toBe(false);
  });

  it('has: quantity in the backpack at least', () => {
    const s = fresh();
    s.inventory = [{ id: 'logs', qty: 3 }];
    expect(ev(s, { has: ['logs', 3] })).toBe(true);
    expect(ev(s, { has: ['logs', 4] })).toBe(false);
    expect(ev(s, { has: ['copper_ore', 1] })).toBe(false);
  });

  it('stat: counter at least', () => {
    const s = fresh();
    expect(ev(s, { stat: ['kill:goblin', 1] })).toBe(false);
    bump(s, 'kill:goblin', 2);
    expect(ev(s, { stat: ['kill:goblin', 2] })).toBe(true);
    expect(ev(s, { stat: ['kill:goblin', 3] })).toBe(false);
  });

  it('shrine: the region is discovered', () => {
    const s = fresh();
    s.shrines.woods = false;
    expect(ev(s, { shrine: 'woods' })).toBe(false);
    s.shrines.woods = true;
    expect(ev(s, { shrine: 'woods' })).toBe(true);
  });

  it('flag: a quest flag is set', () => {
    const s = fresh();
    expect(ev(s, { flag: 'killedMoss' })).toBe(false);
    s.quests.killedMoss = true;
    expect(ev(s, { flag: 'killedMoss' })).toBe(true);
  });

  it('all, any, not, nested', () => {
    const s = fresh();
    s.gp = 10;
    const yes = { gp: 10 };
    const no = { gp: 11 };
    expect(ev(s, { all: [yes, yes] })).toBe(true);
    expect(ev(s, { all: [yes, no] })).toBe(false);
    expect(ev(s, { any: [no, yes] })).toBe(true);
    expect(ev(s, { any: [no, no] })).toBe(false);
    expect(ev(s, { not: no })).toBe(true);
    expect(ev(s, { not: yes })).toBe(false);
    expect(ev(s, { all: [{ any: [no, { not: no }] }, { not: { all: [yes, no] } }] })).toBe(true);
    expect(ev(s, { any: [{ all: [yes, no] }, { not: { any: [yes] } }] })).toBe(false);
  });

  it('an unknown kind throws', () => {
    expect(() => ev(fresh(), { bogus: 1 })).toThrow();
    expect(() => ev(fresh(), { all: [{ bogus: 1 }] })).toThrow();
  });
});

describe('openDialogue', () => {
  it('starts at the first greet whose condition holds', () => {
    const s = fresh();
    expect(openDialogue(s, KEEPER)?.nodeId).toBe('hello');
    s.progress = { story: { fx_job: 0 } };
    expect(openDialogue(s, KEEPER)?.nodeId).toBe('working');
    s.progress = { story: {} };
    s.quests.claimed = [...s.quests.claimed, 'fx_job'];
    expect(openDialogue(s, KEEPER)?.nodeId).toBe('thanks');
    // both fx_job done and fx_relay active hold: the earlier entry wins
    s.progress = { story: { fx_relay: 0 } };
    expect(openDialogue(s, KEEPER)?.nodeId).toBe('relay');
  });

  it('returns the speaker, the line and only the options whose condition holds, with their indexes', () => {
    const s = fresh();
    const view = openDialogue(s, KEEPER)!;
    expect(view.npcId).toBe(KEEPER);
    expect(view.speaker).toBe('Fixture Keeper');
    expect(view.say).toBe('Hello, traveller.');
    expect(view.options.map((o) => o.index)).toEqual([0, 1, 2]);
    expect(view.options.map((o) => o.text)).toEqual(['Any work?', 'Show me your wares.', 'Lead me in.']);
    meetLedger(s);
    // starter ready: "It is done." shown at index 3 (greet stays on 'hello', fx_job none)
    expect(openDialogue(s, KEEPER)?.options.map((o) => o.index)).toEqual([0, 1, 2, 3]);
  });

  it('counts the conversation as talk:<npc>', () => {
    const s = fresh();
    expect(stat(s, `talk:${KEEPER}`)).toBe(0);
    openDialogue(s, KEEPER);
    openDialogue(s, KEEPER);
    expect(stat(s, `talk:${KEEPER}`)).toBe(2);
    expect(stat(s, 'talk:fx_other')).toBe(0);
  });

  it('returns null for an unknown person and counts nothing', () => {
    const s = fresh();
    const before = snapshot(s);
    expect(openDialogue(s, 'nobody_here')).toBeNull();
    expect(snapshot(s)).toBe(before);
  });

  it('STAT_KEYS holds talk:<id> for every person', () => {
    const ids = npcIds(NPCS);
    expect(ids).toContain(KEEPER);
    for (const id of ids) expect(STAT_KEYS).toContain(`talk:${id}`);
  });
});

describe('chooseOption', () => {
  const choose = (s: GameState, node: string, index: number, npc = KEEPER) => chooseOption(s, npc, node, index);
  const refused = (r: { ok: boolean; reason?: string }) => {
    expect(r.ok).toBe(false);
    expect(typeof r.reason).toBe('string');
    expect(r.reason!.length).toBeGreaterThan(0);
  };

  it('refuses a node that is not that person\'s, and an unknown person', () => {
    const s = fresh();
    const before = snapshot(s);
    refused(choose(s, 'secret', 0, KEEPER));
    refused(choose(s, 'no_such_node', 0));
    refused(choose(s, 'hello', 0, 'nobody_here'));
    expect(snapshot(s)).toBe(before);
    expect(choose(s, 'secret', 0, 'fx_other').ok).toBe(true);
  });

  it('refuses an index whose option is hidden, or out of range', () => {
    const s = fresh();
    s.progress = { story: { fx_job: 0 } };
    const before = snapshot(s);
    refused(choose(s, 'hello', 0)); // "Any work?" needs the quest not started
    refused(choose(s, 'hello', 3)); // "It is done." needs the chain ready
    refused(choose(s, 'hello', 9));
    refused(choose(s, 'hello', -1));
    expect(snapshot(s)).toBe(before);
  });

  it('with a full backpack a give applies nothing, moves no quest and says why', () => {
    const s = fresh();
    s.inventory = Array.from({ length: BACKPACK_SIZE }, () => ({ id: 'wooden_shield', qty: 1 }));
    expect(canAddItem(s, 'bronze_scimitar')).toBe(false);
    s.progress = { story: { fx_relay: 0 } };
    const before = snapshot(s);
    const r = choose(s, 'gifts', 0);
    refused(r);
    expect(eventTypes(r)).toEqual([]);
    expect(snapshot(s)).toBe(before);
    expect(s.progress.story!.fx_relay).toBe(0);
  });

  it('a take without the item applies nothing and moves no quest', () => {
    const s = fresh();
    s.progress = { story: { fx_relay: 0 } };
    const before = snapshot(s);
    const r = choose(s, 'gifts', 1);
    refused(r);
    expect(eventTypes(r)).toEqual([]);
    expect(snapshot(s)).toBe(before);
  });

  it('a failing effect drops the effects before it (one copy, committed only when all succeed)', () => {
    const s = fresh();
    const before = snapshot(s);
    refused(choose(s, 'edge', 3)); // give copper ore, then take a scimitar the hero lacks
    expect(countItem(s, 'copper_ore')).toBe(0);
    expect(snapshot(s)).toBe(before);
  });

  it('applies the effects in order', () => {
    const s = fresh();
    const r = choose(s, 'edge', 0); // give then take of one item
    expect(r.ok).toBe(true);
    expect(countItem(s, 'copper_ore')).toBe(0);
    const before = snapshot(s);
    refused(choose(s, 'edge', 1)); // take then give of an item the hero lacks
    expect(snapshot(s)).toBe(before);
  });

  it('a give, a take and an advance change the state and the events match', () => {
    const s = fresh();
    s.inventory = [{ id: 'logs', qty: 5 }];
    s.progress = { story: { fx_relay: 0 } };
    const r = choose(s, 'relay', 0);
    expect(r.ok).toBe(true);
    expect(eventTypes(r)).toEqual(['questAdvanced']);
    expect(countItem(s, 'logs')).toBe(3);
    expect(countItem(s, 'shrimp')).toBe(1);
    expect(s.progress!.story!.fx_relay).toBe(1);
    expect(viewOf(r)?.nodeId).toBe('relay');
  });

  it('start moves the quest to its first stage and returns the next view; goto end returns no view', () => {
    const s = fresh();
    const r = choose(s, 'hello', 0);
    expect(r.ok).toBe(true);
    expect(eventTypes(r)).toEqual(['questStarted']);
    expect(s.progress!.story!.fx_job).toBe(0);
    expect(viewOf(r)?.nodeId).toBe('working');
    expect(viewOf(r)?.options.map((o) => o.index)).toEqual([1]); // "The goblins are down." still hidden
    expect(viewOf(choose(s, 'working', 1))).toBeNull();
  });

  it('finish moves the quest from story to claimed and returns questFinished', () => {
    const s = fresh();
    s.progress = { story: { fx_job: 1 } };
    const r = choose(s, 'working', 0);
    expect(r.ok).toBe(true);
    expect(eventTypes(r)).toEqual(['questFinished']);
    expect(s.quests.claimed).toContain('fx_job');
    expect(s.progress!.story).not.toHaveProperty('fx_job');
    expect(viewOf(r)?.nodeId).toBe('thanks');
  });

  it('open and enter change no state and return an event', () => {
    const s = fresh();
    const before = snapshot(s);
    const open = choose(s, 'hello', 1);
    const enter = choose(s, 'hello', 2);
    expect(open.ok && enter.ok).toBe(true);
    expect(eventTypes(open)).toEqual(['open']);
    expect(eventTypes(enter)).toEqual(['enter']);
    expect(JSON.stringify(open)).toContain('shop');
    expect(JSON.stringify(enter)).toContain('fx_dungeon');
    expect(snapshot(s)).toBe(before);
  });
});

describe('claimStarter', () => {
  it('pays exactly what claimQuest pays on a copy', () => {
    const s = fresh();
    meetLedger(s);
    const copy = cloneState(s);
    const direct = claimQuest(copy, 'sq_ledger');
    expect(direct.ok).toBe(true);

    const r = chooseOption(s, KEEPER, 'hello', 3);
    expect(r.ok).toBe(true);
    expect(s.gp).toBe(copy.gp);
    expect(s.inventory).toEqual(copy.inventory);
    expect(s.skills).toEqual(copy.skills);
    expect(s.quests.claimed).toEqual(copy.quests.claimed);
    expect(s.quests.title).toBe(copy.quests.title);
    expect(s.quests.dragonfireWard).toBe(copy.quests.dragonfireWard);
  });

  it('a second call by either route is refused', () => {
    const viaDialogue = fresh();
    meetLedger(viaDialogue);
    expect(chooseOption(viaDialogue, KEEPER, 'hello', 3).ok).toBe(true);
    const afterDialogue = snapshot(viaDialogue);
    expect(claimQuest(viaDialogue, 'sq_ledger').ok).toBe(false);
    expect(chooseOption(viaDialogue, KEEPER, 'hello', 3).ok).toBe(false);
    expect(snapshot(viaDialogue)).toBe(afterDialogue);

    const viaButton = fresh();
    meetLedger(viaButton);
    expect(claimQuest(viaButton, 'sq_ledger').ok).toBe(true);
    const afterButton = snapshot(viaButton);
    expect(chooseOption(viaButton, KEEPER, 'hello', 3).ok).toBe(false);
    expect(snapshot(viaButton)).toBe(afterButton);
  });

  it('refuses a chain step that is not open, even from an option with no condition', () => {
    const s = fresh();
    const before = snapshot(s);
    const r = chooseOption(s, KEEPER, 'edge', 2); // claimStarter sq_forge
    expect(r.ok).toBe(false);
    expect(typeof r.reason).toBe('string');
    expect(snapshot(s)).toBe(before);
  });

  it('refuses on a save that never had the chain', () => {
    const s = createDefaultState();
    const before = snapshot(s);
    expect(chooseOption(s, KEEPER, 'edge', 2).ok).toBe(false);
    expect(snapshot(s)).toBe(before);
  });
});
