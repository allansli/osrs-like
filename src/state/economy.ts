import { MONSTER_TYPES } from '../data/world';

export type DropResult =
  | { kind: 'gp'; amount: number }
  | { kind: 'item'; id: string; qty: number };

export const HP_REGEN_PER_SEC = 0.25;

export function rollDrops(typeKey: string, rand: () => number = Math.random): DropResult[] {
  const def = MONSTER_TYPES[typeKey];
  if (!def || !def.drops) return [];
  const results: DropResult[] = [];
  for (const d of def.drops) {
    if (rand() <= d.chance) {
      if (d.gp) {
        const coinDraw = rand();
        const amount = d.gp[0] + Math.floor(coinDraw * (d.gp[1] - d.gp[0] + 1));
        results.push({ kind: 'gp', amount });
      } else if (d.id) {
        const qty = (d as { qty?: number }).qty || 1;
        results.push({ kind: 'item', id: d.id, qty });
      }
    }
  }
  return results;
}

export function gatherChance(level: number, req: number): number {
  return Math.min(0.92, 0.50 + (level - req) * 0.02);
}
