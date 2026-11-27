// Plan Q5: makes a dialogue condition true the way play would, and walks a story quest through the real dialogue
// functions. Used by the data tests (tests/story-data.test.ts); reads the live tables, so later slices are covered
// without edits. Nothing here is a game rule: if a step cannot be made, it throws and the data test fails.
import { OSRS_XP_TABLE } from '../../src/data/skills';
import { existsSync } from 'node:fs';
import { STORY_QUESTS } from '../../src/data/story';
import { combatLevel, STARTER_QUESTS } from '../../src/state/adventure';
import { chooseOption, evalCond, openDialogue, type Cond, type DialogueView } from '../../src/state/dialogue';
import { applyState, cloneState } from '../../src/state/gameState';
import { addItem, countItem } from '../../src/state/inventory';
import { bump, stat } from '../../src/state/progress';
import { advanceStory, questStatus } from '../../src/state/story';
import type { GameState } from '../../src/state/types';

/** The most choices one step of a walk (a start, a talk stage, the finish) needed, over every walk so far. */
export const walkStats = { maxChoices: 0 };
const MAX_CHOICES = 12;
const COMBAT_SKILLS = ['attack', 'strength', 'defence', 'hitpoints', 'ranged', 'magic', 'prayer'];

export function setSkill(state: GameState, key: string, lvl: number): void {
  const skill = state.skills[key];
  if (!skill) throw new Error(`satisfy: unknown skill ${key}`);
  skill.lvl = lvl;
  skill.xp = OSRS_XP_TABLE[lvl];
  if (key === 'hitpoints') {
    state.maxHp = lvl;
    state.hp = Math.min(state.hp, lvl);
  }
  if (key === 'prayer') state.maxPrayerPts = lvl;
}

/** Every combat skill to the same level, the smallest at which the combat level is at least `n`. */
export function raiseCombat(state: GameState, n: number): void {
  for (let lvl = 1; lvl <= 99; lvl++) {
    for (const key of COMBAT_SKILLS) setSkill(state, key, key === 'hitpoints' ? Math.max(10, lvl) : lvl);
    if (combatLevel(state) >= n) return;
  }
  throw new Error(`satisfy: combat level ${n} is out of reach`);
}

/** Every combat skill back to the new-game base, so a combat gate can be seen to refuse. */
export function resetCombat(state: GameState): void {
  for (const key of COMBAT_SKILLS) setSkill(state, key, key === 'hitpoints' ? 10 : 1);
}

/** The condition's leaves that must hold on every path (through `all`, never through `any` or `not`). */
export function mustLeaves(cond: Cond): Cond[] {
  if ('all' in cond) return cond.all.flatMap(mustLeaves);
  return [cond];
}

/** Makes `cond` true. A `not` or an `any` is satisfied by its first workable branch; a `not` that is false is an error. */
export function satisfy(state: GameState, cond: Cond): void {
  if ('all' in cond) {
    for (const c of cond.all) satisfy(state, c);
  } else if ('any' in cond) {
    if (cond.any.length === 0) throw new Error('satisfy: an empty any can never hold');
    satisfy(state, cond.any[0]);
  } else if ('not' in cond) {
    if (evalCond(state, cond.not)) throw new Error(`satisfy: cannot undo ${JSON.stringify(cond.not)}`);
  } else if ('quest' in cond) {
    const [id, want] = cond.quest;
    if (want === 'done') ensureDone(state, id);
    else if (want === 'active') ensureActive(state, id);
    else if (questStatus(state, id) !== 'none') throw new Error(`satisfy: quest ${id} is already ${questStatus(state, id)}`);
  } else if ('stage' in cond) {
    const [id, n] = cond.stage;
    ensureActive(state, id);
    const quest = STORY_QUESTS.find((q) => q.id === id)!;
    while (state.progress!.story![id] < n) walkStage(state, quest.id);
    if (state.progress!.story![id] !== n) throw new Error(`satisfy: quest ${id} is past stage ${n}`);
  } else if ('claimed' in cond) {
    claimOld(state, cond.claimed);
  } else if ('starter' in cond) {
    const [id, mode] = cond.starter;
    const index = STARTER_QUESTS.findIndex((q) => q.id === id);
    if (index < 1) throw new Error(`satisfy: unknown starter quest ${id}`);
    state.quests.claimed = [...new Set([...state.quests.claimed, ...STARTER_QUESTS.slice(0, index).map((q) => q.id)])];
    state.quests.claimed = state.quests.claimed.filter((c) => c !== id);
    if (mode === 'ready' && !STARTER_QUESTS[index].steps.every((s) => s.met(state))) {
      throw new Error(`satisfy: starter quest ${id} cannot be made ready from data alone`);
    }
  } else if ('skill' in cond) {
    const [key, lvl] = cond.skill;
    if (state.skills[key].lvl < lvl) setSkill(state, key, lvl);
  } else if ('combat' in cond) {
    if (combatLevel(state) < cond.combat) raiseCombat(state, cond.combat);
  } else if ('gp' in cond) {
    if (state.gp < cond.gp) state.gp = cond.gp;
  } else if ('has' in cond) {
    const [id, qty] = cond.has;
    const missing = qty - countItem(state, id);
    if (missing > 0 && addItem(state, id, missing).added !== missing) throw new Error(`satisfy: no room for ${missing} ${id}`);
  } else if ('stat' in cond) {
    const [key, min] = cond.stat;
    const missing = min - stat(state, key);
    if (missing > 0) bump(state, key, missing);
  } else if ('shrine' in cond) {
    state.shrines[cond.shrine] = true;
  } else if ('flag' in cond) {
    state.quests[cond.flag] = true;
  } else {
    throw new Error(`satisfy: unknown condition ${JSON.stringify(cond)}`);
  }
}

