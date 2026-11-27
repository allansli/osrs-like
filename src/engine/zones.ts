import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { G, player, type MonsterEntity, type ResourceNodeEntity } from './context';
import { disposeObject3D } from './dispose';
import { albedoMaterial, sealAlbedoUvs } from './textures';
import { addCartoonOutline, facetMaterial } from './materials';
import { AIR } from './atmosphere';
import { setSkyVisible } from './sky';
import { applyWorldMaterials, loadBlenderWorldTemplate } from './blenderWorld';
import { buildWalkGrid, type WalkGrid } from '../state/pathfind';
import { runStep, zoneWalk, type DungeonRun } from '../state/dungeon';
import { DUNGEONS, type Dungeon } from '../data/dungeons';
import { getTerrainHeight } from '../state/terrain';
import { AGGRO_GRACE_MS, isDown } from '../state/monsterAi';
import { spawnMonster, spawnResourceNode } from './spawns';

const ZONE_FOG_COLOR = 0x0f0c0a;
const ZONE_FOG_DENSITY = 0.025;

// Set by enterZone and read only while G.zone is set.
let overworldGrid = null as unknown as WalkGrid;
let zoneFloor = null as unknown as THREE.Mesh;
let zoneMonsters = new Set<MonsterEntity>();
let zoneNodes = new Set<ResourceNodeEntity>();
let zoneInteractiveObjects: THREE.Object3D[] = [];

export const isZoneMonster = (m: MonsterEntity): boolean => zoneMonsters.has(m);
/** A zone's nodes are gathered once a run (actions.ts never sets a respawn timer for them). */
export const isZoneNode = (n: ResourceNodeEntity): boolean => zoneNodes.has(n);

/** Every frame while in a zone, after updateAir: the shader fog (and, through updateSky, scene.fog) reads these uniforms. */
export function applyZoneAir(): void {
  AIR.uAirColor.value.setHex(ZONE_FOG_COLOR);
  AIR.uAirSunColor.value.copy(AIR.uAirColor.value);
  AIR.uFogHeightFalloff.value = 0;
  AIR.uFogDensity.value = ZONE_FOG_DENSITY;
}

function isInsideOtherRoom(
  allRooms: [number, number, number, number][],
  currentIdx: number,
  x: number,
  z: number
): boolean {
  for (let i = 0; i < allRooms.length; i++) {
    if (i === currentIdx) continue;
    const [x0, z0, x1, z1] = allRooms[i];
    if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return true;
  }
  return false;
}

function computeWallSegments(roomsRecord: Record<string, [number, number, number, number]>): [number, number, number, number][] {
  const rooms = Object.values(roomsRecord);
  const segments: [number, number, number, number][] = [];

  for (let idx = 0; idx < rooms.length; idx++) {
    const [rx0, rz0, rx1, rz1] = rooms[idx];

    // North edge: z = rz0, x from rx0 to rx1
    let segStart: number | null = null;
    for (let x = rx0; x < rx1; x++) {
      const unshared = !isInsideOtherRoom(rooms, idx, x + 0.5, rz0 - 0.5);
      if (unshared) {
        if (segStart === null) segStart = x;
      } else {
        if (segStart !== null) {
          segments.push([segStart, rz0, x, rz0]);
          segStart = null;
        }
      }
    }
    if (segStart !== null) {
      segments.push([segStart, rz0, rx1, rz0]);
    }

    // South edge: z = rz1, x from rx0 to rx1
    segStart = null;
    for (let x = rx0; x < rx1; x++) {
      const unshared = !isInsideOtherRoom(rooms, idx, x + 0.5, rz1 + 0.5);
      if (unshared) {
        if (segStart === null) segStart = x;
      } else {
        if (segStart !== null) {
          segments.push([segStart, rz1, x, rz1]);
          segStart = null;
        }
      }
    }
    if (segStart !== null) {
      segments.push([segStart, rz1, rx1, rz1]);
    }

    // West edge: x = rx0, z from rz0 to rz1
    segStart = null;
    for (let z = rz0; z < rz1; z++) {
      const unshared = !isInsideOtherRoom(rooms, idx, rx0 - 0.5, z + 0.5);
      if (unshared) {
        if (segStart === null) segStart = z;
      } else {
        if (segStart !== null) {
          segments.push([rx0, segStart, rx0, z]);
          segStart = null;
        }
      }
    }
    if (segStart !== null) {
      segments.push([rx0, segStart, rx0, rz1]);
    }

    // East edge: x = rx1, z from rz0 to rz1
    segStart = null;
    for (let z = rz0; z < rz1; z++) {
      const unshared = !isInsideOtherRoom(rooms, idx, rx1 + 0.5, z + 0.5);
      if (unshared) {
        if (segStart === null) segStart = z;
      } else {
        if (segStart !== null) {
          segments.push([rx1, segStart, rx1, z]);
          segStart = null;
        }
      }
    }
    if (segStart !== null) {
      segments.push([rx1, segStart, rx1, rz1]);
    }
  }

  return segments;
}

