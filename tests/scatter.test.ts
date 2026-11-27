import { describe, expect, it } from 'vitest';
import { FLORA_RULES, GFX_TIERS, KIT_PIECES, type QualityTier } from '../src/data/look';
import { NODE_PLACEMENTS } from '../src/data/placements';
import { WORLD_REGIONS } from '../src/data/world';
import { CAMPS, PATHS, POIS, RIDGES, SAFE_ZONES, type RidgeDef } from '../src/data/worldMap';
import { WOODS_TREES } from '../src/data/woodsTrees';
import { buildScatter, type ScatterResult } from '../src/state/scatter';
import { hitsCastleWall, inBasinWater, isDeepWater, isWalkableGround, nearestOnPolyline } from '../src/state/collision';
import { shrineWorldPos } from '../src/state/shrines';
import { getTerrainHeight, regionAt } from '../src/state/terrain';

/*
 * Plan GR3, design 5.6, 6.7 and the G5.6 and G5.8 rows of 8.1: the boundary check for generated decoration.
 * Every clearance is written here as a literal so the flora data cannot loosen it.
 *
 * Canopy stands only where isWalkableGround is false (the border ring beyond 118, the ridge core, the far bank
 * strips), never in water and never in the castle's walls. The predicate is isWalkableGround, not isWalkable,
 * so a woods-tree cell never counts as room for canopy; the walk grid stops at 118, so the predicate is the source.
 */

const PIECES = [
  'boulder_s', 'boulder_m', 'boulder_l', 'bush_a', 'bush_b', 'fern', 'reed', 'log', 'snag', 'sapling',
  'mushrooms', 'backdrop_tree_a', 'backdrop_tree_b', 'crag_a', 'crag_b'
] as const;
type PieceId = (typeof PIECES)[number];
type Instance = ScatterResult[PieceId][number];
// Design 5.6: the understorey is bushes, ferns, reeds, small rocks, logs, mushrooms; canopy and crag are backdrop trees, crags, snags.
const MUST_BE_UNDERSTOREY = ['boulder_s', 'bush_a', 'bush_b', 'fern', 'reed', 'log', 'mushrooms'] as const;
const MUST_BE_CANOPY = ['backdrop_tree_a', 'backdrop_tree_b', 'crag_a', 'crag_b', 'snag'] as const;
const TIERS = Object.keys(GFX_TIERS) as QualityTier[];
// The full count: a tier at scatterDensity 1 (whichever, so a tune that thins one tier keeps this file valid).
const FULL = TIERS.find((t) => GFX_TIERS[t].scatterDensity === 1) as QualityTier;

const SEED = 20261114;
const UNDERSTOREY_MAX_HEIGHT = 1.2;
const GAMEPLAY_CLEAR = 2.5; // nodes, stations, shrines, camp member homes
const SAFE_ZONE_INNER = 6;
const WOODS_TREE_CLEAR = 1;
const REED_WATER_REACH = 3;
const POI_REACH = 10; // beyond padRadius: where a POI's frame and floor stand
const REGION_MIN = 3; // one cluster is 3 to 9 members
const POI_MIN = 2; // a frame is two or three tall things
const RING_INNER = 118;
const RING_OUTER = 130; // terrain half-size
const SECTORS = 16;
const COUNT_TOLERANCE = 0.05;
const WATER_PLANE = -0.34; // terrain.ts and worldMesh.ts

// worldBuild.ts: altars, forges, merchants, bank booth, slayer master; plus the five shrines (as tests/woods-trees.test.ts).
const STATIONS: [string, number, number][] = [
  ['altar', -10, -4], ['altar', 72, -26],
  ['forge', 10, -4], ['forge', 86, -16],
  ['merchant', -7, 5], ['merchant', 78, -12], ['merchant', 64, 62],
  ['bank', 2.2, 4.2], ['slayer master', 5.5, 8.5],
  ...WORLD_REGIONS.map((r): [string, number, number] => [`${r.id} shrine`, shrineWorldPos(r).x, shrineWorldPos(r).z])
];

