import { BOSSES } from '../data/attacks';
import { FORGE_RECIPES } from '../data/recipeTable';
import { MONSTER_TYPES, RESOURCE_NODES_DEF } from '../data/world';
import { CAMPS } from '../data/worldMap';
import type { Progress } from './types';

const MAX_STAT = 2147483647;

const statKeysSet = new Set<string>();
for (const k of Object.keys(MONSTER_TYPES)) statKeysSet.add(`kill:${k}`);
for (const n of Object.values(RESOURCE_NODES_DEF)) statKeysSet.add(`gather:${(n as { item: string }).item}`);
for (const r of FORGE_RECIPES) statKeysSet.add(`craft:${r.id}`);
statKeysSet.add('bury');
statKeysSet.add('vows');
statKeysSet.add('deaths');

export const STAT_KEYS: readonly string[] = Object.freeze(Array.from(statKeysSet));
const STAT_SET = new Set(STAT_KEYS);

// Q2 (STORY_QUESTS), Y2 (diary table) and Z2 (DUNGEONS) add these tables; until then the reader knows no ids in these families.
const STORY_QUEST_STAGES: Record<string, number> = {};
const KNOWN_DIARY_TIERS = new Set<string>();
const KNOWN_DUNGEONS: readonly string[] = [];

export function bump(state: { progress?: Progress }, key: string, n = 1): void {
  if (!STAT_SET.has(key)) {
    throw new Error(`Unknown stat key: ${key}`);
  }
  if (!state.progress) {
    state.progress = {};
  }
  if (!state.progress.stats) {
    state.progress.stats = {};
  }
  const current = state.progress.stats[key] ?? 0;
  state.progress.stats[key] = Math.min(MAX_STAT, current + n);
}

export function stat(state: { progress?: Progress }, key: string): number {
  return state.progress?.stats?.[key] ?? 0;
}

export function noteBossDown(state: { progress?: Progress }, typeKey: string, now: number): void {
  const boss = BOSSES[typeKey];
  if (!boss) return;
  const hasCamp = CAMPS.some((c) => c.members.some((m) => m.type === typeKey));
  if (!hasCamp) return;
  if (!state.progress) {
    state.progress = {};
  }
  if (!state.progress.bossDownUntil) {
    state.progress.bossDownUntil = {};
  }
  state.progress.bossDownUntil[typeKey] = now + boss.respawnSecs * 1000;
}

export function bossBackIn(state: { progress?: Progress }, typeKey: string, now: number): number {
  const until = state.progress?.bossDownUntil?.[typeKey];
  if (until === undefined || until <= now) return 0;
  return (until - now) / 1000;
}

export function clearBossDown(state: { progress?: Progress }, typeKey: string): void {
  if (state.progress?.bossDownUntil) {
    delete state.progress.bossDownUntil[typeKey];
  }
}

export function isEmptyProgress(progress?: Progress): boolean {
  if (!progress) return true;
  if (progress.story && Object.keys(progress.story).length > 0) return false;
  if (progress.stats && Object.keys(progress.stats).length > 0) return false;
  if (progress.diary && progress.diary.length > 0) return false;
  if (progress.dungeons && Object.keys(progress.dungeons).length > 0) return false;
  if (progress.bossDownUntil && Object.keys(progress.bossDownUntil).length > 0) return false;
  return true;
}

export function normalizeProgress(raw: unknown, now: number, claimed: readonly string[]): Progress | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const data = raw as Record<string, unknown>;
  const result: Progress = {};

  if (data.story && typeof data.story === 'object' && !Array.isArray(data.story)) {
    const rawStory = data.story as Record<string, unknown>;
    const story: Record<string, number> = {};
    for (const [id, stageCount] of Object.entries(STORY_QUEST_STAGES)) {
      if (!claimed.includes(id) && Object.hasOwn(rawStory, id)) {
        const val = rawStory[id];
        if (typeof val === 'number' && Number.isInteger(val) && val >= 0 && val < stageCount) {
          story[id] = val;
        }
      }
    }
    if (Object.keys(story).length > 0) {
      result.story = story;
    }
  }

  if (data.stats && typeof data.stats === 'object' && !Array.isArray(data.stats)) {
    const rawStats = data.stats as Record<string, unknown>;
    const stats: Record<string, number> = {};
    for (const key of STAT_KEYS) {
      if (Object.hasOwn(rawStats, key)) {
        const val = rawStats[key];
        if (typeof val === 'number' && Number.isFinite(val)) {
          const floored = Math.floor(val);
          const clamped = Math.max(0, Math.min(MAX_STAT, floored));
          if (clamped > 0) {
            stats[key] = clamped;
          }
        }
      }
    }
    if (Object.keys(stats).length > 0) {
      result.stats = stats;
    }
  }

  if (Array.isArray(data.diary) && data.diary.length <= 64) {
    const seen = new Set<string>();
    for (const item of data.diary) {
      if (typeof item === 'string' && KNOWN_DIARY_TIERS.has(item)) {
        seen.add(item);
      }
    }
    if (seen.size > 0) {
      result.diary = Array.from(seen);
    }
  }

  if (data.dungeons && typeof data.dungeons === 'object' && !Array.isArray(data.dungeons)) {
    const rawDungeons = data.dungeons as Record<string, unknown>;
    const dungeons: Record<string, { clears: number; best: number }> = {};
    for (const id of KNOWN_DUNGEONS) {
      if (Object.hasOwn(rawDungeons, id)) {
        const entry = rawDungeons[id];
        if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
          const rec = entry as Record<string, unknown>;
          if (
            typeof rec.clears === 'number' &&
            Number.isFinite(rec.clears) &&
            typeof rec.best === 'number' &&
            Number.isFinite(rec.best)
          ) {
            const clears = Math.floor(rec.clears);
            const best = Math.floor(rec.best);
            dungeons[id] = {
              clears: Math.max(0, Math.min(MAX_STAT, clears)),
              best: Math.max(0, Math.min(MAX_STAT, best))
            };
          }
        }
      }
    }
    if (Object.keys(dungeons).length > 0) {
      result.dungeons = dungeons;
    }
  }

  if (data.bossDownUntil && typeof data.bossDownUntil === 'object' && !Array.isArray(data.bossDownUntil)) {
    const rawBoss = data.bossDownUntil as Record<string, unknown>;
    const bossDownUntil: Record<string, number> = {};
    for (const typeKey of Object.keys(BOSSES)) {
      const hasCamp = CAMPS.some((c) => c.members.some((m) => m.type === typeKey));
      if (!hasCamp) continue;
      if (Object.hasOwn(rawBoss, typeKey)) {
        const val = rawBoss[typeKey];
        if (typeof val === 'number' && Number.isFinite(val)) {
          const epochMs = Math.floor(val);
          if (epochMs > now) {
            const respawnSecs = BOSSES[typeKey].respawnSecs;
            const maxTime = now + respawnSecs * 1000;
            bossDownUntil[typeKey] = Math.min(epochMs, maxTime);
          }
        }
      }
    }
    if (Object.keys(bossDownUntil).length > 0) {
      result.bossDownUntil = bossDownUntil;
    }
  }

  return isEmptyProgress(result) ? undefined : result;
}
