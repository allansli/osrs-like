import { ITEMS } from '../data/items';
import { PRAYERS, SPELLS } from '../data/magic';
import { getLevelForXp, SKILL_KEYS } from '../data/skills';
import { WORLD_REGIONS } from '../data/world';
import { createDefaultState } from './gameState';
import { compactSlots } from './inventory';
import { normalizeStyle } from './combat';
import { normalizeQuests } from './quests';
import { initialShrines } from './shrines';
import { QUEST_DEFS, SLAYER_BANDS } from './adventure';
import { isWalkable } from './collision';
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

  if (typeof data.gp === 'number' && Number.isFinite(data.gp)) state.gp = Math.max(0, Math.min(2147483647, Math.floor(data.gp)));
  if (typeof data.xpMultiplier === 'number') state.xpMultiplier = data.xpMultiplier === 1 ? 1 : 10;
  if (typeof data.combatStyle === 'string') state.combatStyle = normalizeStyle(data.combatStyle);
  if (typeof data.activeSpell === 'string' && SPELLS.some((s) => s.id === data.activeSpell && s.type === 'combat')) {
    state.activeSpell = data.activeSpell;
  } else {
    state.activeSpell = 'wind_strike';
  }
  if (typeof data.specArmed === 'boolean') state.specArmed = data.specArmed;
  if (typeof data.specEnergy === 'number' && Number.isFinite(data.specEnergy)) state.specEnergy = Math.max(0, Math.min(100, data.specEnergy));
  if (typeof data.currentRegion === 'string' && WORLD_REGIONS.some((r) => r.id === data.currentRegion)) {
    state.currentRegion = data.currentRegion;
  }
  if (typeof data.timeOfDay === 'number' && Number.isInteger(data.timeOfDay) && data.timeOfDay >= 0 && data.timeOfDay <= 2) {
    state.timeOfDay = data.timeOfDay;
  } else {
    state.timeOfDay = 0;
  }
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
      else if (typeof value === 'string' && Object.hasOwn(ITEMS, value)) state.equipment[key] = value;
    }
  }
  if (source && source.startsWith('runewilds')) {
    if (state.equipment.cape === null) state.equipment.cape = 'hylian_cape';
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
  const validQuestIds = new Set(QUEST_DEFS.map((q) => q.id));
  state.quests.claimed = Array.from(new Set(state.quests.claimed.filter((id) => validQuestIds.has(id))));
  if (state.quests.slayer) {
    const band = SLAYER_BANDS.find((b) => b.monster === state.quests.slayer?.monster);
    if (band) {
      state.quests.slayer.name = band.name;
    } else {
      state.quests.slayer = null;
    }
  }

  state.maxHp = state.skills.hitpoints.lvl;
  state.hp = typeof data.hp === 'number' && Number.isFinite(data.hp) ? Math.max(1, Math.min(state.maxHp, data.hp)) : state.maxHp;
  state.maxPrayerPts = state.skills.prayer.lvl;
  state.prayerPts = typeof data.prayerPts === 'number' && Number.isFinite(data.prayerPts)
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
    pose = sanitizePose({
      x: data.playerPos.x,
      y: num(data.playerPos.y, 0),
      z: data.playerPos.z,
      yaw: num(data.playerPos.yaw, 0)
    });
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

export function sanitizePose(p: SavedPose): SavedPose {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) {
    return { x: 0, y: num(p.y, 0), z: 4, yaw: p.yaw };
  }
  const cx = Math.max(-118, Math.min(118, p.x));
  const cz = Math.max(-118, Math.min(118, p.z));
  if (isWalkable(cx, cz)) {
    return { x: cx, y: num(p.y, 0), z: cz, yaw: p.yaw };
  }
  for (let step = 1; step <= 24; step++) {
    const r = step * 0.5;
    for (let i = 0; i < 24; i++) {
      const angle = (i * 2 * Math.PI) / 24;
      const nx = cx + r * Math.cos(angle);
      const nz = cz + r * Math.sin(angle);
      if (isWalkable(nx, nz)) {
        return { x: nx, y: num(p.y, 0), z: nz, yaw: p.yaw };
      }
    }
  }
  return { x: 0, y: num(p.y, 0), z: 4, yaw: p.yaw };
}

export function sanitizeCam(c: SavedCam): SavedCam {
  return {
    yaw: c.yaw,
    manualOffset: c.manualOffset,
    pitch: Math.min(c.pitch, 0.42),
    distance: Math.min(c.distance, 9.5)
  };
}

