// The aggression rule of design 7.13 (owner, 2026-11-14: aggressive and passive monsters), as the pure function the game
// will get in src/state/monsterAi.ts (plan task G2). No clock, no random source, no table: every input is a parameter.
// Used by aggro-check.ts (the function's own checks and the Stage 2 gate) and by the pacing rerun (pacing-rerun.sh).

/** The smallest sight radius: about a melee strike (2.9). A hero far above a monster must walk into it to be attacked. */
export const SIGHT_MIN = 3;
/** Combat levels above the monster at which its sight reaches the minimum. */
export const SIGHT_GAP = 10;

/**
 * How far an idle member of an AGGRESSIVE camp sees the hero.
 * `base` is the camp's aggroRadius (9 for melee, 12 for ranged and magic). At or below the monster's level the radius is
 * `base`; it falls in a straight line to SIGHT_MIN at SIGHT_GAP levels above, and stays there.
 * `keepsSight` is data on the camp: the pass sentries, boss camps and every dungeon camp never shrink.
 * A passive camp never calls this: it never starts a fight.
 */
export function sightRadius(base: number, monsterLevel: number, heroCombat: number, keepsSight: boolean, gap = SIGHT_GAP): number {
  const floor = Math.min(base, SIGHT_MIN);
  if (keepsSight) return base;
  const over = heroCombat - monsterLevel;
  if (over <= 0) return base;
  if (over >= gap) return floor;
  return base - (base - floor) * (over / gap);
}

/** Camps whose members keep their full sight at any hero level (design 7.13). Dungeon camps get the flag from zoneCamps. */
export const KEEPS_SIGHT = ['pass_sentries', 'ashmantle', 'tollmaster'];

/**
 * The pacing model's count of camp members that attack at once (Stage 3's tests/support/pacingModel.ts, `attackers`).
 * Stage 2's rule gave the whole pack when the hero was not above the monster's level and one attacker otherwise.
 * Now the pack applies at every level, scaled by how much of the sight radius is left and rounded up (an upper estimate:
 * it ignores that a hero can stand at the camp's edge). Equal to the old count at or below the monster's level, and to 1
 * from SIGHT_GAP levels above.
 */
export function packAttackers(pack: number, monsterLevel: number, monsterStyle: string, heroCombat: number, gap = SIGHT_GAP): number {
  if (pack <= 1) return 1;
  const base = monsterStyle === 'magic' || monsterStyle === 'ranged' ? 12 : 9;
  const left = (sightRadius(base, monsterLevel, heroCombat, false, gap) - SIGHT_MIN) / (base - SIGHT_MIN);
  return 1 + Math.ceil((pack - 1) * left - 1e-9);
}
