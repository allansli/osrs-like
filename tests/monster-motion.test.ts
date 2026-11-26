// M1 (models pass): the motion table and the monster animator (design 6.1.3, 6.5; plan M1, R0 items 11 and 12).
// Red until M1b. It pins this interface, which M1b builds:
//   src/data/monsterPoses.ts (pure, imports nothing from three)
//     MONSTER_MOTION: Record<modelKey, { skeleton: 'biped' | 'dragon' | 'crawler'; bones: string[];
//       clips?: { idle: string; walk: string; attack: string; death: string; hurt?: string };
//       anticipation?: number }>
//       `bones`: the unprefixed bones the row poses (each must exist and carry weight on a skinned figure).
//       `clips`: present for a clip-driven row, absent for a row still posed in code.
//       `anticipation`: seconds, the attack clip's anticipation key (equals the library manifest's skin.attackClips).
//   upgradeMonsterRigWithGltf(entity, monstersGltf, heroGltf?): a row with clips gets `entity.animator`, a
//     BlenderHeroAnimator over the library of its skeleton (a biped's clips come from `heroGltf`), with the clips
//     cloned so the hero's own are never changed, and the `Hips` position track scaled by hip height over the hero's.
//   poseMonsterLimbs(entity, moving, now, dt): for a clip row it advances the animator (frozen during hit stop),
//     scrubs the attack clip to progress * anticipation while `logic.windup` is set, releases it when the windup
//     ends, then adds Stage 4's flinch (group lean and lift, head and arm offsets) after the animator.
//   poseMonsterDying(entity, timeLeft, dt): a clip row plays `Death` to its end inside DYING_SECS and is not toppled.
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MONSTER_MOTION, PENDING_DRAGON_CLIPS } from '../src/data/monsterPoses';
import { MONSTER_TYPES } from '../src/data/world';
import { KNOCK_BACK, springOffset } from '../src/data/feel';
import { DYING_SECS } from '../src/state/monsterAi';
import { getTerrainHeight } from '../src/state/terrain';
import type { MonsterEntity } from '../src/engine/context';
import { upgradeMonsterRigWithGltf } from '../src/engine/blenderMonsters';
import type { BlenderHeroAnimator, HeroClipName } from '../src/engine/blenderHero';
import { poseMonsterDying, poseMonsterLimbs } from '../src/engine/monsterMeshes';
import { hitStop, knockBack, updateReactions } from '../src/engine/reactions';

vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });

type Animated = MonsterEntity & { animator?: BlenderHeroAnimator };

const readGlb = async (file: string): Promise<GLTF> => {
  const buf = fs.readFileSync(path.resolve(__dirname, '../public/models', file));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise<GLTF>((resolve, reject) => new GLTFLoader().parse(ab, '', resolve, reject));
};
const hero = await readGlb('hero.glb');
const monsters = await readGlb('monsters.glb');
const heroManifest = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'fixtures/model-contract/hero.json'), 'utf8')
) as { skin: { attackClips: Record<string, number> } };

const modelOf = (key: string): string => (MONSTER_TYPES[key] as { model?: string }).model ?? key;
const MODEL_KEYS = [...new Set(Object.keys(MONSTER_TYPES).map(modelOf))];
const GROUND = getTerrainHeight(0, 0);

// --- the table -------------------------------------------------------------------------------------------------

describe('the motion table', () => {
  it('every model key has a motion row', () => {
    expect(MODEL_KEYS).toHaveLength(10);
    for (const key of MODEL_KEYS) {
      const row = MONSTER_MOTION[key];
      expect(row, `a motion row for ${key}`).toBeDefined();
      expect(['biped', 'dragon', 'crawler']).toContain(row.skeleton);
      expect(Array.isArray(row.bones)).toBe(true);
    }
  });

  it('the goblin raider plays the biped Idle, Walk, Slash and Death, and its anticipation is the library\'s', () => {
    const row = MONSTER_MOTION.goblin;
    expect(row.skeleton).toBe('biped');
    expect(row.clips).toMatchObject({ idle: 'Idle', walk: 'Walk', attack: 'Slash', death: 'Death' });
    expect(row.anticipation).toBeCloseTo(heroManifest.skin.attackClips.Slash, 3);
  });

  it('the table imports nothing from three', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../src/data/monsterPoses.ts'), 'utf8');
    expect(src).not.toMatch(/['"]three(\/[^'"]*)?['"]/);
  });
});

