import { describe, expect, it } from 'vitest';
import { ATTACKS, BOSSES, BOSS_ARENA_MARGIN, CADENCE_SECS, PATTERNS } from '../src/data/attacks';
import { ITEMS, unitSellPrice } from '../src/data/items';
import { NODE_PLACEMENTS } from '../src/data/placements';
import { MONSTER_TYPES } from '../src/data/world';
import { CAMPS, PATHS, SAFE_ZONES, type CampDef } from '../src/data/worldMap';
import { TICK_SEC } from '../src/engine/context';
import { playerAttackProfile, playerHitChance } from '../src/state/combat';
import { isWalkable } from '../src/state/collision';
import { createDefaultState } from '../src/state/gameState';
import { DEAD_SECS, DYING_SECS } from '../src/state/monsterAi';
import { buildWalkGrid } from '../src/state/pathfind';
import { minWindupMs } from '../src/state/telegraph';

// Stage 6 slice 1, task D3: the roster of design 7.5 and 7.7 (Cinder Adept, Slag Brute, Marrowjaw), their three camps and
// Marrowjaw's boss row. Red until D4 adds the rows. Every number is read from the design, never from the data file.
// The O-6.1b answers of 2026-11-26 win over older text: Marrowjaw's arena is radius 12 and `tollmaster` stands at (7, -73);
// the Slag Brute takes the hill giant's pattern; the boss takes Ashmantle's marks and phase shift and no opening roar.
// Stage 4's full arena criterion (tests/world-data-combat.test.ts 65-115) runs on `tollmaster` through that file's declared
// list edit; the cases here add the two O-6.1b.4 conditions by name.

// The ten meshes of monsters.glb: every new row reuses one of them (Stage 4's tests/new-monsters.test.ts).
const MESHES = ['chicken', 'goblin', 'scorpion', 'dark_wizard', 'hill_giant', 'moss_guardian', 'lesser_demon', 'elvarg_dragon', 'goblin_archer', 'dark_ranger'];

type Row = Record<string, unknown> & { name: string; level: number; hp: number; maxHit: number; atk: number; def: number; style: string; model?: string; modelScale?: number; pattern?: string; drops: { id?: string; chance: number; gp?: [number, number]; qty?: number }[] };
const row = (k: string): Row => {
  const r = (MONSTER_TYPES as Record<string, unknown>)[k] as Row | undefined;
  if (!r) throw new Error(`roster-s6: MONSTER_TYPES has no ${k}`);
  return r;
};
const camp = (id: string): CampDef => {
  const c = CAMPS.find((x) => x.id === id);
  if (!c) throw new Error(`roster-s6: CAMPS has no ${id}`);
  return c;
};
const meanCoin = (r: Row): number => {
  const gp = r.drops.find((d) => d.gp);
  if (!gp?.gp) throw new Error(`${r.name} has no coin drop`);
  return ((gp.gp[0] + gp.gp[1]) / 2) * gp.chance;
};

