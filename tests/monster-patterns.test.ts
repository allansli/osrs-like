import { describe, expect, it } from 'vitest';
import { ATTACKS, CADENCE_SECS, CAMP_WINDUP_GAP_SECS, PATTERNS, TELEGRAPH_TIME_SCALE } from '../src/data/attacks';
import { MONSTER_TYPES } from '../src/data/world';
import { CAMPS, isInSafeZone, type CampDef } from '../src/data/worldMap';
import { combatLevel } from '../src/state/adventure';
import { rollMonsterAttack, rollMonsterHit } from '../src/state/combat';
import { createDefaultState } from '../src/state/gameState';
import {
  createMonsterLogic,
  onPlayerHit,
  stepMonster,
  tickWindupGates,
  type MonsterEvent,
  type MonsterLogic,
  type StepWorld
} from '../src/state/monsterAi';
import { inShape } from '../src/state/telegraph';
import type { GameState } from '../src/state/types';

// The pattern state machine (design 6.2 steps 1 to 4, the camp wind-up gate, 9.1 G4.2; plan T3).
// Red until T4 adds the `windup`, `resolve` and `cancel` events, `MonsterLogic.windup`, `StepWorld.windupGate`,
// `tickWindupGates` and `rollMonsterAttack`. The phase-shift cancel of 9.1 needs the boss (B2) and is B1's test.
//
// Conventions these tests fix where the plan leaves a choice open:
// - the wind-up lasts `windupMs * TELEGRAPH_TIME_SCALE`, and the `windup` event's `ms` is that value;
// - the engine ticks the gate once per frame, before it steps the monsters (`tickWindupGates(gate, dt)`);
// - `rollMonsterAttack` may return the damage or an object with `dmg`, as `rollMonsterHit` does;
// - a death during a wind-up may emit its `cancel` from `onPlayerHit` or from the next `stepMonster`.

const DT = 1 / 60;
const NO_MARKS = { count: 0, left: 0 };

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

type Windup = Extract<MonsterEvent, { kind: 'windup' }>;
type Rec = { t: number; ev: MonsterEvent };

const PATTERNED = Object.entries(MONSTER_TYPES)
  .filter(([, d]) => d.pattern !== undefined)
  .map(([key]) => key);

function heavyOf(typeKey: string): string {
  const pattern = MONSTER_TYPES[typeKey].pattern;
  if (!pattern) throw new Error(`monster-patterns: ${typeKey} has no pattern`);
  const heavy = PATTERNS[pattern].find((id) => id !== 'basic');
  if (!heavy) throw new Error(`monster-patterns: pattern ${pattern} has no heavy`);
  return heavy;
}

/** Wind-up seconds of an attack row. */
function windSecs(attackId: string): number {
  return (ATTACKS[attackId].windupMs * TELEGRAPH_TIME_SCALE) / 1000;
}

/** Slot seconds of a heavy (design 6.2 step 3). */
function slotSecs(attackId: string): number {
  return Math.max(ATTACKS[attackId].slots * CADENCE_SECS, windSecs(attackId) + 0.15);
}

/** Where a target stands to be in reach and in every ordinary heavy's shape: melee 1.5, far 6, along +x. */
function standOff(m: MonsterLogic): number {
  return m.style === 'magic' || m.style === 'ranged' ? 6 : 1.5;
}

/** A monster of `typeKey` at (hx, hz), hit once for 0 so it is in chase. */
function engaged(typeKey: string, hx = 0, hz = 0, campId?: string): MonsterLogic {
  const m = createMonsterLogic(typeKey, hx, hz, { campId });
  onPlayerHit(m, 0);
  return m;
}

type Script = (t: number, m: MonsterLogic) => Partial<StepWorld> & { playerX: number; playerZ: number };

/** Steps one monster for `secs`; the world of each frame comes from `script`. */
function simulate(m: MonsterLogic, secs: number, script: Script, rand = seeded(1)): Rec[] {
  const out: Rec[] = [];
  const frames = Math.round(secs / DT);
  for (let i = 0; i < frames; i++) {
    const t = i * DT;
    const w = script(t, m);
    for (const ev of stepMonster(m, { playerDown: false, dt: DT, rand, ...w })) out.push({ t, ev });
  }
  return out;
}

