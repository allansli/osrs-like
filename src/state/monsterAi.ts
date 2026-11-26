// Monster rules (design 5.4, Stage 1 shape; Stage 2 territory and aggression):
// a pure step function and the hit entry point.
// The engine owns meshes, sounds and the HUD; it applies the events returned here.
import { BOSSES, CADENCE_SECS, PATTERNS, type BossDef } from '../data/attacks';
import { MONSTER_TYPES } from '../data/world';
import { isInSafeZone, type CampDef } from '../data/worldMap';
import { moveWithCollision } from './collision';
import {
  escapeStall,
  entityGoal,
  findPath,
  isOpenCell,
  openStart,
  segmentWalkable,
  shouldRepath,
  STALL_SEC,
  type WalkGrid
} from './pathfind';
import { bossTargetGaveUp, clampToArena, crossPhase, patternAttack, startBossOpening, stepWindupAndRecovery } from './monsterPattern';

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
  path: [number, number][];
  pathGoalX: number;
  pathGoalZ: number;
  repathIn: number;
  returnLeft: number;
  routeStall: number;
  patternIdx: number;
  windup: { attackId: string; left: number; total: number; ox: number; oz: number; dx: number; dz: number } | null;
  recoverLeft: number;
  phase: number;
  shiftLeft: number;
  outsideFor: number;
};

export type MonsterEvent =
  | { kind: 'attack' }
  | { kind: 'died' }
  | { kind: 'respawned' }
  | { kind: 'aggro' }
  | { kind: 'reset' }
  | { kind: 'phase'; index: number }
  | { kind: 'windup'; attackId: string; ox: number; oz: number; dx: number; dz: number; ms: number }
  | { kind: 'resolve'; attackId: string; hit: boolean }
  | { kind: 'cancel' };

export type StepWorld = {
  playerX: number;
  playerZ: number;
  playerDown: boolean;
  dt: number;
  rand: () => number;
  playerCombat?: number;
  playerSafe?: boolean;
  camps?: CampDef[];
  grid?: WalkGrid;
  pathBudget?: { left: number };
  windupGate?: Record<string, number>;
};

export function tickWindupGates(gates: Record<string, number>, dt: number): void {
  for (const key of Object.keys(gates)) {
    gates[key] = Math.max(0, gates[key] - dt);
  }
}

const DROP_DIST = 26;
const MELEE_RANGE = 2.9;
const FAR_RANGE = 11.0;
const CHASE_SPEED = 5.2;
const WANDER_SPEED = 1.8;
export const ATTACK_INTERVAL = 1.65;
export const DYING_SECS = 0.85;
export const DEAD_SECS = 7.5;

/** The smallest sight radius: about a melee strike (2.9). A hero far above a monster must walk into it to be attacked. */
export const SIGHT_MIN = 3;
/** Combat levels above the monster at which its sight reaches the minimum. */
export const SIGHT_GAP = 10;

/**
 * How far an idle member of an AGGRESSIVE camp sees the hero.
 * `base` is the camp's aggroRadius (9 for melee, 12 for ranged and magic). At or below the monster's level the radius is
 * `base`; it falls in a straight line to SIGHT_MIN at SIGHT_GAP levels above, and stays there.
 * `keepsSight` is data on the camp: the pass sentries, boss camps and every dungeon camp never shrink.
 * A passive camp never calls this: it never starts a fight.
 */
export function sightRadius(base: number, monsterLevel: number, heroCombat: number, keepsSight: boolean, gap = SIGHT_GAP): number {
  const floor = Math.min(base, SIGHT_MIN);
  if (keepsSight) return base;
  const over = heroCombat - monsterLevel;
  if (over <= 0) return base;
  if (over >= gap) return floor;
  return base - (base - floor) * (over / gap);
}

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
    stallZ: homeZ,
    path: [],
    pathGoalX: homeX,
    pathGoalZ: homeZ,
    repathIn: ((Math.abs(homeX) * 12.9898 + Math.abs(homeZ) * 78.233) % 1) * 0.5,
    returnLeft: 0,
    routeStall: 0,
    patternIdx: 0,
    windup: null,
    recoverLeft: 0,
    phase: 0,
    shiftLeft: 0,
    outsideFor: 0
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

function routeLength(from: [number, number], route: [number, number][]): number {
  let len = 0;
  let prev = from;
  for (const p of route) {
    len += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    prev = p;
  }
  return len;
}

