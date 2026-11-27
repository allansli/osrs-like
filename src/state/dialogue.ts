import { NPCS, type NpcDef } from '../data/npcs';
import { DIALOGUES } from '../data/dialogue';
import { STARTER_QUESTS, claimQuest, combatLevel, type QuestDef } from './adventure';
import { applyState, cloneState } from './gameState';
import { addItem, canAddItem, countItem, removeItem } from './inventory';
import { bump, stat } from './progress';
import { finishQuest, startQuest } from './story';
import type { GameState } from './types';

export type StoryQuestStatus = 'none' | 'active' | 'done';
export type StarterQuestStatus = 'open' | 'ready';
export type DialogueOpenTarget = 'shop' | 'bank' | 'forge' | 'tasks' | 'bench' | 'altar';

export type Cond =
  | { all: Cond[] }
  | { any: Cond[] }
  | { not: Cond }
  | { quest: [string, StoryQuestStatus] }
  | { stage: [string, number] }
  | { claimed: string }
  | { starter: [string, StarterQuestStatus] }
  | { skill: [string, number] }
  | { combat: number }
  | { gp: number }
  | { has: [string, number] }
  | { stat: [string, number] }
  | { shrine: string }
  | { flag: string };

export type Effect =
  | { start: string }
  | { advance: string }
  | { finish: string }
  | { claimStarter: string }
  | { give: [string, number] }
  | { take: [string, number] }
  | { open: DialogueOpenTarget }
  | { enter: string };

export interface DialogueOption {
  text: string;
  when?: Cond;
  then?: Effect[];
  goto: string | 'end';
}

export interface DialogueNode {
  say: string;
  by?: 'hero';
  options: DialogueOption[];
}

export interface DialogueGreet {
  when?: Cond;
  node: string;
}

export interface Dialogue {
  npc: string;
  greet: DialogueGreet[];
  nodes: Record<string, DialogueNode>;
}

export interface DialogueViewOption {
  index: number;
  text: string;
}

export interface DialogueView {
  npcId: string;
  nodeId: string;
  speaker: string;
  say: string;
  options: DialogueViewOption[];
}

export type DialogueEvent =
  | { type: 'questStarted'; questId: string }
  | { type: 'questAdvanced'; questId: string }
  | { type: 'questFinished'; questId: string }
  | { type: 'open'; target: DialogueOpenTarget; station?: DialogueOpenTarget }
  | { type: 'enter'; dungeonId: string };

export interface ChooseResult {
  ok: boolean;
  reason?: string;
  view?: DialogueView | null;
  events: DialogueEvent[];
}

export function evalCond(state: GameState, cond: Cond): boolean {
  if ('all' in cond) {
    return cond.all.every((c) => evalCond(state, c));
  }
  if ('any' in cond) {
    return cond.any.some((c) => evalCond(state, c));
  }
  if ('not' in cond) {
    return !evalCond(state, cond.not);
  }
  if ('quest' in cond) {
    const [questId, expected] = cond.quest;
    const isDone = state.quests.claimed.includes(questId);
    const isActive = !isDone && state.progress?.story?.[questId] !== undefined;
    const current: StoryQuestStatus = isDone ? 'done' : isActive ? 'active' : 'none';
    return current === expected;
  }
  if ('stage' in cond) {
    const [questId, targetStage] = cond.stage;
    const isDone = state.quests.claimed.includes(questId);
    if (isDone) return false;
    return state.progress?.story?.[questId] === targetStage;
  }
  if ('claimed' in cond) {
    return state.quests.claimed.includes(cond.claimed);
  }
  if ('starter' in cond) {
    const [starterQuestId, mode] = cond.starter;
    if (!state.quests.claimed.includes(STARTER_QUESTS[0].id)) return false;
    let openDef: QuestDef | null = null;
    for (let i = 1; i < STARTER_QUESTS.length; i++) {
      const cur = STARTER_QUESTS[i];
      const prev = STARTER_QUESTS[i - 1];
      if (!state.quests.claimed.includes(cur.id) && state.quests.claimed.includes(prev.id)) {
        openDef = cur;
        break;
      }
    }
    if (!openDef || openDef.id !== starterQuestId) return false;
    if (mode === 'open') return true;
    if (mode === 'ready') return openDef.steps.every((step) => step.met(state));
    return false;
  }
  if ('skill' in cond) {
    const [skillKey, minLevel] = cond.skill;
    return (state.skills[skillKey]?.lvl ?? 0) >= minLevel;
  }
  if ('combat' in cond) {
    return combatLevel(state) >= cond.combat;
  }
  if ('gp' in cond) {
    return state.gp >= cond.gp;
  }
  if ('has' in cond) {
    const [itemId, qty] = cond.has;
    return countItem(state, itemId) >= qty;
  }
  if ('stat' in cond) {
    const [statKey, min] = cond.stat;
    return stat(state, statKey) >= min;
  }
  if ('shrine' in cond) {
    return Boolean(state.shrines[cond.shrine]);
  }
  if ('flag' in cond) {
    return Boolean((state.quests as unknown as Record<string, unknown>)[cond.flag]);
  }
  throw new Error(`Unknown condition: ${JSON.stringify(cond)}`);
}