const isSlot = (ev: MonsterEvent): boolean => ev.kind === 'attack' || ev.kind === 'windup';

function firstWindup(recs: Rec[]): { t: number; ev: Windup } {
  for (const r of recs) if (r.ev.kind === 'windup') return { t: r.t, ev: r.ev };
  throw new Error('monster-patterns: no windup was emitted');
}

/** Runs until the first wind-up begins and returns its time and event. */
function untilWindup(m: MonsterLogic, script: Script, rand = seeded(1)): { t: number; ev: Windup } {
  for (let i = 0; i < Math.round(30 / DT); i++) {
    const t = i * DT;
    for (const ev of stepMonster(m, { playerDown: false, dt: DT, rand, ...script(t, m) })) {
      if (ev.kind === 'windup') return { t, ev };
    }
  }
  throw new Error(`monster-patterns: ${m.typeKey} never wound up`);
}

describe('the life of a heavy attack', () => {
  for (const typeKey of PATTERNED) {
    it(`${typeKey}: basic, basic, basic, wind-up; resolve windupMs later; next slot after slots x cadence`, () => {
      const m = engaged(typeKey);
      const px = standOff(m);
      const heavy = heavyOf(typeKey);
      const recs = simulate(m, 3 * 4 * CADENCE_SECS + 2 * slotSecs(heavy), () => ({ playerX: px, playerZ: 0 }));
      const slots = recs.filter((r) => isSlot(r.ev));
      expect(slots.slice(0, 8).map((r) => r.ev.kind)).toEqual([
        'attack', 'attack', 'attack', 'windup', 'attack', 'attack', 'attack', 'windup'
      ]);
      expect(slots[0].t).toBeLessThanOrEqual(DT);

      const w = firstWindup(recs);
      expect(w.ev.attackId).toBe(heavy);
      expect(w.ev.ms).toBeCloseTo(windSecs(heavy) * 1000, 6);
      // The shape locks on the target (circle at the target) or on the monster, pointing at the target.
      const shape = ATTACKS[heavy].shape;
      const atTarget = shape.type === 'circle' && shape.anchor === 'target';
      expect(w.ev.ox).toBeCloseTo(atTarget ? px : 0, 9);
      expect(w.ev.oz).toBeCloseTo(0, 9);
      expect(w.ev.dx).toBeCloseTo(1, 9);
      expect(w.ev.dz).toBeCloseTo(0, 9);

      const after = recs.filter((r) => r.t > w.t);
      const resolveAt = after.findIndex((r) => r.ev.kind === 'resolve' || r.ev.kind === 'cancel');
      expect(resolveAt).toBeGreaterThanOrEqual(0);
      const res = after[resolveAt];
      if (res.ev.kind !== 'resolve') throw new Error(`${typeKey}: the wind-up was cancelled`);
      expect(res.ev.attackId).toBe(heavy);
      expect(res.ev.hit).toBe(true);
      expect(res.ev.hit).toBe(inShape(shape, w.ev.ox, w.ev.oz, w.ev.dx, w.ev.dz, px, 0));
      expect(Math.abs(res.t - w.t - windSecs(heavy))).toBeLessThanOrEqual(DT + 1e-9);
      // Nothing is dealt during the wind-up.
      expect(after.slice(0, resolveAt).some((r) => r.ev.kind === 'attack')).toBe(false);

      const next = after.find((r) => isSlot(r.ev));
      expect(next?.ev.kind).toBe('attack');
      expect(Math.abs((next?.t ?? Infinity) - w.t - slotSecs(heavy))).toBeLessThanOrEqual(DT + 1e-9);
    });
  }

  it('a type without a pattern emits only attacks, one per cadence (chicken, goblin, goblin archer, the existing dragon)', () => {
    for (const typeKey of ['chicken', 'goblin', 'goblin_archer', 'elvarg_dragon']) {
      const m = engaged(typeKey);
      const recs = simulate(m, 60, () => ({ playerX: standOff(m), playerZ: 0 }));
      expect(recs.length, typeKey).toBeGreaterThan(30);
      for (const r of recs) expect(r.ev.kind, typeKey).toBe('attack');
      for (let i = 1; i < recs.length; i++) {
        expect(Math.abs(recs[i].t - recs[i - 1].t - CADENCE_SECS), typeKey).toBeLessThanOrEqual(DT + 1e-9);
      }
    }
  });

  it('every windup is followed by exactly one resolve or cancel, through moves, leaves, downs, safety and deaths', () => {
    const camp: CampDef = { id: 'patterns_camp', x: 0, z: 0, radius: 8, aggressive: true, members: [] };
    let windups = 0, resolves = 0, cancels = 0;
    for (const typeKey of PATTERNED) {
      for (let seed = 1; seed <= 10; seed++) {
        const script = seeded(1000 + seed);
        const rand = seeded(seed);
        const m = engaged(typeKey, 0, 0, camp.id);
        let open = false;
        let px = 1.5, pz = 0, down = false, safe = false;
        const take = (evs: MonsterEvent[], where: string) => {
          for (const ev of evs) {
            if (ev.kind === 'windup') {
              expect(open, `${typeKey} seed ${seed} ${where}: a second windup before the first closed`).toBe(false);
              open = true;
              windups++;
            } else if (ev.kind === 'resolve' || ev.kind === 'cancel') {
              expect(open, `${typeKey} seed ${seed} ${where}: ${ev.kind} without a windup`).toBe(true);
              open = false;
              if (ev.kind === 'resolve') resolves++;
              else cancels++;
            }
          }
        };
        for (let i = 0; i < Math.round(90 / DT); i++) {
          if (i % 40 === 0) {
            const r = script();
            const dist = [1.2, 2.5, 5, 9, 14, 30][Math.floor(script() * 6)];
            const ang = script() * Math.PI * 2;
            px = m.x + Math.cos(ang) * dist;
            pz = m.z + Math.sin(ang) * dist;
            down = r < 0.06;
            safe = r > 0.94;
          } else {
            px += (script() - 0.5) * 0.2;
            pz += (script() - 0.5) * 0.2;
          }
          if (m.state === 'idle' && script() < 0.02) take(onPlayerHit(m, 0).events, 'engage');
          if (open && script() < 0.01) take(onPlayerHit(m, m.hp).events, 'kill');
          take(
            stepMonster(m, { playerX: px, playerZ: pz, playerDown: down, playerSafe: safe, dt: DT, rand, camps: [camp] }),
            `t=${(i * DT).toFixed(2)}`
          );
        }
      }
    }
    // The run must exercise both endings.
    expect(windups).toBeGreaterThan(50);
    expect(resolves).toBeGreaterThan(10);
    expect(cancels).toBeGreaterThan(10);
  });

  it('the pattern starts over on entering combat from idle and after a reset', () => {
    const m = engaged('hill_giant');
    const two = simulate(m, CADENCE_SECS + 0.5, () => ({ playerX: 1.5, playerZ: 0 }));
    expect(two.map((r) => r.ev.kind)).toEqual(['attack', 'attack']);
    const home = simulate(m, 1, () => ({ playerX: 40, playerZ: 0 }));
    expect(home.map((r) => r.ev.kind)).toContain('reset');
    expect(m.state).toBe('idle');
    onPlayerHit(m, 0);
    const again = simulate(m, 4 * CADENCE_SECS, () => ({ playerX: 1.5, playerZ: 0 }));
    expect(again.filter((r) => isSlot(r.ev)).map((r) => r.ev.kind)).toEqual(['attack', 'attack', 'attack', 'windup']);
  });
});

