// Stage 6 bosses, and Stage 4's Ashmantle, through Stage 4's positional fight (fight.ts, copied; see its header).
// 2,000 seeded fights per row, each row TWICE: with today's attack formula and with the style rebalance of design 7.12
// (STYLE_AFTER), the latter with bronze arrows and, for a ranged fighter, with the arrow or bolt grade of its level
// (AMMO_TIERS). Every bound must hold in every column, so the fight tests do not depend on where the rebalance slice lands
// nor on which arrow their ranged fighter is given.
// Tuning rule, as in Stage 4: the fighters are fixed, only the boss rows in content.ts move.
import { MONSTER_TYPES } from '../../../../src/data/world';
import { combatLevel } from '../../../../src/state/adventure';
import { fight, profile, FIGHTERS, LABELS, STYLE, type Fighter } from './fight';
import { BOSS, BOSS_ROW } from './boss';
import { AMMO, AMMO_TIERS, BOSSES, NEW_MONSTERS, STYLE_AFTER, STYLE_TODAY } from './content';

for (const [k, m] of Object.entries(NEW_MONSTERS)) {
  (MONSTER_TYPES as Record<string, unknown>)[k] = { name: m.name, level: m.level, hp: m.hp, maxHit: m.maxHit, atk: m.atk, def: m.def, scale: 1, style: m.style, bodyColor: 0, accentColor: 0, kind: 'x', drops: [] };
}

const addy = { weapon: 'addy_scimitar', body: 'addy_plate', legs: 'addy_legs' };
const mith = { weapon: 'mith_scimitar', body: 'mith_plate', legs: 'mith_legs' };
const rune = { weapon: 'rune_scimitar', body: 'rune_plate', legs: 'rune_legs', shield: 'rune_shield' };
const dragon = { weapon: 'dragon_scimitar', body: 'dragon_chain', legs: 'dragon_legs', shield: 'dragon_defender' };
const hide35 = { weapon: 'yew_bow', body: 'blue_dhide_body', legs: 'blue_dhide_chaps' };
const hide50 = { weapon: 'magic_bow', body: 'red_dhide_body', legs: 'red_dhide_chaps' };
const hide70 = { weapon: 'armadyl_crossbow', body: 'black_dhide_body', legs: 'black_dhide_chaps' };
const robe35 = { weapon: 'mystic_staff', body: 'mystic_top', legs: 'mystic_bottom' };
const robe50 = { weapon: 'ancient_staff', body: 'infinity_top', legs: 'infinity_bottom' };
const robe70 = { weapon: 'ancient_staff', body: 'bloodbark_top', legs: 'bloodbark_bottom' };
const base = { ward: false, moves: true, extraMs: 0, pots: 0 };
type Row = [string, Fighter, string];

