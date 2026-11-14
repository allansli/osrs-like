import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadGltfOnce } from './gltf';
import { addCartoonOutline, facetMaterial } from './materials';
import { albedoMaterial, biomeAlbedoId, biomeGroundId, sealAlbedoUvs } from './textures';

export function loadBlenderWorldTemplate(url = '/models/world.glb'): Promise<GLTF | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }
  return loadGltfOnce(url);
}

export interface ResourceNodeLike {
  nodeKey: string;
  def: {
    kind: string;
    foliageColor?: number;
    trunkColor?: number;
    oreColor?: number;
    scale?: number;
  };
  group: THREE.Group;
  pos: THREE.Vector3;
  visualMesh: THREE.Object3D;
  depletedMesh: THREE.Object3D;
  depleted: boolean;
}

function extractColorHex(mat: THREE.Material | undefined, fallback: number): number {
  const std = mat as THREE.MeshStandardMaterial | undefined;
  if (std && std.color && typeof std.color.getHex === 'function') {
    return std.color.getHex();
  }
  return fallback;
}

export interface WorldMaterialOverrides {
  foliageHex?: number;
  trunkHex?: number;
  oreHex?: number;
  stoneHex?: number;
  stoneAlbedo?: string;
  mushroomHex?: number;
}

function applyWorldMaterials(root: THREE.Object3D, overrides: WorldMaterialOverrides = {}): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry = mesh.geometry.clone();
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const origMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const matName = (origMat?.name || '').toLowerCase();
    const meshName = (mesh.name || '').toLowerCase();
    const baseHex = extractColorHex(origMat, 0x94a3b8);

    if (matName.includes('ore_vein') || meshName.includes('vein')) {
      const c = overrides.oreHex ?? baseHex;
      mesh.material = facetMaterial({
        color: c,
        emissive: c,
        emissiveIntensity: 0.28,
        flatShading: true
      });
    } else if (matName.includes('mushroom_cap') || meshName.includes('mushroom_cap')) {
      const c = overrides.mushroomHex ?? baseHex;
      mesh.material = facetMaterial({
        color: c,
        emissive: c,
        emissiveIntensity: 0.45
      });
    } else if (matName.includes('crystal') || meshName.includes('crystal') || meshName.includes('rune')) {
      mesh.material = facetMaterial({
        color: 0x5d8096,
        emissive: 0x2d4857,
        emissiveIntensity: 0.45,
        flatShading: true
      });
    } else if (matName.includes('lava') || matName.includes('fire') || meshName.includes('lava') || meshName.includes('flame')) {
      mesh.material = facetMaterial({
        color: 0xab3815,
        emissive: 0x781a07,
        emissiveIntensity: 0.82
      });
    } else if (matName.includes('foliage') || matName.includes('leaf') || matName.includes('grass') || matName.includes('moss')) {
      const c = overrides.foliageHex ?? 0x334835;
      mesh.material = albedoMaterial(c, 'grass');
    } else if (matName.includes('bark') || meshName.includes('trunk')) {
      const c = overrides.trunkHex ?? 0x362b22;
      mesh.material = albedoMaterial(c, 'bark');
    } else if (matName.includes('wood') || matName.includes('timber')) {
      mesh.material = albedoMaterial(0x44372c, 'wood');
    } else if (matName.includes('sandstone') || matName.includes('sand')) {
      mesh.material = albedoMaterial(0x786e5c, biomeAlbedoId('alkharid-sand'));
    } else if (matName.includes('obsidian')) {
      mesh.material = albedoMaterial(0x383535, biomeAlbedoId('peak-volcanic'));
    } else if (matName.includes('slate') || matName.includes('roof')) {
      mesh.material = albedoMaterial(0x2d333b, 'slate');
    } else if (matName.includes('stone') || matName.includes('marble') || matName.includes('rock')) {
      const c = overrides.stoneHex ?? 0x525c66;
      mesh.material = albedoMaterial(c, (overrides.stoneAlbedo as 'stone') || 'stone');
    } else if (matName.includes('iron') || matName.includes('anvil') || matName.includes('steel')) {
      mesh.material = albedoMaterial(0x33373d, 'iron');
    } else if (matName.includes('gold') || matName.includes('brass')) {
      mesh.material = facetMaterial({ color: 0x8f7d4e, emissive: 0x5e4f2b, emissiveIntensity: 0.12 });
    } else if (matName.includes('cloth')) {
      mesh.material = albedoMaterial(baseHex, 'cloth', { side: THREE.DoubleSide });
    } else if (matName.includes('water') || meshName.includes('ripple')) {
      mesh.material = new THREE.MeshBasicMaterial({ color: 0x1c2d36 });
      mesh.userData.noOutline = true;
    } else {
      mesh.material = facetMaterial({ color: baseHex });
    }
  });
}

function cloneWorldNode(gltf: GLTF, name: string, overrides: WorldMaterialOverrides = {}): THREE.Group | null {
  const template = gltf.scene.getObjectByName(name);
  if (!template) return null;

  const group = new THREE.Group();
  const cloned = template.clone(true);
  cloned.position.set(0, 0, 0);
  cloned.rotation.set(0, 0, 0);
  cloned.scale.set(1, 1, 1);

  applyWorldMaterials(cloned, overrides);

  const children = [...cloned.children];
  if (children.length > 0) {
    for (const ch of children) {
      group.add(ch);
    }
  } else if ((cloned as THREE.Mesh).isMesh) {
    group.add(cloned);
  } else {
    return null;
  }
  return group;
}

/**
 * Upgrades a resource node (tree, ore rock, or fishing spot) in-place with sculpted Blender meshes from `world.glb`.
 */
