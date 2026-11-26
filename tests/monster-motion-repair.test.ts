// M1b repair: the goblin raider's clips across a cancelled wind-up, a death mid-attack, a death under hit stop and a respawn.
// Separate from monster-motion.test.ts (M1's, untouched); same fixtures.
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MONSTER_TYPES } from '../src/data/world';
import { DYING_SECS } from '../src/state/monsterAi';
import type { MonsterEntity } from '../src/engine/context';
import { upgradeMonsterRigWithGltf } from '../src/engine/blenderMonsters';
import type { BlenderHeroAnimator, HeroClipName } from '../src/engine/blenderHero';
import { poseMonsterDying, poseMonsterLimbs, resetMonsterMotion } from '../src/engine/monsterMeshes';
import { hitStop, updateReactions } from '../src/engine/reactions';

vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });

type Animated = MonsterEntity & { animator?: BlenderHeroAnimator };

const readGlb = async (file: string): Promise<GLTF> => {
  const buf = fs.readFileSync(path.resolve(__dirname, '../public/models', file));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise<GLTF>((resolve, reject) => new GLTFLoader().parse(ab, '', resolve, reject));
};
const hero = await readGlb('hero.glb');
const monsters = await readGlb('monsters.glb');

const SLASH = 'Slash' as HeroClipName;
const DEATH = 'Death' as HeroClipName;
const DT = 1 / 60;

function makeGoblin(): Animated {
  const group = new THREE.Group();
  const hitbox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  group.add(hitbox);
  const m = {
    typeKey: 'goblin',
    modelKey: 'goblin',
    def: MONSTER_TYPES.goblin,
    rig: { group, hitbox },
    logic: { state: 'idle', windup: null },
    pos: group.position,
    flinch: 0,
    attackAnim: 0
  } as unknown as Animated;
  expect(upgradeMonsterRigWithGltf(m, monsters, hero)).toBe(true);
  return m;
}

const frame = (m: Animated, moving = false, dt = DT): void => poseMonsterLimbs(m, moving, 0, dt);
const windup = (m: Animated, progress: number): void => {
  m.logic.state = 'attack';
  (m.logic as { windup: unknown }).windup = progress < 0 ? null : { left: 1 - progress, total: 1 };
};
const weight = (m: Animated, name: HeroClipName): number => {
  const a = m.animator!.actions.get(name)!;
  return a.isScheduled() && a.enabled ? a.getEffectiveWeight() : 0;
};

/** Plays a whole death through the rules timer, with `stopMs` of hit stop from its first frame. */
function die(m: Animated, stopMs = 0): void {
  m.logic.state = 'dying';
  if (stopMs > 0) hitStop(m, stopMs);
  let left = DYING_SECS;
  for (;;) {
    updateReactions(DT);
    poseMonsterDying(m, left, DT);
    if (left <= DT) return;
    left -= DT;
  }
}

describe('M1b repair', () => {
  it('a cancelled wind-up fades out and never plays the strike', () => {
    const m = makeGoblin();
    const slash = m.animator!.actions.get(SLASH)!;
    windup(m, 0);
    for (let i = 0; i < 6; i++) frame(m);
    windup(m, 0.9);
    for (let i = 0; i < 3; i++) frame(m);
    const held = slash.time;
    expect(held).toBeGreaterThan(0);
    windup(m, -1); // cancel: attackAnim stays 0, no strike
    m.logic.state = 'return';
    for (let i = 0; i < 60; i++) frame(m, true);
    expect(slash.time, 'the held clip did not play on').toBeLessThanOrEqual(held + 1e-6);
    expect(weight(m, SLASH), 'and it faded out').toBe(0);
  });

  it('a death mid wind-up has only Death in the mix', () => {
    const m = makeGoblin();
    windup(m, 0);
    for (let i = 0; i < 4; i++) frame(m);
    windup(m, 0.8);
    frame(m);
    expect(weight(m, SLASH)).toBe(1);
    windup(m, -1);
    die(m);
    expect(weight(m, SLASH)).toBe(0);
    expect(weight(m, 'Idle' as HeroClipName)).toBe(0);
    expect(weight(m, 'Walk' as HeroClipName)).toBe(0);
    expect(weight(m, DEATH)).toBe(1);
  });

  it('a death mid strike has only Death in the mix', () => {
    const m = makeGoblin();
    m.attackAnim = 1;
    for (let i = 0; i < 5; i++) frame(m);
    expect(m.animator!.actions.get(SLASH)!.isRunning()).toBe(true);
    die(m);
    expect(weight(m, SLASH)).toBe(0);
    expect(weight(m, DEATH)).toBe(1);
  });

  it('a killing blow\'s hit stop does not leave Death short of its last pose', () => {
    const m = makeGoblin();
    die(m, 110);
    const death = m.animator!.actions.get(DEATH)!;
    expect(death.time).toBeGreaterThanOrEqual(death.getClip().duration - 1e-6);
  });

  it('a respawned raider has no Death in its mix, and dies again from the start', () => {
    const m = makeGoblin();
    die(m);
    const death = m.animator!.actions.get(DEATH)!;
    resetMonsterMotion(m);
    m.logic.state = 'idle';
    for (let i = 0; i < 30; i++) frame(m, true);
    expect(weight(m, DEATH), 'Death is out of the mix').toBe(0);
    expect(weight(m, 'Walk' as HeroClipName) + weight(m, 'Idle' as HeroClipName)).toBeCloseTo(1, 6);
    m.logic.state = 'dying';
    poseMonsterDying(m, DYING_SECS, DT);
    expect(death.time, 'the clip replays from its start').toBeLessThan(0.1 * death.getClip().duration);
    expect(weight(m, DEATH)).toBe(1);
  });
});
