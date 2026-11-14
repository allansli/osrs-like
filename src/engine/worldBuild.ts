import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadGltfOnce } from './gltf';
import { G } from './context';
import { WORLD_REGIONS, type RegionDef } from '../data/world';
import { ITEMS, type ItemDef } from '../data/items';
import { getTerrainHeight } from '../state/terrain';
import { albedoMaterial, biomeAlbedoId, sealAlbedoUvs } from './textures';
import { addCartoonOutline, facetMaterial } from './materials';
import { loadBlenderWorldTemplate, upgradeWorldPropWithGltf } from './blenderWorld';
import { buildHumanoidRig, LEAN_RIG } from './humanoid';
import { loadBlenderHeroTemplate, upgradeHumanoidRigWithGltf } from './blenderHero';
import { loadBlenderGearTemplate } from './blenderGear';
import { buildCapeVisual, buildHeadVisual, buildWeaponVisual } from './playerGear';

export function buildBiomeLandmarks(): void {
  const sand = albedoMaterial(0xe7c07a, biomeAlbedoId('alkharid-sand'));
  const palm = albedoMaterial(0x4ade80, 'grass');
  const bark = albedoMaterial(0x92400e, 'bark');
  const moss = albedoMaterial(0x4ade80, biomeAlbedoId('korok-moss'));
  const stone = albedoMaterial(0xe5e7eb, biomeAlbedoId('varrock-cobble'));
  const gold = facetMaterial({ color: 0xfacc15 });
  const obsidian = albedoMaterial(0xa8a29e, biomeAlbedoId('peak-volcanic'));
  const lava = facetMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 0.85 });

  function place(builder: () => THREE.Group, x: number, z: number, worldAssetName?: string, overrides: Record<string, unknown> = {}): void {
    const grp = builder();
    grp.position.set(x, getTerrainHeight(x, z), z);
    sealAlbedoUvs(grp);
    addCartoonOutline(grp, 0.038);
    G.scene.add(grp);
    if (worldAssetName) {
      loadBlenderWorldTemplate().then((gltf: GLTF | null) => {
        if (!gltf) return;
        upgradeWorldPropWithGltf(grp, worldAssetName, gltf, { overrides, outlineThickness: 0.035 });
      });
    }
  }

  function sandstoneArch(): THREE.Group {
    const grp = new THREE.Group();
    const left = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.62, 4.2, 12), sand);
    left.position.set(-1.6, 2.1, 0);
    const right = left.clone();
    right.position.x = 1.6;
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.7, 1.1), sand);
    lintel.position.y = 4.3;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), gold);
    cap.position.y = 4.9;
    [left, right, lintel, cap].forEach((mesh: THREE.Mesh) => { mesh.castShadow = true; grp.add(mesh); });
    return grp;
  }

  function palmTree(): THREE.Group {
    const grp = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 3.4, 10), bark);
    trunk.position.y = 1.7;
    trunk.rotation.z = 0.18;
    grp.add(trunk);
    for (let i = 0; i < 6; i++) {
      const frond = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), palm);
      frond.scale.set(1.8, 0.28, 0.7);
      const ang = (i / 6) * Math.PI * 2;
      frond.position.set(Math.cos(ang) * 0.85, 3.35, Math.sin(ang) * 0.85);
      frond.lookAt(0, 2.4, 0);
      grp.add(frond);
    }
    const dates = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), gold);
    dates.position.y = 2.7;
    grp.add(dates);
    return grp;
  }

  function plazaPillar(): THREE.Group {
    const grp = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 5.2, 14), stone);
    shaft.position.y = 2.6;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.86, 0.4, 14), stone);
    foot.position.y = 0.2;
    const crown = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.35, 1.15), gold);
    crown.position.y = 5.35;
    [shaft, foot, crown].forEach((mesh: THREE.Mesh) => { mesh.castShadow = true; grp.add(mesh); });
    return grp;
  }

  function mysticMushroom(color: number): THREE.Group {
    const grp = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 1.3, 12), facetMaterial({ color: 0xf8fafc }));
    stem.position.y = 0.65;
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
      facetMaterial({ color, emissive: color, emissiveIntensity: 0.45 })
    );
    cap.position.y = 1.35;
    grp.add(stem, cap);
    return grp;
  }

  function woodsLantern(): THREE.Group {
    const grp = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.2, 8), moss);
    post.position.y = 1.1;
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 10),
      facetMaterial({ color: 0xfde047, emissive: 0xfacc15, emissiveIntensity: 0.8 })
    );
    lamp.position.y = 2.3;
    grp.add(post, lamp);
    return grp;
  }

  function obsidianSpire(): THREE.Group {
    const grp = new THREE.Group();
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.85, 6.4, 7), obsidian);
    spire.position.y = 3.2;
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), lava);
    glow.position.y = 5.6;
    grp.add(spire, glow);
    return grp;
  }

  function lavaFissure(): THREE.Group {
    const grp = new THREE.Group();
    const crack = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 0.35), lava);
    crack.position.y = 0.08;
    crack.rotation.y = 0.4;
    const crackB = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.22), lava);
    crackB.position.set(0.4, 0.09, 0.45);
    crackB.rotation.y = -0.8;
    grp.add(crack, crackB);
    return grp;
  }

  place(sandstoneArch, 80, 82, 'World_sandstone_arch');
  place(palmTree, 58, 58, 'World_palm_tree');
  place(palmTree, 74, 52, 'World_palm_tree');
  place(plazaPillar, 70, -16, 'World_plaza_pillar');
  place(plazaPillar, 86, -24, 'World_plaza_pillar');
  place(plazaPillar, 78, -30, 'World_plaza_pillar');
  place(() => mysticMushroom(0xa855f7), -66, -22, 'World_mystic_mushroom', { mushroomHex: 0xa855f7 });
  place(() => mysticMushroom(0x22d3ee), -84, -26, 'World_mystic_mushroom', { mushroomHex: 0x22d3ee });
  place(woodsLantern, -72, -38, 'World_woods_lantern');
  place(woodsLantern, -90, -34, 'World_woods_lantern');
  place(obsidianSpire, -58, 62, 'World_obsidian_spire');
  place(obsidianSpire, -66, 90, 'World_obsidian_spire');
  place(lavaFissure, -74, 70, 'World_lava_fissure');
}

