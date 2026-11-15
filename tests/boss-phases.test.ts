import { describe, expect, it } from 'vitest';
import { ATTACKS, BOSSES, CADENCE_SECS, PATTERNS, TELEGRAPH_TIME_SCALE, type AttackDef } from '../src/data/attacks';
import { MONSTER_TYPES } from '../src/data/world';
import { CAMPS, type CampDef } from '../src/data/worldMap';
import { isBossLoot, registerKill, resolveDragonfire } from '../src/state/adventure';
import { addMark, markMultiplier, mitigateDamage, rollMonsterAttack, rollMonsterHit, tickMarks } from '../src/state/combat';
import { createDefaultState } from '../src/state/gameState';
import {
  createMonsterLogic,
  DEAD_SECS,
  inCombat,
  onPlayerHit,
  stepMonster,
  type MonsterEvent,
  type MonsterLogic,
  type StepWorld
} from '../src/state/monsterAi';
import { inShape } from '../src/state/telegraph';
import type { GameState } from '../src/state/types';

// The new boss's phases, gate, shift, arena, marks and respawn, and the existing dragon left as it is
// (design 6.4, 9.1 G4.4; plan B1, with the owner's CALL-4.18 "open with a warning" and CALL-4.14 "allow it").
// Red until B2 adds `BOSSES`, the five boss rows, `CampDef.arenaRadius`, `MonsterLogic.phase`, `shiftLeft` and
// `outsideFor`, the `phase` event, `reason` on `onPlayerHit`, the boss branch of `rollMonsterAttack`, the mark
// functions and the boss branches of `isBossLoot` and `registerKill`. The existing-dragon cases pass today.
//
// B3 may tune the boss's stats, powers, wind-ups, shapes, mark step and camp spot, so those are read from the
// tables, never written here. Literals are kept only for what the design fixes: the phase order and patterns,
// thresholds 0.66 / 0.33 / 0, cadence x0.8 in phase III, shifts of 2,000 ms, respawn 120 s, arena 12, the title,
// the unmarked bound under 60 and the Ashen Nova + Slagburst pair covering 0 to 13.5.
//
// Conventions these tests fix where the plan leaves a choice open:
// - boss attacks are found by `name`; a phase's `pattern` may be a PATTERNS key or a list of attack ids;
// - the transition into phase k lasts `phases[k].shiftMs`; the opening roar lasts `openingShiftMs`;
// - the opening roar starts on the camp aggro (the `aggro` event) after a reset or a respawn and emits
//   `{ kind: 'phase', index: 0 }`; a threshold emits the index of the phase it enters. Whether a fight that
//   the hero opens with a hit also roars is left to B2: no case here depends on it;
// - `phase` and a shift's `cancel` may come from `onPlayerHit` or from the next `stepMonster`;
// - `onPlayerHit` refuses with `{ applied: false, reason: 'shift' | 'arena' }`; the hit that crosses a
//   threshold is applied (clamped);
// - `addMark` and `tickMarks` may return the new `{ count, left }` or change their argument;
// - a boss heavy rolls `power x (0.75 to 1.0)` floored, with no hit roll; the engine deals it only on a
//   `resolve` with `hit: true`;
// - the boss spends `BOSSES[type].respawnSecs` in `dead`, after the usual `dying`.

const DT = 1 / 60;
const BOSS = 'ashmantle';
const NO_MARKS = { count: 0, left: 0 };

type Marks = { count: number; left: number };
type PhaseRow = { name: string; untilHpFrac: number; pattern: unknown; cadenceMult: number; shiftMs: number };
type BossRow = {
  respawnSecs: number;
  arenaRadius: number;
  title?: string;
  openingShiftMs: number;
  mark: { step: number; max: number; secs: number };
  phases: PhaseRow[];
};
type Rec = { t: number; ev: MonsterEvent };
type HitResult = { applied: boolean; events: MonsterEvent[]; reason?: string };

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

function bossRow(): BossRow {
  const row = (BOSSES as unknown as Record<string, BossRow> | undefined)?.[BOSS];
  if (!row) throw new Error('boss-phases: BOSSES has no ashmantle row');
  return row;
}

function attackNamed(name: string): AttackDef {
  const a = Object.values(ATTACKS).find((r) => r.name === name);
  if (!a) throw new Error(`boss-phases: no attack row named ${name}`);
  return a;
}

const phaseIds = (p: { pattern: unknown }): string[] =>
  Array.isArray(p.pattern) ? (p.pattern as string[]) : (PATTERNS[p.pattern as string] ?? []);
const idName = (id: string): string => (id === 'basic' ? 'basic' : ATTACKS[id]?.name ?? `?${id}`);

function bossHeavies(): AttackDef[] {
  const ids = new Set(bossRow().phases.flatMap(phaseIds).filter((id) => id !== 'basic'));
  return [...ids].map((id) => ATTACKS[id]);
}

function bossCamp(): CampDef {
  const camp = CAMPS.find((c) => c.members.some((mm) => mm.type === BOSS));
  if (!camp) throw new Error('boss-phases: no camp holds the boss');
  return camp;
}