describe('design 7.5: the three rows', () => {
  const want: Record<string, { name: string; level: number; hp: number; maxHit: number; atk: number; def: number; style: string; model: string; modelScale: number }> = {
    cinder_adept: { name: 'Cinder Adept', level: 52, hp: 80, maxHit: 17, atk: 49, def: 36, style: 'magic', model: 'dark_wizard', modelScale: 1.08 },
    slag_brute: { name: 'Slag Brute', level: 58, hp: 112, maxHit: 19, atk: 54, def: 48, style: 'melee', model: 'hill_giant', modelScale: 1.12 },
    marrowjaw: { name: 'Marrowjaw the Tollmaster', level: 40, hp: 560, maxHit: 21, atk: 52, def: 30, style: 'melee', model: 'hill_giant', modelScale: 1.3 }
  };

  it.each(Object.entries(want))('%s has the stats of design 7.5 and an existing mesh', (key, w) => {
    const r = row(key);
    expect({ name: r.name, level: r.level, hp: r.hp, maxHit: r.maxHit, atk: r.atk, def: r.def, style: r.style, model: r.model, modelScale: r.modelScale }).toEqual(w);
    expect(MESHES, `${key}.model`).toContain(r.model);
  });

  it('the Adept casts Hexfall and the Brute slams: the existing patterns of Stage 4 (O-6.1b.3)', () => {
    expect(PATTERNS[row('cinder_adept').pattern!]).toEqual(['basic', 'basic', 'basic', 'hexfall']);
    expect(PATTERNS[row('slag_brute').pattern!]).toEqual(['basic', 'basic', 'basic', 'overhead_slam']);
  });

  it("the Adept's coins are 230 to 550 and the Brute's 340 to 770, always dropped (critique H1)", () => {
    expect(row('cinder_adept').drops).toContainEqual({ gp: [230, 550], chance: 1 });
    expect(row('slag_brute').drops).toContainEqual({ gp: [340, 770], chance: 1 });
  });

  it('their coins per hitpoint sit between the moss guardian and the lesser demon (the line of design 7.5)', () => {
    const perHp = (k: string) => meanCoin(row(k)) / row(k).hp;
    for (const k of ['cinder_adept', 'slag_brute']) {
      expect(perHp(k), k).toBeGreaterThan(perHp('moss_guardian'));
      expect(perHp(k), k).toBeLessThan(perHp('lesser_demon'));
    }
    expect(perHp('cinder_adept')).toBeLessThan(perHp('slag_brute'));
  });

  it('none of the three drops equipment, and each drops its bones', () => {
    for (const k of Object.keys(want)) {
      for (const d of row(k).drops) if (d.id) expect(ITEMS[d.id].type, `${k} ${d.id}`).not.toBe('equip');
      expect(row(k).drops.some((d) => d.id === 'big_bones' && d.chance === 1), k).toBe(true);
    }
  });

  it("Marrowjaw's table ends with one Runite Bar at 0.125 (design 7.6) and gives 2 lobsters", () => {
    const d = row('marrowjaw').drops;
    expect(d[d.length - 1]).toMatchObject({ id: 'runite_bar', chance: 0.125 });
    expect(d[d.length - 1].qty ?? 1).toBe(1);
    expect(d).toContainEqual({ id: 'lobster', chance: 1, qty: 2 });
    expect(d).toContainEqual({ gp: [600, 1200], chance: 1 });
  });
});

describe('design 7.7: the boss row of Marrowjaw', () => {
  const boss = () => (BOSSES as Record<string, (typeof BOSSES)[string]>).marrowjaw;
  const ids = (p: { pattern: unknown }): string[] => (Array.isArray(p.pattern) ? (p.pattern as string[]) : PATTERNS[p.pattern as string]);

  it('respawns in 180 s, in an arena of 12, with Ashmantle\'s marks, no opening roar and no title', () => {
    const b = boss();
    expect(b, 'BOSSES.marrowjaw').toBeDefined();
    expect(b.respawnSecs).toBe(180);
    expect(b.arenaRadius).toBe(12);
    expect(b.title).toBeUndefined();
    expect(b.openingShiftMs).toBe(0);
    expect(b.mark).toEqual({ step: 0.25, max: 4, secs: 12 });
    expect(b.mark).toEqual(BOSSES.ashmantle.mark);
    expect(b, 'hitpoints live in the monster row').not.toHaveProperty('hp');
  });

  it('has two phases: The Toll to half health, The Reckoning to zero, each shifting in 2,000 ms, patterns of design 7.7', () => {
    const p = boss().phases;
    expect(p.map((x) => x.untilHpFrac)).toEqual([0.5, 0]);
    expect(p.map((x) => x.cadenceMult)).toEqual([1, 1]);
    expect(p.map((x) => x.shiftMs)).toEqual([2000, 2000]);
    expect(p.map(ids)).toEqual([
      ['basic', 'basic', 'toll_slam', 'basic'],
      ['camp_sweep', 'toll_slam', 'basic', 'basic']
    ]);
  });

  it('Toll Slam and Camp Sweep: shapes, wind-ups and powers of design 7.7, and the names of design 7.10', () => {
    const toll = ATTACKS.toll_slam;
    const sweep = ATTACKS.camp_sweep;
    expect(toll.name).toBe('Toll Slam');
    expect(sweep.name).toBe('Camp Sweep');
    expect(toll.shape).toEqual({ type: 'circle', anchor: 'target', radius: 3 });
    expect(sweep.shape).toEqual({ type: 'circle', anchor: 'self', radius: 5 });
    expect([toll.windupMs, toll.power, toll.style]).toEqual([1800, 26, 'melee']);
    expect([sweep.windupMs, sweep.power, sweep.style]).toEqual([1900, 30, 'melee']);
  });

  it("passes Stage 4's attack-table rules: wind-up at least minWindupMs + 200 and 1,100 ms, a recovery of 150 ms in every slot, boss damage under 60 unmarked", () => {
    for (const phase of boss().phases) {
      for (const id of ids(phase)) {
        if (id === 'basic') continue;
        const a = ATTACKS[id];
        expect(a, id).toBeDefined();
        expect(a.windupMs, id).toBeGreaterThanOrEqual(minWindupMs(a) + 200);
        expect(a.windupMs, id).toBeGreaterThanOrEqual(1100);
        const slotMs = Math.max(a.slots * CADENCE_SECS * phase.cadenceMult * 1000, a.windupMs + 150);
        expect(slotMs - a.windupMs, id).toBeGreaterThanOrEqual(150);
        expect(a.power, id).toBeGreaterThan(0);
        expect(a.power!, id).toBeLessThan(60);
      }
    }
    expect(ids(boss().phases[0])[0]).toBe('basic');
  });
});

