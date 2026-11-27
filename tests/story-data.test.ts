// Plan Q5: the story table against the rest of the game, and the walk: every quest played through the real dialogue
// functions from a new game. It reads the live tables, so it is vacuous while they are empty (Q5) and covers each later
// slice without edits.
import { describe, expect, it } from 'vitest';
import { DIALOGUES } from '../src/data/dialogue';
import { ITEMS } from '../src/data/items';
import { NPCS } from '../src/data/npcs';
import { SKILL_KEYS } from '../src/data/skills';
import { STORY_QUESTS, type StoryQuest } from '../src/data/story';
import { WORLD_REGIONS } from '../src/data/world';
import { combatLevel, STARTER_QUESTS } from '../src/state/adventure';
import { evalCond, type Cond, type Dialogue } from '../src/state/dialogue';
import { MAX_GP } from '../src/state/economy';
import { createNewGameState } from '../src/state/gameState';
import { countItem } from '../src/state/inventory';
import { STARTER_ARRIVAL } from '../src/state/quests';
import { finishQuest, questStatus, startQuest } from '../src/state/story';
import type { GameState } from '../src/state/types';
import { condProblems, mustLeaves, resetCombat, satisfy, walkStage, walkStats } from './support/satisfy';

const has = (table: object, id: string) => Object.hasOwn(table, id);
const npcIds = new Set(NPCS.map((n) => n.id));
const regionIds = new Set((WORLD_REGIONS as { id: string }[]).map((r) => r.id));
const questIds = STORY_QUESTS.map((q) => q.id);

/** Whether `cond` names a story quest anywhere (a quest, stage or claimed leaf, also inside an all, any or not). */
function namesStory(cond: Cond): boolean {
  if ('all' in cond) return cond.all.some(namesStory);
  if ('any' in cond) return cond.any.some(namesStory);
  if ('not' in cond) return namesStory(cond.not);
  if ('quest' in cond || 'stage' in cond) return true;
  return 'claimed' in cond && questIds.includes(cond.claimed);
}

/** A new game with the starter chain claimed (what a player has before the main line). */
function afterChain(): GameState {
  const s = createNewGameState();
  s.quests.claimed = [STARTER_ARRIVAL, ...STARTER_QUESTS.map((q) => q.id)];
  return s;
}

/** The nodes of a conversation a player can get to from a greet. */
function reachableNodes(d: Dialogue): Set<string> {
  const seen = new Set<string>();
  const stack = d.greet.map((g) => g.node);
  while (stack.length > 0) {
    const n = stack.pop()!;
    if (seen.has(n) || !d.nodes[n]) continue;
    seen.add(n);
    for (const o of d.nodes[n].options) if (o.goto !== 'end') stack.push(o.goto);
  }
  return seen;
}

/**
 * The reachable options of every person's tree that carry an effect of `kind` on quest `id`, with the person and the
 * stages of that quest their condition pins (empty: shown at any stage).
 */
function movers(kind: 'start' | 'advance' | 'finish', id: string) {
  const out: { npc: string; stages: number[] }[] = [];
  for (const d of DIALOGUES) {
    const reach = reachableNodes(d);
    for (const [name, node] of Object.entries(d.nodes)) {
      if (!reach.has(name)) continue;
      for (const opt of node.options) {
        if (!(opt.then ?? []).some((e) => kind in e && (e as Record<string, unknown>)[kind] === id)) continue;
        const stages = (opt.when ? mustLeaves(opt.when) : []).flatMap((l) => ('stage' in l && l.stage[0] === id ? [l.stage[1]] : []));
        out.push({ npc: d.npc, stages });
      }
    }
  }
  return out;
}

describe('story table', () => {
  it('ids are unique and every id it names exists', () => {
    const out: string[] = [];
    if (new Set(questIds).size !== questIds.length) out.push('duplicate quest id');
    for (const q of STORY_QUESTS) {
      const w = q.id;
      if (!npcIds.has(q.giver)) out.push(`${w}: giver ${q.giver}`);
      if (!regionIds.has(q.region)) out.push(`${w}: region ${q.region}`);
      if (q.line !== 'main' && q.line !== 'side') out.push(`${w}: line ${String(q.line)}`);
      if (q.stages.length === 0) out.push(`${w}: no stages`);
      condProblems(q.needs, `${w} needs`, out);
      q.stages.forEach((st, i) => {
        if (st.kind === 'talk' && !npcIds.has(st.at)) out.push(`${w}[${i}]: person ${st.at}`);
        if (st.kind === 'do') condProblems(st.done, `${w}[${i}]`, out);
        if (st.journal.trim() === '') out.push(`${w}[${i}]: empty journal line`);
      });
      if (q.stages.length > 0 && q.stages[q.stages.length - 1].kind !== 'talk') out.push(`${w}: the last stage is not a conversation`);
      if (!Number.isInteger(q.reward.gp) || q.reward.gp < 0) out.push(`${w}: reward gp ${q.reward.gp}`);
      for (const [skill, xp] of Object.entries(q.reward.xp)) {
        if (!SKILL_KEYS.includes(skill)) out.push(`${w}: reward skill ${skill}`);
        if (!Number.isInteger(xp) || xp <= 0) out.push(`${w}: reward xp ${xp}`);
      }
      for (const it of q.reward.items) if (!has(ITEMS, it.id) || !Number.isInteger(it.qty) || it.qty < 1) out.push(`${w}: reward item ${it.id}`);
    }
    expect(out).toEqual([]);
  });

  it('every quest is offered by an option in its giver tree, and every talk stage has exactly one way on', () => {
    const out: string[] = [];
    for (const q of STORY_QUESTS) {
      if (!movers('start', q.id).some((m) => m.npc === q.giver)) out.push(`${q.id}: ${q.giver} has no reachable option that starts it`);
      q.stages.forEach((st, i) => {
        if (st.kind !== 'talk') return;
        // A way on is any reachable option, in any tree, shown at this stage: pinned to it, or pinning no stage at all.
        const kind = i === q.stages.length - 1 ? 'finish' : 'advance';
        const ways = movers(kind, q.id).filter((m) => m.stages.length === 0 || m.stages.includes(i));
        const where = ways.map((m) => m.npc).join(', ');
        if (ways.length !== 1 || ways[0].npc !== st.at) out.push(`${q.id}[${i}]: ${ways.length} reachable options ${kind} it at that stage (${where}), want one, in ${st.at}'s tree`);
      });
    }
    expect(out).toEqual([]);
  });
});

