import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { G, camState, player, type MonsterEntity, type ResourceNodeEntity } from './context';
import { disposeObject3D } from './dispose';
import { albedoMaterial, assignGroundUvs, biomeAlbedoId, GROUND_REPEAT, loadAlbedo, sealAlbedoUvs } from './textures';
import { addCartoonOutline, facetMaterial } from './materials';
import { AIR } from './atmosphere';
import { setSkyVisible } from './sky';
import { setCarpetVisible } from './flora';
import { setCaveWeather, setWeatherParticlesVisible } from './particles';
import { applyWorldMaterials, loadBlenderWorldTemplate } from './blenderWorld';
import { buildWalkGrid, type WalkGrid } from '../state/pathfind';
import { runStep, zoneRespawns, zoneWalk, type DungeonRun } from '../state/dungeon';
import { CAVES, DUNGEONS, type Dungeon, type Zone } from '../data/dungeons';
import { getTerrainHeight } from '../state/terrain';
import { AGGRO_GRACE_MS, isDown, sendHome } from '../state/monsterAi';
import { clearTelegraph } from './telegraphs';
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
  AIR.uFogHeightFalloff.value = 0;
  // A cave keeps the colour updateAir wrote from CAVE_LIGHT.air, and the density from CAVE_FOG_SCALE.
  if (CAVES.some((c) => c.id === G.zone!.def.id)) return;
  AIR.uAirColor.value.setHex(ZONE_FOG_COLOR);
  AIR.uAirSunColor.value.copy(AIR.uAirColor.value);
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

interface CaveSessionState {
  group: THREE.Group;
  grid: WalkGrid;
  floorMesh: THREE.Mesh;
  monsters: MonsterEntity[];
  interactiveObjects: THREE.Object3D[];
}
const caveStates = new Map<string, CaveSessionState>();

