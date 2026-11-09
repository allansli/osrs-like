import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { LEAN_RIG, type HumanoidRig } from './humanoid';
import { addCartoonOutline, facetMaterial } from './materials';
import { albedoMaterial, creatureAlbedoId, sealAlbedoUvs } from './textures';

export type HeroClipName =
  | 'Idle'
  | 'Walk'
  | 'Slash'
  | 'Lunge'
  | 'Ranged'
  | 'Cast'
  | 'Chop'
  | 'Mine'
  | 'Fish'
  | 'SpinSlash';

const REST_POSITIONS: Record<string, [number, number, number]> = {
  Torso: [0, LEAN_RIG.torsoY, 0],
  HeadGroup: [0, LEAN_RIG.headY, 0],
  LeftArmPivot: [-LEAN_RIG.shoulderX, LEAN_RIG.shoulderY, 0],
  RightArmPivot: [LEAN_RIG.shoulderX, LEAN_RIG.shoulderY, 0],
  LeftLegPivot: [-LEAN_RIG.hipX, LEAN_RIG.hipY, 0],
  RightLegPivot: [LEAN_RIG.hipX, LEAN_RIG.hipY, 0]
};

export class BlenderHeroAnimator {
  readonly mixer: THREE.AnimationMixer;
  readonly actions = new Map<HeroClipName, THREE.AnimationAction>();
  private currentLocomotion: HeroClipName = 'Idle';
  private activeOneShot: THREE.AnimationAction | null = null;
  private pivots: Record<string, THREE.Object3D>;
  private isMoving = false;
  private walkSpeedRatio = 1.0;
  private blend = 0.0; // 0.0 = full idle, 1.0 = full walk

  constructor(
    root: THREE.Object3D,
    clips: THREE.AnimationClip[],
    pivots: Record<string, THREE.Object3D>
  ) {
    this.mixer = new THREE.AnimationMixer(root);
    this.pivots = pivots;

    for (const clip of clips) {
      const name = clip.name as HeroClipName;
      const action = this.mixer.clipAction(clip);
      if (name === 'Idle' || name === 'Walk') {
        action.setLoop(THREE.LoopRepeat, Infinity);
      } else {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = false;
      }
      this.actions.set(name, action);
    }

    this.mixer.addEventListener('finished', (e) => {
      if (this.activeOneShot && e.action === this.activeOneShot) {
        this.activeOneShot.fadeOut(0.12);
        this.activeOneShot = null;
      }
    });

    const idle = this.actions.get('Idle');
    if (idle) {
      idle.setEffectiveWeight(1.0);
      idle.play();
    }
    const walk = this.actions.get('Walk');
    if (walk) {
      walk.setEffectiveWeight(0.0);
      walk.play();
    }
  }

  setWalkSpeed(speedRatio: number): void {
    this.walkSpeedRatio = Math.max(0.1, speedRatio);
  }

  setMoving(isMoving: boolean): void {
    this.isMoving = isMoving;
    this.currentLocomotion = isMoving ? 'Walk' : 'Idle';
    const walk = this.actions.get('Walk');
    if (walk && !walk.isRunning()) walk.play();
    const idle = this.actions.get('Idle');
    if (idle && !idle.isRunning()) idle.play();
  }

  playAction(clipName: HeroClipName, timeScale = 1.15): void {
    const action = this.actions.get(clipName);
    if (!action) return;
    if (this.activeOneShot && this.activeOneShot !== action) {
      this.activeOneShot.fadeOut(0.08);
    }
    this.activeOneShot = action;
    action.reset();
    action.setEffectiveTimeScale(timeScale);
    action.setEffectiveWeight(1);
    action.fadeIn(0.08);
    action.play();
  }

