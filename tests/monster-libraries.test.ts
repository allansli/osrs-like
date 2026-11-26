// M3b (models pass): monsters.glb holds more than one clip library (the dragon's, the scorpion's crawler library).
// A figure's animator takes only the clips whose every track is on its own bones, and a clip the file names
// `<model key>_<clip>` (because another library took the bare name) plays under the bare name.
// The scorpion cases run against a monsters.glb that carries the scorpion's library (the M3b build, K4's promote).
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MONSTER_MOTION } from '../src/data/monsterPoses';
import { MONSTER_TYPES } from '../src/data/world';
import { DYING_SECS } from '../src/state/monsterAi';
import type { MonsterEntity } from '../src/engine/context';
import { upgradeMonsterRigWithGltf } from '../src/engine/blenderMonsters';
import type { BlenderHeroAnimator, HeroClipName } from '../src/engine/blenderHero';
import { poseMonsterDying, poseMonsterLimbs } from '../src/engine/monsterMeshes';

// The scorpion's clips as K4 names them on the live row (plan K4 promote amendments); the export they came from is gone.
const PENDING_SCORPION_CLIPS = {
  clips: { idle: 'Idle', walk: 'Walk', attack: 'Strike', death: 'Death' },
  anticipation: 0.333333
};

vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });

type Animated = MonsterEntity & { animator?: BlenderHeroAnimator };

const readGlb = async (file: string): Promise<GLTF> => {
  const buf = fs.readFileSync(path.resolve(__dirname, '../public/models', file));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise<GLTF>((resolve, reject) => new GLTFLoader().parse(ab, '', resolve, reject));
};
const hero = await readGlb('hero.glb');
const monsters = await readGlb('monsters.glb');
const scorpionBuilt = monsters.animations.some((a) => a.name === 'scorpion_Idle');

function entity(key: string): Animated {
  const group = new THREE.Group();
  const hitbox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  group.add(hitbox);
  return {
    typeKey: key,
    modelKey: key,
    def: MONSTER_TYPES[key],
    rig: { group, hitbox },
    logic: { state: 'idle', windup: null },
    pos: group.position,
    flinch: 0,
    attackAnim: 0
  } as unknown as Animated;
}

const frame = (m: Animated, moving: boolean, dt = 1 / 30): void => poseMonsterLimbs(m, moving, 0, dt);

describe('each figure plays only its own library from monsters.glb', () => {
  it('the dragon\'s animator holds the dragon\'s five clips under their bare names, and no other library\'s', () => {
    const m = entity('elvarg_dragon');
    expect(upgradeMonsterRigWithGltf(m, monsters, hero)).toBe(true);
    expect([...m.animator!.actions.keys()].sort()).toEqual(['Bite', 'Death', 'Idle', 'Walk', 'WingBuffet']);
    for (const action of m.animator!.actions.values()) {
      for (const track of action.getClip().tracks) expect(track.name.startsWith('scorpion_'), track.name).toBe(false);
    }
  });

  it.skipIf(!scorpionBuilt)('the scorpion\'s animator holds Idle, Walk, Strike and Death (Idle, Walk and Death from scorpion_<clip>), on its own bones', async () => {
    const live = MONSTER_MOTION.scorpion;
    MONSTER_MOTION.scorpion = { ...live, ...PENDING_SCORPION_CLIPS };
    try {
      const m = entity('scorpion');
      expect(upgradeMonsterRigWithGltf(m, await readGlb('monsters.glb'), hero)).toBe(true);
      expect([...m.animator!.actions.keys()].sort()).toEqual(['Death', 'Idle', 'Strike', 'Walk']);
      const bones = new Set<string>();
      m.rig.group.traverse((o) => {
        if ((o as THREE.Bone).isBone) bones.add(o.name);
      });
      for (const action of m.animator!.actions.values()) {
        for (const track of action.getClip().tracks) {
          const [node, prop] = track.name.split('.');
          expect(bones.has(node), `${action.getClip().name}: ${track.name} binds a bone of the scorpion`).toBe(true);
          expect(MONSTER_MOTION.scorpion.bones).toContain(node);
          if (prop === 'position') expect(node).toBe('Hips');
        }
      }

      const bone = (name: string): THREE.Object3D => m.rig.group.getObjectByName(name)!;
      for (let i = 0; i < 10; i++) frame(m, true);
      expect(bone('LegL1').quaternion.angleTo(new THREE.Quaternion()), 'a leg swings in Walk').toBeGreaterThan(0.01);

      for (let i = 0; i < 30; i++) frame(m, false);
      m.logic.state = 'attack';
      (m.logic as { windup: unknown }).windup = { left: 0, total: 1 };
      frame(m, false);
      const strike = m.animator!.actions.get('Strike' as HeroClipName)!;
      expect(strike.time, 'the wind-up holds Strike at its anticipation').toBeCloseTo(PENDING_SCORPION_CLIPS.anticipation!, 3);
      (m.logic as { windup: unknown }).windup = null;
      m.attackAnim = 1;
      for (let i = 0; i < 6; i++) frame(m, false, 1 / 60);
      expect(strike.time, 'the strike plays on').toBeGreaterThan(PENDING_SCORPION_CLIPS.anticipation! + 0.02);
      expect(bone('TailPivot3').quaternion.angleTo(new THREE.Quaternion()), 'the tail moves in Strike').toBeGreaterThan(0.01);

      const death = m.animator!.actions.get('Death' as HeroClipName)!;
      const hipsRest = bone('Hips').position.y;
      const dt = 1 / 60;
      m.logic.state = 'dying';
      let left = DYING_SECS;
      while (left > dt) {
        poseMonsterDying(m, left, dt);
        left -= dt;
      }
      poseMonsterDying(m, left, dt);
      expect(m.rig.group.rotation.x, 'no group topple').toBe(0);
      expect(death.time).toBeGreaterThanOrEqual(death.getClip().duration - 0.05);
      expect(bone('Hips').position.y, 'the body lies lower than it stood').toBeLessThan(hipsRest - 0.03);
    } finally {
      MONSTER_MOTION.scorpion = live;
    }
  });
});