export function upgradeResourceNodeWithGltf(rObj: ResourceNodeLike, gltf: GLTF): boolean {
  const kind = rObj.def.kind;
  const nodeKey = rObj.nodeKey;

  if (kind === 'tree') {
    const foliageHex =
      ({
        normal_tree: 0x334835,
        oak_tree: 0x3e4f38,
        willow_tree: 0x48523c,
        maple_tree: 0x5c4228,
        yew_tree: 0x223628,
        magic_tree: 0x35545b
      } as Record<string, number>)[nodeKey] ||
      rObj.def.foliageColor ||
      0x334835;
    const trunkHex = rObj.def.trunkColor || 0x362b22;

    const visual =
      cloneWorldNode(gltf, `World_${nodeKey}`, { foliageHex, trunkHex }) ||
      cloneWorldNode(gltf, 'World_normal_tree', { foliageHex, trunkHex });
    const stump = cloneWorldNode(gltf, 'World_tree_stump', { trunkHex });
    if (!visual) return false;

    if (rObj.visualMesh && rObj.visualMesh.parent === rObj.group) {
      rObj.group.remove(rObj.visualMesh);
    }
    visual.visible = !rObj.depleted;
    rObj.group.add(visual);
    rObj.visualMesh = visual;

    if (stump) {
      if (rObj.depletedMesh && rObj.depletedMesh.parent === rObj.group) {
        rObj.group.remove(rObj.depletedMesh);
      }
      stump.visible = rObj.depleted;
      rObj.group.add(stump);
      rObj.depletedMesh = stump;
    }
  } else if (kind === 'rock') {
    const rockBiome = biomeGroundId(rObj.pos.x, rObj.pos.z);
    const stoneAlbedo = rockBiome ? biomeAlbedoId(rockBiome) : 'stone';
    const visual = cloneWorldNode(gltf, 'World_ore_rock', {
      oreHex: rObj.def.oreColor || 0xd97706,
      stoneHex: 0x94a3b8,
      stoneAlbedo
    });
    const depleted = cloneWorldNode(gltf, 'World_rock_depleted', {
      stoneHex: 0x64748b,
      stoneAlbedo: 'stone'
    });
    if (!visual) return false;

    if (rObj.visualMesh && rObj.visualMesh.parent === rObj.group) {
      rObj.group.remove(rObj.visualMesh);
    }
    visual.visible = !rObj.depleted;
    rObj.group.add(visual);
    rObj.visualMesh = visual;

    if (depleted) {
      if (rObj.depletedMesh && rObj.depletedMesh.parent === rObj.group) {
        rObj.group.remove(rObj.depletedMesh);
      }
      depleted.visible = rObj.depleted;
      rObj.group.add(depleted);
      rObj.depletedMesh = depleted;
    }
  } else {
    const visual = cloneWorldNode(gltf, 'World_fishing_spot');
    if (!visual) return false;

    if (rObj.visualMesh && rObj.visualMesh.parent === rObj.group) {
      rObj.group.remove(rObj.visualMesh);
    }
    visual.visible = !rObj.depleted;
    rObj.group.add(visual);
    rObj.visualMesh = visual;
  }

  rObj.group.userData.isBlenderResource = true;
  sealAlbedoUvs(rObj.group);
  addCartoonOutline(rObj.group, 0.032);
  return true;
}

export interface WorldPropUpgradeOptions {
  overrides?: WorldMaterialOverrides;
  keepChildren?: (child: THREE.Object3D) => boolean;
  interactiveObjectsList?: THREE.Object3D[];
  outlineThickness?: number;
}

/**
 * Upgrades a world structure, landmark, or interactive station group in-place with its sculpted Blender `World_<id>` asset.
 */
export function upgradeWorldPropWithGltf(
  targetGroup: THREE.Group,
  assetName: string,
  gltf: GLTF,
  opts: WorldPropUpgradeOptions = {}
): boolean {
  const cloned = cloneWorldNode(gltf, assetName, opts.overrides || {});
  if (!cloned) return false;

  const uData = targetGroup.userData && targetGroup.userData.type ? targetGroup.userData : null;

  // Hide old interactive meshes that sit in worldInteractiveObjects rather than deleting them,
  // or keep explicitly preserved children (e.g. BANK sign, NPC rig).
  const toKeep: THREE.Object3D[] = [];
  for (const ch of targetGroup.children) {
    if (opts.keepChildren && opts.keepChildren(ch)) {
      toKeep.push(ch);
    } else if (opts.interactiveObjectsList && opts.interactiveObjectsList.includes(ch)) {
      const m = ch as THREE.Mesh;
      if (m.isMesh) {
        m.material = new THREE.MeshBasicMaterial({ visible: false });
        m.userData.noOutline = true;
      }
      toKeep.push(ch);
    }
  }

  targetGroup.clear();
  for (const ch of toKeep) {
    targetGroup.add(ch);
  }

  for (const ch of [...cloned.children]) {
    if (uData) {
      ch.userData = { ...ch.userData, ...uData };
      ch.traverse((sub) => {
        if ((sub as THREE.Mesh).isMesh && !sub.userData.isOutline) {
          sub.userData = { ...sub.userData, ...uData };
          if (opts.interactiveObjectsList) {
            opts.interactiveObjectsList.push(sub);
          }
        }
      });
    }
    targetGroup.add(ch);
  }

  targetGroup.userData.isBlenderWorldProp = true;
  sealAlbedoUvs(targetGroup);
  addCartoonOutline(targetGroup, opts.outlineThickness ?? 0.032);
  return true;
}
