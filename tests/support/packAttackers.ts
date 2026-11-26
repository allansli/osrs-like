// The pacing model's count of camp members that attack at once (design 7.13, plan G1), from
// docs/superpowers/research/content-model/aggro.ts. A convention of Stage 3's pacing model, not a game rule,
// so it lives beside the model and not in src/. The game's rule is `sightRadius`; this only reads it.
// The whole pack at or below the monster's level; scaled by how much of the sight radius is left above
// SIGHT_MIN, rounded up; one attacker from SIGHT_GAP levels above. A pack of 0 or 1 is one attacker.
import type { MonsterDef } from '../../src/data/world';
import { SIGHT_MIN, sightRadius } from '../../src/state/monsterAi';

export function packAttackers(pack: number, monster: Pick<MonsterDef, 'level' | 'style'>, heroCombat: number): number {
  if (pack <= 1) return 1;
  const base = monster.style === 'magic' || monster.style === 'ranged' ? 12 : 9;
  const left = (sightRadius(base, monster.level, heroCombat, false) - SIGHT_MIN) / (base - SIGHT_MIN);
  return 1 + Math.ceil((pack - 1) * left - 1e-9);
}