describe('a locked shape', () => {
  it('does not follow a target that moves: a circle at the target stays where the target stood', () => {
    const m = engaged('dark_wizard');
    const w = untilWindup(m, () => ({ playerX: 6, playerZ: 0 }));
    expect(w.ev.ox).toBeCloseTo(6, 9);
    expect(w.ev.oz).toBeCloseTo(0, 9);
    // The target walks 3.2 sideways during the wind-up, staying in the wizard's reach.
    const recs = simulate(m, windSecs(w.ev.attackId) + 0.2, (t) => ({ playerX: 6, playerZ: Math.min(3.2, t * 4) }));
    expect(recs.some((r) => r.ev.kind === 'cancel')).toBe(false);
    const res = recs.find((r) => r.ev.kind === 'resolve');
    if (!res || res.ev.kind !== 'resolve') throw new Error('dark_wizard: no resolve');
    expect(res.ev.hit).toBe(false);
    expect(inShape(ATTACKS[w.ev.attackId].shape, w.ev.ox, w.ev.oz, w.ev.dx, w.ev.dz, 6, 3.2)).toBe(false);
  });

  it('does not turn with a target that moves: a cone keeps its locked direction', () => {
    const m = engaged('scorpion');
    const w = untilWindup(m, () => ({ playerX: 1.5, playerZ: 0 }));
    expect(w.ev.dx).toBeCloseTo(1, 9);
    expect(w.ev.dz).toBeCloseTo(0, 9);
    // The target circles a quarter turn round the scorpion, inside its reach the whole time.
    const end = windSecs(w.ev.attackId) * 0.8;
    const recs = simulate(m, windSecs(w.ev.attackId) + 0.2, (t) => {
      const a = (Math.min(t, end) / end) * (Math.PI / 2);
      return { playerX: Math.cos(a) * 1.5, playerZ: Math.sin(a) * 1.5 };
    });
    expect(recs.some((r) => r.ev.kind === 'cancel')).toBe(false);
    const res = recs.find((r) => r.ev.kind === 'resolve');
    if (!res || res.ev.kind !== 'resolve') throw new Error('scorpion: no resolve');
    expect(res.ev.hit).toBe(false);
  });
});