const ROWS: Record<string, Row[]> = {
  marrowjaw: [
    ['melee 35, adamant, 10 lobsters, moves', { ...base, style: 'melee', make: () => profile('melee', 35, 38, 20, addy, []), food: 10, heal: 16 }, '>= 85'],
    ['the same, +300 ms (trackpad)', { ...base, style: 'melee', make: () => profile('melee', 35, 38, 20, addy, []), food: 10, heal: 16, extraMs: 300 }, '>= 70'],
    ['the same, never moves', { ...base, style: 'melee', make: () => profile('melee', 35, 38, 20, addy, []), food: 10, heal: 16, moves: false }, '<= 25'],
    ['melee 22, mithril, 8 trout, moves', { ...base, style: 'melee', make: () => profile('melee', 22, 26, 10, mith, []), food: 8, heal: 9 }, '<= 35'],
    ['ranged 35, yew bow, blue hides, moves', { ...base, style: 'ranged', make: () => profile('ranged', 35, 38, 20, hide35, []), food: 10, heal: 16 }, '>= 85'],
    ['magic 35, mystic, ice burst, moves', { ...base, style: 'magic', make: () => profile('magic', 35, 38, 20, robe35, [], 'ice_burst'), food: 10, heal: 16 }, '>= 85']
  ],
  saltfang: [
    ['melee 50, rune, Protect from Melee, 16 swordfish, 2 potions', { ...base, style: 'melee', make: () => profile('melee', 50, 50, 43, rune, ['prot_melee']), food: 16, heal: 20, pots: 2, prayer: 'prot_melee' }, '>= 85'],
    ['the same, +300 ms', { ...base, style: 'melee', make: () => profile('melee', 50, 50, 43, rune, ['prot_melee']), food: 16, heal: 20, pots: 2, prayer: 'prot_melee', extraMs: 300 }, '>= 65'],
    ['the same, never moves', { ...base, style: 'melee', make: () => profile('melee', 50, 50, 43, rune, ['prot_melee']), food: 16, heal: 20, pots: 2, prayer: 'prot_melee', moves: false }, '<= 5'],
    ['the same, no food', { ...base, style: 'melee', make: () => profile('melee', 50, 50, 43, rune, ['prot_melee']), food: 0, heal: 20, pots: 2, prayer: 'prot_melee' }, 'information'],
    ['melee 38, adamant, no prayer, 10 lobsters', { ...base, style: 'melee', make: () => profile('melee', 38, 40, 20, addy, []), food: 10, heal: 16 }, '<= 15'],
    ['at the door: melee 41, rune, Protect from Melee, 12 lobsters, 1 potion', { ...base, style: 'melee', make: () => profile('melee', 41, 42, 31, rune, ['prot_melee']), food: 12, heal: 16, pots: 1, prayer: 'prot_melee' }, 'information'],
    ['ranged 50, magic bow, red hides, Protect from Melee, 16 swordfish', { ...base, style: 'ranged', make: () => profile('ranged', 50, 50, 43, hide50, ['prot_melee']), food: 16, heal: 20, pots: 2, prayer: 'prot_melee' }, '>= 85'],
    ['magic 50, infinity, blood barrage, Protect from Melee', { ...base, style: 'magic', make: () => profile('magic', 50, 50, 43, robe50, ['prot_melee']), food: 16, heal: 20, pots: 2, prayer: 'prot_melee' }, '>= 85']
  ],
  kiln_warden: [
    ['melee 70, dragon, Protect from Melee, 20 sharks, 4 potions', { ...base, style: 'melee', make: () => profile('melee', 70, 70, 45, dragon, ['prot_melee']), food: 20, heal: 24, pots: 4, prayer: 'prot_melee' }, '>= 85'],
    ['the same, +300 ms', { ...base, style: 'melee', make: () => profile('melee', 70, 70, 45, dragon, ['prot_melee']), food: 20, heal: 24, pots: 4, prayer: 'prot_melee', extraMs: 300 }, '>= 65'],
    ['the same, never moves', { ...base, style: 'melee', make: () => profile('melee', 70, 70, 45, dragon, ['prot_melee']), food: 20, heal: 24, pots: 4, prayer: 'prot_melee', moves: false }, '<= 5'],
    ['the same, no prayer', { ...base, style: 'melee', make: () => profile('melee', 70, 70, 45, dragon, []), food: 20, heal: 24 }, 'information'],
    ['melee 55, rune, no prayer, 12 lobsters', { ...base, style: 'melee', make: () => profile('melee', 55, 55, 20, rune, []), food: 12, heal: 16 }, '<= 15'],
    ['at the door: melee 58, rune, Protect from Melee, 16 sharks, 2 potions', { ...base, style: 'melee', make: () => profile('melee', 58, 59, 43, rune, ['prot_melee']), food: 16, heal: 24, pots: 2, prayer: 'prot_melee' }, 'information'],
    ['ranged 70, crossbow, black hides, Protect from Melee', { ...base, style: 'ranged', make: () => profile('ranged', 70, 70, 45, hide70, ['prot_melee']), food: 20, heal: 24, pots: 4, prayer: 'prot_melee' }, '>= 85'],
    ['the same, never moves', { ...base, style: 'ranged', make: () => profile('ranged', 70, 70, 45, hide70, ['prot_melee']), food: 20, heal: 24, pots: 4, prayer: 'prot_melee', moves: false }, '<= 5'],
    ['magic 70, robes, blood barrage, Protect from Melee', { ...base, style: 'magic', make: () => profile('magic', 70, 70, 45, robe70, ['prot_melee']), food: 20, heal: 24, pots: 4, prayer: 'prot_melee' }, '>= 85'],
    ['the same, never moves', { ...base, style: 'magic', make: () => profile('magic', 70, 70, 45, robe70, ['prot_melee']), food: 20, heal: 24, pots: 4, prayer: 'prot_melee', moves: false }, '<= 5']
  ]
};

