import type { GameState } from './types';

export function startQuest(_state: GameState, _questId: string): { ok: boolean; reason?: string } {
  throw new Error('not built');
}

export function finishQuest(_state: GameState, _questId: string): { ok: boolean; reason?: string } {
  throw new Error('not built');
}
