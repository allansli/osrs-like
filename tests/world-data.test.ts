import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NODE_PLACEMENTS } from '../src/data/placements';
import { MONSTER_TYPES, RESOURCE_NODES_DEF, WORLD_REGIONS } from '../src/data/world';
import { BASINS, CAMPS, PATHS, POIS, RIDGES, SAFE_ZONES, type CampDef, type RidgeDef } from '../src/data/worldMap';
import { castleBlockers, isDeepWater, isWalkable } from '../src/state/collision';
import { shrineWorldPos } from '../src/state/shrines';
import { getTerrainHeight } from '../src/state/terrain';

// Design 6.11 "World data", G2.3, and the resource rules of 6.4. Counts come from design 6.3 and 6.4.
const WATER_PLANE = -0.34;
const BUILDERS = new Set(['tent', 'fireRing', 'cairn', 'signpost']);

function glbNodeNames(): Set<string> {
  const buf = readFileSync(new URL('../public/models/world.glb', import.meta.url));
  expect(buf.readUInt32LE(0)).toBe(0x46546c67); // 'glTF'
  const jsonLength = buf.readUInt32LE(12);
  expect(buf.readUInt32LE(16)).toBe(0x4e4f534a); // 'JSON'
  const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8')) as { nodes: { name?: string }[] };
  return new Set(json.nodes.map((n) => n.name).filter((n): n is string => !!n));
}

function samplePolyline(points: [number, number][], step = 1): [number, number][] {
  const out: [number, number][] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1];
    const [bx, bz] = points[i];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  return out;
}

/** Distance from (x, z) to a polyline, and the nearest point on it. */
function nearestOnPolyline(points: [number, number][], x: number, z: number): { d: number; qx: number; qz: number } {
  let best = { d: Infinity, qx: 0, qz: 0 };
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1];
    const [bx, bz] = points[i];
    const lx = bx - ax;
    const lz = bz - az;
    const len2 = lx * lx + lz * lz;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * lx + (z - az) * lz) / len2));
    const qx = ax + lx * t;
    const qz = az + lz * t;
    const d = Math.hypot(x - qx, z - qz);
    if (d < best.d) best = { d, qx, qz };
  }
  return best;
}

/** A gap opens the ridge where the nearest crest point is within the gap's halfWidth of `at`. */
function inGap(ridge: RidgeDef, qx: number, qz: number, margin = 0): boolean {
  return ridge.gaps.some((g) => Math.hypot(qx - g.at[0], qz - g.at[1]) <= g.halfWidth + margin);
}

function inRidgeCore(ridge: RidgeDef, x: number, z: number, margin = 0): boolean {
  const n = nearestOnPolyline(ridge.points, x, z);
  return n.d <= ridge.coreHalfWidth + margin && !inGap(ridge, n.qx, n.qz);
}

function inCorridor(ridge: RidgeDef, x: number, z: number): boolean {
  const n = nearestOnPolyline(ridge.points, x, z);
  return n.d <= ridge.halfWidth && inGap(ridge, n.qx, n.qz);
}

const inCamp = (c: CampDef, x: number, z: number) => Math.hypot(x - c.x, z - c.z) <= c.radius;

function inBasinWater(x: number, z: number): boolean {
  return BASINS.some((b) => Math.hypot(x - b.x, z - b.z) <= b.radius && getTerrainHeight(x, z) < WATER_PLANE);
}

function walkableWithin(x: number, z: number, r: number): boolean {
  for (const d of [...Array.from({ length: Math.floor(r / 0.25) }, (_, k) => (k + 1) * 0.25), r]) {
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      if (isWalkable(x + Math.cos(a) * d, z + Math.sin(a) * d)) return true;
    }
  }
  return false;
}

/** Length of the unwalkable run through (x, z) along direction (ux, uz). */
function blockedRun(x: number, z: number, ux: number, uz: number): number {
  let run = 0;
  for (const s of [1, -1]) {
    for (let t = 0.05; t < 60; t += 0.05) {
      if (isWalkable(x + ux * t * s, z + uz * t * s)) break;
      run += 0.05;
    }
  }
  return run;
}

