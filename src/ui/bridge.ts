import type { ItemDef } from '../data/items';

/** UI callbacks assigned by the runtime after the DOM helpers exist. */
export const bridge = {
  chat: (_text: string, _type?: string) => {},
  refresh: () => {},
  close: () => {},
  coin: () => {},
  saveToast: () => {},
  reset: () => {},
  cycleTime: () => {},
  toggleXp: () => {},
  toggleAudio: () => {},
  teleportSpell: (_regionId: string) => {},
  noteBank: () => {},
  noteQuest: () => {},
  showItemTooltip: (_ev: MouseEvent, _it: ItemDef) => {},
  moveItemTooltip: (_ev: MouseEvent) => {},
  hideItemTooltip: () => {},
  claimQuest: (_questId: string) => {},
  locateRegion: (_regionId: string) => {},
  requestSlayer: () => {}
};