/** The state read through a call, so a check before `stepMonster` does not narrow the one after it. */
const st = (m: MonsterLogic): string => m.state;
const isSlot = (ev: MonsterEvent): boolean => ev.kind === 'attack' || ev.kind === 'windup';
const isPhase = (ev: MonsterEvent): boolean => ev.kind === 'phase';
const phaseIndex = (ev: MonsterEvent): number => (ev as unknown as { index: number }).index;

/** A fight against the boss on its real camp; the hero stands `d` east of home (open ground, design 6.4). */
function bossFight(seed = 1) {
  const camp = bossCamp();
  const member = camp.members.find((mm) => mm.type === BOSS)!;
  const m = createMonsterLogic(BOSS, member.x, member.z, { campId: camp.id });
  const rand = seeded(seed);
  const log: Rec[] = [];
  const f = {
    m,
    log,
    t: 0,
    hx: member.x,
    hz: member.z,
    /** Hero `d` east of home. */
    at(d: number): [number, number] {
      return [member.x + d, member.z];
    },
    world(px: number, pz: number, extra: Partial<StepWorld> = {}): StepWorld {
      return { playerX: px, playerZ: pz, playerDown: false, dt: DT, rand, playerCombat: 70, playerSafe: false, camps: CAMPS, ...extra };
    },
    step(px: number, pz: number, extra: Partial<StepWorld> = {}): MonsterEvent[] {
      const evs = stepMonster(m, f.world(px, pz, extra));
      for (const ev of evs) log.push({ t: f.t, ev });
      f.t += DT;
      return evs;
    },
    run(secs: number, d: number): void {
      const [px, pz] = f.at(d);
      for (let i = 0; i < Math.round(secs / DT); i++) f.step(px, pz);
    },
    hit(dmg: number): HitResult {
      const r = onPlayerHit(m, dmg) as HitResult;
      for (const ev of r.events) log.push({ t: f.t, ev });
      return r;
    },
    fromHome(): number {
      return Math.hypot(m.x - member.x, m.z - member.z);
    },
    since(t0: number): Rec[] {
      return log.filter((r) => r.t >= t0);
    }
  };
  return f;
}

type Fight = ReturnType<typeof bossFight>;

/** The camp aggro with the hero 3 east of home, then past the opening roar. */
function engagedBoss(seed = 1, d = 3): Fight {
  const f = bossFight(seed);
  const [px, pz] = f.at(3);
  f.step(px, pz);
  expect(f.log.map((r) => r.ev.kind), 'the camp aggro').toContain('aggro');
  f.run(bossRow().openingShiftMs / 1000 + 3 * DT, d);
  return f;
}

/** Crosses the current phase's threshold with one blow and steps through the shift, the hero `d` east of home. */
function crossThreshold(f: Fight, d = 6): { tHit: number; r: HitResult } {
  const tHit = f.t;
  const r = f.hit(1_000_000);
  const next = bossRow().phases[f.m.phase];
  f.run((next?.shiftMs ?? 0) / 1000 + 3 * DT, d);
  return { tHit, r };
}

function bare(): GameState {
  return createDefaultState();
}

function rollHeavy(attack: AttackDef, state: GameState, seed: number, marks: Marks = NO_MARKS): number {
  return rollMonsterAttack(BOSS, attack, state, marks, seeded(seed)).dmg;
}

const addTo = (m: Marks, boss: BossRow): Marks =>
  ((addMark as unknown as (mm: Marks, b: BossRow) => Marks | undefined)(m, boss) ?? m);
const tickBy = (m: Marks, dt: number): Marks =>
  ((tickMarks as unknown as (mm: Marks, s: number) => Marks | undefined)(m, dt) ?? m);
const multOf = (m: Marks, boss: BossRow): number =>
  (markMultiplier as unknown as (mm: Marks, b: BossRow) => number)(m, boss);

describe('the boss row (design 6.4)', () => {
  it('BOSSES holds one row, ashmantle, with respawn 120, arena 12, title Ashbreaker, a 2 s opening and the mark of four for 12 s', () => {
    expect(Object.keys(BOSSES as object)).toEqual([BOSS]);
    const b = bossRow();
    expect(b.respawnSecs).toBe(120);
    expect(b.arenaRadius).toBe(12);
    expect(b.title).toBe('Ashbreaker');
    expect(b.openingShiftMs).toBe(2000);
    expect(b.mark.max).toBe(4);
    expect(b.mark.secs).toBe(12);
    expect(b.mark.step).toBeGreaterThan(0);
    expect(b, 'hitpoints live in the monster row').not.toHaveProperty('hp');
    expect((bossCamp() as CampDef & { arenaRadius?: number }).arenaRadius).toBe(b.arenaRadius);
  });

  it('three phases in the order, thresholds, cadences, shifts and patterns of the phase table', () => {
    const p = bossRow().phases;
    expect(p.map((x) => x.name)).toEqual(['Grounded', 'Rain of Slag', 'Fury']);
    expect(p.map((x) => x.untilHpFrac)).toEqual([0.66, 0.33, 0]);
    expect(p.map((x) => x.cadenceMult)).toEqual([1, 1, 0.8]);
    expect(p.map((x) => x.shiftMs)).toEqual([2000, 2000, 2000]);
    expect(p.map((x) => phaseIds(x).map(idName))).toEqual([
      ['basic', 'basic', 'Ember Cone', 'basic', 'Tail Sweep'],
      ['Slag Rain', 'Slag Rain', 'Slag Rain', 'Tail Sweep', 'basic', 'Ember Cone', 'basic'],
      ['Ashen Nova', 'Slagburst', 'basic', 'Ember Cone', 'basic', 'Slag Rain', 'Slag Rain']
    ]);
  });

  it('the five boss attacks have a power and the styles of the power table', () => {
    const want: Record<string, string> = {
      'Ember Cone': 'fire', 'Tail Sweep': 'melee', 'Slag Rain': 'pure', 'Ashen Nova': 'pure', Slagburst: 'melee'
    };
    for (const [name, style] of Object.entries(want)) {
      const a = attackNamed(name);
      expect(a.style, name).toBe(style);
      expect(a.power, name).toBeGreaterThan(0);
    }
    expect(bossHeavies().map((a) => a.name).sort()).toEqual(Object.keys(want).sort());
  });
});

