import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MONSTER_MOTION } from '../data/monsterPoses';
import { BlenderHeroAnimator } from './blenderHero';
import { loadGltfOnce } from './gltf';
import { addCartoonOutline, facetMaterial } from './materials';
import { cloneFigure, fixCullSpheres, hasSkin, stripBonePrefix, stripClipPrefix } from './skinned';
import { albedoMaterial, offsetAlbedoPhase, sealAlbedoUvs, speciesAlbedo } from './textures';

export function loadBlenderMonstersTemplate(url = '/models/monsters.glb?v=1bdba310'): Promise<GLTF | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }
  return loadGltfOnce(url);
}

export interface MonsterRigLike {
  group: THREE.Group;
  hitbox: THREE.Mesh;
  headGroup?: THREE.Object3D | null;
  leftArmPivot?: THREE.Object3D | null;
  rightArmPivot?: THREE.Object3D | null;
  leftLegPivot?: THREE.Object3D | null;
  rightLegPivot?: THREE.Object3D | null;
  lWing?: THREE.Object3D | null;
  rWing?: THREE.Object3D | null;
}

export interface MonsterEntityLike {
  typeKey: string;
  modelKey?: string;
  def: {
    bodyColor?: number;
    accentColor?: number;
    weaponColor?: number;
    scale?: number;
    tint?: number;
    modelScale?: number;
    kit?: string;
    body?: string;
  };
  rig: MonsterRigLike;
  pos: THREE.Vector3;
  animator?: BlenderHeroAnimator;
}

function extractColorHex(mat: THREE.Material | undefined, fallback: number): number {
  const std = mat as THREE.MeshStandardMaterial | undefined;
  if (std && std.color && typeof std.color.getHex === 'function') {
    return std.color.getHex();
  }
  return fallback;
}

function extractEmissiveHex(mat: THREE.Material | undefined): number | null {
  const std = mat as THREE.MeshStandardMaterial | undefined;
  if (std && std.emissive && typeof std.emissive.getHex === 'function') {
    const hex = std.emissive.getHex();
    if (hex > 0 && (std.emissiveIntensity ?? 1) > 0.05) {
      return hex;
    }
  }
  return null;
}

function findPivot(root: THREE.Object3D, prefix: string, suffix: string): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  const targetA = `${prefix}_${suffix}`.toLowerCase();
  const targetB = suffix.toLowerCase();
  root.traverse((obj) => {
    if (found) return;
    const n = (obj.name || '').toLowerCase();
    // Strip Blender .001 suffixes if any
    const clean = n.replace(/\.\d+$/, '');
    if (clean === targetA || clean === targetB) {
      found = obj;
    }
  });
  return found;
}

/**
 * Upgrades a monster's Three.js rig in-place with the sculpted Blender model from `monsters.glb`.
 */