/** Stage 4's own proof rows for Ashmantle (its design 6.4), with its thresholds: the approved boss row is not touched. */
const S4_BOUNDS: Record<string, string> = { A: '>= 85', B: '<= 5', C: '>= 65', F: '<= 15', G: '<= 5', R: '>= 85', Rstill: '<= 5', M: '>= 85', Mstill: '<= 5', FR: '<= 15', FM: '<= 15' };
const S4_ROWS: Row[] = ['A', 'B', 'C', 'C2', 'D', 'E', 'F', 'G', 'R', 'Rslow', 'Rstill', 'M', 'Mslow', 'Mstill', 'FR', 'FM'].map((k) => [LABELS[k], FIGHTERS[k], S4_BOUNDS[k] || 'information']);

/** Max-hit points of the arrow or bolt the model gives a ranged fighter after the rebalance: the grade of its Ranged level. */
function ammoOf(f: Fighter): number {
  if (f.style !== 'ranged') return 0;
  const s = f.make(), lvl = s.skills.ranged.lvl, tier = [...AMMO_TIERS].reverse().find((t) => t.fromReq <= lvl)!;
  const bolt = /crossbow/.test(String(s.equipment.weapon));
  return AMMO[bolt ? tier.bolt : tier.arrow].power;
}

const N = 2000;
let bad = 0;
const sets: [string, { typeKey: string; hp: number }, Row[], string][] = [
  ...Object.entries(ROWS).map(([key, rows]) => [`${NEW_MONSTERS[key].name} (level ${NEW_MONSTERS[key].level}, ${NEW_MONSTERS[key].hp} hitpoints, basic max hit ${NEW_MONSTERS[key].maxHit} ${NEW_MONSTERS[key].style}; ${BOSSES[key].phases.length} phases)`, BOSSES[key], rows, BOSSES[key].question] as [string, typeof BOSS, Row[], string]),
  [`${BOSS_ROW.name}, Stage 4's boss, row unchanged (level ${BOSS_ROW.level}, ${BOSS_ROW.hp} hitpoints, basic max hit ${BOSS_ROW.maxHit} ${BOSS_ROW.style})`, BOSS, S4_ROWS, "Stage 4's proof rows and thresholds (its design 6.4)."]
];
for (const [title, boss, rows, question] of sets) {
  console.log(`\n=== ${title}`);
  console.log(`    ${question}`);
  console.log('fighter                                                             combat   bound        | today: win%  mean s | rebalanced, bronze arrows: win%  mean s | rebalanced, arrow of the level: win%  mean s  arrow');
  for (const [label, f, bound] of rows) {
    const cell: string[] = [];
    // Three columns: today; the rebalance with bronze arrows (what a fight test written before the arrow grades exist plays,
    // and what it keeps playing after them: its fighter carries no better arrow); the rebalance with the arrow of the level.
    for (const mode of [0, 1, 2]) {
      const after = mode > 0;
      if (mode === 2 && f.style !== 'ranged') { cell.push('              (as the column before)'); continue; }
      Object.assign(STYLE, after ? STYLE_AFTER : STYLE_TODAY);
      const ff = { ...f, ammo: mode === 2 ? ammoOf(f) : 0 };
      let w = 0, secs = 0;
      for (let i = 1; i <= N; i++) { const o = fight(ff, boss as never, i); if (o.win) { w++; secs += o.t; } }
      const pct = (w / N) * 100, mt = /^(>=|<=) (\d+)$/.exec(bound);
      const ok = !mt || (mt[1] === '>=' ? pct >= +mt[2] : pct <= +mt[2]);
      if (!ok) bad++;
      cell.push(`${pct.toFixed(1).padStart(11)}${ok ? ' ' : '!'} ${(w ? secs / w : 0).toFixed(0).padStart(6)}` + (mode === 2 ? `   +${ff.ammo}` : ''));
    }
    console.log(`${label.padEnd(68)} ${String(combatLevel(f.make())).padStart(5)}   ${bound.padEnd(12)} |${cell[0]} |${cell[1]}              |${cell[2]}`);
  }
}
Object.assign(STYLE, STYLE_TODAY);
console.log(bad === 0 ? '\nEVERY BOUND HOLDS, WITH TODAY\'S FORMULA AND WITH THE REBALANCE' : `\n${bad} BOUND(S) MISSED`);
if (bad) process.exitCode = 1;