describe('boss heavies: sure damage, mitigation and marks', () => {
  it('a boss heavy deals power x 0.75..1.0 when inside, with no hit roll', () => {
    for (const a of bossHeavies()) {
      const power = a.power!;
      let lo = Infinity, hi = -Infinity;
      for (let seed = 1; seed <= 500; seed++) {
        const dmg = rollHeavy(a, bare(), seed);
        expect(Number.isInteger(dmg), a.name).toBe(true);
        expect(dmg, a.name).toBeGreaterThanOrEqual(Math.floor(power * 0.75));
        expect(dmg, a.name).toBeLessThanOrEqual(power);
        lo = Math.min(lo, dmg);
        hi = Math.max(hi, dmg);
      }
      expect(lo, `${a.name}: the low end is reached`).toBeLessThanOrEqual(Math.floor(power * 0.75) + 1);
      expect(hi, `${a.name}: the high end is reached`).toBeGreaterThanOrEqual(power - 2);
    }
  });

  it('a boss heavy is dealt only when the hero is inside at the resolve: hit true for a hero who stays, false for one who left', () => {
    for (const leave of [false, true]) {
      const f = engagedBoss(7);
      const home: [number, number] = f.at(3);
      let pos: [number, number] = home;
      let open: Extract<MonsterEvent, { kind: 'windup' }> | null = null;
      const resolves: boolean[] = [];
      for (let i = 0; i < Math.round(20 / DT) && resolves.length < 2; i++) {
        for (const ev of f.step(pos[0], pos[1])) {
          if (ev.kind === 'windup') {
            open = ev;
            if (leave) {
              const shape = ATTACKS[ev.attackId].shape;
              const out = [7, 9, 10].flatMap((r) => Array.from({ length: 36 }, (_, k) => {
                const ang = (k * 10 * Math.PI) / 180;
                return [f.m.x + Math.cos(ang) * r, f.m.z + Math.sin(ang) * r] as [number, number];
              })).find(([x, z]) => !inShape(shape, ev.ox, ev.oz, ev.dx, ev.dz, x, z) && Math.hypot(x - f.hx, z - f.hz) <= 17);
              expect(out, `${ev.attackId}: a spot outside the shape`).toBeDefined();
              pos = out!;
            }
          } else if (ev.kind === 'resolve') {
            expect(open?.attackId).toBe(ev.attackId);
            expect(ev.hit, `${ev.attackId}, leave ${leave}`).toBe(!leave);
            resolves.push(ev.hit);
            open = null;
            pos = home;
          }
        }
      }
      expect(resolves, `leave ${leave}: the first two heavies of phase I resolved`).toHaveLength(2);
    }
  });

  it('Ember Cone is cut to 25% by a ward, the quest flag or Protect from Magic, through resolveDragonfire; Protect from Melee does not cut it', () => {
    const cone = attackNamed('Ember Cone');
    const ward = (): GameState => { const s = bare(); s.equipment.shield = 'elysian_shield'; return s; };
    const flag = (): GameState => { const s = bare(); s.quests.dragonfireWard = true; return s; };
    const prayer = (): GameState => { const s = bare(); s.activePrayers.add('prot_magic'); return s; };
    const melee = (): GameState => { const s = bare(); s.activePrayers.add('prot_melee'); return s; };
    for (let seed = 1; seed <= 200; seed++) {
      const u = rollHeavy(cone, bare(), seed);
      expect(u).toBeGreaterThan(0);
      for (const [label, make] of [['ward', ward], ['quest flag', flag], ['Protect from Magic', prayer]] as const) {
        const s = make();
        expect(rollHeavy(cone, s, seed), `${label}, seed ${seed}`).toBe(resolveDragonfire(u, s).damage);
        expect(rollHeavy(cone, s, seed), `${label}, seed ${seed}`).toBe(Math.floor(u * 0.25));
      }
      expect(rollHeavy(cone, melee(), seed), `Protect from Melee, seed ${seed}`).toBe(u);
    }
  });

  it('Tail Sweep and Slagburst are cut by Protect from Melee and not by Protect from Magic or a ward', () => {
    for (const name of ['Tail Sweep', 'Slagburst']) {
      const a = attackNamed(name);
      for (let seed = 1; seed <= 200; seed++) {
        const u = rollHeavy(a, bare(), seed);
        const pm = bare(); pm.activePrayers.add('prot_melee');
        expect(rollHeavy(a, pm, seed), `${name} seed ${seed}`).toBe(mitigateDamage(u, 'melee', pm.activePrayers));
        expect(rollHeavy(a, pm, seed), `${name} seed ${seed}`).toBe(Math.floor(u * 0.2));
        const mg = bare(); mg.activePrayers.add('prot_magic'); mg.equipment.shield = 'elysian_shield'; mg.quests.dragonfireWard = true;
        expect(rollHeavy(a, mg, seed), `${name} seed ${seed}`).toBe(u);
      }
    }
  });

  it('Slag Rain and Ashen Nova are cut by nothing', () => {
    for (const name of ['Slag Rain', 'Ashen Nova']) {
      const a = attackNamed(name);
      for (let seed = 1; seed <= 200; seed++) {
        const u = rollHeavy(a, bare(), seed);
        const all = bare();
        for (const p of ['prot_magic', 'prot_melee', 'prot_ranged', 'piety', 'thick_skin']) all.activePrayers.add(p);
        all.equipment.shield = 'elysian_shield';
        all.quests.dragonfireWard = true;
        all.skills.defence.lvl = 99;
        expect(rollHeavy(a, all, seed), `${name} seed ${seed}`).toBe(u);
      }
    }
  });

  it('unmarked, no boss heavy deals 60 or more before mitigation (a single miss from a clean state never kills a 60-hitpoint hero)', () => {
    const top = () => 1 - 1e-12;
    for (const a of bossHeavies()) {
      expect(rollMonsterAttack(BOSS, a, bare(), NO_MARKS, top).dmg, a.name).toBeLessThan(60);
      for (let seed = 1; seed <= 500; seed++) expect(rollHeavy(a, bare(), seed), a.name).toBeLessThan(60);
    }
  });

  it('each heavy hit adds a mark up to four and resets one shared 12 s timer; all marks go when it runs out', () => {
    const b = bossRow();
    let m: Marks = { count: 0, left: 0 };
    expect(multOf(m, b)).toBe(1);
    m = addTo(m, b);
    expect(m).toEqual({ count: 1, left: b.mark.secs });
    m = tickBy(m, 5);
    expect(m.count).toBe(1);
    expect(m.left).toBeCloseTo(b.mark.secs - 5, 9);
    m = addTo(m, b);
    expect(m, 'the second mark resets the shared timer').toEqual({ count: 2, left: b.mark.secs });
    for (let i = 0; i < 5; i++) m = addTo(m, b);
    expect(m.count, 'never past the maximum').toBe(b.mark.max);
    expect(multOf(m, b)).toBeCloseTo(1 + b.mark.step * b.mark.max, 9);
    m = tickBy(m, b.mark.secs - 0.1);
    expect(m.count, 'still marked just before the timer runs out').toBe(b.mark.max);
    m = tickBy(m, 0.2);
    expect(m.count, 'all marks go together').toBe(0);
    expect(multOf(m, b)).toBe(1);
    for (let n = 0; n <= b.mark.max; n++) expect(multOf({ count: n, left: 1 }, b), `${n} marks`).toBeCloseTo(1 + b.mark.step * n, 9);
  });

  it('every heavy hit while marks last is raised by the mark multiplier', () => {
    const b = bossRow();
    for (const a of bossHeavies()) {
      for (let n = 1; n <= b.mark.max; n++) {
        const marks = { count: n, left: b.mark.secs };
        const mult = multOf(marks, b);
        let sumU = 0, sumM = 0;
        for (let seed = 1; seed <= 200; seed++) {
          const u = rollHeavy(a, bare(), seed);
          const mk = rollHeavy(a, bare(), seed, marks);
          expect(Math.abs(mk - u * mult), `${a.name}, ${n} marks, seed ${seed}`).toBeLessThanOrEqual(mult);
          sumU += u;
          sumM += mk;
        }
        expect(sumM / sumU, `${a.name}, ${n} marks`).toBeCloseTo(mult, 1);
      }
    }
  });

  it('no standing distance from 0 to 13.5 is outside both Ashen Nova and Slagburst', () => {
    const nova = attackNamed('Ashen Nova').shape;
    const burst = attackNamed('Slagburst').shape;
    for (let i = 0; i <= 1350; i++) {
      const d = i / 100;
      for (const [dx, dz] of [[1, 0], [0, 1], [-Math.SQRT1_2, Math.SQRT1_2]]) {
        const x = dx * d, z = dz * d;
        expect(inShape(nova, 0, 0, 1, 0, x, z) || inShape(burst, 0, 0, 1, 0, x, z), `distance ${d}`).toBe(true);
      }
    }
  });
});

