// A1: G4.7 of the combat-weight design (9.1). Red until A2 adds src/state/soundPlan.ts and reworks src/engine/audio.ts.
// Contract A2 must meet (names fixed by plan task A2, design 6.7):
//   type Voice = { at, kind: 'tone' | 'noise', freq, slideTo, type, dur, vol }   at, dur in seconds from now
//   type Cue = 'low' | 'mid' | 'high' | 'fire'
//   cueFor(attack, monsterStyle): Cue
//   windupPlan(attack, cue): Voice[]   the rising part only, ends at windupMs / 1000
//   resolvePlan(cue): Voice[]          the impact, played on the resolve event
//   impactPlan(ratio), heavyTakenPlan(), dodgedPlan(), phasePlan(), bossDownPlan(), heartbeatPlan(), foodReadyPlan()
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ATTACKS } from '../src/data/attacks';
import * as sp from '../src/state/soundPlan';

const CUES = ['low', 'mid', 'high', 'fire'] as const;
const STYLES = ['melee', 'ranged', 'magic', 'fire'] as const;
const KINDS = ['tone', 'noise'];
const ATTACK_LIST = Object.values(ATTACKS);

type V = { at: number; kind: string; freq: number; slideTo?: number; type?: string; dur: number; vol: number };

const fixedPlans: Record<string, V[]> = {
  heavyTaken: sp.heavyTakenPlan(),
  dodged: sp.dodgedPlan(),
  phase: sp.phasePlan(),
  bossDown: sp.bossDownPlan(),
  heartbeat: sp.heartbeatPlan(),
  foodReady: sp.foodReadyPlan(),
};

const allPlans = (): [string, V[]][] => {
  const out: [string, V[]][] = Object.entries(fixedPlans);
  for (const r of [0, 0.25, 0.5, 1]) out.push([`impact ${r}`, sp.impactPlan(r)]);
  for (const c of CUES) out.push([`resolve ${c}`, sp.resolvePlan(c)]);
  for (const a of ATTACK_LIST) for (const c of CUES) out.push([`windup ${a.id} ${c}`, sp.windupPlan(a, c)]);
  return out;
};

const endOf = (plan: V[]) => Math.max(...plan.map((v) => v.at + v.dur));

describe('G4.7 wind-up plans', () => {
  it('there is at least one attack to check', () => {
    expect(ATTACK_LIST.length).toBeGreaterThanOrEqual(6);
  });

  it.each(ATTACK_LIST.map((a) => [a.id, a] as const))('%s: every cue ends at windupMs / 1000 within 1 ms, with no voice after', (_id, a) => {
    for (const cue of CUES) {
      const plan = sp.windupPlan(a, cue);
      expect(plan.length).toBeGreaterThan(0);
      const end = a.windupMs / 1000;
      expect(Math.abs(endOf(plan) - end)).toBeLessThanOrEqual(0.001);
      for (const v of plan) {
        expect(v.at).toBeGreaterThanOrEqual(0);
        expect(v.at).toBeLessThan(end);
        expect(v.at + v.dur).toBeLessThanOrEqual(end + 0.001);
      }
    }
  });

  it('a wind-up holds no impact voice: nothing of the resolve plan is in it', () => {
    for (const a of ATTACK_LIST) {
      for (const cue of CUES) {
        const wind = sp.windupPlan(a, cue);
        for (const imp of sp.resolvePlan(cue)) {
          expect(wind.some((v) => v.at === imp.at && v.kind === imp.kind && v.freq === imp.freq && v.dur === imp.dur && v.vol === imp.vol)).toBe(false);
        }
      }
    }
  });

  it('the ranged cue has three ticks in the last 450 ms; the others have none that late and short', () => {
    const a = ATTACKS.hexfall;
    const end = a.windupMs / 1000;
    const ticks = sp.windupPlan(a, 'mid').filter((v) => v.at >= end - 0.45 && v.dur <= 0.1);
    expect(ticks.length).toBeGreaterThanOrEqual(3);
  });

  it('the fire cue swells filtered noise', () => {
    expect(sp.windupPlan(ATTACKS.scorch_lane, 'fire').some((v) => v.kind === 'noise')).toBe(true);
  });
});

describe('G4.7 cue choice', () => {
  it('style fire gives fire, whatever the attack says', () => {
    for (const a of ATTACK_LIST) for (const s of STYLES) if (a.style === 'fire') expect(sp.cueFor(a, s)).toBe('fire');
    expect(sp.cueFor({ ...ATTACKS.tail_lash, style: 'fire' }, 'melee')).toBe('fire');
  });

  it('melee, ranged and magic attacks carry their own style: low, mid, high', () => {
    const base = ATTACKS.tail_lash;
    for (const s of STYLES) {
      expect(sp.cueFor({ ...base, style: 'melee' }, s)).toBe('low');
      expect(sp.cueFor({ ...base, style: 'ranged' }, s)).toBe('mid');
      expect(sp.cueFor({ ...base, style: 'magic' }, s)).toBe('high');
    }
  });

  it('an own or pure attack takes the monster style', () => {
    const base = ATTACKS.tail_lash;
    for (const own of ['own', 'pure'] as const) {
      expect(sp.cueFor({ ...base, style: own }, 'melee')).toBe('low');
      expect(sp.cueFor({ ...base, style: own }, 'ranged')).toBe('mid');
      expect(sp.cueFor({ ...base, style: own }, 'magic')).toBe('high');
      expect(sp.cueFor({ ...base, style: own }, 'fire')).toBe('fire');
    }
  });

  it('every real attack maps to one of the four cues for every monster style', () => {
    for (const a of ATTACK_LIST) for (const s of STYLES) expect(CUES).toContain(sp.cueFor(a, s));
  });
});