function skinnedMeshesOf(gltf: GLTF, key: string): THREE.SkinnedMesh[] {
  const out: THREE.SkinnedMesh[] = [];
  const node = gltf.scene.getObjectByName(`Monster_${key}`);
  expect(node, `Monster_${key} is in monsters.glb`).toBeDefined();
  node!.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) out.push(o as THREE.SkinnedMesh);
  });
  return out;
}

/** The unprefixed names of the bones that carry weight on at least one vertex of any mesh of the figure. */
function weightedBones(meshes: THREE.SkinnedMesh[], key: string): { all: Set<string>; weighted: Set<string> } {
  const strip = (n: string): string => (n.startsWith(`${key}_`) ? n.slice(key.length + 1) : n);
  const all = new Set<string>();
  const weighted = new Set<string>();
  for (const mesh of meshes) {
    const bones = mesh.skeleton.bones;
    bones.forEach((b) => all.add(strip(b.name)));
    const idx = mesh.geometry.getAttribute('skinIndex');
    const w = mesh.geometry.getAttribute('skinWeight');
    for (let v = 0; v < idx.count; v++) {
      for (let k = 0; k < 4; k++) {
        if (w.getComponent(v, k) > 0) weighted.add(strip(bones[idx.getComponent(v, k)].name));
      }
    }
  }
  return { all, weighted };
}

describe('a clip row names every bone its clips rotate', () => {
  // The biped library clips live in hero.glb; a row's `bones` may not be empty or short of a track's bone.
  for (const key of MODEL_KEYS) {
    const clips = MONSTER_MOTION[key].clips;
    it.skipIf(clips === undefined || MONSTER_MOTION[key].skeleton !== 'biped')(`${key}`, () => {
      const names = Object.values(clips as Record<string, string>);
      const found = hero.animations.filter((a) => names.includes(a.name));
      expect(found.length, `${key}: its clips ${names.join(', ')} are in the hero library`).toBeGreaterThan(0);
      const tracked = new Set(found.flatMap((a) => a.tracks.map((t) => t.name.split('.')[0])));
      expect(tracked.size, `${key}: the clips have tracks`).toBeGreaterThan(0);
      for (const bone of tracked) {
        expect(MONSTER_MOTION[key].bones, `${key}: bones names ${bone}`).toContain(bone);
      }
    });
  }
});

describe('every bone a row names exists on that model\'s skeleton and has weight', () => {
  for (const key of MODEL_KEYS) {
    const meshes = skinnedMeshesOf(monsters, key);
    // Skipped by name for a model that is still rigid in the shipped file.
    it.skipIf(meshes.length === 0)(`${key}`, () => {
      const { all, weighted } = weightedBones(meshes, key);
      for (const bone of MONSTER_MOTION[key].bones) {
        expect(all.has(bone), `${key}: ${bone} is a bone of its skeleton`).toBe(true);
        expect(weighted.has(bone), `${key}: ${bone} has weight on a vertex`).toBe(true);
      }
    });
  }
});

// --- rows still posed in code: today's numbers (monsterMeshes.ts poseMonsterLimbs, commit 661d4eb) -------------------

const WINGED = new Set(['elvarg_dragon', 'lesser_demon']);

function codeRig(model: string): { m: Animated; piv: Record<string, THREE.Object3D> } {
  const group = new THREE.Group();
  const hitbox = new THREE.Mesh();
  group.add(hitbox);
  const piv: Record<string, THREE.Object3D> = {};
  for (const n of ['headGroup', 'leftArmPivot', 'rightArmPivot', 'leftLegPivot', 'rightLegPivot']) piv[n] = new THREE.Object3D();
  if (WINGED.has(model)) {
    piv.lWing = new THREE.Object3D();
    piv.rWing = new THREE.Object3D();
  }
  const m = {
    typeKey: model,
    def: {},
    rig: { group, hitbox, ...piv },
    logic: { state: 'idle', windup: null },
    pos: new THREE.Vector3(0, 0, 0),
    flinch: 0,
    attackAnim: 0
  } as unknown as Animated;
  return { m, piv };
}