// ---------------------------------------------------------------- camps on the real world
// The section-6 rules of the content model (model.ts campPlacement), on the live tables: a camp reaches its leash (radius + 4),
// a boss camp its arena + 6. Every other camp, safe zone, path, node and Ashmantle's arena must be clear of that reach.
const leash = (c: CampDef) => c.radius + 4;
const reachOf = (c: CampDef) => (c.arenaRadius ? c.arenaRadius + BOSS_ARENA_MARGIN : leash(c));
const inCamp = (c: CampDef, x: number, z: number) => Math.hypot(x - c.x, z - c.z) <= c.radius;

function polylineDistance(points: [number, number][], x: number, z: number): number {
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1];
    const [bx, bz] = points[i];
    const lx = bx - ax;
    const lz = bz - az;
    const len2 = lx * lx + lz * lz;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * lx + (z - az) * lz) / len2));
    best = Math.min(best, Math.hypot(x - (ax + lx * t), z - (az + lz * t)));
  }
  return best;
}

describe('design 7.5: the three overworld camps', () => {
  const NEW_CAMPS: [string, string, number, number | undefined][] = [
    ['cinder_circle', 'cinder_adept', 3, 12],
    ['brute_shelf', 'slag_brute', 2, 9],
    ['tollmaster', 'marrowjaw', 1, 9]
  ];

  it.each(NEW_CAMPS)('%s holds its members and is aggressive with its radius', (id, type, n, aggro) => {
    const c = camp(id);
    expect(c.members).toHaveLength(n);
    for (const m of c.members) expect(m.type).toBe(type);
    expect(c.aggressive).toBe(true);
    expect(c.aggroRadius).toBe(aggro);
  });

  it('only tollmaster keeps its sight (design 7.13); the other two shrink their sight with the level gap', () => {
    expect(camp('tollmaster').keepsSight).toBe(true);
    expect(camp('cinder_circle').keepsSight).toBeFalsy();
    expect(camp('brute_shelf').keepsSight).toBeFalsy();
  });

  it('tollmaster is the only new camp with an arena, of radius 12, and it matches the boss row', () => {
    expect(camp('tollmaster').arenaRadius).toBe(12);
    expect(camp('tollmaster').arenaRadius).toBe(BOSSES.marrowjaw.arenaRadius);
    expect(camp('cinder_circle').arenaRadius).toBeUndefined();
    expect(camp('brute_shelf').arenaRadius).toBeUndefined();
  });

  it.each(NEW_CAMPS)('%s: members inside the camp on walkable ground, every cell of its reach open', (id) => {
    const c = camp(id);
    for (const m of c.members) {
      expect(inCamp(c, m.x, m.z), `${id} ${m.type} (${m.x}, ${m.z}) inside`).toBe(true);
      expect(isWalkable(m.x, m.z), `${id} ${m.type} (${m.x}, ${m.z}) walkable`).toBe(true);
    }
    const reach = reachOf(c);
    const closed: string[] = [];
    for (let dx = -reach; dx <= reach; dx++) {
      for (let dz = -reach; dz <= reach; dz++) {
        if (Math.hypot(dx, dz) <= reach && !isWalkable(c.x + dx, c.z + dz)) closed.push(`(${c.x + dx}, ${c.z + dz})`);
      }
    }
    expect(closed.slice(0, 10), `${id}: blocked cells inside its reach of ${reach}`).toEqual([]);
  });

  it.each(NEW_CAMPS)('%s: no safe zone, path or node inside its reach, and clear of every other camp and of Ashmantle\'s arena plus 6', (id) => {
    const c = camp(id);
    const reach = reachOf(c);
    const fails: string[] = [];
    for (const s of SAFE_ZONES) if (Math.hypot(s.x - c.x, s.z - c.z) - s.radius - reach < 0) fails.push(`safe zone ${s.id}`);
    for (const p of PATHS) if (polylineDistance(p.points, c.x, c.z) - p.halfWidth - reach < 0) fails.push(`path ${p.id}`);
    for (const n of NODE_PLACEMENTS) if (Math.hypot(n.x - c.x, n.z - c.z) - reach < 0) fails.push(`node ${n.type} (${n.x}, ${n.z})`);
    for (const o of CAMPS) {
      if (o === c) continue;
      // another camp's reach is its leash, or its arena plus the 6 of the boss margin: Ashmantle's arena plus 6 is the second case
      if (Math.hypot(o.x - c.x, o.z - c.z) - reachOf(o) - reach < 0) fails.push(`camp ${o.id}`);
    }
    expect(fails, id).toEqual([]);
  });

  it("tollmaster stands more than 35 from thornwatch and its arena has more than 400 open cells (O-6.1b.4)", () => {
    const c = camp('tollmaster');
    const t = camp('thornwatch');
    expect(Math.hypot(c.x - t.x, c.z - t.z)).toBeGreaterThan(35);
    const grid = buildWalkGrid();
    let cells = 0;
    for (let id = 0; id < grid.cells.length; id++) {
      const cx = grid.origin + (id % grid.size) + 0.5;
      const cz = grid.origin + ((id / grid.size) | 0) + 0.5;
      if (Math.hypot(cx - c.x, cz - c.z) <= 12 && grid.cells[id] === 1) cells++;
    }
    expect(cells).toBeGreaterThan(400);
  });
});