// A route from an open start: the start itself is kept as the first waypoint when the monster stands off it.
function fromStart(m: MonsterLogic, start: [number, number], route: [number, number][]): [number, number][] {
  return Math.hypot(start[0] - m.x, start[1] - m.z) > 0.001 ? [start, ...route] : route;
}

// One frame along m.path, dropping the waypoints already reached, then toward (goalX, goalZ) once it is empty.
// A boss stays in its arena; a monster that cannot move along its route for STALL_SEC escapes the stall.
function followPath(m: MonsterLogic, grid: WalkGrid, goalX: number, goalZ: number, dt: number, boss?: BossDef): void {
  while (m.path.length > 0 && Math.hypot(m.path[0][0] - m.x, m.path[0][1] - m.z) <= 0.45) {
    m.path.shift();
  }

  const targetX = m.path.length > 0 ? m.path[0][0] : goalX;
  const targetZ = m.path.length > 0 ? m.path[0][1] : goalZ;
  const dx = targetX - m.x;
  const dz = targetZ - m.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 0.0001) {
    const moveDist = Math.min(dist, CHASE_SPEED * dt);
    const stepped = moveWithCollision(m.x, m.z, (dx / dist) * moveDist, (dz / dist) * moveDist, grid.walkable);
    if (boss) clampToArena(m, stepped, boss);
    if (stepped.x === m.x && stepped.z === m.z && m.path.length > 0) {
      m.routeStall += dt;
      if (m.routeStall >= STALL_SEC - 1e-9) {
        escapeStall(grid, m.path, [m.x, m.z]);
        m.routeStall = 0;
      }
    } else {
      m.routeStall = 0;
    }
    m.x = stepped.x;
    m.z = stepped.z;
  }
}

function resetToIdle(m: MonsterLogic): void {
  m.state = 'idle';
  m.hp = m.maxHp;
  m.breathCount = 0;
  m.patternIdx = 0;
  m.windup = null;
  m.recoverLeft = 0;
  m.phase = 0;
  m.shiftLeft = 0;
  m.outsideFor = 0;
  m.path = [];
  m.repathIn = 0;
}

function enterReturn(m: MonsterLogic, world: StepWorld): void {
  m.state = 'return';
  m.stallTimer = 1.5;
  m.stallX = m.x;
  m.stallZ = m.z;
  m.routeStall = 0;
  m.windup = null;
  m.recoverLeft = 0;
  m.outsideFor = 0;
  if (world.grid) {
    const start = openStart(world.grid, m.x, m.z);
    const route = start ? findPath(world.grid, start, [m.homeX, m.homeZ], undefined, 6000) : null;
    if (start && route) {
      const fullRoute = fromStart(m, start, route);
      m.path = fullRoute;
      m.returnLeft = routeLength([m.x, m.z], fullRoute) / CHASE_SPEED + 3;
    } else {
      m.path = [];
      m.returnLeft = 3;
    }
  }
}

