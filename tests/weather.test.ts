import { describe, expect, it } from 'vitest';
import { GFX_TIERS, WEATHER } from '../src/data/look';
import { WORLD_REGIONS } from '../src/data/world';
import { weatherAt } from '../src/state/weather';

/*
 * Plan WX1, design 5.7, 6.8 and the G5.7 row of 8.1, against `WEATHER` in src/data/look.ts and `weatherAt` in
 * src/state/weather.ts. Row fields pinned for WX2:
 *   { id, regions: string[], keyScale, fogScale, motes: Array<{ color, intensity, glow }>, fall: { color } | null }
 * `motes` lists the kinds of ambient mote the state shows and `fall` the falling kind (rain, flakes) or null.
 * Counts are never in a row: they come from GFX_TIERS.
 */
type Row = { id: string; regions: string[]; keyScale: number; fogScale: number; motes: unknown[]; fall: unknown };
const rows = WEATHER as unknown as Row[];
const REGION_IDS = WORLD_REGIONS.map((r) => r.id);
const IDS = ['clear', 'overcast', 'mist', 'rain', 'sand_haze', 'ash_fall'];
const rowOf = (id: string) => rows.find((r) => r.id === id);
const only = (region: string): Record<string, number> => Object.fromEntries(REGION_IDS.map((r) => [r, r === region ? 1 : 0]));
const DAYS = 200;

describe('weather table', () => {
  it('has the six states of design 5.7', () => {
    expect(rows.map((r) => r.id)).toEqual(IDS);
  });

  it('gives every row complete, finite fields and lists only real regions', () => {
    expect(rows).toHaveLength(6);
    for (const r of rows) {
      expect(r.regions.length, r.id).toBeGreaterThan(0);
      for (const g of r.regions) expect(REGION_IDS, `${r.id} ${g}`).toContain(g);
      for (const n of ['keyScale', 'fogScale'] as const) {
        expect(Number.isFinite(r[n]), `${r.id} ${n}`).toBe(true);
        expect(r[n], `${r.id} ${n}`).toBeGreaterThan(0);
      }
      expect(Array.isArray(r.motes), `${r.id} motes`).toBe(true);
      expect(r.fall === null || typeof r.fall === 'object', `${r.id} fall`).toBe(true);
      for (const m of r.motes as Array<Record<string, unknown>>) expect(m, `${r.id} mote`).not.toHaveProperty('count');
    }
  });

  it('lists every region for clear, and keeps the region-bound states to their regions', () => {
    expect(rowOf('clear')?.regions).toEqual(REGION_IDS);
    expect(rowOf('rain')?.regions).not.toContain('desert');
    expect(rowOf('rain')?.regions).not.toContain('wilderness');
    expect(rowOf('sand_haze')?.regions).toEqual(['desert']);
    expect(rowOf('ash_fall')?.regions).toEqual(['wilderness']);
  });

  it('draws mote, fall and point-light counts from the tier table, and they are 0 on performance', () => {
    expect(GFX_TIERS.performance.motes).toBe(0);
    expect(GFX_TIERS.performance.weatherParticles).toBe(0);
    expect(GFX_TIERS.performance.pointLights).toBe(0);
    for (const id of ['performance', 'balanced', 'high', 'ultra'] as const) {
      for (const n of ['motes', 'weatherParticles', 'pointLights'] as const) {
        expect(Number.isInteger(GFX_TIERS[id][n]), `${id} ${n}`).toBe(true);
      }
    }
  });
});

describe('weatherAt', () => {
  it('returns the same result for the same inputs', () => {
    for (const region of REGION_IDS) {
      for (let day = 0; day < 20; day++) {
        for (let p = 0; p < 1; p += 0.037) {
          expect(weatherAt(day, p, only(region)), `${region} ${day} ${p}`).toEqual(weatherAt(day, p, only(region)));
        }
      }
    }
  });

  it('returns a known id and a blend in 0..1', () => {
    for (const region of REGION_IDS) {
      for (let day = 0; day < 30; day++) {
        for (let p = 0; p < 1; p += 0.01) {
          const w = weatherAt(day, p, only(region));
          expect(IDS, `${region} ${day} ${p}`).toContain(w.id);
          expect(w.blend, `${region} ${day} ${p}`).toBeGreaterThanOrEqual(0);
          expect(w.blend, `${region} ${day} ${p}`).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('shows a state only in a region its row lists (the heaviest region decides)', () => {
    for (const region of REGION_IDS) {
      for (let day = 0; day < DAYS; day++) {
        for (let p = 0; p < 1; p += 0.05) {
          const w = weatherAt(day, p, only(region));
          expect(rowOf(w.id)?.regions, `${region} ${day} ${p} ${w.id}`).toContain(region);
        }
      }
    }
    const mixed = { lumbridge: 0.2, varrock: 0, desert: 0.7, woods: 0.1, wilderness: 0 };
    for (let day = 0; day < DAYS; day++) {
      for (let p = 0; p < 1; p += 0.05) expect(rowOf(weatherAt(day, p, mixed).id)?.regions, `${day} ${p}`).toContain('desert');
    }
  });

  it('never shows rain in desert or wilderness, sand haze outside desert, or ash fall outside wilderness', () => {
    for (let day = 0; day < DAYS; day++) {
      for (let p = 0; p < 1; p += 0.01) {
        for (const region of ['desert', 'wilderness']) expect(weatherAt(day, p, only(region)).id, `${region} ${day} ${p}`).not.toBe('rain');
        for (const region of REGION_IDS.filter((r) => r !== 'desert')) expect(weatherAt(day, p, only(region)).id, `${region} ${day} ${p}`).not.toBe('sand_haze');
        for (const region of REGION_IDS.filter((r) => r !== 'wilderness')) expect(weatherAt(day, p, only(region)).id, `${region} ${day} ${p}`).not.toBe('ash_fall');
      }
    }
  });

  it('does show each region-bound state somewhere in its region over many days', () => {
    const seen = (region: string) => {
      const ids = new Set<string>();
      for (let day = 0; day < DAYS; day++) for (let p = 0; p < 1; p += 0.01) ids.add(weatherAt(day, p, only(region)).id);
      return ids;
    };
    expect(seen('desert').has('sand_haze')).toBe(true);
    expect(seen('wilderness').has('ash_fall')).toBe(true);
    expect(seen('lumbridge').has('rain')).toBe(true);
    expect(seen('woods').has('rain')).toBe(true);
    expect(seen('lumbridge').has('clear')).toBe(true);
  });

  it('changes state no more often than every 0.08 of phase', () => {
    const STEP = 0.001;
    for (const region of REGION_IDS) {
      // One continuous timeline across days: the clock does not reset at phase 0 of a new day.
      let last = -Infinity;
      let prev = weatherAt(0, 0, only(region)).id;
      for (let day = 0; day < 60; day++) {
        for (let p = day === 0 ? STEP : 0; p < 1; p += STEP) {
          const id = weatherAt(day, p, only(region)).id;
          if (id !== prev) {
            const t = day + p;
            expect(t - last, `${region} day ${day} at ${p.toFixed(3)}`).toBeGreaterThanOrEqual(0.08 - 2 * STEP);
            last = t;
            prev = id;
          }
        }
      }
    }
  });
});
