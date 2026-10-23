/** Shop and bank quantities. Pills use 1, 5, 10, 50, 100, 500, and all. Batch buttons also pass 1000. */
export type QtyMode = number | 'all';

export interface ItemStack {
  id: string;
  qty: number;
}

export interface SkillProgress {
  xp: number;
  lvl: number;
}

export interface SlayerTask {
  monster: string;
  name: string;
  remaining: number;
  total: number;
}

export interface QuestFlags {
  burnedLog: boolean;
  openedBank: boolean;
  killedGoblin: boolean;
  killedArcane: boolean;
  minedMetal: boolean;
  killedScorpion: boolean;
  smeltedBar: boolean;
  choppedAncient: boolean;
  killedMoss: boolean;
  killedElvarg: boolean;
  claimed: string[];
  slayer: SlayerTask | null;
  slayerTasksCompleted: number;
  slayerStreak: number;
  dragonfireWard: boolean;
  title: string;
}

export interface GameState {
  gp: number;
  xpMultiplier: number;
  combatStyle: string;
  activeSpell: string;
  specArmed: boolean;
  specEnergy: number;
  hp: number;
  maxHp: number;
  prayerPts: number;
  maxPrayerPts: number;
  activePrayers: Set<string>;
  currentRegion: string;
  timeOfDay: number;
  shopFilter: string;
  bankFilter: string;
  bankQuery: string;
  audioEnabled: boolean;
  transferQty: QtyMode;
  skills: Record<string, SkillProgress>;
  equipment: Record<string, string | null>;
  inventory: ItemStack[];
  bank: ItemStack[];
  shrines: Record<string, boolean>;
  quests: QuestFlags;
}

export interface SavedPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface SavedCam {
  yaw: number;
  manualOffset: number;
  pitch: number;
  distance: number;
}
