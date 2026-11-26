import { SKILL_KEYS } from '../data/skills';
import { LEGACY_SAVE_KEYS, migrateLegacySave, type StorageLike } from './save';

const CORRUPT_1 = 'gielinor_hero_save_v1_corrupt';
const CORRUPT_2 = 'gielinor_hero_save_v1_corrupt_2';
const CORRUPT_3 = 'gielinor_hero_save_v1_corrupt_3';
const LIMIT_BYTES = 256 * 1024;

export interface KeepResult {
  kept: boolean;
}

export interface LegacyPreview {
  key: string;
  gp: number;
  totalLevel: number;
}

export function keepCorrupt(storage: StorageLike, raw: string): KeepResult {
  if (storage.getItem(CORRUPT_1) === raw) {
    return { kept: true };
  }
  if (raw.length > LIMIT_BYTES) {
    return { kept: false };
  }

  const c2 = storage.getItem(CORRUPT_2);
  if (c2 !== null) {
    try {
      storage.setItem(CORRUPT_3, c2);
    } catch {
      // ignore older-copy write failure
    }
  }

  const c1 = storage.getItem(CORRUPT_1);
  if (c1 !== null) {
    try {
      storage.setItem(CORRUPT_2, c1);
    } catch {
      // ignore older-copy write failure
    }
  }

  try {
    storage.setItem(CORRUPT_1, raw);
    return { kept: true };
  } catch {
    try {
      storage.removeItem(CORRUPT_2);
    } catch {
      // ignore
    }
    try {
      storage.removeItem(CORRUPT_3);
    } catch {
      // ignore
    }
    try {
      storage.setItem(CORRUPT_1, raw);
      return { kept: true };
    } catch {
      return { kept: false };
    }
  }
}

export function recoveryExit(choice: 'new' | 'older' | 'copy' | string, keepResult: KeepResult): boolean {
  if (choice === 'copy') {
    return false;
  }
  return keepResult.kept === true;
}

export function shouldAutosave(hold: boolean): boolean {
  return !hold;
}

export function legacyPreview(storage: StorageLike): LegacyPreview | null {
  for (const key of LEGACY_SAVE_KEYS) {
    const raw = storage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') continue;
      const migrated = migrateLegacySave(parsed, key, 0);
      const totalLevel = SKILL_KEYS.reduce((n, k) => n + migrated.state.skills[k].lvl, 0);
      return {
        key,
        gp: migrated.state.gp,
        totalLevel
      };
    } catch {
      continue;
    }
  }
  return null;
}