// ---------------------------------------------------------------- Marrowjaw's income (design 7.7, critique second pass)
// D1's 25% rule exempts bosses, so this bound holds Marrowjaw's table: its coins plus its non-bone, non-food drops at sale value,
// every entry at its chance, per second of its 180 s return, is at most 0.9 times the best open ground at its level. Open
// ground is Stage 3's rule (design 4.2) for a melee hero with every fighting skill at 35 in adamant: each kill costs its fight
// plus 1.5 s, or the camp's shared respawn wait if longer; monsters up to ten levels above the skills; bosses left out. The
// bound is the dimensionless ratio, never a duration (Stage 3 rule 10); Z3's tests/support/income.ts generalises this later.
describe("Marrowjaw's table against open ground", () => {
  const SKILL = 35;
  const meanRoll = (max: number) => (1 + (max * (max + 1)) / 2) / (max + 1);
  const isBones = (id: string) => id === 'bones' || id === 'big_bones' || id === 'dragon_bones';
  const goods = (r: Row) =>
    r.drops.reduce((s, d) => (d.id && !isBones(d.id) && ITEMS[d.id].type !== 'food' ? s + d.chance * (d.qty ?? 1) * unitSellPrice(ITEMS[d.id]) : s), 0);

  function hero() {
    const s = createDefaultState();
    for (const k of ['attack', 'strength', 'defence', 'hitpoints']) s.skills[k].lvl = SKILL;
    s.maxHp = SKILL;
    s.hp = SKILL;
    for (const slot of Object.keys(s.equipment)) s.equipment[slot] = null;
    for (const [slot, id] of Object.entries({ weapon: 'addy_scimitar', body: 'addy_plate', legs: 'addy_legs' })) {
      if (!Object.hasOwn(ITEMS, id)) throw new Error(`roster-s6: unknown item ${id}`);
      s.equipment[slot] = id;
    }
    s.combatStyle = 'controlled';
    return s;
  }

  it('is at most 0.9 times the GP per second of the best open ground', () => {
    const state = hero();
    const { maxHit, accuracy } = playerAttackProfile(state);
    const size: Record<string, number> = {};
    for (const c of CAMPS) {
      for (const m of c.members) size[m.type] = Math.max(size[m.type] ?? 0, c.members.filter((x) => x.type === m.type).length);
    }
    let best = 0;
    let bestType = '';
    for (const [type, n] of Object.entries(size)) {
      const r = row(type);
      if (r.level > SKILL + 10 || Object.hasOwn(BOSSES, type) || type === 'marrowjaw' || type === 'elvarg_dragon') continue;
      const kill = (r.hp / (playerHitChance(accuracy, r.def) * meanRoll(maxHit))) * TICK_SEC;
      const rate = (meanCoin(r) + goods(r)) / Math.max(kill + 1.5, (DYING_SECS + DEAD_SECS + kill) / n);
      if (rate > best) { best = rate; bestType = type; }
    }
    expect(best, 'a best open-ground type exists').toBeGreaterThan(0);
    const m = row('marrowjaw');
    const rate = (meanCoin(m) + goods(m)) / BOSSES.marrowjaw.respawnSecs;
    // eslint-disable-next-line no-console
    console.log(`Marrowjaw ${rate.toFixed(1)} GP/s against ${bestType} ${best.toFixed(1)} GP/s: ratio ${(rate / best).toFixed(2)}`);
    expect(rate, `Marrowjaw against ${bestType}`).toBeLessThanOrEqual(0.9 * best);
  });
});
