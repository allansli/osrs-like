// Prints the positional boss fight (fight.ts) for the design's proof rows. Run with run.sh.
// History: written by the Stage 4 critique against the first draft (the existing dragon at 1,200 hitpoints).
// The owner's decisions of 2026-11-14 made the phased fight a separate, new boss and made hitpoints regenerate
// during fights, so this now prints (1) the first draft's fight as a baseline, without and with regeneration,
// (2) the new boss as tuned, (3) the variants behind three decisions.
import { FIGHTERS, REGEN_IN_COMBAT, table } from './fight';
import { BOSS, BOSS_ROW, FIRST_DRAFT } from './boss';

const p = (...a: unknown[]) => console.log(...a);
const all = Object.keys(FIGHTERS);
const melee = ['A', 'B', 'C', 'D', 'F', 'G'];

p('2000 seeded fights per row; positions, the click back onto the boss and the walk back are modelled.');
p('Ranged and magic heroes stand 11 from the boss (its own reach) and attack from anywhere within 13.5.');
p('The level-50 rows have no ward, no protection prayer and 10 lobsters. "Never moves" ignores every shape.');

p('\n== 1. Baseline: the first draft\'s fight (existing dragon, 1,200 HP), no regeneration in the fight');
p('   (the critique\'s committed rows were A 99.5, B 0.1, C 98.0, D 96.8, F 41.5, G 0.0; this run steps out of a');
p('   cone across its edge, not across its axis, which moves them slightly)');
p(table(FIRST_DRAFT, melee, { regen: 0 }).join('\n'));
p(`\n== 2. The same fight with hitpoints regenerating at ${REGEN_IN_COMBAT} HP/s during it, and with ranged and magic heroes`);
p(table(FIRST_DRAFT, all).join('\n'));

p(`\n== 3. The new boss: ${BOSS_ROW.name}, ${BOSS.hp} HP, basic max hit ${BOSS_ROW.maxHit} (magic), attack ${BOSS_ROW.atk}, defence ${BOSS_ROW.def}; mark step ${BOSS.markStep}`);
for (const ph of BOSS.phases) p(`   ${ph.name.padEnd(16)} until ${(ph.untilHpFrac * 100).toFixed(0).padStart(2)}%  cadence x${ph.cadenceMult}  ${ph.pattern.join(', ')}`);
for (const a of Object.values(BOSS.attacks)) p(`   ${a.id.padEnd(11)} ${JSON.stringify(a.shape).padEnd(52)} wind-up ${a.windupMs} ms, power ${a.power}, ${a.style}`);
p(`   regeneration ${REGEN_IN_COMBAT} HP/s throughout; food cooldown 1.8 s`);
p('   thresholds: prepared heroes who move win at least 85% (the +300 ms melee row at least 65%); heroes who never move');
p('   win at most 5%; unprepared level-50 heroes win at most 15%');
p(table(BOSS, all).join('\n'));

p('\n== 4. The new boss without regeneration in the fight (what constant regeneration is worth)');
p(table(BOSS, ['A', 'C', 'D', 'F', 'R', 'M', 'FR', 'FM'], { regen: 0 }).join('\n'));

p('\n== 5. The new boss with no food cooldown (food eaten the moment it is needed, as today): does standing still win?');
p(table(BOSS, ['B', 'Rstill', 'Mstill', 'G', 'F', 'FR', 'FM'], { eatCd: 0 }).join('\n'));

p('\n== 6. The new boss with any single heavy blow capped at 45% of maximum hitpoints (CALL-4.14)');
p(table(BOSS, ['A', 'B', 'C', 'Rstill', 'Mstill'], { capFrac: 0.45 }).join('\n'));

p('\n== 7. The new boss with the existing dragon\'s basic max hit (32) instead of 72: why the bolt is the preparation check');
{
  const kept = BOSS_ROW.maxHit;
  BOSS_ROW.maxHit = 32;
  p(table(BOSS, ['A', 'F', 'FR', 'FM']).join('\n'));
  BOSS_ROW.maxHit = kept;
}