describe('leaving, standing and cancelling', () => {
  it('a target that leaves attack range during a wind-up does not cancel it; the resolve misses', () => {
    const m = engaged('hill_giant');
    const w = untilWindup(m, () => ({ playerX: 1.5, playerZ: 0 }));
    const recs = simulate(m, windSecs(w.ev.attackId) + 0.2, () => ({ playerX: 6, playerZ: 0 }));
    expect(recs.some((r) => r.ev.kind === 'cancel')).toBe(false);
    const res = recs.find((r) => r.ev.kind === 'resolve');
    if (!res || res.ev.kind !== 'resolve') throw new Error('hill_giant: no resolve');
    expect(res.ev.hit).toBe(false);
  });

  it('the monster does not move during wind-up and recovery, then chases', () => {
    const m = engaged('hill_giant');
    const w = untilWindup(m, () => ({ playerX: 1.5, playerZ: 0 }));
    const x0 = m.x, z0 = m.z;
    const hold = slotSecs(w.ev.attackId) - 2 * DT;
    simulate(m, hold, () => ({ playerX: 6, playerZ: 0 }));
    expect(m.x).toBe(x0);
    expect(m.z).toBe(z0);
    simulate(m, 1, () => ({ playerX: 6, playerZ: 0 }));
    expect(Math.hypot(m.x - x0, m.z - z0)).toBeGreaterThan(0.5);
  });

  // Each T5 cause and death, half a second into the wind-up: one cancel, no resolve, no shape left.
  const camp: CampDef = { id: 'cancel_camp', x: 0, z: 0, radius: 6, aggressive: true, members: [] };
  const causes: Array<[string, (m: MonsterLogic) => MonsterEvent[], Partial<StepWorld> & { playerX: number; playerZ: number }]> = [
    // The leash circle shrinks under the monster, which stands 8 from the camp centre.
    ['leash', () => [], { playerX: 9.5, playerZ: 0, camps: [{ ...camp, radius: 2 }] }],
    ['target beyond 26', () => [], { playerX: 40, playerZ: 0, camps: [camp] }],
    ['target down', () => [], { playerX: 9.5, playerZ: 0, playerDown: true, camps: [camp] }],
    ['target safe in an aggressive camp', () => [], { playerX: 9.5, playerZ: 0, playerSafe: true, camps: [camp] }],
    ['death', (m) => onPlayerHit(m, m.hp).events, { playerX: 9.5, playerZ: 0, camps: [camp] }]
  ];
  for (const [cause, act, after] of causes) {
    it(`${cause} during a wind-up emits cancel and no resolve`, () => {
      const m = engaged('hill_giant', 8, 0, camp.id);
      untilWindup(m, () => ({ playerX: 9.5, playerZ: 0, camps: [camp] }));
      const before = simulate(m, 0.5, () => ({ playerX: 9.5, playerZ: 0, camps: [camp] }));
      expect(before.some((r) => r.ev.kind === 'resolve' || r.ev.kind === 'cancel')).toBe(false);
      expect(m.windup).not.toBeNull();
      const evs = [...act(m), ...simulate(m, 3, () => after).map((r) => r.ev)];
      expect(evs.filter((ev) => ev.kind === 'cancel').length).toBe(1);
      expect(evs.some((ev) => ev.kind === 'resolve')).toBe(false);
      expect(m.windup).toBeNull();
      if (cause === 'death') expect(['dying', 'dead']).toContain(m.state);
      else expect(['return', 'idle']).toContain(m.state);
    });
  }
});