export function enterZone(def: Dungeon): void {
  if (G.zone) {
    leaveZone();
  }

  const [ox, oz] = def.origin;
  const group = new THREE.Group();
  const stoneMat = albedoMaterial(0x525c66, 'stone', { shade: 'cut' });

  // 1. One merged floor mesh from the room rectangles
  const floorGeos: THREE.BufferGeometry[] = [];
  for (const [rx0, rz0, rx1, rz1] of Object.values(def.rooms)) {
    const w = rx1 - rx0;
    const d = rz1 - rz0;
    const geo = new THREE.PlaneGeometry(w, d);
    geo.rotateX(-Math.PI / 2);
    geo.translate(ox + (rx0 + rx1) / 2, 0, oz + (rz0 + rz1) / 2);
    floorGeos.push(geo);
  }
  const floorGeo = mergeGeometries(floorGeos, false);
  floorGeo.computeVertexNormals();
  const floorMesh = new THREE.Mesh(floorGeo, stoneMat);
  floorMesh.receiveShadow = true;
  floorMesh.userData = { type: 'ground' };
  group.add(floorMesh);

  // 2. One merged wall mesh (walls 4 units high along every room edge not shared with another room)
  const wallSegments = computeWallSegments(def.rooms);
  const wallGeos: THREE.BufferGeometry[] = [];
  for (const [x0, z0, x1, z1] of wallSegments) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    if (len < 0.001) continue;
    const geo = new THREE.PlaneGeometry(len, 4);
    geo.translate(len / 2, 2, 0);
    geo.rotateY(-Math.atan2(dz, dx));
    geo.translate(ox + x0, 0, oz + z0);
    wallGeos.push(geo);
  }
  if (wallGeos.length > 0) {
    const wallGeo = mergeGeometries(wallGeos, false);
    wallGeo.computeVertexNormals();
    const wallMesh = new THREE.Mesh(wallGeo, stoneMat);
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    group.add(wallMesh);
  }

  // 3. Gate slabs
  for (const gate of def.gates) {
    const [gx0, gz0, gx1, gz1] = gate.rect;
    const slabGeo = new THREE.BoxGeometry(gx1 - gx0, 4, gz1 - gz0);
    const slab = new THREE.Mesh(slabGeo, stoneMat);
    slab.position.set(ox + (gx0 + gx1) / 2, 2, oz + (gz0 + gz1) / 2);
    slab.castShadow = true;
    slab.receiveShadow = true;
    slab.userData = { gateId: gate.id };
    group.add(slab);
  }

  // The stone tile is world-projected like the painted stone, not stretched 0..1 across a room.
  sealAlbedoUvs(group);

  // 4. Props from the optional props list (existing world.glb nodes); a bad node name or a missing glb throws
  const props = def.props;
  if (props) {
    loadBlenderWorldTemplate().then((gltf) => {
      if (G.zone?.group !== group) return; // left the zone while the glb loaded
      if (!gltf) throw new Error(`Zone "${def.id}" lists props but world.glb did not load`);
      for (const prop of props) {
        const template = gltf.scene.getObjectByName(prop.node);
        if (!template) throw new Error(`Zone "${def.id}" prop node "${prop.node}" is not in world.glb`);
        const clone = template.clone(true);
        // clone() shares geometry with the template; leaveZone disposes this group, so give it its own
        clone.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) m.geometry = m.geometry.clone();
        });
        clone.position.set(ox + prop.x, 0, oz + prop.z);
        if (prop.scale) clone.scale.setScalar(prop.scale);
        if (prop.rotY) clone.rotation.y = prop.rotY;
        applyWorldMaterials(clone);
        sealAlbedoUvs(clone);
        group.add(clone);
      }
    });
  }

  // 5. Grid
  overworldGrid = G.walkGrid;
  const walk = zoneWalk(def, []);
  const zoneGrid = buildWalkGrid(walk, ox, oz, def.size);
  G.walkGrid = zoneGrid;

  // 6. Ground picking registration
  G.groundMesh = floorMesh;
  G.worldInteractiveObjects.push(floorMesh);
  zoneFloor = floorMesh;

  // 7. Monsters, resource nodes, chest, exit door
  zoneMonsters = new Set();
  zoneNodes = new Set();
  zoneInteractiveObjects = [];

  for (const camp of def.camps) {
    for (const m of camp.members) {
      const idxBefore = G.monstersList.length;
      spawnMonster(m.type, ox + m.x, oz + m.z, {
        campId: `${def.id}:${camp.id}`,
        wander: m.wander,
        respawn: false
      });
      if (G.monstersList.length === idxBefore) throw new Error(`enterZone: unknown monster type "${m.type}" in ${def.id}`);
      zoneMonsters.add(G.monstersList[G.monstersList.length - 1]);
    }
  }

  for (const n of def.nodes) {
    const idxBefore = G.resourceNodesList.length;
    spawnResourceNode(n.type, ox + n.x, oz + n.z);
    if (G.resourceNodesList.length === idxBefore) throw new Error(`enterZone: unknown node type "${n.type}" in ${def.id}`);
    zoneNodes.add(G.resourceNodesList[G.resourceNodesList.length - 1]);
  }

  // Chest interactive object
  const chestGrp = new THREE.Group();
  chestGrp.position.set(ox + def.chest[0], 0, oz + def.chest[1]);
  const chestMat = albedoMaterial(0x854d0e, 'wood', { shade: 'cut' });
  const trimMat = facetMaterial({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 0.3, shade: 'cut' });
  const chestBox = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.8), chestMat);
  chestBox.position.y = 0.4;
  chestBox.castShadow = true;
  chestBox.receiveShadow = true;
  const chestTrim = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.2, 0.84), trimMat);
  chestTrim.position.y = 0.4;
  chestGrp.add(chestBox, chestTrim);
  sealAlbedoUvs(chestGrp);
  addCartoonOutline(chestGrp, 0.035);

  const chestUData = {
    type: 'interactive',
    action: 'chest',
    name: 'Treasure Chest',
    interactRadius: 3.5
  };
  chestGrp.userData = chestUData;
  chestBox.userData = chestUData;
  group.add(chestGrp);
  G.worldInteractiveObjects.push(chestBox);
  zoneInteractiveObjects.push(chestBox);

  // Exit doorway in entry room
  const exitDoorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.8, 0.4), stoneMat);
  exitDoorMesh.position.set(ox + def.entry[0], 1.4, oz + def.entry[1] - 4);
  exitDoorMesh.castShadow = true;
  const exitDoorUData = {
    type: 'interactive',
    action: 'door',
    name: 'Doorway (Leave)',
    interactRadius: 3.5
  };
  exitDoorMesh.userData = exitDoorUData;
  group.add(exitDoorMesh);
  G.worldInteractiveObjects.push(exitDoorMesh);
  zoneInteractiveObjects.push(exitDoorMesh);

  // 8. Move hero to entry with aggression grace
  player.pos.set(ox + def.entry[0], 0, oz + def.entry[1]);
  player.waypoints.length = 0;
  player.targetEntity = null;
  player.currentSpeed = 0;
  G.aggroGraceUntil = performance.now() + AGGRO_GRACE_MS;

  // 9. Hide sky dome (the fog is applyZoneAir's, called from loop.ts) and horizon apron
  setSkyVisible(false);

  // 10. Run state, add to scene and set G.zone
  const run: DungeonRun = {
    id: def.id,
    startedAt: Date.now(),
    deadCamps: [],
    bossDead: false,
    chestOpen: false
  };

  G.scene.add(group);
  G.zone = { def, run, grid: zoneGrid, group };
}

