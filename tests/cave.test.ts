import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { PATTERNS } from '../src/data/attacks';
import { CAVES, DUNGEONS } from '../src/data/dungeons';
import { ITEMS } from '../src/data/items';
import { CAVE_FOG_SCALE, CAVE_LIGHT, DAY_KEYS } from '../src/data/look';
import { NODE_PLACEMENTS } from '../src/data/placements';
import { MONSTER_TYPES } from '../src/data/world';
import { CAMPS, POIS } from '../src/data/worldMap';
import { isWalkable } from '../src/state/collision';
import { dayFrameAt, frameOf } from '../src/state/dayCycle';
import { canEnter, zoneCamps, zoneRespawns, zoneSafe, zoneWalk } from '../src/state/dungeon';
import { createDefaultState } from '../src/state/gameState';
import { createMonsterLogic, DEAD_SECS, DYING_SECS, onPlayerHit, sendHome, stepMonster } from '../src/state/monsterAi';
import { buildWalkGrid, findPath } from '../src/state/pathfind';
import { FX_DUNGEON } from './support/dungeonFixture';
import { campRate, killPay, openGroundBest, WALK_SPEED } from './support/income';

// Stage 6 plan C1 (design 7.5, 7.6; CALL-6.30 to 6.33, owner). The demons' cave and the Ember Hurler, against the tables
// C2 and C3 add. Red until then. The cave's rooms, camps and pillars are written out here, so a change to the row fails.

type Rect = [number, number, number, number];
const FRONT_HALL: Rect = [26, 20, 50, 48];
const BACK_HALL: Rect = [56, 18, 84, 50];
const SOLID: Rect[] = [[31, 27, 33, 29], [31, 39, 33, 41], [61, 24, 63, 26], [61, 42, 63, 44], [69, 30, 71, 32]];
// CALL-6.33 (a), decided 2026-11-25: 13.5 s from a death to the monster's return inside the cave (0.85 dying, 12.65 dead).
const CAVE_RESPAWN_SECS = 13.5;
const MAX_RATIO = 0.9; // the package's bound: at most this share of the best open ground at level 70
const FIGHTER = 70;
const LEASH_MARGIN = 4; // a camp's leash circle is its radius plus 4
const ARENA_MARGIN = 6;
const DT = 0.05;

const cave = CAVES[0];
const [OX, OZ] = [1000, 600];
const types = MONSTER_TYPES as unknown as Record<string, Record<string, unknown> & { drops: { id?: string; chance: number; gp?: number[]; qty?: number }[] }>;
const items = ITEMS as unknown as Record<string, { type: string }>;

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const grid = () => buildWalkGrid(zoneWalk(cave, []), OX, OZ, 96);
const homes = () => cave.camps.flatMap((c) => c.members.map((m) => ({ camp: c, ...m })));

describe('the row (design 7.6)', () => {
  it('CAVES holds one row, slagfall_cave, with the table of design 7.6 written out', () => {
    expect(CAVES).toHaveLength(1);
    expect(cave.id).toBe('slagfall_cave');
    expect(cave.name).toBe('Slagfall Terrace');
    expect(cave.origin).toEqual([1000, 600]);
    expect(cave.size).toBe(96);
    expect(cave.door).toEqual({ x: -84, z: 98 });
    expect(cave.entry).toEqual([12, 34]);
    expect(cave.rooms).toEqual({
      entry: [4, 26, 20, 42],
      c1: [20, 31, 26, 37],
      front: FRONT_HALL,
      c2: [50, 31, 56, 37],
      back: BACK_HALL
    });
    expect([...(cave.solid ?? [])].sort()).toEqual([...SOLID].sort());
    expect(cave.camps.map((c) => [c.id, c.room])).toEqual([['front', 'front'], ['back', 'back']]);
    const at = (id: string) => cave.camps.find((c) => c.id === id)!.members.map((m) => [m.type, m.x, m.z]);
    expect(at('front')).toEqual([['lesser_demon', 36, 30], ['lesser_demon', 36, 38], ['ember_hurler', 44, 34]]);
    expect(at('back')).toEqual([['lesser_demon', 66, 34], ['ember_hurler', 74, 28], ['ember_hurler', 74, 40]]);
  });

  it('needs nothing beyond the door, and the row has no gates, nodes, chest or loot field', () => {
    expect(cave.needs).toEqual({ all: [] });
    expect(canEnter(createDefaultState(), cave)).toBe(true);
    for (const key of ['gates', 'nodes', 'chest', 'loot']) expect(Object.hasOwn(cave, key), key).toBe(false);
  });

  it('a monster waits 13.5 s from death to return in the cave (CALL-6.33 (a))', () => {
    expect((cave as unknown as { respawnSecs: number }).respawnSecs).toBe(CAVE_RESPAWN_SECS);
  });
});

