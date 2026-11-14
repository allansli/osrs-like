// Monster rules (design 5.4, Stage 1 shape; Stage 2 territory and aggression):
// a pure step function and the hit entry point.
// The engine owns meshes, sounds and the HUD; it applies the events returned here.
import { MONSTER_TYPES } from '../data/world';
import { isInSafeZone, type CampDef } from '../data/worldMap';
import { monsterThreatColor } from './adventure';
import { moveWithCollision } from './collision';

export type MonsterState = 'idle' | 'chase' | 'attack' | 'return' | 'dying' | 'dead';

export type MonsterLogic = {
  typeKey: string;
  level: number;
  style: string;
  maxHp: number;
  hp: number;
  x: number;
  z: number;
  homeX: number;
  homeZ: number;
  state: MonsterState;
  attackCooldown: number;
  wanderTimer: number;
  wanderRadius: number;
  wanderX: number;
  wanderZ: number;
  /** Seconds left in `dying` or `dead`. */
  timer: number;
  breathCount: number;
  campId?: string;
  stallTimer: number;
  stallX: number;
  stallZ: number;
};

export type MonsterEvent = { kind: 'attack' | 'died' | 'respawned' | 'aggro' | 'reset' };

export type StepWorld = {
  playerX: number;
  playerZ: number;
  playerDown: boolean;
  dt: number;
  rand: () => number;
  playerCombat?: number;
  playerSafe?: boolean;
  camps?: CampDef[];
};

const DROP_DIST = 26;
const MELEE_RANGE = 2.9;
const FAR_RANGE = 11.0;
const CHASE_SPEED = 5.2;
const WANDER_SPEED = 1.8;
const ATTACK_INTERVAL = 1.65;
const DYING_SECS = 0.85;
const DEAD_SECS = 7.5;

/** Aggression grace after load, teleport and respawn (design 6.5). */
export const AGGRO_GRACE_MS = 3000;

/** `playerSafe` for stepMonster: inside a safe zone, or before `graceUntil` (same clock as `now`). */
export function isPlayerSafe(x: number, z: number, now: number, graceUntil: number): boolean {
  return isInSafeZone(x, z) || now < graceUntil;
}

export function createMonsterLogic(
  typeKey: string,
  homeX: number,
  homeZ: number,
  opts?: { campId?: string; wander?: number }
): MonsterLogic {
  const def = MONSTER_TYPES[typeKey];
  if (!def) throw new Error(`createMonsterLogic: unknown monster type "${typeKey}"`);
  return {
    typeKey,
    level: def.level,
    style: def.style,
    maxHp: def.hp,
    hp: def.hp,
    x: homeX,
    z: homeZ,
    homeX,
    homeZ,
    state: 'idle',
    attackCooldown: 0,
    // The shortest wander interval. spawnMonster replaces it with today's random 0-3 s stagger.
    wanderTimer: 2.5,
    wanderRadius: opts?.wander ?? 4.5,
    // A wander target at home is the same as no target: the monster starts there and stands still.
    wanderX: homeX,
    wanderZ: homeZ,
    timer: 0,
    breathCount: 0,
    campId: opts?.campId,
    stallTimer: 1.5,
    stallX: homeX,
    stallZ: homeZ
  };
}

/** Dying or dead: what `monster.dead` meant before the reshape. */
export function isDown(m: MonsterLogic): boolean {
  return m.state === 'dying' || m.state === 'dead';
}

export function inCombat(m: MonsterLogic): boolean {
  return m.state === 'chase' || m.state === 'attack';
}

export function attackRange(m: MonsterLogic): number {
  return (m.style === 'magic' || m.style === 'ranged') ? FAR_RANGE : MELEE_RANGE;
}

/** Every 1.5 s: true when the monster moved less than 0.2 since the last check. */
function stalled(m: MonsterLogic, dt: number): boolean {
  m.stallTimer -= dt;
  if (m.stallTimer > 0) return false;
  const distMoved = Math.hypot(m.x - m.stallX, m.z - m.stallZ);
  m.stallTimer = 1.5;
  m.stallX = m.x;
  m.stallZ = m.z;
  return distMoved < 0.2;
}

