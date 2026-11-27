import type { GameState } from './types';

export type StoryResult = { ok: true } | { ok: false; reason: string };

export function startQuest(_state: GameState, _questId: string): StoryResult {
  throw new Error('not built');
}

export function finishQuest(_state: GameState, _questId: string): StoryResult {
  throw new Error('not built');
}
