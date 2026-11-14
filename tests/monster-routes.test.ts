import { readFileSync, writeFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CAMPS } from '../src/data/worldMap';
import { createMonsterLogic, onPlayerHit, stepMonster, type MonsterLogic } from '../src/state/monsterAi';
import { buildWalkGrid, escapeStall, findPath, openStart, segmentWalkable, STALL_SEC, type WalkGrid } from '../src/state/pathfind';

// Design 6.1 (G4.1): monsters chase and return on routes from the walk grid.
// findPath and escapeStall are passed through and counted, so a test sees every search the monster makes.
vi.mock('../src/state/pathfind', async (orig) => {
  const real = await orig<typeof import('../src/state/pathfind')>();
  return { ...real, findPath: vi.fn(real.findPath), escapeStall: vi.fn(real.escapeStall) };
});

const searches = vi.mocked(findPath);
const escapes = vi.mocked(escapeStall);
beforeEach(() => {
  searches.mockClear();
  escapes.mockClear();
});

const GOLDEN = new URL('./fixtures/monster-steps-golden.json', import.meta.url);
const UPDATE = process.env.UPDATE_GOLDEN === '1';
const DT = 1 / 60;
const SPEED = 5.2;
const realGrid = buildWalkGrid();

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const inBounds = (x: number, z: number) => x >= -118 && x <= 118 && z >= -118 && z <= 118;
/** A wall across x = 0 from z = -half to z = half, 1.2 thick. */
const wallGrid = (half: number) => buildWalkGrid((x, z) => inBounds(x, z) && !(Math.abs(x) < 0.6 && Math.abs(z) <= half));
const cellOpen = (g: WalkGrid, x: number, z: number) => g.cells[Math.floor(z - g.origin) * g.size + Math.floor(x - g.origin)] === 1;

function routeLength(from: [number, number], route: [number, number][]): number {
  let len = 0;
  let prev = from;
  for (const p of route) {
    len += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    prev = p;
  }
  return len;
}

/** A goblin at (x, z), home there, hit for 0 so it is in chase. */
function chaser(x: number, z: number, typeKey = 'goblin'): MonsterLogic {
  const m = createMonsterLogic(typeKey, x, z);
  onPlayerHit(m, 0);
  return m;
}

/** One frame with a grid. The monster never stands where the grid's walk test says no. */
function step(m: MonsterLogic, grid: WalkGrid, px: number, pz: number, budget = { left: 2 }, playerDown = false) {
  const events = stepMonster(m, { playerX: px, playerZ: pz, playerDown, dt: DT, rand: () => 0.5, grid, pathBudget: budget });
  expect(grid.walkable(m.x, m.z), `monster at (${m.x}, ${m.z})`).toBe(true);
  return events;
}

/** Searches made so far whose fifth argument is the monsters' cap. */
const cappedSearches = () => searches.mock.calls.filter((c) => c[4] === 6000).length;