describe('phases: gate, shift, patterns (G4.4)', () => {
  it('hitpoints cannot pass a threshold in one hit, overflow is lost, phase is emitted once per threshold, and the last threshold 0 lets it die', () => {
    const f = engagedBoss(2);
    const phases = bossRow().phases;
    expect(f.m.phase).toBe(0);
    expect(f.m.hp).toBe(f.m.maxHp);
    expect(phases[phases.length - 1].untilHpFrac).toBe(0);

    // A blow that stops short of the threshold is dealt as usual.
    const short = f.hit(10);
    expect(short.applied).toBe(true);
    expect(f.m.hp).toBe(f.m.maxHp - 10);

    for (let k = 0; k < phases.length - 1; k++) {
      const { r } = crossThreshold(f);
      expect(r.applied, `phase ${k}: the crossing blow is applied`).toBe(true);
      expect(Math.abs(f.m.hp - f.m.maxHp * phases[k].untilHpFrac), `phase ${k}: clamped at its threshold`).toBeLessThanOrEqual(1);
      expect(f.m.hp).toBeGreaterThan(0);
      expect(inCombat(f.m), `phase ${k}: still fighting`).toBe(true);
      expect(f.m.phase).toBe(k + 1);
    }
    // The last phase's threshold is 0: the next blow kills.
    const last = f.hit(1_000_000);
    expect(last.applied).toBe(true);
    expect(f.m.hp).toBe(0);
    expect(f.log.map((r) => r.ev.kind)).toContain('died');

    const phaseEvents = f.log.filter((r) => isPhase(r.ev)).map((r) => phaseIndex(r.ev));
    expect(phaseEvents, 'the opening, then once per threshold').toEqual([0, 1, 2]);
  });

  it('a blow that crosses a threshold by a little is clamped too', () => {
    const f = engagedBoss(3);
    const frac = bossRow().phases[0].untilHpFrac;
    const above = Math.ceil(f.m.maxHp * frac) + 6;
    f.hit(f.m.maxHp - above);
    expect(f.m.hp).toBe(above);
    expect(f.m.phase).toBe(0);
    f.hit(20);
    expect(Math.abs(f.m.hp - f.m.maxHp * frac)).toBeLessThanOrEqual(1);
    f.run(3 * DT, 3);
    expect(f.m.phase).toBe(1);
  });

  it('the boss takes no damage during the shift and says why (reason shift), then takes it again', () => {
    const phases = bossRow().phases;
    const f = engagedBoss(4);
    for (let k = 1; k < phases.length; k++) {
      f.hit(1_000_000);
      const hp = f.m.hp;
      const frames = Math.round(phases[k].shiftMs / 1000 / DT);
      const [px, pz] = f.at(6);
      for (let i = 0; i < frames - 2; i++) {
        f.step(px, pz);
        const r = f.hit(25);
        expect(r.applied, `phase ${k} frame ${i}`).toBe(false);
        expect(r.reason, `phase ${k} frame ${i}`).toBe('shift');
        expect(f.m.hp).toBe(hp);
      }
      f.run(5 * DT, 6);
      const after = f.hit(25);
      expect(after.applied, `phase ${k}: the shift is over`).toBe(true);
      expect(f.m.hp).toBe(hp - 25);
      f.run(1.5, 6);
    }
    expect(f.log.filter((r) => isPhase(r.ev)).map((r) => phaseIndex(r.ev))).toEqual([0, 1, 2]);
  });

  it('phases II and III start with their first pattern entry, a heavy, one second after the shift', () => {
    const phases = bossRow().phases;
    const f = engagedBoss(5);
    for (let k = 1; k < phases.length; k++) {
      const tHit = f.t;
      f.hit(1_000_000);
      f.run(phases[k].shiftMs / 1000 + 1.5, 6);
      const first = f.since(tHit).find((r) => isSlot(r.ev));
      const want = phaseIds(phases[k])[0];
      expect(want, `phase ${k} opens with a heavy`).not.toBe('basic');
      expect(first?.ev.kind, `phase ${k}`).toBe('windup');
      expect((first?.ev as { attackId?: string }).attackId, `phase ${k}`).toBe(want);
      expect(Math.abs((first?.t ?? Infinity) - tHit - (phases[k].shiftMs / 1000 + 1)), `phase ${k}: one second after the shift`).toBeLessThanOrEqual(3 * DT + 1e-9);
      expect(f.since(tHit).filter((r) => isSlot(r.ev) && r.t < (first?.t ?? 0)), 'nothing during the shift').toHaveLength(0);
    }
  });

  it('phase III uses the faster cadence: every slot is slots x 1.65 x 0.8, never under wind-up + 150 ms', () => {
    const phases = bossRow().phases;
    const f = engagedBoss(6);
    crossThreshold(f);
    const tHit = f.t;
    f.hit(1_000_000);
    const ids = phaseIds(phases[2]);
    const mult = phases[2].cadenceMult;
    f.run(phases[2].shiftMs / 1000 + 1.5 + 25, 6);
    expect(f.m.phase).toBe(2);
    const slots = f.since(tHit).filter((r) => isSlot(r.ev)).slice(0, ids.length + 1);
    expect(slots).toHaveLength(ids.length + 1);
    for (let j = 0; j <= ids.length; j++) {
      const id = ids[j % ids.length];
      const ev = slots[j].ev;
      if (id === 'basic') expect(ev.kind, `slot ${j}`).toBe('attack');
      else expect((ev as { attackId?: string }).attackId, `slot ${j}`).toBe(id);
    }
    for (let j = 0; j < ids.length; j++) {
      const id = ids[j];
      const want = id === 'basic'
        ? CADENCE_SECS * mult
        : Math.max(ATTACKS[id].slots * CADENCE_SECS * mult, (ATTACKS[id].windupMs * TELEGRAPH_TIME_SCALE) / 1000 + 0.15);
      expect(Math.abs(slots[j + 1].t - slots[j].t - want), `after ${idName(id)}`).toBeLessThanOrEqual(2 * DT + 1e-9);
    }
    const basicGap = ids.findIndex((id, j) => id === 'basic' && j + 1 < ids.length);
    expect(slots[basicGap + 1].t - slots[basicGap].t, 'a basic slot is shorter than the 1.65 s cadence').toBeLessThan(CADENCE_SECS - 0.2);
  });

  it('a wind-up in progress is cancelled by a phase shift, and never resolves', () => {
    const f = engagedBoss(8);
    const [px, pz] = f.at(3);
    let windAt = -1;
    for (let i = 0; i < Math.round(15 / DT) && windAt < 0; i++) {
      if (f.step(px, pz).some((ev) => ev.kind === 'windup')) windAt = f.t;
    }
    expect(windAt, 'phase I wound up a heavy').toBeGreaterThan(0);
    f.run(0.3, 3);
    expect(f.m.windup).not.toBeNull();
    const tHit = f.t;
    f.hit(1_000_000);
    f.run(0.2, 3);
    const after = f.since(tHit).map((r) => r.ev.kind);
    expect(after).toContain('cancel');
    expect(after.indexOf('cancel')).toBeLessThan(after.includes('resolve') ? after.indexOf('resolve') : Infinity);
    f.run(bossRow().phases[1].shiftMs / 1000 + 0.5, 3);
    const kinds = f.since(tHit).map((r) => r.ev.kind);
    expect(kinds.filter((k) => k === 'resolve'), 'the cancelled wind-up never resolves').toHaveLength(0);
  });

  it('the fight opens with a 2 s untouchable roar on the camp aggro: phase 0 is emitted, nothing is dealt either way, then a basic', () => {
    const f = bossFight(9);
    const b = bossRow();
    const [px, pz] = f.at(3);
    f.step(px, pz);
    expect(f.log.map((r) => r.ev.kind)).toContain('aggro');
    const frames = Math.round(b.openingShiftMs / 1000 / DT);
    for (let i = 0; i < frames - 2; i++) {
      const r = f.hit(25);
      expect(r.applied, `frame ${i}`).toBe(false);
      expect(r.reason, `frame ${i}`).toBe('shift');
      expect(f.m.hp).toBe(f.m.maxHp);
      f.step(px, pz);
    }
    expect(f.log.filter((r) => isSlot(r.ev)), 'no blow and no wind-up during the roar').toHaveLength(0);
    expect(f.log.filter((r) => isPhase(r.ev)).map((r) => phaseIndex(r.ev))).toEqual([0]);
    f.run(1 + CADENCE_SECS + 0.5, 3);
    const first = f.log.find((r) => isSlot(r.ev));
    expect(first?.ev.kind, 'phase I opens with a basic').toBe('attack');
    expect(f.hit(25).applied).toBe(true);
  });
});

