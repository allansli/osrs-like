import { describe, expect, it } from 'vitest';
import { CAMPS, isInSafeZone } from '../src/data/worldMap';
import { combatLevel } from '../src/state/adventure';
import { rollMonsterHit } from '../src/state/combat';
import { createDefaultState } from '../src/state/gameState';
import { createMonsterLogic, stepMonster } from '../src/state/monsterAi';

// Gate simulation (design 6.6, 6.11 G2.5; CALL-9). A scripted runner crosses Cinderstep Pass at 11.5 units/s,
// east to west, along the centre line and along each wall. The real stepMonster drives the four sentries
// and every `attack` event is resolved with rollMonsterHit, as performMonsterRetaliation does.

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

const SEEDS = 1000;
const RUN_SPEED = 11.5;
const DT = 1 / 60;
const START_X = -8; // Wardstone Cairn, outside the camp
const END_X = -80; // well past the leash (camp radius + 4)
const PASS_Z = 55;
const PASS_HALF_WIDTH = 2.5;
const LINES = [PASS_Z, PASS_Z - PASS_HALF_WIDTH, PASS_Z + PASS_HALF_WIDTH];

const SENTRY_CAMP = CAMPS.find((c) => c.id === 'pass_sentries');
if (!SENTRY_CAMP) throw new Error('gate-simulation: no pass_sentries camp in CAMPS');
const sentryCamp = SENTRY_CAMP;

type Character = ReturnType<typeof createDefaultState>;

function fresh(): Character {
  return createDefaultState();
}

function prayedForty(): Character {
  const s = createDefaultState();
  s.skills.hitpoints.lvl = 40;
  s.hp = 40;
  s.activePrayers.add('prot_melee');
  return s;
}

/**
 * One crossing. Returns whether the runner lives and how many attacks each sentry made.
 * With `stopOnDeath` false the runner keeps going on negative HP, which counts the blows the whole pass deals.
 */
function run(
  makeCharacter: () => Character,
  lineZ: number,
  seed: number,
  stopOnDeath = true
): { survived: boolean; attacks: number[] } {
  const rand = seeded(seed);
  const state = makeCharacter();
  const playerCombat = combatLevel(state);
  const sentries = sentryCamp.members.map((mem) => {
    const m = createMonsterLogic(mem.type, mem.x, mem.z, { campId: sentryCamp.id, wander: mem.wander });
    m.wanderTimer = rand() * 3; // spawnMonster's stagger
    return m;
  });
  const attacks = sentries.map(() => 0);
  let hp = state.hp;
  let px = START_X;

  while (px > END_X) {
    px = Math.max(END_X, px - RUN_SPEED * DT);
    const world = {
      playerX: px,
      playerZ: lineZ,
      playerDown: stopOnDeath && hp <= 0,
      dt: DT,
      rand,
      playerCombat,
      playerSafe: isInSafeZone(px, lineZ),
      camps: CAMPS
    };
    sentries.forEach((m, i) => {
      for (const ev of stepMonster(m, world)) {
        if (ev.kind !== 'attack') continue;
        attacks[i] += 1;
        m.breathCount += 1;
        hp -= rollMonsterHit(m.typeKey, m.breathCount, state, rand).dmg;
      }
    });
    if (stopOnDeath && hp <= 0) return { survived: false, attacks };
  }
  return { survived: hp > 0, attacks };
}

describe('gate simulation: Cinderstep Pass', () => {
  it('the pass sentries are four lesser demons with wander 1 on the pass', () => {
    expect(sentryCamp.aggressive).toBe(true);
    expect(sentryCamp.members.length).toBe(4);
    for (const mem of sentryCamp.members) {
      expect(mem.type).toBe('lesser_demon');
      expect(mem.wander).toBe(1);
      expect(Math.abs(mem.z - PASS_Z)).toBeLessThanOrEqual(PASS_HALF_WIDTH);
      expect(mem.x).toBeLessThan(START_X);
      expect(mem.x).toBeGreaterThan(END_X);
    }
  });

  it('a fresh character (10 HP, no prayer) survives fewer than 5% of runs', () => {
    const start = fresh();
    expect(start.hp).toBe(10);
    expect(start.activePrayers.size).toBe(0);
    for (const z of LINES) {
      let survived = 0;
      for (let seed = 1; seed <= SEEDS; seed++) if (run(fresh, z, seed).survived) survived++;
      expect(survived / SEEDS, `line z=${z}`).toBeLessThan(0.05);
    }
  });

  it('a character with 40 hitpoints and Protect from Melee survives every run', () => {
    for (const z of LINES) {
      for (let seed = 1; seed <= SEEDS; seed++) {
        expect(run(prayedForty, z, seed).survived, `line z=${z} seed ${seed}`).toBe(true);
      }
    }
  });

  it('every run records at least one attack per sentry', () => {
    for (const make of [fresh, prayedForty]) {
      for (const z of LINES) {
        for (let seed = 1; seed <= SEEDS; seed++) {
          // A fresh runner usually dies before the last sentry, so the crossing runs to the end regardless.
          const { attacks } = run(make, z, seed, false);
          for (const [i, n] of attacks.entries()) {
            expect(n, `line z=${z} seed ${seed} sentry ${i}`).toBeGreaterThanOrEqual(1);
          }
        }
      }
    }
  });
});