  update(dt: number): void {
    const targetBlend = this.isMoving ? 1.0 : 0.0;
    const blendSpeed = this.isMoving ? 14 : 9;
    this.blend += (targetBlend - this.blend) * Math.min(1, dt * blendSpeed);

    const idle = this.actions.get('Idle');
    const walk = this.actions.get('Walk');

    if (idle && walk) {
      const w = this.blend * this.blend * (3 - 2 * this.blend);
      const oneShotWeight = this.activeOneShot ? this.activeOneShot.getEffectiveWeight() : 0.0;
      const baseWeight = Math.max(0, 1.0 - oneShotWeight);

      walk.setEffectiveWeight(w * baseWeight);
      idle.setEffectiveWeight((1.0 - w) * baseWeight);

      const targetTimeScale = 0.85 + this.walkSpeedRatio * 0.90;
      walk.setEffectiveTimeScale(targetTimeScale);
    }

    this.mixer.update(dt);
  }
}

let cachedTemplatePromise: Promise<GLTF | null> | null = null;

export function loadBlenderHeroTemplate(url = '/models/hero.glb'): Promise<GLTF | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }
  if (!cachedTemplatePromise) {
    const loader = new GLTFLoader();
    cachedTemplatePromise = new Promise((resolve) => {
      loader.load(
        url,
        (gltf) => resolve(gltf),
        undefined,
        (err) => {
          console.warn('[BlenderHero] Failed to load hero.glb, keeping procedural fallback:', err);
          resolve(null);
        }
      );
    });
  }
  return cachedTemplatePromise;
}

export interface HeroUpgradeOptions {
  isPlayer?: boolean;
  skinHex?: number;
  tunicHex?: number;
  legsHex?: number;
  bootHex?: number;
}

/**
 * Upgrades an existing HumanoidRig in-place with the sculpted Blender base human (`hero.glb`)
 * meshes and 10 NLA animations. Equipment meshes are composed dynamically via `playerGear.ts`.
 */