interface Expect {
  y: number;
  gx?: number;
  head?: number;
  r?: number;
  l?: number;
  lw?: number;
  rw?: number;
}

function expectedAttack(model: string, p: number): Expect {
  if (model === 'elvarg_dragon') return { head: -0.35 + p * 0.65, lw: 0.2 + p * 0.55, rw: -0.2 - p * 0.55, y: GROUND + p * 0.32 };
  if (model === 'dark_wizard') return { r: -1.65 * p, l: -1.45 * p, head: -0.25 * p, y: GROUND + p * 0.12 };
  if (model === 'moss_guardian' || model === 'hill_giant') return { r: -1.8 * p, l: -1.8 * p, y: GROUND + p * 0.22 };
  if (model === 'goblin') return { r: -1.55 * p, l: p * 0.4, y: GROUND + p * 0.25 };
  return { r: -1.45 * p, l: 1.45 * p * 0.4, y: GROUND + p * 0.1 };
}

function check(model: string, m: Animated, piv: Record<string, THREE.Object3D>, want: Expect): void {
  const near = (got: number, exp: number | undefined, what: string): void => {
    if (exp !== undefined) expect(got, `${model} ${what}`).toBeCloseTo(exp, 6);
  };
  near(m.rig.group.position.y, want.y, 'group y');
  near(m.rig.group.rotation.x, want.gx ?? 0, 'group lean');
  near(piv.headGroup.rotation.x, want.head, 'head x');
  near(piv.rightArmPivot.rotation.x, want.r, 'right arm x');
  near(piv.leftArmPivot.rotation.x, want.l, 'left arm x');
  if (piv.lWing) near(piv.lWing.rotation.z, want.lw, 'left wing z');
  if (piv.rWing) near(piv.rWing.rotation.z, want.rw, 'right wing z');
}