describe('chase on a route (design 6.1)', () => {
  it('reaches a player behind a wall that a straight walk cannot pass', () => {
    const grid = wallGrid(6);
    expect(segmentWalkable(grid, [-5, 0], [5, 0])).toBe(false);
    const stats = { expanded: 0 };
    const pre = findPath(grid, [-5, 0], [3, 0], stats, 6000);
    expect(pre).not.toBeNull();
    expect(routeLength([-5, 0], pre!)).toBeLessThan(26);

    const m = chaser(-5, 0);
    let t = 0;
    for (; t < 10 && m.state !== 'attack'; t += DT) {
      step(m, grid, 5, 0);
      expect(m.state).not.toBe('return');
    }
    expect(m.state).toBe('attack');
    expect(Math.hypot(5 - m.x, 0 - m.z)).toBeLessThanOrEqual(2.9);
  });

  it('walks straight and makes no search when the segment is open', () => {
    expect(segmentWalkable(realGrid, [-4, -3], [-16, -3])).toBe(true);
    const m = chaser(-4, -3);
    const blind = chaser(-4, -3);
    for (let i = 0; i < 120 && m.state === 'chase'; i++) {
      const budget = { left: 2 };
      step(m, realGrid, -16, -3, budget);
      stepMonster(blind, { playerX: -16, playerZ: -3, playerDown: false, dt: DT, rand: () => 0.5 });
      expect(budget.left).toBe(2);
      expect(m.x).toBeCloseTo(blind.x, 9);
      expect(m.z).toBeCloseTo(blind.z, 9);
    }
    expect(m.state).toBe('attack');
    expect(cappedSearches()).toBe(0);
  });

  it('asks for a route at most every 0.5 s', () => {
    const grid = wallGrid(12);
    const m = chaser(-5, 0);
    const frames: number[] = [];
    for (let f = 0; f < 180 && m.state === 'chase'; f++) {
      // The target walks up and down behind the wall at 6 u/s, so a new route is always wanted.
      const pz = 5 - Math.abs(((f * DT * 6) % 20) - 10);
      const before = cappedSearches();
      step(m, grid, 5, pz);
      expect(m.state).not.toBe('return');
      if (cappedSearches() > before) frames.push(f);
    }
    expect(frames.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < frames.length; i++) {
      expect((frames[i] - frames[i - 1]) * DT).toBeGreaterThanOrEqual(0.5 - 1e-9);
    }
  });

  it('with the frame budget spent it makes no search and still moves', () => {
    const grid = wallGrid(6);
    const m = chaser(-5, 0);
    m.repathIn = 0;
    for (let i = 0; i < 60; i++) {
      const budget = { left: 0 };
      step(m, grid, 5, 0, budget);
      expect(budget.left).toBe(0);
      expect(m.state).toBe('chase');
    }
    expect(searches).not.toHaveBeenCalled();
    expect(m.x).toBeGreaterThan(-4);
    // The refused request is still pending: the first frame with quota serves it.
    const budget = { left: 2 };
    step(m, grid, 5, 0, budget);
    expect(cappedSearches()).toBe(1);
    expect(budget.left).toBe(1);
  });

  it('with pathBudget 1 and three monsters asking every frame, each is served within three frames when the caller rotates the start', () => {
    const grid = wallGrid(6);
    const ms = [chaser(-5, -2), chaser(-5, 0), chaser(-5, 2)];
    const served: number[][] = [[], [], []];
    for (let f = 0; f < 30; f++) {
      const pz = f % 2 === 0 ? 3 : -3; // the target is 6 from where it was: every route is stale
      const budget = { left: 1 };
      for (let k = 0; k < 3; k++) {
        const i = (f + k) % 3; // as updateMonsters will: one place further round each frame
        ms[i].repathIn = 0;
        const before = cappedSearches();
        step(ms[i], grid, 5, pz, budget);
        if (cappedSearches() > before) served[i].push(f);
      }
      expect(budget.left).toBeGreaterThanOrEqual(0);
    }
    for (let i = 0; i < 3; i++) {
      for (let f = 0; f + 2 < 30; f++) {
        expect(served[i].some((s) => s >= f && s <= f + 2), `monster ${i} unserved in frames ${f}-${f + 2}`).toBe(true);
      }
    }
  });

  it('a monster chasing a target that stands still asks for no second route', () => {
    const grid = wallGrid(6);
    const m = chaser(-5, 0);
    for (let t = 0; t < 10 && m.state !== 'attack'; t += DT) {
      const before = cappedSearches();
      step(m, grid, 5, 0);
      if (before === 0 && cappedSearches() === 1) {
        expect(m.pathGoalX).toBe(5);
        expect(m.pathGoalZ).toBe(0);
      }
    }
    expect(m.state).toBe('attack');
    expect(cappedSearches()).toBe(1);
  });

  it('a monster held on a route corner for STALL_SEC takes an escape cell (escapeStall) and keeps chasing', () => {
    // A snag finer than the cell grid: it is in grid.walkable only, so no search or smoothing sees it.
    let snag: { x: number; z: number; sx: number; sz: number } | null = null;
    const base = wallGrid(6);
    const grid: WalkGrid = {
      ...base,
      walkable: (x, z) => {
        if (!base.walkable(x, z)) return false;
        if (!snag) return true;
        const dx = x - snag.x;
        const dz = z - snag.z;
        if (Math.abs(dx) >= 0.6 || Math.abs(dz) >= 0.6) return true;
        return !(dx * snag.sx > 0.05 || dz * snag.sz > 0.05);
      }
    };
    const m = chaser(-5, 0);
    let t = 0;
    for (; t < 2 && cappedSearches() === 0; t += DT) step(m, grid, 5, 0);
    expect(cappedSearches()).toBe(1);
    const prev = [m.x, m.z];
    step(m, grid, 5, 0);
    t += DT;
    // Close the way ahead on both axes, where the monster stands.
    snag = { x: m.x, z: m.z, sx: Math.sign(m.x - prev[0]), sz: Math.sign(m.z - prev[1]) };
    const heldAt = t;
    let escapedAt = -1;
    for (; t < heldAt + 1 && escapedAt < 0; t += DT) {
      step(m, grid, 5, 0);
      expect(m.state).toBe('chase');
      if (escapes.mock.calls.length > 0) escapedAt = t;
    }
    expect(escapedAt).toBeGreaterThanOrEqual(heldAt + STALL_SEC - 2 * DT);
    expect(escapedAt).toBeLessThanOrEqual(heldAt + STALL_SEC + 0.2);
    snag = null;
    const stuckX = m.x;
    const stuckZ = m.z;
    for (; t < heldAt + 10 && m.state !== 'attack'; t += DT) {
      step(m, grid, 5, 0);
      expect(m.state).not.toBe('return');
    }
    expect(Math.hypot(m.x - stuckX, m.z - stuckZ)).toBeGreaterThan(0.45);
    expect(m.state).toBe('attack');
  });

  it('a search past the cap leads to return', () => {
    // The target stands in a sealed pocket: the search exhausts the cap and returns null.
    const grid = buildWalkGrid((x, z) => {
      const c = Math.max(Math.abs(x - 5), Math.abs(z));
      return inBounds(x, z) && !(c >= 2.4 && c <= 3.6);
    });
    expect(findPath(grid, [-5, 0], [5, 0], { expanded: 0 }, 6000)).toBeNull();
    searches.mockClear();
    const m = chaser(-5, 0);
    for (let t = 0; t < 1 && m.state === 'chase'; t += DT) step(m, grid, 5, 0);
    expect(m.state).toBe('return');
    const chaseCalls = searches.mock.calls.filter((c) => c[2][0] !== m.homeX || c[2][1] !== m.homeZ);
    expect(chaseCalls.length).toBeGreaterThan(0);
    for (const c of chaseCalls) expect(c[4]).toBe(6000);
  });

  it('a route longer than 52 leads to return', () => {
    const grid = wallGrid(30);
    const stats = { expanded: 0 };
    const pre = findPath(grid, [-6, 0], [6, 0], stats, 6000);
    expect(pre).not.toBeNull();
    expect(routeLength([-6, 0], pre!)).toBeGreaterThan(58);
    expect(stats.expanded).toBeLessThan(6000);
    searches.mockClear();
    const m = chaser(-6, 0);
    for (let t = 0; t < 1 && m.state === 'chase'; t += DT) step(m, grid, 6, 0);
    expect(m.state).toBe('return');
    // The chase search found a route (so the cap did not end it), and the route was too long.
    const chaseRoutes = searches.mock.calls
      .map((c, i) => ({ from: c[1], to: c[2], r: searches.mock.results[i] }))
      .filter((s) => s.to[0] !== m.homeX || s.to[1] !== m.homeZ);
    expect(chaseRoutes.length).toBeGreaterThan(0);
    expect(chaseRoutes.some((s) => s.r.type === 'return' && s.r.value !== null && routeLength(s.from, s.r.value) > 52)).toBe(true);
  });

  it('a monster whose cell centre is blocked still gets a route', () => {
    const grid = wallGrid(6);
    // Walkable point, blocked cell: the wall face.
    expect(grid.walkable(-0.7, 0)).toBe(true);
    expect(cellOpen(grid, -0.7, 0)).toBe(false);
    const m = chaser(-0.7, 0);
    for (let t = 0; t < 10 && m.state !== 'attack'; t += DT) {
      step(m, grid, 5, 0);
      expect(m.state).not.toBe('return');
    }
    expect(m.state).toBe('attack');
    expect(searches.mock.results.some((r) => r.type === 'return' && r.value !== null)).toBe(true);
  });
});

