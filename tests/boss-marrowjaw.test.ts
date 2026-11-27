import { describe, expect, it } from 'vitest';
import { FIGHTERS as STAGE4_FIGHTERS, runRow as stage4Row } from './support/bossModel';
import { profile, runRow, type Fighter } from './support/bossFightModel';

// Design 7.7 and plan B1: Marrowjaw the Tollmaster's six rows through Stage 4's positional fight, 500 seeds each.
// The fighters are the content model's (check.ts) and are fixed; a bound that misses moves the boss's hitpoints, basic
// max hit or attack powers, never a bound and never a fighter. B1 plays bronze: no arrow term, today's or S2's formula.
const SEEDS = 500;
const BOSS = 'marrowjaw';

const addy = { weapon: 'addy_scimitar', body: 'addy_plate', legs: 'addy_legs' };
const mith = { weapon: 'mith_scimitar', body: 'mith_plate', legs: 'mith_legs' };
const hide35 = { weapon: 'yew_bow', body: 'blue_dhide_body', legs: 'blue_dhide_chaps' };
const robe35 = { weapon: 'mystic_staff', body: 'mystic_top', legs: 'mystic_bottom' };
const base = { ward: false, moves: true, extraMs: 0, pots: 0, food: 10, heal: 16 };
const melee35 = () => profile('melee', 35, 38, 20, addy, []);

const ROWS: Array<{ label: string; f: Fighter; min?: number; max?: number }> = [
  { label: 'melee 35, adamant, 10 lobsters, moves', f: { ...base, style: 'melee', make: melee35 }, min: 0.85 },
  { label: 'the same, +300 ms (trackpad)', f: { ...base, style: 'melee', make: melee35, extraMs: 300 }, min: 0.7 },
  { label: 'the same, never moves', f: { ...base, style: 'melee', make: melee35, moves: false }, max: 0.25 },
  { label: 'melee 22, mithril, 8 trout, moves', f: { ...base, style: 'melee', make: () => profile('melee', 22, 26, 10, mith, []), food: 8, heal: 9 }, max: 0.35 },
  { label: 'ranged 35, yew bow, blue hides, moves', f: { ...base, style: 'ranged', make: () => profile('ranged', 35, 38, 20, hide35, []) }, min: 0.85 },
  { label: 'magic 35, mystic, ice burst, moves', f: { ...base, style: 'magic', make: () => profile('magic', 35, 38, 20, robe35, [], 'ice_burst') }, min: 0.85 }
];

describe('the parameterised fight model (baseline 6.2)', () => {
  it("plays Ashmantle exactly as Stage 4's shipped model does, seed for seed", () => {
    for (const [key, f] of Object.entries(STAGE4_FIGHTERS)) {
      expect(runRow(f, 'ashmantle', SEEDS), key).toEqual(stage4Row(key, SEEDS));
    }
  }, 60_000);
});

describe('the Marrowjaw fight, simulated with positions (design 7.7, G6.7)', () => {
  it(`every row holds over ${SEEDS} seeds`, () => {
    const lines = ['fighter                                  win%   bound      mean s (wins)  heavies dodged'];
    const misses: string[] = [];
    for (const row of ROWS) {
      const res = runRow(row.f, BOSS, SEEDS);
      const bound = row.min !== undefined ? `>= ${row.min * 100}%` : `<= ${row.max! * 100}%`;
      lines.push(`${row.label.padEnd(40)} ${(res.win * 100).toFixed(1).padStart(5)}   ${bound.padEnd(9)}  ${res.meanWinSecs.toFixed(0).padStart(13)}  ${(res.dodged * 100).toFixed(0).padStart(13)}%`);
      if ((row.min !== undefined && res.win < row.min) || (row.max !== undefined && res.win > row.max)) misses.push(`${row.label}: ${(res.win * 100).toFixed(1)}% (${bound})`);
    }
    console.log(lines.join('\n'));
    expect(misses).toEqual([]);
  }, 60_000);
});