export function buildAllCitiesAndLandmarks(): void {
  WORLD_REGIONS.forEach((reg: RegionDef) => {
    const sx = reg.x;
    const sz = reg.z - 6;
    const sy = getTerrainHeight(sx, sz);
    const shrineGroup = new THREE.Group();
    shrineGroup.position.set(sx, sy, sz);
    const stone = albedoMaterial(0x525c66, 'stone');
    const slate = albedoMaterial(0x2d333b, 'slate');
    const stepA = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.28, 2.6), slate);
    stepA.position.y = 0.14;
    const stepB = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.26, 1.85), stone);
    stepB.position.y = 0.4;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.58, 2.15, 14), stone);
    pillar.position.y = 1.58;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.16, 0.78), slate);
    cap.position.y = 2.72;
    const rune = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.34, 0),
      facetMaterial({ color: 0x5d8096, emissive: 0x2d4857, emissiveIntensity: 0.45, flatShading: true })
    );
    rune.position.y = 3.15;
    [stepA, stepB, pillar, cap, rune].forEach((mesh: THREE.Mesh) => {
      mesh.castShadow = true;
      shrineGroup.add(mesh);
    });

    const uData = {
      type: 'interactive',
      action: 'worldmap',
      name: `${reg.name} Shrine (Teleport)`,
      interactRadius: 4.2
    };
    shrineGroup.userData = uData;
    pillar.userData = uData;
    rune.userData = uData;
    G.worldInteractiveObjects.push(pillar, rune);
    addCartoonOutline(shrineGroup, 0.038);
    G.scene.add(shrineGroup);
    loadBlenderWorldTemplate().then((gltf: GLTF | null) => {
      if (!gltf) return;
      upgradeWorldPropWithGltf(shrineGroup, 'World_shrine', gltf, {
        interactiveObjectsList: G.worldInteractiveObjects,
        outlineThickness: 0.035
      });
    });
  });

  // 2. Sculpted Lumbridge Castle Keep & Cylindrical Battlement Towers
  createCastleStructure(0, -25);
  createCastleGuard(-2.4, -16.5, 'Lumbridge Castle Guard', 0);
  createCastleGuard(2.4, -16.5, 'Lumbridge Castle Guard', 0);

  // BlendSwap #6679 Props: Barrels, Crates, Cabbage & Apple Boxes, Grain Sacks
  spawnWorldProp('World_barrel', -3.6, -17.8, 0.4);
  spawnWorldProp('World_barrel', 3.6, -17.8, -0.3);
  spawnWorldProp('World_crate', -4.8, -18.4, 0.2);
  spawnWorldProp('World_crate', 4.8, -18.4, -0.5);
  spawnWorldProp('World_box_cabbage', -3.5, -22.0, 0.1);
  spawnWorldProp('World_box_apples', 3.5, -22.0, -0.2);
  spawnWorldProp('World_bag_grain', -5.0, -23.5, 0.3);
  spawnWorldProp('World_bag_closed', 5.0, -23.5, -0.4);

  spawnWorldProp('World_barrel', 12.2, -3.2, 0.2);
  spawnWorldProp('World_crate', 12.5, -4.5, -0.3);

  spawnWorldProp('World_bag_grain', -0.5, 5.5, 0.2);
  spawnWorldProp('World_barrel', 4.2, 5.2, -0.2);

  // 3. Sculpted Marble Altars
  createPrayerAltar(-10, -4, 'Sacred Altar of Lumbridge');
  createPrayerAltar(72, -26, 'Varrock Cathedral Altar');

  // 4. Sculpted Blacksmith Anvil, Domed Furnace & Cooking Range
  createForgeStation(10, -4, 'Lumbridge Forge & Range');
  createForgeStation(86, -16, 'Varrock Royal Blacksmith');

  // 5. Grand Emporium Merchants
  createMerchantNPC(-7, 5, 'Shopkeeper Bob (Grand Emporium)', 0x1d4ed8);
  createMerchantNPC(78, -12, 'Varrock Trade Master', 0xd97706);
  createMerchantNPC(64, 62, 'Al-Kharid Bazaar Merchant', 0xb91c1c);
  createBankBooth(2.2, 4.2);
  createSlayerMaster(5.5, 8.5);
  buildBiomeLandmarks();
}

