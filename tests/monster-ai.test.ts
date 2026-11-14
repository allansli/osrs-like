import { describe, expect, it } from 'vitest';
import { createMonsterLogic, onPlayerHit, stepMonster } from '../src/state/monsterAi';

// Stage 1 world shape only (design 5.4). Stage 2 adds optional fields, so these stay valid.
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

type Logic = ReturnType<typeof createMonsterLogic>;

function stepOnce(m: Logic, px: number, pz: number, dt: number, rand: () => number, playerDown = false) {
  return stepMonster(m, { playerX: px, playerZ: pz, playerDown, dt, rand });
}

/** Goblin at the origin, hit once for 0 so it is in chase. */
function chasing(typeKey = 'goblin'): Logic {
  const m = createMonsterLogic(typeKey, 0, 0);
  onPlayerHit(m, 0);
  return m;
}

describe('monsterAi step function', () => {
  it('a passive monster stays idle for 60 simulated seconds without a hit', () => {
    const m = createMonsterLogic('goblin', 0, 0);
    const rand = seeded(1);
    for (let t = 0; t < 600; t++) {
      // Player standing right next to it: only a hit may start a fight.
      const events = stepOnce(m, 1, 1, 0.1, rand);
      expect(events).toEqual([]);
      expect(m.state).toBe('idle');
    }
    expect(m.hp).toBe(m.maxHp);
  });

  it('onPlayerHit with dmg 0 sends idle to chase', () => {
    const m = createMonsterLogic('goblin', 0, 0);
    onPlayerHit(m, 0);
    expect(m.state).toBe('chase');
    expect(m.hp).toBe(m.maxHp);
  });

  it('onPlayerHit reduces hp', () => {
    const m = createMonsterLogic('goblin', 0, 0);
    const before = m.hp;
    const r = onPlayerHit(m, 3);
    expect(r.applied).toBe(true);
    expect(m.hp).toBe(before - 3);
    expect(m.state).toBe('chase');
  });

  it('chase becomes attack within 2.9 for melee and 11.0 for ranged or magic', () => {
    const rand = seeded(2);
    for (const [key, range] of [['goblin', 2.9], ['goblin_archer', 11.0], ['dark_wizard', 11.0]] as const) {
      const inside = chasing(key);
      for (let i = 0; i < 3; i++) stepOnce(inside, range - 0.1, 0, 0.001, rand);
      expect(inside.state, `${key} just inside ${range}`).toBe('attack');

      const outside = chasing(key);
      for (let i = 0; i < 3; i++) stepOnce(outside, range + 0.1, 0, 0.001, rand);
      expect(outside.state, `${key} just outside ${range}`).toBe('chase');
    }
  });

  it('attack returns to chase beyond range', () => {
    const rand = seeded(3);
    const m = chasing();
    for (let i = 0; i < 3; i++) stepOnce(m, 2, 0, 0.01, rand);
    expect(m.state).toBe('attack');
    for (let i = 0; i < 3; i++) stepOnce(m, 6, 0, 0.001, rand);
    expect(m.state).toBe('chase');
  });

  it('first attack event is immediate, then every 1.65 s', () => {
    const rand = seeded(4);
    const m = chasing();
    const dt = 0.05;
    const times: number[] = [];
    for (let i = 1; i <= 140; i++) {
      for (const e of stepOnce(m, 2, 0, dt, rand)) if (e.kind === 'attack') times.push(i * dt);
    }
    expect(times.length).toBeGreaterThanOrEqual(4);
    expect(times[0]).toBeLessThanOrEqual(2 * dt + 1e-9);
    for (let i = 1; i < times.length; i++) {
      expect(Math.abs(times[i] - times[i - 1] - 1.65)).toBeLessThanOrEqual(dt + 1e-9);
    }
  });

  it('returns home, cannot be damaged on the way, and is healed on arrival', () => {
    // Planned replacement #3 (design 6.11, CALL-8): beyond 26 the monster goes home instead of stopping.
    const rand = seeded(5);
    const m = createMonsterLogic('goblin', 0, 0);
    onPlayerHit(m, 1);
    const hp = m.hp;
    expect(hp).toBeLessThan(m.maxHp);
    for (let i = 0; i < 40; i++) stepOnce(m, 20, 0, 0.05, rand);
    expect(m.x).toBeGreaterThan(5);
    stepOnce(m, 40, 0, 0.05, rand);
    const state: string = m.state;
    expect(state).toBe('return');
    const r = onPlayerHit(m, 1);
    expect(r.applied).toBe(false);
    expect(m.hp).toBe(hp);
    let home = false;
    for (let i = 0; i < 200 && !home; i++) {
      stepOnce(m, 40, 0, 0.05, rand);
      home = m.state === 'idle';
      if (!home) expect(m.hp).toBe(hp);
    }
    expect(home).toBe(true);
    expect(Math.hypot(m.x - m.homeX, m.z - m.homeZ)).toBeLessThanOrEqual(1.0 + 5.2 * 0.05 + 1e-9);
    expect(m.hp).toBe(m.maxHp);
  });

  it('hp 0 enters dying and emits died', () => {
    const m = createMonsterLogic('goblin', 0, 0);
    const r = onPlayerHit(m, m.maxHp);
    expect(r.applied).toBe(true);
    expect(r.events.some((e) => e.kind === 'died')).toBe(true);
    expect(m.hp).toBe(0);
    expect(m.state).toBe('dying');
  });

  it('dying lasts 0.85 s, dead lasts 7.5 s, then idle at home with full HP', () => {
    const rand = seeded(6);
    const m = createMonsterLogic('goblin', 3, 4);
    onPlayerHit(m, m.maxHp);
    const dt = 0.05;
    const run = (secs: number) => {
      const out = [];
      for (let i = 0; i < Math.round(secs / dt); i++) out.push(...stepOnce(m, 50, 50, dt, rand));
      return out;
    };
    run(0.8);
    expect(m.state).toBe('dying');
    run(0.1);
    expect(m.state).toBe('dead');
    run(7.3); // 8.2 s since death, inside 0.85 + 7.5
    expect(m.state).toBe('dead');
    const events = run(0.3); // 8.5 s, past 8.35
    expect(events.some((e) => e.kind === 'respawned')).toBe(true);
    expect(m.state).toBe('idle');
    expect(m.hp).toBe(m.maxHp);
    expect(m.x).toBe(3);
    expect(m.z).toBe(4);
  });

  it('idle wanders within 4.5 of home at 1.8 units/s', () => {
    const rand = seeded(7);
    const m = createMonsterLogic('goblin', 0, 0);
    const dt = 0.05;
    let maxFromHome = 0;
    let maxStep = 0;
    for (let i = 0; i < 1200; i++) {
      const px = m.x;
      const pz = m.z;
      stepOnce(m, 80, 80, dt, rand);
      maxStep = Math.max(maxStep, Math.hypot(m.x - px, m.z - pz));
      maxFromHome = Math.max(maxFromHome, Math.hypot(m.x - m.homeX, m.z - m.homeZ));
    }
    expect(maxFromHome).toBeGreaterThan(0.5);
    expect(maxFromHome).toBeLessThanOrEqual(4.5 + 1.8 * dt);
    expect(maxStep).toBeLessThanOrEqual(1.8 * dt + 1e-9);
    expect(maxStep).toBeGreaterThan(1.8 * dt * 0.99);
  });
});