export function upgradeMonsterRigWithGltf(
  mObj: MonsterEntityLike,
  gltf: GLTF,
  heroGltf?: GLTF | null
): boolean {
  const modelKey = mObj.modelKey ?? mObj.typeKey;
  const nodeKey = mObj.def.body ?? modelKey;
  const template = gltf.scene.getObjectByName(`Monster_${nodeKey}`);
  if (!template) return false;

  const isSkinned = hasSkin(template);
  if (isSkinned) {
    fixCullSpheres(template);
  }
  const cloned = isSkinned ? cloneFigure(template) : template.clone(true);
  if (!cloned) return false;

  cloned.position.set(0, 0, 0);
  cloned.rotation.set(0, 0, 0);
  cloned.scale.set(1, 1, 1);

  if (isSkinned) {
    stripBonePrefix(cloned, nodeKey);
  }

  if (mObj.def.kit) {
    const kitTemplate = gltf.scene.getObjectByName(`Kit_${mObj.def.kit}`);
    if (!kitTemplate) return false;
    for (const child of kitTemplate.children) {
      const clonedChild = child.clone(true);
      let bone: THREE.Bone | null = null;
      cloned.traverse((obj) => {
        if (!bone && (obj as THREE.Bone).isBone && obj.name === child.name) {
          bone = obj as THREE.Bone;
        }
      });
      if (bone) {
        (bone as THREE.Bone).add(clonedChild);
      } else {
        cloned.add(clonedChild);
      }
    }
  }

  const speciesKey =
    modelKey === 'goblin_archer'
      ? 'goblin'
      : modelKey;
  const bodyAlbedo = speciesAlbedo(speciesKey);
  const defaultBodyColor = mObj.def.bodyColor ?? 0x65a30d;
  const tintColor = mObj.def.tint !== undefined ? new THREE.Color(mObj.def.tint) : null;

  cloned.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry = mesh.geometry.clone();
    mesh.castShadow = true;
    mesh.receiveShadow = false;

    const hasColor = Boolean(mesh.geometry.getAttribute('color'));
    const isSkinned = Boolean((mesh as THREE.SkinnedMesh).isSkinnedMesh);
    const extra: Record<string, unknown> = {
      ...(hasColor ? { vertexColors: true } : {}),
      ...(hasColor && isSkinned ? { shade: 'cut' } : {}),
    };

    const origMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const matName = (origMat?.name || '').toLowerCase();
    const meshName = (mesh.name || '').toLowerCase();
    const colorHex = extractColorHex(origMat, defaultBodyColor);
    const emissiveHex = extractEmissiveHex(origMat);

    if (matName.includes('glow') || meshName.includes('eye') || emissiveHex !== null) {
      const eHex = emissiveHex ?? colorHex;
      if (meshName.includes('eye')) {
        mesh.material = new THREE.MeshBasicMaterial({ color: eHex });
        mesh.userData.noOutline = true;
      } else {
        mesh.material = facetMaterial({
          color: colorHex,
          emissive: eHex,
          emissiveIntensity: 0.75,
          ...extra
        });
      }
    } else {
      if (matName.includes('skin') || matName.includes('scale') || matName.includes('chitin') || matName.includes('feather')) {
        mesh.material = bodyAlbedo ? albedoMaterial(colorHex, bodyAlbedo, extra) : facetMaterial({ color: colorHex, ...extra });
      } else if (matName.includes('cloth') || matName.includes('robe')) {
        mesh.material = albedoMaterial(colorHex, 'cloth', { side: THREE.DoubleSide, ...extra });
      } else if (matName.includes('leather') || matName.includes('fur') || matName.includes('wing') || matName.includes('hoof')) {
        mesh.material = albedoMaterial(colorHex, 'leather', { side: THREE.DoubleSide, ...extra });
      } else if (matName.includes('wood')) {
        mesh.material = albedoMaterial(colorHex, 'wood', extra);
      } else if (matName.includes('bark')) {
        mesh.material = albedoMaterial(colorHex, 'bark', extra);
      } else if (matName.includes('moss') || matName.includes('grass') || matName.includes('leaf')) {
        mesh.material = albedoMaterial(colorHex, 'grass', extra);
      } else if (matName.includes('stone')) {
        mesh.material = albedoMaterial(colorHex, 'stone', extra);
      } else if (matName.includes('iron') || matName.includes('bronze') || matName.includes('steel')) {
        mesh.material = albedoMaterial(colorHex, 'iron', extra);
      } else {
        mesh.material = facetMaterial({ color: colorHex, ...extra });
      }
      if (tintColor) {
        (mesh.material as THREE.MeshLambertMaterial).color.multiply(tintColor);
      }
    }
  });

  const rig = mObj.rig;
  const keepChildren = rig.group.children.filter(
    (ch) => ch === rig.hitbox || ch.userData?.isCollider
  );
  rig.group.clear();
  keepChildren.forEach((ch) => rig.group.add(ch));

  const children = [...cloned.children];
  for (const ch of children) {
    rig.group.add(ch);
  }

  rig.headGroup = findPivot(rig.group, modelKey, 'HeadGroup');
  rig.leftArmPivot = findPivot(rig.group, modelKey, 'LeftArmPivot');
  rig.rightArmPivot = findPivot(rig.group, modelKey, 'RightArmPivot');
  rig.leftLegPivot = findPivot(rig.group, modelKey, 'LeftLegPivot');
  rig.rightLegPivot = findPivot(rig.group, modelKey, 'RightLegPivot');
  rig.lWing = findPivot(rig.group, modelKey, 'LWing');
  rig.rWing = findPivot(rig.group, modelKey, 'RWing');

  rig.group.userData.isBlenderMonster = true;
  sealAlbedoUvs(rig.group);
  const phase = (Math.abs(mObj.pos.x) * 12.9898 + Math.abs(mObj.pos.z) * 78.233) % 1;
  offsetAlbedoPhase(rig.group, phase, (phase * 1.618) % 1);
  addCartoonOutline(rig.group, 0.022);

  const motionRow = MONSTER_MOTION[modelKey];
  if (motionRow?.clips) {
    if (motionRow.skeleton === 'biped') {
      // Optional by contract (callers that do not pose the figure pass no hero file); spawnMonster throws when the hero file failed to load.
      if (heroGltf) attachBipedAnimator(mObj, modelKey, heroGltf);
    } else {
      attachMonsterGltfAnimator(mObj, modelKey, gltf);
    }
  }

  return true;
}