describe('the package\'s rules', () => {
  it('each camp holds at most 4; the cave holds 3 Lesser Demons and 3 Ember Hurlers, split 2 and 1, 1 and 2', () => {
    const count = (campId: string, type: string) => cave.camps.find((c) => c.id === campId)!.members.filter((m) => m.type === type).length;
    for (const c of cave.camps) expect(c.members.length, c.id).toBeLessThanOrEqual(4);
    expect(homes().filter((m) => m.type === 'lesser_demon')).toHaveLength(3);
    expect(homes().filter((m) => m.type === 'ember_hurler')).toHaveLength(3);
    expect([count('front', 'lesser_demon'), count('front', 'ember_hurler')]).toEqual([2, 1]);
    expect([count('back', 'lesser_demon'), count('back', 'ember_hurler')]).toEqual([1, 2]);
  });

  it('every Ember Hurler\'s home is more than 12 from the entry, and every home of one camp is more than 12 from every home of the other', () => {
    for (const m of homes()) if (m.type === 'ember_hurler') expect(Math.hypot(m.x - cave.entry[0], m.z - cave.entry[1]), `${m.camp.id} hurler at (${m.x}, ${m.z})`).toBeGreaterThan(12);
    const [a, b] = cave.camps;
    for (const p of a.members) for (const q of b.members) expect(Math.hypot(p.x - q.x, p.z - q.z), `${p.x},${p.z} and ${q.x},${q.z}`).toBeGreaterThan(12);
  });
});