describe('a row without clips reproduces the old branch at progress 0, 0.5 and 1', () => {
  for (const model of MODEL_KEYS) {
    // A row that has moved to clips (the goblin from M1b, later rows with their rebuilds) leaves this case.
    const hasClips = MONSTER_MOTION[model].clips !== undefined;
    describe.skipIf(hasClips)(model, () => {
      it('wind-up', () => {
        for (const p of [0, 0.5, 1]) {
          const { m, piv } = codeRig(model);
          m.logic.state = 'attack';
          (m.logic as { windup: unknown }).windup = { left: 2 * (1 - p), total: 2 };
          poseMonsterLimbs(m, false, 0, 0.016);
          check(model, m, piv, {
            r: -1.8 * p,
            l: -1.8 * p,
            head: -0.35 * p,
            lw: 0.2 + p * 0.55,
            rw: -0.2 - p * 0.55,
            y: GROUND + p * 0.15
          });
        }
      });

      it('attack', () => {
        // progress = sin(attackAnim * pi): attackAnim 1 gives 0, 1/6 gives 0.5, 1/2 gives 1; dt 0 keeps attackAnim.
        for (const [anim, p] of [[1, 0], [1 / 6, 0.5], [0.5, 1]] as const) {
          const { m, piv } = codeRig(model);
          m.logic.state = 'attack';
          m.attackAnim = anim;
          poseMonsterLimbs(m, false, 0, 0);
          check(model, m, piv, expectedAttack(model, Math.sin(anim * Math.PI)));
          expect(Math.sin(anim * Math.PI)).toBeCloseTo(p, 6);
        }
      });

      it('flinch', () => {
        // dt 0 keeps the flinch value: curve = sin(flinch * pi), 0 at 1, 0.7071 at 1/4, 1 at 1/2.
        for (const f of [1, 0.25, 0.5]) {
          const { m, piv } = codeRig(model);
          m.flinch = f;
          poseMonsterLimbs(m, false, 0, 0);
          const c = Math.sin(f * Math.PI);
          check(model, m, piv, { y: GROUND + c * 0.16, gx: c * 0.24, head: -c * 0.36, r: c * 0.45, l: c * 0.35 });
        }
      });

      it('walk', () => {
        for (const state of ['chase', 'idle'] as const) {
          const { m, piv } = codeRig(model);
          m.logic.state = state;
          const combat = state === 'chase';
          const now = 1234;
          poseMonsterLimbs(m, true, now, 0.016);
          const s = Math.sin(now * (combat ? 0.01 : 0.007)) * (combat ? 0.52 : 0.38);
          expect(piv.leftLegPivot.rotation.x).toBeCloseTo(s, 6);
          expect(piv.rightLegPivot.rotation.x).toBeCloseTo(-s, 6);
          expect(piv.leftArmPivot.rotation.x).toBeCloseTo(-s * 0.75, 6);
          expect(piv.rightArmPivot.rotation.x).toBeCloseTo(s * 0.75, 6);
          expect(m.rig.group.position.y).toBeCloseTo(GROUND + Math.abs(Math.sin(now * 0.014)) * 0.06, 6);
        }
      });

      it('idle', () => {
        const { m, piv } = codeRig(model);
        piv.leftLegPivot.rotation.x = 0.4;
        piv.rightLegPivot.rotation.x = -0.4;
        const now = 777;
        poseMonsterLimbs(m, false, now, 0.05);
        const breath = Math.sin(now * 0.003) * 0.07;
        expect(m.rig.group.position.y).toBeCloseTo(GROUND + Math.abs(breath) * 0.04, 6);
        expect(piv.headGroup.rotation.y).toBeCloseTo(Math.sin(now * 0.0016) * 0.14, 6);
        expect(piv.leftArmPivot.rotation.x).toBeCloseTo(breath, 6);
        expect(piv.rightArmPivot.rotation.x).toBeCloseTo(-breath * 0.45, 6);
        expect(piv.leftLegPivot.rotation.x).toBeCloseTo(0.4 * Math.pow(0.86, 0.05 * 60), 6);
        expect(piv.rightLegPivot.rotation.x).toBeCloseTo(-0.4 * Math.pow(0.86, 0.05 * 60), 6);
      });
    });
  }
});

// --- the goblin raider on the hero file's clips ---------------------------------------------------------------------

const ANTICIPATION = heroManifest.skin.attackClips.Slash;
const SLASH = 'Slash' as HeroClipName;
const DEATH = 'Death' as HeroClipName;

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
  expect(m.animator, 'the goblin\'s row has clips, so the upgrade gives it an animator').toBeDefined();
  return m;
}

const frame = (m: Animated, moving: boolean, dt = 1 / 30): void => poseMonsterLimbs(m, moving, 0, dt);
const bone = (m: Animated, name: string): THREE.Object3D => m.rig.group.getObjectByName(name)!;
const windup = (m: Animated, progress: number, total = 1): void => {
  m.logic.state = 'attack';
  (m.logic as { windup: unknown }).windup = progress < 0 ? null : { left: total * (1 - progress), total };
};

/** The hero's clip sampled at a time, as a quaternion, for a track name. */
function clipQuat(clipName: string, track: string, t: number): THREE.Quaternion {
  const clip = hero.animations.find((a) => a.name === clipName)!;
  const tr = clip.tracks.find((x) => x.name === track)!;
  const out = tr.createInterpolant().evaluate(t);
  return new THREE.Quaternion(out[0], out[1], out[2], out[3]);
}