/** An id of the old quest tables (the starter chain or Stage 3's ten): claimed without being played. */
function claimOld(state: GameState, id: string): void {
  if (STORY_QUESTS.some((q) => q.id === id)) return ensureDone(state, id);
  const chain = STARTER_QUESTS.findIndex((q) => q.id === id);
  const ids = chain >= 0 ? STARTER_QUESTS.slice(0, chain + 1).map((q) => q.id) : [id];
  state.quests.claimed = [...new Set([...state.quests.claimed, ...ids])];
}

function ensureActive(state: GameState, id: string): void {
  const status = questStatus(state, id);
  if (status === 'done') throw new Error(`satisfy: quest ${id} is already done`);
  if (status === 'none') walkStart(state, id);
}

function ensureDone(state: GameState, id: string): void {
  if (questStatus(state, id) !== 'done') completeQuest(state, id);
}

/**
 * Plays a person's conversation until `done` is true, choosing options breadth-first the way a player could; every try
 * runs on a copy. Throws when no sequence of at most 12 choices reaches it.
 */
export function talkUntil(state: GameState, npcId: string, done: (s: GameState) => boolean): number {
  const start = cloneState(state);
  const first = openDialogue(start, npcId);
  if (!first) throw new Error(`talkUntil: ${npcId} has no conversation`);
  const seen = new Set<string>([first.nodeId]);
  let frontier: { s: GameState; view: DialogueView }[] = [{ s: start, view: first }];
  for (let choices = 1; choices <= MAX_CHOICES && frontier.length > 0; choices++) {
    const next: typeof frontier = [];
    for (const { s, view } of frontier) {
      for (const opt of view.options) {
        const copy = cloneState(s);
        const res = chooseOption(copy, npcId, view.nodeId, opt.index);
        if (!res.ok) continue;
        if (done(copy)) {
          applyState(state, copy);
          walkStats.maxChoices = Math.max(walkStats.maxChoices, choices);
          return choices;
        }
        if (res.view && !seen.has(res.view.nodeId)) {
          seen.add(res.view.nodeId);
          next.push({ s: copy, view: res.view });
        }
      }
    }
    frontier = next;
  }
  throw new Error(`talkUntil: no way to the goal with ${npcId} in ${MAX_CHOICES} choices`);
}

/** Satisfies a quest's `needs`, then starts it through its giver's conversation. */
export function walkStart(state: GameState, id: string): void {
  const quest = STORY_QUESTS.find((q) => q.id === id);
  if (!quest) throw new Error(`satisfy: unknown story quest ${id}`);
  satisfy(state, quest.needs);
  talkUntil(state, quest.giver, (s) => questStatus(s, id) !== 'none');
}

/** Moves the active quest one stage on: a `do` stage by satisfying it, a `talk` stage by the person's conversation. */
export function walkStage(state: GameState, id: string): void {
  const quest = STORY_QUESTS.find((q) => q.id === id)!;
  const at = state.progress!.story![id];
  const stage = quest.stages[at];
  if (stage.kind === 'do') {
    satisfy(state, stage.done);
    advanceStory(state);
    if (state.progress!.story![id] <= at) throw new Error(`satisfy: ${id} stage ${at} did not move`);
  } else {
    talkUntil(state, stage.at, (s) => questStatus(s, id) === 'done' || s.progress!.story![id] > at);
    advanceStory(state);
  }
}

/** Plays quest `id` from wherever it is to its end. */
export function completeQuest(state: GameState, id: string): void {
  ensureActive(state, id);
  while (questStatus(state, id) === 'active') walkStage(state, id);
}

/** Every string inside a value, however deep (keys are not strings of the content and are skipped). */
export function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const v of value) collectStrings(v, out);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) collectStrings(v, out);
  return out;
}

/** Every leaf of a condition tree, through all, any and not. */
export function allLeaves(cond: Cond): Cond[] {
  if ('all' in cond) return cond.all.flatMap(allLeaves);
  if ('any' in cond) return cond.any.flatMap(allLeaves);
  if ('not' in cond) return allLeaves(cond.not);
  return [cond];
}

/** The exports of a data module a later slice adds (`src/data/<name>.ts`); an empty record until it exists. */
export async function optionalModule(name: string): Promise<Record<string, unknown>> {
  const file = new URL(`../../src/data/${name}.ts`, import.meta.url);
  return existsSync(file) ? ((await import(/* @vite-ignore */ file.href)) as Record<string, unknown>) : {};
}