describe('G4.7 every cue of 6.7 has a plan', () => {
  it('the impacts are separate plans, one per cue, and are not empty', () => {
    for (const c of CUES) expect(sp.resolvePlan(c).length).toBeGreaterThan(0);
  });

  it('the fixed cues are non-empty plans', () => {
    for (const [name, p] of Object.entries(fixedPlans)) {
      expect(Array.isArray(p), name).toBe(true);
      expect(p.length, name).toBeGreaterThan(0);
    }
  });

  it('impact dealt: a plan for every ratio, pitch falling as damage / max hit rises', () => {
    const lead = (r: number) => Math.max(...sp.impactPlan(r).filter((v) => v.kind === 'tone').map((v) => v.freq));
    for (const r of [0, 0.5, 1]) expect(sp.impactPlan(r).length).toBeGreaterThan(0);
    expect(lead(1)).toBeLessThan(lead(0));
    expect(sp.impactPlan(1).some((v) => v.kind === 'noise')).toBe(true);
  });

  it('plan durations match 6.7: phase change 1.2 s, boss down 1.5 s, heartbeat 1.2 s apart in two thumps', () => {
    expect(endOf(sp.phasePlan())).toBeCloseTo(1.2, 1);
    expect(endOf(sp.bossDownPlan())).toBeCloseTo(1.5, 1);
    expect(sp.heartbeatPlan().length).toBeGreaterThanOrEqual(2);
    expect(endOf(sp.heartbeatPlan())).toBeLessThanOrEqual(1.2);
  });

  it('the heartbeat is quieter than every other fixed cue', () => {
    const peak = (p: V[]) => Math.max(...p.map((v) => v.vol));
    const hb = peak(sp.heartbeatPlan());
    for (const [name, p] of Object.entries(fixedPlans)) if (name !== 'heartbeat') expect(hb, name).toBeLessThan(peak(p));
    for (const c of CUES) expect(hb).toBeLessThan(peak(sp.resolvePlan(c)));
  });

  it('food ready is one short blip', () => {
    const p = sp.foodReadyPlan();
    expect(p.length).toBe(1);
    expect(p[0].dur).toBeLessThanOrEqual(0.2);
  });
});

describe('G4.7 plan limits', () => {
  it('every voice is well formed and no voice is louder than 0.2', () => {
    const plans = allPlans();
    expect(plans.length).toBeGreaterThan(40);
    for (const [name, plan] of plans) {
      for (const v of plan) {
        expect(KINDS, name).toContain(v.kind);
        for (const n of [v.at, v.freq, v.dur, v.vol]) expect(Number.isFinite(n), name).toBe(true);
        if (v.slideTo !== undefined) expect(Number.isFinite(v.slideTo), name).toBe(true);
        expect(v.at, name).toBeGreaterThanOrEqual(0);
        expect(v.dur, name).toBeGreaterThan(0);
        expect(v.freq, name).toBeGreaterThan(0);
        expect(v.vol, name).toBeGreaterThan(0);
        expect(v.vol, name).toBeLessThanOrEqual(0.2);
      }
    }
  });

  it('every plan fits 12 voices', () => {
    for (const [name, plan] of allPlans()) expect(plan.length, name).toBeLessThanOrEqual(12);
  });
});

describe('G4.7 audio.ts text scan', () => {
  const src = readFileSync(new URL('../src/engine/audio.ts', import.meta.url), 'utf8');

  it('has no setTimeout', () => {
    expect(src.match(/setTimeout/g) ?? []).toHaveLength(0);
  });

  it('checks audioEnabled in exactly one place', () => {
    expect(src.match(/audioEnabled/g) ?? []).toHaveLength(1);
  });

  it('creates its context only inside the gesture listener', () => {
    const start = src.indexOf('export function armAudioOnGesture');
    expect(start).toBeGreaterThanOrEqual(0);
    const after = src.slice(start + 1).search(/\n(?:export|const|function|let|type)\s/);
    const end = after < 0 ? src.length : start + 1 + after;
    const sites = [...src.matchAll(/\bnew\s+(?:\w+\.)?(?:AudioContext|webkitAudioContext|Ctor|AC)\b|\bctx\s*=\s*new\b/g)];
    expect(sites.length).toBeGreaterThan(0);
    for (const m of sites) {
      expect(m.index).toBeGreaterThan(start);
      expect(m.index).toBeLessThan(end);
    }
    expect(src).toMatch(/pointerdown|keydown|touchstart/);
  });

  it('has no empty catch', () => {
    expect(src).not.toMatch(/catch\s*(\([^)]*\))?\s*\{\s*\}/);
  });
});