describe('the goblin plays the hero file\'s Walk and Slash', () => {
  it('a leg bone turns, and every bone keeps its own rest translation', () => {
    const m = makeGoblin();
    const bones: THREE.Bone[] = [];
    m.rig.group.traverse((o) => {
      if ((o as THREE.Bone).isBone) bones.push(o as THREE.Bone);
    });
    expect(bones.length).toBeGreaterThanOrEqual(16);
    const rest = new Map(bones.map((b) => [b, b.position.clone()]));
    const restLen = (n: string): number => bone(m, n).position.length();
    const forearmLen = restLen('RightElbowPivot');

    for (let i = 0; i < 15; i++) frame(m, true);
    const turn = Math.max(
      bone(m, 'LeftLegPivot').quaternion.angleTo(new THREE.Quaternion()),
      bone(m, 'RightLegPivot').quaternion.angleTo(new THREE.Quaternion())
    );
    expect(turn).toBeGreaterThan(0.01);

    windup(m, 0.5);
    for (let i = 0; i < 6; i++) frame(m, false);
    windup(m, -1);
    m.attackAnim = 1;
    for (let i = 0; i < 40; i++) frame(m, false);

    for (const b of bones) {
      if (b.name === 'Hips') continue; // the one position track, tested below
      expect(b.position.distanceTo(rest.get(b)!), `${b.name} keeps its rest translation`).toBeLessThan(1e-6);
    }
    expect(restLen('RightElbowPivot')).toBeCloseTo(forearmLen, 6);
  });

  it('the Hips position track is scaled by the model\'s hip height over the hero\'s, and the hero\'s clips are untouched', () => {
    const heroWalkBefore = hero.animations.find((a) => a.name === 'Walk')!.tracks.find((t) => t.name === 'Hips.position')!;
    const before = Array.from(heroWalkBefore.values);
    const m = makeGoblin();
    const ratio = bone(m, 'Hips').position.y / hero.scene.getObjectByName('Hips')!.position.y;
    expect(Math.abs(ratio - 1), 'the goblin\'s hips are not at the hero\'s height, so the scale means something').toBeGreaterThan(0.05);

    const walk = m.animator!.actions.get('Walk' as HeroClipName)!.getClip();
    const goblinTrack = walk.tracks.find((t) => t.name === 'Hips.position')!;
    expect(goblinTrack, 'the goblin\'s Walk keeps a Hips position track').toBeDefined();
    for (let i = 1; i < before.length; i += 3) {
      expect(goblinTrack.values[i]).toBeCloseTo(before[i] * ratio, 4);
    }
    expect(Array.from(heroWalkBefore.values)).toEqual(before);
    expect(walk).not.toBe(hero.animations.find((a) => a.name === 'Walk'));
  });
});

describe('the attack clip is the wind-up', () => {
  it('while winding up its time is progress times the anticipation time, and it does not advance on its own', () => {
    const m = makeGoblin();
    const slash = m.animator!.actions.get(SLASH)!;
    windup(m, 0);
    for (let i = 0; i < 10; i++) frame(m, false);
    for (const p of [0.5, 1]) {
      windup(m, p);
      frame(m, false);
      expect(slash.time).toBeCloseTo(p * ANTICIPATION, 3);
      const t = slash.time;
      for (let i = 0; i < 6; i++) frame(m, false, 0.1);
      expect(slash.time, `held at progress ${p}`).toBeCloseTo(t, 6);
      // The bone shows the clip's own pose at that time: the telegraph and the strike are one motion.
      const want = clipQuat('Slash', 'RightArmPivot.quaternion', slash.time);
      expect(bone(m, 'RightArmPivot').quaternion.angleTo(want)).toBeLessThan(0.02);
    }
    const start = clipQuat('Slash', 'RightArmPivot.quaternion', 0);
    const wound = clipQuat('Slash', 'RightArmPivot.quaternion', ANTICIPATION);
    expect(start.angleTo(wound), 'the anticipation key is a real wind-back').toBeGreaterThan(0.05);
  });

  it('on release it plays on from the anticipation key to the end', () => {
    const m = makeGoblin();
    const slash = m.animator!.actions.get(SLASH)!;
    let finished = 0;
    m.animator!.mixer.addEventListener('finished', (e) => {
      if ((e as unknown as { action: THREE.AnimationAction }).action === slash) finished++;
    });
    windup(m, 0);
    for (let i = 0; i < 10; i++) frame(m, false);
    windup(m, 0.95);
    for (let i = 0; i < 4; i++) frame(m, false);
    expect(finished).toBe(0);
    const held = slash.time;

    windup(m, -1);
    m.attackAnim = 1; // what performMonsterRetaliation sets when the windup resolves
    frame(m, false, 1 / 60);
    expect(slash.time, 'no restart from zero').toBeGreaterThanOrEqual(held - 0.01);
    for (let i = 0; i < 6; i++) frame(m, false, 1 / 60);
    expect(slash.time).toBeGreaterThan(held + 0.02);
    expect(finished).toBe(0);
    for (let i = 0; i < 120; i++) frame(m, false, 1 / 60);
    expect(finished, 'the clip reached its end once').toBe(1);
  });
});