interface CachedClips {
  clips: THREE.AnimationClip[];
  walkLegRatio: number;
}
const modelClipsCache = new Map<string, CachedClips>();

function attachBipedAnimator(mObj: MonsterEntityLike, modelKey: string, heroSource: GLTF): void {
  let cached = modelClipsCache.get(modelKey);
  if (!cached) {
    const heroHips = heroSource.scene.getObjectByName('Hips');
    if (!heroHips) throw new Error('attachBipedAnimator: the hero file has no Hips bone');
    const monHips = mObj.rig.group.getObjectByName('Hips');
    if (!monHips) throw new Error(`attachBipedAnimator: ${modelKey} has no Hips bone`);
    const heroHipsY = heroHips.position.y;
    const monHipsY = monHips.position.y;
    const ratio = monHipsY / heroHipsY;
    const walkLegRatio = heroHipsY / monHipsY;

    const clonedClips: THREE.AnimationClip[] = [];
    for (const clip of heroSource.animations) {
      const cloned = clip.clone();
      for (let t = 0; t < cloned.tracks.length; t++) {
        const track = cloned.tracks[t];
        if (track.name === 'Hips.position') {
          const scaledTrack = track.clone();
          for (let i = 0; i < scaledTrack.values.length; i++) {
            scaledTrack.values[i] *= ratio;
          }
          cloned.tracks[t] = scaledTrack;
        }
      }
      clonedClips.push(cloned);
    }
    cached = { clips: clonedClips, walkLegRatio };
    modelClipsCache.set(modelKey, cached);
  }

  const rig = mObj.rig;
  const pivots: Record<string, THREE.Object3D> = {};
  if (rig.headGroup) pivots.headGroup = rig.headGroup;
  if (rig.leftArmPivot) pivots.leftArmPivot = rig.leftArmPivot;
  if (rig.rightArmPivot) pivots.rightArmPivot = rig.rightArmPivot;
  if (rig.leftLegPivot) pivots.leftLegPivot = rig.leftLegPivot;
  if (rig.rightLegPivot) pivots.rightLegPivot = rig.rightLegPivot;
  if (rig.lWing) pivots.lWing = rig.lWing;
  if (rig.rWing) pivots.rWing = rig.rWing;

  const animator = new BlenderHeroAnimator(rig.group, cached.clips, pivots);
  animator.setWalkLegRatio(cached.walkLegRatio);
  mObj.animator = animator;
}

function attachMonsterGltfAnimator(
  mObj: MonsterEntityLike,
  modelKey: string,
  monstersGltf: GLTF
): void {
  let cached = modelClipsCache.get(modelKey);
  if (!cached) {
    // The library's tracks carry the prefix of the figure that authored it (the model key), never a body's (design 6.1).
    const stripped = stripClipPrefix(monstersGltf.animations, modelKey);
    const clonedClips = stripped.map((c) => c.clone());
    cached = { clips: clonedClips, walkLegRatio: 1.0 };
    modelClipsCache.set(modelKey, cached);
  }
  const rig = mObj.rig;
  const pivots: Record<string, THREE.Object3D> = {};
  if (rig.headGroup) pivots.headGroup = rig.headGroup;
  if (rig.leftArmPivot) pivots.leftArmPivot = rig.leftArmPivot;
  if (rig.rightArmPivot) pivots.rightArmPivot = rig.rightArmPivot;
  if (rig.leftLegPivot) pivots.leftLegPivot = rig.leftLegPivot;
  if (rig.rightLegPivot) pivots.rightLegPivot = rig.rightLegPivot;
  if (rig.lWing) pivots.lWing = rig.lWing;
  if (rig.rWing) pivots.rWing = rig.rWing;

  const animator = new BlenderHeroAnimator(rig.group, cached.clips, pivots);
  mObj.animator = animator;
}