export function createCastleStructure(cx: number, cz: number): void {
  const grp = new THREE.Group();
  const y = getTerrainHeight(cx, cz);
  grp.position.set(cx, y, cz);
  const stoneMat = albedoMaterial(0x525c66, 'stone');
  const roofMat = albedoMaterial(0x2d333b, 'slate');
  const goldMat = facetMaterial({ color: 0x8f7d4e });
  const timberMat = albedoMaterial(0x42352a, 'wood');
  function box(w: number, h: number, d: number, mat: THREE.Material, x: number, yy: number, z: number): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, yy, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    grp.add(mesh);
    return mesh;
  }
  function crenelate(x0: number, z0: number, x1: number, z1: number, yTop: number): void {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(2, Math.floor(len / 1.15));
    for (let i = 0; i < n; i++) {
      if (i % 2 === 1) continue;
      const t = n === 1 ? 0.5 : i / (n - 1);
      box(0.7, 0.55, 0.7, stoneMat, x0 + (x1 - x0) * t, yTop, z0 + (z1 - z0) * t);
    }
  }
  box(7.6, 8.2, 6.2, stoneMat, 0, 4.1, -3.5);
  const keepRoof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 3.2, 4), roofMat);
  keepRoof.position.set(0, 9.6, -3.5);
  keepRoof.rotation.y = Math.PI / 4;
  keepRoof.castShadow = true;
  grp.add(keepRoof);
  box(19.2, 5.2, 1.4, stoneMat, 0, 2.6, -9);
  crenelate(-9, -9, 9, -9, 5.4);
  box(7.4, 5.2, 1.4, stoneMat, -5.4, 2.6, 8);
  box(7.4, 5.2, 1.4, stoneMat, 5.4, 2.6, 8);
  crenelate(-9.1, 8, -1.7, 8, 5.4);
  crenelate(1.7, 8, 9.1, 8, 5.4);
  box(1.4, 5.2, 17, stoneMat, -9, 2.6, -0.5);
  box(1.4, 5.2, 17, stoneMat, 9, 2.6, -0.5);
  crenelate(-9, -9, -9, 8, 5.4);
  crenelate(9, -9, 9, 8, 5.4);
  ([[-9, -9], [9, -9], [-9, 8], [9, 8]] as const).forEach(([tx, tz]) => {
    box(3.2, 8.4, 3.2, stoneMat, tx, 4.2, tz);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(2.1, 3.4, 4), roofMat);
    spire.position.set(tx, 10.0, tz);
    spire.rotation.y = Math.PI / 4;
    spire.castShadow = true;
    grp.add(spire);
    const finial = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.55, 0.35), goldMat);
    finial.position.set(tx, 12.0, tz);
    grp.add(finial);
  });
  box(3.2, 0.45, 1.5, timberMat, 0, 4.6, 8);
  sealAlbedoUvs(grp);
  addCartoonOutline(grp, 0.03);
  G.scene.add(grp);
  loadBlenderWorldTemplate().then((gltf: GLTF | null) => {
    if (!gltf) return;
    upgradeWorldPropWithGltf(grp, 'World_castle', gltf, { outlineThickness: 0.03 });
  });
}

