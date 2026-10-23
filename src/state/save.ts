import { ITEMS } from '../data/items';
import { PRAYERS } from '../data/magic';
import { getLevelForXp, SKILL_KEYS } from '../data/skills';
import { createDefaultState } from './gameState';
import { compactSlots } from './inventory';
import { normalizeStyle } from './combat';
import { normalizeQuests } from './quests';
import { initialShrines } from './shrines';
import type { GameState, SavedCam, SavedPose } from './types';

export const SAVE_KEY = 'gielinor_hero_save_v1';
export const LEGACY_SAVE_KEYS = ['runewilds_save_v3', 'runewilds_save_v2'] as const;

export interface MigratedSave {
  state: GameState;
  pose: SavedPose | null;
  cam: SavedCam | null;
  migratedFrom: string | null;
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function migrateLegacySave(raw: unknown, source: string | null = null): MigratedSave {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const state = createDefaultState();

  if (typeof data.gp === 'number') state.gp = Math.max(0, Math.floor(data.gp));
  if (typeof data.xpMultiplier === 'number') state.xpMultiplier = data.xpMultiplier === 1 ? 1 : 10;
  if (typeof data.combatStyle === 'string') state.combatStyle = normalizeStyle(data.combatStyle);
  if (typeof data.activeSpell === 'string') state.activeSpell = data.activeSpell;
  if (typeof data.specArmed === 'boolean') state.specArmed = data.specArmed;
  if (typeof data.specEnergy === 'number') state.specEnergy = Math.max(0, Math.min(100, data.specEnergy));
  if (typeof data.currentRegion === 'string') state.currentRegion = data.currentRegion;
  if (typeof data.timeOfDay === 'number') state.timeOfDay = data.timeOfDay % 3;
  if (typeof data.audioEnabled === 'boolean') state.audioEnabled = data.audioEnabled;
  if (data.transferQty === 'all' || data.transferQty === 1 || data.transferQty === 5 || data.transferQty === 10 || data.transferQty === 50 || data.transferQty === 100 || data.transferQty === 500 || data.transferQty === 1000) {
    state.transferQty = data.transferQty;
  }

  if (data.skills && typeof data.skills === 'object') {
    for (const key of SKILL_KEYS) {
      if (!data.skills[key]) continue;
      const xp = Math.max(0, num(data.skills[key].xp, state.skills[key].xp));
      state.skills[key] = { xp, lvl: getLevelForXp(xp) };
    }
  }

  if (data.equipment && typeof data.equipment === 'object') {
    for (const key of Object.keys(state.equipment)) {
      const value = data.equipment[key];
      if (value === null) state.equipment[key] = null;
      else if (typeof value === 'string' && ITEMS[value]) state.equipment[key] = value;
    }
  }

  state.inventory = compactSlots(Array.isArray(data.inventory) ? data.inventory : state.inventory, false);
  state.bank = compactSlots(Array.isArray(data.bank) ? data.bank : [], true);

  state.shrines = { ...initialShrines() };
  if (data.shrines && typeof data.shrines === 'object') {
    for (const key of Object.keys(state.shrines)) {
      if (typeof data.shrines[key] === 'boolean') state.shrines[key] = data.shrines[key];
    }
  }
  state.shrines.lumbridge = true;

  state.quests = normalizeQuests(data.quests);

  state.maxHp = state.skills.hitpoints.lvl;
  state.hp = typeof data.hp === 'number' ? Math.max(1, Math.min(state.maxHp, data.hp)) : state.maxHp;
  state.maxPrayerPts = state.skills.prayer.lvl;
  state.prayerPts = typeof data.prayerPts === 'number'
    ? Math.max(0, Math.min(state.maxPrayerPts, data.prayerPts))
    : state.maxPrayerPts;

  state.activePrayers = new Set<string>();
  if (Array.isArray(data.activePrayers)) {
    for (const id of data.activePrayers) {
      if (PRAYERS.some((p: { id: string }) => p.id === id)) state.activePrayers.add(id);
    }
  }

  let pose: SavedPose | null = null;
  if (data.playerPos && typeof data.playerPos.x === 'number' && typeof data.playerPos.z === 'number') {
    pose = {
      x: data.playerPos.x,
      y: num(data.playerPos.y, 0),
      z: data.playerPos.z,
      yaw: num(data.playerPos.yaw, 0)
    };
  }

  let cam: SavedCam | null = null;
  if (data.cam && typeof data.cam === 'object') {
    cam = {
      yaw: num(data.cam.yaw, 0),
      manualOffset: num(data.cam.manualOffset, 0),
      pitch: Math.max(0.08, Math.min(1.25, num(data.cam.pitch, 0.24))),
      distance: Math.max(4.5, Math.min(24, num(data.cam.distance, 11)))
    };
  }

  const migratedFrom = source && source !== SAVE_KEY ? source : (data.version && data.version < 4 ? source : null);
  return { state, pose, cam, migratedFrom };
}

export function serializeState(state: GameState, pose: SavedPose | null, cam: SavedCam | null): string {
  return JSON.stringify({
    version: 4,
    game: 'Gielinor Hero',
    savedAt: Date.now(),
    gp: state.gp,
    xpMultiplier: state.xpMultiplier,
    combatStyle: state.combatStyle,
    activeSpell: state.activeSpell,
    specArmed: state.specArmed,
    specEnergy: state.specEnergy,
    hp: state.hp,
    maxHp: state.maxHp,
    prayerPts: state.prayerPts,
    maxPrayerPts: state.maxPrayerPts,
    activePrayers: Array.from(state.activePrayers),
    currentRegion: state.currentRegion,
    timeOfDay: state.timeOfDay,
    audioEnabled: state.audioEnabled,
    transferQty: state.transferQty,
    skills: state.skills,
    equipment: state.equipment,
    inventory: state.inventory,
    bank: state.bank,
    shrines: state.shrines,
    quests: state.quests,
    playerPos: pose,
    cam
  });
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function readSave(storage: StorageLike): MigratedSave | null {
  const keys = [SAVE_KEY, ...LEGACY_SAVE_KEYS];
  for (const key of keys) {
    const raw = storage.getItem(key);
    if (!raw) continue;
    try {
      return migrateLegacySave(JSON.parse(raw), key);
    } catch {
      continue;
    }
  }
  return null;
}

export function writeSave(storage: StorageLike, state: GameState, pose: SavedPose | null, cam: SavedCam | null): void {
  storage.setItem(SAVE_KEY, serializeState(state, pose, cam));
}