describe('the walk: every quest, in table order, through the dialogue functions', () => {
  it('finishes every quest, pays each reward once, and needs at most 12 choices a step', () => {
    const s = afterChain();
    walkStats.maxChoices = 0;
    const out: string[] = [];
    for (const q of STORY_QUESTS) {
      if (questStatus(s, q.id) === 'done') continue; // an earlier quest's `needs` played it already
      // Play it up to its last stage, then record what the finishing conversation changes: that is the reward.
      satisfy(s, { quest: [q.id, 'active'] });
      while (s.progress!.story![q.id] < q.stages.length - 1) walkStage(s, q.id);
      const gpBefore = s.gp;
      const xpBefore = Object.fromEntries(Object.entries(s.skills).map(([k, v]) => [k, v.xp]));
      const itemsBefore = q.reward.items.map((it) => countItem(s, it.id));
      walkStage(s, q.id);
      const paid = s.gp - gpBefore;
      if (paid !== Math.min(q.reward.gp, MAX_GP - gpBefore)) out.push(`${q.id}: gp moved by ${paid}, reward is ${q.reward.gp}`);
      for (const [skill, amount] of Object.entries(q.reward.xp)) {
        const got = s.skills[skill].xp - xpBefore[skill];
        if (got !== amount) out.push(`${q.id}: ${skill} xp moved by ${got}, reward is ${amount}`);
      }
      if (questStatus(s, q.id) !== 'done') out.push(`${q.id}: not done after its last conversation`);
      if (s.quests.claimed.filter((id) => id === q.id).length !== 1) out.push(`${q.id}: claimed ${s.quests.claimed.filter((id) => id === q.id).length} times`);
      if (s.progress?.story?.[q.id] !== undefined) out.push(`${q.id}: still in progress.story when done`);
      if (q.reward.title && s.quests.title !== q.reward.title) out.push(`${q.id}: title is ${s.quests.title}`);
      q.reward.items.forEach((it, i) => {
        const got = countItem(s, it.id) - itemsBefore[i];
        if (got !== it.qty) out.push(`${q.id}: ${it.id} moved by ${got} in the backpack, reward is ${it.qty}`);
      });
      // Paid once: a second finish, a second start and a replay are all refused, and change nothing.
      const snap = JSON.stringify(s);
      expect(finishQuest(s, q.id).ok, `${q.id}: a second finish`).toBe(false);
      expect(startQuest(s, q.id).ok, `${q.id}: a second start`).toBe(false);
      expect(JSON.stringify(s), `${q.id}: a refused call changed the state`).toBe(snap);
    }
    expect(out).toEqual([]);
    expect(walkStats.maxChoices).toBeLessThanOrEqual(12);
  });

  it('the main line is refused out of order and below its combat level', () => {
    const main = STORY_QUESTS.filter((q) => q.line === 'main');
    const out: string[] = [];
    main.forEach((q: StoryQuest, i) => {
      if (i > 0) {
        // Every leaf that names no story quest (the combat level included) made true, so only the missing earlier
        // chapter can refuse, however the chapter names it (quest, stage, claimed, or inside an any or not).
        const fresh = afterChain();
        for (const leaf of mustLeaves(q.needs)) if (!namesStory(leaf)) satisfy(fresh, leaf);
        if (startQuest(fresh, q.id).ok) out.push(`${q.id}: started with no earlier chapter done`);
      }
      const need = mustLeaves(q.needs).flatMap((l) => ('combat' in l ? [l.combat] : []));
      if (need.length === 0) return;
      const level = Math.max(...need);
      // Everything but the combat level made true, then the combat level taken down: the start is refused.
      const s = afterChain();
      for (const leaf of mustLeaves(q.needs)) if (!('combat' in leaf)) satisfy(s, leaf);
      resetCombat(s);
      const undone = mustLeaves(q.needs).filter((l) => !('combat' in l) && !evalCond(s, l));
      if (undone.length > 0) {
        out.push(`${q.id}: taking the combat level down also undid ${JSON.stringify(undone)}`);
        return;
      }
      if (combatLevel(s) >= level) {
        out.push(`${q.id}: the base combat level ${combatLevel(s)} is not below its gate ${level}`);
      } else if (startQuest(s, q.id).ok) {
        out.push(`${q.id}: started at combat ${combatLevel(s)}, gate is ${level}`);
      }
    });
    expect(out).toEqual([]);
  });
});
