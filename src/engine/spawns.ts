import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { G, type MonsterEntity, type ResourceNodeEntity } from './context';
import { MONSTER_TYPES, RESOURCE_NODES_DEF, type MonsterDef } from '../data/world';
import { MONSTER_PLACEMENTS, NODE_PLACEMENTS } from '../data/placements';
import { getTerrainHeight } from '../state/terrain';
import {
  albedoMaterial,
  biomeAlbedoId,
  biomeGroundId,
  offsetAlbedoPhase,
  sealAlbedoUvs
} from './textures';
import { addCartoonOutline, facetMaterial } from './materials';
import { createMonsterMesh } from './monsterMeshes';
import { loadBlenderMonstersTemplate, upgradeMonsterRigWithGltf } from './blenderMonsters';
import { loadBlenderWorldTemplate, upgradeResourceNodeWithGltf } from './blenderWorld';
import { el } from '../ui/hud';

interface ResourceNodeDef {
  name?: string;
  skill?: string;
  req?: number;
  xp?: number;
  item?: string;
  respawn?: number;
  kind: string;
  foliageColor?: number;
  trunkColor?: number;
  oreColor?: number;
  scale?: number;
}

export function spawnMonster(typeKey: string, x: number, z: number): void {
  const def: MonsterDef | undefined = MONSTER_TYPES[typeKey];
  if (!def) return;
  const rig = createMonsterMesh(def, typeKey);
  const phase = ((Math.abs(x) * 12.9898 + Math.abs(z) * 78.233) % 1);
  offsetAlbedoPhase(rig.group, phase, (phase * 1.618) % 1);
  const y = getTerrainHeight(x, z);
  rig.group.position.set(x, y, z);

  const labelEl = document.createElement('div');
  labelEl.className = 'entity-label';
  labelEl.innerHTML = `
    <div class="label-text">${def.name} (Lv-${def.level})</div>
    <div class="entity-hp-bar" style="display:none;"><div class="entity-hp-fill" style="width:100%"></div></div>
  `;
  el('world-labels').appendChild(labelEl);

  const mObj: MonsterEntity = {
    typeKey,
    def,
    rig,
    pos: rig.group.position,
    spawnPos: new THREE.Vector3(x, y, z),
    hp: def.hp,
    maxHp: def.hp,
    dead: false,
    isDying: false,
    dyingTimer: 0,
    flinch: 0,
    flashTimer: 0,
    respawnTimer: 0,
    wanderTimer: Math.random() * 3,
    attackCooldown: 0,
    attackAnim: 0,
    breathCount: 0,
    inCombatWithPlayer: false,
    labelEl
  };

  const uData = { type: 'monster', entity: mObj, interactRadius: def.style === 'melee' ? 2.8 : 3.4 };
  rig.group.userData = uData;
  rig.hitbox.userData = uData;
  G.worldInteractiveObjects.push(rig.hitbox);
  G.scene.add(rig.group);
  G.monstersList.push(mObj);
  loadBlenderMonstersTemplate().then((gltf: GLTF | null) => {
    if (!gltf) return;
    upgradeMonsterRigWithGltf(mObj, gltf);
  });
}