const cache = new Map<QualityTier, ScatterResult>();
function scatter(tier: QualityTier): ScatterResult {
  let r = cache.get(tier);
  if (!r) {
    r = buildScatter(SEED, tier);
    cache.set(tier, r);
  }
  return r;
}

function all(r: ScatterResult): [PieceId, Instance][] {
  return PIECES.flatMap((id) => r[id].map((p): [PieceId, Instance] => [id, p]));
}

const total = (r: ScatterResult) => PIECES.reduce((s, id) => s + r[id].length, 0);
const at = (id: string, p: Instance) => `${id} at (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`;

function inWater(x: number, z: number): boolean {
  return isDeepWater(x, z) || inBasinWater(x, z) || getTerrainHeight(x, z) < WATER_PLANE;
}

function nearWater(x: number, z: number, reach: number): boolean {
  for (let dx = -reach; dx <= reach; dx += 0.5) {
    for (let dz = -reach; dz <= reach; dz += 0.5) {
      if (Math.hypot(dx, dz) <= reach && inWater(x + dx, z + dz)) return true;
    }
  }
  return false;
}

/** Cinderstep Pass corridor, as tests/world-data.test.ts: across the ridge where the nearest crest point is in a gap. */
function inCorridor(ridge: RidgeDef, x: number, z: number): boolean {
  const n = nearestOnPolyline(ridge.points, x, z);
  return n.d <= ridge.halfWidth && ridge.gaps.some((g) => Math.hypot(n.qx - g.at[0], n.qz - g.at[1]) <= g.halfWidth);
}

describe('scatter: the tables', () => {
  it('KIT_PIECES has the fifteen pieces of design 6.7, each complete', () => {
    expect(Object.keys(KIT_PIECES).sort()).toEqual([...PIECES].sort());
    for (const id of PIECES) {
      const k = KIT_PIECES[id];
      expect(['understorey', 'canopy'], id).toContain(k.layer);
      expect(k.maxHeight, id).toBeGreaterThan(0);
      expect(k.radius, id).toBeGreaterThan(0);
      expect(typeof k.castShadow, id).toBe('boolean');
    }
  });

  it('every understorey piece is at most 1.2 high, and the layers follow design 5.6', () => {
    expect(Object.keys(KIT_PIECES)).toHaveLength(PIECES.length);
    for (const id of PIECES) {
      if (KIT_PIECES[id].layer === 'understorey') expect(KIT_PIECES[id].maxHeight, id).toBeLessThanOrEqual(UNDERSTOREY_MAX_HEIGHT);
    }
    for (const id of MUST_BE_UNDERSTOREY) expect(KIT_PIECES[id].layer, id).toBe('understorey');
    for (const id of MUST_BE_CANOPY) expect(KIT_PIECES[id].layer, id).toBe('canopy');
  });

  it('FLORA_RULES has one row per region id and one per POI id', () => {
    expect(WORLD_REGIONS).toHaveLength(5);
    expect(POIS).toHaveLength(7);
    const ids = [...WORLD_REGIONS.map((r) => r.id), ...POIS.map((p) => p.id)];
    expect(new Set(ids).size).toBe(12);
    expect(Object.keys(FLORA_RULES).sort()).toEqual(ids.sort());
  });
});

