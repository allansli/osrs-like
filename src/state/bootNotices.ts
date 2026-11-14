import type { GameState } from './types';

export type BootNotice = 'restored' | 'xp10' | 'controls' | 'first-task';

/** The chat lines a boot shows after the welcome line, as ids; the engine owns the text. */
export function bootNotices(hadSave: boolean, state: GameState): BootNotice[] {
  if (!hadSave) return ['controls', 'first-task'];
  return state.xpMultiplier !== 1 ? ['restored', 'xp10'] : ['restored'];
}