// Smooth Organic Branching Trees & Sculpted Weathered Ore Boulders
export function spawnResourceNode(nodeKey: string, x: number, z: number): void {
  const def = (RESOURCE_NODES_DEF as Record<string, ResourceNodeDef | undefined>)[nodeKey];
  if (!def) return;
  const grp = new THREE.Group();
  const y = def.kind === 'fish' ? -0.30 : getTerrainHeight(x, z);
  grp.position.set(x, y, z);

  let visualMesh: THREE.Object3D;
  let depletedMesh: THREE.Object3D;

  if (def.kind === 'tree') {
    const s = def.scale || 1.0;
    grp.scale.set(s, s, s);
    visualMesh = new THREE.Group();

    const barkMat = albedoMaterial(def.trunkColor || 0x92400e, 'bark');
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.36, 2.2, 12), barkMat);
    trunk.position.y = 1.1;
    trunk.castShadow = true;
    visualMesh.add(trunk);

    const foliageHexMap: Record<string, number> = {
      normal_tree: 0x334835,
      oak_tree: 0x3e4f38,
      willow_tree: 0x48523c,
      maple_tree: 0x5c4228,
      yew_tree: 0x223628,
      magic_tree: 0x35545b
    };
    const foliageHex = foliageHexMap[nodeKey] || def.foliageColor || 0x334835;
    const fMat = albedoMaterial(foliageHex, 'grass');
    const puffs: [number, number, number, number][] = [
      [0, 2.55, 0, 1.25],
      [0.72, 2.15, 0.28, 0.82],
      [-0.62, 2.2, -0.32, 0.78]
    ];
    puffs.forEach(([px, py, pz, rad]) => {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(rad, 16, 14), fMat);
      puff.scale.set(1.08, 0.88, 1.08);
      puff.position.set(px, py, pz);
      puff.castShadow = true;
      visualMesh.add(puff);
    });

    grp.add(visualMesh);

    depletedMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.52, 0.68, 6), barkMat);
    depletedMesh.position.y = 0.34;
    depletedMesh.visible = false;
    grp.add(depletedMesh);
  } else if (def.kind === 'rock') {
    visualMesh = new THREE.Group();
    const rockBiome = biomeGroundId(x, z);
    const rockMat = albedoMaterial(0x94a3b8, rockBiome ? biomeAlbedoId(rockBiome) : 'stone');
    const baseRock = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 12), rockMat);
    baseRock.position.y = 0.7;
    baseRock.scale.set(1.18, 0.78, 1.05);
    const sideRock = new THREE.Mesh(new THREE.SphereGeometry(0.58, 14, 10), rockMat);
    sideRock.position.set(0.78, 0.42, 0.2);
    sideRock.scale.set(1.1, 0.8, 0.95);
    visualMesh.add(baseRock, sideRock);
    const oreMat = facetMaterial({ color: def.oreColor, emissive: def.oreColor, emissiveIntensity: 0.2, flatShading: true });
    const veins: [number, number, number][] = [
      [0.15, 0.95, 0.72],
      [-0.35, 0.7, -0.55]
    ];
    veins.forEach(([ox, oy, oz]) => {
      const vein = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), oreMat);
      vein.position.set(ox, oy, oz);
      visualMesh.add(vein);
    });
    grp.add(visualMesh);

    depletedMesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.85, 0),
      albedoMaterial(0x64748b, 'stone')
    );
    depletedMesh.scale.set(0.95, 0.75, 0.95);
    depletedMesh.visible = false;
    grp.add(depletedMesh);
  } else {
    visualMesh = new THREE.Group();
    const ring1 = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.05, 5, 8),
      new THREE.MeshBasicMaterial({ color: 0x7a96a3 })
    );
    ring1.rotation.x = Math.PI / 2;
    ring1.position.y = 0.06;
    visualMesh.add(ring1);
    G.swayingFoliage.push({ mesh: ring1, speed: 1.8, rotY: true });
    grp.add(visualMesh);

    depletedMesh = new THREE.Group();
    depletedMesh.visible = false;
    grp.add(depletedMesh);
  }

  const hitbox = new THREE.Mesh(
    new THREE.CylinderGeometry(1.45, 1.45, 3.2, 6),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitbox.position.y = 1.5;
  hitbox.userData.isCollider = true;
  grp.add(hitbox);
  sealAlbedoUvs(grp);
  addCartoonOutline(grp, 0.038);

  const rObj: ResourceNodeEntity = {
    nodeKey,
    def,
    group: grp,
    pos: grp.position,
    visualMesh,
    depletedMesh,
    depleted: false,
    respawnTimer: 0
  };

  const uData = { type: 'resource', entity: rObj, interactRadius: 3.4 };
  grp.userData = uData;
  hitbox.userData = uData;
  G.worldInteractiveObjects.push(hitbox);
  G.scene.add(grp);
  G.resourceNodesList.push(rObj);
  loadBlenderWorldTemplate().then((gltf: GLTF | null) => {
    if (!gltf) return;
    upgradeResourceNodeWithGltf(rObj, gltf);
  });
}

export function spawnAllResourcesAndMonsters(): void {
  for (const m of MONSTER_PLACEMENTS) {
    spawnMonster(m.type, m.x, m.z);
  }
  for (const n of NODE_PLACEMENTS) {
    spawnResourceNode(n.type, n.x, n.z);
  }
}