describe('scatter: output shape and determinism', () => {
  it('every tier returns a list per kit piece of finite instances inside the terrain', () => {
    for (const tier of TIERS) {
      const r = scatter(tier);
      expect(Object.keys(r).sort(), tier).toEqual([...PIECES].sort());
      for (const [id, p] of all(r)) {
        for (const v of [p.x, p.z, p.rot, p.scale]) expect(Number.isFinite(v), `${tier} ${at(id, p)}`).toBe(true);
        expect(p.scale, `${tier} ${at(id, p)}`).toBeGreaterThan(0);
        expect(Math.max(Math.abs(p.x), Math.abs(p.z)), `${tier} ${at(id, p)}`).toBeLessThanOrEqual(RING_OUTER);
      }
    }
  });

  it('every kit piece is used at full density, ferns and reeds included', () => {
    const r = scatter(FULL);
    for (const id of PIECES) expect(r[id].length, id).toBeGreaterThan(0);
  });

  it('the same seed gives the same output, and another seed another', () => {
    for (const tier of TIERS) expect(buildScatter(SEED, tier), tier).toEqual(scatter(tier));
    expect(buildScatter(SEED + 1, FULL)).not.toEqual(scatter(FULL));
  });
});

describe('scatter: clearances', () => {
  it('no instance is inside a path half-width, a POI pad, a safe zone inner 6 or the Cinderstep Pass corridor', () => {
    expect(PATHS).toHaveLength(4);
    expect(POIS).toHaveLength(7);
    expect(SAFE_ZONES).toHaveLength(5);
    expect(RIDGES).toHaveLength(1);
    expect(RIDGES[0].gaps).toHaveLength(1);
    for (const tier of TIERS) {
      for (const [id, p] of all(scatter(tier))) {
        for (const path of PATHS) {
          const d = nearestOnPolyline(path.points, p.x, p.z).d;
          if (d < path.halfWidth) expect.fail(`${tier} ${at(id, p)} is ${d.toFixed(2)} from ${path.id}`);
        }
        for (const poi of POIS) {
          const d = Math.hypot(p.x - poi.x, p.z - poi.z);
          if (d < poi.padRadius) expect.fail(`${tier} ${at(id, p)} is inside the pad of ${poi.id}`);
        }
        for (const sz of SAFE_ZONES) {
          if (Math.hypot(p.x - sz.x, p.z - sz.z) < SAFE_ZONE_INNER) expect.fail(`${tier} ${at(id, p)} is inside the inner 6 of safe zone ${sz.id}`);
        }
        if (inCorridor(RIDGES[0], p.x, p.z)) expect.fail(`${tier} ${at(id, p)} is in the Cinderstep Pass corridor`);
      }
    }
  });

  it('no instance is within 2.5 of a node, station, shrine or camp member home', () => {
    expect(STATIONS).toHaveLength(9 + WORLD_REGIONS.length);
    expect(NODE_PLACEMENTS).toHaveLength(49);
    expect(CAMPS).toHaveLength(17);
    const members = CAMPS.flatMap((c) => c.members.map((m): [string, number, number] => [`${c.id} ${m.type}`, m.x, m.z]));
    expect(members).toHaveLength(46);
    const points: [string, number, number][] = [
      ...STATIONS,
      ...NODE_PLACEMENTS.map((n): [string, number, number] => [n.type, n.x, n.z]),
      ...members
    ];
    for (const tier of TIERS) {
      for (const [id, p] of all(scatter(tier))) {
        for (const [n, x, z] of points) {
          if (Math.hypot(p.x - x, p.z - z) < GAMEPLAY_CLEAR) expect.fail(`${tier} ${at(id, p)} is within 2.5 of ${n} (${x}, ${z})`);
        }
      }
    }
  });

  it('no instance is within 1 of a woods-tree cell centre', () => {
    expect(WOODS_TREES.length).toBeGreaterThanOrEqual(100);
    const trees = WOODS_TREES.map(([i, j]) => [-118 + i + 0.5, -118 + j + 0.5]);
    for (const tier of TIERS) {
      for (const [id, p] of all(scatter(tier))) {
        for (const [x, z] of trees) {
          if (Math.hypot(p.x - x, p.z - z) < WOODS_TREE_CLEAR) expect.fail(`${tier} ${at(id, p)} is within 1 of the woods tree at (${x}, ${z})`);
        }
      }
    }
  });
});

