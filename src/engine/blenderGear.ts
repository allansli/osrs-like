import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ItemDef } from '../data/items';
import { facetMaterial } from './materials';
import { albedoForItem, albedoMaterial, sealAlbedoUvs } from './textures';

let cachedGearPromise: Promise<GLTF | null> | null = null;
let loadedGearRoot: THREE.Object3D | null = null;

export function setBlenderGearRoot(root: THREE.Object3D | null): void {
  loadedGearRoot = root;
}

export function hasBlenderGearTemplate(): boolean {
  return loadedGearRoot !== null;
}

export function loadBlenderGearTemplate(url = '/models/gear.glb?v=4503_v2'): Promise<GLTF | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }
  if (!cachedGearPromise) {
    const loader = new GLTFLoader();
    cachedGearPromise = new Promise((resolve) => {
      loader.load(
        url,
        (gltf) => {
          loadedGearRoot = gltf.scene;
          resolve(gltf);
        },
        undefined,
        (err) => {
          console.warn('[BlenderGear] Failed to load gear.glb, keeping procedural fallback:', err);
          resolve(null);
        }
      );
    });
  }
  return cachedGearPromise;
}

export interface GearCloneOptions {
  primaryExtra?: Record<string, unknown>;
  trimExtra?: Record<string, unknown>;
  glowHex?: number;
  glowIntensity?: number;
  doubleSided?: boolean;
}

/**
 * Clones a named gear template node (e.g. `Gear_scimitar`) from `gear.glb`
 * and re-colors its semantic materials (`gear_primary`, `gear_trim`, `gear_glow`, etc.)
 * to match the equipped `ItemDef`.
 */
export function cloneBlenderGearNode(
  nodeName: string,
  item: ItemDef,
  opts: GearCloneOptions = {}
): THREE.Group | null {
  if (!loadedGearRoot) return null;
  const template = loadedGearRoot.getObjectByName(nodeName);
  if (!template) return null;

  const group = new THREE.Group();
  const cloned = template.clone(true);
  cloned.position.set(0, 0, 0);
  cloned.rotation.set(0, 0, 0);
  cloned.scale.set(1, 1, 1);

  const primaryHex = item.color ?? 0x9ca3af;
  const trimHex = item.trim || item.color || 0xfacc15;
  const glowHex = opts.glowHex ?? (item.trim || item.color || 0xfde047);
  const glowIntensity = opts.glowIntensity ?? 0.75;

  const primaryMat = albedoMaterial(primaryHex, albedoForItem(item), {
    ...(opts.doubleSided ? { side: THREE.DoubleSide } : {}),
    ...(opts.primaryExtra || {})
  });
  const trimMat = facetMaterial({
    color: trimHex,
    ...(opts.trimExtra || {})
  });
  const glowMat = facetMaterial({
    color: glowHex,
    emissive: glowHex,
    emissiveIntensity: glowIntensity
  });
  const woodMat = albedoMaterial(0x3e2c1c, 'wood');
  const leatherMat = albedoMaterial(0x241a13, 'leather');
  const darkMat = facetMaterial({ color: 0x1a1e24 });
  const whiteMat = facetMaterial({ color: 0xd8dbdf });
  const crimsonMat = facetMaterial({ color: 0x6c2323 });

  cloned.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry = mesh.geometry.clone();
    mesh.castShadow = true;
    mesh.receiveShadow = false;

    const origMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const matName = (origMat?.name || '').toLowerCase();
    const meshName = (mesh.name || '').toLowerCase();

    if (matName.includes('gear_glow') || matName.includes('glow') || meshName.includes('glow') || meshName.includes('eye') || meshName.includes('gem') || meshName.includes('orb')) {
      mesh.material = glowMat;
      if (meshName.includes('string') || meshName.includes('eye')) {
        mesh.userData.noOutline = true;
      }
    } else if (matName.includes('gear_trim') || matName.includes('trim') || matName.includes('gold')) {
      mesh.material = trimMat;
    } else if (matName.includes('gear_wood') || matName.includes('wood')) {
      mesh.material = woodMat;
    } else if (matName.includes('gear_leather') || matName.includes('leather')) {
      mesh.material = leatherMat;
    } else if (matName.includes('gear_dark') || matName.includes('dark') || matName.includes('charcoal')) {
      mesh.material = darkMat;
    } else if (matName.includes('gear_white') || matName.includes('white') || matName.includes('feather') || matName.includes('wing')) {
      mesh.material = whiteMat;
      if (meshName.includes('string')) {
        mesh.userData.noOutline = true;
      }
    } else if (matName.includes('gear_crimson') || matName.includes('crimson')) {
      mesh.material = crimsonMat;
    } else {
      mesh.material = primaryMat;
    }
  });

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

  sealAlbedoUvs(group);
  return group;
}