describe('the camp wind-up gate', () => {
  /** Members of one camp side by side at the origin, all engaged on the same frame. */
  function camp(typeKey: string, n: number): MonsterLogic[] {
    return Array.from({ length: n }, (_, i) => engaged(typeKey, 0, i * 0.4 - 0.4, 'gate_camp'));
  }

  type Member = { recs: Rec[]; shutBasics: number };

  /** Ticks the gate once per frame before the members step, as the engine does. Checks the gate rule on every slot. */
  function gatedRun(members: MonsterLogic[], secs: number, gate: Record<string, number> | undefined): Member[] {
    const out: Member[] = members.map(() => ({ recs: [], shutBasics: 0 }));
    const basicsBeforeHeavy = PATTERNS[MONSTER_TYPES[members[0].typeKey].pattern as string].length - 1;
    const sinceHeavy = members.map(() => 0);
    const rand = seeded(3);
    for (let i = 0; i < Math.round(secs / DT); i++) {
      const t = i * DT;
      if (gate) tickWindupGates(gate, DT);
      members.forEach((m, k) => {
        const shut = gate ? (gate.gate_camp ?? 0) > 0 : false;
        const evs = stepMonster(m, { playerX: 1.5, playerZ: 0, playerDown: false, dt: DT, rand, windupGate: gate });
        for (const ev of evs) {
          out[k].recs.push({ t, ev });
          if (!isSlot(ev)) continue;
          const heavyDue = sinceHeavy[k] >= basicsBeforeHeavy;
          if (heavyDue && !shut) {
            expect(ev.kind, `member ${k} at ${t.toFixed(2)}: the heavy is due and the gate is open`).toBe('windup');
          } else {
            expect(ev.kind, `member ${k} at ${t.toFixed(2)}: ${heavyDue ? 'the gate is shut' : 'a basic is due'}`).toBe('attack');
          }
          if (heavyDue && shut) out[k].shutBasics++;
          sinceHeavy[k] = ev.kind === 'windup' ? 0 : sinceHeavy[k] + 1;
        }
      });
    }
    return out;
  }

  it('two members never wind up at once; the second waits CAMP_WINDUP_GAP_SECS after the first resolves, playing basics and keeping its heavy', () => {
    const members = camp('hill_giant', 2);
    const runs = gatedRun(members, 60, {});
    for (const r of runs) expect(r.recs.find((x) => isSlot(x.ev))?.ev.kind, "each member's first attack").toBe('attack');
    expect(runs[1].shutBasics, 'the gate turned a heavy into a basic').toBeGreaterThan(0);

    // Merge the camp's wind-ups and endings in time order.
    const timeline = runs
      .flatMap((r, k) => r.recs.map((x) => ({ ...x, k })))
      .filter((x) => x.ev.kind === 'windup' || x.ev.kind === 'resolve' || x.ev.kind === 'cancel')
      .sort((a, b) => a.t - b.t || (a.ev.kind === 'windup' ? 1 : -1));
    let live = 0;
    let lastEnd = -Infinity;
    let windups = 0;
    for (const x of timeline) {
      if (x.ev.kind === 'windup') {
        expect(live, `t=${x.t.toFixed(2)}: a second wind-up in the camp while one is live`).toBe(0);
        expect(x.t - lastEnd, `t=${x.t.toFixed(2)}: gap after the previous resolve`).toBeGreaterThanOrEqual(CAMP_WINDUP_GAP_SECS - 2 * DT);
        live++;
        windups++;
      } else {
        live--;
        lastEnd = x.t;
      }
    }
    expect(windups).toBeGreaterThanOrEqual(8);
    expect(runs.every((r) => r.recs.some((x) => x.ev.kind === 'windup'))).toBe(true);
  });

  it("each member's first attack is a basic when a gated camp aggroes on its own", () => {
    const def: CampDef = { id: 'gate_camp', x: 0, z: 0, radius: 8, aggressive: true, members: [] };
    const members = [0, 1, 2].map((i) => createMonsterLogic('hill_giant', 0, i - 1, { campId: def.id }));
    const gate: Record<string, number> = {};
    const rand = seeded(5);
    const first: Array<string | undefined> = members.map(() => undefined);
    const playerCombat = combatLevel(createDefaultState());
    for (let i = 0; i < Math.round(10 / DT); i++) {
      tickWindupGates(gate, DT);
      members.forEach((m, k) => {
        const evs = stepMonster(m, { playerX: 1.5, playerZ: 0, playerDown: false, dt: DT, rand, playerCombat, camps: [def], windupGate: gate });
        for (const ev of evs) if (isSlot(ev) && first[k] === undefined) first[k] = ev.kind;
      });
    }
    expect(first).toEqual(['attack', 'attack', 'attack']);
  });

  it('without windupGate the members of one camp are not gated', () => {
    const members = camp('hill_giant', 2);
    const runs = gatedRun(members, 4 * CADENCE_SECS, undefined);
    const w = runs.map((r) => r.recs.find((x) => x.ev.kind === 'windup')?.t);
    expect(w[0]).toBeDefined();
    expect(w[1]).toBe(w[0]);
  });

  it("over 10,000 s a gated camp of three rolls one ordinary roll per cadence per member, within 5%", () => {
    const T = 10000;
    const members = camp('hill_giant', 3);
    const runs = gatedRun(members, T, {});
    const heavy = heavyOf('hill_giant');
    for (const [k, r] of runs.entries()) {
      // A basic is one roll; a heavy that resolves is `slots` rolls (the target stands, so every heavy lands).
      let rolls = 0;
      for (const x of r.recs) {
        if (x.ev.kind === 'attack') rolls += 1;
        if (x.ev.kind === 'resolve') {
          expect(x.ev.hit).toBe(true);
          rolls += ATTACKS[heavy].slots;
        }
      }
      expect(Math.abs(rolls / T - 1 / CADENCE_SECS) / (1 / CADENCE_SECS), `member ${k}`).toBeLessThanOrEqual(0.05);
    }
  });
});