export function leaveZone(): void {
  if (!G.zone) return;
  const { def, group } = G.zone;

  for (const m of zoneMonsters) {
    const idx = G.monstersList.indexOf(m);
    if (idx >= 0) G.monstersList.splice(idx, 1);
    const hIdx = G.worldInteractiveObjects.indexOf(m.rig.hitbox);
    if (hIdx >= 0) G.worldInteractiveObjects.splice(hIdx, 1);
    m.labelEl.remove();
    G.scene.remove(m.rig.group);
    disposeObject3D(m.rig.group);
  }
  zoneMonsters.clear();

  for (const r of zoneNodes) {
    const idx = G.resourceNodesList.indexOf(r);
    if (idx >= 0) G.resourceNodesList.splice(idx, 1);
    const colliders = r.group.children.filter((c) => c.userData?.isCollider || c.userData?.type === 'resource');
    for (const c of colliders) {
      const hIdx = G.worldInteractiveObjects.indexOf(c);
      if (hIdx >= 0) G.worldInteractiveObjects.splice(hIdx, 1);
    }
    const rIdx = G.worldInteractiveObjects.indexOf(r.group);
    if (rIdx >= 0) G.worldInteractiveObjects.splice(rIdx, 1);
    G.scene.remove(r.group);
    disposeObject3D(r.group);
  }
  zoneNodes.clear();

  for (const obj of zoneInteractiveObjects) {
    const idx = G.worldInteractiveObjects.indexOf(obj);
    if (idx >= 0) G.worldInteractiveObjects.splice(idx, 1);
  }
  zoneInteractiveObjects = [];

  G.scene.remove(group);
  disposeObject3D(group);

  G.worldInteractiveObjects.splice(G.worldInteractiveObjects.indexOf(zoneFloor), 1);
  G.groundMesh = G.terrainMesh;
  G.walkGrid = overworldGrid;

  setSkyVisible(true);

  player.pos.set(def.door.x, getTerrainHeight(def.door.x, def.door.z), def.door.z);
  player.waypoints.length = 0;
  player.targetEntity = null;
  player.currentSpeed = 0;

  G.zone = null;
}