/** Puts a chasing monster at (x, z) and sends it home through a T5 cause (the player is down). */
function sendHome(m: MonsterLogic, grid: WalkGrid, x: number, z: number): void {
  onPlayerHit(m, 0);
  m.x = x;
  m.z = z;
  m.hp = 1;
  m.breathCount = 2;
  step(m, grid, 999, 999, { left: 2 }, true);
  expect(m.state).toBe('return');
}

describe('return on a route (design 6.1)', () => {
  it('return follows the route home over the bridge', () => {
    const m = createMonsterLogic('goblin', 12, 4, { campId: 'three_kettle' });
    // Where the bridge lure leaves it: east of the river, off the bridge deck (review 0).
    sendHome(m, realGrid, 35.21, 2.77);
    let onDeck = false;
    const events: string[] = [];
    for (let t = 0; t < 15 && m.state === 'return'; t += DT) {
      const px = m.x;
      const pz = m.z;
      events.push(...step(m, realGrid, 999, 999).map((e) => e.kind));
      // Arrival within 1.0 does not move it: no frame, the last one included, is a snap.
      expect(Math.hypot(m.x - px, m.z - pz)).toBeLessThanOrEqual(SPEED * DT + 1e-9);
      if (Math.abs(m.z) <= 2.05 && m.x >= 22 && m.x <= 34) onDeck = true;
    }
    expect(onDeck).toBe(true);
    expect(m.state).toBe('idle');
    expect(events).toContain('reset');
    expect(Math.hypot(m.x - m.homeX, m.z - m.homeZ)).toBeLessThanOrEqual(1.0);
    expect(m.hp).toBe(m.maxHp);
    expect(m.breathCount).toBe(0);
  });

  it('from 200 seeded points per camp, return reaches idle at full hitpoints within route time + 3 s', () => {
    const dt = 1 / 30;
    const late: string[] = [];
    for (const [ci, camp] of CAMPS.entries()) {
      const rand = seeded(7000 + ci);
      const R = camp.radius + 4 + 11;
      for (let i = 0; i < 200; i++) {
        let p: [number, number];
        do {
          const a = rand() * Math.PI * 2;
          const r = Math.sqrt(rand()) * R;
          p = [camp.x + Math.cos(a) * r, camp.z + Math.sin(a) * r];
        } while (!realGrid.walkable(p[0], p[1]));
        const mem = camp.members[i % camp.members.length];
        const start = openStart(realGrid, p[0], p[1]);
        const route = start ? findPath(realGrid, start, [mem.x, mem.z], undefined, 6000) : null;
        const bound = (route ? routeLength(p, [start!, ...route]) / SPEED : 0) + 3 + 2 * dt;

        const m = createMonsterLogic(mem.type, mem.x, mem.z, { campId: camp.id });
        sendHome(m, realGrid, p[0], p[1]);
        let t = 0;
        let reset = false;
        while (m.state === 'return' && t <= bound + 1) {
          const ev = stepMonster(m, { playerX: 999, playerZ: 999, playerDown: false, dt, rand: () => 0.5, grid: realGrid, pathBudget: { left: 2 } });
          if (ev.some((e) => e.kind === 'reset')) reset = true;
          t += dt;
        }
        if (m.state !== 'idle' || !reset || t > bound || m.hp !== m.maxHp) {
          late.push(`${camp.id} ${mem.type} from (${p[0].toFixed(2)}, ${p[1].toFixed(2)}): ${m.state} after ${t.toFixed(2)} s, bound ${bound.toFixed(2)} s, hp ${m.hp}/${m.maxHp}`);
        }
      }
    }
    expect(late).toEqual([]);
  });

  it('with the home walled in, the monster is put home when the clock runs out, with reset', () => {
    // A closed ring round the home at (0, 0); the monster is sent home from outside it.
    const grid = buildWalkGrid((x, z) => {
      const c = Math.max(Math.abs(x), Math.abs(z));
      return inBounds(x, z) && !(c >= 2.4 && c <= 3.6);
    });
    // From 14 away it still walks at the 1.5 s and 3 s stall checks: only the clock puts it home by 3 s.
    expect(findPath(grid, [-14, 0], [0, 0], { expanded: 0 }, 6000)).toBeNull();
    const m = createMonsterLogic('goblin', 0, 0);
    sendHome(m, grid, -14, 0);
    const events: string[] = [];
    let t = 0;
    for (; t < 6 && m.state === 'return'; t += DT) events.push(...step(m, grid, 999, 999).map((e) => e.kind));
    expect(m.state).toBe('idle');
    expect(t).toBeLessThanOrEqual(3 + 3 * DT);
    expect(events).toContain('reset');
    expect(m.x).toBe(m.homeX);
    expect(m.z).toBe(m.homeZ);
    expect(m.hp).toBe(m.maxHp);
    expect(m.breathCount).toBe(0);
  });
});