// worldBuild.ts: altars, forges, merchants, bank booth, slayer master; plus the five shrines.
const STATIONS: [string, number, number][] = [
  ['altar', -10, -4], ['altar', 72, -26],
  ['forge', 10, -4], ['forge', 86, -16],
  ['merchant', -7, 5], ['merchant', 78, -12], ['merchant', 64, 62],
  ['bank', 2.2, 4.2], ['slayer master', 5.5, 8.5],
  ...WORLD_REGIONS.map((r): [string, number, number] => [`${r.id} shrine`, shrineWorldPos(r).x, shrineWorldPos(r).z])
];
const STATION_CLEARANCE = 2;

function castleDistance(x: number, z: number): number {
  let d = Infinity;
  for (const b of castleBlockers()) {
    const dx = Math.max(b.minX - x, 0, x - b.maxX);
    const dz = Math.max(b.minZ - z, 0, z - b.maxZ);
    d = Math.min(d, Math.hypot(dx, dz));
  }
  return d;
}

const fishing = NODE_PLACEMENTS.filter((p) => p.type.startsWith('fish_'));
const aggressive = () => CAMPS.filter((c) => c.aggressive);
const memberCount = () => CAMPS.reduce((s, c) => s + c.members.length, 0);

function harrowback(): RidgeDef {
  expect(RIDGES).toHaveLength(1);
  expect(RIDGES[0].gaps).toHaveLength(1);
  return RIDGES[0];
}

/** The camp that holds the pass: the one whose circle contains the gap. */
function passCamp(ridge: RidgeDef): CampDef {
  const [gx, gz] = ridge.gaps[0].at;
  const holding = CAMPS.filter((c) => inCamp(c, gx, gz));
  expect(holding, 'camps containing the Cinderstep Pass gap').toHaveLength(1);
  return holding[0];
}