export function enterZone(def: Zone): void {
  if (G.zone) {
    leaveZone();
  }

  const [ox, oz] = def.origin;
  const isCave = CAVES.some((c) => c.id === def.id);

  if (isCave) {
    const existing = caveStates.get(def.id);
    if (existing) {
      existing.group.visible = true;
      for (const m of existing.monsters) {
        G.monstersList.push(m);
        zoneMonsters.add(m);
        G.worldInteractiveObjects.push(m.rig.hitbox);
        m.rig.group.visible = m.logic.state !== 'dead';
        if (m.logic.state !== 'dead') {
          m.labelEl.style.display = '';
        }
      }
      for (const obj of existing.interactiveObjects) {
        G.worldInteractiveObjects.push(obj);
        zoneInteractiveObjects.push(obj);
      }
      overworldGrid = G.walkGrid;
      G.walkGrid = existing.grid;
      G.groundMesh = existing.floorMesh;
      G.worldInteractiveObjects.push(existing.floorMesh);
      zoneFloor = existing.floorMesh;
      player.pos.set(ox + def.entry[0], 0, oz + def.entry[1]);
      player.waypoints.length = 0;
      player.targetEntity = null;
      player.currentSpeed = 0;
      G.aggroGraceUntil = performance.now() + AGGRO_GRACE_MS;
      setSkyVisible(false);
      setCarpetVisible(false);
      setWeatherParticlesVisible(false);
      setCaveWeather(true);
      G.zone = { def, run: null, grid: existing.grid, group: existing.group };
      return;
    }

    const group = new THREE.Group();
    const floorMat = facetMaterial({
      color: 0xffffff,
      map: loadAlbedo(biomeAlbedoId('peak-volcanic'), GROUND_REPEAT),
      shade: 'cut'
    });
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
    assignGroundUvs(floorGeo);
    floorGeo.computeVertexNormals();
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.receiveShadow = true;
    floorMesh.userData = { type: 'ground' };
    group.add(floorMesh);

    const wallMat = albedoMaterial(0x2b2622, 'stone', { shade: 'cut' });
    const wallSegments = computeWallSegments(def.rooms);
    const wallGeos: THREE.BufferGeometry[] = [];
    for (const [x0, z0, x1, z1] of wallSegments) {
      const dx = x1 - x0;
      const dz = z1 - z0;
      const len = Math.hypot(dx, dz);
      if (len < 0.001) continue;
      const geo = new THREE.PlaneGeometry(len, 6);
      geo.translate(len / 2, 3, 0);
      geo.rotateY(-Math.atan2(dz, dx));
      geo.translate(ox + x0, 0, oz + z0);
      wallGeos.push(geo);
    }
    if (wallGeos.length > 0) {
      const wallGeo = mergeGeometries(wallGeos, false);
      wallGeo.computeVertexNormals();
      const wallMesh = new THREE.Mesh(wallGeo, wallMat);
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      group.add(wallMesh);
    }

    loadBlenderWorldTemplate().then((gltf) => {
      if (G.zone?.group !== group) return; // left the zone while the glb loaded
      if (!gltf) throw new Error(`Cave "${def.id}" needs world.glb but it did not load`);
      const spireTemplate = gltf.scene.getObjectByName('World_obsidian_spire');
      if (!spireTemplate) throw new Error(`Cave "${def.id}" node "World_obsidian_spire" is not in world.glb`);
      for (const [x0, z0, x1, z1] of def.solid!) {
        const clone = spireTemplate.clone(true);
        clone.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) m.geometry = m.geometry.clone();
        });
        clone.position.set(ox + (x0 + x1) / 2, 0, oz + (z0 + z1) / 2);
        applyWorldMaterials(clone);
        sealAlbedoUvs(clone);
        group.add(clone);
      }
      const fissureTemplate = gltf.scene.getObjectByName('World_lava_fissure');
      if (!fissureTemplate) throw new Error(`Cave "${def.id}" node "World_lava_fissure" is not in world.glb`);
      const emberMat = facetMaterial({ color: 0xff7a3a, emissive: 0xff5522, emissiveIntensity: 0.85, shade: 'cut' });
      for (const [x0, z0, x1, z1] of wallSegments) {
        const dx = x1 - x0;
        const dz = z1 - z0;
        const len = Math.hypot(dx, dz);
        for (let s = 8; s < len; s += 8) {
          const t = s / len;
          const clone = fissureTemplate.clone(true);
          clone.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.isMesh) {
              m.geometry = m.geometry.clone();
              m.material = emberMat;
            }
          });
          clone.position.set(ox + x0 + dx * t, 0, oz + z0 + dz * t);
          clone.rotation.y = -Math.atan2(dz, dx);
          sealAlbedoUvs(clone);
          group.add(clone);
        }
      }
    });

    const exitDoorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.8, 0.4), wallMat);
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

    overworldGrid = G.walkGrid;
    const walk = zoneWalk(def, []);
    const zoneGrid = buildWalkGrid(walk, ox, oz, def.size);
    G.walkGrid = zoneGrid;

    G.groundMesh = floorMesh;
    G.worldInteractiveObjects.push(floorMesh);
    zoneFloor = floorMesh;

    zoneMonsters = new Set();
    const caveMonsters: MonsterEntity[] = [];
    for (const camp of def.camps) {
      for (const m of camp.members) {
        const idxBefore = G.monstersList.length;
        spawnMonster(m.type, ox + m.x, oz + m.z, {
          campId: `${def.id}:${camp.id}`,
          wander: m.wander,
          respawn: zoneRespawns(def),
          respawnSecs: def.respawnSecs
        });
        if (G.monstersList.length === idxBefore) throw new Error(`enterZone: unknown monster type "${m.type}" in ${def.id}`);
        const spawned = G.monstersList[G.monstersList.length - 1];
        zoneMonsters.add(spawned);
        caveMonsters.push(spawned);
      }
    }

    caveStates.set(def.id, {
      group,
      grid: zoneGrid,
      floorMesh,
      monsters: caveMonsters,
      interactiveObjects: [exitDoorMesh]
    });

    player.pos.set(ox + def.entry[0], 0, oz + def.entry[1]);
    player.waypoints.length = 0;
    player.targetEntity = null;
    player.currentSpeed = 0;
    G.aggroGraceUntil = performance.now() + AGGRO_GRACE_MS;

    setSkyVisible(false);
    setCarpetVisible(false);
    setWeatherParticlesVisible(false);
    setCaveWeather(true);

    G.scene.add(group);
    G.zone = { def, run: null, grid: zoneGrid, group };
    return;
  }

  const dDef = def as Dungeon;
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
  for (const gate of dDef.gates) {
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

  for (const n of dDef.nodes) {
    const idxBefore = G.resourceNodesList.length;
    spawnResourceNode(n.type, ox + n.x, oz + n.z);
    if (G.resourceNodesList.length === idxBefore) throw new Error(`enterZone: unknown node type "${n.type}" in ${def.id}`);
    zoneNodes.add(G.resourceNodesList[G.resourceNodesList.length - 1]);
  }

  // Chest interactive object
  const chestGrp = new THREE.Group();
  chestGrp.position.set(ox + dDef.chest[0], 0, oz + dDef.chest[1]);
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
  setCarpetVisible(false);
  setWeatherParticlesVisible(false);

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

  const isCave = CAVES.some((c) => c.id === def.id);
  if (isCave) {
    const cave = caveStates.get(def.id)!;
    for (const m of cave.monsters) {
      clearTelegraph(m);
      sendHome(m.logic);
      m.pos.x = m.logic.x;
      m.pos.z = m.logic.z;
      m.rig.group.position.set(m.logic.x, getTerrainHeight(m.logic.x, m.logic.z), m.logic.z);
      m.rig.group.visible = false;
      m.labelEl.style.display = 'none';
      G.worldInteractiveObjects.splice(G.worldInteractiveObjects.indexOf(m.rig.hitbox), 1);
      G.monstersList.splice(G.monstersList.indexOf(m), 1);
      zoneMonsters.delete(m);
    }
    for (const obj of zoneInteractiveObjects) {
      G.worldInteractiveObjects.splice(G.worldInteractiveObjects.indexOf(obj), 1);
    }
    zoneInteractiveObjects = [];
    G.worldInteractiveObjects.splice(G.worldInteractiveObjects.indexOf(zoneFloor), 1);
    group.visible = false;
    G.groundMesh = G.terrainMesh;
    G.walkGrid = overworldGrid;
    setSkyVisible(true);
    setCarpetVisible(true);
    setWeatherParticlesVisible(true);
    setCaveWeather(false);
    player.pos.set(def.door.x, getTerrainHeight(def.door.x, def.door.z), def.door.z);
    player.waypoints.length = 0;
    player.targetEntity = null;
    player.currentSpeed = 0;
    G.zone = null;
    return;
  }

  for (const m of zoneMonsters) {
    G.monstersList.splice(G.monstersList.indexOf(m), 1);
    G.worldInteractiveObjects.splice(G.worldInteractiveObjects.indexOf(m.rig.hitbox), 1);
    m.labelEl.remove();
    G.scene.remove(m.rig.group);
    disposeObject3D(m.rig.group);
  }
  zoneMonsters.clear();

  for (const r of zoneNodes) {
    G.resourceNodesList.splice(G.resourceNodesList.indexOf(r), 1);
    const hitbox = r.group.children.find((c) => G.worldInteractiveObjects.includes(c))!;
    G.worldInteractiveObjects.splice(G.worldInteractiveObjects.indexOf(hitbox), 1);
    G.scene.remove(r.group);
    disposeObject3D(r.group);
  }
  zoneNodes.clear();

  for (const obj of zoneInteractiveObjects) {
    G.worldInteractiveObjects.splice(G.worldInteractiveObjects.indexOf(obj), 1);
  }
  zoneInteractiveObjects = [];

  G.scene.remove(group);
  disposeObject3D(group);

  G.worldInteractiveObjects.splice(G.worldInteractiveObjects.indexOf(zoneFloor), 1);
  G.groundMesh = G.terrainMesh;
  G.walkGrid = overworldGrid;

  setSkyVisible(true);
  setCarpetVisible(true);
  setWeatherParticlesVisible(true);

  player.pos.set(def.door.x, getTerrainHeight(def.door.x, def.door.z), def.door.z);
  player.waypoints.length = 0;
  player.targetEntity = null;
  player.currentSpeed = 0;

  G.zone = null;
}

