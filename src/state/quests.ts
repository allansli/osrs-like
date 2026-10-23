import type { QuestFlags } from './types';

export function defaultQuests(): QuestFlags {
  return {
    burnedLog: false,
    openedBank: false,
    killedGoblin: false,
    killedArcane: false,
    minedMetal: false,
    killedScorpion: false,
    smeltedBar: false,
    choppedAncient: false,
    killedMoss: false,
    killedElvarg: false,
    claimed: [],
    slayer: null,
    slayerTasksCompleted: 0,
    slayerStreak: 0,
    dragonfireWard: false,
    title: ''
  };
}

export function copyQuests(quests: QuestFlags): QuestFlags {
  return {
    ...quests,
    claimed: [...(quests.claimed || [])],
    slayer: quests.slayer ? { ...quests.slayer } : null
  };
}

export function normalizeQuests(raw: unknown): QuestFlags {
  const quests = defaultQuests();
  if (!raw || typeof raw !== 'object') return quests;
  const data = raw as Record<string, unknown>;
  const flags = [
    'burnedLog',
    'openedBank',
    'killedGoblin',
    'killedArcane',
    'minedMetal',
    'killedScorpion',
    'smeltedBar',
    'choppedAncient',
    'killedMoss',
    'killedElvarg',
    'dragonfireWard'
  ] as const;
  for (const key of flags) {
    if (typeof data[key] === 'boolean') quests[key] = data[key];
  }
  if (Array.isArray(data.claimed)) {
    quests.claimed = data.claimed.filter((id): id is string => typeof id === 'string');
  }
  if (typeof data.slayerTasksCompleted === 'number') {
    quests.slayerTasksCompleted = Math.max(0, Math.floor(data.slayerTasksCompleted));
  }
  if (typeof data.slayerStreak === 'number') {
    quests.slayerStreak = Math.max(0, Math.floor(data.slayerStreak));
  }
  if (typeof data.title === 'string') quests.title = data.title.slice(0, 40);
  if (data.slayer && typeof data.slayer === 'object') {
    const task = data.slayer as Record<string, unknown>;
    if (typeof task.monster === 'string' && typeof task.name === 'string') {
      quests.slayer = {
        monster: task.monster,
        name: task.name,
        remaining: Math.max(0, Math.floor(Number(task.remaining) || 0)),
        total: Math.max(1, Math.floor(Number(task.total) || 1))
      };
    }
  }
  return quests;
}

export function noteGather(state: { quests: QuestFlags }, itemId: string): void {
  if (itemId === 'iron_ore' || itemId === 'mithril_ore') state.quests.minedMetal = true;
  if (itemId === 'yew_logs' || itemId === 'magic_logs') state.quests.choppedAncient = true;
}

export function noteSmelt(state: { quests: QuestFlags }): void {
  state.quests.smeltedBar = true;
}