describe('the arena (design 6.4)', () => {
  it('a hero inside arenaRadius + 6 never sends the boss home, wherever it stands', () => {
    for (const d of [8, 14, 17.5]) {
      const f = engagedBoss(10, d);
      f.run(30, d);
      expect(f.log.map((r) => r.ev.kind), `hero at ${d}`).not.toContain('reset');
      expect(inCombat(f.m), `hero at ${d}`).toBe(true);
      expect(f.fromHome(), `hero at ${d}`).toBeLessThanOrEqual(bossRow().arenaRadius + 0.1);
    }
  });

  it('the boss never chases beyond arenaRadius, does not stall home pinned at its edge, and goes home after 5 s beyond arenaRadius + 6', () => {
    const R = bossRow().arenaRadius;
    for (const d of [22, 24]) {
      const f = engagedBoss(11);
      const t0 = f.t;
      let maxFrom = 0;
      let returnedAt = -1;
      const [px, pz] = f.at(d);
      for (let i = 0; i < Math.round(8 / DT) && returnedAt < 0; i++) {
        f.step(px, pz);
        if (f.m.state === 'return') returnedAt = f.t - DT - t0;
        else maxFrom = Math.max(maxFrom, f.fromHome());
        if (Math.abs(f.t - t0 - 4) < DT / 2) {
          expect(inCombat(f.m), `hero at ${d}: still fighting at 4 s (the leash and the stall test do not apply)`).toBe(true);
          if (d === 24) {
            expect(f.m.state, 'pinned at its edge in chase').toBe('chase');
            expect(f.fromHome()).toBeGreaterThanOrEqual(R - 0.15);
            expect(Math.hypot(px - f.m.x, pz - f.m.z), 'out of its reach of 11').toBeGreaterThan(11);
          }
        }
      }
      expect(maxFrom, `hero at ${d}`).toBeLessThanOrEqual(R + 0.1);
      expect(maxFrom, `hero at ${d}: it went past the camp leash`).toBeGreaterThan(bossCamp().radius + 4);
      expect(returnedAt, `hero at ${d}: home after 5 s outside`).toBeGreaterThanOrEqual(5 - 2 * DT);
      expect(returnedAt, `hero at ${d}`).toBeLessThanOrEqual(5 + 3 * DT);
    }
  });

  it('while the target is farther than arenaRadius + 6 from home, onPlayerHit returns applied false with reason arena', () => {
    const f = engagedBoss(12);
    f.run(3, 24);
    expect(f.m.state).toBe('chase');
    expect(f.fromHome()).toBeGreaterThanOrEqual(bossRow().arenaRadius - 0.15);
    const [px, pz] = f.at(24);
    expect(Math.hypot(px - f.m.x, pz - f.m.z), 'beyond the boss reach of 11, inside a ranged hero 13.5').toBeGreaterThan(11);
    expect(Math.hypot(px - f.m.x, pz - f.m.z)).toBeLessThan(13.5);
    const hp = f.m.hp;
    const r = f.hit(50);
    expect(r.applied).toBe(false);
    expect(r.reason).toBe('arena');
    expect(f.m.hp).toBe(hp);
  });

  it('a target that alternates 4.9 s at 24 from home and 0.1 s at 17 deals no damage while outside', () => {
    const f = engagedBoss(13);
    let dealt = 0;
    for (let cycle = 0; cycle < 5; cycle++) {
      const [ox, oz] = f.at(24);
      for (let i = 0; i < Math.round(4.9 / DT); i++) {
        f.step(ox, oz);
        const hp = f.m.hp;
        const r = f.hit(5);
        expect(r.applied, `cycle ${cycle} outside, frame ${i}`).toBe(false);
        expect(r.reason, `cycle ${cycle} outside, frame ${i}`).toBe('arena');
        expect(f.m.hp).toBe(hp);
      }
      const [ix, iz] = f.at(17);
      for (let i = 0; i < Math.round(0.1 / DT); i++) {
        f.step(ix, iz);
        const r = f.hit(5);
        expect(r.applied, `cycle ${cycle} inside, frame ${i}`).toBe(true);
        dealt += 5;
      }
    }
    expect(f.m.maxHp - f.m.hp, 'only the blows from inside landed').toBe(dealt);
    expect(f.log.map((r) => r.ev.kind)).not.toContain('reset');
  });

  it('reset and respawn restore phase I, the first pattern entry, full hitpoints and no shift; the next aggro roars again', () => {
    const b = bossRow();
    // Reset: into phase II, then the hero leaves past the 26-unit drop distance.
    const f = engagedBoss(14);
    crossThreshold(f);
    expect(f.m.phase).toBe(1);
    let reset = false;
    for (let i = 0; i < Math.round(20 / DT) && !reset; i++) reset = f.step(...f.at(40)).some((ev) => ev.kind === 'reset');
    expect(reset).toBe(true);
    expect(f.m.phase).toBe(0);
    expect(f.m.patternIdx).toBe(0);
    expect(f.m.hp).toBe(f.m.maxHp);
    expect(f.m.shiftLeft).toBe(0);
    const tBack = f.t;
    f.run(0.5, 3);
    expect(f.since(tBack).filter((r) => isPhase(r.ev)).map((r) => phaseIndex(r.ev)), 'the opening roar after a reset').toEqual([0]);
    expect(f.hit(25).reason).toBe('shift');

    // Respawn: through every phase to the kill, then the dead time.
    const g = engagedBoss(15);
    for (let k = 0; k < b.phases.length - 1; k++) crossThreshold(g);
    g.hit(1_000_000);
    let respawned = false;
    for (let i = 0; i < Math.round((b.respawnSecs + 5) / DT) && !respawned; i++) respawned = g.step(...g.at(40)).some((ev) => ev.kind === 'respawned');
    expect(respawned).toBe(true);
    expect(g.m.phase).toBe(0);
    expect(g.m.patternIdx).toBe(0);
    expect(g.m.hp).toBe(g.m.maxHp);
    expect(g.m.shiftLeft).toBe(0);
    const tUp = g.t;
    g.run(0.5, 3);
    expect(g.since(tUp).filter((r) => isPhase(r.ev)).map((r) => phaseIndex(r.ev)), 'the opening roar after a respawn').toEqual([0]);
  });
});