export function stepMonster(m: MonsterLogic, world: StepWorld): MonsterEvent[] {
  const { dt, rand } = world;

  if (m.state === 'dying') {
    m.timer -= dt;
    if (m.timer <= 0) {
      m.state = 'dead';
      m.timer = DEAD_SECS;
    }
    return [];
  }

  if (m.state === 'dead') {
    m.timer -= dt;
    if (m.timer <= 0) {
      m.state = 'idle';
      m.hp = m.maxHp;
      m.breathCount = 0;
      m.x = m.homeX;
      m.z = m.homeZ;
      return [{ kind: 'respawned' }];
    }
    return [];
  }

  if (m.state === 'return') {
    const dx = m.homeX - m.x;
    const dz = m.homeZ - m.z;
    const dist = Math.hypot(dx, dz);
    // Blocked on the way home (river, wall): the same stall test as chase puts it home.
    const stuck = dist > 1.0 && stalled(m, dt);
    if (dist <= 1.0 || stuck) {
      if (stuck) {
        m.x = m.homeX;
        m.z = m.homeZ;
      }
      m.state = 'idle';
      m.hp = m.maxHp;
      m.breathCount = 0;
      return [{ kind: 'reset' }];
    }
    const moveDist = Math.min(dist, CHASE_SPEED * dt);
    const stepped = moveWithCollision(m.x, m.z, (dx / dist) * moveDist, (dz / dist) * moveDist);
    m.x = stepped.x;
    m.z = stepped.z;
    return [];
  }

  if (m.state === 'chase' || m.state === 'attack') {
    const camp = world.camps?.find((c) => c.id === m.campId);
    const distToPlayer = Math.hypot(world.playerX - m.x, world.playerZ - m.z);
    const distMonsterToCamp = camp ? Math.hypot(m.x - camp.x, m.z - camp.z) : 0;

    const leashTriggered = camp ? distMonsterToCamp > camp.radius + 4 : false;
    const playerTooFar = distToPlayer > DROP_DIST;
    const playerDown = world.playerDown;
    const safeInAggroCamp = !!(world.playerSafe && camp?.aggressive);

    const stallTriggered = m.state === 'chase' && stalled(m, dt);

    if (leashTriggered || playerTooFar || playerDown || safeInAggroCamp || stallTriggered) {
      m.state = 'return';
      m.stallTimer = 1.5;
      m.stallX = m.x;
      m.stallZ = m.z;
      return [];
    }

    if (distToPlayer > attackRange(m)) {
      if (m.state !== 'chase') {
        m.state = 'chase';
        m.stallTimer = 1.5;
        m.stallX = m.x;
        m.stallZ = m.z;
      }
      const dx = world.playerX - m.x;
      const dz = world.playerZ - m.z;
      const stepped = moveWithCollision(m.x, m.z, (dx / distToPlayer) * CHASE_SPEED * dt, (dz / distToPlayer) * CHASE_SPEED * dt);
      m.x = stepped.x;
      m.z = stepped.z;
      return [];
    }

    m.state = 'attack';
    m.attackCooldown -= dt;
    if (m.attackCooldown <= 0) {
      m.attackCooldown = ATTACK_INTERVAL;
      return [{ kind: 'attack' }];
    }
    return [];
  }

  // idle: check T2 (camp aggro)
  const camp = world.camps?.find((c) => c.id === m.campId);
  if (
    camp &&
    camp.aggressive &&
    !world.playerDown &&
    !world.playerSafe &&
    world.playerCombat != null &&
    monsterThreatColor(m.level, world.playerCombat) !== 'green'
  ) {
    const distToPlayer = Math.hypot(world.playerX - m.x, world.playerZ - m.z);
    const aggroRadius = camp.aggroRadius ?? (m.style === 'magic' || m.style === 'ranged' ? 12 : 9);
    const distPlayerToCamp = Math.hypot(world.playerX - camp.x, world.playerZ - camp.z);

    if (distToPlayer <= aggroRadius && distPlayerToCamp <= camp.radius) {
      m.state = 'chase';
      m.stallTimer = 1.5;
      m.stallX = m.x;
      m.stallZ = m.z;
      const events: MonsterEvent[] = [{ kind: 'aggro' }];
      if (distToPlayer <= attackRange(m)) {
        m.state = 'attack';
        m.attackCooldown -= dt;
        if (m.attackCooldown <= 0) {
          m.attackCooldown = ATTACK_INTERVAL;
          events.push({ kind: 'attack' });
        }
      }
      return events;
    }
  }

  // idle: wander
  m.wanderTimer -= dt;
  if (m.wanderTimer <= 0) {
    m.wanderTimer = 2.5 + rand() * 4;
    const ang = rand() * Math.PI * 2;
    const rad = rand() * m.wanderRadius;
    m.wanderX = m.homeX + Math.cos(ang) * rad;
    m.wanderZ = m.homeZ + Math.sin(ang) * rad;
  }
  const dx = m.wanderX - m.x;
  const dz = m.wanderZ - m.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 0.3) {
    const stepped = moveWithCollision(m.x, m.z, (dx / dist) * WANDER_SPEED * dt, (dz / dist) * WANDER_SPEED * dt);
    m.x = stepped.x;
    m.z = stepped.z;
  }
  return [];
}

/** The player's attack resolves against the monster (dmg 0 is a miss). */
export function onPlayerHit(m: MonsterLogic, dmg: number): { applied: boolean; events: MonsterEvent[] } {
  if (isDown(m) || m.state === 'return') return { applied: false, events: [] };
  if (m.state === 'idle') {
    m.state = 'chase';
    m.stallTimer = 1.5;
    m.stallX = m.x;
    m.stallZ = m.z;
  }
  if (dmg <= 0) return { applied: true, events: [] };
  m.hp = Math.max(0, m.hp - dmg);
  if (m.hp > 0) return { applied: true, events: [] };
  m.state = 'dying';
  m.timer = DYING_SECS;
  return { applied: true, events: [{ kind: 'died' }] };
}