export function createPrayerAltar(x: number, z: number, name: string): void {
  const y = getTerrainHeight(x, z);
  const grp = new THREE.Group();
  grp.position.set(x, y, z);

  const marbleMat = albedoMaterial(0x6b7280, 'stone');
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.85, 1.15), marbleMat);
  base.position.y = 0.42;
  base.castShadow = true;
  grp.add(base);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.18, 1.4), albedoMaterial(0x525c66, 'stone'));
  slab.position.y = 0.92;
  grp.add(slab);
  const goldTrim = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.08, 0.12), facetMaterial({ color: 0x8f7d4e }));
  goldTrim.position.set(0, 0.7, 0.58);
  grp.add(goldTrim);

  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.32, 0),
    facetMaterial({ color: 0x5d8096, emissive: 0x2d4857, emissiveIntensity: 0.35, flatShading: true })
  );
  crystal.position.y = 1.45;
  grp.add(crystal);

  const uData = { type: 'interactive', action: 'altar', name, interactRadius: 4.0 };
  grp.userData = uData;
  base.userData = uData;
  crystal.userData = uData;
  G.worldInteractiveObjects.push(base, crystal);
  addCartoonOutline(grp, 0.038);
  G.scene.add(grp);
  G.npcList.push({ pos: grp.position, name, color: '#38bdf8', yOffset: 3.4 });
  loadBlenderWorldTemplate().then((gltf: GLTF | null) => {
    if (!gltf) return;
    upgradeWorldPropWithGltf(grp, 'World_altar', gltf, {
      interactiveObjectsList: G.worldInteractiveObjects,
      outlineThickness: 0.035
    });
  });
}

export function createForgeStation(x: number, z: number, name: string): void {
  const y = getTerrainHeight(x, z);
  const grp = new THREE.Group();
  grp.position.set(x, y, z);

  // Sculpted Blacksmith Horn Anvil (Lathe + Extruded Bevel Top)
  const ironMat = albedoMaterial(0x334155, 'iron');
  const anvilBase = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.82, 0.75, 6), ironMat);
  anvilBase.position.set(-1.2, 0.38, 0);
  anvilBase.castShadow = true;
  grp.add(anvilBase);

  const anvilTop = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.5, 6), ironMat);
  anvilTop.rotation.z = Math.PI / 2;
  anvilTop.position.set(-1.2, 0.88, 0);
  anvilTop.castShadow = true;
  grp.add(anvilTop);

  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.85, 5), ironMat);
  horn.rotation.z = Math.PI / 2;
  horn.position.set(-2.25, 0.88, 0);
  horn.castShadow = true;
  grp.add(horn);

  const furnace = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 2.4, 1.5),
    albedoMaterial(0x92400e, 'wood')
  );
  furnace.position.set(1.3, 1.2, 0);
  furnace.castShadow = true;
  grp.add(furnace);

  const fireCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.78, 7, 6),
    facetMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 0.95 })
  );
  fireCore.position.set(1.3, 0.85, 1.0);
  grp.add(fireCore);

  const uData = { type: 'interactive', action: 'forge', name, interactRadius: 4.2 };
  grp.userData = uData;
  anvilTop.userData = uData;
  furnace.userData = uData;
  G.worldInteractiveObjects.push(anvilTop, furnace);
  addCartoonOutline(grp, 0.038);
  G.scene.add(grp);
  G.npcList.push({ pos: grp.position, name, color: '#ff981f', yOffset: 3.5 });
  loadBlenderWorldTemplate().then((gltf: GLTF | null) => {
    if (!gltf) return;
    upgradeWorldPropWithGltf(grp, 'World_forge', gltf, {
      interactiveObjectsList: G.worldInteractiveObjects,
      outlineThickness: 0.035
    });
  });
}