export function upgradeHumanoidRigWithGltf(
  rig: HumanoidRig,
  gltf: GLTF,
  tunicHex = 0x38444e,
  hairHex = 0x4a3728,
  legsHex = 0x2a2522,
  opts: HeroUpgradeOptions = {}
): BlenderHeroAnimator | null {
  const clonedScene = gltf.scene.clone(true);
  const heroRoot = clonedScene.getObjectByName('HeroRoot') || clonedScene;

  const torso = heroRoot.getObjectByName('Torso') as THREE.Group | undefined;
  const headGroup = heroRoot.getObjectByName('HeadGroup') as THREE.Group | undefined;
  const leftArmPivot = heroRoot.getObjectByName('LeftArmPivot') as THREE.Group | undefined;
  const rightArmPivot = heroRoot.getObjectByName('RightArmPivot') as THREE.Group | undefined;
  const leftLegPivot = heroRoot.getObjectByName('LeftLegPivot') as THREE.Group | undefined;
  const rightLegPivot = heroRoot.getObjectByName('RightLegPivot') as THREE.Group | undefined;

  if (!torso || !headGroup || !leftArmPivot || !rightArmPivot || !leftLegPivot || !rightLegPivot) {
    console.warn('[BlenderHero] Missing expected pivot groups in hero.glb');
    return null;
  }

  const skinColor = opts.skinHex ?? 0xd9bfa3;
  const skinMat = albedoMaterial(skinColor, creatureAlbedoId('skin'));
  const lipsMat = albedoMaterial(0xa07567, creatureAlbedoId('skin'));
  const tunicMat = albedoMaterial(opts.tunicHex ?? tunicHex, 'gear:cloth');
  const legsMat = albedoMaterial(opts.legsHex ?? legsHex, 'gear:cloth');
  const hairMat = albedoMaterial(hairHex, creatureAlbedoId('hair'));
  const bootMat = albedoMaterial(opts.bootHex ?? 0x2e231b, 'gear:leather');
  const gloveMat = albedoMaterial(skinColor, creatureAlbedoId('skin'));
  const beltLeatherMat = albedoMaterial(0x2d2117, 'gear:leather');
  const goldMat = facetMaterial({ color: 0x8f7d4e, emissive: 0x5e4f2b, emissiveIntensity: 0.12 });
  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xdde3ea });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x141a20 });

  let chestMesh: THREE.Mesh | null = null;
  let beltMesh: THREE.Mesh | null = null;
  let neckMesh: THREE.Mesh | null = null;
  let headMesh: THREE.Mesh | null = null;
  let hairCapMesh: THREE.Mesh | null = null;

  heroRoot.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry = mesh.geometry.clone();
    mesh.castShadow = true;
    mesh.receiveShadow = false;

    const part = (mesh.userData?.part as string) || '';
    const mName = mesh.name || '';

    if (
      mesh.userData?.noOutline ||
      part === 'nose' ||
      part === 'mouth' ||
      part === 'ear' ||
      part === 'eye-white' ||
      part === 'eye' ||
      part === 'pupil' ||
      part === 'brow' ||
      part === 'collar' ||
      part === 'belt-strap' ||
      part === 'belt-buckle' ||
      mName.startsWith('Sideburn_') ||
      mName.startsWith('Thumb_')
    ) {
      mesh.userData.noOutline = true;
    }

    if (part === 'belt-strap') {
      mesh.material = beltLeatherMat;
    } else if (part === 'belt-buckle') {
      mesh.material = goldMat;
    } else if (part === 'chest' || part === 'collar' || part === 'arm' || part === 'deltoid') {
      mesh.material = tunicMat;
    } else if (part === 'belt' || part === 'thigh' || part === 'shin') {
      mesh.material = legsMat;
    } else if (part === 'boot' || part === 'toe') {
      mesh.material = bootMat;
    } else if (part === 'hand') {
      mesh.material = gloveMat;
    } else if (part === 'mouth') {
      mesh.material = lipsMat;
    } else if (part === 'head' || part === 'ear' || part === 'nose' || part === 'neck' || part === 'skin') {
      mesh.material = skinMat;
    } else if (part === 'hair' || part === 'brow') {
      mesh.material = hairMat;
    } else if (part === 'eye-white' || part === 'eye') {
      mesh.material = eyeWhiteMat;
    } else if (part === 'pupil') {
      mesh.material = pupilMat;
    }

    if (part === 'chest' && !chestMesh) chestMesh = mesh;
    if (part === 'belt' && !beltMesh) beltMesh = mesh;
    if (part === 'neck' && !neckMesh) neckMesh = mesh;
    if (part === 'head' && !headMesh) headMesh = mesh;
    if (mName === 'HairCap' || (part === 'hair' && !hairCapMesh)) hairCapMesh = mesh;
  });

  const keepChildren = rig.group.children.filter(
    (ch) => ch === rig.hitbox || ch === (rig as unknown as Record<string, unknown>).spinRing || ch.userData?.isCollider
  );
  rig.group.clear();
  keepChildren.forEach((ch) => rig.group.add(ch));

  const rootChildren = [...heroRoot.children];
  for (const child of rootChildren) {
    rig.group.add(child);
  }

  rig.torso = torso;
  if (chestMesh) rig.chest = chestMesh;
  if (beltMesh) rig.belt = beltMesh;
  if (neckMesh) rig.neck = neckMesh;
  rig.headGroup = headGroup;
  if (headMesh) rig.head = headMesh;
  if (hairCapMesh) rig.hairCap = hairCapMesh;
  rig.leftArmPivot = leftArmPivot;
  rig.rightArmPivot = rightArmPivot;
  rig.leftLegPivot = leftLegPivot;
  rig.rightLegPivot = rightLegPivot;
  rig.tunicMat = tunicMat;
  rig.legsMat = legsMat;
  rig.bootMat = bootMat;
  rig.gloveMat = gloveMat;
  rig.group.userData.isBlenderHero = true;

  addCartoonOutline(rig.group, LEAN_RIG.outline);
  sealAlbedoUvs(rig.group);

  return new BlenderHeroAnimator(rig.group, gltf.animations || [], {
    Torso: torso,
    HeadGroup: headGroup,
    LeftArmPivot: leftArmPivot,
    RightArmPivot: rightArmPivot,
    LeftLegPivot: leftLegPivot,
    RightLegPivot: rightLegPivot
  });
}