export function openDialogue(state: GameState, npcId: string): DialogueView | null {
  const npcsList: readonly NpcDef[] = Array.isArray(NPCS) ? NPCS : Object.values(NPCS);
  const npc = npcsList.find((n) => n.id === npcId);
  if (!npc) return null;

  const dialoguesList: readonly Dialogue[] = Array.isArray(DIALOGUES) ? DIALOGUES : Object.values(DIALOGUES);
  const dlg = dialoguesList.find((d) => d.npc === npcId);
  if (!dlg) return null;

  const greet = dlg.greet.find((g) => !g.when || evalCond(state, g.when));
  if (!greet) return null;

  const node = dlg.nodes[greet.node];
  if (!node) return null;

  bump(state, `talk:${npcId}`);

  return {
    npcId,
    nodeId: greet.node,
    speaker: npc.name,
    say: node.say,
    options: node.options
      .map((opt, index) => ({ opt, index }))
      .filter(({ opt }) => !opt.when || evalCond(state, opt.when))
      .map(({ opt, index }) => ({ index, text: opt.text }))
  };
}

export function chooseOption(
  state: GameState,
  npcId: string,
  nodeId: string,
  index: number
): ChooseResult {
  const npcsList: readonly NpcDef[] = Array.isArray(NPCS) ? NPCS : Object.values(NPCS);
  const npc = npcsList.find((n) => n.id === npcId);
  if (!npc) return { ok: false, reason: 'Unknown person', events: [] };

  const dialoguesList: readonly Dialogue[] = Array.isArray(DIALOGUES) ? DIALOGUES : Object.values(DIALOGUES);
  const dlg = dialoguesList.find((d) => d.npc === npcId);
  if (!dlg) return { ok: false, reason: 'No dialogue for person', events: [] };

  const node = dlg.nodes[nodeId];
  if (!node) return { ok: false, reason: 'Unknown dialogue node', events: [] };

  if (index < 0 || index >= node.options.length) {
    return { ok: false, reason: 'Option index out of range', events: [] };
  }

  const option = node.options[index];
  if (option.when && !evalCond(state, option.when)) {
    return { ok: false, reason: 'Option not available', events: [] };
  }

  const copy = cloneState(state);
  const events: DialogueEvent[] = [];

  if (option.then) {
    for (const effect of option.then) {
      if ('give' in effect) {
        const [itemId, qty] = effect.give;
        if (!canAddItem(copy, itemId, qty)) {
          return { ok: false, reason: 'Your backpack is full.', events: [] };
        }
        addItem(copy, itemId, qty);
      } else if ('take' in effect) {
        const [itemId, qty] = effect.take;
        if (countItem(copy, itemId) < qty) {
          return { ok: false, reason: 'Missing required item.', events: [] };
        }
        removeItem(copy, itemId, qty);
      } else if ('advance' in effect) {
        if (!copy.progress) copy.progress = {};
        if (!copy.progress.story) copy.progress.story = {};
        const current = copy.progress.story[effect.advance] ?? 0;
        copy.progress.story[effect.advance] = current + 1;
        events.push({ type: 'questAdvanced', questId: effect.advance });
      } else if ('start' in effect) {
        const res = startQuest(copy, effect.start);
        if (!res.ok) return { ok: false, reason: res.reason ?? 'Cannot start quest.', events: [] };
        events.push({ type: 'questStarted', questId: effect.start });
      } else if ('finish' in effect) {
        const res = finishQuest(copy, effect.finish);
        if (!res.ok) return { ok: false, reason: res.reason ?? 'Cannot finish quest.', events: [] };
        events.push({ type: 'questFinished', questId: effect.finish });
      } else if ('claimStarter' in effect) {
        const res = claimQuest(copy, effect.claimStarter);
        if (!res.ok) return { ok: false, reason: res.reason, events: [] };
      } else if ('open' in effect) {
        events.push({ type: 'open', target: effect.open, station: effect.open });
      } else if ('enter' in effect) {
        events.push({ type: 'enter', dungeonId: effect.enter });
      } else {
        throw new Error(`Unknown effect: ${JSON.stringify(effect)}`);
      }
    }
  }

  applyState(state, copy);

  if (option.goto === 'end') {
    return { ok: true, view: null, events };
  }

  const nextNode = dlg.nodes[option.goto];
  if (!nextNode) {
    return { ok: true, view: null, events };
  }

  const nextView: DialogueView = {
    npcId,
    nodeId: option.goto,
    speaker: npc.name,
    say: nextNode.say,
    options: nextNode.options
      .map((opt, optIndex) => ({ opt, index: optIndex }))
      .filter(({ opt }) => !opt.when || evalCond(state, opt.when))
      .map(({ opt, index: optIndex }) => ({ index: optIndex, text: opt.text }))
  };

  return { ok: true, view: nextView, events };
}