export function createBankBooth(x: number, z: number): void {
  const y = getTerrainHeight(x, z);
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  const wood = albedoMaterial(0x6b4423, 'wood');
  const gold = facetMaterial({ color: 0xfacc15 });
  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.05, 0.7), wood);
  counter.position.set(0, 0.55, 0.4);
  counter.castShadow = true;
  grp.add(counter);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.16, 1.05), gold);
  lintel.position.set(0, 1.95, 0.35);
  grp.add(lintel);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx2d = canvas.getContext('2d')!;
  ctx2d.fillStyle = '#1d1812';
  ctx2d.fillRect(0, 0, 256, 64);
  ctx2d.fillStyle = '#fde047';
  ctx2d.font = '700 36px sans-serif';
  ctx2d.textAlign = 'center';
  ctx2d.fillText('BANK', 128, 44);
  const tex = new THREE.CanvasTexture(canvas);
  if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: tex }));
  sign.position.set(0, 1.55, 0.82);
  sign.userData.noOutline = true;
  grp.add(sign);
  const rig = buildHumanoidRig(0x1e3a8a, 0xfacc15, 0x334155, 1);
  rig.group.position.set(0, 0, -0.2);
  grp.add(rig.group);
  const uData = { type: 'interactive', action: 'bank', name: 'Lumbridge Bank', interactRadius: 4.2 };
  grp.userData = uData;
  rig.hitbox.userData = uData;
  counter.userData = uData;
  G.worldInteractiveObjects.push(rig.hitbox, counter);
  addCartoonOutline(counter, 0.038);
  addCartoonOutline(lintel, 0.038);
  G.scene.add(grp);
  G.npcList.push({ pos: grp.position, name: 'Lumbridge Bank', color: '#fde047', yOffset: 2.6 });
  loadBlenderHeroTemplate().then((gltf: GLTF | null) => {
    if (!gltf) return;
    const anim = upgradeHumanoidRigWithGltf(rig, gltf, 0x1e3a8a, 0xfacc15, 0x334155, { isPlayer: false });
    if (anim) G.npcAnimatorsList.push(anim);
  });
  loadBlenderWorldTemplate().then((gltf: GLTF | null) => {
    if (!gltf) return;
    upgradeWorldPropWithGltf(grp, 'World_bank_booth', gltf, {
      keepChildren: (ch: THREE.Object3D) => ch === sign || ch === rig.group,
      interactiveObjectsList: G.worldInteractiveObjects,
      outlineThickness: 0.035
    });
  });
}

export function createSlayerMaster(x: number, z: number): void {
  const y = getTerrainHeight(x, z);
  const rig = buildHumanoidRig(0x4c1d95, 0x1c1917, 0x111827, 1.05);
  rig.group.position.set(x, y, z);
  let vannakaWep: THREE.Group | null = null;
  let vannakaCape: THREE.Group | null = null;
  const attachVannakaGear = (): void => {
    if (vannakaWep && vannakaWep.parent) vannakaWep.parent.remove(vannakaWep);
    if (vannakaCape && vannakaCape.parent) vannakaCape.parent.remove(vannakaCape);
    const wepVis = buildWeaponVisual(ITEMS.godsword || ITEMS.rune_2h || ({ id: 'godsword', iconKind: 'greatsword', slot: 'weapon', color: 0xfacc15, trim: 0xfde047 } as unknown as ItemDef));
    if (rig.rightElbowPivot) {
      wepVis.group.position.set(0.19, -0.32, 0.08);
      wepVis.group.rotation.set(-0.2, 0.0, 0.1);
      rig.rightElbowPivot.add(wepVis.group);
    } else {
      wepVis.group.position.set(0, LEAN_RIG.handY, -0.08);
      rig.rightArmPivot.add(wepVis.group);
    }
    vannakaWep = wepVis.group;
    addCartoonOutline(vannakaWep, 0.02);

    const capeVis = buildCapeVisual({ id: 'slayer_cape', slot: 'cape', color: 0x4c1d95, trim: 0xfacc15 } as unknown as ItemDef);
    if (rig.group.userData.isBlenderHero || rig.leftElbowPivot) {
      capeVis.position.set(0, 0.22, 0.02);
    } else {
      capeVis.position.set(0, 0.285, 0.175);
    }
    rig.torso.add(capeVis);
    vannakaCape = capeVis;
    addCartoonOutline(vannakaCape, 0.02);
  };
  attachVannakaGear();
  const uData = { type: 'interactive', action: 'slayer', name: 'Slayer Master Vannaka', interactRadius: 4.0 };
  rig.group.userData = uData;
  rig.hitbox.userData = uData;
  G.worldInteractiveObjects.push(rig.hitbox);
  G.scene.add(rig.group);
  G.npcList.push({ pos: rig.group.position, name: 'Slayer Master Vannaka', color: '#c084fc', yOffset: 2.9 });
  Promise.all([loadBlenderHeroTemplate(), loadBlenderGearTemplate()]).then(([heroGltf]) => {
    if (heroGltf) {
      const anim = upgradeHumanoidRigWithGltf(rig, heroGltf, 0x4c1d95, 0x1c1917, 0x111827, { isPlayer: false });
      if (anim) G.npcAnimatorsList.push(anim);
    }
    attachVannakaGear();
  });
}

