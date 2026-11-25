import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { G } from './context';
import { STATE } from '../state/gameState';
import { PALETTE, addCartoonOutline } from './materials';
import {
  BIOME_COLORS,
  assignGroundUvs,
  terrainMaterial,
  albedoMaterial,
  sealAlbedoUvs
} from './textures';
import { getTerrainHeight, onPath, slopeAt, TERRAIN_SEGMENTS, TERRAIN_SIZE } from '../state/terrain';
import { setPhase } from './lighting';
import { presetToPhase } from '../state/dayCycle';
import { PAVED_PLAZA } from './flora';
import { loadBlenderWorldTemplate, upgradeWorldPropWithGltf } from './blenderWorld';
import { el } from '../ui/hud';
import { GFX_TIERS } from '../data/look';
import { currentQuality } from './renderer';
import { buildWater } from './water';

export function getBiomeColor(x: number, z: number, h: number): THREE.Color {
  const dirt = new THREE.Color(PALETTE.dirt);
  const grass = [PALETTE.sageShade, PALETTE.sage, PALETTE.sageLit].map((hex) => new THREE.Color(hex));
  if (h < -0.05) return dirt;
  if (onPath(x, z)) return dirt;
  if (slopeAt(x, z) > 0.55) return new THREE.Color(BIOME_COLORS.crag);
  if (Math.hypot(x - PAVED_PLAZA.x, z - PAVED_PLAZA.z) < PAVED_PLAZA.radius) return dirt;
  if (x > 40 && z > 36) return new THREE.Color(BIOME_COLORS.sand);
  if (x < -40 && z > 36) return new THREE.Color(h > 3.1 ? BIOME_COLORS.lava : BIOME_COLORS.crag);
  if (x < -40 && z < 0) return new THREE.Color(BIOME_COLORS.canopy);
  const band = Math.abs(Math.floor(x / 7) + Math.floor(z / 7) * 2) % 3;
  return grass[band];
}


export function cycleTimeOfDay(): void {
  STATE.timeOfDay = (STATE.timeOfDay + 1) % 3;
  setPhase(presetToPhase(STATE.timeOfDay), false);
  const btn = el('time-of-day-btn');
  if (STATE.timeOfDay === 0) {
    btn.textContent = 'Golden Hour';
  } else if (STATE.timeOfDay === 1) {
    btn.textContent = 'High Noon';
  } else {
    btn.textContent = 'Starry Night';
  }
}

export function buildTerrainAndWater(): void {
  const size = TERRAIN_SIZE;
  const geo = new THREE.PlaneGeometry(size, size, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
  geo.rotateX(-Math.PI / 2);

  // The quad diagonal stays three's stock split: telegraphs.ts gridHeight lifts fills by that rule (A11.3).

  const posAttr = geo.attributes.position;
  const colors: number[] = [];
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const vy = getTerrainHeight(vx, vz);
    posAttr.setY(i, vy);
    const col = getBiomeColor(vx, vz, vy);
    colors.push(col.r, col.g, col.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  assignGroundUvs(geo);

  const mat = terrainMaterial();
  G.terrainMesh = new THREE.Mesh(geo, mat);
  G.terrainMesh.receiveShadow = true;
  G.terrainMesh.castShadow = GFX_TIERS[currentQuality].terrainCasts;
  G.terrainMesh.userData = { type: 'ground' };
  G.scene.add(G.terrainMesh);
  G.worldInteractiveObjects.push(G.terrainMesh);

  buildWater();

  // Arched Wooden & Stone Footbridge over the River at (28, 0)
  buildRiverBridge(28, 0);
}

export function buildRiverBridge(bx: number, bz: number): void {
  const grp = new THREE.Group();
  grp.position.set(bx, 0, bz);
  const woodMat = albedoMaterial(0x42352a, 'wood', { shade: 'cut' });
  const stoneMat = albedoMaterial(0x505a63, 'stone', { shade: 'cut' });

  for (let i = -7; i <= 7; i++) {
    const t = i / 7;
    const archY = Math.cos(t * Math.PI * 0.5) * 1.15 - 0.1;
    const plank = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 3.8, 6), woodMat);
    plank.rotation.x = Math.PI / 2;
    plank.position.set(i * 1.0, archY, 0);
    plank.castShadow = true;
    plank.receiveShadow = true;
    grp.add(plank);
  }
  [-1.8, 1.8].forEach((oz: number) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-7.2, 0.8, oz),
      new THREE.Vector3(0, 2.05, oz),
      new THREE.Vector3(7.2, 0.8, oz)
    ]);
    const rail = new THREE.Mesh(new THREE.TubeGeometry(curve, 6, 0.1, 5, false), stoneMat);
    rail.castShadow = true;
    grp.add(rail);
  });
  sealAlbedoUvs(grp);
  G.scene.add(grp);
  addCartoonOutline(grp, 0.038);
  loadBlenderWorldTemplate().then((gltf: GLTF | null) => {
    if (!gltf) return;
    upgradeWorldPropWithGltf(grp, 'World_river_bridge', gltf, { outlineThickness: 0.035 });
  });
}
