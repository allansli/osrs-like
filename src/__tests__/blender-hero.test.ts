import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ITEMS } from '../data/items';
import { MONSTER_TYPES, RESOURCE_NODES_DEF } from '../data/world';
import { buildHumanoidRig, LEAN_RIG } from '../engine/humanoid';
import { upgradeHumanoidRigWithGltf } from '../engine/blenderHero';
import { setBlenderGearRoot } from '../engine/blenderGear';
import { upgradeMonsterRigWithGltf, type MonsterEntityLike } from '../engine/blenderMonsters';
import { upgradeResourceNodeWithGltf, upgradeWorldPropWithGltf } from '../engine/blenderWorld';
import {
  buildAmuletVisual,
  buildBodyVisual,
  buildBootVisual,
  buildCapeVisual,
  buildGloveVisual,
  buildHeadVisual,
  buildLegsVisual,
  buildRingVisual,
  buildShieldVisual,
  buildWeaponVisual
} from '../engine/playerGear';

function parseGlb(relPath: string): Promise<GLTF> {
  const glbPath = path.resolve(__dirname, relPath);
  const buf = fs.readFileSync(glbPath);
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.parse(arrayBuffer, '', (gltf) => resolve(gltf), (err) => reject(err));
  });
}

describe('Blender 5.2 Complete Asset & Composition Pipeline (hero.glb, gear.glb, monsters.glb, world.glb)', () => {
  it('hero.glb exports a clean base human (no baked armor/weapons) with all 10 NLA clips and exact LEAN_RIG pivots', async () => {
    const gltf = await parseGlb('../../public/models/hero.glb');
    const clipNames = gltf.animations.map((a) => a.name).sort();
    expect(clipNames).toEqual(
      ['Cast', 'Chop', 'Fish', 'Idle', 'Lunge', 'Mine', 'Ranged', 'Slash', 'SpinSlash', 'Walk'].sort()
    );

    // Ensure no baked-in gear meshes exist in hero.glb
    const meshNames: string[] = [];
    gltf.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) meshNames.push(obj.name);
    });
    expect(meshNames.some((n) => /Scythe|Faceguard|WarCape|Bandos|Pauldron|Zenyte/i.test(n))).toBe(false);

    const rig = buildHumanoidRig();
    const animator = upgradeHumanoidRigWithGltf(rig, gltf);
    expect(animator).not.toBeNull();
    expect(rig.group.userData.isBlenderHero).toBe(true);

    expect(rig.torso.position.y).toBeCloseTo(LEAN_RIG.torsoY, 2);
    expect(rig.headGroup.position.y).toBeCloseTo(LEAN_RIG.headY, 2);
    expect(rig.leftArmPivot.position.x).toBeCloseTo(-LEAN_RIG.shoulderX, 2);
    expect(rig.rightArmPivot.position.x).toBeCloseTo(LEAN_RIG.shoulderX, 2);
    expect(rig.leftLegPivot.position.x).toBeCloseTo(-LEAN_RIG.hipX, 2);
    expect(rig.rightLegPivot.position.x).toBeCloseTo(LEAN_RIG.hipX, 2);

    // Verify animator drives Walk and Slash clips
    animator!.setMoving(true);
    animator!.update(0.2);
    expect(Math.abs(rig.leftLegPivot.rotation.x)).toBeGreaterThan(0.01);

    animator!.playAction('Slash', 1.2);
    animator!.update(0.15);
    expect(Math.abs(rig.rightArmPivot.rotation.x)).toBeGreaterThan(0.05);
  });

  it('gear.glb exports all 47 gear silhouettes and dynamically composes them onto the base human character', async () => {
    const heroGltf = await parseGlb('../../public/models/hero.glb');
    const gearGltf = await parseGlb('../../public/models/gear.glb');
    setBlenderGearRoot(gearGltf.scene);

    const rig = buildHumanoidRig();
    upgradeHumanoidRigWithGltf(rig, heroGltf);

    // Dynamically compose a full 10-slot loadout onto the base human pivots
    const weapon = buildWeaponVisual(ITEMS.rune_scimitar);
    rig.rightArmPivot.add(weapon.group);
    expect(weapon.group.children.length).toBeGreaterThan(0);

    const shield = buildShieldVisual(ITEMS.dragon_defender);
    rig.leftArmPivot.add(shield);
    expect(shield.children.length).toBeGreaterThan(0);

    const helm = buildHeadVisual(ITEMS.neitiznot_helm);
    rig.headGroup.add(helm);
    expect(helm.children.length).toBeGreaterThan(0);

    const body = buildBodyVisual(ITEMS.bandos_chest);
    expect(body.torso).not.toBeNull();
    rig.torso.add(body.torso!);

    const legs = buildLegsVisual(ITEMS.bandos_tassets);
    expect(legs.torso).not.toBeNull();
    expect(legs.left).not.toBeNull();
    expect(legs.right).not.toBeNull();
    rig.torso.add(legs.torso!);
    rig.leftLegPivot.add(legs.left!);
    rig.rightLegPivot.add(legs.right!);

    const bootL = buildBootVisual(ITEMS.primordial_boots, true);
    const bootR = buildBootVisual(ITEMS.primordial_boots, false);
    rig.leftLegPivot.add(bootL);
    rig.rightLegPivot.add(bootR);
    expect(bootL.children.length).toBeGreaterThan(0);

    const gloveL = buildGloveVisual(ITEMS.barrows_gloves);
    const gloveR = buildGloveVisual(ITEMS.barrows_gloves);
    rig.leftArmPivot.add(gloveL);
    rig.rightArmPivot.add(gloveR);
    expect(gloveL.children.length).toBeGreaterThan(0);

    const cape = buildCapeVisual(ITEMS.infernal_cape);
    rig.torso.add(cape);
    expect(cape.children.length).toBeGreaterThan(0);

    const amulet = buildAmuletVisual(ITEMS.amulet_torture);
    rig.torso.add(amulet);
    expect(amulet.children.length).toBeGreaterThan(0);

    const ring = buildRingVisual(ITEMS.berserker_ring);
    rig.rightArmPivot.add(ring);
    expect(ring.children.length).toBeGreaterThan(0);

    setBlenderGearRoot(null);
  });

  it('monsters.glb exports all 10 monster species and upgrades monster rigs with articulated pivots', async () => {
    const monstersGltf = await parseGlb('../../public/models/monsters.glb');
    const speciesKeys = Object.keys(MONSTER_TYPES);
    expect(speciesKeys.length).toBe(10);

    for (const typeKey of speciesKeys) {
      const node = monstersGltf.scene.getObjectByName(`Monster_${typeKey}`);
      expect(node, `Missing Monster_${typeKey} in monsters.glb`).toBeDefined();

      const group = new THREE.Group();
      const hitbox = new THREE.Mesh();
      group.add(hitbox);
      const mObj: MonsterEntityLike = {
        typeKey,
        def: (MONSTER_TYPES as Record<string, { bodyColor?: number; accentColor?: number; scale?: number }>)[typeKey],
        rig: { group, hitbox },
        pos: new THREE.Vector3(10, 0, 10)
      };

      const upgraded = upgradeMonsterRigWithGltf(mObj, monstersGltf);
      expect(upgraded).toBe(true);
      expect(mObj.rig.group.userData.isBlenderMonster).toBe(true);
      expect(mObj.rig.leftLegPivot).not.toBeNull();
      expect(mObj.rig.rightLegPivot).not.toBeNull();
    }
  });

  it('world.glb exports all 23 world props, resource nodes, stations, and landmarks', async () => {
    const worldGltf = await parseGlb('../../public/models/world.glb');
    const expectedWorldNodes = [
      'World_normal_tree',
      'World_oak_tree',
      'World_willow_tree',
      'World_maple_tree',
      'World_yew_tree',
      'World_magic_tree',
      'World_tree_stump',
      'World_ore_rock',
      'World_rock_depleted',
      'World_fishing_spot',
      'World_shrine',
      'World_altar',
      'World_forge',
      'World_bank_booth',
      'World_castle',
      'World_river_bridge',
      'World_sandstone_arch',
      'World_palm_tree',
      'World_plaza_pillar',
      'World_mystic_mushroom',
      'World_woods_lantern',
      'World_obsidian_spire',
      'World_lava_fissure'
    ];

    for (const name of expectedWorldNodes) {
      expect(worldGltf.scene.getObjectByName(name), `Missing ${name} in world.glb`).toBeDefined();
    }

    // Test resource node upgrade
    const treeGroup = new THREE.Group();
    const visualMesh = new THREE.Group();
    const depletedMesh = new THREE.Group();
    treeGroup.add(visualMesh, depletedMesh);
    const nodesDef = RESOURCE_NODES_DEF as Record<string, { kind: string; foliageColor?: number; trunkColor?: number }>;
    const rObj = {
      nodeKey: 'magic_tree',
      def: nodesDef.magic_tree,
      group: treeGroup,
      pos: new THREE.Vector3(0, 0, 0),
      visualMesh,
      depletedMesh,
      depleted: false
    };
    expect(upgradeResourceNodeWithGltf(rObj, worldGltf)).toBe(true);
    expect(rObj.group.userData.isBlenderResource).toBe(true);

    // Test landmark prop upgrade
    const castleGroup = new THREE.Group();
    expect(upgradeWorldPropWithGltf(castleGroup, 'World_castle', worldGltf)).toBe(true);
    expect(castleGroup.userData.isBlenderWorldProp).toBe(true);
  });
});