export function createMerchantNPC(x: number, z: number, name: string, tunicColor: number): void {
  const y = getTerrainHeight(x, z);
  const rig = buildHumanoidRig(tunicColor, 0xfacc15, 0x334155, 1.02);
  rig.group.position.set(x, y, z);
  const uData = { type: 'interactive', action: 'shop', name, interactRadius: 4.0 };
  rig.group.userData = uData;
  rig.hitbox.userData = uData;
  G.worldInteractiveObjects.push(rig.hitbox);
  G.scene.add(rig.group);
  G.npcList.push({ pos: rig.group.position, name, color: '#ffe642', yOffset: 2.85 });
  Promise.all([loadBlenderHeroTemplate(), loadBlenderGearTemplate()]).then(([heroGltf]) => {
    if (heroGltf) {
      const anim = upgradeHumanoidRigWithGltf(rig, heroGltf, tunicColor, 0xfacc15, 0x334155, { isPlayer: false });
      if (anim) G.npcAnimatorsList.push(anim);
    }
    const hatItem = (name.includes('Varrock')
      ? { id: 'wizard_hat', slot: 'head', iconKind: 'hat', color: tunicColor, trim: 0xfacc15 }
      : name.includes('Al-Kharid')
      ? { id: 'hood', slot: 'head', iconKind: 'hood', color: tunicColor, trim: 0xfacc15 }
      : { id: 'circlet', slot: 'head', iconKind: 'circlet', color: 0x38bdf8, trim: 0xfacc15 }) as unknown as ItemDef;
    const hat = buildHeadVisual(hatItem);
    if (rig.leftElbowPivot || rig.group.userData.isBlenderHero) {
      hat.scale.set(0.74, 0.74, 0.74);
      hat.position.set(0, -0.16, 0.01);
    }
    rig.headGroup.add(hat);
    addCartoonOutline(hat, 0.018);
  });
}

export function loadBlenderGuardTemplate(url = '/models/guard.glb'): Promise<GLTF | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }
  return loadGltfOnce(url);
}

export function createCastleGuard(x: number, z: number, name: string, rotY = 0): void {
  const y = getTerrainHeight(x, z);
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  grp.rotation.y = rotY;

  const uData = {
    type: 'interactive',
    action: 'dialogue',
    name,
    dialogue: 'Halt! Welcome to Lumbridge Castle, adventurer. Keep your weapons sheathed within the courtyard.',
    interactRadius: 3.5
  };
  grp.userData = uData;

  const hitbox = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 1.85, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitbox.position.y = 0.92;
  hitbox.userData = uData;
  grp.add(hitbox);
  G.worldInteractiveObjects.push(hitbox);
  G.scene.add(grp);
  G.npcList.push({ pos: grp.position, name, color: '#94a3b8', yOffset: 2.5 });

  loadBlenderGuardTemplate().then((gltf: GLTF | null) => {
    if (!gltf) return;
    const cloned = gltf.scene.clone(true);
    cloned.position.set(0, 0, 0);
    cloned.traverse((obj: THREE.Object3D) => {
      const m = obj as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = false;
        m.userData = { ...m.userData, ...uData };
      }
    });
    grp.add(cloned);
    addCartoonOutline(cloned, 0.024);
  });
}

export function spawnWorldProp(assetName: string, x: number, z: number, rotY = 0, scale = 1.0): void {
  const y = getTerrainHeight(x, z);
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  grp.rotation.y = rotY;
  if (scale !== 1.0) grp.scale.set(scale, scale, scale);
  G.scene.add(grp);

  loadBlenderWorldTemplate().then((gltf: GLTF | null) => {
    if (!gltf) return;
    const node = gltf.scene.getObjectByName(assetName);
    if (!node) return;
    const cloned = node.clone(true);
    cloned.position.set(0, 0, 0);
    cloned.traverse((obj: THREE.Object3D) => {
      const m = obj as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    grp.add(cloned);
    sealAlbedoUvs(grp);
    addCartoonOutline(grp, 0.028);
  });
}
