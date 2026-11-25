// Pattern step of a monster (design 6.2): wind-up, resolve, recovery and the slot choice,
// plus the boss rules of design 6.4 that share its state (opening, phases, arena).
// Pure; monsterAi.ts calls it. Types only from monsterAi, so there is no import cycle.
import {
  ATTACKS,
  BOSS_ARENA_MARGIN,
  BOSS_FIRST_ENTRY_SECS,
  BOSS_OUTSIDE_SECS,
  CADENCE_SECS,
  CAMP_WINDUP_GAP_SECS,
  TELEGRAPH_TIME_SCALE,
  type BossDef
} from '../data/attacks';
import { inShape } from './telegraph';
import type { MonsterEvent, MonsterLogic, StepWorld } from './monsterAi';

/** Advances a wind-up, then the recovery. Returns events when the step is consumed, null when the monster is free to act. */
export function stepWindupAndRecovery(m: MonsterLogic, world: StepWorld, cadenceMult = 1): MonsterEvent[] | null {
  const dt = world.dt;
  if (m.windup) {
    m.windup.left -= dt;
    if (m.windup.left <= 0) {
      const attack = ATTACKS[m.windup.attackId];
      const hit = inShape(attack.shape, m.windup.ox, m.windup.oz, m.windup.dx, m.windup.dz, world.playerX, world.playerZ);
      const windSecs = (attack.windupMs * TELEGRAPH_TIME_SCALE) / 1000;
      const slotSecs = Math.max(attack.slots * CADENCE_SECS * cadenceMult, windSecs + 0.15);
      m.recoverLeft = (slotSecs - windSecs) + m.windup.left;
      const ev: MonsterEvent = { kind: 'resolve', attackId: m.windup.attackId, hit };
      m.windup = null;
      return [ev];
    }
    return [];
  }
  if (m.recoverLeft > 0) {
    m.recoverLeft -= dt;
    if (m.recoverLeft > 0) {
      return [];
    }
    m.recoverLeft = 0;
  }
  return null;
}

/** One attack slot of a patterned type: a basic, a heavy wind-up, or a basic when the camp gate is shut (a boss passes campGated false). */
export function patternAttack(m: MonsterLogic, world: StepWorld, pattern: string[], attackInterval: number, campGated = true): MonsterEvent[] {
  m.attackCooldown -= world.dt;
  if (m.attackCooldown > 0) {
    return [];
  }

  const attackId = pattern[m.patternIdx % pattern.length];
  if (attackId === 'basic') {
    m.attackCooldown = attackInterval;
    m.patternIdx = (m.patternIdx + 1) % pattern.length;
    return [{ kind: 'attack' }];
  }

  const gateTime = (campGated && m.campId && world.windupGate) ? (world.windupGate[m.campId] ?? 0) : 0;
  const isGateShut = (campGated && world.windupGate !== undefined && m.campId !== undefined) && gateTime > 0;

  if (isGateShut) {
    m.attackCooldown = attackInterval;
    return [{ kind: 'attack' }];
  }

  const attack = ATTACKS[attackId];
  const windSecs = (attack.windupMs * TELEGRAPH_TIME_SCALE) / 1000;
  if (campGated && world.windupGate && m.campId) {
    world.windupGate[m.campId] = windSecs + CAMP_WINDUP_GAP_SECS;
  }

  m.patternIdx = (m.patternIdx + 1) % pattern.length;

  const atTarget = attack.shape.type === 'circle' && attack.shape.anchor === 'target';
  const ox = atTarget ? world.playerX : m.x, oz = atTarget ? world.playerZ : m.z;
  const dirX = world.playerX - m.x, dirZ = world.playerZ - m.z;
  const dirDist = Math.hypot(dirX, dirZ);
  const dx = dirDist > 0.0001 ? dirX / dirDist : 1, dz = dirDist > 0.0001 ? dirZ / dirDist : 0;
  const ms = attack.windupMs * TELEGRAPH_TIME_SCALE;

  m.windup = { attackId, left: windSecs, total: windSecs, ox, oz, dx, dz };
  m.attackCooldown = 0;
  return [{ kind: 'windup', attackId, ox, oz, dx, dz, ms }];
}

/** The boss's first pull, by proximity or by a hit: the opening shift and the phase-0 event. */
export function startBossOpening(m: MonsterLogic, boss: BossDef): MonsterEvent[] {
  m.phase = 0;
  m.shiftLeft = boss.openingShiftMs / 1000;
  m.attackCooldown = BOSS_FIRST_ENTRY_SECS;
  return [{ kind: 'phase', index: 0 }];
}

/** Counts the seconds the target spends beyond the arena margin; true once the boss gives up. */
export function bossTargetGaveUp(m: MonsterLogic, boss: BossDef, px: number, pz: number, dt: number): boolean {
  const beyond = Math.hypot(px - m.homeX, pz - m.homeZ) > boss.arenaRadius + BOSS_ARENA_MARGIN;
  m.outsideFor = beyond ? m.outsideFor + dt : 0;
  return m.outsideFor >= BOSS_OUTSIDE_SECS;
}

/** Keeps a stepped position inside the boss's arena circle. */
export function clampToArena(m: MonsterLogic, p: { x: number; z: number }, boss: BossDef): void {
  const hx = p.x - m.homeX;
  const hz = p.z - m.homeZ;
  const hd = Math.hypot(hx, hz);
  if (hd > boss.arenaRadius) {
    p.x = m.homeX + (hx / hd) * boss.arenaRadius;
    p.z = m.homeZ + (hz / hd) * boss.arenaRadius;
  }
}

/** A hit that crosses the phase threshold clamps there and starts the shift; null when it does not. */
export function crossPhase(m: MonsterLogic, boss: BossDef, dmg: number): MonsterEvent[] | null {
  const thresholdHp = Math.round(m.maxHp * boss.phases[m.phase].untilHpFrac);
  if (thresholdHp <= 0 || m.hp - dmg > thresholdHp) return null;
  m.hp = thresholdHp;
  m.phase += 1;
  m.shiftLeft = boss.phases[m.phase].shiftMs / 1000;
  m.attackCooldown = BOSS_FIRST_ENTRY_SECS;
  m.patternIdx = 0;
  const events: MonsterEvent[] = [{ kind: 'phase', index: m.phase }];
  if (m.windup) {
    m.windup = null;
    m.recoverLeft = 0;
    events.push({ kind: 'cancel' });
  }
  return events;
}