export function handleZoneMonsterDied(m: MonsterEntity): void {
  const def = G.zone!.def;
  const localCampId = m.logic.campId!.slice(`${def.id}:`.length);

  const members = G.monstersList.filter((other) => other.logic.campId === m.logic.campId);
  const allDead = members.every((other) => isDown(other.logic) || other === m);
  if (!allDead) return;

  const opened = runStep(G.zone!.run!, { campDead: localCampId });
  if (opened.length > 0) {
    const toRemove: THREE.Object3D[] = [];
    G.zone!.group.traverse((child) => {
      if (child.userData?.gateId && opened.includes(child.userData.gateId)) {
        toRemove.push(child);
      }
    });
    for (const slab of toRemove) {
      G.zone!.group.remove(slab);
      disposeObject3D(slab);
    }

    const openGates = def.gates
      .filter((g) => g.opensWhen.every((cId) => G.zone!.run!.deadCamps.includes(cId)))
      .map((g) => g.id);
    const newWalk = zoneWalk(def, openGates);
    const newGrid = buildWalkGrid(newWalk, def.origin[0], def.origin[1], def.size);
    G.zone!.grid = newGrid;
    G.walkGrid = newGrid;
  }
}

export function enterZoneById(id: string): void {
  const def = DUNGEONS.find((d) => d.id === id);
  if (!def) throw new Error(`Unknown zone id: "${id}"`);
  enterZone(def);
}