/** Seconds a monster in `dying` spends in `dead` before `respawned`. */
function deadTime(m: MonsterLogic): number {
  if (st(m) !== 'dying') return NaN;
  const w: StepWorld = { playerX: m.homeX + 40, playerZ: m.homeZ, playerDown: false, dt: DT, rand: seeded(1) };
  let dead = 0;
  for (let i = 0; i < Math.round(200 / DT); i++) {
    const wasDead = st(m) === 'dead';
    const evs = stepMonster(m, w);
    if (wasDead) dead += DT;
    if (evs.some((ev) => ev.kind === 'respawned')) return dead;
  }
  return Infinity;
}

/** An ordinary monster killed by one blow. */
function killed(typeKey: string): MonsterLogic {
  const m = createMonsterLogic(typeKey, 0, 0);
  onPlayerHit(m, 0);
  onPlayerHit(m, 1_000_000);
  return m;
}

describe('respawn', () => {
  it('the boss is back after 120 s dead', () => {
    const f = engagedBoss(16);
    for (let k = 0; k < bossRow().phases.length - 1; k++) crossThreshold(f);
    f.hit(1_000_000);
    expect(f.m.state).toBe('dying');
    expect(Math.abs(deadTime(f.m) - bossRow().respawnSecs)).toBeLessThanOrEqual(2 * DT);
  });

  it('every other monster, the existing dragon among them, is back after 7.5 s dead', () => {
    const rows = (BOSSES ?? {}) as Record<string, unknown>;
    expect(DEAD_SECS).toBe(7.5);
    for (const key of Object.keys(MONSTER_TYPES).filter((k) => !Object.hasOwn(rows, k))) {
      expect(Math.abs(deadTime(killed(key)) - DEAD_SECS), key).toBeLessThanOrEqual(2 * DT);
    }
    expect(Object.keys(MONSTER_TYPES)).toContain('elvarg_dragon');
  });
});