describe('walking', () => {
  it('every open cell of the cave grid is reachable from the entry, and findPath finds a route to every home and a spread of cells', () => {
    const g = grid();
    const n = g.size;
    const seen = new Uint8Array(n * n);
    const start = Math.floor(cave.entry[1]) * n + Math.floor(cave.entry[0]);
    expect(g.cells[start]).toBe(1);
    const stack = [start];
    seen[start] = 1;
    while (stack.length > 0) {
      const i = stack.pop()!;
      const x = i % n;
      const z = (i - x) / n;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx;
        const Z = z + dz;
        if (X < 0 || Z < 0 || X >= n || Z >= n) continue;
        const j = Z * n + X;
        if (g.cells[j] === 1 && seen[j] === 0) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    const open = g.cells.reduce((s, v) => s + v, 0);
    expect(open).toBeGreaterThan(1500);
    expect(seen.reduce((s, v) => s + v, 0)).toBe(open);

    const from: [number, number] = [OX + cave.entry[0], OZ + cave.entry[1]];
    for (const m of homes()) expect(findPath(g, from, [OX + m.x, OZ + m.z]), `a route to ${m.type} at (${m.x}, ${m.z})`).not.toBeNull();
    for (let i = 0; i < g.cells.length; i += 37) {
      if (g.cells[i] !== 1) continue;
      const to: [number, number] = [OX + (i % n) + 0.5, OZ + Math.floor(i / n) + 0.5];
      expect(findPath(g, from, to), `a route to cell ${i}`).not.toBeNull();
    }
  });

  it('no point inside a solid rectangle is walkable, in the cave or in a dungeon fixture that has one', () => {
    const walk = zoneWalk(cave, []);
    for (const [x0, z0, x1, z1] of SOLID) {
      for (const [x, z] of [[(x0 + x1) / 2, (z0 + z1) / 2], [x0 + 0.5, z0 + 0.5], [x1 - 0.5, z1 - 0.5], [x0, z0], [x1, z1]]) {
        expect(walk(OX + x, OZ + z), `(${x}, ${z}) of [${x0}, ${z0}, ${x1}, ${z1}]`).toBe(false);
      }
      expect(walk(OX + x0 - 1, OZ + (z0 + z1) / 2), 'one cell left of the pillar').toBe(true);
    }
    const fx = { ...FX_DUNGEON, solid: [[28, 18, 30, 20]] as Rect[] };
    const fxWalk = zoneWalk(fx, ['lair_gate']);
    expect(fxWalk(1000 + 29, -200 + 19)).toBe(false);
    expect(fxWalk(1000 + 36, -200 + 30)).toBe(true);
  });

  it('every member\'s home is on an open cell inside its room, and every room is inside the zone with a 2-cell margin and at least 6 wide', () => {
    const walk = zoneWalk(cave, []);
    for (const m of homes()) {
      const r = cave.rooms[m.camp.room];
      expect(m.x >= r[0] && m.x <= r[2] && m.z >= r[1] && m.z <= r[3], `${m.type} at (${m.x}, ${m.z}) inside ${m.camp.room}`).toBe(true);
      expect(walk(OX + m.x, OZ + m.z), `${m.type} at (${m.x}, ${m.z}) on an open cell`).toBe(true);
    }
    for (const [id, r] of Object.entries(cave.rooms)) {
      expect(r[0] >= 2 && r[1] >= 2 && r[2] <= cave.size - 2 && r[3] <= cave.size - 2, `${id} inside the zone`).toBe(true);
      expect(Math.min(r[2] - r[0], r[3] - r[1]), `${id} width`).toBeGreaterThanOrEqual(6);
    }
  });

  it('the door passes the dungeon door rules, and the origin is at least 400 from every dungeon\'s', () => {
    const { x, z } = cave.door;
    expect(isWalkable(Math.floor(x) + 0.5, Math.floor(z) + 0.5), 'door on an open overworld cell').toBe(true);
    for (const c of CAMPS) {
      expect(Math.hypot(c.x - x, c.z - z), `door and the leash of ${c.id}`).toBeGreaterThan(c.radius + LEASH_MARGIN);
      if (c.arenaRadius !== undefined) expect(Math.hypot(c.x - x, c.z - z), `door and the arena of ${c.id}`).toBeGreaterThan(c.arenaRadius + ARENA_MARGIN);
    }
    for (const n of NODE_PLACEMENTS) expect(Math.hypot(n.x - x, n.z - z), `door and the node at (${n.x}, ${n.z})`).toBeGreaterThanOrEqual(3);
    for (const d of DUNGEONS) expect(Math.hypot(OX - d.origin[0], OZ - d.origin[1]), `origin and ${d.id}`).toBeGreaterThanOrEqual(400);
  });

  it('the entry is safe within 6 and not beyond', () => {
    expect(zoneSafe(cave, 1012, 634)).toBe(true);
    expect(zoneSafe(cave, 1012 + 6.1, 634)).toBe(false);
  });
});

describe('rules', () => {
  it('zoneRespawns is true for the cave and false for every dungeon', () => {
    expect(zoneRespawns(cave)).toBe(true);
    for (const d of DUNGEONS) expect(zoneRespawns(d), d.id).toBe(false);
  });

  it('zoneCamps gives two aggressive camps that keep their sight and set no radius', () => {
    const camps = zoneCamps(cave);
    expect(camps.map((c) => c.id)).toEqual(['slagfall_cave:front', 'slagfall_cave:back']);
    for (const c of camps) {
      expect(c.aggressive, c.id).toBe(true);
      expect(c.keepsSight, c.id).toBe(true);
      expect(c.aggroRadius, c.id).toBeUndefined();
    }
  });

  const acquires = (type: string, homeX: number, homeZ: number, heroDx: number): boolean => {
    const camps = zoneCamps(cave);
    const m = createMonsterLogic(type, OX + homeX, OZ + homeZ, { campId: 'slagfall_cave:front', respawn: true });
    const events = stepMonster(m, { playerX: OX + homeX + heroDx, playerZ: OZ + homeZ, playerDown: false, dt: 0.02, rand: seeded(7), playerCombat: 126, playerSafe: false, camps, grid: grid() });
    return events.some((e) => e.kind === 'aggro') && m.state !== 'idle';
  };

  it('an idle Lesser Demon acquires a combat-126 hero 8.9 away and not one 9.1 away', () => {
    expect(acquires('lesser_demon', 36, 30, 8.9)).toBe(true);
    expect(acquires('lesser_demon', 36, 30, 9.1)).toBe(false);
  });

  it('an idle Ember Hurler acquires a combat-126 hero at 11.9 and not at 12.1', () => {
    expect(acquires('ember_hurler', 44, 34, -11.9)).toBe(true);
    expect(acquires('ember_hurler', 44, 34, -12.1)).toBe(false);
  });

  it('a member killed in the cave is back at home and idle after the cave\'s 13.5 s, and not before; open ground\'s 8.35 s is unchanged', () => {
    expect(DYING_SECS + DEAD_SECS).toBeCloseTo(8.35, 9);
    const killed = (opts: Record<string, unknown>) => {
      const m = createMonsterLogic('lesser_demon', OX + 36, OZ + 30, { campId: 'slagfall_cave:front', ...opts } as never);
      m.x = OX + 30;
      onPlayerHit(m, m.hp);
      expect(m.state).toBe('dying');
      return m;
    };
    // The seconds of stepping until the member's `respawned` event; at that step it is home and idle (it may wander after).
    const respawnAt = (m: ReturnType<typeof killed>): number => {
      const w = { playerX: OX + 10, playerZ: OZ + 34, playerDown: false, dt: DT, rand: seeded(3), playerCombat: 126, playerSafe: true, camps: zoneCamps(cave), grid: grid() };
      for (let t = DT; t < 20; t += DT) {
        if (stepMonster(m, w).some((e) => e.kind === 'respawned')) {
          expect([m.state, m.x, m.z], 'home and idle at the return').toEqual(['idle', m.homeX, m.homeZ]);
          return t;
        }
      }
      throw new Error('the member never returned within 20 s');
    };
    const inCave = respawnAt(killed({ respawn: zoneRespawns(cave), respawnSecs: CAVE_RESPAWN_SECS }));
    expect(inCave).toBeGreaterThan(13.4);
    expect(inCave).toBeLessThan(13.6);
    const onOpenGround = respawnAt(killed({ respawn: true }));
    expect(onOpenGround).toBeGreaterThan(8.25);
    expect(onOpenGround).toBeLessThan(8.45);
  });

  it('sendHome puts a Hurler in attack with a wind-up back at home, idle, at full hp and wind-up null, and leaves a dead or dying member alone', () => {
    const [hx, hz] = [OX + 44, OZ + 34];
    const m = createMonsterLogic('ember_hurler', hx, hz, { campId: 'slagfall_cave:front', respawn: true });
    m.state = 'attack';
    m.x = hx - 8;
    m.z = hz + 3;
    m.hp = 40;
    m.windup = { attackId: 'pinning_volley', left: 0.6, total: 1.2, ox: m.x, oz: m.z, dx: 1, dz: 0 };
    m.recoverLeft = 0.4;
    sendHome(m);
    expect([m.state, m.x, m.z, m.hp, m.windup]).toEqual(['idle', hx, hz, m.maxHp, null]);

    for (const state of ['dead', 'dying'] as const) {
      const down = createMonsterLogic('ember_hurler', hx, hz, { campId: 'slagfall_cave:front', respawn: true });
      down.state = state;
      down.timer = 5;
      down.hp = 0;
      down.x = hx + 4;
      const before = structuredClone(down);
      sendHome(down);
      expect(down, state).toEqual(before);
    }
  });
});

describe('the overworld', () => {
  it('CAMPS has no slagfall_terrace camp and no member within 12 of the door', () => {
    expect(CAMPS.some((c) => c.id === 'slagfall_terrace')).toBe(false);
    for (const c of CAMPS) for (const m of c.members) expect(Math.hypot(m.x + 84, m.z - 98), `${c.id} ${m.type} at (${m.x}, ${m.z})`).toBeGreaterThan(12);
  });

  it('pass_sentries still holds its four Lesser Demons, one wander each, and POIS still holds the terrace', () => {
    const sentries = CAMPS.find((c) => c.id === 'pass_sentries')!;
    expect(sentries.members).toEqual([-42, -37, -27, -22].map((x) => ({ type: 'lesser_demon', x, z: 55, wander: 1 })));
    expect(POIS.some((p) => p.id === 'slagfall_terrace')).toBe(true);
  });
});

describe('the Ember Hurler (design 7.5)', () => {
  const row = () => types.ember_hurler;

  it('has the stats, pattern, model and look of the table', () => {
    const r = row();
    const ld = types.lesser_demon;
    expect(r).toBeDefined();
    expect([r.name, r.level, r.hp, r.maxHit, r.atk, r.def, r.style]).toEqual(['Ember Hurler', 66, 105, 19, 64, 44, 'ranged']);
    expect([r.pattern, r.model, r.tint, r.modelScale]).toEqual(['dark_ranger', 'lesser_demon', 0xb8b2a7, 0.85]);
    for (const k of ['scale', 'bodyColor', 'accentColor', 'weaponColor', 'kind']) expect(r[k], k).toBe(ld[k]);
    expect(PATTERNS.dark_ranger[3]).toBe('pinning_volley');
  });

  it('drops dragon bones, coins, a shark and 2 ashes in that order, and no equipment', () => {
    expect(row().drops).toEqual([
      { id: 'dragon_bones', chance: 1 },
      { gp: [340, 760], chance: 1 },
      { id: 'shark', chance: 0.5 },
      { id: 'ashes', chance: 0.5, qty: 2 }
    ]);
    for (const d of row().drops) if (d.id) expect(items[d.id].type, d.id).not.toBe('equip');
  });

  it('leaves the Lesser Demon\'s row as it was', () => {
    expect(types.lesser_demon).toEqual({
      name: 'Lesser Demon', level: 68, hp: 125, maxHit: 22, atk: 64, def: 55, scale: 1.8, style: 'melee', bodyColor: 14427686,
      accentColor: 1120295, kind: 'demon', weaponColor: 16347926, pattern: 'lesser_demon',
      drops: [
        { id: 'dragon_bones', chance: 1 }, { gp: [450, 980], chance: 1 }, { id: 'dragon_chain', chance: 0.01 },
        { id: 'dragon_legs', chance: 0.01 }, { id: 'dragon_scimitar', chance: 0.009 }, { id: 'shark', chance: 0.65 }
      ]
    });
  });

  it('shoots the hellfire orb through one typeKey branch beside the Lesser Demon\'s, and no other line names it', () => {
    const lines = readFileSync(new URL('../src/engine/actions.ts', import.meta.url), 'utf8').split('\n');
    const named = lines.map((l, i) => [l, i] as const).filter(([l]) => l.includes('ember_hurler'));
    expect(named).toHaveLength(1);
    const [line, i] = named[0];
    expect(line).toContain("monster.typeKey === 'lesser_demon' || monster.typeKey === 'ember_hurler'");
    expect(line).toMatch(/else if/);
    expect(lines[i + 1]).toContain('spawnHellfireOrb(');
  });
});

describe('the income bound (CALL-6.33 (a))', () => {
  it('every camp and both halls in turn pay at most 0.9 of the best open ground at level 70, with the cave\'s 13.5 s wait', () => {
    const wait = (cave as unknown as { respawnSecs: number }).respawnSecs;
    const open = openGroundBest(FIGHTER).rate;
    const kinds = (campId: string) => cave.camps.find((c) => c.id === campId)!.members.map((m) => m.type);
    const front = campRate(kinds('front'), FIGHTER, wait) / open;
    const back = campRate(kinds('back'), FIGHTER, wait) / open;
    // Both halls in turn: the six kills' cycle, then the walk between the halls' centres, there and back, times 1.5.
    const both = [...kinds('front'), ...kinds('back')];
    const pay = both.reduce((s, t) => s + killPay(t), 0);
    const centre = (r: Rect) => [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2];
    const [a, b] = [centre(FRONT_HALL), centre(BACK_HALL)];
    const walkSecs = (Math.hypot(a[0] - b[0], a[1] - b[1]) * 1.5 * 2) / WALK_SPEED;
    const turn = 1 / (1 / campRate(both, FIGHTER, wait) + walkSecs / pay) / open;
    console.log(`cave: front ${front.toFixed(3)}, back ${back.toFixed(3)}, both in turn ${turn.toFixed(3)} of ${open.toFixed(1)} GP/s (the Hurler's hide, 0.10, is added by K2)`);
    expect(front, 'front hall').toBeLessThanOrEqual(MAX_RATIO);
    expect(back, 'back hall').toBeLessThanOrEqual(MAX_RATIO);
    expect(turn, 'both in turn').toBeLessThanOrEqual(MAX_RATIO);
  });
});

describe('the cave\'s light', () => {
  const linear = (hex: string) => [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });

  afterEach(async () => {
    (await import('../src/engine/particles')).setCaveWeather(false);
  });

  it('CAVE_LIGHT is the frame of design 7.6 and is not a day key', () => {
    expect(CAVE_LIGHT).toEqual({ phase: 0, sunElevationDeg: 90, key: '#ff7a3a', keyIntensity: 0.3, zenith: '#2a120c', horizon: '#2a120c', air: '#3b1a12', fill: '#120a1a', bounce: '#ff6a1f', exposure: 1.2 });
    expect(DAY_KEYS).toHaveLength(6);
    expect(DAY_KEYS).not.toContain(CAVE_LIGHT);
  });

  it('frameOf(CAVE_LIGHT) looks straight down at no moon, in linear colour, with the key\'s own intensity and exposure', () => {
    const f = frameOf(CAVE_LIGHT);
    expect(f.sunDir).toEqual([0, 1, 0]);
    expect(f.keyIsMoon).toBe(false);
    expect([f.keyIntensity, f.exposure]).toEqual([0.3, 1.2]);
    for (const k of ['key', 'zenith', 'horizon', 'air', 'fill', 'bounce'] as const) {
      const want = linear(CAVE_LIGHT[k]);
      f[k].forEach((v, i) => expect(v, `${k}[${i}]`).toBeCloseTo(want[i], 6));
    }
  });

  it('frameOf of a day key equals dayFrameAt at its phase in every colour and in exposure', () => {
    for (const i of [2, 3]) {
      const k = DAY_KEYS[i];
      const f = frameOf(k);
      const d = dayFrameAt(k.phase);
      for (const c of ['key', 'zenith', 'horizon', 'air', 'fill', 'bounce'] as const) f[c].forEach((v, j) => expect(Math.abs(v - d[c][j]), `key ${i} ${c}[${j}]`).toBeLessThan(1e-6));
      expect(f.exposure).toBeCloseTo(d.exposure, 6);
    }
  });

  it('CAVE_FOG_SCALE is 3, and getWeatherState returns it as the fog scale, over ash_fall, while the cave weather is on', async () => {
    const particles = await import('../src/engine/particles');
    expect(CAVE_FOG_SCALE).toBe(3);
    particles.setCaveWeather(true);
    const w = particles.getWeatherState(0, 0.5);
    expect([w.id, w.blend, w.keyScale, w.fogScale]).toEqual(['ash_fall', 1, 1, CAVE_FOG_SCALE]);
    particles.setCaveWeather(false);
    expect(particles.getWeatherState(0, 0.5).fogScale).not.toBe(CAVE_FOG_SCALE);
  });
});
