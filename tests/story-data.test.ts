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
import type { Cond, Dialogue } from '../src/state/dialogue';
import { MAX_GP } from '../src/state/economy';
import { createNewGameState } from '../src/state/gameState';
import { countItem } from '../src/state/inventory';
import { STAT_KEYS } from '../src/state/progress';
import { STARTER_ARRIVAL } from '../src/state/quests';
import { finishQuest, questStatus, startQuest } from '../src/state/story';
import type { GameState } from '../src/state/types';
import { allLeaves, mustLeaves, resetCombat, satisfy, walkStage, walkStats } from './support/satisfy';

const has = (table: object, id: string) => Object.hasOwn(table, id);
const npcIds = new Set(NPCS.map((n) => n.id));
const regionIds = new Set((WORLD_REGIONS as { id: string }[]).map((r) => r.id));
const statKeys = new Set(STAT_KEYS);
const questIds = STORY_QUESTS.map((q) => q.id);
const dialogueOf = (npc: string): Dialogue | undefined => DIALOGUES.find((d) => d.npc === npc);

/** A new game with the starter chain claimed (what a player has before the main line). */
function afterChain(): GameState {
  const s = createNewGameState();
  s.quests.claimed = [STARTER_ARRIVAL, ...STARTER_QUESTS.map((q) => q.id)];
  return s;
}

function condIdProblems(c: Cond, where: string, out: string[]) {
  for (const leaf of allLeaves(c)) {
    if ('quest' in leaf && !questIds.includes(leaf.quest[0])) out.push(`${where}: quest ${leaf.quest[0]}`);
    if ('stage' in leaf && !questIds.includes(leaf.stage[0])) out.push(`${where}: stage of ${leaf.stage[0]}`);
    if ('skill' in leaf && !SKILL_KEYS.includes(leaf.skill[0])) out.push(`${where}: skill ${leaf.skill[0]}`);
    if ('has' in leaf && !has(ITEMS, leaf.has[0])) out.push(`${where}: item ${leaf.has[0]}`);
    if ('stat' in leaf && !statKeys.has(leaf.stat[0])) out.push(`${where}: stat ${leaf.stat[0]}`);
    if ('shrine' in leaf && !regionIds.has(leaf.shrine)) out.push(`${where}: region ${leaf.shrine}`);
  }
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

/** The reachable options of a person's tree that carry an effect of `kind` on quest `id`, with the stages their condition pins. */
function movers(npc: string, kind: 'start' | 'advance' | 'finish', id: string) {
  const d = dialogueOf(npc);
  if (!d) return [];
  const reach = reachableNodes(d);
  const out: { stages: number[] }[] = [];
  for (const [name, node] of Object.entries(d.nodes)) {
    if (!reach.has(name)) continue;
    for (const opt of node.options) {
      if (!(opt.then ?? []).some((e) => kind in e && (e as Record<string, unknown>)[kind] === id)) continue;
      const stages = (opt.when ? mustLeaves(opt.when) : []).flatMap((l) => ('stage' in l && l.stage[0] === id ? [l.stage[1]] : []));
      out.push({ stages });
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
      condIdProblems(q.needs, `${w} needs`, out);
      q.stages.forEach((st, i) => {
        if (st.kind === 'talk' && !npcIds.has(st.at)) out.push(`${w}[${i}]: person ${st.at}`);
        if (st.kind === 'do') condIdProblems(st.done, `${w}[${i}]`, out);
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
      if (movers(q.giver, 'start', q.id).length === 0) out.push(`${q.id}: ${q.giver} has no reachable option that starts it`);
      q.stages.forEach((st, i) => {
        if (st.kind !== 'talk') return;
        const kind = i === q.stages.length - 1 ? 'finish' : 'advance';
        const ways = movers(st.at, kind, q.id).filter((m) => m.stages.includes(i));
        if (ways.length !== 1) out.push(`${q.id}[${i}]: ${st.at} has ${ways.length} reachable options that ${kind} it at that stage`);
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
      for (const it of q.reward.items) if (countItem(s, it.id) < it.qty) out.push(`${q.id}: ${it.id} x${it.qty} not in the backpack`);
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
        const fresh = afterChain();
        if (startQuest(fresh, q.id).ok) out.push(`${q.id}: started with no earlier chapter done`);
      }
      const need = mustLeaves(q.needs).flatMap((l) => ('combat' in l ? [l.combat] : []));
      if (need.length === 0) return;
      const level = Math.max(...need);
      // Everything but the combat level made true, then the combat level taken down: the start is refused.
      const s = afterChain();
      for (const leaf of mustLeaves(q.needs)) if (!('combat' in leaf)) satisfy(s, leaf);
      resetCombat(s);
      if (combatLevel(s) >= level) {
        out.push(`${q.id}: the base combat level ${combatLevel(s)} is not below its gate ${level}`);
      } else if (startQuest(s, q.id).ok) {
        out.push(`${q.id}: started at combat ${combatLevel(s)}, gate is ${level}`);
      }
    });
    expect(out).toEqual([]);
  });
});