describe('world data', () => {
  it('every POI piece names a world.glb node or one of tent, fireRing, cairn, signpost', () => {
    expect(POIS).toHaveLength(7);
    const nodes = glbNodeNames();
    let pieces = 0;
    for (const poi of POIS) {
      for (const piece of poi.pieces) {
        pieces++;
        const at = `${poi.name} ${JSON.stringify(piece)}`;
        expect((piece.node === undefined) !== (piece.builder === undefined), `${at}: exactly one of node and builder`).toBe(true);
        if (piece.node !== undefined) expect(nodes.has(piece.node), at).toBe(true);
        if (piece.builder !== undefined) expect(BUILDERS.has(piece.builder), at).toBe(true);
      }
    }
    expect(pieces).toBeGreaterThan(0);
  });

  it('every POI piece stands on walkable ground inside its pad', () => {
    expect(POIS).toHaveLength(7);
    for (const poi of POIS) {
      for (const piece of poi.pieces) {
        const at = `${poi.name} ${JSON.stringify(piece)}`;
        expect(Math.hypot(piece.dx, piece.dz), at).toBeLessThanOrEqual(poi.padRadius);
        expect(isWalkable(poi.x + piece.dx, poi.z + piece.dz), at).toBe(true);
      }
    }
  });

  it('every camp member is inside its camp and on walkable ground', () => {
    expect(memberCount()).toBe(36);
    for (const c of CAMPS) {
      for (const m of c.members) {
        const at = `${c.id} ${m.type} (${m.x}, ${m.z})`;
        expect(inCamp(c, m.x, m.z), at).toBe(true);
        expect(isWalkable(m.x, m.z), at).toBe(true);
      }
    }
  });

  it('every fishing spot is on unwalkable water (river by isDeepWater, or a basin) within 3.1 of walkable ground', () => {
    // Nine spots of today, five of them moved onto deep water, plus one in each basin.
    expect(fishing).toHaveLength(11);
    expect(BASINS).toHaveLength(2);
    for (const b of BASINS) {
      expect(fishing.some((p) => Math.hypot(p.x - b.x, p.z - b.z) <= b.radius), `a fishing spot in ${b.name}`).toBe(true);
    }
    for (const p of fishing) {
      const at = `${p.type} at (${p.x}, ${p.z})`;
      expect(isDeepWater(p.x, p.z) || inBasinWater(p.x, p.z), `${at} on water`).toBe(true);
      expect(isWalkable(p.x, p.z), `${at} unwalkable`).toBe(false);
      expect(walkableWithin(p.x, p.z, 3.1), `${at} within 3.1 of walkable ground`).toBe(true);
    }
  });

  it('every monster type and node key exists', () => {
    for (const c of CAMPS) {
      for (const m of c.members) expect(Object.hasOwn(MONSTER_TYPES, m.type), `${c.id} ${m.type}`).toBe(true);
    }
    for (const p of NODE_PLACEMENTS) {
      expect(Object.hasOwn(RESOURCE_NODES_DEF, p.type), `${p.type} at (${p.x}, ${p.z})`).toBe(true);
    }
  });

  it('no ridge core or basin overlaps a region core, the castle, a station or a path', () => {
    const ridge = harrowback();
    expect(BASINS).toHaveLength(2);
    expect(PATHS).toHaveLength(4);
    for (const r of WORLD_REGIONS) {
      expect(nearestOnPolyline(ridge.points, r.x, r.z).d, `${ridge.name} vs ${r.id} core`).toBeGreaterThan(16 + ridge.coreHalfWidth);
      for (const b of BASINS) {
        expect(Math.hypot(b.x - r.x, b.z - r.z), `${b.name} vs ${r.id} core`).toBeGreaterThan(16 + b.radius);
      }
    }
    for (let x = -10; x <= 10; x += 0.5) {
      for (let z = -35; z <= -15; z += 0.5) {
        if (castleDistance(x, z) > 0) continue;
        expect(inRidgeCore(ridge, x, z), `${ridge.name} vs castle (${x}, ${z})`).toBe(false);
      }
    }
    for (const b of BASINS) {
      expect(castleDistance(b.x, b.z), `${b.name} vs castle`).toBeGreaterThan(b.radius);
    }
    for (const [name, x, z] of STATIONS) {
      expect(nearestOnPolyline(ridge.points, x, z).d, `${ridge.name} vs ${name}`).toBeGreaterThan(ridge.coreHalfWidth + STATION_CLEARANCE);
      for (const b of BASINS) {
        expect(Math.hypot(x - b.x, z - b.z), `${b.name} vs ${name}`).toBeGreaterThan(b.radius + STATION_CLEARANCE);
      }
    }
    for (const p of PATHS) {
      for (const [x, z] of samplePolyline(p.points)) {
        expect(inRidgeCore(ridge, x, z, p.halfWidth), `${p.name} vs ${ridge.name} core at (${x}, ${z})`).toBe(false);
        for (const b of BASINS) {
          expect(Math.hypot(x - b.x, z - b.z), `${p.name} vs ${b.name} at (${x}, ${z})`).toBeGreaterThan(b.radius + p.halfWidth);
        }
      }
    }
  });

  it('every ridge core and basin is at least 2 units across', () => {
    const ridge = harrowback();
    expect(BASINS).toHaveLength(2);
    expect(ridge.coreHalfWidth * 2).toBeGreaterThanOrEqual(2);
    let measured = 0;
    for (let i = 1; i < ridge.points.length; i++) {
      const [ax, az] = ridge.points[i - 1];
      const [bx, bz] = ridge.points[i];
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      if (Math.abs(mx) > 112 || Math.abs(mz) > 112 || inGap(ridge, mx, mz, 2)) continue;
      const len = Math.hypot(bx - ax, bz - az);
      measured++;
      expect(blockedRun(mx, mz, -(bz - az) / len, (bx - ax) / len), `${ridge.name} across at (${mx}, ${mz})`).toBeGreaterThanOrEqual(2);
    }
    expect(measured).toBeGreaterThan(0);
    for (const b of BASINS) {
      expect(blockedRun(b.x, b.z, 1, 0), `${b.name} across x`).toBeGreaterThanOrEqual(2);
      expect(blockedRun(b.x, b.z, 0, 1), `${b.name} across z`).toBeGreaterThanOrEqual(2);
    }
  });

  it('no aggressive camp overlaps a safe zone', () => {
    // Design 6.4: the hen yard and Three Kettle Camp are passive, every other camp is aggressive.
    expect(aggressive().length).toBe(CAMPS.length - 2);
    for (const c of aggressive()) {
      for (const sz of SAFE_ZONES) {
        expect(Math.hypot(c.x - sz.x, c.z - sz.z), `${c.id} vs ${sz.id} safe zone`).toBeGreaterThan(c.radius + sz.radius);
      }
    }
  });

  it('no path except Cinder Stair crosses an aggressive camp', () => {
    const ridge = harrowback();
    expect(PATHS).toHaveLength(4);
    expect(aggressive().length).toBe(CAMPS.length - 2);
    const sentries = passCamp(ridge);
    // Cinder Stair is the one path that runs through Cinderstep Pass.
    const throughPass = PATHS.filter((p) => samplePolyline(p.points).some(([x, z]) => inCorridor(ridge, x, z)));
    expect(throughPass.map((p) => p.name)).toHaveLength(1);
    let crossesSentries = false;
    const crossings: string[] = [];
    for (const p of PATHS) {
      for (const [x, z] of samplePolyline(p.points)) {
        for (const c of aggressive()) {
          if (Math.hypot(x - c.x, z - c.z) > c.radius + p.halfWidth) continue;
          if (p === throughPass[0] && c === sentries) crossesSentries = true;
          else crossings.push(`${p.name} at (${x}, ${z}) in ${c.id}`);
        }
      }
    }
    expect(crossings).toEqual([]);
    expect(crossesSentries, `${throughPass[0].name} crosses the pass sentries' camp`).toBe(true);
  });

  it('no resource node except yew and magic trees is inside an aggressive camp', () => {
    expect(aggressive().length).toBe(CAMPS.length - 2);
    expect(aggressive().length).toBeGreaterThan(0);
    for (const p of NODE_PLACEMENTS) {
      if (p.type === 'yew_tree' || p.type === 'magic_tree') continue;
      for (const c of aggressive()) {
        expect(inCamp(c, p.x, p.z), `${p.type} at (${p.x}, ${p.z}) inside ${c.id}`).toBe(false);
      }
    }
  });

  it('all yew and magic trees are inside the two deep-woods camps', () => {
    const trees = NODE_PLACEMENTS.filter((p) => p.type === 'yew_tree' || p.type === 'magic_tree');
    expect(trees.filter((p) => p.type === 'yew_tree')).toHaveLength(4);
    expect(trees.filter((p) => p.type === 'magic_tree')).toHaveLength(3);
    const holding = new Set<CampDef>();
    for (const t of trees) {
      const camps = CAMPS.filter((c) => inCamp(c, t.x, t.z));
      expect(camps, `${t.type} at (${t.x}, ${t.z}) in exactly one camp`).toHaveLength(1);
      holding.add(camps[0]);
    }
    expect(holding.size).toBe(2);
    for (const c of holding) {
      expect(c.aggressive, c.id).toBe(true);
      expect(c.members.length, c.id).toBeGreaterThan(0);
      for (const m of c.members) expect(m.type, c.id).toBe('moss_guardian');
    }
  });

  it('runite rocks are outside every camp', () => {
    const runite = NODE_PLACEMENTS.filter((p) => p.type === 'runite_rock');
    expect(runite).toHaveLength(3);
    for (const p of runite) {
      for (const c of CAMPS) {
        expect(inCamp(c, p.x, p.z), `runite at (${p.x}, ${p.z}) inside ${c.id}`).toBe(false);
      }
    }
  });

  it('four lesser demons stand in the Cinderstep Pass camp with wander 1', () => {
    const ridge = harrowback();
    const camp = passCamp(ridge);
    expect(camp.aggressive).toBe(true);
    expect(camp.members).toHaveLength(4);
    for (const m of camp.members) {
      const at = `${m.type} at (${m.x}, ${m.z})`;
      expect(m.type, at).toBe('lesser_demon');
      expect(m.wander, at).toBe(1);
      expect(inCorridor(ridge, m.x, m.z), `${at} in the pass`).toBe(true);
    }
  });
});
