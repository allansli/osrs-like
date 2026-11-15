// Pattern step of a monster (design 6.2): wind-up, resolve, recovery and the slot choice.
// Pure; monsterAi.ts calls it. Types only from monsterAi, so there is no import cycle.
import { ATTACKS, CADENCE_SECS, CAMP_WINDUP_GAP_SECS, TELEGRAPH_TIME_SCALE } from '../data/attacks';
import { inShape } from './telegraph';
import type { MonsterEvent, MonsterLogic, StepWorld } from './monsterAi';

/** Advances a wind-up, then the recovery. Returns events when the step is consumed, null when the monster is free to act. */
export function stepWindupAndRecovery(m: MonsterLogic, world: StepWorld): MonsterEvent[] | null {
  const dt = world.dt;
  if (m.windup) {
    m.windup.left -= dt;
    if (m.windup.left <= 0) {
      const attack = ATTACKS[m.windup.attackId];
      const hit = inShape(attack.shape, m.windup.ox, m.windup.oz, m.windup.dx, m.windup.dz, world.playerX, world.playerZ);
      const windSecs = (attack.windupMs * TELEGRAPH_TIME_SCALE) / 1000;
      const slotSecs = Math.max(attack.slots * CADENCE_SECS, windSecs + 0.15);
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

/** One attack slot of a patterned type: a basic, a heavy wind-up, or a basic when the camp gate is shut. */
export function patternAttack(m: MonsterLogic, world: StepWorld, pattern: string[], attackInterval: number): MonsterEvent[] {
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

  const gateTime = (m.campId && world.windupGate) ? (world.windupGate[m.campId] ?? 0) : 0;
  const isGateShut = (world.windupGate !== undefined && m.campId !== undefined) && gateTime > 0;

  if (isGateShut) {
    m.attackCooldown = attackInterval;
    return [{ kind: 'attack' }];
  }

  const attack = ATTACKS[attackId];
  const windSecs = (attack.windupMs * TELEGRAPH_TIME_SCALE) / 1000;
  if (world.windupGate && m.campId) {
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
