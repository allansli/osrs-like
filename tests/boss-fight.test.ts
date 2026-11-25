import { describe, expect, it } from 'vitest';
import { FIGHTERS, runRow } from './support/bossModel';

// Design 6.4 "The fight, simulated" and plan B3: the proof rows of G4.5, 500 seeds each, on the shipped boss.
// A threshold that misses moves the boss's data, never a threshold and never a fighter.
const SEEDS = 500;
const ROWS: Array<{ key: string; min?: number; max?: number }> = [
  { key: 'A', min: 0.85 },
  { key: 'B', max: 0.05 },
  { key: 'C', min: 0.65 },
  { key: 'F', max: 0.15 },
  { key: 'G', max: 0.05 },
  { key: 'R', min: 0.85 },
  { key: 'Rstill', max: 0.05 },
  { key: 'M', min: 0.85 },
  { key: 'Mstill', max: 0.05 },
  { key: 'FR', max: 0.15 },
  { key: 'FM', max: 0.15 }
];

describe('the Ashmantle fight, simulated with positions (design 6.4, G4.5)', () => {
  it(`every proof row holds over ${SEEDS} seeds`, () => {
    const lines = ['fighter                              win%   threshold  mean s (wins)  heavies dodged'];
    const misses: string[] = [];
    for (const row of ROWS) {
      const res = runRow(row.key, SEEDS);
      const bound = row.min !== undefined ? `>= ${row.min * 100}%` : `<= ${row.max! * 100}%`;
      lines.push(`${FIGHTERS[row.key].label.padEnd(36)} ${(res.win * 100).toFixed(1).padStart(5)}   ${bound.padEnd(9)}  ${res.meanWinSecs.toFixed(0).padStart(13)}  ${(res.dodged * 100).toFixed(0).padStart(13)}%`);
      if ((row.min !== undefined && res.win < row.min) || (row.max !== undefined && res.win > row.max)) misses.push(`${row.key} ${(res.win * 100).toFixed(1)}% (${bound})`);
    }
    console.log(lines.join('\n'));
    expect(misses).toEqual([]);
  }, 60_000);
});
