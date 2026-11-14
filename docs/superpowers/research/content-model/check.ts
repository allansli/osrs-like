// Stage 6 bosses through Stage 4's positional fight (fight.ts, copied; see its header). 2,000 seeded fights per row.
// Tuning rule, as in Stage 4: the fighters are fixed, only the boss rows in content.ts move.
import { MONSTER_TYPES } from '../../../../src/data/world';
import { combatLevel } from '../../../../src/state/adventure';
import { fight, profile, type Fighter } from './fight';
import { BOSSES, NEW_MONSTERS } from './content';

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

const N = 2000;
let bad = 0;
for (const [key, rows] of Object.entries(ROWS)) {
  const boss = BOSSES[key], m = NEW_MONSTERS[key];
  console.log(`\n=== ${m.name} (level ${m.level}, ${m.hp} hitpoints, basic max hit ${m.maxHit} ${m.style}; ${boss.phases.length} phases)`);
  console.log(`    ${boss.question}`);
  console.log('fighter                                                             combat   win%   bound        mean s (wins)  heavies dodged  damage taken per fight, by source');
  for (const [label, f, bound] of rows) {
    let w = 0, secs = 0, hv = 0, dg = 0; const by: Record<string, number> = {};
    for (let i = 1; i <= N; i++) { const o = fight(f, boss, i); if (o.win) { w++; secs += o.t; } hv += o.heavies; dg += o.dodged; for (const [id, d] of Object.entries(o.by)) by[id] = (by[id] || 0) + d; }
    const pct = (w / N) * 100, mt = /^(>=|<=) (\d+)$/.exec(bound);
    const ok = !mt || (mt[1] === '>=' ? pct >= +mt[2] : pct <= +mt[2]);
    if (!ok) bad++;
    console.log(`${label.padEnd(68)} ${String(combatLevel(f.make())).padStart(5)}  ${pct.toFixed(1).padStart(5)}  ${bound.padEnd(12)} ${ok ? ' ' : '!'} ${(w ? secs / w : 0).toFixed(0).padStart(6)} ${((dg / Math.max(1, hv)) * 100).toFixed(0).padStart(14)}%   ${Object.entries(by).map(([id, d]) => `${id} ${(d / N).toFixed(0)}`).join(', ')}`);
  }
}
console.log(bad === 0 ? '\nEVERY BOUND HOLDS' : `\n${bad} BOUND(S) MISSED`);
if (bad) process.exitCode = 1;