describe('Stage 4\'s reactions after the animator', () => {
  const warm = (m: Animated): void => {
    for (let i = 0; i < 10; i++) frame(m, false);
  };

  it('flinch lean, lift and bone offsets are present and the animator keeps playing', () => {
    const a = makeGoblin();
    const b = makeGoblin();
    warm(a);
    warm(b);
    a.flinch = 0.5;
    frame(a, false);
    frame(b, false);
    const c = Math.sin((0.5 - (1 / 30) * 3.8) * Math.PI);
    expect(a.flinch).toBeCloseTo(0.5 - (1 / 30) * 3.8, 9);
    expect(a.rig.group.rotation.x).toBeCloseTo(c * 0.24, 6);
    expect(b.rig.group.rotation.x).toBeCloseTo(0, 9);
    expect(a.rig.group.position.y - b.rig.group.position.y).toBeCloseTo(c * 0.16, 6);
    const off = (n: string): number => bone(a, n).quaternion.angleTo(bone(b, n).quaternion);
    expect(off('HeadGroup')).toBeCloseTo(c * 0.36, 3);
    expect(off('RightArmPivot')).toBeCloseTo(c * 0.45, 3);
    expect(off('LeftArmPivot')).toBeCloseTo(c * 0.35, 3);
    expect(a.animator!.mixer.time, 'the clip did not stop for the flinch').toBeCloseTo(b.animator!.mixer.time, 9);
  });

  it('knock-back offsets survive the animator\'s update', () => {
    const a = makeGoblin();
    const b = makeGoblin();
    warm(a);
    warm(b);
    knockBack(a, 1, 0, KNOCK_BACK.monsterHit.amount);
    updateReactions(0.05);
    frame(a, false);
    frame(b, false);
    const want = springOffset(50, KNOCK_BACK.monsterHit.amount, KNOCK_BACK.monsterHit.ms);
    expect(want).toBeGreaterThan(0.05);
    const kids = a.rig.group.children.filter((ch) => ch !== a.rig.hitbox);
    const twins = b.rig.group.children.filter((ch) => ch !== b.rig.hitbox);
    expect(kids.length).toBeGreaterThan(0);
    kids.forEach((k, i) => {
      expect(k.position.x - twins[i].position.x, `${k.name} x`).toBeCloseTo(want, 6);
      expect(k.position.z - twins[i].position.z, `${k.name} z`).toBeCloseTo(0, 6);
    });
    updateReactions(1);
  });
});

describe('hit stop', () => {
  it('the animator does not advance during the frozen time, and resumes after it', () => {
    const m = makeGoblin();
    for (let i = 0; i < 10; i++) frame(m, true);
    hitStop(m, 70);
    const t = m.animator!.mixer.time;
    const before = bone(m, 'LeftLegPivot').quaternion.clone();
    for (let i = 0; i < 3; i++) frame(m, true, 1 / 60);
    expect(m.animator!.mixer.time).toBe(t);
    expect(bone(m, 'LeftLegPivot').quaternion.angleTo(before)).toBeLessThan(1e-9);
    updateReactions(0.1);
    frame(m, true, 1 / 60);
    expect(m.animator!.mixer.time).toBeGreaterThan(t);
  });
});

