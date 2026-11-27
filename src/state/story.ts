import { ITEMS } from '../data/items';
import { NPCS } from '../data/npcs';
import { STORY_QUESTS } from '../data/story';
import { getLevelForXp } from '../data/skills';
import { evalCond, type Cond, type StoryQuestStatus } from './dialogue';
import { creditGp } from './economy';
import { addItem, canAddItem, countItem, removeItem } from './inventory';
import { stat } from './progress';
import type { GameState } from './types';

export type StoryResult = { ok: true } | { ok: false; reason: string };

export type StoryAdvanceEvent = { questId: string; stage: number };

export interface JournalActiveEntry {
  id: string;
  name: string;
  main: boolean;
  stage: string;
  counts: string | null;
  line: 'main' | 'side';
  region: string;
  giver: string;
}

export interface JournalOfferedEntry {
  id: string;
  name: string;
  line: 'main' | 'side';
  region: string;
  giver: string;
  giverName: string;
  needs: Cond;
}

export interface JournalDoneEntry {
  id: string;
  name: string;
  line: 'main' | 'side';
  region: string;
}

export interface JournalView {
  active: JournalActiveEntry[];
  offered: JournalOfferedEntry[];
  done: JournalDoneEntry[];
}

export function questStatus(state: GameState, questId: string): StoryQuestStatus {
  if (state.quests.claimed.includes(questId)) return 'done';
  if (state.progress?.story?.[questId] !== undefined) return 'active';
  return 'none';
}

export function startQuest(state: GameState, questId: string): StoryResult {
  const quest = STORY_QUESTS.find((q) => q.id === questId);
  if (!quest) return { ok: false, reason: 'Unknown quest.' };
  if (state.quests.claimed.includes(questId)) return { ok: false, reason: 'Quest already claimed.' };
  if (state.progress?.story?.[questId] !== undefined) return { ok: false, reason: 'Quest already active.' };
  if (!evalCond(state, quest.needs)) return { ok: false, reason: 'Requirements not met.' };

  if (!state.progress) {
    state.progress = {};
  }
  if (!state.progress.story) {
    state.progress.story = {};
  }
  state.progress.story[questId] = 0;
  return { ok: true };
}

export function advanceStory(state: GameState): StoryAdvanceEvent[] {
  if (!state.progress?.story) return [];
  const moved: StoryAdvanceEvent[] = [];
  for (const [questId, current] of Object.entries(state.progress.story)) {
    if (typeof current !== 'number') continue;
    if (state.quests.claimed.includes(questId)) continue;
    const quest = STORY_QUESTS.find((q) => q.id === questId);
    if (!quest) continue;
    let stageIdx = current;
    while (stageIdx < quest.stages.length) {
      const stage = quest.stages[stageIdx];
      if (stage.kind === 'do' && evalCond(state, stage.done)) {
        stageIdx++;
        state.progress.story[questId] = stageIdx;
        moved.push({ questId, stage: stageIdx });
      } else {
        break;
      }
    }
  }
  return moved;
}

function canHoldRewards(state: GameState, items: { id: string; qty: number }[]): boolean {
  if (!items || items.length === 0) return true;
  const rehearsal = { ...state, inventory: state.inventory.map((slot) => ({ ...slot })) };
  for (const item of items) {
    if (!canAddItem(rehearsal, item.id, item.qty)) return false;
    addItem(rehearsal, item.id, item.qty);
  }
  return true;
}

function grantExactXp(state: GameState, skillKey: string, amount: number): void {
  const skill = state.skills[skillKey];
  if (!skill || amount <= 0) return;
  const oldLevel = skill.lvl;
  skill.xp += amount;
  skill.lvl = getLevelForXp(skill.xp);
  if (skillKey === 'hitpoints') {
    state.maxHp = skill.lvl;
    state.hp = Math.min(state.maxHp, state.hp + Math.max(0, skill.lvl - oldLevel));
  }
  if (skillKey === 'prayer') {
    state.maxPrayerPts = skill.lvl;
  }
}

export function finishQuest(state: GameState, questId: string): StoryResult {
  const quest = STORY_QUESTS.find((q) => q.id === questId);
  if (!quest) return { ok: false, reason: 'Unknown quest.' };
  if (state.quests.claimed.includes(questId)) return { ok: false, reason: 'Quest already claimed.' };
  const currentStage = state.progress?.story?.[questId];
  if (currentStage === undefined) return { ok: false, reason: 'Quest is not active.' };
  if (currentStage < quest.stages.length - 1) return { ok: false, reason: 'Quest has not reached its final stage.' };
  if (!canHoldRewards(state, quest.reward.items)) return { ok: false, reason: 'Your backpack is full.' };

  creditGp(state, quest.reward.gp);
  for (const [skill, amount] of Object.entries(quest.reward.xp)) {
    grantExactXp(state, skill, amount);
  }
  for (const item of quest.reward.items) {
    addItem(state, item.id, item.qty);
  }
  if (quest.reward.title) {
    state.quests.title = quest.reward.title;
  }
  delete state.progress?.story?.[questId];
  state.quests.claimed = [...state.quests.claimed, questId];
  return { ok: true };
}

function extractStatCount(state: GameState, cond: Cond): string | null {
  if ('stat' in cond) {
    const [statKey, target] = cond.stat;
    const current = Math.min(stat(state, statKey), target);
    return `${current} of ${target}`;
  }
  if ('all' in cond) {
    for (const c of cond.all) {
      const res = extractStatCount(state, c);
      if (res) return res;
    }
  }
  return null;
}

export function journalView(state: GameState): JournalView {
  const active: JournalActiveEntry[] = [];
  const offered: JournalOfferedEntry[] = [];
  const done: JournalDoneEntry[] = [];

  for (const quest of STORY_QUESTS) {
    if (state.quests.claimed.includes(quest.id)) {
      done.push({
        id: quest.id,
        name: quest.name,
        line: quest.line,
        region: quest.region
      });
    } else if (state.progress?.story?.[quest.id] !== undefined) {
      const stageIdx = state.progress.story[quest.id];
      const stage = quest.stages[stageIdx];
      active.push({
        id: quest.id,
        name: quest.name,
        main: quest.line === 'main',
        stage: stage ? stage.journal : '',
        counts: stage && stage.kind === 'do' ? extractStatCount(state, stage.done) : null,
        line: quest.line,
        region: quest.region,
        giver: quest.giver
      });
    } else if (evalCond(state, quest.needs)) {
      const npc = NPCS.find((n) => n.id === quest.giver);
      offered.push({
        id: quest.id,
        name: quest.name,
        line: quest.line,
        region: quest.region,
        giver: quest.giver,
        giverName: npc ? npc.name : quest.giver,
        needs: quest.needs
      });
    }
  }

  active.sort((a, b) => (a.main === b.main ? 0 : a.main ? -1 : 1));

  return { active, offered, done };
}

export function useEmber(state: GameState, itemId: string, skillKey: string): StoryResult {
  if (!skillKey || !Object.hasOwn(state.skills, skillKey)) {
    return { ok: false, reason: 'Unknown skill.' };
  }
  const item = ITEMS[itemId];
  if (!item || typeof item.lampXp !== 'number' || item.lampXp <= 0) {
    return { ok: false, reason: 'That item is not an ember.' };
  }
  if (countItem(state, itemId) < 1) {
    return { ok: false, reason: 'You do not have that item.' };
  }
  removeItem(state, itemId, 1);
  grantExactXp(state, skillKey, item.lampXp);
  return { ok: true };
}
