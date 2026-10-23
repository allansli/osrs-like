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
  noteQuest: () => {}
};