describe('Death', () => {
  it('a row that names Death finishes it within DYING_SECS and is not also toppled by poseMonsterDying', () => {
    const m = makeGoblin();
    const death = m.animator!.actions.get(DEATH)!;
    const dt = 1 / 60;
    m.logic.state = 'dying';
    let left = DYING_SECS;
    poseMonsterDying(m, left, dt);
    while (left > dt) {
      left -= dt;
      poseMonsterDying(m, left, dt);
      expect(m.rig.group.rotation.x, 'no group topple').toBe(0);
    }
    poseMonsterDying(m, left, dt);
    expect(m.rig.group.rotation.x).toBe(0);
    expect(death.getClip().duration).toBeGreaterThan(DYING_SECS);
    expect(death.time, 'the clip is at its last pose when the rules timer ends').toBeGreaterThanOrEqual(death.getClip().duration - 0.05);
  });
});

// --- the dragon on its own library (plan D2b; declared: replaces the dragon's row of the old-branch case) ---------

const dragonManifestPath = ['pending/monsters.json', 'monsters.json']
  .map((f) => path.resolve(__dirname, 'fixtures/model-contract', f))
  .find((f) => fs.existsSync(f))!;
const dragonManifest = JSON.parse(fs.readFileSync(dragonManifestPath, 'utf8')) as {
  skin: { attackClips?: Record<string, number> };
};
const DRAGON_CLIPS = ['Idle', 'Walk', 'Bite', 'WingBuffet', 'Death'];
// The shipped file keeps the old rigid dragon until its promotion; these cases run against the built file.
const dragonBuilt = monsters.animations.some((a) => a.name === 'Bite');

function dragonEntity(): Animated {
  const group = new THREE.Group();
  const hitbox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  group.add(hitbox);
  return {
    typeKey: 'elvarg_dragon',
    modelKey: 'elvarg_dragon',
    def: MONSTER_TYPES.elvarg_dragon,
    rig: { group, hitbox },
    logic: { state: 'idle', windup: null },
    pos: group.position,
    flinch: 0,
    attackAnim: 0
  } as unknown as Animated;
}

describe('the dragon plays its own library', () => {
  it('its staged clips are Idle, Walk, Bite, WingBuffet (the wind-up) and Death, keyed only by the roles the engine reads, and its anticipation is the library\'s', () => {
    const staged = PENDING_DRAGON_CLIPS;
    expect(MONSTER_MOTION.elvarg_dragon.skeleton).toBe('dragon');
    // Declared (plan D2b amendments): gains windup: 'WingBuffet'.
    expect(staged.clips).toEqual({ idle: 'Idle', walk: 'Walk', attack: 'Bite', windup: 'WingBuffet', death: 'Death' });
    expect(dragonManifest.skin.attackClips?.Bite).toBeCloseTo(staged.anticipation, 5);
    expect(dragonManifest.skin.attackClips?.WingBuffet).toBeCloseTo(staged.anticipation, 5);
    // Once D5 names them on the live row, they are the staged ones.
    if (MONSTER_MOTION.elvarg_dragon.clips) expect(MONSTER_MOTION.elvarg_dragon).toMatchObject(staged);
  });

  it('a row plays from monsters.glb only clips that the monsters.glb in the tree carries', () => {
    for (const key of MODEL_KEYS) {
      const row = MONSTER_MOTION[key];
      if (!row.clips || row.skeleton === 'biped') continue;
      for (const name of Object.values(row.clips)) {
        expect(monsters.animations.some((a) => a.name === name), `${key}: ${name} is in monsters.glb`).toBe(true);
      }
    }
  });

  it.skipIf(!dragonBuilt)('its clips rotate only the bones the row names, and move only Hips', () => {
    const row = { ...MONSTER_MOTION.elvarg_dragon, ...PENDING_DRAGON_CLIPS };
    for (const name of DRAGON_CLIPS) {
      const clip = monsters.animations.find((a) => a.name === name);
      expect(clip, `${name} is in monsters.glb`).toBeDefined();
      for (const track of clip!.tracks) {
        const [node, prop] = track.name.split('.');
        expect(node.startsWith('elvarg_dragon_'), `${name}: ${track.name} is on a dragon bone`).toBe(true);
        const bone = node.slice('elvarg_dragon_'.length);
        if (prop === 'position') expect(bone, `${name}: the one position track`).toBe('Hips');
        else expect(prop, `${name}: ${track.name}`).toBe('quaternion');
        expect(row.bones).toContain(bone);
      }
    }
  });

  it('on the monsters.glb in the tree, the dragon winds up, strikes and dies without a missing clip', () => {
    const m = dragonEntity();
    expect(upgradeMonsterRigWithGltf(m, monsters, hero)).toBe(true);
    frame(m, true);
    windup(m, 0.5);
    expect(() => frame(m, false), 'a wind-up frame').not.toThrow();
    windup(m, -1);
    m.attackAnim = 1;
    expect(() => frame(m, false), 'the strike').not.toThrow();
    m.logic.state = 'dying';
    expect(() => poseMonsterDying(m, DYING_SECS, 1 / 60), 'a dying frame').not.toThrow();
    expect(() => poseMonsterDying(m, 1 / 120, 1 / 60), 'the last dying frame').not.toThrow();
  });

  it.skipIf(!dragonBuilt)('the wind-up holds WingBuffet at progress times the anticipation and strikes on it, a plain attack plays Bite, and Death ends lying within DYING_SECS', () => {
    // The staged row, as D5 will name it, for this case only.
    const live = MONSTER_MOTION.elvarg_dragon;
    MONSTER_MOTION.elvarg_dragon = { ...live, ...PENDING_DRAGON_CLIPS };
    try {
      dragonPlaysItsLibrary();
    } finally {
      MONSTER_MOTION.elvarg_dragon = live;
    }
  });
});