describe('the existing dragon is left as it is', () => {
  it('has no BOSSES row and no pattern', () => {
    expect(Object.hasOwn((BOSSES ?? {}) as object, 'elvarg_dragon')).toBe(false);
    expect((MONSTER_TYPES.elvarg_dragon as { pattern?: string }).pattern).toBeUndefined();
  });

  it('leashes at its camp radius + 4 as any monster', () => {
    const camp = CAMPS.find((c) => c.id === 'dragon')!;
    const member = camp.members[0];
    const m = createMonsterLogic('elvarg_dragon', member.x, member.z, { campId: camp.id });
    onPlayerHit(m, 0);
    const rand = seeded(20);
    let maxFrom = 0;
    for (let i = 0; i < Math.round(10 / DT) && st(m) !== 'return'; i++) {
      stepMonster(m, { playerX: member.x + 21, playerZ: member.z, playerDown: false, dt: DT, rand, playerCombat: 70, playerSafe: false, camps: CAMPS });
      if (st(m) !== 'return') maxFrom = Math.max(maxFrom, Math.hypot(m.x - camp.x, m.z - camp.z));
    }
    expect(m.state).toBe('return');
    expect(maxFrom).toBeGreaterThan(camp.radius + 4 - 0.2);
    expect(maxFrom).toBeLessThanOrEqual(camp.radius + 4 + 0.1);
  });

  it('stalls home against a wall as any monster', () => {
    // The castle's south wall spans z -17.7..-16.3 at x 1.7..9.1 (the same wall as monster-territory's stall test).
    const camp: CampDef = { id: 'dragon_wall', x: 5, z: -10, radius: 30, aggressive: false, members: [] };
    const m = createMonsterLogic('elvarg_dragon', 5, -10, { campId: camp.id });
    onPlayerHit(m, 0);
    const rand = seeded(21);
    let t = 0;
    let stuckAt = -1;
    while (m.state === 'chase' && t < 10) {
      const px = m.x, pz = m.z;
      stepMonster(m, { playerX: 5, playerZ: -28, playerDown: false, dt: DT, rand, playerCombat: 70, playerSafe: false, camps: [camp] });
      t += DT;
      if (stuckAt < 0 && m.state === 'chase' && Math.hypot(m.x - px, m.z - pz) < 1e-9) stuckAt = t;
    }
    expect(m.state).toBe('return');
    expect(stuckAt, 'it reached the wall').toBeGreaterThan(0);
    expect(t - stuckAt).toBeGreaterThanOrEqual(1.4);
    expect(t - stuckAt).toBeLessThanOrEqual(3.1);
  });

  it('rollMonsterHit gives it dragonfire when breathCount is a multiple of 3, and never gives it to the boss', () => {
    for (let bc = 0; bc < 30; bc++) {
      for (let seed = 1; seed <= 20; seed++) {
        expect(rollMonsterHit('elvarg_dragon', bc, bare(), seeded(seed)).dragonfire, `breathCount ${bc}`).toBe(bc % 3 === 0);
        expect(rollMonsterHit(BOSS, bc, bare(), seeded(seed)).dragonfire, `boss, breathCount ${bc}`).toBe(false);
      }
    }
  });
});

describe('loot and the title', () => {
  it('isBossLoot is true for elvarg_dragon and for ashmantle and false for hill_giant', () => {
    expect(isBossLoot('elvarg_dragon')).toBe(true);
    expect(isBossLoot(BOSS)).toBe(true);
    expect(isBossLoot('hill_giant')).toBe(false);
  });

  it("registerKill of ashmantle sets quests.title to the row's title and sets no quest flag", () => {
    const s = bare();
    const before = JSON.parse(JSON.stringify(s.quests));
    registerKill(s, BOSS);
    expect(s.quests.title).toBe(bossRow().title);
    expect(s.quests.title).toBe('Ashbreaker');
    const after = JSON.parse(JSON.stringify(s.quests));
    delete before.title;
    delete after.title;
    expect(after).toEqual(before);
  });
});