describe('wander (design 6.1)', () => {
  // The east half past x = 1 is blocked; the monster lives at (0, 0).
  const grid = buildWalkGrid((x, z) => inBounds(x, z) && x <= 1);
  const idleWorld = (rand: () => number, g?: WalkGrid) =>
    g
      ? { playerX: 999, playerZ: 999, playerDown: false, dt: DT, rand, grid: g, pathBudget: { left: 2 } }
      : { playerX: 999, playerZ: 999, playerDown: false, dt: DT, rand };
  const firstEast = () => {
    const seq = [0.5, 0, 0.9]; // timer, then an angle due east and a radius of 4.05: a blocked cell
    let i = 0;
    return () => (i < seq.length ? seq[i++] : 0.5);
  };

  it('with a grid, a wander point on a blocked cell is re-drawn; without a grid, wander draws exactly as today', () => {
    const blind = createMonsterLogic('goblin', 0, 0);
    blind.wanderTimer = 0;
    stepMonster(blind, idleWorld(firstEast()));
    expect(blind.wanderX).toBeCloseTo(4.05, 12);
    expect(blind.wanderZ).toBeCloseTo(0, 12);
    expect(cellOpen(grid, 4.05, 0)).toBe(false);

    const m = createMonsterLogic('goblin', 0, 0);
    m.wanderTimer = 0;
    stepMonster(m, idleWorld(firstEast(), grid));
    expect(cellOpen(grid, m.wanderX, m.wanderZ)).toBe(true);
    expect(Math.hypot(m.wanderX - 4.05, m.wanderZ)).toBeGreaterThan(0.5);
  });

  it('with a grid, a monster whose three draws are all blocked stays', () => {
    // A constant 0.9 draws (3.28, -2.38) every time: blocked.
    const m = createMonsterLogic('goblin', 0, 0);
    m.wanderTimer = 0;
    for (let i = 0; i < 120; i++) stepMonster(m, idleWorld(() => 0.9, grid));
    expect(m.x).toBe(0);
    expect(m.z).toBe(0);
    const blind = createMonsterLogic('goblin', 0, 0);
    blind.wanderTimer = 0;
    for (let i = 0; i < 120; i++) stepMonster(blind, idleWorld(() => 0.9));
    expect(Math.hypot(blind.x, blind.z)).toBeGreaterThan(1);
  });
});