function dragonPlaysItsLibrary(): void {
  const m = dragonEntity();
  expect(upgradeMonsterRigWithGltf(m, monsters, hero)).toBe(true);
  expect(m.animator).toBeDefined();
  for (let i = 0; i < 10; i++) frame(m, true);
  expect(bone(m, 'LeftArmPivot').quaternion.angleTo(new THREE.Quaternion()), 'a fore leg swings in Walk').toBeGreaterThan(0.01);

  const bite = m.animator!.actions.get('Bite' as HeroClipName)!;
  const buffet = m.animator!.actions.get('WingBuffet' as HeroClipName)!;
  windup(m, 0);
  frame(m, false);
  windup(m, 1);
  frame(m, false);
  expect(buffet.time, 'the held wind-up clip is WingBuffet').toBeCloseTo(MONSTER_MOTION.elvarg_dragon.anticipation!, 3);
  expect(buffet.paused).toBe(true);
  expect(bite.isRunning(), 'Bite is not held').toBe(false);
  windup(m, -1);
  m.attackAnim = 1;
  for (let i = 0; i < 6; i++) frame(m, false, 1 / 60);
  expect(buffet.time, 'the strike plays WingBuffet on').toBeGreaterThan(MONSTER_MOTION.elvarg_dragon.anticipation! + 0.02);
  expect(bite.isRunning(), 'no Bite on top of the released wind-up').toBe(false);

  // A plain attack (no wind-up) plays the row's attack clip.
  for (let i = 0; i < 90; i++) frame(m, false, 1 / 60);
  expect(buffet.isRunning(), 'WingBuffet has ended').toBe(false);
  m.attackAnim = 1;
  frame(m, false, 1 / 60);
  expect(bite.isRunning(), 'a plain attack plays Bite').toBe(true);
  expect(buffet.isRunning()).toBe(false);

  // A cancelled wind-up (no strike) fades the held WingBuffet and never starts Bite.
  for (let i = 0; i < 60; i++) frame(m, false, 1 / 60);
  windup(m, 0.5);
  frame(m, false, 1 / 60);
  expect(buffet.paused, 'WingBuffet held again').toBe(true);
  windup(m, -1);
  for (let i = 0; i < 20; i++) frame(m, false, 1 / 60);
  expect(buffet.isRunning(), 'the cancelled WingBuffet has faded').toBe(false);
  expect(bite.isRunning(), 'a cancel never strikes').toBe(false);

  const death = m.animator!.actions.get(DEATH)!;
  const hipsRest = bone(m, 'Hips').position.y;
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
  expect(bone(m, 'Hips').position.y, 'the body lies lower than it stood').toBeLessThan(hipsRest - 0.03);
}