export function stepMonster(m: MonsterLogic, world: StepWorld): MonsterEvent[] {
  const { dt, rand } = world;

  if (m.state === 'dying') {
    m.timer -= dt;
    if (m.timer <= 0) {
      m.state = 'dead';
      const boss = BOSSES[m.typeKey];
      m.timer = boss ? boss.respawnSecs : DEAD_SECS;
    }
    return [];
  }

  if (m.state === 'dead') {
    m.timer -= dt;
    if (m.timer <= 0) {
      resetToIdle(m);
      m.x = m.homeX;
      m.z = m.homeZ;
      return [{ kind: 'respawned' }];
    }
    return [];
  }

  if (m.state === 'return') {
    if (!world.grid) {
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
        resetToIdle(m);
        return [{ kind: 'reset' }];
      }
      const moveDist = Math.min(dist, CHASE_SPEED * dt);
      const stepped = moveWithCollision(m.x, m.z, (dx / dist) * moveDist, (dz / dist) * moveDist);
      m.x = stepped.x;
      m.z = stepped.z;
      return [];
    }

    m.returnLeft -= dt;
    const distHome = Math.hypot(m.homeX - m.x, m.homeZ - m.z);
    if (distHome <= 1.0 || m.returnLeft <= 0) {
      if (m.returnLeft <= 0 && distHome > 1.0) {
        m.x = m.homeX;
        m.z = m.homeZ;
      }
      resetToIdle(m);
      m.path = [];
      return [{ kind: 'reset' }];
    }

    followPath(m, world.grid, m.homeX, m.homeZ, dt);
    return [];
  }

  m.shiftLeft = Math.max(0, m.shiftLeft - dt);

  if (m.state === 'chase' || m.state === 'attack') {
    const boss = BOSSES[m.typeKey];
    const camp = world.camps?.find((c) => c.id === m.campId);
    const distToPlayer = Math.hypot(world.playerX - m.x, world.playerZ - m.z);
    const distMonsterToCamp = camp ? Math.hypot(m.x - camp.x, m.z - camp.z) : 0;

    const leashTriggered = !boss && camp ? distMonsterToCamp > camp.radius + 4 : false;
    const playerTooFar = distToPlayer > DROP_DIST;
    const playerDown = world.playerDown;
    const safeTriggered = boss ? !!world.playerSafe : !!(world.playerSafe && camp?.aggressive);
    const stallTriggered = !boss && m.state === 'chase' && stalled(m, dt);
    const gaveUp = !!boss && bossTargetGaveUp(m, boss, world.playerX, world.playerZ, dt);

    if (leashTriggered || playerTooFar || playerDown || safeTriggered || stallTriggered || gaveUp) {
      if (m.windup) {
        m.windup = null;
        m.recoverLeft = 0;
        enterReturn(m, world);
        return [{ kind: 'cancel' }];
      }
      enterReturn(m, world);
      return [];
    }

    const pending = stepWindupAndRecovery(m, world, boss ? boss.phases[m.phase].cadenceMult : 1);
    if (pending) {
      return pending;
    }

    if (distToPlayer > attackRange(m)) {
      if ((MONSTER_TYPES[m.typeKey].pattern || boss) && m.shiftLeft === 0 && m.attackCooldown > 0) {
        m.attackCooldown = Math.max(0, m.attackCooldown - dt);
      }
      if (m.state !== 'chase') {
        m.state = 'chase';
        m.stallTimer = 1.5;
        m.stallX = m.x;
        m.stallZ = m.z;
        m.routeStall = 0;
      }

      if (!world.grid) {
        const dx = world.playerX - m.x;
        const dz = world.playerZ - m.z;
        const stepped = moveWithCollision(m.x, m.z, (dx / distToPlayer) * CHASE_SPEED * dt, (dz / distToPlayer) * CHASE_SPEED * dt);
        if (boss) clampToArena(m, stepped, boss);
        m.x = stepped.x;
        m.z = stepped.z;
        return [];
      }

      m.repathIn -= dt;

      if (m.repathIn <= 0) {
        const straightOpen = segmentWalkable(world.grid, [m.x, m.z], [world.playerX, world.playerZ]);
        if (straightOpen) {
          m.path = [];
          m.repathIn = 0.5;
        } else {
          const reachedLast = m.path.length === 0;
          const needRepath = shouldRepath([m.pathGoalX, m.pathGoalZ], [world.playerX, world.playerZ], reachedLast);
          if (needRepath) {
            const hasBudget = !world.pathBudget || world.pathBudget.left > 0;
            if (hasBudget) {
              if (world.pathBudget) world.pathBudget.left--;
              const start = openStart(world.grid, m.x, m.z);
              const goal = start ? entityGoal(world.grid, start, [world.playerX, world.playerZ], attackRange(m)) : null;
              const route = (start && goal) ? findPath(world.grid, start, goal, undefined, 6000) : null;
              if (!route || routeLength(start!, route) > 52) {
                enterReturn(m, world);
                return [];
              }
              m.path = fromStart(m, start!, route);
              m.pathGoalX = world.playerX;
              m.pathGoalZ = world.playerZ;
              m.repathIn = 0.5;
            }
          } else {
            m.repathIn = 0.5;
          }
        }
      }

      followPath(m, world.grid, world.playerX, world.playerZ, dt, boss);
      return [];
    }

    m.state = 'attack';
    m.path = [];
    m.routeStall = 0;

    if (boss) {
      if (m.shiftLeft > 0) return [];
      const phase = boss.phases[m.phase];
      return patternAttack(m, world, phase.pattern, CADENCE_SECS * phase.cadenceMult, false);
    }

    const def = MONSTER_TYPES[m.typeKey];
    const pattern = def.pattern ? PATTERNS[def.pattern] : undefined;

    if (!pattern) {
      m.attackCooldown -= dt;
      if (m.attackCooldown <= 0) {
        m.attackCooldown = ATTACK_INTERVAL;
        return [{ kind: 'attack' }];
      }
      return [];
    }

    return patternAttack(m, world, pattern, ATTACK_INTERVAL);
  }

  // idle: check T2 (camp aggro)
  const camp = world.camps?.find((c) => c.id === m.campId);
  if (
    camp &&
    camp.aggressive &&
    !world.playerDown &&
    !world.playerSafe &&
    world.playerCombat != null
  ) {
    const distToPlayer = Math.hypot(world.playerX - m.x, world.playerZ - m.z);
    const aggroRadius = sightRadius(
      camp.aggroRadius ?? (m.style === 'magic' || m.style === 'ranged' ? 12 : 9),
      m.level,
      world.playerCombat,
      !!camp.keepsSight
    );
    const distPlayerToCamp = Math.hypot(world.playerX - camp.x, world.playerZ - camp.z);

    if (distToPlayer <= aggroRadius && distPlayerToCamp <= camp.radius) {
      m.state = 'chase';
      m.patternIdx = 0;
      m.stallTimer = 1.5;
      m.stallX = m.x;
      m.stallZ = m.z;
      m.routeStall = 0;
      const events: MonsterEvent[] = [{ kind: 'aggro' }];
      const boss = BOSSES[m.typeKey];
      if (boss) {
        events.push(...startBossOpening(m, boss));
        return events;
      }
      if (distToPlayer <= attackRange(m)) {
        m.state = 'attack';
        m.path = [];
        m.attackCooldown -= dt;
        if (m.attackCooldown <= 0) {
          const def = MONSTER_TYPES[m.typeKey];
          const pattern = def.pattern ? PATTERNS[def.pattern] : undefined;
          m.attackCooldown = ATTACK_INTERVAL;
          if (pattern) m.patternIdx = (m.patternIdx + 1) % pattern.length;
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
    let chosenX = m.x;
    let chosenZ = m.z;
    let found = false;
    const maxDraws = world.grid ? 3 : 1;
    for (let draw = 0; draw < maxDraws; draw++) {
      const ang = rand() * Math.PI * 2;
      const rad = rand() * m.wanderRadius;
      const wx = m.homeX + Math.cos(ang) * rad;
      const wz = m.homeZ + Math.sin(ang) * rad;
      if (!world.grid) {
        chosenX = wx;
        chosenZ = wz;
        found = true;
        break;
      }
      if (isOpenCell(world.grid, wx, wz)) {
        chosenX = wx;
        chosenZ = wz;
        found = true;
        break;
      }
    }
    if (found) {
      m.wanderX = chosenX;
      m.wanderZ = chosenZ;
    } else {
      m.wanderX = m.x;
      m.wanderZ = m.z;
    }
  }
  const dx = m.wanderX - m.x;
  const dz = m.wanderZ - m.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 0.3) {
    const stepped = moveWithCollision(
      m.x,
      m.z,
      (dx / dist) * WANDER_SPEED * dt,
      (dz / dist) * WANDER_SPEED * dt,
      world.grid?.walkable
    );
    m.x = stepped.x;
    m.z = stepped.z;
  }
  return [];
}

/** The player's attack resolves against the monster (dmg 0 is a miss). */
export function onPlayerHit(m: MonsterLogic, dmg: number): { applied: boolean; events: MonsterEvent[]; reason?: string } {
  if (isDown(m) || m.state === 'return') return { applied: false, events: [] };
  const boss = BOSSES[m.typeKey];
  if (boss) {
    if (m.outsideFor > 0) return { applied: false, events: [], reason: 'arena' };
  }
  const opening: MonsterEvent[] = [];
  if (m.state === 'idle') {
    m.state = 'chase';
    m.patternIdx = 0;
    m.stallTimer = 1.5;
    m.stallX = m.x;
    m.stallZ = m.z;
    if (boss) opening.push(...startBossOpening(m, boss));
  }
  // After the idle branch, so the hit that pulls a boss is refused by the roar it starts.
  if (boss && m.shiftLeft > 0) return { applied: false, events: opening, reason: 'shift' };
  if (dmg <= 0) return { applied: true, events: opening };

  const crossed = boss ? crossPhase(m, boss, dmg) : null;
  if (crossed) return { applied: true, events: [...opening, ...crossed] };

  m.hp = Math.max(0, m.hp - dmg);
  if (m.hp > 0) return { applied: true, events: opening };
  m.state = 'dying';
  m.timer = DYING_SECS;
  const events: MonsterEvent[] = [...opening, { kind: 'died' }];
  if (m.windup) {
    m.windup = null;
    m.recoverLeft = 0;
    events.push({ kind: 'cancel' });
  }
  return { applied: true, events };
}