const ARM_STEP = 0.1;
// The camera's near plane (0.5 at fov 50) reaches about 0.48 to the side of the eye; the eye keeps this far from a wall.
const EYE_MARGIN = 0.6;

function eyeClear(x: number, z: number): boolean {
  const w = G.walkGrid.walkable;
  return w(x, z) && w(x + EYE_MARGIN, z) && w(x - EYE_MARGIN, z) && w(x, z + EYE_MARGIN) && w(x, z - EYE_MARGIN);
}

/**
 * In a zone, the camera arm ends at the last point of the ray from the hero that is EYE_MARGIN clear of anything not
 * walkable (a wall, a pillar or a shut gate) on every side, so the eye never stands behind a wall. It may go below
 * distanceMin, down to 0 when the hero stands against a wall.
 */
export function zoneArmLength(horizDist: number): number {
  if (!G.zone) return horizDist;
  const dx = -Math.sin(camState.yaw);
  const dz = -Math.cos(camState.yaw);
  for (let d = 0; d < horizDist; ) {
    const next = Math.min(horizDist, d + ARM_STEP);
    if (!eyeClear(player.pos.x + dx * next, player.pos.z + dz * next)) return d;
    d = next;
  }
  return horizDist;
}

export function handleZoneMonsterDied(m: MonsterEntity): void {
  if (!G.zone!.run) return;
  const def = G.zone!.def as Dungeon;
  const localCampId = m.logic.campId!.slice(`${def.id}:`.length);

  const members = G.monstersList.filter((other) => other.logic.campId === m.logic.campId);
  const allDead = members.every((other) => isDown(other.logic) || other === m);
  if (!allDead) return;

  const opened = runStep(G.zone!.run!, { campDead: localCampId });
  if (opened.length > 0) {
    const toRemove: THREE.Object3D[] = [];
    G.zone!.group.traverse((child) => {
      if (child.userData.gateId && opened.includes(child.userData.gateId)) {
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
  const def = DUNGEONS.find((d) => d.id === id) ?? CAVES.find((c) => c.id === id);
  if (!def) throw new Error(`Unknown zone id: "${id}"`);
  enterZone(def);
}
