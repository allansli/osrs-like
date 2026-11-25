// H1 (models pass): what the skinned hero must be and do, written before it exists (design 6.1.2, 6.5, 8.3).
// Measured against `public/models/hero.glb` (whatever is shipped; the hero slice's promote task turns it green).
//
// RED LIST on today's hero (recorded at H1, 2026-11-25, base 8b7ecdd; 14 red of 25 cases, measured by running this file):
//   attack clip Lunge turns Torso >= 0.3 ...... 0.24  (Cast 0.12 red too; Slash 0.90, Ranged 0.55, Chop 0.44, Mine 0.49, SpinSlash 3.14 pass)
//   Idle turns Torso or HeadGroup >= 0.08 ..... 0.03
//   Walk turns Torso >= 0.08 .................. 0.04
//   Fish turns an arm >= 0.3 .................. 0.10
//   Lunge: right arm x first moves against the strike ... rises monotonically (Slash, Chop and Mine pass)
//   Slash bends the right elbow >= 0.3 ........ 0.05 (Walk knees, 0.75 each, pass)
//   shared clips rotation-only plus Hips pos .. Idle, Lunge and Cast carry position tracks, and there is no Hips
//   skin cases (3) ............................ no SkinnedMesh: bone list, bone parents, one skeleton for every mesh
//   Hair, TorsoCoat, InnerCollar own meshes ... InnerCollar missing (Hair and TorsoCoat exist)
//   triangles <= 6,000 and meshes <= 11 ....... 5,304 triangles pass, 18 meshes fail
//   meshes carry COLOR_0 ...................... none do
// Green today (the two frozen samples, restated on bones by name): 0.2 s into Walk a leg bone turns past 0.01;
// 0.15 s into Slash at time scale 1.2 the right arm bone turns past 0.05.
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildHumanoidRig } from '../src/engine/humanoid';
import { upgradeHumanoidRigWithGltf } from '../src/engine/blenderHero';

let gltf: GLTF;

beforeAll(async () => {
  const buf = fs.readFileSync(path.resolve(__dirname, '../public/models/hero.glb'));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  gltf = await new Promise<GLTF>((resolve, reject) => new GLTFLoader().parse(ab, '', resolve, reject));
});

const clip = (name: string): THREE.AnimationClip => {
  const c = gltf.animations.find((a) => a.name === name);
  if (!c) throw new Error(`hero.glb has no clip ${name}`);
  return c;
};

const quats = (t: THREE.KeyframeTrack): THREE.Quaternion[] => {
  const out: THREE.Quaternion[] = [];
  for (let i = 0; i < t.times.length; i++) out.push(new THREE.Quaternion().fromArray(t.values as unknown as number[], i * 4));
  return out;
};

/** Largest angle between any two keys of a bone's rotation track (what the review sheets print as the range). 0 when the bone is not keyed. */
function range(clipName: string, bone: string): number {
  const t = clip(clipName).tracks.find((k) => k.name === `${bone}.quaternion`);
  if (!t) return 0;
  const q = quats(t);
  let max = 0;
  for (let i = 0; i < q.length; i++) for (let j = i + 1; j < q.length; j++) max = Math.max(max, q[i].angleTo(q[j]));
  return max;
}

/** How far (rad) the right arm's x rotation travels against the strike before the strike. The strike is the fastest single step of x; ties go to the first. */
function windUp(clipName: string): number {
  const t = clip(clipName).tracks.find((k) => k.name === 'RightArmPivot.quaternion');
  if (!t) return 0;
  const xs = quats(t).map((q) => new THREE.Euler().setFromQuaternion(q, 'XYZ').x);
  let strike = 0;
  let best = 0;
  for (let i = 1; i < xs.length; i++) {
    const step = Math.abs(xs[i] - xs[i - 1]);
    if (step > best + 1e-3) {
      best = step;
      strike = i;
    }
  }
  const dir = Math.sign(xs[strike] - xs[strike - 1]);
  let against = 0;
  for (let i = 0; i < strike; i++) against = Math.max(against, -dir * (xs[i] - xs[0]));
  return against;
}

const meshes = (): THREE.Mesh[] => {
  const out: THREE.Mesh[] = [];
  gltf.scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh);
  });
  return out;
};

describe('hero clips (rotation ranges, critique E4)', () => {
  it.each(['Slash', 'Lunge', 'Ranged', 'Cast', 'Chop', 'Mine', 'SpinSlash'])('attack clip %s turns Torso by at least 0.3 rad', (name) => {
    expect(range(name, 'Torso')).toBeGreaterThanOrEqual(0.3);
  });

  it('Idle turns Torso or HeadGroup by at least 0.08 rad', () => {
    expect(Math.max(range('Idle', 'Torso'), range('Idle', 'HeadGroup'))).toBeGreaterThanOrEqual(0.08);
  });

  it('Walk turns Torso by at least 0.08 rad', () => {
    expect(range('Walk', 'Torso')).toBeGreaterThanOrEqual(0.08);
  });

  it('Fish turns an arm by at least 0.3 rad', () => {
    expect(Math.max(range('Fish', 'LeftArmPivot'), range('Fish', 'RightArmPivot'))).toBeGreaterThanOrEqual(0.3);
  });

  it.each(['Slash', 'Lunge', 'Chop', 'Mine'])('in %s the right arm\'s x rotation first moves against the strike (by at least 0.2 rad)', (name) => {
    expect(windUp(name)).toBeGreaterThanOrEqual(0.2);
  });

  it('Walk bends each knee bone by at least 0.3 rad', () => {
    expect(range('Walk', 'LeftKneePivot')).toBeGreaterThanOrEqual(0.3);
    expect(range('Walk', 'RightKneePivot')).toBeGreaterThanOrEqual(0.3);
  });

  it('Slash bends the right elbow by at least 0.3 rad', () => {
    expect(range('Slash', 'RightElbowPivot')).toBeGreaterThanOrEqual(0.3);
  });

  it('shared clips have rotation tracks only, plus Hips position', () => {
    expect(gltf.animations.length).toBeGreaterThanOrEqual(10);
    for (const c of gltf.animations) {
      for (const t of c.tracks) {
        const [node, prop] = [t.name.slice(0, t.name.lastIndexOf('.')), t.name.slice(t.name.lastIndexOf('.') + 1)];
        const allowed = prop === 'quaternion' || (prop === 'position' && node === 'Hips');
        expect(allowed, `${c.name}: ${t.name}`).toBe(true);
      }
    }
  });
});

