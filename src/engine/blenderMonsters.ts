import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadGltfOnce } from './gltf';
import { addCartoonOutline, facetMaterial } from './materials';
import { albedoMaterial, offsetAlbedoPhase, sealAlbedoUvs, speciesAlbedo } from './textures';

export function loadBlenderMonstersTemplate(url = '/models/monsters.glb?v=face_align_v2'): Promise<GLTF | null> {
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
  def: {
    bodyColor?: number;
    accentColor?: number;
    weaponColor?: number;
    scale?: number;
  };
  rig: MonsterRigLike;
  pos: THREE.Vector3;
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
export function upgradeMonsterRigWithGltf(mObj: MonsterEntityLike, gltf: GLTF): boolean {
  const typeKey = mObj.typeKey;
  const template = gltf.scene.getObjectByName(`Monster_${typeKey}`);
  if (!template) return false;

  const cloned = template.clone(true);
  cloned.position.set(0, 0, 0);
  cloned.rotation.set(0, 0, 0);
  cloned.scale.set(1, 1, 1);

  const speciesKey =
    typeKey === 'goblin_archer'
      ? 'goblin'
      : typeKey;
  const bodyAlbedo = speciesAlbedo(speciesKey);
  const defaultBodyColor = mObj.def.bodyColor ?? 0x65a30d;

  cloned.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry = mesh.geometry.clone();
    mesh.castShadow = true;
    mesh.receiveShadow = false;

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
          emissiveIntensity: 0.75
        });
      }
    } else if (matName.includes('skin') || matName.includes('scale') || matName.includes('chitin') || matName.includes('feather')) {
      mesh.material = bodyAlbedo ? albedoMaterial(colorHex, bodyAlbedo) : facetMaterial({ color: colorHex });
    } else if (matName.includes('cloth') || matName.includes('robe')) {
      mesh.material = albedoMaterial(colorHex, 'cloth', { side: THREE.DoubleSide });
    } else if (matName.includes('leather') || matName.includes('fur') || matName.includes('wing') || matName.includes('hoof')) {
      mesh.material = albedoMaterial(colorHex, 'leather', { side: THREE.DoubleSide });
    } else if (matName.includes('wood')) {
      mesh.material = albedoMaterial(colorHex, 'wood');
    } else if (matName.includes('bark')) {
      mesh.material = albedoMaterial(colorHex, 'bark');
    } else if (matName.includes('moss') || matName.includes('grass') || matName.includes('leaf')) {
      mesh.material = albedoMaterial(colorHex, 'grass');
    } else if (matName.includes('stone')) {
      mesh.material = albedoMaterial(colorHex, 'stone');
    } else if (matName.includes('iron') || matName.includes('bronze') || matName.includes('steel')) {
      mesh.material = albedoMaterial(colorHex, 'iron');
    } else {
      mesh.material = facetMaterial({ color: colorHex });
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

  rig.headGroup = findPivot(rig.group, typeKey, 'HeadGroup');
  rig.leftArmPivot = findPivot(rig.group, typeKey, 'LeftArmPivot');
  rig.rightArmPivot = findPivot(rig.group, typeKey, 'RightArmPivot');
  rig.leftLegPivot = findPivot(rig.group, typeKey, 'LeftLegPivot');
  rig.rightLegPivot = findPivot(rig.group, typeKey, 'RightLegPivot');
  rig.lWing = findPivot(rig.group, typeKey, 'LWing');
  rig.rWing = findPivot(rig.group, typeKey, 'RWing');

  rig.group.userData.isBlenderMonster = true;
  sealAlbedoUvs(rig.group);
  const phase = (Math.abs(mObj.pos.x) * 12.9898 + Math.abs(mObj.pos.z) * 78.233) % 1;
  offsetAlbedoPhase(rig.group, phase, (phase * 1.618) % 1);
  addCartoonOutline(rig.group, 0.022);
  return true;
}