// Today's stepMonster without a grid, recorded before P4. Only fields that exist today are compared.
type Frame = [number, number, string, string];

function scenario(name: 'chase' | 'leash' | 'wander'): Frame[] {
  const rand = seeded(name === 'chase' ? 11 : name === 'leash' ? 12 : 13);
  const m = name === 'wander'
    ? createMonsterLogic('chicken', -13, 4, { campId: 'hen_yard' })
    : createMonsterLogic('goblin', 12, 4, { campId: 'three_kettle' });
  let px = name === 'wander' ? 60 : 14;
  let pz = name === 'wander' ? 60 : 6;
  if (name !== 'wander') onPlayerHit(m, 0);
  const frames: Frame[] = [];
  let t = 0;
  while (t < 30) {
    const dt = 1 / 40 + rand() / 40;
    t += dt;
    if (name === 'chase') {
      px = 14 + Math.cos(t * 0.7) * 5;
      pz = 8 + Math.sin(t * 0.7) * 5;
    } else if (name === 'leash') {
      px = Math.max(-30, px - 3 * dt);
      pz = 5;
    }
    const ev = stepMonster(m, { playerX: px, playerZ: pz, playerDown: false, dt, rand, playerCombat: 3, playerSafe: false, camps: CAMPS });
    frames.push([m.x, m.z, m.state, ev.map((e) => e.kind).join(',')]);
  }
  return frames;
}

describe('without a grid (design 6.1)', () => {
  it('without a grid, positions equal the golden step for step over 30 s', () => {
    const live = { chase: scenario('chase'), leash: scenario('leash'), wander: scenario('wander') };
    if (UPDATE) {
      writeFileSync(GOLDEN, JSON.stringify(live) + '\n');
      return;
    }
    const golden = JSON.parse(readFileSync(GOLDEN, 'utf8')) as typeof live;
    for (const key of ['chase', 'leash', 'wander'] as const) {
      const want = golden[key];
      const got = live[key];
      expect(got.length, key).toBe(want.length);
      got.forEach((f, i) => {
        expect(Math.abs(f[0] - want[i][0]), `${key} step ${i} x`).toBeLessThan(1e-9);
        expect(Math.abs(f[1] - want[i][1]), `${key} step ${i} z`).toBeLessThan(1e-9);
        expect(f[2], `${key} step ${i} state`).toBe(want[i][2]);
        expect(f[3], `${key} step ${i} events`).toBe(want[i][3]);
      });
    }
  });
});