describe('the slot rule', () => {
  it('a faster cadence never shortens a slot below wind-up + 150 ms (a one-slot heavy takes windupMs + 150)', () => {
    const heavy = heavyOf('hill_giant');
    const row = ATTACKS[heavy];
    const slots = row.slots;
    row.slots = 1;
    try {
      expect(row.slots * CADENCE_SECS).toBeLessThan(windSecs(heavy) + 0.15);
      const m = engaged('hill_giant');
      const w = untilWindup(m, () => ({ playerX: 1.5, playerZ: 0 }));
      const recs = simulate(m, 3, () => ({ playerX: 1.5, playerZ: 0 }));
      const next = recs.find((r) => isSlot(r.ev));
      expect(next?.ev.kind).toBe('attack');
      // `simulate` restarts its clock at 0 on the frame after the wind-up began.
      expect(Math.abs((next?.t ?? Infinity) + DT - (windSecs(heavy) + 0.15))).toBeLessThanOrEqual(DT + 1e-9);
      expect(w.ev.attackId).toBe(heavy);
    } finally {
      row.slots = slots;
    }
  });
});

describe('rollMonsterAttack on an ordinary heavy', () => {
  function dmgOf(r: number | { dmg: number }): number {
    return typeof r === 'number' ? r : r.dmg;
  }
  function counted(seed: number): { rand: () => number; draws: () => number } {
    const inner = seeded(seed);
    let n = 0;
    return { rand: () => { n++; return inner(); }, draws: () => n };
  }
  const PRAYER: Record<string, string> = { melee: 'prot_melee', ranged: 'prot_ranged', magic: 'prot_magic' };

  for (const typeKey of PATTERNED) {
    it(`${typeKey}: equals slots x the roll rollMonsterHit makes on the same draws, with and without prayer`, () => {
      const attack = ATTACKS[heavyOf(typeKey)];
      const states: GameState[] = [createDefaultState(), createDefaultState()];
      states[1].activePrayers.add(PRAYER[MONSTER_TYPES[typeKey].style]);
      let hits = 0, misses = 0;
      for (const state of states) {
        for (let seed = 1; seed <= 400; seed++) {
          const a = counted(seed);
          const b = counted(seed);
          const heavy = dmgOf(rollMonsterAttack(typeKey, attack, state, NO_MARKS, a.rand));
          const one = rollMonsterHit(typeKey, 1, state, b.rand).dmg;
          expect(heavy, `seed ${seed}`).toBe(attack.slots * one);
          expect(a.draws(), `seed ${seed} draws`).toBe(b.draws());
          if (b.draws() === 1) misses++;
          else hits++;
        }
      }
      expect(hits).toBeGreaterThan(0);
      expect(misses).toBeGreaterThan(0);
    });
  }
});