describe('scatter: layers and placement rules', () => {
  it('every canopy instance stands where isWalkableGround is false, not in water and not in the castle', () => {
    for (const tier of TIERS) {
      const r = scatter(tier);
      for (const id of PIECES) {
        if (KIT_PIECES[id].layer !== 'canopy') continue;
        for (const p of r[id]) {
          expect(isWalkableGround(p.x, p.z), `${tier} ${at(id, p)} is on walkable ground`).toBe(false);
          expect(inWater(p.x, p.z), `${tier} ${at(id, p)} is in water`).toBe(false);
          expect(hitsCastleWall(p.x, p.z), `${tier} ${at(id, p)} is in the castle`).toBe(false);
        }
      }
    }
  });

  it('reeds stand within 3 of water, ferns only in woods', () => {
    for (const tier of TIERS) {
      const r = scatter(tier);
      for (const p of r.reed) expect(nearWater(p.x, p.z, REED_WATER_REACH), `${tier} ${at('reed', p)}`).toBe(true);
      for (const p of r.fern) expect(regionAt(p.x, p.z)?.id, `${tier} ${at('fern', p)}`).toBe('woods');
    }
  });

  it('no two instances are closer than the larger footprint radius', () => {
    for (const tier of TIERS) {
      const list = all(scatter(tier));
      for (let a = 0; a < list.length; a++) {
        const [ia, pa] = list[a];
        for (let b = a + 1; b < list.length; b++) {
          const [ib, pb] = list[b];
          const min = Math.max(KIT_PIECES[ia].radius, KIT_PIECES[ib].radius);
          if (Math.hypot(pa.x - pb.x, pa.z - pb.z) < min) expect.fail(`${tier} ${at(ia, pa)} and ${at(ib, pb)} are closer than ${min}`);
        }
      }
    }
  });

  it('every region and every POI has at least one cluster at full density', () => {
    const list = all(scatter(FULL));
    for (const reg of WORLD_REGIONS) {
      const n = list.filter(([, p]) => regionAt(p.x, p.z)?.id === reg.id).length;
      expect(n, `instances in region ${reg.id}`).toBeGreaterThanOrEqual(REGION_MIN);
    }
    for (const poi of POIS) {
      const n = list.filter(([, p]) => Math.hypot(p.x - poi.x, p.z - poi.z) <= poi.padRadius + POI_REACH).length;
      expect(n, `instances within padRadius + ${POI_REACH} of ${poi.id}`).toBeGreaterThanOrEqual(POI_MIN);
    }
  });

  it('each of 16 sectors of the 118 to 130 border ring has canopy instances on every tier', () => {
    for (const tier of TIERS) {
      const r = scatter(tier);
      const hit = new Array<number>(SECTORS).fill(0);
      for (const id of PIECES) {
        if (KIT_PIECES[id].layer !== 'canopy') continue;
        for (const p of r[id]) {
          const m = Math.max(Math.abs(p.x), Math.abs(p.z));
          if (m <= RING_INNER || m > RING_OUTER) continue;
          const a = (Math.atan2(p.z, p.x) + 2 * Math.PI) % (2 * Math.PI);
          hit[Math.min(SECTORS - 1, Math.floor((a / (2 * Math.PI)) * SECTORS))]++;
        }
      }
      hit.forEach((n, s) => expect(n, `${tier} sector ${s}`).toBeGreaterThan(0));
    }
  });
});

describe('scatter: density by tier', () => {
  it('each tier holds scatterDensity times the full count, within 5%', () => {
    expect(TIERS).toHaveLength(4);
    expect(FULL, 'a tier at scatterDensity 1').toBeDefined();
    const full = total(scatter(FULL));
    expect(full).toBeGreaterThan(0);
    for (const tier of TIERS) {
      const want = GFX_TIERS[tier].scatterDensity * full;
      expect(Math.abs(total(scatter(tier)) - want), `${tier}: ${total(scatter(tier))} vs ${want}`).toBeLessThanOrEqual(COUNT_TOLERANCE * want);
    }
  });
});