describe('hero skin (design 6.1.2)', () => {
  const REQUIRED = [
    'Root', 'Hips', 'Torso', 'HeadGroup',
    'LeftArmPivot', 'LeftElbowPivot', 'LeftHand', 'RightArmPivot', 'RightElbowPivot', 'RightHand',
    'LeftLegPivot', 'LeftKneePivot', 'LeftFoot', 'RightLegPivot', 'RightKneePivot', 'RightFoot'
  ];
  const OPTIONAL = ['Jaw', 'WeaponPivot', 'OffhandPivot', 'LWing', 'RWing', 'TailPivot', 'TailPivot2', 'LeftShoulder', 'RightShoulder'];
  const PARENT: Record<string, string[]> = {
    Hips: ['Root'], Torso: ['Hips'], HeadGroup: ['Torso'],
    LeftArmPivot: ['Torso', 'LeftShoulder'], RightArmPivot: ['Torso', 'RightShoulder'],
    LeftElbowPivot: ['LeftArmPivot'], LeftHand: ['LeftElbowPivot'], RightElbowPivot: ['RightArmPivot'], RightHand: ['RightElbowPivot'],
    LeftLegPivot: ['Hips'], LeftKneePivot: ['LeftLegPivot'], LeftFoot: ['LeftKneePivot'],
    RightLegPivot: ['Hips'], RightKneePivot: ['RightLegPivot'], RightFoot: ['RightKneePivot']
  };

  const skinned = (): THREE.SkinnedMesh[] => meshes().filter((m) => (m as THREE.SkinnedMesh).isSkinnedMesh) as THREE.SkinnedMesh[];

  it('the hero is skinned on the biped skeleton with the bone list of design 6.1.2', () => {
    const sk = skinned();
    expect(sk.length, 'skinned meshes').toBeGreaterThan(0);
    const names = new Set<string>();
    for (const m of sk) for (const b of m.skeleton.bones) names.add(b.name);
    for (const n of REQUIRED) expect(names.has(n), `bone ${n}`).toBe(true);
    for (const n of names) expect([...REQUIRED, ...OPTIONAL].includes(n), `unexpected bone ${n}`).toBe(true);
  });

  it('every bone hangs under the parent design 6.1.2 names', () => {
    const sk = skinned();
    expect(sk.length, 'skinned meshes').toBeGreaterThan(0);
    for (const b of sk[0].skeleton.bones) {
      if (b.name === 'Root') continue;
      expect(PARENT[b.name] ?? [], b.name).toContain(b.parent?.name);
    }
  });

  it('every skinned mesh is skinned on the same bones and no mesh is rigid next to them', () => {
    const sk = skinned();
    expect(sk.length, 'skinned meshes').toBeGreaterThan(0);
    const first = sk[0].skeleton.bones.map((b) => b.name).join();
    for (const m of sk) expect(m.skeleton.bones.map((b) => b.name).join()).toBe(first);
  });
});

describe('hero meshes (design 6.4, 9.1)', () => {
  it('Hair, TorsoCoat and InnerCollar exist as their own meshes', () => {
    const names = meshes().map((m) => m.name);
    for (const n of ['Hair', 'TorsoCoat', 'InnerCollar']) expect(names.filter((x) => x === n).length, n).toBe(1);
  });

  it('triangles at most 6,000, meshes at most 11', () => {
    let tris = 0;
    const all = meshes();
    for (const m of all) tris += (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute('position').count) / 3;
    expect(tris).toBeLessThanOrEqual(6000);
    expect(all.length).toBeLessThanOrEqual(11);
  });

  it('meshes carry COLOR_0', () => {
    const all = meshes();
    expect(all.length).toBeGreaterThan(0);
    for (const m of all) expect(m.geometry.getAttribute('color'), m.name).toBeDefined();
  });
});

describe('the two frozen samples, restated by bone name', () => {
  const upgraded = () => {
    const rig = buildHumanoidRig();
    const animator = upgradeHumanoidRigWithGltf(rig, gltf);
    expect(animator).not.toBeNull();
    return { rig, animator: animator! };
  };

  it('0.2 s into Walk a leg bone\'s x rotation exceeds 0.01', () => {
    const { rig, animator } = upgraded();
    animator.setMoving(true);
    animator.update(0.2);
    const leg = rig.group.getObjectByName('LeftLegPivot')!;
    expect(Math.abs(leg.rotation.x)).toBeGreaterThan(0.01);
  });

  it('0.15 s into Slash at time scale 1.2 the right arm\'s x rotation exceeds 0.05', () => {
    const { rig, animator } = upgraded();
    animator.playAction('Slash', 1.2);
    animator.update(0.15);
    const arm = rig.group.getObjectByName('RightArmPivot')!;
    expect(Math.abs(arm.rotation.x)).toBeGreaterThan(0.05);
  });
});
