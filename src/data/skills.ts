import { SKILLS_META } from './catalog';

export { SKILLS_META };

/** Official Old School RuneScape experience thresholds for levels 1–99. */
export const OSRS_XP_TABLE: number[] = (() => {
  const table = [0, 0];
  let pts = 0;
  for (let lvl = 1; lvl < 99; lvl++) {
    pts += Math.floor(lvl + 300 * Math.pow(2, lvl / 7));
    table[lvl + 1] = Math.floor(pts / 4);
  }
  return table;
})();

export function getLevelForXp(xp: number): number {
  const safe = Math.max(0, xp || 0);
  for (let lvl = 99; lvl >= 1; lvl--) {
    if (safe >= OSRS_XP_TABLE[lvl]) return lvl;
  }
  return 1;
}

export const SKILL_KEYS = Object.keys(SKILLS_META);
