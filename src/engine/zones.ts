import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { G, player } from './context';
import { disposeObject3D } from './dispose';
import { albedoMaterial } from './textures';
import { setSkyVisible } from './sky';
import { applyWorldMaterials, loadBlenderWorldTemplate } from './blenderWorld';
import { buildWalkGrid, type WalkGrid } from '../state/pathfind';
import { zoneWalk } from '../state/dungeon';
import { DUNGEONS, type Dungeon } from '../data/dungeons';
import { getTerrainHeight } from '../state/terrain';
import { AGGRO_GRACE_MS } from '../state/monsterAi';

let savedOverworldGrid: WalkGrid | null = null;
let savedFogColor = 0x9ab0c2;
let savedFogDensity = 0.0028;
let currentFloorMesh: THREE.Mesh | null = null;

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
  if (def.gates) {
    for (const gate of def.gates) {
      const [gx0, gz0, gx1, gz1] = gate.rect;
      const w = gx1 - gx0;
      const d = gz1 - gz0;
      const slabGeo = new THREE.BoxGeometry(w, 4, d);
      slabGeo.computeVertexNormals();
      const slab = new THREE.Mesh(slabGeo, stoneMat);
      slab.position.set(ox + (gx0 + gx1) / 2, 2, oz + (gz0 + gz1) / 2);
      slab.castShadow = true;
      slab.receiveShadow = true;
      slab.userData = { gateId: gate.id };
      group.add(slab);
    }
  }

  // 4. Props from optional props list
  const maybeProps = (def as unknown as { props?: { node: string; x: number; z: number; scale?: number; rotY?: number }[] }).props;
  if (maybeProps && Array.isArray(maybeProps)) {
    loadBlenderWorldTemplate().then((gltf) => {
      if (!gltf || G.zone?.group !== group) return;
      for (const prop of maybeProps) {
        const template = gltf.scene.getObjectByName(prop.node);
        if (!template) continue;
        const clone = template.clone(true);
        clone.position.set(ox + prop.x, 0, oz + prop.z);
        if (prop.scale) clone.scale.setScalar(prop.scale);
        if (prop.rotY) clone.rotation.y = prop.rotY;
        applyWorldMaterials(clone);
        group.add(clone);
      }
    });
  }

  // 5. Grid
  if (!savedOverworldGrid) {
    savedOverworldGrid = G.walkGrid;
  }
  const walk = zoneWalk(def, []);
  const zoneGrid = buildWalkGrid(walk, ox, oz, def.size);
  G.walkGrid = zoneGrid;

  // 6. Ground picking registration
  G.groundMesh = floorMesh;
  G.worldInteractiveObjects.push(floorMesh);
  currentFloorMesh = floorMesh;

  // 7. Move hero to entry with aggression grace
  player.pos.set(ox + def.entry[0], 0, oz + def.entry[1]);
  player.waypoints.length = 0;
  player.targetEntity = null;
  player.currentSpeed = 0;
  G.aggroGraceUntil = performance.now() + AGGRO_GRACE_MS;

  // 8. Fog: dense and dark, remember old values
  if (G.scene && G.scene.fog && (G.scene.fog as THREE.FogExp2).isFogExp2) {
    const fog = G.scene.fog as THREE.FogExp2;
    savedFogColor = fog.color.getHex();
    savedFogDensity = fog.density;
    fog.color.setHex(0x0f0c0a);
    fog.density = 0.025;
  }

  // 9. Hide sky dome and horizon apron
  setSkyVisible(false);

  // 10. Add to scene and set G.zone
  if (G.scene) {
    G.scene.add(group);
  }
  G.zone = { def, run: null, grid: zoneGrid, group };
}

export function leaveZone(): void {
  if (!G.zone) return;
  const { def, group } = G.zone;

  if (G.scene) {
    G.scene.remove(group);
  }
  disposeObject3D(group);

  if (currentFloorMesh) {
    const idx = G.worldInteractiveObjects.indexOf(currentFloorMesh);
    if (idx !== -1) {
      G.worldInteractiveObjects.splice(idx, 1);
    }
    currentFloorMesh = null;
  }
  G.groundMesh = G.terrainMesh;

  if (savedOverworldGrid) {
    G.walkGrid = savedOverworldGrid;
    savedOverworldGrid = null;
  } else {
    G.walkGrid = buildWalkGrid();
  }

  if (G.scene && G.scene.fog && (G.scene.fog as THREE.FogExp2).isFogExp2) {
    const fog = G.scene.fog as THREE.FogExp2;
    fog.color.setHex(savedFogColor);
    fog.density = savedFogDensity;
  }

  setSkyVisible(true);

  player.pos.set(def.door.x, getTerrainHeight(def.door.x, def.door.z), def.door.z);
  player.waypoints.length = 0;
  player.targetEntity = null;
  player.currentSpeed = 0;

  G.zone = null;
}

export function enterZoneById(id: string): void {
  const def = DUNGEONS.find((d) => d.id === id);
  if (!def) throw new Error(`Unknown zone id: "${id}"`);
  enterZone(def);
}

if (typeof window !== 'undefined') {
  try {
    const w = window as unknown as { __DEBUG?: Record<string, unknown> };
    let dbg = w.__DEBUG ?? {};
    dbg.enterZone = (id: string) => enterZoneById(id);
    dbg.leaveZone = () => leaveZone();
    Object.defineProperty(window, '__DEBUG', {
      configurable: true,
      enumerable: true,
      get() {
        return dbg;
      },
      set(v: Record<string, unknown>) {
        dbg = Object.assign(v || {}, {
          enterZone: (id: string) => enterZoneById(id),
          leaveZone: () => leaveZone()
        });
      }
    });
  } catch {
    const w = window as unknown as { __DEBUG?: Record<string, unknown> };
    w.__DEBUG = w.__DEBUG || {};
    w.__DEBUG.enterZone = (id: string) => enterZoneById(id);
    w.__DEBUG.leaveZone = () => leaveZone();
  }
}