describe('the gate simulation: Cinderstep Pass sentries never wind up', () => {
  // The run of tests/gate-simulation.test.ts, rebuilt from CAMPS (nothing is imported from the frozen test). It passes no
  // windupGate: a gate can only turn a wind-up into a basic, so the ungated run is the stricter one.
  const SEEDS = 1000;
  const RUN_SPEED = 11.5;
  const START_X = -8;
  const END_X = -80;
  const PASS_Z = 55;
  const LINES = [PASS_Z, PASS_Z - 2.5, PASS_Z + 2.5];
  const sentryCamp = CAMPS.find((c) => c.id === 'pass_sentries');
  if (!sentryCamp) throw new Error('monster-patterns: no pass_sentries camp in CAMPS');
  const sentries = sentryCamp;

  function prayedForty(): GameState {
    const s = createDefaultState();
    s.skills.hitpoints.lvl = 40;
    s.hp = 40;
    s.activePrayers.add('prot_melee');
    return s;
  }

  /** Wind-ups emitted while the runner is alive, and the most slots any one sentry used. */
  function run(make: () => GameState, lineZ: number, seed: number): { windups: number; slots: number } {
    const rand = seeded(seed);
    const state = make();
    const playerCombat = combatLevel(state);
    const ms = sentries.members.map((mem) => {
      const m = createMonsterLogic(mem.type, mem.x, mem.z, { campId: sentries.id, wander: mem.wander });
      m.wanderTimer = rand() * 3;
      return m;
    });
    let hp = state.hp;
    let px = START_X;
    let windups = 0;
    const slots = ms.map(() => 0);
    const result = () => ({ windups, slots: Math.max(...slots) });
    while (px > END_X) {
      px = Math.max(END_X, px - RUN_SPEED * DT);
      const world: StepWorld = {
        playerX: px,
        playerZ: lineZ,
        playerDown: hp <= 0,
        dt: DT,
        rand,
        playerCombat,
        playerSafe: isInSafeZone(px, lineZ),
        camps: CAMPS
      };
      for (const [k, m] of ms.entries()) {
        for (const ev of stepMonster(m, world)) {
          if (ev.kind === 'windup') windups++;
          if (ev.kind === 'windup' || ev.kind === 'attack') slots[k]++;
          if (ev.kind !== 'attack') continue;
          m.breathCount += 1;
          hp -= rollMonsterHit(m.typeKey, m.breathCount, state, rand).dmg;
        }
      }
      if (hp <= 0) return result();
    }
    return result();
  }

  it('the sentries have a pattern (so the check is not empty)', () => {
    for (const mem of sentries.members) expect(MONSTER_TYPES[mem.type].pattern, mem.type).toBeDefined();
  });

  it('in 1000 seeds on each line, no sentry emits windup while the runner is alive (fresh and prepared runners)', () => {
    // Design 6.2: a runner is in a sentry's reach for under a second, so no sentry comes near its heavy slot.
    const basics = PATTERNS[MONSTER_TYPES[sentries.members[0].type].pattern as string].indexOf(heavyOf(sentries.members[0].type));
    for (const make of [createDefaultState, prayedForty]) {
      for (const z of LINES) {
        for (let seed = 1; seed <= SEEDS; seed++) {
          const r = run(make, z, seed);
          expect(r.windups, `line z=${z} seed ${seed}`).toBe(0);
          expect(r.slots, `line z=${z} seed ${seed} slots`).toBeLessThanOrEqual(basics);
        }
      }
    }
  });
});
